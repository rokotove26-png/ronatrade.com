// @ts-nocheck

const asArray=value=>Array.isArray(value)?value:[];
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const ACTIVE_AUTHORITY=new Set(['CONFIRMED','VERIFIED']);

function addMoney(map,currency,amount,extra={}){
  const c=upper(currency),v=n(amount);if(!c||v===null||v<0)return;
  const row=map.get(c)||{currency:c,amount:0,...extra};row.amount=round(row.amount+v);map.set(c,row);
}
function sourceLockedOutgoing(row){
  const flow=upper(row?.flow_kind);
  if(!s(row?.fact_id)||n(row?.amount)===null||n(row?.amount)<0||!upper(row?.currency))return false;
  if(upper(row?.deal_allocation_status)!=='CONFIRMED'||upper(row?.bank_fact_status)!=='BANK_CONFIRMED'||upper(row?.authority_state)!=='CONFIRMED')return false;
  if(row?.lifecycle_state&&upper(row.lifecycle_state)!=='ACTIVE')return false;
  if(!s(row?.source_document)||!s(row?.source_version)||!row?.source_timestamp)return false;
  if(flow==='FX_CONVERSION')return false;
  return asArray(row?.deal_ids).map(s).filter(Boolean).length>0;
}
function spendCategory(row){
  const flow=upper(row?.flow_kind),hay=upper([row?.beneficiary_role,row?.beneficiary_name,row?.purpose].filter(Boolean).join(' '));
  if(flow==='BANK_FEE')return'BANK_FEE';
  if(flow==='FX_COST'||flow==='FX_EFFECT')return'FX_COST_EFFECT';
  if(/АВАНС|ADVANCE/.test(hay))return'RONA_ADVANCE';
  if(/ЛОГИСТ|ЭКСПЕД|ЖД|ВАГОН|ПЕРЕВОЗ|RAIL|LOGISTIC|FORWARD|TRANSPORT/.test(hay))return'LOGISTICS_FORWARDING';
  if(flow==='COUNTERPARTY_PAYMENT')return'SUPPLIER_COUNTERPARTY';
  return'OTHER_CONFIRMED';
}
function categoryLabel(value){return({SUPPLIER_COUNTERPARTY:'Поставщику / контрагенту',LOGISTICS_FORWARDING:'Логистика / экспедирование',BANK_FEE:'Банковские комиссии',RONA_ADVANCE:'Авансировано RONA',FX_COST_EFFECT:'FX / подтвержденный реальный cost/effect',OTHER_CONFIRMED:'Прочие подтвержденные расходы'}[value]||value)}

async function readExplicitExpectedReceipts(sql){
  if(typeof sql!=='function')return[];
  return await sql`
    with finance_current as (
      select p.record_id proposal_record_id,
             p.target_id deal_id,
             p.payload->'proposed_state' state,
             p.created_at proposal_created_at,
             p.evidence_refs proposal_evidence_refs,
             c.record_id conclusion_record_id,
             c.created_at conclusion_created_at,
             c.status conclusion_status,
             c.source_refs conclusion_source_refs
        from portal_private.ai_coordination_records p
        join lateral (
          select c.*
            from portal_private.ai_coordination_records c
           where c.target_type='DEAL'
             and c.target_id=p.target_id
             and c.functional_role::text='FINANCE'
             and c.record_type='FUNCTIONAL_CONCLUSION'
             and c.status in ('APPROVED','APPROVED_WITH_CONDITIONS')
             and c.qa_only=false
             and coalesce((c.payload->>'confirmed')::boolean,false)=true
             and (
               coalesce(p.evidence_refs,'[]'::jsonb) @> to_jsonb(array['FINANCE_CONCLUSION:'||c.record_id::text]::text[])
               or coalesce(p.payload->'evidence_refs','[]'::jsonb) @> to_jsonb(array['FINANCE_CONCLUSION:'||c.record_id::text]::text[])
             )
           order by c.version desc,c.created_at desc
           limit 1
        ) c on true
       where p.target_type='DEAL'
         and p.functional_role::text='FINANCE'
         and p.record_type='BUSINESS_CHANGE_PROPOSAL'
         and p.status='PROPOSED'
         and p.qa_only=false
         and p.payload->>'proposed_action'='UPSERT_OWNER_EXPECTED_RECEIPT_PROJECTION'
         and jsonb_typeof(p.payload->'proposed_state')='object'
    )
    select distinct on (deal_id)
           deal_id,
           upper(nullif(btrim(state->>'currency'),'')) currency,
           coalesce(nullif(state->>'verified_client_received','')::numeric,0) verified_received,
           coalesce(nullif(state->>'due_now','')::numeric,0) due_now,
           coalesce(nullif(state->>'expected_not_due','')::numeric,0) expected_not_due,
           nullif(state->>'next_expected_payment','')::numeric next_expected_payment,
           nullif(btrim(state->>'projection_status'),'') projection_status,
           nullif(btrim(state->>'finance_status'),'') finance_status,
           nullif(btrim(state->>'document_dispatch_status'),'') document_dispatch_status,
           proposal_record_id,conclusion_record_id,
           greatest(proposal_created_at,conclusion_created_at) source_timestamp,
           coalesce(proposal_evidence_refs,'[]'::jsonb)||coalesce(conclusion_source_refs,'[]'::jsonb) source_refs
      from finance_current
     order by deal_id,proposal_created_at desc,conclusion_created_at desc`;
}

function summaryMap(finance){
  const map=new Map();
  for(const row of [...asArray(finance?.dealFinanceCurrentState),...asArray(finance?.dealFinanceSummaries)]){
    const id=s(row?.deal_id);if(id&&!map.has(id))map.set(id,row);
  }
  return map;
}
function expectedRow({dealId,summary,currency,amount,bucket,projectionStatus,financeStatus,sourceKind,sourceVersion,sourceTimestamp,sourceRefs,proposalRecordId,conclusionRecordId,documentDispatchStatus,nextExpectedPayment}){
  return{deal_id:dealId,client_id:summary?.client_id??null,client_name:summary?.client_name??null,currency:upper(currency),expected_amount:round(amount),bucket,
    projection_status:projectionStatus,finance_status:financeStatus??summary?.finance_status??null,document_dispatch_status:documentDispatchStatus??null,
    next_expected_payment:n(nextExpectedPayment),source_kind:sourceKind,source_version:sourceVersion??null,source_timestamp:sourceTimestamp??null,source_refs:asArray(sourceRefs),
    proposal_record_id:proposalRecordId??null,conclusion_record_id:conclusionRecordId??null};
}
function buildExpectedReceiptRows(finance,explicit){
  const summaries=summaryMap(finance),rows=[],explicitDeals=new Set();
  for(const src of explicit){
    const dealId=s(src?.deal_id),currency=upper(src?.currency),summary=summaries.get(dealId)||null;if(!dealId||!currency)continue;explicitDeals.add(dealId);
    const sourceStatus=upper(src?.projection_status),toVerify=sourceStatus.includes('TO_VERIFY');
    const due=Math.max(0,n(src?.due_now)??0),future=Math.max(0,n(src?.expected_not_due)??0),next=n(src?.next_expected_payment);
    if(due>0)rows.push(expectedRow({dealId,summary,currency,amount:due,bucket:'DUE_NOW',projectionStatus:toVerify?'TO_VERIFY':'AUTHORITATIVE',financeStatus:src?.finance_status,sourceKind:'FINANCE_EXPECTED_RECEIPT_CURRENT_STATE',sourceVersion:`PROPOSAL:${src.proposal_record_id}`,sourceTimestamp:src?.source_timestamp,sourceRefs:src?.source_refs,proposalRecordId:src?.proposal_record_id,conclusionRecordId:src?.conclusion_record_id,documentDispatchStatus:src?.document_dispatch_status,nextExpectedPayment:next}));
    if(future>0)rows.push(expectedRow({dealId,summary,currency,amount:future,bucket:'EXPECTED_NOT_DUE',projectionStatus:toVerify?'TO_VERIFY':'AUTHORITATIVE',financeStatus:src?.finance_status,sourceKind:'FINANCE_EXPECTED_RECEIPT_CURRENT_STATE',sourceVersion:`PROPOSAL:${src.proposal_record_id}`,sourceTimestamp:src?.source_timestamp,sourceRefs:src?.source_refs,proposalRecordId:src?.proposal_record_id,conclusionRecordId:src?.conclusion_record_id,documentDispatchStatus:src?.document_dispatch_status,nextExpectedPayment:next}));
    if(due===0&&future===0&&next!==null&&next>0)rows.push(expectedRow({dealId,summary,currency,amount:next,bucket:'EXPECTED_NOT_DUE',projectionStatus:'TO_VERIFY',financeStatus:src?.finance_status,sourceKind:'FINANCE_EXPECTED_RECEIPT_CURRENT_STATE',sourceVersion:`PROPOSAL:${src.proposal_record_id}`,sourceTimestamp:src?.source_timestamp,sourceRefs:src?.source_refs,proposalRecordId:src?.proposal_record_id,conclusionRecordId:src?.conclusion_record_id,documentDispatchStatus:src?.document_dispatch_status,nextExpectedPayment:next}));
  }
  for(const schedule of asArray(finance?.dealFinanceCurrentState)){
    const dealId=s(schedule?.deal_id);if(!dealId||explicitDeals.has(dealId)||upper(schedule?.payment_schedule_projection_status)!=='AUTHORITATIVE')continue;
    const currency=upper(schedule?.currency),due=Math.max(0,n(schedule?.current_due_amount)??0),future=Math.max(0,n(schedule?.deferred_not_due_amount)??0);if(!currency)continue;
    const prov=asArray(finance?.paymentSchedules).find(x=>s(x?.dealId)===dealId)||{};
    if(due>0)rows.push(expectedRow({dealId,summary:schedule,currency,amount:due,bucket:'DUE_NOW',projectionStatus:'AUTHORITATIVE',financeStatus:schedule?.finance_status,sourceKind:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE',sourceVersion:prov?.sourceVersion,sourceTimestamp:prov?.sourceTimestamp,sourceRefs:prov?.sourceRefs,nextExpectedPayment:due}));
    if(future>0)rows.push(expectedRow({dealId,summary:schedule,currency,amount:future,bucket:'EXPECTED_NOT_DUE',projectionStatus:'AUTHORITATIVE',financeStatus:schedule?.finance_status,sourceKind:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE',sourceVersion:prov?.sourceVersion,sourceTimestamp:prov?.sourceTimestamp,sourceRefs:prov?.sourceRefs,nextExpectedPayment:future}));
  }
  return rows.sort((a,b)=>a.deal_id.localeCompare(b.deal_id)||a.bucket.localeCompare(b.bucket));
}
function buildSpend(finance){
  const rows=[],seen=new Set();
  for(const src of asArray(finance?.outgoingPayments)){
    if(!sourceLockedOutgoing(src))continue;
    const category=spendCategory(src);
    for(const dealId of [...new Set(asArray(src?.deal_ids).map(s).filter(Boolean))]){
      const key=s(src.fact_id)+'\u0000'+dealId;if(seen.has(key))continue;seen.add(key);
      rows.push({deal_id:dealId,payment_id:s(src.fact_id),payment_at:src?.payment_at??null,recipient:s(src?.beneficiary_name)||null,recipient_role:s(src?.beneficiary_role)||null,
        amount:n(src?.amount),currency:upper(src?.currency),category,category_label:categoryLabel(category),flow_kind:upper(src?.flow_kind),purpose:s(src?.purpose)||null,bank_document:s(src?.bank_document)||null,
        status:'CONFIRMED',bank_fact_status:'BANK_CONFIRMED',deal_allocation_status:'CONFIRMED',source_document:s(src?.source_document),source_version:s(src?.source_version),source_timestamp:src?.source_timestamp??null,
        authority_state:upper(src?.authority_state),lifecycle_state:upper(src?.lifecycle_state)||'ACTIVE'});
    }
  }
  rows.sort((a,b)=>a.deal_id.localeCompare(b.deal_id)||String(a.payment_at).localeCompare(String(b.payment_at))||a.payment_id.localeCompare(b.payment_id));
  const totalMap=new Map(),dealMap=new Map();
  for(const row of rows){addMoney(totalMap,row.currency,row.amount);const key=row.deal_id+'\u0000'+row.currency,prev=dealMap.get(key)||{deal_id:row.deal_id,currency:row.currency,amount:0};prev.amount=round(prev.amount+row.amount);dealMap.set(key,prev)}
  return{rows,totalsByCurrency:[...totalMap.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),totalsByDealCurrency:[...dealMap.values()].sort((a,b)=>a.deal_id.localeCompare(b.deal_id)||a.currency.localeCompare(b.currency))};
}
function receivedRows(finance){
  return asArray(finance?.incomingPayments).map(row=>({bucket:'VERIFIED_RECEIVED',projection_status:'AUTHORITATIVE',payment_id:s(row?.payment_id),deal_ids:asArray(finance?.incomingPaymentAllocations).filter(a=>s(a?.payment_id)===s(row?.payment_id)).map(a=>s(a?.deal_id)).filter(Boolean),amount:n(row?.amount),currency:upper(row?.currency),date:row?.payment_at??null,source_system:s(row?.source_system)||null,source_version:s(row?.source_version)||null,source_timestamp:row?.source_timestamp??null}));
}

export async function enrichOwnerPaymentsSemanticsV3(financeFragment,sql){
  const finance=financeFragment&&typeof financeFragment==='object'?financeFragment:{};
  const explicit=await readExplicitExpectedReceipts(sql);
  const expectedReceiptRows=buildExpectedReceiptRows(finance,explicit);
  const expectedTotals=new Map(),dueTotals=new Map();
  for(const row of expectedReceiptRows){addMoney(expectedTotals,row.currency,row.expected_amount);if(row.bucket==='DUE_NOW'&&row.projection_status==='AUTHORITATIVE')addMoney(dueTotals,row.currency,row.expected_amount)}
  const spend=buildSpend(finance);
  return{...finance,
    ownerPaymentSemanticsContract:'ADMIN_PAYMENTS_OWNER_SEMANTICS_V3',
    expectedReceiptAuthorityContract:'FINANCE_EXPECTED_RECEIPTS_CURRENT_STATE_V1',
    dealActualSpendContract:'FINANCE_DEAL_ACTUAL_SPEND_SOURCE_LOCKED_V1',
    clientPaymentAllocationMeaning:'CREDITED_TO_DEAL_PAYMENT_OBLIGATION_NOT_DEAL_SPEND',
    ownerPaymentsPolicy:{clientReceivedIsDealSpend:false,actualSpendFromOutgoingFinanceFactsOnly:true,nativeCurrencyTotalsOnly:true,syntheticFx:false,grossFxConversionPrincipalIsSpend:false,marginForcedToZero:false,directSourceUseTraceRequired:true},
    financeExpectedReceiptAuthority:explicit,
    ownerReceiptCurrentStateRows:[...receivedRows(finance),...expectedReceiptRows],
    expectedReceiptRows,
    expectedReceiptTotalsByCurrency:[...expectedTotals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),
    dueNowTotalsByCurrency:[...dueTotals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),
    dealActualSpendRows:spend.rows,
    dealActualSpendTotalsByCurrency:spend.totalsByCurrency,
    dealActualSpendTotalsByDealCurrency:spend.totalsByDealCurrency};
}
