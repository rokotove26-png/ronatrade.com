-- Admin Agent Rewards authoritative DDS projection v14
-- Owner instruction 2026-10-07.
-- Fixes blanket TO_VERIFY caused by stale accrual/strict-bank receipt projection.
-- Uses only Finance+Operations-approved DDS authority over already existing source-locked Finance facts.
-- No mutation of Payments, bank facts, allocations, Accounting, Shipments or legal balances.

create or replace function public.rona_admin_agent_rewards_workspace_v12()
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
  v_base:=public.rona_admin_agent_rewards_workspace_v11();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  approved_dds as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as finance_proposal_created_at,
      o.created_at as operations_approval_created_at,
      p.payload->'proposed_value' as dds_value,
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
      and p.payload->>'proposed_field'='agent_rewards.fact.dds_authority_v3'
      and p.payload->>'proposed_action'='MATERIALIZE_EXISTING_FINANCE_AUTHORITY_AS_DDS_FACT'
      and p.payload->'proposed_value'->>'recognition_status'='APPROVED_FINANCE_DDS_FACT'
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
      a.dds_value,
      a.evidence_refs,
      nullif(a.dds_value->>'reporting_currency','') as reporting_currency,
      nullif(a.dds_value->>'cash_received','')::numeric as cash_received,
      nullif(a.dds_value->>'counterparty_cash_out','')::numeric as counterparty_cash_out,
      nullif(a.dds_value->>'bank_fees','')::numeric as bank_fees,
      nullif(a.dds_value->>'net_cash_flow','')::numeric as net_cash_flow,
      nullif(a.dds_value->'realized_fx_reference'->>'amount','')::numeric as realized_fx_reference,
      coalesce(nullif(a.dds_value->'owner_bridge'->>'open_settlement_adjustment_default','')::numeric,0::numeric) as open_settlement_default
    from base_deals b
    left join approved_dds a on a.deal_id=b.deal_id
  )
  select coalesce(
    jsonb_agg(
      case
        when s.finance_proposal_id is null then s.item
        else
          s.item
          || jsonb_build_object(
            'cashFlow',
              coalesce(s.item->'cashFlow','{}'::jsonb)
              || jsonb_build_object(
                'status','APPROVED_CASH_FLOW_DDS',
                'currency',s.reporting_currency,
                'cashReceived',s.cash_received,
                'counterpartyCashOut',s.counterparty_cash_out,
                'bankFees',s.bank_fees,
                'totalCashOut',s.counterparty_cash_out+s.bank_fees,
                'netCashFlow',s.net_cash_flow,
                'realizedFxReference',s.realized_fx_reference,
                'semantics','DDS_ONLY__EXISTING_FINANCE_AUTHORITY',
                'receiptSemantics','OWNER_CONFIRMED_OR_BANK_CONFIRMED_FINANCE_AUTHORITY',
                'zeroReceiptSemantics','CONFIRMED_ZERO_IS_FACT_NOT_TO_VERIFY',
                'fxSemantics','HIDE_WITHOUT_SEPARATE_APPROVED_REFERENCE__NEVER_ADD_TO_RESULT'
              ),
            'cashFlowAuthority',jsonb_build_object(
              'status','APPROVED_FOR_UI_MATERIALIZATION',
              'financeProposalRecordId',s.finance_proposal_id,
              'operationsApprovalRecordId',s.operations_approval_id,
              'financeProposalCreatedAt',s.finance_proposal_created_at,
              'operationsApprovalCreatedAt',s.operations_approval_created_at,
              'evidenceRefs',coalesce(s.evidence_refs,'[]'::jsonb),
              'sourcePrecision','PRESERVE',
              'displayPrecision',1,
              'mutationSemantics','READ_ONLY_PROJECTION'
            ),
            'ownerResultBridge',
              jsonb_build_object(
                'recognition_status','APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE',
                'owner_column_semantics','MIRROR_FACT_DDS_WITH_ITEMIZED_OWNER_OVERLAYS',
                'open_settlement_adjustment',jsonb_build_object(
                  'label','Незакрытые расчёты',
                  'amount',s.open_settlement_default,
                  'currency',s.reporting_currency,
                  'status','OWNER_OVERLAY_DEFAULT',
                  'semantics','DEFAULT_ZERO_IS_EDITABLE_OVERLAY_NOT_ZERO_EXTERNAL_BALANCE_ASSERTION',
                  'owner_editable_aggregate',true
                ),
                'actual_financial_result',jsonb_build_object(
                  'amount',s.net_cash_flow+s.open_settlement_default,
                  'currency',s.reporting_currency,
                  'formula','NET_CASH_FLOW_PLUS_OPEN_SETTLEMENT_ADJUSTMENT'
                ),
                'realized_fx_reference',jsonb_build_object(
                  'amount',s.realized_fx_reference,
                  'currency',s.reporting_currency,
                  'treatment','REFERENCE_ONLY__NEVER_ADD_TO_RESULT'
                ),
                'no_double_count_fx',true,
                'no_authoritative_financial_fact_mutation',true
              ),
            'ownerResultBridgeAuthority',jsonb_build_object(
              'status','APPROVED_FOR_OWNER_RESULT',
              'financeProposalRecordId',s.finance_proposal_id,
              'operationsApprovalRecordId',s.operations_approval_id,
              'evidenceRefs',coalesce(s.evidence_refs,'[]'::jsonb),
              'resultSemantics','NET_DDS_PLUS_OWNER_OPEN_SETTLEMENT_OVERLAY',
              'fxSemantics','REFERENCE_ONLY__NO_DOUBLE_COUNT',
              'mutationSemantics','READ_ONLY_FACT_PLUS_IMMUTABLE_OWNER_OVERLAY'
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
    'contract','ADMIN_AGENT_REWARDS_PNL_V14_AUTHORITATIVE_DDS',
    'factAuthorityContract','FINANCE_EXISTING_SOURCE_LOCKED_AUTHORITY_PLUS_OPERATIONS_APPROVAL',
    'receiptSemantics','FINANCE_AUTHORITY_NOT_BANK_STATUS_ONLY',
    'confirmedZeroSemantics','ZERO_IS_NUMERIC_FACT',
    'ownerBridgeDefaultSemantics','ZERO_OWNER_OVERLAY_IS_NOT_EXTERNAL_BALANCE_ASSERTION',
    'fxResultSemantics','REFERENCE_ONLY__DO_NOT_ADD_TO_RESULT',
    'displayDecimals',1,
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v12() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v12() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v12() is
'Admin Agent Rewards v14. Removes blanket TO_VERIFY for deals with existing Finance-authoritative DDS facts, including Owner-confirmed receipts and confirmed zero receipts. Source facts remain immutable.';
