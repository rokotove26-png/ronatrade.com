import paymentsMoneyDisplayContract from './main-ui/payments-money-display-contract.js';

const BUILD='payments-v8-data-bridge-v7-passport-selfheal-20260921';

const SCRIPT=paymentsMoneyDisplayContract+String.raw`(()=>{'use strict';
if(window.__RONA_PAYMENTS_V8_UI_INSTALLED__)return;
window.__RONA_PAYMENTS_V8_UI_INSTALLED__=true;
const ENDPOINT='/portal/api/v1/admin/bootstrap';
const OWNER='payments-v8-bootstrap-v1';
const VISUAL_OWNER='admin-payments-v7-native-v2';
const PASSPORT_MODAL_ID='ronaPaymentsV8PassportModal';
const LEGACY_PASSPORT_MODAL_ID='ronaPaymentsV7PassportDesignerModal';
let projection=null;
let loading=null;
let publishing=false;
let retryTimer=null;
let refreshTimer=null;
const REFRESH_MS=30000;

function asArray(v){return Array.isArray(v)?v:[]}
function text(v){return String(v==null?'':v).trim()}
function upper(v){return text(v).toUpperCase()}
function authoritative(m){return !!m&&upper(m.status)==='AUTHORITATIVE'&&m.amount!==null&&m.amount!==undefined&&Number.isFinite(Number(m.amount))&&!!text(m.currency)}
function fmtNumber(v){const formatted=globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.formatAmount(v);return formatted===null||formatted===undefined?'—':formatted}
function money(m){return authoritative(m)?fmtNumber(m.amount)+' '+upper(m.currency):'Требует проверки'}
function rawMoney(amount,currency){return amount!==null&&amount!==undefined&&Number.isFinite(Number(amount))&&text(currency)?fmtNumber(amount)+' '+upper(currency):'Требует проверки'}
function node(tag,attrs,...children){const el=document.createElement(tag);for(const [k,v] of Object.entries(attrs||{})){if(v===null||v===undefined)continue;if(k==='class')el.className=String(v);else if(k==='text')el.textContent=String(v);else if(k==='dataset'&&v&&typeof v==='object'){for(const [dk,dv] of Object.entries(v))el.dataset[dk]=String(dv)}else el.setAttribute(k,String(v))}for(const child of children.flat()){if(child===null||child===undefined)continue;el.append(child instanceof Node?child:document.createTextNode(String(child)))}return el}
function aggregateRows(field){const aggregate=projection?.currency_aggregates?.[field],groups=asArray(aggregate?.groups);return groups.filter(row=>upper(row?.status)==='AUTHORITATIVE'&&row?.amount!==null&&row?.amount!==undefined&&text(row?.currency)).map(row=>({currency:upper(row.currency),amount:String(row.amount),completeness:upper(row?.completeness_status||aggregate?.completeness_status||'COMPLETE')})).sort((a,b)=>{const rank={USD:1,RUB:2,KZT:3};return(rank[a.currency]||99)-(rank[b.currency]||99)||a.currency.localeCompare(b.currency)})}
function kpi(title,field,tone){const lines=node('div',{class:'rona-fin-kpi-lines'}),rows=aggregateRows(field);if(!rows.length)lines.append(node('div',{class:'rona-owner-kpi',text:'—'}));for(const row of rows)lines.append(node('div',{class:'rona-fin-kpi-line'},node('span',{class:'rona-owner-kpi',text:fmtNumber(row.amount)+' '+row.currency}),node('span',{class:'rona-fin-kpi-currency',text:row.currency})));return node('section',{class:'rona-owner-card rona-fin-kpi rona-fin-kpi--'+tone},node('h2',{text:title}),lines)}
function statusPill(value){const v=upper(value)||'—';const ru={PAID:'Оплачено',PARTIALLY_PAID:'Частично оплачено',PARTIAL:'Частично оплачено',NOT_DUE:'Срок не наступил',DUE:'К оплате',OVERDUE:'Просрочено',CONDITIONAL:'Условное обязательство'}[v]||v;const tone=v==='PAID'?'success':v==='DUE'||v==='OVERDUE'?'warn':v==='NOT_DUE'||v==='CONDITIONAL'?'info':'neutral';return node('span',{class:'rona-fin-pill rona-fin-pill--'+tone,text:ru})}
function authorityPill(deal){const fields=['verified_received','due_now','future_conditional','actual_spend','remaining_execution'];const ok=fields.every(k=>authoritative(deal?.[k]));return node('span',{class:'rona-fin-pill rona-fin-pill--'+(ok?'success':'warn'),text:ok?'Подтверждено':'Требует проверки'})}
function passportButton(deal){return node('button',{type:'button',class:'rona-payments-v8-passport-trigger',dataset:{paymentsV8PassportDeal:deal?.deal_id||''},text:'Паспорт'})}
function table(){const wrap=node('div',{class:'rona-owner-table-wrap'}),t=node('table',{class:'rona-owner-table'}),thead=node('thead'),hr=node('tr');for(const h of ['Deal ID','Клиент','Получено','Ожидается сейчас','Условно','Потрачено','Остаток финансирования','Finance','Данные','Паспорт'])hr.append(node('th',{text:h}));thead.append(hr);const tbody=node('tbody');const deals=asArray(projection?.deals).slice().sort((a,b)=>text(a?.deal_id).localeCompare(text(b?.deal_id)));for(const d of deals){const tr=node('tr',{dataset:{dealId:d?.deal_id||''}},node('td',{text:d?.deal_id||'—'}),node('td',{text:d?.client_display||d?.client_name||d?.client_id||'—'}),node('td',{text:money(d?.verified_received)}),node('td',{text:money(d?.due_now)}),node('td',{text:money(d?.future_conditional)}),node('td',{text:money(d?.actual_spend)}),node('td',{text:money(d?.remaining_execution)}),node('td',{},statusPill(d?.financial_status)),node('td',{},authorityPill(d)),node('td',{},passportButton(d)));tbody.append(tr)}t.append(thead,tbody);wrap.append(t);return wrap}
function versionKeyOf(value){return text(value?.projection_version_key)||[value?.source_as_of,value?.generated_at,value?.generatedAt,value?.finance_authority_projection_reconciliation?.version].filter(Boolean).map(String).join('|')||'current'}
function versionKey(){return versionKeyOf(projection)}

function installPassportStyle(){if(document.getElementById('ronaPaymentsV8PassportStyle'))return;const s=node('style',{id:'ronaPaymentsV8PassportStyle'});s.textContent='.rona-payments-v8-passport-trigger{appearance:none;border:1px solid rgba(126,170,203,.24);border-radius:8px;padding:7px 10px;background:rgba(12,31,45,.9);color:#dce9f3;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.rona-payments-v8-passport-overlay{position:fixed;inset:0;z-index:2147483100;display:grid;place-items:center;padding:20px;background:rgba(1,7,12,.78);backdrop-filter:blur(10px)}.rona-payments-v8-passport-modal{width:min(1120px,calc(100vw - 40px));max-height:92vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(126,170,203,.22);border-radius:18px;background:linear-gradient(180deg,rgba(9,23,34,.995),rgba(4,13,21,.995));box-shadow:0 30px 90px rgba(0,0,0,.58);color:#e8f0f6}.rona-payments-v8-passport-head{display:flex;justify-content:space-between;gap:18px;padding:17px 20px;border-bottom:1px solid rgba(126,170,203,.13)}.rona-payments-v8-passport-head h2{margin:0;font-size:22px}.rona-payments-v8-passport-close{appearance:none;border:1px solid rgba(126,170,203,.24);border-radius:8px;padding:8px 12px;background:rgba(13,31,45,.9);color:#dce9f3;font:inherit;font-weight:800;cursor:pointer}.rona-payments-v8-passport-scroll{overflow:auto;padding:16px 18px 20px}.rona-payments-v8-passport-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.rona-payments-v8-passport-card{border:1px solid rgba(126,170,203,.14);border-radius:11px;padding:12px;background:rgba(8,22,33,.72)}.rona-payments-v8-passport-card h3{margin:0 0 8px;font-size:13px}.rona-payments-v8-passport-kv{display:grid;grid-template-columns:minmax(150px,.44fr) minmax(0,1fr);gap:6px 12px;font-size:12px;line-height:1.35}.rona-payments-v8-passport-kv dt{color:#82a1b7}.rona-payments-v8-passport-kv dd{margin:0;color:#edf5fa;overflow-wrap:anywhere}.rona-payments-v8-passport-empty{padding:14px;border:1px dashed rgba(242,187,103,.3);border-radius:10px;color:#e8cb99}.rona-payments-v8-passport-section-title{margin:18px 0 8px;font-size:13px;color:#a9c0d0}.rona-payments-v8-passport-list{display:grid;gap:10px}@media(max-width:980px){.rona-payments-v8-passport-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:820px){.rona-payments-v8-passport-overlay{padding:8px}.rona-payments-v8-passport-modal{width:calc(100vw - 16px)}.rona-payments-v8-passport-summary{grid-template-columns:1fr}.rona-payments-v8-passport-kv{grid-template-columns:1fr}.rona-payments-v8-passport-kv dd{margin-bottom:5px}}';document.head.appendChild(s)}
function closePassport(){document.getElementById(PASSPORT_MODAL_ID)?.remove();document.documentElement.classList.remove('rona-payments-v8-passport-open')}
function passportItems(passport){const items=[];for(const event of asArray(passport?.funding_events)){items.push({kind:'funding',...event});for(const line of asArray(event?.settlement_lines))items.push({kind:'settlement',...line,funding_event_id:event?.funding_event_id||line?.funding_event_id||null})}for(const line of asArray(passport?.unlinked_settlement_lines))items.push({kind:'unlinked',...line});return items}
function passportNativeTotals(passport){const map=new Map();for(const item of passportItems(passport)){const kind=text(item?.kind);if(kind!=='settlement'&&kind!=='unlinked')continue;const amount=Number(item?.amount),currency=upper(item?.currency);if(!Number.isFinite(amount)||!currency)continue;map.set(currency,(map.get(currency)||0)+amount)}return Array.from(map.entries()).map(([currency,amount])=>({currency,amount})).sort((a,b)=>{const rank={USD:1,RUB:2,KZT:3};return(rank[a.currency]||99)-(rank[b.currency]||99)||a.currency.localeCompare(b.currency)})}
function nativeTotalCard(passport){const rows=passportNativeTotals(passport),body=node('div',{dataset:{passportField:'native-total'}});if(!rows.length)body.append(node('div',{text:'Требует проверки'}));else for(const row of rows)body.append(node('div',{text:rawMoney(row.amount,row.currency)}));return node('div',{class:'rona-payments-v8-passport-card'},node('h3',{text:'Списано в валюте платежа'}),body)}
function kv(label,value,field){return [node('dt',{text:label}),node('dd',{dataset:field?{passportField:field}:null,text:text(value)||'—'})]}
function paymentCard(item,index,passportCurrency){
  const beneficiary=text(item?.bank_beneficiary_name||item?.beneficiary_name),route=text(item?.bank_route_reference||item?.bank_document),recipient=text(item?.recipient);
  const dl=node('dl',{class:'rona-payments-v8-passport-kv'},...kv('Получатель',recipient,'recipient'),...kv('Банковский получатель',beneficiary,'bank-beneficiary'),...kv('Банковский маршрут',route,'bank-route'),...kv('Платёж',item?.payment_id||item?.funding_event_id||'—'),...kv('Назначение',item?.purpose||item?.original_payment_purpose||'—'));
  const kind=text(item?.kind),nativeAmount=item?.amount,nativeCurrency=upper(item?.currency),accountingCurrency=upper(item?.funding_currency||passportCurrency);
  if(kind==='settlement'||kind==='unlinked'){
    const accountingAmount=item?.allocated_funding_amount??(nativeCurrency&&nativeCurrency===accountingCurrency?nativeAmount:null);
    dl.append(...kv('Фактическое списание',rawMoney(nativeAmount,nativeCurrency),'native-amount'));
    dl.append(...kv('В валюте сделки',rawMoney(accountingAmount,accountingCurrency),'accounting-amount'));
  }else{
    const fundingAmount=item?.funding_amount??item?.allocated_funding_amount??item?.amount;
    const fundingCurrency=item?.funding_currency||item?.currency||passportCurrency;
    dl.append(...kv('Сумма финансирования',rawMoney(fundingAmount,fundingCurrency),'funding-amount'));
    if(item?.acquired_amount!==null&&item?.acquired_amount!==undefined&&text(item?.acquired_currency))dl.append(...kv('Получено после конвертации',rawMoney(item.acquired_amount,item.acquired_currency),'acquired-amount'));
  }
  return node('article',{class:'rona-payments-v8-passport-card',dataset:{passportItem:String(index),passportKind:item?.kind||'payment'}},node('h3',{text:kind==='settlement'?'Расчётный платёж':kind==='unlinked'?'Расчётный платёж':'Финансирование'}),dl)
}
function openPassport(dealId){const deal=asArray(projection?.deals).find(d=>text(d?.deal_id)===text(dealId));if(!deal)return false;installPassportStyle();closePassport();document.getElementById(LEGACY_PASSPORT_MODAL_ID)?.remove();document.documentElement.classList.remove('rona-payments-v7-modal-open');const passport=deal?.payment_passport||null;const overlay=node('div',{id:PASSPORT_MODAL_ID,class:'rona-payments-v8-passport-overlay',dataset:{passportDealId:deal?.deal_id||'',passportContract:passport?.contract||'missing'}});const modal=node('section',{class:'rona-payments-v8-passport-modal',role:'dialog','aria-modal':'true','aria-labelledby':'ronaPaymentsV8PassportTitle'});const head=node('header',{class:'rona-payments-v8-passport-head'},node('div',{},node('div',{class:'rona-owner-muted',text:'ПАСПОРТ ПЛАТЕЖА · КАНОНИЧЕСКИЙ V8'}),node('h2',{id:'ronaPaymentsV8PassportTitle',text:deal?.deal_id||'Сделка'})),node('button',{type:'button',class:'rona-payments-v8-passport-close',dataset:{paymentsV8PassportClose:'true'},text:'Закрыть'}));const scroll=node('div',{class:'rona-payments-v8-passport-scroll'});if(!passport){scroll.append(node('div',{class:'rona-payments-v8-passport-empty',text:'Платёжный паспорт отсутствует в текущей канонической проекции.'}))}else{scroll.append(node('div',{class:'rona-payments-v8-passport-summary'},node('div',{class:'rona-payments-v8-passport-card'},node('h3',{text:'Получено'}),node('div',{text:money(passport?.funding_received)})),node('div',{class:'rona-payments-v8-passport-card'},node('h3',{text:'Потрачено'}),node('div',{text:money(passport?.funding_spent)})),nativeTotalCard(passport),node('div',{class:'rona-payments-v8-passport-card'},node('h3',{text:'Остаток'}),node('div',{text:money(passport?.funding_remaining)}))));const items=passportItems(passport);scroll.append(node('h3',{class:'rona-payments-v8-passport-section-title',text:'Платежи и банковский маршрут'}));if(!items.length)scroll.append(node('div',{class:'rona-payments-v8-passport-empty',text:'Платёжные события в текущем паспорте отсутствуют.'}));else{const list=node('div',{class:'rona-payments-v8-passport-list'});items.forEach((item,index)=>list.append(paymentCard(item,index,passport?.funding_currency)));scroll.append(list)}}modal.append(head,scroll);overlay.append(modal);document.body.appendChild(overlay);document.documentElement.classList.add('rona-payments-v8-passport-open');overlay.querySelector('.rona-payments-v8-passport-close')?.focus();window.__RONA_PAYMENTS_V8_PASSPORT__={status:'OPEN',dealId:deal?.deal_id||null,contract:passport?.contract||null,source:'CANONICAL_V8_BOOTSTRAP',openedAt:new Date().toISOString()};return true}

function validProjection(value){return !!value&&value.contract==='ADMIN_PAYMENTS_V7'&&Array.isArray(value.deals)}
function projectionDeal(dealId,value=projection){const id=text(dealId);return id&&validProjection(value)?asArray(value.deals).find(d=>text(d?.deal_id)===id)||null:null}
function adoptWindowProjection(reason='passport-open'){const live=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;if(!validProjection(live))return false;projection=live;window.__RONA_PAYMENTS_V8_PROJECTION__=live;window.__RONA_PAYMENTS_V8_PASSPORT_ROUTE__={status:'ADOPTED_WINDOW_PROJECTION',reason,dealCount:asArray(live.deals).length,at:new Date().toISOString()};return true}
function legacyPassportDealId(trigger){const article=trigger?.closest?.('.rona-payments-v7-deal');return text(article?.dataset?.dealId)||text(article?.querySelector?.('.rona-payments-v7-deal-id')?.textContent)}
function disableLegacyPassportRuntime(){const handler=document.__ronaPaymentsV7PassportOwnerTableV2Handler;if(typeof handler==='function'){document.removeEventListener('click',handler,true);document.__ronaPaymentsV7PassportOwnerTableV2Handler=null}document.getElementById(LEGACY_PASSPORT_MODAL_ID)?.remove();document.documentElement.classList.remove('rona-payments-v7-modal-open');window.__RONA_PAYMENTS_V8_LEGACY_PASSPORT_DISABLED__=true}
function openPassportUnavailable(dealId,code){installPassportStyle();closePassport();document.getElementById(LEGACY_PASSPORT_MODAL_ID)?.remove();document.documentElement.classList.remove('rona-payments-v7-modal-open');const id=text(dealId),overlay=node('div',{id:PASSPORT_MODAL_ID,class:'rona-payments-v8-passport-overlay',dataset:{passportDealId:id,passportContract:'unavailable'}}),modal=node('section',{class:'rona-payments-v8-passport-modal',role:'dialog','aria-modal':'true','aria-labelledby':'ronaPaymentsV8PassportTitle'}),head=node('header',{class:'rona-payments-v8-passport-head'},node('div',{},node('div',{class:'rona-owner-muted',text:'ПАСПОРТ ПЛАТЕЖА · КАНОНИЧЕСКИЙ V8'}),node('h2',{id:'ronaPaymentsV8PassportTitle',text:id||'Паспорт платежа'})),node('button',{type:'button',class:'rona-payments-v8-passport-close',dataset:{paymentsV8PassportClose:'true'},text:'Закрыть'})),scroll=node('div',{class:'rona-payments-v8-passport-scroll'},node('div',{class:'rona-payments-v8-passport-empty',text:'Паспорт платежа временно недоступен. Данные автоматически пересинхронизируются; повторите открытие после обновления.'}));modal.append(head,scroll);overlay.append(modal);document.body.appendChild(overlay);document.documentElement.classList.add('rona-payments-v8-passport-open');overlay.querySelector('.rona-payments-v8-passport-close')?.focus();window.__RONA_PAYMENTS_V8_PASSPORT_ERROR__=String(code||'PAYMENTS_V8_PASSPORT_UNAVAILABLE');window.__RONA_PAYMENTS_V8_PASSPORT_ROUTE__={status:'UNAVAILABLE',dealId:id||null,code:window.__RONA_PAYMENTS_V8_PASSPORT_ERROR__,at:new Date().toISOString()};return true}
function openCanonicalPassport(dealId){const id=text(dealId);if(!id)return openPassportUnavailable('', 'PAYMENTS_V8_PASSPORT_TRIGGER_DEAL_ID_MISSING');adoptWindowProjection('passport-open');if(projectionDeal(id)){window.__RONA_PAYMENTS_V8_PASSPORT_ROUTE__={status:'OPEN_FROM_CURRENT_PROJECTION',dealId:id,at:new Date().toISOString()};return openPassport(id)}window.__RONA_PAYMENTS_V8_PASSPORT_ROUTE__={status:'REFRESHING',dealId:id,at:new Date().toISOString()};load('passport-open-reconcile').then(()=>{adoptWindowProjection('passport-open-after-refresh');if(projectionDeal(id)){openPassport(id);window.__RONA_PAYMENTS_V8_PASSPORT_ROUTE__={status:'OPEN_AFTER_REFRESH',dealId:id,at:new Date().toISOString()};return}openPassportUnavailable(id,'PAYMENTS_V8_PASSPORT_DEAL_NOT_FOUND_AFTER_REFRESH')});return true}
function openCanonicalPassportForLegacyTrigger(trigger){return openCanonicalPassport(legacyPassportDealId(trigger))}

function bridgeProjection(reason='manual',changed=true){
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7')return false;
  const current=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__;
  try{window.__RONA_OWNER_AI_SYNC_SNAPSHOT__={...(current&&typeof current==='object'?current:{}),paymentsV7Projection:projection}}catch(_e){return false}
  window.__RONA_PAYMENTS_V8_PROJECTION__=projection;
  const page=document.getElementById('page-payments');
  if(page){
    page.dataset.ronaPaymentsV8DataOwner=OWNER;
    page.dataset.ronaPaymentsVisualOwner=VISUAL_OWNER;
    page.querySelector(':scope > #ronaPaymentsV8Root')?.remove();
  }
  window.__RONA_PAYMENTS_V8_UI__={
    status:'READY',
    owner:OWNER,
    mode:'DATA_AND_PASSPORT_BRIDGE',
    visualOwner:VISUAL_OWNER,
    sourceAsOf:projection.source_as_of||null,
    dealCount:asArray(projection.deals).length,
    moneyDisplayContract:globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.contract||null,
    passportModal:'CANONICAL_V8',
    legacyPassportDisabled:true,
    lastBridgeReason:reason,
    renderedAt:new Date().toISOString()
  };
  if(changed&&!publishing){
    publishing=true;
    try{window.dispatchEvent(new CustomEvent('rona:finance-sync',{detail:{source:OWNER,projectionKey:versionKey(),reason}}))}
    finally{publishing=false}
  }
  return true;
}
function extract(payload){const direct=payload?.data?.paymentsV7Projection||payload?.paymentsV7Projection||null;if(direct?.contract==='ADMIN_PAYMENTS_V7'&&Array.isArray(direct.deals))return direct;return null}
async function load(reason='manual'){
  if(loading)return loading;
  loading=(async()=>{try{
    const r=await fetch(ENDPOINT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','cache-control':'no-store'}});
    const j=await r.json().catch(()=>null);
    if(!r.ok)throw new Error('PAYMENTS_V8_BOOTSTRAP_HTTP_'+r.status);
    const next=extract(j);
    if(!next)throw new Error('PAYMENTS_V8_PROJECTION_MISSING');
    const previous=projection,previousKey=versionKeyOf(previous),nextKey=versionKeyOf(next),changed=!previous||previousKey!==nextKey;
    projection=next;
    window.__RONA_PAYMENTS_V8_PROJECTION_REFRESH_POLICY__='ADOPT_EVERY_SUCCESSFUL_NO_STORE_BOOTSTRAP_V1';
    disableLegacyPassportRuntime();
    bridgeProjection(reason,changed);
    window.__RONA_PAYMENTS_V8_UI_ERROR__=null;
    window.__RONA_PAYMENTS_V8_LAST_REFRESH__={reason,changed,versionKey:changed?nextKey:previousKey,at:new Date().toISOString()};
    return projection;
  }catch(error){
    window.__RONA_PAYMENTS_V8_UI_ERROR__=String(error&&error.message?error.message:error);
    window.__RONA_PAYMENTS_V8_LAST_REFRESH__={reason,changed:false,versionKey:versionKey(),failed:true,at:new Date().toISOString()};
    scheduleRetry();
    return projection;
  }finally{loading=null}})();
  return loading;
}
function paymentsOpen(){const page=document.getElementById('page-payments');if(!page)return false;if(page.hidden||page.getAttribute('aria-hidden')==='true')return false;try{return getComputedStyle(page).display!=='none'&&getComputedStyle(page).visibility!=='hidden'}catch{return true}}
function scheduleRetry(){if(retryTimer)return;retryTimer=setTimeout(()=>{retryTimer=null;if(!projection||paymentsOpen())load('retry')},3000)}
function refreshIfOpen(reason){if(paymentsOpen())return load(reason);return Promise.resolve(projection)}
function scheduleRefresh(reason){setTimeout(()=>load(reason),0)}
window.__RONA_PAYMENTS_V8_OPEN_PASSPORT__=openCanonicalPassport;
disableLegacyPassportRuntime();
const paymentsV8PassportClickHandler=event=>{const legacy=event.target?.closest?.('.rona-payments-v7-passport-trigger,.rona-payments-v7-passport > summary');if(legacy){event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();openCanonicalPassportForLegacyTrigger(legacy);return}const passport=event.target?.closest?.('[data-payments-v8-passport-deal]');if(passport){event.preventDefault();event.stopImmediatePropagation();openCanonicalPassport(passport.dataset.paymentsV8PassportDeal);return}if(event.target?.closest?.('[data-payments-v8-passport-close]')||event.target?.id===PASSPORT_MODAL_ID){event.preventDefault();closePassport();return}const b=event.target?.closest?.('#nav button[data-page="payments"],[data-page="payments"]');if(b)scheduleRefresh('navigation')};
const previousPassportHandler=document.__ronaPaymentsV8PassportClickHandler;if(typeof previousPassportHandler==='function')document.removeEventListener('click',previousPassportHandler,true);document.__ronaPaymentsV8PassportClickHandler=paymentsV8PassportClickHandler;document.addEventListener('click',paymentsV8PassportClickHandler,true);window.__RONA_PAYMENTS_V8_PASSPORT_ROUTING__='SELF_HEAL_V1';
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.getElementById(PASSPORT_MODAL_ID)){event.preventDefault();event.stopImmediatePropagation();closePassport()}},true);
window.addEventListener('rona:admin-app-ready',()=>scheduleRefresh('admin-app-ready'));
window.addEventListener('rona:finance-sync',event=>{if(publishing||event?.detail?.source===OWNER)return;refreshIfOpen('finance-sync')});
window.addEventListener('focus',()=>refreshIfOpen('focus'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshIfOpen('visibilitychange')});
refreshTimer=setInterval(()=>refreshIfOpen('interval'),REFRESH_MS);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{disableLegacyPassportRuntime();load('initial')},{once:true});else{disableLegacyPassportRuntime();load('initial')}

})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-payments-ui':'v8-bootstrap-bridge-v2',
    'x-rona-payments-visual-owner':'admin-payments-v7-native-v2',
    'x-rona-payments-money-display':'max-1-v1',
    'x-rona-payments-passport-routing':'canonical-v8-takeover-v3-native-total',
    'x-rona-ui-build':BUILD,
  }});
}
