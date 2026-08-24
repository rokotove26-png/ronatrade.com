const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD__)return;
window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD__='20260824-1948';
window.__RONA_ACCESS_CANONICAL_V4__=true;
window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD_READY__=true;
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-clients-agents-guard':'v5-explicit-owner-flag'}})}
