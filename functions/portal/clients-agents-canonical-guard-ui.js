const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD__)return;
window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD__='20260824-1958';
window.__RONA_ACCESS_CANONICAL_V4__=true;
window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD_READY__=true;
function releaseStaleAuthenticatedBootLock(){
  const body=document.body,root=document.documentElement;
  if(!body||!body.classList.contains('admin-auth-locked'))return false;
  const authenticated=window.RONA_ADMIN_AUTH_CONTEXT?.authenticatedByServer===true;
  const runtime=window.__RONA_MAIN_UI_RUNTIME_LOADED__===true||window.__RONA_MAIN_UI_ENTRY__===true;
  const shell=!!document.querySelector('.app')&&!!document.querySelector('#nav');
  if(!authenticated||!runtime||!shell)return false;
  body.classList.remove('admin-auth-locked');
  root.classList.add('rona-owner-paint-ready');
  root.dataset.ronaAdminBootFailsoft='released';
  window.__RONA_ADMIN_BOOT_FAILSOFT__={released:true,reason:'STALE_AUTHENTICATED_UI_LOCK',at:new Date().toISOString()};
  return true;
}
function armFailsoft(){setTimeout(releaseStaleAuthenticatedBootLock,10500);setTimeout(releaseStaleAuthenticatedBootLock,14000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',armFailsoft,{once:true});else armFailsoft();
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-clients-agents-guard':'v5-explicit-owner-flag-failsoft'}})}
