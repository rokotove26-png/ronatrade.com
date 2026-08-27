const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_ANALYTICS_APPROVED_V455__==='retired-compat-guard-v3')return;
window.__RONA_ANALYTICS_APPROVED_V455__='retired-compat-guard-v3';
function scrub(){
 const page=document.getElementById('page-analytics');
 if(!page)return;
 page.querySelectorAll('.rona-analytics-canonical-title,.rona-global-title-duplicate,.rona-global-title-duplicate-heading').forEach(n=>n.remove());
 Array.from(page.children).forEach(n=>{if(n.id!=='rona-analytics-v2'&&n.classList?.contains('rona-global-sticky-title'))n.remove()});
}
function loadCanonicalAccess(){
 if(document.querySelector('script[data-rona-canonical-access-v441]')||window.__RONA_CANONICAL_CREATE_ACCESS_V441__)return;
 const s=document.createElement('script');s.src='/portal/admin-canonical-create-access-v441-ui?v=20260828-canonical-v441';s.async=false;s.dataset.ronaCanonicalAccessV441='true';document.head.appendChild(s);
}
function loadPasswordHotfix(){
 if(document.querySelector('script[data-rona-access-password-hotfix]')||window.__RONA_CANONICAL_CREATE_ACCESS_V441_PASSWORD_HOTFIX__)return;
 const s=document.createElement('script');s.src='/portal/admin-canonical-create-access-v441-password-hotfix-ui?v=20260828-password-hotfix';s.async=false;s.dataset.ronaAccessPasswordHotfix='true';document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{scrub();loadCanonicalAccess();setTimeout(loadPasswordHotfix,100)},{once:true});else{scrub();loadCanonicalAccess();setTimeout(loadPasswordHotfix,100)}
window.addEventListener('rona:admin-pagechange',e=>{const page=String(e?.detail?.page||'');if(page==='analytics')queueMicrotask(scrub);if(page==='access'){loadCanonicalAccess();setTimeout(loadPasswordHotfix,100)}});
setTimeout(scrub,400);setTimeout(scrub,1600);setTimeout(loadCanonicalAccess,80);setTimeout(loadPasswordHotfix,180);
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-analytics-approved':'retired-compat-guard-v3','x-rona-access-canonical-loader':'v4.4.1','x-rona-access-password-hotfix':'admin-entered-v1'}})}