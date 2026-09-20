import { patchAdminOperationsCommandCenterV6 as patchV6 } from './admin-operations-command-center-v6.js';

export const OPERATIONS_COMMAND_CENTER_VERSION='v7-event-driven-current-v1';
export const OPERATIONS_CURRENT_CONTRACT='OPERATIONS_CURRENT_V1';
export const OPERATIONS_INVALIDATION_CONTRACT='RONA_ADMIN_OPERATIONS_INVALIDATION_V1';

function replaceRequired(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error('ADMIN_OPERATIONS_V7_SOURCE_MISMATCH:'+label);
  if(source.indexOf(from,first+from.length)>=0)throw new Error('ADMIN_OPERATIONS_V7_SOURCE_NOT_UNIQUE:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const EVENT_RUNTIME=String.raw`
let ronaOpsV7Busy=false,ronaOpsV7Queued=false,ronaOpsV7Debounce=0,ronaOpsV7ReconnectTimer=0,ronaOpsV7HeartbeatTimer=0,ronaOpsV7ReconnectAttempt=0,ronaOpsV7Ref=1;
function ronaOpsV7HomeVisible(){const p=page('home');return !!(p&&getComputedStyle(p).display!=='none')}
function ronaOpsV7SetState(status,extra={}){window.__RONA_ADMIN_OPERATIONS_EVENT_STATE__={status,connected:status==='CONNECTED',updatedAt:Date.now(),...extra}}
async function ronaOpsV7RefreshCurrent(reason='EVENT'){
  if(ronaOpsV7Busy){ronaOpsV7Queued=true;return null}
  ronaOpsV7Busy=true;
  try{
    const next=await call('/admin/operations-current-v1');
    if(!next||next.version!=='OPERATIONS_CURRENT_V1')throw new Error('OPERATIONS_CURRENT_CONTRACT_MISMATCH');
    window.__RONA_ADMIN_OPERATIONS_CURRENT_V1__=next;
    window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__=null;
    window.__RONA_ADMIN_OPERATIONS_CURRENT_LAST_FETCH__={reason,at:Date.now(),signalVersion:Number(next.signal_version||0)};
    window.__RONA_ADMIN_OPERATIONS_DIRTY__=false;
    if(adminData&&typeof adminData==='object')adminData.operations=next;
    window.dispatchEvent(new CustomEvent('rona:operations-current',{detail:{reason,signalVersion:Number(next.signal_version||0),generatedAt:next.generated_at||null}}));
    if(ronaOpsV7HomeVisible())renderAdminHome();
    return next;
  }catch(err){
    window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__=String(err?.code||err?.message||err);
    window.dispatchEvent(new CustomEvent('rona:operations-current-error',{detail:{code:window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__,reason}}));
    if(ronaOpsV7HomeVisible())renderAdminHome();
    return null;
  }finally{
    ronaOpsV7Busy=false;
    if(ronaOpsV7Queued){ronaOpsV7Queued=false;queueMicrotask(()=>ronaOpsV7RefreshCurrent('COALESCED'))}
  }
}
function ronaOpsV7Schedule(reason='DATABASE_CHANGE'){
  window.__RONA_ADMIN_OPERATIONS_DIRTY__=true;
  if(!ronaOpsV7HomeVisible())return;
  clearTimeout(ronaOpsV7Debounce);
  ronaOpsV7Debounce=setTimeout(()=>ronaOpsV7RefreshCurrent(reason),180);
}
function ronaOpsV7ClearHeartbeat(){if(ronaOpsV7HeartbeatTimer){clearInterval(ronaOpsV7HeartbeatTimer);ronaOpsV7HeartbeatTimer=0}}
function ronaOpsV7ScheduleReconnect(){
  clearTimeout(ronaOpsV7ReconnectTimer);
  const steps=[1000,2000,5000,10000],delay=steps[Math.min(ronaOpsV7ReconnectAttempt++,steps.length-1)];
  ronaOpsV7ReconnectTimer=setTimeout(()=>ronaOpsV7Connect(true),delay);
}
function ronaOpsV7Connect(isReconnect=false){
  const existing=window.__RONA_ADMIN_OPERATIONS_EVENT_SOCKET__;
  if(existing&&(existing.readyState===WebSocket.OPEN||existing.readyState===WebSocket.CONNECTING))return;
  if(typeof WebSocket!=='function'){ronaOpsV7SetState('UNAVAILABLE',{reason:'WEBSOCKET_UNAVAILABLE'});return}
  ronaOpsV7SetState('CONNECTING',{reconnect:isReconnect});
  const key='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
  const url='wss://sxawrwzeobaqwwmlkzws.supabase.co/realtime/v1/websocket?apikey='+encodeURIComponent(key)+'&vsn=1.0.0';
  const ws=new WebSocket(url);
  window.__RONA_ADMIN_OPERATIONS_EVENT_SOCKET__=ws;
  const topic='realtime:rona-admin-operations-current-v1';
  const joinRef=String(ronaOpsV7Ref++);
  ws.onopen=()=>{
    ws.send(JSON.stringify({topic,event:'phx_join',payload:{config:{broadcast:{ack:false,self:false},presence:{enabled:false},postgres_changes:[{event:'UPDATE',schema:'public',table:'rona_admin_operations_invalidation_v1'}],private:false}},ref:joinRef,join_ref:joinRef}));
    ronaOpsV7ClearHeartbeat();
    ronaOpsV7HeartbeatTimer=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',payload:{},ref:String(ronaOpsV7Ref++),join_ref:null}))},25000);
  };
  ws.onmessage=ev=>{
    let msg=null;try{msg=JSON.parse(String(ev.data||''))}catch(_e){return}
    if(msg?.event==='phx_reply'&&String(msg?.ref||'')===joinRef){
      if(msg?.payload?.status==='ok'){
        const hadConnection=window.__RONA_ADMIN_OPERATIONS_EVENT_EVER_CONNECTED__===true;
        window.__RONA_ADMIN_OPERATIONS_EVENT_EVER_CONNECTED__=true;
        ronaOpsV7ReconnectAttempt=0;
        ronaOpsV7SetState('CONNECTED',{joinedAt:Date.now()});
        if(isReconnect&&hadConnection){window.__RONA_ADMIN_OPERATIONS_DIRTY__=true;if(ronaOpsV7HomeVisible())ronaOpsV7Schedule('RECONNECT_RECOVERY')}
      }else{
        ronaOpsV7SetState('ERROR',{reason:String(msg?.payload?.response?.reason||'JOIN_REJECTED')});
        try{ws.close()}catch(_e){}
      }
      if(ronaOpsV7HomeVisible())renderAdminHome();
      return;
    }
    if(msg?.event==='postgres_changes'){ronaOpsV7Schedule('DATABASE_CHANGE');return}
    if(msg?.event==='phx_error'||msg?.event==='phx_close'){
      ronaOpsV7SetState('DISCONNECTED',{reason:msg.event});
      if(ronaOpsV7HomeVisible())renderAdminHome();
    }
  };
  ws.onerror=()=>{ronaOpsV7SetState('ERROR',{reason:'SOCKET_ERROR'});if(ronaOpsV7HomeVisible())renderAdminHome()};
  ws.onclose=()=>{
    ronaOpsV7ClearHeartbeat();
    if(window.__RONA_ADMIN_OPERATIONS_EVENT_SOCKET__===ws)window.__RONA_ADMIN_OPERATIONS_EVENT_SOCKET__=null;
    ronaOpsV7SetState('DISCONNECTED',{reason:'SOCKET_CLOSED'});
    if(ronaOpsV7HomeVisible())renderAdminHome();
    ronaOpsV7ScheduleReconnect();
  };
}
function ensureAdminOperationsCurrentV7(){
  window.__RONA_ADMIN_OPERATIONS_EVENT_DRIVEN__='postgres-change-invalidation-v1-no-polling';
  if(window.__RONA_ADMIN_OPERATIONS_EVENT_INIT__)return;
  window.__RONA_ADMIN_OPERATIONS_EVENT_INIT__=true;
  window.__RONA_ADMIN_OPERATIONS_DIRTY__=true;
  ronaOpsV7RefreshCurrent('INITIAL');
  ronaOpsV7Connect(false);
  window.addEventListener('rona:admin-pagechange',()=>{if(ronaOpsV7HomeVisible()&&window.__RONA_ADMIN_OPERATIONS_DIRTY__)ronaOpsV7RefreshCurrent('PAGE_ACTIVATED')});
  window.addEventListener('pageshow',()=>{ronaOpsV7Connect(false);if(ronaOpsV7HomeVisible()&&window.__RONA_ADMIN_OPERATIONS_DIRTY__)ronaOpsV7RefreshCurrent('PAGE_SHOW')});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){ronaOpsV7Connect(false);if(ronaOpsV7HomeVisible()&&window.__RONA_ADMIN_OPERATIONS_DIRTY__)ronaOpsV7RefreshCurrent('VISIBLE_DIRTY')}},{passive:true});
}
`;

export function patchAdminOperationsCommandCenterV7(script){
  let patched=patchV6(script);

  patched=replaceRequired(
    patched,
    'function renderAdminHome(){',
    EVENT_RUNTIME+'\\nfunction renderAdminHome(){',
    'event-runtime'
  );

  patched=replaceRequired(
    patched,
    "  ensureAdminHomeColorNetworkV6();\n  ensureAdminHomeDealCurrentV6();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v5-operational-automation';\n  window.__RONA_ADMIN_OPERATIONS_COLOR_NETWORK__='v6-color-network-indicators';\n  window.__RONA_ADMIN_OPERATIONS_DEAL_CURRENT__='v1-authoritative-deals-snapshot';",
    "  ensureAdminHomeColorNetworkV6();\n  ensureAdminHomeDealCurrentV6();\n  ensureAdminOperationsCurrentV7();\n  window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v7-event-driven-current-v1';\n  window.__RONA_ADMIN_OPERATIONS_COLOR_NETWORK__='v6-color-network-indicators';\n  window.__RONA_ADMIN_OPERATIONS_DEAL_CURRENT__='v1-authoritative-deals-snapshot';",
    'runtime-marker'
  );

  patched=replaceRequired(
    patched,
    "const d=adminData||{},ops=d.operations||{},opsMetrics=ops.metrics||{},opsAlerts=Array.isArray(ops.alerts)?ops.alerts:[],networkClients=Array.isArray(d.clients)?d.clients:[],networkAgents=Array.isArray(d.agents)?d.agents:[],networkClientCount=new Set(networkClients.map(x=>String(x?.client_id||x?.client_key||x?.id||'').trim()).filter(Boolean)).size,networkAgentCount=new Set(networkAgents.map(x=>String(x?.agent_person_id||x?.agent_id||x?.id||'').trim()).filter(Boolean)).size;",
    "const d=adminData||{},ops=window.__RONA_ADMIN_OPERATIONS_CURRENT_V1__||d.operations||{},opsMetrics=ops.metrics||{},opsAlerts=Array.isArray(ops.alerts)?ops.alerts:[],networkClients=Array.isArray(d.clients)?d.clients:[],networkAgents=Array.isArray(d.agents)?d.agents:[],networkClientFallback=new Set(networkClients.map(x=>String(x?.client_id||x?.client_key||x?.id||'').trim()).filter(Boolean)).size,networkAgentFallback=new Set(networkAgents.map(x=>String(x?.agent_person_id||x?.agent_id||x?.id||'').trim()).filter(Boolean)).size,networkClientCount=Number.isFinite(Number(opsMetrics?.clients_registered))?Number(opsMetrics.clients_registered):networkClientFallback,networkAgentCount=Number.isFinite(Number(opsMetrics?.agents_registered))?Number(opsMetrics.agents_registered):networkAgentFallback;",
    'operations-current-source'
  );

  patched=replaceRequired(
    patched,
    "  const financeRows=financeKnown&&Array.isArray(fragment?.dealFinanceSummaries)?fragment.dealFinanceSummaries:[];",
    "  const financeRows=financeKnown&&Array.isArray(fragment?.dealFinanceSummaries)?fragment.dealFinanceSummaries:[];\n  const opsPaymentControl=Number.isFinite(Number(opsMetrics?.payments_on_control))?Number(opsMetrics.payments_on_control):null,opsTrustedWagons=Number.isFinite(Number(opsMetrics?.trusted_wagons))?Number(opsMetrics.trusted_wagons):null;",
    'authoritative-kpi-fallbacks'
  );

  patched=replaceRequired(
    patched,
    "  const stateTone=criticalCount?'red':attentionCount?'amber':'green';\n  const stateCode=criticalCount?'MASTER WARNING':attentionCount?'MASTER CAUTION':'SYSTEM NORMAL';\n  const stateText=criticalCount?'Критические события: '+criticalCount:attentionCount?'Требует внимания: '+attentionCount:'Контур стабилен';",
    "  const opsCurrentReady=ops?.version==='OPERATIONS_CURRENT_V1',opsEventConnected=window.__RONA_ADMIN_OPERATIONS_EVENT_STATE__?.connected===true,opsCurrentError=window.__RONA_ADMIN_OPERATIONS_CURRENT_ERROR__;\n  const stateTone=!opsCurrentReady||opsCurrentError||!opsEventConnected?'amber':criticalCount?'red':attentionCount?'amber':'green';\n  const stateCode=!opsCurrentReady||opsCurrentError?'DATA DEGRADED':!opsEventConnected?'EVENT LINK':criticalCount?'MASTER WARNING':attentionCount?'MASTER CAUTION':'SYSTEM NORMAL';\n  const stateText=!opsCurrentReady?'Операционный read model недоступен':opsCurrentError?'Ошибка read model: '+String(opsCurrentError):!opsEventConnected?'Канал событий переподключается':criticalCount?'Критические события: '+criticalCount:attentionCount?'Требует внимания: '+attentionCount:'Контур стабилен';",
    'fail-closed-system-state'
  );

  patched=replaceRequired(
    patched,
    "onclick:async()=>{try{const dealRefresh=window.__RONA_DEALS_CURRENT_STATE_REFRESH__;await ownerAdminRefreshTick(true);if(typeof dealRefresh==='function')await dealRefresh();renderAdminHome()}catch(err){window.__RONA_OWNER_ADMIN_REFRESH_ERROR__=String(err?.message||err);renderAdminHome();notify(err?.message||String(err),'Ошибка обновления')}}",
    "onclick:async()=>{try{const dealRefresh=window.__RONA_DEALS_CURRENT_STATE_REFRESH__;await ownerAdminRefreshTick(true);await ronaOpsV7RefreshCurrent('MANUAL');if(typeof dealRefresh==='function')await dealRefresh();renderAdminHome()}catch(err){window.__RONA_OWNER_ADMIN_REFRESH_ERROR__=String(err?.message||err);renderAdminHome();notify(err?.message||String(err),'Ошибка обновления')}}",
    'manual-refresh'
  );

  patched=replaceRequired(
    patched,
    "gauge('RAIL-04','Вагоны на контроле',railKnown?allWagons.length:'—',railKnown?'ЖД-контур':'Нет снимка','monitoring',waitingWagons.length?'amber':'teal')",
    "gauge('RAIL-04','Вагоны на контроле',railKnown?allWagons.length:(opsTrustedWagons!==null?opsTrustedWagons:'—'),railKnown?'ЖД-контур':(opsTrustedWagons!==null?'Canonical Rail':'Нет снимка'),'monitoring',waitingWagons.length?'amber':'teal')",
    'rail-kpi'
  );

  patched=replaceRequired(
    patched,
    "gauge('FIN-05','Платежи на контроле',financeKnown?paymentControl.length:'—',financeKnown?'Срок наступил / просрочено':'Нет снимка','payments',paymentControl.length?'amber':'gold')",
    "gauge('FIN-05','Платежи на контроле',opsPaymentControl!==null?opsPaymentControl:(financeKnown?paymentControl.length:'—'),opsPaymentControl!==null?'Current finance authority':(financeKnown?'Срок наступил / просрочено':'Нет снимка'),'payments',(opsPaymentControl||paymentControl.length)?'amber':'gold')",
    'finance-kpi'
  );

  patched=replaceRequired(patched,"gauge('NET-07','Клиенты в сети',networkClientCount,'Текущий реестр','access','emerald')","gauge('NET-07','Клиенты',networkClientCount,'Текущий реестр','access','emerald')",'clients-label');
  patched=replaceRequired(patched,"gauge('NET-08','Агенты в сети',networkAgentCount,'Активные профили','access','violet')","gauge('NET-08','Агенты',networkAgentCount,'Активные профили','access','violet')",'agents-label');

  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_EVENT_DRIVEN__='postgres-change-invalidation-v1-no-polling'"))throw new Error('ADMIN_OPERATIONS_V7_EVENT_MARKER_MISSING');
  if(!patched.includes("call('/admin/operations-current-v1')"))throw new Error('ADMIN_OPERATIONS_V7_READ_MODEL_CALL_MISSING');
  if(!patched.includes("table:'rona_admin_operations_invalidation_v1'"))throw new Error('ADMIN_OPERATIONS_V7_REALTIME_SIGNAL_MISSING');
  if(patched.includes("setInterval(()=>ownerAdminRefreshTick(false),30000"))throw new Error('ADMIN_OPERATIONS_V7_30S_POLLING_FORBIDDEN');
  if(!patched.includes("window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v7-event-driven-current-v1'"))throw new Error('ADMIN_OPERATIONS_V7_MARKER_MISSING');
  if((patched.match(/function renderAdminHome\(\)\{/g)||[]).length!==1)throw new Error('ADMIN_OPERATIONS_V7_NOT_SINGLE_OWNER');
  return patched;
}
