-- Payments V7 recurring Finance materialization maintenance.
-- Adds server-side recovery scheduling plus reconciliation for confirmed conclusions
-- whose trigger failed before durable job creation.

create table if not exists portal_private.finance_materialization_maintenance_audit_v7 (
  maintenance_id uuid primary key default gen_random_uuid(),
  invocation_source text not null check (invocation_source in ('PG_CRON','QA_PERIODIC_WORKER')),
  reconciled_jobs integer not null default 0 check (reconciled_jobs >= 0),
  recovered_jobs integer not null default 0 check (recovered_jobs >= 0),
  reconciliation_result jsonb not null default '{}'::jsonb,
  recovery_result jsonb not null default '{}'::jsonb,
  error_text text null,
  created_at timestamptz not null default now()
);

create trigger finance_materialization_maintenance_audit_v7_immutable
before update or delete on portal_private.finance_materialization_maintenance_audit_v7
for each row execute function portal_private.reject_v7_authority_mutation();

create or replace function portal_private.reconcile_finance_materialization_jobs_v7(p_limit integer default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_candidate record;
  v_job_id uuid;
  v_created integer:=0;
  v_results jsonb:='[]'::jsonb;
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'FINANCE_MATERIALIZATION_RECONCILIATION_LIMIT_INVALID';
  end if;

  for v_candidate in
    select
      c.record_id as conclusion_record_id,
      c.target_id as source_lock_task_id,
      m.record_id as manifest_record_id,
      encode(sha256(convert_to((m.payload->'proposed_state')::text,'UTF8')),'hex') as manifest_payload_sha256
    from portal_private.ai_coordination_records c
    join lateral (
      select m0.*
      from portal_private.ai_coordination_records m0
      where m0.record_type='BUSINESS_CHANGE_PROPOSAL'
        and m0.functional_role::text='FINANCE'
        and m0.identity_id='AI-FINANCE'
        and coalesce(m0.tool_name,'')='business_change_proposal_submit'
        and coalesce(m0.qa_only,false)=false
        and m0.status='PROPOSED'
        and m0.target_type='TASK'
        and m0.target_id=c.target_id
        and upper(coalesce(m0.payload->>'target_entity_type',''))='TASK'
        and coalesce(m0.payload->>'target_entity_id','')=coalesce(m0.target_id,'')
        and upper(coalesce(m0.payload->>'proposed_action',''))='PAYMENTS_V7_MATERIALIZE'
        and lower(coalesce(m0.payload->>'proposed_field',''))='payments_v7_materialization_manifest'
        and jsonb_typeof(m0.payload->'proposed_state')='object'
        and coalesce(m0.payload->'proposed_state'->>'schema','')='PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1'
        and coalesce(m0.payload->'proposed_state'->>'source_lock_task_id','')=m0.target_id
        and exists(
          select 1 from jsonb_array_elements_text(coalesce(c.source_refs,'[]'::jsonb)) s(value)
          where s.value=m0.record_id::text
             or s.value=('BUSINESS_CHANGE_PROPOSAL:'||m0.record_id::text)
             or s.value=('PAYMENTS_V7_MANIFEST:'||m0.record_id::text)
        )
      order by m0.created_at desc,m0.record_id desc
      limit 1
    ) m on true
    where c.record_type='FUNCTIONAL_CONCLUSION'
      and c.functional_role::text='FINANCE'
      and c.identity_id='AI-FINANCE'
      and coalesce(c.tool_name,'')='functional_conclusion_submit'
      and coalesce(c.qa_only,false)=false
      and c.status in ('APPROVED','APPROVED_WITH_CONDITIONS')
      and lower(coalesce(c.payload->>'confirmed','false'))='true'
      and c.target_type='TASK'
      and upper(coalesce(c.payload->>'entity_type',''))='TASK'
      and coalesce(c.payload->>'entity_id','')=coalesce(c.target_id,'')
      and c.created_at>=m.created_at
      and exists(
        select 1 from portal_private.staff_tasks t
        where t.task_id=c.target_id
          and upper(coalesce(t.authority_domain,''))='FINANCE'
          and coalesce(t.assigned_functional_role::text,'')='FINANCE'
      )
      and not exists(select 1 from portal_private.ai_coordination_records x where x.supersedes_id=c.record_id)
      and not exists(
        select 1 from portal_private.ai_coordination_records x
        where x.record_type='FUNCTIONAL_CONCLUSION'
          and x.functional_role::text='FINANCE'
          and x.target_type='TASK'
          and x.target_id=c.target_id
          and x.version>c.version
      )
      and not exists(select 1 from portal_private.ai_coordination_records x where x.supersedes_id=m.record_id)
      and not exists(
        select 1 from portal_private.ai_coordination_records x
        where x.record_type='BUSINESS_CHANGE_PROPOSAL'
          and x.functional_role::text='FINANCE'
          and x.identity_id='AI-FINANCE'
          and x.target_type='TASK'
          and x.target_id=m.target_id
          and upper(coalesce(x.payload->>'proposed_action',''))='PAYMENTS_V7_MATERIALIZE'
          and lower(coalesce(x.payload->>'proposed_field',''))='payments_v7_materialization_manifest'
          and (x.created_at,x.record_id)>(m.created_at,m.record_id)
      )
      and not exists(
        select 1 from portal_private.finance_materialization_jobs_v7 j
        where j.manifest_record_id=m.record_id
      )
    order by c.created_at,c.record_id
    limit p_limit
    for update of c skip locked
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
      v_results:=v_results||jsonb_build_array(jsonb_build_object(
        'job_id',v_job_id,'manifest_id',v_candidate.manifest_record_id,
        'conclusion_id',v_candidate.conclusion_record_id,'status','QUEUED'
      ));
    end if;
  end loop;

  return jsonb_build_object('ok',true,'created',v_created,'jobs',v_results);
end
$$;

create or replace function portal_private.run_finance_materialization_maintenance_v7(
  p_reconcile_limit integer default 25,
  p_recovery_limit integer default 25,
  p_invocation_source text default 'PG_CRON'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','portal_private'
as $$
declare
  v_source text:=upper(coalesce(p_invocation_source,''));
  v_reconcile jsonb:='{}'::jsonb;
  v_recovery jsonb:='{}'::jsonb;
  v_reconciled integer:=0;
  v_recovered integer:=0;
  v_error text:=null;
  v_result jsonb;
begin
  if v_source not in ('PG_CRON','QA_PERIODIC_WORKER') then
    raise exception 'FINANCE_MATERIALIZATION_MAINTENANCE_SOURCE_INVALID';
  end if;

  begin
    v_reconcile:=portal_private.reconcile_finance_materialization_jobs_v7(p_reconcile_limit);
    v_reconciled:=coalesce((v_reconcile->>'created')::integer,0);
  exception when others then
    v_error:='RECONCILIATION: '||left(sqlerrm,900);
    v_reconcile:=jsonb_build_object('ok',false,'reason_code','RECONCILIATION_EXCEPTION');
  end;

  begin
    v_recovery:=portal_private.recover_finance_materialization_jobs_v7(p_recovery_limit);
    v_recovered:=coalesce((v_recovery->>'processed')::integer,0);
  exception when others then
    v_error:=concat_ws('; ',v_error,'RECOVERY: '||left(sqlerrm,900));
    v_recovery:=jsonb_build_object('ok',false,'reason_code','RECOVERY_EXCEPTION');
  end;

  v_result:=jsonb_build_object(
    'ok',v_error is null,'invocation_source',v_source,
    'reconciled_jobs',v_reconciled,'recovered_jobs',v_recovered,
    'reconciliation',v_reconcile,'recovery',v_recovery,'error',v_error
  );

  if v_reconciled>0 or v_recovered>0 or v_error is not null then
    insert into portal_private.finance_materialization_maintenance_audit_v7(
      invocation_source,reconciled_jobs,recovered_jobs,reconciliation_result,recovery_result,error_text
    ) values(v_source,v_reconciled,v_recovered,v_reconcile,v_recovery,v_error);
  end if;

  return v_result;
end
$$;

do $$
begin
  if not exists(select 1 from pg_roles where rolname='rona_finance_materializer_worker_v7') then
    create role rona_finance_materializer_worker_v7
      login noinherit nosuperuser nocreatedb nocreaterole noreplication;
  end if;
end
$$;

revoke all on portal_private.finance_materialization_maintenance_audit_v7 from public,anon,authenticated,service_role;
revoke all on function portal_private.reconcile_finance_materialization_jobs_v7(integer) from public,anon,authenticated,service_role;
revoke all on function portal_private.run_finance_materialization_maintenance_v7(integer,integer,text) from public,anon,authenticated,service_role;

grant usage on schema portal_private to rona_finance_materializer_worker_v7;
grant execute on function portal_private.run_finance_materialization_maintenance_v7(integer,integer,text)
  to rona_finance_materializer_worker_v7;

-- Supabase's managed postgres role is not a true superuser and pg_cron therefore cannot
-- schedule a job directly as another database role. The cron connection is owned by the
-- current migration role, then immediately SET ROLEs to the dedicated least-privilege worker.
grant rona_finance_materializer_worker_v7 to postgres;

-- Production gate: pg_cron must exist. Plain PostgreSQL QA may explicitly opt out of cron registration
-- while exercising this exact maintenance entrypoint through the CI periodic-worker harness.
do $payments_v7_scheduler$
declare
  v_allow_missing boolean:=lower(coalesce(current_setting('rona.payments_v7_allow_missing_cron',true),'')) in ('1','on','true','yes');
begin
  if to_regprocedure('cron.schedule_in_database(text,text,text,text,text,boolean)') is null then
    if v_allow_missing then
      raise notice 'PAYMENTS V7 QA: pg_cron registration skipped by explicit test-only GUC';
      return;
    end if;
    raise exception 'PAYMENTS_V7_PG_CRON_REQUIRED';
  end if;

  perform cron.schedule_in_database(
    'payments-v7-finance-materialization-maintenance-v7',
    '* * * * *',
    $cron$set role rona_finance_materializer_worker_v7; select portal_private.run_finance_materialization_maintenance_v7(50,50,'PG_CRON');$cron$,
    current_database(),
    null,
    true
  );
end
$payments_v7_scheduler$;

comment on function portal_private.reconcile_finance_materialization_jobs_v7(integer) is
'Finds exact current confirmed FINANCE / AI-FINANCE Payments V7 manifest conclusions with no durable job and creates the missing idempotent job. No Payments business DML.';
comment on function portal_private.run_finance_materialization_maintenance_v7(integer,integer,text) is
'Least-privilege scheduled maintenance entrypoint: reconcile missing jobs, then recover due QUEUED/RETRY jobs through the existing manifest-bound materializer.';