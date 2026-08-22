// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import OpenAI from "openai";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");

const sql = postgres(DB, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10, max_lifetime: 60 });
const VERSION = "1.1.0";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const BUSINESS_ROLES = new Set(["OPERATIONS_DIRECTOR", "FINANCE", "LEGAL", "MARKET_ANALYST", "RAIL_LOGISTICS"]);
const ROLE_CODE = Object.freeze({ OPERATIONS_DIRECTOR: "OPS", FINANCE: "FIN", LEGAL: "LEGAL", MARKET_ANALYST: "MARKET", RAIL_LOGISTICS: "RAIL" });
const CODE_ROLE = Object.freeze(Object.fromEntries(Object.entries(ROLE_CODE).map(([k, v]) => [v, k])));
const VOICE_BASE = `${SUPA_URL}/functions/v1/rona-voice-gateway`;

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

function send(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders,
    },
  });
}

function xml(status, body) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function xmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function pathOf(req) {
  const p = new URL(req.url).pathname;
  const marker = "/rona-voice-gateway";
  const i = p.indexOf(marker);
  return i >= 0 ? (p.slice(i + marker.length) || "/") : p;
}

function claims(token) {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - p.length % 4) % 4)));
  } catch { return {}; }
}

async function adminContext(req) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  const client = createClient(SUPA_URL, runtimeKey("pub"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
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

async function jsonBody(req) {
  try {
    const value = await req.json();
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch { throw Object.assign(new Error("INVALID_JSON"), { status: 400 }); }
}

function reqIds(req) {
  const r = req.headers.get("x-request-id");
  const c = req.headers.get("x-correlation-id");
  return {
    requestId: r && UUID_RE.test(r) ? r : crypto.randomUUID(),
    correlationId: c && UUID_RE.test(c) ? c : null,
  };
}

async function audit(tx, ctx, action, entityType, entityId, req, metadata = {}, result = "SUCCESS", severity = "INFO") {
  const { requestId, correlationId } = reqIds(req);
  await tx`
    insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata,severity,result)
    values(${ctx?.userId || null}::uuid,${ctx ? "ADMIN" : "SYSTEM"},${action},${entityType},${entityId},${requestId}::uuid,${correlationId}::uuid,
      ${sql.json(metadata)}::jsonb,${severity}::portal_private.audit_severity_enum,${result}::portal_private.audit_result_enum)
  `;
  return requestId;
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

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeUuidKey(v) { return String(v || "").toLowerCase().replace(/[^0-9a-f]/g, ""); }
function safeE164(v) { const s = String(v || "").trim(); return E164_RE.test(s) ? s : null; }
function openAIConfigPresent() { return Boolean(Deno.env.get("OPENAI_API_KEY") && Deno.env.get("OPENAI_WEBHOOK_SECRET") && Deno.env.get("OPENAI_PROJECT_ID")); }
function plivoConfigPresent() { return Boolean(Deno.env.get("PLIVO_AUTH_ID") && Deno.env.get("PLIVO_AUTH_TOKEN") && safeE164(Deno.env.get("PLIVO_FROM_E164"))); }
function roleBridgePresent() { return true; }
function roleBridgeMode() { return "FIXED_ROLE_NO_INTERNAL_TOOLS_V1"; }
function providerAdapterPresent(c) { return Boolean(c?.provider === "PLIVO" && c?.provider_mode === "PLIVO_SIP_BRIDGE" && plivoConfigPresent()); }

function inboundReady(c) {
  return Boolean(c && c.enabled && c.inbound_enabled && c.provider_state === "READY" && c.openai_realtime_state === "READY" &&
    c.model_execution_state === "READY" && c.activation_gate === "PRODUCTION_READY" && openAIConfigPresent() && providerAdapterPresent(c) && roleBridgePresent());
}
function outboundReady(c) {
  return Boolean(c && c.enabled && c.outbound_enabled && c.provider_state === "READY" && c.openai_realtime_state === "READY" &&
    c.model_execution_state === "READY" && c.activation_gate === "PRODUCTION_READY" && openAIConfigPresent() && providerAdapterPresent(c) && roleBridgePresent());
}

function openAISipUri() {
  const project = String(Deno.env.get("OPENAI_PROJECT_ID") || "").trim();
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(project)) throw Object.assign(new Error("OPENAI_PROJECT_ID_INVALID"), { status: 503 });
  return `sip:${project}@sip.api.openai.com;transport=tls`;
}

function voiceInstructions(role, direction, purpose = null) {
  const roleName = ({ OPERATIONS_DIRECTOR: "Operations Director", FINANCE: "Finance", LEGAL: "Legal", MARKET_ANALYST: "Market Analyst", RAIL_LOGISTICS: "Rail Logistics" })[role] || "Operations Director";
  const lines = [
    `You are the external telephone endpoint for the fixed RONA Trade ${roleName} role.`,
    `Call direction: ${direction}.`,
    "Speak naturally and concisely in the caller's language when clear; otherwise use Russian.",
    "This V1 voice session has no internal RONA data tools. Never invent prices, balances, contracts, shipment status, legal conclusions, credentials, provider state, user identity, or any other company fact that is not explicitly present in this call context.",
    "A phone number, caller name, email address, spoken company name, SIP header, or prior call history is not authoritative identity.",
    "Do not disclose client-specific contracts, payments, private prices, documents, bank data, internal diagnostics, tokens, secrets, QA identities, or protected information.",
    "Do not perform or promise legal, commercial, financial, IAM, contract, publication, access, binding, or other authoritative mutations.",
    "Internal staff communication must remain in the audited RONA network coordination contour and must never be moved to internal email.",
    "If the request requires protected data, an authoritative decision, or information you do not have, say that it requires verification and do not guess.",
    "Do not claim that a follow-up task, booking, contract change, payment action, publication, or internal handoff was created unless a real authorized tool confirms it.",
  ];
  if (purpose) lines.push(`Authorized outbound call purpose: ${String(purpose).slice(0, 500)}. Stay within this purpose and do not broaden authority.`);
  return lines.join(" ");
}

async function openAIRealtimeCall(callId, action, body = undefined) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw Object.assign(new Error("OPENAI_API_KEY_MISSING"), { status: 503 });
  const response = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/${action}`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`OPENAI_${action.toUpperCase()}_FAILED`), { status: response.status, data });
  return data;
}

async function hmacSha256Base64(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  let binary = ""; for (const b of sig) binary += String.fromCharCode(b);
  return btoa(binary);
}

function timingSafeStringEqual(a, b) {
  const aa = new TextEncoder().encode(String(a || ""));
  const bb = new TextEncoder().encode(String(b || ""));
  if (!aa.length || aa.length !== bb.length) return false;
  let diff = 0; for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function verifyPlivoV3(req, raw) {
  const token = Deno.env.get("PLIVO_AUTH_TOKEN");
  if (!token) return { ok: false, code: "PLIVO_CREDENTIALS_NOT_CONFIGURED" };
  const nonce = String(req.headers.get("x-plivo-signature-v3-nonce") || "");
  const header = String(req.headers.get("x-plivo-signature-v3") || "");
  if (!nonce || !header) return { ok: false, code: "PLIVO_SIGNATURE_MISSING" };
  let message = req.url;
  const ct = String(req.headers.get("content-type") || "").toLowerCase();
  if (raw && ct.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(raw);
    const entries = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0], "en", { sensitivity: "variant" }));
    for (const [k, v] of entries) message += `${k}${v}`;
  }
  message += nonce;
  const expected = await hmacSha256Base64(token, message);
  const candidates = header.split(",").map((x) => x.trim()).filter(Boolean);
  return candidates.some((x) => timingSafeStringEqual(x, expected)) ? { ok: true } : { ok: false, code: "PLIVO_SIGNATURE_INVALID" };
}

function formMap(raw) { const p = new URLSearchParams(raw); return Object.fromEntries([...p.entries()]); }

async function recordCallEvent(callId, type, source, metadata = {}, payloadHash = null) {
  await sql`insert into portal_private.voice_call_events(voice_call_id,event_type,event_source,payload_hash,metadata)
    values(${callId}::uuid,${type},${source},${payloadHash},${sql.json(metadata)}::jsonb)`;
}

async function upsertPlivoCall(providerCallId, direction, fromE164, toE164, role, status, metadata = {}) {
  const rows = await sql`
    insert into portal_private.voice_calls(provider_call_id,direction,from_e164,to_e164,routed_role,identity_state,status,metadata)
    values(${providerCallId},${direction},${fromE164},${toE164},${role}::portal_private.ai_business_role_enum,'UNVERIFIED',${status},${sql.json(metadata)}::jsonb)
    on conflict (provider_call_id) do update set routed_role=excluded.routed_role,status=excluded.status,updated_at=now(),metadata=portal_private.voice_calls.metadata||excluded.metadata
    returning id
  `;
  return String(rows[0].id);
}

function safeUnavailableXml() {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Speak language="ru-RU">Телефонный сервис RONA Trade временно недоступен. Пожалуйста, позвоните позже.</Speak><Hangup/></Response>`;
}

function bridgeXml(callId, role, requestId = null) {
  const headers = [`RonaDirection=${requestId ? "OUTBOUND" : "INBOUND"}`, `RonaProviderCall=${normalizeUuidKey(callId)}`, `RonaRole=${ROLE_CODE[role] || "OPS"}`];
  if (requestId) headers.push(`RonaRequest=${normalizeUuidKey(requestId)}`);
  const action = `${VOICE_BASE}/plivo/dial-status${requestId ? `?rid=${encodeURIComponent(requestId)}` : ""}`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial action="${xmlEscape(action)}" method="POST" callbackUrl="${xmlEscape(action)}" callbackMethod="POST" timeout="30" timeLimit="3600"><User sipHeaders="${xmlEscape(headers.join(","))}">${xmlEscape(openAISipUri())}</User></Dial></Response>`;
}

async function handlePlivoInboundAnswer(req) {
  const raw = await req.text();
  const sig = await verifyPlivoV3(req, raw);
  if (!sig.ok) return send(sig.code === "PLIVO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const f = formMap(raw);
  const callUuid = String(f.CallUUID || f.ALegUUID || "").trim();
  if (!callUuid || callUuid.length > 160) return send(400, { ok: false, code: "PLIVO_CALL_UUID_MISSING" });
  const c = await control();
  const role = BUSINESS_ROLES.has(String(c?.default_inbound_role || "")) ? String(c.default_inbound_role) : "OPERATIONS_DIRECTOR";
  const voiceCallId = await upsertPlivoCall(callUuid, "INBOUND", safeE164(f.From), safeE164(f.To), role, inboundReady(c) ? "RINGING" : "BLOCKED", { provider: "PLIVO", bridge: "OPENAI_SIP", identity_source: "NONE" });
  await recordCallEvent(voiceCallId, inboundReady(c) ? "PLIVO_INBOUND_ACCEPTED_FOR_SIP_BRIDGE" : "PLIVO_INBOUND_BLOCKED", "TELEPHONY_PROVIDER", { role, gate: String(c?.activation_gate || "MISSING") });
  if (!inboundReady(c)) {
    await sql`update portal_private.voice_calls set last_error_code='VOICE_INBOUND_GATE_NOT_READY',ended_at=now() where id=${voiceCallId}::uuid`;
    return xml(200, safeUnavailableXml());
  }
  return xml(200, bridgeXml(callUuid, role));
}

async function handlePlivoOutboundAnswer(req) {
  const raw = await req.text();
  const sig = await verifyPlivoV3(req, raw);
  if (!sig.ok) return send(sig.code === "PLIVO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const rid = String(new URL(req.url).searchParams.get("rid") || "");
  if (!UUID_RE.test(rid)) return send(400, { ok: false, code: "VOICE_REQUEST_ID_INVALID" });
  const f = formMap(raw);
  const callUuid = String(f.CallUUID || f.ALegUUID || "").trim();
  if (!callUuid || callUuid.length > 160) return send(400, { ok: false, code: "PLIVO_CALL_UUID_MISSING" });
  const rows = await sql`select id,target_role::text as target_role,destination_e164,purpose,state,authorization_state from portal_private.voice_outbound_requests where id=${rid}::uuid limit 1`;
  if (rows.length !== 1 || rows[0].authorization_state !== "AUTHORIZED" || !["AUTHORIZED","DISPATCHED"].includes(String(rows[0].state))) return xml(200, safeUnavailableXml());
  const c = await control();
  if (!outboundReady(c)) return xml(200, safeUnavailableXml());
  const role = String(rows[0].target_role);
  const voiceCallId = await upsertPlivoCall(callUuid, "OUTBOUND", safeE164(Deno.env.get("PLIVO_FROM_E164")), safeE164(rows[0].destination_e164), role, "RINGING", { provider: "PLIVO", request_id: rid });
  await sql`update portal_private.voice_outbound_requests set dispatch_call_id=${voiceCallId}::uuid,state='DISPATCHED',last_error_code=null where id=${rid}::uuid`;
  await recordCallEvent(voiceCallId, "PLIVO_OUTBOUND_ANSWERED_FOR_SIP_BRIDGE", "TELEPHONY_PROVIDER", { request_id: rid, role });
  return xml(200, bridgeXml(callUuid, role, rid));
}

async function handlePlivoDialStatus(req) {
  const raw = await req.text();
  const sig = await verifyPlivoV3(req, raw);
  if (!sig.ok) return send(sig.code === "PLIVO_CREDENTIALS_NOT_CONFIGURED" ? 503 : 403, { ok: false, code: sig.code });
  const f = formMap(raw);
  const a = String(f.DialALegUUID || f.CallUUID || f.ALegUUID || "").trim();
  const status = String(f.DialStatus || f.DialBLegStatus || f.DialAction || "UNKNOWN").slice(0, 80);
  if (a) {
    const rows = await sql`select id,direction from portal_private.voice_calls where provider_call_id=${a} limit 1`;
    if (rows.length === 1) {
      const terminal = ["completed","busy","failed","cancel","timeout","no-answer","hangup"].includes(status.toLowerCase());
      await recordCallEvent(String(rows[0].id), "PLIVO_DIAL_STATUS", "TELEPHONY_PROVIDER", { status, hangup_cause: String(f.DialHangupCause || f.DialBLegHangupCauseName || "").slice(0, 120) });
      if (terminal) await sql`update portal_private.voice_calls set status=${status.toLowerCase()==='completed'?'COMPLETED':'FAILED'},ended_at=now(),last_error_code=${status.toLowerCase()==='completed'?null:`PLIVO_${status.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`} where id=${String(rows[0].id)}::uuid`;
    }
  }
  const rid = String(new URL(req.url).searchParams.get("rid") || "");
  if (UUID_RE.test(rid) && ["completed","busy","failed","cancel","timeout","no-answer","hangup"].includes(status.toLowerCase())) {
    await sql`update portal_private.voice_outbound_requests set state=${status.toLowerCase()==='completed'?'COMPLETED':'FAILED'},last_error_code=${status.toLowerCase()==='completed'?null:`PLIVO_${status.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`} where id=${rid}::uuid`;
  }
  return xml(200, `<?xml version="1.0" encoding="UTF-8"?><Response/>`);
}

function sipHeaderMap(headers) {
  const out = {};
  for (const h of Array.isArray(headers) ? headers : []) {
    const n = String(h?.name || "").trim().toLowerCase();
    if (n) out[n] = String(h?.value || "").trim();
  }
  return out;
}

async function resolveOpenAICallBinding(data) {
  const h = sipHeaderMap(data?.sip_headers);
  const requestKey = normalizeUuidKey(h["x-ph-ronarequest"] || h["ronarequest"]);
  const providerKey = normalizeUuidKey(h["x-ph-ronaprovidercall"] || h["ronaprovidercall"]);
  const roleCode = String(h["x-ph-ronarole"] || h["ronarole"] || "").toUpperCase();
  if (requestKey.length === 32) {
    const rows = await sql`select id,target_role::text as role,purpose,state,authorization_state,dispatch_call_id from portal_private.voice_outbound_requests where replace(id::text,'-','')=${requestKey} limit 1`;
    if (rows.length === 1 && rows[0].authorization_state === "AUTHORIZED" && ["AUTHORIZED","DISPATCHED"].includes(String(rows[0].state))) {
      return { direction: "OUTBOUND", role: String(rows[0].role), purpose: String(rows[0].purpose), requestId: String(rows[0].id), voiceCallId: rows[0].dispatch_call_id ? String(rows[0].dispatch_call_id) : null };
    }
  }
  if (providerKey.length >= 16) {
    const rows = await sql`select id,direction,routed_role::text as role,metadata from portal_private.voice_calls where replace(lower(provider_call_id),'-','')=${providerKey} order by created_at desc limit 1`;
    if (rows.length === 1) return { direction: String(rows[0].direction), role: String(rows[0].role || CODE_ROLE[roleCode] || "OPERATIONS_DIRECTOR"), purpose: null, requestId: rows[0].metadata?.request_id || null, voiceCallId: String(rows[0].id) };
  }
  return null;
}

async function rejectIncoming(callId, voiceCallId, reason) {
  try { await openAIRealtimeCall(callId, "reject", { status_code: 603 }); } catch { /* preserve fail closed */ }
  if (voiceCallId) {
    await sql`update portal_private.voice_calls set status='REJECTED',last_error_code=${reason},ended_at=now() where id=${voiceCallId}::uuid`;
    await recordCallEvent(voiceCallId, "CALL_REJECTED_FAIL_CLOSED", "RONA_GATEWAY", { reason });
  }
}

async function handleOpenAIWebhook(req) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const webhookSecret = Deno.env.get("OPENAI_WEBHOOK_SECRET");
  if (!apiKey || !webhookSecret) return send(503, { ok: false, code: "VOICE_OPENAI_CREDENTIALS_NOT_CONFIGURED" });
  const raw = await req.text();
  let event;
  try {
    const client = new OpenAI({ apiKey, webhookSecret, maxRetries: 0 });
    event = client.webhooks.unwrap(raw, req.headers);
  } catch { return send(400, { ok: false, code: "INVALID_OPENAI_WEBHOOK_SIGNATURE" }); }
  const eventType = String(event?.type || "");
  if (eventType !== "realtime.call.incoming") return send(200, { ok: true, accepted: true, ignored: true, eventType });
  const data = event?.data || {};
  const callId = String(data.call_id || data.id || data.call?.id || "").trim();
  if (!callId || callId.length > 200) return send(400, { ok: false, code: "OPENAI_CALL_ID_MISSING" });
  const binding = await resolveOpenAICallBinding(data);
  if (!binding || !BUSINESS_ROLES.has(binding.role)) {
    try { await openAIRealtimeCall(callId, "reject", { status_code: 603 }); } catch { /* no-op */ }
    return send(200, { ok: true, accepted: false, code: "TRUSTED_TELEPHONY_BINDING_REQUIRED" });
  }
  const c = await control();
  const ready = binding.direction === "OUTBOUND" ? outboundReady(c) : inboundReady(c);
  if (!ready) {
    await rejectIncoming(callId, binding.voiceCallId, "VOICE_GATE_NOT_READY");
    return send(200, { ok: true, accepted: false, code: "VOICE_GATE_NOT_READY" });
  }
  const voiceCallId = binding.voiceCallId || String((await sql`
    insert into portal_private.voice_calls(openai_call_id,direction,routed_role,identity_state,status,metadata)
    values(${callId},${binding.direction},${binding.role}::portal_private.ai_business_role_enum,'UNVERIFIED','RECEIVED',${sql.json({ request_id: binding.requestId })}::jsonb)
    on conflict (openai_call_id) do update set updated_at=now() returning id
  `)[0].id);
  await sql`update portal_private.voice_calls set openai_call_id=${callId},routed_role=${binding.role}::portal_private.ai_business_role_enum,status='RECEIVED' where id=${voiceCallId}::uuid`;
  await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_INCOMING", "OPENAI", { direction: binding.direction, role: binding.role, request_id: binding.requestId }, await sha256Hex(raw));
  const model = Deno.env.get("RONA_VOICE_REALTIME_MODEL") || "gpt-realtime";
  try {
    await openAIRealtimeCall(callId, "accept", {
      type: "realtime",
      model,
      instructions: voiceInstructions(binding.role, binding.direction, binding.purpose),
      output_modalities: ["audio"],
      max_output_tokens: 1024,
      tool_choice: "none",
      tracing: null,
    });
    await sql`update portal_private.voice_calls set status='ACCEPTED',answered_at=coalesce(answered_at,now()),last_error_code=null where id=${voiceCallId}::uuid`;
    await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_ACCEPTED", "RONA_GATEWAY", { model, role: binding.role, authority: roleBridgeMode(), tools: "NONE" });
    return send(200, { ok: true, accepted: true });
  } catch {
    await sql`update portal_private.voice_calls set status='FAILED',last_error_code='OPENAI_ACCEPT_FAILED',ended_at=now() where id=${voiceCallId}::uuid`;
    await recordCallEvent(voiceCallId, "OPENAI_REALTIME_CALL_ACCEPT_FAILED", "RONA_GATEWAY", { code: "OPENAI_ACCEPT_FAILED" });
    return send(502, { ok: false, code: "OPENAI_ACCEPT_FAILED" });
  }
}

function plivoBasicAuth() {
  const id = String(Deno.env.get("PLIVO_AUTH_ID") || "");
  const token = String(Deno.env.get("PLIVO_AUTH_TOKEN") || "");
  if (!id || !token) throw Object.assign(new Error("PLIVO_CREDENTIALS_NOT_CONFIGURED"), { status: 503 });
  return `Basic ${btoa(`${id}:${token}`)}`;
}

async function plivoApi(path, init = {}) {
  const id = String(Deno.env.get("PLIVO_AUTH_ID") || "");
  const response = await fetch(`https://api.plivo.com/v1/Account/${encodeURIComponent(id)}${path}`, {
    ...init,
    headers: { authorization: plivoBasicAuth(), accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function handleAdminPlivoPrepare(req) {
  const ctx = await adminContext(req);
  if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" });
  const presence = { plivoAuthId: Boolean(Deno.env.get("PLIVO_AUTH_ID")), plivoAuthToken: Boolean(Deno.env.get("PLIVO_AUTH_TOKEN")), plivoFrom: Boolean(safeE164(Deno.env.get("PLIVO_FROM_E164"))), openaiApiKey: Boolean(Deno.env.get("OPENAI_API_KEY")), openaiWebhookSecret: Boolean(Deno.env.get("OPENAI_WEBHOOK_SECRET")), openaiProjectId: Boolean(Deno.env.get("OPENAI_PROJECT_ID")) };
  if (!Object.values(presence).every(Boolean)) return send(409, { ok: false, code: "VOICE_EXTERNAL_CREDENTIALS_INCOMPLETE", presence });
  const p = await plivoApi("/", { method: "GET" });
  const model = Deno.env.get("RONA_VOICE_REALTIME_MODEL") || "gpt-realtime";
  const o = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` } });
  if (!p.ok || !o.ok) return send(409, { ok: false, code: "VOICE_EXTERNAL_PROVIDER_PROBE_FAILED", plivoStatus: p.status, openaiStatus: o.status });
  const from = safeE164(Deno.env.get("PLIVO_FROM_E164"));
  await sql.begin(async (tx) => {
    await tx`update portal_private.voice_gateway_control set provider='PLIVO',provider_mode='PLIVO_SIP_BRIDGE',provider_state='CONFIGURED',provider_number_e164=${from},provider_verified_at=now(),openai_realtime_state='CONFIGURED',model_execution_state='TESTING',activation_gate='FOUNDATION',enabled=false,inbound_enabled=false,outbound_enabled=false,configured_at=coalesce(configured_at,now()),updated_by=${ctx.userId}::uuid where singleton=true`;
    await audit(tx, ctx, "VOICE_PLIVO_PROVIDER_PROBE_PASSED", "VOICE_GATEWAY", "PLIVO", req, { provider: "PLIVO", model, number_present: true });
  });
  return send(200, { ok: true, provider: "PLIVO", providerState: "CONFIGURED", openaiRealtimeState: "CONFIGURED", modelExecutionState: "TESTING", activationGate: "FOUNDATION", liveCallingEnabled: false });
}

async function handleAdminHealth(req) {
  const ctx = await adminContext(req);
  if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" });
  const c = await control();
  if (!c) return send(503, { ok: false, code: "VOICE_CONTROL_MISSING" });
  return send(200, {
    ok: true, service: "rona-voice-gateway", version: VERSION,
    control: {
      enabled: Boolean(c.enabled), inboundEnabled: Boolean(c.inbound_enabled), outboundEnabled: Boolean(c.outbound_enabled), provider: String(c.provider), providerMode: String(c.provider_mode), providerState: String(c.provider_state), providerNumberConfigured: Boolean(c.provider_number_e164), defaultInboundRole: String(c.default_inbound_role), openaiRealtimeState: String(c.openai_realtime_state), modelExecutionState: String(c.model_execution_state), activationGate: String(c.activation_gate), identityPolicy: String(c.identity_policy), recordingPolicy: String(c.recording_policy), transcriptPolicy: String(c.transcript_policy), humanFailoverState: String(c.human_failover_state),
    },
    capabilities: { openaiCredentialsPresent: openAIConfigPresent(), plivoCredentialsPresent: plivoConfigPresent(), roleBridgePresent: roleBridgePresent(), roleBridgeMode: roleBridgeMode(), providerAdapterPresent: providerAdapterPresent(c), inboundReady: inboundReady(c), outboundReady: outboundReady(c) },
  });
}

async function dispatchPlivoOutbound(requestId, destination) {
  const from = safeE164(Deno.env.get("PLIVO_FROM_E164"));
  if (!from) throw Object.assign(new Error("PLIVO_FROM_E164_MISSING"), { status: 503 });
  const answer = `${VOICE_BASE}/plivo/outbound/answer?rid=${encodeURIComponent(requestId)}`;
  const hangup = `${VOICE_BASE}/plivo/dial-status?rid=${encodeURIComponent(requestId)}`;
  return await plivoApi("/Call/", { method: "POST", body: JSON.stringify({ from, to: destination, answer_url: answer, answer_method: "POST", hangup_url: hangup, hangup_method: "POST", time_limit: 3600 }) });
}

async function handleOutboundRequest(req) {
  const ctx = await adminContext(req);
  if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" });
  const body = await jsonBody(req);
  const sourceRecordId = String(body.sourceRecordId || "").trim();
  const targetRole = String(body.targetRole || "").trim();
  const destination = String(body.destinationE164 || "").trim();
  const purpose = String(body.purpose || "").trim();
  const idempotencyKey = String(body.idempotencyKey || "").trim();
  if (!UUID_RE.test(sourceRecordId)) return send(400, { ok: false, code: "INVALID_SOURCE_RECORD_ID" });
  if (!BUSINESS_ROLES.has(targetRole)) return send(400, { ok: false, code: "INVALID_TARGET_ROLE" });
  if (!E164_RE.test(destination)) return send(400, { ok: false, code: "INVALID_DESTINATION_E164" });
  if (!purpose || purpose.length > 500) return send(400, { ok: false, code: "INVALID_PURPOSE" });
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return send(400, { ok: false, code: "INVALID_IDEMPOTENCY_KEY" });
  const source = await sql`select record_id,functional_role::text as functional_role,target_role::text as target_role,status from portal_private.ai_coordination_records where record_id=${sourceRecordId}::uuid and qa_only=false limit 1`;
  if (source.length !== 1) return send(409, { ok: false, code: "AUTHORITATIVE_SOURCE_RECORD_REQUIRED" });
  const sourceRoles = new Set([String(source[0].functional_role || ""), String(source[0].target_role || "")]);
  if (!sourceRoles.has(targetRole)) return send(409, { ok: false, code: "SOURCE_ROLE_MISMATCH" });
  const existing = await sql`select id,state,authorization_state,last_error_code,provider_request_id from portal_private.voice_outbound_requests where idempotency_key=${idempotencyKey} limit 1`;
  if (existing.length === 1) return send(200, { ok: !["BLOCKED","FAILED"].includes(String(existing[0].state)), idempotent: true, requestId: String(existing[0].id), state: String(existing[0].state), authorizationState: String(existing[0].authorization_state), providerRequestRecorded: Boolean(existing[0].provider_request_id), code: existing[0].last_error_code ? String(existing[0].last_error_code) : null });
  const c = await control();
  if (!outboundReady(c)) {
    const created = await sql.begin(async (tx) => {
      const rows = await tx`insert into portal_private.voice_outbound_requests(source_record_id,target_role,destination_e164,purpose,authorization_state,state,idempotency_key,requested_by,last_error_code,provider_name) values(${sourceRecordId}::uuid,${targetRole}::portal_private.ai_business_role_enum,${destination},${purpose},'BLOCKED','BLOCKED',${idempotencyKey},${ctx.userId}::uuid,'VOICE_OUTBOUND_GATE_NOT_READY','PLIVO') returning id`;
      const id = String(rows[0].id);
      await audit(tx, ctx, "VOICE_OUTBOUND_REQUEST_BLOCKED", "VOICE_OUTBOUND_REQUEST", id, req, { source_record_id: sourceRecordId, target_role: targetRole, reason: "VOICE_OUTBOUND_GATE_NOT_READY" }, "DENIED", "WARNING");
      return id;
    });
    return send(409, { ok: false, requestId: created, state: "BLOCKED", authorizationState: "BLOCKED", code: "VOICE_OUTBOUND_GATE_NOT_READY" });
  }
  const requestId = await sql.begin(async (tx) => {
    const rows = await tx`insert into portal_private.voice_outbound_requests(source_record_id,target_role,destination_e164,purpose,authorization_state,state,authorization_ref,idempotency_key,requested_by,provider_name) values(${sourceRecordId}::uuid,${targetRole}::portal_private.ai_business_role_enum,${destination},${purpose},'AUTHORIZED','AUTHORIZED',${`ADMIN:${ctx.userId}`},${idempotencyKey},${ctx.userId}::uuid,'PLIVO') returning id`;
    const id = String(rows[0].id);
    await audit(tx, ctx, "VOICE_OUTBOUND_REQUEST_AUTHORIZED", "VOICE_OUTBOUND_REQUEST", id, req, { source_record_id: sourceRecordId, target_role: targetRole, provider: "PLIVO" });
    return id;
  });
  const p = await dispatchPlivoOutbound(requestId, destination);
  if (!p.ok) {
    await sql`update portal_private.voice_outbound_requests set state='FAILED',last_error_code='PLIVO_CALL_CREATE_FAILED' where id=${requestId}::uuid`;
    await sql.begin(async (tx) => { await audit(tx, ctx, "VOICE_OUTBOUND_DISPATCH_FAILED", "VOICE_OUTBOUND_REQUEST", requestId, req, { provider: "PLIVO", http_status: p.status }, "FAILURE", "ERROR"); });
    return send(502, { ok: false, requestId, state: "FAILED", code: "PLIVO_CALL_CREATE_FAILED" });
  }
  const providerRequestId = String(p.data?.request_uuid || p.data?.api_id || "").slice(0, 240) || null;
  await sql`update portal_private.voice_outbound_requests set state='DISPATCHED',provider_request_id=${providerRequestId},last_error_code=null where id=${requestId}::uuid`;
  await sql.begin(async (tx) => { await audit(tx, ctx, "VOICE_OUTBOUND_DISPATCHED", "VOICE_OUTBOUND_REQUEST", requestId, req, { provider: "PLIVO", provider_request_recorded: Boolean(providerRequestId) }); });
  return send(202, { ok: true, requestId, state: "DISPATCHED", authorizationState: "AUTHORIZED", provider: "PLIVO" });
}

Deno.serve(async (req) => {
  const path = pathOf(req);
  try {
    if (req.method === "GET" && (path === "/" || path === "/health")) return send(200, { ok: true, service: "rona-voice-gateway", version: VERSION, mode: "FAIL_CLOSED_PLIVO_ADAPTER" });
    if (req.method === "GET" && path === "/admin/health") return await handleAdminHealth(req);
    if (req.method === "POST" && path === "/admin/provider/plivo/prepare") return await handleAdminPlivoPrepare(req);
    if (req.method === "POST" && path === "/admin/outbound/request") return await handleOutboundRequest(req);
    if (req.method === "POST" && path === "/openai/webhook") return await handleOpenAIWebhook(req);
    if (req.method === "POST" && path === "/plivo/inbound/answer") return await handlePlivoInboundAnswer(req);
    if (req.method === "POST" && path === "/plivo/outbound/answer") return await handlePlivoOutboundAnswer(req);
    if (req.method === "POST" && path === "/plivo/dial-status") return await handlePlivoDialStatus(req);
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  } catch (error) {
    const status = Number(error?.status || 500);
    const code = String(error?.message || "VOICE_GATEWAY_ERROR").replace(/[^A-Z0-9_]/gi, "_").slice(0, 120) || "VOICE_GATEWAY_ERROR";
    return send(status >= 400 && status < 600 ? status : 500, { ok: false, code });
  }
});
