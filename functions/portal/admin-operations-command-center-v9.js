import { patchAdminOperationsCommandCenterV89 as patchV89 } from './admin-operations-command-center-v8-9.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v9-production-recovery-v1';
export const OPERATIONS_PRODUCTION_RECOVERY_CONTRACT='OPERATIONS_PRODUCTION_RECOVERY_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V9_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V9_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV9(script){
  let patched=patchV89(script);

  patched=replaceRequired(
    patched,
    "async function ronaOpsV7RefreshCurrent(reason='EVENT'){",
    "function ronaOpsV90Bounded(label,value,ms=8000){return new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>{if(settled)return;settled=true;reject(new Error(label+'_TIMEOUT'))},ms);Promise.resolve(value).then(v=>{if(settled)return;settled=true;clearTimeout(timer);resolve(v)},e=>{if(settled)return;settled=true;clearTimeout(timer);reject(e)})})}\nconst ronaOpsV90DealsModuleSrc='/portal/deals-current-state-ui?v=20260826-single-owner';\nasync function ronaOpsV90EnsureDealsCurrent(){let refresh=window.__RONA_DEALS_CURRENT_STATE_REFRESH__;if(typeof refresh!=='function'&&typeof window.__RONA_ADMIN_LOAD_MODULE__==='function'){await ronaOpsV90Bounded('DEALS_MODULE_LOAD',window.__RONA_ADMIN_LOAD_MODULE__('deals',ronaOpsV90DealsModuleSrc),10000);refresh=window.__RONA_DEALS_CURRENT_STATE_REFRESH__}if(typeof refresh==='function')await ronaOpsV90Bounded('DEALS_CURRENT_V4',refresh(),10000);const snap=window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__;if(!snap||snap.readModelVersion!=='ADMIN_DEALS_CURRENT_V4')throw new Error('DEALS_CURRENT_V4_REFRESH_UNAVAILABLE');return snap}\nasync function ronaOpsV7RefreshCurrent(reason='EVENT'){",
    'bounded-runtime'
  );

  patched=replaceRequired(
    patched,
    "    const next=await call('/admin/operations-current-v1');",
    "    const next=await ronaOpsV90Bounded('OPERATIONS_READ_MODEL',call('/admin/operations-current-v1'),8000);",
    'read-model-timeout'
  );

  patched=replaceRequired(
    patched,
    "    if((domains.includes('DEALS')||domains.includes('FINANCE'))&&typeof window.__RONA_DEALS_CURRENT_STATE_REFRESH__==='function')await window.__RONA_DEALS_CURRENT_STATE_REFRESH__();",
    "    if(reason==='INITIAL'||reason==='RECOVERY_RETRY'||domains.includes('DEALS')||domains.includes('FINANCE'))await ronaOpsV90EnsureDealsCurrent();",
    'initial-deals-v4-sync'
  );

  patched=replaceRequired(
    patched,
    "    if(domains.includes('FINANCE')&&typeof window.__RONA_OWNER_AI_REFRESH__==='function')await window.__RONA_OWNER_AI_REFRESH__();",
    "    if(domains.includes('FINANCE')&&typeof window.__RONA_OWNER_AI_REFRESH__==='function')await ronaOpsV90Bounded('OWNER_AI_FINANCE',window.__RONA_OWNER_AI_REFRESH__(),8000);",
    'finance-refresh-timeout'
  );

  patched=replaceRequired(
    patched,
    "    if((domains.includes('DEALS')||domains.includes('RAIL')||domains.includes('DOCUMENTS'))&&typeof ownerAdminRefreshTick==='function')await ownerAdminRefreshTick(true);",
    "    if((domains.includes('DEALS')||domains.includes('RAIL')||domains.includes('DOCUMENTS'))&&typeof ownerAdminRefreshTick==='function')await ronaOpsV90Bounded('OWNER_ADMIN_REFRESH',ownerAdminRefreshTick(true),8000);",
    'owner-refresh-timeout'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.9-exact-object-routing-v1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v9-production-recovery-v1';\n  window.__RONA_ADMIN_OPERATIONS_PRODUCTION_RECOVERY__='OPERATIONS_PRODUCTION_RECOVERY_V1';",
    'browser-version'
  );

  if(!patched.includes("ronaOpsV90Bounded('OPERATIONS_READ_MODEL'"))throw new Error('ADMIN_OPERATIONS_V9_READ_MODEL_TIMEOUT_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_LOAD_MODULE__('deals',ronaOpsV90DealsModuleSrc)"))throw new Error('ADMIN_OPERATIONS_V9_DEALS_MODULE_RECOVERY_MISSING');
  if(!patched.includes("reason==='INITIAL'||reason==='RECOVERY_RETRY'"))throw new Error('ADMIN_OPERATIONS_V9_INITIAL_SYNC_MISSING');
  if(!patched.includes("snap.readModelVersion!=='ADMIN_DEALS_CURRENT_V4'"))throw new Error('ADMIN_OPERATIONS_V9_DEALS_V4_GATE_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_PRODUCTION_RECOVERY__='OPERATIONS_PRODUCTION_RECOVERY_V1'"))throw new Error('ADMIN_OPERATIONS_V9_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV90"))throw new Error('ADMIN_OPERATIONS_V9_POLLING_FORBIDDEN');
  return patched;
}
