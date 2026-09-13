import { enrichOwnerPaymentsAccountingCurrencyProgressV6 } from '../supabase/functions/rona-owner-ai-sync/owner-payments-accounting-currency-progress-v6.ts';

const CANON_ID='eabba23f-70b9-4d40-86ef-3d0578c71d4a';
const CANON_REF=`FINANCE_CONCLUSION:${CANON_ID}`;
const clone=v=>structuredClone(v);
function pass(name,cond){if(!cond)throw new Error(name+'=FAIL');console.log(name+'=PASS')}
function canon(overrides={}){
  return{
    record_id:CANON_ID,
    record_type:'FUNCTIONAL_CONCLUSION',
    functional_role:'FINANCE',
    version:23,
    status:'APPROVED_WITH_CONDITIONS',
    payload:{confirmed:true},
    source_refs:['OWNER_RULE_V23'],
    created_at:'2026-09-12T23:56:18.989Z',
    source_locked:true,
    ...overrides
  };
}
function structuredProjection({dealId='DEAL-2026-009',total=31002300,expected=9300690,future=21701610,currency='RUB',status='EXPECTED_TO_VERIFY'}={}){
  return{
    proposal_record_id:'fresh-v23-structured-'+dealId+'-'+total,
    parent_record_id:CANON_ID,
    proposal_status:'PROPOSED',
    deal_id:dealId,
    state:{currency,invoice_gross_basis:total,due_now:0,next_expected_payment:expected,expected_not_due:expected,nominal_future_70_percent:future,projection_status:status,finance_status:'NOT_DUE'},
    source_timestamp:'2026-09-13T00:50:00.000Z',
    source_refs:[CANON_REF,'STRUCTURED_FINANCE_PROJECTION:'+dealId],
    authority_source:'FINANCE_V23_EVIDENCE_LINKED_PROPOSAL'
  };
}
function baseV5(deals){
  const control=deals.map((deal_id,i)=>({
    deal_id,
    client_id:'C'+i,
    client_name:'Client '+deal_id,
    currency:'USD',
    total_to_receive_amount:100,
    verified_received_amount:0,
    expected_amount:100,
    due_now_amount:0,
    deferred_not_due_amount:100,
    remaining_obligation_amount:100,
    projection_status:'AUTHORITATIVE',
    payment_handoff_state:'READY'
  }));
  return{
    ownerPaymentSemanticsContract:'ADMIN_PAYMENTS_CANONICAL_OWNER_WORKFLOW_V4',
    ownerPaymentsPolicy:{upstreamLifecycleReadOnly:true,syntheticFx:false,fxPrincipalDoubleCount:false},
    paymentContourDealIds:[...deals],
    paymentContourMembership:deals.map(deal_id=>({deal_id,payment_handoff_state:'READY'})),
    dealPaymentControlRows:control,
    dealPaymentPassports:control.map(x=>({...x,receipts:[]})),
    incomingPaymentAllocations:[],payments:[],incomingPayments:[],dealActualSpendRows:[],unallocatedPaymentRows:[],ownerAdvancePaymentRows:[],
    totalToReceiveTotalsByCurrency:[],verifiedReceivedTotalsByCurrency:[],expectedReceiptTotalsByCurrency:[],dueNowTotalsByCurrency:[],deferredNotDueTotalsByCurrency:[]
  };
}
function incoming(finance,{paymentId,dealId,currency,amount}){
  finance.payments.push({payment_id:paymentId,payment_direction:'INCOMING',payment_kind:'CLIENT_PAYMENT',bank_fact_status:'BANK_CONFIRMED',finance_verification_status:'VERIFIED',currency,amount});
  finance.incomingPaymentAllocations.push({payment_id:paymentId,deal_id:dealId,currency,allocated_amount:amount,allocation_status:'VERIFIED',authority_state:'CONFIRMED',lifecycle_state:'ACTIVE'});
}
function deps({canonRow=canon(),proposals=[],links=[]}={}){
  return{
    enrichV5:async finance=>clone(finance),
    readFinanceCanon:async()=>canonRow===null?null:clone(canonRow),
    readCurrentPaymentCurrencyProposals:async()=>clone(proposals),
    readAccountingCurrencyLinks:async()=>clone(links)
  };
}
async function enrich(finance,options){return enrichOwnerPaymentsAccountingCurrencyProgressV6(finance,null,deps(options))}

{
  const f=baseV5(['DEAL-2026-004']);incoming(f,{paymentId:'PIN-USD',dealId:'DEAL-2026-004',currency:'USD',amount:100});
  f.dealPaymentControlRows[0].expected_amount=0;f.dealPaymentControlRows[0].deferred_not_due_amount=0;
  const out=await enrich(f);const row=out.dealPaymentControlRows[0];
  pass('SEMANTIC_VERIFIED_USD_PAYMENT_TO_USD',row.accounting_currency==='USD'&&row.accounting_currency_source==='VERIFIED_INCOMING_CLIENT_PAYMENT'&&row.verified_received_amount===100);
}

{
  const f=baseV5(['DEAL-2026-009']),proposal=structuredProjection();
  const out=await enrich(f,{proposals:[proposal]});const row=out.dealPaymentControlRows[0];
  pass('SEMANTIC_RUB_FALLBACK_UNDER_V23',row.accounting_currency==='RUB'&&row.accounting_currency_source==='OWNER_FINANCE_PAYMENT_CURRENCY'&&row.total_to_receive_amount===31002300&&row.expected_amount===9300690&&row.deferred_not_due_amount===21701610&&row.verified_received_amount===0);
  pass('GAZONE_VALUES_FROM_STRUCTURED_FINANCE_AUTHORITY',out.financeExpectedReceiptAuthority.some(x=>x.deal_id==='DEAL-2026-009'&&x.authority_source==='FINANCE_V23_EVIDENCE_LINKED_PROPOSAL'&&x.source_refs.includes(CANON_REF)));
}

{
  const f=baseV5(['DEAL-2026-009']);
  const out=await enrich(f);const row=out.dealPaymentControlRows[0];
  pass('ABSENT_STRUCTURED_FINANCE_PROJECTION_FAILS_CLOSED',row.accounting_currency===null&&row.accounting_currency_status==='TO_VERIFY'&&row.total_to_receive_amount===null&&out.financeExpectedReceiptAuthority.length===0);
}

{
  const f=baseV5(['DEAL-2026-005']);incoming(f,{paymentId:'PIN-USD',dealId:'DEAL-2026-005',currency:'USD',amount:30});incoming(f,{paymentId:'PIN-RUB',dealId:'DEAL-2026-005',currency:'RUB',amount:2000});
  const out=await enrich(f);const row=out.dealPaymentControlRows[0];
  pass('SEMANTIC_MIXED_INBOUND_TO_VERIFY',row.accounting_currency===null&&row.accounting_currency_status==='TO_VERIFY'&&row.accounting_currency_source==='MIXED_INBOUND_CURRENCIES');
}

{
  const f=baseV5(['DEAL-2026-004']);incoming(f,{paymentId:'PIN-USD',dealId:'DEAL-2026-004',currency:'USD',amount:100});
  const absent=await enrich(f,{canonRow:null});
  pass('SEMANTIC_CANON_ABSENT_FAIL_CLOSED',absent.v6ProjectionAuthority==='TO_VERIFY'&&absent.ownerFinanceCanon.record_id===null&&absent.dealPaymentControlRows.length===0&&absent.dealPaymentPassports.length===0);
  const unlocked=await enrich(f,{canonRow:canon({source_locked:false,status:'HOLD',payload:{confirmed:false}})});
  pass('SEMANTIC_CANON_UNLOCKED_FAIL_CLOSED',unlocked.v6ProjectionAuthority==='TO_VERIFY'&&unlocked.ownerFinanceCanon.status==='TO_VERIFY'&&unlocked.dealPaymentControlRows.length===0);
}

{
  const f=baseV5(['DEAL-2026-010']);
  const stale=[{proposal_record_id:'stale-returned-proposal',parent_record_id:CANON_ID,proposal_status:'PROPOSED',deal_id:'DEAL-2026-010',state:{currency:'RUB',invoice_gross_basis:999},source_refs:[CANON_REF],authority_decision_status:'RETURN_FOR_REVISION',authority_source:'FINANCE_V23_EVIDENCE_LINKED_PROPOSAL'}];
  const out=await enrich(f,{proposals:stale});const row=out.dealPaymentControlRows[0];
  pass('SEMANTIC_STALE_REJECTED_PROPOSAL_NOT_AUTHORITY',row.accounting_currency===null&&row.accounting_currency_status==='TO_VERIFY'&&!out.financeExpectedReceiptAuthority.some(x=>x.proposal_record_id==='stale-returned-proposal'));
}

{
  const f=baseV5(['DEAL-2026-004']);incoming(f,{paymentId:'PIN-USD',dealId:'DEAL-2026-004',currency:'USD',amount:50});
  f.dealPaymentControlRows[0].total_to_receive_amount=100;f.dealPaymentControlRows[0].expected_amount=50;f.dealPaymentControlRows[0].deferred_not_due_amount=50;
  f.dealActualSpendRows=[{deal_id:'DEAL-2026-004',payment_id:'OUT-RUB',payment_at:'2026-09-12T10:00:00Z',recipient:'Supplier',amount:1000,currency:'RUB'}];
  const out=await enrich(f);const passport=out.dealPaymentPassports[0];
  pass('SEMANTIC_CROSS_CURRENCY_WITHOUT_EXACT_LINK_TO_VERIFY',passport.actual_spend_status==='TO_VERIFY'&&passport.spend_details.some(x=>x.accounting_amount_source==='CROSS_CURRENCY_SOURCE_LOCK_REQUIRED'&&x.accounting_amount_status==='TO_VERIFY'));
}

{
  const f=baseV5(['DEAL-2026-006']);incoming(f,{paymentId:'PIN-USD',dealId:'DEAL-2026-006',currency:'USD',amount:50});
  f.dealPaymentControlRows[0].total_to_receive_amount=200;f.dealPaymentControlRows[0].expected_amount=150;f.dealPaymentControlRows[0].deferred_not_due_amount=150;
  const out=await enrich(f);const row=out.dealPaymentControlRows[0];
  pass('SEMANTIC_PROGRESS_RECEIVED_OVER_TOTAL_ONLY',row.payment_progress_pct===25&&row.verified_received_amount===50&&row.total_to_receive_amount===200&&row.deferred_not_due_amount===150);
}

{
  const f=baseV5(['DEAL-2026-005']);
  f.dealPaymentControlRows[0].total_to_receive_amount=100;f.dealPaymentControlRows[0].expected_amount=70;f.dealPaymentControlRows[0].deferred_not_due_amount=70;
  incoming(f,{paymentId:'PIN-1',dealId:'DEAL-2026-005',currency:'USD',amount:30});
  const before=await enrich(f);const beforeRow=before.dealPaymentControlRows[0];
  incoming(f,{paymentId:'PIN-2',dealId:'DEAL-2026-005',currency:'USD',amount:20});
  const after=await enrich(f);const afterRow=after.dealPaymentControlRows[0];
  pass('VERIFIED_CLIENT_PAYMENT_AUTOMATIC_RECALC',beforeRow.verified_received_amount===30&&beforeRow.remaining_obligation_amount===70&&beforeRow.payment_progress_pct===30&&afterRow.verified_received_amount===50&&afterRow.remaining_obligation_amount===50&&afterRow.payment_progress_pct===50);
}

{
  const f=baseV5(['DEAL-2026-009']);
  const projectionA=structuredProjection({total:31002300,expected:9300690,future:21701610});
  const projectionB=structuredProjection({total:32000000,expected:9600000,future:22400000});
  const a=await enrich(f,{proposals:[projectionA]}),b=await enrich(f,{proposals:[projectionB]});
  const ar=a.dealPaymentControlRows[0],br=b.dealPaymentControlRows[0];
  pass('FINANCE_VALUE_CHANGE_REQUIRES_NO_CODE_CHANGE',ar.total_to_receive_amount===31002300&&br.total_to_receive_amount===32000000&&ar.expected_amount===9300690&&br.expected_amount===9600000&&ar.source_payment_currency_authority===br.source_payment_currency_authority);
}

console.log('V6_R2_SEMANTIC_INTEGRATION=PASS');
