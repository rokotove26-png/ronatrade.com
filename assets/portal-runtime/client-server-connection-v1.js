(()=>{'use strict';
const MARK='20260830-client-server-connection-v1';
if(window.__RONA_CLIENT_SERVER_CONNECTION__===MARK)return;
window.__RONA_CLIENT_SERVER_CONNECTION__=MARK;
if(location.pathname!=='/portal/client')return;

const STYLE_ID='ronaClientServerConnectionV1Style';
const state={status:'checking',httpStatus:null,lastSuccessAt:null,observer:null,rendering:false,timer:0};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`[data-rona-server-connection-indicator="true"] [data-rona-server-label]{display:inline-flex!important;align-items:center!important;gap:6px!important}[data-rona-server-connection-indicator="true"] .rona-server-dot{display:inline-block;width:6px;height:6px;border-radius:50%;flex:0 0 6px;box-shadow:0 0 8px currentColor}[data-rona-server-connection-indicator="true"][data-rona-server-state="online"] .rona-server-dot{color:#58d68d;background:#58d68d}[data-rona-server-connection-indicator="true"][data-rona-server-state="checking"] .rona-server-dot{color:#e6be52;background:#e6be52}[data-rona-server-connection-indicator="true"][data-rona-server-state="degraded"] .rona-server-dot,[data-rona-server-connection-indicator="true"][data-rona-server-state="offline"] .rona-server-dot{color:#e86767;background:#e86767}`;
  document.head.appendChild(style);
}
function findTarget(){
  const selectors=['.rona-topbar-actions .role-pill','[class*="topbar-actions"] [class*="role-pill"]','header .role-pill','header [class*="role-pill"]'];
  for(const selector of selectors){
    for(const el of document.querySelectorAll(selector)){
      if(el.dataset?.ronaServerConnectionIndicator==='true')return el;
      const text=low(el.textContent);
      if(text.includes('сделки')&&(text.includes('открыт')||text==='сделки'))return el;
      const kicker=el.querySelector('.role-pill-kicker,[class*="role-pill-kicker"]');
      if(kicker&&low(kicker.textContent)==='сделки')return el;
    }
  }
  return null;
}
function labelFor(status){
  if(status==='online')return'Подключено';
  if(status==='degraded')return'Сервер недоступен';
  if(status==='offline')return'Нет связи';
  return'Проверка';
}
function titleFor(status){
  const when=state.lastSuccessAt?` Последний успешный обмен: ${new Date(state.lastSuccessAt).toLocaleTimeString('ru-RU')}.`:'';
  if(status==='online')return'Соединение с сервером RONA Trade активно.'+when;
  if(status==='degraded')return`Сервер RONA Trade ответил ошибкой${state.httpStatus?' '+state.httpStatus:''}.`+when;
  if(status==='offline')return'Нет соединения с сервером RONA Trade.'+when;
  return'Проверка соединения с сервером RONA Trade.';
}
function updateIndicator(host){
  if(!host)return;
  host.dataset.ronaServerState=state.status;
  const label=host.querySelector('[data-rona-server-label-text]');
  if(label)label.textContent=labelFor(state.status);
  host.title=titleFor(state.status);
  host.setAttribute('aria-label','Сервер: '+labelFor(state.status));
}
function ensureIndicator(){
  if(state.rendering)return document.querySelector('[data-rona-server-connection-indicator="true"]');
  state.rendering=true;
  try{
    ensureStyle();
    let host=document.querySelector('[data-rona-server-connection-indicator="true"]');
    if(!host)host=findTarget();
    if(!host)return null;
    if(host.dataset.ronaServerConnectionIndicator!=='true'){
      host.dataset.ronaServerConnectionIndicator='true';
      host.setAttribute('role','status');
      host.setAttribute('aria-live','polite');
      host.innerHTML='<span class="role-pill-kicker" data-rona-server-kicker>Сервер</span><span class="role-pill-title" data-rona-server-label><span class="rona-server-dot" aria-hidden="true"></span><span data-rona-server-label-text>Проверка</span></span>';
    }
    updateIndicator(host);
    return host;
  }finally{state.rendering=false}
}
function setStatus(status,httpStatus=null){
  state.status=status;
  state.httpStatus=httpStatus;
  if(status==='online')state.lastSuccessAt=Date.now();
  updateIndicator(ensureIndicator());
  document.documentElement.dataset.ronaServerConnection=status;
}
function apiRequest(input){
  let raw='';
  if(typeof input==='string')raw=input;
  else if(input instanceof URL)raw=input.href;
  else if(input&&typeof input.url==='string')raw=input.url;
  if(!raw)return false;
  try{
    const url=new URL(raw,location.origin);
    return url.origin===location.origin&&url.pathname.startsWith('/portal/api/');
  }catch{return false}
}
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const watched=apiRequest(input);
  try{
    const response=await nativeFetch(input,init);
    if(watched){
      if(response.status>=500)setStatus('degraded',response.status);
      else setStatus('online',response.status);
    }
    return response;
  }catch(error){
    if(watched)setStatus('offline',null);
    throw error;
  }
};
function schedule(){
  clearTimeout(state.timer);
  state.timer=setTimeout(()=>ensureIndicator(),80);
}
function start(){
  ensureIndicator();
  setStatus(navigator.onLine===false?'offline':'checking');
  if(!state.observer){
    state.observer=new MutationObserver(()=>{if(!state.rendering)schedule()});
    state.observer.observe(document.body,{childList:true,subtree:true});
  }
}
window.addEventListener('offline',()=>setStatus('offline'));
window.addEventListener('online',()=>setStatus('checking'));
window.addEventListener('pageshow',schedule,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
