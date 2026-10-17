// Owner Operations V12 — source-locked event transport for the existing V2 read model.
// This patch is applied by the same-origin /portal/main-ui middleware. It does not
// touch the original, governed Operations V10/V11 source or any business data.
function replaceOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0||source.indexOf(from,first+from.length)>=0)
    throw new Error('OPERATIONS_V12_SOURCE_MISMATCH:'+label);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

function operationsV12Controller(){
  const CHANNEL='realtime:rona-operations-current-v2-events';
  const URL='wss://sxawrwzeobaqwwmlkzws.supabase.co/realtime/v1/websocket';
  // Public publishable key only; the subscribed table exposes domain/version,
  // not business data. All authoritative reads use authenticated same-origin RPC.
  const PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
  const DOMAIN_NAMES=new Set(['DEALS','OPERATIONS','DOCUMENTS','FINANCE','RAIL','REGISTRY']);
  const SAFETY_MS=12*60*1000;
  const PRESENCE_TTL_MS=75*1000;
  const reconnectSteps=[1200,2600,5500,12000,30000];
  let started=false,connected=false,everConnected=false,paused=false;
  let socket=null,seq=1,joinRef='',reconnectCount=0,lastRead=0,read=null;
  let dirty=true,pending=false,eventEpoch=0,bootstrapFetched=false,bootstrapFallback=false;
  let initialTimer=0,eventTimer=0,safetyTimer=0,reconnectTimer=0,heartbeatTimer=0,retryTimer=0,presenceTimer=0;
  const versions=new Map(),stats={reads:0,events:0,coalesced:0};
  const now=()=>Date.now();
  const home=()=>document.visibilityState==='visible'&&ronaOpsV10HomeVisible();
  const stale=()=>!lastRead||now()-lastRead>=SAFETY_MS;
  function diagnostic(status,reason){
    window.__RONA_ADMIN_OPERATIONS_EVENTS_V12__={
      contract:'OPERATIONS_V12_REALTIME_INVALIDATION',status,reason,
      at:now(),lastReadAt:lastRead||null,eventEpoch,
      reads:stats.reads,events:stats.events,coalesced:stats.coalesced,
      connected:status==='CONNECTED'
    };
  }
  function renderLink(){
    if(home()&&typeof renderAdminHome==='function')renderAdminHome();
  }
  function timerClear(name){
    if(name==='heartbeat'){clearInterval(heartbeatTimer);heartbeatTimer=0}
    if(name==='event'){clearTimeout(eventTimer);eventTimer=0}
    if(name==='initial'){clearTimeout(initialTimer);initialTimer=0}
    if(name==='safety'){clearTimeout(safetyTimer);safetyTimer=0}
    if(name==='presence'){clearTimeout(presenceTimer);presenceTimer=0}
    if(name==='retry'){clearTimeout(retryTimer);retryTimer=0}
    if(name==='reconnect'){clearTimeout(reconnectTimer);reconnectTimer=0}
  }
  function safety(){
    timerClear('safety');
    if(!home())return;
    safetyTimer=setTimeout(()=>{
      safetyTimer=0;
      if(home())void refresh('SAFETY_REVALIDATION');
      else dirty=true;
    },SAFETY_MS);
  }
  function presenceExpiry(snapshot){
    timerClear('presence');
    if(!home())return;
    const clients=Number(snapshot?.kpis?.clientsOnline||0),
      agents=Number(snapshot?.kpis?.agentsOnline||0);
    if(!(clients>0||agents>0))return;
    // Only while real sessions are reported online: one bounded read at
    // their TTL boundary. A disconnected session must not remain online
    // indefinitely, even when no new database event arrives.
    const ttl=Math.min(90*1000,Math.max(PRESENCE_TTL_MS,
      Number(snapshot?.systems?.presence?.ttlSeconds||75)*1000));
    presenceTimer=setTimeout(()=>{
      presenceTimer=0;
      if(home())void refresh('PRESENCE_TTL_RECONCILE');
    },ttl);
  }
  function retry(){
    if(retryTimer||!home())return;
    const failures=Math.max(0,Number(window.__RONA_ADMIN_OPERATIONS_V12_FAILURES__||0));
    const delays=[3500,15000,60000,240000];
    retryTimer=setTimeout(()=>{
      retryTimer=0;
      if(home())void refresh('FAIL_CLOSED_RETRY');
    },delays[Math.min(failures,delays.length-1)]);
  }
  async function refresh(reason='EVENT'){
    if(!home()){dirty=true;return null}
    if(read){
      if(reason!=='MANUAL'){pending=true;stats.coalesced++}
      return read;
    }
    timerClear('retry');
    const epoch=eventEpoch;
    read=(async()=>{
      stats.reads++;
      const result=await ronaOpsV10Refresh(reason);
      if(result){
        lastRead=now();bootstrapFetched=true;
        window.__RONA_ADMIN_OPERATIONS_V12_FAILURES__=0;
        dirty=eventEpoch!==epoch;
        diagnostic(connected?'CONNECTED':'OFFLINE',reason);
        safety();
        presenceExpiry(result);
      }else{
        dirty=true;
        window.__RONA_ADMIN_OPERATIONS_V12_FAILURES__=
          Math.min(20,(window.__RONA_ADMIN_OPERATIONS_V12_FAILURES__||0)+1);
        diagnostic(connected?'CONNECTED':'OFFLINE','READ_FAILED');
        retry();
      }
      return result;
    })();
    try{return await read}
    finally{
      read=null;
      const caught=pending||dirty;
      pending=false;
      if(caught&&home()&&window.__RONA_ADMIN_OPERATIONS_V2_STATUS__!=='ERROR')
        schedule('COALESCED');
    }
  }
  function schedule(reason){
    dirty=true;
    if(!home())return;
    timerClear('event');
    eventTimer=setTimeout(()=>{eventTimer=0;void refresh(reason)},220);
  }
  function receive(event){
    const data=event?.payload?.data?.record||event?.payload?.record||{};
    const domain=String(data.domain||'').toUpperCase();
    const version=Number(data.version);
    if(!DOMAIN_NAMES.has(domain)||!Number.isSafeInteger(version)||version<1)return;
    if(version<=(versions.get(domain)||0))return;
    versions.set(domain,version);
    eventEpoch++;stats.events++;
    diagnostic(connected?'CONNECTED':'OFFLINE','INVALIDATION:'+domain);
    schedule('INVALIDATION:'+domain);
  }
  function heartbeatStop(){timerClear('heartbeat')}
  function reconnect(){
    timerClear('reconnect');
    if(document.hidden||paused)return;
    const wait=reconnectSteps[Math.min(reconnectCount++,reconnectSteps.length-1)];
    reconnectTimer=setTimeout(()=>{reconnectTimer=0;connect()},wait);
  }
  function connect(){
    if(document.hidden||paused)return;
    if(socket&&(socket.readyState===0||socket.readyState===1))return;
    if(typeof WebSocket!=='function'){
      diagnostic('OFFLINE','WEBSOCKET_UNAVAILABLE');renderLink();return;
    }
    diagnostic('CONNECTING','SUBSCRIBING');
    const ws=new WebSocket(URL+'?apikey='+encodeURIComponent(PUBLISHABLE_KEY)+'&vsn=1.0.0');
    socket=ws;window.__RONA_ADMIN_OPERATIONS_EVENT_SOCKET_V12__=ws;
    joinRef=String(seq++);
    const expectedRef=joinRef;
    ws.onopen=()=>{
      if(socket!==ws)return;
      ws.send(JSON.stringify({
        topic:CHANNEL,event:'phx_join',
        payload:{config:{broadcast:{ack:false,self:false},presence:{enabled:false},
          postgres_changes:[{event:'UPDATE',schema:'public',
            table:'rona_admin_operations_invalidation_v1'}],private:false}},
        ref:expectedRef,join_ref:expectedRef
      }));
      heartbeatStop();
      heartbeatTimer=setInterval(()=>{
        if(socket===ws&&ws.readyState===1)
          ws.send(JSON.stringify({topic:'phoenix',event:'heartbeat',
            payload:{},ref:String(seq++),join_ref:null}));
      },25000);
    };
    ws.onmessage=event=>{
      if(socket!==ws)return;
      let msg=null;
      try{msg=JSON.parse(String(event.data||''))}catch(_){return}
      if(msg?.event==='phx_reply'&&String(msg?.ref||'')===expectedRef){
        if(msg?.payload?.status!=='ok'){
          diagnostic('OFFLINE','JOIN_REJECTED');
          try{ws.close()}catch(_){}
          renderLink();return;
        }
        connected=true;reconnectCount=0;
        const replay=everConnected||bootstrapFallback;
        everConnected=true;
        diagnostic('CONNECTED',replay?'RECONNECTED':'SUBSCRIBED');
        renderLink();
        timerClear('initial');
        if(!bootstrapFetched)void refresh('INITIAL_SUBSCRIBED');
        else if(replay) {dirty=true;schedule('RECONNECT_RECONCILE')}
        else if(dirty&&home())schedule('JOIN_DIRTY');
        return;
      }
      if(msg?.event==='postgres_changes'){receive(msg);return}
      if(msg?.event==='phx_error'||msg?.event==='phx_close'){
        connected=false;dirty=true;
        diagnostic('OFFLINE',String(msg.event));
        renderLink();try{ws.close()}catch(_){}
      }
    };
    ws.onerror=()=>{
      if(socket!==ws)return;
      connected=false;dirty=true;
      diagnostic('OFFLINE','WEBSOCKET_ERROR');renderLink();
      try{ws.close()}catch(_){}
    };
    ws.onclose=()=>{
      if(socket!==ws)return;
      socket=null;window.__RONA_ADMIN_OPERATIONS_EVENT_SOCKET_V12__=null;
      connected=false;dirty=true;heartbeatStop();
      diagnostic(paused||document.hidden?'PAUSED':'OFFLINE','DISCONNECTED');
      renderLink();reconnect();
    };
  }
  function bootstrap(){
    if(bootstrapFetched||initialTimer||!home())return;
    initialTimer=setTimeout(()=>{
      initialTimer=0;
      if(bootstrapFetched||!home())return;
      bootstrapFallback=true;
      void refresh('INITIAL_SOCKET_WAIT_TIMEOUT');
    },1250);
  }
  function resume(reason){
    paused=false;connect();bootstrap();
    if(home()&&(dirty||stale())){
      if(connected||bootstrapFetched) schedule(reason);
    }
  }
  function suspend(){
    paused=true;dirty=true;
    timerClear('reconnect');timerClear('event');timerClear('initial');
    timerClear('safety');timerClear('presence');heartbeatStop();
    if(socket){
      const current=socket;socket=null;connected=false;
      window.__RONA_ADMIN_OPERATIONS_EVENT_SOCKET_V12__=null;
      try{current.close()}catch(_){}
    }
    diagnostic('PAUSED','DOCUMENT_HIDDEN');
  }
  function start(){
    if(started)return;
    started=true;
    window.__RONA_ADMIN_OPERATIONS_REFRESH_POLICY__=
      'REALTIME_INVALIDATION_NO_60S_POLL_V12';
    diagnostic('CONNECTING','BOOT');
    if(!document.hidden){connect();bootstrap()}
    window.addEventListener('rona:admin-pagechange',ev=>{
      if(String(ev?.detail?.page||'')==='home'&&home()&&(dirty||stale()))
        schedule('HOME_DIRTY_OR_STALE');
    });
    window.addEventListener('pageshow',()=>resume('PAGE_RESUME'));
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)suspend();
      else resume('VISIBLE_DIRTY_OR_STALE');
    },{passive:true});
    window.addEventListener('pagehide',suspend);
  }
  return {start,refresh,snapshot:()=>({connected,dirty,lastRead,stats:{...stats}}),
    __testReceive:receive,__testSchedule:schedule};
}

export function patchAdminOperationsEventRuntimeV12(input){
  let output=String(input||'');
  const marker="window.__RONA_ADMIN_OPERATIONS_LEGACY_RUNTIME__='DISABLED_BY_V10'";
  if(!output.includes(marker)||!output.includes("call('/admin/operations-current-v2'"))
    throw new Error('OPERATIONS_V12_V10_SOURCE_CONTRACT_MISSING');
  if(output.includes('__RONA_ADMIN_OPERATIONS_REFRESH_POLICY__'))
    throw new Error('OPERATIONS_V12_DUPLICATE_PATCH');

  // Avoid an additional per-event seen-record GET: viewer state is local
  // after ACK; refresh it on manual, initial, or explicit session recovery.
  output=replaceOnce(output,
    'const seenPromise=ronaOpsV10LoadSeen(controller.signal);',
    "const seenPromise=(!ronaOpsV10SeenReady||['MANUAL','SESSION_RESUME','RECONNECT_RECONCILE','HOME_DIRTY_OR_STALE'].includes(String(reason)))?ronaOpsV10LoadSeen(controller.signal):Promise.resolve(null);",
    'seen-requests');

  output=replaceOnce(output,
    'const RONA_OPS_AUTO_REFRESH_MS=60000;',
    "window.__RONA_ADMIN_OPERATIONS_LEGACY_60S_POLL_DISABLED__=true;",
    'legacy-60s');

  const from='function ronaOpsV10Start(){';
  const end='\nfunction renderAdminHome(){';
  const a=output.indexOf(from),b=output.indexOf(end,a);
  if(a<0||b<=a||output.indexOf(from,a+from.length)>=0)
    throw new Error('OPERATIONS_V12_START_BOUNDARY_MISMATCH');
  const controller="const ronaOpsV12Controller=("+operationsV12Controller.toString()+")();\n";
  const start="function ronaOpsV10Start(){"+
    "window.__RONA_ADMIN_OPERATIONS_COMMAND_CENTER__='v12-event-driven-operations-current-v2';"+
    "window.__RONA_ADMIN_OPERATIONS_SOURCE__='OPERATIONS_CURRENT_V2';"+
    "window.__RONA_ADMIN_OPERATIONS_LEGACY_RUNTIME__='DISABLED_BY_V10';"+
    "window.__RONA_ADMIN_OPERATIONS_V2_REFRESH__=ronaOpsV12Controller.refresh;"+
    "window.__RONA_ADMIN_OPERATIONS_EVENT_DEBUG_V12__=ronaOpsV12Controller.snapshot;"+
    "ronaOpsV12Controller.start();}\n";
  output=output.slice(0,a)+controller+start+output.slice(b);

  // V12 source health: a current, authorized database read is not a new
  // business mutation. Never mark a long-unchanged record as stale solely
  // because updated_at is old; still fail closed if the source is absent.
  output=replaceOnce(output,"    deals:['RECENT_RECORD_CHANGE','NO_ACTIVE_RECORDS'],","    deals:['RECENT_RECORD_CHANGE','CURRENT_REGISTRY_READ','NO_ACTIVE_RECORDS'],","deals-source");
  output=replaceOnce(output,"    finance:['RECENT_AUTHORITY_DATE'],rail:['RECENT_OBSERVATION'],","    finance:['RECENT_AUTHORITY_DATE','CURRENT_AUTHORITY_READ'],rail:['RECENT_OBSERVATION'],","finance-source");
  output=replaceOnce(output,"    documents:['RECENT_RECORD_CHANGE','NO_DOCUMENT_RECORDS'],","    documents:['RECENT_RECORD_CHANGE','CURRENT_DOCUMENT_REGISTRY_READ','NO_DOCUMENT_RECORDS'],","document-source");
  output=replaceOnce(output,"    contracts:['RECENT_RECORD_CHANGE'],","    contracts:['RECENT_RECORD_CHANGE','CURRENT_CONTRACT_REGISTRY_READ'],","contract-source");
  output=replaceOnce(output,"  const sourceFoot=name=>!opsTruth?'Источник не подтверждён':\n    sourceGood(name)?('Изменено '+ronaOpsV11ShortDate(opsSourceAsOf[name])):\n    ('ТРЕБУЕТ СВЕРКИ · '+ronaOpsV11ShortDate(opsSourceAsOf[name]));","  const sourceFoot=name=>{if(!opsTruth)return'Источник не подтверждён';\n    const source=String(opsSources[name]||'');\n    if(source==='NO_ACTIVE_RECORDS')return'Активных сделок нет';\n    if(source==='NO_DOCUMENT_RECORDS')return'Документов нет';\n    if(source==='NO_ACTIVE_MONITORING')return'ЖД-мониторинг не активирован';\n    if(source==='NO_OPEN_TASKS')return'Открытых задач нет';\n    const when=ronaOpsV11ShortDate(opsSourceAsOf[name]);\n    return sourceGood(name)?('Состояние из реестра · изменено '+when):\n      ('ИСТОЧНИК НЕ ПОДТВЕРЖДЁН · '+when);\n  };",'source-foot-truth');

  output=replaceOnce(output,
    "onclick:()=>ronaOpsV10Refresh('MANUAL')",
    "onclick:()=>ronaOpsV12Controller.refresh('MANUAL')",
    'manual-refresh');

  // Source-truth V11 still owns READY/DEGRADED. The status of the event link
  // is additional evidence and must not be presented as a healthy stream
  // while the WebSocket is disconnected. No business status is invented.
  const tone="  const stateTone=!ready?(ronaOpsV10Error?'amber':'cyan'):opsDegraded?'amber':(criticalN||0)>0?'red':(actionN||0)>0?'amber':'green';";
  const nextTone="  const opsEventStatus=String(window.__RONA_ADMIN_OPERATIONS_EVENTS_V12__?.status||'CONNECTING');\n"+
    "  const opsEventOnline=opsEventStatus==='CONNECTED';\n"+
    "  const stateTone=!ready?(ronaOpsV10Error?'amber':'cyan'):opsDegraded?'amber':!opsEventOnline?'amber':(criticalN||0)>0?'red':(actionN||0)>0?'amber':'green';";
  output=replaceOnce(output,tone,nextTone,'event-health-tone');

  const code="  const stateCode=!ready?(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC'):opsDegraded?'SOURCE RECONFIRMATION':(criticalN||0)>0?'MASTER WARNING':(actionN||0)>0?'MASTER CAUTION':'SYSTEM NORMAL';";
  const nextCode="  const stateCode=!ready?(ronaOpsV10Error?'DATA DEGRADED':'DATA SYNC'):opsDegraded?'SOURCE RECONFIRMATION':!opsEventOnline?'EVENT LINK OFFLINE':(criticalN||0)>0?'MASTER WARNING':(actionN||0)>0?'MASTER CAUTION':'SYSTEM NORMAL';";
  output=replaceOnce(output,code,nextCode,'event-health-code');

  const footer="  root.append(top,instruments,workspace,systemsBar,footer);";
  const nextFooter="  footer.append(e('span',{class:'rona-fd-v5__event-link',text:'События · '+(opsEventOnline?'ПОДКЛЮЧЕНО':opsEventStatus==='CONNECTING'?'ПОДКЛЮЧЕНИЕ':opsEventStatus==='PAUSED'?'ПАУЗА':'НЕТ СВЯЗИ')}));\n"+
    "  root.dataset.ronaOpsEventLink=opsEventStatus;\n"+footer;
  output=replaceOnce(output,footer,nextFooter,'source-transparent-footer');

  if(/setInterval\(\(\)=>\{if\(document\.visibilityState==='visible'&&ronaOpsV10HomeVisible\(\)\)ronaOpsV10Refresh/.test(output))
    throw new Error('OPERATIONS_V12_UNREMOVED_60S_POLL');
  if(!output.includes('realtime:rona-operations-current-v2-events')||
     !output.includes('OPERATIONS_V12_REALTIME_INVALIDATION'))
    throw new Error('OPERATIONS_V12_TRANSPORT_CONTRACT_MISSING');
  return output;
}

export const __test={replaceOnce,operationsV12Controller};
