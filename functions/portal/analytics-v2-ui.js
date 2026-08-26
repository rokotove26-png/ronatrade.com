import { onRequest as approvedV3 } from './analytics-v2-approved-base.js';

const OWNER_LOCK=String.raw`
;(()=>{'use strict';
if(window.__RONA_ANALYTICS_APPROVED_OWNER_LOCK__)return;
window.__RONA_ANALYTICS_APPROVED_OWNER_LOCK__='20260826-approved-v3-owner-lock-v1';
let queued=false;
const page=()=>document.getElementById('page-analytics');
function enforce(){
  queued=false;
  const p=page();if(!p)return false;
  const root=p.querySelector(':scope > #rona-analytics-v2');if(!root)return false;
  if(root.style.getPropertyValue('display')!=='grid'||root.style.getPropertyPriority('display')!=='important')root.style.setProperty('display','grid','important');
  if(root.style.getPropertyValue('visibility')!=='visible'||root.style.getPropertyPriority('visibility')!=='important')root.style.setProperty('visibility','visible','important');
  if(root.style.getPropertyValue('opacity')!=='1'||root.style.getPropertyPriority('opacity')!=='important')root.style.setProperty('opacity','1','important');
  if(root.hasAttribute('aria-hidden'))root.removeAttribute('aria-hidden');
  for(const node of Array.from(p.children)){
    if(node===root)continue;
    if(node.style.getPropertyValue('display')!=='none'||node.style.getPropertyPriority('display')!=='important')node.style.setProperty('display','none','important');
    if(node.getAttribute('aria-hidden')!=='true')node.setAttribute('aria-hidden','true');
  }
  p.classList.remove('rona-rs-gated');
  const loading=p.querySelector(':scope > .rona-rs-loading');if(loading)loading.remove();
  document.documentElement.dataset.ronaAnalyticsOwner='approved-v3-single-owner';
  window.__RONA_ANALYTICS_V2_READY__=true;
  return true;
}
function schedule(){
  if(queued)return;queued=true;
  queueMicrotask(()=>{enforce();setTimeout(enforce,70);setTimeout(enforce,260)});
}
function install(){
  const p=page();if(!p){setTimeout(install,60);return}
  if(!p.__ronaApprovedAnalyticsOwnerLock){
    p.__ronaApprovedAnalyticsOwnerLock=true;
    new MutationObserver(schedule).observe(p,{childList:true,subtree:true,attributes:true,attributeFilter:['style','aria-hidden','class']});
  }
  schedule();
}
window.addEventListener('rona:admin-pagechange',ev=>{
  if(String(ev?.detail?.page||'')!=='analytics')return;
  schedule();setTimeout(enforce,120);setTimeout(enforce,700);
});
document.addEventListener('click',ev=>{
  const b=ev.target?.closest?.('#nav button[data-page="analytics"]');if(!b)return;
  setTimeout(enforce,0);setTimeout(enforce,180);setTimeout(enforce,900);
});
install();
})();`;

export async function onRequest(context){
  const response=await approvedV3(context);
  const source=(await response.text())+'\n'+OWNER_LOCK;
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-analytics-ui','approved-v3-single-owner');
  headers.set('x-rona-analytics-owner-lock','20260826-v1');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
