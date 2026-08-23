const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_TITLE_VISUAL_ROLLBACK__)return;
window.__RONA_TITLE_VISUAL_ROLLBACK__='20260823-2325';
function qa(s,r){return Array.from((r||document).querySelectorAll(s))}
function cleanup(){
  qa('#ronaStickySectionTitlesStyle,#ronaStickySectionTitlesStyleV2').forEach(function(n){n.remove()});
  qa('.rona-global-sticky-slot').forEach(function(n){n.remove()});
  qa('.rona-global-sticky-title').forEach(function(n){n.remove()});
  qa('.rona-global-title-duplicate').forEach(function(n){n.classList.remove('rona-global-title-duplicate')});
  qa('.rona-global-title-duplicate-heading').forEach(function(n){n.classList.remove('rona-global-title-duplicate-heading')});
}
cleanup();
setTimeout(cleanup,0);
setTimeout(cleanup,150);
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-title-visual':'rollback-pre-sticky'}})}
