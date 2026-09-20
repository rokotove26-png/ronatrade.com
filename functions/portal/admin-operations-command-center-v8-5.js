import { patchAdminOperationsCommandCenterV84 as patchV84 } from './admin-operations-command-center-v8-4.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.5-effective-kpi-v1';
export const OPERATIONS_EFFECTIVE_KPI_CONTRACT='OPERATIONS_EFFECTIVE_KPI_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V85_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V85_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV85(script){
  let patched=patchV84(script);

  patched=replaceRequired(
    patched,
    "gauge('CAUT-03','Требует действия',attentionCount,'Подтверждённые сигналы','home',attentionCount?'amber':'green')",
    "gauge('CAUT-03','Требует действия',effectiveAttentionCount,'Подтверждённые сигналы','home',effectiveAttentionCount?'amber':'green')",
    'effective-attention-kpi'
  );

  patched=replaceRequired(
    patched,
    "gauge('WARN-06','Критические события',criticalCount,'Операционные конфликты','home',criticalCount?'red':'green')",
    "gauge('WARN-06','Критические события',effectiveCriticalCount,'Операционные конфликты','home',effectiveCriticalCount?'red':'green')",
    'effective-critical-kpi'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.4-complete-scroll-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.5-effective-kpi-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';",
    'browser-version'
  );

  if(!patched.includes("gauge('CAUT-03','Требует действия',effectiveAttentionCount"))throw new Error('ADMIN_OPERATIONS_V85_ATTENTION_KPI_MISSING');
  if(!patched.includes("gauge('WARN-06','Критические события',effectiveCriticalCount"))throw new Error('ADMIN_OPERATIONS_V85_CRITICAL_KPI_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1'"))throw new Error('ADMIN_OPERATIONS_V85_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV85"))throw new Error('ADMIN_OPERATIONS_V85_POLLING_FORBIDDEN');
  return patched;
}
