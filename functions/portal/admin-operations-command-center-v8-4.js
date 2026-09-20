import { patchAdminOperationsCommandCenterV83 as patchV83 } from './admin-operations-command-center-v8-3.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.4-complete-scroll-v1';
export const OPERATIONS_COMPLETE_SCROLL_CONTRACT='OPERATIONS_COMPLETE_SCROLL_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V84_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V84_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV84(script){
  let patched=patchV83(script);

  patched=replaceRequired(
    patched,
    "if(activeDeals.length){for(const x of activeDeals.slice(0,10)){",
    "if(activeDeals.length){for(const x of activeDeals){",
    'complete-active-deals'
  );

  patched=replaceRequired(
    patched,
    "if(queueVisible.length){for(const row of queueVisible.slice(0,9))",
    "if(queueVisible.length){for(const row of queueVisible)",
    'complete-action-queue'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.3-action-router-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.4-complete-scroll-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';",
    'browser-version'
  );

  if(patched.includes("activeDeals.slice(0,10)"))throw new Error('ADMIN_OPERATIONS_V84_DEAL_CAP_REMAINS');
  if(patched.includes("queueVisible.slice(0,9)"))throw new Error('ADMIN_OPERATIONS_V84_QUEUE_CAP_REMAINS');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1'"))throw new Error('ADMIN_OPERATIONS_V84_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV84"))throw new Error('ADMIN_OPERATIONS_V84_POLLING_FORBIDDEN');
  return patched;
}
