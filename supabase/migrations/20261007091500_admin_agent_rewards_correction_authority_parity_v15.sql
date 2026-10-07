-- Admin Agent Rewards correction authority parity v15
-- Owner instruction 2026-10-07.
-- Exposes the same per-deal correction eligibility that rona_admin_agent_rewards_correct_v7 already enforces.
-- No mutation of FACT/DDS, Payments, Accounting, bank facts, legal balances or source-locked payment rows.

create or replace function public.rona_admin_agent_rewards_workspace_v13()
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, portal_private, auth
as $$
declare
  v_base jsonb;
  v_deals jsonb;
begin
  v_base:=public.rona_admin_agent_rewards_workspace_v12();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  approved_correction as (
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
      and p.payload->>'proposed_field'='agent_rewards.owner.correction_contract_v2'
      and p.payload->>'proposed_action'='ALLOW_SOURCE_LOCKED_PAYMENT_LINE_OVERLAYS_PLUS_OPEN_SETTLEMENT'
      and jsonb_typeof(p.payload->'proposed_value')='object'
    order by p.target_id,p.created_at desc,o.created_at desc
  )
  select coalesce(
    jsonb_agg(
      b.item
      || jsonb_build_object(
        'ownerCorrectionAuthority',jsonb_build_object(
          'status',
            case when a.finance_proposal_id is null
              then 'TO_VERIFY_CORRECTION_AUTHORITY'
              else 'APPROVED_FOR_OWNER_CORRECTION'
            end,
          'contract','PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
          'financeProposalRecordId',a.finance_proposal_id,
          'operationsApprovalRecordId',a.operations_approval_id,
          'financeProposalCreatedAt',a.finance_proposal_created_at,
          'operationsApprovalCreatedAt',a.operations_approval_created_at,
          'evidenceRefs',coalesce(a.evidence_refs,'[]'::jsonb),
          'editableFields',jsonb_build_array('paymentLineAmounts','openSettlementAdjustment'),
          'mutationSemantics','MANAGEMENT_OVERLAY_ONLY__SOURCE_FACTS_IMMUTABLE'
        )
      )
      order by b.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from base_deals b
  left join approved_correction a on a.deal_id=b.deal_id;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V15_CORRECTION_AUTHORITY_PARITY',
    'ownerCorrectionEligibilitySemantics','APPROVED_DDS_AND_OWNER_RESULT_BRIDGE_AND_APPROVED_CORRECTION_CONTRACT',
    'ownerCorrectionContract','PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v13() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v13() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v13() is
'Admin Agent Rewards v15. Exposes per-deal Owner correction authority from the same Finance proposal plus Operations approval contract enforced by correct_v7, so frontend and backend fail closed identically.';
