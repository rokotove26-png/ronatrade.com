(()=>{'use strict';
const MARK='20260904-client-applications-canonical-layout-v2-toolbar-frame';
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
function toolbarFrame(r){
  const controls=[searchInput(r),statusSelect(r),resetButton(r)].map(rect).filter(Boolean);
  if(controls.length>=2){
    const left=Math.min(...controls.map(x=>x.left));
    const right=Math.max(...controls.map(x=>x.right));
    const width=right-left;
    if(width>=420)return{left,right,width};
  }
  const rr=rect(r);if(!rr)return null;
  const heading=[...r.querySelectorAll('h1,h2,h3,[role="heading"]')].find(el=>norm(el.textContent)==='Заявки');
  if(!heading)return null;
  let node=heading.parentElement,best=null;
  for(let i=0;node&&node!==r&&i<10;i++,node=node.parentElement){
    const b=rect(node);if(!b)continue;
    const cs=getComputedStyle(node),radius=parseFloat(cs.borderTopLeftRadius)||0;
    const bg=cs.backgroundColor&&cs.backgroundColor!=='transparent'&&cs.backgroundColor!=='rgba(0, 0, 0, 0)';
    const border=(parseFloat(cs.borderTopWidth)||0)>0||(parseFloat(cs.borderLeftWidth)||0)>0;
    if(b.width>=420&&b.height>=62&&b.height<=190&&b.left>=rr.left-2&&b.right<=rr.right+2){
      if(!best||b.width>best.width)best=b;
      if(radius>=8&&(bg||border))best=b;
    }
  }
  return best;
}
function align(){
  const r=root(),list=r?.querySelector('[data-rona-live-applications="v1"]');
  if(!r||!list)return false;
  const target=toolbarFrame(r),parentRect=rect(list.parentElement);
  if(!target||!parentRect)return false;
  const offset=Math.round(target.left-parentRect.left);
  const width=Math.round(target.width||target.right-target.left);
  if(width<420)return false;
  list.style.boxSizing='border-box';
  list.style.marginLeft=`${offset}px`;
  list.style.marginRight='0';
  list.style.width=`${width}px`;
  list.style.minWidth=`${width}px`;
  list.style.maxWidth=`${width}px`;
  list.style.justifySelf='start';
  list.setAttribute('data-rona-canonical-frame','applications-toolbar-frame');
  return true;
}
let raf=0;
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{align();setTimeout(align,60)})}
function pulse(){schedule();setTimeout(schedule,160);setTimeout(schedule,420)}
function start(){
  pulse();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',pulse,{passive:true});
  window.addEventListener('rona:client-applications-rendered',pulse);
  window.addEventListener('rona:client-application-submitted',pulse);
  document.addEventListener('input',schedule,true);
  document.addEventListener('change',schedule,true);
  document.addEventListener('click',e=>{if(/^заявки$/iu.test(norm(e.target?.closest?.('a,button,[role="button"]')?.textContent)))pulse()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
