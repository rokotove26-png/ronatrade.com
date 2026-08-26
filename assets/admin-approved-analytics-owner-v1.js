(()=>{'use strict';
if(window.__RONA_APPROVED_ANALYTICS_OWNER_GUARD__)return;
window.__RONA_APPROVED_ANALYTICS_OWNER_GUARD__='20260826-v1';
const page=()=>document.getElementById('page-analytics');
let loading=null,scheduled=false;
function enforce(){
  scheduled=false;
  const p=page();if(!p)return false;
  const approved=p.querySelector('#rona-analytics-v2');if(!approved)return false;
  if(approved.hidden)approved.hidden=false;
  if(approved.style.display==='none')approved.style.removeProperty('display');
  if(approved.style.visibility==='hidden')approved.style.removeProperty('visibility');
  approved.removeAttribute('aria-hidden');
  approved.dataset.ronaAnalyticsOwner='approved-v2';
  const competing=p.querySelector(':scope > .rona-rs-root[data-kind="analytics"]');
  if(competing&&competing.style.display!=='none')competing.style.display='none';
  const loadingNode=p.querySelector(':scope > .rona-rs-loading');
  if(loadingNode&&loadingNode.style.display!=='none')loadingNode.style.display='none';
  window.__RONA_APPROVED_ANALYTICS_VISIBLE__=true;
  return true;
}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(enforce)}
function ensureLoaded(){
  if(window.__RONA_ANALYTICS_V2_READY__===true){schedule();return Promise.resolve(true)}
  if(loading)return loading;
  loading=new Promise(resolve=>{
    let s=document.getElementById('rona-analytics-approved-owner');
    if(s)s.remove();
    s=document.createElement('script');s.id='rona-analytics-approved-owner';s.src='/portal/analytics-v2-ui?v=20260826-approved-owner-v1';s.async=false;
    s.onload=()=>{window.__RONA_APPROVED_ANALYTICS_LOAD_ERROR__=null;schedule();resolve(true)};
    s.onerror=()=>{window.__RONA_APPROVED_ANALYTICS_LOAD_ERROR__='SCRIPT_LOAD_FAILED';s.remove();resolve(false)};
    document.body.append(s);
  }).finally(()=>{loading=null});
  return loading;
}
function activate(){void ensureLoaded();[0,100,350,900,1800].forEach(ms=>setTimeout(()=>{schedule();if(!window.__RONA_ANALYTICS_V2_READY__)void ensureLoaded()},ms))}
function watch(){
  const p=page();if(!p)return;
  const observer=new MutationObserver(()=>{if(document.documentElement.dataset.ronaAdminPage==='analytics')schedule()});
  observer.observe(p,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden','aria-hidden']});
  window.__RONA_APPROVED_ANALYTICS_OBSERVER__=observer;
}
document.addEventListener('click',event=>{const b=event.target?.closest?.('#nav button[data-page="analytics"]');if(b)activate()},true);
window.addEventListener('rona:admin-pagechange',event=>{if(String(event?.detail?.page||'')==='analytics')activate()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{watch();activate()},{once:true});else{watch();activate()}
})();