-- Payments V7 — consume Finance-owned actual_spend / remaining through the existing authority/materialization contour.
-- No bank fact is fabricated. Missing funding events are not interpreted as a financial result.

alter table portal_private.deal_finance_authority_v7
  add column if not exists actual_spend numeric(24,8),
  add column if not exists actual_spend_status text,
  add column if not exists remaining_execution numeric(24,8),
  add column if not exists remaining_execution_status text,
  add column if not exists execution_currency char(3),
  add column if not exists execution_status text;

alter table portal_private.deal_finance_authority_v7
  drop constraint if exists deal_finance_authority_v7_actual_spend_status_check,
  add constraint deal_finance_authority_v7_actual_spend_status_check
    check (actual_spend_status is null or actual_spend_status in ('AUTHORITATIVE','TO_VERIFY')),
  drop constraint if exists deal_finance_authority_v7_remaining_execution_status_check,
  add constraint deal_finance_authority_v7_remaining_execution_status_check
    check (remaining_execution_status is null or remaining_execution_status in ('AUTHORITATIVE','TO_VERIFY')),
  drop constraint if exists deal_finance_authority_v7_execution_currency_check,
  add constraint deal_finance_authority_v7_execution_currency_check
    check (execution_currency is null or execution_currency::text ~ '^[A-Z]{3}$'),
  drop constraint if exists deal_finance_authority_v7_actual_spend_integrity_check,
  add constraint deal_finance_authority_v7_actual_spend_integrity_check
    check (
      actual_spend_status is null
      or (actual_spend_status='AUTHORITATIVE' and actual_spend is not null and actual_spend>=0 and execution_currency is not null)
      or (actual_spend_status='TO_VERIFY' and actual_spend is null)
    ),
  drop constraint if exists deal_finance_authority_v7_remaining_execution_integrity_check,
  add constraint deal_finance_authority_v7_remaining_execution_integrity_check
    check (
      remaining_execution_status is null
      or (remaining_execution_status='AUTHORITATIVE' and remaining_execution is not null and execution_currency is not null)
      or (remaining_execution_status='TO_VERIFY' and remaining_execution is null)
    ),
  drop constraint if exists deal_finance_authority_v7_execution_pair_check,
  add constraint deal_finance_authority_v7_execution_pair_check
    check ((actual_spend_status is null)=(remaining_execution_status is null));

alter table portal_private.finance_events_v7
  drop constraint if exists finance_events_v7_event_type_check;
alter table portal_private.finance_events_v7
  add constraint finance_events_v7_event_type_check check (event_type in (
    'CLIENT_PAYMENT_CONFIRMED',
    'DEAL_FINANCIAL_OBLIGATION_CONFIRMED',
    'DEAL_PAYMENT_SCHEDULE_CONFIRMED',
    'PAYMENT_TRIGGER_CONFIRMED',
    'OUTGOING_PAYMENT_CONFIRMED',
    'OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED',
    'PAYMENT_RESOURCE_CHAIN_CONFIRMED',
    'DOCUMENTARY_STATUS_CONFIRMED',
    'DEAL_EXECUTION_STATE_CONFIRMED'
  ));

-- Keep the original controlled writer intact for all existing event types and wrap only the new
-- Finance execution authority event. This preserves the existing mutation contour.
alter function portal_private.persist_finance_event_v7(jsonb,jsonb)
  rename to persist_finance_event_v7_pre_execution_authority;

create or replace function portal_private.persist_finance_event_v7(p_actor jsonb,p_event jsonb)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_event_type text:=upper(coalesce(p_event->>'event_type',''));
  v_actor_id text:=coalesce(p_actor->>'identity_id','');
  v_actor_role text:=upper(coalesce(p_actor->>'role',''));
  v_correlation uuid;
  v_idem text:=coalesce(p_event->>'idempotency_key','');
  v_payload jsonb:=coalesce(p_event->'payload','{}'::jsonb);
  v_source_refs jsonb:=coalesce(p_event->'source_refs','[]'::jsonb);
  v_source_version text:=coalesce(p_event->>'source_version','');
  v_source_timestamp timestamptz;
  v_effective_at timestamptz;
  v_payload_hash text:=md5(coalesce(p_event::text,''));
  v_existing portal_private.finance_events_v7%rowtype;
  v_deal portal_private.deals%rowtype;
  v_current portal_private.deal_finance_authority_v7%rowtype;
  v_current_count integer:=0;
  v_expected uuid;
  v_new_authority uuid;
  v_result jsonb;
  v_currency text;
  v_actual_status text;
  v_remaining_status text;
  v_execution_status text;
  v_actual numeric;
  v_remaining numeric;
begin
  if v_event_type<>'DEAL_EXECUTION_STATE_CONFIRMED' then
    return portal_private.persist_finance_event_v7_pre_execution_authority(p_actor,p_event);
  end if;

  if v_actor_role<>'FINANCE' or v_actor_id<>'AI-FINANCE' then
    return jsonb_build_object('accepted',false,'reason_code','FINANCE_ROLE_BINDING_REQUIRED','action_class','TECHNICAL_MATERIALIZATION_REQUIRED');
  end if;
  begin v_correlation:=(p_actor->>'correlation_id')::uuid; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','CORRELATION_ID_REQUIRED','action_class','TECHNICAL_MATERIALIZATION_REQUIRED');
  end;
  if v_idem !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$' then
    return jsonb_build_object('accepted',false,'reason_code','IDEMPOTENCY_KEY_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end if;
  if jsonb_typeof(v_payload)<>'object' or jsonb_typeof(v_source_refs)<>'array' or jsonb_array_length(v_source_refs)=0 or btrim(v_source_version)='' then
    return jsonb_build_object('accepted',false,'reason_code','SOURCE_LOCK_INCOMPLETE','action_class','FINANCE_ACTION_REQUIRED');
  end if;
  begin v_source_timestamp:=(p_event->>'source_timestamp')::timestamptz; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','SOURCE_TIMESTAMP_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end;
  begin v_effective_at:=(p_event->>'effective_at')::timestamptz; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','EFFECTIVE_AT_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end;
  begin v_expected:=nullif(p_event->>'expected_current_authority_id','')::uuid; exception when others then
    return jsonb_build_object('accepted',false,'reason_code','EXPECTED_AUTHORITY_ID_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end;

  perform pg_advisory_xact_lock(hashtext('finance-v7:'||v_actor_id||':'||v_idem));
  select * into v_existing from portal_private.finance_events_v7 where actor_id=v_actor_id and idempotency_key=v_idem limit 1;
  if found then
    if v_existing.payload_hash<>v_payload_hash then
      return jsonb_build_object('accepted',false,'reason_code','FINANCE_EVENT_IDEMPOTENCY_CONFLICT','action_class','FINANCE_ACTION_REQUIRED');
    end if;
    return v_existing.result_snapshot||jsonb_build_object('idempotent_replay',true,'finance_event_id',v_existing.id);
  end if;

  select * into v_deal
    from portal_private.deals
   where deal_id=nullif(btrim(coalesce(p_event->>'deal_id','')),'')
     and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
   order by updated_at desc
   limit 1;
  if not found then
    return jsonb_build_object('accepted',false,'reason_code','DEAL_NOT_FOUND','action_class','FINANCE_ACTION_REQUIRED');
  end if;

  select count(*) into v_current_count
    from portal_private.deal_finance_authority_v7 a
   where a.deal_key=v_deal.id and a.source_locked=true
     and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
     and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
     and not exists(
       select 1 from portal_private.deal_finance_authority_v7 n
        where n.supersedes_id=a.id and n.source_locked=true
          and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
          and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
     );
  if v_current_count<>1 then
    return jsonb_build_object('accepted',false,'reason_code',case when v_current_count=0 then 'CURRENT_FINANCE_AUTHORITY_REQUIRED' else 'FINANCE_AUTHORITY_CONFLICT' end,'action_class','FINANCE_ACTION_REQUIRED');
  end if;

  select * into v_current
    from portal_private.deal_finance_authority_v7 a
   where a.deal_key=v_deal.id and a.source_locked=true
     and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
     and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
     and not exists(
       select 1 from portal_private.deal_finance_authority_v7 n
        where n.supersedes_id=a.id and n.source_locked=true
          and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
          and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
     )
   limit 1;
  if v_expected is null or v_expected<>v_current.id then
    return jsonb_build_object('accepted',false,'reason_code','STALE_AUTHORITY','action_class','FINANCE_ACTION_REQUIRED','current_authority_id',v_current.id);
  end if;

  v_currency:=upper(btrim(coalesce(v_payload->>'currency','')));
  v_actual_status:=upper(coalesce(nullif(v_payload->>'actual_spend_status',''),case when upper(coalesce(v_payload->>'actual_spend',''))='TO_VERIFY' then 'TO_VERIFY' else 'AUTHORITATIVE' end));
  v_remaining_status:=upper(coalesce(nullif(v_payload->>'remaining_execution_status',''),case when upper(coalesce(v_payload->>'remaining_execution',''))='TO_VERIFY' then 'TO_VERIFY' else 'AUTHORITATIVE' end));
  v_execution_status:=nullif(btrim(coalesce(v_payload->>'execution_status','')),'');

  if v_currency!~'^[A-Z]{3}$' or v_execution_status is null
     or v_actual_status not in ('AUTHORITATIVE','TO_VERIFY')
     or v_remaining_status not in ('AUTHORITATIVE','TO_VERIFY') then
    return jsonb_build_object('accepted',false,'reason_code','FINANCE_EXECUTION_PAYLOAD_INVALID','action_class','FINANCE_ACTION_REQUIRED');
  end if;

  if v_actual_status='AUTHORITATIVE' then
    begin v_actual:=(v_payload->>'actual_spend')::numeric; exception when others then
      return jsonb_build_object('accepted',false,'reason_code','ACTUAL_SPEND_INVALID','action_class','FINANCE_ACTION_REQUIRED');
    end;
    if v_actual is null or v_actual<0 then
      return jsonb_build_object('accepted',false,'reason_code','ACTUAL_SPEND_INVALID','action_class','FINANCE_ACTION_REQUIRED');
    end if;
  else
    v_actual:=null;
  end if;

  if v_remaining_status='AUTHORITATIVE' then
    begin v_remaining:=(v_payload->>'remaining_execution')::numeric; exception when others then
      return jsonb_build_object('accepted',false,'reason_code','REMAINING_EXECUTION_INVALID','action_class','FINANCE_ACTION_REQUIRED');
    end;
    if v_remaining is null then
      return jsonb_build_object('accepted',false,'reason_code','REMAINING_EXECUTION_INVALID','action_class','FINANCE_ACTION_REQUIRED');
    end if;
  else
    v_remaining:=null;
  end if;

  v_new_authority:=gen_random_uuid();
  insert into portal_private.deal_finance_authority_v7(
    id,deal_key,total_to_receive,due_now,expected_not_due,future_conditional,
    obligation_currency,contractual_payment_currency,mixed_inbound_accounting_currency,
    actual_spend,actual_spend_status,remaining_execution,remaining_execution_status,execution_currency,execution_status,
    finance_status,documentary_status,authority_state,lifecycle_state,effective_at,
    supersedes_id,supersedes_authority_refs,source_version,source_timestamp,source_refs,source_locked,
    actor_id,actor_role,correlation_id,idempotency_key
  ) values(
    v_new_authority,v_current.deal_key,v_current.total_to_receive,v_current.due_now,v_current.expected_not_due,v_current.future_conditional,
    v_current.obligation_currency,v_current.contractual_payment_currency,v_current.mixed_inbound_accounting_currency,
    v_actual,v_actual_status,v_remaining,v_remaining_status,v_currency::char(3),v_execution_status,
    v_current.finance_status,v_current.documentary_status,'AUTHORITATIVE','CURRENT',v_effective_at,
    v_current.id,
    coalesce(v_current.supersedes_authority_refs,'[]'::jsonb)||jsonb_build_array(jsonb_build_object('source_type','FINANCE_AUTHORITY','source_id',v_current.id::text)),
    v_source_version,v_source_timestamp,v_source_refs,true,
    v_actor_id,v_actor_role,v_correlation,v_idem
  );

  v_result:=jsonb_build_object(
    'accepted',true,
    'event_type',v_event_type,
    'deal_id',v_deal.deal_id,
    'authority_id',v_new_authority,
    'supersedes_id',v_current.id,
    'actual_spend_status',v_actual_status,
    'remaining_execution_status',v_remaining_status,
    'projection_refresh_required',true
  );

  insert into portal_private.finance_events_v7(
    id,event_type,event_identity,deal_key,payment_key,actor_id,actor_role,correlation_id,idempotency_key,
    payload_hash,expected_current_authority_id,source_refs,source_version,source_timestamp,effective_at,
    request_snapshot,result_snapshot
  ) values(
    gen_random_uuid(),v_event_type,v_event_type||':'||v_deal.deal_id||':'||v_idem,v_deal.id,null,
    v_actor_id,v_actor_role,v_correlation,v_idem,v_payload_hash,v_expected,
    v_source_refs,v_source_version,v_source_timestamp,v_effective_at,p_event,v_result
  );

  return v_result;
end
$$;

revoke all on function portal_private.persist_finance_event_v7_pre_execution_authority(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function portal_private.persist_finance_event_v7(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Extend the existing manifest-bound materializer contract to a Finance authoritative execution-result proposal.
-- The caller still supplies only immutable proposal/conclusion IDs; all business values are loaded server-side.
alter function portal_private.materialize_finance_manifest_v7(jsonb,jsonb)
  rename to materialize_finance_manifest_v7_pre_execution_authority;

create or replace function portal_private.materialize_finance_manifest_v7(p_actor jsonb,p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_actor_role text:=upper(coalesce(p_actor->>'role',''));
  v_actor_id text:=coalesce(p_actor->>'identity_id','');
  v_correlation uuid;
  v_proposal_id uuid;
  v_conclusion_id uuid;
  v_proposal record;
  v_conclusion record;
  v_deal_conclusion record;
  v_state jsonb;
  v_deal_id text;
  v_deal portal_private.deals%rowtype;
  v_current portal_private.deal_finance_authority_v7%rowtype;
  v_source_conclusion_id uuid;
  v_policies jsonb;
  v_policy jsonb;
  v_primary jsonb;
  v_policy_id text;
  v_actual_status text;
  v_remaining_status text;
  v_event jsonb;
  v_result jsonb;
  v_audit_id uuid;
  v_sha text;
  v_reason text;
begin
  begin
    v_proposal_id:=(p_request->>'manifest_id')::uuid;
    v_conclusion_id:=(p_request->>'conclusion_id')::uuid;
  exception when others then
    return portal_private.materialize_finance_manifest_v7_pre_execution_authority(p_actor,p_request);
  end;

  select * into v_proposal from portal_private.ai_coordination_records where record_id=v_proposal_id limit 1;
  if not found or upper(coalesce(v_proposal.payload->>'proposed_action',''))<>'MATERIALIZE_FINANCE_AUTHORITATIVE_RESULT' then
    return portal_private.materialize_finance_manifest_v7_pre_execution_authority(p_actor,p_request);
  end if;

  if v_actor_role<>'FINANCE' or v_actor_id<>'AI-FINANCE' then v_reason:='FINANCE_ROLE_BINDING_REQUIRED'; end if;
  if v_reason is null then
    begin v_correlation:=(p_actor->>'correlation_id')::uuid; exception when others then v_reason:='CORRELATION_ID_REQUIRED'; end;
  end if;
  if v_reason is null and (
       p_request is null or jsonb_typeof(p_request)<>'object'
       or not (p_request ? 'manifest_id') or not (p_request ? 'conclusion_id')
       or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('manifest_id','conclusion_id'))
     ) then v_reason:='CALLER_PAYLOAD_OVERRIDE_FORBIDDEN'; end if;

  if v_reason is null and (
       v_proposal.record_type<>'BUSINESS_CHANGE_PROPOSAL'
       or v_proposal.functional_role::text<>'FINANCE'
       or v_proposal.identity_id<>'AI-FINANCE'
       or coalesce(v_proposal.tool_name,'')<>'business_change_proposal_submit'
       or coalesce(v_proposal.status,'')<>'PROPOSED'
       or coalesce(v_proposal.qa_only,false)=true
       or coalesce(v_proposal.target_type,'')<>'TASK'
       or upper(coalesce(v_proposal.payload->>'target_entity_type',''))<>'TASK'
       or coalesce(v_proposal.payload->>'target_entity_id','')<>coalesce(v_proposal.target_id,'')
       or jsonb_typeof(v_proposal.payload->'proposed_state')<>'object'
     ) then v_reason:='FINANCE_EXECUTION_PROPOSAL_INVALID'; end if;

  v_state:=v_proposal.payload->'proposed_state';
  v_deal_id:=nullif(btrim(coalesce(v_state->>'deal_id','')),'');
  if v_reason is null then
    begin v_source_conclusion_id:=(v_state->>'source_conclusion_id')::uuid; exception when others then v_reason:='FINANCE_EXECUTION_SOURCE_CONCLUSION_REQUIRED'; end;
  end if;

  select * into v_conclusion from portal_private.ai_coordination_records where record_id=v_conclusion_id limit 1;
  if v_reason is null and (
       not found
       or v_conclusion.record_type<>'FUNCTIONAL_CONCLUSION'
       or v_conclusion.functional_role::text<>'FINANCE'
       or v_conclusion.identity_id<>'AI-FINANCE'
       or coalesce(v_conclusion.tool_name,'')<>'functional_conclusion_submit'
       or coalesce(v_conclusion.qa_only,false)=true
       or v_conclusion.status not in ('APPROVED','APPROVED_WITH_CONDITIONS')
       or lower(coalesce(v_conclusion.payload->>'confirmed','false'))<>'true'
       or v_conclusion.target_type<>'TASK'
       or v_conclusion.target_id<>v_proposal.target_id
       or not exists(
         select 1 from jsonb_array_elements_text(coalesce(v_conclusion.source_refs,'[]'::jsonb)) s(value)
          where s.value=v_proposal_id::text or s.value=('BUSINESS_CHANGE_PROPOSAL:'||v_proposal_id::text)
       )
       or exists(select 1 from portal_private.ai_coordination_records n where n.supersedes_id=v_conclusion_id)
       or exists(
         select 1 from portal_private.ai_coordination_records n
          where n.record_type='FUNCTIONAL_CONCLUSION' and n.functional_role::text='FINANCE'
            and n.target_type='TASK' and n.target_id=v_conclusion.target_id and n.version>v_conclusion.version
       )
     ) then v_reason:='FINANCE_EXECUTION_TASK_CONCLUSION_INVALID'; end if;

  select * into v_deal_conclusion from portal_private.ai_coordination_records where record_id=v_source_conclusion_id limit 1;
  if v_reason is null and (
       not found
       or v_deal_conclusion.record_type<>'FUNCTIONAL_CONCLUSION'
       or v_deal_conclusion.functional_role::text<>'FINANCE'
       or v_deal_conclusion.identity_id<>'AI-FINANCE'
       or coalesce(v_deal_conclusion.qa_only,false)=true
       or v_deal_conclusion.status not in ('APPROVED','APPROVED_WITH_CONDITIONS')
       or lower(coalesce(v_deal_conclusion.payload->>'confirmed','false'))<>'true'
       or v_deal_conclusion.target_type<>'DEAL'
       or v_deal_conclusion.target_id<>v_deal_id
       or exists(select 1 from portal_private.ai_coordination_records n where n.supersedes_id=v_source_conclusion_id)
     ) then v_reason:='FINANCE_EXECUTION_DEAL_CONCLUSION_INVALID'; end if;

  if v_reason is null and not exists(
    select 1 from portal_private.staff_tasks t
     where t.task_id=v_proposal.target_id
       and upper(coalesce(t.authority_domain,''))='FINANCE'
       and coalesce(t.assigned_functional_role::text,'')='FINANCE'
  ) then v_reason:='FINANCE_SOURCE_LOCK_TASK_REQUIRED'; end if;

  if v_reason is null and exists(
    select 1 from portal_private.ai_coordination_records n where n.supersedes_id=v_proposal_id
  ) then v_reason:='FINANCE_EXECUTION_PROPOSAL_SUPERSEDED'; end if;

  if v_reason is null then
    select portal_private.ai_role_global_policies_current_v1('FINANCE'::portal_private.ai_business_role_enum) into v_policies;
    select value into v_policy
      from jsonb_array_elements(coalesce(v_policies,'[]'::jsonb)) p(value)
     where coalesce(p.value->>'policy_key',p.value->'policy'->>'policy_key')='FINANCE_GLOBAL_PAYMENT_SEMANTICS'
     order by coalesce((p.value->>'version')::integer,(p.value->'policy'->>'version')::integer,0) desc
     limit 1;
    v_primary:=coalesce(v_policy->'policy'->'rules'->'FUNDING_CURRENCY_PRIMARY_SEMANTICS',v_policy->'rules'->'FUNDING_CURRENCY_PRIMARY_SEMANTICS','{}'::jsonb);
    v_policy_id:=coalesce(v_policy->>'policy_id',v_policy->'policy'->>'policy_id');
    if v_policy is null
       or upper(coalesce(v_primary->>'actual_spend_owner',''))<>'FINANCE'
       or upper(coalesce(v_primary->>'remaining_owner',''))<>'FINANCE'
       or upper(coalesce(v_primary->>'missing_direct_funding_side',''))<>'NOT_SUFFICIENT_FOR_TO_VERIFY'
       or lower(coalesce(v_primary->>'to_verify_only_when_finance_cannot_determine','false'))<>'true'
       or lower(coalesce(v_primary->>'finance_authoritative_zero_when_no_actual_expense','false'))<>'true'
       or (nullif(v_state->>'policy_required','') is not null and v_state->>'policy_required'<>v_policy_id)
    then v_reason:='FINANCE_EXECUTION_POLICY_NOT_ACTIVE'; end if;
  end if;

  select * into v_deal from portal_private.deals
   where deal_id=v_deal_id and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
   order by updated_at desc limit 1;
  if v_reason is null and not found then v_reason:='DEAL_NOT_FOUND'; end if;

  if v_reason is null then
    select * into v_current
      from portal_private.deal_finance_authority_v7 a
     where a.deal_key=v_deal.id and a.source_locked=true
       and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
       and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
       and not exists(
         select 1 from portal_private.deal_finance_authority_v7 n
          where n.supersedes_id=a.id and n.source_locked=true
            and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE')
            and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')
       )
     limit 1;
    if not found then v_reason:='CURRENT_FINANCE_AUTHORITY_REQUIRED'; end if;
  end if;

  if jsonb_typeof(v_state->'actual_spend')='number' then v_actual_status:='AUTHORITATIVE';
  elsif upper(coalesce(v_state->>'actual_spend',''))='TO_VERIFY' then v_actual_status:='TO_VERIFY';
  else v_actual_status:=upper(nullif(v_state->>'actual_spend_status','')); end if;
  if jsonb_typeof(coalesce(v_state->'remaining_execution',v_state->'remaining'))='number' then v_remaining_status:='AUTHORITATIVE';
  elsif upper(coalesce(v_state->>'remaining_execution',v_state->>'remaining',''))='TO_VERIFY' then v_remaining_status:='TO_VERIFY';
  else v_remaining_status:=upper(nullif(v_state->>'remaining_execution_status','')); end if;

  if v_reason is null and (
       v_deal_id is null
       or coalesce(v_state->>'currency','')!~'^[A-Z]{3}$'
       or nullif(btrim(coalesce(v_state->>'status','')),'') is null
       or v_actual_status not in ('AUTHORITATIVE','TO_VERIFY')
       or v_remaining_status not in ('AUTHORITATIVE','TO_VERIFY')
     ) then v_reason:='FINANCE_EXECUTION_STATE_INVALID'; end if;

  v_sha:=encode(sha256(convert_to(coalesce(v_state,'{}'::jsonb)::text,'UTF8')),'hex');
  if v_reason is not null then
    v_audit_id:=gen_random_uuid();
    insert into portal_private.finance_materializer_audit_v7(
      id,actor_role,actor_id,correlation_id,source_lock_task_id,manifest_record_id,conclusion_record_id,
      manifest_payload_sha256,request_hash,request_snapshot,persist_invoked,outcome,reason_code,persist_result
    ) values(
      v_audit_id,nullif(v_actor_role,''),nullif(v_actor_id,''),v_correlation,v_proposal.target_id,v_proposal_id,v_conclusion_id,
      v_sha,encode(sha256(convert_to(coalesce(p_request,'{}'::jsonb)::text,'UTF8')),'hex'),coalesce(p_request,'{}'::jsonb),false,'DENIED',v_reason,
      jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason)
    );
    return jsonb_build_object('accepted',false,'materialized',false,'persist_invoked',false,'reason_code',v_reason,'counts',jsonb_build_object('total',1,'materialized',0,'skipped',0,'denied',1,'errors',0),'materializer_audit_id',v_audit_id);
  end if;

  v_event:=jsonb_build_object(
    'event_type','DEAL_EXECUTION_STATE_CONFIRMED',
    'deal_id',v_deal_id,
    'expected_current_authority_id',v_current.id::text,
    'idempotency_key','finance-execution:'||v_proposal_id::text,
    'payload',jsonb_build_object(
      'currency',v_state->>'currency',
      'actual_spend',case when v_actual_status='AUTHORITATIVE' then v_state->'actual_spend' else to_jsonb('TO_VERIFY'::text) end,
      'actual_spend_status',v_actual_status,
      'remaining_execution',case when v_remaining_status='AUTHORITATIVE' then coalesce(v_state->'remaining_execution',v_state->'remaining') else to_jsonb('TO_VERIFY'::text) end,
      'remaining_execution_status',v_remaining_status,
      'execution_status',v_state->>'status'
    ),
    'source_refs',jsonb_build_array(
      jsonb_build_object('source_type','SOURCE_LOCK_TASK','source_id',v_proposal.target_id),
      jsonb_build_object('source_type','BUSINESS_CHANGE_PROPOSAL','source_id',v_proposal_id::text),
      jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id',v_source_conclusion_id::text),
      jsonb_build_object('source_type','FINANCE_TASK_CONCLUSION','source_id',v_conclusion_id::text),
      jsonb_build_object('source_type','GLOBAL_ROLE_POLICY','source_id',v_policy_id)
    ),
    'source_version',coalesce(v_policy_id,'FINANCE_GLOBAL_PAYMENT_SEMANTICS'),
    'source_timestamp',v_proposal.created_at::text,
    'effective_at',v_deal_conclusion.created_at::text
  );

  v_result:=portal_private.persist_finance_event_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id',v_correlation,'execution_contour','SERVER_MATERIALIZER_FINANCE_EXECUTION_AUTHORITY'),
    v_event
  );

  v_audit_id:=gen_random_uuid();
  insert into portal_private.finance_materializer_audit_v7(
    id,actor_role,actor_id,correlation_id,source_lock_task_id,manifest_record_id,conclusion_record_id,
    manifest_payload_sha256,event_index,event_payload_sha256,confirmation_status,event_type,idempotency_key,
    source_refs,source_version,source_timestamp,request_hash,request_snapshot,event_snapshot,persist_invoked,outcome,reason_code,persist_result
  ) values(
    v_audit_id,v_actor_role,v_actor_id,v_correlation,v_proposal.target_id,v_proposal_id,v_conclusion_id,
    v_sha,1,encode(sha256(convert_to(v_event::text,'UTF8')),'hex'),'CONFIRMED','DEAL_EXECUTION_STATE_CONFIRMED',v_event->>'idempotency_key',
    v_event->'source_refs',v_event->>'source_version',(v_event->>'source_timestamp')::timestamptz,
    encode(sha256(convert_to(p_request::text,'UTF8')),'hex'),p_request,jsonb_build_object('confirmation_status','CONFIRMED','event',v_event),true,
    case when coalesce((v_result->>'accepted')::boolean,false) then 'MATERIALIZED' else 'DENIED' end,
    case when coalesce((v_result->>'accepted')::boolean,false) then null else v_result->>'reason_code' end,v_result
  );

  return jsonb_build_object(
    'accepted',coalesce((v_result->>'accepted')::boolean,false),
    'materialized',coalesce((v_result->>'accepted')::boolean,false),
    'persist_invoked',true,
    'manifest_id',v_proposal_id,
    'conclusion_id',v_conclusion_id,
    'counts',jsonb_build_object('total',1,'materialized',case when coalesce((v_result->>'accepted')::boolean,false) then 1 else 0 end,'skipped',0,'denied',case when coalesce((v_result->>'accepted')::boolean,false) then 0 else 1 end,'errors',0),
    'events',jsonb_build_array(jsonb_build_object('event_index',1,'outcome',case when coalesce((v_result->>'accepted')::boolean,false) then 'MATERIALIZED' else 'DENIED' end,'result',v_result,'materializer_audit_id',v_audit_id))
  );
end
$$;

revoke all on function portal_private.materialize_finance_manifest_v7_pre_execution_authority(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function portal_private.materialize_finance_manifest_v7(jsonb,jsonb) from public,anon,authenticated,service_role;

-- Reuse the existing durable materialization jobs/recovery loop. The maintenance reconciler now also
-- discovers current Finance authoritative execution-result proposals, while preserving the legacy manifest reconciliation.
alter function portal_private.reconcile_finance_materialization_jobs_v7(integer)
  rename to reconcile_finance_materialization_jobs_v7_pre_execution_authority;

create or replace function portal_private.reconcile_finance_materialization_jobs_v7(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_legacy jsonb;
  v_legacy_created integer:=0;
  v_remaining integer;
  v_candidate record;
  v_job_id uuid;
  v_created integer:=0;
  v_jobs jsonb:='[]'::jsonb;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'FINANCE_MATERIALIZATION_RECONCILIATION_LIMIT_INVALID';
  end if;

  v_legacy:=portal_private.reconcile_finance_materialization_jobs_v7_pre_execution_authority(p_limit);
  v_legacy_created:=coalesce((v_legacy->>'created')::integer,0);
  v_remaining:=greatest(p_limit-v_legacy_created,0);
  if v_remaining=0 then
    return jsonb_build_object('ok',true,'created',v_legacy_created,'jobs',coalesce(v_legacy->'jobs','[]'::jsonb),'legacy',v_legacy,'execution_created',0);
  end if;

  for v_candidate in
    select
      c.record_id as conclusion_record_id,
      c.target_id as source_lock_task_id,
      p.record_id as manifest_record_id,
      encode(sha256(convert_to((p.payload->'proposed_state')::text,'UTF8')),'hex') as manifest_payload_sha256
    from portal_private.ai_coordination_records p
    join portal_private.ai_coordination_records c
      on c.record_type='FUNCTIONAL_CONCLUSION'
     and c.functional_role::text='FINANCE'
     and c.identity_id='AI-FINANCE'
     and coalesce(c.tool_name,'')='functional_conclusion_submit'
     and coalesce(c.qa_only,false)=false
     and c.status in ('APPROVED','APPROVED_WITH_CONDITIONS')
     and lower(coalesce(c.payload->>'confirmed','false'))='true'
     and c.target_type='TASK'
     and c.target_id=p.target_id
     and c.created_at>=p.created_at
     and exists(
       select 1 from jsonb_array_elements_text(coalesce(c.source_refs,'[]'::jsonb)) s(value)
        where s.value=p.record_id::text or s.value=('BUSINESS_CHANGE_PROPOSAL:'||p.record_id::text)
     )
    where p.record_type='BUSINESS_CHANGE_PROPOSAL'
      and p.functional_role::text='FINANCE'
      and p.identity_id='AI-FINANCE'
      and coalesce(p.tool_name,'')='business_change_proposal_submit'
      and coalesce(p.qa_only,false)=false
      and p.status='PROPOSED'
      and p.target_type='TASK'
      and upper(coalesce(p.payload->>'proposed_action',''))='MATERIALIZE_FINANCE_AUTHORITATIVE_RESULT'
      and jsonb_typeof(p.payload->'proposed_state')='object'
      and upper(coalesce(p.payload->>'target_entity_type',''))='TASK'
      and coalesce(p.payload->>'target_entity_id','')=p.target_id
      and exists(
        select 1 from portal_private.staff_tasks t
         where t.task_id=p.target_id
           and upper(coalesce(t.authority_domain,''))='FINANCE'
           and coalesce(t.assigned_functional_role::text,'')='FINANCE'
      )
      and not exists(select 1 from portal_private.ai_coordination_records x where x.supersedes_id=p.record_id)
      and not exists(select 1 from portal_private.ai_coordination_records x where x.supersedes_id=c.record_id)
      and not exists(
        select 1 from portal_private.ai_coordination_records x
         where x.record_type='FUNCTIONAL_CONCLUSION' and x.functional_role::text='FINANCE'
           and x.target_type='TASK' and x.target_id=c.target_id and x.version>c.version
      )
      and not exists(select 1 from portal_private.finance_materialization_jobs_v7 j where j.manifest_record_id=p.record_id)
    order by p.created_at,p.record_id
    limit v_remaining
    for update of p skip locked
  loop
    v_job_id:=null;
    insert into portal_private.finance_materialization_jobs_v7(
      manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,status,next_attempt_at
    ) values(
      v_candidate.manifest_record_id,v_candidate.conclusion_record_id,v_candidate.source_lock_task_id,
      v_candidate.manifest_payload_sha256,'QUEUED',now()
    )
    on conflict(manifest_record_id) do nothing
    returning job_id into v_job_id;
    if v_job_id is not null then
      v_created:=v_created+1;
      v_jobs:=v_jobs||jsonb_build_array(jsonb_build_object('job_id',v_job_id,'manifest_id',v_candidate.manifest_record_id,'conclusion_id',v_candidate.conclusion_record_id,'status','QUEUED'));
    end if;
  end loop;

  return jsonb_build_object(
    'ok',true,
    'created',v_legacy_created+v_created,
    'jobs',coalesce(v_legacy->'jobs','[]'::jsonb)||v_jobs,
    'legacy',v_legacy,
    'execution_created',v_created
  );
end
$$;

revoke all on function portal_private.reconcile_finance_materialization_jobs_v7_pre_execution_authority(integer) from public,anon,authenticated,service_role;
revoke all on function portal_private.reconcile_finance_materialization_jobs_v7(integer) from public,anon,authenticated,service_role;

comment on column portal_private.deal_finance_authority_v7.actual_spend is
'Finance-owned actual spend in execution_currency. NULL is permitted only when actual_spend_status is TO_VERIFY or execution authority is not materialized yet.';
comment on column portal_private.deal_finance_authority_v7.remaining_execution is
'Finance-owned remaining execution amount in execution_currency. Missing funding events do not determine this field.';
comment on function portal_private.persist_finance_event_v7(jsonb,jsonb) is
'Existing Finance controlled writer extended generically for DEAL_EXECUTION_STATE_CONFIRMED. Zero, nonzero and TO_VERIFY are source-driven Finance outcomes; no bank event is synthesized.';
comment on function portal_private.materialize_finance_manifest_v7(jsonb,jsonb) is
'Existing manifest-bound materializer extended to immutable Finance MATERIALIZE_FINANCE_AUTHORITATIVE_RESULT proposals, while preserving legacy Payments V7 manifests.';
