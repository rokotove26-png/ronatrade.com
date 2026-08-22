// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import OpenAI from "openai";

const DB = Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!DB || !SUPA_URL) throw new Error("runtime vars missing");

const sql = postgres(DB, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 10, max_lifetime: 60 });
const VERSION = "1.0.0";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E164_RE = /^\+[1-9][0-9]{7,14}$/;
const BUSINESS_ROLES = new Set(["OPERATIONS_DIRECTOR", "FINANCE", "LEGAL", "MARKET_ANALYST", "RAIL_LOGISTICS"]);

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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
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
  } catch {
    return {};
  }
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
  return {
    authUserId: String(data.user.id),
    userId: String(rows[0].portal_user_id),
    displayName: String(rows[0].display_name || ""),
    sessionId: sid,
  };
}

async function jsonBody(req) {
  try {
    const value = await req.json();
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch {
    throw Object.assign(new Error("INVALID_JSON"), { status: 400 });
  }
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
    insert into portal_private.audit_events(
      actor_user_id,actor_role,action,entity_type,entity_id,request_id,correlation_id,metadata,severity,result
    ) values(
      ${ctx?.userId || null}::uuid,
      ${ctx ? "ADMIN" : "SYSTEM"},
      ${action},${entityType},${entityId},
      ${requestId}::uuid,${correlationId}::uuid,
      ${sql.json(metadata)}::jsonb,
      ${severity}::portal_private.audit_severity_enum,
      ${result}::portal_private.audit_result_enum
    )
  `;
  return requestId;
}

async function control() {
  const rows = await sql`
    select enabled,inbound_enabled,outbound_enabled,provider,provider_state,openai_realtime_state,
           model_execution_state,activation_gate,identity_policy,recording_policy,transcript_policy,
           human_failover_state,configured_at,activated_at,updated_at
    from portal_private.voice_gateway_control
    where singleton=true
    limit 1
  `;
  return rows[0] || null;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function openAIConfigPresent() {
  return Boolean(Deno.env.get("OPENAI_API_KEY") && Deno.env.get("OPENAI_WEBHOOK_SECRET"));
}

function roleBridgePresent() {
  return Deno.env.get("RONA_VOICE_ROLE_BRIDGE_READY") === "true";
}

function providerAdapterPresent() {
  return Deno.env.get("RONA_VOICE_PROVIDER_ADAPTER_READY") === "true";
}

function fullyReady(c) {
  return Boolean(
    c && c.enabled && c.inbound_enabled &&
    c.provider_state === "READY" &&
    c.openai_realtime_state === "READY" &&
    c.model_execution_state === "READY" &&
    c.activation_gate === "PRODUCTION_READY" &&
    openAIConfigPresent() && roleBridgePresent()
  );
}

async function openAIRealtimeCall(callId, action, body = undefined) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw Object.assign(new Error("OPENAI_API_KEY_MISSING"), { status: 503 });
  const response = await fetch(`https://api.openai.com/v1/realtime/calls/${encodeURIComponent(callId)}/${action}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = Object.assign(new Error(`OPENAI_${action.toUpperCase()}_FAILED`), { status: response.status, data });
    throw err;
  }
  return data;
}

async function rejectIncoming(callId, voiceCallId, reason) {
  try {
    await openAIRealtimeCall(callId, "reject", { status_code: 603 });
    await sql.begin(async (tx) => {
      await tx`update portal_private.voice_calls set status='REJECTED',last_error_code=${reason},ended_at=now() where id=${voiceCallId}::uuid`;
      await tx`
        insert into portal_private.voice_call_events(voice_call_id,event_type,event_source,metadata)
        values(${voiceCallId}::uuid,'CALL_REJECTED_FAIL_CLOSED','RONA_GATEWAY',${sql.json({ reason })}::jsonb)
      `;
    });
  } catch (error) {
    await sql.begin(async (tx) => {
      await tx`update portal_private.voice_calls set status='BLOCKED',last_error_code='OPENAI_REJECT_FAILED' where id=${voiceCallId}::uuid`;
      await tx`
        insert into portal_private.voice_call_events(voice_call_id,event_type,event_source,metadata)
        values(${voiceCallId}::uuid,'CALL_REJECT_FAILED','RONA_GATEWAY',${sql.json({ reason: String(error?.message || error).slice(0, 120) })}::jsonb)
      `;
    });
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
  } catch {
    return send(400, { ok: false, code: "INVALID_OPENAI_WEBHOOK_SIGNATURE" });
  }

  const eventType = String(event?.type || "");
  if (eventType !== "realtime.call.incoming") {
    return send(200, { ok: true, accepted: true, ignored: true, eventType });
  }

  const data = event?.data || {};
  const callId = String(data.call_id || data.id || data.call?.id || "").trim();
  if (!callId || callId.length > 200) return send(400, { ok: false, code: "OPENAI_CALL_ID_MISSING" });
  const payloadHash = await sha256Hex(raw);

  const rows = await sql.begin(async (tx) => {
    const inserted = await tx`
      insert into portal_private.voice_calls(openai_call_id,direction,status,metadata)
      values(${callId},'INBOUND','RECEIVED',${sql.json({ webhook_event_type: eventType })}::jsonb)
      on conflict (openai_call_id) do update set updated_at=now()
      returning id,status
    `;
    const voiceCallId = String(inserted[0].id);
    await tx`
      insert into portal_private.voice_call_events(voice_call_id,event_type,event_source,payload_hash,metadata)
      values(${voiceCallId}::uuid,'OPENAI_REALTIME_CALL_INCOMING','OPENAI',${payloadHash},${sql.json({ event_type: eventType })}::jsonb)
    `;
    return [{ id: voiceCallId }];
  });
  const voiceCallId = rows[0].id;
  const c = await control();

  if (!fullyReady(c)) {
    await rejectIncoming(callId, voiceCallId, "VOICE_GATE_NOT_READY");
    return send(200, { ok: true, accepted: false, code: "VOICE_GATE_NOT_READY" });
  }

  const model = Deno.env.get("RONA_VOICE_REALTIME_MODEL") || "gpt-realtime-2.1-mini";
  const instructions = [
    "You are the RONA Trade voice reception router.",
    "Do not treat a phone number, caller name, email address, or spoken company name as authoritative identity.",
    "Do not disclose client-specific contracts, payments, prices, documents, internal diagnostics, credentials, tokens, QA identities, or other protected information without an authoritative identity mapping and applicable access gates.",
    "Do not make legal, commercial, financial, IAM, contract, publication, or binding mutations.",
    "Internal follow-up must use the audited RONA network coordination contour, never internal email.",
    "If identity or authority is ambiguous, act fail-closed and offer a safe human follow-up path.",
    "This reception session is not itself a business-role employee and must not inherit FINANCE, LEGAL, MARKET_ANALYST, RAIL_LOGISTICS, OPERATIONS_DIRECTOR, or SYSTEM_ADMIN authority.",
  ].join(" ");

  try {
    await openAIRealtimeCall(callId, "accept", {
      type: "realtime",
      model,
      instructions,
      output_modalities: ["audio"],
      max_output_tokens: 1024,
      tracing: null,
    });
    await sql.begin(async (tx) => {
      await tx`update portal_private.voice_calls set status='ACCEPTED',answered_at=now(),last_error_code=null where id=${voiceCallId}::uuid`;
      await tx`
        insert into portal_private.voice_call_events(voice_call_id,event_type,event_source,metadata)
        values(${voiceCallId}::uuid,'OPENAI_REALTIME_CALL_ACCEPTED','RONA_GATEWAY',${sql.json({ model, authority: 'RECEPTION_ROUTER_ONLY' })}::jsonb)
      `;
    });
    return send(200, { ok: true, accepted: true });
  } catch (error) {
    await sql.begin(async (tx) => {
      await tx`update portal_private.voice_calls set status='FAILED',last_error_code='OPENAI_ACCEPT_FAILED',ended_at=now() where id=${voiceCallId}::uuid`;
      await tx`
        insert into portal_private.voice_call_events(voice_call_id,event_type,event_source,metadata)
        values(${voiceCallId}::uuid,'OPENAI_REALTIME_CALL_ACCEPT_FAILED','RONA_GATEWAY',${sql.json({ code: 'OPENAI_ACCEPT_FAILED' })}::jsonb)
      `;
    });
    return send(502, { ok: false, code: "OPENAI_ACCEPT_FAILED" });
  }
}

async function handleAdminHealth(req) {
  const ctx = await adminContext(req);
  if (!ctx) return send(401, { ok: false, code: "ADMIN_AUTH_REQUIRED" });
  const c = await control();
  if (!c) return send(503, { ok: false, code: "VOICE_CONTROL_MISSING" });
  return send(200, {
    ok: true,
    service: "rona-voice-gateway",
    version: VERSION,
    control: {
      enabled: Boolean(c.enabled),
      inboundEnabled: Boolean(c.inbound_enabled),
      outboundEnabled: Boolean(c.outbound_enabled),
      provider: String(c.provider),
      providerState: String(c.provider_state),
      openaiRealtimeState: String(c.openai_realtime_state),
      modelExecutionState: String(c.model_execution_state),
      activationGate: String(c.activation_gate),
      identityPolicy: String(c.identity_policy),
      recordingPolicy: String(c.recording_policy),
      transcriptPolicy: String(c.transcript_policy),
      humanFailoverState: String(c.human_failover_state),
    },
    capabilities: {
      openaiCredentialsPresent: openAIConfigPresent(),
      roleBridgePresent: roleBridgePresent(),
      providerAdapterPresent: providerAdapterPresent(),
      inboundReady: fullyReady(c),
      outboundReady: Boolean(c.enabled && c.outbound_enabled && c.provider_state === "READY" && c.model_execution_state === "READY" && providerAdapterPresent()),
    },
  });
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

  const source = await sql`
    select record_id,functional_role::text as functional_role,target_role::text as target_role,status
    from portal_private.ai_coordination_records
    where record_id=${sourceRecordId}::uuid and qa_only=false
    limit 1
  `;
  if (source.length !== 1) return send(409, { ok: false, code: "AUTHORITATIVE_SOURCE_RECORD_REQUIRED" });
  const sourceRoles = new Set([String(source[0].functional_role || ""), String(source[0].target_role || "")]);
  if (!sourceRoles.has(targetRole)) return send(409, { ok: false, code: "SOURCE_ROLE_MISMATCH" });

  const existing = await sql`
    select id,state,authorization_state,last_error_code
    from portal_private.voice_outbound_requests
    where idempotency_key=${idempotencyKey}
    limit 1
  `;
  if (existing.length === 1) {
    return send(200, {
      ok: existing[0].state !== "BLOCKED",
      idempotent: true,
      requestId: String(existing[0].id),
      state: String(existing[0].state),
      authorizationState: String(existing[0].authorization_state),
      code: existing[0].last_error_code ? String(existing[0].last_error_code) : null,
    });
  }

  const c = await control();
  const providerReady = Boolean(c?.enabled && c?.outbound_enabled && c?.provider_state === "READY" && c?.model_execution_state === "READY" && providerAdapterPresent());
  const blocker = providerReady ? "OUTBOUND_PROVIDER_IMPLEMENTATION_PENDING" : "VOICE_OUTBOUND_GATE_NOT_READY";

  const created = await sql.begin(async (tx) => {
    const rows = await tx`
      insert into portal_private.voice_outbound_requests(
        source_record_id,target_role,destination_e164,purpose,authorization_state,state,idempotency_key,requested_by,last_error_code
      ) values(
        ${sourceRecordId}::uuid,${targetRole}::portal_private.ai_business_role_enum,${destination},${purpose},
        'BLOCKED','BLOCKED',${idempotencyKey},${ctx.userId}::uuid,${blocker}
      ) returning id
    `;
    const requestId = String(rows[0].id);
    await audit(tx, ctx, "VOICE_OUTBOUND_REQUEST_BLOCKED", "VOICE_OUTBOUND_REQUEST", requestId, req, {
      source_record_id: sourceRecordId,
      target_role: targetRole,
      reason: blocker,
    }, "DENIED", "WARNING");
    return requestId;
  });

  return send(409, {
    ok: false,
    requestId: created,
    state: "BLOCKED",
    authorizationState: "BLOCKED",
    code: blocker,
  });
}

Deno.serve(async (req) => {
  const path = pathOf(req);
  try {
    if (req.method === "GET" && (path === "/" || path === "/health")) {
      return send(200, {
        ok: true,
        service: "rona-voice-gateway",
        version: VERSION,
        mode: "FAIL_CLOSED_FOUNDATION",
      });
    }
    if (req.method === "GET" && path === "/admin/health") return await handleAdminHealth(req);
    if (req.method === "POST" && path === "/openai/webhook") return await handleOpenAIWebhook(req);
    if (req.method === "POST" && path === "/admin/outbound/request") return await handleOutboundRequest(req);
    return send(404, { ok: false, code: "ROUTE_NOT_FOUND" });
  } catch (error) {
    const status = Number(error?.status || 500);
    const code = String(error?.message || "VOICE_GATEWAY_ERROR").replace(/[^A-Z0-9_]/gi, "_").slice(0, 120) || "VOICE_GATEWAY_ERROR";
    return send(status >= 400 && status < 600 ? status : 500, { ok: false, code });
  }
});
