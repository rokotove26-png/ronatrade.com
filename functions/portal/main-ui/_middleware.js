const CASH_OWNER='cash-r2-exclusive-v1';
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
const RADIO_VISUAL_VERSION='20260915-radio-v7-constrained-r1';
const RADIO_VISUAL_LOADER="\n;(()=>{try{if(!window.__RONA_ADMIN_RADIO_DESIGNER_V7__&&!document.getElementById('rona-admin-radio-designer-v7')){const s=document.createElement('script');s.id='rona-admin-radio-designer-v7';s.src='/assets/portal-admin-radio-designer-v7.js?v="+RADIO_VISUAL_VERSION+"';s.async=false;s.dataset.ronaVisualOnly='radio-designer-v7-constrained';document.body.appendChild(s)}}catch(_e){}})();\n";

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
    patched=patchCashSingleOwner(await response.text());
  }catch(error){
    return new Response(String(error?.message||error||'ADMIN_CASH_SINGLE_OWNER_PATCH_FAILED'),{
      status:500,
      headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-rona-cash-owner':CASH_OWNER,'x-rona-cash-single-owner':'failed'}
    });
  }
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('x-rona-cash-owner',CASH_OWNER);
  headers.set('x-rona-cash-legacy-owner','disabled');
  headers.set('x-rona-cash-single-owner','enforced');
  headers.set('x-rona-cash-host','r2-owned-shell');
  headers.set('x-rona-radio-visual','designer-v7-constrained');
  return new Response(patched,{status:response.status,statusText:response.statusText,headers});
}

export const __test={patchCashSingleOwner,CASH_OWNER,RADIO_VISUAL_VERSION};
