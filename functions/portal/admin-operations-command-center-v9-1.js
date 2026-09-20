import { patchAdminOperationsCommandCenterV9 as patchV9 } from './admin-operations-command-center-v9.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v9.1-readmodel-timeout-resilience-v1';
export const OPERATIONS_TIMEOUT_RESILIENCE_CONTRACT='OPERATIONS_TIMEOUT_RESILIENCE_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V91_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V91_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV91(script){
  let patched=patchV9(script);

  patched=replaceRequired(
    patched,
    "    const next=await ronaOpsV90Bounded('OPERATIONS_READ_MODEL',call('/admin/operations-current-v1'),8000);",
    "    const ronaOpsV91NeedDeals=reason==='INITIAL'||reason==='RECOVERY_RETRY'||domains.includes('DEALS')||domains.includes('FINANCE');\n    const ronaOpsV91DealsPromise=ronaOpsV91NeedDeals?ronaOpsV90EnsureDealsCurrent().then(s=>{window.__RONA_ADMIN_OPERATIONS_DEALS_RECOVERY_ERROR__=null;if(ronaOpsV7HomeVisible())renderAdminHome();return s}).catch(err=>{window.__RONA_ADMIN_OPERATIONS_DEALS_RECOVERY_ERROR__=String(err?.code||err?.message||err);if(ronaOpsV7HomeVisible())renderAdminHome();return null}):null;\n    const next=await ronaOpsV90Bounded('OPERATIONS_READ_MODEL',call('/admin/operations-current-v1'),20000);\n    if(ronaOpsV91DealsPromise){const snap=await ronaOpsV91DealsPromise;if(!snap)throw new Error(window.__RONA_ADMIN_OPERATIONS_DEALS_RECOVERY_ERROR__||'DEALS_CURRENT_V4_REFRESH_UNAVAILABLE')}",
    'parallel-current-snapshots'
  );

  patched=replaceRequired(
    patched,
    "    if(reason==='INITIAL'||reason==='RECOVERY_RETRY'||domains.includes('DEALS')||domains.includes('FINANCE'))await ronaOpsV90EnsureDealsCurrent();",
    "    /* V9.1: Deals Current V4 is synchronized in parallel before the Operations read-model await. */",
    'remove-serial-deals-wait'
  );

  patched=replaceRequired(
    patched,
    "return !active||status!=='succeeded'||stale",
    "return !active||(!['succeeded','running'].includes(status))||stale",
    'automation-running-is-not-failure'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v9-production-recovery-v1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v9.1-readmodel-timeout-resilience-v1';\n  window.__RONA_ADMIN_OPERATIONS_TIMEOUT_RESILIENCE__='OPERATIONS_TIMEOUT_RESILIENCE_V1';",
    'browser-version'
  );

  if(!patched.includes("call('/admin/operations-current-v1'),20000"))throw new Error('ADMIN_OPERATIONS_V91_READMODEL_BUDGET_MISSING');
  if(!patched.includes("ronaOpsV91DealsPromise=ronaOpsV91NeedDeals?ronaOpsV90EnsureDealsCurrent()"))throw new Error('ADMIN_OPERATIONS_V91_PARALLEL_DEALS_MISSING');
  if(!patched.includes("['succeeded','running'].includes(status)"))throw new Error('ADMIN_OPERATIONS_V91_RUNNING_HEALTH_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_TIMEOUT_RESILIENCE__='OPERATIONS_TIMEOUT_RESILIENCE_V1'"))throw new Error('ADMIN_OPERATIONS_V91_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV91"))throw new Error('ADMIN_OPERATIONS_V91_POLLING_FORBIDDEN');
  return patched;
}
