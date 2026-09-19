import { patchAdminOperationsCommandCenterV5 as patchFunctionalBaseline } from './admin-operations-command-center-v5.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v6-color-network-indicators';
export const OPERATIONS_VISUAL_BASELINE='v5-operational-automation:flightdeck-v5-full-rebuild';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V6_COLOR_NETWORK_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V6_COLOR_NETWORK_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const COLOR_NETWORK_CSS=String.raw`
#page-home .rona-flightdeck-v5{--fd-v6-blue:#6aa9ff;--fd-v6-indigo:#9a8cff;--fd-v6-teal:#45dfd1;--fd-v6-gold:#ffd16a;--fd-v6-emerald:#67f0b5;--fd-v6-violet:#c48cff}
#page-home .rona-fd-v5__instruments{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
#page-home .rona-fd-v5-gauge{--v6-accent:#6ee7ff;--v6-soft:rgba(110,231,255,.1);--v6-glow:rgba(110,231,255,.28);border-color:color-mix(in srgb,var(--v6-accent) 28%,transparent);background:repeating-linear-gradient(90deg,transparent 0,transparent 31px,color-mix(in srgb,var(--v6-accent) 3%,transparent) 32px),linear-gradient(150deg,color-mix(in srgb,var(--v6-accent) 7%,#081927),#030c15)}
#page-home .rona-fd-v5-gauge:before{width:3px;background:var(--v6-accent);box-shadow:0 0 13px var(--v6-glow)}
#page-home .rona-fd-v5-gauge:after{content:'';position:absolute;left:3px;right:0;top:0;height:1px;background:linear-gradient(90deg,var(--v6-accent),transparent 74%);opacity:.58}
#page-home .rona-fd-v5-gauge:hover{border-color:color-mix(in srgb,var(--v6-accent) 55%,transparent);background:linear-gradient(150deg,color-mix(in srgb,var(--v6-accent) 12%,#071522),#04101b);box-shadow:0 7px 24px color-mix(in srgb,var(--v6-accent) 8%,transparent),inset 0 1px 0 rgba(229,250,255,.055)}
#page-home .rona-fd-v5-gauge__code{color:color-mix(in srgb,var(--v6-accent) 78%,#dff7ff);font-weight:900}
#page-home .rona-fd-v5-gauge__lamp{background:var(--v6-accent);box-shadow:0 0 11px var(--v6-glow)}
#page-home .rona-fd-v5-gauge__label{color:color-mix(in srgb,var(--v6-accent) 48%,#dceef7)}
#page-home .rona-fd-v5-gauge__value{color:color-mix(in srgb,var(--v6-accent) 36%,#fff);text-shadow:0 0 18px var(--v6-glow)}
#page-home .rona-fd-v5-gauge__rail span{background:color-mix(in srgb,var(--v6-accent) 24%,transparent)}
#page-home .rona-fd-v5-gauge.is-blue{--v6-accent:var(--fd-v6-blue);--v6-glow:rgba(106,169,255,.3)}
#page-home .rona-fd-v5-gauge.is-indigo{--v6-accent:var(--fd-v6-indigo);--v6-glow:rgba(154,140,255,.3)}
#page-home .rona-fd-v5-gauge.is-teal{--v6-accent:var(--fd-v6-teal);--v6-glow:rgba(69,223,209,.28)}
#page-home .rona-fd-v5-gauge.is-gold{--v6-accent:var(--fd-v6-gold);--v6-glow:rgba(255,209,106,.3)}
#page-home .rona-fd-v5-gauge.is-emerald{--v6-accent:var(--fd-v6-emerald);--v6-glow:rgba(103,240,181,.3)}
#page-home .rona-fd-v5-gauge.is-violet{--v6-accent:var(--fd-v6-violet);--v6-glow:rgba(196,140,255,.3)}
#page-home .rona-fd-v5-gauge.is-cyan{--v6-accent:var(--fd-cyan);--v6-glow:rgba(110,231,255,.3)}
#page-home .rona-fd-v5-gauge.is-green{--v6-accent:var(--fd-green);--v6-glow:rgba(103,240,181,.3)}
#page-home .rona-fd-v5-gauge.is-amber{--v6-accent:var(--fd-amber);--v6-glow:rgba(255,209,106,.34)}
#page-home .rona-fd-v5-gauge.is-red{--v6-accent:var(--fd-red);--v6-glow:rgba(255,111,134,.36)}
#page-home .rona-fd-v5-strip__state:nth-child(1)>span:nth-of-type(2){color:var(--fd-v6-blue);font-weight:950;letter-spacing:.08em}
#page-home .rona-fd-v5-strip__state:nth-child(2)>span:nth-of-type(2){color:var(--fd-v6-gold);font-weight:950;letter-spacing:.08em}
#page-home .rona-fd-v5__status-cell:nth-child(1){border-color:rgba(106,169,255,.2);box-shadow:inset 2px 0 0 rgba(106,169,255,.52)}
#page-home .rona-fd-v5__status-cell:nth-child(1) .rona-fd-v5__status-label{color:rgba(106,169,255,.74)}
#page-home .rona-fd-v5__status-cell:nth-child(2){border-color:rgba(255,209,106,.2);box-shadow:inset 2px 0 0 rgba(255,209,106,.52)}
#page-home .rona-fd-v5__status-cell:nth-child(2) .rona-fd-v5__status-label{color:rgba(255,209,106,.72)}
#page-home .rona-fd-v5__status-cell:nth-child(3){border-color:rgba(196,140,255,.2);box-shadow:inset 2px 0 0 rgba(196,140,255,.52)}
#page-home .rona-fd-v5__status-cell:nth-child(3) .rona-fd-v5__status-label{color:rgba(196,140,255,.74)}
#page-home .rona-fd-v5-stage{--v6-stage-accent:var(--fd-cyan);border-color:color-mix(in srgb,var(--v6-stage-accent) 20%,transparent);background:linear-gradient(180deg,color-mix(in srgb,var(--v6-stage-accent) 7%,rgba(9,29,45,.72)),rgba(3,14,23,.72))}
#page-home .rona-fd-v5-stage:nth-child(1){--v6-stage-accent:var(--fd-v6-blue)}
#page-home .rona-fd-v5-stage:nth-child(2){--v6-stage-accent:var(--fd-cyan)}
#page-home .rona-fd-v5-stage:nth-child(3){--v6-stage-accent:var(--fd-v6-gold)}
#page-home .rona-fd-v5-stage:nth-child(4){--v6-stage-accent:var(--fd-v6-teal)}
#page-home .rona-fd-v5-stage:nth-child(5){--v6-stage-accent:var(--fd-v6-emerald)}
#page-home .rona-fd-v5-stage:nth-child(6){--v6-stage-accent:var(--fd-v6-violet)}
#page-home .rona-fd-v5-stage:nth-child(7){--v6-stage-accent:var(--fd-red)}
#page-home .rona-fd-v5-stage__label{color:color-mix(in srgb,var(--v6-stage-accent) 74%,#bfe3f3)}
#page-home .rona-fd-v5__systems .rona-fd-v5-system:nth-child(1){border-color:rgba(69,223,209,.2);box-shadow:inset 2px 0 0 rgba(69,223,209,.48)}
#page-home .rona-fd-v5__systems .rona-fd-v5-system:nth-child(1) .rona-fd-v5-system__code{color:rgba(69,223,209,.78)}
#page-home .rona-fd-v5__systems .rona-fd-v5-system:nth-child(2){border-color:rgba(255,209,106,.2);box-shadow:inset 2px 0 0 rgba(255,209,106,.48)}
#page-home .rona-fd-v5__systems .rona-fd-v5-system:nth-child(2) .rona-fd-v5-system__code{color:rgba(255,209,106,.78)}
#page-home .rona-fd-v5__systems .rona-fd-v5-system:nth-child(3){border-color:rgba(196,140,255,.2);box-shadow:inset 2px 0 0 rgba(196,140,255,.48)}
#page-home .rona-fd-v5__systems .rona-fd-v5-system:nth-child(3) .rona-fd-v5-system__code{color:rgba(196,140,255,.78)}
#page-home .rona-fd-v5__next-label{color:var(--fd-v6-gold)}
@media(max-width:1180px){#page-home .rona-fd-v5__instruments{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:480px){#page-home .rona-fd-v5__instruments{grid-template-columns:1fr}}
`;

const COLOR_NETWORK_RUNTIME=String.raw`
function ensureAdminHomeColorNetworkV6(){
  const id='ronaAdminOperationsColorNetworkV6Style';
  if(!document.getElementById(id)){
    const style=document.createElement('style');
    style.id=id;
    style.textContent=`+JSON.stringify(COLOR_NETWORK_CSS)+String.raw`;
    document.head.append(style);
  }
  window.__RONA_ADMIN_OPERATIONS_COLOR_NETWORK__='v6-color-network-indicators';
}
`;

export function patchAdminOperationsCommandCenterV6(script){
  let patched=patchFunctionalBaseline(script);

  patched=replaceRequired(
    patched,
    'function renderAdminHome(){',
    COLOR_NETWORK_RUNTIME+'\nfunction renderAdminHome(){',
    'color-runtime'
  );

  patched=replaceRequired(
    patched,
    "  ensureAdminGlobalSearchV5();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v5-operational-automation';",
    "  ensureAdminGlobalSearchV5();\n  ensureAdminHomeColorNetworkV6();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v5-operational-automation';\n  window.__RONA_ADMIN_OPERATIONS_COLOR_NETWORK__='v6-color-network-indicators';",
    'runtime-marker'
  );

  patched=replaceRequired(
    patched,
    "'data-rona-operations-command-center':'v5','data-rona-single-owner':'true'",
    "'data-rona-operations-command-center':'v5','data-rona-color-network':'v6','data-rona-single-owner':'true'",
    'dom-marker'
  );

  patched=replaceRequired(
    patched,
    "const d=adminData||{},ops=d.operations||{},opsMetrics=ops.metrics||{},opsAlerts=Array.isArray(ops.alerts)?ops.alerts:[];",
    "const d=adminData||{},ops=d.operations||{},opsMetrics=ops.metrics||{},opsAlerts=Array.isArray(ops.alerts)?ops.alerts:[],networkClients=Array.isArray(d.clients)?d.clients:[],networkAgents=Array.isArray(d.agents)?d.agents:[],networkClientCount=new Set(networkClients.map(x=>String(x?.client_id||x?.client_key||x?.id||'').trim()).filter(Boolean)).size,networkAgentCount=new Set(networkAgents.map(x=>String(x?.agent_person_id||x?.agent_id||x?.id||'').trim()).filter(Boolean)).size;",
    'network-read-model'
  );

  patched=replaceRequired(
    patched,
    "const gauge=(code,label,value,foot,target,tone)=>e('button',{class:'rona-fd-v5-gauge is-'+(tone||'cyan'),type:'button',onclick:()=>adminHomeNavigate(target)}",
    "const gauge=(code,label,value,foot,target,tone)=>e('button',{class:'rona-fd-v5-gauge is-'+(tone||'cyan'),type:'button','data-code':code,'aria-label':label+': '+String(value),onclick:()=>adminHomeNavigate(target)}",
    'accessible-gauge'
  );

  patched=replaceRequired(
    patched,
    "instruments.append(gauge('FLT-01','Активные сделки',activeDeals.length,'Текущий портфель','deals','cyan'),gauge('FLT-02','В исполнении',executionDeals.length,'Фактический статус','deals',executionDeals.length?'green':'cyan'),gauge('CAUT-03','Требует действия',attentionCount,'Подтверждённые сигналы','home',attentionCount?'amber':'green'),gauge('RAIL-04','Вагоны на контроле',railKnown?allWagons.length:'—',railKnown?'ЖД-контур':'Нет снимка','monitoring',waitingWagons.length?'amber':'cyan'),gauge('FIN-05','Платежи на контроле',financeKnown?paymentControl.length:'—',financeKnown?'Срок наступил / просрочено':'Нет снимка','payments',paymentControl.length?'amber':'cyan'),gauge('WARN-06','Критические события',criticalCount,'Операционные конфликты','home',criticalCount?'red':'green'));",
    "instruments.append(gauge('FLT-01','Активные сделки',activeDeals.length,'Текущий портфель','deals','blue'),gauge('FLT-02','В исполнении',executionDeals.length,'Фактический статус','deals','indigo'),gauge('CAUT-03','Требует действия',attentionCount,'Подтверждённые сигналы','home',attentionCount?'amber':'green'),gauge('RAIL-04','Вагоны на контроле',railKnown?allWagons.length:'—',railKnown?'ЖД-контур':'Нет снимка','monitoring',waitingWagons.length?'amber':'teal'),gauge('FIN-05','Платежи на контроле',financeKnown?paymentControl.length:'—',financeKnown?'Срок наступил / просрочено':'Нет снимка','payments',paymentControl.length?'amber':'gold'),gauge('WARN-06','Критические события',criticalCount,'Операционные конфликты','home',criticalCount?'red':'green'),gauge('NET-07','Клиенты в сети',networkClientCount,'Текущий реестр','access','emerald'),gauge('NET-08','Агенты в сети',networkAgentCount,'Активные профили','access','violet'));",
    'network-instruments'
  );

  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COLOR_NETWORK__='v6-color-network-indicators'"))throw new Error('ADMIN_OPERATIONS_V6_MARKER_MISSING');
  if(!patched.includes("'data-rona-color-network':'v6'"))throw new Error('ADMIN_OPERATIONS_V6_DOM_MARKER_MISSING');
  if(!patched.includes("'NET-07','Клиенты в сети'")||!patched.includes("'NET-08','Агенты в сети'"))throw new Error('ADMIN_OPERATIONS_V6_NETWORK_INDICATORS_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v5-operational-automation'"))throw new Error('ADMIN_OPERATIONS_V5_BASELINE_MISSING');
  if((patched.match(/function renderAdminHome\(\)\{/g)||[]).length!==1)throw new Error('ADMIN_OPERATIONS_V6_NOT_SINGLE_OWNER');
  if(/finance_event_submit/i.test(patched))throw new Error('ADMIN_OPERATIONS_V6_FINANCE_WRITE_FORBIDDEN');
  return patched;
}
