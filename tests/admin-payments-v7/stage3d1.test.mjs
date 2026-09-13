import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPaymentsV7Projection } from '../../supabase/functions/_shared/admin-payments-v7/projection.mjs';
import { reconcileAllPayments } from '../../supabase/functions/_shared/admin-payments-v7/reconciliation.mjs';
import { readAdminPaymentsV7RawSources } from '../../supabase/functions/rona-owner-ai-sync/admin-payments-v7-source-reader.mjs';

const D004='17503586-9909-58cc-99f6-92b2ba4d8797', D005='51352e24-23f2-56c0-b56b-4290a11a4267', D006='68a82fae-ac16-5c3b-9a3a-4cd008e10b68', D009='6a2af55b-a945-43c0-8078-7385970c8dc3';
const P008='9fda9905-e782-42f3-8441-71ca866bee0d', P009='7c6dba20-eb9f-47fe-a077-ec3bbf17bf29';
const VALID=new Set(['NOT_APPLICABLE','TO_VERIFY','VERIFIED']);

function payment([key,id,amount,currency,direction,kind,review='VERIFIED',candidates=[]]) {
  const fx=kind==='FX_CONVERSION';
  return { payment_key:key,payment_id:id,payment_at:'2026-09-13T00:00:00Z',amount:String(amount),currency,direction,kind,bank_fact_status:'BANK_CONFIRMED',finance_verification_status:'VERIFIED',allocation_applicability:fx?'NOT_APPLICABLE':'DEAL_ALLOCATABLE',allocation_review_status:fx?'NOT_APPLICABLE':review,candidate_deal_ids:candidates,current:true,source_locked:true,authority_state:'AUTHORITATIVE',lifecycle_state:'CURRENT',authority_refs:[] };
}
const CURRENT=[
 ['p001','PAYEV-2026-000001','236250','USD','INCOMING','CLIENT_PAYMENT','VERIFIED',[D004]],
 ['p004-bnk','OUT-2026-004-BNK','8484210','RUB','OUTGOING','COUNTERPARTY_PAYMENT','VERIFIED',[D004]],
 ['p004-bnk-fee','OUT-2026-004-BNK-FEE','3000','RUB','OUTGOING','BANK_FEE','VERIFIED',[D004]],
 ['p004-orient','OUT-2026-004-ORIENT','25444800','KZT','OUTGOING','COUNTERPARTY_PAYMENT','VERIFIED',[D004]],
 ['p004-orient-fee','OUT-2026-004-ORIENT-FEE','20000','KZT','OUTGOING','BANK_FEE','VERIFIED',[D004]],
 ['p002','PAYEV-2026-000002','201750','USD','INCOMING','CLIENT_PAYMENT','VERIFIED',[D005]],
 ['p003','PAYEV-2026-000003','49320','USD','INCOMING','CLIENT_PAYMENT','VERIFIED',[D006]],
 ['p004-sg','OUT-2026-004-SGTRANS','5899358.9','RUB','OUTGOING','COUNTERPARTY_PAYMENT','VERIFIED',[D004]],
 ['p004-sg-fee','OUT-2026-004-SGTRANS-FEE','3000','RUB','OUTGOING','BANK_FEE','VERIFIED',[D004]],
 ['pkuz','OUT-2026-005006-KUZMASH','16536960','RUB','OUTGOING','COUNTERPARTY_PAYMENT','TO_VERIFY',[D005,D006]],
 ['pkuz-fee','OUT-2026-005006-KUZMASH-FEE','3000','RUB','OUTGOING','BANK_FEE','TO_VERIFY',[D005,D006]],
 ['fx004','PAYEV-2026-000004','11800','USD','OUTGOING','FX_CONVERSION'],
 ['fx005','PAYEV-2026-000005','1003000','RUB','INCOMING','FX_CONVERSION'],
 ['fx006','PAYEV-2026-000006','30000','USD','OUTGOING','FX_CONVERSION'],
 ['fx007','PAYEV-2026-000007','2505000','RUB','INCOMING','FX_CONVERSION'],
 [P008,'PAYEV-2026-000008','3644000','RUB','OUTGOING','COUNTERPARTY_PAYMENT','TO_VERIFY',[]],
 [P009,'PAYEV-2026-000009','3000','RUB','OUTGOING','BANK_FEE','TO_VERIFY',[]],
].map(payment);

function claim(p) {
  if (p.kind==='FX_CONVERSION' || [P008,P009].includes(p.payment_key)) return null;
  if (p.candidate_deal_ids.length>1) return { id:`scope:${p.payment_key}`,payment_key:p.payment_key,classification:p.kind==='BANK_FEE'?'ASSOCIATED_BANK_FEE':'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY',disposition:null,lines:[],scope_deal_keys:p.candidate_deal_ids,principal_payment_key:p.kind==='BANK_FEE'?'pkuz':null,current:true,source_locked:true,authority_state:'AUTHORITATIVE',lifecycle_state:'CURRENT',authority_refs:[] };
  return { id:`exact:${p.payment_key}`,payment_key:p.payment_key,classification:p.kind==='BANK_FEE'?'ASSOCIATED_BANK_FEE':'RESOLVED',disposition:'BIND_TO_DEAL',lines:[{deal_key:p.candidate_deal_ids[0],amount:p.amount,currency:p.currency,amount_status:'EXACT'}],scope_deal_keys:p.candidate_deal_ids,current:true,source_locked:true,authority_state:'AUTHORITATIVE',lifecycle_state:'CURRENT',authority_refs:[] };
}
const BASE_CLAIMS=CURRENT.map(claim).filter(Boolean);
function seedClaims(){ return [
 {id:'owner-8',payment_key:P008,classification:'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED',disposition:null,lines:[],scope_deal_keys:[],business_scope_refs:['OWNER_ASSERTION:PAYEV-2026-000008:BUSINESS_ALLOCATION_KNOWN'],current:true,source_locked:true,authority_state:'AUTHORITATIVE',lifecycle_state:'CURRENT',authority_refs:[]},
 {id:'owner-9',payment_key:P009,classification:'ASSOCIATED_BANK_FEE',disposition:null,lines:[],scope_deal_keys:[],business_scope_refs:['OWNER_ASSERTION:PAYEV-2026-000009:ASSOCIATED_WITH:PAYEV-2026-000008'],principal_payment_key:P008,current:true,source_locked:true,authority_state:'AUTHORITATIVE',lifecycle_state:'CURRENT',authority_refs:[]},
]; }
function source(present,ready,payments=CURRENT,claims=BASE_CLAIMS){ return {generatedAt:'2026-09-13T15:38:42Z',sourceAsOf:'2026-09-13T15:38:42Z',capabilities:{paymentBusinessAuthority:present,paymentBusinessAuthorityPresent:present,paymentBusinessAuthorityReady:ready,financeAuthority:false,resourceChain:false},contour:[],validDealKeys:[D004,D005,D006,D009],payments:structuredClone(payments),attributionClaims:structuredClone(claims),physicalAllocations:[],financeAuthorities:[],resourceChains:[]}; }
function rec(s){ return reconcileAllPayments(s.payments,s.attributionClaims,s.physicalAllocations,s.capabilities,s.validDealKeys); }
function readinessPort(ready){ const empty=async()=>[]; return {readSnapshotTimestamp:async()=> '2026-09-13 15:38:42+00',relationExists:async(name)=>name.endsWith('payment_business_attributions_v7')||name.endsWith('payment_business_attribution_lines_v7')||name.endsWith('admin_payments_v7_provider_readiness'),readProviderReadiness:async(key)=>({provider_key:key,is_ready:ready,ready_at:ready?'2026-09-13 15:40:00+00':null,validation_ref:ready?'STAGE3D1_TEST_BOOTSTRAP_VALIDATED':null}),readDeals:empty,readWorkflows:empty,readClients:empty,readContracts:empty,readPayments:empty,readPaymentAllocations:empty,readPaymentAllocationHistory:empty,readOwnerOutgoingPaymentFacts:empty,readPaymentBusinessAttributions:empty,readPaymentBusinessAttributionLines:empty,readDealFinanceAuthorities:empty,readResourceChains:empty}; }

test('AU — PRODUCTION PAYMENT STATUS DOMAIN',()=>{ assert.equal(CURRENT.length,17); for(const p of CURRENT) assert.equal(VALID.has(p.allocation_review_status),true,`${p.payment_id}:${p.allocation_review_status}`); assert.equal(CURRENT.some(p=>['UNALLOCATED','GENUINELY_UNALLOCATED'].includes(p.allocation_review_status)),false); });
test('AV — PROVIDER PRESENT BUT NOT READY',async()=>{ const raw=await readAdminPaymentsV7RawSources(readinessPort(false)); assert.equal(raw.capabilities.paymentBusinessAuthorityPresent,true); assert.equal(raw.capabilities.paymentBusinessAuthorityReady,false); const s=source(true,false), r=rec(s); assert.equal(buildAdminPaymentsV7Projection(s).owner_exception_queue.length,0); for(const id of ['PAYEV-2026-000008','PAYEV-2026-000009']){ const x=r.find(v=>v.payment_id===id); assert.equal(x.reconciliation_class,'AUTHORITY_MATERIALIZATION_REQUIRED'); assert.equal(x.owner_action_required,false); } });
test('AW — PROVIDER READY AFTER INITIAL SEED',async()=>{ const raw=await readAdminPaymentsV7RawSources(readinessPort(true)); assert.equal(raw.capabilities.paymentBusinessAuthorityReady,true); const s=source(true,true,CURRENT,[...BASE_CLAIMS,...seedClaims()]), r=rec(s); assert.equal(r.length,17); assert.equal(buildAdminPaymentsV7Projection(s).owner_exception_queue.length,0); assert.equal(r.find(v=>v.payment_id==='PAYEV-2026-000008').reconciliation_class,'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED'); assert.equal(r.find(v=>v.payment_id==='PAYEV-2026-000009').reconciliation_class,'ASSOCIATED_BANK_FEE'); const shared=r.find(v=>v.payment_id==='OUT-2026-005006-KUZMASH'); assert.equal(shared.reconciliation_class,'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY'); assert.equal(shared.owner_action_required,false); assert.deepEqual(shared.scope_deal_keys,[D005,D006]); const sharedFee=r.find(v=>v.payment_id==='OUT-2026-005006-KUZMASH-FEE'); assert.equal(sharedFee.reconciliation_class,'ASSOCIATED_BANK_FEE'); assert.equal(sharedFee.owner_action_required,false); for(const id of ['PAYEV-2026-000004','PAYEV-2026-000005','PAYEV-2026-000006','PAYEV-2026-000007']) assert.equal(r.find(v=>v.payment_id===id).reconciliation_class,'FX_CONVERSION_NOT_APPLICABLE'); for(const id of ['PAYEV-2026-000001','PAYEV-2026-000002','PAYEV-2026-000003']) assert.equal(r.find(v=>v.payment_id===id).reconciliation_class,'RESOLVED'); });
test('AX — FUTURE REAL GENUINE UNALLOCATED',()=>{ const future=payment(['future-u','PAYEV-2099-999999','7000','RUB','OUTGOING','COUNTERPARTY_PAYMENT','TO_VERIFY',[]]); const s=source(true,true,[...CURRENT,future],[...BASE_CLAIMS,...seedClaims()]); const q=buildAdminPaymentsV7Projection(s).owner_exception_queue; assert.equal(q.length,1); assert.equal(q[0].reconciliation_class,'GENUINELY_UNALLOCATED'); assert.equal(q[0].owner_action_required,true); assert.deepEqual(q[0].allowed_owner_actions,['BIND_TO_DEAL','ASSIGN_ADVANCE_PAYMENT']); });
test('AY — NEW AUTHORITY REMOVES QUEUE',()=>{ const future=payment(['future-u','PAYEV-2099-999999','7000','RUB','OUTGOING','COUNTERPARTY_PAYMENT','TO_VERIFY',[]]); const scope={id:'future-scope',payment_key:'future-u',classification:'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY',disposition:null,lines:[],scope_deal_keys:[D005,D006],current:true,source_locked:true,authority_state:'AUTHORITATIVE',lifecycle_state:'CURRENT',authority_refs:[]}; const s=source(true,true,[...CURRENT,future],[...BASE_CLAIMS,...seedClaims(),scope]), r=rec(s).find(v=>v.payment_id==='PAYEV-2099-999999'); assert.equal(buildAdminPaymentsV7Projection(s).owner_exception_queue.length,0); assert.equal(r.reconciliation_class,'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY'); });
test('AZ — VERIFIED WITHOUT BACKING AUTHORITY FAILS CLOSED',()=>{ const broken=payment(['verified-gap','PAYEV-2099-888888','9000','RUB','OUTGOING','COUNTERPARTY_PAYMENT','VERIFIED',[]]); const s=source(true,true,[...CURRENT,broken],[...BASE_CLAIMS,...seedClaims()]), r=rec(s).find(v=>v.payment_id==='PAYEV-2099-888888'); assert.equal(r.reconciliation_class,'AUTHORITY_MATERIALIZATION_REQUIRED'); assert.equal(r.reason,'VERIFIED_WITHOUT_BACKING_AUTHORITY'); assert.equal(r.owner_action_required,false); assert.equal(buildAdminPaymentsV7Projection(s).owner_exception_queue.length,0); });
