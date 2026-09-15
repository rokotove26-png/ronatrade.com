-- Payments V7 — automatic Finance manifest materialization.
-- Existing Finance Pilot tools remain the preparation/source-lock surface.
-- A confirmed FINANCE / AI-FINANCE conclusion bound to an exact PAYMENTS_V7_MATERIALIZE
-- manifest automatically enters the canonical materializer. No ChatGPT write tool is required.

create table if not exists portal_private.finance_materialization_jobs_v7 (
  job_id uuid primary key default gen_random_uuid(),
  manifest_record_id uuid not null,
  conclusion_record_id uuid not null,
  source_lock_task_id text not null,
  manifest_payload_sha256 text not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','RUNNING','MATERIALIZED','SKIPPED','DENIED','PARTIAL','RETRY')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz null,
  last_attempt_at timestamptz null,
  completed_at timestamptz null,
  last_result jsonb null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(manifest_record_id)
);

create table if not exists portal_private.finance_materialization_attempts_v7 (
  attempt_id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  manifest_record_id uuid not null,
  conclusion_record_id uuid not null,
  source_lock_task_id text not null,
  manifest_payload_sha256 text not null,
  attempt_no integer not null check (attempt_no >= 0),
  invocation_source text not null check (invocation_source in ('CONCLUSION_TRIGGER','RECOVERY','IDEMPOTENT_REPLAY')),
  outcome text not null check (outcome in ('MATERIALIZED','SKIPPED','DENIED','PARTIAL','RETRY','IDEMPOTENT_REPLAY')),
  persist_invoked boolean not null default false,
  result_snapshot jsonb null,
  error_text text null,
  created_at timestamptz not null default now()
);

create trigger finance_materialization_attempts_v7_immutable
before update or delete on portal_private.finance_materialization_attempts_v7
for each row execute function portal_private.reject_v7_authority_mutation();

create or replace function portal_private.attempt_finance_materialization_job_v7(
  p_job_id uuid,
  p_invocation_source text default 'RECOVERY'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_job portal_private.finance_materialization_jobs_v7%rowtype;
  v_result jsonb;
  v_actor jsonb;
  v_request jsonb;
  v_attempt integer;
  v_status text;
  v_persist boolean:=false;
  v_errors integer:=0;
  v_denied integer:=0;
  v_materialized integer:=0;
  v_skipped integer:=0;
  v_error text;
begin
  if upper(coalesce(p_invocation_source,'')) not in ('CONCLUSION_TRIGGER','RECOVERY') then
    raise exception 'FINANCE_MATERIALIZATION_INVOCATION_SOURCE_INVALID';
  end if;

  select * into v_job
    from portal_private.finance_materialization_jobs_v7
   where job_id=p_job_id
   for update;

  if not found then
    return jsonb_build_object('ok',false,'reason_code','MATERIALIZATION_JOB_NOT_FOUND','persist_invoked',false);
  end if;

  if v_job.status in ('MATERIALIZED','SKIPPED','DENIED','PARTIAL') then
    insert into portal_private.finance_materialization_attempts_v7(
      job_id,manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,
      attempt_no,invocation_source,outcome,persist_invoked,result_snapshot
    ) values(
      v_job.job_id,v_job.manifest_record_id,v_job.conclusion_record_id,v_job.source_lock_task_id,
      v_job.manifest_payload_sha256,v_job.attempt_count,'IDEMPOTENT_REPLAY','IDEMPOTENT_REPLAY',false,
      jsonb_build_object('status',v_job.status,'idempotent_replay',true)
    );
    return jsonb_build_object(
      'ok',true,'status',v_job.status,'idempotent_replay',true,'persist_invoked',false,
      'job_id',v_job.job_id,'manifest_id',v_job.manifest_record_id,'conclusion_id',v_job.conclusion_record_id
    );
  end if;

  v_attempt:=v_job.attempt_count+1;
  update portal_private.finance_materialization_jobs_v7
     set status='RUNNING',attempt_count=v_attempt,last_attempt_at=now(),updated_at=now(),last_error=null
   where job_id=v_job.job_id;

  v_actor:=jsonb_build_object(
    'role','FINANCE',
    'identity_id','AI-FINANCE',
    'correlation_id',v_job.job_id,
    'execution_contour','SERVER_AUTO_MATERIALIZER_MANIFEST_BOUND'
  );
  v_request:=jsonb_build_object(
    'manifest_id',v_job.manifest_record_id,
    'conclusion_id',v_job.conclusion_record_id
  );

  begin
    v_result:=portal_private.materialize_finance_manifest_v7(v_actor,v_request);
    v_persist:=coalesce((v_result->>'persist_invoked')::boolean,false);
    v_errors:=coalesce((v_result#>>'{counts,errors}')::integer,0);
    v_denied:=coalesce((v_result#>>'{counts,denied}')::integer,0);
    v_materialized:=coalesce((v_result#>>'{counts,materialized}')::integer,0);
    v_skipped:=coalesce((v_result#>>'{counts,skipped}')::integer,0);

    if v_errors>0 then
      v_status:='RETRY';
    elsif v_materialized>0 and v_denied>0 then
      v_status:='PARTIAL';
    elsif v_materialized>0 then
      v_status:='MATERIALIZED';
    elsif coalesce((v_result->>'accepted')::boolean,false) and v_skipped>0 then
      v_status:='SKIPPED';
    else
      v_status:='DENIED';
    end if;
  exception when others then
    v_status:='RETRY';
    v_error:=left(sqlerrm,1000);
    v_result:=jsonb_build_object(
      'accepted',false,'materialized',false,'persist_invoked',false,
      'reason_code','AUTO_MATERIALIZATION_EXCEPTION'
    );
    v_persist:=false;
  end;

  update portal_private.finance_materialization_jobs_v7
     set status=v_status,
         next_attempt_at=case when v_status='RETRY' then now()+interval '5 minutes' else null end,
         completed_at=case when v_status in ('MATERIALIZED','SKIPPED','DENIED','PARTIAL') then now() else null end,
         last_result=v_result,
         last_error=v_error,
         updated_at=now()
   where job_id=v_job.job_id;

  insert into portal_private.finance_materialization_attempts_v7(
    job_id,manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,
    attempt_no,invocation_source,outcome,persist_invoked,result_snapshot,error_text
  ) values(
    v_job.job_id,v_job.manifest_record_id,v_job.conclusion_record_id,v_job.source_lock_task_id,
    v_job.manifest_payload_sha256,v_attempt,upper(p_invocation_source),v_status,v_persist,v_result,v_error
  );

  return jsonb_build_object(
    'ok',v_status in ('MATERIALIZED','SKIPPED'),
    'status',v_status,
    'job_id',v_job.job_id,
    'manifest_id',v_job.manifest_record_id,
    'conclusion_id',v_job.conclusion_record_id,
    'attempt_no',v_attempt,
    'persist_invoked',v_persist,
    'data',v_result
  );
end
$$;

create or replace function portal_private.auto_materialize_finance_conclusion_v7()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_manifest record;
  v_manifest_sha text;
  v_job portal_private.finance_materialization_jobs_v7%rowtype;
  v_job_id uuid;
  v_terminal boolean:=false;
  v_current boolean:=false;
  v_error text;
begin
  -- Unrelated conclusions are deliberately ignored. This automation belongs only to Finance.
  if new.record_type<>'FUNCTIONAL_CONCLUSION'
     or new.functional_role::text<>'FINANCE'
     or new.identity_id<>'AI-FINANCE'
     or coalesce(new.tool_name,'')<>'functional_conclusion_submit'
     or coalesce(new.qa_only,false)=true
     or new.status not in ('APPROVED','APPROVED_WITH_CONDITIONS')
     or lower(coalesce(new.payload->>'confirmed','false'))<>'true'
     or coalesce(new.target_type,'')<>'TASK' then
    return new;
  end if;

  begin
    select r.* into v_manifest
      from portal_private.ai_coordination_records r
     where r.record_type='BUSINESS_CHANGE_PROPOSAL'
       and r.functional_role::text='FINANCE'
       and r.identity_id='AI-FINANCE'
       and coalesce(r.tool_name,'')='business_change_proposal_submit'
       and coalesce(r.qa_only,false)=false
       and r.status='PROPOSED'
       and r.target_type='TASK'
       and r.target_id=new.target_id
       and upper(coalesce(r.payload->>'proposed_action',''))='PAYMENTS_V7_MATERIALIZE'
       and lower(coalesce(r.payload->>'proposed_field',''))='payments_v7_materialization_manifest'
       and coalesce(r.payload->'proposed_state'->>'schema','')='PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1'
       and exists(
         select 1
           from jsonb_array_elements_text(coalesce(new.source_refs,'[]'::jsonb)) s(value)
          where s.value=r.record_id::text
             or s.value=('BUSINESS_CHANGE_PROPOSAL:'||r.record_id::text)
             or s.value=('PAYMENTS_V7_MANIFEST:'||r.record_id::text)
       )
     order by r.created_at desc,r.record_id desc
     limit 1;

    if not found then
      return new;
    end if;

    v_manifest_sha:=encode(sha256(convert_to((v_manifest.payload->'proposed_state')::text,'UTF8')),'hex');

    v_current:=not exists(
      select 1 from portal_private.ai_coordination_records n where n.supersedes_id=v_manifest.record_id
    ) and not exists(
      select 1
        from portal_private.ai_coordination_records n
       where n.record_type='BUSINESS_CHANGE_PROPOSAL'
         and n.functional_role::text='FINANCE'
         and n.identity_id='AI-FINANCE'
         and n.target_type='TASK'
         and n.target_id=v_manifest.target_id
         and upper(coalesce(n.payload->>'proposed_action',''))='PAYMENTS_V7_MATERIALIZE'
         and lower(coalesce(n.payload->>'proposed_field',''))='payments_v7_materialization_manifest'
         and (n.created_at,n.record_id)>(v_manifest.created_at,v_manifest.record_id)
    );

    insert into portal_private.finance_materialization_jobs_v7(
      manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,status,next_attempt_at
    ) values(
      v_manifest.record_id,new.record_id,new.target_id,v_manifest_sha,
      case when v_current then 'QUEUED' else 'DENIED' end,
      case when v_current then now() else null end
    )
    on conflict(manifest_record_id) do nothing
    returning job_id into v_job_id;

    if v_job_id is null then
      select * into v_job
        from portal_private.finance_materialization_jobs_v7
       where manifest_record_id=v_manifest.record_id
       for update;

      v_terminal:=v_job.status in ('MATERIALIZED','SKIPPED','DENIED','PARTIAL');
      if v_terminal then
        insert into portal_private.finance_materialization_attempts_v7(
          job_id,manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,
          attempt_no,invocation_source,outcome,persist_invoked,result_snapshot
        ) values(
          v_job.job_id,v_job.manifest_record_id,new.record_id,v_job.source_lock_task_id,
          v_job.manifest_payload_sha256,v_job.attempt_count,'IDEMPOTENT_REPLAY','IDEMPOTENT_REPLAY',false,
          jsonb_build_object('status',v_job.status,'duplicate_conclusion_id',new.record_id,'idempotent_replay',true)
        );
        return new;
      end if;

      update portal_private.finance_materialization_jobs_v7
         set conclusion_record_id=new.record_id,
             status=case when v_current then 'QUEUED' else 'DENIED' end,
             next_attempt_at=case when v_current then now() else null end,
             updated_at=now()
       where job_id=v_job.job_id
       returning job_id into v_job_id;
    end if;

    if not v_current then
      select * into v_job from portal_private.finance_materialization_jobs_v7 where job_id=v_job_id;
      insert into portal_private.finance_materialization_attempts_v7(
        job_id,manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,
        attempt_no,invocation_source,outcome,persist_invoked,result_snapshot
      ) values(
        v_job_id,v_manifest.record_id,new.record_id,new.target_id,v_manifest_sha,
        v_job.attempt_count,'CONCLUSION_TRIGGER','DENIED',false,
        jsonb_build_object('reason_code','MANIFEST_NOT_CURRENT','persist_invoked',false)
      );
      return new;
    end if;

    begin
      perform portal_private.attempt_finance_materialization_job_v7(v_job_id,'CONCLUSION_TRIGGER');
    exception when others then
      v_error:=left(sqlerrm,1000);
      update portal_private.finance_materialization_jobs_v7
         set status='RETRY',next_attempt_at=now()+interval '5 minutes',last_error=v_error,updated_at=now()
       where job_id=v_job_id;
      insert into portal_private.finance_materialization_attempts_v7(
        job_id,manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,
        attempt_no,invocation_source,outcome,persist_invoked,result_snapshot,error_text
      )
      select j.job_id,j.manifest_record_id,j.conclusion_record_id,j.source_lock_task_id,j.manifest_payload_sha256,
             j.attempt_count,'CONCLUSION_TRIGGER','RETRY',false,
             jsonb_build_object('reason_code','AUTO_MATERIALIZATION_TRIGGER_ERROR','persist_invoked',false),v_error
        from portal_private.finance_materialization_jobs_v7 j where j.job_id=v_job_id;
    end;
  exception when others then
    -- Materialization automation must never invalidate an already valid Finance conclusion.
    raise warning 'Payments V7 auto materialization isolated failure: %',left(sqlerrm,500);
  end;

  return new;
end
$$;

create trigger finance_auto_materialize_after_conclusion_v7
after insert on portal_private.ai_coordination_records
for each row execute function portal_private.auto_materialize_finance_conclusion_v7();

create or replace function portal_private.recover_finance_materialization_jobs_v7(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_job record;
  v_result jsonb;
  v_results jsonb:='[]'::jsonb;
  v_processed integer:=0;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'FINANCE_MATERIALIZATION_RECOVERY_LIMIT_INVALID';
  end if;

  for v_job in
    select job_id
      from portal_private.finance_materialization_jobs_v7
     where status in ('QUEUED','RETRY')
       and coalesce(next_attempt_at,now())<=now()
     order by coalesce(next_attempt_at,created_at),created_at
     limit p_limit
     for update skip locked
  loop
    v_result:=portal_private.attempt_finance_materialization_job_v7(v_job.job_id,'RECOVERY');
    v_results:=v_results||jsonb_build_array(v_result);
    v_processed:=v_processed+1;
  end loop;

  return jsonb_build_object('ok',true,'processed',v_processed,'results',v_results);
end
$$;

revoke all on portal_private.finance_materialization_jobs_v7 from public,anon,authenticated,service_role;
revoke all on portal_private.finance_materialization_attempts_v7 from public,anon,authenticated,service_role;
revoke all on function portal_private.attempt_finance_materialization_job_v7(uuid,text) from public,anon,authenticated,service_role;
revoke all on function portal_private.auto_materialize_finance_conclusion_v7() from public,anon,authenticated,service_role;
revoke all on function portal_private.recover_finance_materialization_jobs_v7(integer) from public,anon,authenticated,service_role;

comment on function portal_private.auto_materialize_finance_conclusion_v7() is
'Fail-isolated automatic Payments V7 materialization trigger. Only confirmed FINANCE / AI-FINANCE functional conclusions bound to current exact PAYMENTS_V7_MATERIALIZE manifests can invoke materialize_finance_manifest_v7.';
comment on function portal_private.recover_finance_materialization_jobs_v7(integer) is
'Internal retry/recovery worker for queued or transiently failed Payments V7 Finance materialization jobs. Not a ChatGPT tool.';