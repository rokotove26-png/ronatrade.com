-- Admin Payments V7 — server-side Finance fact materializer.
-- Execution contour is independent of ChatGPT/MCP tool discovery.
-- Finance AI remains the source-lock authority; authoritative business writes still occur
-- only inside portal_private.persist_finance_event_v7(jsonb,jsonb).

create table if not exists portal_private.finance_materializer_audit_v7 (
  id uuid primary key default gen_random_uuid(),
  actor_role text null,
  actor_id text null,
  correlation_id uuid null,
  source_lock_task_id text null,
  source_lock_record_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_lock_record_ids)='array'),
  confirmation_status text null,
  event_type text null,
  idempotency_key text null,
  source_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_refs)='array'),
  source_version text null,
  source_timestamp timestamptz null,
  request_hash text not null,
  request_snapshot jsonb not null check (jsonb_typeof(request_snapshot)='object'),
  persist_invoked boolean not null default false,
  outcome text not null check (outcome in ('MATERIALIZED','SKIPPED','DENIED','ERROR')),
  reason_code text null,
  persist_result jsonb null,
  created_at timestamptz not null default now()
);

create trigger finance_materializer_audit_v7_immutable
before update or delete on portal_private.finance_materializer_audit_v7
for each row execute function portal_private.reject_v7_authority_mutation();

create or replace function portal_private.materialize_finance_fact_v7(p_actor jsonb,p_fact jsonb)
returns jsonb
language plpgsql
security invoker
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_actor_role text:=upper(coalesce(p_actor->>'role',''));
  v_actor_id text:=coalesce(p_actor->>'identity_id','');
  v_correlation uuid;
  v_confirmation text:=upper(coalesce(p_fact->>'confirmation_status',''));
  v_event_type text:=upper(coalesce(p_fact->>'event_type',''));
  v_idem text:=coalesce(p_fact->>'idempotency_key','');
  v_source_refs jsonb:=coalesce(p_fact->'source_refs','[]'::jsonb);
  v_source_version text:=coalesce(p_fact->>'source_version','');
  v_source_timestamp timestamptz;
  v_task_id text:=nullif(btrim(coalesce(p_fact->>'source_lock_task_id','')),'');
  v_lock_ids jsonb:=coalesce(p_fact->'source_lock_record_ids','[]'::jsonb);
  v_payload jsonb:=coalesce(p_fact->'payload','{}'::jsonb);
  v_event jsonb;
  v_result jsonb;
  v_outcome text:='DENIED';
  v_reason text;
  v_persist_invoked boolean:=false;
  v_audit_id uuid:=gen_random_uuid();
  v_lock_count integer:=0;
  v_lock_distinct integer:=0;
  v_lock_valid integer:=0;
  v_lock_ref_count integer:=0;
  v_task_count integer:=0;
  v_request_hash text:=md5(coalesce(p_fact::text,''));
begin
  <<materialize>>
  begin
    if v_actor_role<>'FINANCE' or v_actor_id<>'AI-FINANCE' then
      v_reason:='FINANCE_ROLE_BINDING_REQUIRED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','TECHNICAL_MATERIALIZATION_REQUIRED');
      exit materialize;
    end if;

    begin
      v_correlation:=(p_actor->>'correlation_id')::uuid;
    exception when others then
      v_reason:='CORRELATION_ID_REQUIRED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','TECHNICAL_MATERIALIZATION_REQUIRED');
      exit materialize;
    end;

    if v_confirmation not in ('CONFIRMED','TO_VERIFY') then
      v_reason:='FINANCE_CONFIRMATION_STATUS_REQUIRED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    if jsonb_typeof(v_source_refs)<>'array' or jsonb_array_length(v_source_refs)=0
       or btrim(v_source_version)=''
       or v_idem !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$'
       or v_task_id is null
       or jsonb_typeof(v_lock_ids)<>'array' or jsonb_array_length(v_lock_ids)=0 then
      v_reason:='SOURCE_LOCK_INCOMPLETE';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    if exists(
      select 1
        from jsonb_array_elements(v_source_refs) r(value)
       where jsonb_typeof(r.value)<>'object'
          or btrim(coalesce(r.value->>'source_type',''))=''
          or btrim(coalesce(r.value->>'source_id',''))=''
    ) then
      v_reason:='SOURCE_REFS_INVALID';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    begin
      v_source_timestamp:=(p_fact->>'source_timestamp')::timestamptz;
    exception when others then
      v_reason:='SOURCE_TIMESTAMP_INVALID';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end;

    select count(*) into v_task_count
      from portal_private.staff_tasks t
     where t.task_id=v_task_id
       and upper(coalesce(t.authority_domain,''))='FINANCE'
       and coalesce(t.assigned_functional_role::text,'')='FINANCE';
    if v_task_count<>1 then
      v_reason:='FINANCE_SOURCE_LOCK_TASK_REQUIRED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    if not exists(
      select 1 from jsonb_array_elements(v_source_refs) r(value)
       where upper(coalesce(r.value->>'source_type','')) in ('TASK','SOURCE_LOCK_TASK')
         and r.value->>'source_id'=v_task_id
    ) then
      v_reason:='SOURCE_LOCK_TASK_REF_REQUIRED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    select count(*),count(distinct x.value)
      into v_lock_count,v_lock_distinct
      from jsonb_array_elements_text(v_lock_ids) x(value);
    if v_lock_count=0 or v_lock_count<>v_lock_distinct then
      v_reason:='SOURCE_LOCK_RECORD_IDS_INVALID';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    select count(*) into v_lock_valid
      from jsonb_array_elements_text(v_lock_ids) x(value)
      join portal_private.ai_coordination_records r on r.record_id::text=x.value
     where r.functional_role::text='FINANCE'
       and r.identity_id='AI-FINANCE'
       and r.record_type='FUNCTIONAL_CONCLUSION'
       and r.status in ('APPROVED','APPROVED_WITH_CONDITIONS')
       and lower(coalesce(r.payload->>'confirmed','false'))='true'
       and (
         r.target_id=v_task_id
         or r.source_refs ? v_task_id
         or r.source_refs ? ('TASK:'||v_task_id)
       );
    if v_lock_valid<>v_lock_count then
      v_reason:='FINANCE_SOURCE_LOCK_RECORD_INVALID';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    select count(*) into v_lock_ref_count
      from jsonb_array_elements_text(v_lock_ids) x(value)
     where exists(
       select 1 from jsonb_array_elements(v_source_refs) r(value)
        where upper(coalesce(r.value->>'source_type','')) in ('FINANCE_CONCLUSION','FINANCE_SOURCE_LOCK')
          and r.value->>'source_id'=x.value
     );
    if v_lock_ref_count<>v_lock_count then
      v_reason:='FINANCE_SOURCE_LOCK_REF_REQUIRED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
      exit materialize;
    end if;

    -- Any explicit TO_VERIFY business value is fail-closed. A confirmed payment may still
    -- carry unresolved Deal allocation through attribution_mode=SCOPE_ONLY; that is not a
    -- TO_VERIFY fact and persist_finance_event_v7 preserves it as unresolved allocation.
    if v_confirmation='TO_VERIFY'
       or v_payload::text ~ '(:|\[)[[:space:]]*"TO_VERIFY"' then
      v_outcome:='SKIPPED';
      v_reason:='TO_VERIFY_NOT_MATERIALIZED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'skipped',true,'reason_code',v_reason,'action_class','FINANCE_SOURCE_LOCK_REQUIRED');
      exit materialize;
    end if;

    if v_event_type='PAYMENT_RESOURCE_CHAIN_CONFIRMED' then
      if upper(btrim(coalesce(v_payload->>'conversion_source_basis','')))=''
         or upper(coalesce(v_payload->>'conversion_source_basis','')) like '%CBR%'
         or upper(coalesce(v_payload->>'conversion_source_basis','')) like '%MARKET%'
         or upper(coalesce(v_payload->>'conversion_source_basis','')) like '%CONTRACTUAL_FX%'
         or upper(coalesce(v_payload->>'conversion_source_basis','')) like '%APPROX%'
         or upper(coalesce(v_payload->>'conversion_source_basis','')) like '%SYNTHETIC%' then
        v_reason:='SYNTHETIC_FX_FORBIDDEN';
        v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','FINANCE_ACTION_REQUIRED');
        exit materialize;
      end if;
    end if;

    -- Wrapper-only fields never reach the canonical persistence primitive.
    v_event:=p_fact-'confirmation_status'-'source_lock_task_id'-'source_lock_record_ids';
    v_persist_invoked:=true;
    begin
      v_result:=portal_private.persist_finance_event_v7(p_actor,v_event);
      if coalesce((v_result->>'accepted')::boolean,false) then
        v_outcome:='MATERIALIZED';
        v_reason:=null;
        v_result:=v_result||jsonb_build_object('materialized',true);
      else
        v_outcome:='DENIED';
        v_reason:=coalesce(v_result->>'reason_code','FINANCE_EVENT_NOT_MATERIALIZED');
        v_result:=v_result||jsonb_build_object('materialized',false);
      end if;
    exception when others then
      v_outcome:='ERROR';
      v_reason:='FINANCE_EVENT_PERSISTENCE_FAILED';
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason,'action_class','TECHNICAL_MATERIALIZATION_REQUIRED');
    end;
  end materialize;

  insert into portal_private.finance_materializer_audit_v7(
    id,actor_role,actor_id,correlation_id,source_lock_task_id,source_lock_record_ids,
    confirmation_status,event_type,idempotency_key,source_refs,source_version,source_timestamp,
    request_hash,request_snapshot,persist_invoked,outcome,reason_code,persist_result
  ) values(
    v_audit_id,nullif(v_actor_role,''),nullif(v_actor_id,''),v_correlation,v_task_id,v_lock_ids,
    nullif(v_confirmation,''),nullif(v_event_type,''),nullif(v_idem,''),v_source_refs,nullif(v_source_version,''),v_source_timestamp,
    v_request_hash,coalesce(p_fact,'{}'::jsonb),v_persist_invoked,v_outcome,v_reason,v_result
  );

  return coalesce(v_result,jsonb_build_object('accepted',false,'materialized',false,'reason_code','MATERIALIZER_RESULT_MISSING'))
         ||jsonb_build_object('materializer_audit_id',v_audit_id,'persist_invoked',v_persist_invoked);
end
$$;

revoke all on portal_private.finance_materializer_audit_v7 from public,anon,authenticated,service_role;
revoke all on function portal_private.materialize_finance_fact_v7(jsonb,jsonb) from public,anon,authenticated,service_role;

comment on function portal_private.materialize_finance_fact_v7(jsonb,jsonb) is
'Payments V7 server-side materializer. Validates FINANCE/AI-FINANCE source-lock and confirmation state, fail-closes TO_VERIFY/synthetic FX, then delegates the only authoritative business mutation to persist_finance_event_v7.';
