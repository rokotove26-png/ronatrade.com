(()=>{'use strict';
const MARK='20260904-client-applications-canonical-layout-v1';
if(window.__RONA_CLIENT_APPLICATIONS_CANONICAL_LAYOUT__===MARK)return;
window.__RONA_CLIENT_APPLICATIONS_CANONICAL_LAYOUT__=MARK;
if(location.pathname!=='/portal/client')return;

const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
function root(){
  return document.getElementById('page-applications')||
    document.getElementById('applicationsPage')||
    document.querySelector('[data-page-panel="applications"],[data-page-id="applications"]');
}
function searchInput(r){return [...r.querySelectorAll('input')].find(el=>/ид заявки|товар|ид сделки/i.test(String(el.placeholder||'')))||null}
function statusSelect(r){return [...r.querySelectorAll('select')].find(el=>/все статусы/i.test(norm(el.textContent)))||null}
function resetButton(r){return [...r.querySelectorAll('button')].find(el=>/^сбросить$/iu.test(norm(el.textContent)))||null}
function rect(el){
  if(!el||!el.isConnected)return null;
  const box=el.getBoundingClientRect(),style=getComputedStyle(el);
  return box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden'?box:null;
}
function align(){
  const r=root(),list=r?.querySelector('[data-rona-live-applications="v1"]');
  if(!r||!list)return false;
  const rr=rect(r),controls=[searchInput(r),statusSelect(r),resetButton(r)].map(rect).filter(Boolean);
  if(!rr||!controls.length)return false;
  const left=Math.min(...controls.map(x=>x.left));
  const right=Math.max(...controls.map(x=>x.right));
  const offset=Math.max(0,Math.round(left-rr.left));
  const available=Math.max(240,Math.round(right-left));
  list.style.boxSizing='border-box';
  list.style.marginLeft=`${offset}px`;
  list.style.marginRight='0';
  list.style.width=`${available}px`;
  list.style.maxWidth=`calc(100% - ${offset}px)`;
  list.setAttribute('data-rona-canonical-frame','applications-filter-frame');
  return true;
}
let raf=0;
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(align)}
function start(){
  schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('rona:client-application-submitted',()=>{schedule();setTimeout(schedule,180)});
  document.addEventListener('input',schedule,true);
  document.addEventListener('change',schedule,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
