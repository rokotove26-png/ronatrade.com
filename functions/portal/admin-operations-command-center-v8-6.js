import { patchAdminOperationsCommandCenterV85 as patchV85 } from './admin-operations-command-center-v8-5.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v8.6-canonical-controls-v1';
export const OPERATIONS_CANONICAL_CONTROLS_CONTRACT='OPERATIONS_CANONICAL_CONTROLS_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V86_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V86_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

export function patchAdminOperationsCommandCenterV86(script){
  let patched=patchV85(script);

  patched=replaceRequired(
    patched,
    "  const opsPaymentControl=Number.isFinite(Number(opsMetrics?.payments_on_control))?Number(opsMetrics.payments_on_control):null,opsTrustedWagons=Number.isFinite(Number(opsMetrics?.trusted_wagons))?Number(opsMetrics.trusted_wagons):null;",
    "  const opsPaymentControl=Number.isFinite(Number(opsMetrics?.payments_on_control))?Number(opsMetrics.payments_on_control):null,opsTrustedWagons=Number.isFinite(Number(opsMetrics?.trusted_wagons))?Number(opsMetrics.trusted_wagons):null;\n  const financeCurrentKnown=!!(currentDealSnapshot&&Array.isArray(currentDealSnapshot.deals)),currentDueDeals=financeCurrentKnown?activeDeals.filter(x=>Number(x?.due_now||0)>0):[],currentDueCount=currentDueDeals.length,currentFutureConditionalCount=financeCurrentKnown?activeDeals.filter(x=>Number(x?.due_now||0)<=0&&Number(x?.future_conditional||0)>0).length:0;\n  const railCurrentKnown=!!(currentDealSnapshot&&Array.isArray(currentDealSnapshot.rail)),railGu12Count=railCurrentKnown?rail.reduce((n,x)=>n+Number(x?.gu12_count||0),0):null,railTrustedCount=railCurrentKnown?rail.reduce((n,x)=>n+Number(x?.trusted_wagon_count||0),0):null,railVerifyCount=railCurrentKnown?rail.reduce((n,x)=>n+Number(x?.unresolved_or_conflict_count||0),0):null,railControlCount=railCurrentKnown?railTrustedCount+railVerifyCount:null;",
    'canonical-control-aggregates'
  );

  patched=replaceRequired(
    patched,
    "gauge('RAIL-04','Вагоны на контроле',railKnown?allWagons.length:(opsTrustedWagons!==null?opsTrustedWagons:'—'),railKnown?'ЖД-контур':(opsTrustedWagons!==null?'Canonical Rail':'Нет снимка'),'monitoring',waitingWagons.length?'amber':'teal')",
    "gauge('RAIL-04','Вагоны на контроле',railCurrentKnown?railControlCount:(railKnown?allWagons.length:(opsTrustedWagons!==null?opsTrustedWagons:'—')),railCurrentKnown?'Canonical Rail V4':(railKnown?'ЖД-контур':(opsTrustedWagons!==null?'Canonical Rail':'Нет снимка')),'monitoring',railCurrentKnown?(railVerifyCount?'amber':'teal'):(waitingWagons.length?'amber':'teal'))",
    'canonical-rail-kpi'
  );

  patched=replaceRequired(
    patched,
    "gauge('FIN-05','Платежи на контроле',opsPaymentControl!==null?opsPaymentControl:(financeKnown?paymentControl.length:'—'),opsPaymentControl!==null?'Current finance authority':(financeKnown?'Срок наступил / просрочено':'Нет снимка'),'payments',(opsPaymentControl||paymentControl.length)?'amber':'gold')",
    "gauge('FIN-05','Платежи на контроле',financeCurrentKnown?currentDueCount:(opsPaymentControl!==null?opsPaymentControl:(financeKnown?paymentControl.length:'—')),financeCurrentKnown?'Finance V8 · срок наступил':(opsPaymentControl!==null?'Current finance authority':(financeKnown?'Срок наступил / просрочено':'Нет снимка')),'payments',financeCurrentKnown?(currentDueCount?'amber':'gold'):((opsPaymentControl||paymentControl.length)?'amber':'gold'))",
    'canonical-finance-kpi'
  );

  patched=replaceRequired(
    patched,
    "systems.append(system('RAIL CONTROL','Онлайн ЖД',railKnown?allWagons.length:'—',railKnown?(String(rail.length)+' ГУ-12 · '+String(waitingWagons.length)+' позиций требуют проверки'):'ЖД-снимок не получен','monitoring',waitingWagons.length?'amber':railKnown?'green':'cyan'),system('FINANCE CONTROL','Платежи',financeKnown?paymentControl.length:'—',financeKnown?(String(financeRows.length)+' сделок в финансовом снимке · просрочено: '+String(overdueCount)):'Финансовый снимок не получен','payments',overdueCount?'red':paymentControl.length?'amber':financeKnown?'green':'cyan'),system('DOCUMENT CONTROL','Документы',docsKnown?docs.length:'—',docsKnown?(String(uncheckedDocs.length)+' требуют контроля'):'Снимок документов не получен','documents',uncheckedDocs.length?'amber':docsKnown?'green':'cyan'));",
    "systems.append(system('RAIL CONTROL','Онлайн ЖД',railCurrentKnown?railControlCount:(railKnown?allWagons.length:'—'),railCurrentKnown?(String(railGu12Count)+' ГУ-12 · '+String(railVerifyCount)+' требуют проверки'):(railKnown?(String(rail.length)+' записей ЖД · '+String(waitingWagons.length)+' требуют проверки'):'ЖД-снимок не получен'),'monitoring',railCurrentKnown?(railVerifyCount?'amber':'green'):(waitingWagons.length?'amber':railKnown?'green':'cyan')),system('FINANCE CONTROL','Платежи',financeCurrentKnown?currentDueCount:(financeKnown?paymentControl.length:'—'),financeCurrentKnown?('Finance V8 · к оплате сейчас: '+String(currentDueCount)+' · будущих этапов: '+String(currentFutureConditionalCount)):(financeKnown?(String(financeRows.length)+' сделок в финансовом снимке · просрочено: '+String(overdueCount)):'Финансовый снимок не получен'),'payments',financeCurrentKnown?(currentDueCount?'amber':'green'):(overdueCount?'red':paymentControl.length?'amber':financeKnown?'green':'cyan')),system('DOCUMENT CONTROL','Документы',docsKnown?docs.length:'—',docsKnown?(String(uncheckedDocs.length)+' требуют контроля'):'Снимок документов не получен','documents',uncheckedDocs.length?'amber':docsKnown?'green':'cyan'));",
    'canonical-system-controls'
  );

  patched=replaceRequired(
    patched,
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.5-effective-kpi-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';",
    "  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v8.6-canonical-controls-v1';\n  window.__RONA_ADMIN_OPERATIONS_READMODEL_RECOVERY__='OPERATIONS_CURRENT_V1_RECOVERY_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_QUEUE__='OPERATIONS_ACTION_QUEUE_NORMALIZED_V1';\n  window.__RONA_ADMIN_OPERATIONS_ACTION_ROUTER__='OPERATIONS_ACTION_ROUTER_V1';\n  window.__RONA_ADMIN_OPERATIONS_COMPLETE_SCROLL__='OPERATIONS_COMPLETE_SCROLL_V1';\n  window.__RONA_ADMIN_OPERATIONS_EFFECTIVE_KPI__='OPERATIONS_EFFECTIVE_KPI_V1';\n  window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1';",
    'browser-version'
  );

  if(!patched.includes("financeCurrentKnown?currentDueCount"))throw new Error('ADMIN_OPERATIONS_V86_FINANCE_CURRENT_MISSING');
  if(!patched.includes("railCurrentKnown?railControlCount"))throw new Error('ADMIN_OPERATIONS_V86_RAIL_CURRENT_MISSING');
  if(!patched.includes("String(railGu12Count)+' ГУ-12"))throw new Error('ADMIN_OPERATIONS_V86_GU12_CURRENT_MISSING');
  if(patched.includes("railKnown?(String(rail.length)+' ГУ-12"))throw new Error('ADMIN_OPERATIONS_V86_FALSE_GU12_SEMANTICS_REMAINS');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_CANONICAL_CONTROLS__='OPERATIONS_CANONICAL_CONTROLS_V1'"))throw new Error('ADMIN_OPERATIONS_V86_MARKER_MISSING');
  if(patched.includes("setInterval(()=>ronaOpsV86"))throw new Error('ADMIN_OPERATIONS_V86_POLLING_FORBIDDEN');
  return patched;
}
