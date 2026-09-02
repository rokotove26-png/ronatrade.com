(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260902-client-background-section-preload-current-context-v6';
  if(window.__RONA_CLIENT_BACKGROUND_SECTION_PRELOAD__===MARK)return;
  window.__RONA_CLIENT_BACKGROUND_SECTION_PRELOAD__=MARK;

  const API='/portal/api';
  const REFRESH_MS=30000;
  const RETRY_MS=2500;
  const state={version:MARK,running:false,rerun:false,timer:0,retry:0,cycle:0,lastStartedAt:null,lastCompletedAt:null,lastReason:null,currentContext:null,cache:{},sections:{},errors:[],unsubscribe:null};
  window.__RONA_CLIENT_BACKGROUND_STATE__=state;

  const norm=v=>String(v??'').trim();
  const contextKey=c=>`${norm(c?.client_id)}|${norm(c?.contract_id)}`;
  const scopedPath=(route,c)=>`${route}?clientId=${encodeURIComponent(norm(c?.client_id))}&contractId=${encodeURIComponent(norm(c?.contract_id))}`;
  const contextPath=c=>scopedPath('/v1/client/context',c);
  const pricesPath=c=>scopedPath('/v1/client/prices',c);
  const marketPath=c=>scopedPath('/v1/client/market',c);
  const shipmentsPath=c=>scopedPath('/v1/client/shipments',c);
  const railPath=c=>scopedPath('/v1/client/rail',c);
  const now=()=>new Date().toISOString();

  function contextAuthority(){return window.RONA_CLIENT_CONTEXT||null}
  async function authorityReady(){const authority=contextAuthority();if(!authority)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');await authority.whenReady();return authority}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){}}
  function markSection(name,status,meta={}){state.sections[name]={status,updated_at:now(),...meta}}
  function publish(reason){
    const context=state.currentContext?{client_id:norm(state.currentContext.client_id),contract_id:norm(state.currentContext.contract_id)}:null;
    const detail={version:MARK,reason,cycle:state.cycle,last_completed_at:state.lastCompletedAt,current_context:context,sections:JSON.parse(JSON.stringify(state.sections))};
    document.documentElement.dataset.ronaClientBackgroundSections=Object.values(state.sections).every(x=>x.status==='READY'||x.status==='READY_EMPTY'||x.status==='READY_DISABLED')?'ready':'degraded';
    emit('rona:client:background-sections',detail);
  }

  async function read(path,{allowDisabled=false}={}){
    const started=Date.now();let response;
    try{response=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-background-preload':'v6-current-context-only'}})}
    catch(error){const message=String(error?.message||error||'NETWORK_ERROR');state.cache[path]={ok:false,status:0,error:message,loaded_at:now(),duration_ms:Date.now()-started};throw new Error(message)}
    const body=await response.json().catch(()=>null);
    const disabled=allowDisabled&&response.status===503&&body?.code==='RAIL_CLIENT_PUBLICATION_DISABLED';
    const entry={ok:response.ok||disabled,status:response.status,disabled,body,loaded_at:now(),duration_ms:Date.now()-started};
    state.cache[path]=entry;if(!entry.ok)throw new Error(String(body?.code||body?.error?.code||`HTTP_${response.status}`));return entry;
  }
  async function preloadContext(ctx){
    const key=contextKey(ctx);if(!norm(ctx?.client_id)||!norm(ctx?.contract_id))return {key,ok:false,error:'INVALID_CONTEXT'};
    const [detail,prices]=await Promise.allSettled([read(contextPath(ctx)),read(pricesPath(ctx))]);
    return {key,ok:detail.status==='fulfilled'&&prices.status==='fulfilled',detail_ok:detail.status==='fulfilled',prices_ok:prices.status==='fulfilled',detail_error:detail.status==='rejected'?String(detail.reason?.message||detail.reason):null,prices_error:prices.status==='rejected'?String(prices.reason?.message||prices.reason):null};
  }

  async function cycle(reason='timer'){
    if(state.running){state.rerun=true;return}
    state.running=true;state.rerun=false;state.cycle+=1;state.lastReason=reason;state.lastStartedAt=now();state.errors=[];
    document.documentElement.dataset.ronaClientBackgroundSections='loading';emit('rona:client:background-sections-loading',{version:MARK,reason,cycle:state.cycle});
    try{
      const authority=await authorityReady(),current=authority.getCurrentContext();
      state.currentContext=current||null;
      markSection('company_contract','READY',{context_selected:Boolean(current),selection_required:authority.selectionRequired()});
      if(!current){
        for(const name of ['home','applications','deals','documents','payments','prices','market','rail'])markSection(name,'READY_EMPTY',{selection_required:true});
      }else{
        const key=contextKey(current);
        const [market,shipments,rail,context]=await Promise.all([
          read(marketPath(current)).then(()=>({ok:true})).catch(error=>({ok:false,error})),
          read(shipmentsPath(current)).then(()=>({ok:true})).catch(error=>({ok:false,error})),
          read(railPath(current),{allowDisabled:true}).then(entry=>({ok:true,disabled:entry.disabled})).catch(error=>({ok:false,error})),
          preloadContext(current)
        ]);
        if(contextKey(authority.getCurrentContext())!==key){state.rerun=true;return}
        for(const name of ['home','applications','deals','documents','payments'])markSection(name,context.detail_ok?'READY':'DEGRADED',{context_selected:true});
        markSection('prices',context.prices_ok?'READY':'DEGRADED',{context_selected:true});
        markSection('market',market.ok?'READY':'DEGRADED',{context_selected:true});
        markSection('rail',shipments.ok&&rail.ok?(rail.disabled?'READY_DISABLED':'READY'):'DEGRADED',{provider_disabled:Boolean(rail.disabled),context_selected:true});
        if(!context.ok)state.errors.push({scope:'context',key:context.key,detail_error:context.detail_error,prices_error:context.prices_error});
        if(!market.ok)state.errors.push({scope:'market',error:String(market.error?.message||market.error)});
        if(!shipments.ok)state.errors.push({scope:'shipments',error:String(shipments.error?.message||shipments.error)});
        if(!rail.ok)state.errors.push({scope:'rail',error:String(rail.error?.message||rail.error)});
      }
      state.lastCompletedAt=now();window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache;publish(reason);clearTimeout(state.retry);state.retry=0;
    }catch(error){
      state.errors.push({scope:'context-authority',error:String(error?.message||error)});
      for(const name of ['company_contract','home','applications','deals','documents','payments','prices','market','rail'])markSection(name,'DEGRADED');
      state.lastCompletedAt=now();window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache;publish(reason);clearTimeout(state.retry);state.retry=window.setTimeout(()=>cycle('retry'),RETRY_MS);
    }finally{state.running=false;if(state.rerun){state.rerun=false;queueMicrotask(()=>cycle('queued'))}}
  }

  function start(){
    const authority=contextAuthority();if(!authority){cycle('authority-unavailable');return}
    state.unsubscribe=authority.subscribe(()=>cycle('context-change'));
    cycle('open');state.timer=window.setInterval(()=>cycle('interval'),REFRESH_MS);
    window.addEventListener('pageshow',()=>cycle('pageshow'),{passive:true});window.addEventListener('online',()=>cycle('online'),{passive:true});window.addEventListener('focus',()=>cycle('focus'),{passive:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')cycle('visible')});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();