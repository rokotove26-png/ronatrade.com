// Historical production lineage before the v61 in-repo sync: https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/36727a94820e1e85e95d4abfc5d6aab8234c5c18/supabase/functions/rona-mcp-gateway/index.js
// Lineage only. Current runtime authority is this self-contained in-repo source; no remote runtime import is performed.
import { SYSTEM_ADMIN_DETAIL_TOOLS, createSystemAdminDetails } from "./system-admin-details.mjs";
import { observeRuntimeResponse } from "./runtime-continuity.mjs";
import { buildRegistryContract, compactEnvelope, stateErrorEnvelope, addStateDetail, identityError } from "./state-projection.mjs";
import postgres from "npm:postgres@3.4.7";
import { createFinancePaymentsV7NativeHooks } from "./finance-payments-v7-extension.mjs";

const DB = Deno.env.get("SUPABASE_DB_URL");
if (!DB) throw new Error("MCP_RUNTIME_VARS_MISSING");
const sql = postgres(DB, { prepare: false, max: 3 });
const financeHooks = createFinancePaymentsV7NativeHooks({ sql });
const originalServe = Deno.serve.bind(Deno);
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_RE = /^[A-Za-z0-9][A-Za-z0-9._:\/-]{7,159}$/;
const SAFE_TEXT_RE = /^[^\u0000-\u001F\u007F]{1,4000}$/u;
const PUBLIC_ORIGIN = "https://ronaoil.com";
const MCP_ROLE_SEGMENTS = new Set([
  "operations","operations-pilot",
  "finance","finance-pilot",
  "legal","legal-pilot",
  "market-analyst","market-analyst-pilot",
  "rail-logistics","rail-logistics-pilot",
  "system-admin","system-admin-pilot",
]);

function roleSegmentFromRequest(req) {
  const pathname = new URL(req.url).pathname;
  const marker = "/functions/v1/rona-mcp-gateway/";
  const rest = pathname.includes(marker)
    ? pathname.slice(pathname.indexOf(marker) + marker.length)
    : pathname.replace(/^\/+/, "");
  const first = rest.split("/")[0] || "";
  return MCP_ROLE_SEGMENTS.has(first) ? first : null;
}
function coordinateSegment(segment) { return segment === "system-admin" || String(segment || "").endsWith("-pilot"); }
function primaryTechnicalCtx(ctx) { return ["rona-mcp-system-admin","rona-mcp-system-admin-pilot"].includes(ctx?.server_slug) && ctx?.role === "SYSTEM_ADMIN" && ctx?.identity_id === "AI-SYSTEM-ADMIN"; }
function coordinateContext(ctx) { return primaryTechnicalCtx(ctx) || String(ctx?.server_slug || "").endsWith("-pilot"); }
function oauthScopesForSegment(segment) {
  return coordinateSegment(segment)
    ? ["mcp:read","mcp:coordinate","offline_access"]
    : ["mcp:read","offline_access"];
}
function publicRoleBase(segment) {
  return `${PUBLIC_ORIGIN}/${segment}`;
}
function publicMcpResourceForSegment(segment) {
  return `${publicRoleBase(segment)}/mcp`;
}
function oauthProtectedMetadataForSegment(segment) {
  return {
    resource: publicMcpResourceForSegment(segment),
    authorization_servers: [publicRoleBase(segment)],
    scopes_supported: oauthScopesForSegment(segment),
    bearer_methods_supported: ["header"],
    resource_documentation: "https://ronaoil.com",
  };
}
function oauthAuthorizationMetadataForSegment(segment) {
  const issuer = publicRoleBase(segment);
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    revocation_endpoint: `${issuer}/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code","refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: oauthScopesForSegment(segment),
    authorization_response_iss_parameter_supported: false,
    client_id_metadata_document_supported: false,
    service_documentation: "https://ronaoil.com",
  };
}
function oauthMetadataResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "x-content-type-options": "nosniff",
    },
  });
}
function oauthDiscoveryResponse(req) {
  if (req.method !== "GET") return null;
  const pathname = new URL(req.url).pathname;
  const marker = "/functions/v1/rona-mcp-gateway/";
  const rest = pathname.includes(marker)
    ? pathname.slice(pathname.indexOf(marker) + marker.length)
    : pathname.replace(/^\/+/, "");

  for (const segment of MCP_ROLE_SEGMENTS) {
    if (rest === `${segment}/.well-known/oauth-protected-resource`) {
      return oauthMetadataResponse(oauthProtectedMetadataForSegment(segment));
    }
    if (rest === `${segment}/.well-known/oauth-authorization-server`) {
      return oauthMetadataResponse(oauthAuthorizationMetadataForSegment(segment));
    }
    if (rest === `.well-known/oauth-protected-resource/${segment}/mcp`) {
      return oauthMetadataResponse(oauthProtectedMetadataForSegment(segment));
    }
    if (rest === `.well-known/oauth-authorization-server/${segment}`) {
      return oauthMetadataResponse(oauthAuthorizationMetadataForSegment(segment));
    }
  }
  return null;
}
function oauthUnauthorizedResponse(segment) {
  const scope = coordinateSegment(segment)
    ? "mcp:read mcp:coordinate"
    : "mcp:read";
  return new Response(JSON.stringify({ error: "invalid_token" }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "pragma": "no-cache",
      "www-authenticate": `Bearer resource_metadata="${publicRoleBase(segment)}/.well-known/oauth-protected-resource", scope="${scope}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
function normalizeOauthChallenge(res, segment) {
  if (!segment || res.status !== 401) return res;
  const headers = cloneHeaders(res.headers);
  const scope = coordinateSegment(segment) ? "mcp:read mcp:coordinate" : "mcp:read";
  headers.set(
    "www-authenticate",
    `Bearer resource_metadata="${publicRoleBase(segment)}/.well-known/oauth-protected-resource", scope="${scope}"`,
  );
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
const AI_ROLES = new Set(["OPERATIONS_DIRECTOR","FINANCE","LEGAL","MARKET_ANALYST","COMMERCIAL_DIRECTOR","RAIL_LOGISTICS","SYSTEM_ADMIN"]);
const CANONICAL_AI_HANDOFF_TARGETS = Object.freeze(["COMMERCIAL_DIRECTOR","FINANCE","LEGAL","OPERATIONS_DIRECTOR","RAIL_LOGISTICS","SYSTEM_ADMIN"]);
const CANONICAL_AI_HANDOFF_TARGET_SET = new Set(CANONICAL_AI_HANDOFF_TARGETS);
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
const EXCEPTION_COCKPIT_TOOL = {
  name: "exception_cockpit",
  title: "Операционные исключения",
  description: "Получить exception-first cockpit текущей фиксированной роли: ACTION_NOW, WAITING_EXTERNAL, BLOCKED, STALE, STATE_CONFLICTS и semantic reconciliation candidates.",
  inputSchema: { type: "object", additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const EXECUTION_CHECKPOINT_READ_TOOL = {
  name: "execution_checkpoint_read",
  title: "Восстановить рабочий контекст роли",
  description: "Прочитать server-side execution workstreams фиксированной роли. Использовать после current_state, когда пользователь говорит «продолжай/восстанови», после длинной работы или при любой неопределенности контекста. Не просить пользователя повторять задачу, пока не проверены эти checkpoints.",
  inputSchema: { type: "object", additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};
const EXECUTION_CHECKPOINT_SUBMIT_TOOL = {
  name: "execution_checkpoint_submit",
  title: "Сохранить рабочий checkpoint роли",
  description: "Сохранить/обновить host-independent execution checkpoint крупной работы: цель, последний подтвержденный этап и следующий шаг. Это recovery state, не business fact и не завершение задачи. Использовать в начале длинной owner-инструкции и после существенных переходов.",
  inputSchema: {
    type: "object",
    properties: {
      workstream_id: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$" },
      title: { type: "string", minLength: 1, maxLength: 240 },
      objective: { type: "string", minLength: 1, maxLength: 1200 },
      status: { type: "string", enum: ["ACTIVE","BLOCKED","PAUSED","COMPLETED"] },
      last_completed: { type: "string", minLength: 1, maxLength: 1600 },
      next_action: { type: "string", minLength: 1, maxLength: 1600 },
      blockers: { type: "array", items: { type: "string", minLength: 1, maxLength: 300 }, maxItems: 10 },
      source_refs: { type: "array", items: { type: "string", minLength: 1, maxLength: 200 }, maxItems: 20 },
      task_id: { type: "string", minLength: 1, maxLength: 160 },
      idempotency_key: { type: "string", minLength: 8, maxLength: 160 }
    },
    required: ["workstream_id","title","objective","status","last_completed","next_action","blockers","source_refs","idempotency_key"],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

const TASK_COMPLETE_TOOL = {
  name: "task_complete",
  title: "Завершить назначенную задачу",
  description: "Перевести назначенную фиксированной роли задачу в COMPLETED только при текущем APPROVED+confirmed functional conclusion без mandatory conditions и с evidence refs.",
  inputSchema: {
    type: "object",
    properties: {
      task_id: { type: "string", minLength: 1, maxLength: 160 },
      conclusion_record_id: { type: "string", format: "uuid" },
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
  title: "Закрыть неактуальную задачу",
  description: "Административно закрыть назначенную задачу только по перечисленному основанию SUPERSEDED, DUPLICATE, OBSOLETE_SOURCE или NO_LONGER_APPLICABLE. Не означает бизнес-выполнение.",
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
  out.set("x-rona-role-state-contract", "RONA_ROLE_STATE_RECOVERY_V6");
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
      "x-rona-role-state-contract": "RONA_ROLE_STATE_RECOVERY_V6",
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
  if (!ctx || !scopeHas(ctx.scope, "mcp:coordinate") || !coordinateContext(ctx)) return null;
  if ((!BUSINESS_ROLES.has(ctx.role) && !primaryTechnicalCtx(ctx)) || !args || typeof args !== "object" || Array.isArray(args)) return null;
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
  if (!BUSINESS_ROLES.has(targetRole) || !CANONICAL_AI_HANDOFF_TARGET_SET.has(targetRole) || !id || !subject || !check || !reason || !["LOW","NORMAL","HIGH","CRITICAL"].includes(priority) || !refs || !idem) return null;
  if (!roleCanUseEntity(ctx.role, type)) return null;
  if (!primaryTechnicalCtx(ctx) && roleCanUseEntity(targetRole, type)) return null;
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
  if (primaryTechnicalCtx(ctx) && normalized.type === "TASK") {
    const rows = await sql`select assigned_functional_role::text as assigned_role,authority_domain from portal_private.staff_tasks where task_id=${normalized.id} limit 1`;
    if (rows.length !== 1 || rows[0].assigned_role !== "SYSTEM_ADMIN" || !["TECHNICAL","SYSTEM","SECURITY"].includes(String(rows[0].authority_domain).toUpperCase())) {
      await recordMcpEvent(ctx, ids, "handoff_request_submit", "DENIED", 200, { code: "TASK_ROLE_SCOPE_DENIED" });
      return rpcToolResponse(msg.id, { ok: false, code: "TASK_ROLE_SCOPE_DENIED", status: 403 }, true);
    }
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

const EXECUTION_WORKSTREAM_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/;
function validateTextArray(v, maxItems, maxLen) {
  if (!Array.isArray(v) || v.length > maxItems) return null;
  const out = [];
  for (const x of v) {
    const s = cleanText(x, maxLen);
    if (!s) return null;
    out.push(s);
  }
  return out;
}
function publicExecutionWorkstream(value, observedAt = null) {
  if (!value || typeof value !== "object" || !EXECUTION_WORKSTREAM_ID_RE.test(String(value.workstream_id || ""))) return null;
  return {
    contract:"RONA_AI_EXECUTION_RESUME_V1",
    workstream_id:String(value.workstream_id),
    title:String(value.title || ""),
    objective:String(value.objective || ""),
    status:String(value.status || ""),
    last_completed:String(value.last_completed || ""),
    next_action:String(value.next_action || ""),
    blockers:Array.isArray(value.blockers) ? value.blockers : [],
    source_refs:Array.isArray(value.source_refs) ? value.source_refs : [],
    task_id:value.task_id ?? null,
    updated_at:value.updated_at || observedAt,
    correlation_id:value.correlation_id || null
  };
}
async function loadExecutionWorkstreams(ctx) {
  const rows = await sql`
    select event_at, correlation_id, metadata
      from portal_private.mcp_gateway_request_events
     where functional_role=${ctx.role}::portal_private.ai_business_role_enum
       and identity_id=${ctx.identity_id}
       and tool_name='execution_checkpoint_submit'
       and result='SUCCESS'
     order by event_at desc
     limit 50`;
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const w = publicExecutionWorkstream(row?.metadata?.workstream, row?.event_at);
    if (!w || seen.has(w.workstream_id)) continue;
    seen.add(w.workstream_id);
    out.push(w);
    if (out.length >= 6) break;
  }
  return out;
}
async function executionCheckpointRead(ctx, req, msg) {
  const ids = requestIds(req);
  if (!await rateAllowed(ctx)) return null;
  const args = msg?.params?.arguments ?? {};
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length !== 0) {
    await recordMcpEvent(ctx, ids, "execution_checkpoint_read", "DENIED", 200, { code:"INVALID_ARGUMENTS" });
    return rpcToolResponse(msg.id, { ok:false, code:"INVALID_ARGUMENTS", status:403 }, true);
  }
  const workstreams = await loadExecutionWorkstreams(ctx);
  await recordMcpEvent(ctx, ids, "execution_checkpoint_read", "SUCCESS", 200, {
    contract:"RONA_AI_EXECUTION_RESUME_V1", storage:"MCP_REQUEST_AUDIT", workstream_count:workstreams.length
  });
  return rpcToolResponse(msg.id, {
    ok:true, role:ctx.role, identity_id:ctx.identity_id, correlation_id:ids.correlationId,
    contract:"RONA_AI_EXECUTION_RESUME_V1", storage:"MCP_REQUEST_AUDIT", workstreams,
    recovery_rule:"Match the current owner request to the most recent relevant ACTIVE/BLOCKED/PAUSED workstream. If one matches, resume from next_action without asking the owner to repeat prior context. COMPLETED workstreams are history only."
  });
}
async function executionCheckpointSubmit(ctx, req, msg) {
  const ids = requestIds(req);
  if (!await rateAllowed(ctx)) return null;
  if (!ctx || !scopeHas(ctx.scope, "mcp:coordinate") || !coordinateContext(ctx)) return null;
  const args = msg?.params?.arguments ?? {};
  const allowed = new Set(["workstream_id","title","objective","status","last_completed","next_action","blockers","source_refs","task_id","idempotency_key"]);
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).some(k => !allowed.has(k) || FORBIDDEN_ROLE_KEYS.has(k))) {
    await recordMcpEvent(ctx, ids, "execution_checkpoint_submit", "DENIED", 200, { code:"INVALID_ARGUMENTS" });
    return rpcToolResponse(msg.id, { ok:false, code:"INVALID_ARGUMENTS", status:403 }, true);
  }
  const workstreamId = typeof args.workstream_id === "string" && EXECUTION_WORKSTREAM_ID_RE.test(args.workstream_id) ? args.workstream_id : null;
  const title = cleanText(args.title,240);
  const objective = cleanText(args.objective,1200);
  const status = ["ACTIVE","BLOCKED","PAUSED","COMPLETED"].includes(String(args.status || "")) ? String(args.status) : null;
  const lastCompleted = cleanText(args.last_completed,1600);
  const nextAction = cleanText(args.next_action,1600);
  const blockers = validateTextArray(args.blockers,10,300);
  const sourceRefs = validateRefs(args.source_refs);
  const taskId = args.task_id == null ? null : cleanText(args.task_id,160);
  const idem = typeof args.idempotency_key === "string" && IDEMPOTENCY_RE.test(args.idempotency_key) ? args.idempotency_key : null;
  if (!workstreamId || !title || !objective || !status || !lastCompleted || !nextAction || !blockers || !sourceRefs || !idem || (args.task_id != null && !taskId)) {
    await recordMcpEvent(ctx, ids, "execution_checkpoint_submit", "DENIED", 200, { code:"INVALID_ARGUMENTS" });
    return rpcToolResponse(msg.id, { ok:false, code:"INVALID_ARGUMENTS", status:403 }, true);
  }
  const idemHash = await sha256Hex(idem);
  const payloadCore = {
    workstream_id:workstreamId, title, objective, status, last_completed:lastCompleted,
    next_action:nextAction, blockers, source_refs:sourceRefs, task_id:taskId
  };
  const payloadHash = await sha256Hex(stableStringify(payloadCore));
  const priorRows = await sql`
    select metadata
      from portal_private.mcp_gateway_request_events
     where functional_role=${ctx.role}::portal_private.ai_business_role_enum
       and identity_id=${ctx.identity_id}
       and tool_name='execution_checkpoint_submit'
       and result='SUCCESS'
       and metadata->>'idempotency_key_hash'=${idemHash}
     order by event_at desc
     limit 1`;
  if (priorRows.length) {
    const priorMeta = priorRows[0].metadata || {};
    if (priorMeta.payload_hash !== payloadHash) {
      await recordMcpEvent(ctx, ids, "execution_checkpoint_submit", "DENIED", 200, { code:"IDEMPOTENCY_CONFLICT", workstream_id:workstreamId });
      return rpcToolResponse(msg.id, { ok:false, code:"IDEMPOTENCY_CONFLICT", status:409 }, true);
    }
    return rpcToolResponse(msg.id, {
      ok:true, role:ctx.role, identity_id:ctx.identity_id, correlation_id:ids.correlationId,
      contract:"RONA_AI_EXECUTION_RESUME_V1", storage:"MCP_REQUEST_AUDIT",
      workstream:publicExecutionWorkstream(priorMeta.workstream), idempotent_replay:true
    });
  }
  const now = new Date().toISOString();
  const entry = {
    contract:"RONA_AI_EXECUTION_RESUME_V1", ...payloadCore,
    updated_at:now, correlation_id:ids.correlationId
  };
  await recordMcpEvent(ctx, ids, "execution_checkpoint_submit", "SUCCESS", 200, {
    contract:"RONA_AI_EXECUTION_RESUME_V1",
    storage:"MCP_REQUEST_AUDIT",
    workstream_id:workstreamId,
    idempotency_key_hash:idemHash,
    payload_hash:payloadHash,
    workstream:entry
  });
  return rpcToolResponse(msg.id, {
    ok:true, role:ctx.role, identity_id:ctx.identity_id, correlation_id:ids.correlationId,
    contract:"RONA_AI_EXECUTION_RESUME_V1", storage:"MCP_REQUEST_AUDIT",
    workstream:entry, idempotent_replay:false
  });
}

async function exceptionCockpit(ctx, req, msg) {
  const ids = requestIds(req);
  if (!await rateAllowed(ctx)) return null;
  const args = msg?.params?.arguments ?? {};
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length !== 0) {
    await recordMcpEvent(ctx, ids, "exception_cockpit", "DENIED", 200, { code: "INVALID_ARGUMENTS" });
    return rpcToolResponse(msg.id, { ok: false, code: "INVALID_ARGUMENTS", status: 403 }, true);
  }
  const rows = await sql`select portal_private.ai_role_exception_cockpit_v1(${ctx.role}::portal_private.ai_business_role_enum) as data`;
  await recordMcpEvent(ctx, ids, "exception_cockpit", "SUCCESS", 200, { contract: "RONA_EXCEPTION_FIRST_COCKPIT_V1" });
  return rpcToolResponse(msg.id, { ok: true, role: ctx.role, identity_id: ctx.identity_id, correlation_id: ids.correlationId, data: rows[0]?.data ?? null });
}

async function taskTerminalAction(ctx, req, msg, terminalStatus) {
  const ids = requestIds(req);
  const tool = terminalStatus === "COMPLETED" ? "task_complete" : "task_close";
  if (!await rateAllowed(ctx)) return null;
  if (!ctx || !scopeHas(ctx.scope, "mcp:coordinate") || !coordinateContext(ctx)) return null;
  const args = msg?.params?.arguments ?? {};
  const allowed = terminalStatus === "COMPLETED"
    ? new Set(["task_id","conclusion_record_id","note","evidence_refs","idempotency_key"])
    : new Set(["task_id","closure_basis","note","evidence_refs","idempotency_key"]);
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).some(k => !allowed.has(k) || FORBIDDEN_ROLE_KEYS.has(k))) {
    await recordMcpEvent(ctx, ids, tool, "DENIED", 200, { code: "INVALID_ARGUMENTS" });
    return rpcToolResponse(msg.id, { ok: false, code: "INVALID_ARGUMENTS", status: 403 }, true);
  }
  const taskId = cleanText(args.task_id,160);
  const note = cleanText(args.note,4000);
  const evidence = validateRefs(args.evidence_refs);
  const idem = typeof args.idempotency_key === "string" && IDEMPOTENCY_RE.test(args.idempotency_key) ? args.idempotency_key : null;
  const conclusionId = terminalStatus === "COMPLETED" && UUID_RE.test(String(args.conclusion_record_id || "")) ? String(args.conclusion_record_id) : null;
  const closureBasis = terminalStatus === "CLOSED" ? String(args.closure_basis || "").toUpperCase() : null;
  if (!taskId || !note || !evidence || evidence.length === 0 || !idem
      || (terminalStatus === "COMPLETED" && !conclusionId)
      || (terminalStatus === "CLOSED" && !["SUPERSEDED","DUPLICATE","OBSOLETE_SOURCE","NO_LONGER_APPLICABLE"].includes(closureBasis))) {
    await recordMcpEvent(ctx, ids, tool, "DENIED", 200, { code: "INVALID_ARGUMENTS" });
    return rpcToolResponse(msg.id, { ok: false, code: "INVALID_ARGUMENTS", status: 403 }, true);
  }
  if (terminalStatus === "CLOSED" && !["OPERATIONS_DIRECTOR","SYSTEM_ADMIN"].includes(ctx.role)) {
    await recordMcpEvent(ctx, ids, tool, "DENIED", 200, { code: "TASK_CLOSE_ROLE_DENIED" });
    return rpcToolResponse(msg.id, { ok: false, code: "TASK_CLOSE_ROLE_DENIED", status: 403 }, true);
  }
  const taskRows = await sql`select task_id,status::text,assigned_functional_role::text as assigned_role,authority_domain from portal_private.staff_tasks where task_id=${taskId} and qa_only=false limit 1`;
  if (taskRows.length !== 1 || taskRows[0].assigned_role !== ctx.role || (primaryTechnicalCtx(ctx) && !["TECHNICAL","SYSTEM","SECURITY"].includes(String(taskRows[0].authority_domain).toUpperCase()))) {
    await recordMcpEvent(ctx, ids, tool, "DENIED", 200, { code: "TASK_NOT_ASSIGNED_TO_ROLE" });
    return rpcToolResponse(msg.id, { ok: false, code: "TASK_NOT_ASSIGNED_TO_ROLE", status: 403 }, true);
  }
  const payload = terminalStatus === "COMPLETED"
    ? { terminal_status: "COMPLETED", conclusion_record_id: conclusionId, note }
    : { terminal_status: "CLOSED", closure_basis: closureBasis, note };
  const idemHash = await sha256Hex(idem);
  const payloadHash = await sha256Hex(stableStringify({ task_id: taskId, ...payload, evidence_refs: evidence }));
  const existing = await sql`select * from portal_private.ai_coordination_records where identity_id=${ctx.identity_id} and tool_name=${tool} and idempotency_key_hash=${idemHash} limit 1`;
  if (existing.length) {
    if (existing[0].payload_hash !== payloadHash) {
      await recordMcpEvent(ctx, ids, tool, "DENIED", 200, { code: "IDEMPOTENCY_CONFLICT" });
      await coordAudit(ctx, ids, tool, { targetType:"TASK", targetId:taskId, idemHash, payloadHash, result:"CONFLICT", denialCode:"IDEMPOTENCY_CONFLICT" });
      return rpcToolResponse(msg.id, { ok:false, code:"IDEMPOTENCY_CONFLICT", status:409 }, true);
    }
    const r=existing[0];
    return rpcToolResponse(msg.id, { ok:true, role:ctx.role, identity_id:ctx.identity_id, correlation_id:ids.correlationId, record_id:r.record_id, status:r.status, version:r.version, idempotent_replay:true });
  }
  let inserted;
  try {
    inserted = await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${`${ctx.identity_id}|${tool}|${idemHash}`},0))`;
      const again = await tx`select * from portal_private.ai_coordination_records where identity_id=${ctx.identity_id} and tool_name=${tool} and idempotency_key_hash=${idemHash} limit 1`;
      if (again.length) return again[0];
      const rows = await tx`insert into portal_private.ai_coordination_records(
        record_type,functional_role,identity_id,token_id,client_id,server_slug,tool_name,
        target_type,target_id,target_role,parent_record_id,version,supersedes_id,
        idempotency_key_hash,payload_hash,source_refs,evidence_refs,payload,status,
        correlation_id,mcp_request_id,qa_only
      ) values(
        'TASK_TERMINAL_ACTION',${ctx.role}::portal_private.ai_business_role_enum,${ctx.identity_id},
        ${ctx.token_id}::uuid,${ctx.client_id},${ctx.server_slug},${tool},
        'TASK',${taskId},${ctx.role}::portal_private.ai_business_role_enum,null,1,null,
        ${idemHash},${payloadHash},
        ${sql.json(terminalStatus === "COMPLETED" ? [`FUNCTIONAL_CONCLUSION:${conclusionId}`] : [`TASK:${taskId}`])}::jsonb,
        ${sql.json(evidence)}::jsonb,${sql.json(payload)}::jsonb,${terminalStatus},
        ${ids.correlationId}::uuid,${ids.mcpRequestId}::uuid,false
      ) returning *`;
      return rows[0];
    });
  } catch (e) {
    const code=String(e?.message || e).slice(0,200);
    await recordMcpEvent(ctx, ids, tool, "DENIED", 200, { code });
    await coordAudit(ctx, ids, tool, { targetType:"TASK", targetId:taskId, idemHash, payloadHash, result:"DENIED", denialCode:code });
    return rpcToolResponse(msg.id, { ok:false, code, status:409 }, true);
  }
  await recordMcpEvent(ctx, ids, tool, "SUCCESS", 200, { coordination_record_id:inserted.record_id, terminal_status:terminalStatus });
  await coordAudit(ctx, ids, tool, { targetType:"TASK", targetId:taskId, idemHash, payloadHash, result:"SUCCESS", record:inserted, metadata:{ terminal_status:terminalStatus } });
  const state = await sql`select status::text as status from portal_private.staff_tasks where task_id=${taskId} limit 1`;
  return rpcToolResponse(msg.id, {
    ok:true, role:ctx.role, identity_id:ctx.identity_id, correlation_id:ids.correlationId,
    record_id:inserted.record_id, record_type:inserted.record_type,
    requested_terminal_status:terminalStatus, task_status:state[0]?.status ?? null,
    idempotent_replay:false
  });
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
  const rows = await sql`select record_id,record_type,functional_role::text as from_role,target_role::text,target_type,target_id,parent_record_id,version,supersedes_id,status,payload,source_refs,evidence_refs,created_at from portal_private.ai_coordination_records where record_id=${recordId}::uuid and qa_only=false and (functional_role=${ctx.role}::portal_private.ai_business_role_enum or target_role=${ctx.role}::portal_private.ai_business_role_enum or (${ctx.role}='OPERATIONS_DIRECTOR' and record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION','TASK_TERMINAL_ACTION') and target_type<>'SYSTEM')) limit 1`;
  if (rows.length !== 1) {
    await recordMcpEvent(ctx, ids, "coordination_detail", "DENIED", 200, { code: "COORDINATION_RECORD_NOT_VISIBLE" });
    return rpcToolResponse(msg.id, { ok: false, code: "COORDINATION_RECORD_NOT_VISIBLE", status: 403 }, true);
  }
  await recordMcpEvent(ctx, ids, "coordination_detail", "SUCCESS", 200, { coordination_record_id: recordId, coordination_policy: "RONA_CROSS_ROLE_COORDINATION_V1" });
  return rpcToolResponse(msg.id, { ok: true, role: ctx.role, identity_id: ctx.identity_id, correlation_id: ids.correlationId, data: primaryTechnicalCtx(ctx) ? { ...rows[0], type: rows[0].record_type, owner: rows[0].payload?.owner ?? null, gate: rows[0].payload?.gate ?? null, dependency: rows[0].payload?.dependency ?? null, required_action: rows[0].payload?.required_action ?? rows[0].payload?.requested_check ?? rows[0].payload?.recommendation ?? null } : rows[0] });
}
function addOAuthSecuritySchemesToTools(envelope) {
  const tools = envelope?.result?.tools;
  if (!Array.isArray(tools)) return envelope;
  for (const tool of tools) {
    if (!tool || typeof tool !== "object") continue;
    const readOnly = tool?.annotations?.readOnlyHint === true;
    tool.securitySchemes = [{
      type: "oauth2",
      scopes: readOnly ? ["mcp:read"] : ["mcp:coordinate"],
    }];
  }
  return envelope;
}
async function addOAuthSecuritySchemesResponse(res) {
  if (!res.ok) return res;
  let envelope;
  try { envelope = await res.clone().json(); } catch { return res; }
  if (!Array.isArray(envelope?.result?.tools)) return res;
  addOAuthSecuritySchemesToTools(envelope);
  return new Response(JSON.stringify(envelope), {
    status: res.status,
    statusText: res.statusText,
    headers: cloneHeaders(res.headers),
  });
}

async function directSystemAdminPilotConsentResponse(req, segment, res) {
  if (req.method !== "GET" || segment !== "system-admin-pilot" || !res.ok) return res;
  const pathname = new URL(req.url).pathname;
  if (!pathname.endsWith("/system-admin-pilot/authorize")) return res;

  const html = await res.text();
  if (!/<form\b/i.test(html)) {
    return new Response(html, { status: res.status, statusText: res.statusText, headers: cloneHeaders(res.headers) });
  }

  const direct = new URL(req.url);
  direct.search = "";
  direct.hash = "";
  const directAction = direct.toString();

  let patched = html.replace(
    /<form\b([^>]*)>/i,
    (full, attrs) => {
      const cleaned = String(attrs || "").replace(/\saction\s*=\s*(["'])[^"']*\1/i, "");
      return `<form${cleaned} action="${directAction}">`;
    }
  );
  patched = patched.replaceAll('type="submit"', "type='submit'");

  const headers = cloneHeaders(res.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set(
    "content-security-policy",
    `default-src 'none'; style-src 'unsafe-inline'; form-action ${direct.origin}; base-uri 'none'; frame-ancestors 'none'`
  );
  headers.set("x-rona-system-admin-pilot-consent", "direct-supabase-post-v3");
  return new Response(patched, { status: res.status, statusText: res.statusText, headers });
}

async function augmentToolsListResponse(res, ctx) {
  if (!res.ok) return res;
  let envelope;
  try { envelope = await res.clone().json(); } catch { return res; }
  const tools = envelope?.result?.tools;
  if (!Array.isArray(tools)) return res;
  if (!tools.some(t => t?.name === "coordination_detail")) tools.push(COORDINATION_DETAIL_TOOL);
  if (!tools.some(t => t?.name === "exception_cockpit")) tools.push(EXCEPTION_COCKPIT_TOOL);
  if (ctx && scopeHas(ctx.scope,"mcp:read") && !tools.some(t => t?.name === "execution_checkpoint_read")) tools.push(EXECUTION_CHECKPOINT_READ_TOOL);
  if (ctx && coordinateContext(ctx) && (primaryTechnicalCtx(ctx) || scopeHas(ctx.scope,"mcp:coordinate")) && !tools.some(t => t?.name === "execution_checkpoint_submit")) tools.push(EXECUTION_CHECKPOINT_SUBMIT_TOOL);
  const currentStateTool = tools.find(t => t?.name === "current_state");
  if (currentStateTool) currentStateTool.description = "Обязательный preflight для любой работы RONA: получить актуальное role-scoped state. Также вызывать немедленно, когда пользователь говорит «продолжай/восстанови», после длинной работы или при неопределенности контекста; server-side execution workstreams не зависят от памяти чата.";

  if (ctx && primaryTechnicalCtx(ctx) && scopeHas(ctx.scope, "mcp:read")) {
    for (const tool of SYSTEM_ADMIN_DETAIL_TOOLS) if (!tools.some(t => t?.name === tool.name)) tools.push(tool);
  }

  const handoff = tools.find(t => t?.name === "handoff_request_submit");
  if (handoff?.inputSchema?.properties?.target_role) {
    handoff.inputSchema.properties.target_role.enum = [...CANONICAL_AI_HANDOFF_TARGETS];
  }

  if (ctx && coordinateContext(ctx) && (primaryTechnicalCtx(ctx) || scopeHas(ctx.scope,"mcp:coordinate"))) {
    if (!tools.some(t => t?.name === "task_complete")) tools.push(TASK_COMPLETE_TOOL);
    if (["OPERATIONS_DIRECTOR","SYSTEM_ADMIN"].includes(ctx.role) && !tools.some(t => t?.name === "task_close")) tools.push(TASK_CLOSE_TOOL);
  }
  return new Response(JSON.stringify(envelope), { status: res.status, statusText: res.statusText, headers: cloneHeaders(res.headers) });
}
async function roleExecutionRecovery(data, ctx) {
  const coordinate = scopeHas(ctx.scope, "mcp:coordinate");
  const records = Array.isArray(data.coordination?.records) ? data.coordination.records : [];
  const tasks = Array.isArray(data.active_tasks) ? data.active_tasks : [];
  const workstreams = await loadExecutionWorkstreams(ctx);
  const writeTools = coordinate
    ? ["execution_checkpoint_submit","task_acknowledge","task_progress_submit","functional_conclusion_submit","handoff_request_submit","task_complete"]
    : [];
  if (coordinate && ["OPERATIONS_DIRECTOR","SYSTEM_ADMIN"].includes(ctx.role)) writeTools.push("task_close");
  return {
    contract: "RONA_AI_OFFICE_EXECUTION_RECOVERY_V3",
    execution_resume: {
      contract:"RONA_AI_EXECUTION_RESUME_V1",
      workstreams,
      checkpoint_tool:"execution_checkpoint_submit",
      read_tool:"execution_checkpoint_read",
      host_independent:true,
      storage:"MCP_REQUEST_AUDIT",
      selection_rule:"On uncertain chat context, match the current owner request to the most recent relevant non-COMPLETED workstream and resume from next_action."
    },
    authority_sources: ["global_role_policies", "competence_contract"],
    transport: { server_slug: ctx.server_slug, functional_role: ctx.role, identity_id: ctx.identity_id, scope: ctx.scope },
    write_scope_granted: coordinate,
    write_tools: writeTools,
    active_task_ids: tasks.map(t => t.task_id || t.id).filter(Boolean),
    checkpoint_is_historical: true,
    checkpoint_semantics: "WORKING_SNAPSHOT_NOT_LIVE_REPOSITORY_AUTHORITY",
    latest_coordination_record_id: records[0]?.record_id || null,
    incoming_handoff_record_ids: records.filter(r => r.record_type === "HANDOFF_REQUEST" && r.target_role === ctx.role && r.status === "REQUESTED").map(r => r.record_id),
    resume_procedure: [
      "If chat context is uncertain, do not ask the owner to repeat the task before checking execution_resume workstreams. Resume the matching workstream from next_action.",
      "For a new substantial owner instruction without a durable task_id, create/update an execution checkpoint before long multi-tool work and after material stage transitions.",
      "Apply canonical policies and the competence gate to the current owner instruction.",
      "Use current_state only as the compact projection; when bootstrap.next is present, perform that exact read in the same turn.",
      "An empty active_tasks list is not a blocker to an owner instruction that is within role competence. Do not invent a task_id.",
      "For an assigned task acknowledge, execute, record evidence-backed progress, and apply existing terminal gates.",
      "For an owner instruction without a task_id execute only within existing role authority; route any out-of-scope remainder through the existing handoff mechanism.",
      "Treat checkpoint repository/release identifiers as historical unless a live technical source explicitly confirms them.",
      "Keep HOLD work on HOLD until its existing gate is satisfied; do not turn historical pending_actions into new authorization.",
      "After an instruction to execute, perform the next available tool action in the same turn. Report an actual result or a specific blocker, not readiness or a repeated plan.",
      "Do not claim verification or mutation without a tool result. Tool availability is not proof of execution.",
      "Chat execution is interactive. Background heartbeat or event-driven work requires separately verified deployed runtime."
    ]
  };
}

let liveTechnicalSourceCache = {expiresAt:0,value:null};
async function liveTechnicalSources(data) {
  const checkpointMain = data?.checkpoint?.canonical_sources?.find?.(x => x?.ref === "main")?.sha || null;
  const now = Date.now();
  let live = liveTechnicalSourceCache.value;
  if (!live || now >= liveTechnicalSourceCache.expiresAt) {
    try {
      const response = await fetch("https://api.github.com/repos/rokotove26-png/ronatrade.com/branches/main", {
        headers:{accept:"application/vnd.github+json","user-agent":"RONA-System-Admin-Current-State"},
        signal:AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("GITHUB_MAIN_UNAVAILABLE");
      const body = await response.json();
      live = {status:"LIVE",source:"GITHUB_API",repository:"rokotove26-png/ronatrade.com",branch:"main",sha:body?.commit?.sha || null,observed_at:new Date().toISOString()};
      liveTechnicalSourceCache = {expiresAt:now + 60000,value:live};
    } catch {
      live = {status:"UNAVAILABLE",source:"GITHUB_API",repository:"rokotove26-png/ronatrade.com",branch:"main",sha:null,observed_at:new Date().toISOString()};
    }
  }
  return {
    repository_main: live,
    checkpoint_main_sha: checkpointMain,
    checkpoint_matches_live_main: live.status === "LIVE" && checkpointMain ? checkpointMain === live.sha : null,
    authority_rule: "LIVE_SOURCE_OVERRIDES_HISTORICAL_CHECKPOINT_FOR_CURRENT_REPOSITORY_STATE",
  };
}

async function loadCanonicalRoleState(ctx) {
  const rows = await sql`select portal_private.ai_role_state_current_v6(${ctx.role}::portal_private.ai_business_role_enum, 10, 20) as data`;
  if (!rows?.[0]?.data) throw new Error("ROLE_STATE_SOURCE_UNAVAILABLE");
  const data = rows[0].data;
  const routing = { ...(data.routing_capabilities || {}) };
  const nonexistentRoles = ["ACCOUNTING","EXECUTIVE_DIRECTOR"];
  const canonicalAiRoles = ["FINANCE","OPERATIONS_DIRECTOR","COMMERCIAL_DIRECTOR","LEGAL","RAIL_LOGISTICS","SYSTEM_ADMIN"];
  routing.contract = "RONA_ROLE_ROUTING_CONTRACT_V4";
  routing.topology_authority = "OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2";
  routing.canonical_ai_roles = canonicalAiRoles;
  routing.nonexistent_roles = nonexistentRoles;
  routing.compatibility_role_map = {
    ACCOUNTING: "FINANCE",
    EXECUTIVE_DIRECTOR: "OPERATIONS_DIRECTOR",
    MARKET_ANALYST: "COMMERCIAL_DIRECTOR",
  };
  routing.ai_role_gaps = [];
  routing.active_ai_roles = (Array.isArray(routing.active_ai_roles) ? routing.active_ai_roles : canonicalAiRoles)
    .filter(role => canonicalAiRoles.includes(role));
  routing.canonical_ai_handoff_targets = (Array.isArray(routing.canonical_ai_handoff_targets)
    ? routing.canonical_ai_handoff_targets
    : canonicalAiRoles).filter(role => canonicalAiRoles.includes(role));
  data.routing_capabilities = routing;
  data.data_contract = "RONA_ROLE_STATE_RECOVERY_V6";
  data.bootstrap = {
    ...(data.bootstrap || {}),
    routing_contract: "RONA_ROLE_ROUTING_CONTRACT_V4",
    canonical_role_topology: "OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2",
    nonexistent_roles: nonexistentRoles,
  };
  if (ctx) data.execution_recovery = await roleExecutionRecovery(data, ctx);
  if (ctx && primaryTechnicalCtx(ctx)) data.technical_live_sources = await liveTechnicalSources(data);
  return data;
}

async function gatewayRegistry(ctx, req) {
  // Module is already initialized by the entrypoint import; no HTTP/SQL probe.
  const { toolsFor } = await import("./gateway-base.mjs");
  const cfg = { server_slug:ctx.server_slug, business_role:ctx.role, identity_id:ctx.identity_id };
  const resolve = async scope => {
    let response = new Response(JSON.stringify({jsonrpc:"2.0",id:1,result:{tools:toolsFor(cfg,{scope})}}));
    response = await augmentToolsListResponse(response,{...ctx,scope});
    const registered = (await response.clone().json()).result.tools;
    response = await financeHooks.toolsList(req,response);
    response = await addOAuthSecuritySchemesResponse(response);
    return { registered, final:(await response.json()).result.tools };
  };
  const enabled = await resolve("mcp:read mcp:coordinate");
  const actual = scopeHas(ctx.scope,"mcp:read") && scopeHas(ctx.scope,"mcp:coordinate") ? enabled : await resolve(ctx.scope);
  return buildRegistryContract(ctx,enabled.registered,enabled.final,actual.final);
}

function stateResponse(envelope, res) {
  const headers = cloneHeaders(res.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(envelope),{status:res.status,statusText:res.statusText,headers});
}

async function compactCurrentStateResponse(res, ctx, req) {
  if (!res.ok) return res;
  let envelope, payload;
  try { envelope = await res.clone().json(); payload = JSON.parse(envelope.result.content[0].text); }
  catch { return stateResponse(stateErrorEnvelope(null,"CURRENT_STATE_RESPONSE_INVALID"),res); }
  if (payload?.ok !== true) return res;
  const mismatch = identityError(payload,ctx);
  if (mismatch) return stateResponse(stateErrorEnvelope(envelope.id,mismatch),res);
  let data, registry;
  try { data = await loadCanonicalRoleState(ctx); }
  catch { return stateResponse(stateErrorEnvelope(envelope.id,"ROLE_STATE_SOURCE_UNAVAILABLE"),res); }
  try { registry = await gatewayRegistry(ctx,req); }
  catch { return stateResponse(stateErrorEnvelope(envelope.id,"TOOL_REGISTRY_SOURCE_UNAVAILABLE"),res); }
  return stateResponse(compactEnvelope(envelope,{...payload,data},ctx,registry),res);
}

async function historyStateDetails(res, ctx) {
  if (!res.ok) return res;
  let envelope, payload;
  try { envelope = await res.clone().json(); payload = JSON.parse(envelope.result.content[0].text); } catch { return res; }
  if (payload?.ok !== true) return res;
  const mismatch = identityError(payload,ctx);
  if (mismatch) {
    envelope.result.content[0].text = JSON.stringify({...payload,role_state_details:{ok:false,code:mismatch}});
    return stateResponse(envelope,res);
  }
  try { payload = addStateDetail(payload,await loadCanonicalRoleState(ctx),ctx); }
  catch (e) { payload = {...payload,role_state_details:{ok:false,code:e?.message === "RUNTIME_IDENTITY_MISMATCH" ? e.message : "ROLE_STATE_DETAIL_UNAVAILABLE"}}; }
  envelope.result.content[0].text = JSON.stringify(payload);
  return stateResponse(envelope,res);
}
const systemAdminDetails = createSystemAdminDetails({ sql, isAdmin: primaryTechnicalCtx, scopeHas, requestIds, rateAllowed, recordMcpEvent, rpcToolResponse });

async function wrappedRequest(handler, req) {
  const discovery = oauthDiscoveryResponse(req);
  if (discovery) return discovery;

  const segment = roleSegmentFromRequest(req);
  if (
    segment &&
    req.method === "GET" &&
    new URL(req.url).pathname.endsWith(`/${segment}/mcp`) &&
    !readBearer(req)
  ) {
    return oauthUnauthorizedResponse(segment);
  }

  const msg = await inspectMcp(req);
  const name = msg?.method === "tools/call" ? String(msg?.params?.name || "") : "";
  const needsCtx = msg?.method === "tools/list" || (name === "history" && msg?.params?.arguments?.domain === "tasks") || ["current_state","handoff_request_submit","coordination_detail","execution_checkpoint_read","execution_checkpoint_submit","exception_cockpit","task_complete","task_close","object_detail","pr_detail","review_detail"].includes(name);
  let ctx;
  try { ctx = needsCtx ? await authContext(req) : null; }
  catch (e) {
    const code = e?.code === "53300" ? "RUNTIME_DB_CONNECTION_LIMIT"
      : e?.code === "CONNECT_TIMEOUT" ? "RUNTIME_DB_CONNECT_TIMEOUT" : "RUNTIME_AUTH_CONTEXT_UNAVAILABLE";
    const envelope = msg?.method === "tools/call"
      ? {jsonrpc:"2.0",id:msg?.id ?? null,result:{isError:true,content:[{type:"text",text:JSON.stringify({ok:false,code,status:503,error_class:"TOOL_RUNTIME_ERROR",phase:"VERIFY_RUNTIME_IDENTITY",recovery:"READ_ONLY_RETRY_AFTER_BACKEND_RECOVERY",authorization_established:false})}]}}
      : {jsonrpc:"2.0",id:msg?.id ?? null,error:{code:-32603,message:code}};
    const response = new Response(JSON.stringify(envelope),{status:200,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
    return observeRuntimeResponse(response,{msg,ctx:null,segment});
  }
  const response = await dispatchWrappedRequest(handler, req, msg, name, ctx, segment);
  return observeRuntimeResponse(response, { msg, ctx, segment });
}

async function dispatchWrappedRequest(handler, req, msg, name, ctx, segment) {
  if (SYSTEM_ADMIN_DETAIL_TOOLS.some(t => t.name === name) && ctx) {
    const direct = await systemAdminDetails(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "coordination_detail" && ctx && scopeHas(ctx.scope, "mcp:read")) {
    const direct = await coordinationDetail(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "execution_checkpoint_read" && ctx && scopeHas(ctx.scope, "mcp:read")) {
    const direct = await executionCheckpointRead(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "execution_checkpoint_submit" && ctx) {
    const direct = await executionCheckpointSubmit(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "exception_cockpit" && ctx && scopeHas(ctx.scope, "mcp:read")) {
    const direct = await exceptionCockpit(ctx, req, msg);
    if (direct) return direct;
  }
  if (name === "task_complete" && ctx) {
    const direct = await taskTerminalAction(ctx, req, msg, "COMPLETED");
    if (direct) return direct;
  }
  if (name === "task_close" && ctx) {
    const direct = await taskTerminalAction(ctx, req, msg, "CLOSED");
    if (direct) return direct;
  }
  if (name === "handoff_request_submit" && ctx) {
    const normalized = syntacticallyValidCrossRoleHandoff(ctx, msg?.params?.arguments ?? {});
    if (normalized) {
      const direct = await createCrossRoleHandoff(ctx, req, msg, normalized);
      if (direct) return direct;
    }
  }
  if (name === "finance_event_submit") {
    const direct = await financeHooks.toolCall(req, msg);
    if (direct) return direct;
  }
  let res = await handler(req);
  // System Admin Pilot must use the same canonical authorize POST path as the other Pilot roles.
  // Do not rewrite the consent form action to an internal Supabase URL.
  res = normalizeOauthChallenge(res, segment);
  if (msg?.method === "tools/list") {
    res = await augmentToolsListResponse(res, ctx);
    res = await financeHooks.toolsList(req, res);
    res = await addOAuthSecuritySchemesResponse(res);
  }
  if (name === "current_state") res = await compactCurrentStateResponse(res, ctx, req);
  if (name === "history" && msg?.params?.arguments?.domain === "tasks" && ctx && scopeHas(ctx.scope,"mcp:read")) res = await historyStateDetails(res,ctx);
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

await import("./gateway-base.mjs");
