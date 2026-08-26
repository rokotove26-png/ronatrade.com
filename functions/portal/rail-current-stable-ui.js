import { onRequest as realMapRail } from './rail-current-v7-real-map-ui.js';
import { onRequest as stableRail } from './rail-current-v4-ui.js';

function withHeaders(response, mode){
  const h=new Headers(response.headers);
  h.set('cache-control','no-store, no-cache, must-revalidate');
  h.set('pragma','no-cache');
  h.set('expires','0');
  h.set('x-content-type-options','nosniff');
  h.set('x-rona-rail-stable-owner','real-map-first-fallback-v1');
  h.set('x-rona-rail-render-mode',mode);
  h.delete('content-length');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}

export async function onRequest(context){
  try{
    const current=await realMapRail(context);
    if(current?.status===200)return withHeaders(current,'REAL_MAP_V7');
  }catch(_){ }
  try{
    const fallback=await stableRail(context);
    return withHeaders(fallback,'STABLE_V4_FALLBACK');
  }catch(e){
    return new Response(`RAIL_CURRENT_STABLE_FAILED:${String(e?.message||e)}`,{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-rona-rail-stable-owner':'failed'}});
  }
}
