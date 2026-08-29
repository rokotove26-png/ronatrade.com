export const CANONICAL_LIVE_HYDRATION_RUNTIME=String.raw`
;(()=>{
  if(window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__==='v1')return;
  window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__='v1';
  let inFlight=null,lastApplied='';
  const API='/portal/api/v1/admin/analytics';
  function valid(payload){
    if(!payload||payload.version!=='RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1'||!payload.products)return false;
    return ['AI92','AI95','DT','LPG'].every(k=>Array.isArray(payload.products?.[k]?.dates)&&Array.isArray(payload.products?.[k]?.values));
  }
  function signature(payload){
    return [payload.cutoff,payload.latestTradeDate,...['AI92','AI95','DT','LPG'].map(k=>{
      const p=payload.products[k]||{};return String(p.values?.[p.values.length-1]??'');
    })].join('|');
  }
  async function hydrate(){
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      try{
        const response=await fetch(API,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
        if(!response.ok)return false;
        const body=await response.json().catch(()=>null);
        const payload=body?.data?.canonicalAnalytics;
        if(!valid(payload))return false;
        const sig=signature(payload);
        if(sig===lastApplied)return true;
        const view=window.RONA_ANALYTICS_VIEW;
        if(!view||typeof view.setPayload!=='function')return false;
        const applied=view.setPayload(payload);
        if(applied===false)return false;
        lastApplied=sig;
        document.documentElement.dataset.ronaAnalyticsData='canonical-daily-live';
        document.documentElement.dataset.ronaAnalyticsAsOf=String(payload.latestTradeDate||payload.cutoff||'');
        try{window.dispatchEvent(new CustomEvent('rona:analytics-live-applied',{detail:{version:payload.version,cutoff:payload.cutoff,latestTradeDate:payload.latestTradeDate}}))}catch(_){ }
        return true;
      }catch(_){return false}
      finally{inFlight=null}
    })();
    return inFlight;
  }
  function boot(){hydrate()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);
  window.addEventListener('focus',hydrate,{passive:true});
  window.addEventListener('rona:admin-pagechange',hydrate);
  setInterval(hydrate,300000);
})();
`;
