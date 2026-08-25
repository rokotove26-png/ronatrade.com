(()=>{'use strict';
if(window.__RONA_ADMIN_SHELL_RESILIENCE__)return;
window.__RONA_ADMIN_SHELL_RESILIENCE__='fast-static-v1';
window.__RONA_ADMIN_SHELL_OPTIONAL_ERRORS__=[];
window.__RONA_ADMIN_SESSION_STATE__='CHECKING';
const LOGIN='/portal/login?next='+encodeURIComponent('/portal/admin');
const root=document.documentElement;

function recordError(stage,error){
  const entry={stage:String(stage),error:String(error?.code||error?.message||error||'UNKNOWN'),at:new Date().toISOString()};
  window.__RONA_ADMIN_SHELL_OPTIONAL_ERRORS__.push(entry);
  console.warn('[RONA Admin shell]',entry.stage,entry.error);
}

function revealShell(reason='fast-static-v1'){
  root.classList.add('rona-owner-paint-ready');
  root.dataset.ronaOwnerPaint='fast-shell';
  root.dataset.ronaAdminShell=reason;
  const app=document.querySelector('.app');
  if(app){
    app.style.setProperty('opacity','1','important');
    app.style.setProperty('visibility','visible','important');
    app.style.setProperty('pointer-events','auto','important');
    app.removeAttribute('aria-hidden');
  }
}
revealShell();

(function installFetchGate(){
  if(window.__RONA_BACKEND_FETCH_GATE__)return;
  window.__RONA_BACKEND_FETCH_GATE__='fast-static-v1';
  const raw=window.fetch.bind(window);
  const queue=[];
  const MAX=4;
  let active=0;

  function gated(input){
    try{
      const rawUrl=typeof input==='string'?input:(input instanceof URL?input.href:(input&&input.url)||'');
      const u=new URL(rawUrl,location.href);
      if(u.origin!==location.origin)return false;
      const p=u.pathname;
      return p.startsWith('/portal/api/')||
        p.startsWith('/portal/admin-authority')||
        p.includes('price-updates-api')||
        p.includes('owner-acceptance-api')||
        p.includes('control-plane');
    }catch{return false}
  }

  function pump(){
    while(active<MAX&&queue.length){
      active++;
      const run=queue.shift();
      Promise.resolve().then(run).finally(()=>{active--;pump()});
    }
  }

  window.fetch=(input,init)=>{
    if(!gated(input))return raw(input,init);
    return new Promise((resolve,reject)=>{
      queue.push(()=>raw(input,init).then(resolve,reject));
      pump();
    });
  };
})();

function bootAuthority(){
  try{window.__RONA_ADMIN_REFRESH_AUTHORITY__?.()}catch(e){recordError('authority-boot',e)}
}
function kickServerBootstrap(){
  try{window.RONA_ADMIN_SERVER_BOOTSTRAP?.start?.()}catch(e){recordError('server-bootstrap-kick',e)}
}

function markSessionVerified(){
  window.__RONA_ADMIN_SESSION_STATE__='VERIFIED';
  window.__RONA_ADMIN_SESSION_VERIFIED_AT__=new Date().toISOString();
  if(document.body){
    document.body.classList.remove('admin-auth-locked');
    document.body.classList.add('admin-auth-server-verified');
  }
  revealShell('session-verified');
  bootAuthority();
  kickServerBootstrap();
}

async function probeSessionOnce(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),3500);
  try{
    const r=await fetch('/portal/api/session/me',{
      credentials:'same-origin',
      cache:'no-store',
      headers:{accept:'application/json'},
      signal:controller.signal
    });
    if(r.status===401||r.status===403){
      window.__RONA_ADMIN_SESSION_STATE__='DENIED';
      window.location.replace(LOGIN);
      return 'DENIED';
    }
    if(r.ok){
      markSessionVerified();
      return 'VERIFIED';
    }
    window.__RONA_ADMIN_SESSION_STATE__='TRANSIENT_'+r.status;
    return 'TRANSIENT';
  }catch(e){
    window.__RONA_ADMIN_SESSION_STATE__='TRANSIENT_NETWORK';
    recordError('session-probe',e);
    return 'TRANSIENT';
  }finally{
    clearTimeout(timer);
  }
}

async function sessionLoop(){
  const delays=[0,1200,3000,7000,15000];
  for(const delay of delays){
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    const state=await probeSessionOnce();
    if(state==='VERIFIED'||state==='DENIED')return;
  }
  window.__RONA_ADMIN_SESSION_STATE__='DEGRADED_BACKEND';
  revealShell('backend-degraded');
}
sessionLoop();

function loadScript(src,id,timeout=12000){
  return new Promise((resolve,reject)=>{
    const prior=document.getElementById(id);
    if(prior){resolve(prior);return}
    const s=document.createElement('script');
    s.id=id;
    s.src=src;
    s.async=false;
    s.dataset.ronaFastShell='v1';
    let done=false;
    const finish=(ok,value)=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      ok?resolve(value):reject(value);
    };
    const timer=setTimeout(()=>finish(false,new Error('SCRIPT_TIMEOUT:'+id)),timeout);
    s.onload=()=>finish(true,s);
    s.onerror=()=>finish(false,new Error('SCRIPT_LOAD_FAILED:'+id));
    document.body.appendChild(s);
  });
}
async function safeLoad(src,id,timeout){
  try{return await loadScript(src,id,timeout)}
  catch(e){recordError(id,e);return null}
}

const CORE=[
  ['/portal/main-ui?v=20260824-0320','rona-main-ui-loader'],
  ['/portal/deals-current-state-ui?v=20260824-0320','rona-deals-current-loader'],
  ['/portal/deals-r1-r11-ui','rona-deals-r11-loader']
];
const OPTIONAL=[
  ['/portal/cash-r2-ui','rona-cash-r2-loader'],
  ['/portal/rail-current-v81-maplibre-ui?v=20260825-0352','rona-rail-current-v81-loader'],
  ['/portal/claims-r2-ui','rona-claims-r2-loader'],
  ['/portal/title-visual-rollback-ui','rona-title-visual-rollback-loader'],
  ['/portal/claims-title-hotfix','rona-claims-title-loader'],
  ['/portal/applications-total-kpi-ui','rona-applications-total-kpi-loader'],
  ['/portal/owner-layout-polish-ui?v=20260824-1346','rona-owner-layout-polish-loader'],
  ['/portal/admin-access-ui','rona-admin-access-ui-loader']
];
const POSTCORE=[
  ['/portal/clients-agents-canonical-guard-ui?v=20260824-2008','rona-postcore-access-ownership'],
  ['/portal/remaining-sections-ui?v=20260824-1948','rona-postcore-remaining'],
  ['/portal/remaining-sections-final-polish-ui?v=20260824-1602','rona-postcore-polish'],
  ['/portal/remaining-sections-functional-preserve-v2-ui?v=20260824-analytics-compat','rona-postcore-preserve'],
  ['/portal/clients-agents-v4-ui?v=20260824-2018-home-parity-v1','rona-postcore-access-v4'],
  ['/portal/analytics-v2-ui?v=20260824-v3-market-rona-lpg','rona-postcore-analytics-v2']
];

function forceStyle(el,name,value){
  if(el&&el.style&&(el.style.getPropertyValue(name)!==value||el.style.getPropertyPriority(name)!=='important')){
    el.style.setProperty(name,value,'important');
  }
}
function own(pageId,rootId,flag,readyClass,fallbackClass){
  if(window[flag]!==true)return;
  const p=document.querySelector(pageId);
  const r=p&&p.querySelector(':scope>'+rootId);
  if(!p||!r)return;
  root.classList.add(readyClass);
  root.classList.remove(fallbackClass);
  p.classList.remove('rona-rs-gated');
  p.querySelector(':scope>.rona-rs-loading')?.remove();
  forceStyle(r,'display','grid');
  forceStyle(r,'visibility','visible');
  forceStyle(r,'opacity','1');
  forceStyle(r,'pointer-events','auto');
  r.removeAttribute('aria-hidden');
  for(const x of Array.from(p.children)){
    if(x===r)continue;
    forceStyle(x,'display','none');
    forceStyle(x,'visibility','hidden');
    forceStyle(x,'opacity','0');
    forceStyle(x,'pointer-events','none');
    x.setAttribute('aria-hidden','true');
  }
}
function enforceOwners(){
  own('#page-access','#rona-ca4','__RONA_CLIENTS_AGENTS_V4_READY__','rona-access-v4-ready','rona-access-fallback');
  own('#page-analytics','#rona-analytics-v2','__RONA_ANALYTICS_V2_READY__','rona-analytics-v2-ready','rona-analytics-fallback');
}
function installOwnerGuards(){
  for(const sel of ['#page-access','#page-analytics']){
    const p=document.querySelector(sel);
    if(!p||p.__ronaFastOwnerGuard)continue;
    p.__ronaFastOwnerGuard=true;
    new MutationObserver(()=>queueMicrotask(enforceOwners)).observe(p,{childList:true});
  }
  document.addEventListener('click',event=>{
    const b=event.target?.closest?.('#nav button[data-page]');
    if(!b||!['access','analytics'].includes(String(b.dataset.page||'')))return;
    queueMicrotask(enforceOwners);
    [80,240,700].forEach(ms=>setTimeout(enforceOwners,ms));
  },true);
}

async function loadUi(){
  for(const [src,id] of CORE)await safeLoad(src,id);
  window.__RONA_ADMIN_FAST_CORE_LOADED__=true;
  revealShell('core-loaded');
  kickServerBootstrap();

  for(let i=0;i<OPTIONAL.length;i+=3){
    await Promise.allSettled(OPTIONAL.slice(i,i+3).map(([src,id])=>safeLoad(src,id)));
  }

  window.__RONA_POSTCORE_ENHANCEMENTS__='fast-static-v1';
  window.__RONA_ACCESS_CANONICAL_V4__=true;
  window.__RONA_ANALYTICS_CANONICAL_V2__=true;
  for(const [src,id] of POSTCORE)await safeLoad(src,id);
  installOwnerGuards();
  enforceOwners();
  window.__RONA_POSTCORE_ENHANCEMENTS_READY__=true;

  await safeLoad('/portal/admin-canonical-tweaks-ui?v=20260825-0352','rona-admin-canonical-tweaks-loader');
  await safeLoad('/portal/prices-current-ui?v=20260825-2055-centered-modal-v4','rona-prices-current-loader');
  window.__RONA_ADMIN_FAST_UI_LOADED__=true;
  revealShell('ui-loaded');
  bootAuthority();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{revealShell();loadUi()},{once:true});
}else{
  revealShell();
  loadUi();
}

if(!window.__RONA_ADMIN_LIVE_AUTHORITY_ADAPTER__){
  window.__RONA_ADMIN_LIVE_AUTHORITY_ADAPTER__=true;
  window.__RONA_ADMIN_LIVE_READY__=false;
  window.__RONA_ADMIN_LIVE_ERROR__=null;
  window.__RONA_ADMIN_AGENT_ACCESS_READY__=false;
  const BASE='/portal/admin-authority';

  async function call(path,options){
    const init=Object.assign({credentials:'same-origin',cache:'no-store',headers:{}},options||{});
    const r=await fetch(BASE+path,init);
    const j=await r.json().catch(()=>({}));
    if(!r.ok||j?.ok===false){
      const e=new Error(String(j?.code||('HTTP_'+r.status)));
      e.code=String(j?.code||'REQUEST_FAILED');
      e.status=r.status;
      e.payload=j;
      throw e;
    }
    return j;
  }

  async function coreBootstrap(){
    const r=await fetch('/portal/api/v1/admin/bootstrap',{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j?.ok)throw new Error(String(j?.code||'ADMIN_BOOTSTRAP_FAILED'));
    return j.data;
  }

  function mapUserStatus(v){
    v=String(v||'').toUpperCase();
    if(v==='ACTIVE')return'АКТИВЕН';
    if(v==='SUSPENDED'||v==='REVOKED'||v==='ARCHIVED')return'ЗАБЛОКИРОВАН';
    return'ОЖИДАЕТ АКТИВАЦИИ';
  }
  function mapBindingStatus(v){
    v=String(v||'').toUpperCase();
    if(v==='REVOKED'||v==='EXPIRED')return'ОТОЗВАН';
    if(v==='SUSPENDED')return'ПРИОСТАНОВЛЕН';
    if(v==='ACTIVE')return'АКТИВЕН';
    return'ОЖИДАЕТ';
  }

  function applyLiveContracts(authority){
    try{
      if(typeof companies==='undefined'||!Array.isArray(companies))return;
      const live=new Map((authority.contracts||[]).map(x=>[String(x.contractId),x]));
      for(const c of companies){
        const x=live.get(String(c.id));
        if(!x)continue;
        c.name=String(x.legalName||c.name);
        c.clientId=String(x.clientId||c.clientId);
        c.contractNumber=String(x.currentExternalContractNumber||x.contractId||c.id);
        c.contractDate=x.effectiveFrom?String(x.effectiveFrom).slice(0,10):(x.signedAt?String(x.signedAt).slice(0,10):c.contractDate);
        c.status=String(x.contractStatus||c.status);
        const ready=String(x.contractStatus||'')==='ACTIVE'&&
          String(x.lifecycleState||'')==='ACTIVE'&&
          ['CONFIRMED','VERIFIED'].includes(String(x.authorityState||''));
        c.dataStatus=ready?String(x.authorityState):'TO_VERIFY';
        c.authorityNote='Server authority: status='+String(x.contractStatus||'')+
          '; authority='+String(x.authorityState||'')+
          '; lifecycle='+String(x.lifecycleState||'');
      }
    }catch(e){recordError('authority-contracts',e)}
  }

  function applyAccess(authority){
    try{
      if(typeof state==='undefined'||!state)return;
      state.accessUsers=(authority.accessUsers||[]).map(u=>({
        id:String(u.id),
        name:String(u.name||''),
        login:String(u.login||''),
        role:String(u.role||'Клиент'),
        online:!!u.online,
        last:u.last||'—',
        status:mapUserStatus(u.status),
        bindings:(u.bindings||[]).map(b=>({
          id:String(b.id||''),
          company:String(b.company||''),
          clientId:String(b.clientId||''),
          contractId:String(b.contractId||''),
          status:mapBindingStatus(b.status),
          role:String(b.role||'Уполномоченный представитель'),
          dealScopeMode:String(b.dealScopeMode||'')
        }))
      }));
      if(typeof companies!=='undefined'&&Array.isArray(companies)){
        for(const c of companies){
          c.users=state.accessUsers.filter(u=>(u.bindings||[]).some(b=>b.contractId===c.id&&b.status!=='ОТОЗВАН')).length;
          c.online=state.accessUsers.filter(u=>u.online&&(u.bindings||[]).some(b=>b.contractId===c.id&&b.status!=='ОТОЗВАН')).length;
        }
      }
      if(typeof renderAccess==='function')renderAccess();
    }catch(e){recordError('authority-access',e)}
  }

  function applySignedGate(authority){
    try{
      window.__RONA_ADMIN_SIGNED_CONTRACT_BOOTSTRAP__=authority.signedContractGate||{scope:'ADMIN_SIGNED_CONTRACT_GATE',mode:'SNAPSHOT',contracts:[]};
      window.RONA_ADMIN_SIGNED_CONTRACT_GATE?.setData?.(window.__RONA_ADMIN_SIGNED_CONTRACT_BOOTSTRAP__);
    }catch(e){recordError('authority-signed-gate',e)}
  }

  function enableExistingAgentAccessOption(){
    try{
      if(window.__RONA_ADMIN_AGENT_ACCESS_READY__!==true)return;
      const select=document.getElementById('newRole');
      if(!select)return;
      for(const option of Array.from(select.options||[])){
        if(String(option.textContent||'').trim().startsWith('Агент')){
          option.value='Агент';
          option.disabled=false;
        }
      }
    }catch(e){recordError('authority-agent-option',e)}
  }

  function wrapOpenModalForAgentAccess(){
    try{
      const current=window.openModal;
      if(typeof current!=='function'||current.__ronaAgentAccessWrapped===true)return;
      const wrapped=function(...args){
        const result=current.apply(this,args);
        if(args[0]==='create-access')enableExistingAgentAccessOption();
        return result;
      };
      Object.defineProperty(wrapped,'__ronaAgentAccessWrapped',{value:true});
      window.openModal=wrapped;
    }catch(e){recordError('authority-modal-wrap',e)}
  }

  function activateAgentAccess(){
    wrapOpenModalForAgentAccess();
    enableExistingAgentAccessOption();
  }
  document.addEventListener('click',()=>queueMicrotask(activateAgentAccess),true);
  [0,250,1000,3000].forEach(ms=>setTimeout(activateAgentAccess,ms));

  let authorityBusy=false;
  async function refreshAuthority(){
    if(authorityBusy||window.__RONA_ADMIN_SESSION_STATE__!=='VERIFIED')return null;
    authorityBusy=true;
    try{
      const corePromise=coreBootstrap();
      const authorityPromise=call('/bootstrap');
      let agentReadiness={ok:false,data:{matrixReady:false,profiles:[]}};
      try{agentReadiness=await call('/agent-readiness')}
      catch(e){recordError('authority-agent-readiness',e)}
      const [core,authorityEnvelope]=await Promise.all([corePromise,authorityPromise]);
      const authority=authorityEnvelope.data||{};
      applyLiveContracts(authority);
      applySignedGate(authority);
      applyAccess(authority);
      window.__RONA_ADMIN_AGENT_ACCESS_READY__=agentReadiness?.data?.matrixReady===true;
      activateAgentAccess();
      window.__RONA_ADMIN_LIVE_SNAPSHOT__={core,authority,agentAccessReadiness:agentReadiness?.data||null,at:new Date().toISOString()};
      window.__RONA_ADMIN_LIVE_ERROR__=null;
      window.__RONA_ADMIN_LIVE_READY__=true;
      return window.__RONA_ADMIN_LIVE_SNAPSHOT__;
    }catch(e){
      window.__RONA_ADMIN_LIVE_READY__=false;
      window.__RONA_ADMIN_LIVE_ERROR__=String(e?.code||e?.message||e);
      recordError('authority-refresh',e);
      return null;
    }finally{
      authorityBusy=false;
    }
  }

  function formForSigned(req){
    const fd=new FormData();
    fd.set('clientId',String(req.clientId||''));
    fd.set('adminClaimsBilateralSigned',String(req.adminClaimsBilateralSigned===true));
    fd.set('adminAttestation',JSON.stringify(req.adminAttestation||{}));
    fd.set('file',req.signedContractFile);
    return fd;
  }

  async function attachSignedContractToExistingContract(req){
    const j=await call('/contracts/'+encodeURIComponent(req.contractId)+'/signed-document/attach',{method:'POST',body:formForSigned(req)});
    await refreshAuthority();
    return j;
  }
  async function replaceSignedContractVersion(req){
    const headers={'x-current-document-id':String(req.currentDocumentId||'')};
    const j=await call('/contracts/'+encodeURIComponent(req.contractId)+'/signed-document/replace',{method:'POST',headers,body:formForSigned(req)});
    await refreshAuthority();
    return j;
  }
  async function downloadSignedContract(req){
    return call('/documents/'+encodeURIComponent(req.documentId)+'/download?clientId='+encodeURIComponent(req.clientId)+'&contractId='+encodeURIComponent(req.contractId));
  }
  async function askAdminPassword(firstLabel='Установите первоначальный пароль для учётной записи'){
    const dialogs=window.RONA_ADMIN_DIALOGS;
    if(!dialogs||typeof dialogs.password!=='function'){
      const e=new Error('ADMIN_DIALOG_UNAVAILABLE');
      e.code='ADMIN_DIALOG_UNAVAILABLE';
      throw e;
    }
    return String(await dialogs.password(firstLabel));
  }
  async function createAccessUser(req){
    const initialPassword=String(req.initialPassword||await askAdminPassword());
    const payload=Object.assign({},req,{
      email:String(document.querySelector('#newEmail')?.value||req.email||'').trim(),
      phone:String(document.querySelector('#newPhone')?.value||req.phone||'').trim(),
      initialPassword
    });
    const j=await call('/access/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    await refreshAuthority();
    return j;
  }
  async function setAccessUserPassword(req){
    const password=String(req.password||await askAdminPassword('Установите новый пароль'));
    const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/password',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
    await refreshAuthority();
    return j;
  }
  async function linkContractsToUser(req){
    const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/contracts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({contractIds:req.contractIds||[]})});
    await refreshAuthority();
    return j;
  }
  async function revokeBinding(req){
    const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/contracts/'+encodeURIComponent(req.contractId)+'/revoke',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    await refreshAuthority();
    return j;
  }
  async function restoreBinding(req){
    const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/contracts/'+encodeURIComponent(req.contractId)+'/restore',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    await refreshAuthority();
    return j;
  }
  async function blockAccessUser(req){
    const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/block',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    await refreshAuthority();
    return j;
  }
  async function unblockAccessUser(req){
    const j=await call('/access/users/'+encodeURIComponent(req.userId)+'/unblock',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    await refreshAuthority();
    return j;
  }

  window.__RONA_PORTAL_BACKEND__=Object.freeze({
    attachSignedContractToExistingContract,
    replaceSignedContractVersion,
    downloadSignedContract,
    createAccessUser,
    setAccessUserPassword,
    linkContractsToUser,
    revokeBinding,
    restoreBinding,
    blockAccessUser,
    unblockAccessUser,
    syncCanonical:async()=>{await refreshAuthority();return{ok:true,status:'SERVER_READ_REFRESHED'}}
  });
  window.__RONA_ADMIN_REFRESH_AUTHORITY__=refreshAuthority;
}

window.addEventListener('rona:admin-app-ready',()=>{
  bootAuthority();
  revealShell('admin-app-ready');
});
[0,300,1200,3500].forEach(ms=>setTimeout(kickServerBootstrap,ms));

(function installLogout(){
  if(window.__RONA_PORTAL_LOGOUT_RUNTIME__)return;
  window.__RONA_PORTAL_LOGOUT_RUNTIME__=true;
  const HOME='https://ronaoil.com';
  const norm=v=>String(v||'').trim().toLocaleLowerCase('ru-RU');
  let signingOut=false;

  function control(){
    const direct=document.querySelector('#adminLogoutBtn,#ronaLogout,[data-action="logout"],[data-logout],a[href="/portal/logout"],a[href="/portal/auth/logout"],form[action="/portal/logout"] button,form[action="/portal/auth/logout"] button');
    if(direct)return direct;
    return Array.from(document.querySelectorAll('button,a,[role="button"]')).find(el=>['выход','выйти','logout'].includes(norm(el.textContent)))||null;
  }
  async function signOut(event){
    if(event){event.preventDefault();event.stopImmediatePropagation()}
    if(signingOut)return;
    signingOut=true;
    const b=event?.currentTarget||event?.target;
    if(b&&'disabled'in b)b.disabled=true;
    try{await fetch('/portal/logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}})}
    catch(e){recordError('logout',e)}
    finally{window.location.replace(HOME)}
  }
  function bind(){
    const b=control();
    if(!b||b.dataset.ronaLogoutBound==='true')return;
    if(['выйти','logout'].includes(norm(b.textContent)))b.textContent='Выход';
    b.setAttribute('aria-label','Выход');
    b.dataset.ronaLogoutBound='true';
    b.addEventListener('click',signOut,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else queueMicrotask(bind);
  document.addEventListener('click',()=>queueMicrotask(bind),true);
})();

window.addEventListener('pageshow',event=>{
  const nav=performance.getEntriesByType?.('navigation')?.[0];
  if(event.persisted||nav?.type==='back_forward')probeSessionOnce();
});
})();
