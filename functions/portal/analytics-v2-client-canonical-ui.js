import {
  onRequest as approvedAdminAnalytics,
  CANONICAL_PRICING_BRIDGE_RUNTIME
} from './analytics-v2-ui.js';
import { CANONICAL_LIVE_HYDRATION_RUNTIME } from './analytics-canonical-live-hydration.js';

// The renderer is the EXACT same approved Admin v4.3.2 source artifact.
// Only its data transport changes. Client data remains role/contract scoped
// at the server endpoint; the internal Admin pricing bridge is not delivered.
const MARK='20261010-client-approved-admin-single-engine-v14';
function changeOne(s,a,b,label){
  if(s.split(a).length!==2)throw Error('APPROVED_RENDERER_CONTRACT_MISMATCH:'+label);
  return s.replace(a,b);
}
export function clientHydrationRuntime(){
  let code=CANONICAL_LIVE_HYDRATION_RUNTIME;
  if(code.split('source-safe-v4-observation-daily').length!==3)
    throw Error('CANONICAL_LIVE_GUARD_CHANGED');
  code=code.replaceAll('source-safe-v4-observation-daily','source-safe-v5-client-admin-engine');
  code=changeOne(code,
    "const API='/portal/api/v1/admin/analytics';",
    "const API='/portal/api/v1/client/market-intelligence';",
    'ROLE_SCOPED_API');
  code=changeOne(code,
    'const payload=body?.data?.canonicalAnalytics;',
    'const payload=body?.data?.clientCanonicalAnalytics;',
    'CLIENT_PROJECTION');
  code=changeOne(code,
    "window.addEventListener('rona:admin-pagechange',hydrate);",
    "document.addEventListener('rona:client:context-changed',()=>{lastApplied='';lastSource=null;indicateUnavailable('CLIENT_CONTEXT_CHANGED');hydrate()});",
    'CONTEXT_BOUND_DATA');
  code=changeOne(code,
    'setInterval(hydrate,300000);',
    "window.addEventListener('rona:client-market-intelligence-invalidated',hydrate,{passive:true});\n  document.addEventListener('click',event=>{if(event.target?.closest?.('[data-page=\\\"analytics\\\"],[data-page-id=\\\"analytics\\\"],[data-page-panel=\\\"analytics\\\"]'))requestAnimationFrame(hydrate)},true);",
    'SOURCE_REFRESH');
  code=changeOne(code,
    'lastApplied=sig;lastSource=payload;',
    "lastApplied=sig;lastSource=payload;\n        document.querySelector('#page-analytics #rona-analytics-v2')?.setAttribute('data-rona-client-source-safe','1');",
    'CLIENT_SAFE_PREPAINT');
  code=changeOne(code,
    "if(!root)return;\n    const stage=root.querySelector('[data-chart-stage]');",
    "if(!root)return;\n    root.dataset.ronaClientSourceSafe='0';\n    const stage=root.querySelector('[data-chart-stage]');",
    'FAIL_CLOSED_ON_ERROR');
  code=changeOne(code,
    "'canonical-daily-live-v3'",
    "'canonical-daily-client-authorized-v14'",
    'LIVE_STATUS');
  return code;
}
export async function onRequest(context){
  const response=await approvedAdminAnalytics(context);
  const approvedSource=await response.text();
  if(response.status!==200)return new Response('',{status:502});
  if(!approvedSource.includes(CANONICAL_PRICING_BRIDGE_RUNTIME)||
     !approvedSource.includes(CANONICAL_LIVE_HYDRATION_RUNTIME))
    return new Response('ADMIN_CANONICAL_SOURCE_NOT_MATCHED',{status:503});
  const clientSource=approvedSource
    .replace(CANONICAL_PRICING_BRIDGE_RUNTIME,'')
    .replace(CANONICAL_LIVE_HYDRATION_RUNTIME,clientHydrationRuntime());
  if(!clientSource.includes("RONA TRADE · ANALYTICS")||
     !clientSource.includes("source-safe-v5-client-admin-engine")||
     !clientSource.includes('/portal/api/v1/client/market-intelligence')||
     clientSource.includes("const API='/portal/api/v1/admin/analytics';"))
    return new Response('CLIENT_ADMIN_RENDERER_ISOLATION_FAILED',{status:503});
  const headers=new Headers(response.headers);
  headers.delete('content-length');headers.delete('etag');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-analytics-engine','admin-approved-v4.3.2-exact');
  headers.set('x-rona-analytics-projection','CLIENT_EFFECTIVE_CONTRACT');
  headers.set('x-rona-analytics-client-adapter',MARK);
  return new Response(clientSource,{status:200,headers});
}
