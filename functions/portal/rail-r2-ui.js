const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_RAIL_R2_FAIL_CLOSED__)return;
window.__RONA_RAIL_R2_FAIL_CLOSED__='20260829-authoritative-only-v1';
window.__RONA_RAIL_CURRENT_FIRST__='AUTHORITATIVE_ONLY';
for(const node of document.querySelectorAll('[data-rail-current-root],.rona-rail-root,.rona-rail-map'))node.remove();
document.documentElement.dataset.ronaRailLegacyR2='disabled-fail-closed';
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-rail-ui':'legacy-r2-disabled-authoritative-only'}})}
