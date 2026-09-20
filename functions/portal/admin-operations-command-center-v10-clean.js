import { patchAdminOperationsCommandCenterV91 as patchLegacy } from './admin-operations-command-center-v9-1.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v10-operations-current-v2-single-owner';
export const OPERATIONS_CURRENT_V2_CONTRACT='OPERATIONS_CURRENT_V2_SINGLE_OWNER_V1';

const CLEAN_RUNTIME=String.raw`
let ronaOpsV10Snapshot=null,ronaOpsV10Error=null,ronaOpsV10Promise=null,ronaOpsV10Timer=0,ronaOpsV10Started=false;
function ronaOpsV10HomeVisible(){try{const p=page('home');return !!p&&getComputedStyle(p).display!=='none'}catch(_){return false}}
function ronaOpsV10Ready(s=ronaOpsV10Snapshot){return !!s&&s.version==='OPERATIONS_CURRENT_V2'&&String(s?.readiness?.state||'').toUpperCase()==='READY'}
function ronaOpsV10Num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function ronaOpsV10PaymentTone(row){
  const due=Number(row?.dueNow||0),future=Number(row?.futureConditional||0),k=ronaFdV5Key(row?.financeStatus||'');
  if(['OVERDUE','DISPUTED','HOLD','NO-GO','BLOCKED','FAILED','ERROR','REJECTED'].includes(k))return'red';
  if(['PAID','FULLY_PAID','SETTLED','CONFIRMED','COMPLETED'].includes(k)&&due<=0)return'green';
  if(['PARTIAL','PARTIALLY_PAID','PARTIAL_PAYMENT'].includes(k))return'amber';
  if(due>0||['DUE','PAYMENT_DUE','AWAITING_PAYMENT','PENDING_PAYMENT','WAITING_PAYMENT'].includes(k))return'amber';
  if(future>0||['NOT_DUE','NO_PAYMENT_REQUIRED','NOT_REQUIRED'].includes(k))return'cyan';
  return ronaFdV5Tone(k);
}
function installAdminOperationsPayStatusColorV1Style(){
  if(q('#ronaOpsPayStatusColorV1Style'))return;
  const s=e('style',{id:'ronaOpsPayStatusColorV1Style'});
  s.textContent=
    '#page-home .rona-fd-v5-strip__state--pay{gap:7px!important}' +
    '#page-home .rona-fd-v5-strip__pay-code{display:inline-grid;place-items:center;min-width:34px;height:19px;padding:0 6px;border:1px solid rgba(110,231,255,.20);border-radius:999px;background:rgba(110,231,255,.045);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:9px!important;font-weight:950!important;letter-spacing:.09em;line-height:1!important;color:rgba(188,230,247,.70);box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}' +
    '#page-home .rona-fd-v5-strip__state--pay .rona-fd-v5-strip__pay-value{font-weight:900!important;transition:color .16s ease,text-shadow .16s ease}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-green .rona-fd-v5-strip__pay-code{color:#83f2bd;border-color:rgba(103,240,181,.40);background:rgba(38,126,89,.16);box-shadow:0 0 12px rgba(103,240,181,.08),inset 0 1px 0 rgba(218,255,239,.035)}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-green .rona-fd-v5-strip__pay-value{color:#bdf8db!important;text-shadow:0 0 10px rgba(103,240,181,.12)}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-amber .rona-fd-v5-strip__pay-code{color:#ffd56f;border-color:rgba(255,209,106,.44);background:rgba(119,82,16,.17);box-shadow:0 0 12px rgba(255,209,106,.09),inset 0 1px 0 rgba(255,243,211,.03)}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-amber .rona-fd-v5-strip__pay-value{color:#ffe0a0!important;text-shadow:0 0 10px rgba(255,209,106,.13)}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-red .rona-fd-v5-strip__pay-code{color:#ff7d92;border-color:rgba(255,111,134,.48);background:rgba(124,29,47,.18);box-shadow:0 0 13px rgba(255,111,134,.11),inset 0 1px 0 rgba(255,226,232,.03)}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-red .rona-fd-v5-strip__pay-value{color:#ffb4c0!important;text-shadow:0 0 11px rgba(255,111,134,.16)}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-cyan .rona-fd-v5-strip__pay-code{color:#78e7ff;border-color:rgba(110,231,255,.38);background:rgba(22,101,133,.15);box-shadow:0 0 12px rgba(110,231,255,.08),inset 0 1px 0 rgba(224,250,255,.03)}' +
    '#page-home .rona-fd-v5-strip__state--pay.is-cyan .rona-fd-v5-strip__pay-value{color:#aeefff!important;text-shadow:0 0 10px rgba(110,231,255,.11)}' +
    '#page-home .rona-fd-v5__status-cell--payment{transition:border-color .16s ease,background .16s ease,box-shadow .16s ease}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-green{border-color:rgba(103,240,181,.26)!important;background:rgba(38,126,89,.075)!important}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-green .rona-fd-v5__status-value{color:#bdf8db!important}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-amber{border-color:rgba(255,209,106,.30)!important;background:rgba(119,82,16,.075)!important}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-amber .rona-fd-v5__status-value{color:#ffe0a0!important}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-red{border-color:rgba(255,111,134,.34)!important;background:rgba(124,29,47,.085)!important}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-red .rona-fd-v5__status-value{color:#ffb4c0!important}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-cyan{border-color:rgba(110,231,255,.22)!important;background:rgba(22,101,133,.065)!important}' +
    '#page-home .rona-fd-v5__status-cell--payment.is-cyan .rona-fd-v5__status-value{color:#aeefff!important}';
  document.head.appendChild(s);
}
function ronaOpsV10Open(row){
  const target=String(row?.target||'home'),dealId=String(row?.dealId||''),applicationId=String(row?.applicationId||'');
  if(target==='payments'){
    adminHomeNavigate('payments');
    if(dealId&&typeof window.__RONA_PAYMENTS_V8_OPEN_PASSPORT__==='function')queueMicrotask(()=>window.__RONA_PAYMENTS_V8_OPEN_PASSPORT__(dealId));
    return;
  }
  if(target==='deals'){
    if(dealId)window.__RONA_DEALS_REQUESTED_ID__=dealId;
    adminHomeNavigate('deals');
    if(dealId)queueMicrotask(()=>window.dispatchEvent(new CustomEvent('rona:deal-select',{detail:{dealId}})));
    return;
  }
  if(target==='applications'){
    if(applicationId)window.__RONA_APPLICATIONS_REQUESTED_ID__=applicationId;
    adminHomeNavigate('applications');
    return;
  }
  adminHomeNavigate(target||'home');
}
async function ronaOpsV10Refresh(reason='SYNC'){
  if(ronaOpsV10Promise)return ronaOpsV10Promise;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort('OPERATIONS_CURRENT_V2_TIMEOUT'),5000);
  window.__RONA_ADMIN_OPERATIONS_V2_STATUS__=ronaOpsV10Snapshot?'REFRESHING':'LOADING';
  ronaOpsV10Promise=(async()=>{
    try{
      const next=await call('/admin/operations-current-v2',{signal:controller.signal});
      if(!ronaOpsV10Ready(next))throw new Error('OPERATIONS_CURRENT_V2_CONTRACT_MISMATCH');
      ronaOpsV10Snapshot=next;
      ronaOpsV10Error=null;
      window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__=next;
      window.__RONA_ADMIN_OPERATIONS_V2_STATUS__='READY';
      window.__RONA_ADMIN_OPERATIONS_V2_LAST_FETCH__={reason,at:Date.now(),generatedAt:next.generatedAt||null,signalVersion:Number(next.signalVersion||0)};
      window.dispatchEvent(new CustomEvent('rona:operations-current-v2',{detail:{reason,generatedAt:next.generatedAt||null,signalVersion:Number(next.signalVersion||0)}}));
      if(ronaOpsV10HomeVisible())renderAdminHome();
      return next;
    }catch(err){
      ronaOpsV10Error=String(err?.name==='AbortError'?'OPERATIONS_CURRENT_V2_TIMEOUT':(err?.code||err?.message||err));
      window.__RONA_ADMIN_OPERATIONS_V2_ERROR__=ronaOpsV10Error;
      window.__RONA_ADMIN_OPERATIONS_V2_STATUS__='ERROR';
      if(ronaOpsV10HomeVisible())renderAdminHome();
      return null;
    }finally{
      clearTimeout(timeout);
      ronaOpsV10Promise=null;
    }
  })();
  return ronaOpsV10Promise;
}
function ronaOpsV10Start(){
  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v10-operations-current-v2-single-owner';
  window.__RONA_ADMIN_OPERATIONS_SOURCE__='OPERATIONS_CURRENT_V2';
  window.__RONA_ADMIN_OPERATIONS_LEGACY_RUNTIME__='DISABLED_BY_V10';
  window.__RONA_ADMIN_OPERATIONS_V2_REFRESH__=ronaOpsV10Refresh;
  if(ronaOpsV10Started)return;
  ronaOpsV10Started=true;
  queueMicrotask(()=>ronaOpsV10Refresh('INITIAL'));
  ronaOpsV10Timer=setInterval(()=>{if(document.visibilityState==='visible')ronaOpsV10Refresh('SYNC')},15000);
  window.addEventListener('pageshow',()=>ronaOpsV10Refresh('PAGE_SHOW'));
  window.addEventListener('focus',()=>ronaOpsV10Refresh('FOCUS'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)ronaOpsV10Refresh('VISIBLE')},{passive:true});
  window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')==='home')ronaOpsV10Refresh('HOME_ACTIVE')});
}
`;

const CLEAN_RENDER=String.raw`
function renderAdminHome(){
  installAdminExecutiveDashboardStyle();
  installAdminOperationsCommandCenterV4Style();
  installAdminOperationsMissionV8Style();
  installAdminOperationsPayStatusColorV1Style();
  ensureAdminHomeColorNetworkV6();
  ensureAdminGlobalSearchV5();
  ronaOpsV10Start();

  const snap=window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__||ronaOpsV10Snapshot;
  const ready=ronaOpsV10Ready(snap);
  const k=ready?(snap.kpis||{}):{};
  const deals=ready&&Array.isArray(snap.deals)?snap.deals:[];
  const actions=ready&&Array.isArray(snap.actions)?snap.actions:[];
  const systems=ready?(snap.systems||{}):{};
  const num=name=>{const n=ready?ronaOpsV10Num(k?.[name]):null;return n===null?null:n};
  const activeN=num('activeDeals'),executionN=num('executionDeals'),actionN=num('actionsRequired'),railN=num('trustedWagons'),paymentN=num('paymentsDue'),criticalN=num('criticalEvents'),clientsN=num('clientsOnline'),agentsN=num('agentsOnline'),documentsN=num('documentsTotal'),documentsAttentionN=num('documentsAttention');
  const stateTone=!ready?(ronaOpsV10Error?'amber':'cyan'):(criticalN||0)>0?'red':(actionN||0)>0?'amber':'green';
  const stateCode=!ready?(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC'):(criticalN||0)>0?'MASTER WARNING':(actionN||0)>0?'MASTER CAUTION':'SYSTEM NORMAL';
  const stateText=!ready?(ronaOpsV10Error?('Ошибка Operations V2: '+ronaOpsV10Error):'Синхронизация единого операционного снимка…'):(criticalN||0)>0?('Критические события: '+criticalN):(actionN||0)>0?('Требует внимания: '+actionN):'Контур стабилен';
  const root=e('div',{class:'rona-flightdeck-v5','data-rona-operations-command-center':'v10','data-rona-color-network':'v6','data-rona-single-owner':'true','data-rona-flightdeck':'v5-full-rebuild','data-rona-source':'OPERATIONS_CURRENT_V2'});
  const top=e('header',{class:'rona-fd-v5__overhead'},e('div',{class:'rona-fd-v5__identity'},e('div',{class:'rona-fd-v5__overline',text:'RONA TRADE · OPERATIONS FLIGHTDECK'}),e('h1',{class:'rona-ops-v4__title',text:'Операционный центр'}),e('div',{class:'rona-fd-v5__subtitle'},e('span',{class:'rona-fd-v5__bus-dot'}),e('span',{text:'OPERATIONS CURRENT V2'}),e('span',{text:'·'}),e('span',{text:'FACTUAL STATE ONLY'}))),e('div',{class:'rona-fd-v5__top-controls'},e('div',{class:'rona-fd-v5__annunciator is-'+stateTone},e('span',{class:'rona-fd-v5__ann-lamp'}),e('div',{},e('div',{class:'rona-fd-v5__ann-label',text:stateCode}),e('div',{class:'rona-fd-v5__ann-value',text:stateText}))),e('button',{class:'rona-fd-v5__refresh',type:'button',onclick:()=>ronaOpsV10Refresh('MANUAL')},e('span',{text:'↻'}),e('span',{text:'Refresh'}))));

  const gauge=(code,label,value,foot,target,tone)=>e('button',{class:'rona-fd-v5-gauge is-'+(tone||'cyan'),type:'button','data-code':code,'aria-label':label+': '+String(value),onclick:()=>adminHomeNavigate(target)},e('div',{class:'rona-fd-v5-gauge__top'},e('span',{class:'rona-fd-v5-gauge__code',text:code}),e('span',{class:'rona-fd-v5-gauge__lamp'})),e('div',{class:'rona-fd-v5-gauge__label',text:label}),e('div',{class:'rona-fd-v5-gauge__value',text:String(value)}),e('div',{class:'rona-fd-v5-gauge__foot',text:foot}),e('div',{class:'rona-fd-v5-gauge__rail'},e('span'),e('span'),e('span'),e('span'),e('span')));
  const instruments=e('section',{class:'rona-fd-v5__instruments','aria-label':'Операционные показатели'});
  instruments.append(
    gauge('FLT-01','Активные сделки',activeN===null?'—':activeN,ready?'Текущий портфель':'Источник не готов','deals','blue'),
    gauge('FLT-02','В исполнении',executionN===null?'—':executionN,ready?'Фактический статус':'Источник не готов','deals','indigo'),
    gauge('CAUT-03','Требует действия',actionN===null?'—':actionN,ready?'Единая очередь действий':'Источник не готов','home',ready&&(actionN||0)>0?'amber':'green'),
    gauge('RAIL-04','Вагоны на контроле',railN===null?'—':railN,ready?'TRUSTED позиции':'Источник не готов','monitoring',ready?'teal':'cyan'),
    gauge('FIN-05','Платежи на контроле',paymentN===null?'—':paymentN,ready?'Finance V8 · срок наступил':'Источник не готов','payments',ready&&(paymentN||0)>0?'amber':'gold'),
    gauge('WARN-06','Критические события',criticalN===null?'—':criticalN,ready?'Подтверждённые исключения':'Источник не готов','home',ready&&(criticalN||0)>0?'red':'green'),
    gauge('NET-07','Клиенты в сети',clientsN===null?'—':clientsN,ready?'Активные подключения':'Presence не готов','access','emerald'),
    gauge('NET-08','Агенты в сети',agentsN===null?'—':agentsN,ready?'Активные подключения':'Presence не готов','access','violet')
  );

  const selectedRequested=String(window.__RONA_ADMIN_OPS_SELECTED_DEAL__||'');
  let selected=deals.find(x=>String(x?.dealId||'')===selectedRequested)||deals[0]||null;
  if(selected?.dealId)window.__RONA_ADMIN_OPS_SELECTED_DEAL__=String(selected.dealId);

  const dealList=e('div',{});
  dealList.append(e('div',{class:'rona-fd-v5-list-head'},e('span',{text:'Flight / Deal'}),e('span',{text:'Execution state'}),e('span',{text:'Telemetry'})));
  const dealScroll=e('div',{class:'rona-fd-v5-list'});
  if(!ready){
    dealScroll.append(ronaFdV5Empty(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC',ronaOpsV10Error?'Не удалось подтвердить единый операционный снимок.':'Ожидаю Operations Current V2.'));
  }else if(deals.length){
    for(const x of deals){
      const id=String(x?.dealId||''),stage=String(x?.stage||x?.businessStatus||'—'),payment=Number(x?.dueNow||0)>0?'DUE':String(x?.financeStatus||'—'),paymentTone=ronaOpsV10PaymentTone(x),railCount=Number(x?.trustedWagons||0),gu12=Number(x?.gu12Count||0),docs=Number(x?.documentCount||0),isSelected=selected&&String(selected?.dealId||'')===id;
      const row=e('div',{class:'rona-fd-v5-strip '+(isSelected?'is-selected':''),role:'button',tabindex:'0','aria-label':'Выбрать '+(id||'сделку'),onclick:()=>{window.__RONA_ADMIN_OPS_SELECTED_DEAL__=id;renderAdminHome()},onkeydown:ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();window.__RONA_ADMIN_OPS_SELECTED_DEAL__=id;renderAdminHome()}}},
        e('div',{},e('div',{class:'rona-fd-v5-strip__id',text:id||'Сделка'}),e('div',{class:'rona-fd-v5-strip__client',text:String(x?.clientName||x?.clientId||'—')})),
        e('div',{class:'rona-fd-v5-strip__states'},
          e('div',{class:'rona-fd-v5-strip__state'},e('span',{class:'rona-fd-v5-strip__signal is-'+ronaFdV5Tone(stage)}),e('span',{text:'STG'}),e('b',{text:ronaFdV5Text(stage)})),
          e('div',{class:'rona-fd-v5-strip__state rona-fd-v5-strip__state--pay is-'+paymentTone,'data-pay-tone':paymentTone},e('span',{class:'rona-fd-v5-strip__signal is-'+paymentTone}),e('span',{class:'rona-fd-v5-strip__pay-code',text:'PAY'}),e('b',{class:'rona-fd-v5-strip__pay-value',text:ronaFdV5Text(payment)})),
          e('div',{class:'rona-fd-v5-strip__next',text:'NEXT · '+String(x?.nextAction||'Контроль исполнения сделки')})
        ),
        e('div',{class:'rona-fd-v5-strip__telemetry'},e('span',{class:'rona-fd-v5-strip__chip',text:railCount?String(railCount)+' WGN':gu12?String(gu12)+' GU12':'RAIL —'}),e('span',{class:'rona-fd-v5-strip__chip',text:String(docs)+' DOC'}))
      );
      dealScroll.append(row);
    }
  }else dealScroll.append(ronaFdV5Empty('NO ACTIVE FLIGHTS','Активных сделок нет.'));
  dealList.append(dealScroll);
  const dealsScreen=ronaFdV5Screen('ACTIVE FLIGHT SELECTOR','Активный контур сделок',ready?deals.length:'—',dealList,'rona-fd-v5__deals');

  let mission;
  if(!ready){
    mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},e('div',{class:'rona-fd-v5-screen__head'},e('div',{},e('div',{class:'rona-fd-v5-screen__code',text:'EXECUTION VECTOR'}),e('div',{class:'rona-fd-v5-screen__title',text:'Контур исполнения'}))),ronaFdV5Empty(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC','Контур исполнения ожидает единый снимок.'));
  }else if(selected){
    const id=String(selected?.dealId||''),stage=String(selected?.stage||selected?.businessStatus||'—'),payment=Number(selected?.dueNow||0)>0?('К оплате '+String(selected.dueNow)+' '+String(selected?.currency||'')):String(selected?.financeStatus||'—'),paymentTone=ronaOpsV10PaymentTone(selected),rail=Number(selected?.trustedWagons||0),docs=Number(selected?.documentCount||0),nextAction=String(selected?.nextAction||'Контроль исполнения сделки');
    const steps=[['Ресурс','—','cyan'],['Договор','—','cyan'],['Оплата',ronaFdV5Text(payment),paymentTone],['ЖД',rail?String(rail)+' вагонов':'—','teal'],['Доставка',ronaFdV5Text(stage),ronaFdV5Tone(stage)],['Документы',String(docs)+' документов','violet'],['Закрытие',ronaFdV5Text(selected?.businessStatus||'—'),ronaFdV5Tone(selected?.businessStatus||'—')]];
    const vector=e('div',{class:'rona-fd-v5__vector'});
    for(const step of steps)vector.append(e('div',{class:'rona-fd-v5-stage','data-tone':step[2]},e('span',{class:'rona-fd-v5-stage__lamp'}),e('div',{class:'rona-fd-v5-stage__label',text:step[0]}),e('div',{class:'rona-fd-v5-stage__value',text:step[1]})));
    mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},
      e('div',{class:'rona-fd-v5__mission-head'},e('div',{},e('div',{class:'rona-fd-v5__mission-kicker',text:'EXECUTION VECTOR · SELECTED FLIGHT'}),e('div',{class:'rona-fd-v5__mission-id',text:id||'Сделка'}),e('div',{class:'rona-fd-v5__mission-client',text:String(selected?.clientName||selected?.clientId||'—')})),e('button',{class:'rona-fd-v5__mission-open',type:'button',onclick:()=>ronaOpsV10Open({target:'deals',dealId:id}),text:'Deal Control'})),
      e('div',{class:'rona-fd-v5__mission-status'},
        e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Current stage'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(stage)})),
        e('div',{class:'rona-fd-v5__status-cell rona-fd-v5__status-cell--payment is-'+paymentTone,'data-pay-tone':paymentTone},e('div',{class:'rona-fd-v5__status-label',text:'Payment'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(payment)})),
        e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Documents'}),e('div',{class:'rona-fd-v5__status-value',text:String(docs)}))
      ),
      vector,
      e('button',{class:'rona-fd-v5__next-action',type:'button',onclick:()=>ronaOpsV10Open({target:selected?.nextActionTarget||'deals',dealId:id})},e('span',{class:'rona-fd-v5__next-label',text:'NEXT ACTION'}),e('span',{class:'rona-fd-v5__next-value',text:nextAction}))
    );
  }else mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},e('div',{class:'rona-fd-v5-screen__head'},e('div',{},e('div',{class:'rona-fd-v5-screen__code',text:'EXECUTION VECTOR'}),e('div',{class:'rona-fd-v5-screen__title',text:'Контур исполнения'}))),ronaFdV5Empty('NO SELECTED FLIGHT','Нет активной сделки.'));

  const masterBody=e('div',{});
  masterBody.append(e('div',{class:'rona-fd-v5__master-banner is-'+stateTone},e('span',{class:'rona-fd-v5__master-lamp'}),e('div',{},e('div',{class:'rona-fd-v5__master-code',text:stateCode}),e('div',{class:'rona-fd-v5__master-text',text:stateText}))));
  const queue=e('div',{class:'rona-fd-v5-queue'});
  if(!ready)queue.append(ronaFdV5Empty(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC',ronaOpsV10Error?'Не удалось подтвердить единый операционный снимок.':'Ожидаю Operations Current V2. Нулевые показатели не подставляются.'));
  else if(actions.length){for(const row of actions){const tone=String(row?.severity||'ATTENTION').toUpperCase()==='CRITICAL'?'red':'amber';queue.append(e('div',{class:'rona-fd-v5-event'},e('span',{class:'rona-fd-v5-event__signal is-'+tone}),e('div',{},e('div',{class:'rona-fd-v5-event__name',text:String(row?.title||'Требуется действие')}),e('div',{class:'rona-fd-v5-event__meta',text:String(row?.meta||'')})),e('button',{class:'rona-fd-v5-event__open',type:'button','aria-label':'Открыть действие',onclick:()=>ronaOpsV10Open(row),text:'›'})))}}
  else queue.append(ronaFdV5Empty('ALL SYSTEMS NORMAL','Operations Current V2 подтверждает отсутствие действий, требующих вмешательства.'));
  masterBody.append(queue);
  const masterScreen=ronaFdV5Screen('EXCEPTION CONTROL','Master caution / warning',ready?actions.length:'—',masterBody,'rona-fd-v5__master');
  const workspace=e('section',{class:'rona-fd-v5__workspace'},dealsScreen,mission,masterScreen);

  const railSys=systems?.rail||{},finSys=systems?.finance||{},docSys=systems?.documents||{};
  const system=(code,title,value,meta,target,tone)=>e('button',{class:'rona-fd-v5-system is-'+(tone||'cyan'),type:'button',onclick:()=>adminHomeNavigate(target)},e('div',{},e('div',{class:'rona-fd-v5-system__head'},e('span',{class:'rona-fd-v5-system__lamp'}),e('span',{class:'rona-fd-v5-system__code',text:code})),e('div',{class:'rona-fd-v5-system__title',text:title}),e('div',{class:'rona-fd-v5-system__meta',text:meta})),e('div',{class:'rona-fd-v5-system__value',text:String(value)}));
  const systemsBar=e('section',{class:'rona-fd-v5__systems'});
  systemsBar.append(
    system('RAIL CONTROL','Онлайн ЖД',railN===null?'—':railN,ready?(String(railSys.attention||0)+' требуют проверки'):'Источник не готов','monitoring',ready&&Number(railSys.attention||0)>0?'amber':ready?'green':'cyan'),
    system('FINANCE CONTROL','Платежи',paymentN===null?'—':paymentN,ready?('Finance V8 · к оплате сейчас: '+String(paymentN||0)):'Источник не готов','payments',ready&&(paymentN||0)>0?'amber':ready?'green':'cyan'),
    system('DOCUMENT CONTROL','Документы',documentsN===null?'—':documentsN,ready?(String(documentsAttentionN||0)+' требуют контроля'):'Источник не готов','documents',ready&&(documentsAttentionN||0)>0?'amber':ready?'green':'cyan')
  );
  const stamp=ready?((snap?.freshness||{}).signalUpdatedAt||snap?.generatedAt||null):null;
  const footer=e('footer',{class:'rona-fd-v5__footer'},e('span',{},'DATA BUS · ',e('strong',{text:'OPERATIONS CURRENT V2'}),' · SINGLE OWNER'),e('span',{text:stamp?('CURRENT STATE · '+String(stamp)):'CURRENT STATE · —'}));
  root.append(top,instruments,workspace,systemsBar,footer);
  replacePage('home',root);
}
`;

function stripLegacyRuntime(source){
  const start='let ronaOpsV7Busy=';
  const end='function deriveOperationsMissionCurrentRows';
  const a=source.indexOf(start),b=source.indexOf(end);
  if(a<0||b<0||b<=a)throw new Error('ADMIN_OPERATIONS_V10_LEGACY_RUNTIME_BOUNDARY_MISSING');
  if(source.indexOf(start,a+start.length)>=0)throw new Error('ADMIN_OPERATIONS_V10_LEGACY_RUNTIME_START_NOT_UNIQUE');
  return source.slice(0,a)+"window.__RONA_ADMIN_OPERATIONS_LEGACY_EVENT_RUNTIME_STRIPPED__='V7_V91';\n"+source.slice(b);
}

function replaceSectionRequired(source,start,end,replacement,label){
  const first=source.indexOf(start);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V10_SECTION_START_MISSING:'+label);
  const boundary=source.indexOf(end,first+start.length);
  if(boundary<0)throw new Error('ADMIN_OPERATIONS_V10_SECTION_END_MISSING:'+label);
  if(source.indexOf(start,first+start.length)>=0)throw new Error('ADMIN_OPERATIONS_V10_SECTION_START_NOT_UNIQUE:'+label);
  return source.slice(0,first)+replacement+source.slice(boundary);
}

export function patchAdminOperationsCommandCenterV10Clean(script){
  let patched=stripLegacyRuntime(patchLegacy(script));
  patched=replaceSectionRequired(
    patched,
    'function renderAdminHome(){',
    '\nfunction renderPrices(){',
    CLEAN_RUNTIME+'\n'+CLEAN_RENDER,
    'render-admin-home'
  );

  if(!patched.includes("call('/admin/operations-current-v2'"))throw new Error('ADMIN_OPERATIONS_V10_V2_SOURCE_MISSING');
  if(patched.includes("call('/admin/operations-current-v1'"))throw new Error('ADMIN_OPERATIONS_V10_LEGACY_V1_CALL_REMAINS');
  if(patched.includes("realtime:rona-admin-operations-current-v1"))throw new Error('ADMIN_OPERATIONS_V10_LEGACY_V1_SOCKET_REMAINS');
  if(!patched.includes("__RONA_ADMIN_OPERATIONS_LEGACY_EVENT_RUNTIME_STRIPPED__='V7_V91'"))throw new Error('ADMIN_OPERATIONS_V10_LEGACY_EVENT_STRIP_MARKER_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_LEGACY_RUNTIME__='DISABLED_BY_V10'"))throw new Error('ADMIN_OPERATIONS_V10_LEGACY_DISABLE_MARKER_MISSING');
  if(!patched.includes("'Клиенты в сети'"))throw new Error('ADMIN_OPERATIONS_V10_CLIENT_ONLINE_LABEL_MISSING');
  if(!patched.includes("'Агенты в сети'"))throw new Error('ADMIN_OPERATIONS_V10_AGENT_ONLINE_LABEL_MISSING');
  if(!patched.includes("Operations Current V2 подтверждает отсутствие действий"))throw new Error('ADMIN_OPERATIONS_V10_FAIL_CLOSED_QUEUE_MISSING');
  if(patched.includes("function renderAdminHome(){\ninstallAdminExecutiveDashboardStyle();\ninstallAdminOperationsCommandCenterV4Style();\nensureAdminHomeAutoRefresh()"))throw new Error('ADMIN_OPERATIONS_V10_LEGACY_RENDER_STILL_ACTIVE');
  return patched;
}
