-- AI STAFF RUNTIME V1.2.2
-- Eliminate direct-DB Edge worker connection fan-out. Queue dispatch, wake-up, heartbeat and watchdog are DB-native.

create or replace function portal_private.ai_runtime_dispatch_db(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  v_ctl record;
  q record;
  v_task_status text;
  v_coord_status text;
  v_coord_type text;
  v_source_qa boolean;
  v_identity boolean;
  v_read boolean;
  v_coordinate boolean;
  v_reason text;
  v_attempts integer;
  v_claimed integer := 0;
  v_delivered integer := 0;
  v_processed integer := 0;
  v_blocked integer := 0;
begin
  select enabled,scheduler_state,protocol_version into v_ctl
  from portal_private.ai_runtime_control where singleton=true;

  if not found or not v_ctl.enabled or v_ctl.scheduler_state <> 'ENABLED' then
    return jsonb_build_object('ok',false,'code','AI_RUNTIME_DISABLED','worker_version','1.2.2');
  end if;

  update portal_private.ai_runtime_queue
     set state='QUEUED',lease_until=null,claimed_by=null,updated_at=now()
   where state='CLAIMED' and lease_until < now();

  for q in
    select * from portal_private.ai_runtime_queue
     where state in ('QUEUED','BLOCKED') and available_at <= now()
     order by case priority when 'CRITICAL' then 0 when 'HIGH' then 1 when 'NORMAL' then 2 else 3 end,
              deadline_at,created_at
     limit greatest(1,least(coalesce(p_limit,100),250))
     for update skip locked
  loop
    v_claimed := v_claimed + 1;
    v_attempts := q.attempts + 1;
    update portal_private.ai_runtime_queue
       set state='CLAIMED',lease_until=now()+interval '2 minutes',claimed_by='DB_NATIVE_V1_2_2',attempts=v_attempts,updated_at=now()
     where id=q.id;

    if q.qa_only then
      update portal_private.ai_runtime_queue
         set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now()
       where id=q.id;
      insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
      values(q.id,q.target_role,'1.2.2','DISPATCH','PROCESSED','QA_ITEM_EXCLUDED',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('protocol',v_ctl.protocol_version,'executor','DB_NATIVE'),now());
      v_processed := v_processed + 1;
      continue;
    end if;

    if q.source_type in ('STAFF_TASK','PORTAL_REVERSE_EVENT') then
      v_task_status := null; v_source_qa := false;
      select t.status::text,t.qa_only into v_task_status,v_source_qa
      from portal_private.staff_tasks t
      where t.task_id=coalesce(q.payload->>'task_id',q.source_id)
      limit 1;
      if not found then
        update portal_private.ai_runtime_queue
           set state='BLOCKED',available_at=now()+interval '5 minutes',lease_until=null,claimed_by=null,last_error_code='STAFF_TASK_NOT_FOUND',last_error_text='Authoritative staff task is unavailable',updated_at=now()
         where id=q.id;
        insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
        values(q.id,q.target_role,'1.2.2','DISPATCH','BLOCKED','STAFF_TASK_NOT_FOUND',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('executor','DB_NATIVE'),now());
        v_blocked := v_blocked + 1;
        continue;
      end if;
      if v_source_qa then
        update portal_private.ai_runtime_queue set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now() where id=q.id;
        insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
        values(q.id,q.target_role,'1.2.2','DISPATCH','PROCESSED','QA_ITEM_EXCLUDED',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('task_status',v_task_status,'executor','DB_NATIVE'),now());
        v_processed := v_processed + 1;
        continue;
      end if;
      if v_task_status in ('DECIDED','COMPLETED','REJECTED','CLOSED') then
        update portal_private.ai_runtime_queue set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now() where id=q.id;
        insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
        values(q.id,q.target_role,'1.2.2','DISPATCH','PROCESSED','SOURCE_ALREADY_TERMINAL',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('task_status',v_task_status,'executor','DB_NATIVE'),now());
        v_processed := v_processed + 1;
        continue;
      end if;
    elsif q.source_type='COORDINATION' then
      v_coord_status := null; v_coord_type := null; v_source_qa := false;
      if q.source_record_id is null then
        update portal_private.ai_runtime_queue set state='BLOCKED',available_at=now()+interval '5 minutes',lease_until=null,claimed_by=null,last_error_code='COORDINATION_RECORD_ID_MISSING',last_error_text='Coordination source record id is missing',updated_at=now() where id=q.id;
        insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
        values(q.id,q.target_role,'1.2.2','DISPATCH','BLOCKED','COORDINATION_RECORD_ID_MISSING',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('executor','DB_NATIVE'),now());
        v_blocked := v_blocked + 1;
        continue;
      end if;
      select r.status,r.record_type,r.qa_only into v_coord_status,v_coord_type,v_source_qa
      from portal_private.ai_coordination_records r
      where r.record_id=q.source_record_id
      limit 1;
      if not found then
        update portal_private.ai_runtime_queue set state='BLOCKED',available_at=now()+interval '5 minutes',lease_until=null,claimed_by=null,last_error_code='COORDINATION_RECORD_NOT_FOUND',last_error_text='Authoritative coordination record is unavailable',updated_at=now() where id=q.id;
        insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
        values(q.id,q.target_role,'1.2.2','DISPATCH','BLOCKED','COORDINATION_RECORD_NOT_FOUND',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('executor','DB_NATIVE'),now());
        v_blocked := v_blocked + 1;
        continue;
      end if;
      if v_source_qa then
        update portal_private.ai_runtime_queue set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now() where id=q.id;
        insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
        values(q.id,q.target_role,'1.2.2','DISPATCH','PROCESSED','QA_ITEM_EXCLUDED',jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('coordination_status',v_coord_status,'record_type',v_coord_type,'executor','DB_NATIVE'),now());
        v_processed := v_processed + 1;
        continue;
      end if;
    end if;

    select exists(
      select 1 from portal_private.ai_service_identities i
      where i.business_role=q.target_role and i.status='ACTIVE'::portal_private.binding_status_enum and i.revoked_at is null
    ) into v_identity;
    select exists(
      select 1 from portal_private.mcp_gateway_config c
      where c.business_role=q.target_role and c.enabled=true and c.server_slug !~ '-pilot$'
    ) into v_read;
    select exists(
      select 1 from portal_private.mcp_gateway_config c
      where c.business_role=q.target_role and c.enabled=true and c.server_slug ~ '-pilot$'
    ) into v_coordinate;

    if not v_identity or not v_read then
      update portal_private.ai_runtime_queue
         set state='BLOCKED',available_at=now()+interval '5 minutes',lease_until=null,claimed_by=null,
             last_error_code=case when not v_identity then 'AI_IDENTITY_NOT_ACTIVE' else 'AI_READ_CONNECTOR_UNAVAILABLE' end,
             last_error_text=case when not v_identity then 'Fixed AI role identity is not ACTIVE' else 'Role read connector is not enabled' end,
             updated_at=now()
       where id=q.id;
      insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
      values(q.id,q.target_role,'1.2.2','DISPATCH','BLOCKED',case when not v_identity then 'AI_IDENTITY_NOT_ACTIVE' else 'AI_READ_CONNECTOR_UNAVAILABLE' end,
             jsonb_build_array(q.source_type||':'||q.source_id),jsonb_build_object('identity_active',v_identity,'read_connector',v_read,'coordinate_connector',v_coordinate,'executor','DB_NATIVE'),now());
      v_blocked := v_blocked + 1;
      continue;
    end if;

    v_reason := case when q.target_role='SYSTEM_ADMIN'::portal_private.ai_business_role_enum or not v_coordinate
                     then 'ROLE_READ_CONTOUR_VISIBLE_WRITEBACK_EXTERNAL'
                     else 'ROLE_READ_WRITE_CONTOUR_VISIBLE' end;
    update portal_private.ai_runtime_queue
       set state='DELIVERED',delivered_at=coalesce(delivered_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now()
     where id=q.id;
    insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
    values(q.id,q.target_role,'1.2.2','DISPATCH','DELIVERED',v_reason,jsonb_build_array(q.source_type||':'||q.source_id),
           jsonb_build_object('identity_active',v_identity,'read_connector',v_read,'coordinate_connector',v_coordinate,'bidirectional',(q.target_role<>'SYSTEM_ADMIN'::portal_private.ai_business_role_enum and v_coordinate),'protocol',v_ctl.protocol_version,'executor','DB_NATIVE','accounting_human_authority_required',coalesce((q.payload->>'requires_human_accounting_authority')::boolean,false)),now());
    v_delivered := v_delivered + 1;
  end loop;

  return jsonb_build_object('ok',true,'worker_version','1.2.2','executor','DB_NATIVE','claimed',v_claimed,'delivered',v_delivered,'processed',v_processed,'blocked',v_blocked);
end $$;

create or replace function portal_private.ai_runtime_enqueue_sla_escalation_db()
returns uuid
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
declare
  v_n integer;
  v_items jsonb;
  v_bucket text;
  v_id uuid;
begin
  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object('id',id,'source_type',source_type,'source_id',source_id,'target_role',target_role::text,'priority',priority,'deadline_at',deadline_at) order by deadline_at),'[]'::jsonb)
    into v_n,v_items
  from (select id,source_type,source_id,target_role,priority,deadline_at
          from portal_private.ai_runtime_queue
         where sla_breached_at is not null and state not in ('PROCESSED','DEAD_LETTER')
         order by deadline_at limit 25) s;
  if coalesce(v_n,0)=0 then return null; end if;
  v_bucket := to_char(date_trunc('minute',now()) - make_interval(mins => (extract(minute from now())::int % 15)),'YYYYMMDDHH24MI');
  insert into portal_private.ai_runtime_queue(source_type,source_id,target_role,priority,deadline_at,payload)
  values('SYSTEM_CHECK','SLA-ESCALATION-'||v_bucket,'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,'HIGH',portal_private.ai_runtime_deadline('HIGH',now()),
         jsonb_build_object('protocol','AI_STAFF_COMMUNICATION_PROTOCOL_V1_2','kind','SLA_ESCALATION','breached_count',v_n,'items',v_items,'executor','DB_NATIVE','rule','Operations coordinates/escalates but never bypasses Finance/Legal/Accounting/Rail/Market/IAM authority.'))
  on conflict(source_type,source_id,target_role) do update set payload=excluded.payload,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function portal_private.wake_ai_runtime_after_queue_insert()
returns trigger
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $$
begin
  perform portal_private.ai_runtime_dispatch_db(100);
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists trg_ai_runtime_queue_wake on portal_private.ai_runtime_queue;
create trigger trg_ai_runtime_queue_wake
after insert on portal_private.ai_runtime_queue
for each statement execute function portal_private.wake_ai_runtime_after_queue_insert();

create or replace function private.invoke_rona_ai_coordination_runtime(p_action text default 'dispatch', p_payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path='pg_catalog','portal_private','private'
as $$
begin
  if p_action='dispatch' then
    perform portal_private.ai_runtime_dispatch_db(coalesce((p_payload->>'limit')::integer,100));
  elsif p_action='heartbeat' then
    perform portal_private.enqueue_ai_runtime_heartbeat();
    perform portal_private.ai_runtime_mark_sla_breaches();
    perform portal_private.ai_runtime_enqueue_sla_escalation_db();
    perform portal_private.ai_runtime_dispatch_db(100);
  elsif p_action='watchdog' then
    perform portal_private.ai_runtime_mark_sla_breaches();
    perform portal_private.ai_runtime_enqueue_sla_escalation_db();
    perform portal_private.ai_runtime_dispatch_db(100);
  elsif p_action='status' then
    null;
  else
    raise exception 'unsupported action';
  end if;
  return 0;
end $$;

select cron.unschedule(jobid) from cron.job where jobname in ('rona-ai-runtime-dispatch','rona-ai-runtime-heartbeat','rona-ai-runtime-watchdog');
select cron.schedule('rona-ai-runtime-dispatch','* * * * *',$cron$select portal_private.ai_runtime_dispatch_db(100);$cron$);
select cron.schedule('rona-ai-runtime-heartbeat','*/15 * * * *',$cron$select portal_private.enqueue_ai_runtime_heartbeat(); select portal_private.ai_runtime_mark_sla_breaches(); select portal_private.ai_runtime_enqueue_sla_escalation_db(); select portal_private.ai_runtime_dispatch_db(100);$cron$);
select cron.schedule('rona-ai-runtime-watchdog','* * * * *',$cron$select portal_private.ai_runtime_mark_sla_breaches(); select portal_private.ai_runtime_enqueue_sla_escalation_db(); select portal_private.ai_runtime_dispatch_db(100);$cron$);

update portal_private.ai_runtime_control
set worker_version='1.2.2',scheduler_state='ENABLED',model_execution_state='BLOCKED',updated_at=now()
where singleton=true;
