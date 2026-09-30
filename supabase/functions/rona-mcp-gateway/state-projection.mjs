import {CLIENT_TOOL_CATALOG_REFERENCE} from './client-tool-catalog-reference.mjs';
import {reconcileToolRegistries,toolRegistryFingerprint} from './runtime-continuity.mjs';

export const COMPACT_STATE_CONTRACT = 'RONA_ROLE_STATE_COMPACT_V1';
export const BOOTSTRAP_V2_STEPS = Object.freeze([
  'VERIFY_RUNTIME_IDENTITY','VERIFY_TOOL_SOURCE','VERIFY_AVAILABLE_TOOLS',
  'READ_CURRENT_STATE','APPLY_ROLE_POLICY','EXECUTE',
]);
export const STATE_DETAIL_CALL = Object.freeze({tool:'history',arguments:{domain:'tasks'},result_path:'role_state_details.data'});
const encoder = new TextEncoder();
const hasScope = (ctx,scope) => String(ctx?.scope || '').split(/\s+/).includes(scope);
const names = tools => [...new Set(tools.map(t => t.name))].sort();
const select = (obj,keys) => Object.fromEntries(keys.filter(k => Object.hasOwn(obj || {},k)).map(k => [k,obj[k]]));

export function identityError(payload,ctx) {
  if (!ctx || !hasScope(ctx,'mcp:read')) return 'TOOL_NOT_AUTHORIZED';
  if (payload?.role !== ctx.role || payload?.identity_id !== ctx.identity_id ||
      (payload?.data?.functional_role && payload.data.functional_role !== ctx.role) ||
      (payload?.data?.identity_profile?.identity_id && payload.data.identity_profile.identity_id !== ctx.identity_id)) return 'RUNTIME_IDENTITY_MISMATCH';
  return null;
}

// Registry definitions come from the real gateway builder and its compatibility
// transforms. Client observations are evidence, never the source of authority.
export async function buildRegistryContract(ctx,registeredTools,enabledTools,actualTools) {
  if (![registeredTools,enabledTools,actualTools].every(Array.isArray)) throw Error('TOOL_REGISTRY_SOURCE_UNAVAILABLE');
  const registered = names(registeredTools), enabled = names(enabledTools);
  const authorized = names(actualTools.filter(t => hasScope(ctx,t.annotations?.readOnlyHint === true ? 'mcp:read' : 'mcp:coordinate')));
  const reference = CLIENT_TOOL_CATALOG_REFERENCE.roles[ctx.role];
  const referenceComparison = reconcileToolRegistries(actualTools,reference);
  const enabledNotRegistered = enabled.filter(n => !registered.includes(n));
  const authorizedNotEnabled = authorized.filter(n => !enabled.includes(n));
  const gatewayStatus = enabledNotRegistered.length || authorizedNotEnabled.length ? 'GATEWAY_DRIFT' : 'GATEWAY_COHERENT';
  return {
    contract:'RONA_GATEWAY_TOOL_RECONCILIATION_V2',source_of_truth:'GATEWAY_ROLE_REGISTRY',
    server_slug:ctx.server_slug,registry_sha256:await toolRegistryFingerprint(actualTools),
    registered:{basis:'ROLE_REGISTRY_BEFORE_COMPATIBILITY_FILTERS',names:registered},
    enabled:{basis:'FINAL_ADVERTISED_CATALOG',names:enabled},
    authorized:{basis:'CURRENT_SCOPE_GATE',names:authorized,argument_and_object_checks_required:true},
    client_visible:{
      status:'UNKNOWN',
      reference_observed_at:CLIENT_TOOL_CATALOG_REFERENCE.observed_at,
      reference_names:reference || [],
      reference_comparison:{...referenceComparison,status:referenceComparison.status === 'DRIFT' ? 'REFERENCE_DRIFT' : referenceComparison.status,authority:'NONE',action:'REPORT_ONLY'},
    },
    runtime_available:{confirmed:['current_state'],other_tools:'UNPROBED',host_mount:'UNKNOWN'},
    reconciliation:{
      status:gatewayStatus,
      registered_count:registered.length,
      enabled_count:enabled.length,
      authorized_count:authorized.length,
      enabled_not_registered:enabledNotRegistered,
      authorized_not_enabled:authorizedNotEnabled,
      intentionally_filtered:registered.filter(n => !enabled.includes(n)),
      action:gatewayStatus === 'GATEWAY_COHERENT' ? 'NONE' : 'REPORT_GATEWAY_DEFECT',
    },
    catalog_mutation:false,
  };
}

export function bootstrapV2(data,ctx,registry) {
  const policies = data.global_role_policies;
  const errors = [];
  if (!data.identity_profile || data.identity_profile.identity_id !== ctx.identity_id || data.functional_role !== ctx.role) errors.push('RUNTIME_IDENTITY_MISMATCH');
  if (!registry || registry.source_of_truth !== 'GATEWAY_ROLE_REGISTRY') errors.push('TOOL_REGISTRY_SOURCE_UNAVAILABLE');
  if (registry && !registry.registered.names.includes('history')) errors.push('TOOL_NOT_REGISTERED');
  else if (registry && !registry.enabled.names.includes('history')) errors.push('TOOL_NOT_ENABLED');
  else if (registry && !registry.authorized.names.includes('history')) errors.push('TOOL_NOT_AUTHORIZED');
  if (!Array.isArray(policies) || !policies.length) errors.push('ROLE_POLICY_SOURCE_MISSING');
  const code = errors[0] || 'ROLE_POLICY_DETAIL_REQUIRED';
  return {
    ...(data.bootstrap || {}),
    contract:'RONA_AI_OFFICE_BOOTSTRAP_V2',
    legacy_procedure:data.bootstrap?.procedure || [],procedure:[...BOOTSTRAP_V2_STEPS],
    response_budget_bytes:24000,
    result:{status:errors.length ? 'BLOCKED' : 'DETAIL_REQUIRED',code,
      checks:{identity:errors.includes('RUNTIME_IDENTITY_MISMATCH') ? 'FAIL' : 'MATCH',tool_source:registry ? 'GATEWAY' : 'UNAVAILABLE',current_state:'READ',detail_tool:errors.some(e => e.startsWith('TOOL_')) ? 'BLOCKED' : 'AUTHORIZED_NOT_PROBED',role_policy:'MUST_READ_AND_APPLY',execution:'NOT_YET_AUTHORIZED_BY_THIS_CHECK'},
      next:errors.length ? null : STATE_DETAIL_CALL,
      recovery:'Continue in the same turn: use the gateway registry, perform the exact next read, apply the role policy, then execute the owner instruction within competence. A missing plugin listing is not evidence of missing MCP access. Do not repeat side-effecting calls during recovery.'},
    policy_metadata_is_execution_authority:false,
  };
}

// Original canonical state is never mutated. Full V6 is returned on the existing
// history(tasks) call. Stable core fields retain their values and types.
export function compactState(data,ctx,registry) {
  const projected = select(data,[
    'functional_role','generated_at','identity_profile','checkpoint','active_tasks',
    'competence_contract','routing_capabilities','state_conflicts','execution_recovery','technical_live_sources',
  ]);
  const records = Array.isArray(data.coordination?.records) ? data.coordination.records : [];
  projected.data_contract = COMPACT_STATE_CONTRACT;
  projected.source_data_contract = data.data_contract;
  projected.global_role_policies = (data.global_role_policies || []).map(p => ({
    ...select(p,['scope','version','policy_id','policy_key','task_scoped','effective_at','authority_kind','functional_role','owner_instruction_ref']),
    detail_required:true,
  }));
  projected.coordination = {
    projection:'LATEST_RECORD_METADATA',source_record_count:records.length,
    records:records.slice(0,3).map(r => select(r,['record_id','record_type','status','version','functional_role','target_role','target_type','target_id','created_at'])),
    detail_required:records.length > 0,
  };
  projected.runtime_status = {
    contract:'RONA_AI_OFFICE_RUNTIME_CONTINUITY_V1',
    identity:'MATCH',
    transport_server_slug:ctx.server_slug,
    session_runtime_contract:'REQUEST_SCOPED_SERVER_RUNTIME',
    app_binding_contract:'CLIENT_HOST_MANAGED_NOT_OBSERVABLE_SERVER_SIDE',
    mounted_app_context:'UNKNOWN',
    tool_persistence:'CLIENT_HOST_MANAGED_UNKNOWN',
    runtime_identity:{status:'MATCH',role:ctx.role,identity_id:ctx.identity_id,server_slug:ctx.server_slug},
    host_mount:'UNKNOWN',
    turn_continuity:'UNKNOWN',
  };
  projected.tool_registry = registry;
  projected.bootstrap = bootstrapV2(data,ctx,registry);
  // Inclusion flags describe this compact response. The original flags remain
  // in the lossless V6 detail alongside the sections they describe.
  Object.assign(projected.bootstrap,{
    sla_diagnostics_included:false,dependency_graph_included:false,
    exception_cockpit_included:false,mailbox_state_in_current_state:false,
    office_directory_in_current_state:false,heavy_coordination_fields_included:false,
    full_role_registry_in_current_state:false,
  });
  projected.detail = {
    contract:'RONA_ROLE_STATE_DETAIL_V1',...STATE_DETAIL_CALL,
    source_state_version:data.checkpoint?.state_version ?? null,
    full_source_data_contract:data.data_contract,
    content:'Full policies, coordination, catalogs, documents, arrays and complete legacy V6 state.',
    sections:Object.keys(data).filter(k => !Object.hasOwn(projected,k)).concat(['global_role_policies','coordination']),
    consistency:'Detail reads current canonical state. Compare checkpoint and policy versions; refresh current_state if they differ.',
  };
  return projected;
}

export function compactEnvelope(envelope,payload,ctx,registry) {
  const code = identityError(payload,ctx);
  if (code) return stateErrorEnvelope(envelope.id,code);
  if (!payload?.data?.checkpoint || !Array.isArray(payload.data.global_role_policies)) return stateErrorEnvelope(envelope.id,'ROLE_STATE_SOURCE_INVALID');
  const projected = {...payload,data:compactState(payload.data,ctx,registry)};
  const out = structuredClone(envelope);
  out.result.content[0].text = JSON.stringify(projected);
  if (encoder.encode(JSON.stringify(out)).length > 24000) return stateErrorEnvelope(envelope.id,'CURRENT_STATE_BUDGET_EXCEEDED');
  return out;
}

export function stateErrorEnvelope(id,code) {
  return {jsonrpc:'2.0',id:id ?? null,result:{isError:true,content:[{type:'text',text:JSON.stringify({ok:false,code,recovery:STATE_DETAIL_CALL})}]}};
}

export function addStateDetail(payload,fullState,ctx) {
  const error = identityError({...payload,data:fullState},ctx);
  if (error) throw Error(error);
  // Keep data (including array shape/order/values) unchanged. Put the detail
  // before potentially large legacy history for model visibility.
  const {data,...header} = payload;
  return {...header,role_state_details:{contract:'RONA_ROLE_STATE_DETAIL_V1',state_version:fullState.checkpoint?.state_version ?? null,
    data:fullState,bootstrap:{contract:'RONA_AI_OFFICE_BOOTSTRAP_V2',policy_source:'RETURNED',next:'APPLY_ROLE_POLICY',execution_authorized_by_read:false}},data};
}
