(()=>{'use strict';
const MARK='20260829-client-operations-authoritative-state-v5';
if(window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__===MARK)return;
window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api',REFRESH_MS=30000;
const state={activeIds:new Set(),dealStates:new Map(),ready:false,loading:false,lastLoad:0,timer:0,observer:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0};
const APP_ID_RE=/\bRONA-C\d{3}-IN-\d{4}-\d{3,}\b/g;
const DEAL_ID_RE=/\bDEAL-\d{4}-\d{3,}\b/g;
const DEAL_AMOUNT_RE=/^\d[\d\s.,]*\s*(?:долл\.?\s*США|USD|сом|KGS|руб\.?|RUB|₽|EUR|€)$/iu;
const RESOURCE_STATE_RE=/^(?:Ресурс|Ресурс\s+подтвержд[её]н|Ресурс\s+не\s+подтвержд[её]н|Подтвержд[её]н|Не\s+подтвержд[её]н|Ожидание\s+подтверждения\s+ресурса)$/iu;

async function request(path){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.ok===false)throw new Error(String(b?.code||b?.error?.code||('HTTP_'+r.status)));
  return b;
}
function operationsResourceState(businessStatus){
  const s=norm(businessStatus).toUpperCase();
  if(s==='EXECUTING')return{code:'RESOURCE_CONFIRMED',label:'Ресурс подтверждён'};
  if(s==='CANCELLED')return{code:'DEAL_CANCELLED',label:'Сделка отменена'};
  return{code:'RESOURCE_PENDING',label:'Ожидание подтверждения ресурса'};
}
function markAuthoritativeReady(){
  document.documentElement.setAttribute('data-rona-client-operations-state','ready');
  document.documentElement.setAttribute('data-rona-client-operations-ready','true');
}
function markAuthoritativeError(){
  document.documentElement.setAttribute('data-rona-client-operations-state','error');
  document.documentElement.removeAttribute('data-rona-client-operations-ready');
}
async function loadAuthoritativeState(force=false){
  if(state.loading)return;
  if(!force&&state.ready&&Date.now()-state.lastLoad<REFRESH_MS){apply();markAuthoritativeReady();return}
  state.loading=true;
  try{
    const boot=await request('/v1/client/bootstrap');
    const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];
    const details=await Promise.all(contexts.map(async ctx=>{
      const clientId=norm(ctx?.client_id),contractId=norm(ctx?.contract_id);
      if(!clientId||!contractId)throw new Error('CLIENT_CONTEXT_ID_MISSING');
      return request('/v1/client/context?clientId='+encodeURIComponent(clientId)+'&contractId='+encodeURIComponent(contractId));
    }));
    const active=new Set(),deals=new Map();
    for(const detail of details){
      for(const app of Array.isArray(detail?.data?.applications)?detail.data.applications:[]){
        const id=norm(app?.application_id||app?.applicationId||app?.id);
        if(id)active.add(id);
      }
      for(const deal of Array.isArray(detail?.data?.deals)?detail.data.deals:[]){
        const id=norm(deal?.deal_id||deal?.dealId||deal?.id),businessStatus=norm(deal?.business_status||deal?.businessStatus||deal?.status);
        if(id)deals.set(id,{dealId:id,businessStatus,...operationsResourceState(businessStatus)});
      }
    }
    state.activeIds=active;
    state.dealStates=deals;
    state.ready=true;
    state.lastLoad=Date.now();
    window.__RONA_CLIENT_APPLICATION_ACTIVE_STATE__={version:MARK,source:'AUTHORITATIVE_CLIENT_CONTEXT',active_application_ids:[...active],loaded_at:new Date().toISOString()};
    window.__RONA_CLIENT_DEAL_OPERATIONS_STATE__={version:MARK,source:'OPERATIONS_DIRECTOR/AUTHORITATIVE_DEALS',deals:[...deals.values()],loaded_at:new Date().toISOString()};
    apply();
    markAuthoritativeReady();
  }catch(error){
    console.error('RONA client authoritative projection',error);
    state.ready=false;
    apply();
    markAuthoritativeError();
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
function dealsRoot(){
  for(const selector of ['#page-deals','#dealsPage','[data-page-panel="deals"]','[data-page-id="deals"]']){
    const el=document.querySelector(selector);if(el)return el;
  }
  let best=null;
  for(const el of document.querySelectorAll('main section,main div,section,article')){
    if(!visible(el))continue;
    const t=norm(el.textContent);
    if(!t.includes('Сделки')||!t.includes('Все этапы')||!DEAL_ID_RE.test(t)){DEAL_ID_RE.lastIndex=0;continue}
    DEAL_ID_RE.lastIndex=0;
    if(!best||t.length<norm(best.textContent).length)best=el;
  }
  return best;
}
function idsFromText(root,re){
  const ids=new Set(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
    const matches=String(node.nodeValue||'').match(re)||[];
    for(const id of matches)ids.add(id);
  }
  return [...ids];
}
function leafWithText(root,text){return [...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent).includes(text))}
function rowFor(root,id,allIds,contextTokens){
  for(const leaf of leafWithText(root,id)){
    let node=leaf,candidate=null;
    for(let depth=0;node&&node!==root&&depth<12;depth++,node=node.parentElement){
      const t=norm(node.textContent);
      if(!t.includes(id))continue;
      const idsPresent=allIds.filter(x=>x&&t.includes(x));
      const hasRowContext=contextTokens.some(token=>t.includes(token));
      if(idsPresent.length===1&&hasRowContext&&t.length<3200)candidate=node;
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
function styleDealAmounts(root,ids){
  for(const id of ids){
    const row=rowFor(root,id,ids,['Сделка','Ресурс','Открыть','Документы']);if(!row)continue;
    for(const el of row.querySelectorAll('*')){
      if(el.childElementCount!==0)continue;
      const text=norm(el.textContent);
      if(text==='Сумма'){
        el.style.display='none';
        el.setAttribute('data-rona-deal-amount-label-removed','true');
        continue;
      }
      if(!DEAL_AMOUNT_RE.test(text))continue;
      el.style.display='inline-flex';
      el.style.alignItems='center';
      el.style.width='fit-content';
      el.style.padding='5px 10px';
      el.style.border='1px solid rgba(78,196,255,.30)';
      el.style.borderRadius='999px';
      el.style.background='rgba(11,34,49,.86)';
      el.style.whiteSpace='nowrap';
      el.setAttribute('data-rona-deal-amount-badge','true');
    }
  }
}
function projectApplicationRows(root,ids){
  if(!state.ready)return;
  for(const id of ids){
    const row=rowFor(root,id,ids,['Принята','Принято','Открыть','Сделка','DEAL-']);if(!row)continue;
    if(state.activeIds.has(id)){
      if(row.hasAttribute('data-rona-application-projection')||row.hasAttribute('data-rona-application-archived')){
        row.hidden=false;row.style.removeProperty('display');row.removeAttribute('data-rona-application-projection');row.removeAttribute('data-rona-application-archived');
      }
    }else{
      row.hidden=true;row.style.display='none';row.setAttribute('data-rona-application-projection','authoritative-not-active');
    }
  }
}
function syncApplicationCounter(root,ids){
  if(!state.ready)return;
  let count=0;
  for(const id of ids){
    const row=rowFor(root,id,ids,['Принята','Принято','Открыть','Сделка','DEAL-']);
    if(row&&state.activeIds.has(id)&&visible(row))count++;
  }
  for(const el of root.querySelectorAll('*')){
    if(el.childElementCount!==0)continue;
    if(/^\d+\s+зарегистрировано$/iu.test(norm(el.textContent)))el.textContent=`${count} зарегистрировано`;
  }
}
function syncResourceState(row,deal){
  const leaves=[...row.querySelectorAll('*')].filter(el=>el.childElementCount===0&&RESOURCE_STATE_RE.test(norm(el.textContent)));
  let anchor=leaves.find(el=>norm(el.textContent)==='Ресурс')||leaves.find(el=>low(el.textContent).includes('ресурс'))||leaves[0]||null;
  if(!anchor){
    anchor=document.createElement('span');
    row.append(anchor);
  }
  for(const el of leaves){
    if(el===anchor)continue;
    el.hidden=true;
    el.style.display='none';
    el.setAttribute('aria-hidden','true');
    el.setAttribute('data-rona-stale-resource-state-removed','true');
  }
  anchor.hidden=false;
  anchor.style.removeProperty('display');
  anchor.removeAttribute('aria-hidden');
  anchor.textContent=deal.label;
  anchor.setAttribute('data-rona-operations-resource-state',deal.code);
  anchor.setAttribute('data-rona-resource-projection','single-authoritative');
  anchor.setAttribute('title','Источник: контур Операционного директора');
}
function projectDealRows(root,ids){
  if(!state.ready)return;
  for(const id of ids){
    const deal=state.dealStates.get(id);
    const row=rowFor(root,id,ids,['Сделка','Ресурс','Открыть','Документы']);
    if(!row)continue;
    if(!deal){row.hidden=true;row.style.display='none';row.setAttribute('data-rona-deal-projection','authoritative-not-current');continue}
    if(row.hasAttribute('data-rona-deal-projection')){row.hidden=false;row.style.removeProperty('display');row.removeAttribute('data-rona-deal-projection')}
    syncResourceState(row,deal);
    row.setAttribute('data-rona-operations-deal-status',deal.businessStatus||'UNKNOWN');
  }
}
function apply(){
  const apps=applicationsRoot();
  if(apps){
    const ids=idsFromText(apps,APP_ID_RE);
    hideStatusLabels(apps);
    projectApplicationRows(apps,ids);
    syncApplicationCounter(apps,ids);
    apps.setAttribute('data-rona-application-lifecycle',state.ready?'authoritative-active-v5':'authoritative-pending-v5');
  }
  const deals=dealsRoot();
  if(deals){
    const ids=idsFromText(deals,DEAL_ID_RE);
    styleDealAmounts(deals,ids);
    projectDealRows(deals,ids);
    deals.setAttribute('data-rona-deal-authority',state.ready?'operations-director-v2':'operations-pending');
  }
  return Boolean(apps||deals);
}
function schedule(delay=0){clearTimeout(state.timer);state.timer=setTimeout(apply,delay)}
function start(){
  apply();
  loadAuthoritativeState(true);
  state.observer=new MutationObserver(()=>schedule(30));
  state.observer.observe(document.body,{childList:true,subtree:true});
  setInterval(()=>loadAuthoritativeState(false),REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
document.addEventListener('click',()=>schedule(60),true);
document.addEventListener('change',()=>schedule(60),true);
window.addEventListener('pageshow',()=>loadAuthoritativeState(true),{passive:true});
window.addEventListener('hashchange',()=>schedule(20),{passive:true});
window.addEventListener('rona:client-application-submitted',()=>setTimeout(()=>loadAuthoritativeState(true),150));
})();
