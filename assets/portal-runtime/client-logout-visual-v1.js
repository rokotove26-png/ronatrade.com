(()=>{'use strict';
const MARK='20260830-client-logout-red-glow-v1';
if(window.__RONA_CLIENT_LOGOUT_VISUAL_V1__===MARK)return;
window.__RONA_CLIENT_LOGOUT_VISUAL_V1__=MARK;
const STYLE_ID='rona-client-logout-red-glow-v1-style';
const ATTR='data-rona-logout-visual-v1';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
[${ATTR}="true"]{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  text-align:center!important;
  color:#fff!important;
  border-color:rgba(255,93,104,.78)!important;
  background:linear-gradient(120deg,#5d0810 0%,#8f0c17 18%,#c31624 38%,#f15b66 50%,#c31624 62%,#8f0c17 82%,#5d0810 100%)!important;
  background-size:240% 240%!important;
  box-shadow:0 0 0 1px rgba(255,70,82,.12),0 0 10px rgba(222,28,43,.28),inset 0 1px 0 rgba(255,255,255,.16)!important;
  text-shadow:0 1px 1px rgba(45,0,5,.72)!important;
  animation:ronaClientLogoutRedFlowV1 4.8s ease-in-out infinite!important;
  transition:filter .18s ease,box-shadow .18s ease,transform .18s ease!important;
}
[${ATTR}="true"]:hover{
  filter:brightness(1.12) saturate(1.08)!important;
  box-shadow:0 0 0 1px rgba(255,102,112,.22),0 0 16px rgba(239,35,52,.42),inset 0 1px 0 rgba(255,255,255,.2)!important;
  transform:translateY(-1px)!important;
}
[${ATTR}="true"]:active{transform:translateY(0)!important;filter:brightness(.98)!important}
@keyframes ronaClientLogoutRedFlowV1{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@media (prefers-reduced-motion:reduce){[${ATTR}="true"]{animation:none!important}}
`;
  document.head.appendChild(style);
}
function visible(el){
  if(!el||!el.isConnected)return false;
  const s=getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0;
}
function score(el){
  let s=0;
  if(el.dataset?.ronaClientCanonicalLogout==='true')s+=1500;
  if(el.dataset?.ronaLogoutBound==='true')s+=1200;
  if(el.id==='clientLogoutBtn')s+=1000;
  if(el.id==='ronaLogout'||el.id==='logoutBtn')s+=800;
  if(el.closest?.('header,.topbar,[class*="topbar"],[class*="header"],[data-user-menu],.user-menu,.user-actions,.header-actions,.topbar-actions'))s+=500;
  if(norm(el.textContent)==='выход')s+=200;
  const r=el.getBoundingClientRect();
  s+=Math.max(0,260-r.top);
  s+=Math.max(0,r.left/20);
  return s;
}
function apply(){
  ensureStyle();
  const selector='#clientLogoutBtn,#ronaLogout,#logoutBtn,[data-rona-client-canonical-logout="true"],[data-rona-logout-bound="true"],[data-action="logout"],[data-logout],button,a,[role="button"]';
  const list=[...document.querySelectorAll(selector)].filter(el=>visible(el)&&(el.id==='clientLogoutBtn'||el.id==='ronaLogout'||el.id==='logoutBtn'||el.dataset?.ronaClientCanonicalLogout==='true'||el.dataset?.ronaLogoutBound==='true'||el.getAttribute?.('data-action')==='logout'||el.hasAttribute?.('data-logout')||norm(el.textContent)==='выход'));
  if(!list.length)return;
  list.sort((a,b)=>score(b)-score(a));
  for(const el of document.querySelectorAll(`[${ATTR}="true"]`))if(el!==list[0])el.removeAttribute(ATTR);
  list[0].setAttribute(ATTR,'true');
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function start(){apply();new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','data-rona-client-canonical-logout','data-rona-logout-bound']});window.addEventListener('pageshow',schedule)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
