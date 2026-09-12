// @ts-nocheck

const OWNER_FINANCE_CANON_ID='d6429144-5a12-4a9e-a57e-7d9e345f94a3';
const asArray=value=>Array.isArray(value)?value:[];
const s=value=>String(value??'').trim();
const upper=value=>s(value).toUpperCase();
const n=value=>{const x=Number(value);return Number.isFinite(x)?x:null};
const round=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000;
const ACTIVE_AUTHORITY=new Set(['CONFIRMED','VERIFIED']);
const HANDOFF_STATES=new Set(['READY','SENT']);

function addMoney(map,currency,amount){const c=upper(currency),v=n(amount);if(!c||v===null||v<0)return;const row=map.get(c)||{currency:c,amount:0};row.amount=round(row.amount+v);map.set(c,row)}
function sourceLockedOutgoing(row){return !!(s(row?.fact_id)&&n(row?.amount)!==null&&n(row?.amount)>=0&&upper(row?.currency)&&upper(row?.bank_fact_status)==='BANK_CONFIRMED'&&upper(row?.authority_state)==='CONFIRMED'&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')&&s(row?.source_document)&&s(row?.source_version)&&row?.source_timestamp)}
function category(row){const flow=upper(row?.flow_kind),hay=upper([row?.beneficiary_role,row?.beneficiary_name,row?.purpose].filter(Boolean).join(' '));if(flow==='BANK_FEE')return'BANK_FEE';if(/ЛОГИСТ|ЭКСПЕД|ЖД|ВАГОН|ПЕРЕВОЗ|RAIL|LOGISTIC|FORWARD|TRANSPORT/.test(hay))return'LOGISTICS_FORWARDING';if(flow==='COUNTERPARTY_PAYMENT')return'SUPPLIER_COUNTERPARTY';return'OTHER_CONFIRMED'}
function categoryLabel(v){return({SUPPLIER_COUNTERPARTY:'Поставщику / контрагенту',LOGISTICS_FORWARDING:'Логистика / экспедирование',BANK_FEE:'Банковские комиссии',OTHER_CONFIRMED:'Прочие подтвержденные расходы'}[v]||v)}

async function readOwnerFinanceCanon(sql){
  if(typeof sql!=='function')return null;
  const rows=await sql`select record_id,record_type,functional_role::text functional_role,target_type,target_id,status,version,payload,source_refs,created_at from portal_private.ai_coordination_records where record_id=${OWNER_FINANCE_CANON_ID}::uuid and qa_only=false limit 1`;
  const row=rows?.[0]||null;if(!row)return null;
  return{...row,source_locked:row.record_type==='FUNCTIONAL_CONCLUSION'&&row.functional_role==='FINANCE'&&row.status==='APPROVED'&&row.payload?.confirmed===true};
}
async function readPaymentContour(sql){
  if(typeof sql!=='function')return[];
  return await sql`select d.deal_id,d.id deal_key,w.payment_handoff_state,w.payment_handoff_at from portal_private.deals d join portal_private.owner_deal_workflow w on w.deal_key=d.id where d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and d.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum) and w.payment_handoff_state in ('READY','SENT') order by d.deal_id`;
}
async function readExplicitExpected(sql){
  if(typeof sql!=='function')return[];
  return await sql`
    with finance_current as (
      select p.record_id proposal_record_id,p.target_id deal_id,p.payload->'proposed_state' state,p.created_at proposal_created_at,p.evidence_refs proposal_evidence_refs,
             c.record_id conclusion_record_id,c.created_at conclusion_created_at,c.status conclusion_status,c.source_refs conclusion_source_refs
      from portal_private.ai_coordination_records p
      join lateral (
        select c.* from portal_private.ai_coordination_records c
        where c.target_type='DEAL' and c.target_id=p.target_id and c.functional_role::text='FINANCE' and c.record_type='FUNCTIONAL_CONCLUSION'
          and c.status in ('APPROVED','APPROVED_WITH_CONDITIONS') and c.qa_only=false and coalesce((c.payload->>'confirmed')::boolean,false)=true
          and (coalesce(p.evidence_refs,'[]'::jsonb) @> to_jsonb(array['FINANCE_CONCLUSION:'||c.record_id::text]::text[])
            or coalesce(p.payload->'evidence_refs','[]'::jsonb) @> to_jsonb(array['FINANCE_CONCLUSION:'||c.record_id::text]::text[]))
        order by c.version desc,c.created_at desc limit 1
      ) c on true
      where p.target_type='DEAL' and p.functional_role::text='FINANCE' and p.record_type='BUSINESS_CHANGE_PROPOSAL' and p.status='PROPOSED' and p.qa_only=false
        and p.payload->>'proposed_action'='UPSERT_OWNER_EXPECTED_RECEIPT_PROJECTION' and jsonb_typeof(p.payload->'proposed_state')='object'
    )
    select distinct on (deal_id) deal_id,upper(nullif(btrim(state->>'currency'),'')) currency,
      coalesce(nullif(state->>'verified_client_received','')::numeric,0) verified_received,
      coalesce(nullif(state->>'due_now','')::numeric,0) due_now,
      coalesce(nullif(state->>'expected_not_due','')::numeric,0) expected_not_due,
      nullif(state->>'next_expected_payment','')::numeric next_expected_payment,
      nullif(state->>'future_conditional_balance','')::numeric future_conditional_balance,
      nullif(btrim(state->>'projection_status'),'') projection_status,nullif(btrim(state->>'finance_status'),'') finance_status,
      nullif(btrim(state->>'document_dispatch_status'),'') document_dispatch_status,
      proposal_record_id,conclusion_record_id,greatest(proposal_created_at,conclusion_created_at) source_timestamp,
      coalesce(proposal_evidence_refs,'[]'::jsonb)||coalesce(conclusion_source_refs,'[]'::jsonb) source_refs
    from finance_current order by deal_id,proposal_created_at desc,conclusion_created_at desc`;
}
async function readOwnerOutgoingDecisions(sql){
  if(typeof sql!=='function')return[];
  const rel=await sql`select to_regclass('portal_private.owner_outgoing_payment_decisions_v5')::text rel`;if(!rel?.[0]?.rel)return[];
  return await sql`select d.id,d.payment_id,d.decision_type,d.deal_id,d.actor_user_id,d.authority_state,d.lifecycle_state,d.source_system,d.source_version,d.source_timestamp,d.idempotency_key,d.supersedes_id,
    p.payment_at,p.amount,p.currency,p.payment_kind::text payment_kind,p.bank_fact_status::text bank_fact_status,p.finance_verification_status::text finance_verification_status,
    p.counterparty_name,p.counterparty_role,p.original_payment_purpose,p.bank_transaction_reference
    from portal_private.owner_outgoing_payment_decisions_v5 d join portal_private.payments p on p.id=d.payment_key
    where d.authority_state='CONFIRMED' and d.lifecycle_state='ACTIVE' order by p.payment_at,d.payment_id`;
}
async function readUsdExecutionLinks(sql){
  if(typeof sql!=='function')return[];
  const rel=await sql`select to_regclass('portal_private.finance_deal_execution_usd_links_v5')::text rel`;if(!rel?.[0]?.rel)return[];
  return await sql`select l.id,l.deal_id,l.usd_source_payment_id,l.execution_payment_id,l.usd_amount,l.native_amount,l.native_currency,l.execution_state,l.obligation_reference,
    l.bank_source_reference,l.treasury_source_reference,l.source_system,l.source_version,l.source_timestamp,l.supersedes_link_id
    from portal_private.finance_deal_execution_usd_links_v5 l
    where l.authority_state='CONFIRMED' and l.lifecycle_state='ACTIVE' and not exists(select 1 from portal_private.finance_deal_execution_usd_links_v5 x where x.supersedes_link_id=l.id and x.authority_state='CONFIRMED' and x.lifecycle_state='ACTIVE')
    order by l.deal_id,l.source_timestamp,l.id`;
}

function summaryMap(finance){const map=new Map();for(const row of [...asArray(finance?.dealFinanceCurrentState),...asArray(finance?.dealFinanceSummaries)]){const id=s(row?.deal_id);if(id&&!map.has(id))map.set(id,row)}return map}
function expectedRow(args){return{deal_id:args.dealId,client_id:args.summary?.client_id??null,client_name:args.summary?.client_name??null,currency:upper(args.currency),expected_amount:round(args.amount),bucket:args.bucket,projection_status:args.projectionStatus,finance_status:args.financeStatus??args.summary?.finance_status??null,document_dispatch_status:args.documentDispatchStatus??null,next_expected_payment:n(args.nextExpectedPayment),future_conditional_balance:n(args.futureConditionalBalance),source_kind:args.sourceKind,source_version:args.sourceVersion??null,source_timestamp:args.sourceTimestamp??null,source_refs:[...new Set([...asArray(args.sourceRefs),`FINANCE_CONCLUSION:${OWNER_FINANCE_CANON_ID}`])],proposal_record_id:args.proposalRecordId??null,conclusion_record_id:args.conclusionRecordId??null,payment_handoff_state:args.handoffState??null}}
function buildExpected(finance,explicit,contour){
  const summaries=summaryMap(finance),rows=[],explicitDeals=new Set(),members=new Map(asArray(contour).map(x=>[s(x.deal_id),x]));
  for(const src of explicit){const dealId=s(src?.deal_id),member=members.get(dealId),currency=upper(src?.currency),summary=summaries.get(dealId)||null;if(!dealId||!member||!HANDOFF_STATES.has(upper(member.payment_handoff_state))||!currency)continue;explicitDeals.add(dealId);const toVerify=upper(src?.projection_status).includes('TO_VERIFY'),due=Math.max(0,n(src?.due_now)??0),future=Math.max(0,n(src?.expected_not_due)??0),next=n(src?.next_expected_payment),common={dealId,summary,currency,projectionStatus:toVerify?'TO_VERIFY':'AUTHORITATIVE',financeStatus:src?.finance_status,sourceKind:'FINANCE_EXPECTED_RECEIPT_CURRENT_STATE',sourceVersion:`PROPOSAL:${src.proposal_record_id}`,sourceTimestamp:src?.source_timestamp,sourceRefs:src?.source_refs,proposalRecordId:src?.proposal_record_id,conclusionRecordId:src?.conclusion_record_id,documentDispatchStatus:src?.document_dispatch_status,nextExpectedPayment:next,futureConditionalBalance:src?.future_conditional_balance,handoffState:member.payment_handoff_state};if(due>0)rows.push(expectedRow({...common,amount:due,bucket:'DUE_NOW'}));if(future>0)rows.push(expectedRow({...common,amount:future,bucket:'EXPECTED_NOT_DUE'}));if(due===0&&future===0&&next!==null&&next>0)rows.push(expectedRow({...common,amount:next,bucket:'EXPECTED_NOT_DUE',projectionStatus:'TO_VERIFY'}))}
  for(const schedule of asArray(finance?.dealFinanceCurrentState)){const dealId=s(schedule?.deal_id),member=members.get(dealId);if(!dealId||!member||!HANDOFF_STATES.has(upper(member.payment_handoff_state))||explicitDeals.has(dealId)||upper(schedule?.payment_schedule_projection_status)!=='AUTHORITATIVE')continue;const currency=upper(schedule?.currency),due=Math.max(0,n(schedule?.current_due_amount)??0),future=Math.max(0,n(schedule?.deferred_not_due_amount)??0);if(!currency)continue;const prov=asArray(finance?.paymentSchedules).find(x=>s(x?.dealId)===dealId)||{},common={dealId,summary:schedule,currency,projectionStatus:'AUTHORITATIVE',financeStatus:schedule?.finance_status,sourceKind:'FINANCE_PAYMENT_SCHEDULE_CURRENT_STATE',sourceVersion:prov?.sourceVersion,sourceTimestamp:prov?.sourceTimestamp,sourceRefs:prov?.sourceRefs,nextExpectedPayment:null,futureConditionalBalance:null,handoffState:member.payment_handoff_state};if(due>0)rows.push(expectedRow({...common,amount:due,bucket:'DUE_NOW'}));if(future>0)rows.push(expectedRow({...common,amount:future,bucket:'EXPECTED_NOT_DUE'}))}
  return rows.sort((a,b)=>a.deal_id.localeCompare(b.deal_id)||a.bucket.localeCompare(b.bucket));
}
function activeAllocations(finance,contourSet){return asArray(finance?.incomingPaymentAllocations).filter(row=>contourSet.has(s(row?.deal_id))&&upper(row?.allocation_status)==='VERIFIED'&&(!row?.lifecycle_state||upper(row.lifecycle_state)==='ACTIVE')&&(!row?.authority_state||ACTIVE_AUTHORITY.has(upper(row.authority_state))))}
function buildControlRows(finance,contour,expected){
  const members=new Map(asArray(contour).map(x=>[s(x.deal_id),x])),contourSet=new Set(members.keys()),summaries=summaryMap(finance),allocs=activeAllocations(finance,contourSet),receivedByDeal=new Map();for(const a of allocs){const key=s(a.deal_id)+'\u0000'+upper(a.currency);receivedByDeal.set(key,round((receivedByDeal.get(key)||0)+(n(a.allocated_amount)||0)))}
  const expectedByDeal=new Map();for(const x of expected){const key=s(x.deal_id)+'\u0000'+upper(x.currency),r=expectedByDeal.get(key)||{expected:0,due:0,deferred:0,toVerify:false};r.expected=round(r.expected+(n(x.expected_amount)||0));if(upper(x.bucket)==='DUE_NOW')r.due=round(r.due+(n(x.expected_amount)||0));if(upper(x.bucket)==='EXPECTED_NOT_DUE')r.deferred=round(r.deferred+(n(x.expected_amount)||0));if(upper(x.projection_status)==='TO_VERIFY')r.toVerify=true;expectedByDeal.set(key,r)}
  const rows=[];for(const [dealId,member] of members){const summary=summaries.get(dealId);if(!summary)continue;const currency=upper(summary.currency),obligation=n(summary.obligation_amount),received=receivedByDeal.get(dealId+'\u0000'+currency)??n(summary.verified_received_amount)??0,exp=expectedByDeal.get(dealId+'\u0000'+currency)||{expected:0,due:0,deferred:0,toVerify:false};rows.push({deal_id:dealId,client_id:summary.client_id??null,client_name:summary.client_name??null,currency,total_to_receive_amount:obligation,verified_received_amount:round(received),expected_amount:round(exp.expected),due_now_amount:round(exp.due),deferred_not_due_amount:round(exp.deferred),remaining_obligation_amount:obligation===null?null:round(Math.max(0,obligation-received)),projection_status:exp.toVerify?'TO_VERIFY':'AUTHORITATIVE',management_currency:'USD',management_usd_status:currency==='USD'?'AUTHORITATIVE':'TO_VERIFY',payment_handoff_state:member.payment_handoff_state})}
  return rows.sort((a,b)=>a.deal_id.localeCompare(b.deal_id));
}

function buildBankEvidence(finance,ownerDecisions,contourSet){
  const confirmed=[],toVerify=[];
  for(const src of asArray(finance?.outgoingPayments)){if(!sourceLockedOutgoing(src)||upper(src?.flow_kind)==='FX_CONVERSION')continue;const dealIds=[...new Set(asArray(src?.deal_ids).map(s).filter(Boolean))].filter(id=>contourSet.has(id));for(const dealId of dealIds){const row={deal_id:dealId,payment_id:s(src.fact_id),payment_at:src.payment_at??null,recipient:s(src.beneficiary_name)||null,recipient_role:s(src.beneficiary_role)||null,amount:n(src.amount),currency:upper(src.currency),category:category(src),category_label:categoryLabel(category(src)),purpose:s(src.purpose)||null,bank_document:s(src.bank_document)||null,bank_fact_status:'BANK_CONFIRMED',source_document:s(src.source_document),source_version:s(src.source_version),source_timestamp:src.source_timestamp??null,authority_type:'FINANCE_SOURCE_LOCKED_OUTGOING'};if(upper(src.deal_allocation_status)==='CONFIRMED')confirmed.push(row);else if(upper(src.deal_allocation_status)==='TO_VERIFY')toVerify.push({...row,management_usd_status:'TO_VERIFY',reason:'DEAL_ATTRIBUTION_TO_VERIFY'})}}
  for(const d of ownerDecisions){if(upper(d?.decision_type)!=='DEAL_BINDING'||!contourSet.has(s(d?.deal_id))||upper(d?.bank_fact_status)!=='BANK_CONFIRMED'||upper(d?.finance_verification_status)!=='VERIFIED')continue;confirmed.push({deal_id:s(d.deal_id),payment_id:s(d.payment_id),payment_at:d.payment_at??null,recipient:s(d.counterparty_name)||null,recipient_role:s(d.counterparty_role)||null,amount:n(d.amount),currency:upper(d.currency),category:upper(d.payment_kind)==='BANK_FEE'?'BANK_FEE':'SUPPLIER_COUNTERPARTY',category_label:upper(d.payment_kind)==='BANK_FEE'?'Банковские комиссии':'Поставщику / контрагенту',purpose:s(d.original_payment_purpose)||null,bank_document:s(d.bank_transaction_reference)||null,bank_fact_status:'BANK_CONFIRMED',source_document:'OWNER_AUTHORIZED_DEAL_BINDING',source_version:s(d.source_version),source_timestamp:d.source_timestamp??null,authority_type:'OWNER_AUTHORIZED_DEAL_BINDING'})}
  return{confirmed,toVerify};
}
function validateUsdLinks(finance,links,evidence,contourSet){
  const payments=new Map(asArray(finance?.payments).map(p=>[s(p.payment_id),p])),sourceUse=new Map(),candidate=[];
  for(const link of links){const dealId=s(link.deal_id),sourceId=s(link.usd_source_payment_id),usd=n(link.usd_amount),native=n(link.native_amount),nativeCurrency=upper(link.native_currency),state=upper(link.execution_state),source=payments.get(sourceId);let valid=contourSet.has(dealId)&&usd!==null&&usd>0&&source&&upper(source.payment_direction)==='OUTGOING'&&upper(source.payment_kind)==='FX_CONVERSION'&&upper(source.currency)==='USD'&&upper(source.bank_fact_status)==='BANK_CONFIRMED'&&upper(source.finance_verification_status)==='VERIFIED'&&n(source.amount)!==null&&s(link.source_system)==='FINANCE_TREASURY_EXECUTION_SOURCE_LOCK'&&s(link.source_version)&&link.source_timestamp;if(state==='COMPLETED'){const executionId=s(link.execution_payment_id);const detail=evidence.confirmed.find(x=>s(x.deal_id)===dealId&&s(x.payment_id)===executionId);valid=valid&&!!detail&&native!==null&&native>0&&nativeCurrency===upper(detail?.currency)&&native<=Number(detail?.amount)+1e-6}else if(state==='CONVERTED_EXECUTION_PENDING'){valid=valid&&!s(link.execution_payment_id)&&!!s(link.obligation_reference)}else valid=false;candidate.push({...link,deal_id:dealId,usd_source_payment_id:sourceId,usd_amount:usd,native_amount:native,native_currency:nativeCurrency,execution_state:state,valid});if(valid)sourceUse.set(sourceId,round((sourceUse.get(sourceId)||0)+usd))}
  for(const row of candidate){if(!row.valid)continue;const source=payments.get(row.usd_source_payment_id);if((sourceUse.get(row.usd_source_payment_id)||0)>Number(source.amount)+1e-6)row.valid=false}
  return candidate;
}
function buildSpend(finance,ownerDecisions,links,contour){
  const contourSet=new Set(asArray(contour).map(x=>s(x.deal_id))),evidence=buildBankEvidence(finance,ownerDecisions,contourSet),validated=validateUsdLinks(finance,links,evidence,contourSet),completedLinks=validated.filter(x=>x.valid&&x.execution_state==='COMPLETED'),pendingLinks=validated.filter(x=>x.valid&&x.execution_state==='CONVERTED_EXECUTION_PENDING');
  const completedByExecution=new Map();for(const l of completedLinks){const key=l.deal_id+'\u0000'+s(l.execution_payment_id);const r=completedByExecution.get(key)||{usd_amount:0,links:[]};r.usd_amount=round(r.usd_amount+l.usd_amount);r.links.push(l);completedByExecution.set(key,r)}
  const detailRows=[],dealTotals=new Map();let totalUsd=0,hasToVerify=false;
  for(const row of evidence.confirmed){const key=s(row.deal_id)+'\u0000'+s(row.payment_id),link=completedByExecution.get(key);let usd=null,status='TO_VERIFY',sourceKind='NO_EXACT_USD_EXECUTION_LINK';if(upper(row.currency)==='USD'){usd=n(row.amount);status='AUTHORITATIVE';sourceKind='DIRECT_BANK_USD_OUTFLOW'}else if(link){usd=link.usd_amount;status='AUTHORITATIVE';sourceKind='FINANCE_TREASURY_EXECUTION_LINK'}else hasToVerify=true;if(status==='AUTHORITATIVE'&&usd!==null){totalUsd=round(totalUsd+usd);dealTotals.set(s(row.deal_id),round((dealTotals.get(s(row.deal_id))||0)+usd))}detailRows.push({...row,management_usd_amount:usd,management_usd_status:status,management_usd_source:sourceKind,usd_execution_links:link?.links||[]})}
  for(const row of evidence.toVerify){detailRows.push({...row,management_usd_amount:null,management_usd_status:'TO_VERIFY',management_usd_source:'DEAL_ATTRIBUTION_TO_VERIFY'});hasToVerify=true}
  const pendingRows=pendingLinks.map(l=>({deal_id:l.deal_id,usd_source_payment_id:l.usd_source_payment_id,usd_amount:l.usd_amount,native_amount:l.native_amount,native_currency:l.native_currency,obligation_reference:l.obligation_reference,status:'CONVERTED_EXECUTION_NOT_COMPLETED',bank_source_reference:l.bank_source_reference,treasury_source_reference:l.treasury_source_reference,source_version:l.source_version,source_timestamp:l.source_timestamp}));
  const pendingByDeal=new Map();for(const p of pendingRows)pendingByDeal.set(p.deal_id,round((pendingByDeal.get(p.deal_id)||0)+p.usd_amount));
  const toVerifyByDeal=new Set(detailRows.filter(x=>x.management_usd_status==='TO_VERIFY').map(x=>s(x.deal_id)));
  return{detailRows:detailRows.sort((a,b)=>s(a.deal_id).localeCompare(s(b.deal_id))||String(a.payment_at).localeCompare(String(b.payment_at))),pendingRows,totalUsd,hasToVerify,dealTotals,pendingByDeal,toVerifyByDeal,validatedLinks:validated};
}
function buildDealPassports(finance,control,spend){
  const allocs=asArray(finance?.incomingPaymentAllocations);return control.map(c=>{const receipts=allocs.filter(a=>s(a.deal_id)===c.deal_id&&upper(a.allocation_status)==='VERIFIED'&&(!a.lifecycle_state||upper(a.lifecycle_state)==='ACTIVE')&&(!a.authority_state||ACTIVE_AUTHORITY.has(upper(a.authority_state))));const receivedUsd=c.currency==='USD'?n(c.verified_received_amount):null,actual=spend.dealTotals.get(c.deal_id)||0,pending=spend.pendingByDeal.get(c.deal_id)||0,toVerify=spend.toVerifyByDeal.has(c.deal_id)||c.currency!=='USD',remaining=receivedUsd===null||toVerify?null:round(Math.max(0,receivedUsd-actual));return{...c,management_currency:'USD',verified_received_usd:receivedUsd,actual_spend_usd:actual,actual_spend_usd_status:toVerify?'TO_VERIFY':'AUTHORITATIVE',converted_execution_pending_usd:pending,remaining_unexecuted_usd:remaining,receipts,spend_details:spend.detailRows.filter(x=>s(x.deal_id)===c.deal_id),converted_pending:spend.pendingRows.filter(x=>s(x.deal_id)===c.deal_id)}})}

function activeIncomingTotals(finance){const map=new Map();for(const row of asArray(finance?.incomingPaymentAllocations)){if(upper(row?.allocation_status)!=='VERIFIED'||(row?.lifecycle_state&&upper(row.lifecycle_state)!=='ACTIVE')||(row?.authority_state&&!ACTIVE_AUTHORITY.has(upper(row.authority_state))))continue;const key=s(row.payment_id)+'\u0000'+upper(row.currency);map.set(key,round((map.get(key)||0)+(n(row.allocated_amount)||0)))}return map}
function buildUnallocated(finance,ownerDecisions){const incomingTotals=activeIncomingTotals(finance),activeDecision=new Map(ownerDecisions.map(d=>[s(d.payment_id),d])),unresolved=[],advances=[];for(const p of asArray(finance?.payments)){const id=s(p.payment_id),direction=upper(p.payment_direction),kind=upper(p.payment_kind),currency=upper(p.currency),amount=n(p.amount);if(!id||amount===null||amount<=0||!currency||upper(p.bank_fact_status)!=='BANK_CONFIRMED'||upper(p.finance_verification_status)!=='VERIFIED'||upper(p.deal_allocation_applicability)!=='DEAL_ALLOCATABLE'||(p.lifecycle_state&&upper(p.lifecycle_state)!=='ACTIVE')||(p.authority_state&&!ACTIVE_AUTHORITY.has(upper(p.authority_state))))continue;if(direction==='INCOMING'&&kind==='CLIENT_PAYMENT'){const allocated=incomingTotals.get(id+'\u0000'+currency)||0,residue=round(amount-allocated);if(residue>0)unresolved.push({payment_id:id,payment_at:p.payment_at,direction,kind,amount,currency,allocated_total:allocated,unallocated_residue:residue,counterparty_name:s(p.counterparty_name)||s(p.payer_name)||null,counterparty_role:s(p.counterparty_role)||'CLIENT',purpose:s(p.original_payment_purpose)||null,bank_reference:s(p.bank_transaction_reference)||null,owner_actions:['DEAL_BINDING'],owner_action_required:true})}else if(direction==='OUTGOING'&&(kind==='COUNTERPARTY_PAYMENT'||kind==='BANK_FEE')){const decision=activeDecision.get(id);if(decision){if(upper(decision.decision_type)==='ADVANCE_PAYMENT')advances.push({payment_id:id,payment_at:p.payment_at,amount,currency,counterparty_name:s(p.counterparty_name)||s(p.beneficiary_name)||null,purpose:s(p.original_payment_purpose)||null,owner_status:'Авансовый платеж',decision_id:decision.id,source_timestamp:decision.source_timestamp});continue}unresolved.push({payment_id:id,payment_at:p.payment_at,direction,kind,amount,currency,allocated_total:0,unallocated_residue:amount,counterparty_name:s(p.counterparty_name)||s(p.beneficiary_name)||null,counterparty_role:s(p.counterparty_role)||null,purpose:s(p.original_payment_purpose)||null,bank_reference:s(p.bank_transaction_reference)||null,owner_actions:kind==='BANK_FEE'?['DEAL_BINDING']:['DEAL_BINDING','ADVANCE_PAYMENT'],owner_action_required:true})}}return{unresolved:unresolved.sort((a,b)=>String(b.payment_at).localeCompare(String(a.payment_at))),advances}}

export async function enrichOwnerPaymentsOwnerFinalV5(financeFragment,sql){
  const finance=financeFragment&&typeof financeFragment==='object'?financeFragment:{};
  const [canon,contour,explicit,ownerDecisions,usdLinks]=await Promise.all([readOwnerFinanceCanon(sql),readPaymentContour(sql),readExplicitExpected(sql),readOwnerOutgoingDecisions(sql),readUsdExecutionLinks(sql)]);
  const expected=buildExpected(finance,explicit,contour),control=buildControlRows(finance,contour,expected),spend=buildSpend(finance,ownerDecisions,usdLinks,contour),passports=buildDealPassports(finance,control,spend),unalloc=buildUnallocated(finance,ownerDecisions);
  const expectedTotals=new Map(),dueTotals=new Map(),deferredTotals=new Map(),totalToReceive=new Map(),verifiedReceived=new Map();for(const x of expected){addMoney(expectedTotals,x.currency,x.expected_amount);if(x.bucket==='DUE_NOW')addMoney(dueTotals,x.currency,x.expected_amount);if(x.bucket==='EXPECTED_NOT_DUE')addMoney(deferredTotals,x.currency,x.expected_amount)}for(const x of control){if(x.total_to_receive_amount!==null)addMoney(totalToReceive,x.currency,x.total_to_receive_amount);addMoney(verifiedReceived,x.currency,x.verified_received_amount)}
  const receiptTotals=new Map();for(const a of activeAllocations(finance,new Set(contour.map(x=>s(x.deal_id)))))addMoney(receiptTotals,a.currency,a.allocated_amount);
  return{...finance,
    ownerPaymentSemanticsContract:'ADMIN_PAYMENTS_CANONICAL_OWNER_WORKFLOW_V4',
    ownerFinanceCanon:{record_id:canon?.record_id??OWNER_FINANCE_CANON_ID,status:canon?.source_locked?'AUTHORITATIVE':'TO_VERIFY',version:canon?.version??null,source_refs:canon?.source_refs??[],created_at:canon?.created_at??null},
    paymentContourAuthorityContract:'EXISTING_OWNER_DEAL_WORKFLOW_PAYMENT_HANDOFF_V1',
    managementCurrency:'USD',
    ownerPaymentsPurpose:['CONTROL_RECEIPTS','DEAL_PAYMENT_PASSPORT','OWNER_DECISION_REQUIRED_PAYMENTS'],
    ownerPaymentsPolicy:{upstreamLifecycleReadOnly:true,clientReceivedIsDealSpend:false,factualUsdOnly:true,nativeCurrencyDetailOnly:true,syntheticFx:false,fxPrincipalDoubleCount:false,convertedNotPaidIsActualSpend:false,autoDealBinding:false,proportionalSplit:false,aiGuessedDeal:false,autoAdvanceStatus:false,ownerOnlyAuthorization:true},
    paymentContourMembership:contour.map(x=>({deal_id:s(x.deal_id),payment_handoff_state:s(x.payment_handoff_state),payment_handoff_at:x.payment_handoff_at??null})),paymentContourDealIds:contour.map(x=>s(x.deal_id)).filter(Boolean),
    financeExpectedReceiptAuthority:explicit,expectedReceiptRows:expected,dealPaymentControlRows:control,dealPaymentPassports:passports,
    totalToReceiveTotalsByCurrency:[...totalToReceive.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),verifiedReceivedTotalsByCurrency:[...verifiedReceived.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),clientReceiptTotalsByCurrency:[...receiptTotals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),expectedReceiptTotalsByCurrency:[...expectedTotals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),dueNowTotalsByCurrency:[...dueTotals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),deferredNotDueTotalsByCurrency:[...deferredTotals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),
    dealActualSpendRows:spend.detailRows,dealActualSpendUsdTotal:{currency:'USD',amount:spend.totalUsd,status:spend.hasToVerify?'TO_VERIFY':'AUTHORITATIVE'},dealActualSpendUsdByDeal:passports.map(p=>({deal_id:p.deal_id,currency:'USD',amount:p.actual_spend_usd,status:p.actual_spend_usd_status})),convertedExecutionPendingRows:spend.pendingRows,financeUsdExecutionLinks:spend.validatedLinks,
    unallocatedPaymentRows:unalloc.unresolved,ownerAdvancePaymentRows:unalloc.advances,ownerOutgoingPaymentDecisions:ownerDecisions,
    ownerMutationContracts:{incoming:'OWNER_CLIENT_PAYMENT_ALLOCATION_V5_AUTHENTICATED',outgoing:'OWNER_OUTGOING_PAYMENT_DECISION_V5_AUTHENTICATED'}};
}
