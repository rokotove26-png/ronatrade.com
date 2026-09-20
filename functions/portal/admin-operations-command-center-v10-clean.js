import { patchAdminOperationsCommandCenterV91 as patchLegacy } from './admin-operations-command-center-v9-1.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v10-operations-current-v2-single-owner';
export const OPERATIONS_CURRENT_V2_CONTRACT='OPERATIONS_CURRENT_V2_SINGLE_OWNER_V1';

const CLEAN_RUNTIME=String.raw`
let ronaOpsV10Snapshot=null,ronaOpsV10Error=null,ronaOpsV10Promise=null,ronaOpsV10Timer=0,ronaOpsV10Started=false;
function ronaOpsV10HomeVisible(){try{const p=page('home');return !!p&&getComputedStyle(p).display!=='none'}catch(_){return false}}
function ronaOpsV10Ready(s=ronaOpsV10Snapshot){return !!s&&s.version==='OPERATIONS_CURRENT_V2'&&String(s?.readiness?.state||'').toUpperCase()==='READY'}
function ronaOpsV10Num(v){const n=Number(v);return Number.isFinite(n)?n:null}
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
  ronaOpsV10Start();

  const snap=window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__||ronaOpsV10Snapshot,ready=ronaOpsV10Ready(snap),k=ready?(snap.kpis||{}):{},actions=ready&&Array.isArray(snap.actions)?snap.actions:[],deals=ready&&Array.isArray(snap.deals)?snap.deals:[],systems=ready?(snap.systems||{}):{};
  const value=name=>{const n=ready?ronaOpsV10Num(k?.[name]):null;return n===null?'—':n};
  const activeCount=value('activeDeals'),executionCount=value('executionDeals'),actionCount=value('actionsRequired'),railCount=value('trustedWagons'),paymentCount=value('paymentsDue'),criticalCount=value('criticalEvents'),clientsOnline=value('clientsOnline'),agentsOnline=value('agentsOnline'),documentsTotal=value('documentsTotal'),documentsAttention=value('documentsAttention');
  const criticalN=ready?(ronaOpsV10Num(k.criticalEvents)||0):0,attentionN=ready?(ronaOpsV10Num(k.actionsRequired)||0):0;
  const stateTone=!ready?(ronaOpsV10Error?'amber':'cyan'):criticalN>0?'red':attentionN>0?'amber':'green';
  const stateCode=!ready?(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC'):criticalN>0?'MASTER WARNING':attentionN>0?'MASTER CAUTION':'SYSTEM NORMAL';
  const stateText=!ready?(ronaOpsV10Error?('Ошибка Operations V2: '+ronaOpsV10Error):'Синхронизация единого операционного снимка…'):criticalN>0?('Критические события: '+criticalN):attentionN>0?('Требует действий: '+attentionN):'Контур стабилен';
  const root=e('div',{class:'rona-flightdeck-v5','data-rona-operations-command-center':'v10','data-rona-single-owner':'true','data-rona-source':'OPERATIONS_CURRENT_V2'});

  const top=e('header',{class:'rona-fd-v5__overhead'},
    e('div',{class:'rona-fd-v5__identity'},
      e('div',{class:'rona-fd-v5__overline',text:'RONA TRADE · OPERATIONS FLIGHTDECK'}),
      e('h1',{class:'rona-ops-v4__title',text:'Операционный центр'}),
      e('div',{class:'rona-fd-v5__subtitle'},e('span',{class:'rona-fd-v5__bus-dot'}),e('span',{text:'OPERATIONS CURRENT V2'}),e('span',{text:'·'}),e('span',{text:'FACTUAL STATE ONLY'}))
    ),
    e('div',{class:'rona-fd-v5__top-controls'},
      e('div',{class:'rona-fd-v5__annunciator is-'+stateTone},e('span',{class:'rona-fd-v5__ann-lamp'}),e('div',{},e('div',{class:'rona-fd-v5__ann-label',text:stateCode}),e('div',{class:'rona-fd-v5__ann-value',text:stateText}))),
      e('button',{class:'rona-fd-v5__refresh',type:'button',onclick:()=>ronaOpsV10Refresh('MANUAL')},e('span',{text:'↻'}),e('span',{text:'Refresh'}))
    )
  );

  const gauge=(code,label,v,foot,target,tone)=>e('button',{class:'rona-fd-v5-gauge is-'+tone,type:'button','data-code':code,onclick:()=>adminHomeNavigate(target)},e('span',{class:'rona-fd-v5-gauge__lamp'}),e('span',{class:'rona-fd-v5-gauge__code',text:code}),e('span',{class:'rona-fd-v5-gauge__label',text:label}),e('strong',{class:'rona-fd-v5-gauge__value',text:String(v)}),e('span',{class:'rona-fd-v5-gauge__foot',text:foot}));
  const instruments=e('section',{class:'rona-fd-v5__instruments','aria-label':'Операционные показатели'});
  instruments.append(
    gauge('ACT-01','Активные сделки',activeCount,ready?'Текущий портфель':'Источник не готов','deals','blue'),
    gauge('STG-02','В исполнении',executionCount,ready?'Фактический статус':'Источник не готов','deals','indigo'),
    gauge('CAUT-03','Требует действия',actionCount,ready?'Единая очередь действий':'Источник не готов','home',ready&&attentionN>0?'amber':'teal'),
    gauge('RAIL-04','Вагоны на контроле',railCount,ready?'TRUSTED позиции':'Источник не готов','monitoring','teal'),
    gauge('FIN-05','Платежи на контроле',paymentCount,ready?'Finance V8 · срок наступил':'Источник не готов','payments',ready&&Number(paymentCount)>0?'amber':'gold'),
    gauge('WARN-06','Критические события',criticalCount,ready?'Подтверждённые исключения':'Источник не готов','home',ready&&criticalN>0?'red':'emerald'),
    gauge('NET-07','Клиенты в сети',clientsOnline,ready?'Активные пользовательские подключения':'Presence не готов','access','green'),
    gauge('NET-08','Агенты в сети',agentsOnline,ready?'Активные пользовательские подключения':'Presence не готов','access','violet')
  );

  const screen=(code,title,count,body,extra='')=>{const s=e('section',{class:'rona-fd-v5-screen '+extra});s.append(e('div',{class:'rona-fd-v5-screen__head'},e('div',{},e('div',{class:'rona-fd-v5-screen__code',text:code}),e('div',{class:'rona-fd-v5-screen__title',text:title})),e('div',{class:'rona-fd-v5-screen__count',text:String(count)})),body);return s};
  const dealsBody=e('div',{class:'rona-fd-v5-flight-list'});
  if(!ready)dealsBody.append(ronaFdV5Empty('DATA SYNC','Сделки будут показаны после подтверждения Operations Current V2.'));
  else if(!deals.length)dealsBody.append(ronaFdV5Empty('NO ACTIVE DEALS','Активных сделок нет.'));
  else for(const d of deals){
    const id=String(d?.dealId||''),row=e('button',{class:'rona-fd-v5-flight',type:'button',onclick:()=>ronaOpsV10Open({target:'deals',dealId:id})});
    row.append(
      e('div',{class:'rona-fd-v5-flight__main'},e('strong',{text:id||'—'}),e('span',{text:String(d?.clientName||d?.clientId||'—')})),
      e('div',{class:'rona-fd-v5-flight__state'},e('span',{text:String(d?.businessStatus||'—')}),e('span',{text:String(d?.stage||'—')})),
      e('div',{class:'rona-fd-v5-flight__telemetry'},e('span',{text:'PAY '+(Number(d?.dueNow||0)>0?'DUE':'—')}),e('span',{text:'RAIL '+String(Number(d?.trustedWagons||0))}),e('span',{text:'DOC '+String(Number(d?.documentCount||0))}))
    );
    dealsBody.append(row);
  }
  const dealsScreen=screen('ACTIVE FLIGHT SELECTOR','Активный контур сделок',ready?deals.length:'—',dealsBody,'rona-fd-v5__flights');

  const selectedId=String(window.__RONA_ADMIN_OPS_V10_SELECTED_DEAL__||deals[0]?.dealId||''),selected=deals.find(d=>String(d?.dealId||'')===selectedId)||deals[0]||null;
  if(selected)window.__RONA_ADMIN_OPS_V10_SELECTED_DEAL__=String(selected.dealId||'');
  const missionBody=e('div',{class:'rona-fd-v5__mission-body'});
  if(!ready)missionBody.append(ronaFdV5Empty('DATA SYNC','Контур исполнения ожидает единый снимок.'));
  else if(!selected)missionBody.append(ronaFdV5Empty('NO SELECTED FLIGHT','Нет активной сделки.'));
  else{
    const due=Number(selected?.dueNow||0),rail=Number(selected?.trustedWagons||0),docs=Number(selected?.documentCount||0);
    missionBody.append(
      e('div',{class:'rona-fd-v5__mission-id',text:String(selected.dealId||'—')}),
      e('div',{class:'rona-fd-v5__status-grid'},
        e('div',{class:'rona-fd-v5__status-cell'},e('span',{class:'rona-fd-v5__status-label',text:'Состояние'}),e('strong',{class:'rona-fd-v5__status-value',text:String(selected.stage||selected.businessStatus||'—')})),
        e('div',{class:'rona-fd-v5__status-cell'},e('span',{class:'rona-fd-v5__status-label',text:'Оплата'}),e('strong',{class:'rona-fd-v5__status-value',text:due>0?('К оплате '+due+' '+String(selected.currency||'')):String(selected.financeStatus||'—')})),
        e('div',{class:'rona-fd-v5__status-cell'},e('span',{class:'rona-fd-v5__status-label',text:'ЖД'}),e('strong',{class:'rona-fd-v5__status-value',text:rail?String(rail)+' ваг.':'—'})),
        e('div',{class:'rona-fd-v5__status-cell'},e('span',{class:'rona-fd-v5__status-label',text:'Документы'}),e('strong',{class:'rona-fd-v5__status-value',text:String(docs)}))
      ),
      e('button',{class:'rona-fd-v5__next-action',type:'button',onclick:()=>ronaOpsV10Open({target:selected.nextActionTarget||'deals',dealId:selected.dealId})},e('span',{class:'rona-fd-v5__next-label',text:'NEXT ACTION'}),e('span',{class:'rona-fd-v5__next-value',text:String(selected.nextAction||'Контроль исполнения сделки')}))
    );
  }
  const missionScreen=screen('EXECUTION VECTOR','Контур исполнения',ready&&selected?1:(ready?0:'—'),missionBody,'rona-fd-v5__mission');

  const queueBody=e('div',{});
  queueBody.append(e('div',{class:'rona-fd-v5__master-banner is-'+stateTone},e('span',{class:'rona-fd-v5__master-lamp'}),e('div',{},e('div',{class:'rona-fd-v5__master-code',text:stateCode}),e('div',{class:'rona-fd-v5__master-text',text:stateText}))));
  const queue=e('div',{class:'rona-fd-v5-queue'});
  if(!ready)queue.append(ronaFdV5Empty(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC',ronaOpsV10Error?'Не удалось подтвердить единый операционный снимок.':'Ожидаю Operations Current V2. Нулевые показатели не подставляются.'));
  else if(actions.length){
    for(const a of actions)queue.append(e('div',{class:'rona-fd-v5-event'},e('span',{class:'rona-fd-v5-event__signal is-'+(String(a?.severity||'ATTENTION').toUpperCase()==='CRITICAL'?'red':'amber')}),e('div',{},e('div',{class:'rona-fd-v5-event__name',text:String(a?.title||'Требуется действие')}),e('div',{class:'rona-fd-v5-event__meta',text:String(a?.meta||'')})),e('button',{class:'rona-fd-v5-event__open',type:'button',onclick:()=>ronaOpsV10Open(a),text:'›'}));
  }else queue.append(ronaFdV5Empty('ALL SYSTEMS NORMAL','Operations Current V2 подтверждает отсутствие действий, требующих вмешательства.'));
  queueBody.append(queue);
  const actionScreen=screen('EXCEPTION CONTROL','Требует действия',ready?actions.length:'—',queueBody,'rona-fd-v5__master');

  const workspace=e('section',{class:'rona-fd-v5__workspace'},dealsScreen,missionScreen,actionScreen);

  const system=(code,title,v,meta,target,tone)=>e('button',{class:'rona-fd-v5-system is-'+tone,type:'button',onclick:()=>adminHomeNavigate(target)},e('div',{},e('div',{class:'rona-fd-v5-system__head'},e('span',{class:'rona-fd-v5-system__lamp'}),e('span',{class:'rona-fd-v5-system__code',text:code})),e('div',{class:'rona-fd-v5-system__title',text:title}),e('div',{class:'rona-fd-v5-system__meta',text:meta})),e('div',{class:'rona-fd-v5-system__value',text:String(v)}));
  const sys=e('section',{class:'rona-fd-v5__systems'});
  const railSys=systems?.rail||{},finSys=systems?.finance||{},docSys=systems?.documents||{};
  sys.append(
    system('RAIL CONTROL','Онлайн ЖД',ready?railCount:'—',ready?(String(railSys.attention||0)+' требуют проверки'):'Источник не готов','monitoring',ready&&Number(railSys.attention||0)>0?'amber':ready?'green':'cyan'),
    system('FINANCE CONTROL','Платежи',ready?paymentCount:'—',ready?('Finance V8 · к оплате сейчас: '+String(paymentCount)):'Источник не готов','payments',ready&&Number(paymentCount)>0?'amber':ready?'green':'cyan'),
    system('DOCUMENT CONTROL','Документы',ready?documentsTotal:'—',ready?(String(documentsAttention)+' требуют контроля'):'Источник не готов','documents',ready&&Number(documentsAttention)>0?'amber':ready?'green':'cyan')
  );

  const freshness=ready?(snap.freshness||{}):{},stamp=freshness.signalUpdatedAt||snap?.generatedAt||null;
  const footer=e('footer',{class:'rona-fd-v5__footer'},e('span',{},'DATA BUS · ',e('strong',{text:'OPERATIONS CURRENT V2'}),' · SINGLE OWNER'),e('span',{text:stamp?('CURRENT STATE · '+String(stamp)):'CURRENT STATE · —'}));
  root.append(top,instruments,workspace,sys,footer);
  replacePage('home',root);
}
`;

function replaceSectionRequired(source,start,end,replacement,label){
  const first=source.indexOf(start);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V10_SECTION_START_MISSING:'+label);
  const boundary=source.indexOf(end,first+start.length);
  if(boundary<0)throw new Error('ADMIN_OPERATIONS_V10_SECTION_END_MISSING:'+label);
  if(source.indexOf(start,first+start.length)>=0)throw new Error('ADMIN_OPERATIONS_V10_SECTION_START_NOT_UNIQUE:'+label);
  return source.slice(0,first)+replacement+source.slice(boundary);
}

export function patchAdminOperationsCommandCenterV10Clean(script){
  let patched=patchLegacy(script);
  patched=replaceSectionRequired(
    patched,
    'function renderAdminHome(){',
    '\nfunction renderPrices(){',
    CLEAN_RUNTIME+'\n'+CLEAN_RENDER,
    'render-admin-home'
  );

  if(!patched.includes("call('/admin/operations-current-v2'"))throw new Error('ADMIN_OPERATIONS_V10_V2_SOURCE_MISSING');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_LEGACY_RUNTIME__='DISABLED_BY_V10'"))throw new Error('ADMIN_OPERATIONS_V10_LEGACY_DISABLE_MARKER_MISSING');
  if(!patched.includes("'Клиенты в сети'"))throw new Error('ADMIN_OPERATIONS_V10_CLIENT_ONLINE_LABEL_MISSING');
  if(!patched.includes("'Агенты в сети'"))throw new Error('ADMIN_OPERATIONS_V10_AGENT_ONLINE_LABEL_MISSING');
  if(!patched.includes("Operations Current V2 подтверждает отсутствие действий"))throw new Error('ADMIN_OPERATIONS_V10_FAIL_CLOSED_QUEUE_MISSING');
  if(patched.includes("function renderAdminHome(){\ninstallAdminExecutiveDashboardStyle();\ninstallAdminOperationsCommandCenterV4Style();\nensureAdminHomeAutoRefresh()"))throw new Error('ADMIN_OPERATIONS_V10_LEGACY_RENDER_STILL_ACTIVE');
  return patched;
}
