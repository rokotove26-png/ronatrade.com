-- Admin Agent Rewards itemized Owner correction v13
-- Owner-directed DELTA_ONLY.
-- Column 3 remains a management overlay over FACT/DDS.
-- Editable: source-locked counterparty payment line replacement amounts + openSettlementAdjustment.
-- Immutable: FACT/DDS, bank fees, realized FX reference, Payments, Accounting and source-locked bank facts.
-- UI/persisted Owner overlay precision: 0.1; underlying source precision is preserved.

create or replace function public.rona_admin_agent_rewards_workspace_v11()
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
  v_base:=public.rona_admin_agent_rewards_workspace_v10();

  with base_deals as (
    select value as item, value->>'dealId' as deal_id
    from jsonb_array_elements(coalesce(v_base->'deals','[]'::jsonb))
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
      and (c.corrected_payload ? 'paymentLineAmounts' or c.corrected_payload ? 'openSettlementAdjustment')
      and (c.corrected_payload - 'paymentLineAmounts' - 'openSettlementAdjustment')='{}'::jsonb
      and (
        not (c.corrected_payload ? 'paymentLineAmounts')
        or jsonb_typeof(c.corrected_payload->'paymentLineAmounts')='object'
      )
    order by c.deal_key,c.assignment_id,c.correction_version desc,c.created_at desc
  ),
  shaped as (
    select
      b.item,
      b.deal_id,
      cc.correction_version,
      cc.corrected_payload,
      cc.note,
      cc.created_at correction_created_at
    from base_deals b
    left join deal_keys dk on dk.deal_id=b.deal_id
    left join compatible_correction cc
      on cc.deal_key=dk.deal_key
     and cc.assignment_id=nullif(b.item->>'assignmentId','')::uuid
  )
  select coalesce(
    jsonb_agg(
      s.item
      || jsonb_build_object(
        'ownerCorrection',
          case
            when s.correction_version is not null
            then jsonb_build_object(
              'version',s.correction_version,
              'payload',s.corrected_payload,
              'note',s.note,
              'createdAt',s.correction_created_at
            )
            else s.item->'ownerCorrection'
          end,
        'ownerCorrectionContract','PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
        'ownerCorrectionPrecision',jsonb_build_object(
          'displayDecimals',1,
          'inputStep',0.1,
          'savedOverlayDecimals',1,
          'underlyingSourcePrecision','PRESERVE'
        )
      )
      order by s.deal_id
    ),
    '[]'::jsonb
  )
  into v_deals
  from shaped s;

  return v_base || jsonb_build_object(
    'contract','ADMIN_AGENT_REWARDS_PNL_V13_ITEMIZED_OWNER_CORRECTIONS',
    'ownerColumnSemantics','MIRROR_FACT_DDS_WITH_ITEMIZED_OWNER_OVERLAYS',
    'ownerCorrectionContract','PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
    'correctedCounterpartyCashOutFormula','FACT_TOTAL_PLUS_SUM_OWNER_LINE_DELTAS',
    'correctedNetCashFlowFormula','FACT_CASH_RECEIVED_MINUS_CORRECTED_COUNTERPARTY_CASH_OUT_MINUS_FACT_BANK_FEES',
    'fxResultSemantics','REFERENCE_ONLY__DO_NOT_ADD_TO_RESULT',
    'displayDecimals',1,
    'deals',v_deals
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_workspace_v11() from public,anon;
grant execute on function public.rona_admin_agent_rewards_workspace_v11() to authenticated;

comment on function public.rona_admin_agent_rewards_workspace_v11() is
'Admin Agent Rewards v13. Owner column mirrors FACT/DDS, permits only source-locked payment-line management overlays plus open settlements, preserves underlying source precision, and exposes UI precision 0.1.';

create or replace function public.rona_admin_agent_rewards_correct_v7(
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
  v_deal_snapshot jsonb;
  v_payment_lines jsonb;
  v_line_key text;
  v_line_value jsonb;
  v_line_numeric numeric;
  v_normalized_lines jsonb:='{}'::jsonb;
  v_open_value jsonb;
  v_open_numeric numeric;
  v_normalized_payload jsonb;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  if btrim(coalesce(p_deal_id,''))='' then raise exception 'DEAL_ID_REQUIRED'; end if;
  if p_assignment_id is null then raise exception 'ASSIGNMENT_ID_REQUIRED'; end if;
  if p_corrected_payload is null or jsonb_typeof(p_corrected_payload)<>'object' then raise exception 'CORRECTION_PAYLOAD_INVALID'; end if;
  if btrim(coalesce(p_idempotency_key,''))='' then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  if not (p_corrected_payload ? 'paymentLineAmounts')
     or not (p_corrected_payload ? 'openSettlementAdjustment')
     or p_corrected_payload <> jsonb_build_object(
       'paymentLineAmounts',p_corrected_payload->'paymentLineAmounts',
       'openSettlementAdjustment',p_corrected_payload->'openSettlementAdjustment'
     )
  then
    raise exception 'CORRECTION_CONTRACT_PAYMENT_LINES_PLUS_OPEN_SETTLEMENT_ONLY';
  end if;

  if jsonb_typeof(p_corrected_payload->'paymentLineAmounts')<>'object' then
    raise exception 'PAYMENT_LINE_AMOUNTS_OBJECT_REQUIRED';
  end if;

  v_open_value:=p_corrected_payload->'openSettlementAdjustment';
  if jsonb_typeof(v_open_value) not in ('number','null') then
    raise exception 'OPEN_SETTLEMENT_ADJUSTMENT_NUMERIC_REQUIRED';
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

  perform 1
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
    and p.payload->>'proposed_field'='agent_rewards.owner.correction_contract_v2'
    and p.payload->>'proposed_action'='ALLOW_SOURCE_LOCKED_PAYMENT_LINE_OVERLAYS_PLUS_OPEN_SETTLEMENT'
  order by p.created_at desc,o.created_at desc
  limit 1;
  if not found then raise exception 'OWNER_ITEMIZED_CORRECTION_AUTHORITY_REQUIRED'; end if;

  select x into v_deal_snapshot
  from jsonb_array_elements(
    coalesce(public.rona_admin_agent_rewards_workspace_v9()->'deals','[]'::jsonb)
  ) x
  where x->>'dealId'=p_deal_id
  limit 1;

  if v_deal_snapshot is null then raise exception 'DEAL_WORKSPACE_NOT_FOUND'; end if;
  if v_deal_snapshot->'cashFlow'->>'status'<>'APPROVED_CASH_FLOW_DDS' then
    raise exception 'OWNER_ITEMIZED_CORRECTION_REQUIRES_APPROVED_DDS'; end if;

  v_payment_lines:=coalesce(v_deal_snapshot->'cashPaymentLines','[]'::jsonb);

  for v_line_key,v_line_value in
    select key,value from jsonb_each(p_corrected_payload->'paymentLineAmounts')
  loop
    if btrim(coalesce(v_line_key,''))='' then raise exception 'PAYMENT_LINE_KEY_REQUIRED'; end if;
    if jsonb_typeof(v_line_value)<>'number' then
      raise exception 'PAYMENT_LINE_AMOUNT_NUMERIC_REQUIRED:%',v_line_key;
    end if;
    v_line_numeric:=(v_line_value#>>'{}')::numeric;
    if v_line_numeric<0 then raise exception 'PAYMENT_LINE_AMOUNT_NEGATIVE:%',v_line_key; end if;

    if not exists (
      select 1
      from jsonb_array_elements(v_payment_lines) x
      where x->>'paymentId'=v_line_key
        and x->>'source'='SOURCE_LOCKED_PAYMENT_RESOURCE_CHAIN'
    ) then
      raise exception 'PAYMENT_LINE_NOT_SOURCE_LOCKED:%',v_line_key;
    end if;

    if (
      select count(distinct coalesce(x->>'counterparty',''))
      from jsonb_array_elements(v_payment_lines) x
      where x->>'paymentId'=v_line_key
    ) > 1 then
      raise exception 'PAYMENT_LINE_COUNTERPARTY_AMBIGUOUS:%',v_line_key;
    end if;

    v_normalized_lines:=v_normalized_lines || jsonb_build_object(
      v_line_key,to_jsonb(round(v_line_numeric,1))
    );
  end loop;

  v_open_numeric:=case
    when jsonb_typeof(v_open_value)='null' then null
    else round((v_open_value#>>'{}')::numeric,1)
  end;

  v_normalized_payload:=jsonb_build_object(
    'paymentLineAmounts',v_normalized_lines,
    'openSettlementAdjustment',
      case when v_open_numeric is null then 'null'::jsonb else to_jsonb(v_open_numeric) end
  );

  perform pg_advisory_xact_lock(hashtextextended(
    'ADMIN_AGENT_REWARDS_V7:'||p_assignment_id::text||':'||v_deal_key::text,0
  ));

  select coalesce(max(correction_version),0)+1 into v_version
  from portal_private.agent_reward_owner_corrections_v1
  where assignment_id=p_assignment_id and deal_key=v_deal_key;

  insert into portal_private.agent_reward_owner_corrections_v1(
    deal_key,assignment_id,correction_version,corrected_payload,note,created_by,idempotency_key
  ) values (
    v_deal_key,p_assignment_id,v_version,v_normalized_payload,
    nullif(btrim(coalesce(p_note,'')),''),v_actor,p_idempotency_key
  );

  return jsonb_build_object(
    'accepted',true,
    'idempotentReplay',false,
    'dealId',p_deal_id,
    'assignmentId',p_assignment_id,
    'version',v_version,
    'correctedPayload',v_normalized_payload,
    'correctionContract','PAYMENT_LINE_AMOUNTS_PLUS_OPEN_SETTLEMENT_ADJUSTMENT',
    'savedOverlayDecimals',1
  );
end;
$$;

revoke all on function public.rona_admin_agent_rewards_correct_v7(text,uuid,jsonb,text,text) from public,anon;
grant execute on function public.rona_admin_agent_rewards_correct_v7(text,uuid,jsonb,text,text) to authenticated;

comment on function public.rona_admin_agent_rewards_correct_v7(text,uuid,jsonb,text,text) is
'Owner correction v7 for Agent Rewards. Accepts only source-locked paymentId replacement amounts plus openSettlementAdjustment, rounds Owner overlays to 0.1, and never mutates FACT/bank/Payment authority.';
