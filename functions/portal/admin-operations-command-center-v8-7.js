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
    "for(const x of dealActionRows){queueRows.push({tone:'amber',name:'Сделка · '+String(x?.deal_id||'—'),meta:String(x?.next_action_text||'Требуется действие'),target:'deals',dealId:x?.deal_id||null})}",
    "for(const x of dealActionRows){const actionTarget=String(x?.next_action_target||'deals'),actionDomain=ronaFdV5Key(x?.next_action_domain),actionLabel=actionDomain==='PAYMENT'?'Оплата':actionDomain==='RAIL'?'ЖД':'Сделка';queueRows.push({tone:'amber',name:actionLabel+' · '+String(x?.deal_id||'—'),meta:String(x?.next_action_text||'Требуется действие'),target:actionTarget,dealId:x?.deal_id||null})}",
    'canonical-deal-action-routing'
  );

  patched=replaceRequired(
    patched,
    "  if(dealId)return{kind:'DEAL',dealId,target:'deals'};",
    "  if(direct&&direct!=='home'&&direct!=='deals')return{kind:'SECTION',target:direct,dealId:dealId||null};\n  if(dealId)return{kind:'DEAL',dealId,target:'deals'};",
    'explicit-section-before-deal'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.6-canonical-controls-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.7-finance-actions-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';\n  window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1';",
    'browser-version'
  );

  if(!patched.includes("actionDomain==='PAYMENT'?'Оплата'"))throw new Error('ADMIN_OPERATIONS_V87_FINANCE_LABEL_MISSING');
  if(!patched.includes("target:actionTarget,dealId:x?.deal_id||null"))throw new Error('ADMIN_OPERATIONS_V87_ACTION_TARGET_MISSING');
  if(!patched.includes("if(direct&&direct!=='home'&&direct!=='deals')return{kind:'SECTION',target:direct,dealId:dealId||null}"))throw new Error('ADMIN_OPERATIONS_V87_SECTION_PRIORITY_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_FINANCE_ACTIONS__='OPERATIONS_FINANCE_ACTIONS_V1'"))throw new Error('ADMIN_OPERATIONS_V87_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV87"))throw new Error('ADMIN_OPERATIONS_V87_POLLING_FORBIDDEN');
  return patched;
}
