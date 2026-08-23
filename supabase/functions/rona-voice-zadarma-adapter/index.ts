// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import OpenAI from "openai";
import { createHash, createHmac } from "node:crypto";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");

const sql = postgres(DB, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10, max_lifetime: 60 });
const VERSION = "1.3.0";
const PROVIDER = "ZADARMA_KG";
const PROVIDER_MODE = "ZADARMA_KG_SIP_BRIDGE";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const TWILIO_CALL_RE = /^CA[0-9a-f]{32}$/i;
const BUSINESS_ROLES = new Set(["OPERATIONS_DIRECTOR", "FINANCE", "LEGAL", "MARKET_ANALYST", "RAIL_LOGISTICS"]);
const ROLE_CODE = Object.freeze({ OPERATIONS_DIRECTOR: "OPS", FINANCE: "FIN", LEGAL: "LEGAL", MARKET_ANALYST: "MARKET", RAIL_LOGISTICS: "RAIL" });
const CODE_ROLE = Object.freeze(Object.fromEntries(Object.entries(ROLE_CODE).map(([k, v]) => [v, k])));
const BASE = `${SUPA_URL}/functions/v1/rona-voice-zadarma-adapter`;

function runtimeKey(kind) {
  const legacy = kind === "pub" ? Deno.env.get("SUPABASE_ANON_KEY") : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get(kind === "pub" ? "SUPABASE_PUBLISHABLE_KEYS" : "SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.default) return parsed.default;
  }
  throw new Error("key missing");
}

function send(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", pragma: "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
function xml(status, body) {
  return new Response(body, { status, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", pragma: "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
function xmlEscape(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;"); }
function pathOf(req) { const p = new URL(req.url).pathname, marker = "/rona-voice-zadarma-adapter", i = p.indexOf(marker); return i >= 0 ? (p.slice(i + marker.length) || "/") : p; }
function safeE164(v) { const s = String(v || "").trim(); return E164_RE.test(s) ? s : null; }
function digits(v) { return String(v || "").replace(/[^0-9]/g, ""); }
function claims(token) { try { const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4))); } catch { return {}; } }

async function adminContext(req) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const client = createClient(SUPA_URL, runtimeKey("pub"), { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const sid = claims(token).session_id;
  if (typeof sid !== "string" || !UUID_RE.test(sid)) return null;
  const rows = await sql`
    select a.portal_user_id,a.display_name,a.roles,s.not_after
    from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a
    join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid
    where a.session_allowed and (s.not_after is null or s.not_after>now())
  `;
  if (rows.length !== 1 || !(rows[0].roles || []).map(String).includes("ADMIN")) return null;
  return { authUserId: String(data.user.id), userId: String(rows[0].portal_user_id), displayName: String(rows[0].display_name || ""), sessionId: sid };
}

async function jsonBody(req) { try { const v = await req.json(); if (!v || Array.isArray(v) || typeof v !== "object") throw new Error(); return v; } catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); } }
function reqIds(req) { const r = req.headers.get("x-request-id"), c = req.headers.get("x-correlation-id"); return { requestId: r && UUID_RE.test(r) ? r : crypto.randomUUID(), correlationId: c && UUID_RE.test(c) ? c : null }; }
async function audit(tx, ctx, action, entityType, entityId, req, metadata = {}, result = "SUCCESS", severity = "INFO") {
  const { requestId, correlationId } = reqIds(req);
  await tx`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata,severity,result)
    values(${ctx.userId}::uuid,'ADMIN',${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,${sql.json(metadata)}::jsonb,${severity}::portal_private.audit_severity_enum,${result}::portal_private.audit_result_enum)`;
}

async function control() {
  const rows = await sql`
    select enabled,inbound_enabled,outbound_enabled,provider,provider_state,provider_mode,provider_number_e164,provider_verified_at,
           default_inbound_role::text as default_inbound_role,openai_realtime_state,model_execution_state,activation_gate,identity_policy,
           recording_policy,transcript_policy,human_failover_state,configured_at,activated_at,updated_at
    from portal_private.voice_gateway_control where singleton=true limit 1
  `;
  return rows[0] || null;
}

function openAIConfigPresent() { return Boolean(Deno.env.get("OPENAI_API_KEY") && Deno.env.get("OPENAI_WEBHOOK_SECRET") && /^proj_[A-Za-z0-9_-]{3,160}$/.test(String(Deno.env.get("OPENAI_PROJECT_ID") || ""))); }
function zadarmaApiConfigPresent() { return Boolean(Deno.env.get("ZADARMA_API_KEY") && Deno.env.get("ZADARMA_API_SECRET") && safeE164(Deno.env.get("ZADARMA_DID_E164"))); }
function zadarmaSipConfigPresent() { return Boolean(Deno.env.get("ZADARMA_SIP_USER") && Deno.env.get("ZADARMA_SIP_PASSWORD") && /^[A-Za-z0-9.-]+\.zadarma\.com$/i.test(String(Deno.env.get("ZADARMA_SIP_OUTBOUND_HOST") || "sip.zadarma.com"))); }
function twilioConfigPresent() { return Boolean(/^AC[0-9a-f]{32}$/i.test(String(Deno.env.get("TWILIO_ACCOUNT_SID") || "")) && Deno.env.get("TWILIO_AUTH_TOKEN") && safeE164(Deno.env.get("TWILIO_FROM_E164"))); }
function providerConfigured(c) { return Boolean(c?.provider === PROVIDER && c?.provider_mode === PROVIDER_MODE && zadarmaApiConfigPresent()); }
function inboundReady(c) { return Boolean(c && c.enabled && c.inbound_enabled && c.provider_state === "READY" && c.openai_realtime_state === "READY" && c.model_execution_state === "READY" && c.activation_gate === "PRODUCTION_READY" && providerConfigured(c) && openAIConfigPresent()); }
function outboundReady(c) { return Boolean(c && c.enabled && c.outbound_enabled && c.provider_state === "READY" && c.openai_realtime_state === "READY" && c.model_execution_state === "READY" && c.activation_gate === "PRODUCTION_READY" && providerConfigured(c) && openAIConfigPresent() && zadarmaSipConfigPresent() && twilioConfigPresent()); }
function inboundTestReady(c, caller) { const allow = safeE164(Deno.env.get("RONA_VOICE_TEST_CALLER_E164")); return Boolean(c && c.activation_gate === "INBOUND_TEST" && c.provider_state === "TESTING" && c.openai_realtime_state === "TESTING" && c.model_execution_state === "TESTING" && providerConfigured(c) && openAIConfigPresent() && allow && caller === allow); }
function outboundTestReady(c, destination) { const allow = safeE164(Deno.env.get("RONA_VOICE_TEST_CALLEE_E164")); return Boolean(c && c.activation_gate === "OUTBOUND_TEST" && c.provider_state === "TESTING" && c.openai_realtime_state === "TESTING" && c.model_execution_state === "TESTING" && providerConfigured(c) && openAIConfigPresent() && zadarmaSipConfigPresent() && twilioConfigPresent() && allow && destination === allow); }

function openAISipTarget() {
  const project = String(Deno.env.get("OPENAI_PROJECT_ID") || "").trim();
  if (!/^proj_[A-Za-z0-9_-]{3,160}$/.test(project)) throw Object.assign(new Error("OPENAI_PROJECT_ID_INVALID"), { status: 503 });
  return `sip:${project}@sip.api.openai.com;transport=tls`;
}
function zadarmaRouteTarget() { return openAISipTarget().replace(/^sip:/, ""); }
function sipTarget(providerCallId, role, requestId = null) {
  const params = new URLSearchParams();
  params.set("x-ph-ronadirection", requestId ? "OUTBOUND" : "INBOUND");
  params.set("x-ph-ronaprovidercall", providerCallId);
  params.set("x-ph-ronarole", ROLE_CODE[role] || "OPS");
  if (requestId) params.set("x-ph-ronarequest", requestId);
  return `${openAISipTarget()}?${params.toString()}`;
}
function voiceInstructions(role, direction, purpose = null, test = false) {
  const roleName = ({ OPERATIONS_DIRECTOR: "Operations Director", FINANCE: "Finance", LEGAL: "Legal", MARKET_ANALYST: "Market Analyst", RAIL_LOGISTICS: "Rail Logistics" })[role] || "Operations Director";
  const lines = [
    `You are the external telephone endpoint for the fixed RONA Trade ${roleName} role.`, `Call direction: ${direction}.`,
    "Speak naturally and concisely in the caller's language when clear; otherwise use Russian.",
    "This voice session has no internal RONA data tools. Never invent prices, balances, contracts, shipment status, legal conclusions, credentials, provider state, user identity, or any company fact not explicitly present in the call context.",
    "A phone number, caller name, email address, spoken company name, SIP header, address-book match, or prior call history is not authoritative identity.",
    "Do not disclose client-specific contracts, payments, private prices, documents, bank data, internal diagnostics, tokens, secrets, QA identities, or protected information.",
    "Do not perform or promise legal, commercial, financial, IAM, contract, publication, access, binding, or other authoritative mutations.",
    "Internal staff communication must remain in the audited RONA network coordination contour and must never be moved to internal email.",
    "If protected data, an authoritative decision, or unknown information is required, state that verification is required and do not guess.",
    "Do not claim a follow-up task, contract change, payment action, publication, or internal handoff was created unless a real authorized tool confirms it."
  ];
  if (purpose) lines.push(`Authorized outbound call purpose: ${String(purpose).slice(0, 500)}. Stay within this purpose.`);
  if (test) lines.push("This is a controlled technical acceptance call. Do not disclose business data and keep the conversation limited to voice-path verification.");
  return lines.join(" ");
}

async function openAIRealtimeCall(callId, action, body = undefined) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw Object.assign(new Error("OPENAI_API_KEY_MISSING"), { status: 503 });
  const r = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/${action}`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`OPENAI_${action.toUpperCase()}_FAILED`), { status: r.status, data });
  return data;
}

function zadarmaParamString(params = {}) {
  const usp = new URLSearchParams();
  for (const k of Object.keys(params).sort()) if (params[k] !== undefined && params[k] !== null) usp.append(k, String(params[k]));
  return usp.toString();
}
function zadarmaAuthorization(methodPath, paramsString) {
  const key = String(Deno.env.get("ZADARMA_API_KEY") || ""), secret = String(Deno.env.get("ZADARMA_API_SECRET") || "");
  if (!key || !secret) throw Object.assign(new Error("ZADARMA_API_CREDENTIALS_NOT_CONFIGURED"), { status: 503 });
  const md5 = createHash("md5").update(paramsString).digest("hex");
  const signature = createHmac("sha1", secret).update(methodPath + paramsString + md5).digest("base64");
  return `${key}:${signature}`;
}
async function zadarmaApi(method, methodPath, params = {}) {
  const ps = zadarmaParamString(params), upper = method.toUpperCase();
  const url = `https://api.zadarma.com${methodPath}${upper === "GET" && ps ? `?${ps}` : ""}`;
  const r = await fetch(url, { method: upper, headers: { authorization: zadarmaAuthorization(methodPath, ps), accept: "application/json", ...(upper === "GET" ? {} : { "content-type": "application/x-www-form-urlencoded" }) }, body: upper === "GET" ? undefined : ps });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok && String(data?.status || "").toLowerCase() !== "error", status: r.status, data };
}
async function probeZadarmaDid() {
  const did = safeE164(Deno.env.get("ZADARMA_DID_E164"));
  if (!did) return { ok: false, code: "ZADARMA_DID_E164_MISSING" };
  const r = await zadarmaApi("GET", "/v1/direct_numbers/");
  if (!r.ok) return { ok: false, code: "ZADARMA_API_PROBE_FAILED", status: r.status };
  const numbers = Array.isArray(r.data?.info) ? r.data.info : [];
  const row = numbers.find(x => digits(x?.number) === digits(did));
  if (!row) return { ok: false, code: "ZADARMA_DID_NOT_FOUND" };
  if (String(row.status || "").toLowerCase() !== "on") return { ok: false, code: "ZADARMA_DID_NOT_ACTIVE", didStatus: String(row.status || "unknown") };
  return { ok: true, did, status: "on", channels: Number(row.channels || 0) || null, sipBound: Boolean(row.sip) };
}

async function hmacBase64(secret, message, hash) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  let binary = ""; for (const b of sig) binary += String.fromCharCode(b); return btoa(binary);
}
function timingSafeStringEqual(a, b) { const aa = new TextEncoder().encode(String(a || "")), bb = new TextEncoder().encode(String(b || "")); if (!aa.length || aa.length !== bb.length) return false; let d = 0; for (let i = 0; i < aa.length; i++) d |= aa[i] ^ bb[i]; return d === 0; }
async function verifyTwilio(req, raw) {
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!token) return { ok: false, code: "TWILIO_CREDENTIALS_NOT_CONFIGURED" };
  const supplied = String(req.headers.get("x-twilio-signature") || "");
  if (!supplied) return { ok: false, code: "TWILIO_SIGNATURE_MISSING" };
  let message = req.url;
  const ct = String(req.headers.get("content-type") || "").toLowerCase();
  if (req.method === "POST" && ct.includes("application/x-www-form-urlencoded")) {
    const entries = [...new URLSearchParams(raw).entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    for (const [k, v] of entries) message += `${k}${v}`;
  }
  const expected = await hmacBase64(token, message, "SHA-1");
  return timingSafeStringEqual(supplied, expected) ? { ok: true } : { ok: false, code: "TWILIO_SIGNATURE_INVALID" };
}
function formMap(raw) { return Object.fromEntries([...new URLSearchParams(raw).entries()]); }

async function recordCallEvent(callId, type, source, metadata = {}) { await sql`insert into portal_private.voice_call_events(voice_call_id,event_type,event_source,metadata) values(${callId}::uuid,${type},${source},${sql.json(metadata)}::jsonb)`; }
async function upsertCall(providerCallId, direction, fromE164, toE164, role, status, metadata = {}) {
  const rows = await sql`insert into portal_private.voice_calls(provider_call_id,direction,from_e164,to_e164,routed_role,identity_state,status,metadata)
    values(${providerCallId},${direction},${fromE164},${toE164},${role}::portal_private.ai_business_role_enum,'UNVERIFIED',${status},${sql.json(metadata)}::jsonb)
    on conflict(provider_call_id) do update set routed_role=excluded.routed_role,status=excluded.status,updated_at=now(),metadata=portal_private.voice_calls.metadata||excluded.metadata returning id`;
  return String(rows[0].id);
}
function unavailableXml() { return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="ru-RU">Телефонный сервис RONA Trade временно недоступен. Пожалуйста, позвоните позже.</Say><Hangup/></Response>`; }
function bridgeXml(callSid, role, requestId) {
  const action = `${BASE}/twilio/dial-status?rid=${encodeURIComponent(requestId)}`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial action="${xmlEscape(action)}" method="POST" timeout="30" timeLimit="3600"><Sip>${xmlEscape(sipTarget(callSid, role, requestId))}</Sip></Dial></Response>`;
}

function sipHeaderMap(headers) {
  const out = {};
  for (const h of Array.isArray(headers) ? headers : []) {
    const n = String(h?.name || "").trim().toLowerCase().replace(/_/g, "-");
    if (n) out[n] = String(h?.value || "").trim();
  }
  return out;
}
function sipIdentity(value) {
  const m = String(value || "").match(/<?sip:(\+?[0-9]+)@([^;>]+)[^>]*>?/i);
  if (!m) return { e164: null, host: null };
  const e164 = safeE164(m[1].startsWith("+") ? m[1] : `+${m[1]}`);
  return { e164, host: String(m[2] || "").toLowerCase() };
}
async function resolveOpenAIBinding(data) {
  const h = sipHeaderMap(data?.sip_headers), rid = String(h["x-ph-ronarequest"] || ""), twilioCall = String(h["x-ph-ronaprovidercall"] || ""), roleCode = String(h["x-ph-ronarole"] || "").toUpperCase();
  if (UUID_RE.test(rid)) {
    const rows = await sql`select id,target_role::text as role,purpose,state,authorization_state,dispatch_call_id,destination_e164 from portal_private.voice_outbound_requests where id=${rid}::uuid and provider_name=${PROVIDER} limit 1`;
    if (rows.length === 1 && rows[0].authorization_state === "AUTHORIZED" && ["AUTHORIZED","DISPATCHED"].includes(String(rows[0].state))) return { direction: "OUTBOUND", role: String(rows[0].role), purpose: String(rows[0].purpose), requestId: String(rows[0].id), voiceCallId: rows[0].dispatch_call_id ? String(rows[0].dispatch_call_id) : null, destination: String(rows[0].destination_e164), providerCallId: twilioCall };
  }
  const did = safeE164(Deno.env.get("ZADARMA_DID_E164"));
  const calledDid = safeE164(String(h["called-did"] || "").startsWith("+") ? h["called-did"] : h["called-did"] ? `+${digits(h["called-did"])}` : "");
  const from = sipIdentity(h.from), callIdHeader = String(h["call-id"] || "").trim();
  const trustedHost = Boolean(from.host && (from.host === "sip.zadarma.com" || from.host === "pbx.zadarma.com" || from.host.endsWith(".zadarma.com")));
  if (did && calledDid === did && trustedHost && callIdHeader && callIdHeader.length <= 500) {
    const c = await control();
    const role = BUSINESS_ROLES.has(String(c?.default_inbound_role || "")) ? String(c.default_inbound_role) : "OPERATIONS_DIRECTOR";
    return { direction: "INBOUND", role, purpose: null, requestId: null, voiceCallId: null, destination: did, providerCallId: `ZADARMA:${callIdHeader}`, fromE164: from.e164 };
  }
  return null;
}
async function rejectOpenAI(callId, voiceCallId, reason) {
  try { await openAIRealtimeCall(callId, "reject", { status_code: 603 }); } catch {}
  if (voiceCallId) { await sql`update portal_private.voice_calls set status='REJECTED',last_error_code=${reason},ended_at=now() where id=${voiceCallId}::uuid`; await recordCallEvent(voiceCallId, "CALL_REJECTED_FAIL_CLOSED", "RONA_GATEWAY", { reason }); }
}

async function handleOpenAIWebhook(req) {
  const apiKey = Deno.env.get("OPENAI_API_KEY"), webhookSecret = Deno.env.get("OPENAI_WEBHOOK_SECRET");
  if (!apiKey || !webhookSecret) return send(503, { ok: false, code: "VOICE_OPENAI_CREDENTIALS_NOT_CONFIGURED" });
  const raw = await req.text(); let event;
  try { event = new OpenAI({ apiKey, webhookSecret, maxRetries: 0 }).webhooks.unwrap(raw, req.headers); } catch { return send(400, { ok: false, code: "INVALID_OPENAI_WEBHOOK_SIGNATURE" }); }
  const eventType = String(event?.type || ""); if (eventType !== "realtime.call.incoming") return send(200, { ok: true, ignored: true, eventType });
  const data = event?.data || {}, callId = String(data.call_id || data.id || data.call?.id || "").trim(); if (!callId || callId.length > 200) return send(400, { ok: false, code: "OPENAI_CALL_ID_MISSING" });
  const binding = await resolveOpenAIBinding(data);
  if (!binding || !BUSINESS_ROLES.has(binding.role)) { try { await openAIRealtimeCall(callId, "reject", { status_code: 603 }); } catch {} return send(200, { ok: true, accepted: false, code: "TRUSTED_TELEPHONY_BINDING_REQUIRED" }); }
  let voiceCallId = binding.voiceCallId;
  if (!voiceCallId) voiceCallId = await upsertCall(binding.providerCallId, "INBOUND", binding.fromE164 || null, binding.destination, binding.role, "RECEIVED", { provider: PROVIDER, transport: "DIRECT_OPENAI_SIP", identity_source: "NONE", called_did_verified: true });
  await sql`update portal_private.voice_calls set openai_call_id=${callId},routed_role=${binding.role}::portal_private.ai_business_role_enum,status='RECEIVED' where id=${voiceCallId}::uuid`;
  const c = await control();
  const test = binding.direction === "INBOUND" ? inboundTestReady(c, binding.fromE164 || null) : outboundTestReady(c, binding.destination);
  const ready = binding.direction === "INBOUND" ? inboundReady(c) : outboundReady(c);
  if (!ready && !test) { await rejectOpenAI(callId, voiceCallId, "VOICE_GATE_NOT_READY"); return send(200, { ok: true, accepted: false, code: "VOICE_GATE_NOT_READY" }); }
  await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_INCOMING", "OPENAI", { provider: PROVIDER, direction: binding.direction, role: binding.role, request_id: binding.requestId, test });
  const model = Deno.env.get("RONA_VOICE_REALTIME_MODEL") || "gpt-realtime-2.1";
  try {
    await openAIRealtimeCall(callId, "accept", { type: "realtime", model, instructions: voiceInstructions(binding.role, binding.direction, binding.purpose, test), output_modalities: ["audio"], max_output_tokens: 1024, tool_choice: "none", tracing: null });
    await sql`update portal_private.voice_calls set status='ACCEPTED',answered_at=coalesce(answered_at,now()),last_error_code=null where id=${voiceCallId}::uuid`;
    await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_ACCEPTED", "RONA_GATEWAY", { provider: PROVIDER, model, role: binding.role, tools: "NONE", test });
    return send(200, { ok: true, accepted: true, test });
  } catch {
    await sql`update portal_private.voice_calls set status='FAILED',last_error_code='OPENAI_ACCEPT_FAILED',ended_at=now() where id=${voiceCallId}::uuid`;
    await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_ACCEPT_FAILED", "RONA_GATEWAY", { provider: PROVIDER });
    return send(502, { ok: false, code: "OPENAI_ACCEPT_FAILED" });
  }
}

function twilioBasicAuth() { const sid = String(Deno.env.get("TWILIO_ACCOUNT_SID") || ""), token = String(Deno.env.get("TWILIO_AUTH_TOKEN") || ""); if (!/^AC[0-9a-f]{32}$/i.test(sid) || !token) throw Object.assign(new Error("TWILIO_CREDENTIALS_NOT_CONFIGURED"), { status: 503 }); return `Basic ${btoa(`${sid}:${token}`)}`; }
async function twilioApi(path, init = {}) {
  const sid = String(Deno.env.get("TWILIO_ACCOUNT_SID") || "");
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}${path}`, { ...init, headers: { authorization: twilioBasicAuth(), accept: "application/json", ...(init.body ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, data };
}
async function dispatchOutbound(requestId, destination) {
  const from = safeE164(Deno.env.get("TWILIO_FROM_E164")); if (!from) throw Object.assign(new Error("TWILIO_FROM_E164_MISSING"), { status: 503 });
  const host = String(Deno.env.get("ZADARMA_SIP_OUTBOUND_HOST") || "sip.zadarma.com").trim().toLowerCase(); if (!/^[A-Za-z0-9.-]+\.zadarma\.com$/.test(host)) throw Object.assign(new Error("ZADARMA_SIP_HOST_INVALID"), { status: 503 });
  const user = String(Deno.env.get("ZADARMA_SIP_USER") || ""), pass = String(Deno.env.get("ZADARMA_SIP_PASSWORD") || ""); if (!user || !pass) throw Object.assign(new Error("ZADARMA_SIP_CREDENTIALS_NOT_CONFIGURED"), { status: 503 });
  const form = new URLSearchParams();
  form.set("To", `sip:${destination}@${host}`); form.set("From", from); form.set("Url", `${BASE}/twilio/outbound/answer?rid=${encodeURIComponent(requestId)}`); form.set("Method", "POST");
  form.set("StatusCallback", `${BASE}/twilio/call-status?rid=${encodeURIComponent(requestId)}`); form.set("StatusCallbackMethod", "POST");
  for (const e of ["initiated", "ringing", "answered", "completed"]) form.append("StatusCallbackEvent", e);
  form.set("SipAuthUsername", user); form.set("SipAuthPassword", pass);
  return await twilioApi("/Calls.json", { method: "POST", body: form.toString() });
}

async function handleOutboundAnswer(req) {
  const raw = await req.text(), sig = await verifyTwilio(req, raw);
  if (!sig.ok) return send(sig.code === "TWILIO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const rid = String(new URL(req.url).searchParams.get("rid") || ""); if (!UUID_RE.test(rid)) return send(400, { ok: false, code: "VOICE_REQUEST_ID_INVALID" });
  const f = formMap(raw), callSid = String(f.CallSid || ""); if (!TWILIO_CALL_RE.test(callSid)) return send(400, { ok: false, code: "TWILIO_CALL_SID_INVALID" });
  const rows = await sql`select id,target_role::text as target_role,destination_e164,purpose,state,authorization_state from portal_private.voice_outbound_requests where id=${rid}::uuid and provider_name=${PROVIDER} limit 1`;
  if (rows.length !== 1 || rows[0].authorization_state !== "AUTHORIZED" || !["AUTHORIZED","DISPATCHED"].includes(String(rows[0].state))) return xml(200, unavailableXml());
  const c = await control(); const destination = String(rows[0].destination_e164); if (!outboundReady(c) && !outboundTestReady(c, destination)) return xml(200, unavailableXml());
  const role = String(rows[0].target_role), did = safeE164(Deno.env.get("ZADARMA_DID_E164"));
  const id = await upsertCall(callSid, "OUTBOUND", did, destination, role, "RINGING", { provider: PROVIDER, request_id: rid, pstn_egress: "ZADARMA_SIP", control_leg: "TWILIO" });
  await sql`update portal_private.voice_outbound_requests set dispatch_call_id=${id}::uuid,state='DISPATCHED',last_error_code=null where id=${rid}::uuid`;
  await recordCallEvent(id, "ZADARMA_OUTBOUND_ANSWERED_FOR_OPENAI_BRIDGE", "TELEPHONY_PROVIDER", { request_id: rid, role, twilio_call_sid_recorded: true });
  return xml(200, bridgeXml(callSid, role, rid));
}
function terminalTwilioStatus(s) { return ["completed", "busy", "failed", "no-answer", "canceled"].includes(s); }
async function handleStatus(req, dial = false) {
  const raw = await req.text(), sig = await verifyTwilio(req, raw);
  if (!sig.ok) return send(sig.code === "TWILIO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const f = formMap(raw), callSid = String(f.CallSid || f.ParentCallSid || ""), status = String(dial ? (f.DialCallStatus || f.CallStatus || "unknown") : (f.CallStatus || "unknown")).toLowerCase().slice(0, 80);
  if (TWILIO_CALL_RE.test(callSid)) {
    const rows = await sql`select id from portal_private.voice_calls where provider_call_id=${callSid} limit 1`;
    if (rows.length === 1) {
      const id = String(rows[0].id); await recordCallEvent(id, dial ? "TWILIO_OPENAI_BRIDGE_STATUS" : "TWILIO_ZADARMA_LEG_STATUS", "TELEPHONY_PROVIDER", { status });
      if (terminalTwilioStatus(status)) await sql`update portal_private.voice_calls set status=${status === 'completed' ? 'COMPLETED' : 'FAILED'},ended_at=now(),last_error_code=${status === 'completed' ? null : `TWILIO_${status.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`} where id=${id}::uuid`;
      else if (["in-progress", "answered"].includes(status)) await sql`update portal_private.voice_calls set status='ACTIVE',answered_at=coalesce(answered_at,now()),last_error_code=null where id=${id}::uuid`;
    }
  }
  const rid = String(new URL(req.url).searchParams.get("rid") || "");
  if (UUID_RE.test(rid) && terminalTwilioStatus(status)) await sql`update portal_private.voice_outbound_requests set state=${status === 'completed' ? 'COMPLETED' : 'FAILED'},last_error_code=${status === 'completed' ? null : `TWILIO_${status.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`} where id=${rid}::uuid`;
  return xml(200, `<?xml version="1.0" encoding="UTF-8"?><Response/>`);
}

async function handlePrepare(req) {
  const ctx = await adminContext(req); if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" });
  const presence = { zadarmaApiKey: Boolean(Deno.env.get("ZADARMA_API_KEY")), zadarmaApiSecret: Boolean(Deno.env.get("ZADARMA_API_SECRET")), zadarmaDid: Boolean(safeE164(Deno.env.get("ZADARMA_DID_E164"))), openaiApiKey: Boolean(Deno.env.get("OPENAI_API_KEY")), openaiWebhookSecret: Boolean(Deno.env.get("OPENAI_WEBHOOK_SECRET")), openaiProjectId: Boolean(/^proj_[A-Za-z0-9_-]{3,160}$/.test(String(Deno.env.get("OPENAI_PROJECT_ID") || ""))), twilioOutbound: twilioConfigPresent(), zadarmaSipOutbound: zadarmaSipConfigPresent() };
  if (!presence.zadarmaApiKey || !presence.zadarmaApiSecret || !presence.zadarmaDid || !presence.openaiApiKey || !presence.openaiWebhookSecret || !presence.openaiProjectId) return send(409, { ok: false, code: "VOICE_INBOUND_EXTERNAL_CREDENTIALS_INCOMPLETE", presence });
  const zd = await probeZadarmaDid(); if (!zd.ok) return send(409, { ok: false, code: zd.code, didStatus: zd.didStatus || null, providerStatus: zd.status || null });
  const model = Deno.env.get("RONA_VOICE_REALTIME_MODEL") || "gpt-realtime-2.1";
  const oa = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` } });
  if (!oa.ok) return send(409, { ok: false, code: "OPENAI_REALTIME_MODEL_PROBE_FAILED", openaiStatus: oa.status });
  await sql.begin(async tx => {
    await tx`update portal_private.voice_gateway_control set provider=${PROVIDER},provider_mode=${PROVIDER_MODE},provider_state='CONFIGURED',provider_number_e164=${zd.did},provider_verified_at=now(),openai_realtime_state='CONFIGURED',model_execution_state='TESTING',activation_gate='FOUNDATION',enabled=false,inbound_enabled=false,outbound_enabled=false,configured_at=coalesce(configured_at,now()),updated_by=${ctx.userId}::uuid where singleton=true`;
    await audit(tx, ctx, "VOICE_ZADARMA_KG_PROVIDER_PROBE_PASSED", "VOICE_GATEWAY", PROVIDER, req, { provider: PROVIDER, model, number_present: true, channels: zd.channels, outbound_dependencies_present: Boolean(presence.twilioOutbound && presence.zadarmaSipOutbound) });
  });
  return send(200, { ok: true, provider: PROVIDER, providerState: "CONFIGURED", openaiRealtimeState: "CONFIGURED", modelExecutionState: "TESTING", activationGate: "FOUNDATION", inboundRouteConfigured: false, liveCallingEnabled: false, outboundDependenciesPresent: Boolean(presence.twilioOutbound && presence.zadarmaSipOutbound) });
}

async function handleRouteOpenAI(req) {
  const ctx = await adminContext(req); if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" });
  const c = await control(); if (!c || !providerConfigured(c) || !openAIConfigPresent()) return send(409, { ok: false, code: "VOICE_PROVIDER_PREPARE_REQUIRED" });
  const did = safeE164(Deno.env.get("ZADARMA_DID_E164")), target = zadarmaRouteTarget();
  const r = await zadarmaApi("PUT", "/v1/direct_numbers/set_sip_id/", { number: did, sip_id: target, test_mode: "off" });
  if (!r.ok) {
    await sql.begin(async tx => { await audit(tx, ctx, "VOICE_ZADARMA_INBOUND_ROUTE_FAILED", "VOICE_GATEWAY", PROVIDER, req, { provider: PROVIDER, http_status: r.status, target_host: "sip.api.openai.com" }, "FAILURE", "ERROR"); });
    return send(409, { ok: false, code: "ZADARMA_INBOUND_ROUTE_CONFIGURATION_FAILED", providerStatus: r.status });
  }
  await sql.begin(async tx => {
    await tx`update portal_private.voice_gateway_control set provider_state='TESTING',openai_realtime_state='TESTING',model_execution_state='TESTING',activation_gate='INBOUND_TEST',enabled=false,inbound_enabled=false,outbound_enabled=false,updated_by=${ctx.userId}::uuid where singleton=true`;
    await audit(tx, ctx, "VOICE_ZADARMA_INBOUND_ROUTE_CONFIGURED", "VOICE_GATEWAY", PROVIDER, req, { provider: PROVIDER, target_host: "sip.api.openai.com", transport: "TLS", live_calling_enabled: false });
  });
  return send(200, { ok: true, provider: PROVIDER, routeConfigured: true, targetHost: "sip.api.openai.com", transport: "TLS", activationGate: "INBOUND_TEST", liveCallingEnabled: false });
}

async function handleAdminHealth(req) {
  const ctx = await adminContext(req); if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" }); const c = await control(); if (!c) return send(503, { ok: false, code: "VOICE_CONTROL_MISSING" });
  return send(200, { ok: true, service: "rona-voice-zadarma-adapter", version: VERSION, control: { enabled: Boolean(c.enabled), inboundEnabled: Boolean(c.inbound_enabled), outboundEnabled: Boolean(c.outbound_enabled), provider: String(c.provider), providerMode: String(c.provider_mode), providerState: String(c.provider_state), providerNumberConfigured: Boolean(c.provider_number_e164), defaultInboundRole: String(c.default_inbound_role), openaiRealtimeState: String(c.openai_realtime_state), modelExecutionState: String(c.model_execution_state), activationGate: String(c.activation_gate), recordingPolicy: String(c.recording_policy), transcriptPolicy: String(c.transcript_policy) }, capabilities: { zadarmaApiCredentialsPresent: zadarmaApiConfigPresent(), zadarmaSipCredentialsPresent: zadarmaSipConfigPresent(), twilioOutboundCredentialsPresent: twilioConfigPresent(), openaiCredentialsPresent: openAIConfigPresent(), inboundProductionReady: inboundReady(c), outboundProductionReady: outboundReady(c), inboundTestCallerConfigured: Boolean(safeE164(Deno.env.get("RONA_VOICE_TEST_CALLER_E164"))), outboundTestCalleeConfigured: Boolean(safeE164(Deno.env.get("RONA_VOICE_TEST_CALLEE_E164"))), externalVoiceTools: "NONE" } });
}

async function handleOutboundRequest(req) {
  const ctx = await adminContext(req); if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" }); const b = await jsonBody(req);
  const sourceRecordId = String(b.sourceRecordId || "").trim(), targetRole = String(b.targetRole || "").trim(), destination = String(b.destinationE164 || "").trim(), purpose = String(b.purpose || "").trim(), idempotencyKey = String(b.idempotencyKey || "").trim();
  if (!UUID_RE.test(sourceRecordId)) return send(400, { ok: false, code: "INVALID_SOURCE_RECORD_ID" }); if (!BUSINESS_ROLES.has(targetRole)) return send(400, { ok: false, code: "INVALID_TARGET_ROLE" }); if (!E164_RE.test(destination)) return send(400, { ok: false, code: "INVALID_DESTINATION_E164" }); if (!purpose || purpose.length > 500) return send(400, { ok: false, code: "INVALID_PURPOSE" }); if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return send(400, { ok: false, code: "INVALID_IDEMPOTENCY_KEY" });
  const source = await sql`select record_id,functional_role::text as functional_role,target_role::text as target_role from portal_private.ai_coordination_records where record_id=${sourceRecordId}::uuid and qa_only=false limit 1`;
  if (source.length !== 1) return send(409, { ok: false, code: "AUTHORITATIVE_SOURCE_RECORD_REQUIRED" }); const roles = new Set([String(source[0].functional_role || ""), String(source[0].target_role || "")]); if (!roles.has(targetRole)) return send(409, { ok: false, code: "SOURCE_ROLE_MISMATCH" });
  const existing = await sql`select id,state,authorization_state,last_error_code,provider_request_id from portal_private.voice_outbound_requests where idempotency_key=${idempotencyKey} limit 1`; if (existing.length === 1) return send(200, { ok: !["BLOCKED", "FAILED"].includes(String(existing[0].state)), idempotent: true, requestId: String(existing[0].id), state: String(existing[0].state), authorizationState: String(existing[0].authorization_state), providerRequestRecorded: Boolean(existing[0].provider_request_id), code: existing[0].last_error_code || null });
  const c = await control(), allowed = outboundReady(c) || outboundTestReady(c, destination);
  if (!allowed) {
    const id = await sql.begin(async tx => { const rows = await tx`insert into portal_private.voice_outbound_requests(source_record_id,target_role,destination_e164,purpose,authorization_state,state,idempotency_key,requested_by,last_error_code,provider_name) values(${sourceRecordId}::uuid,${targetRole}::portal_private.ai_business_role_enum,${destination},${purpose},'BLOCKED','BLOCKED',${idempotencyKey},${ctx.userId}::uuid,'VOICE_OUTBOUND_GATE_NOT_READY',${PROVIDER}) returning id`; const x = String(rows[0].id); await audit(tx, ctx, "VOICE_OUTBOUND_REQUEST_BLOCKED", "VOICE_OUTBOUND_REQUEST", x, req, { provider: PROVIDER, source_record_id: sourceRecordId, target_role: targetRole, reason: "VOICE_OUTBOUND_GATE_NOT_READY" }, "DENIED", "WARNING"); return x; });
    return send(409, { ok: false, requestId: id, state: "BLOCKED", authorizationState: "BLOCKED", code: "VOICE_OUTBOUND_GATE_NOT_READY" });
  }
  const id = await sql.begin(async tx => { const rows = await tx`insert into portal_private.voice_outbound_requests(source_record_id,target_role,destination_e164,purpose,authorization_state,state,authorization_ref,idempotency_key,requested_by,provider_name) values(${sourceRecordId}::uuid,${targetRole}::portal_private.ai_business_role_enum,${destination},${purpose},'AUTHORIZED','AUTHORIZED',${`ADMIN:${ctx.userId}`},${idempotencyKey},${ctx.userId}::uuid,${PROVIDER}) returning id`; const x = String(rows[0].id); await audit(tx, ctx, "VOICE_OUTBOUND_REQUEST_AUTHORIZED", "VOICE_OUTBOUND_REQUEST", x, req, { provider: PROVIDER, source_record_id: sourceRecordId, target_role: targetRole }); return x; });
  const tw = await dispatchOutbound(id, destination);
  if (!tw.ok) { await sql`update portal_private.voice_outbound_requests set state='FAILED',last_error_code='TWILIO_ZADARMA_CALL_CREATE_FAILED' where id=${id}::uuid`; await sql.begin(async tx => { await audit(tx, ctx, "VOICE_OUTBOUND_DISPATCH_FAILED", "VOICE_OUTBOUND_REQUEST", id, req, { provider: PROVIDER, control_leg: "TWILIO", http_status: tw.status }, "FAILURE", "ERROR"); }); return send(502, { ok: false, requestId: id, state: "FAILED", code: "TWILIO_ZADARMA_CALL_CREATE_FAILED" }); }
  const providerId = TWILIO_CALL_RE.test(String(tw.data?.sid || "")) ? String(tw.data.sid) : null; await sql`update portal_private.voice_outbound_requests set state='DISPATCHED',provider_request_id=${providerId},last_error_code=null where id=${id}::uuid`; await sql.begin(async tx => { await audit(tx, ctx, "VOICE_OUTBOUND_DISPATCHED", "VOICE_OUTBOUND_REQUEST", id, req, { provider: PROVIDER, control_leg: "TWILIO", pstn_egress: "ZADARMA_SIP", provider_request_recorded: Boolean(providerId) }); }); return send(202, { ok: true, requestId: id, state: "DISPATCHED", authorizationState: "AUTHORIZED", provider: PROVIDER });
}

Deno.serve(async req => {
  const path = pathOf(req);
  try {
    if (req.method === "GET" && (path === "/" || path === "/health")) return send(200, { ok: true, service: "rona-voice-zadarma-adapter", version: VERSION, mode: "FAIL_CLOSED_ZADARMA_KG_ADAPTER" });
    if (req.method === "GET" && path === "/admin/health") return await handleAdminHealth(req);
    if (req.method === "POST" && path === "/admin/provider/prepare") return await handlePrepare(req);
    if (req.method === "POST" && path === "/admin/provider/route-openai") return await handleRouteOpenAI(req);
    if (req.method === "POST" && path === "/admin/outbound/request") return await handleOutboundRequest(req);
    if (req.method === "POST" && path === "/twilio/outbound/answer") return await handleOutboundAnswer(req);
    if (req.method === "POST" && path === "/twilio/call-status") return await handleStatus(req, false);
    if (req.method === "POST" && path === "/twilio/dial-status") return await handleStatus(req, true);
    if (req.method === "POST" && path === "/openai/webhook") return await handleOpenAIWebhook(req);
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  } catch (error) {
    const status = Number(error?.status || 500), code = String(error?.message || "VOICE_ZADARMA_ADAPTER_ERROR").replace(/[^A-Z0-9_]/gi, "_").slice(0, 120) || "VOICE_ZADARMA_ADAPTER_ERROR";
    return send(status >= 400 && status < 600 ? status : 500, { ok: false, code });
  }
});
