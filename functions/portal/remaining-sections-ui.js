import { onRequest as baseRemaining } from './remaining-sections-r2-base.js';

export async function onRequest(context){
  const response=await baseRemaining(context);
  let source=await response.text();

  // Analytics and Market News are owned by dedicated current-only modules.
  // remaining-sections must not render, gate, refresh, or mutate either page.
  source=source.replaceAll("'аналитика':'analytics',",'');
  source=source.replaceAll("'новости топливного рынка снг':'news',",'');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"analytics\\"]','');
  source=source.replaceAll(',.rona-rs-root[data-kind=\\"news\\"]','');

  const start=source.indexOf('function publicationCard(){');
  const end=source.indexOf('function renderAgents(){',start);
  if(start<0||end<=start){
    return new Response('REMAINING_CANONICAL_SPLIT_SOURCE_MISMATCH',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  source=source.slice(0,start)+source.slice(end);

  source=source.replaceAll("if(kind==='analytics')return renderAnalytics();",'');
  source=source.replaceAll("if(kind==='news')return renderNews();",'');
  source=source.replaceAll("if(kind==='analytics'||kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');
  source=source.replaceAll("if(kind==='news'){refreshMarket(true).then(()=>render(kind));return}",'');

  // Hard owner lock for the rebuilt Market News page.
  // This is served from the no-store function route, so it also protects sessions
  // that still have an older static Admin bundle in browser/CDN cache.
  source+=String.raw`
(()=>{'use strict';
if(window.__RONA_MARKET_NEWS_OWNER_GUARD_V5__)return;
window.__RONA_MARKET_NEWS_OWNER_GUARD_V5__='20260826-hard-owner-lock-v5';
let queued=false,loading=false,observer=null;
const page=()=>document.getElementById('page-market-news');
const selected=()=>document.documentElement.dataset.ronaAdminPage==='market-news'||!!page()?.classList.contains('active');
function forceStyle(el,key,value){if(el.style.getPropertyValue(key)!==value||el.style.getPropertyPriority(key)!=='important')el.style.setProperty(key,value,'important')}
function requestCurrent(){
  if(!selected())return;
  if(window.__RONA_MARKET_NEWS_CURRENT_V1__){
    window.dispatchEvent(new CustomEvent('rona:admin-pagechange',{detail:{page:'market-news',source:'market-news-owner-guard-v5'}}));
    return;
  }
  if(loading)return;
  loading=true;
  document.querySelector('script[data-rona-market-news-guard-loader="v5"]')?.remove();
  const s=document.createElement('script');
  s.src='/assets/portal-market-news-current-v1.js?v=20260826-hard-owner-lock-v5&ts='+Date.now();
  s.async=false;
  s.dataset.ronaMarketNewsGuardLoader='v5';
  s.onload=()=>{loading=false;window.dispatchEvent(new CustomEvent('rona:admin-pagechange',{detail:{page:'market-news',source:'market-news-owner-guard-v5-load'}}));schedule()};
  s.onerror=()=>{loading=false;setTimeout(schedule,500)};
  document.body.appendChild(s);
}
function stabilize(){
  if(!selected())return;
  const p=page();if(!p)return;
  p.classList.remove('rona-rs-gated','rona-owner-hide','rona-owner-original-hidden');
  if(p.hasAttribute('aria-hidden'))p.removeAttribute('aria-hidden');
  forceStyle(p,'visibility','visible');forceStyle(p,'opacity','1');forceStyle(p,'pointer-events','auto');
  let root=p.querySelector(':scope > #rona-market-news-current');
  if(!root){
    const anywhere=document.getElementById('rona-market-news-current');
    if(anywhere){p.replaceChildren(anywhere);root=anywhere}
  }
  if(!root){requestCurrent();return}
  root.classList.remove('rona-owner-original-hidden','rona-owner-hide','rona-rs-gated','current-loading');
  if(root.hasAttribute('aria-hidden'))root.removeAttribute('aria-hidden');
  forceStyle(root,'display','block');forceStyle(root,'visibility','visible');forceStyle(root,'opacity','1');forceStyle(root,'pointer-events','auto');
  for(const child of Array.from(p.children))if(child!==root)child.remove();
  p.dataset.ronaMarketNewsOwner='current-v5-locked';
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;stabilize();attach()})}
function attach(){
  const p=page();if(!p||p.__ronaMarketNewsOwnerGuardV5)return;
  p.__ronaMarketNewsOwnerGuardV5=true;
  observer=new MutationObserver(schedule);
  observer.observe(p,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-hidden']});
}
window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')==='market-news')[0,20,80,220,600,1400].forEach(ms=>setTimeout(schedule,ms))},{passive:true});
document.addEventListener('click',ev=>{const b=ev.target?.closest?.('#nav [data-page="market-news"]');if(b)[0,25,100,300,900,1800].forEach(ms=>setTimeout(schedule,ms))},true);
window.addEventListener('pageshow',schedule,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
setInterval(()=>{if(selected())schedule()},750);
})();
`;

  const forbidden=[
    "'аналитика':'analytics'",
    "'новости топливного рынка снг':'news'",
    'function renderAnalytics(){',
    'function renderNews(){',
    'function publicationCard(){',
    "root('analytics'",
    "root('news'",
    "kind==='analytics'",
    'ronaMarketNewsTopRuntimeV8',
    '__RONA_MARKET_NEWS_TOP_RUNTIME_V8__'
  ];
  if(forbidden.some(token=>source.includes(token))){
    return new Response('REMAINING_CANONICAL_SPLIT_FAILED',{status:500,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }

  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-remaining-sections','r2-canonical-split-no-analytics-no-news-v5');
  headers.set('x-rona-market-news-owner','dedicated-current-hard-lock-v5');
  headers.delete('content-length');
  headers.delete('etag');
  return new Response(source,{status:response.status,statusText:response.statusText,headers});
}
