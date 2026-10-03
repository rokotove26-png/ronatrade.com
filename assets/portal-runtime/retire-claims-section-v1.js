(()=>{'use strict';
if(window.__RONA_CLAIMS_SECTION_RETIRED_V1__)return;
window.__RONA_CLAIMS_SECTION_RETIRED_V1__='20261003-owner-simplification-v1';

const selectors=[
  '[data-page="claims"]',
  '[data-section="claims"]',
  '[data-route="claims"]',
  '[data-view="claims"]',
  '#page-claims',
  '#claims-page',
  '#client-claims',
  'a[href="#claims"]',
  'a[href$="/claims"]',
  'a[href*="page=claims"]',
  '[data-action*="claim"]'
];

let queued=false;
function isActive(node){
  return !!(node&&(
    node.classList?.contains('active')||
    node.getAttribute?.('aria-current')==='page'||
    node.getAttribute?.('aria-selected')==='true'
  ));
}
function clearStoredClaimsRoute(){
  try{
    for(let i=sessionStorage.length-1;i>=0;i--){
      const key=sessionStorage.key(i);
      if(!key)continue;
      const value=String(sessionStorage.getItem(key)||'').trim().toLowerCase();
      if(value==='claims'||value==='#claims'||value.endsWith('/claims'))sessionStorage.removeItem(key);
    }
  }catch(_e){}
}
function prune(){
  queued=false;
  let activeRemoved=false;
  for(const selector of selectors){
    document.querySelectorAll(selector).forEach(node=>{
      if(isActive(node))activeRemoved=true;
      node.remove();
    });
  }
  document.querySelectorAll('nav a,nav button,.sidebar a,.sidebar button,[role="navigation"] a,[role="navigation"] button').forEach(node=>{
    const label=String(node.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(label==='претензии'||label==='claims'){
      if(isActive(node))activeRemoved=true;
      node.remove();
    }
  });
  document.querySelectorAll('h1,h2,h3,h4,.section-title,.card-title').forEach(title=>{
    const label=String(title.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(label!=='претензии'&&label!=='claims')return;
    const container=title.closest('section,.page,.card,.panel,[data-section],[data-card],[data-view]');
    if(container&&container!==document.body&&container!==document.documentElement){
      if(isActive(container))activeRemoved=true;
      container.remove();
    }
  });
  clearStoredClaimsRoute();
  document.documentElement.dataset.ronaClaimsSection='retired-v1';
  window.__RONA_CLAIMS_SECTION_RETIRED_STATE__={retired:true,checkedAt:new Date().toISOString()};
  if(activeRemoved){
    const home=document.querySelector('[data-page="home"],a[href="#home"],a[href*="page=home"]');
    if(home&&typeof home.click==='function')setTimeout(()=>home.click(),0);
  }
}
function schedule(){if(queued)return;queued=true;queueMicrotask(prune)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prune,{once:true});else prune();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('pageshow',schedule,{passive:true});
})();