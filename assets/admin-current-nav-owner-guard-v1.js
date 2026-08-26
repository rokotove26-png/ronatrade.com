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
/* The current-only router exposes one authoritative navigation API before any
   optional visual runtime is loaded. Capture the user's nav click at document
   level, invoke that API directly and stop the event before later document/body
   handlers can reinterpret the same click. */
document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#nav button[data-page]');
  if(!button||!nav.contains(button))return;
  const page=String(button.dataset.page||'');
  if(!page)return;
  lastExplicit=page;
  event.preventDefault();
  event.stopImmediatePropagation();
  event.stopPropagation();
  reassert(page);
  queueMicrotask(()=>reassert(page));
  setTimeout(()=>reassert(page),50);
  setTimeout(()=>reassert(page),250);
},true);
window.addEventListener('rona:admin-pagechange',event=>{
  const page=String(event?.detail?.page||'');
  const source=String(event?.detail?.source||'');
  if((source==='user'||source==='api')&&page)lastExplicit=page;
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