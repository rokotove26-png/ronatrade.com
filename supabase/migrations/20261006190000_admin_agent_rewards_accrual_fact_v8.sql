-- Admin Agent Rewards operational/accrual FACT v8
-- Owner-directed DELTA_ONLY.
-- FACT is recognized from approved operational performance, not cash movement.
-- Cash is projected separately as settlement / AR / AP / advance state.
-- No mutation of Payments, Accounting, shipment, supplier settlement, or legal setoff facts.

create or replace function public.rona_admin_agent_rewards_workspace_v7()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_base jsonb;
  v_deals jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_base:=public.rona_admin_agent_rewards_workspace_v6();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  approved_accrual as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as finance_proposal_created_at,
      o.created_at as operations_approval_created_at,
      p.payload->'proposed_value' as fact_value,
      coalesce(p.payload->'evidence_refs','[]'::jsonb) as evidence_refs
    from portal_private.ai_coordination_records p
    join portal_private.ai_coordination_records o
      on o.record_type='OPERATIONS_INTERNAL_DECISION'
     and o.functional_role::text='OPERATIONS_DIRECTOR'
     and o.target_type='DEAL'
     and o.target_id=p.target_id
     and o.status='APPROVE_FOR_NEXT_STAGE'
     and o.payload->>'record_id'=p.record_id::text
    where p.record_type='BUSINESS_CHANGE_PROPOSAL'
      and p.functional_role::text='FINANCE'
      and p.target_type='DEAL'
      and p.status='PROPOSED'
      and p.payload->>'proposed_field'='agent_rewards.fact.accrual_basis_v1'
      and p.payload->>'proposed_action'='MATERIALIZE_AGENT_REWARDS_ACCRUAL_FACT'
      and jsonb_typeof(p.payload->'proposed_value')='object'
    order by p.target_id,p.created_at desc,o.created_at desc
  ),
  shaped as (
    select
      b.item,
      b.deal_id,
      a.finance_proposal_id,
      a.operations_approval_id,
      a.finance_proposal_created_at,
      a.operations_approval_created_at,
      a.fact_value,
      a.evidence_refs,
      coalesce(a.fact_value->>'recognition_status','TO_VERIFY_NO_APPROVED_ACCRUAL_FACT') as recognition_status,
      case
        when a.fact_value->>'recognition_status'='APPROVED_OPERATIONAL_ACCRUAL_FACT'
        then coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'paymentId',e->>'key',
              'counterparty',e->>'label',
              'counterpartyName',e->>'label',
              'paymentKind','COUNTERPARTY_PAYMENT',
              'expenseCategory',e->>'category',
              'nativeAmount',nullif(e->>'native_amount','')::numeric,
              'nativeCurrency',e->>'native_currency',
              'receiptCurrencyEquivalent',nullif(e->>'accounting_amount','')::numeric,
              'receiptCurrency',e->>'accounting_currency',
              'expenseStatus',e->>'status',
              'accrualBasis',e->>'basis',
              'source','APPROVED_OPERATIONAL_ACCRUAL_FACT'
            )
            order by ord
          )
          from jsonb_array_elements(coalesce(a.fact_value->'expense_lines','[]'::jsonb)) with ordinality t(e,ord)
        ),'[]'::jsonb)
        else '[]'::jsonb
      end as accrued_expenses
    from base_deals b
    left join approved_accrual a on a.deal_id=b.deal_id
  )
  select coalesce(
    jsonb_agg(
      case
        when s.finance_proposal_id is null then
          s.item
          || jsonb_build_object(
            'factInputs',
              coalesce(s.item->'factInputs','{}'::jsonb)
              || jsonb_build_object(
                'revenue',null,
                'revenueStatus','TO_VERIFY_NO_APPROVED_ACCRUAL_FACT',
                'actualSpend',null,
                'actualSpendStatus','TO_VERIFY_NO_APPROVED_ACCRUAL_FACT',
                'taxesAndPayments',null,
                'taxesAndPaymentsStatus','TO_VERIFY_NO_APPROVED_ACCRUAL_FACT',
                'fxDifference',null,
                'fxStatus','TO_VERIFY_NO_APPROVED_ACCRUAL_FACT'
              ),
            'expenses','[]'::jsonb,
            'accrualFact',jsonb_build_object(
              'recognition_status','TO_VERIFY_NO_APPROVED_ACCRUAL_FACT',
              'semantics',jsonb_build_object(
                'cash_movement_is_not_revenue_or_expense_by_itself',true,
                'profit_requires_authoritative_operational_performance',true
              )
            ),
            'settlementPositions','[]'::jsonb,
            'conditionalPositions','[]'::jsonb
          )
        when s.recognition_status='APPROVED_OPERATIONAL_ACCRUAL_FACT' then
          s.item
          || jsonb_build_object(
            'financialCurrency',coalesce(nullif(s.fact_value->>'financial_currency',''),s.item->>'financialCurrency'),
            'factInputs',
              coalesce(s.item->'factInputs','{}'::jsonb)
              || jsonb_build_object(
                'revenue',nullif(s.fact_value->'revenue'->>'accrued_amount','')::numeric,
                'revenueStatus','APPROVED_OPERATIONAL_ACCRUAL_FACT',
                'actualSpend',nullif(s.fact_value->>'expense_total','')::numeric,
                'accruedExpenseTotal',nullif(s.fact_value->>'expense_total','')::numeric,
                'actualSpendStatus','APPROVED_ACCRUAL_EXPENSES',
                'expenseStatus','APPROVED_ACCRUAL_EXPENSES',
                'taxesAndPayments',nullif(s.fact_value->>'taxes_and_payments','')::numeric,
                'taxesAndPaymentsStatus','APPROVED_ACCRUAL_TAXES_AND_PAYMENTS',
                'fxDifference',nullif(s.fact_value->>'realized_fx_economic_effect','')::numeric,
                'fxStatus','APPROVED_REALIZED_FX_ECONOMIC_EFFECT',
                'fxSemantics','POSITIVE_IS_ECONOMIC_BENEFIT__NEGATIVE_IS_ECONOMIC_LOSS',
                'cashReceived',nullif(s.fact_value->'revenue'->>'cash_received','')::numeric,
                'cashReceivedCurrency',s.fact_value->>'financial_currency',
                'recognitionStatus',s.recognition_status
              ),
            'expenses',s.accrued_expenses,
            'asIs',
              coalesce(s.item->'asIs','{}'::jsonb)
              || jsonb_build_object(
                'revenue',nullif(s.fact_value->'revenue'->>'accrued_amount','')::numeric,
                'actualSpend',nullif(s.fact_value->>'expense_total','')::numeric,
                'taxesAndPayments',nullif(s.fact_value->>'taxes_and_payments','')::numeric,
                'fxDifference',nullif(s.fact_value->>'realized_fx_economic_effect','')::numeric,
                'recognitionStatus',s.recognition_status
              ),
            'accrualFact',s.fact_value,
            'settlementPositions',coalesce(s.fact_value->'settlement_positions','[]'::jsonb),
            'conditionalPositions',coalesce(s.fact_value->'conditional_positions','[]'::jsonb),
            'accrualAuthority',jsonb_build_object(
              'financeProposalRecordId',s.finance_proposal_id,
              'operationsApprovalRecordId',s.operations_approval_id,
              'financeProposalCreatedAt',s.finance_proposal_created_at,
              'operationsApprovalCreatedAt',s.operations_approval_created_at,
              'evidenceRefs',s.evidence_refs,
              'recognition','OPERATIONAL_ACCRUAL',
              'cashSemantics','SEPARATE_SETTLEMENT_LAYER',
              'mutationSemantics','READ_ONLY_PROJECTION'
            )
          )
        else
          s.item
          || jsonb_build_object(
            'financialCurrency',coalesce(nullif(s.fact_value->>'financial_currency',''),s.item->>'financialCurrency'),
            'factInputs',
              coalesce(s.item->'factInputs','{}'::jsonb)
              || jsonb_build_object(
                'revenue',null,
                'revenueStatus','TO_VERIFY_NO_AUTHORITATIVE_PERFORMANCE_FACT',
                'actualSpend',null,
                'accruedExpenseTotal',null,
                'actualSpendStatus','TO_VERIFY_NO_AUTHORITATIVE_PERFORMANCE_FACT',
                'expenseStatus','TO_VERIFY_NO_AUTHORITATIVE_PERFORMANCE_FACT',
                'taxesAndPayments',null,
                'taxesAndPaymentsStatus','TO_VERIFY_NO_AUTHORITATIVE_PERFORMANCE_FACT',
                'fxDifference',null,
                'fxStatus','TO_VERIFY_NO_AUTHORITATIVE_PERFORMANCE_FACT',
                'cashReceived',
                  case when nullif(s.fact_value->>'cash_received','') is not null
                    then (s.fact_value->>'cash_received')::numeric else null end,
                'cashReceivedCurrency',s.fact_value->>'financial_currency',
                'recognitionStatus',s.recognition_status
              ),
            'expenses','[]'::jsonb,
            'asIs',
              coalesce(s.item->'asIs','{}'::jsonb)
              || jsonb_build_object(
                'revenue',null,
                'actualSpend',null,
                'taxesAndPayments',null,
                'fxDifference',null,
                'recognitionStatus',s.recognition_status
              ),
            'accrualFact',s.fact_value,
            'settlementPositions',coalesce(s.fact_value->'settlement_positions','[]'::jsonb),
            'conditionalPositions',coalesce(s.fact_value->'conditional_positions','[]'::jsonb),
            'accrualAuthority',jsonb_build_object(
              'financeProposalRecordId',s.finance_proposal_id,
              'operationsApprovalRecordId',s.operations_approval_id,
              'financeProposalCreatedAt',s.finance_proposal_created_at,
              'operationsApprovalCreatedAt',s.operations_approval_created_at,
              'evidenceRefs',s.evidence_refs,
              'recognition','FAIL_CLOSED_PENDING_AUTHORITATIVE_PERFORMANCE',
              'cashSemantics','ADVANCE_OR_SETTLEMENT_ONLY_NOT_REVENUE',
              'mutationSemantics','READ_ONLY_PROJECTION'
            )
          )
      end
      order by s.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from shaped s;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V8_ACCRUAL_FACT',
    'factRecognitionContract','FINANCE_ACCRUAL_PROPOSAL_PLUS_OPERATIONS_APPROVAL',
    'factSemantics','OPERATIONAL_ACCRUAL_NOT_CASH',
    'cashSemantics','SEPARATE_SETTLEMENT_LAYER',
    'arApSemantics','ACCRUED_VS_SETTLED_BALANCE',
    'failClosedSemantics','NO_PERFORMANCE_AUTHORITY__NO_FACT_PNL',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v7() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v7() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v7() is
'Admin Agent Rewards P&L v8 operational/accrual FACT. Revenue and expenses come only from approved actual performance; cash is a separate settlement/AR/AP layer. Deals without materialized authoritative performance fail closed and do not reuse plan/cash as FACT P&L.';

create or replace function public.rona_admin_agent_rewards_correct_v5(
  p_deal_id text,
  p_assignment_id uuid,
  p_corrected_payload jsonb,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_deal_key uuid;
  v_version integer;
  v_existing portal_private.agent_reward_owner_corrections_v1%rowtype;
  v_key text;
  v_value jsonb;
  v_expenses jsonb;
  v_accrual_value jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  if btrim(coalesce(p_deal_id,''))='' then raise exception 'DEAL_ID_REQUIRED'; end if;
  if p_assignment_id is null then raise exception 'ASSIGNMENT_ID_REQUIRED'; end if;
  if p_corrected_payload is null or jsonb_typeof(p_corrected_payload)<>'object' then raise exception 'CORRECTION_PAYLOAD_INVALID'; end if;
  if btrim(coalesce(p_idempotency_key,''))='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  for v_key,v_value in select key,value from jsonb_each(p_corrected_payload)
  loop
    if v_key not in ('expenseLines','fxDifference') then
      raise exception 'CORRECTION_FIELD_NOT_ALLOWED:%',v_key;
    end if;
  end loop;

  if p_corrected_payload ? 'fxDifference'
     and jsonb_typeof(p_corrected_payload->'fxDifference') not in ('number','null') then
    raise exception 'CORRECTION_VALUE_NOT_NUMERIC:fxDifference';
  end if;

  v_expenses:=coalesce(p_corrected_payload->'expenseLines','{}'::jsonb);
  if jsonb_typeof(v_expenses)<>'object' then
    raise exception 'CORRECTION_EXPENSE_LINES_INVALID';
  end if;

  select * into v_existing
  from portal_private.agent_reward_owner_corrections_v1
  where idempotency_key=p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object(
      'accepted',true,'idempotentReplay',true,'dealId',p_deal_id,
      'assignmentId',p_assignment_id,'version',v_existing.correction_version
    );
  end if;

  select d.id into v_deal_key
  from portal_private.deals d
  where d.deal_id=p_deal_id
  limit 1;
  if v_deal_key is null then raise exception 'DEAL_NOT_FOUND'; end if;

  perform 1
  from portal_private.agent_client_assignments aca
  join portal_private.agent_persons ap
    on ap.id=aca.agent_person_key and ap.lifecycle_state::text='ACTIVE'
  join portal_private.deals d
    on d.id=v_deal_key and d.client_key=aca.client_key
  where aca.id=p_assignment_id
    and aca.status::text='ACTIVE'
    and aca.lifecycle_state::text='ACTIVE'
    and aca.authority_state::text in ('CONFIRMED','VERIFIED')
    and aca.valid_from<=now()
    and (aca.valid_to is null or aca.valid_to>now())
  limit 1;
  if not found then raise exception 'DEAL_ASSIGNMENT_NOT_IN_AGENT_SCOPE'; end if;

  select p.payload->'proposed_value'
  into v_accrual_value
  from portal_private.ai_coordination_records p
  join portal_private.ai_coordination_records o
    on o.record_type='OPERATIONS_INTERNAL_DECISION'
   and o.functional_role::text='OPERATIONS_DIRECTOR'
   and o.target_type='DEAL'
   and o.target_id=p.target_id
   and o.status='APPROVE_FOR_NEXT_STAGE'
   and o.payload->>'record_id'=p.record_id::text
  where p.record_type='BUSINESS_CHANGE_PROPOSAL'
    and p.functional_role::text='FINANCE'
    and p.target_type='DEAL'
    and p.target_id=p_deal_id
    and p.status='PROPOSED'
    and p.payload->>'proposed_field'='agent_rewards.fact.accrual_basis_v1'
    and p.payload->>'proposed_action'='MATERIALIZE_AGENT_REWARDS_ACCRUAL_FACT'
    and p.payload->'proposed_value'->>'recognition_status'='APPROVED_OPERATIONAL_ACCRUAL_FACT'
  order by p.created_at desc,o.created_at desc
  limit 1;

  if v_accrual_value is null then
    raise exception 'OWNER_CORRECTION_REQUIRES_APPROVED_OPERATIONAL_FACT';
  end if;

  for v_key,v_value in select key,value from jsonb_each(v_expenses)
  loop
    if btrim(coalesce(v_key,''))='' then raise exception 'CORRECTION_EXPENSE_KEY_REQUIRED'; end if;
    if jsonb_typeof(v_value) not in ('number','null') then
      raise exception 'CORRECTION_VALUE_NOT_NUMERIC:%',v_key;
    end if;

    perform 1
    from jsonb_array_elements(coalesce(v_accrual_value->'expense_lines','[]'::jsonb)) e
    where e->>'key'=v_key
    limit 1;
    if not found then
      raise exception 'CORRECTION_EXPENSE_LINE_NOT_ALLOWED:%',v_key;
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtextextended(
    'ADMIN_AGENT_REWARDS_V5:'||p_assignment_id::text||':'||v_deal_key::text,0
  ));

  select coalesce(max(correction_version),0)+1 into v_version
  from portal_private.agent_reward_owner_corrections_v1
  where assignment_id=p_assignment_id and deal_key=v_deal_key;

  insert into portal_private.agent_reward_owner_corrections_v1(
    deal_key,assignment_id,correction_version,corrected_payload,note,created_by,idempotency_key
  ) values (
    v_deal_key,p_assignment_id,v_version,p_corrected_payload,
    nullif(btrim(coalesce(p_note,'')),''),v_actor,p_idempotency_key
  );

  return jsonb_build_object(
    'accepted',true,'idempotentReplay',false,'dealId',p_deal_id,
    'assignmentId',p_assignment_id,'version',v_version,
    'correctedPayload',p_corrected_payload,
    'correctionContract','APPROVED_ACCRUAL_EXPENSE_LINES_PLUS_FX_ONLY'
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_correct_v5(text,uuid,jsonb,text,text) from public,anon;
grant execute on function public.rona_admin_agent_rewards_correct_v5(text,uuid,jsonb,text,text) to authenticated;

comment on function public.rona_admin_agent_rewards_correct_v5(text,uuid,jsonb,text,text) is
'Owner correction v5 for Agent Rewards accrual FACT. Accepts only expenseLines keys present in the latest Finance+Operations approved operational accrual proposal and fxDifference. Revenue, expense total, taxes/payments, result, agent reward and RONA profit remain computed/read-only.';
