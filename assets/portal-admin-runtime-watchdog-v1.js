(()=>{'use strict';
if(window.__RONA_ADMIN_RUNTIME_WATCHDOG__)return;
window.__RONA_ADMIN_RUNTIME_WATCHDOG__='current-only-recovery-v1';

const SHELL_ID='rona-admin-fast-shell-runtime';
const MAIN_ID='rona-main-ui-loader';
const SHELL_SRC='/assets/portal-admin-shell-fast-v1.js?v=20260826-current-only-v1';
const MAIN_SRC='/portal/main-ui?v=20260826-runtime-recovery-v1';
const RELOAD_KEY='rona_admin_runtime_recovery_reload_v1';
const state=window.__RONA_ADMIN_RUNTIME_RECOVERY__={
  version:'current-only-recovery-v1',
  status:'BOOTING',
  shellAttempts:0,
  mainAttempts:0,
  reloads:0,
  recovered:false,
  lastError:null,
  events:[]
};
let running=false;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function note(stage,error){
  const item={stage:String(stage),error:String(error?.message||error||'UNKNOWN'),at:new Date().toISOString()};
  state.lastError=item;
  state.events.push(item);
  if(state.events.length>20)state.events.shift();
  console.warn('[RONA Admin recovery]',item.stage,item.error);
}
function shellReady(){return window.__RONA_ADMIN_SHELL_RESILIENCE__==='fast-static-v1'}
function mainReady(){return window.__RONA_MAIN_UI_RUNTIME_LOADED__===true}
function ownerReady(){return window.__RONA_OWNER_ADMIN_READY__===true}
function homeEscapedStaticPlaceholder(){
  const p=document.querySelector('#page-home');
  if(!p)return false;
  return !p.querySelector(':scope > .rona-owner-page-content')&&!!p.querySelector('.current-loading');
}
function setLoadingStatus(text){
  const n=document.querySelector('#page-home .current-loading-sub')||document.querySelector('#ronaHomeLoading .rona-owner-muted');
  if(n)n.textContent=String(text);
}
function waitFor(predicate,timeout=5000,interval=100){
  return new Promise(resolve=>{
    const started=Date.now();
    const tick=()=>{
      let ok=false;
      try{ok=!!predicate()}catch(_e){}
      if(ok)return resolve(true);
      if(Date.now()-started>=timeout)return resolve(false);
      setTimeout(tick,interval);
    };
    tick();
  });
}
function retryUrl(src,attempt){
  const u=new URL(src,location.href);
  u.searchParams.set('_rona_recovery_attempt',String(attempt));
  u.searchParams.set('_rona_recovery_ts',String(Date.now()));
  return u.pathname+u.search;
}
function injectScript(src,id,attempt,timeout=12000){
  return new Promise((resolve,reject)=>{
    const prior=document.getElementById(id);
    if(prior)prior.remove();
    const s=document.createElement('script');
    s.id=id;
    s.src=retryUrl(src,attempt);
    s.async=false;
    s.dataset.ronaRecovery='current-only-recovery-v1';
    s.dataset.ronaRecoveryAttempt=String(attempt);
    let done=false;
    const finish=(ok,value)=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      s.onload=null;
      s.onerror=null;
      if(!ok){try{s.remove()}catch(_e){}}
      ok?resolve(value):reject(value);
    };
    const timer=setTimeout(()=>finish(false,new Error('SCRIPT_TIMEOUT:'+id)),timeout);
    s.onload=()=>finish(true,s);
    s.onerror=()=>finish(false,new Error('SCRIPT_LOAD_FAILED:'+id));
    (document.body||document.documentElement).appendChild(s);
  });
}
async function recoverShell(){
  if(shellReady())return true;
  setLoadingStatus('Восстанавливаю загрузку интерфейса…');
  const delays=[250,800,1800];
  for(let i=0;i<delays.length;i++){
    await sleep(delays[i]);
    if(shellReady())return true;
    state.shellAttempts++;
    try{
      await injectScript(SHELL_SRC,SHELL_ID,state.shellAttempts,10000);
      if(await waitFor(shellReady,2500)){
        state.recovered=true;
        return true;
      }
    }catch(e){note('shell-retry-'+state.shellAttempts,e)}
  }
  return shellReady();
}
async function recoverMain(){
  if(mainReady())return true;
  setLoadingStatus('Восстанавливаю основной модуль кабинета…');
  const delays=[300,900,2200,4200];
  for(let i=0;i<delays.length;i++){
    await sleep(delays[i]);
    if(mainReady())return true;
    state.mainAttempts++;
    try{
      await injectScript(MAIN_SRC,MAIN_ID,state.mainAttempts,12000);
      if(await waitFor(mainReady,3500)){
        state.recovered=true;
        return true;
      }
    }catch(e){note('main-retry-'+state.mainAttempts,e)}
  }
  return mainReady();
}
function showTerminalRecovery(reason){
  state.status='DEGRADED';
  note('terminal',reason);
  const host=document.querySelector('#page-home .current-loading-card')||document.querySelector('#page-home>.rona-owner-page-content')||document.querySelector('#page-home');
  if(!host)return;
  let box=document.getElementById('ronaAdminRuntimeRecoveryBox');
  if(box)return;
  box=document.createElement('div');
  box.id='ronaAdminRuntimeRecoveryBox';
  box.style.cssText='margin-top:14px;padding:14px;border:1px solid rgba(255,199,107,.42);border-radius:12px;background:rgba(255,199,107,.06)';
  const text=document.createElement('div');
  text.textContent='Интерфейс не завершил загрузку. Сессия сохранена.';
  const btn=document.createElement('button');
  btn.type='button';
  btn.textContent='Повторить загрузку';
  btn.style.cssText='margin-top:10px;padding:8px 12px;border:1px solid rgba(255,255,255,.24);border-radius:9px;background:rgba(8,16,25,.85);color:inherit;cursor:pointer;font-weight:700';
  btn.onclick=()=>{try{sessionStorage.removeItem(RELOAD_KEY)}catch(_e){}location.reload()};
  box.append(text,btn);
  host.append(box);
}
function hardReloadOnce(reason){
  let last=0;
  try{last=Number(sessionStorage.getItem(RELOAD_KEY)||0)}catch(_e){}
  const now=Date.now();
  if(last&&now-last<90000){
    showTerminalRecovery(reason);
    return false;
  }
  try{sessionStorage.setItem(RELOAD_KEY,String(now))}catch(_e){}
  state.reloads++;
  state.status='RELOADING';
  note('hard-reload',reason);
  const u=new URL(location.href);
  u.searchParams.set('_rona_recover',String(now));
  location.replace(u.toString());
  return true;
}
async function run(){
  if(running)return;
  running=true;
  try{
    state.status='WAITING_SHELL';
    if(!shellReady()){
      await waitFor(shellReady,4500);
      if(!shellReady()&&!await recoverShell())return void hardReloadOnce('FAST_SHELL_NOT_READY');
    }

    state.status='WAITING_MAIN';
    if(!mainReady()){
      await waitFor(mainReady,13500);
      if(!mainReady()&&!await recoverMain())return void hardReloadOnce('MAIN_UI_NOT_READY');
    }

    state.status='WAITING_OWNER';
    if(!ownerReady()){
      const ok=await waitFor(ownerReady,9000);
      if(!ok)return void hardReloadOnce('OWNER_ADMIN_NOT_READY');
    }

    state.status='VERIFYING_HOME';
    await sleep(1500);
    if(homeEscapedStaticPlaceholder())return void hardReloadOnce('HOME_STATIC_PLACEHOLDER_STUCK');

    state.status='READY';
    window.__RONA_ADMIN_RUNTIME_RECOVERY_READY__=true;
    if(state.recovered)setLoadingStatus('Интерфейс восстановлен. Загружаю актуальные данные…');
  }catch(e){
    note('watchdog',e);
    hardReloadOnce('WATCHDOG_EXCEPTION');
  }finally{
    running=false;
  }
}
function boot(){
  setTimeout(run,0);
  window.addEventListener('online',()=>setTimeout(run,250),{passive:true});
  window.addEventListener('pageshow',()=>setTimeout(run,250),{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
