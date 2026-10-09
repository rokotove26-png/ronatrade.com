import {CANONICAL_PRICING_BRIDGE_RUNTIME} from './analytics-v2-ui.js';
import {SHARED_ANALYTICS_PRESENTER_V14} from './analytics-canonical-presenter-v14.js';
import {LPG_GAP_RUNTIME} from './lpg-observation-gap-runtime-v13.js';

// The EXACT SAME source strings are mounted by Admin in analytics-v2-ui.js.
// The Client already contains the same approved canonical HTML and base engine.
// One client script only attaches the approved Admin v4.3.2 bridge and presenter.
export async function onRequest(context){
  if(context.request.method!=='GET')return new Response('METHOD_NOT_ALLOWED',{status:405});
  const runtime=CANONICAL_PRICING_BRIDGE_RUNTIME+
    SHARED_ANALYTICS_PRESENTER_V14+LPG_GAP_RUNTIME;
  if(!runtime.includes('ADMIN_APPROVED_SHARED_V14')||
     !runtime.includes('canonical-v4.3.2')||
     !runtime.includes('__RONA_LPG_OBSERVATION_GAPS_V13__'))throw Error('ADMIN_CANONICAL_V14_RUNTIME_NOT_PARITY');
  return new Response(runtime,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache','x-content-type-options':'nosniff',
    'x-rona-analytics-visual':'ADMIN_APPROVED_V432_1TO1',
    'x-rona-analytics-source':'SAME_ADMIN_PRICING_PRESENTER_GAP_RUNTIME'
  }});
}
