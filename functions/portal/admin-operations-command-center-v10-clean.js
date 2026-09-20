import { patchAdminOperationsCommandCenterV91 as patchLegacy } from './admin-operations-command-center-v9-1.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v10-operations-current-v2-single-owner';
export const OPERATIONS_CURRENT_V2_CONTRACT='OPERATIONS_CURRENT_V2_SINGLE_OWNER_V1';

const CLEAN_RUNTIME=String.raw`
let ronaOpsV10Snapshot=null,ronaOpsV10Error=null,ronaOpsV10Promise=null,ronaOpsV10Timer=0,ronaOpsV10Started=false;
function ronaOpsV10HomeVisible(){try{const p=page('home');return !!p&&getComputedStyle(p).display!=='none'}catch(_){return false}}
function ronaOpsV10Ready(s=ronaOpsV10Snapshot){return !!s&&s.version==='OPERATIONS_CURRENT_V2'&&String(s?.readiness?.state||'').toUpperCase()==='READY'}
function ronaOpsV10Num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function ronaOpsV10Fingerprint(row,snap=ronaOpsV10Snapshot){
  const id=String(row?.id||''),dealId=String(row?.dealId||'');
  const deal=Array.isArray(snap?.deals)?snap.deals.find(x=>String(x?.dealId||'')===dealId):null;
  return JSON.stringify([
    'v1',id,String(row?.kind||''),String(row?.severity||''),String(row?.title||''),String(row?.meta||''),String(row?.target||''),dealId,String(row?.applicationId||''),
    deal?Number(deal?.dueNow||0):null,deal?Number(deal?.verificationWagons||0):null,deal?Number(deal?.uncheckedDocuments||0):null,deal?String(deal?.nextAction||''):null
  ]);
}
let ronaOpsV10SeenMap=new Map(),ronaOpsV10SeenReady=false,ronaOpsV10SeenError=null;
function ronaOpsV10ApplySeen(data){
  const rows=Array.isArray(data?.seen)?data.seen:[];
  ronaOpsV10SeenMap=new Map(rows.map(x=>[String(x?.id||''),String(x?.fingerprint||'')]).filter(x=>x[0]));
  ronaOpsV10SeenReady=true;ronaOpsV10SeenError=null;
  window.__RONA_ADMIN_OPERATIONS_ATTENTION_SEEN__={ready:true,count:ronaOpsV10SeenMap.size,at:Date.now()};
}
function ronaOpsV10Unseen(actions,snap=ronaOpsV10Snapshot){
  if(!ronaOpsV10SeenReady)return null;
  return (Array.isArray(actions)?actions:[]).filter(row=>ronaOpsV10SeenMap.get(String(row?.id||''))!==ronaOpsV10Fingerprint(row,snap));
}
async function ronaOpsV10LoadSeen(signal){
  try{
    const seen=await call('/admin/operations-attention-seen-v1',signal?{signal}:{});
    ronaOpsV10ApplySeen(seen||{});
    return seen;
  }catch(err){
    ronaOpsV10SeenReady=false;
    ronaOpsV10SeenError=String(err?.code||err?.message||err);
    window.__RONA_ADMIN_OPERATIONS_ATTENTION_SEEN__={ready:false,error:ronaOpsV10SeenError,at:Date.now()};
    return null;
  }
}
async function ronaOpsV10Ack(actions,snap=ronaOpsV10Snapshot){
  const items=(Array.isArray(actions)?actions:[]).map(row=>({id:String(row?.id||''),fingerprint:ronaOpsV10Fingerprint(row,snap)})).filter(x=>x.id);
  if(!items.length){ronaOpsV10ApplySeen({seen:[]});return{acknowledged:0}}
  const result=await post('/admin/operations-attention-ack-v1',{items});
  for(const item of items)ronaOpsV10SeenMap.set(item.id,item.fingerprint);
  ronaOpsV10SeenReady=true;ronaOpsV10SeenError=null;
  window.__RONA_ADMIN_OPERATIONS_ATTENTION_SEEN__={ready:true,count:ronaOpsV10SeenMap.size,at:Date.now(),acknowledged:Number(result?.acknowledged||items.length)};
  if(ronaOpsV10HomeVisible())renderAdminHome();
  return result;
}
async function ronaOpsV10OpenAttention(){
  const snap=window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__||ronaOpsV10Snapshot,ready=ronaOpsV10Ready(snap),actions=ready&&Array.isArray(snap?.actions)?snap.actions:[];
  document.querySelector('#ronaOpsV10AttentionDetail')?.remove();
  const layer=e('div',{id:'ronaOpsV10AttentionDetail',role:'dialog','aria-modal':'true','aria-label':'Требует внимания'});
  layer.style.cssText='position:fixed;inset:0;z-index:2147483643;background:rgba(2,7,17,.78);backdrop-filter:blur(4px);display:grid;place-items:center;padding:20px';
  const panel=e('section',{});
  panel.style.cssText='width:min(860px,100%);max-height:84vh;overflow:auto;border:1px solid rgba(255,209,106,.28);border-radius:14px;background:linear-gradient(160deg,#071521,#04101a);color:#edfaff;box-shadow:0 30px 90px rgba(0,0,0,.55);padding:18px';
  const head=e('div',{});head.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:16px';
  const identity=e('div',{});
  const unseenBefore=ronaOpsV10Unseen(actions,snap);
  const summary=e('div',{text:ready?('Открыто: '+actions.length+' · непросмотрено: '+(unseenBefore===null?'—':unseenBefore.length)):'Источник данных не готов'});
  summary.style.cssText='margin-top:6px;font-size:12px;color:rgba(211,232,243,.68)';
  identity.append(e('div',{text:'ОПЕРАЦИОННЫЕ ДЕЙСТВИЯ'}),e('h3',{text:'Требует внимания'}),summary);
  const close=e('button',{type:'button',text:'Закрыть',onclick:()=>layer.remove()});
  close.style.cssText='padding:8px 12px;border:1px solid rgba(110,231,255,.22);border-radius:8px;background:rgba(110,231,255,.04);color:inherit;cursor:pointer';
  head.append(identity,close);panel.append(head);
  const list=e('div',{});list.style.cssText='display:grid;gap:8px;margin-top:16px';
  if(!ready){
    const msg=e('div',{text:'Operations Current V2 ещё не готов.'});msg.style.cssText='padding:14px;border:1px solid rgba(255,209,106,.16);border-radius:9px';list.append(msg);
  }else if(!actions.length){
    const msg=e('div',{text:'Открытых элементов, требующих внимания, нет.'});msg.style.cssText='padding:14px;border:1px solid rgba(103,240,181,.16);border-radius:9px';list.append(msg);
  }else{
    for(const row of actions){
      const item=e('div',{});item.style.cssText='display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid rgba(110,231,255,.10);border-radius:9px;background:rgba(255,255,255,.018)';
      const lamp=e('span',{});lamp.style.cssText='width:8px;height:8px;border-radius:50%;background:'+(String(row?.severity||'').toUpperCase()==='CRITICAL'?'#ff6f86':'#ffd16a')+';box-shadow:0 0 12px currentColor';
      const info=e('div',{});
      info.append(e('div',{text:String(row?.title||'Требуется действие')}),e('div',{text:String(row?.meta||'')}));
      info.lastChild.style.cssText='margin-top:3px;font-size:11px;color:rgba(205,226,238,.62)';
      const open=e('button',{type:'button',text:'Открыть',onclick:()=>{layer.remove();ronaOpsV10Open(row)}});
      open.style.cssText='padding:7px 10px;border:1px solid rgba(110,231,255,.20);border-radius:7px;background:rgba(110,231,255,.04);color:inherit;cursor:pointer';
      item.append(lamp,info,open);list.append(item);
    }
  }
  panel.append(list);layer.append(panel);
  layer.addEventListener('click',ev=>{if(ev.target===layer)layer.remove()});
  const esc=ev=>{if(ev.key==='Escape'){layer.remove();document.removeEventListener('keydown',esc,true)}};document.addEventListener('keydown',esc,true);
  document.body.append(layer);close.focus();
  if(ready&&actions.length){
    try{
      await ronaOpsV10Ack(actions,snap);
      summary.textContent='Открыто: '+actions.length+' · непросмотрено: 0';
    }catch(err){
      summary.textContent='Открыто: '+actions.length+' · не удалось сохранить просмотр';
    }
  }
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
      const id=String(x?.dealId||''),stage=String(x?.stage||x?.businessStatus||'—'),payment=Number(x?.dueNow||0)>0?'DUE':String(x?.financeStatus||'—'),railCount=Number(x?.trustedWagons||0),gu12=Number(x?.gu12Count||0),docs=Number(x?.documentCount||0),isSelected=selected&&String(selected?.dealId||'')===id;
      const row=e('div',{class:'rona-fd-v5-strip '+(isSelected?'is-selected':''),role:'button',tabindex:'0','aria-label':'Выбрать '+(id||'сделку'),onclick:()=>{window.__RONA_ADMIN_OPS_SELECTED_DEAL__=id;renderAdminHome()},onkeydown:ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();window.__RONA_ADMIN_OPS_SELECTED_DEAL__=id;renderAdminHome()}}},
        e('div',{},e('div',{class:'rona-fd-v5-strip__id',text:id||'Сделка'}),e('div',{class:'rona-fd-v5-strip__client',text:String(x?.clientName||x?.clientId||'—')})),
        e('div',{class:'rona-fd-v5-strip__states'},
          e('div',{class:'rona-fd-v5-strip__state'},e('span',{class:'rona-fd-v5-strip__signal is-'+ronaFdV5Tone(stage)}),e('span',{text:'STG'}),e('b',{text:ronaFdV5Text(stage)})),
          e('div',{class:'rona-fd-v5-strip__state'},e('span',{class:'rona-fd-v5-strip__signal is-'+ronaFdV5Tone(payment)}),e('span',{text:'PAY'}),e('b',{text:ronaFdV5Text(payment)})),
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
    const id=String(selected?.dealId||''),stage=String(selected?.stage||selected?.businessStatus||'—'),payment=Number(selected?.dueNow||0)>0?('К оплате '+String(selected.dueNow)+' '+String(selected?.currency||'')):String(selected?.financeStatus||'—'),rail=Number(selected?.trustedWagons||0),docs=Number(selected?.documentCount||0),nextAction=String(selected?.nextAction||'Контроль исполнения сделки');
    const steps=[['Ресурс','—','cyan'],['Договор','—','cyan'],['Оплата',ronaFdV5Text(payment),ronaFdV5Tone(payment)],['ЖД',rail?String(rail)+' вагонов':'—','teal'],['Доставка',ronaFdV5Text(stage),ronaFdV5Tone(stage)],['Документы',String(docs)+' документов','violet'],['Закрытие',ronaFdV5Text(selected?.businessStatus||'—'),ronaFdV5Tone(selected?.businessStatus||'—')]];
    const vector=e('div',{class:'rona-fd-v5__vector'});
    for(const step of steps)vector.append(e('div',{class:'rona-fd-v5-stage','data-tone':step[2]},e('span',{class:'rona-fd-v5-stage__lamp'}),e('div',{class:'rona-fd-v5-stage__label',text:step[0]}),e('div',{class:'rona-fd-v5-stage__value',text:step[1]})));
    mission=e('section',{class:'rona-fd-v5-screen rona-fd-v5__mission'},
      e('div',{class:'rona-fd-v5__mission-head'},e('div',{},e('div',{class:'rona-fd-v5__mission-kicker',text:'EXECUTION VECTOR · SELECTED FLIGHT'}),e('div',{class:'rona-fd-v5__mission-id',text:id||'Сделка'}),e('div',{class:'rona-fd-v5__mission-client',text:String(selected?.clientName||selected?.clientId||'—')})),e('button',{class:'rona-fd-v5__mission-open',type:'button',onclick:()=>ronaOpsV10Open({target:'deals',dealId:id}),text:'Deal Control'})),
      e('div',{class:'rona-fd-v5__mission-status'},
        e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Current stage'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(stage)})),
        e('div',{class:'rona-fd-v5__status-cell'},e('div',{class:'rona-fd-v5__status-label',text:'Payment'}),e('div',{class:'rona-fd-v5__status-value',text:ronaFdV5Text(payment)})),
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
