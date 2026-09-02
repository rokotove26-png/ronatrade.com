(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260902-client-background-section-preload-market-hourly-v2';
  if(window.__RONA_CLIENT_BACKGROUND_SECTION_PRELOAD__===MARK)return;
  window.__RONA_CLIENT_BACKGROUND_SECTION_PRELOAD__=MARK;

  const API='/portal/api';
  const REFRESH_MS=30000;
  const MARKET_INTELLIGENCE_REFRESH_MS=3600000;
  const RETRY_MS=2500;
  const MARKET_INTELLIGENCE_PATH='/v1/client/market-intelligence';
  const state={
    version:MARK,
    running:false,
    rerun:false,
    timer:0,
    retry:0,
    cycle:0,
    lastStartedAt:null,
    lastCompletedAt:null,
    lastReason:null,
    contexts:[],
    cache:{},
    sections:{},
    errors:[]
  };
  window.__RONA_CLIENT_BACKGROUND_STATE__=state;

  const norm=v=>String(v??'').trim();
  const contextKey=c=>`${norm(c?.client_id)}|${norm(c?.contract_id)}`;
  const contextPath=c=>`/v1/client/context?clientId=${encodeURIComponent(norm(c?.client_id))}&contractId=${encodeURIComponent(norm(c?.contract_id))}`;
  const pricesPath=c=>`/v1/client/prices?clientId=${encodeURIComponent(norm(c?.client_id))}&contractId=${encodeURIComponent(norm(c?.contract_id))}`;
  const now=()=>new Date().toISOString();

  function emit(name,detail){
    try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){/* no-op */}
  }
  function markSection(name,status,meta={}){
    state.sections[name]={status,updated_at:now(),...meta};
  }
  function publish(reason){
    const detail={
      version:MARK,
      reason,
      cycle:state.cycle,
      last_completed_at:state.lastCompletedAt,
      contexts:state.contexts.map(c=>({client_id:norm(c?.client_id),contract_id:norm(c?.contract_id)})),
      sections:JSON.parse(JSON.stringify(state.sections))
    };
    document.documentElement.dataset.ronaClientBackgroundSections=Object.values(state.sections).every(x=>x.status==='READY'||x.status==='READY_EMPTY'||x.status==='READY_DISABLED')?'ready':'degraded';
    emit('rona:client:background-sections',detail);
  }

  async function read(path,{allowDisabled=false}={}){
    const started=Date.now();
    let response;
    try{
      response=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-background-preload':'v2'}});
    }catch(error){
      const message=String(error?.message||error||'NETWORK_ERROR');
      state.cache[path]={ok:false,status:0,error:message,loaded_at:now(),duration_ms:Date.now()-started};
      throw new Error(message);
    }
    const body=await response.json().catch(()=>null);
    const disabled=allowDisabled&&response.status===503&&body?.code==='RAIL_CLIENT_PUBLICATION_DISABLED';
    const entry={ok:response.ok||disabled,status:response.status,disabled,body,loaded_at:now(),duration_ms:Date.now()-started};
    state.cache[path]=entry;
    if(!entry.ok)throw new Error(String(body?.code||body?.error?.code||`HTTP_${response.status}`));
    return entry;
  }

  function contextRows(entry){
    return Array.isArray(entry?.body?.data?.contexts)?entry.body.data.contexts:[];
  }

  async function readMarketIntelligence(reason){
    const cached=state.cache[MARKET_INTELLIGENCE_PATH];
    const loadedAt=Date.parse(cached?.loaded_at||'');
    const fresh=Boolean(cached?.ok)&&Number.isFinite(loadedAt)&&(Date.now()-loadedAt)<MARKET_INTELLIGENCE_REFRESH_MS;
    const force=reason==='open'||reason==='context-change';
    if(fresh&&!force)return {ok:true,entry:cached,cached:true};
    try{return {ok:true,entry:await read(MARKET_INTELLIGENCE_PATH),cached:false}}
    catch(error){return {ok:false,error,cached:false}}
  }

  async function preloadContext(ctx){
    const key=contextKey(ctx);
    if(!norm(ctx?.client_id)||!norm(ctx?.contract_id))return {key,ok:false,error:'INVALID_CONTEXT'};
    const [detail,prices]=await Promise.allSettled([read(contextPath(ctx)),read(pricesPath(ctx))]);
    return {
      key,
      ok:detail.status==='fulfilled'&&prices.status==='fulfilled',
      detail_ok:detail.status==='fulfilled',
      prices_ok:prices.status==='fulfilled',
      detail_error:detail.status==='rejected'?String(detail.reason?.message||detail.reason):null,
      prices_error:prices.status==='rejected'?String(prices.reason?.message||prices.reason):null
    };
  }

  async function cycle(reason='timer'){
    if(state.running){state.rerun=true;return}
    state.running=true;
    state.rerun=false;
    state.cycle+=1;
    state.lastReason=reason;
    state.lastStartedAt=now();
    state.errors=[];
    document.documentElement.dataset.ronaClientBackgroundSections='loading';
    emit('rona:client:background-sections-loading',{version:MARK,reason,cycle:state.cycle});

    try{
      const boot=await read('/v1/client/bootstrap');
      state.contexts=contextRows(boot);
      markSection('company_contract','READY',{contexts:state.contexts.length});

      const [market,marketIntelligence,shipments,rail,contexts]=await Promise.all([
        read('/v1/client/market').then(()=>({ok:true})).catch(error=>({ok:false,error})),
        readMarketIntelligence(reason),
        read('/v1/client/shipments').then(()=>({ok:true})).catch(error=>({ok:false,error})),
        read('/v1/client/rail',{allowDisabled:true}).then(entry=>({ok:true,disabled:entry.disabled})).catch(error=>({ok:false,error})),
        Promise.all(state.contexts.map(preloadContext))
      ]);

      const allDetails=contexts.every(x=>x.detail_ok);
      const allPrices=contexts.every(x=>x.prices_ok);
      const empty=state.contexts.length===0;
      const intelligenceData=marketIntelligence.ok?marketIntelligence.entry?.body?.data:null;
      const analyticsCount=Array.isArray(intelligenceData?.analytics)?intelligenceData.analytics.length:0;
      const newsCount=Array.isArray(intelligenceData?.news)?intelligenceData.news.length:0;

      for(const name of ['home','applications','deals','documents','payments']){
        markSection(name,empty?'READY_EMPTY':allDetails?'READY':'DEGRADED',{contexts:state.contexts.length});
      }
      markSection('prices',empty?'READY_EMPTY':allPrices?'READY':'DEGRADED',{contexts:state.contexts.length});
      markSection('market',market.ok?'READY':'DEGRADED');
      markSection('analytics',marketIntelligence.ok?(analyticsCount?'READY':'READY_EMPTY'):'DEGRADED',{items:analyticsCount,feed:'RONA_CLIENT_MARKET_INTELLIGENCE_V1',refresh_ms:MARKET_INTELLIGENCE_REFRESH_MS});
      markSection('market_news',marketIntelligence.ok?(newsCount?'READY':'READY_EMPTY'):'DEGRADED',{items:newsCount,window_calendar_dates:7,authoritative_date:'source_published_at',deduplication:'duplicate_group',refresh_ms:MARKET_INTELLIGENCE_REFRESH_MS});
      markSection('rail',shipments.ok&&rail.ok?(rail.disabled?'READY_DISABLED':'READY'):'DEGRADED',{provider_disabled:Boolean(rail.disabled)});

      for(const row of contexts){
        if(!row.ok)state.errors.push({scope:'context',key:row.key,detail_error:row.detail_error,prices_error:row.prices_error});
      }
      if(!market.ok)state.errors.push({scope:'market',error:String(market.error?.message||market.error)});
      if(!marketIntelligence.ok)state.errors.push({scope:'market_intelligence',error:String(marketIntelligence.error?.message||marketIntelligence.error)});
      if(!shipments.ok)state.errors.push({scope:'shipments',error:String(shipments.error?.message||shipments.error)});
      if(!rail.ok)state.errors.push({scope:'rail',error:String(rail.error?.message||rail.error)});

      state.lastCompletedAt=now();
      window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache;
      publish(reason);
      clearTimeout(state.retry);state.retry=0;
    }catch(error){
      state.errors.push({scope:'bootstrap',error:String(error?.message||error)});
      for(const name of ['company_contract','home','applications','deals','documents','payments','prices','market','analytics','market_news','rail'])markSection(name,'DEGRADED');
      state.lastCompletedAt=now();
      window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache;
      publish(reason);
      clearTimeout(state.retry);
      state.retry=window.setTimeout(()=>cycle('retry'),RETRY_MS);
    }finally{
      state.running=false;
      if(state.rerun){state.rerun=false;queueMicrotask(()=>cycle('queued'))}
    }
  }

  function start(){
    cycle('open');
    state.timer=window.setInterval(()=>cycle('interval'),REFRESH_MS);
    window.addEventListener('pageshow',()=>cycle('pageshow'),{passive:true});
    window.addEventListener('online',()=>cycle('online'),{passive:true});
    window.addEventListener('focus',()=>cycle('focus'),{passive:true});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')cycle('visible')});
    document.addEventListener('rona:client:context-changed',()=>cycle('context-change'));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
