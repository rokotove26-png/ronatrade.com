import { onRequest as approvedBase } from './analytics-v2-approved-base.js';
import { canonicalizeV432 } from './analytics-v2-ui.js';

// Both portals now execute the exact same frozen approved Admin analytics renderer.
// The Client endpoint deliberately omits Admin API hydration and internal price bridge.
const CLIENT_BOOTSTRAP=String.raw`
;(()=>{
  if(location.pathname!=='/portal/client')return;
  if(window.__RONA_CLIENT_EXACT_ADMIN_ANALYTICS_RENDERER_V14__)return;
  const page=document.getElementById('page-analytics');
  if(!page)throw Error('CLIENT_ANALYTICS_PAGE_NOT_FOUND');
  const old=page.querySelector(':scope > #rona-analytics-v2');
  if(!old)throw Error('CLIENT_ANALYTICS_PREVIOUS_ROOT_NOT_FOUND');
  old.remove();
  delete window.RONA_ANALYTICS_VIEW;
  window.__RONA_CLIENT_EXACT_ADMIN_ANALYTICS_RENDERER_V14__='approved-admin-v4.3.2-base';
})();
`;

export async function onRequest(context){
  const base=await approvedBase(context);
  const body=await base.text();
  const shared=canonicalizeV432(body,{adminRuntime:false});
  // No admin bootstrap, pricing bridge, or private margin is appended to Client.
  const response=CLIENT_BOOTSTRAP+'\n'+shared+'\n/* RONA_CLIENT_EXACT_ADMIN_RENDERER_V14 */\n';
  const headers=new Headers(base.headers);
  headers.delete('content-length');headers.delete('etag');
  headers.set('content-type','application/javascript; charset=utf-8');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-analytics-visual-source','admin-v432-approved-base-exact');
  headers.set('x-rona-analytics-authority','client-effective-only');
  return new Response(response,{status:base.status,headers});
}
