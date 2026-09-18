// @ts-nocheck
import postgres from 'postgres';
import { buildAdminCashFinanceProjection, CASH_PROJECTION_CONTRACT } from './cash-projection-v1.mjs';

const BASE_PRODUCTION_RUNTIME='https://cdn.jsdelivr.net/gh/rokotove26-png/ronatrade.com@c8ecd30f1f3be32479f5270257fd028acb656f95/supabase/functions/rona-owner-ai-sync/index.ts';
const DB=Deno.env.get('SUPABASE_DB_URL');
if(!DB)throw new Error('ADMIN_CASH_DB_UNAVAILABLE');
const sql=postgres(DB,{prepare:false,max:1,idle_timeout:1,max_lifetime:30,connect_timeout:5});
const nativeServe=Deno.serve.bind(Deno);
let baseHandler=null;

const capturedServe=(...args)=>{
  const handler=typeof args[0]==='function'?args[0]:args[1];
  if(typeof handler!=='function')throw new Error('ADMIN_CASH_BASE_HANDLER_CAPTURE_FAILED');
  baseHandler=handler;
  return{finished:Promise.resolve(),ref(){},unref(){},shutdown(){return Promise.resolve()},addr:{transport:'tcp',hostname:'0.0.0.0',port:0}};
};
const serveDescriptor=Object.getOwnPropertyDescriptor(Deno,'serve');
Object.defineProperty(Deno,'serve',{value:capturedServe,configurable:true,writable:true});
await import(BASE_PRODUCTION_RUNTIME);
if(serveDescriptor)Object.defineProperty(Deno,'serve',serveDescriptor);
else Object.defineProperty(Deno,'serve',{value:nativeServe,configurable:true,writable:true});
if(typeof baseHandler!=='function')throw new Error('ADMIN_CASH_BASE_HANDLER_NOT_CAPTURED');

function normalizedPath(req){const p=new URL(req.url).pathname;return /\/admin\/sync\/?$/.test(p)?'/admin/sync':p}
function ymd(value){if(!value)return'';const raw=String(value);if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)}
async function readCashProjection(){
  const snapshots=await sql`
    with dates as (
      select distinct snapshot_date
      from portal_private.owner_cash_snapshots
      order by snapshot_date desc
      limit 2
    )
    select snapshot_date,currency,opening_balance,received_amount,paid_amount,closing_balance,source_system,updated_at
    from portal_private.owner_cash_snapshots
    where snapshot_date in (select snapshot_date from dates)
    order by snapshot_date,currency`;
  const dates=[...new Set(snapshots.map(row=>ymd(row.snapshot_date)).filter(Boolean))].sort();
  if(dates.length<2)return buildAdminCashFinanceProjection({snapshots,movements:[]});
  const anchor=dates.at(-2),latest=dates.at(-1);
  const movements=await sql`
    select p.payment_id,p.payment_at,p.amount,p.currency,
           nullif(p.payer_name,'') payer_name,nullif(p.beneficiary_name,'') beneficiary_name,
           nullif(p.counterparty_name,'') counterparty_name,nullif(p.counterparty_role,'') counterparty_role,
           p.original_payment_purpose,p.bank_transaction_reference,p.bank_account_reference,p.bank_statement_date,
           p.payment_direction::text payment_direction,p.payment_kind::text payment_kind,
           p.fx_equivalent_amount,p.fx_equivalent_currency,p.fx_rate,p.fx_source_reference,
           p.source_system,p.source_version,p.source_timestamp
    from portal_private.payments p
    where p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and p.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
      and p.bank_fact_status='BANK_CONFIRMED'::portal_private.payment_bank_state_enum
      and p.finance_verification_status='VERIFIED'::portal_private.finance_verification_state_enum
      and p.payment_at::date>${anchor}::date
      and p.payment_at::date<=${latest}::date
    order by p.payment_at,p.payment_id`;
  return buildAdminCashFinanceProjection({snapshots,movements});
}
function unavailable(existing,error){return{contract:CASH_PROJECTION_CONTRACT,status:'TO_VERIFY',code:'CASH_PROJECTION_UNAVAILABLE',sourceAsOf:existing?.sourceAsOf??null,supportedFrom:null,supportedTo:null,currencies:[],movements:[],dailyBalances:[],reconciliation:[],error_code:String(error?.message||error||'UNKNOWN').slice(0,160)}}

nativeServe(async req=>{
  const response=await baseHandler(req);
  if(req.method!=='GET'||normalizedPath(req)!=='/admin/sync'||!response.ok)return response;
  const payload=await response.json().catch(()=>null);
  if(!payload?.data||typeof payload.data!=='object')return new Response(JSON.stringify({ok:false,code:'ADMIN_SYNC_PAYLOAD_INVALID'}),{status:502,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  const finance=payload.data.financeFragment&&typeof payload.data.financeFragment==='object'?payload.data.financeFragment:{};
  try{finance.cashProjection=await readCashProjection()}catch(error){console.error('admin cash projection failed',error);finance.cashProjection=unavailable(finance,error)}
  payload.data.financeFragment=finance;
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store');headers.set('x-rona-cash-projection',CASH_PROJECTION_CONTRACT);
  return new Response(JSON.stringify(payload),{status:response.status,statusText:response.statusText,headers});
});
