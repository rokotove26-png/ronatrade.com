const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_ANALYTICS_APPROVED_V455__==='retired-compat-guard-v5')return;
window.__RONA_ANALYTICS_APPROVED_V455__='retired-compat-guard-v5';
function scrub(){
 const page=document.getElementById('page-analytics');
 if(!page)return;
 page.querySelectorAll('.rona-analytics-canonical-title,.rona-global-title-duplicate,.rona-global-title-duplicate-heading').forEach(n=>n.remove());
 Array.from(page.children).forEach(n=>{if(n.id!=='rona-analytics-v2'&&n.classList?.contains('rona-global-sticky-title'))n.remove()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scrub,{once:true});else scrub();
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='analytics')queueMicrotask(scrub)});
setTimeout(scrub,400);setTimeout(scrub,1600);
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-analytics-approved':'retired-compat-guard-v5','x-rona-access-loader':'none','x-rona-shell-mutation':'analytics-title-scrub-only'}})}