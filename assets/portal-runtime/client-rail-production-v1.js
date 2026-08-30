(()=>{
  'use strict';
  if(location.pathname!=='/portal/client')return;
  if(window.__RONA_CLIENT_RAIL_PRODUCTION__==='20260830-auto-runtime-v2')return;
  window.__RONA_CLIENT_RAIL_PRODUCTION__='20260830-auto-runtime-v2';

  const TILE_SELECTOR='img.rona-rail-v7-tile';
  const TILE_RETRY_AFTER_MS=30000;
  const DATA_REFRESH_MS=30000;
  const PROVIDER_PROBE_MS=60000;
  const REQUEST_TIMEOUT_MS=12000;
  const SHIPMENTS_API='/portal/api/v1/client/shipments';
  const PROVIDER_GATE_API='/portal/api/v1/client/rail';
  let refreshInFlight=false;
  let lastProviderProbeAt=0;
  let lastProviderResult={state:'UNKNOWN',provider:null,code:null,movements:[]};

  function tileSpec(src){
    const raw=String(src||'');
    let m=/^https:\/\/tile\.openstreetmap\.org\/(\d{1,2})\/(\d+)\/(\d+)\.png(?:\?.*)?$/i.exec(raw);
    if(m)return{z:m[1],x:m[2],y:m[3]};
    try{
      const u=new URL(raw,location.origin);
      m=/^\/portal\/map-assets\/osm\/(\d{1,2})\/(\d+)\/(\d+)\.png$/.exec(u.pathname);
      if(m)return{z:m[1],x:m[2],y:m[3]};
    }catch(_){ }
    return null;
  }

  function direct(spec){return `https://tile.openstreetmap.org/${spec.z}/${spec.x}/${spec.y}.png`}
  function proxy(spec){return `/portal/map-assets/osm/${spec.z}/${spec.x}/${spec.y}.png`}
  function sourceKind(img){
    const raw=String(img.currentSrc||img.src||'');
    return raw.includes('/portal/map-assets/osm/')?'proxy':raw.includes('tile.openstreetmap.org/')?'direct':'other';
  }
  function switchSource(img,target){
    const spec=tileSpec(img.currentSrc||img.src);
    if(!spec)return false;
    if(target==='proxy'){
      if(img.dataset.ronaRailProxyTried==='1')return false;
      img.dataset.ronaRailProxyTried='1';
      img.src=proxy(spec);
      return true;
    }
    if(target==='direct'){
      if(img.dataset.ronaRailDirectTried==='1')return false;
      img.dataset.ronaRailDirectTried='1';
      img.referrerPolicy='strict-origin-when-cross-origin';
      img.src=direct(spec);
      return true;
    }
    return false;
  }
  function recover(img){
    if(!(img instanceof HTMLImageElement))return;
    const kind=sourceKind(img);
    if(kind==='direct'){
      img.dataset.ronaRailDirectTried='1';
      if(switchSource(img,'proxy'))return;
    }else if(kind==='proxy'){
      img.dataset.ronaRailProxyTried='1';
      if(switchSource(img,'direct'))return;
    }
    img.dataset.ronaRailFailedAt=String(Date.now());
  }
  function manage(img){
    if(!(img instanceof HTMLImageElement)||!tileSpec(img.currentSrc||img.src))return;
    if(img.dataset.ronaRailManaged!=='1'){
      img.dataset.ronaRailManaged='1';
      img.addEventListener('load',()=>{img.dataset.ronaRailFailedAt=''});
      img.addEventListener('error',()=>recover(img));
    }
    if(img.complete&&img.naturalWidth===0){
      const failedAt=Number(img.dataset.ronaRailFailedAt||0);
      if(failedAt&&Date.now()-failedAt>=TILE_RETRY_AFTER_MS){
        img.dataset.ronaRailDirectTried='';
        img.dataset.ronaRailProxyTried='';
        img.dataset.ronaRailFailedAt='';
      }
      recover(img);
    }
  }
  function scanTiles(){
    if(document.visibilityState==='hidden')return;
    document.querySelectorAll(TILE_SELECTOR).forEach(manage);
  }

  function railRoot(){
    for(const selector of ['#page-rail','#page-monitoring','[data-page="rail"]','[data-page="monitoring"]']){
      const el=document.querySelector(selector);
      if(el)return el;
    }
    const title=[...document.querySelectorAll('h1,h2,h3')].find(el=>String(el.textContent||'').trim()==='Онлайн ЖД');
    return title?.closest('section,[id^="page-"],main,.page')||title?.parentElement||null;
  }
  function ensureStatusBadge(){
    const root=railRoot();
    if(!root)return null;
    let badge=root.querySelector('#rona-client-rail-auto-status-v2');
    if(badge)return badge;
    const title=[...root.querySelectorAll('h1,h2,h3')].find(el=>String(el.textContent||'').trim()==='Онлайн ЖД');
    if(!title)return null;
    badge=document.createElement('span');
    badge.id='rona-client-rail-auto-status-v2';
    badge.setAttribute('role','status');
    badge.style.cssText='display:inline-flex;align-items:center;gap:6px;margin-left:10px;padding:4px 8px;border:1px solid rgba(118,190,219,.28);border-radius:999px;background:rgba(7,22,31,.72);color:#a9c4cf;font:600 10px/1.2 Inter,Arial,sans-serif;vertical-align:middle;white-space:nowrap';
    title.appendChild(badge);
    return badge;
  }
  function statusText(state){
    if(state==='LIVE')return 'Автообновление 30 с · ЖД-источник подключён';
    if(state==='WAITING_PROVIDER')return 'Автообновление 30 с · ЖД-источник ожидается';
    if(state==='DEGRADED')return 'Автообновление 30 с · восстанавливаю связь';
    return 'Автообновление 30 с';
  }
  function paintStatus(state,lastSyncAt){
    document.documentElement.dataset.ronaClientRailMode='AUTO_30S';
    document.documentElement.dataset.ronaClientRailSourceState=state;
    if(lastSyncAt)document.documentElement.dataset.ronaClientRailLastSync=lastSyncAt;
    const badge=ensureStatusBadge();
    if(badge){
      badge.textContent=statusText(state);
      badge.title=lastSyncAt?`Последняя серверная синхронизация: ${lastSyncAt}`:'';
    }
  }

  async function fetchJson(url){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(url,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal});
      const payload=await response.json().catch(()=>({}));
      return{ok:response.ok,status:response.status,payload};
    }finally{clearTimeout(timer)}
  }
  function extractMovements(payload){
    for(const value of [payload?.movements,payload?.data?.movements,payload?.rail?.movements])if(Array.isArray(value))return value;
    return [];
  }
  function publishState({shipments,shipmentsOk,providerResult,lastSyncAt}){
    const current=window.__RONA_RAIL__&&typeof window.__RONA_RAIL__==='object'?window.__RONA_RAIL__:{};
    const previous=current.state&&typeof current.state==='object'?current.state:{};
    const providerLive=providerResult.state==='LIVE';
    const state={
      ...previous,
      shipments:Array.isArray(shipments)?shipments:[],
      movements:providerLive?providerResult.movements:[],
      source:'AUTHORITATIVE_SERVER_CLIENT_RAIL',
      shipment_source:SHIPMENTS_API,
      provider_gate_source:PROVIDER_GATE_API,
      auto_refresh:true,
      refresh_interval_ms:DATA_REFRESH_MS,
      provider_state:providerResult.state,
      provider:providerResult.provider,
      provider_code:providerResult.code,
      last_sync_at:lastSyncAt,
      source_state:!shipmentsOk?'DEGRADED':providerLive?'LIVE':'WAITING_PROVIDER'
    };
    current.state=state;
    current.refresh=()=>refresh(true);
    window.__RONA_RAIL__=current;
    window.__RONA_CLIENT_RAIL_REFRESH__=current.refresh;
    paintStatus(state.source_state,lastSyncAt);
    window.dispatchEvent(new CustomEvent('rona:rail:update',{detail:state}));
    document.dispatchEvent(new CustomEvent('rona:rail:update',{detail:state}));
  }

  async function refresh(forceProvider=false){
    if(refreshInFlight||document.visibilityState==='hidden')return;
    refreshInFlight=true;
    const startedAt=Date.now();
    try{
      let shipments=[],shipmentsOk=false;
      try{
        const result=await fetchJson(SHIPMENTS_API);
        shipmentsOk=result.ok&&Array.isArray(result.payload?.shipments);
        if(shipmentsOk)shipments=result.payload.shipments;
      }catch(_){ }

      const shouldProbe=forceProvider||!lastProviderProbeAt||Date.now()-lastProviderProbeAt>=PROVIDER_PROBE_MS;
      if(shouldProbe){
        lastProviderProbeAt=Date.now();
        try{
          const result=await fetchJson(PROVIDER_GATE_API);
          if(result.ok){
            lastProviderResult={state:'LIVE',provider:result.payload?.provider||null,code:null,movements:extractMovements(result.payload)};
          }else{
            lastProviderResult={state:result.payload?.code==='RAIL_CLIENT_PUBLICATION_DISABLED'?'DISABLED':'UNAVAILABLE',provider:result.payload?.provider||null,code:result.payload?.code||`HTTP_${result.status}`,movements:[]};
          }
        }catch(_){
          lastProviderResult={state:'UNAVAILABLE',provider:lastProviderResult.provider,code:'REQUEST_FAILED',movements:[]};
        }
      }
      publishState({shipments,shipmentsOk,providerResult:lastProviderResult,lastSyncAt:new Date().toISOString()});
    }finally{
      refreshInFlight=false;
      document.documentElement.dataset.ronaClientRailRefreshMs=String(Date.now()-startedAt);
      scanTiles();
    }
  }

  function resume(){
    if(document.visibilityState==='hidden')return;
    scanTiles();
    refresh(true);
  }

  document.addEventListener('DOMContentLoaded',resume,{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resume()});
  window.addEventListener('pageshow',resume);
  window.addEventListener('focus',resume);
  window.setInterval(scanTiles,5000);
  window.setInterval(()=>refresh(false),DATA_REFRESH_MS);
  scanTiles();
  refresh(true);
})();
