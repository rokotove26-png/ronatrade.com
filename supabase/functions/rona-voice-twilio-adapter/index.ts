// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import OpenAI from "openai";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");

const sql = postgres(DB, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10, max_lifetime: 60 });
const VERSION = "1.2.0";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const TWILIO_CALL_RE = /^CA[0-9a-f]{32}$/i;
const BUSINESS_ROLES = new Set(["OPERATIONS_DIRECTOR", "FINANCE", "LEGAL", "MARKET_ANALYST", "RAIL_LOGISTICS"]);
const ROLE_CODE = Object.freeze({ OPERATIONS_DIRECTOR: "OPS", FINANCE: "FIN", LEGAL: "LEGAL", MARKET_ANALYST: "MARKET", RAIL_LOGISTICS: "RAIL" });
const CODE_ROLE = Object.freeze(Object.fromEntries(Object.entries(ROLE_CODE).map(([k, v]) => [v, k])));
const BASE = `${SUPA_URL}/functions/v1/rona-voice-twilio-adapter`;

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
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
function xml(status, body) {
  return new Response(body, { status, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store, no-cache, must-revalidate", "pragma": "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
function xmlEscape(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function pathOf(req) { const p = new URL(req.url).pathname, marker = "/rona-voice-twilio-adapter", i = p.indexOf(marker); return i >= 0 ? (p.slice(i + marker.length) || "/") : p; }
function safeE164(v) { const s = String(v || "").trim(); return E164_RE.test(s) ? s : null; }
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

function openAIConfigPresent() { return Boolean(Deno.env.get("OPENAI_API_KEY") && Deno.env.get("OPENAI_WEBHOOK_SECRET") && Deno.env.get("OPENAI_PROJECT_ID")); }
function twilioConfigPresent() { return Boolean(/^AC[0-9a-f]{32}$/i.test(String(Deno.env.get("TWILIO_ACCOUNT_SID") || "")) && Deno.env.get("TWILIO_AUTH_TOKEN") && safeE164(Deno.env.get("TWILIO_FROM_E164"))); }
function providerReady(c) { return Boolean(c?.provider === "TWILIO" && c?.provider_mode === "TWILIO_SIP_BRIDGE" && twilioConfigPresent()); }
function inboundReady(c) { return Boolean(c && c.enabled && c.inbound_enabled && c.provider_state === "READY" && c.openai_realtime_state === "READY" && c.model_execution_state === "READY" && c.activation_gate === "PRODUCTION_READY" && openAIConfigPresent() && providerReady(c)); }
function outboundReady(c) { return Boolean(c && c.enabled && c.outbound_enabled && c.provider_state === "READY" && c.openai_realtime_state === "READY" && c.model_execution_state === "READY" && c.activation_gate === "PRODUCTION_READY" && openAIConfigPresent() && providerReady(c)); }

function openAISipTarget() {
  const project = String(Deno.env.get("OPENAI_PROJECT_ID") || "").trim();
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(project)) throw Object.assign(new Error("OPENAI_PROJECT_ID_INVALID"), { status: 503 });
  return `sip:${project}@sip.api.openai.com;transport=tls`;
}
function sipTarget(providerCallId, role, requestId = null) {
  const params = new URLSearchParams();
  params.set("x-ph-ronadirection", requestId ? "OUTBOUND" : "INBOUND");
  params.set("x-ph-ronaprovidercall", providerCallId);
  params.set("x-ph-ronarole", ROLE_CODE[role] || "OPS");
  if (requestId) params.set("x-ph-ronarequest", requestId);
  return `${openAISipTarget()}?${params.toString()}`;
}
function voiceInstructions(role, direction, purpose = null) {
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
async function upsertCall(callSid, direction, fromE164, toE164, role, status, metadata = {}) {
  const rows = await sql`insert into portal_private.voice_calls(provider_call_id,direction,from_e164,to_e164,routed_role,identity_state,status,metadata)
    values(${callSid},${direction},${fromE164},${toE164},${role}::portal_private.ai_business_role_enum,'UNVERIFIED',${status},${sql.json(metadata)}::jsonb)
    on conflict(provider_call_id) do update set routed_role=excluded.routed_role,status=excluded.status,updated_at=now(),metadata=portal_private.voice_calls.metadata||excluded.metadata returning id`;
  return String(rows[0].id);
}
function unavailableXml() { return `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="ru-RU">Телефонный сервис RONA Trade временно недоступен. Пожалуйста, позвоните позже.</Say><Hangup/></Response>`; }
function bridgeXml(callSid, role, requestId = null) {
  const suffix = requestId ? `?rid=${encodeURIComponent(requestId)}` : "";
  const action = `${BASE}/twilio/dial-status${suffix}`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial action="${xmlEscape(action)}" method="POST" timeout="30" timeLimit="3600"><Sip>${xmlEscape(sipTarget(callSid, role, requestId))}</Sip></Dial></Response>`;
}

async function handleInboundAnswer(req) {
  const raw = await req.text(), sig = await verifyTwilio(req, raw);
  if (!sig.ok) return send(sig.code === "TWILIO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const f = formMap(raw), callSid = String(f.CallSid || "");
  if (!TWILIO_CALL_RE.test(callSid)) return send(400, { ok: false, code: "TWILIO_CALL_SID_INVALID" });
  const c = await control();
  const role = BUSINESS_ROLES.has(String(c?.default_inbound_role || "")) ? String(c.default_inbound_role) : "OPERATIONS_DIRECTOR";
  const ready = inboundReady(c);
  const id = await upsertCall(callSid, "INBOUND", safeE164(f.From), safeE164(f.To), role, ready ? "RINGING" : "BLOCKED", { provider: "TWILIO", bridge: "OPENAI_SIP", identity_source: "NONE" });
  await recordCallEvent(id, ready ? "TWILIO_INBOUND_ACCEPTED_FOR_SIP_BRIDGE" : "TWILIO_INBOUND_BLOCKED", "TELEPHONY_PROVIDER", { role, gate: String(c?.activation_gate || "MISSING") });
  if (!ready) { await sql`update portal_private.voice_calls set last_error_code='VOICE_INBOUND_GATE_NOT_READY',ended_at=now() where id=${id}::uuid`; return xml(200, unavailableXml()); }
  return xml(200, bridgeXml(callSid, role));
}

async function handleOutboundAnswer(req) {
  const raw = await req.text(), sig = await verifyTwilio(req, raw);
  if (!sig.ok) return send(sig.code === "TWILIO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const rid = String(new URL(req.url).searchParams.get("rid") || ""); if (!UUID_RE.test(rid)) return send(400, { ok: false, code: "VOICE_REQUEST_ID_INVALID" });
  const f = formMap(raw), callSid = String(f.CallSid || ""); if (!TWILIO_CALL_RE.test(callSid)) return send(400, { ok: false, code: "TWILIO_CALL_SID_INVALID" });
  const rows = await sql`select id,target_role::text as target_role,destination_e164,purpose,state,authorization_state from portal_private.voice_outbound_requests where id=${rid}::uuid limit 1`;
  if (rows.length !== 1 || rows[0].authorization_state !== "AUTHORIZED" || !["AUTHORIZED","DISPATCHED"].includes(String(rows[0].state))) return xml(200, unavailableXml());
  const c = await control(); if (!outboundReady(c)) return xml(200, unavailableXml());
  const role = String(rows[0].target_role);
  const id = await upsertCall(callSid, "OUTBOUND", safeE164(Deno.env.get("TWILIO_FROM_E164")), safeE164(rows[0].destination_e164), role, "RINGING", { provider: "TWILIO", request_id: rid });
  await sql`update portal_private.voice_outbound_requests set dispatch_call_id=${id}::uuid,state='DISPATCHED',last_error_code=null where id=${rid}::uuid`;
  await recordCallEvent(id, "TWILIO_OUTBOUND_ANSWERED_FOR_SIP_BRIDGE", "TELEPHONY_PROVIDER", { request_id: rid, role });
  return xml(200, bridgeXml(callSid, role, rid));
}

function terminalTwilioStatus(s) { return ["completed","busy","failed","no-answer","canceled"].includes(s); }
async function handleStatus(req, dial = false) {
  const raw = await req.text(), sig = await verifyTwilio(req, raw);
  if (!sig.ok) return send(sig.code === "TWILIO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const f = formMap(raw), callSid = String(f.CallSid || f.ParentCallSid || ""), status = String(dial ? (f.DialCallStatus || f.CallStatus || "unknown") : (f.CallStatus || "unknown")).toLowerCase().slice(0, 80);
  if (TWILIO_CALL_RE.test(callSid)) {
    const rows = await sql`select id from portal_private.voice_calls where provider_call_id=${callSid} limit 1`;
    if (rows.length === 1) {
      const id = String(rows[0].id); await recordCallEvent(id, dial ? "TWILIO_DIAL_STATUS" : "TWILIO_CALL_STATUS", "TELEPHONY_PROVIDER", { status });
      if (terminalTwilioStatus(status)) await sql`update portal_private.voice_calls set status=${status==='completed'?'COMPLETED':'FAILED'},ended_at=now(),last_error_code=${status==='completed'?null:`TWILIO_${status.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`} where id=${id}::uuid`;
      else if (["in-progress","answered"].includes(status)) await sql`update portal_private.voice_calls set status='ACTIVE',answered_at=coalesce(answered_at,now()),last_error_code=null where id=${id}::uuid`;
    }
  }
  const rid = String(new URL(req.url).searchParams.get("rid") || "");
  if (UUID_RE.test(rid) && terminalTwilioStatus(status)) await sql`update portal_private.voice_outbound_requests set state=${status==='completed'?'COMPLETED':'FAILED'},last_error_code=${status==='completed'?null:`TWILIO_${status.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`} where id=${rid}::uuid`;
  return xml(200, `<?xml version="1.0" encoding="UTF-8"?><Response/>`);
}

function sipHeaderMap(headers) { const out = {}; for (const h of Array.isArray(headers) ? headers : []) { const n = String(h?.name || "").trim().toLowerCase(); if (n) out[n] = String(h?.value || "").trim(); } return out; }
async function resolveOpenAIBinding(data) {
  const h = sipHeaderMap(data?.sip_headers), rid = String(h["x-ph-ronarequest"] || ""), callSid = String(h["x-ph-ronaprovidercall"] || ""), roleCode = String(h["x-ph-ronarole"] || "").toUpperCase();
  if (UUID_RE.test(rid)) {
    const rows = await sql`select id,target_role::text as role,purpose,state,authorization_state,dispatch_call_id from portal_private.voice_outbound_requests where id=${rid}::uuid and provider_name='TWILIO' limit 1`;
    if (rows.length === 1 && rows[0].authorization_state === "AUTHORIZED" && ["AUTHORIZED","DISPATCHED"].includes(String(rows[0].state))) return { direction: "OUTBOUND", role: String(rows[0].role), purpose: String(rows[0].purpose), requestId: String(rows[0].id), voiceCallId: rows[0].dispatch_call_id ? String(rows[0].dispatch_call_id) : null };
  }
  if (TWILIO_CALL_RE.test(callSid)) {
    const rows = await sql`select id,direction,routed_role::text as role,metadata from portal_private.voice_calls where provider_call_id=${callSid} and metadata->>'provider'='TWILIO' order by created_at desc limit 1`;
    if (rows.length === 1) return { direction: String(rows[0].direction), role: String(rows[0].role || CODE_ROLE[roleCode] || "OPERATIONS_DIRECTOR"), purpose: null, requestId: rows[0].metadata?.request_id || null, voiceCallId: String(rows[0].id) };
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
  const c = await control(), ready = binding.direction === "OUTBOUND" ? outboundReady(c) : inboundReady(c);
  if (!ready) { await rejectOpenAI(callId, binding.voiceCallId, "VOICE_GATE_NOT_READY"); return send(200, { ok: true, accepted: false, code: "VOICE_GATE_NOT_READY" }); }
  let voiceCallId = binding.voiceCallId;
  if (!voiceCallId) voiceCallId = String((await sql`insert into portal_private.voice_calls(openai_call_id,direction,routed_role,identity_state,status,metadata) values(${callId},${binding.direction},${binding.role}::portal_private.ai_business_role_enum,'UNVERIFIED','RECEIVED',${sql.json({ provider: 'TWILIO', request_id: binding.requestId })}::jsonb) on conflict(openai_call_id) do update set updated_at=now() returning id`)[0].id);
  await sql`update portal_private.voice_calls set openai_call_id=${callId},routed_role=${binding.role}::portal_private.ai_business_role_enum,status='RECEIVED' where id=${voiceCallId}::uuid`;
  await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_INCOMING", "OPENAI", { provider: "TWILIO", direction: binding.direction, role: binding.role, request_id: binding.requestId });
  const model = Deno.env.get("RONA_VOICE_REALTIME_MODEL") || "gpt-realtime";
  try {
    await openAIRealtimeCall(callId, "accept", { type: "realtime", model, instructions: voiceInstructions(binding.role, binding.direction, binding.purpose), output_modalities: ["audio"], max_output_tokens: 1024, tool_choice: "none", tracing: null });
    await sql`update portal_private.voice_calls set status='ACCEPTED',answered_at=coalesce(answered_at,now()),last_error_code=null where id=${voiceCallId}::uuid`;
    await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_ACCEPTED", "RONA_GATEWAY", { provider: "TWILIO", model, role: binding.role, tools: "NONE" });
    return send(200, { ok: true, accepted: true });
  } catch {
    await sql`update portal_private.voice_calls set status='FAILED',last_error_code='OPENAI_ACCEPT_FAILED',ended_at=now() where id=${voiceCallId}::uuid`;
    await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_ACCEPT_FAILED", "RONA_GATEWAY", { provider: "TWILIO" });
    return send(502, { ok: false, code: "OPENAI_ACCEPT_FAILED" });
  }
}

function twilioBasicAuth() { const sid = String(Deno.env.get("TWILIO_ACCOUNT_SID") || ""), token = String(Deno.env.get("TWILIO_AUTH_TOKEN") || ""); if (!/^AC[0-9a-f]{32}$/i.test(sid) || !token) throw Object.assign(new Error("TWILIO_CREDENTIALS_NOT_CONFIGURED"), { status: 503 }); return `Basic ${btoa(`${sid}:${token}`)}`; }
async function twilioApi(path, init = {}) {
  const sid = String(Deno.env.get("TWILIO_ACCOUNT_SID") || "");
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}${path}`, { ...init, headers: { authorization: twilioBasicAuth(), accept: "application/json", ...(init.body ? { "content-type": "application/x-www-form-urlencoded" } : {}), ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, data };
}
async function handlePrepare(req) {
  const ctx = await adminContext(req); if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" });
  const presence = { twilioAccountSid: Boolean(/^AC[0-9a-f]{32}$/i.test(String(Deno.env.get("TWILIO_ACCOUNT_SID") || ""))), twilioAuthToken: Boolean(Deno.env.get("TWILIO_AUTH_TOKEN")), twilioFrom: Boolean(safeE164(Deno.env.get("TWILIO_FROM_E164"))), openaiApiKey: Boolean(Deno.env.get("OPENAI_API_KEY")), openaiWebhookSecret: Boolean(Deno.env.get("OPENAI_WEBHOOK_SECRET")), openaiProjectId: Boolean(Deno.env.get("OPENAI_PROJECT_ID")) };
  if (!Object.values(presence).every(Boolean)) return send(409, { ok: false, code: "VOICE_EXTERNAL_CREDENTIALS_INCOMPLETE", presence });
  const tw = await twilioApi(".json", { method: "GET" }), model = Deno.env.get("RONA_VOICE_REALTIME_MODEL") || "gpt-realtime";
  const oa = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` } });
  if (!tw.ok || !oa.ok) return send(409, { ok: false, code: "VOICE_EXTERNAL_PROVIDER_PROBE_FAILED", twilioStatus: tw.status, openaiStatus: oa.status });
  const from = safeE164(Deno.env.get("TWILIO_FROM_E164"));
  await sql.begin(async tx => {
    await tx`update portal_private.voice_gateway_control set provider='TWILIO',provider_mode='TWILIO_SIP_BRIDGE',provider_state='CONFIGURED',provider_number_e164=${from},provider_verified_at=now(),openai_realtime_state='CONFIGURED',model_execution_state='TESTING',activation_gate='FOUNDATION',enabled=false,inbound_enabled=false,outbound_enabled=false,configured_at=coalesce(configured_at,now()),updated_by=${ctx.userId}::uuid where singleton=true`;
    await audit(tx, ctx, "VOICE_TWILIO_PROVIDER_PROBE_PASSED", "VOICE_GATEWAY", "TWILIO", req, { provider: "TWILIO", model, number_present: true });
  });
  return send(200, { ok: true, provider: "TWILIO", providerState: "CONFIGURED", openaiRealtimeState: "CONFIGURED", modelExecutionState: "TESTING", activationGate: "FOUNDATION", liveCallingEnabled: false });
}
async function handleAdminHealth(req) {
  const ctx = await adminContext(req); if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" }); const c = await control(); if (!c) return send(503, { ok: false, code: "VOICE_CONTROL_MISSING" });
  return send(200, { ok: true, service: "rona-voice-twilio-adapter", version: VERSION, control: { enabled: Boolean(c.enabled), inboundEnabled: Boolean(c.inbound_enabled), outboundEnabled: Boolean(c.outbound_enabled), provider: String(c.provider), providerMode: String(c.provider_mode), providerState: String(c.provider_state), providerNumberConfigured: Boolean(c.provider_number_e164), defaultInboundRole: String(c.default_inbound_role), openaiRealtimeState: String(c.openai_realtime_state), modelExecutionState: String(c.model_execution_state), activationGate: String(c.activation_gate), recordingPolicy: String(c.recording_policy), transcriptPolicy: String(c.transcript_policy) }, capabilities: { twilioCredentialsPresent: twilioConfigPresent(), openaiCredentialsPresent: openAIConfigPresent(), inboundReady: inboundReady(c), outboundReady: outboundReady(c), externalVoiceTools: "NONE" } });
}
async function dispatchOutbound(requestId, destination) {
  const from = safeE164(Deno.env.get("TWILIO_FROM_E164")); if (!from) throw Object.assign(new Error("TWILIO_FROM_E164_MISSING"), { status: 503 });
  const form = new URLSearchParams(); form.set("To", destination); form.set("From", from); form.set("Url", `${BASE}/twilio/outbound/answer?rid=${encodeURIComponent(requestId)}`); form.set("Method", "POST"); form.set("StatusCallback", `${BASE}/twilio/call-status?rid=${encodeURIComponent(requestId)}`); form.set("StatusCallbackMethod", "POST"); for (const e of ["initiated","ringing","answered","completed"]) form.append("StatusCallbackEvent", e);
  return await twilioApi("/Calls.json", { method: "POST", body: form.toString() });
}
async function handleOutboundRequest(req) {
  const ctx = await adminContext(req); if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" }); const b = await jsonBody(req);
  const sourceRecordId = String(b.sourceRecordId || "").trim(), targetRole = String(b.targetRole || "").trim(), destination = String(b.destinationE164 || "").trim(), purpose = String(b.purpose || "").trim(), idempotencyKey = String(b.idempotencyKey || "").trim();
  if (!UUID_RE.test(sourceRecordId)) return send(400, { ok: false, code: "INVALID_SOURCE_RECORD_ID" }); if (!BUSINESS_ROLES.has(targetRole)) return send(400, { ok: false, code: "INVALID_TARGET_ROLE" }); if (!E164_RE.test(destination)) return send(400, { ok: false, code: "INVALID_DESTINATION_E164" }); if (!purpose || purpose.length > 500) return send(400, { ok: false, code: "INVALID_PURPOSE" }); if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return send(400, { ok: false, code: "INVALID_IDEMPOTENCY_KEY" });
  const source = await sql`select record_id,functional_role::text as functional_role,target_role::text as target_role from portal_private.ai_coordination_records where record_id=${sourceRecordId}::uuid and qa_only=false limit 1`;
  if (source.length !== 1) return send(409, { ok: false, code: "AUTHORITATIVE_SOURCE_RECORD_REQUIRED" }); const roles = new Set([String(source[0].functional_role || ""), String(source[0].target_role || "")]); if (!roles.has(targetRole)) return send(409, { ok: false, code: "SOURCE_ROLE_MISMATCH" });
  const existing = await sql`select id,state,authorization_state,last_error_code,provider_request_id from portal_private.voice_outbound_requests where idempotency_key=${idempotencyKey} limit 1`; if (existing.length === 1) return send(200, { ok: !["BLOCKED","FAILED"].includes(String(existing[0].state)), idempotent: true, requestId: String(existing[0].id), state: String(existing[0].state), authorizationState: String(existing[0].authorization_state), providerRequestRecorded: Boolean(existing[0].provider_request_id), code: existing[0].last_error_code || null });
  const c = await control();
  if (!outboundReady(c)) {
    const id = await sql.begin(async tx => { const rows = await tx`insert into portal_private.voice_outbound_requests(source_record_id,target_role,destination_e164,purpose,authorization_state,state,idempotency_key,requested_by,last_error_code,provider_name) values(${sourceRecordId}::uuid,${targetRole}::portal_private.ai_business_role_enum,${destination},${purpose},'BLOCKED','BLOCKED',${idempotencyKey},${ctx.userId}::uuid,'VOICE_OUTBOUND_GATE_NOT_READY','TWILIO') returning id`; const x = String(rows[0].id); await audit(tx, ctx, "VOICE_OUTBOUND_REQUEST_BLOCKED", "VOICE_OUTBOUND_REQUEST", x, req, { provider: "TWILIO", source_record_id: sourceRecordId, target_role: targetRole, reason: "VOICE_OUTBOUND_GATE_NOT_READY" }, "DENIED", "WARNING"); return x; });
    return send(409, { ok: false, requestId: id, state: "BLOCKED", authorizationState: "BLOCKED", code: "VOICE_OUTBOUND_GATE_NOT_READY" });
  }
  const id = await sql.begin(async tx => { const rows = await tx`insert into portal_private.voice_outbound_requests(source_record_id,target_role,destination_e164,purpose,authorization_state,state,authorization_ref,idempotency_key,requested_by,provider_name) values(${sourceRecordId}::uuid,${targetRole}::portal_private.ai_business_role_enum,${destination},${purpose},'AUTHORIZED','AUTHORIZED',${`ADMIN:${ctx.userId}`},${idempotencyKey},${ctx.userId}::uuid,'TWILIO') returning id`; const x = String(rows[0].id); await audit(tx, ctx, "VOICE_OUTBOUND_REQUEST_AUTHORIZED", "VOICE_OUTBOUND_REQUEST", x, req, { provider: "TWILIO", source_record_id: sourceRecordId, target_role: targetRole }); return x; });
  const tw = await dispatchOutbound(id, destination);
  if (!tw.ok) { await sql`update portal_private.voice_outbound_requests set state='FAILED',last_error_code='TWILIO_CALL_CREATE_FAILED' where id=${id}::uuid`; await sql.begin(async tx => { await audit(tx, ctx, "VOICE_OUTBOUND_DISPATCH_FAILED", "VOICE_OUTBOUND_REQUEST", id, req, { provider: "TWILIO", http_status: tw.status }, "FAILURE", "ERROR"); }); return send(502, { ok: false, requestId: id, state: "FAILED", code: "TWILIO_CALL_CREATE_FAILED" }); }
  const providerId = TWILIO_CALL_RE.test(String(tw.data?.sid || "")) ? String(tw.data.sid) : null; await sql`update portal_private.voice_outbound_requests set state='DISPATCHED',provider_request_id=${providerId},last_error_code=null where id=${id}::uuid`; await sql.begin(async tx => { await audit(tx, ctx, "VOICE_OUTBOUND_DISPATCHED", "VOICE_OUTBOUND_REQUEST", id, req, { provider: "TWILIO", provider_request_recorded: Boolean(providerId) }); }); return send(202, { ok: true, requestId: id, state: "DISPATCHED", authorizationState: "AUTHORIZED", provider: "TWILIO" });
}

Deno.serve(async req => {
  const path = pathOf(req);
  try {
    if (req.method === "GET" && (path === "/" || path === "/health")) return send(200, { ok: true, service: "rona-voice-twilio-adapter", version: VERSION, mode: "FAIL_CLOSED_TWILIO_ADAPTER" });
    if (req.method === "GET" && path === "/admin/health") return await handleAdminHealth(req);
    if (req.method === "POST" && path === "/admin/provider/prepare") return await handlePrepare(req);
    if (req.method === "POST" && path === "/admin/outbound/request") return await handleOutboundRequest(req);
    if (req.method === "POST" && path === "/twilio/inbound/answer") return await handleInboundAnswer(req);
    if (req.method === "POST" && path === "/twilio/outbound/answer") return await handleOutboundAnswer(req);
    if (req.method === "POST" && path === "/twilio/call-status") return await handleStatus(req, false);
    if (req.method === "POST" && path === "/twilio/dial-status") return await handleStatus(req, true);
    if (req.method === "POST" && path === "/openai/webhook") return await handleOpenAIWebhook(req);
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  } catch (error) {
    const status = Number(error?.status || 500), code = String(error?.message || "VOICE_TWILIO_ADAPTER_ERROR").replace(/[^A-Z0-9_]/gi, "_").slice(0, 120) || "VOICE_TWILIO_ADAPTER_ERROR";
    return send(status >= 400 && status < 600 ? status : 500, { ok: false, code });
  }
});
