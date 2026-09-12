// @ts-nocheck

const ACTIVE_AUTHORITY=new Set(['CONFIRMED','VERIFIED']);
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const sameMoney=(a,b)=>{const x=n(a),y=n(b);return x!==null&&y!==null&&Math.abs(x-y)<0.000001};
const asArray=value=>Array.isArray(value)?value:[];

function paymentMap(incomingPayments){
  const map=new Map();
  for(const p of incomingPayments||[]){if(upper(p?.bank_fact_status)!=='BANK_CONFIRMED')continue;map.set(s(p.payment_id),p)}
  return map;
}
function verifiedForDeal(dealId,currency,incomingPayments,incomingPaymentAllocations){
  const payments=paymentMap(incomingPayments),rows=[];
  for(const a of incomingPaymentAllocations||[]){
    if(s(a?.deal_id)!==dealId||upper(a?.currency)!==currency)continue;
    if(upper(a?.allocation_status)!=='VERIFIED'||!ACTIVE_AUTHORITY.has(upper(a?.authority_state)))continue;
    const p=payments.get(s(a.payment_id));if(!p||upper(p.currency)!==currency)continue;
    const amount=n(a.allocated_amount);if(amount===null||amount<0)continue;
    rows.push({paymentId:s(a.payment_id),amount});
  }
  return{rows,amount:round(rows.reduce((sum,row)=>sum+row.amount,0)),paymentIds:[...new Set(rows.map(row=>row.paymentId))]};
}
function summaryFor(dealId,dealFinanceSummaries){return(dealFinanceSummaries||[]).find(x=>s(x?.deal_id)===dealId)||null}
function allocationTotalFor(dealId,currency,dealAllocationTotals){return(dealAllocationTotals||[]).find(x=>s(x?.deal_id)===dealId&&upper(x?.currency)===currency)||null}
function sourceRefs(value){return asArray(value).map(s).filter(Boolean)}

async function readApprovedPreviewPaymentPlan(sql){
  return await sql`
    with approved as (
      select p.record_id proposal_record_id,p.target_id deal_id,p.payload->'proposed_value' schedule,
             c.record_id conclusion_record_id,d.record_id operations_decision_id,
             greatest(p.created_at,c.created_at,d.created_at) source_timestamp,
             jsonb_build_array(
               'PR461_OWNER_AUTHORIZED_PREVIEW_READ_MODEL',
               'BUSINESS_CHANGE_PROPOSAL:'||p.record_id::text,
               'FINANCE_CONCLUSION:'||c.record_id::text,
               'OPERATIONS_DECISION:'||d.record_id::text
             ) source_refs
        from portal_private.ai_coordination_records p
        join lateral (
          select c.* from portal_private.ai_coordination_records c
           where c.target_type='DEAL' and c.target_id=p.target_id
             and c.functional_role::text='FINANCE' and c.record_type='FUNCTIONAL_CONCLUSION'
             and c.status='APPROVED_WITH_CONDITIONS' and coalesce((c.payload->>'confirmed')::boolean,false)=true
             and (c.source_refs @> to_jsonb(array['BUSINESS_CHANGE_PROPOSAL:'||p.record_id::text]::text[])
                  or c.payload->'source_refs' @> to_jsonb(array['BUSINESS_CHANGE_PROPOSAL:'||p.record_id::text]::text[]))
           order by c.version desc,c.created_at desc limit 1
        ) c on true
        join lateral (
          select d.* from portal_private.ai_coordination_records d
           where d.target_type='DEAL' and d.target_id=p.target_id
             and d.record_type='OPERATIONS_INTERNAL_DECISION' and d.status='APPROVE_FOR_NEXT_STAGE'
             and d.payload->>'action'='APPROVE_FOR_NEXT_STAGE'
             and d.payload->>'record_id'=p.record_id::text
           order by d.version desc,d.created_at desc limit 1
        ) d on true
       where p.target_type='DEAL' and p.functional_role::text='FINANCE'
         and p.record_type='BUSINESS_CHANGE_PROPOSAL' and p.status='PROPOSED'
         and p.payload->>'proposed_action'='UPSERT_FINANCE_AUTHORITATIVE_PAYMENT_SCHEDULE'
         and jsonb_typeof(p.payload->'proposed_value')='object'
         and jsonb_typeof(p.payload->'proposed_value'->'tranches')='array'
    ), expanded as (
      select a.*,t.value tranche,t.ordinality::int ord
        from approved a cross join lateral jsonb_array_elements(a.schedule->'tranches') with ordinality t(value,ordinality)
    )
    select e.proposal_record_id id,e.deal_id,
           coalesce(nullif(e.tranche->>'tranche_no','')::int,nullif(e.tranche->>'sequence','')::int,e.ord) tranche_no,
           nullif(btrim(coalesce(e.tranche->>'next_tranche_condition',e.tranche->>'basis','')),'') share_text,
           coalesce(nullif(e.tranche->>'planned_amount','')::numeric,nullif(e.tranche->>'amount','')::numeric) planned_amount,
           upper(btrim(e.schedule->>'currency')) currency,null::timestamptz due_at,
           case when upper(coalesce(e.tranche->>'status','EXPECTED')) in ('PAID','PAID_VERIFIED','RECEIVED') then 'RECEIVED' else 'EXPECTED' end status,
           'PR461_OWNER_AUTHORIZED_PREVIEW_READ_MODEL' source_system,'CONFIRMED' schedule_authority_state,
           case
             when upper(coalesce(e.tranche->>'status','')) in ('PAID','PAID_VERIFIED','RECEIVED') then 'CURRENT_DUE'
             when upper(coalesce(e.tranche->>'status',''))='DEFERRED_NOT_DUE' then 'DEFERRED_NOT_DUE'
             when upper(coalesce(e.tranche->>'trigger_state','')) like 'NOT_CONFIRMED%' then 'DEFERRED_NOT_DUE'
             when upper(coalesce(e.tranche->>'trigger_state','')) in ('CONFIRMED','GU_CONFIRMED','AUTHORITATIVE_CONFIRMED','TRIGGER_CONFIRMED') then 'CURRENT_DUE'
             else 'TO_VERIFY'
           end due_state,
           case when e.tranche ? 'trigger_state' then 'PAYMENT_SCHEDULE_TRIGGER' else null end trigger_type,
           case
             when upper(coalesce(e.tranche->>'status','')) in ('PAID','PAID_VERIFIED','RECEIVED') then 'NOT_APPLICABLE'
             when upper(coalesce(e.tranche->>'trigger_state','')) like 'NOT_CONFIRMED%' or upper(coalesce(e.tranche->>'trigger_state','')) in ('PENDING','DEFERRED','SENT') then 'NOT_CONFIRMED'
             when upper(coalesce(e.tranche->>'trigger_state','')) in ('CONFIRMED','GU_CONFIRMED','AUTHORITATIVE_CONFIRMED','TRIGGER_CONFIRMED') then 'CONFIRMED'
             else 'TO_VERIFY'
           end trigger_state,
           nullif(btrim(coalesce(e.tranche->>'next_tranche_condition',e.tranche->>'basis','')),'') next_tranche_condition,
           nullif(btrim(e.schedule->>'schedule_version'),'') schedule_version,e.proposal_record_id,e.conclusion_record_id,e.operations_decision_id,
           null::uuid trigger_record_id,e.source_refs,e.source_timestamp,e.operations_decision_id::text materialized_at,
           'OWNER_AUTHORIZED_PR461_PREVIEW_READ_MODEL' materialized_by,e.source_timestamp created_at,e.source_timestamp updated_at
      from expanded e
     order by e.deal_id,tranche_no`;
}

async function readMaterializedPaymentPlan(sql){
  if(typeof sql!=='function')return[];
  try{
    return await sql`
      select p.id,d.deal_id,p.tranche_no,p.share_text,p.planned_amount,p.currency,p.due_at,p.status,p.source_system,
             p.schedule_authority_state,p.due_state,p.trigger_type,p.trigger_state,p.next_tranche_condition,p.schedule_version,
             p.proposal_record_id,p.conclusion_record_id,p.operations_decision_id,p.trigger_record_id,p.source_refs,p.source_timestamp,
             p.materialized_at,p.materialized_by,p.created_at,p.updated_at
        from portal_private.owner_payment_plan p
        join portal_private.deals d on d.id=p.deal_key
       where p.schedule_authority_state='CONFIRMED' and p.status<>'CANCELLED'
       order by d.deal_id,p.tranche_no`;
  }catch(error){
    if(String(error?.code||'')!=='42703')throw error;
    return await readApprovedPreviewPaymentPlan(sql);
  }
}
function authoritativePlanGroups(paymentPlan){
  const groups=new Map();
  for(const row of paymentPlan||[]){
    if(upper(row?.schedule_authority_state)!=='CONFIRMED'||upper(row?.status)==='CANCELLED')continue;
    const dealId=s(row?.deal_id);if(!dealId)continue;
    if(!groups.has(dealId))groups.set(dealId,[]);groups.get(dealId).push(row);
  }
  for(const rows of groups.values())rows.sort((a,b)=>Number(a?.tranche_no||0)-Number(b?.tranche_no||0));
  return groups;
}
function validatePlanRows(dealId,rows){
  const errors=[],seen=new Set(),currencies=new Set(),versions=new Set();let obligation=0,duePlanAmount=0;
  for(const row of rows){
    const no=Number(row?.tranche_no),amount=n(row?.planned_amount),currency=upper(row?.currency),due=upper(row?.due_state),trigger=upper(row?.trigger_state),triggerType=s(row?.trigger_type);
    if(!Number.isInteger(no)||no<=0||seen.has(no))errors.push('TRANCHE_NUMBER_INVALID');else seen.add(no);
    if(amount===null||amount<0)errors.push('TRANCHE_AMOUNT_INVALID');else obligation=round(obligation+amount);
    if(!/^[A-Z]{3}$/.test(currency))errors.push('TRANCHE_CURRENCY_INVALID');else currencies.add(currency);
    if(!['CURRENT_DUE','DEFERRED_NOT_DUE','NOT_APPLICABLE'].includes(due))errors.push('TRANCHE_DUE_STATE_INVALID');
    if(!['CONFIRMED','NOT_CONFIRMED','NOT_APPLICABLE'].includes(trigger))errors.push('TRANCHE_TRIGGER_STATE_INVALID');
    if(triggerType&&trigger==='NOT_CONFIRMED'&&due==='CURRENT_DUE')errors.push('UNCONFIRMED_TRIGGER_CREATED_DUE');
    if(trigger==='CONFIRMED'&&due!=='CURRENT_DUE')errors.push('CONFIRMED_TRIGGER_NOT_DUE');
    if(due==='CURRENT_DUE'&&(!triggerType||['CONFIRMED','NOT_APPLICABLE'].includes(trigger))&&amount!==null)duePlanAmount=round(duePlanAmount+amount);
    const version=s(row?.schedule_version);if(!version)errors.push('SCHEDULE_VERSION_MISSING');else versions.add(version);
    if(!s(row?.materialized_at))errors.push('MATERIALIZED_AT_MISSING');
  }
  if(currencies.size!==1)errors.push('SCHEDULE_CURRENCY_CONFLICT');if(versions.size!==1)errors.push('SCHEDULE_VERSION_CONFLICT');if(obligation<=0)errors.push('SCHEDULE_OBLIGATION_INVALID');
  return{ok:errors.length===0,errors:[...new Set(errors)],dealId,currency:[...currencies][0]||null,scheduleVersion:[...versions][0]||null,obligation,duePlanAmount};
}
function planTriggerState(rows,remaining){
  if(remaining===0)return'NOT_APPLICABLE';const triggered=rows.filter(row=>s(row?.trigger_type));if(!triggered.length)return'NOT_APPLICABLE';
  if(triggered.some(row=>upper(row?.trigger_state)==='NOT_CONFIRMED'))return'NOT_CONFIRMED';if(triggered.some(row=>upper(row?.trigger_state)==='CONFIRMED'))return'CONFIRMED';return'TO_VERIFY';
}
function nextCondition(rows,remaining){
  if(remaining===0)return'NO_FURTHER_TRANCHE';const deferred=rows.find(row=>upper(row?.due_state)==='DEFERRED_NOT_DUE');if(deferred)return s(deferred?.next_tranche_condition||deferred?.share_text)||null;
  const triggered=rows.find(row=>s(row?.trigger_type)&&upper(row?.trigger_state)==='CONFIRMED');return s(triggered?.next_tranche_condition||triggered?.share_text)||null;
}
function planProvenance(rows){
  const first=rows[0]||{};return{
    sourceKind:s(first?.source_system)||'FINANCE_PAYMENT_PLAN_MATERIALIZED',sourceRecordId:s(first?.id)||null,proposalRecordId:s(first?.proposal_record_id)||null,
    conclusionRecordId:s(first?.conclusion_record_id)||null,operationsDecisionId:s(first?.operations_decision_id)||null,
    triggerRecordId:s(rows.find(x=>x?.trigger_record_id)?.trigger_record_id)||null,sourceVersion:s(first?.schedule_version)||null,
    sourceTimestamp:first?.source_timestamp??null,materializedAt:first?.materialized_at??null,sourceRefs:[...new Set(rows.flatMap(row=>sourceRefs(row?.source_refs)))]
  };
}

export async function buildPaymentScheduleAuthority(sql,{paymentPlan=null,incomingPayments=[],incomingPaymentAllocations=[],dealAllocationTotals=[],dealFinanceSummaries=[]}={}){
  const currentPlan=Array.isArray(paymentPlan)?paymentPlan:await readMaterializedPaymentPlan(sql);
  const planGroups=authoritativePlanGroups(currentPlan),schedules=[],materialized=new Set(),invalidPlans=new Map();
  for(const [dealId,rows] of planGroups){
    const plan=validatePlanRows(dealId,rows);if(!plan.ok){invalidPlans.set(dealId,plan.errors);continue}
    const currency=plan.currency,obligation=plan.obligation,summary=summaryFor(dealId,dealFinanceSummaries);
    if(!summary||upper(summary.currency)!==currency||!sameMoney(summary.obligation_amount,obligation)){invalidPlans.set(dealId,['FINANCE_SUMMARY_PLAN_MISMATCH']);continue}
    const verified=verifiedForDeal(dealId,currency,incomingPayments,incomingPaymentAllocations),aggregate=allocationTotalFor(dealId,currency,dealAllocationTotals);
    if(aggregate&&!sameMoney(aggregate.allocated_amount,verified.amount)){invalidPlans.set(dealId,['DEAL_ALLOCATION_TOTAL_MISMATCH']);continue}
    if(verified.amount>obligation+0.000001){invalidPlans.set(dealId,['VERIFIED_RECEIPT_EXCEEDS_OBLIGATION']);continue}
    const remaining=round(Math.max(0,obligation-verified.amount)),currentDueAmount=round(Math.min(remaining,Math.max(0,plan.duePlanAmount-verified.amount))),deferredNotDueAmount=round(Math.max(0,remaining-currentDueAmount));
    const scheduleState=remaining===0?'PAID':currentDueAmount>0?'DUE':deferredNotDueAmount>0?'DEFERRED_NOT_DUE':'TO_VERIFY';if(scheduleState==='TO_VERIFY'){invalidPlans.set(dealId,['DUE_BUCKETS_UNRESOLVED']);continue}
    const triggerState=planTriggerState(rows,remaining),provenance=planProvenance(rows);if(scheduleState==='DUE'&&!['CONFIRMED','NOT_APPLICABLE'].includes(triggerState)){invalidPlans.set(dealId,['DUE_WITHOUT_MATERIALIZED_TRIGGER']);continue}
    schedules.push({dealId,currency,obligationAmount:obligation,verifiedReceivedAmount:verified.amount,remainingAmount:remaining,currentDueAmount,deferredNotDueAmount,scheduleState,
      nextTrancheCondition:nextCondition(rows,remaining),triggerState,paymentIds:verified.paymentIds,bankFactStatus:verified.paymentIds.length?'BANK_CONFIRMED':'NO_VERIFIED_RECEIPT',
      allocationStatus:verified.paymentIds.length?'VERIFIED':'NO_VERIFIED_ALLOCATION',financeStatus:s(summary.finance_status)||null,accountingClosureStatus:s(summary.accounting_status)||null,
      outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',authorityState:'FINANCE_CURRENT_STATE',...provenance});materialized.add(dealId);
  }

  for(const summary of dealFinanceSummaries||[]){
    const dealId=s(summary?.deal_id);if(!dealId||materialized.has(dealId)||invalidPlans.has(dealId))continue;const currency=upper(summary?.currency),obligation=n(summary?.obligation_amount);
    if(!currency||obligation===null||obligation<=0||upper(summary?.finance_status)!=='PAID')continue;
    const verified=verifiedForDeal(dealId,currency,incomingPayments,incomingPaymentAllocations),aggregate=allocationTotalFor(dealId,currency,dealAllocationTotals);
    if(!sameMoney(verified.amount,obligation)||(aggregate&&!sameMoney(aggregate.allocated_amount,verified.amount)))continue;
    schedules.push({dealId,currency,obligationAmount:obligation,verifiedReceivedAmount:verified.amount,remainingAmount:0,currentDueAmount:0,deferredNotDueAmount:0,scheduleState:'PAID',
      nextTrancheCondition:'NO_FURTHER_TRANCHE',triggerState:'NOT_APPLICABLE',paymentIds:verified.paymentIds,bankFactStatus:'BANK_CONFIRMED',allocationStatus:'VERIFIED',
      financeStatus:s(summary.finance_status)||null,accountingClosureStatus:s(summary.accounting_status)||null,outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
      sourceKind:'FINANCE_PAID_CURRENT_STATE',sourceRecordId:null,proposalRecordId:null,conclusionRecordId:null,operationsDecisionId:null,sourceVersion:s(summary?.source_version)||null,
      sourceTimestamp:summary?.source_timestamp??null,materializedAt:null,sourceRefs:[],triggerRecordId:null,authorityState:'FINANCE_CURRENT_STATE'});materialized.add(dealId);
  }

  const holds=[];for(const summary of dealFinanceSummaries||[]){
    const dealId=s(summary?.deal_id);if(!dealId||materialized.has(dealId))continue;const obligation=n(summary?.obligation_amount);if(obligation===null||obligation<=0)continue;
    holds.push({dealId,scheduleState:'TO_VERIFY',currency:upper(summary?.currency)||null,obligationAmount:null,verifiedReceivedAmount:null,remainingAmount:null,currentDueAmount:null,deferredNotDueAmount:null,
      nextTrancheCondition:null,triggerState:'TO_VERIFY',paymentIds:[],bankFactStatus:'TO_VERIFY',allocationStatus:'TO_VERIFY',financeStatus:s(summary?.finance_status)||null,
      accountingClosureStatus:s(summary?.accounting_status)||null,outgoingUsdEquivalent:null,outgoingUsdEquivalentStatus:'TO_VERIFY',
      reason:invalidPlans.has(dealId)?'MATERIALIZED_FINANCE_PAYMENT_PLAN_INVALID':'FINANCE_PAYMENT_SCHEDULE_NOT_MATERIALIZED',validationErrors:invalidPlans.get(dealId)||[],authorityState:'FAIL_CLOSED'});
  }
  return{paymentScheduleContract:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE_V1',paymentScheduleStore:'portal_private.owner_payment_plan',
    paymentSchedules:schedules.sort((a,b)=>a.dealId.localeCompare(b.dealId)),paymentScheduleHolds:holds.sort((a,b)=>a.dealId.localeCompare(b.dealId))};
}
