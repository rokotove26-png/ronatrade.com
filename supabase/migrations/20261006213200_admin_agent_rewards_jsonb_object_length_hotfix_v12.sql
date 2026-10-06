-- Admin Agent Rewards Owner mirror DDS + open settlements v12 hotfix
-- Owner-directed DELTA_ONLY.
-- Column 3 mirrors FACT/DDS and adds one signed management bridge row «Незакрытые расчёты».
-- Realized FX is reference-only for result arithmetic to prevent double counting.
-- Legacy expense-line / FX corrections are quarantined from the new Owner column.
-- No mutation of Payments, Accounting, Shipments, legal AR/AP, bank facts or source-locked facts.

create or replace function public.rona_admin_agent_rewards_workspace_v10()
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
  v_base:=public.rona_admin_agent_rewards_workspace_v9();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
  ),
  approved_bridge as (
    select distinct on (p.target_id)
      p.target_id as deal_id,
      p.record_id as finance_proposal_id,
      o.record_id as operations_approval_id,
      p.created_at as finance_proposal_created_at,
      o.created_at as operations_approval_created_at,
      p.payload->'proposed_value' as bridge_value,
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
      and p.payload->>'proposed_field'='agent_rewards.owner.actual_result_bridge_v1'
      and p.payload->>'proposed_action'='MATERIALIZE_OWNER_MIRROR_DDS_PLUS_OPEN_SETTLEMENTS'
      and jsonb_typeof(p.payload->'proposed_value')='object'
    order by p.target_id,p.created_at desc,o.created_at desc
  ),
  deal_keys as (
    select d.deal_id,d.id deal_key
    from portal_private.deals d
    where d.deal_id in (select deal_id from base_deals)
  ),
  compatible_correction as (
    select distinct on (c.deal_key,c.assignment_id)
      c.deal_key,
      c.assignment_id,
      c.correction_version,
      c.corrected_payload,
      c.note,
      c.created_at
    from portal_private.agent_reward_owner_corrections_v1 c
    where jsonb_typeof(c.corrected_payload)='object'
      and c.corrected_payload ? 'openSettlementAdjustment'
      and c.corrected_payload = jsonb_build_object('openSettlementAdjustment', c.corrected_payload->'openSettlementAdjustment')
    order by c.deal_key,c.assignment_id,c.correction_version desc,c.created_at desc
  ),
  shaped as (
    select
      b.item,
      b.deal_id,
      a.finance_proposal_id,
      a.operations_approval_id,
      a.finance_proposal_created_at,
      a.operations_approval_created_at,
      a.bridge_value,
      a.evidence_refs,
      cc.correction_version,
      cc.corrected_payload,
      cc.note,
      cc.created_at correction_created_at
    from base_deals b
    left join approved_bridge a on a.deal_id=b.deal_id
    left join deal_keys dk on dk.deal_id=b.deal_id
    left join compatible_correction cc
      on cc.deal_key=dk.deal_key
     and cc.assignment_id=nullif(b.item->>'assignmentId','')::uuid
  )
  select coalesce(
    jsonb_agg(
      s.item
      || jsonb_build_object(
        'ownerResultBridge',
          coalesce(
            s.bridge_value,
            jsonb_build_object(
              'recognition_status','TO_VERIFY_NO_APPROVED_OWNER_RESULT_BRIDGE',
              'owner_column_semantics','MIRROR_FACT_DDS_PLUS_SINGLE_OPEN_SETTLEMENT_ADJUSTMENT',
              'no_double_count_fx',true
            )
          ),
        'ownerResultBridgeAuthority',
          jsonb_build_object(
            'status',
              case
                when s.finance_proposal_id is null then 'TO_VERIFY'
                when s.bridge_value->>'recognition_status'='APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE'
                  then 'APPROVED_FOR_OWNER_RESULT'
                else 'FAIL_CLOSED'
              end,
            'financeProposalRecordId',s.finance_proposal_id,
            'operationsApprovalRecordId',s.operations_approval_id,
            'financeProposalCreatedAt',s.finance_proposal_created_at,
            'operationsApprovalCreatedAt',s.operations_approval_created_at,
            'evidenceRefs',coalesce(s.evidence_refs,'[]'::jsonb),
            'resultSemantics','NET_DDS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
            'fxSemantics','REFERENCE_ONLY__NO_DOUBLE_COUNT',
            'mutationSemantics','READ_ONLY_BRIDGE_PLUS_IMMUTABLE_OWNER_OVERLAY'
          ),
        'ownerCorrectionLegacy',
          case
            when s.correction_version is null
              then coalesce(s.item->'ownerCorrectionLegacy',s.item->'ownerCorrection')
            else coalesce(s.item->'ownerCorrectionLegacy',s.item->'ownerCorrection')
          end,
        'ownerCorrection',
          case
            when s.bridge_value->>'recognition_status'='APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE'
             and s.correction_version is not null
            then jsonb_build_object(
              'version',s.correction_version,
              'payload',s.corrected_payload,
              'note',s.note,
              'createdAt',s.correction_created_at
            )
            else null
          end,
        'ownerCorrectionContract','OPEN_SETTLEMENT_ADJUSTMENT_ONLY'
      )
      order by s.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from shaped s;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V11_OWNER_MIRROR_DDS',
    'ownerColumnSemantics','MIRROR_FACT_DDS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
    'actualResultFormula','NET_CASH_FLOW_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
    'fxResultSemantics','REFERENCE_ONLY__DO_NOT_ADD_TO_RESULT',
    'ownerCorrectionContract','OPEN_SETTLEMENT_ADJUSTMENT_ONLY',
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v10() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v10() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v10() is
'Admin Agent Rewards v11. Column 3 mirrors source-locked FACT/DDS, adds one Finance+Operations approved signed open-settlement bridge, computes actual result without re-adding FX, and exposes only a management overlay for openSettlementAdjustment.';

create or replace function public.rona_admin_agent_rewards_correct_v6(
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
  v_bridge jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  if btrim(coalesce(p_deal_id,''))='' then raise exception 'DEAL_ID_REQUIRED'; end if;
  if p_assignment_id is null then raise exception 'ASSIGNMENT_ID_REQUIRED'; end if;
  if p_corrected_payload is null or jsonb_typeof(p_corrected_payload)<>'object' then raise exception 'CORRECTION_PAYLOAD_INVALID'; end if;
  if btrim(coalesce(p_idempotency_key,''))='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  if not (p_corrected_payload ? 'openSettlementAdjustment')
     or p_corrected_payload <> jsonb_build_object('openSettlementAdjustment', p_corrected_payload->'openSettlementAdjustment') then
    raise exception 'CORRECTION_CONTRACT_OPEN_SETTLEMENT_ONLY';
  end if;

  for v_key,v_value in select key,value from jsonb_each(p_corrected_payload)
  loop
    if v_key<>'openSettlementAdjustment' then
      raise exception 'CORRECTION_FIELD_NOT_ALLOWED:%',v_key;
    end if;
    if jsonb_typeof(v_value) not in ('number','null') then
      raise exception 'CORRECTION_VALUE_NOT_NUMERIC:%',v_key;
    end if;
  end loop;

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
  into v_bridge
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
    and p.payload->>'proposed_field'='agent_rewards.owner.actual_result_bridge_v1'
    and p.payload->>'proposed_action'='MATERIALIZE_OWNER_MIRROR_DDS_PLUS_OPEN_SETTLEMENTS'
    and p.payload->'proposed_value'->>'recognition_status'='APPROVED_MANAGEMENT_ACTUAL_RESULT_BRIDGE'
  order by p.created_at desc,o.created_at desc
  limit 1;

  if v_bridge is null then
    raise exception 'OWNER_CORRECTION_REQUIRES_APPROVED_RESULT_BRIDGE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'ADMIN_AGENT_REWARDS_V6:'||p_assignment_id::text||':'||v_deal_key::text,0
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
    'accepted',true,
    'idempotentReplay',false,
    'dealId',p_deal_id,
    'assignmentId',p_assignment_id,
    'version',v_version,
    'correctedPayload',p_corrected_payload,
    'correctionContract','OPEN_SETTLEMENT_ADJUSTMENT_ONLY'
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_correct_v6(text,uuid,jsonb,text,text) from public,anon;
grant execute on function public.rona_admin_agent_rewards_correct_v6(text,uuid,jsonb,text,text) to authenticated;

comment on function public.rona_admin_agent_rewards_correct_v6(text,uuid,jsonb,text,text) is
'Owner correction v6 for Agent Rewards. Only openSettlementAdjustment is editable. FACT/DDS rows and FX are read-only; actual result, agent basis/reward and RONA profit are computed.';
