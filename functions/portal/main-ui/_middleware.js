const CASH_OWNER='cash-r2-exclusive-v1';
const PAYMENTS_OWNER='admin-payments-v7-native-v2';
const LEGACY_RENDER_START='function renderCash(){';
const LEGACY_RENDER_END='\nif(!window.__RONA_FINANCE_FRAGMENT_UI_LISTENER__)';
const LEGACY_FINANCE_LISTENER="window.addEventListener('rona:finance-sync',()=>{try{renderPayments();renderCash()}catch(_e){}})";
const PAYMENTS_ONLY_FINANCE_LISTENER="window.addEventListener('rona:finance-sync',()=>{try{renderPayments()}catch(_e){}})";
const LEGACY_ACCOUNTING_ROUTE='accounting:renderCash,';
const CASH_R2_ACCOUNTING_ROUTE='accounting:ensureCashR2Host,';
const LEGACY_BOOT_SEQUENCE='renderPayments();renderCash();renderRail();';
const CASH_R2_BOOT_SEQUENCE='renderPayments();ensureCashR2Host();renderRail();';
const OWNED_PAGE_MARKER='function renderOwnedAdminPage(id){';
const CASH_R2_HOST_FUNCTION="function ensureCashR2Host(){const p=page('accounting');if(!p)return null;let host=q(':scope > .rona-owner-page-content[data-owner-page=\\\"accounting\\\"]',p)||q(':scope > .rona-owner-page-content',p);if(!host){for(const child of Array.from(p.children))child.classList.add('rona-owner-original-hidden');host=e('div',{class:'rona-owner-page-content','data-owner-page':'accounting','data-rona-cash-host':'r2'});p.append(host)}host.dataset.ronaCashHost='r2';host.classList.remove('rona-owner-original-hidden');host.removeAttribute('aria-hidden');host.style.removeProperty('display');return host}\n";
const RADIO_VISUAL_VERSION='20260915-radio-wide-v10-r1';
const RADIO_VISUAL_LOADER="\n;(()=>{try{if(!window.__RONA_ADMIN_RADIO_WIDE_V10__&&!document.getElementById('rona-admin-radio-wide-v10')){const s=document.createElement('script');s.id='rona-admin-radio-wide-v10';s.src='/assets/portal-admin-radio-wide-v10.js?v="+RADIO_VISUAL_VERSION+"';s.async=false;s.dataset.ronaVisualOnly='radio-wide-v10';document.body.appendChild(s)}}catch(_e){}})();\n";

function patchPaymentsCurrentSemantics(source){
  let script=String(source||'');
  if(script.includes("data-rona-payments-owner':'admin-payments-v7-native-v2'")&&script.includes("paymentsV7Kpi('Conditional'"))return script;
  const aggregateExpected="function paymentsV7AggregateExpected(deals){const m=new Map();let verify=false;for(const d of deals){for(const field of ['due_now','expected_not_due']){const v=d?.[field],c=paymentsV7Upper(v?.currency),n=paymentsV7Num(v?.amount);if(!v||paymentsV7Upper(v.status)!=='AUTHORITATIVE'||!c||n===null){verify=true;continue}m.set(c,(m.get(c)||0)+n)}}return{rows:[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([currency,amount])=>({currency,amount})),verify}}\n";
  const replacements=[
    [
      ".rona-payments-v7-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}",
      ".rona-payments-v7-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}"
    ],
    [
      "function paymentsV7MoneyLines(rows,verify=false)",
      aggregateExpected+"function paymentsV7MoneyLines(rows,verify=false)"
    ],
    [
      "deal?.authority_refs,deal?.total_to_receive?.authority_refs,deal?.verified_received?.authority_refs,deal?.expected_not_due?.authority_refs,deal?.future_conditional?.authority_refs,deal?.actual_spend?.authority_refs",
      "deal?.authority_refs,deal?.total_to_receive?.authority_refs,deal?.verified_received?.authority_refs,deal?.remaining_to_receive?.authority_refs,deal?.due_now?.authority_refs,deal?.expected_not_due?.authority_refs,deal?.future_conditional?.authority_refs,deal?.actual_spend?.authority_refs,deal?.remaining_execution?.authority_refs"
    ],
    [
      "e('strong',{text:paymentsV7Money(deal?.expected_not_due)})",
      "e('strong',{text:paymentsV7Money(deal?.remaining_to_receive)})"
    ],
    [
      "expected=paymentsV7Aggregate(deals,'expected_not_due')",
      "expected=paymentsV7AggregateExpected(deals)"
    ],
    [
      "kpis.append(paymentsV7Kpi('К получению',paymentsV7MoneyLines(total.rows,total.verify)),paymentsV7Kpi('Получено',paymentsV7MoneyLines(received.rows,received.verify)),paymentsV7Kpi('Ожидается',paymentsV7MoneyLines(expected.rows,expected.verify),conditionalSub),paymentsV7Kpi('Потрачено / Остаток',spendNode));",
      "kpis.append(paymentsV7Kpi('Сумма по сделке',paymentsV7MoneyLines(total.rows,total.verify)),paymentsV7Kpi('Получено',paymentsV7MoneyLines(received.rows,received.verify)),paymentsV7Kpi('Ожидается',paymentsV7MoneyLines(expected.rows,expected.verify)),paymentsV7Kpi('Conditional',paymentsV7MoneyLines(conditional.rows,conditional.verify),e('div',{class:'rona-payments-v7-kpi-sub',text:'Условно ожидается'})),paymentsV7Kpi('Потрачено / Остаток',spendNode));"
    ],
    [
      "e('span',{text:'К получению'})",
      "e('span',{text:'Сумма по сделке'})"
    ]
  ];
  for(const [from,to] of replacements){
    if(!script.includes(from))throw new Error('ADMIN_PAYMENTS_CURRENT_SEMANTICS_SOURCE_MISMATCH:'+from.slice(0,64));
    script=script.replace(from,to);
  }
  script=script.replaceAll("'admin-payments-v7-native'","'admin-payments-v7-native-v2'");
  if(!script.includes("paymentsV7Money(deal?.remaining_to_receive)")||!script.includes("paymentsV7Kpi('Conditional'")||!script.includes('paymentsV7AggregateExpected(deals)'))throw new Error('ADMIN_PAYMENTS_CURRENT_SEMANTICS_PATCH_INCOMPLETE');
  return script;
}

function patchCashSingleOwner(source){
  let script=String(source||'');
  const start=script.indexOf(LEGACY_RENDER_START);
  const end=script.indexOf(LEGACY_RENDER_END,start);
  if(start<0||end<0||end<=start)throw new Error('ADMIN_CASH_LEGACY_RENDERER_SOURCE_MISMATCH');
  script=script.slice(0,start)+script.slice(end);
  for(const [from,to,label] of [
    [LEGACY_FINANCE_LISTENER,PAYMENTS_ONLY_FINANCE_LISTENER,'FINANCE_LISTENER'],
    [LEGACY_ACCOUNTING_ROUTE,CASH_R2_ACCOUNTING_ROUTE,'ACCOUNTING_ROUTE'],
    [LEGACY_BOOT_SEQUENCE,CASH_R2_BOOT_SEQUENCE,'BOOT_SEQUENCE']
  ]){
    if(!script.includes(from))throw new Error('ADMIN_CASH_'+label+'_SOURCE_MISMATCH');
    script=script.replace(from,to);
  }
  if(!script.includes(OWNED_PAGE_MARKER))throw new Error('ADMIN_CASH_HOST_INSERTION_SOURCE_MISMATCH');
  script=script.replace(OWNED_PAGE_MARKER,CASH_R2_HOST_FUNCTION+OWNED_PAGE_MARKER);
  if(script.includes('renderCash'))throw new Error('ADMIN_CASH_COMPETING_RENDERER_REMAINS');
  if(!script.includes(CASH_R2_ACCOUNTING_ROUTE)||!script.includes(CASH_R2_BOOT_SEQUENCE)||!script.includes('data-rona-cash-host'))throw new Error('ADMIN_CASH_R2_HOST_MISSING');
  return "window.__RONA_CASH_RUNTIME_OWNER__='"+CASH_OWNER+"';\n"+script+RADIO_VISUAL_LOADER;
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
      headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-rona-cash-owner':CASH_OWNER,'x-rona-cash-single-owner':'failed','x-rona-payments-ui':PAYMENTS_OWNER,'x-rona-payments-current-runtime':'failed'}
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
  headers.set('x-rona-payments-ui',PAYMENTS_OWNER);
  headers.set('x-rona-payments-handoff','payments-v7-projection');
  headers.set('x-rona-payments-current-runtime','conditional-aware-v2');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}

export const __test={patchCashSingleOwner,patchPaymentsCurrentSemantics,CASH_OWNER,PAYMENTS_OWNER,RADIO_VISUAL_VERSION};
