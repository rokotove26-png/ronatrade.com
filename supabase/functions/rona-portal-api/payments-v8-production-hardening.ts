// Payments V8 production hardening wrapper.
// Keeps the exact current production portal handler and adds only server-side aggregate/version projection.
import { buildConfirmedFundingAggregate, buildPaymentsCurrencyAggregates } from '../_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';

const BASELINE='5aceffe2725a904e8e0ded562e483f012e861085';
const nativeServe=Deno.serve.bind(Deno);
let capturedHandler:any=null;

(Deno as any).serve=function capturePortalHandler(first:any,second?:any){
  const handler=typeof first==='function'?first:second;
  if(typeof handler!=='function')throw new Error('PAYMENTS_V8_BASELINE_HANDLER_REQUIRED');
  capturedHandler=handler;
  return {finished:Promise.resolve(),shutdown(){},ref(){},unref(){}};
};

await import('https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/5aceffe2725a904e8e0ded562e483f012e861085/supabase/functions/rona-portal-api/application-business-bootstrap-v2.ts');
(Deno as any).serve=nativeServe;
if(typeof capturedHandler!=='function')throw new Error('PAYMENTS_V8_BASELINE_HANDLER_CAPTURE_FAILED');

function isAdminBootstrap(req:Request){
  return req.method==='GET' && new URL(req.url).pathname.endsWith('/v1/admin/bootstrap');
}
function projectionVersionKey(projection:any){
  const ids=Array.isArray(projection?.deals)?projection.deals.map((d:any)=>String(d?.deal_id||'')).filter(Boolean).sort():[];
  return [
    String(projection?.source_as_of||''),
    String(projection?.generated_at||projection?.generatedAt||''),
    String(projection?.finance_authority_projection_reconciliation?.version||''),
    ids.join(','),
  ].join('|');
}
async function hardenBootstrap(req:Request,response:Response){
  if(!isAdminBootstrap(req)||!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))return response;
  const payload=await response.clone().json().catch(()=>null);
  const projection=payload?.data?.paymentsV7Projection;
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7'||!Array.isArray(projection.deals))return response;
  projection.currency_aggregates=buildPaymentsCurrencyAggregates(projection.deals);
  projection.funding_aggregate=buildConfirmedFundingAggregate(projection.deals);
  projection.projection_version_key=projectionVersionKey(projection);
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-type','application/json; charset=utf-8');
  headers.set('cache-control','no-store');
  headers.set('x-rona-payments-v8-hardening','server-aggregates-live-refresh-v1');
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
}

nativeServe(async(req:Request,info:any)=>{
  const base:Response=await capturedHandler(req,info);
  return await hardenBootstrap(req,base);
});
