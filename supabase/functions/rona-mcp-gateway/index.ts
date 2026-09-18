import postgres from "npm:postgres@3.4.7";
import { createFinancePaymentsV7NativeHooks } from "./finance-payments-v7-extension.mjs";
import { createRailXlsxIntakeHooks } from "./rail-xlsx-intake-extension.mjs";

const DB = Deno.env.get("SUPABASE_DB_URL");
if (!DB) throw new Error("MCP_RUNTIME_VARS_MISSING");
const sql = postgres(DB, { prepare: false, max: 3 });
const financeHooks = createFinancePaymentsV7NativeHooks({ sql });
const railXlsxHooks = createRailXlsxIntakeHooks({
  sql,
  authContext,
  rateAllowed,
  recordMcpEvent,
  requestIds,
  sha256Hex,
});
const originalServe = Deno.serve.bind(Deno);
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{7,159}$/;
const SAFE_TEXT_RE = /^[^\u0000-\u001F\u007F]{1,4000}$/u;
const AI_ROLES = new Set(["OPERATIONS_DIRECTOR","FINANCE","LEGAL","MARKET_ANALYST","COMMERCIAL_DIRECTOR","RAIL_LOGISTICS","SYSTEM_ADMIN"]);
const BUSINESS_ROLES = new Set(["OPERATIONS_DIRECTOR","FINANCE","LEGAL","MARKET_ANALYST","COMMERCIAL_DIRECTOR","RAIL_LOGISTICS"]);
const ENTITY_SCOPE = Object.freeze({
  OPERATIONS_DIRECTOR: new Set(["CLIENT","CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","SHIPMENT","RAIL_DOCUMENT","PUBLICATION","TASK"]),
  FINANCE: new Set(["CONTRACT","APPLICATION","DEAL","PAYMENT","TASK"]),
  LEGAL: new Set(["CONTRACT","DEAL","DOCUMENT","TASK"]),
  MARKET_ANALYST: new Set(["CLIENT","CONTRACT","APPLICATION","DEAL","PUBLICATION","TASK"]),
  COMMERCIAL_DIRECTOR: new Set(["CLIENT","CONTRACT","APPLICATION","DEAL","PUBLICATION","TASK"]),
  RAIL_LOGISTICS: new Set(["DEAL","SHIPMENT","RAIL_DOCUMENT","TASK"]),
  SYSTEM_ADMIN: new Set(["TASK","SYSTEM"]),
});
const HANDOFF_KEYS = new Set(["target_role","entity_type","entity_id","subject","requested_check","reason","priority","source_refs","idempotency_key"]);
const FORBIDDEN_ROLE_KEYS = new Set(["role","business_role","identity_id","ai_identity_id","functional_role","server_slug","token_id","owner_admin"]);
const COORDINATION_DETAIL_TOOL = {
  name: "coordination_detail",
  title: "Детали координации",
  description: "Получить полный payload одной audited coordination-записи, видимой фиксированной роли. Не расширяет authority на бизнес-объект.",
  inputSchema: {
    type: "object",
    properties: { record_id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" } },
    required: ["record_id"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

function roleCanUseEntity(role, type) {
  return ENTITY_SCOPE[role]?.has(type) === true;
}
function scopeHas(scope, value) {
  return new Set(String(scope || "").split(/\s+/).filter(Boolean)).has(value);
}
function readBearer(req) {
  const h = req.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}
function requestIds(req) {
  const r = req.headers.get("x-request-id") || "";
  const c = req.headers.get("x-correlation-id") || "";
  return {
    mcpRequestId: UUID_RE.test(r) ? r : crypto.randomUUID(),
    correlationId: UUID_RE.test(c) ? c : crypto.randomUUID(),
  };
}
function cleanText(v, max = 4000) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > max || !SAFE_TEXT_RE.test(s)) return null;
  return s;
}
function validateRefs(v) {
  if (!Array.isArray(v) || v.length > 20) return null;
  const out = [];
  for (const x of v) {
    const s = cleanText(x, 200);
    if (!s) return null;
    out.push(s);
  }
  return out;
}
function stableValue(v) {
  if (Array.isArray(v)) return v.map(stableValue);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = stableValue(v[k]);
    return o;
  }
  return v;
}
function stableStringify(v) {
  return JSON.stringify(stableValue(v));
}
async function sha256Hex(v) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(v))));
  return [...d].map(x => x.toString(16).padStart(2, "0")).join("");
}
function cloneHeaders(headers) {
  const out = new Headers(headers);
  out.set("cache-control", "no-store, no-cache, must-revalidate");
  out.set("pragma", "no-cache");
  out.set("x-rona-role-state-contract", "RONA_ROLE_STATE_RECOVERY_V2");
  out.set("x-rona-coordination-contract", "RONA_CROSS_ROLE_COORDINATION_V1");
  return out;
}
function rpcToolResponse(id, body, isError = false, status = 200) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: id ?? null,
    result: { content: [{ type: "text", text: JSON.stringify(body) }], ...(isError ? { isError: true } : {}) },
  }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
      "x-rona-role-state-contract": "RONA_ROLE_STATE_RECOVERY_V2",
      "x-rona-coordination-contract": "RONA_CROSS_ROLE_COORDINATION_V1",
    },
  });
}
async function inspectMcp(req) {
  if (req.method !== "POST") return null;
  try {
    const msg = await req.clone().json();
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return null;
    return msg;
  } catch {
    return null;
  }
}
async function authContext(req) {
  const raw = readBearer(req);
  if (!raw) return null;
  const hash = await sha256Hex(raw);
  const rows = await sql`
    select t.token_id,t.client_id,t.owner_portal_user_id,t.scope,t.server_slug,
           t.functional_role::text as role,t.identity_id,c.max_requests_per_minute,
           c.enabled,i.status::text as identity_status,i.revoked_at as identity_revoked
      from portal_private.mcp_oauth_tokens t
      join portal_private.mcp_gateway_config c
        on c.server_slug=t.server_slug
       and c.business_role=t.functional_role
       and c.identity_id=t.identity_id
      join portal_private.ai_service_identities i
        on i.identity_id=t.identity_id
       and i.business_role=t.functional_role
     where t.access_token_hash=${hash}
       and t.revoked_at is null
       and t.access_expires_at>now()
       and c.enabled=true
       and i.status::text='ACTIVE'
       and i.revoked_at is null
     limit 1`;
  if (rows.length !== 1) return null;
  const ctx = rows[0];
  const client = await sql`select client_name from portal_private.mcp_oauth_clients where client_id=${ctx.client_id} limit 1`;
  ctx.qaOnly = Boolean(client[0]?.client_name && String(client[0].client_name).startsWith("RONA Phase 2B2 QA"));
  return ctx;
}
async function rateAllowed(ctx) {
  const rows = await sql`select count(*)::int n from portal_private.mcp_gateway_request_events where token_id=${ctx.token_id}::uuid and event_at>now()-interval '60 seconds'`;
  return Number(rows[0]?.n || 0) < Number(ctx.max_requests_per_minute || 60);
}
async function recordMcpEvent(ctx, ids, tool, result, httpStatus = 200, metadata = {}) {
  await sql`insert into portal_private.mcp_gateway_request_events(server_slug,functional_role,identity_id,token_id,client_id,owner_portal_user_id,tool_name,mcp_request_id,backend_request_id,correlation_id,result,http_status,metadata) values(${ctx.server_slug},${ctx.role}::portal_private.ai_business_role_enum,${ctx.identity_id},${ctx.token_id}::uuid,${ctx.client_id},${ctx.owner_portal_user_id ?? null}::uuid,${tool},${ids.mcpRequestId}::uuid,null,${ids.correlationId}::uuid,${result},${httpStatus},${sql.json(metadata)}::jsonb)`;
}
async function coordAudit(ctx, ids, tool, { targetType = null, targetId = null, idemHash = null, payloadHash = null, result = "DENIED", denialCode = null, record = null, metadata = {} } = {}) {
  try {
    await sql`insert into portal_private.ai_coordination_audit_events(functional_role,identity_id,token_id,client_id,server_slug,tool_name,target_type,target_id,correlation_id,mcp_request_id,idempotency_key_hash,payload_hash,result,denial_code,resulting_record_id,resulting_version,qa_only,metadata) values(${ctx.role}::portal_private.ai_business_role_enum,${ctx.identity_id},${ctx.token_id}::uuid,${ctx.client_id},${ctx.server_slug},${tool},${targetType},${targetId},${ids.correlationId}::uuid,${ids.mcpRequestId}::uuid,${idemHash},${payloadHash},${result},${denialCode},${record?.record_id ?? null}::uuid,${record?.version ?? null},${Boolean(ctx.qaOnly)},${sql.json(metadata)}::jsonb)`;
  } catch (e) {
    console.error("coord audit write failed", String(e?.message || e));
  }
}
async function entityExists(type, id) {
  switch (type) {
    case "CLIENT": return (await sql`select 1 from portal_private.clients where client_id=${id} limit 1`).length === 1;
    case "CONTRACT": return (await sql`select 1 from portal_private.contracts where contract_id=${id} limit 1`).length === 1;
    case "APPLICATION": return (await sql`select 1 from portal_private.client_applications where application_id=${id} limit 1`).length === 1;
    case "DEAL": return (await sql`select 1 from portal_private.deals where deal_id=${id} limit 1`).length === 1;
    case "DOCUMENT": return (await sql`select 1 from portal_private.documents where document_id=${id} limit 1`).length === 1;
    case "PAYMENT": return (await sql`select 1 from portal_private.payments where payment_id=${id} limit 1`).length === 1;
    case "SHIPMENT": return (await sql`select 1 from portal_private.shipments where shipment_id=${id} limit 1`).length === 1;
    case "RAIL_DOCUMENT": return (await sql`select 1 from portal_private.rail_documents where rail_document_id=${id} limit 1`).length === 1;
    case "PUBLICATION": return (await sql`select 1 from portal_private.publications where publication_id=${id} limit 1`).length === 1;
    case "TASK": return (await sql`select 1 from portal_private.staff_tasks where task_id=${id} limit 1`).length === 1;
    case "SYSTEM": return ["MCP","PORTAL","SECURITY","AUTH","INFRASTRUCTURE"].includes(id);
    default: return false;
  }
}
function syntacticallyValidCrossRoleHandoff(ctx, args) {
  if (!ctx || !scopeHas(ctx.scope, "mcp:coordinate") || !String(ctx.server_slug || "").endsWith("-pilot")) return null;
  if (!BUSINESS_ROLES.has(ctx.role) || !args || typeof args !== "object" || Array.isArray(args)) return null;
  if (Object.keys(args).some(k => !HANDOFF_KEYS.has(k) || FORBIDDEN_ROLE_KEYS.has(k))) return null;
  const targetRole = String(args.target_role || "");
  const type = String(args.entity_type || "").toUpperCase();
  const id = cleanText(args.entity_id, 160);
  const subject = cleanText(args.subject, 1000);
  const check = cleanText(args.requested_check, 4000);
  const reason = cleanText(args.reason, 4000);
  const priority = String(args.priority || "");
  const refs = validateRefs(args.source_refs);
  const idem = typeof args.idempotency_key === "string" && IDEMPOTENCY_RE.test(args.idempotency_key) ? args.idempotency_key : null;
  if (!BUSINESS_ROLES.has(targetRole) || !AI_ROLES.has(targetRole) || !id || !subject || !check || !reason || !["LOW","NORMAL","HIGH","CRITICAL"].includes(priority) || !refs || !idem) return null;
  if (!roleCanUseEntity(ctx.role, type)) return null;
  if (roleCanUseEntity(targetRole, type)) return null;
  return { targetRole, type, id, subject, check, reason, priority, refs, idem };
}
async function createCrossRoleHandoff(ctx, req, msg, normalized) {
  const ids = requestIds(req);
  if (!await rateAllowed(ctx)) return null;
  if (!await entityExists(normalized.type, normalized.id)) {
    await recordMcpEvent(ctx, ids, "handoff_request_submit", "DENIED", 200, { code: "TARGET_NOT_FOUND_OR_OUT_OF_SCOPE", coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" });
    await coordAudit(ctx, ids, "handoff_request_submit", { targetType: normalized.type, targetId: normalized.id, result: "DENIED", denialCode: "TARGET_NOT_FOUND_OR_OUT_OF_SCOPE", metadata: { coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" } });
    return rpcToolResponse(msg.id, { ok: false, code: "TARGET_NOT_FOUND_OR_OUT_OF_SCOPE", status: 403 }, true);
  }
  const payload = { target_role: normalized.targetRole, entity_type: normalized.type, entity_id: normalized.id, subject: normalized.subject, requested_check: normalized.check, reason: normalized.reason, priority: normalized.priority, source_refs: normalized.refs, idempotency_key: normalized.idem };
  const idemHash = await sha256Hex(normalized.idem);
  const payloadForHash = { ...payload };
  delete payloadForHash.idempotency_key;
  const payloadHash = await sha256Hex(stableStringify(payloadForHash));
  const existing = await sql`select * from portal_private.ai_coordination_records where identity_id=${ctx.identity_id} and tool_name='handoff_request_submit' and idempotency_key_hash=${idemHash} limit 1`;
  if (existing.length) {
    if (existing[0].payload_hash !== payloadHash) {
      await recordMcpEvent(ctx, ids, "handoff_request_submit", "DENIED", 200, { code: "IDEMPOTENCY_CONFLICT", coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" });
      await coordAudit(ctx, ids, "handoff_request_submit", { targetType: normalized.type, targetId: normalized.id, idemHash, payloadHash, result: "CONFLICT", denialCode: "IDEMPOTENCY_CONFLICT", metadata: { coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" } });
      return rpcToolResponse(msg.id, { ok: false, code: "IDEMPOTENCY_CONFLICT", status: 409 }, true);
    }
    const r = existing[0];
    await recordMcpEvent(ctx, ids, "handoff_request_submit", "SUCCESS", 200, { coordination_record_id: r.record_id, version: r.version, idempotent_replay: true, coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" });
    await coordAudit(ctx, ids, "handoff_request_submit", { targetType: normalized.type, targetId: normalized.id, idemHash, payloadHash, result: "IDEMPOTENT_REPLAY", record: r, metadata: { coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" } });
    return rpcToolResponse(msg.id, { ok: true, role: ctx.role, identity_id: ctx.identity_id, correlation_id: ids.correlationId, record_id: r.record_id, record_type: r.record_type, status: r.status, version: r.version, idempotent_replay: true });
  }
  let inserted;
  try {
    inserted = await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${ctx.identity_id}|handoff_request_submit|${idemHash}`},0))`;
      const again = await tx`select * from portal_private.ai_coordination_records where identity_id=${ctx.identity_id} and tool_name='handoff_request_submit' and idempotency_key_hash=${idemHash} limit 1`;
      if (again.length) return again[0];
      const body = { ...payload };
      delete body.idempotency_key;
      const rows = await tx`insert into portal_private.ai_coordination_records(record_type,functional_role,identity_id,token_id,client_id,server_slug,tool_name,target_type,target_id,target_role,parent_record_id,version,supersedes_id,idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,correlation_id,mcp_request_id,qa_only) values('HANDOFF_REQUEST',${ctx.role}::portal_private.ai_business_role_enum,${ctx.identity_id},${ctx.token_id}::uuid,${ctx.client_id},${ctx.server_slug},'handoff_request_submit',${normalized.type},${normalized.id},${normalized.targetRole}::portal_private.ai_business_role_enum,null,1,null,${idemHash},${payloadHash},${sql.json(normalized.refs)}::jsonb,'[]'::jsonb,${sql.json(body)}::jsonb,'REQUESTED',${ids.correlationId}::uuid,${ids.mcpRequestId}::uuid,${Boolean(ctx.qaOnly)}) returning *`;
      return rows[0];
    });
  } catch (e) {
    console.error("cross-role handoff create failed", String(e?.message || e));
    await recordMcpEvent(ctx, ids, "handoff_request_submit", "DENIED", 200, { code: "COORDINATION_WRITE_ERROR", coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" });
    await coordAudit(ctx, ids, "handoff_request_submit", { targetType: normalized.type, targetId: normalized.id, idemHash, payloadHash, result: "ERROR", denialCode: "COORDINATION_WRITE_ERROR", metadata: { coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" } });
    return rpcToolResponse(msg.id, { ok: false, code: "COORDINATION_WRITE_ERROR", status: 500 }, true);
  }
  await recordMcpEvent(ctx, ids, "handoff_request_submit", "SUCCESS", 200, { coordination_record_id: inserted.record_id, version: inserted.version, idempotent_replay: false, notification_only: true, authority_granted: false, coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" });
  await coordAudit(ctx, ids, "handoff_request_submit", { targetType: normalized.type, targetId: normalized.id, idemHash, payloadHash, result: "SUCCESS", record: inserted, metadata: { notification_only: true, authority_granted: false, coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" } });
  return rpcToolResponse(msg.id, { ok: true, role: ctx.role, identity_id: ctx.identity_id, correlation_id: ids.correlationId, record_id: inserted.record_id, record_type: inserted.record_type, status: inserted.status, version: inserted.version, idempotent_replay: false, notification_only: true, authority_granted: false });
}
async function coordinationDetail(ctx, req, msg) {
  const ids = requestIds(req);
  if (!await rateAllowed(ctx)) return null;
  const args = msg?.params?.arguments ?? {};
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length !== 1 || !UUID_RE.test(String(args.record_id || ""))) {
    await recordMcpEvent(ctx, ids, "coordination_detail", "DENIED", 200, { code: "INVALID_ARGUMENTS" });
    return rpcToolResponse(msg.id, { ok: false, code: "INVALID_ARGUMENTS", status: 403 }, true);
  }
  const recordId = String(args.record_id);
  const rows = await sql`select record_id,record_type,functional_role::text as from_role,target_role::text,target_type,target_id,parent_record_id,version,supersedes_id,status,payload,source_refs,evidence_refs,created_at from portal_private.ai_coordination_records where record_id=${recordId}::uuid and qa_only=false and (functional_role=${ctx.role}::portal_private.ai_business_role_enum or target_role=${ctx.role}::portal_private.ai_business_role_enum or (${ctx.role}='OPERATIONS_DIRECTOR' and record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION') and target_type<>'SYSTEM')) limit 1`;
  if (rows.length !== 1) {
    await recordMcpEvent(ctx, ids, "coordination_detail", "DENIED", 200, { code: "COORDINATION_RECORD_NOT_VISIBLE" });
    return rpcToolResponse(msg.id, { ok: false, code: "COORDINATION_RECORD_NOT_VISIBLE", status: 403 }, true);
  }
  await recordMcpEvent(ctx, ids, "coordination_detail", "SUCCESS", 200, { coordination_record_id: recordId, coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" });
  return rpcToolResponse(msg.id, { ok: true, role: ctx.role, identity_id: ctx.identity_id, correlation_id: ids.correlationId, data: rows[0] });
}
async function augmentToolsListResponse(res) {
  if (!res.ok) return res;
  let envelope;
  try { envelope = await res.clone().json(); } catch { return res; }
  const tools = envelope?.result?.tools;
  if (!Array.isArray(tools)) return res;
  if (!tools.some(t => t?.name === "coordination_detail")) tools.push(COORDINATION_DETAIL_TOOL);
  return new Response(JSON.stringify(envelope), { status: res.status, statusText: res.statusText, headers: cloneHeaders(res.headers) });
}
async function compactCurrentStateResponse(res) {
  if (!res.ok) return res;
  let envelope;
  try { envelope = await res.clone().json(); } catch { return res; }
  const content = envelope?.result?.content;
  if (!Array.isArray(content) || content.length < 1 || content[0]?.type !== "text" || typeof content[0]?.text !== "string") return res;
  let toolPayload;
  try { toolPayload = JSON.parse(content[0].text); } catch { return res; }
  if (toolPayload?.ok !== true || typeof toolPayload?.role !== "string") return res;
  let rows;
  try { rows = await sql`select portal_private.ai_role_state_current_v2(${toolPayload.role}::portal_private.ai_business_role_enum, 10, 20) as data`; }
  catch (e) { console.error("role state v2 projection failed", String(e?.message || e)); return res; }
  if (!rows?.[0]?.data) return res;
  toolPayload.data = rows[0].data;
  content[0].text = JSON.stringify(toolPayload);
  const body = JSON.stringify(envelope);
  if (encoder.encode(body).length > 24000) {
    console.error("role state v2 response budget exceeded");
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: envelope?.id ?? null, error: { code: -32603, message: "ROLE_STATE_V2_RESPONSE_BUDGET_EXCEEDED" } }), { status: 500, headers: cloneHeaders(res.headers) });
  }
  return new Response(body, { status: res.status, statusText: res.statusText, headers: cloneHeaders(res.headers) });
}
async function wrappedRequest(handler, req) {
  const msg = await inspectMcp(req);
  const name = msg?.method === "tools/call" ? String(msg?.params?.name || "") : "";
  const ctx = (name === "handoff_request_submit" || name === "coordination_detail") ? await authContext(req) : null;
  if (name === "coordination_detail" && ctx && scopeHas(ctx.scope, "mcp:read")) {
    const direct = await coordinationDetail(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "handoff_request_submit" && ctx) {
    const normalized = syntacticallyValidCrossRoleHandoff(ctx, msg?.params?.arguments ?? {});
    if (normalized) {
      const direct = await createCrossRoleHandoff(ctx, req, msg, normalized);
      if (direct) return direct;
    }
  }
  const railDirect = await railXlsxHooks.toolCall(req, msg);
  if (railDirect) return railDirect;
  if (name === "finance_event_submit") {
    const direct = await financeHooks.toolCall(req, msg);
    if (direct) return direct;
  }
  let res = await handler(req);
  if (msg?.method === "tools/list") {
    res = await augmentToolsListResponse(res);
    res = await financeHooks.toolsList(req, res);
    res = await railXlsxHooks.toolsList(req, res);
  }
  if (name === "current_state") res = await compactCurrentStateResponse(res);
  return res;
}

(Deno).serve = function (...args) {
  if (typeof args[0] === "function") {
    const handler = args[0];
    return originalServe(req => wrappedRequest(handler, req));
  }
  if (typeof args[1] === "function") {
    const options = args[0];
    const handler = args[1];
    return originalServe(options, req => wrappedRequest(handler, req));
  }
  return originalServe(...args);
};

await import("https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/36727a94820e1e85e95d4abfc5d6aab8234c5c18/supabase/functions/rona-mcp-gateway/index.js");
