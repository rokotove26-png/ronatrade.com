(()=>{'use strict';
const MARK='20260830-client-admin-authoritative-deal-projection-v8';
if(window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__===MARK)return;
window.__RONA_CLIENT_APPLICATION_RESOURCE_ARCHIVE__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api',REFRESH_MS=30000;
const state={activeIds:new Set(),dealStates:new Map(),ready:false,loading:false,lastLoad:0,timer:0,observer:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const visible=el=>{if(!el||!el.isConnected)return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0};
const APP_ID_RE=/\bRONA-C\d{3}-IN-\d{4}-\d{3,}\b/g;
const DEAL_ID_RE=/\bDEAL-\d{4}-\d{3,}\b/g;
const DEAL_AMOUNT_RE=/^\d[\d\s.,]*\s*(?:USD|KGS|RUB|EUR|CNY|KZT|UZS|BYN|AED|TRY|GBP)$/iu;
const STALE_STATUS_RE=/^(?:Сделка\s+открыта|В\s+исполнении|Сделка\s+зарегистрирована|Ресурс\s+подтвержд[её]н|Подтвержд[её]н|Ресурс\s+не\s+подтвержд[её]н|Не\s+подтвержд[её]н|Ожидание\s+подтверждения\s+ресурса|Ресурс\s+ожидает\s+подтверждения|Оплата\s+подтверждена|Оплата\s+получена|Оплата\s+не\s+требуется|Оплата\s+не\s+наступила|Ожидается\s+оплата|Оплата\s+просрочена|Оплата\s+на\s+проверке|Статус\s+оплаты\s+уточняется|Оплачено(?:\s+\d+%)?|Частичная\s+оплата|Завершена|Сделка\s+отменена|Статус\s+уточняется|Ресурс)$/iu;

function installStyle(){
  if(document.getElementById('rona-client-deal-state-strip-v8'))return;
  document.getElementById('rona-client-deal-state-strip-v7')?.remove();
  const style=document.createElement('style');
  style.id='rona-client-deal-state-strip-v8';
  style.textContent=`
    #page-deals [data-rona-deal-state-strip="authoritative-v8"]{display:inline-flex!important;align-items:center;gap:0!important;flex-wrap:nowrap;width:max-content!important;max-width:100%;margin:0!important;padding:0!important;border:1px solid rgba(104,171,207,.20);border-radius:9px;background:rgba(5,22,36,.62);overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
    #page-deals [data-rona-deal-state-strip="authoritative-v8"]>[data-rona-state-chip]{display:inline-flex!important;align-items:center;justify-content:center;gap:6px;min-height:27px;padding:0 10px;border:0!important;border-left:1px solid rgba(104,171,207,.13)!important;border-radius:0!important;background:transparent!important;color:#cfe8f4;font-size:10.3px;line-height:1;font-weight:720;letter-spacing:.005em;white-space:nowrap;box-shadow:none!important}
    #page-deals [data-rona-deal-state-strip="authoritative-v8"]>[data-rona-state-chip]:first-child{border-left:0!important}
    #page-deals [data-rona-deal-state-strip="authoritative-v8"]>[data-rona-state-chip]::before{content:'';width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.88;flex:0 0 5px}
    #page-deals [data-rona-deal-state-strip="authoritative-v8"]>[data-tone="payment"]{color:#bff1d8}
    #page-deals [data-rona-deal-state-strip="authoritative-v8"]>[data-tone="resource"]{color:#bcebd5}
    #page-deals [data-rona-deal-state-strip="authoritative-v8"]>[data-tone="attention"]{color:#ffe2a1}
    @media(max-width:900px){#page-deals [data-rona-deal-state-strip="authoritative-v8"]{flex-wrap:wrap;width:100%!important}#page-deals [data-rona-deal-state-strip="authoritative-v8"]>[data-rona-state-chip]{font-size:9.8px;padding:0 8px;min-height:26px}}
  `;
  document.head.append(style);
}
async function request(path){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.ok===false)throw new Error(String(b?.code||b?.error?.code||('HTTP_'+r.status)));
  return b;
}
function markAuthoritativeReady(){document.documentElement.setAttribute('data-rona-client-operations-state','ready');document.documentElement.setAttribute('data-rona-client-operations-ready','true')}
function markAuthoritativeError(){document.documentElement.setAttribute('data-rona-client-operations-state','error');document.documentElement.removeAttribute('data-rona-client-operations-ready')}
function dealFromServer(row){
  const dealId=norm(row?.deal_id||row?.dealId||row?.id);
  const statusCode=norm(row?.current_status||row?.status_code),statusLabel=norm(row?.current_status_label||row?.status_label);
  const paymentCode=norm(row?.payment_status||row?.payment_code),paymentLabel=norm(row?.payment_label);
  const resourceCode=norm(row?.resource_status||row?.resource_code),resourceLabel=norm(row?.resource_label);
  if(!dealId||!statusCode||!statusLabel||!paymentCode||!paymentLabel||!resourceCode||!resourceLabel)throw new Error('CLIENT_DEAL_SERVER_PROJECTION_INCOMPLETE');
  return{
    dealId,statusCode,statusLabel,paymentCode,paymentLabel,resourceCode,resourceLabel,
    businessStatus:norm(row?.business_status),
    paymentReceived:row?.payment_received_amount??null,paymentObligation:row?.payment_obligation_amount??null,paymentCurrency:norm(row?.payment_currency),paymentPercent:row?.payment_percent??null,
    statusSource:norm(row?.status_source),paymentSource:norm(row?.payment_source),resourceSource:norm(row?.resource_source)
  };
}
function applicationIsActive(app){
  const linkedDeal=norm(app?.deal_id||app?.dealId||app?.linked_deal_id||app?.linkedDealId);
  const status=norm(app?.status||app?.current_status).toUpperCase();
  if(linkedDeal)return false;
  if(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED'].includes(status))return false;
  return true;
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
      for(const app of Array.isArray(detail?.data?.applications)?detail.data.applications:[]){const id=norm(app?.application_id||app?.applicationId||app?.id);if(id&&applicationIsActive(app))active.add(id)}
      for(const raw of Array.isArray(detail?.data?.deals)?detail.data.deals:[]){const deal=dealFromServer(raw);deals.set(deal.dealId,deal)}
    }
    state.activeIds=active;state.dealStates=deals;state.ready=true;state.lastLoad=Date.now();
    window.__RONA_CLIENT_APPLICATION_ACTIVE_STATE__={version:MARK,source:'AUTHORITATIVE_CLIENT_CONTEXT',active_application_ids:[...active],loaded_at:new Date().toISOString()};
    window.__RONA_CLIENT_DEAL_OPERATIONS_STATE__={version:MARK,source:'ADMIN_CLIENT_SERVER_PROJECTION',deals:[...deals.values()],loaded_at:new Date().toISOString()};
    apply();markAuthoritativeReady();
  }catch(error){console.error('RONA client authoritative projection',error);state.ready=false;apply();markAuthoritativeError()}
  finally{state.loading=false}
}
function applicationsRoot(){
  for(const selector of ['#page-applications','#applicationsPage','[data-page-panel="applications"]','[data-page-id="applications"]']){const el=document.querySelector(selector);if(el)return el}
  let best=null;for(const el of document.querySelectorAll('main section,main div,section,article')){if(!visible(el))continue;const t=norm(el.textContent);if(!t.includes('Заявки')||!t.includes('Все статусы')||!t.includes('зарегистрировано'))continue;if(!best||t.length<norm(best.textContent).length)best=el}return best;
}
function dealsRoot(){
  for(const selector of ['#page-deals','#dealsPage','[data-page-panel="deals"]','[data-page-id="deals"]']){const el=document.querySelector(selector);if(el)return el}
  let best=null;for(const el of document.querySelectorAll('main section,main div,section,article')){if(!visible(el))continue;const t=norm(el.textContent);if(!t.includes('Сделки')||!t.includes('Все этапы')||!DEAL_ID_RE.test(t)){DEAL_ID_RE.lastIndex=0;continue}DEAL_ID_RE.lastIndex=0;if(!best||t.length<norm(best.textContent).length)best=el}return best;
}
function idsFromText(root,re){const ids=new Set(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))for(const id of String(node.nodeValue||'').match(re)||[])ids.add(id);return[...ids]}
function leafWithText(root,text){return[...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent).includes(text))}
function rowFor(root,id,allIds,contextTokens){
  for(const leaf of leafWithText(root,id)){let node=leaf,candidate=null;for(let depth=0;node&&node!==root&&depth<12;depth++,node=node.parentElement){const t=norm(node.textContent);if(!t.includes(id))continue;const idsPresent=allIds.filter(x=>x&&t.includes(x)),hasRowContext=contextTokens.some(token=>t.includes(token));if(idsPresent.length===1&&hasRowContext&&t.length<3200)candidate=node;if(idsPresent.length>1)break}if(candidate)return candidate}return null;
}
function hideStatusLabels(root){for(const el of root.querySelectorAll('*'))if(el.childElementCount===0&&norm(el.textContent)==='Статус'){el.style.display='none';el.setAttribute('data-rona-status-label-removed','true')}}
function styleDealAmounts(root,ids){
  for(const id of ids){const row=rowFor(root,id,ids,['Сделка','Ресурс','Открыть','Документы']);if(!row)continue;for(const el of row.querySelectorAll('*')){if(el.childElementCount!==0)continue;const text=norm(el.textContent);if(text==='Сумма'){el.style.display='none';el.setAttribute('data-rona-deal-amount-label-removed','true');continue}if(!DEAL_AMOUNT_RE.test(text))continue;el.setAttribute('data-rona-deal-amount-badge','true')}}
}
function projectApplicationRows(root,ids){if(!state.ready)return;for(const id of ids){const row=rowFor(root,id,ids,['Принята','Принято','Открыть','Сделка','DEAL-']);if(!row)continue;if(state.activeIds.has(id)){if(row.hasAttribute('data-rona-application-projection')||row.hasAttribute('data-rona-application-archived')){row.hidden=false;row.style.removeProperty('display');row.removeAttribute('data-rona-application-projection');row.removeAttribute('data-rona-application-archived')}}else{row.hidden=true;row.style.display='none';row.setAttribute('data-rona-application-projection','authoritative-not-active')}}}
function syncApplicationCounter(root,ids){if(!state.ready)return;let count=0;for(const id of ids){const row=rowFor(root,id,ids,['Принята','Принято','Открыть','Сделка','DEAL-']);if(row&&state.activeIds.has(id)&&visible(row))count++}for(const el of root.querySelectorAll('*'))if(el.childElementCount===0&&/^\d+\s+зарегистрировано$/iu.test(norm(el.textContent)))el.textContent=`${count} зарегистрировано`}
function paymentTitle(deal){
  const r=Number(deal.paymentReceived),o=Number(deal.paymentObligation),c=deal.paymentCurrency;
  if(Number.isFinite(r)&&Number.isFinite(o)&&o>0&&c)return`Получено ${r.toLocaleString('ru-RU',{maximumFractionDigits:2})} из ${o.toLocaleString('ru-RU',{maximumFractionDigits:2})} ${c}`;
  return 'Источник: серверная финансовая проекция';
}
function chip(text,code,tone,title,attr){const el=document.createElement('span');el.textContent=text;el.setAttribute('data-rona-state-chip',code);el.setAttribute('data-tone',tone);if(title)el.title=title;if(attr)el.setAttribute(attr,code);return el}
function syncDealStateStrip(row,deal){
  const stale=[...row.querySelectorAll('*')].filter(el=>el.childElementCount===0&&STALE_STATUS_RE.test(norm(el.textContent))&&!el.closest('[data-rona-deal-state-strip]'));
  const legacy=[...row.querySelectorAll('[data-rona-current-deal-status],[data-rona-finance-payment-state],[data-rona-operations-resource-state]')].filter(el=>!el.closest('[data-rona-deal-state-strip]'));
  let strip=row.querySelector('[data-rona-deal-state-strip="authoritative-v8"]')||row.querySelector('[data-rona-deal-state-strip]');
  if(strip&&strip.getAttribute('data-rona-deal-state-strip')!=='authoritative-v8')strip.setAttribute('data-rona-deal-state-strip','authoritative-v8');
  if(!strip){strip=document.createElement('div');strip.setAttribute('data-rona-deal-state-strip','authoritative-v8')}
  const summarySide=row.querySelector('[data-rona-deal-summary-side]');
  if(summarySide){const open=summarySide.querySelector('button,a,[role="button"]');if(strip.parentElement!==summarySide)summarySide.insertBefore(strip,open||null)}
  else if(!strip.parentElement){const first=stale[0]||legacy[0]||null;if(first?.parentElement)first.parentElement.insertBefore(strip,first);else{const docs=[...row.querySelectorAll('*')].find(el=>el.childElementCount===0&&norm(el.textContent)==='Документы');if(docs?.parentElement)docs.parentElement.insertBefore(strip,docs);else row.append(strip)}}
  for(const el of [...stale,...legacy]){if(el===strip||strip.contains(el))continue;el.hidden=true;el.style.display='none';el.setAttribute('aria-hidden','true');el.setAttribute('data-rona-stale-deal-state-removed','true')}
  strip.replaceChildren(
    chip(deal.statusLabel,deal.statusCode,'status',deal.statusSource||'Источник: серверная операционная проекция','data-rona-current-deal-status'),
    chip(deal.paymentLabel,deal.paymentCode,/PAID|CONFIRMED|PARTIAL/i.test(deal.paymentCode)?'payment':'attention',paymentTitle(deal),'data-rona-finance-payment-state'),
    chip(deal.resourceLabel,deal.resourceCode,/CONFIRMED|EXECUT/i.test(deal.resourceCode)?'resource':'attention',deal.resourceSource||'Источник: серверная ресурсная проекция','data-rona-operations-resource-state')
  );
}
function projectDealRows(root,ids){
  if(!state.ready)return;
  for(const id of ids){const deal=state.dealStates.get(id),row=rowFor(root,id,ids,['Сделка','Ресурс','Открыть','Документы']);if(!row)continue;if(!deal){row.hidden=true;row.style.display='none';row.setAttribute('data-rona-deal-projection','authoritative-not-current');continue}if(row.hasAttribute('data-rona-deal-projection')){row.hidden=false;row.style.removeProperty('display');row.removeAttribute('data-rona-deal-projection')}syncDealStateStrip(row,deal);row.setAttribute('data-rona-operations-deal-status',deal.statusCode);row.setAttribute('data-rona-finance-status',deal.paymentCode);row.setAttribute('data-rona-resource-status',deal.resourceCode)}
}
function apply(){
  installStyle();
  const apps=applicationsRoot();if(apps){const ids=idsFromText(apps,APP_ID_RE);hideStatusLabels(apps);projectApplicationRows(apps,ids);syncApplicationCounter(apps,ids);apps.setAttribute('data-rona-application-lifecycle',state.ready?'authoritative-active-v8':'authoritative-pending-v8')}
  const deals=dealsRoot();if(deals){const ids=idsFromText(deals,DEAL_ID_RE);styleDealAmounts(deals,ids);projectDealRows(deals,ids);deals.setAttribute('data-rona-deal-authority',state.ready?'admin-client-server-v8':'admin-client-server-pending')}
  return Boolean(apps||deals);
}
function operationsPageVisible(){return visible(document.getElementById('page-applications'))||visible(document.getElementById('page-deals'))}
function loadWhenNeeded(force=false){if(operationsPageVisible())loadAuthoritativeState(force)}
function schedule(delay=0){clearTimeout(state.timer);state.timer=setTimeout(apply,delay)}
function scheduleAndLoad(delay=0,force=false){schedule(delay);setTimeout(()=>loadWhenNeeded(force),delay+20)}
function start(){installStyle();apply();loadWhenNeeded(true);state.observer=new MutationObserver(()=>schedule(30));state.observer.observe(document.body,{childList:true,subtree:true});setInterval(()=>loadWhenNeeded(false),REFRESH_MS)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
document.addEventListener('click',()=>scheduleAndLoad(40,false),true);
document.addEventListener('change',()=>scheduleAndLoad(40,false),true);
window.addEventListener('pageshow',()=>scheduleAndLoad(0,false),{passive:true});
window.addEventListener('hashchange',()=>scheduleAndLoad(20,false),{passive:true});
window.addEventListener('rona:client-application-submitted',()=>setTimeout(()=>loadAuthoritativeState(true),150));
})();