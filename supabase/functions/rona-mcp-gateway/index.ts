import postgres from "npm:postgres@3.4.7";
import { createFinancePaymentsV7NativeHooks } from "./finance-payments-v7-extension.mjs";
import { createRailXlsxIntakeHooks } from "./rail-xlsx-intake-extension.mjs";
import { createRailXlsxResolutionHooks } from "./rail-xlsx-resolution-extension.mjs";

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
const railXlsxResolutionHooks = createRailXlsxResolutionHooks({
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
const DEFAULT_CURRENT_STATE_RAW_BUDGET_BYTES = 24000;
const FINANCE_CURRENT_STATE_RAW_BUDGET_BYTES = 65536;
const CURRENT_STATE_GZIP_MIN_BYTES = 8192;
const AI_ROLES = new Set(["OPERATIONS_DIRECTOR","FINANCE","LEGAL","MARKET_ANALYST","COMMERCIAL_DIRECTOR","RAIL_LOGISTICS","SYSTEM_ADMIN"]);
const BUSINESS_ROLES = new Set(["OPERATIONS_DIRECTOR","FINANCE","LEGAL","MARKET_ANALYST","COMMERCIAL_DIRECTOR","RAIL_LOGISTICS"]);
const ENTITY_SCOPE = Object.freeze({
  OPERATIONS_DIRECTOR: new Set(["CLIENT","CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","SHIPMENT","RAIL_DOCUMENT","PUBLICATION","TASK"]),
  FINANCE: new Set(["CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","TASK"]),
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
const TASK_COMPLETE_TOOL = {
  name: "task_complete",
  title: "Завершить назначенную задачу",
  description: "Явно завершить задачу своей фиксированной роли. Требует текущего APPROVED+confirmed функционального заключения без обязательных условий и непустых evidence_refs. Functional conclusion сам по себе задачу не закрывает.",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "string", minLength: 1, maxLength: 160 },
      conclusion_record_id: { type: "string", pattern: "^[0-9a-fA-F-]{36}$" },
      note: { type: "string", minLength: 1, maxLength: 4000 },
      evidence_refs: { type: "array", items: { type: "string", minLength: 1, maxLength: 200 }, minItems: 1, maxItems: 20 },
      idempotency_key: { type: "string", minLength: 8, maxLength: 160 },
    },
    required: ["task_id","conclusion_record_id","note","evidence_refs","idempotency_key"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};
const TASK_CLOSE_TOOL = {
  name: "task_close",
  title: "Закрыть назначенную задачу",
  description: "Административно закрыть назначенную своей роли задачу как superseded, duplicate, obsolete source или no longer applicable. Доступно Operations/System Admin; требует явного основания и evidence_refs; business state не изменяет.",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "string", minLength: 1, maxLength: 160 },
      closure_basis: { type: "string", enum: ["SUPERSEDED","DUPLICATE","OBSOLETE_SOURCE","NO_LONGER_APPLICABLE"] },
      note: { type: "string", minLength: 1, maxLength: 4000 },
      evidence_refs: { type: "array", items: { type: "string", minLength: 1, maxLength: 200 }, minItems: 1, maxItems: 20 },
      idempotency_key: { type: "string", minLength: 8, maxLength: 160 },
    },
    required: ["task_id","closure_basis","note","evidence_refs","idempotency_key"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
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
function currentStateRawBudgetBytes(role) {
  return role === "FINANCE" ? FINANCE_CURRENT_STATE_RAW_BUDGET_BYTES : DEFAULT_CURRENT_STATE_RAW_BUDGET_BYTES;
}
function acceptsGzip(req) {
  return /(^|[,\s])gzip(?:[,\s]|$)/i.test(req.headers.get("accept-encoding") || "");
}
function appendVary(headers, value) {
  const existing = String(headers.get("vary") || "").split(",").map(x => x.trim()).filter(Boolean);
  if (!existing.some(x => x.toLowerCase() === value.toLowerCase())) existing.push(value);
  if (existing.length) headers.set("vary", existing.join(", "));
}
async function gzipBytes(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function finalizeCurrentStateResponse(req, res, envelope, body, role) {
  const rawBytes = encoder.encode(body);
  const rawBudget = currentStateRawBudgetBytes(role);
  if (rawBytes.length > rawBudget) {
    console.error("role state v2 response budget exceeded", { role, raw_bytes: rawBytes.length, raw_budget: rawBudget });
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: envelope?.id ?? null,
      error: { code: -32603, message: "ROLE_STATE_V2_RESPONSE_BUDGET_EXCEEDED" },
    }), { status: 500, headers: cloneHeaders(res.headers) });
  }

  const headers = cloneHeaders(res.headers);
  headers.delete("content-length");
  headers.set("x-rona-current-state-raw-bytes", String(rawBytes.length));
  headers.set("x-rona-current-state-raw-budget-bytes", String(rawBudget));
  headers.set("x-rona-current-state-transport", "IDENTITY");
  headers.set("x-rona-current-state-wire-bytes", String(rawBytes.length));

  // Preserve the full authoritative state. Egress optimization is transport-only:
  // no Finance policy, task, checkpoint or coordination field is removed or summarized here.
  if (
    rawBytes.length >= CURRENT_STATE_GZIP_MIN_BYTES &&
    acceptsGzip(req) &&
    typeof CompressionStream === "function"
  ) {
    try {
      const compressed = await gzipBytes(body);
      if (compressed.length < rawBytes.length) {
        headers.set("content-encoding", "gzip");
        headers.set("x-rona-current-state-transport", "GZIP_V1");
        headers.set("x-rona-current-state-wire-bytes", String(compressed.length));
        appendVary(headers, "Accept-Encoding");
        return new Response(compressed, { status: res.status, statusText: res.statusText, headers });
      }
    } catch (e) {
      console.error("current state gzip failed; falling back to identity", String(e?.message || e));
    }
  }

  return new Response(body, { status: res.status, statusText: res.statusText, headers });
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

async function taskLifecycleCall(ctx, req, msg, name) {
  const ids = requestIds(req);
  const args = msg?.params?.arguments ?? {};
  const deny = async (code, taskId = null, idemHash = null, payloadHash = null) => {
    await recordMcpEvent(ctx, ids, name, "DENIED", 200, { code, task_lifecycle_contract: "RONA_AI_TASK_LIFECYCLE_V1" });
    await coordAudit(ctx, ids, name, { targetType: "TASK", targetId: taskId, idemHash, payloadHash, result: "DENIED", denialCode: code, metadata: { task_lifecycle_contract: "RONA_AI_TASK_LIFECYCLE_V1" } });
    return rpcToolResponse(msg.id, { ok: false, code, status: 403 }, true);
  };
  if (!ctx || !scopeHas(ctx.scope, "mcp:coordinate") || !String(ctx.server_slug || "").endsWith("-pilot")) return null;
  if (!AI_ROLES.has(ctx.role)) return deny("ROLE_AUTHORITY_DENIED");
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).some(k => FORBIDDEN_ROLE_KEYS.has(k))) return deny("INVALID_ARGUMENTS");
  if (!await rateAllowed(ctx)) return deny("RATE_LIMITED");

  const taskId = cleanText(args.task_id, 160);
  const note = cleanText(args.note, 4000);
  const evidence = validateRefs(args.evidence_refs);
  const idem = typeof args.idempotency_key === "string" && IDEMPOTENCY_RE.test(args.idempotency_key) ? args.idempotency_key : null;
  if (!taskId || !note || !evidence || evidence.length < 1 || !idem) return deny("INVALID_ARGUMENTS", taskId);

  const allowedKeys = name === "task_complete"
    ? new Set(["task_id","conclusion_record_id","note","evidence_refs","idempotency_key"])
    : new Set(["task_id","closure_basis","note","evidence_refs","idempotency_key"]);
  if (Object.keys(args).some(k => !allowedKeys.has(k))) return deny("INVALID_ARGUMENTS", taskId);

  let conclusionId = null;
  let closureBasis = null;
  if (name === "task_complete") {
    conclusionId = String(args.conclusion_record_id || "");
    if (!UUID_RE.test(conclusionId)) return deny("INVALID_ARGUMENTS", taskId);
  } else {
    if (!["OPERATIONS_DIRECTOR","SYSTEM_ADMIN"].includes(ctx.role)) return deny("TASK_CLOSE_ROLE_DENIED", taskId);
    closureBasis = String(args.closure_basis || "");
    if (!["SUPERSEDED","DUPLICATE","OBSOLETE_SOURCE","NO_LONGER_APPLICABLE"].includes(closureBasis)) return deny("INVALID_ARGUMENTS", taskId);
  }

  const payload = name === "task_complete"
    ? { task_id: taskId, terminal_status: "COMPLETED", conclusion_record_id: conclusionId, note, evidence_refs: evidence }
    : { task_id: taskId, terminal_status: "CLOSED", closure_basis: closureBasis, note, evidence_refs: evidence };
  const idemHash = await sha256Hex(idem);
  const payloadHash = await sha256Hex(stableStringify(payload));

  const existing = await sql`select * from portal_private.ai_coordination_records where identity_id=${ctx.identity_id} and tool_name=${name} and idempotency_key_hash=${idemHash} limit 1`;
  if (existing.length) {
    if (existing[0].payload_hash !== payloadHash) return deny("IDEMPOTENCY_CONFLICT", taskId, idemHash, payloadHash);
    const taskRows = await sql`select status::text status from portal_private.staff_tasks where task_id=${taskId} limit 1`;
    const r = existing[0];
    await recordMcpEvent(ctx, ids, name, "SUCCESS", 200, { coordination_record_id: r.record_id, idempotent_replay: true, materialized_task_status: taskRows[0]?.status ?? null, task_lifecycle_contract: "RONA_AI_TASK_LIFECYCLE_V1" });
    await coordAudit(ctx, ids, name, { targetType: "TASK", targetId: taskId, idemHash, payloadHash, result: "IDEMPOTENT_REPLAY", record: r, metadata: { task_lifecycle_contract: "RONA_AI_TASK_LIFECYCLE_V1" } });
    return rpcToolResponse(msg.id, { ok: true, role: ctx.role, identity_id: ctx.identity_id, correlation_id: ids.correlationId, record_id: r.record_id, record_type: r.record_type, status: r.status, materialized_task_status: taskRows[0]?.status ?? null, idempotent_replay: true });
  }

  const taskRows = await sql`select task_id,status::text status,authority_domain,assigned_functional_role::text assigned_role,qa_only from portal_private.staff_tasks where task_id=${taskId} limit 1`;
  if (taskRows.length !== 1) return deny("TASK_NOT_FOUND", taskId, idemHash, payloadHash);
  const task = taskRows[0];
  if (task.qa_only) return deny("TASK_QA_TARGET_DENIED", taskId, idemHash, payloadHash);
  if (task.assigned_role !== ctx.role) return deny("TASK_ROLE_SCOPE_DENIED", taskId, idemHash, payloadHash);
  if (["DECIDED","COMPLETED","REJECTED","CLOSED"].includes(task.status)) return deny("TASK_FINAL_STATE", taskId, idemHash, payloadHash);
  if (name === "task_close" && ctx.role === "SYSTEM_ADMIN" && !["TECHNICAL","SYSTEM","SECURITY"].includes(String(task.authority_domain || "").toUpperCase())) return deny("SYSTEM_ADMIN_BUSINESS_WRITE_BLOCKED", taskId, idemHash, payloadHash);

  if (name === "task_complete") {
    const c = await sql`
      select c.record_id
      from portal_private.ai_coordination_records c
      where c.record_id=${conclusionId}::uuid
        and c.qa_only=false
        and c.record_type='FUNCTIONAL_CONCLUSION'
        and c.functional_role=${ctx.role}::portal_private.ai_business_role_enum
        and c.target_type='TASK'
        and c.target_id=${taskId}
        and c.status='APPROVED'
        and coalesce((c.payload->>'confirmed')::boolean,false)=true
        and coalesce(jsonb_array_length(c.payload->'mandatory_conditions'),0)=0
        and not exists(select 1 from portal_private.ai_coordination_records n where n.qa_only=false and n.supersedes_id=c.record_id)
        and c.version=(select max(x.version) from portal_private.ai_coordination_records x where x.qa_only=false and x.record_type='FUNCTIONAL_CONCLUSION' and x.functional_role=${ctx.role}::portal_private.ai_business_role_enum and x.target_type='TASK' and x.target_id=${taskId})
      limit 1`;
    if (c.length !== 1) return deny("TASK_COMPLETION_APPROVED_CONCLUSION_REQUIRED", taskId, idemHash, payloadHash);
  }

  const sourceRefs = name === "task_complete" ? [`AI_COORDINATION:${conclusionId}`, ...evidence] : evidence;
  let inserted;
  try {
    inserted = await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${ctx.identity_id + "|" + name + "|" + idemHash},0))`;
      const again = await tx`select * from portal_private.ai_coordination_records where identity_id=${ctx.identity_id} and tool_name=${name} and idempotency_key_hash=${idemHash} limit 1`;
      if (again.length) {
        if (again[0].payload_hash !== payloadHash) throw new Error("IDEMPOTENCY_CONFLICT");
        return again[0];
      }
      const rows = await tx`
        insert into portal_private.ai_coordination_records(
          record_type,functional_role,identity_id,token_id,client_id,server_slug,tool_name,
          target_type,target_id,target_role,parent_record_id,version,supersedes_id,
          idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,
          correlation_id,mcp_request_id,qa_only
        ) values(
          'TASK_TERMINAL_ACTION',${ctx.role}::portal_private.ai_business_role_enum,${ctx.identity_id},
          ${ctx.token_id}::uuid,${ctx.client_id},${ctx.server_slug},${name},
          'TASK',${taskId},${ctx.role}::portal_private.ai_business_role_enum,null,1,null,
          ${idemHash},${payloadHash},${sql.json(sourceRefs)}::jsonb,${sql.json(evidence)}::jsonb,
          ${sql.json(payload)}::jsonb,${name === "task_complete" ? "COMPLETED" : "CLOSED"},
          ${ids.correlationId}::uuid,${ids.mcpRequestId}::uuid,${Boolean(ctx.qaOnly)}
        ) returning *`;
      return rows[0];
    });
  } catch (e) {
    const code = String(e?.message || "").includes("IDEMPOTENCY_CONFLICT") ? "IDEMPOTENCY_CONFLICT" : "TASK_TERMINAL_SETTLEMENT_FAILED";
    console.error("task lifecycle write failed", String(e?.message || e));
    return deny(code, taskId, idemHash, payloadHash);
  }

  const settled = await sql`select status::text status,decision,decision_at from portal_private.staff_tasks where task_id=${taskId} limit 1`;
  const expected = name === "task_complete" ? "COMPLETED" : "CLOSED";
  if (settled[0]?.status !== expected) return deny("TASK_TERMINAL_NOT_MATERIALIZED", taskId, idemHash, payloadHash);

  await recordMcpEvent(ctx, ids, name, "SUCCESS", 200, { coordination_record_id: inserted.record_id, materialized_task_status: settled[0].status, task_lifecycle_contract: "RONA_AI_TASK_LIFECYCLE_V1" });
  await coordAudit(ctx, ids, name, { targetType: "TASK", targetId: taskId, idemHash, payloadHash, result: "SUCCESS", record: inserted, metadata: { materialized_task_status: settled[0].status, task_lifecycle_contract: "RONA_AI_TASK_LIFECYCLE_V1", business_mutation: false } });
  return rpcToolResponse(msg.id, { ok: true, role: ctx.role, identity_id: ctx.identity_id, correlation_id: ids.correlationId, record_id: inserted.record_id, record_type: inserted.record_type, status: inserted.status, materialized_task_status: settled[0].status, idempotent_replay: false });
}
async function augmentToolsListResponse(res, ctx = null) {
  if (!res.ok) return res;
  let envelope;
  try { envelope = await res.clone().json(); } catch { return res; }
  const tools = envelope?.result?.tools;
  if (!Array.isArray(tools)) return res;
  if (!tools.some(t => t?.name === "coordination_detail")) tools.push(COORDINATION_DETAIL_TOOL);
  if (ctx && scopeHas(ctx.scope, "mcp:coordinate") && String(ctx.server_slug || "").endsWith("-pilot")) {
    if (AI_ROLES.has(ctx.role) && !tools.some(t => t?.name === "task_complete")) tools.push(TASK_COMPLETE_TOOL);
    if (["OPERATIONS_DIRECTOR","SYSTEM_ADMIN"].includes(ctx.role) && !tools.some(t => t?.name === "task_close")) tools.push(TASK_CLOSE_TOOL);
  }
  return new Response(JSON.stringify(envelope), { status: res.status, statusText: res.statusText, headers: cloneHeaders(res.headers) });
}
async function compactCurrentStateResponse(res, req) {
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
  return finalizeCurrentStateResponse(req, res, envelope, body, toolPayload.role);
}
async function wrappedRequest(handler, req) {
  const msg = await inspectMcp(req);
  const name = msg?.method === "tools/call" ? String(msg?.params?.name || "") : "";
  const ctx = (msg?.method === "tools/list" || name === "handoff_request_submit" || name === "coordination_detail" || name === "task_complete" || name === "task_close") ? await authContext(req) : null;
  if ((name === "task_complete" || name === "task_close") && ctx) {
    const direct = await taskLifecycleCall(ctx, req, msg, name);
    if (direct) return direct;
  }
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
  const railResolutionDirect = await railXlsxResolutionHooks.toolCall(req, msg);
  if (railResolutionDirect) return railResolutionDirect;
  const railDirect = await railXlsxHooks.toolCall(req, msg);
  if (railDirect) return railDirect;
  if (name === "finance_event_submit") {
    const direct = await financeHooks.toolCall(req, msg);
    if (direct) return direct;
  }
  let res = await handler(req);
  if (msg?.method === "tools/list") {
    res = await augmentToolsListResponse(res, ctx);
    res = await financeHooks.toolsList(req, res);
    res = await railXlsxHooks.toolsList(req, res);
    res = await railXlsxResolutionHooks.toolsList(req, res);
  }
  if (name === "current_state") res = await compactCurrentStateResponse(res, req);
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

await import("./index.js");
