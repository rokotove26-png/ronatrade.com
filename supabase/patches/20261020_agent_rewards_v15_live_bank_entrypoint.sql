-- Agent rewards V15 entrypoint retains portal OWNER authorization, existing business semantics and its contract label.
CREATE OR REPLACE FUNCTION public.rona_admin_agent_rewards_workspace_v15()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'
AS $function$
declare
  v_base jsonb;
  v_deals jsonb;
begin
  v_base := public.rona_admin_agent_rewards_workspace_v15_legacy_source_v1();

  with base_deals as (
    select x.value as item, x.value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb)) x(value)
  ),
  deal_keys as (
    select d.deal_id,d.id as deal_key
    from portal_private.deals d
    where d.deal_id in (select deal_id from base_deals)
  ),
  approved_accrual as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as proposal_created_at,
      o.created_at as approval_created_at,
      p.payload->'proposed_value' as accrual_value
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
      and p.payload->'proposed_value'->>'recognition_status'='APPROVED_OPERATIONAL_ACCRUAL_FACT'
    order by p.target_id,p.created_at desc,o.created_at desc
  ),
  approved_bridge as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as proposal_created_at,
      o.created_at as approval_created_at,
      p.payload->'proposed_value' as bridge_value
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
      and p.payload->>'proposed_field'='agent_rewards.owner.actual_result_bridge_v1'
      and p.payload->>'proposed_action'='MATERIALIZE_OWNER_MIRROR_DDS_PLUS_OPEN_SETTLEMENTS'
      and p.payload->'proposed_value'->>'recognition_status'='APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE'
    order by p.target_id,p.created_at desc,o.created_at desc
  ),
  latest_correction as (
    select distinct on (c.deal_key,c.assignment_id)
      c.deal_key,c.assignment_id,c.created_at,c.correction_version
    from portal_private.agent_reward_owner_corrections_v1 c
    order by c.deal_key,c.assignment_id,c.correction_version desc,c.created_at desc
  ),
  shaped as (
    select
      b.item,b.deal_id,dk.deal_key,
      a.finance_proposal_id as accrual_proposal_id,
      a.operations_approval_id as accrual_approval_id,
      a.proposal_created_at as accrual_created_at,
      a.accrual_value,
      br.finance_proposal_id as bridge_proposal_id,
      br.operations_approval_id as bridge_approval_id,
      br.proposal_created_at as bridge_created_at,
      br.bridge_value,
      lc.created_at as correction_created_at,
      greatest(a.proposal_created_at,br.proposal_created_at) as source_created_at
    from base_deals b
    left join deal_keys dk on dk.deal_id=b.deal_id
    left join approved_accrual a on a.deal_id=b.deal_id
    left join approved_bridge br on br.deal_id=b.deal_id
    left join latest_correction lc
      on lc.deal_key=dk.deal_key
     and lc.assignment_id=nullif(b.item->>'assignmentId','')::uuid
  ),
  projected as (
    select
      s.deal_id,
      case
        when s.accrual_value is null and s.bridge_value is null then s.item
        else
          s.item
          || jsonb_build_object(
            'settlementPositions',
              case
                when s.accrual_value is not null
                  then coalesce(s.accrual_value->'settlement_positions','[]'::jsonb)
                else coalesce(s.item->'settlementPositions','[]'::jsonb)
              end,
            'conditionalPositions',
              case
                when s.accrual_value is not null
                  then coalesce(s.accrual_value->'conditional_positions','[]'::jsonb)
                else coalesce(s.item->'conditionalPositions','[]'::jsonb)
              end,
            'ownerResultBridge',
              case
                when s.bridge_value is null then coalesce(s.item->'ownerResultBridge','{}'::jsonb)
                else
                  coalesce(s.item->'ownerResultBridge','{}'::jsonb)
                  || jsonb_build_object(
                    'open_settlement_adjustment',
                      s.bridge_value->'open_settlement_adjustment',
                    'actual_financial_result',
                      case
                        when nullif(s.item->'cashFlow'->>'netCashFlow','') is not null
                         and nullif(s.bridge_value->'open_settlement_adjustment'->>'amount','') is not null
                        then jsonb_build_object(
                          'amount',
                          (s.item->'cashFlow'->>'netCashFlow')::numeric
                          + (s.bridge_value->'open_settlement_adjustment'->>'amount')::numeric,
                          'currency',
                          coalesce(
                            s.bridge_value->'open_settlement_adjustment'->>'currency',
                            s.item->'cashFlow'->>'currency'
                          ),
                          'formula','NET_CASH_FLOW_PLUS_SOURCE_CURRENT_OPEN_SETTLEMENT'
                        )
                        else coalesce(s.item->'ownerResultBridge'->'actual_financial_result','null'::jsonb)
                      end
                  )
              end,
            'ownerCorrectionRaw',s.item->'ownerCorrection',
            'ownerCorrection',
              case
                when s.bridge_value is not null
                 and jsonb_typeof(s.item->'ownerCorrection') = 'object'
                 and jsonb_typeof(s.item->'ownerCorrection'->'payload') = 'object'
                 and (s.correction_created_at is null or s.bridge_created_at>s.correction_created_at)
                 and nullif(s.bridge_value->'open_settlement_adjustment'->>'amount','') is not null
                then jsonb_set(
                  s.item->'ownerCorrection',
                  '{payload,openSettlementAdjustment}',
                  to_jsonb((s.bridge_value->'open_settlement_adjustment'->>'amount')::numeric),
                  true
                )
                else s.item->'ownerCorrection'
              end,
            'openSettlementFunctionalRule',jsonb_build_object(
              'ruleId','FINANCE_OPEN_SETTLEMENT_FROM_DOCUMENTED_EXPENSE_V1',
              'status','ENFORCED',
              'recognition','DOCUMENTED_EXPENSE_RECOGNIZED_BEFORE_PAYMENT',
              'calculation','ACCRUED_EXPENSE_MINUS_VERIFIED_SETTLEMENT',
              'onDocument','ADD_OR_INCREASE_OPEN_SETTLEMENT',
              'onVerifiedPayment','DECREASE_OR_CLOSE_OPEN_SETTLEMENT',
              'ownerOverlay','SEPARATE_MANAGEMENT_LAYER__STALE_OVERLAY_CANNOT_SUPPRESS_NEWER_SOURCE',
              'noDoubleCount',true
            ),
            'openSettlementSourceCurrentness',jsonb_build_object(
              'status',
                case
                  when s.source_created_at is null then 'NO_SOURCE'
                  when s.correction_created_at is null then 'SOURCE_CURRENT'
                  when s.source_created_at>s.correction_created_at then 'SOURCE_NEWER_THAN_OWNER_CORRECTION'
                  else 'OWNER_CORRECTION_NEWER_OR_EQUAL'
                end,
              'accrualFinanceProposalRecordId',s.accrual_proposal_id,
              'accrualOperationsApprovalRecordId',s.accrual_approval_id,
              'bridgeFinanceProposalRecordId',s.bridge_proposal_id,
              'bridgeOperationsApprovalRecordId',s.bridge_approval_id,
              'sourceCreatedAt',s.source_created_at,
              'ownerCorrectionCreatedAt',s.correction_created_at
            )
          )
      end as item
    from shaped s
  )
  select coalesce(jsonb_agg(p.item order by p.deal_id),'[]'::jsonb)
    into v_deals
  from projected p;

  v_deals := portal_private.agent_rewards_bank_settlement_overlay_v1(v_deals);

  return portal_private.agent_rewards_live_bank_overlay_v1(v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_SOURCE_CURRENT_OPEN_SETTLEMENT_V1',
    'openSettlementFunctionalRule',jsonb_build_object(
      'ruleId','FINANCE_OPEN_SETTLEMENT_FROM_DOCUMENTED_EXPENSE_V1',
      'recognitionTrigger','DOCUMENTED_EXPENSE',
      'paymentSemantics','PAYMENT_SETTLES_BUT_DOES_NOT_CREATE_EXPENSE',
      'unpaidSemantics','UNPAID_RECOGNIZED_EXPENSE_MUST_APPEAR_IN_OPEN_SETTLEMENTS',
      'ownerOverlaySemantics','SEPARATE_MANAGEMENT_LAYER__CANNOT_SUPPRESS_NEWER_SOURCE',
      'appliesTo','ALL_ADMIN_LK_DEALS'
    ),
    'deals',v_deals
  ));
end;
$function$

