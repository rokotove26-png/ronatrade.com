// @ts-nocheck

const ACTIVE_AUTHORITY=new Set(['CONFIRMED','VERIFIED']);
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const sameMoney=(a,b)=>{const x=n(a),y=n(b);return x!==null&&y!==null&&Math.abs(x-y)<0.000001};

function explicitTriggerState(value){
  if(value===true)return 'CONFIRMED';
  if(value===false)return 'NOT_CONFIRMED';
  const state=upper(value);
  if(['CONFIRMED','GU_CONFIRMED','AUTHORITATIVE_CONFIRMED','TRIGGER_CONFIRMED'].includes(state))return 'CONFIRMED';
  if(['NOT_CONFIRMED','PENDING','DEFERRED','TO_VERIFY','SENT'].includes(state))return state==='SENT'?'NOT_CONFIRMED':state;
  return null;
}
function triggerFromRecord(record){
  const raw=record?.payment_schedule_trigger;
  if(raw===null||raw===undefined)return null;
  if(typeof raw==='boolean'||typeof raw==='string')return explicitTriggerState(raw);
  if(typeof raw==='object'){
    if(raw.confirmed===true)return 'CONFIRMED';
    if(raw.confirmed===false)return 'NOT_CONFIRMED';
    return explicitTriggerState(raw.state??raw.trigger_state??raw.status);
  }
  return null;
}
function proposalTrigger(config){
  const evidence=config?.trigger_evidence||{};
  if(evidence.authoritative_gu_for_deal===true)return 'CONFIRMED';
  if(evidence.authoritative_gu_for_deal===false)return 'NOT_CONFIRMED';
  const tranches=Array.isArray(config?.tranches)?config.tranches:[];
  const next=tranches.find(x=>upper(x?.status)!=='PAID_VERIFIED'&&upper(x?.status)!=='PAID');
  return explicitTriggerState(next?.trigger_state);
}
function scheduleCondition(config){
  if(s(config?.next_tranche_condition))return s(config.next_tranche_condition);
  const tranches=Array.isArray(config?.tranches)?config.tranches:[];
  const next=tranches.find(x=>upper(x?.status)!=='PAID_VERIFIED'&&upper(x?.status)!=='PAID');
  return s(next?.basis)||null;
}
function requiresExplicitTrigger(config){
  const tranches=Array.isArray(config?.tranches)?config.tranches:[];
  return tranches.some(x=>x&&Object.prototype.hasOwnProperty.call(x,'trigger_state'))||config?.trigger_evidence?.authoritative_gu_for_deal!==undefined;
}
function paymentMap(incomingPayments){
  const map=new Map();
  for(const p of incomingPayments||[]){
    if(upper(p?.bank_fact_status)!=='BANK_CONFIRMED')continue;
    map.set(s(p.payment_id),p);
  }
  return map;
}
function verifiedForDeal(dealId,currency,incomingPayments,incomingPaymentAllocations){
  const payments=paymentMap(incomingPayments),rows=[];
  for(const a of incomingPaymentAllocations||[]){
    if(s(a?.deal_id)!==dealId||upper(a?.currency)!==currency)continue;
    if(upper(a?.allocation_status)!=='VERIFIED'||!ACTIVE_AUTHORITY.has(upper(a?.authority_state)))continue;
    const p=payments.get(s(a.payment_id));
    if(!p||upper(p.currency)!==currency)continue;
    const amount=n(a.allocated_amount);if(amount===null||amount<0)continue;
    rows.push({paymentId:s(a.payment_id),amount});
  }
  return{rows,amount:round(rows.reduce((sum,row)=>sum+row.amount,0)),paymentIds:[...new Set(rows.map(row=>row.paymentId))]};
}
function summaryFor(dealId,dealFinanceSummaries){return(dealFinanceSummaries||[]).find(x=>s(x?.deal_id)===dealId)||null}
function allocationTotalFor(dealId,currency,dealAllocationTotals){return(dealAllocationTotals||[]).find(x=>s(x?.deal_id)===dealId&&upper(x?.currency)===currency)||null}

async function authoritativeScheduleConfigs(sql){
  const rows=await sql`
    with approved_proposals as (
      select distinct on (p.target_id)
        p.record_id,p.target_id deal_id,p.version,p.payload->'proposed_value' schedule_value,p.created_at,
        d.record_id decision_record_id,d.created_at decision_created_at
      from portal_private.ai_coordination_records p
      join lateral (
        select x.record_id,x.created_at
        from portal_private.ai_coordination_records x
        where x.qa_only=false
          and x.record_type='OPERATIONS_INTERNAL_DECISION'
          and x.parent_record_id=p.record_id
          and x.status='APPROVE_FOR_NEXT_STAGE'
        order by x.version desc,x.created_at desc
        limit 1
      ) d on true
      where p.qa_only=false
        and p.functional_role::text='FINANCE'
        and p.record_type='BUSINESS_CHANGE_PROPOSAL'
        and p.target_type='DEAL'
        and p.payload->>'proposed_field'='finance.payment_schedule'
        and p.payload->>'proposed_action'='UPSERT_FINANCE_AUTHORITATIVE_PAYMENT_SCHEDULE'
        and jsonb_typeof(p.payload->'proposed_value')='object'
      order by p.target_id,p.version desc,p.created_at desc
    ), direct_finance as (
      select distinct on (r.target_id)
        r.record_id,r.target_id deal_id,r.version,r.payload->'payment_schedule' schedule_value,r.created_at,
        null::uuid decision_record_id,null::timestamptz decision_created_at
      from portal_private.ai_coordination_records r
      where r.qa_only=false
        and r.functional_role::text='FINANCE'
        and r.record_type='FUNCTIONAL_CONCLUSION'
        and r.target_type='DEAL'
        and r.status in ('APPROVED','APPROVED_WITH_CONDITIONS')
        and coalesce((r.payload->>'confirmed')::boolean,false)=true
        and jsonb_typeof(r.payload->'payment_schedule')='object'
      order by r.target_id,r.version desc,r.created_at desc
    ), candidates as (
      select *,'APPROVED_PROPOSAL' source_kind from approved_proposals
      union all
      select *,'FINANCE_CURRENT_STATE' source_kind from direct_finance
    )
    select distinct on (deal_id) * from candidates
    order by deal_id,created_at desc,version desc`;
  return rows.map(row=>({
    dealId:s(row.deal_id),config:row.schedule_value||{},recordId:s(row.record_id),decisionRecordId:s(row.decision_record_id)||null,
    sourceKind:s(row.source_kind),createdAt:row.created_at,decisionCreatedAt:row.decision_created_at
  }));
}
async function explicitTriggerRecords(sql){
  const rows=await sql`
    select distinct on (r.target_id)
      r.target_id deal_id,r.record_id,r.functional_role::text functional_role,r.status,r.version,
      r.payload->'payment_schedule_trigger' payment_schedule_trigger,r.created_at
    from portal_private.ai_coordination_records r
    where r.qa_only=false
      and r.target_type='DEAL'
      and r.record_type='FUNCTIONAL_CONCLUSION'
      and r.functional_role::text in ('FINANCE','RAIL_LOGISTICS')
      and r.status in ('APPROVED','APPROVED_WITH_CONDITIONS')
      and coalesce((r.payload->>'confirmed')::boolean,false)=true
      and r.payload ? 'payment_schedule_trigger'
    order by r.target_id,r.version desc,r.created_at desc`;
  return new Map(rows.map(row=>[s(row.deal_id),row]));
}

export async function buildPaymentScheduleAuthority(sql,{incomingPayments=[],incomingPaymentAllocations=[],dealAllocationTotals=[],dealFinanceSummaries=[]}={}){
  const configs=await authoritativeScheduleConfigs(sql);
  const triggerRecords=await explicitTriggerRecords(sql);
  const schedules=[],materialized=new Set();

  for(const source of configs){
    const dealId=source.dealId,config=source.config||{},currency=upper(config.currency),obligation=n(config.obligation_amount);
    if(!dealId||!currency||obligation===null||obligation<=0)continue;
    const summary=summaryFor(dealId,dealFinanceSummaries);
    if(!summary||upper(summary.currency)!==currency||!sameMoney(summary.obligation_amount,obligation))continue;
    const verified=verifiedForDeal(dealId,currency,incomingPayments,incomingPaymentAllocations);
    const aggregate=allocationTotalFor(dealId,currency,dealAllocationTotals);
    if(aggregate&&!sameMoney(aggregate.allocated_amount,verified.amount))continue;
    if(verified.amount>obligation+0.000001)continue;

    const remaining=round(Math.max(0,obligation-verified.amount));
    const explicit=triggerFromRecord(triggerRecords.get(dealId));
    const proposal=proposalTrigger(config);
    const needsTrigger=requiresExplicitTrigger(config);
    const triggerState=remaining===0?'NOT_APPLICABLE':(explicit||proposal||(needsTrigger?'NOT_CONFIRMED':'NOT_APPLICABLE'));
    const triggerConfirmed=triggerState==='CONFIRMED';
    let scheduleState,currentDueAmount,deferredNotDueAmount;
    if(remaining===0){scheduleState='PAID';currentDueAmount=0;deferredNotDueAmount=0}
    else if(needsTrigger){scheduleState=triggerConfirmed?'DUE':'DEFERRED_NOT_DUE';currentDueAmount=triggerConfirmed?remaining:0;deferredNotDueAmount=triggerConfirmed?0:remaining}
    else if(upper(summary.finance_status)==='DUE'){scheduleState='DUE';currentDueAmount=remaining;deferredNotDueAmount=0}
    else if(upper(summary.finance_status)==='NOT_DUE'){scheduleState='DEFERRED_NOT_DUE';currentDueAmount=0;deferredNotDueAmount=remaining}
    else{continue}

    schedules.push({
      dealId,currency,obligationAmount:obligation,verifiedReceivedAmount:verified.amount,remainingAmount:remaining,
      currentDueAmount,deferredNotDueAmount,scheduleState,
      nextTrancheCondition:remaining===0?'NO_FURTHER_TRANCHE':scheduleCondition(config),triggerState,
      paymentIds:verified.paymentIds,bankFactStatus:verified.paymentIds.length?'BANK_CONFIRMED':'NO_VERIFIED_RECEIPT',
      allocationStatus:verified.paymentIds.length?'VERIFIED':'NO_VERIFIED_ALLOCATION',
      financeStatus:s(summary.finance_status)||null,accountingClosureStatus:s(summary.accounting_status)||null,
      outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
      sourceKind:source.sourceKind,sourceRecordId:source.recordId,sourceDecisionRecordId:source.decisionRecordId,
      sourceCreatedAt:source.createdAt,triggerRecordId:s(triggerRecords.get(dealId)?.record_id)||null,
      authorityState:'FINANCE_CURRENT_STATE'
    });
    materialized.add(dealId);
  }

  for(const summary of dealFinanceSummaries||[]){
    const dealId=s(summary?.deal_id),currency=upper(summary?.currency),obligation=n(summary?.obligation_amount);
    if(!dealId||materialized.has(dealId)||!currency||obligation===null||obligation<=0)continue;
    const verified=verifiedForDeal(dealId,currency,incomingPayments,incomingPaymentAllocations);
    const aggregate=allocationTotalFor(dealId,currency,dealAllocationTotals);
    if(upper(summary?.finance_status)!=='PAID'||verified.amount+0.000001<obligation||verified.amount>obligation+0.000001)continue;
    if(aggregate&&!sameMoney(aggregate.allocated_amount,verified.amount))continue;
    schedules.push({
      dealId,currency,obligationAmount:obligation,verifiedReceivedAmount:verified.amount,remainingAmount:0,currentDueAmount:0,deferredNotDueAmount:0,
      scheduleState:'PAID',nextTrancheCondition:'NO_FURTHER_TRANCHE',triggerState:'NOT_APPLICABLE',paymentIds:verified.paymentIds,
      bankFactStatus:'BANK_CONFIRMED',allocationStatus:'VERIFIED',financeStatus:s(summary.finance_status)||null,
      accountingClosureStatus:s(summary.accounting_status)||null,outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
      sourceKind:'FINANCE_PAID_CURRENT_STATE',sourceRecordId:null,sourceDecisionRecordId:null,sourceCreatedAt:null,triggerRecordId:null,
      authorityState:'FINANCE_CURRENT_STATE'
    });
    materialized.add(dealId);
  }

  const holds=[];
  for(const summary of dealFinanceSummaries||[]){
    const dealId=s(summary?.deal_id);if(!dealId||materialized.has(dealId))continue;
    const obligation=n(summary?.obligation_amount);if(obligation===null||obligation<=0)continue;
    holds.push({
      dealId,scheduleState:'TO_VERIFY',currency:upper(summary?.currency)||null,obligationAmount:null,verifiedReceivedAmount:null,remainingAmount:null,
      currentDueAmount:null,deferredNotDueAmount:null,nextTrancheCondition:null,triggerState:'TO_VERIFY',paymentIds:[],
      bankFactStatus:'TO_VERIFY',allocationStatus:'TO_VERIFY',financeStatus:s(summary?.finance_status)||null,
      accountingClosureStatus:s(summary?.accounting_status)||null,outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
      reason:'FINANCE_PAYMENT_SCHEDULE_AUTHORITY_MISSING_OR_RECONCILING',authorityState:'FAIL_CLOSED'
    });
  }

  return{
    paymentScheduleContract:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1',
    paymentSchedules:schedules.sort((a,b)=>a.dealId.localeCompare(b.dealId)),
    paymentScheduleHolds:holds.sort((a,b)=>a.dealId.localeCompare(b.dealId))
  };
}
