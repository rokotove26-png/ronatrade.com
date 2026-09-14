-- Admin Payments V7 — server-side Finance manifest materializer.
-- Authority content is immutable Finance coordination data, not caller-supplied business fields.
-- Finance prepares an exact manifest with business_change_proposal_submit and confirms that
-- immutable manifest with functional_conclusion_submit. The server accepts only the two record IDs.
-- Authoritative Payments writes remain exclusively inside persist_finance_event_v7(jsonb,jsonb).

create table if not exists portal_private.finance_materializer_audit_v7 (
  id uuid primary key default gen_random_uuid(),
  actor_role text null,
  actor_id text null,
  correlation_id uuid null,
  source_lock_task_id text null,
  manifest_record_id uuid null,
  conclusion_record_id uuid null,
  manifest_record_payload_hash text null,
  manifest_payload_sha256 text null,
  event_index integer null,
  event_payload_sha256 text null,
  confirmation_status text null,
  event_type text null,
  idempotency_key text null,
  source_refs jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_refs)='array'),
  source_version text null,
  source_timestamp timestamptz null,
  request_hash text not null,
  request_snapshot jsonb not null check (jsonb_typeof(request_snapshot)='object'),
  event_snapshot jsonb null check (event_snapshot is null or jsonb_typeof(event_snapshot)='object'),
  persist_invoked boolean not null default false,
  outcome text not null check (outcome in ('MATERIALIZED','SKIPPED','DENIED','ERROR')),
  reason_code text null,
  persist_result jsonb null,
  created_at timestamptz not null default now()
);

create trigger finance_materializer_audit_v7_immutable
before update or delete on portal_private.finance_materializer_audit_v7
for each row execute function portal_private.reject_v7_authority_mutation();

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
  v_manifest_id uuid;
  v_conclusion_id uuid;
  v_manifest record;
  v_conclusion record;
  v_manifest_state jsonb;
  v_events jsonb;
  v_task_id text;
  v_lock_ids jsonb;
  v_manifest_sha text;
  v_request_sha text:=encode(sha256(convert_to(coalesce(p_request,'{}'::jsonb)::text,'UTF8')),'hex');
  v_global_reason text;
  v_event_item jsonb;
  v_event jsonb;
  v_event_payload jsonb;
  v_confirmation text;
  v_event_type text;
  v_idem text;
  v_source_refs jsonb;
  v_source_version text;
  v_source_timestamp timestamptz;
  v_event_sha text;
  v_result jsonb;
  v_persist_actor jsonb;
  v_persist_invoked boolean;
  v_outcome text;
  v_reason text;
  v_index integer:=0;
  v_materialized integer:=0;
  v_skipped integer:=0;
  v_denied integer:=0;
  v_errors integer:=0;
  v_event_results jsonb:='[]'::jsonb;
  v_lock_count integer:=0;
  v_lock_distinct integer:=0;
  v_lock_valid integer:=0;
  v_lock_ref_count integer:=0;
  v_audit_id uuid;
begin
  if v_actor_role<>'FINANCE' or v_actor_id<>'AI-FINANCE' then
    v_global_reason:='FINANCE_ROLE_BINDING_REQUIRED';
  end if;

  if v_global_reason is null then
    begin
      v_correlation:=(p_actor->>'correlation_id')::uuid;
    exception when others then
      v_global_reason:='CORRELATION_ID_REQUIRED';
    end;
  end if;

  if v_global_reason is null and (
       p_request is null
       or jsonb_typeof(p_request)<>'object'
       or not (p_request ? 'manifest_id')
       or not (p_request ? 'conclusion_id')
       or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('manifest_id','conclusion_id'))
     ) then
    v_global_reason:='CALLER_PAYLOAD_OVERRIDE_FORBIDDEN';
  end if;

  if v_global_reason is null then
    begin
      v_manifest_id:=(p_request->>'manifest_id')::uuid;
      v_conclusion_id:=(p_request->>'conclusion_id')::uuid;
    exception when others then
      v_global_reason:='MANIFEST_IDS_INVALID';
    end;
  end if;

  if v_global_reason is not null then
    v_audit_id:=gen_random_uuid();
    insert into portal_private.finance_materializer_audit_v7(
      id,actor_role,actor_id,correlation_id,manifest_record_id,conclusion_record_id,
      request_hash,request_snapshot,persist_invoked,outcome,reason_code,persist_result
    ) values(
      v_audit_id,nullif(v_actor_role,''),nullif(v_actor_id,''),v_correlation,v_manifest_id,v_conclusion_id,
      v_request_sha,coalesce(p_request,'{}'::jsonb),false,'DENIED',v_global_reason,
      jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_global_reason)
    );
    return jsonb_build_object(
      'accepted',false,'materialized',false,'reason_code',v_global_reason,
      'materializer_audit_id',v_audit_id,'persist_invoked',false
    );
  end if;

  select r.* into v_manifest
    from portal_private.ai_coordination_records r
   where r.record_id=v_manifest_id
   limit 1;

  if not found
     or v_manifest.record_type<>'BUSINESS_CHANGE_PROPOSAL'
     or v_manifest.functional_role::text<>'FINANCE'
     or v_manifest.identity_id<>'AI-FINANCE'
     or coalesce(v_manifest.tool_name,'')<>'business_change_proposal_submit'
     or coalesce(v_manifest.status,'')<>'PROPOSED'
     or coalesce(v_manifest.qa_only,false)=true
     or coalesce(v_manifest.target_type,'')<>'TASK'
     or upper(coalesce(v_manifest.payload->>'target_entity_type',''))<>'TASK'
     or coalesce(v_manifest.payload->>'target_entity_id','')<>coalesce(v_manifest.target_id,'')
     or upper(coalesce(v_manifest.payload->>'proposed_action',''))<>'PAYMENTS_V7_MATERIALIZE'
     or lower(coalesce(v_manifest.payload->>'proposed_field',''))<>'payments_v7_materialization_manifest' then
    v_global_reason:='FINANCE_MANIFEST_INVALID';
  else
    v_task_id:=v_manifest.target_id;
    v_manifest_state:=v_manifest.payload->'proposed_state';
  end if;

  if v_global_reason is null and (
       jsonb_typeof(v_manifest_state)<>'object'
       or coalesce(v_manifest_state->>'schema','')<>'PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1'
       or coalesce(v_manifest_state->>'source_lock_task_id','')<>v_task_id
       or jsonb_typeof(v_manifest_state->'source_lock_record_ids')<>'array'
       or jsonb_array_length(v_manifest_state->'source_lock_record_ids')=0
       or jsonb_typeof(v_manifest_state->'events')<>'array'
       or jsonb_array_length(v_manifest_state->'events')=0
       or jsonb_array_length(v_manifest_state->'events')>100
     ) then
    v_global_reason:='FINANCE_MANIFEST_SCHEMA_INVALID';
  end if;

  if v_global_reason is null then
    v_lock_ids:=v_manifest_state->'source_lock_record_ids';
    v_events:=v_manifest_state->'events';
    v_manifest_sha:=encode(sha256(convert_to(v_manifest_state::text,'UTF8')),'hex');

    if not exists(
      select 1 from portal_private.staff_tasks t
       where t.task_id=v_task_id
         and upper(coalesce(t.authority_domain,''))='FINANCE'
         and coalesce(t.assigned_functional_role::text,'')='FINANCE'
    ) then
      v_global_reason:='FINANCE_SOURCE_LOCK_TASK_REQUIRED';
    end if;
  end if;

  if v_global_reason is null and exists(
    select 1 from portal_private.ai_coordination_records n
     where n.supersedes_id=v_manifest_id
  ) then
    v_global_reason:='MANIFEST_SUPERSEDED';
  end if;

  if v_global_reason is null and exists(
    select 1 from portal_private.ai_coordination_records n
     where n.record_type='BUSINESS_CHANGE_PROPOSAL'
       and n.functional_role::text='FINANCE'
       and n.identity_id='AI-FINANCE'
       and n.target_type='TASK'
       and n.target_id=v_task_id
       and upper(coalesce(n.payload->>'proposed_action',''))='PAYMENTS_V7_MATERIALIZE'
       and lower(coalesce(n.payload->>'proposed_field',''))='payments_v7_materialization_manifest'
       and (n.created_at,n.record_id)>(v_manifest.created_at,v_manifest.record_id)
  ) then
    v_global_reason:='MANIFEST_NOT_CURRENT';
  end if;

  if v_global_reason is null then
    select count(*),count(distinct x.value)
      into v_lock_count,v_lock_distinct
      from jsonb_array_elements_text(v_lock_ids) x(value);
    if v_lock_count=0 or v_lock_count<>v_lock_distinct then
      v_global_reason:='SOURCE_LOCK_RECORD_IDS_INVALID';
    end if;
  end if;

  if v_global_reason is null then
    select count(*) into v_lock_valid
      from jsonb_array_elements_text(v_lock_ids) x(value)
      join portal_private.ai_coordination_records r on r.record_id::text=x.value
     where r.functional_role::text='FINANCE'
       and r.identity_id='AI-FINANCE'
       and coalesce(r.qa_only,false)=false
       and (
         (r.record_type='FUNCTIONAL_CONCLUSION'
          and r.status in ('APPROVED','APPROVED_WITH_CONDITIONS')
          and lower(coalesce(r.payload->>'confirmed','false'))='true')
         or (r.record_type='BUSINESS_CHANGE_PROPOSAL' and r.status='PROPOSED')
       );
    if v_lock_valid<>v_lock_count then
      v_global_reason:='FINANCE_SOURCE_LOCK_RECORD_INVALID';
    end if;
  end if;

  if v_global_reason is null and not exists(
    select 1 from jsonb_array_elements_text(coalesce(v_manifest.evidence_refs,'[]'::jsonb)) e(value)
     where e.value=v_task_id or e.value=('TASK:'||v_task_id)
  ) then
    v_global_reason:='MANIFEST_TASK_EVIDENCE_REQUIRED';
  end if;

  if v_global_reason is null then
    select count(*) into v_lock_ref_count
      from jsonb_array_elements_text(v_lock_ids) x(value)
     where exists(
       select 1 from jsonb_array_elements_text(coalesce(v_manifest.evidence_refs,'[]'::jsonb)) e(value)
        where e.value=x.value
           or e.value=('FINANCE_CONCLUSION:'||x.value)
           or e.value=('BUSINESS_CHANGE_PROPOSAL:'||x.value)
           or e.value=('FINANCE_SOURCE_LOCK:'||x.value)
     );
    if v_lock_ref_count<>v_lock_count then
      v_global_reason:='MANIFEST_SOURCE_LOCK_EVIDENCE_REQUIRED';
    end if;
  end if;

  select r.* into v_conclusion
    from portal_private.ai_coordination_records r
   where r.record_id=v_conclusion_id
   limit 1;

  if v_global_reason is null and (
       not found
       or v_conclusion.record_type<>'FUNCTIONAL_CONCLUSION'
       or v_conclusion.functional_role::text<>'FINANCE'
       or v_conclusion.identity_id<>'AI-FINANCE'
       or coalesce(v_conclusion.tool_name,'')<>'functional_conclusion_submit'
       or coalesce(v_conclusion.qa_only,false)=true
       or v_conclusion.status not in ('APPROVED','APPROVED_WITH_CONDITIONS')
       or lower(coalesce(v_conclusion.payload->>'confirmed','false'))<>'true'
       or coalesce(v_conclusion.target_type,'')<>'TASK'
       or coalesce(v_conclusion.target_id,'')<>v_task_id
       or upper(coalesce(v_conclusion.payload->>'entity_type',''))<>'TASK'
       or coalesce(v_conclusion.payload->>'entity_id','')<>v_task_id
       or v_conclusion.created_at<v_manifest.created_at
     ) then
    v_global_reason:='MANIFEST_CONCLUSION_NOT_CONFIRMED';
  end if;

  if v_global_reason is null and not exists(
    select 1 from jsonb_array_elements_text(coalesce(v_conclusion.source_refs,'[]'::jsonb)) s(value)
     where s.value=v_manifest_id::text
        or s.value=('BUSINESS_CHANGE_PROPOSAL:'||v_manifest_id::text)
        or s.value=('PAYMENTS_V7_MANIFEST:'||v_manifest_id::text)
  ) then
    v_global_reason:='CONCLUSION_MANIFEST_BINDING_REQUIRED';
  end if;

  if v_global_reason is null and exists(
    select 1 from portal_private.ai_coordination_records n
     where n.supersedes_id=v_conclusion_id
  ) then
    v_global_reason:='MANIFEST_CONCLUSION_SUPERSEDED';
  end if;

  if v_global_reason is null and exists(
    select 1 from portal_private.ai_coordination_records n
     where n.record_type='FUNCTIONAL_CONCLUSION'
       and n.functional_role::text='FINANCE'
       and n.target_type='TASK'
       and n.target_id=v_task_id
       and n.version>v_conclusion.version
  ) then
    v_global_reason:='MANIFEST_CONCLUSION_NOT_CURRENT';
  end if;

  if v_global_reason is not null then
    v_audit_id:=gen_random_uuid();
    insert into portal_private.finance_materializer_audit_v7(
      id,actor_role,actor_id,correlation_id,source_lock_task_id,manifest_record_id,conclusion_record_id,
      manifest_record_payload_hash,manifest_payload_sha256,request_hash,request_snapshot,
      persist_invoked,outcome,reason_code,persist_result
    ) values(
      v_audit_id,v_actor_role,v_actor_id,v_correlation,v_task_id,v_manifest_id,v_conclusion_id,
      v_manifest.payload_hash,v_manifest_sha,v_request_sha,p_request,false,'DENIED',v_global_reason,
      jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_global_reason)
    );
    return jsonb_build_object(
      'accepted',false,'materialized',false,'reason_code',v_global_reason,
      'manifest_id',v_manifest_id,'conclusion_id',v_conclusion_id,
      'manifest_payload_sha256',v_manifest_sha,
      'materializer_audit_id',v_audit_id,'persist_invoked',false
    );
  end if;

  v_persist_actor:=jsonb_build_object(
    'role','FINANCE','identity_id','AI-FINANCE','correlation_id',v_correlation,
    'execution_contour','SERVER_MATERIALIZER_MANIFEST_BOUND'
  );

  for v_event_item in select value from jsonb_array_elements(v_events)
  loop
    v_index:=v_index+1;
    v_result:=null;
    v_reason:=null;
    v_outcome:='DENIED';
    v_persist_invoked:=false;
    v_source_timestamp:=null;
    v_event:=case when jsonb_typeof(v_event_item)='object' then v_event_item->'event' else null end;
    v_confirmation:=upper(coalesce(v_event_item->>'confirmation_status',''));

    if jsonb_typeof(v_event_item)<>'object'
       or v_confirmation not in ('CONFIRMED','TO_VERIFY')
       or jsonb_typeof(v_event)<>'object' then
      v_reason:='MANIFEST_EVENT_SCHEMA_INVALID';
    end if;

    v_event_type:=upper(coalesce(v_event->>'event_type',''));
    v_idem:=coalesce(v_event->>'idempotency_key','');
    v_source_refs:=coalesce(v_event->'source_refs','[]'::jsonb);
    v_source_version:=coalesce(v_event->>'source_version','');
    v_event_payload:=coalesce(v_event->'payload','{}'::jsonb);
    v_event_sha:=case when v_event is null then null else encode(sha256(convert_to(v_event::text,'UTF8')),'hex') end;

    if v_reason is null and (
         v_event_type=''
         or jsonb_typeof(v_source_refs)<>'array'
         or jsonb_array_length(v_source_refs)=0
         or btrim(v_source_version)=''
         or v_idem !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$'
       ) then
      v_reason:='SOURCE_LOCK_INCOMPLETE';
    end if;

    if v_reason is null and exists(
      select 1 from jsonb_array_elements(v_source_refs) r(value)
       where jsonb_typeof(r.value)<>'object'
          or btrim(coalesce(r.value->>'source_type',''))=''
          or btrim(coalesce(r.value->>'source_id',''))=''
    ) then
      v_reason:='SOURCE_REFS_INVALID';
    end if;

    if v_reason is null then
      begin
        v_source_timestamp:=(v_event->>'source_timestamp')::timestamptz;
      exception when others then
        v_reason:='SOURCE_TIMESTAMP_INVALID';
      end;
    end if;

    if v_reason is null and not exists(
      select 1 from jsonb_array_elements(v_source_refs) r(value)
       where upper(coalesce(r.value->>'source_type','')) in ('TASK','SOURCE_LOCK_TASK')
         and r.value->>'source_id'=v_task_id
    ) then
      v_reason:='SOURCE_LOCK_TASK_REF_REQUIRED';
    end if;

    if v_reason is null then
      select count(*) into v_lock_ref_count
        from jsonb_array_elements_text(v_lock_ids) x(value)
       where exists(
         select 1 from jsonb_array_elements(v_source_refs) r(value)
          where upper(coalesce(r.value->>'source_type','')) in ('FINANCE_CONCLUSION','FINANCE_SOURCE_LOCK','BUSINESS_CHANGE_PROPOSAL')
            and r.value->>'source_id'=x.value
       );
      if v_lock_ref_count<>v_lock_count then
        v_reason:='FINANCE_SOURCE_LOCK_REF_REQUIRED';
      end if;
    end if;

    if v_reason is null and (
         v_confirmation='TO_VERIFY'
         or v_event_payload::text ~ '(:|\[)[[:space:]]*"TO_VERIFY"'
       ) then
      v_outcome:='SKIPPED';
      v_reason:='TO_VERIFY_NOT_MATERIALIZED';
      v_result:=jsonb_build_object('accepted',true,'materialized',false,'skipped',true,'reason_code',v_reason);
      v_skipped:=v_skipped+1;
    end if;

    if v_reason is null and v_event_type='PAYMENT_RESOURCE_CHAIN_CONFIRMED' then
      if upper(btrim(coalesce(v_event_payload->>'conversion_source_basis','')))=''
         or upper(coalesce(v_event_payload->>'conversion_source_basis','')) like '%CBR%'
         or upper(coalesce(v_event_payload->>'conversion_source_basis','')) like '%MARKET%'
         or upper(coalesce(v_event_payload->>'conversion_source_basis','')) like '%CONTRACTUAL_FX%'
         or upper(coalesce(v_event_payload->>'conversion_source_basis','')) like '%APPROX%'
         or upper(coalesce(v_event_payload->>'conversion_source_basis','')) like '%SYNTHETIC%' then
        v_reason:='SYNTHETIC_FX_FORBIDDEN';
      end if;
    end if;

    if v_reason is null then
      v_persist_invoked:=true;
      begin
        v_result:=portal_private.persist_finance_event_v7(v_persist_actor,v_event);
        if coalesce((v_result->>'accepted')::boolean,false) then
          v_outcome:='MATERIALIZED';
          v_materialized:=v_materialized+1;
          v_result:=v_result||jsonb_build_object('materialized',true);
        else
          v_outcome:='DENIED';
          v_reason:=coalesce(v_result->>'reason_code','FINANCE_EVENT_NOT_MATERIALIZED');
          v_denied:=v_denied+1;
          v_result:=v_result||jsonb_build_object('materialized',false);
        end if;
      exception when others then
        v_outcome:='ERROR';
        v_reason:='FINANCE_EVENT_PERSISTENCE_FAILED';
        v_errors:=v_errors+1;
        v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason);
      end;
    elsif v_outcome<>'SKIPPED' then
      v_outcome:='DENIED';
      v_denied:=v_denied+1;
      v_result:=jsonb_build_object('accepted',false,'materialized',false,'reason_code',v_reason);
    end if;

    v_audit_id:=gen_random_uuid();
    insert into portal_private.finance_materializer_audit_v7(
      id,actor_role,actor_id,correlation_id,source_lock_task_id,manifest_record_id,conclusion_record_id,
      manifest_record_payload_hash,manifest_payload_sha256,event_index,event_payload_sha256,
      confirmation_status,event_type,idempotency_key,source_refs,source_version,source_timestamp,
      request_hash,request_snapshot,event_snapshot,persist_invoked,outcome,reason_code,persist_result
    ) values(
      v_audit_id,v_actor_role,v_actor_id,v_correlation,v_task_id,v_manifest_id,v_conclusion_id,
      v_manifest.payload_hash,v_manifest_sha,v_index,v_event_sha,
      nullif(v_confirmation,''),nullif(v_event_type,''),nullif(v_idem,''),v_source_refs,nullif(v_source_version,''),v_source_timestamp,
      v_request_sha,p_request,v_event_item,v_persist_invoked,v_outcome,v_reason,v_result
    );

    v_event_results:=v_event_results||jsonb_build_array(jsonb_build_object(
      'event_index',v_index,'event_payload_sha256',v_event_sha,'outcome',v_outcome,
      'reason_code',v_reason,'persist_invoked',v_persist_invoked,'result',v_result,
      'materializer_audit_id',v_audit_id
    ));
  end loop;

  return jsonb_build_object(
    'accepted',(v_denied=0 and v_errors=0),
    'materialized',(v_materialized>0),
    'skipped',(v_skipped>0),
    'manifest_id',v_manifest_id,
    'conclusion_id',v_conclusion_id,
    'manifest_payload_sha256',v_manifest_sha,
    'counts',jsonb_build_object(
      'total',v_index,'materialized',v_materialized,'skipped',v_skipped,'denied',v_denied,'errors',v_errors
    ),
    'events',v_event_results,
    'persist_invoked',(v_materialized+v_denied+v_errors)>0
  );
end
$$;

revoke all on portal_private.finance_materializer_audit_v7 from public,anon,authenticated,service_role;
revoke all on function portal_private.materialize_finance_manifest_v7(jsonb,jsonb) from public,anon,authenticated,service_role;

comment on function portal_private.materialize_finance_manifest_v7(jsonb,jsonb) is
'Payments V7 manifest-bound server materializer. Caller supplies only immutable Finance manifest/conclusion IDs. Exact event payload is loaded from the current business_change_proposal_submit manifest, verified against a current confirmed functional_conclusion_submit, SHA-256 hashed and audited, then canonical business mutation delegates only to persist_finance_event_v7.';
