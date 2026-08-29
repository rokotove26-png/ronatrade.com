(()=>{'use strict';
const MARK='20260829-client-application-resource-archive-v1';
if(window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__===MARK)return;
window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__=MARK;
if(location.pathname!=='/portal/client')return;

const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0};

function frozenContexts(){
  try{if(typeof CLIENT_CONTEXTS!=='undefined'&&CLIENT_CONTEXTS&&typeof CLIENT_CONTEXTS==='object')return CLIENT_CONTEXTS}catch{}
  return null;
}
function appId(a){return norm(a?.id||a?.application_id||a?.applicationId)}
function appDealId(a){return norm(a?.deal||a?.deal_id||a?.dealId)}
function dealId(d){return norm(d?.id||d?.deal_id||d?.dealId)}
function resourceConfirmed(d){
  const text=low([d?.resource,d?.resource_status,d?.resourceStatus,d?.resource_state,d?.resourceState].filter(Boolean).join(' '));
  if(text.includes('resource_confirmed')||text.includes('ресурс подтвержден'))return true;
  if((d?.resourceDate||d?.resource_date||d?.resource_confirmed_at||d?.resourceConfirmedAt)&&!text.includes('не подтверж'))return true;
  return false;
}
function modelSnapshot(){
  const model=frozenContexts();
  const all=[];
  const archived=[];
  if(!model)return{all,archived};
  for(const ctx of Object.values(model)){
    if(!ctx||typeof ctx!=='object')continue;
    const deals=new Map((Array.isArray(ctx.deals)?ctx.deals:[]).map(d=>[dealId(d),d]));
    for(const app of Array.isArray(ctx.applications)?ctx.applications:[]){
      const id=appId(app),did=appDealId(app);
      if(!id)continue;
      all.push({id,dealId:did,status:norm(app?.status)});
      if(did&&resourceConfirmed(deals.get(did)))archived.push({id,dealId:did});
    }
  }
  return{all,archived};
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
function leafWithText(root,text){
  return [...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent).includes(text));
}
function rowFor(root,id,did,allIds){
  const leaves=leafWithText(root,id);
  for(const leaf of leaves){
    let node=leaf,parent=node.parentElement,candidate=null;
    for(let depth=0;node&&node!==root&&depth<12;depth++,node=node.parentElement){
      const t=norm(node.textContent);
      if(!t.includes(id))continue;
      const idsPresent=allIds.filter(x=>x&&t.includes(x));
      const hasRowContext=(did&&t.includes(did))||t.includes('Принята')||t.includes('Принято')||t.includes('Открыть');
      if(idsPresent.length===1&&hasRowContext&&t.length<2600)candidate=node;
      if(idsPresent.length>1)break;
      parent=node.parentElement;
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
function syncCounter(root,allIds){
  let count=0;
  for(const id of allIds){
    const leaves=leafWithText(root,id);
    if(leaves.some(el=>visible(el)&&!el.closest('[data-rona-application-archived="resource-confirmed"]')))count++;
  }
  for(const el of root.querySelectorAll('*')){
    if(el.childElementCount!==0)continue;
    const t=norm(el.textContent);
    if(/^\d+\s+зарегистрировано$/iu.test(t))el.textContent=`${count} зарегистрировано`;
  }
}
function apply(){
  const root=applicationsRoot();
  if(!root)return false;
  const snap=modelSnapshot(),allIds=[...new Set(snap.all.map(x=>x.id))];
  for(const item of snap.archived){
    const row=rowFor(root,item.id,item.dealId,allIds);
    if(!row)continue;
    row.hidden=true;
    row.style.display='none';
    row.setAttribute('data-rona-application-archived','resource-confirmed');
  }
  hideStatusLabels(root);
  syncCounter(root,allIds);
  root.setAttribute('data-rona-application-lifecycle','resource-confirmed-archive-v1');
  return true;
}
let timer=0;
function schedule(delay=0){clearTimeout(timer);timer=setTimeout(apply,delay)}
const observer=new MutationObserver(()=>schedule(30));
function start(){apply();observer.observe(document.body,{childList:true,subtree:true});schedule(120);schedule(600)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
document.addEventListener('click',()=>schedule(60),true);
document.addEventListener('change',()=>schedule(60),true);
window.addEventListener('pageshow',()=>schedule(20),{passive:true});
window.addEventListener('hashchange',()=>schedule(20),{passive:true});
window.addEventListener('rona:client-application-submitted',()=>schedule(100));
})();
