(()=>{'use strict';
const MARK='20260830-client-logout-force-red-v2';
if(window.__RONA_CLIENT_LOGOUT_VISUAL_V1__===MARK)return;
window.__RONA_CLIENT_LOGOUT_VISUAL_V1__=MARK;
const STYLE_ID='rona-client-logout-force-red-v2-style';
const ATTR='data-rona-logout-visual-v1';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const RED_BG='linear-gradient(110deg,#6b0710 0%,#b70d1b 22%,#f52237 43%,#ff5a69 50%,#f52237 57%,#b70d1b 78%,#65060f 100%)';
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html body [${ATTR}="true"]{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  text-align:center!important;
  color:#fff!important;
  border-color:rgba(255,92,105,.96)!important;
  background:${RED_BG}!important;
  background-size:260% 260%!important;
  box-shadow:0 0 0 1px rgba(255,65,80,.24),0 0 13px rgba(236,24,43,.46),inset 0 1px 0 rgba(255,255,255,.2)!important;
  text-shadow:0 1px 1px rgba(45,0,5,.78)!important;
  animation:ronaClientLogoutRedFlowV2 3.8s ease-in-out infinite!important;
  transition:filter .18s ease,box-shadow .18s ease,transform .18s ease!important;
}
html body [${ATTR}="true"]:hover{
  filter:brightness(1.14) saturate(1.12)!important;
  box-shadow:0 0 0 1px rgba(255,110,121,.34),0 0 18px rgba(247,31,50,.6),inset 0 1px 0 rgba(255,255,255,.24)!important;
  transform:translateY(-1px)!important;
}
html body [${ATTR}="true"]:active{transform:translateY(0)!important;filter:brightness(.98)!important}
@keyframes ronaClientLogoutRedFlowV2{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@media (prefers-reduced-motion:reduce){html body [${ATTR}="true"]{animation:none!important}}
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
  if(el.closest?.('header,.topbar,.rona-topbar,[class*="topbar"],[class*="header"],[data-user-menu],.user-menu,.user-actions,.header-actions,.topbar-actions,.rona-topbar-actions'))s+=700;
  if(norm(el.textContent)==='выход')s+=300;
  const r=el.getBoundingClientRect();
  s+=Math.max(0,280-r.top);
  s+=Math.max(0,r.left/16);
  return s;
}
function important(el,prop,value){
  if(el.style.getPropertyValue(prop)!==value||el.style.getPropertyPriority(prop)!=='important')el.style.setProperty(prop,value,'important');
}
function forceInline(el){
  important(el,'display','inline-flex');
  important(el,'align-items','center');
  important(el,'justify-content','center');
  important(el,'text-align','center');
  important(el,'color','#fff');
  important(el,'background',RED_BG);
  important(el,'background-size','260% 260%');
  important(el,'border-color','rgba(255,92,105,.96)');
  important(el,'box-shadow','0 0 0 1px rgba(255,65,80,.24), 0 0 13px rgba(236,24,43,.46), inset 0 1px 0 rgba(255,255,255,.2)');
  important(el,'text-shadow','0 1px 1px rgba(45,0,5,.78)');
}
function apply(){
  ensureStyle();
  const selector='#clientLogoutBtn,#ronaLogout,#logoutBtn,[data-rona-client-canonical-logout="true"],[data-rona-logout-bound="true"],[data-action="logout"],[data-logout],button,a,[role="button"]';
  const list=[...document.querySelectorAll(selector)].filter(el=>visible(el)&&(el.id==='clientLogoutBtn'||el.id==='ronaLogout'||el.id==='logoutBtn'||el.dataset?.ronaClientCanonicalLogout==='true'||el.dataset?.ronaLogoutBound==='true'||el.getAttribute?.('data-action')==='logout'||el.hasAttribute?.('data-logout')||norm(el.textContent)==='выход'));
  if(!list.length)return;
  list.sort((a,b)=>score(b)-score(a));
  const keep=list[0];
  for(const el of document.querySelectorAll(`[${ATTR}="true"]`))if(el!==keep)el.removeAttribute(ATTR);
  if(keep.getAttribute(ATTR)!=='true')keep.setAttribute(ATTR,'true');
  forceInline(keep);
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})}
function start(){
  apply();
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','hidden','data-rona-client-canonical-logout','data-rona-logout-bound']});
  window.addEventListener('pageshow',schedule);
  setInterval(()=>{if(document.visibilityState==='visible')apply()},1500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
