import paymentsMoneyDisplayContract from './payments-money-display-contract.js';

const CASH_OWNER='cash-r2-exclusive-v1';
const PAYMENTS_OWNER='admin-payments-v7-native-v2';
const PAYMENTS_V8_BOOTSTRAP_OWNER='payments-v8-bootstrap-v1';
const LEGACY_RENDER_START='function renderCash(){';
const LEGACY_RENDER_END='\nif(!window.__RONA_FINANCE_FRAGMENT_UI_LISTENER__)';
const LEGACY_FINANCE_LISTENER="window.addEventListener('rona:finance-sync',()=>{try{renderPayments();renderCash()}catch(_e){}})";
const PAYMENTS_ONLY_FINANCE_LISTENER="window.addEventListener('rona:finance-sync',()=>{try{renderPayments()}catch(_e){}})";
const LEGACY_ACCOUNTING_ROUTE='accounting:renderCash,';
const CASH_R2_ACCOUNTING_ROUTE='accounting:ensureCashR2Host,';
const LEGACY_BOOT_SEQUENCE='renderPayments();renderCash();renderRail();';
const CASH_R2_BOOT_SEQUENCE='renderPayments();ensureCashR2Host();renderRail();';
const CURRENT_RAIL_BOOT_SEQUENCE='renderPayments();renderCash();renderRailCurrentShell();';
const CASH_R2_CURRENT_RAIL_BOOT_SEQUENCE='renderPayments();ensureCashR2Host();renderRailCurrentShell();';
const OWNED_PAGE_MARKER='function renderOwnedAdminPage(id){';
const CASH_R2_HOST_FUNCTION="function ensureCashR2Host(){const p=page('accounting');if(!p)return null;let host=q(':scope > .rona-owner-page-content[data-owner-page=\\\"accounting\\\"]',p)||q(':scope > .rona-owner-page-content',p);if(!host){for(const child of Array.from(p.children))child.classList.add('rona-owner-original-hidden');host=e('div',{class:'rona-owner-page-content','data-owner-page':'accounting','data-rona-cash-host':'r2'});p.append(host)}host.dataset.ronaCashHost='r2';host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display');return host}\n";
const RADIO_VISUAL_VERSION='20260915-radio-wide-v10-r1';
const RADIO_VISUAL_LOADER="\n;(()=>{try{if(!window.__RONA_ADMIN_RADIO_WIDE_V10__&&!document.getElementById('rona-admin-radio-wide-v10')){const s=document.createElement('script');s.id='rona-admin-radio-wide-v10';s.src='/assets/portal-admin-radio-wide-v10.js?v="+RADIO_VISUAL_VERSION+"';s.async=false;s.dataset.ronaVisualOnly='radio-wide-v10';document.body.appendChild(s)}}catch(_e){}})();\n";
const PAYMENTS_V8_BOOTSTRAP_LOADER="\n;(()=>{try{if(!window.__RONA_PAYMENTS_V8_UI_INSTALLED__&&!document.getElementById('rona-payments-v8-bootstrap-ui')){const s=document.createElement('script');s.id='rona-payments-v8-bootstrap-ui';s.src='/portal/payments-v8-ui?v=20260917-v1';s.async=false;s.dataset.ronaPaymentsOwner='"+PAYMENTS_V8_BOOTSTRAP_OWNER+"';document.body.appendChild(s)}}catch(error){window.__RONA_PAYMENTS_V8_UI_ERROR__=String(error&&error.message?error.message:error)}})();\n";
const LEGACY_PAYMENTS_V7_FORMATTERS=[
  "function paymentsV7Fmt(v){const n=paymentsV7Num(v);return n===null?'TO_VERIFY':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)}",
  "function paymentsV7Fmt(v){const n=paymentsV7Num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)}",
];
const CANONICAL_PAYMENTS_V7_FORMATTER="function paymentsV7Fmt(v){const n=paymentsV7Num(v);if(n===null)return'TO_VERIFY';const formatted=globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.formatAmount(n);return formatted===null||formatted===undefined?'TO_VERIFY':formatted}";
const PASSPORT_FALLBACK_FORMATTER="if(typeof globalThis.paymentsV7Fmt!=='function')globalThis.paymentsV7Fmt=value=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(Number(value));";
const CANONICAL_PASSPORT_FORMATTER="if(typeof globalThis.paymentsV7Fmt!=='function')globalThis.paymentsV7Fmt=value=>{const formatted=globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.formatAmount(value);return formatted===null||formatted===undefined?'TO_VERIFY':formatted};";

function patchPaymentsCurrentSemantics(source){
  let script=String(source||'');
  const required=[
    "data-rona-payments-owner':'admin-payments-v7-native-v2'",
    'paymentsV7Money(deal?.due_now)',
    "paymentsV7Kpi('Conditional'",
    "paymentsV7Aggregate(deals,'future_conditional')",
    'paymentsV7OwnerMoney(deal?.due_now',
    'paymentsV7OwnerMoney(deal?.future_conditional',
  ];
  for(const marker of required){
    if(!script.includes(marker))throw new Error('ADMIN_PAYMENTS_V8_RUNTIME_REQUIRED:'+marker.slice(0,72));
  }
  const finalDealStart=script.indexOf('paymentsV7Deal=function paymentsV7DealFinalDisplay(deal){');
  const finalDealEnd=script.indexOf('const PAYMENTS_V7_SERVER_AGGREGATE_UI=',finalDealStart);
  if(finalDealStart<0||finalDealEnd<=finalDealStart)throw new Error('ADMIN_PAYMENTS_V8_FINAL_DISPLAY_SOURCE_MISMATCH');
  const finalDealRenderer=script.slice(finalDealStart,finalDealEnd);
  if(!finalDealRenderer.includes('paymentsV7OwnerMoney(deal?.due_now'))throw new Error('ADMIN_PAYMENTS_V8_DUE_NOW_DISPLAY_MISSING');
  if(!finalDealRenderer.includes('paymentsV7OwnerMoney(deal?.future_conditional'))throw new Error('ADMIN_PAYMENTS_V8_CONDITIONAL_DISPLAY_MISSING');
  if(finalDealRenderer.includes('paymentsV7OwnerMoney(deal?.remaining_to_receive'))throw new Error('ADMIN_PAYMENTS_V8_STALE_REMAINING_DISPLAY_PRESENT');

  let boardFormatterReady=script.includes(CANONICAL_PAYMENTS_V7_FORMATTER);
  for(const legacy of LEGACY_PAYMENTS_V7_FORMATTERS){
    if(script.includes(legacy)){
      script=script.replace(legacy,CANONICAL_PAYMENTS_V7_FORMATTER);
      boardFormatterReady=true;
    }
  }
  if(!boardFormatterReady)throw new Error('ADMIN_PAYMENTS_MONEY_BOARD_FORMATTER_SOURCE_MISMATCH');

  let passportFormatterReady=script.includes(CANONICAL_PASSPORT_FORMATTER);
  if(script.includes(PASSPORT_FALLBACK_FORMATTER)){
    script=script.replace(PASSPORT_FALLBACK_FORMATTER,CANONICAL_PASSPORT_FORMATTER);
    passportFormatterReady=true;
  }
  if(!passportFormatterReady)throw new Error('ADMIN_PAYMENTS_MONEY_PASSPORT_FORMATTER_SOURCE_MISMATCH');

  if(LEGACY_PAYMENTS_V7_FORMATTERS.some(legacy=>script.includes(legacy))||script.includes(PASSPORT_FALLBACK_FORMATTER))throw new Error('ADMIN_PAYMENTS_COMPETING_FORMATTER_REMAINS');
  return paymentsMoneyDisplayContract+'\n'+script;
}

function patchCashSingleOwner(source){
  let script=String(source||'');
  const start=script.indexOf(LEGACY_RENDER_START);
  const end=script.indexOf(LEGACY_RENDER_END,start);
  if(start<0||end<0||end<=start)throw new Error('ADMIN_CASH_LEGACY_RENDERER_SOURCE_MISMATCH');
  script=script.slice(0,start)+script.slice(end);
  for(const [from,to,label] of [
    [LEGACY_FINANCE_LISTENER,PAYMENTS_ONLY_FINANCE_LISTENER,'FINANCE_LISTENER'],
    [LEGACY_ACCOUNTING_ROUTE,CASH_R2_ACCOUNTING_ROUTE,'ACCOUNTING_ROUTE']
  ]){
    if(!script.includes(from))throw new Error('ADMIN_CASH_'+label+'_SOURCE_MISMATCH');
    script=script.replace(from,to);
  }
  const currentRailBoot=script.includes(CURRENT_RAIL_BOOT_SEQUENCE);
  const legacyRailBoot=script.includes(LEGACY_BOOT_SEQUENCE);
  if(currentRailBoot===legacyRailBoot)throw new Error('ADMIN_CASH_BOOT_SEQUENCE_SOURCE_MISMATCH');
  script=script.replace(
    currentRailBoot?CURRENT_RAIL_BOOT_SEQUENCE:LEGACY_BOOT_SEQUENCE,
    currentRailBoot?CASH_R2_CURRENT_RAIL_BOOT_SEQUENCE:CASH_R2_BOOT_SEQUENCE
  );
  if(!script.includes(OWNED_PAGE_MARKER))throw new Error('ADMIN_CASH_HOST_INSERTION_SOURCE_MISMATCH');
  script=script.replace(OWNED_PAGE_MARKER,CASH_R2_HOST_FUNCTION+OWNED_PAGE_MARKER);
  if(script.includes('renderCash'))throw new Error('ADMIN_CASH_COMPETING_RENDERER_REMAINS');
  const cashBootReady=script.includes(CASH_R2_CURRENT_RAIL_BOOT_SEQUENCE)||script.includes(CASH_R2_BOOT_SEQUENCE);
  if(!script.includes(CASH_R2_ACCOUNTING_ROUTE)||!cashBootReady||!script.includes('data-rona-cash-host'))throw new Error('ADMIN_CASH_R2_HOST_MISSING');
  return "window.__RONA_CASH_RUNTIME_OWNER__='"+CASH_OWNER+"';\n"+script+RADIO_VISUAL_LOADER+PAYMENTS_V8_BOOTSTRAP_LOADER;
}

export async function onRequest(context){
  const path=new URL(context.request.url).pathname;
  if(path!=='/portal/main-ui')return context.next();
  const response=await context.next();
  if(!response.ok)return response;
  const contentType=String(response.headers.get('content-type')||'').toLowerCase();
  if(!contentType.includes('javascript'))return response;
  let patched;
  try{
    const paymentsPatched=patchPaymentsCurrentSemantics(await response.text());
    patched=patchCashSingleOwner(paymentsPatched);
  }catch(error){
    return new Response(String(error?.message||error||'ADMIN_MAIN_UI_PATCH_FAILED'),{
      status:500,
      headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-rona-cash-owner':CASH_OWNER,'x-rona-cash-single-owner':'failed','x-rona-payments-ui':PAYMENTS_OWNER,'x-rona-payments-current-runtime':'failed','x-rona-payments-money-display':'failed'}
    });
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-cash-owner',CASH_OWNER);
  headers.set('x-rona-cash-legacy-owner','disabled');
  headers.set('x-rona-cash-single-owner','enforced');
  headers.set('x-rona-cash-host','r2-owned-shell');
  headers.set('x-rona-radio-visual','wide-v10');
  headers.set('x-rona-payments-ui',PAYMENTS_V8_BOOTSTRAP_OWNER);
  headers.set('x-rona-payments-handoff','canonical-v8-bootstrap');
  headers.set('x-rona-payments-current-runtime','due-now-conditional-v3');
  headers.set('x-rona-payments-money-display','max-1-v1');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}

export const __test={patchCashSingleOwner,patchPaymentsCurrentSemantics,CASH_OWNER,PAYMENTS_OWNER,PAYMENTS_V8_BOOTSTRAP_OWNER,RADIO_VISUAL_VERSION};
