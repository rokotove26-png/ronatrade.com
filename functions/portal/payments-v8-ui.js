import paymentsMoneyDisplayContract from './main-ui/payments-money-display-contract.js';

const BUILD='payments-v8-admin-ui-v2-money-display-20260917';

const SCRIPT=paymentsMoneyDisplayContract+String.raw`(()=>{'use strict';
if(window.__RONA_PAYMENTS_V8_UI_INSTALLED__)return;
window.__RONA_PAYMENTS_V8_UI_INSTALLED__=true;
const ENDPOINT='/portal/api/v1/admin/bootstrap';
const OWNER='payments-v8-bootstrap-v1';
let projection=null;
let loading=null;
let rendering=false;
let pageObserver=null;
let retryTimer=null;

function asArray(v){return Array.isArray(v)?v:[]}
function upper(v){return String(v==null?'':v).trim().toUpperCase()}
function authoritative(m){return !!m&&upper(m.status)==='AUTHORITATIVE'&&m.amount!==null&&m.amount!==undefined&&Number.isFinite(Number(m.amount))&&!!String(m.currency||'').trim()}
function fmtNumber(v){const formatted=globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.formatAmount(v);return formatted===null||formatted===undefined?'—':formatted}
function money(m){return authoritative(m)?fmtNumber(m.amount)+' '+upper(m.currency):'Требует проверки'}
function node(tag,attrs,...children){const el=document.createElement(tag);for(const [k,v] of Object.entries(attrs||{})){if(v===null||v===undefined)continue;if(k==='class')el.className=String(v);else if(k==='text')el.textContent=String(v);else if(k==='dataset'&&v&&typeof v==='object'){for(const [dk,dv] of Object.entries(v))el.dataset[dk]=String(dv)}else el.setAttribute(k,String(v))}for(const child of children.flat()){if(child===null||child===undefined)continue;el.append(child instanceof Node?child:document.createTextNode(String(child)))}return el}
function aggregate(field){const map=new Map();for(const d of asArray(projection?.deals)){const m=d?.[field];if(!authoritative(m))continue;const c=upper(m.currency);map.set(c,(map.get(c)||0)+Number(m.amount))}return Array.from(map.entries()).map(([currency,amount])=>({currency,amount})).sort((a,b)=>{const rank={USD:1,RUB:2,KZT:3};return(rank[a.currency]||99)-(rank[b.currency]||99)||a.currency.localeCompare(b.currency)})}
function kpi(title,field,tone){const lines=node('div',{class:'rona-fin-kpi-lines'}),rows=aggregate(field);if(!rows.length)lines.append(node('div',{class:'rona-owner-kpi',text:'—'}));for(const row of rows)lines.append(node('div',{class:'rona-fin-kpi-line'},node('span',{class:'rona-owner-kpi',text:fmtNumber(row.amount)+' '+row.currency}),node('span',{class:'rona-fin-kpi-currency',text:row.currency})));return node('section',{class:'rona-owner-card rona-fin-kpi rona-fin-kpi--'+tone},node('h2',{text:title}),lines)}
function statusPill(value){const v=upper(value)||'—';const ru={PAID:'Оплачено',PARTIALLY_PAID:'Частично оплачено',PARTIAL:'Частично оплачено',NOT_DUE:'Срок не наступил',DUE:'К оплате',OVERDUE:'Просрочено',CONDITIONAL:'Условное обязательство'}[v]||v;const tone=v==='PAID'?'success':v==='DUE'||v==='OVERDUE'?'warn':v==='NOT_DUE'||v==='CONDITIONAL'?'info':'neutral';return node('span',{class:'rona-fin-pill rona-fin-pill--'+tone,text:ru})}
function authorityPill(deal){const fields=['verified_received','due_now','future_conditional','actual_spend','remaining_execution'];const ok=fields.every(k=>authoritative(deal?.[k]));return node('span',{class:'rona-fin-pill rona-fin-pill--'+(ok?'success':'warn'),text:ok?'Подтверждено':'Требует проверки'})}
function table(){const wrap=node('div',{class:'rona-owner-table-wrap'}),t=node('table',{class:'rona-owner-table'}),thead=node('thead'),hr=node('tr');for(const h of ['Deal ID','Клиент','Получено','Ожидается сейчас','Условно','Потрачено','Остаток финансирования','Finance','Данные'])hr.append(node('th',{text:h}));thead.append(hr);const tbody=node('tbody');const deals=asArray(projection?.deals).slice().sort((a,b)=>String(a?.deal_id||'').localeCompare(String(b?.deal_id||'')));for(const d of deals){const tr=node('tr',{dataset:{dealId:d?.deal_id||''}},node('td',{text:d?.deal_id||'—'}),node('td',{text:d?.client_display||d?.client_name||d?.client_id||'—'}),node('td',{text:money(d?.verified_received)}),node('td',{text:money(d?.due_now)}),node('td',{text:money(d?.future_conditional)}),node('td',{text:money(d?.actual_spend)}),node('td',{text:money(d?.remaining_execution)}),node('td',{},statusPill(d?.financial_status)),node('td',{},authorityPill(d)));tbody.append(tr)}t.append(thead,tbody);wrap.append(t);return wrap}
function versionKey(){return String(projection?.source_as_of||projection?.generated_at||projection?.generatedAt||'current')}
function render(){
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7')return false;
  const page=document.getElementById('page-payments');if(!page)return false;
  const key=versionKey(),existing=page.querySelector(':scope > #ronaPaymentsV8Root');if(existing&&existing.dataset.versionKey===key)return true;
  rendering=true;
  try{
    const root=node('div',{id:'ronaPaymentsV8Root',class:'rona-owner-page-content',dataset:{ownerPage:'payments',ronaPaymentsOwner:OWNER,versionKey:key,moneyDisplayContract:globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.contract||'missing'}});
    const grid=node('div',{class:'rona-owner-grid rona-fin-kpi-grid'},kpi('Получено','verified_received','received'),kpi('Ожидается сейчас','due_now','expected'),kpi('Условно','future_conditional','expected'),kpi('Потрачено','actual_spend','paid'),kpi('Остаток финансирования','remaining_execution','received'));
    const summary=node('section',{class:'rona-owner-card'},node('h2',{text:'Финансовая картина по сделкам'}),table());
    const meta=node('div',{class:'rona-owner-muted',text:'Источник: каноническая V8 Finance authority projection · '+key});
    root.append(grid,summary,meta);
    page.replaceChildren(root);
    window.__RONA_PAYMENTS_V8_UI__={status:'READY',owner:OWNER,sourceAsOf:projection.source_as_of||null,dealCount:asArray(projection.deals).length,moneyDisplayContract:globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.contract||null,renderedAt:new Date().toISOString()};
    return true;
  }finally{rendering=false;observePage()}
}
function extract(payload){const direct=payload?.data?.paymentsV7Projection||payload?.paymentsV7Projection||null;if(direct?.contract==='ADMIN_PAYMENTS_V7'&&Array.isArray(direct.deals))return direct;return null}
async function load(){
  if(loading)return loading;
  loading=(async()=>{try{const r=await fetch(ENDPOINT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','cache-control':'no-store'}});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error('PAYMENTS_V8_BOOTSTRAP_HTTP_'+r.status);const p=extract(j);if(!p)throw new Error('PAYMENTS_V8_PROJECTION_MISSING');projection=p;window.__RONA_PAYMENTS_V8_PROJECTION__=p;window.__RONA_PAYMENTS_V8_UI_ERROR__=null;render();return p}catch(error){window.__RONA_PAYMENTS_V8_UI_ERROR__=String(error&&error.message?error.message:error);scheduleRetry();return null}finally{loading=null}})();
  return loading;
}
function scheduleRetry(){if(retryTimer)return;retryTimer=setTimeout(()=>{retryTimer=null;load()},3000)}
function observePage(){const page=document.getElementById('page-payments');if(!page||pageObserver)return;pageObserver=new MutationObserver(()=>{if(rendering||!projection)return;const root=page.querySelector(':scope > #ronaPaymentsV8Root');if(!root||root.dataset.versionKey!==versionKey())queueMicrotask(render)});pageObserver.observe(page,{childList:true})}
function scheduleRender(){setTimeout(()=>{if(projection)render();else load();observePage()},0)}
document.addEventListener('click',event=>{const b=event.target?.closest?.('#nav button[data-page="payments"],[data-page="payments"]');if(b)scheduleRender()},true);
window.addEventListener('rona:admin-app-ready',scheduleRender);
window.addEventListener('rona:finance-sync',()=>{if(projection)setTimeout(render,0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{load();observePage()},{once:true});else{load();observePage()}
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-payments-ui':'v8-bootstrap-v1',
    'x-rona-payments-money-display':'max-1-v1',
    'x-rona-ui-build':BUILD,
  }});
}
