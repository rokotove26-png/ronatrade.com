(()=>{'use strict';
if(window.__RONA_CLIENT_SINGLE_LOGOUT_V1__)return;
window.__RONA_CLIENT_SINGLE_LOGOUT_V1__='20260829-client-single-logout-v1';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
let signingOut=false,queued=false;
function visible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0}
function candidates(){
  const selectors=['#clientLogoutBtn','#ronaLogout','#logoutBtn','[data-action="logout"]','[data-logout]','a[href="/portal/logout"]','a[href="/portal/auth/logout"]','form[action="/portal/logout"] button','form[action="/portal/auth/logout"] button','button','a','[role="button"]'];
  const seen=new Set(),out=[];
  for(const el of document.querySelectorAll(selectors.join(','))){
    if(seen.has(el)||!visible(el))continue;seen.add(el);
    const text=norm(el.textContent),href=String(el.getAttribute?.('href')||''),action=String(el.closest?.('form')?.getAttribute?.('action')||'');
    const explicit=el.id==='clientLogoutBtn'||el.id==='ronaLogout'||el.id==='logoutBtn'||el.hasAttribute?.('data-logout')||el.getAttribute?.('data-action')==='logout'||/\/portal\/(auth\/)?logout$/.test(href)||/\/portal\/(auth\/)?logout$/.test(action);
    if(explicit||text==='выход'||text==='выйти'||text==='logout')out.push(el);
  }
  return out;
}
function score(el){let s=0;if(el.id==='clientLogoutBtn')s+=1000;if(el.id==='ronaLogout'||el.id==='logoutBtn')s+=800;if(el.getAttribute?.('data-action')==='logout'||el.hasAttribute?.('data-logout'))s+=700;if(el.closest?.('header,.topbar,[class*="topbar"],[class*="header"],[data-user-menu],.user-menu,.user-actions,.header-actions,.topbar-actions'))s+=400;if(norm(el.textContent)==='выход')s+=100;const r=el.getBoundingClientRect();s+=Math.max(0,200-r.top);return s}
async function signOut(event){
  event?.preventDefault?.();event?.stopImmediatePropagation?.();if(signingOut)return;signingOut=true;
  const control=event?.currentTarget;if(control&&'disabled'in control)control.disabled=true;
  try{await fetch('/portal/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})}catch(_e){}
  finally{window.location.replace('https://ronaoil.com')}
}
function normalizeLogout(){
  const list=candidates();if(!list.length){document.documentElement.dataset.ronaClientLogoutCount='0';return}
  list.sort((a,b)=>score(b)-score(a));const keep=list[0];
  for(const el of list.slice(1)){if(el!==keep)el.remove()}
  keep.textContent='Выход';keep.setAttribute('aria-label','Выход');keep.dataset.ronaClientCanonicalLogout='true';
  if(keep.dataset.ronaSingleLogoutBound!=='true'){keep.dataset.ronaSingleLogoutBound='true';keep.addEventListener('click',signOut,true)}
  document.documentElement.dataset.ronaClientLogoutCount='1';
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;normalizeLogout()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('pageshow',schedule);
})();
