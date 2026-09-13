// @ts-nocheck

import { enrichOwnerPaymentsOwnerFinalV5 } from './owner-payments-owner-final-v5.ts';

const OWNER_FINANCE_CANON_ID='eabba23f-70b9-4d40-86ef-3d0578c71d4a';
const CONTRACT='ADMIN_PAYMENTS_DEAL_ACCOUNTING_CURRENCY_PROGRESS_V6';
const ACTIVE_AUTHORITY=new Set(['CONFIRMED','VERIFIED']);
const A=v=>Array.isArray(v)?v:[];
const S=v=>String(v??'').trim();
const U=v=>S(v).toUpperCase();
const N=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
const R=v=>Math.round((Number(v)+Number.EPSILON)*1000000)/1000000;

function addMoney(map,currency,amount){const c=U(currency),v=N(amount);if(!c||v===null||v<0)return;map.set(c,R((map.get(c)||0)+v))}
function moneyRows(map){return[...map.entries()].map(([currency,amount])=>({currency,amount})).sort((a,b)=>a.currency.localeCompare(b.currency))}
function cleanNativeEvidence(row){const out={...row};for(const k of Object.keys(out)){if(/^management_usd/i.test(k)||/^usd_execution_links$/i.test(k))delete out[k]}return out}

async function readFinanceCanon(sql){
  if(typeof sql!=='function')return null;
  const rows=await sql`select record_id,record_type,functional_role::text functional_role,target_type,target_id,status,version,payload,source_refs,created_at from portal_private.ai_coordination_records where record_id=${OWNER_FINANCE_CANON_ID}::uuid and qa_only=false limit 1`;
  const row=rows?.[0]||null;if(!row)return null;
  const approved=new Set(['APPROVED','APPROVED_WITH_CONDITIONS']);
  return{...row,source_locked:row.record_type==='FUNCTIONAL_CONCLUSION'&&row.functional_role==='FINANCE'&&approved.has(U(row.status))&&Number(row.version)===23&&row.payload?.confirmed===true};
}

async function readCurrentPaymentCurrencyProposals(sql){
  if(typeof sql!=='function')return[];
  return await sql`
    select distinct on (target_id)
      record_id proposal_record_id,target_id deal_id,payload->'proposed_state' state,created_at source_timestamp,
      coalesce(evidence_refs,'[]'::jsonb)||coalesce(payload->'evidence_refs','[]'::jsonb) source_refs
    from portal_private.ai_coordination_records
    where target_type='DEAL' and functional_role::text='FINANCE' and record_type='BUSINESS_CHANGE_PROPOSAL' and status='PROPOSED' and qa_only=false
      and payload->>'proposed_action'='UPSERT_OWNER_EXPECTED_RECEIPT_PROJECTION' and jsonb_typeof(payload->'proposed_state')='object'
    order by target_id,created_at desc`;
}

async function readAccountingCurrencyLinks(sql){
  if(typeof sql!=='function')return[];
  const rel=await sql`select to_regclass('portal_private.finance_deal_execution_accounting_currency_links_v6')::text rel`;if(!rel?.[0]?.rel)return[];
  return await sql`select id,deal_id,conversion_source_payment_id,execution_payment_id,accounting_currency,accounting_amount,execution_native_amount,execution_native_currency,execution_state,obligation_reference,bank_source_reference,treasury_source_reference,source_system,source_version,source_timestamp,supersedes_link_id
    from portal_private.finance_deal_execution_accounting_currency_links_v6 l
    where l.authority_state='CONFIRMED' and l.lifecycle_state='ACTIVE'
      and not exists(select 1 from portal_private.finance_deal_execution_accounting_currency_links_v6 x where x.supersedes_link_id=l.id and x.authority_state='CONFIRMED' and x.lifecycle_state='ACTIVE')
    order by deal_id,source_timestamp,id`;
}

function verifiedIncomingPaymentMap(finance){
  const map=new Map();
  for(const p of [...A(finance?.incomingPayments),...A(finance?.payments)]){
    const id=S(p?.payment_id);if(!id||map.has(id))continue;
    const direction=U(p?.payment_direction??p?.paymentDirection),kind=U(p?.payment_kind??p?.paymentKind),bank=U(p?.bank_fact_status??p?.bankFactStatus),verified=U(p?.finance_verification_status??p?.financeVerificationStatus);
    if(direction==='INCOMING'&&kind==='CLIENT_PAYMENT'&&bank==='BANK_CONFIRMED'&&verified==='VERIFIED')map.set(id,p);
  }
  return map;
}
function activeAllocations(finance,contour){
  const members=new Set(A(contour).map(S));
  return A(finance?.incomingPaymentAllocations).filter(a=>members.has(S(a?.deal_id))&&U(a?.allocation_status)==='VERIFIED'&&(!a?.authority_state||ACTIVE_AUTHORITY.has(U(a.authority_state)))&&(!a?.lifecycle_state||U(a.lifecycle_state)==='ACTIVE'));
}
function deriveAccountingCurrencies(finance,contour,proposalMap,canonLocked){
  const payments=verifiedIncomingPaymentMap(finance),allocs=activeAllocations(finance,contour),byDeal=new Map();
  for(const a of allocs){const deal=S(a.deal_id),payment=payments.get(S(a.payment_id));if(!deal||!payment)continue;const c=U(payment.currency||a.currency);if(!c)continue;const set=byDeal.get(deal)||new Set();set.add(c);byDeal.set(deal,set)}
  const out=new Map();
  for(const dealId of contour){const set=byDeal.get(dealId)||new Set();if(set.size===1){out.set(dealId,{currency:[...set][0],status:'AUTHORITATIVE',source:'VERIFIED_INCOMING_CLIENT_PAYMENT'});continue}if(set.size>1){out.set(dealId,{currency:null,status:'TO_VERIFY',source:'MIXED_INBOUND_CURRENCIES'});continue}
    const proposal=proposalMap.get(dealId),state=proposal?.state||{},currency=U(state.currency);if(canonLocked&&currency)out.set(dealId,{currency,status:'AUTHORITATIVE',source:'OWNER_FINANCE_PAYMENT_CURRENCY',proposal_record_id:proposal.proposal_record_id,source_timestamp:proposal.source_timestamp});else out.set(dealId,{currency:null,status:'TO_VERIFY',source:'NO_AUTHORITATIVE_PAYMENT_CURRENCY'});
  }
  return out;
}

function buildControlRows(v5,accounting,proposalMap){
  const old=new Map(A(v5?.dealPaymentControlRows).map(x=>[S(x.deal_id),x])),rows=[];
  for(const membership of A(v5?.paymentContourMembership)){
    const dealId=S(membership?.deal_id);if(!dealId)continue;const prior=old.get(dealId)||{},acct=accounting.get(dealId)||{currency:null,status:'TO_VERIFY'},proposal=proposalMap.get(dealId),state=proposal?.state||{},currency=acct.currency;
    if(!currency){rows.push({...prior,deal_id:dealId,currency:null,accounting_currency:null,accounting_currency_status:'TO_VERIFY',total_to_receive_amount:null,verified_received_amount:null,expected_amount:null,due_now_amount:null,deferred_not_due_amount:null,remaining_obligation_amount:null,projection_status:'TO_VERIFY',payment_progress_pct:null,payment_progress_status:'TO_VERIFY',payment_handoff_state:membership.payment_handoff_state});continue}
    const samePrior=U(prior.currency)===currency;
    const total=N(state.invoice_gross_basis??state.client_obligation)??(samePrior?N(prior.total_to_receive_amount):null);
    const received=N(state.verified_client_received)??(samePrior?N(prior.verified_received_amount):0)??0;
    const due=N(state.due_now)??(samePrior?N(prior.due_now_amount):0)??0;
    const next=N(state.next_expected_payment??state.expected_not_due);
    const expected=next!==null?next:(samePrior?N(prior.expected_amount):0)??0;
    const future=N(state.nominal_future_70_percent??state.future_conditional_balance);
    const deferred=future!==null?future:(samePrior?N(prior.deferred_not_due_amount):0)??0;
    const sourceStatus=U(state.projection_status);const projectionStatus=sourceStatus.includes('TO_VERIFY')?'TO_VERIFY':(samePrior?U(prior.projection_status)||'AUTHORITATIVE':'AUTHORITATIVE');
    const progress=total!==null&&total>0?R(Math.max(0,Math.min(100,received/total*100))):null;
    rows.push({...prior,deal_id:dealId,currency,accounting_currency:currency,accounting_currency_status:acct.status,accounting_currency_source:acct.source,total_to_receive_amount:total,verified_received_amount:R(received),expected_amount:R(expected),due_now_amount:R(due),deferred_not_due_amount:R(deferred),remaining_obligation_amount:total===null?null:R(Math.max(0,total-received)),projection_status:projectionStatus,payment_progress_pct:progress,payment_progress_status:progress===null?'TO_VERIFY':'VERIFIED_RECEIVED_ONLY',payment_progress_semantics:'VISUAL_ONLY_NO_TRANCHE_NO_OVERDUE',payment_handoff_state:membership.payment_handoff_state,source_proposal_record_id:proposal?.proposal_record_id??prior.proposal_record_id??null});
  }
  return rows.sort((a,b)=>S(a.deal_id).localeCompare(S(b.deal_id)));
}

function validateAccountingLink(link,row,accountingCurrency){
  if(U(link?.accounting_currency)!==accountingCurrency||N(link?.accounting_amount)===null||N(link.accounting_amount)<=0||S(link?.source_system)!=='FINANCE_TREASURY_ACCOUNTING_CURRENCY_SOURCE_LOCK'||!S(link?.source_version)||!link?.source_timestamp)return false;
  const state=U(link.execution_state);if(state==='COMPLETED')return S(link.execution_payment_id)===S(row.payment_id)&&U(link.execution_native_currency)===U(row.currency)&&N(link.execution_native_amount)!==null&&Math.abs(N(link.execution_native_amount)-N(row.amount))<1e-6;
  return false;
}
function buildSpend(v5,control,links){
  const evidence=A(v5?.dealActualSpendRows).map(cleanNativeEvidence),linkRows=A(links),details=[],totals=new Map(),pending=new Map(),toVerify=new Set();
  for(const row of evidence){const deal=S(row.deal_id),ctl=control.find(x=>S(x.deal_id)===deal),accountingCurrency=U(ctl?.accounting_currency);if(!accountingCurrency){details.push({...row,accounting_currency:null,accounting_amount:null,accounting_amount_status:'TO_VERIFY',accounting_amount_source:'ACCOUNTING_CURRENCY_TO_VERIFY'});toVerify.add(deal);continue}
    if(U(row?.reason)==='DEAL_ATTRIBUTION_TO_VERIFY'||U(row?.management_usd_source)==='DEAL_ATTRIBUTION_TO_VERIFY'){details.push({...row,accounting_currency:accountingCurrency,accounting_amount:null,accounting_amount_status:'TO_VERIFY',accounting_amount_source:'DEAL_ATTRIBUTION_TO_VERIFY'});toVerify.add(deal);continue}
    if(U(row.currency)===accountingCurrency){const amount=N(row.amount);if(amount!==null){totals.set(deal,R((totals.get(deal)||0)+amount));details.push({...row,accounting_currency:accountingCurrency,accounting_amount:amount,accounting_amount_status:'AUTHORITATIVE',accounting_amount_source:'DIRECT_BANK_OUTFLOW_IN_ACCOUNTING_CURRENCY'});continue}}
    const link=linkRows.find(l=>S(l.deal_id)===deal&&U(l.execution_state)==='COMPLETED'&&S(l.execution_payment_id)===S(row.payment_id)&&validateAccountingLink(l,row,accountingCurrency));if(link){const amount=N(link.accounting_amount);totals.set(deal,R((totals.get(deal)||0)+amount));details.push({...row,accounting_currency:accountingCurrency,accounting_amount:amount,accounting_amount_status:'AUTHORITATIVE',accounting_amount_source:'FINANCE_TREASURY_ACCOUNTING_CURRENCY_SOURCE_LOCK',accounting_currency_evidence_id:link.id});continue}
    details.push({...row,accounting_currency:accountingCurrency,accounting_amount:null,accounting_amount_status:'TO_VERIFY',accounting_amount_source:'CROSS_CURRENCY_SOURCE_LOCK_REQUIRED'});toVerify.add(deal);
  }
  for(const link of linkRows){if(U(link.execution_state)!=='CONVERTED_EXECUTION_PENDING')continue;const deal=S(link.deal_id),ctl=control.find(x=>S(x.deal_id)===deal),currency=U(ctl?.accounting_currency);if(!deal||!currency||U(link.accounting_currency)!==currency||N(link.accounting_amount)===null||N(link.accounting_amount)<=0||S(link.source_system)!=='FINANCE_TREASURY_ACCOUNTING_CURRENCY_SOURCE_LOCK'||!S(link.source_version)||!link.source_timestamp||S(link.execution_payment_id))continue;pending.set(deal,R((pending.get(deal)||0)+N(link.accounting_amount)))}
  return{details,totals,pending,toVerify};
}

function buildPassports(v5,control,spend){
  const old=new Map(A(v5?.dealPaymentPassports).map(x=>[S(x.deal_id),x]));
  return control.map(c=>{const prior=old.get(S(c.deal_id))||{},currency=U(c.accounting_currency),actual=spend.totals.get(S(c.deal_id))||0,pending=spend.pending.get(S(c.deal_id))||0,toVerify=!currency||spend.toVerify.has(S(c.deal_id)),received=N(c.verified_received_amount),remaining=received===null||toVerify?null:R(Math.max(0,received-actual));return{deal_id:c.deal_id,client_id:c.client_id??prior.client_id??null,client_name:c.client_name??prior.client_name??null,accounting_currency:currency||null,accounting_currency_status:c.accounting_currency_status,verified_received_amount:received,actual_spend_amount:toVerify?null:actual,actual_spend_status:toVerify?'TO_VERIFY':'AUTHORITATIVE',converted_execution_pending_amount:pending,remaining_unexecuted_amount:remaining,total_to_receive_amount:N(c.total_to_receive_amount),expected_amount:N(c.expected_amount),deferred_not_due_amount:N(c.deferred_not_due_amount),projection_status:c.projection_status,payment_progress_pct:c.payment_progress_pct,payment_progress_status:c.payment_progress_status,receipts:A(prior.receipts),spend_details:spend.details.filter(x=>S(x.deal_id)===S(c.deal_id)),converted_pending:linkPendingRows(c,spend,pending)}})}
function linkPendingRows(control,spend,pending){return pending>0?[{deal_id:control.deal_id,accounting_currency:control.accounting_currency,amount:pending,status:'CONVERTED_EXECUTION_NOT_COMPLETED'}]:[]}

function groupedTotals(control,field){const map=new Map();for(const row of control){if(U(row.accounting_currency)&&N(row[field])!==null)addMoney(map,row.accounting_currency,row[field])}return moneyRows(map)}
function groupedSpend(passports){const map=new Map();for(const p of passports){if(U(p.actual_spend_status)==='AUTHORITATIVE'&&U(p.accounting_currency)&&N(p.actual_spend_amount)!==null)addMoney(map,p.accounting_currency,p.actual_spend_amount)}return moneyRows(map)}

export async function enrichOwnerPaymentsAccountingCurrencyProgressV6(financeFragment,sql){
  const v5=await enrichOwnerPaymentsOwnerFinalV5(financeFragment,sql);
  const [canon,proposalRows,links]=await Promise.all([readFinanceCanon(sql),readCurrentPaymentCurrencyProposals(sql),readAccountingCurrencyLinks(sql)]);
  const contour=A(v5?.paymentContourDealIds).map(S).filter(Boolean),proposalMap=new Map(A(proposalRows).map(x=>[S(x.deal_id),x])),accounting=deriveAccountingCurrencies(v5,contour,proposalMap,!!canon?.source_locked),control=buildControlRows(v5,accounting,proposalMap),spend=buildSpend(v5,control,links),passports=buildPassports(v5,control,spend);
  const out={...v5};
  delete out.managementCurrency;delete out.dealActualSpendUsdTotal;delete out.dealActualSpendUsdByDeal;delete out.financeUsdExecutionLinks;delete out.dealActualSpendRows;delete out.dealConvertedExecutionPendingUsd;
  out.ownerPaymentSemanticsContract=CONTRACT;
  out.ownerFinanceCanon={record_id:canon?.record_id??OWNER_FINANCE_CANON_ID,status:canon?.source_locked?'AUTHORITATIVE':'TO_VERIFY',version:canon?.version??null,source_refs:canon?.source_refs??[],created_at:canon?.created_at??null};
  out.ownerPaymentsPolicy={...out.ownerPaymentsPolicy,dealAccountingCurrencyFollowsClientPayment:true,mixedInboundCurrenciesFailClosed:true,crossCurrencySourceLockRequired:true,syntheticFx:false,fxPrincipalDoubleCount:false,convertedNotPaidIsActualSpend:false,upstreamLifecycleReadOnly:true};
  delete out.ownerPaymentsPolicy.factualUsdOnly;delete out.ownerPaymentsPolicy.nativeCurrencyDetailOnly;
  out.dealPaymentControlRows=control;
  out.dealPaymentPassports=passports;
  out.dealActualSpendRows=spend.details;
  out.financeAccountingCurrencyExecutionLinks=links;
  out.totalToReceiveTotalsByCurrency=groupedTotals(control,'total_to_receive_amount');
  out.verifiedReceivedTotalsByCurrency=groupedTotals(control,'verified_received_amount');
  out.expectedReceiptTotalsByCurrency=groupedTotals(control,'expected_amount');
  out.dueNowTotalsByCurrency=groupedTotals(control,'due_now_amount');
  out.deferredNotDueTotalsByCurrency=groupedTotals(control,'deferred_not_due_amount');
  out.dealActualSpendTotalsByAccountingCurrency=groupedSpend(passports);
  out.dealAccountingCurrencyRows=control.map(x=>({deal_id:x.deal_id,accounting_currency:x.accounting_currency,status:x.accounting_currency_status,source:x.accounting_currency_source,payment_progress_pct:x.payment_progress_pct}));
  out.accountingCurrencyEvidenceContract='FINANCE_DEAL_EXECUTION_ACCOUNTING_CURRENCY_LINKS_V6';
  out.historicalExecutionEvidenceContracts=['FINANCE_DEAL_EXECUTION_USD_LINKS_V5'];
  out.paymentProgressPolicy={formula:'VERIFIED_RECEIVED/TOTAL_TO_RECEIVE',visualOnly:true,fillVerifiedReceivedOnly:true,deferredUnfilledNeutral:true,trancheSegmentation:false,overdueSemantics:false};
  return out;
}
