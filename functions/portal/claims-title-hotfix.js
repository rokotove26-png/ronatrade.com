const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_CLAIMS_TITLE_HOTFIX_V2__)return;
window.__RONA_CLAIMS_TITLE_HOTFIX_V2__='20260823-2245';
function q(s,r){return(r||document).querySelector(s)}
function ensureStyle(){if(q('#ronaClaimsTitleHotfixStyleV2'))return;var s=document.createElement('style');s.id='ronaClaimsTitleHotfixStyleV2';s.textContent='#page-claims .rona-claims-r2-root>.rona-claims-title-hero{display:block!important;margin:0 0 16px!important}#page-claims .rona-claims-title-hero .rona-visual-title{display:block!important;color:inherit!important}';document.head.appendChild(s)}
function apply(){var page=q('#page-claims');if(!page)return;var root=q(':scope > .rona-claims-r2-root',page);if(!root)return;ensureStyle();var hero=q(':scope > .rona-claims-title-hero',root);if(hero)return;hero=document.createElement('div');hero.className='rona-visual-hero rona-claims-title-hero';var title=document.createElement('div');title.className='rona-visual-title';title.textContent='Претензии';hero.appendChild(title);root.prepend(hero)}
function schedule(){setTimeout(apply,0);setTimeout(apply,120)}
function bind(){schedule();if(!document.__ronaClaimsTitleEventsBound){document.__ronaClaimsTitleEventsBound=true;document.addEventListener('click',function(ev){var t=ev.target;if(!t||!t.closest)return;if(t.closest('#nav button[data-page="claims"]')||t.closest('#page-claims'))schedule()},true);document.addEventListener('change',function(ev){var t=ev.target;if(t&&t.closest&&t.closest('#page-claims'))schedule()},true);document.addEventListener('input',function(ev){var t=ev.target;if(t&&t.closest&&t.closest('#page-claims'))schedule()},true)}}
var tries=0;(function tick(){if(window.__RONA_OWNER_ADMIN_READY__===true){bind();return}tries++;if(tries<1200)setTimeout(tick,100)})();
setInterval(function(){var p=q('#page-claims');if(p&&p.classList.contains('active'))apply()},2000);
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-claims-title':'hotfix-v2'}})}
