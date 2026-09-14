const SCRIPT=String.raw`(()=>{'use strict';
if(location.pathname!=='/portal/admin')return;
window.__RONA_PRICES_CURRENT_UI__='DISABLED_LEGACY_RESTORED_20260914';
window.__RONA_PRICES_STRUCTURE__='LEGACY_RESTORED';
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-prices-ui':'legacy-restored-disabled-v1','x-rona-prices-visual':'legacy-restored'}})}