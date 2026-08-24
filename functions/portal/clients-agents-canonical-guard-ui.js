const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD__)return;
window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD__='20260824-1918';
window.__RONA_ACCESS_CANONICAL_V4__=true;
const ZW='\u200b';
function mark(){const b=document.querySelector('#nav button[data-page="access"]');if(!b)return false;const walker=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let node=null,last=null;while((node=walker.nextNode())){if(String(node.nodeValue||'').trim())last=node}if(!last)return false;if(!String(last.nodeValue||'').endsWith(ZW))last.nodeValue=String(last.nodeValue||'')+ZW;b.dataset.ronaCanonicalAccess='v4';return true}
function keep(){mark();requestAnimationFrame(mark);setTimeout(mark,80);setTimeout(mark,300)}
document.addEventListener('click',ev=>{const b=ev.target&&ev.target.closest&&ev.target.closest('#nav button[data-page="access"]');if(b)mark()},true);
new MutationObserver(()=>mark()).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
keep();
window.__RONA_CLIENTS_AGENTS_CANONICAL_GUARD_READY__=true;
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-clients-agents-guard':'v4-pre-r2'}})}
