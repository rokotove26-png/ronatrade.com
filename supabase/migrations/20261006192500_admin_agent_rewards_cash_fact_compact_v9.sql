-- Admin Agent Rewards compact cash-flow FACT v9
-- Owner-directed DELTA_ONLY after UAT.
-- FACT display is DDS/cash-flow only. Accrual evidence remains available for Owner Control and settlement balances.
-- AR/AP/advances are separate compact balances, outside FACT.
-- No mutation of Payments, Accounting, Shipment, supplier settlement, or legal facts.

create or replace function public.rona_admin_agent_rewards_workspace_v8()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_actor uuid;
  v_accrual jsonb;
  v_cash jsonb;
  v_deals jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  v_accrual:=public.rona_admin_agent_rewards_workspace_v7();
  v_cash:=public.rona_admin_agent_rewards_workspace_v6();

  with accrual_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_accrual->'deals','[]'::jsonb))
  ),
  cash_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_cash->'deals','[]'::jsonb))
  ),
  approved_presentation as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as finance_proposal_created_at,
      o.created_at as operations_approval_created_at,
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
      and p.payload->>'proposed_field'='agent_rewards.fact.presentation_semantics_v2'
      and p.payload->>'proposed_action'='MATERIALIZE_AGENT_REWARDS_CASH_FACT_SEPARATE_AR_AP'
      and jsonb_typeof(p.payload->'proposed_value')='object'
      and p.payload->'proposed_value'->>'fact_mode'='CASH_FLOW_DDS'
    order by p.target_id,p.created_at desc,o.created_at desc
  ),
  shaped as (
    select
      a.item,
      a.deal_id,
      c.item as cash_item,
      p.finance_proposal_id,
      p.operations_approval_id,
      p.finance_proposal_created_at,
      p.operations_approval_created_at,
      p.evidence_refs,
      coalesce(nullif(c.item->>'financialCurrency',''),nullif(c.item->>'receiptCurrency','')) as cash_currency,
      nullif(c.item->'factInputs'->>'cashReceived','')::numeric as cash_received,
      nullif(c.item->'factInputs'->>'actualSpend','')::numeric as total_cash_out,
      nullif(c.item->'factInputs'->>'fxDifference','')::numeric as realized_fx,
      (
        select sum((x->>'receiptCurrencyEquivalent')::numeric)
        from jsonb_array_elements(coalesce(c.item->'expenses','[]'::jsonb)) x
        where upper(coalesce(x->>'paymentKind',''))='COUNTERPARTY_PAYMENT'
          and nullif(x->>'receiptCurrencyEquivalent','') is not null
          and coalesce(x->>'receiptCurrency','')=
              coalesce(nullif(c.item->>'financialCurrency',''),nullif(c.item->>'receiptCurrency',''),'')
      ) as counterpart_cash_out_raw,
      (
        select sum((x->>'receiptCurrencyEquivalent')::numeric)
        from jsonb_array_elements(coalesce(c.item->'expenses','[]'::jsonb)) x
        where upper(coalesce(x->>'paymentKind',''))='BANK_FEE'
          and nullif(x->>'receiptCurrencyEquivalent','') is not null
          and coalesce(x->>'receiptCurrency','')=
              coalesce(nullif(c.item->>'financialCurrency',''),nullif(c.item->>'receiptCurrency',''),'')
      ) as bank_fee_cash_out_raw
    from accrual_deals a
    left join cash_deals c on c.deal_id=a.deal_id
    left join approved_presentation p on p.deal_id=a.deal_id
  )
  select coalesce(
    jsonb_agg(
      s.item
      || jsonb_build_object(
        'cashFlow',jsonb_build_object(
          'status',
            case when s.finance_proposal_id is null
              then 'TO_VERIFY_PRESENTATION_AUTHORITY'
              else 'APPROVED_CASH_FLOW_DDS'
            end,
          'currency',s.cash_currency,
          'cashReceived',
            case when s.finance_proposal_id is null then null else s.cash_received end,
          'counterpartyCashOut',
            case
              when s.finance_proposal_id is null then null
              when s.total_cash_out is null then null
              else coalesce(s.counterpart_cash_out_raw,0)
            end,
          'bankFees',
            case
              when s.finance_proposal_id is null then null
              when s.total_cash_out is null then null
              else coalesce(s.bank_fee_cash_out_raw,0)
            end,
          'totalCashOut',
            case when s.finance_proposal_id is null then null else s.total_cash_out end,
          'netCashFlow',
            case
              when s.finance_proposal_id is null then null
              when s.cash_received is null or s.total_cash_out is null then null
              else s.cash_received-s.total_cash_out
            end,
          'realizedFxReference',
            case when s.finance_proposal_id is null then null else s.realized_fx end,
          'semantics','DDS_ONLY__CASH_IS_NOT_ACCRUAL_REVENUE',
          'balanceSemantics','AR_AP_ADVANCES_OUTSIDE_FACT',
          'expenseDetailSemantics','OWNER_CONTROL_PRESERVES_ACCRUAL_DETAIL'
        ),
        'cashFlowAuthority',jsonb_build_object(
          'status',
            case when s.finance_proposal_id is null
              then 'TO_VERIFY_PRESENTATION_AUTHORITY'
              else 'APPROVED_FOR_UI_MATERIALIZATION'
            end,
          'financeProposalRecordId',s.finance_proposal_id,
          'operationsApprovalRecordId',s.operations_approval_id,
          'financeProposalCreatedAt',s.finance_proposal_created_at,
          'operationsApprovalCreatedAt',s.operations_approval_created_at,
          'evidenceRefs',coalesce(s.evidence_refs,'[]'::jsonb)
        )
      )
      order by s.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from shaped s;

  return v_accrual || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V9_CASH_FACT_COMPACT',
    'displayModel','PLAN_CASH_FACT_OWNER_PLUS_SEPARATE_AR_AP',
    'factDisplaySemantics','DDS_ONLY__NO_ACCRUAL_EXPENSE_DETAIL_IN_FACT',
    'balanceDisplaySemantics','SEPARATE_COMPACT_AR_AP_ADVANCE_BLOCK',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v8() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v8() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v8() is
'Admin Agent Rewards v9 compact Owner UAT model. FACT is DDS/cash-flow from source-locked receipts and linked payments. AR/AP/advances stay separate from FACT. Accrual evidence remains available for Owner Control; no authoritative business mutation.';
