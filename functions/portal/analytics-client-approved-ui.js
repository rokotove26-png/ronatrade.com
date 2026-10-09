// Client mounts the exact frozen Admin visual/interaction engine.
// Admin bootstrap, privileged prices and Admin RPC are never exposed.
import {onRequest as approvedAnalytics} from './analytics-v2-approved-base.js';
import {CANONICAL_LIVE_HYDRATION_RUNTIME} from './analytics-canonical-live-hydration.js';
const SHARED_MARK='ADMIN_CANONICAL_RENDERER_CLIENT_ADAPTER_V14';

function clientPresenterFromApprovedAdmin(){
  const original=CANONICAL_LIVE_HYDRATION_RUNTIME;
  const bootstrap='  function boot(){hydrate()}';
  const start=original.indexOf(bootstrap);
  if(start<0||original.indexOf(bootstrap,start+1)>=0||
     !original.includes('  function availablePayload(payload){')||
     !original.includes('  function decorate(payload){')||
     !original.includes('  function hasSeries(p,key){')||
     !original.includes('  function indicateUnavailable(reason){')){
    throw new Error('APPROVED_ADMIN_ANALYTICS_DECORATOR_CONTRACT_CHANGED');
  }
  let shared=original.slice(0,start);
  shared=shared.replaceAll('window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__',
    'window.__RONA_ANALYTICS_CLIENT_SHARED_APPROVED_V14__');
  shared=shared.replaceAll('source-safe-v4-observation-daily',
    'source-safe-admin-decorator-client-v14');
  shared=shared.replace("const API='/portal/api/v1/admin/analytics';",
    "const API='/portal/api/v1/client/market-intelligence';");
  const presenter=String.raw`
  let lastClientPayload=null;
  function applyClient(payload,redraw=true){
    if(!valid(payload)){indicateUnavailable('CLIENT_INVALID_PUBLISHED_CANONICAL');return false;}
    const clientSeries=availablePayload(payload);
    if(!clientSeries){indicateUnavailable('CLIENT_NO_VERIFIED_PUBLISHED_SERIES');return false;}
    const native=window.RONA_ANALYTICS_VIEW;
    if(!native||typeof native.setPayload!=='function'){
      indicateUnavailable('ADMIN_APPROVED_VISUAL_NOT_MOUNTED');return false;
    }
    if(redraw){
      const result=native.setPayload(clientSeries);
      if(result===false){indicateUnavailable('CLIENT_CANONICAL_RENDER_REJECTED');return false;}
    }
    lastClientPayload=payload;
    decorate(payload);
    const root=document.querySelector('#page-analytics #rona-analytics-v2');
    if(root){
      root.dataset.ronaRendererAuthority='APPROVED_ADMIN_V432_EXACT';
      root.dataset.ronaClientRendererAdapter='SOURCE_SCOPED_V14';
    }
    return true;
  }
  window.RONA_ANALYTICS_APPROVED_SHARED={
    version:'ADMIN_CANONICAL_RENDERER_CLIENT_ADAPTER_V14',
    apply:applyClient,
    decorate:()=>lastClientPayload?applyClient(lastClientPayload,false):false,
    unavailable:reason=>indicateUnavailable(reason||'CLIENT_SOURCE_UNAVAILABLE')
  };
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#page-analytics #rona-analytics-v2 [data-an2-product],#page-analytics #rona-analytics-v2 [data-product]')){
      setTimeout(()=>{if(lastClientPayload)applyClient(lastClientPayload,false)},0);
    }
  },true);
})();`;
  return shared+presenter;
}

export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('Method Not Allowed',{status:405});
  const response=await approvedAnalytics(context);
  if(!response.ok)return response;
  const frozenAdminCore=await response.text();
  for(const token of ['RONA TRADE · ANALYTICS','RONA_ANALYTICS_VIEW','approved-v431','an2-controls']){
    if(!frozenAdminCore.includes(token))throw new Error('APPROVED_ADMIN_SOURCE_CHANGED:'+token);
  }
  const script=frozenAdminCore+'\n'+clientPresenterFromApprovedAdmin()+'\n/* '+SHARED_MARK+' */\n';
  return new Response(script,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'x-content-type-options':'nosniff',
    'x-rona-analytics-parity':SHARED_MARK,
    'x-rona-analytics-visual-source':'approved-v4.3.1-single-owner',
    'x-rona-analytics-data-source':'effective-client-published-only'
  }});
}
