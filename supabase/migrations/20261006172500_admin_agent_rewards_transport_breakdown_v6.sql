-- Admin Agent Rewards PLAN transport breakdown v6
-- Read-only projection of RAIL_LOGISTICS transport decomposition after Operations approval.
-- Preserves Finance-approved PLAN totals and financial result.

create or replace function public.rona_admin_agent_rewards_workspace_v5()
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
  v_base:=public.rona_admin_agent_rewards_workspace_v4();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  approved_transport as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as rail_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as rail_proposal_created_at,
      o.created_at as operations_approval_created_at,
      p.payload->'proposed_value' as transport_value,
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
      and p.functional_role::text='RAIL_LOGISTICS'
      and p.target_type='DEAL'
      and p.status='PROPOSED'
      and p.payload->>'proposed_field'='management_plan_transport_breakdown'
      and p.payload->>'proposed_action'='MATERIALIZE_AGENT_REWARDS_PLAN_TRANSPORT_BREAKDOWN'
      and jsonb_typeof(p.payload->'proposed_value')='object'
    order by p.target_id,p.created_at desc,o.created_at desc
  )
  select coalesce(
    jsonb_agg(
      case
        when at.rail_proposal_id is null then b.item
        else
          b.item || jsonb_build_object(
            'planInputs',
              coalesce(b.item->'planInputs','{}'::jsonb)
              || jsonb_build_object(
                'transportBreakdown',at.transport_value,
                'transportBreakdownStatus',
                  case
                    when at.transport_value ? 'conflict' then 'APPROVED_BREAKDOWN_WITH_TARIFF_CONFLICT'
                    when exists (
                      select 1
                      from jsonb_array_elements(coalesce(at.transport_value->'components','[]'::jsonb)) c
                      where upper(coalesce(c->>'status','')) like '%TO_VERIFY%'
                    ) then 'APPROVED_BREAKDOWN_WITH_TO_VERIFY'
                    else 'APPROVED_RAIL_TRANSPORT_BREAKDOWN'
                  end
              ),
            'transportAuthority',jsonb_build_object(
              'railProposalRecordId',at.rail_proposal_id,
              'operationsApprovalRecordId',at.operations_approval_id,
              'railProposalCreatedAt',at.rail_proposal_created_at,
              'operationsApprovalCreatedAt',at.operations_approval_created_at,
              'evidenceRefs',at.evidence_refs,
              'mutationSemantics','READ_ONLY_DECOMPOSITION',
              'totalSemantics','FINANCE_APPROVED_PLAN_TOTAL_UNCHANGED'
            )
          )
      end
      order by b.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from base_deals b
  left join approved_transport at on at.deal_id=b.deal_id;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V6_TRANSPORT_BREAKDOWN',
    'transportBreakdownContract','RAIL_PROPOSAL_PLUS_OPERATIONS_APPROVAL',
    'transportTotalSemantics','FINANCE_APPROVED_PLAN_TOTAL_UNCHANGED',
    'transportConflictSemantics','VISIBLE_FAIL_CLOSED_NO_AUTO_RECONCILIATION',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v5() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v5() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v5() is
'Admin Agent Rewards P&L v6. Adds source-locked RAIL_LOGISTICS PLAN transport component breakdown only after matching Operations approval. Finance-approved PLAN transport total and financial result remain unchanged; tariff conflicts and TO_VERIFY statuses remain visible.';
