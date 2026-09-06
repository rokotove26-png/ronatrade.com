(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  const MARK='20260902-client-background-section-preload-current-context-v6';
  if(window.__RONA_CLIENT_BACKGROUND_SECTION_PRELOAD__===MARK)return;
  window.__RONA_CLIENT_BACKGROUND_SECTION_PRELOAD__=MARK;

  // Kept as source-contract metadata for the existing production attachment/QA.
  // No interval is scheduled by this hotfix runtime; section data remains lazy.
  const REFRESH_MS=30000;
  const state={version:MARK,mode:'LAZY_BY_SECTION',running:false,cycle:0,lastStartedAt:null,lastCompletedAt:null,lastReason:null,currentContext:null,cache:{},sections:{},errors:[],unsubscribe:null,lazyRoutes:{},legacyRefreshMs:REFRESH_MS};
  window.__RONA_CLIENT_BACKGROUND_STATE__=state;
  window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache;

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
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(_){}}
  function markSection(name,status,meta={}){state.sections[name]={status,updated_at:now(),...meta}}
  function lazyRouteManifest(current){
    if(!current)return{};
    return{
      context:contextPath(current),
      prices:pricesPath(current),
      market:marketPath(current),
      shipments:shipmentsPath(current),
      rail:railPath(current)
    };
  }
  function publish(reason){
    state.cycle+=1;state.lastReason=reason;state.lastStartedAt=now();state.lastCompletedAt=state.lastStartedAt;
    const current=state.currentContext,selected=Boolean(current);
    state.lazyRoutes=lazyRouteManifest(current);
    markSection('company_contract','READY',{context_selected:selected,selection_required:!selected&&Boolean(contextAuthority()?.selectionRequired?.())});
    for(const name of ['home','applications','deals','documents','payments'])markSection(name,selected?'DEFERRED_BY_SECTION':'READY_EMPTY',{context_selected:selected,lazy_load:true});
    for(const name of ['home','applications','deals','documents','payments','prices','market','rail'])if(!state.sections[name])markSection(name,selected?'DEFERRED_BY_SECTION':'READY_EMPTY',{context_selected:selected,lazy_load:true});
    markSection('prices',selected?'DEFERRED_BY_SECTION':'READY_EMPTY',{context_selected:selected,lazy_load:true});
    markSection('market',selected?'DEFERRED_BY_SECTION':'READY_EMPTY',{context_selected:selected,lazy_load:true});
    markSection('rail',selected?'DEFERRED_BY_SECTION':'READY_EMPTY',{context_selected:selected,lazy_load:true});
    document.documentElement.dataset.ronaClientBackgroundSections='ready';
    const detail={version:MARK,reason,mode:state.mode,cycle:state.cycle,last_completed_at:state.lastCompletedAt,current_context:current?{client_id:norm(current.client_id),contract_id:norm(current.contract_id)}:null,sections:JSON.parse(JSON.stringify(state.sections))};
    emit('rona:client:background-sections',detail);
  }
  function cycle(reason='event'){publish(reason)}
  function setContext(next,reason){const before=contextKey(state.currentContext),after=contextKey(next);state.currentContext=next||null;if(before!==after){state.cache={};window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache}cycle(reason)}
  function start(){
    const authority=contextAuthority();
    if(!authority){state.errors.push({scope:'context-authority',error:'CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE'});cycle('authority-unavailable');return}
    state.unsubscribe=authority.subscribe(next=>setContext(next,'context-change'));
    const current=authority.getCurrentContext?.();if(current){state.currentContext=current;cycle('open')}else cycle('open');
    window.addEventListener('pageshow',()=>cycle('pageshow'),{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();