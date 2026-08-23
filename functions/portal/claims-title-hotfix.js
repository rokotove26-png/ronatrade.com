const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_CLAIMS_TITLE_HOTFIX_V3__)return;
window.__RONA_CLAIMS_TITLE_HOTFIX_V3__='20260823-2330';
function q(s,r){return(r||document).querySelector(s)}
function ensureStyle(){if(q('#ronaClaimsTitleHotfixStyleV3'))return;var s=document.createElement('style');s.id='ronaClaimsTitleHotfixStyleV3';s.textContent='#page-claims>.rona-claims-section-title{display:block!important;visibility:visible!important;opacity:1!important;margin:0 0 16px!important;width:100%!important;box-sizing:border-box!important}#page-claims>.rona-claims-section-title.rona-claims-r2-hidden,#page-claims>.rona-claims-section-title.rona-owner-original-hidden,#page-claims>.rona-claims-section-title.rona-owner-hide{display:block!important;visibility:visible!important;opacity:1!important}#page-claims>.rona-claims-section-title .rona-visual-title{display:block!important;color:inherit!important}';document.head.appendChild(s)}
function apply(){var page=q('#page-claims');if(!page)return;ensureStyle();var hero=q(':scope > .rona-claims-section-title',page);if(!hero){hero=document.createElement('div');hero.className='rona-visual-hero rona-claims-section-title';var title=document.createElement('div');title.className='rona-visual-title';title.textContent='Претензии';hero.appendChild(title);var root=q(':scope > .rona-claims-r2-root',page);if(root)page.insertBefore(hero,root);else page.prepend(hero)}hero.classList.remove('rona-claims-r2-hidden','rona-owner-original-hidden','rona-owner-hide')}
function schedule(){setTimeout(apply,0);setTimeout(apply,100);setTimeout(apply,500)}
function bind(){schedule();if(document.__ronaClaimsTitleEventsBoundV3)return;document.__ronaClaimsTitleEventsBoundV3=true;document.addEventListener('click',function(ev){var t=ev.target;if(t&&t.closest&&t.closest('#nav button[data-page="claims"]'))schedule()},true);window.addEventListener('rona:finance-sync',schedule)}
var tries=0;(function tick(){if(window.__RONA_OWNER_ADMIN_READY__===true){bind();return}tries++;if(tries<1200)setTimeout(tick,100)})();
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-claims-title':'hotfix-v3-persistent'}})}
