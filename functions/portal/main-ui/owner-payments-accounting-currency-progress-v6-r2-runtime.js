import ownerPaymentsV6AuthorityRuntime from './owner-payments-accounting-currency-progress-v6-authority-runtime.js';

const VERSION_FROM="window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__='20260913-accounting-currency-progress-v6';";
const VERSION_TO="window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__='20260913-accounting-currency-progress-v6-r2';";
const RENDER_ANCHOR="function renderFinance(f){injectCss();if(!financeAuthorityOk(f)){";
const RENDER_ANCHOR_TO="function renderFinance(f){injectCss();const authorityOk=financeAuthorityOk(f);recordR2Diag({financeAuthorityOk:authorityOk,phase:'renderFinance'});if(!authorityOk){";
const GRID_FROM="const grid=e('div',{class:'rona-owner-grid rona-fin-kpi-grid'});grid.append(financeKpiCard('Получено от клиентов','received',A(f.verifiedReceivedTotalsByCurrency)),financeKpiCard('Ожидается поступление','expected',A(f.expectedReceiptTotalsByCurrency)),financeKpiCard('К оплате сейчас','expected',A(f.dueNowTotalsByCurrency)),card('Фактически потрачено',e('div',{class:'kpi-value',text:totalsText(f.dealActualSpendTotalsByAccountingCurrency)})));";
const GRID_TO="const grid=summaryGrid(f);";
const PURPOSE_FROM="const purpose=e('div',{class:'rona-pay-v6-purpose'});purpose.append(card('Учет в валюте сделки',e('div',{class:'rona-owner-muted',text:'Валюта учета = валюта подтвержденного входящего клиентского платежа. Mixed currency → TO_VERIFY.'})),card('Cross-currency spend',e('div',{class:'rona-owner-muted',text:'Пересчет только по exact bank/Treasury source-lock. Synthetic FX запрещен.'})),card('Шкала платежа',e('div',{class:'rona-owner-muted',text:'Заполняется только VERIFIED_RECEIVED / TOTAL_TO_RECEIVE. Отложенное остается нейтральным.'})));";
const PURPOSE_TO="const purpose=summaryPolicyStrip();";
const READY_FROM="window.__RONA_OWNER_PAYMENTS_V6_READY__=true}";
const READY_TO="window.__RONA_OWNER_PAYMENTS_V6_READY__=true;recordR2Diag({rendered:true,renderOwner:'V6_R2',markerPresent:r2SummaryPresent(),legacyOverwriteDetected:false})}";
const RENDER_HOOK_FROM="window.__RONA_OWNER_PAYMENTS_V6_RENDER__=render;";
const RENDER_HOOK_TO="window.__RONA_OWNER_PAYMENTS_V6_RENDER__=render;window.__RONA_OWNER_PAYMENTS_V6_REFRESH__=()=>refreshAfter();installR2OwnerGuard();window.addEventListener('rona:admin-pagechange',onR2PageChange);window.addEventListener('rona:finance-sync',onR2FinanceSync);window.addEventListener('rona:admin-single-owner-ready',()=>render(),{once:true});";

const SUMMARY_HELPERS=String.raw`
function ensureR2SummaryCss(){if(document.getElementById('rona-pay-v6-r2-css'))return;const st=document.createElement('style');st.id='rona-pay-v6-r2-css';st.textContent='.rona-pay-v6-summary-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:stretch}.rona-pay-v6-summary-card{margin:0!important;padding:13px 15px!important;min-height:112px;height:100%;display:flex;flex-direction:column;justify-content:space-between;gap:10px}.rona-pay-v6-summary-title{font-size:11px;line-height:1.25;letter-spacing:.04em;text-transform:uppercase;opacity:.66;font-weight:650}.rona-pay-v6-summary-values{display:grid;gap:4px}.rona-pay-v6-summary-money-line{font-size:clamp(20px,1.75vw,27px);font-weight:760;line-height:1.08;white-space:nowrap}.rona-pay-v6-summary-money-line[data-secondary=true]{font-size:16px;font-weight:690}.rona-pay-v6-summary-empty{font-size:22px;font-weight:720;opacity:.72}.rona-pay-v6-summary-split{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rona-pay-v6-summary-split-block{min-width:0}.rona-pay-v6-summary-split-label{font-size:10px;line-height:1.2;opacity:.56;margin-bottom:5px}.rona-pay-v6-summary-split .rona-pay-v6-summary-money-line{font-size:16px}.rona-pay-v6-policy-strip{display:flex;gap:8px 16px;align-items:center;flex-wrap:wrap;padding:7px 10px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:rgba(148,163,184,.035);font-size:11px;line-height:1.35;opacity:.78}.rona-pay-v6-policy-strip span{white-space:normal}@media(max-width:1100px){.rona-pay-v6-summary-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:680px){.rona-pay-v6-summary-kpis{grid-template-columns:1fr}.rona-pay-v6-summary-card{min-height:96px}.rona-pay-v6-summary-split{grid-template-columns:1fr 1fr}.rona-pay-v6-summary-money-line{font-size:23px}}';document.head.append(st)}
function summaryMoneyRows(rows,secondary=false){const host=e('div',{class:'rona-pay-v6-summary-values'}),items=A(rows);if(!items.length){host.append(e('div',{class:'rona-pay-v6-summary-empty',text:'—'}));return host}for(const x of items)host.append(e('div',{class:'rona-pay-v6-summary-money-line','data-secondary':secondary?'true':'false','data-rona-summary-currency':S(x.currency),text:money(x.amount,x.currency)}));return host}
function summaryCard(title,rows,metric){return e('section',{class:'rona-owner-card rona-pay-v6-summary-card','data-rona-summary-metric':metric},e('div',{class:'rona-pay-v6-summary-title',text:title}),summaryMoneyRows(rows,false))}
function summarySpendBalanceCard(f){const body=e('div',{class:'rona-pay-v6-summary-split'}),spent=e('div',{class:'rona-pay-v6-summary-split-block'},e('div',{class:'rona-pay-v6-summary-split-label',text:'Потрачено'}),summaryMoneyRows(A(f.dealActualSpendTotalsByAccountingCurrency),true)),remaining=e('div',{class:'rona-pay-v6-summary-split-block'},e('div',{class:'rona-pay-v6-summary-split-label',text:'Остаток к получению'}),summaryMoneyRows(A(f.remainingToReceiveTotalsByCurrency),true));body.append(spent,remaining);return e('section',{class:'rona-owner-card rona-pay-v6-summary-card','data-rona-summary-metric':'spent-remaining'},e('div',{class:'rona-pay-v6-summary-title',text:'Потрачено / Остаток'}),body)}
function summaryGrid(f){ensureR2SummaryCss();const grid=e('div',{class:'rona-pay-v6-summary-kpis','data-rona-summary-kpis':'v6-r2'});grid.append(summaryCard('К получению',A(f.totalToReceiveTotalsByCurrency),'to-receive'),summaryCard('Получено',A(f.verifiedReceivedTotalsByCurrency),'received'),summaryCard('Ожидается',A(f.expectedReceiptTotalsByCurrency),'expected'),summarySpendBalanceCard(f));return grid}
function summaryPolicyStrip(){return e('div',{class:'rona-pay-v6-policy-strip','data-rona-summary-policy':'compact'},e('span',{text:'Валюта учета: verified client payment; до первого платежа — только authoritative Finance/Owner, иначе TO_VERIFY.'}),e('span',{text:'Cross-currency: только exact bank/Treasury source-lock; synthetic FX запрещен.'}),e('span',{text:'Progress: VERIFIED_RECEIVED / TOTAL_TO_RECEIVE; deferred остается нейтральным.'}))}
function recordR2Diag(patch={}){window.__RONA_OWNER_PAYMENTS_V6_DIAGNOSTICS__=Object.assign({},window.__RONA_OWNER_PAYMENTS_V6_DIAGNOSTICS__||{},patch,{runtime:window.__RONA_OWNER_PAYMENTS_V6_RUNTIME__||null,pathname:location.pathname,at:new Date().toISOString()})}
function r2SummaryPresent(){return !!document.querySelector('#page-payments [data-rona-summary-kpis="v6-r2"]')}
let r2RecoveryQueued=false;
function scheduleR2Recovery(reason){if(r2RecoveryQueued)return;r2RecoveryQueued=true;queueMicrotask(()=>{r2RecoveryQueued=false;if(!window.__RONA_OWNER_PAYMENTS_V6_READY__||r2SummaryPresent())return;recordR2Diag({legacyOverwriteDetected:true,lastRecoveryReason:String(reason||'unknown')});render()})}
function installR2OwnerGuard(){const host=document.getElementById('page-payments');if(!host||host.__ronaV6R2OwnerGuard)return;host.__ronaV6R2OwnerGuard=true;const observer=new MutationObserver(()=>scheduleR2Recovery('payments-dom-mutation'));observer.observe(host,{childList:true,subtree:true});window.__RONA_OWNER_PAYMENTS_V6_OWNER_GUARD__=observer;recordR2Diag({ownerGuardInstalled:true})}
function onR2PageChange(event){if(S(event?.detail?.page)!=='payments')return;recordR2Diag({pageChangeObserved:true});if(state.finance)renderFinance(state.finance);else render()}
function onR2FinanceSync(){if(S(document.documentElement?.dataset?.ronaAdminPage)!=='payments')return;recordR2Diag({financeSyncObserved:true});refreshAfter().catch(err=>{recordR2Diag({financeSyncRefreshError:S(err?.message||err)});console.error('owner payments v6 r2 finance sync',err)})}
`;

for(const [name,token] of Object.entries({VERSION_FROM,RENDER_ANCHOR,GRID_FROM,PURPOSE_FROM,READY_FROM,RENDER_HOOK_FROM}))if(!ownerPaymentsV6AuthorityRuntime.includes(token))throw new Error('OWNER_PAYMENTS_V6_R2_SOURCE_DRIFT_'+name);

const ownerPaymentsV6R2Runtime=ownerPaymentsV6AuthorityRuntime
  .replace(VERSION_FROM,VERSION_TO)
  .replace(RENDER_ANCHOR,SUMMARY_HELPERS+RENDER_ANCHOR_TO)
  .replace(GRID_FROM,GRID_TO)
  .replace(PURPOSE_FROM,PURPOSE_TO)
  .replace(READY_FROM,READY_TO)
  .replace(RENDER_HOOK_FROM,RENDER_HOOK_TO);

if(!ownerPaymentsV6R2Runtime.includes("data-rona-summary-kpis"))throw new Error('OWNER_PAYMENTS_V6_R2_SUMMARY_MISSING');
if(!ownerPaymentsV6R2Runtime.includes('grid-template-columns:repeat(4,minmax(0,1fr))'))throw new Error('OWNER_PAYMENTS_V6_R2_DESKTOP_GRID_MISSING');
if(!ownerPaymentsV6R2Runtime.includes('@media(max-width:1100px){.rona-pay-v6-summary-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}'))throw new Error('OWNER_PAYMENTS_V6_R2_MEDIUM_GRID_MISSING');
if(!ownerPaymentsV6R2Runtime.includes('@media(max-width:680px){.rona-pay-v6-summary-kpis{grid-template-columns:1fr}'))throw new Error('OWNER_PAYMENTS_V6_R2_MOBILE_GRID_MISSING');
if(!ownerPaymentsV6R2Runtime.includes("window.__RONA_OWNER_PAYMENTS_V6_REFRESH__=()=>refreshAfter()"))throw new Error('OWNER_PAYMENTS_V6_R2_REFRESH_HOOK_MISSING');
if(!ownerPaymentsV6R2Runtime.includes("window.addEventListener('rona:admin-pagechange',onR2PageChange)"))throw new Error('OWNER_PAYMENTS_V6_R2_PAGECHANGE_OWNER_MISSING');
if(!ownerPaymentsV6R2Runtime.includes('new MutationObserver(()=>scheduleR2Recovery'))throw new Error('OWNER_PAYMENTS_V6_R2_DOM_OWNER_GUARD_MISSING');
if(!ownerPaymentsV6R2Runtime.includes('subtree:true'))throw new Error('OWNER_PAYMENTS_V6_R2_NESTED_DOM_GUARD_MISSING');
if(!ownerPaymentsV6R2Runtime.includes('financeAuthorityOk:authorityOk'))throw new Error('OWNER_PAYMENTS_V6_R2_AUTHORITY_DIAGNOSTIC_MISSING');

export default ownerPaymentsV6R2Runtime;