-- Admin Agent Rewards PLAN authority projection v5
-- DELTA_ONLY: materializes only approved Finance management PLAN basis into the read model.
-- Business facts remain in audited coordination; this function is read-only.

create or replace function public.rona_admin_agent_rewards_workspace_v4()
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
  v_base:=public.rona_admin_agent_rewards_workspace_v3();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  approved_plan as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as finance_proposal_created_at,
      o.created_at as operations_approval_created_at,
      p.payload->'proposed_value' as plan_value,
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
      and p.payload->>'proposed_field'='management_plan_financial_basis'
      and p.payload->>'proposed_action'='MATERIALIZE_AGENT_REWARDS_PLAN'
      and jsonb_typeof(p.payload->'proposed_value')='object'
    order by p.target_id,p.created_at desc,o.created_at desc
  ),
  shaped as (
    select
      b.item,
      b.deal_id,
      ap.finance_proposal_id,
      ap.operations_approval_id,
      ap.finance_proposal_created_at,
      ap.operations_approval_created_at,
      ap.evidence_refs,
      ap.plan_value,
      nullif(btrim(ap.plan_value->>'currency'),'') as plan_currency,
      nullif(ap.plan_value->>'revenue','')::numeric as revenue,
      nullif(ap.plan_value->>'purchase_cost','')::numeric as purchase_cost,
      nullif(ap.plan_value->>'transport_cost','')::numeric as transport_cost,
      nullif(ap.plan_value->>'taxes_and_payments','')::numeric as taxes_and_payments,
      upper(coalesce(ap.plan_value->>'agent_mode','')) as agent_mode,
      nullif(ap.plan_value->>'agent_rate','')::numeric as agent_rate,
      ap.plan_value->>'agent_basis' as agent_basis,
      ap.plan_value->>'agent_authority' as agent_authority,
      ap.plan_value->>'fx_semantics' as fx_semantics
    from base_deals b
    left join approved_plan ap on ap.deal_id=b.deal_id
  ),
  projected as (
    select
      s.*,
      case when s.finance_proposal_id is not null
        then s.purchase_cost+s.transport_cost
        else null::numeric end as plan_expense_total,
      case when s.finance_proposal_id is not null
        then s.revenue-s.purchase_cost-s.transport_cost
        else null::numeric end as plan_financial_result
    from shaped s
  ),
  finalized as (
    select
      p.*,
      case
        when p.finance_proposal_id is null then null::numeric
        when p.agent_mode='NONE' then 0::numeric
        when p.agent_mode='PERCENT' and p.agent_rate is not null
          then greatest(0::numeric,p.plan_financial_result)*p.agent_rate
        else null::numeric
      end as plan_agent_reward,
      case
        when p.finance_proposal_id is null then null::text
        when p.agent_mode='NONE' then 'APPROVED_PLAN_NO_CURRENT_EFFECTIVE_TERM'
        when p.agent_mode='PERCENT' and p.agent_rate is not null then 'APPROVED_FINANCE_PLAN_PERCENT'
        else 'TO_VERIFY_PLAN_AGENT_MODE'
      end as plan_agent_reward_status
    from projected p
  )
  select coalesce(
    jsonb_agg(
      case
        when f.finance_proposal_id is null then f.item
        else
          f.item
          || jsonb_build_object(
            'financialCurrency',f.plan_currency,
            'planInputs',jsonb_build_object(
              'revenue',f.revenue,
              'revenueStatus','APPROVED_FINANCE_MANAGEMENT_PLAN',
              'expenseLines',jsonb_build_array(
                jsonb_build_object(
                  'key','PURCHASE_COST',
                  'label','Закупочная стоимость товара',
                  'amount',f.purchase_cost,
                  'currency',f.plan_currency,
                  'source','FINANCE_APPROVED_MANAGEMENT_PLAN'
                ),
                jsonb_build_object(
                  'key','TRANSPORT_COST',
                  'label','Транспортировка',
                  'amount',f.transport_cost,
                  'currency',f.plan_currency,
                  'source','FINANCE_APPROVED_MANAGEMENT_PLAN'
                )
              ),
              'expenseKnownTotal',f.plan_expense_total,
              'expenseStatus','APPROVED_FINANCE_MANAGEMENT_PLAN__EXACTLY_TWO_LINES',
              'taxesAndPayments',f.taxes_and_payments,
              'taxesAndPaymentsStatus','APPROVED_INTERNAL_MANAGEMENT_PLAN',
              'fxDifference',0,
              'fxStatus','NOT_APPLICABLE_IN_PLAN',
              'agentReward',f.plan_agent_reward,
              'agentRewardStatus',f.plan_agent_reward_status,
              'agentPlan',jsonb_build_object(
                'mode',f.agent_mode,
                'rate',f.agent_rate,
                'basis',f.agent_basis,
                'authority',f.agent_authority
              )
            ),
            'planAuthority',jsonb_build_object(
              'financeProposalRecordId',f.finance_proposal_id,
              'operationsApprovalRecordId',f.operations_approval_id,
              'financeProposalCreatedAt',f.finance_proposal_created_at,
              'operationsApprovalCreatedAt',f.operations_approval_created_at,
              'evidenceRefs',f.evidence_refs,
              'fxSemantics',f.fx_semantics,
              'mutationSemantics','READ_ONLY_PROJECTION'
            )
          )
      end
      order by f.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from finalized f;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V5_APPROVED_PLAN',
    'planAuthorityContract','FINANCE_PROPOSAL_PLUS_OPERATIONS_APPROVAL',
    'planFxSemantics','NOT_APPLICABLE_IN_PLAN',
    'planExpenseSemantics','EXACTLY_TWO_LINES_PURCHASE_PLUS_TRANSPORT',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v4() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v4() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v4() is
'Admin Agent Rewards P&L v5 approved PLAN projection. Reads only Finance management_plan_financial_basis proposals with matching Operations APPROVE_FOR_NEXT_STAGE. Exactly two PLAN expense lines (purchase + transport), no FX in PLAN, no mutation of Finance/payment/settlement facts.';
