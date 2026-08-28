(()=>{'use strict';
if(window.__RONA_CLIENT_SINGLE_LOGOUT_V2__)return;
window.__RONA_CLIENT_SINGLE_LOGOUT_V2__='20260829-client-single-logout-v2';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
let signingOut=false,queued=false;
function visible(el){if(!el||!el.isConnected)return false;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0}
function candidates(){
  const selector='#clientLogoutBtn,#ronaLogout,#logoutBtn,[data-rona-logout-bound="true"],[data-action="logout"],[data-logout],a[href="/portal/logout"],a[href="/portal/auth/logout"],form[action="/portal/logout"] button,form[action="/portal/auth/logout"] button,button,a,[role="button"]';
  const out=[];
  for(const el of document.querySelectorAll(selector)){
    if(!visible(el))continue;
    const text=norm(el.textContent),href=String(el.getAttribute?.('href')||''),action=String(el.closest?.('form')?.getAttribute?.('action')||'');
    const explicit=el.id==='clientLogoutBtn'||el.id==='ronaLogout'||el.id==='logoutBtn'||el.dataset?.ronaLogoutBound==='true'||el.hasAttribute?.('data-logout')||el.getAttribute?.('data-action')==='logout'||/\/portal\/(auth\/)?logout$/.test(href)||/\/portal\/(auth\/)?logout$/.test(action);
    if(explicit||text==='выход'||text==='выйти'||text==='logout')out.push(el);
  }
  return [...new Set(out)];
}
function score(el){let s=0;if(el.dataset?.ronaLogoutBound==='true')s+=1500;if(el.id==='clientLogoutBtn')s+=1200;if(el.id==='ronaLogout'||el.id==='logoutBtn')s+=900;if(el.getAttribute?.('data-action')==='logout'||el.hasAttribute?.('data-logout'))s+=800;if(el.closest?.('header,.topbar,[class*="topbar"],[class*="header"],[data-user-menu],.user-menu,.user-actions,.header-actions,.topbar-actions'))s+=500;if(norm(el.textContent)==='выход')s+=100;const r=el.getBoundingClientRect();s+=Math.max(0,240-r.top);return s}
async function signOut(event){
  event?.preventDefault?.();event?.stopImmediatePropagation?.();if(signingOut)return;signingOut=true;
  const control=event?.currentTarget;if(control&&'disabled'in control)control.disabled=true;
  try{await fetch('/portal/auth/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})}catch(_e){}
  finally{window.location.replace('/')}
}
function normalizeLogout(){
  const list=candidates();if(!list.length){document.documentElement.dataset.ronaClientLogoutCount='0';return}
  list.sort((a,b)=>score(b)-score(a));const keep=list[0];
  for(const el of list.slice(1)){if(el!==keep)el.remove()}
  keep.textContent='Выход';keep.setAttribute('aria-label','Выход');keep.dataset.ronaLogoutBound='true';keep.dataset.ronaClientCanonicalLogout='true';
  if(keep.dataset.ronaSingleLogoutV2Bound!=='true'){keep.dataset.ronaSingleLogoutV2Bound='true';keep.addEventListener('click',signOut,true)}
  document.documentElement.dataset.ronaClientLogoutCount='1';
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;normalizeLogout()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('pageshow',schedule);
})();
