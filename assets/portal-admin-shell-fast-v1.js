(()=>{'use strict';
if(window.__RONA_ADMIN_SHELL_RESILIENCE__)return;
window.__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3';
window.__RONA_ADMIN_RUNTIME_OWNER__='single-owner-v3';
window.__RONA_ADMIN_SHELL_OPTIONAL_ERRORS__=[];
window.__RONA_ADMIN_MODULES__=Object.create(null);
window.__RONA_ADMIN_SESSION_STATE__='CHECKING';
const LOGIN='/portal/login?next='+encodeURIComponent('/portal/admin');
const root=document.documentElement;
root.dataset.ronaAdminRuntimeOwner='single-owner-v3';
root.dataset.ronaAdminShellOwner='canonical-home-v3';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function recordError(stage,error){
  const entry={stage:String(stage),error:String(error?.code||error?.message||error||'UNKNOWN'),at:new Date().toISOString()};
  window.__RONA_ADMIN_SHELL_OPTIONAL_ERRORS__.push(entry);
  console.warn('[RONA Admin]',entry.stage,entry.error);
}
function revealShell(reason='single-owner-v3'){
  root.classList.add('rona-owner-paint-ready');
  root.dataset.ronaOwnerPaint='current-only';
  root.dataset.ronaAdminShell=reason;
  const app=document.querySelector('.app');
  if(app){app.style.removeProperty('opacity');app.style.removeProperty('visibility');app.style.removeProperty('pointer-events');app.removeAttribute('aria-hidden')}
}
revealShell();

async function probeSessionOnce(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  try{
    const r=await fetch('/portal/api/session/me',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'},signal:controller.signal});
    if(r.status===401||r.status===403){window.__RONA_ADMIN_SESSION_STATE__='DENIED';location.replace(LOGIN);return'DENIED'}
    if(r.ok){window.__RONA_ADMIN_SESSION_STATE__='VERIFIED';window.__RONA_ADMIN_SESSION_VERIFIED_AT__=new Date().toISOString();document.body?.classList.add('admin-auth-server-verified');return'VERIFIED'}
    window.__RONA_ADMIN_SESSION_STATE__='TRANSIENT_'+r.status;return'TRANSIENT'
  }catch(e){window.__RONA_ADMIN_SESSION_STATE__='TRANSIENT_NETWORK';recordError('session-probe',e);return'TRANSIENT'}finally{clearTimeout(timer)}
}
(async()=>{for(const delay of [0,700,1800,4000]){if(delay)await sleep(delay);const state=await probeSessionOnce();if(state!=='TRANSIENT')return}window.__RONA_ADMIN_SESSION_STATE__='DEGRADED_BACKEND'})();

function selectedPage(){
  try{const live=typeof window.__RONA_ADMIN_SELECTED_PAGE__==='function'?window.__RONA_ADMIN_SELECTED_PAGE__():'';if(live)return String(live)}catch(_){ }
  const ds=String(root.dataset.ronaAdminPage||'');if(ds)return ds;
  try{return sessionStorage.getItem('rona.admin.currentPage')||'home'}catch(_){return'home'}
}
function restoreSelectedPage(){const page=selectedPage();try{window.__RONA_ADMIN_NAVIGATE__?.(page)}catch(e){recordError('restore-page:'+page,e)}}

function scriptOnce(src,id,timeout=14000){
  return new Promise((resolve,reject)=>{
    let prior=document.getElementById(id);
    if(prior&&prior.dataset.ronaLoaded==='true'){resolve(prior);return}
    if(prior)prior.remove();
    const s=document.createElement('script');s.id=id;s.src=src;s.async=false;s.dataset.ronaSingleOwner='v3';
    let done=false;
    const finish=(ok,v)=>{if(done)return;done=true;clearTimeout(timer);if(ok){s.dataset.ronaLoaded='true';resolve(s)}else{s.remove();reject(v)}};
    const timer=setTimeout(()=>finish(false,new Error('SCRIPT_TIMEOUT:'+id)),timeout);
    s.onload=()=>finish(true,s);s.onerror=()=>finish(false,new Error('SCRIPT_LOAD_FAILED:'+id));
    document.body.appendChild(s)
  })
}
async function loadModule(name,src,{attempts=3,ready=null,timeout=14000}={}){
  const state=window.__RONA_ADMIN_MODULES__[name]||(window.__RONA_ADMIN_MODULES__[name]={name,src,status:'PENDING',attempts:0,error:null});
  if(state.promise)return state.promise;
  state.promise=(async()=>{
    for(let attempt=1;attempt<=attempts;attempt++){
      state.attempts=attempt;state.status='LOADING';state.error=null;
      const sep=src.includes('?')?'&':'?',url=src+sep+'rona_retry='+attempt+'&rona_build=20260826_single_owner_1345';
      try{
        await scriptOnce(url,'rona-single-'+name,timeout);
        if(typeof ready==='function'){
          const deadline=Date.now()+Math.min(10000,timeout);
          while(Date.now()<deadline&&!ready())await sleep(100);
          if(!ready())throw new Error('MODULE_NOT_READY:'+name)
        }
        state.status='READY';state.readyAt=new Date().toISOString();restoreSelectedPage();return true
      }catch(e){state.status='RETRY';state.error=String(e?.message||e);recordError('module:'+name+':'+attempt,e);if(attempt<attempts)await sleep(350*attempt)}
    }
    state.status='FAILED';state.failedAt=new Date().toISOString();return false
  })().finally(()=>{state.promise=null});
  return state.promise
}
window.__RONA_ADMIN_LOAD_MODULE__=loadModule;

const MODULES=Object.freeze({
  main:{src:'/portal/main-ui?v=20260826-single-owner',ready:()=>window.__RONA_OWNER_ADMIN_READY__===true},
  deals:{src:'/portal/deals-current-state-ui?v=20260826-single-owner'},
  dealsR11:{src:'/portal/deals-r1-r11-ui?v=20260826-single-owner'},
  cash:{src:'/portal/cash-r2-ui?v=20260826-single-owner'},
  rail:{src:'/portal/rail-current-v81-maplibre-ui?v=20260826-single-owner'},
  applications:{src:'/portal/applications-total-kpi-ui?v=20260826-single-owner'},
  claims:{src:'/portal/claims-r2-ui?v=20260826-single-owner'},
  remaining:{src:'/portal/remaining-sections-ui?v=20260826-single-owner'},
  prices:{src:'/portal/prices-current-ui?v=20260826-single-owner'}
});
async function bootUi(){
  await loadModule('main',MODULES.main.src,{attempts:3,ready:MODULES.main.ready,timeout:16000});
  restoreSelectedPage();
  await Promise.allSettled([
    loadModule('deals',MODULES.deals.src),loadModule('deals-r11',MODULES.dealsR11.src),loadModule('cash',MODULES.cash.src),loadModule('rail',MODULES.rail.src),loadModule('applications',MODULES.applications.src)
  ]);
  await Promise.allSettled([
    loadModule('claims',MODULES.claims.src),loadModule('remaining',MODULES.remaining.src),loadModule('prices',MODULES.prices.src)
  ]);
  window.__RONA_ADMIN_FAST_UI_LOADED__=true;window.__RONA_POSTCORE_ENHANCEMENTS_READY__=true;restoreSelectedPage();revealShell('ui-ready');window.dispatchEvent(new CustomEvent('rona:admin-single-owner-ready'))
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootUi,{once:true});else bootUi();

window.addEventListener('rona:admin-pagechange',event=>{
  const p=String(event?.detail?.page||'');
  if(p==='claims')loadModule('claims',MODULES.claims.src);
  if(['agent-settlements','messages','analytics','market-news'].includes(p))loadModule('remaining',MODULES.remaining.src);
  if(p==='prices')loadModule('prices',MODULES.prices.src);
});
window.addEventListener('rona:admin-module-retry',event=>{
  const m=String(event?.detail?.module||''),p=String(event?.detail?.page||selectedPage());
  if(m==='clients-agents-current'){
    const old=document.getElementById('rona-clients-agents-current-loader');if(old)old.remove();window.__RONA_CLIENTS_AGENTS_CURRENT__=null;
    scriptOnce('/portal/clients-agents-current-ui?v=20260826-single-owner-retry&ts='+Date.now(),'rona-clients-agents-current-loader',14000).then(restoreSelectedPage).catch(e=>recordError('clients-agents-current-retry',e));return
  }
  const key=p==='claims'?'claims':['agent-settlements','messages','analytics','market-news'].includes(p)?'remaining':p==='prices'?'prices':'';
  if(key){const st=window.__RONA_ADMIN_MODULES__[key];if(st){st.status='PENDING';st.promise=null}loadModule(key,MODULES[key].src).then(restoreSelectedPage)}
});

if(!window.__RONA_ADMIN_LIVE_AUTHORITY_ADAPTER__){
  window.__RONA_ADMIN_LIVE_AUTHORITY_ADAPTER__='single-owner-v3';
  const BASE='/portal/admin-authority';let authorityBusy=false;
  async function call(path,options){const init=Object.assign({credentials:'same-origin',cache:'no-store',headers:{}},options||{});const r=await fetch(BASE+path,init);const j=await r.json().catch(()=>({}));if(!r.ok||j?.ok===false){const e=new Error(String(j?.code||('HTTP_'+r.status)));e.code=String(j?.code||'REQUEST_FAILED');e.status=r.status;e.payload=j;throw e}return j}
  async function coreBootstrap(){const r=await fetch('/portal/api/v1/admin/bootstrap',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const j=await r.json().catch(()=>({}));if(!r.ok||!j?.ok)throw new Error(String(j?.code||'ADMIN_BOOTSTRAP_FAILED'));return j.data}
  async function refreshAuthority(){if(authorityBusy)return window.__RONA_ADMIN_LIVE_SNAPSHOT__||null;authorityBusy=true;try{const [core,a]=await Promise.all([coreBootstrap(),call('/bootstrap')]);let readiness=null;try{readiness=(await call('/agent-readiness')).data||null}catch(e){recordError('agent-readiness',e)}window.__RONA_ADMIN_AGENT_ACCESS_READY__=readiness?.matrixReady===true;window.__RONA_ADMIN_LIVE_SNAPSHOT__={core,authority:a.data||{},agentAccessReadiness:readiness,at:new Date().toISOString()};window.__RONA_ADMIN_LIVE_READY__=true;window.__RONA_ADMIN_LIVE_ERROR__=null;return window.__RONA_ADMIN_LIVE_SNAPSHOT__}catch(e){window.__RONA_ADMIN_LIVE_READY__=false;window.__RONA_ADMIN_LIVE_ERROR__=String(e?.code||e?.message||e);recordError('authority-refresh',e);return null}finally{authorityBusy=false}}
  function formForSigned(req){const fd=new FormData();fd.set('clientId',String(req.clientId||''));fd.set('adminClaimsBilateralSigned',String(req.adminClaimsBilateralSigned===true));fd.set('adminAttestation',JSON.stringify(req.adminAttestation||{}));fd.set('file',req.signedContractFile);return fd}
  async function attachSignedContractToExistingContract(req){const j=await call('/contracts/'+encodeURIComponent(req.contractId)+'/signed-document/attach',{method:'POST',body:formForSigned(req)});await refreshAuthority();return j}
  async function replaceSignedContractVersion(req){const j=await call('/contracts/'+encodeURIComponent(req.contractId)+'/signed-document/replace',{method:'POST',headers:{'x-current-document-id':String(req.currentDocumentId||'')},body:formForSigned(req)});await refreshAuthority();return j}
  async function downloadSignedContract(req){return call('/documents/'+encodeURIComponent(req.documentId)+'/download?clientId='+encodeURIComponent(req.clientId)+'&contractId='+encodeURIComponent(req.contractId))}
  async function askPassword(label='Установите первоначальный пароль для учётной записи'){if(!window.RONA_ADMIN_DIALOGS?.password){const e=new Error('ADMIN_DIALOG_UNAVAILABLE');e.code='ADMIN_DIALOG_UNAVAILABLE';throw e}return String(await window.RONA_ADMIN_DIALOGS.password(label))}
  async function createAccessUser(req){const initialPassword=String(req.initialPassword||await askPassword());const payload={...req,initialPassword};const j=await call('/access/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});await refreshAuthority();return j.data||j}
  async function setAccessUserPassword(req){const password=String(req.password||await askPassword('Установите новый пароль'));const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});await refreshAuthority();return j.data||j}
  async function mutate(path,body={}){const j=await call(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});await refreshAuthority();return j.data||j}
  window.__RONA_PORTAL_BACKEND__=Object.freeze({
    attachSignedContractToExistingContract,replaceSignedContractVersion,downloadSignedContract,createAccessUser,setAccessUserPassword,
    linkContractsToUser:req=>mutate('/access/users/'+encodeURIComponent(req.userId)+'/contracts',{contractIds:req.contractIds||[]}),
    revokeBinding:req=>mutate('/access/users/'+encodeURIComponent(req.userId)+'/contracts/'+encodeURIComponent(req.contractId)+'/revoke'),
    restoreBinding:req=>mutate('/access/users/'+encodeURIComponent(req.userId)+'/contracts/'+encodeURIComponent(req.contractId)+'/restore'),
    blockAccessUser:req=>mutate('/access/users/'+encodeURIComponent(req.userId)+'/block'),
    unblockAccessUser:req=>mutate('/access/users/'+encodeURIComponent(req.userId)+'/unblock'),
    syncCanonical:async()=>{await refreshAuthority();return{ok:true,status:'SERVER_READ_REFRESHED'}}
  });
  window.__RONA_ADMIN_REFRESH_AUTHORITY__=refreshAuthority;
  [400,1800,5000].forEach(ms=>setTimeout(()=>{if(window.__RONA_ADMIN_SESSION_STATE__!=='DENIED')refreshAuthority()},ms));
}

(function installLogout(){
  if(window.__RONA_PORTAL_LOGOUT_RUNTIME__)return;window.__RONA_PORTAL_LOGOUT_RUNTIME__='single-owner-v3';let signingOut=false;
  async function signOut(event){event?.preventDefault();event?.stopImmediatePropagation();if(signingOut)return;signingOut=true;try{await fetch('/portal/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})}catch(e){recordError('logout',e)}finally{location.replace('https://ronaoil.com')}}
  document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-action="logout"]');if(b)signOut(e)},true)
})();
window.addEventListener('pageshow',event=>{const nav=performance.getEntriesByType?.('navigation')?.[0];if(event.persisted||nav?.type==='back_forward')probeSessionOnce()});
})();