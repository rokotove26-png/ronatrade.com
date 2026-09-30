// Observation only: no SQL, network, credential access, response rewriting or gates.
import { CLIENT_TOOL_CATALOG_REFERENCE } from './client-tool-catalog-reference.mjs';

export const RUNTIME_CONTINUITY_CONTRACT = Object.freeze({
  contract: 'RONA_AI_OFFICE_RUNTIME_CONTINUITY_V1',
  mode: 'DIAGNOSTIC_ONLY',
  requirements: Object.freeze({
    identity_binding_required: true,
    app_binding_observable: true,
    tool_binding_status_observable: true,
    runtime_check_before_access_error: true,
  }),
});
export const TOOL_ERROR_TAXONOMY = Object.freeze([
  'TOOL_NOT_REGISTERED', 'TOOL_NOT_ENABLED', 'TOOL_NOT_MOUNTED',
  'TOOL_NOT_AUTHORIZED', 'TOOL_RUNTIME_ERROR', 'PAYLOAD_TRUNCATED',
]);
const encoder = new TextEncoder();
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,95}$/;
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,159}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INSPECTION_BYTES = 128000;
const bytes = value => encoder.encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
const safeName = value => typeof value === 'string' && SAFE_NAME.test(value) ? value : null;
const safeCode = value => typeof value === 'string' && SAFE_CODE.test(value) ? value : null;

// Missing evidence is UNKNOWN. In particular an absent client observation does
// not establish TOOL_NOT_MOUNTED, and an oversized response is not truncation.
export function classifyToolFailure(evidence = {}) {
  const code = evidence.code;
  if (evidence.payload_truncated === true || code === 'PAYLOAD_TRUNCATED') return 'PAYLOAD_TRUNCATED';
  if (evidence.registered === false || code === 'TOOL_NOT_FOUND' || code === 'TOOL_NOT_REGISTERED') return 'TOOL_NOT_REGISTERED';
  if (evidence.enabled === false || code === 'TOOL_NOT_ENABLED' || code === 'MCP_CONFIG_DISABLED') return 'TOOL_NOT_ENABLED';
  if (evidence.mounted === false || code === 'TOOL_NOT_MOUNTED') return 'TOOL_NOT_MOUNTED';
  if (evidence.authorized === false || [401,403].includes(evidence.status) ||
      ['COORDINATION_SCOPE_REQUIRED','ROLE_AUTHORITY_DENIED','SYSTEM_ADMIN_READ_REQUIRED','TOOL_NOT_AUTHORIZED','INVALID_TOKEN','TOKEN_EXPIRED','TOKEN_REVOKED'].includes(code)) return 'TOOL_NOT_AUTHORIZED';
  if (evidence.failed === true || evidence.status >= 400) return 'TOOL_RUNTIME_ERROR';
  return null;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k,stable(value[k])]));
  return value;
}
const toolName = tool => typeof tool === 'string' ? tool : tool?.name;
const names = tools => [...new Set(tools.map(toolName).filter(safeName))].sort();

// Optional full definitions enable schema comparisons. A names-only snapshot
// cannot prove contract parity and is explicitly labelled as such.
export function reconcileToolRegistries(gatewayTools, clientTools) {
  if (!Array.isArray(gatewayTools) || !Array.isArray(clientTools)) return {status:'UNKNOWN',reason:'CATALOG_EVIDENCE_MISSING'};
  const gateway = names(gatewayTools), client = names(clientTools);
  const missing = gateway.filter(n => !client.includes(n));
  const stale = client.filter(n => !gateway.includes(n));
  const mismatches = [], compared = [];
  for (const name of gateway.filter(n => client.includes(n))) {
    const a = gatewayTools.find(t => toolName(t) === name), b = clientTools.find(t => toolName(t) === name);
    if (!a?.inputSchema || !b?.inputSchema) continue;
    compared.push(name);
    const contract = t => stable({inputSchema:t.inputSchema,outputSchema:t.outputSchema,annotations:t.annotations,securitySchemes:t.securitySchemes});
    if (JSON.stringify(contract(a)) !== JSON.stringify(contract(b))) mismatches.push(name);
  }
  return {
    status: missing.length || stale.length || mismatches.length ? 'DRIFT' : 'NAMES_MATCH',
    gateway_count: gateway.length, client_count: client.length,
    missing_from_client: missing, client_not_in_gateway: stale,
    contract_mismatches: mismatches,
    contract_comparison: compared.length === gateway.length && compared.length === client.length ? 'COMPLETE' : 'PARTIAL_OR_UNOBSERVED',
    action: 'REPORT_ONLY',
  };
}

export async function toolRegistryFingerprint(tools) {
  const definitions = tools.map(t => ({name:t.name,inputSchema:t.inputSchema,outputSchema:t.outputSchema,annotations:t.annotations,securitySchemes:t.securitySchemes})).sort((a,b) => a.name.localeCompare(b.name));
  const hash = await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify(stable(definitions))));
  return Array.from(new Uint8Array(hash),b => b.toString(16).padStart(2,'0')).join('');
}

export function checkBootstrap(payload, ctx) {
  const data = payload?.data;
  const version = data?.checkpoint?.state_version;
  const procedure = data?.bootstrap?.procedure;
  const expected = data?.bootstrap?.contract === 'RONA_AI_OFFICE_BOOTSTRAP_V2'
    ? ['VERIFY_RUNTIME_IDENTITY','VERIFY_TOOL_SOURCE','VERIFY_AVAILABLE_TOOLS','READ_CURRENT_STATE','APPLY_ROLE_POLICY','EXECUTE']
    : ['VERIFY_RUNTIME_IDENTITY','VERIFY_AVAILABLE_TOOLS','READ_CURRENT_STATE','APPLY_GLOBAL_POLICIES','EXECUTE_TASK'];
  return {
    mode: 'OBSERVE_ONLY',
    runtime_identity: !ctx || !payload?.identity_id || !payload?.role ? 'UNKNOWN' :
      payload.identity_id === ctx.identity_id && payload.role === ctx.role ? 'MATCH' : 'MISMATCH',
    current_state_call: payload?.ok === true ? 'SUCCESS' : 'FAILED_OR_UNOBSERVED',
    state_version: Number.isSafeInteger(version) && version >= 0 ? version : null,
    policy_source: Array.isArray(data?.global_role_policies) ? 'PRESENT' : 'ABSENT',
    precedence: Array.isArray(data?.bootstrap?.precedence) ? 'PRESENT' : 'ABSENT',
    runtime_steps_in_source: expected.filter(step => Array.isArray(procedure) && procedure.includes(step)),
    required_check_order: expected,
    available_tools_check: 'CURRENT_CALL_ONLY',
    mounted_app_context: 'UNKNOWN',
    turn_continuity: 'UNKNOWN',
    policy_application: 'NOT_OBSERVED',
    bootstrap_result_code: safeCode(data?.bootstrap?.result?.code),
  };
}

export function responseSizeTelemetry(text, payload) {
  const declared = payload?.data?.bootstrap?.response_budget_bytes;
  const budget = Number.isSafeInteger(declared) && declared > 0 ? declared : null;
  const responseBytes = bytes(text);
  return {
    unit: 'UTF8_BYTES', response_bytes: responseBytes,
    tool_payload_bytes: payload ? bytes(payload) : null,
    data_bytes: payload?.data ? bytes(payload.data) : null,
    declared_budget_bytes: budget,
    budget_exceeded: budget === null ? null : responseBytes > budget,
    policy: 'OBSERVE_ONLY_NO_TRUNCATION',
  };
}

async function readBounded(response) {
  const reader = response.clone().body?.getReader();
  if (!reader) return {text:'',complete:true,observed_bytes:0};
  const chunks = []; let length = 0;
  try {
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_INSPECTION_BYTES) {
        // Do not await cancellation of a tee branch: the original body has not
        // yet been consumed by the client. Never cancel the original response.
        void reader.cancel().catch(() => {});
        return {text:null,complete:false,observed_bytes:length};
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk,offset); offset += chunk.byteLength; }
  return {text:new TextDecoder().decode(joined),complete:true,observed_bytes:length};
}

// Returns the identical Response instance, including all headers/status/body.
// Never logs arguments, tokens, source text, policy bodies or business records.
export async function observeRuntimeResponse(response, {msg,ctx,segment} = {}, emit = entry => console.info(JSON.stringify(entry))) {
  if (!['tools/list','tools/call'].includes(msg?.method)) return response;
  try {
    const record = {
      event:'RONA_MCP_RUNTIME_DIAGNOSTIC', contract:RUNTIME_CONTINUITY_CONTRACT.contract,
      diagnostic_only:true, observed_at:new Date().toISOString(),
      method:msg.method, tool_name:msg.method === 'tools/call' ? safeName(msg.params?.name) : null,
      transport_segment:safeName(segment), server_slug:safeName(ctx?.server_slug),
      role:safeName(ctx?.role), identity_id:safeName(ctx?.identity_id), http_status:response.status,
      host_app_binding:'UNKNOWN', host_tool_mount:'UNKNOWN', turn_continuity:'UNKNOWN',
    };
    const read = await readBounded(response);
    if (!read.complete) {
      record.inspection = 'DIAGNOSTIC_INSPECTION_LIMIT';
      record.observed_response_bytes_lower_bound = read.observed_bytes;
      record.error_class = classifyToolFailure({status:response.status});
      emit(record); return response;
    }
    let envelope = null, payload = null;
    try { envelope = JSON.parse(read.text); } catch {}
    const text = envelope?.result?.content?.find(c => c.type === 'text')?.text;
    if (typeof text === 'string') { try { payload = JSON.parse(text); } catch {} }
    const detailFailure = payload?.role_state_details?.ok === false ? payload.role_state_details : null;
    const rawCode = payload?.code ?? detailFailure?.code ?? envelope?.error?.message ?? envelope?.error;
    record.source_error_code = safeCode(rawCode);
    record.error_class = classifyToolFailure({code:record.source_error_code,status:payload?.status ?? response.status,failed:!envelope || envelope?.result?.isError === true || payload?.ok === false || Boolean(detailFailure) || Boolean(envelope?.error)});
    record.response_size = responseSizeTelemetry(read.text,payload);
    record.response_json = envelope ? 'PARSED' : 'UNPARSEABLE';
    record.correlation_id = UUID.test(payload?.correlation_id || '') ? payload.correlation_id : null;
    record.tool_layers = {registered:'UNKNOWN',enabled:'NOT_SEPARATELY_OBSERVED',mounted:'UNKNOWN',available:payload?.ok === true ? 'CURRENT_CALL_SUCCEEDED' : 'NOT_ESTABLISHED',authorized:ctx && payload?.ok === true ? 'CURRENT_CALL_SUCCEEDED' : 'NOT_ESTABLISHED'};
    if (msg.method === 'tools/list' && Array.isArray(envelope?.result?.tools)) {
      const tools = envelope.result.tools;
      record.gateway_final_catalog = {count:tools.length,names:names(tools),sha256:await toolRegistryFingerprint(tools)};
      record.client_catalog_reference = {
        observed_at:CLIENT_TOOL_CATALOG_REFERENCE.observed_at,
        evidence_scope:'DATED_AUDIT_SESSION_NOT_CURRENT_CHAT',
        ...reconcileToolRegistries(tools,CLIENT_TOOL_CATALOG_REFERENCE.roles[ctx?.role]),
      };
      record.tool_layers = {registered:'FINAL_ADVERTISED_CATALOG_OBSERVED',enabled:'NOT_SEPARATELY_OBSERVED',mounted:'UNKNOWN',available:'LISTING_ONLY',authorized:'ENFORCED_BY_EXISTING_PER_CALL_GATES'};
    }
    if (msg.params?.name === 'current_state') record.bootstrap_checks = checkBootstrap(payload,ctx);
    emit(record);
  } catch {
    // Diagnostics must not turn a successful business/read response into failure.
    try { emit({event:'RONA_MCP_RUNTIME_DIAGNOSTIC_FAILED',diagnostic_only:true,error_class:'TOOL_RUNTIME_ERROR'}); } catch {}
  }
  return response;
}
