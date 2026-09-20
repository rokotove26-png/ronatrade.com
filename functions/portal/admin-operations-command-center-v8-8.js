import { patchAdminOperationsCommandCenterV87 as patchV87 } from './admin-operations-command-center-v8-7.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.8-mirrored-event-routing-v1';
export const OPERATIONS_MIRRORED_EVENT_ROUTING_CONTRACT='OPERATIONS_MIRRORED_EVENT_ROUTING_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V88_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V88_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV88(script){
  let patched=patchV87(script);

  patched=replaceRequired(
    patched,
    "  const type=ronaFdV5Key(row?.entityType),domain=ronaFdV5Key(entity?.authority_domain),role=ronaFdV5Key(entity?.assigned_functional_role),source=ronaFdV5Key(entity?.source_type),targetType=ronaFdV5Key(entity?.authority_target_type);",
    "  const type=ronaFdV5Key(row?.entityType),domain=ronaFdV5Key(entity?.authority_domain),role=ronaFdV5Key(entity?.assigned_functional_role),source=ronaFdV5Key(entity?.source_type),targetType=ronaFdV5Key(entity?.authority_target_type),ops=ronaOpsV83CurrentOps(),linkedReverse=source==='PORTAL_REVERSE_EVENT'?(Array.isArray(ops?.reverseEvents)?ops.reverseEvents:[]).find(x=>String(x?.event_id||x?.id||'')===String(entity?.source_object_id||'')):null,linkedTargetType=ronaFdV5Key(linkedReverse?.authority_target_type),linkedTargetId=String(linkedReverse?.authority_target_id||'').trim();\n  if(type==='STAFF_TASK'&&linkedTargetType==='APPLICATION')return{kind:'SECTION',target:'applications',applicationId:linkedTargetId||null};\n  if(type==='STAFF_TASK'&&linkedTargetType==='DEAL'&&linkedTargetId)return{kind:'DEAL',dealId:linkedTargetId,target:'deals'};",
    'mirrored-reverse-event-context'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.7-finance-actions-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';\n  window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.8-mirrored-event-routing-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';\n  window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1';\n  window.__RONA_ADMIN_OPERATIONS_MIRRORED_EVENT_ROUTING__='OPERATIONS_MIRRORED_EVENT_ROUTING_V1';",
    'browser-version'
  );

  if(!patched.includes("linkedReverse=source==='PORTAL_REVERSE_EVENT'"))throw new Error('ADMIN_OPERATIONS_V88_LINKED_EVENT_LOOKUP_MISSING');
  if(!patched.includes("linkedTargetType==='APPLICATION'"))throw new Error('ADMIN_OPERATIONS_V88_APPLICATION_ROUTE_MISSING');
  if(!patched.includes("linkedTargetType==='DEAL'&&linkedTargetId"))throw new Error('ADMIN_OPERATIONS_V88_DEAL_ROUTE_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_MIRRORED_EVENT_ROUTING__='OPERATIONS_MIRRORED_EVENT_ROUTING_V1'"))throw new Error('ADMIN_OPERATIONS_V88_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV88"))throw new Error('ADMIN_OPERATIONS_V88_POLLING_FORBIDDEN');
  return patched;
}
