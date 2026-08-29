(()=>{'use strict';
const MARK='20260829-client-application-authoritative-active-v2';
if(window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__===MARK)return;
window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api',REFRESH_MS=30000;
const state={activeIds:new Set(),ready:false,loading:false,lastLoad:0,timer:0,observer:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0};
const APP_ID_RE=/\bRONA-C\d{3}-IN-\d{4}-\d{3,}\b/g;

async function request(path){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.ok===false)throw new Error(String(b?.code||b?.error?.code||('HTTP_'+r.status)));
  return b;
}
async function loadAuthoritativeActiveApplications(force=false){
  if(state.loading)return;
  if(!force&&state.ready&&Date.now()-state.lastLoad<REFRESH_MS){apply();return}
  state.loading=true;
  try{
    const boot=await request('/v1/client/bootstrap');
    const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];
    const details=await Promise.all(contexts.map(async ctx=>{
      const clientId=norm(ctx?.client_id),contractId=norm(ctx?.contract_id);
      if(!clientId||!contractId)throw new Error('CLIENT_CONTEXT_ID_MISSING');
      return request('/v1/client/context?clientId='+encodeURIComponent(clientId)+'&contractId='+encodeURIComponent(contractId));
    }));
    const active=new Set();
    for(const detail of details){
      for(const app of Array.isArray(detail?.data?.applications)?detail.data.applications:[]){
        const id=norm(app?.application_id||app?.applicationId||app?.id);
        if(id)active.add(id);
      }
    }
    state.activeIds=active;
    state.ready=true;
    state.lastLoad=Date.now();
    window.__RONA_CLIENT_APPLICATION_ACTIVE_STATE__={version:MARK,source:'AUTHORITATIVE_CLIENT_CONTEXT',active_application_ids:[...active],loaded_at:new Date().toISOString()};
    apply();
  }catch(error){
    console.error('RONA client application projection',error);
    state.ready=false;
    apply();
  }finally{state.loading=false}
}
function applicationsRoot(){
  for(const selector of ['#page-applications','#applicationsPage','[data-page-panel="applications"]','[data-page-id="applications"]']){
    const el=document.querySelector(selector);if(el)return el;
  }
  let best=null;
  for(const el of document.querySelectorAll('main section,main div,section,article')){
    if(!visible(el))continue;
    const t=norm(el.textContent);
    if(!t.includes('Заявки')||!t.includes('Все статусы')||!t.includes('зарегистрировано'))continue;
    if(!best||t.length<norm(best.textContent).length)best=el;
  }
  return best;
}
function displayedApplicationIds(root){
  const ids=new Set();
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    const matches=String(node.nodeValue||'').match(APP_ID_RE)||[];
    for(const id of matches)ids.add(id);
  }
  return [...ids];
}
function leafWithText(root,text){return [...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent).includes(text))}
function rowFor(root,id,allIds){
  for(const leaf of leafWithText(root,id)){
    let node=leaf,candidate=null;
    for(let depth=0;node&&node!==root&&depth<12;depth++,node=node.parentElement){
      const t=norm(node.textContent);
      if(!t.includes(id))continue;
      const idsPresent=allIds.filter(x=>x&&t.includes(x));
      const hasRowContext=t.includes('Принята')||t.includes('Принято')||t.includes('Открыть')||t.includes('Сделка')||t.includes('DEAL-');
      if(idsPresent.length===1&&hasRowContext&&t.length<2600)candidate=node;
      if(idsPresent.length>1)break;
    }
    if(candidate)return candidate;
  }
  return null;
}
function hideStatusLabels(root){
  for(const el of root.querySelectorAll('*')){
    if(el.childElementCount===0&&norm(el.textContent)==='Статус'){
      el.style.display='none';
      el.setAttribute('data-rona-status-label-removed','true');
    }
  }
}
function projectRows(root,ids){
  if(!state.ready)return;
  for(const id of ids){
    const row=rowFor(root,id,ids);if(!row)continue;
    if(state.activeIds.has(id)){
      if(row.hasAttribute('data-rona-application-projection')||row.hasAttribute('data-rona-application-archived')){
        row.hidden=false;
        row.style.removeProperty('display');
        row.removeAttribute('data-rona-application-projection');
        row.removeAttribute('data-rona-application-archived');
      }
    }else{
      row.hidden=true;
      row.style.display='none';
      row.setAttribute('data-rona-application-projection','authoritative-not-active');
    }
  }
}
function syncCounter(root,ids){
  if(!state.ready)return;
  let count=0;
  for(const id of ids){
    const row=rowFor(root,id,ids);
    if(row&&state.activeIds.has(id)&&visible(row))count++;
  }
  for(const el of root.querySelectorAll('*')){
    if(el.childElementCount!==0)continue;
    if(/^\d+\s+зарегистрировано$/iu.test(norm(el.textContent)))el.textContent=`${count} зарегистрировано`;
  }
}
function apply(){
  const root=applicationsRoot();if(!root)return false;
  const ids=displayedApplicationIds(root);
  hideStatusLabels(root);
  projectRows(root,ids);
  syncCounter(root,ids);
  root.setAttribute('data-rona-application-lifecycle',state.ready?'authoritative-active-v2':'authoritative-pending-v2');
  return true;
}
function schedule(delay=0){clearTimeout(state.timer);state.timer=setTimeout(apply,delay)}
function start(){
  apply();
  loadAuthoritativeActiveApplications(true);
  state.observer=new MutationObserver(()=>schedule(30));
  state.observer.observe(document.body,{childList:true,subtree:true});
  setInterval(()=>loadAuthoritativeActiveApplications(false),REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
document.addEventListener('click',()=>schedule(60),true);
document.addEventListener('change',()=>schedule(60),true);
window.addEventListener('pageshow',()=>loadAuthoritativeActiveApplications(true),{passive:true});
window.addEventListener('hashchange',()=>schedule(20),{passive:true});
window.addEventListener('rona:client-application-submitted',()=>setTimeout(()=>loadAuthoritativeActiveApplications(true),150));
})();
