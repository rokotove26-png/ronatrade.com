const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_CLAIMS_TITLE_HOTFIX__)return;
window.__RONA_CLAIMS_TITLE_HOTFIX__='20260823-2230';
function q(s,r){return(r||document).querySelector(s)}
function ensureStyle(){if(q('#ronaClaimsTitleHotfixStyle'))return;var s=document.createElement('style');s.id='ronaClaimsTitleHotfixStyle';s.textContent='#page-claims>.rona-claims-section-title{display:block!important;margin:0 0 16px!important;font-size:28px!important;font-weight:850!important;line-height:1.2!important;color:inherit!important}#page-claims>.rona-claims-section-title.rona-claims-r2-hidden{display:block!important}';document.head.appendChild(s)}
function apply(){var page=q('#page-claims');if(!page)return;ensureStyle();var h=q(':scope > .rona-claims-section-title',page);if(!h){h=document.createElement('h1');h.className='rona-claims-section-title';h.textContent='Претензии';var root=q(':scope > .rona-claims-r2-root',page);if(root)page.insertBefore(h,root);else page.prepend(h)}h.classList.remove('rona-owner-original-hidden')}
function bind(){apply();var nav=q('#nav');if(nav&&!nav.__ronaClaimsTitleBound){nav.__ronaClaimsTitleBound=true;nav.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest&&ev.target.closest('button[data-page="claims"]');if(!b)return;setTimeout(apply,0);setTimeout(apply,100)},true)}}
var tries=0;(function tick(){if(window.__RONA_OWNER_ADMIN_READY__===true){bind();return}tries++;if(tries<1200)setTimeout(tick,100)})();
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-claims-title':'hotfix-v1'}})}
