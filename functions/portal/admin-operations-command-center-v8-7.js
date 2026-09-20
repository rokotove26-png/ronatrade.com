import { patchAdminOperationsCommandCenterV86 as patchV86 } from './admin-operations-command-center-v8-6.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.7-finance-actions-v1';
export const OPERATIONS_FINANCE_ACTIONS_CONTRACT='OPERATIONS_FINANCE_ACTIONS_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V87_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V87_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV87(script){
  let patched=patchV86(script);

  patched=replaceRequired(
    patched,
    "for(const x of paymentControl){const deal=dealById.get(String(x?.deal_id||'')),s=deal?.finance_status||x?.finance_status||x?.payment_status;queueRows.push({tone:ronaFdV5Tone(s),name:'Оплата · '+String(x?.deal_id||'Сделка'),meta:[x?.client_name||deal?.legal_name,ronaFdV5Text(s)].filter(Boolean).join(' · '),target:'payments'})}",
    "const paymentActionRows=financeCurrentKnown?currentDueDeals:paymentControl;\n  for(const x of paymentActionRows){const deal=financeCurrentKnown?x:dealById.get(String(x?.deal_id||'')),s=financeCurrentKnown?'DUE_NOW':(deal?.finance_status||x?.finance_status||x?.payment_status),client=deal?.legal_name||deal?.client_name||x?.client_name||null;queueRows.push({tone:financeCurrentKnown?'amber':ronaFdV5Tone(s),name:'Оплата · '+String(x?.deal_id||'Сделка'),meta:financeCurrentKnown?[client,'К оплате сейчас'].filter(Boolean).join(' · '):[client,ronaFdV5Text(s)].filter(Boolean).join(' · '),target:'payments'})}",
    'canonical-finance-action-rows'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.6-canonical-controls-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.7-finance-actions-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';\n  window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1';",
    'browser-version'
  );

  if(!patched.includes("const paymentActionRows=financeCurrentKnown?currentDueDeals:paymentControl"))throw new Error('ADMIN_OPERATIONS_V87_PAYMENT_ACTION_ROWS_MISSING');
  if(!patched.includes("financeCurrentKnown?[client,'К оплате сейчас']"))throw new Error('ADMIN_OPERATIONS_V87_CURRENT_DUE_META_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1'"))throw new Error('ADMIN_OPERATIONS_V87_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV87"))throw new Error('ADMIN_OPERATIONS_V87_POLLING_FORBIDDEN');
  return patched;
}
