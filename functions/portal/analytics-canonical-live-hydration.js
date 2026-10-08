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
    return JSON.stringify({
      cutoff: payload.cutoff,
      latestTradeDate: payload.latestTradeDate,
      products: ['AI92','AI95','DT','LPG'].map(key=>{
        const product=payload.products[key]||{};
        return [key,product.dates,product.values,product.forecast,product.rona];
      })
    });
  }
  function availablePayload(payload){
    const products={};
    for(const key of ['AI92','AI95','DT','LPG']){
      const product=payload.products?.[key];
      if(!product||!Array.isArray(product.dates)||!Array.isArray(product.values)||product.dates.length!==product.values.length||product.dates.length===0)continue;
      products[key]=product;
    }
    if(!Object.keys(products).length)return null;
    return {...payload,products};
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
        const livePayload=availablePayload(payload);
        if(!livePayload)return false;
        const applied=view.setPayload(livePayload);
        if(applied===false)return false;
        lastApplied=sig;
        document.documentElement.dataset.ronaAnalyticsData='canonical-daily-live';
        document.documentElement.dataset.ronaAnalyticsAsOf=String(payload.latestTradeDate||payload.cutoff||'');
        try{window.dispatchEvent(new CustomEvent('rona:analytics-live-applied',{detail:{version:payload.version,cutoff:payload.cutoff,latestTradeDate:payload.latestTradeDate,availableProducts:Object.keys(livePayload.products)}}))}catch(_){ }
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
