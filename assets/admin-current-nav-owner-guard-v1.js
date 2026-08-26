(()=>{'use strict';
if(window.__RONA_ADMIN_CURRENT_NAV_OWNER_GUARD__)return;
window.__RONA_ADMIN_CURRENT_NAV_OWNER_GUARD__='20260826-v1';
const nav=document.getElementById('nav');
if(!nav)return;
let lastExplicit='';
function reassert(page){
  page=String(page||'');
  if(!page)return;
  try{window.__RONA_ADMIN_NAVIGATE__?.(page)}catch(_){ }
}
/* The inline current-only router is registered before this guard. It receives
   the click first. This guard then prevents all later/legacy visual runtimes
   from interpreting the same navigation click and becoming a second owner. */
nav.addEventListener('click',event=>{
  const button=event.target?.closest?.('button[data-page]');
  if(!button||!nav.contains(button))return;
  lastExplicit=String(button.dataset.page||'');
  event.stopImmediatePropagation();
  event.stopPropagation();
  queueMicrotask(()=>reassert(lastExplicit));
  setTimeout(()=>reassert(lastExplicit),50);
  setTimeout(()=>reassert(lastExplicit),250);
},true);
window.addEventListener('rona:admin-pagechange',event=>{
  const page=String(event?.detail?.page||'');
  const source=String(event?.detail?.source||'');
  if(source==='user'||source==='api')lastExplicit=page;
});
const observer=new MutationObserver(()=>{
  if(!lastExplicit)return;
  const current=String(document.documentElement.dataset.ronaAdminPage||'');
  if(current!==lastExplicit)queueMicrotask(()=>reassert(lastExplicit));
});
observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-current','data-page']});
const main=document.getElementById('current-admin-main');
if(main)observer.observe(main,{subtree:true,attributes:true,attributeFilter:['class','id']});
window.__RONA_ADMIN_CURRENT_NAV_OWNER_OBSERVER__=observer;
})();