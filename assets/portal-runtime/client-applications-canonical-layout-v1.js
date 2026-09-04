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
function titleFrame(r){
  const rr=rect(r);if(!rr)return null;
  const heading=[...r.querySelectorAll('h1,h2,h3,[role="heading"]')].find(el=>norm(el.textContent)==='Заявки');
  if(heading){
    let node=heading.parentElement,best=null;
    for(let i=0;node&&node!==r&&i<9;i++,node=node.parentElement){
      const b=rect(node);if(!b)continue;
      const cs=getComputedStyle(node),radius=parseFloat(cs.borderTopLeftRadius)||0;
      const bg=cs.backgroundColor&&cs.backgroundColor!=='transparent'&&cs.backgroundColor!=='rgba(0, 0, 0, 0)';
      const border=(parseFloat(cs.borderTopWidth)||0)>0||(parseFloat(cs.borderLeftWidth)||0)>0;
      if(b.width>=420&&b.height>=62&&b.height<=180&&b.left>=rr.left&&b.right<=rr.right+2){
        if(!best)best=b;
        if(radius>=8&&(bg||border))return b;
      }
    }
    if(best)return best;
  }
  const controls=[searchInput(r),statusSelect(r),resetButton(r)].map(rect).filter(Boolean);
  if(!controls.length)return null;
  const left=Math.min(...controls.map(x=>x.left)),right=Math.max(...controls.map(x=>x.right));
  return{left,right,width:right-left};
}
function align(){
  const r=root(),list=r?.querySelector('[data-rona-live-applications="v1"]');
  if(!r||!list)return false;
  const target=titleFrame(r),parentRect=rect(list.parentElement);
  if(!target||!parentRect)return false;
  const offset=Math.round(target.left-parentRect.left),width=Math.round(target.width||target.right-target.left);
  if(width<320)return false;
  list.style.boxSizing='border-box';
  list.style.marginLeft=`${offset}px`;
  list.style.marginRight='0';
  list.style.width=`${width}px`;
  list.style.maxWidth='none';
  list.style.justifySelf='start';
  list.setAttribute('data-rona-canonical-frame','applications-title-frame');
  return true;
}
let raf=0;
function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{align();setTimeout(align,70)})}
function pulse(){schedule();setTimeout(schedule,180);setTimeout(schedule,520)}
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
