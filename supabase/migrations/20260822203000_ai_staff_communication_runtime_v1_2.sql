-- AI STAFF COMMUNICATION RUNTIME V1.2
-- Production-safe, idempotent persisted delivery/SLA runtime.

create schema if not exists private;

create table if not exists private.rona_ai_coordination_runtime_secret (
  singleton boolean primary key default true check (singleton),
  token text not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
insert into private.rona_ai_coordination_runtime_secret(singleton,token)
values(true,encode(gen_random_bytes(32),'hex'))
on conflict(singleton) do nothing;
revoke all on private.rona_ai_coordination_runtime_secret from public, anon, authenticated;

create table if not exists portal_private.ai_runtime_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default true,
  protocol_version text not null default 'AI_STAFF_COMMUNICATION_PROTOCOL_V1_2',
  scheduler_state text not null default 'ENABLED' check (scheduler_state in ('ENABLED','DISABLED','HOLD')),
  model_execution_state text not null default 'BLOCKED' check (model_execution_state in ('AUTO_DETECT','ENABLED','DISABLED','BLOCKED')),
  heartbeat_minutes integer not null default 15 check (heartbeat_minutes between 1 and 1440),
  worker_version text not null default '1.2.0',
  updated_at timestamptz not null default now()
);
insert into portal_private.ai_runtime_control(singleton,model_execution_state)
values(true,'BLOCKED')
on conflict(singleton) do update set
  protocol_version='AI_STAFF_COMMUNICATION_PROTOCOL_V1_2',
  worker_version='1.2.0',
  model_execution_state=case when portal_private.ai_runtime_control.model_execution_state='ENABLED' then 'ENABLED' else 'BLOCKED' end,
  updated_at=now();

create table if not exists portal_private.ai_runtime_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('PORTAL_REVERSE_EVENT','STAFF_TASK','COORDINATION','HEARTBEAT','SYSTEM_CHECK')),
  source_id text not null,
  source_record_id uuid,
  target_role portal_private.ai_business_role_enum not null,
  priority text not null default 'NORMAL' check (priority in ('CRITICAL','HIGH','NORMAL','LOW')),
  state text not null default 'QUEUED' check (state in ('QUEUED','CLAIMED','DELIVERED','PROCESSED','BLOCKED','DEAD_LETTER')),
  available_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  lease_until timestamptz,
  claimed_by text,
  attempts integer not null default 0 check (attempts >= 0),
  correlation_id uuid not null default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  qa_only boolean not null default false,
  delivered_at timestamptz,
  processed_at timestamptz,
  sla_breached_at timestamptz,
  last_error_code text,
  last_error_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_type,source_id,target_role)
);
create index if not exists ai_runtime_queue_ready_idx on portal_private.ai_runtime_queue(state,available_at,priority,deadline_at) where state in ('QUEUED','DELIVERED','BLOCKED');
create index if not exists ai_runtime_queue_role_idx on portal_private.ai_runtime_queue(target_role,state,created_at desc);
create index if not exists ai_runtime_queue_deadline_idx on portal_private.ai_runtime_queue(deadline_at) where state not in ('PROCESSED','DEAD_LETTER');

create table if not exists portal_private.ai_runtime_runs (
  run_id uuid primary key default gen_random_uuid(),
  queue_id uuid references portal_private.ai_runtime_queue(id),
  target_role portal_private.ai_business_role_enum not null,
  worker_version text not null,
  run_kind text not null check (run_kind in ('DISPATCH','HEARTBEAT','SLA_WATCHDOG','MODEL_EXECUTION')),
  status text not null check (status in ('STARTED','DELIVERED','PROCESSED','BLOCKED','FAILED','SLA_BREACH')),
  reason_code text,
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs)='array'),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists ai_runtime_runs_queue_idx on portal_private.ai_runtime_runs(queue_id,started_at desc);
create index if not exists ai_runtime_runs_role_idx on portal_private.ai_runtime_runs(target_role,started_at desc);

create or replace function portal_private.prevent_ai_runtime_run_mutation()
returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $$
begin
  raise exception 'AI_RUNTIME_RUNS_APPEND_ONLY' using errcode='55000';
end $$;
drop trigger if exists trg_ai_runtime_runs_immutable on portal_private.ai_runtime_runs;
create trigger trg_ai_runtime_runs_immutable before update or delete on portal_private.ai_runtime_runs for each row execute function portal_private.prevent_ai_runtime_run_mutation();

create or replace function portal_private.ai_runtime_deadline(p_priority text,p_at timestamptz default now())
returns timestamptz language sql immutable as $$
select case upper(coalesce(p_priority,'NORMAL'))
  when 'CRITICAL' then p_at
  when 'HIGH' then p_at + interval '5 minutes'
  when 'LOW' then p_at + interval '60 minutes'
  else p_at + interval '15 minutes'
end
$$;

create or replace function portal_private.ai_runtime_priority(p text)
returns text language sql immutable as $$
select case upper(coalesce(p,'NORMAL')) when 'CRITICAL' then 'CRITICAL' when 'HIGH' then 'HIGH' when 'LOW' then 'LOW' else 'NORMAL' end
$$;

create or replace function portal_private.ai_runtime_ai_role_for_staff(p_role portal_private.staff_functional_role_enum)
returns portal_private.ai_business_role_enum language sql immutable as $$
select case p_role::text
  when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  when 'FINANCE' then 'FINANCE'::portal_private.ai_business_role_enum
  when 'LEGAL' then 'LEGAL'::portal_private.ai_business_role_enum
  when 'MARKET_ANALYST' then 'MARKET_ANALYST'::portal_private.ai_business_role_enum
  when 'RAIL_LOGISTICS' then 'RAIL_LOGISTICS'::portal_private.ai_business_role_enum
  when 'SYSTEM_ADMIN' then 'SYSTEM_ADMIN'::portal_private.ai_business_role_enum
  when 'ACCOUNTING' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  else null
end
$$;

create or replace function portal_private.enqueue_ai_runtime_staff_task()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private','private' as $$
declare v_role portal_private.ai_business_role_enum; v_priority text; v_source_type text;
begin
  if new.qa_only or new.assigned_functional_role is null then return new; end if;
  if new.status::text in ('DECIDED','COMPLETED','REJECTED','CLOSED') then return new; end if;
  v_role := portal_private.ai_runtime_ai_role_for_staff(new.assigned_functional_role);
  if v_role is null then return new; end if;
  v_priority := portal_private.ai_runtime_priority(new.priority::text);
  v_source_type := case when new.source_reverse_event_key is not null then 'PORTAL_REVERSE_EVENT' else 'STAFF_TASK' end;
  insert into portal_private.ai_runtime_queue(source_type,source_id,source_record_id,target_role,priority,deadline_at,payload,qa_only)
  values(v_source_type,new.task_id,new.source_reverse_event_key,v_role,v_priority,portal_private.ai_runtime_deadline(v_priority,now()),jsonb_build_object(
    'task_id',new.task_id,'title',new.title,'authority_domain',new.authority_domain,'staff_role',new.assigned_functional_role::text,
    'requires_human_accounting_authority',(new.assigned_functional_role::text='ACCOUNTING'),'client_key',new.client_key,'contract_key',new.contract_key,
    'deal_key',new.deal_key,'source_object_id',new.source_object_id,'protocol','AI_STAFF_COMMUNICATION_PROTOCOL_V1_2'
  ),false)
  on conflict(source_type,source_id,target_role) do nothing;
  return new;
end $$;
drop trigger if exists trg_staff_task_ai_runtime_enqueue on portal_private.staff_tasks;
create trigger trg_staff_task_ai_runtime_enqueue after insert on portal_private.staff_tasks for each row execute function portal_private.enqueue_ai_runtime_staff_task();

create or replace function portal_private.enqueue_ai_runtime_coordination()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private','private' as $$
declare v_priority text;
begin
  if new.qa_only or new.target_role is null then return new; end if;
  if new.functional_role = new.target_role and new.record_type <> 'OPERATIONS_INTERNAL_DECISION' then return new; end if;
  v_priority := portal_private.ai_runtime_priority(coalesce(new.payload->>'priority','NORMAL'));
  insert into portal_private.ai_runtime_queue(source_type,source_id,source_record_id,target_role,priority,deadline_at,payload,qa_only)
  values('COORDINATION',new.record_id::text,new.record_id,new.target_role,v_priority,portal_private.ai_runtime_deadline(v_priority,new.created_at),jsonb_build_object(
    'record_id',new.record_id,'record_type',new.record_type,'from_role',new.functional_role::text,'target_role',new.target_role::text,
    'target_type',new.target_type,'target_id',new.target_id,'status',new.status,'payload',new.payload,'source_refs',new.source_refs,
    'protocol','AI_STAFF_COMMUNICATION_PROTOCOL_V1_2'
  ),false)
  on conflict(source_type,source_id,target_role) do nothing;
  return new;
end $$;
drop trigger if exists trg_coordination_ai_runtime_enqueue on portal_private.ai_coordination_records;
create trigger trg_coordination_ai_runtime_enqueue after insert on portal_private.ai_coordination_records for each row execute function portal_private.enqueue_ai_runtime_coordination();

create or replace function portal_private.enqueue_ai_runtime_heartbeat()
returns uuid language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare v_id uuid; v_bucket text;
begin
  v_bucket := to_char(date_trunc('minute',now()) - make_interval(mins => (extract(minute from now())::int % 15)),'YYYYMMDDHH24MI');
  insert into portal_private.ai_runtime_queue(source_type,source_id,target_role,priority,deadline_at,payload)
  values('HEARTBEAT','OPS-HEARTBEAT-'||v_bucket,'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,'NORMAL',portal_private.ai_runtime_deadline('NORMAL',now()),jsonb_build_object(
    'protocol','AI_STAFF_COMMUNICATION_PROTOCOL_V1_2','kind','OPERATIONS_HEARTBEAT',
    'check',jsonb_build_array('stuck_handoffs','HOLD_TO_VERIFY','sla_breaches','current_state_divergence')
  ))
  on conflict(source_type,source_id,target_role) do update set updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function portal_private.ai_runtime_mark_sla_breaches()
returns integer language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare v_count integer;
begin
  with breached as (
    update portal_private.ai_runtime_queue q
       set sla_breached_at=coalesce(q.sla_breached_at,now()),updated_at=now()
     where q.state not in ('PROCESSED','DEAD_LETTER') and q.deadline_at < now() and q.sla_breached_at is null
     returning q.id,q.target_role,q.source_type,q.source_id,q.priority,q.deadline_at
  ), ins as (
    insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
    select id,target_role,'1.2.0','SLA_WATCHDOG','SLA_BREACH','V1_2_SLA_DEADLINE_EXCEEDED',jsonb_build_array(source_type||':'||source_id),jsonb_build_object('priority',priority,'deadline_at',deadline_at),now() from breached
    returning 1
  ) select count(*) into v_count from ins;
  return coalesce(v_count,0);
end $$;

create or replace function private.invoke_rona_ai_coordination_runtime(p_action text default 'dispatch', p_payload jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path='pg_catalog','public','private','net' as $$
declare v_token text; v_request_id bigint; v_body jsonb;
begin
  if p_action not in ('dispatch','heartbeat','status','watchdog') then raise exception 'unsupported action'; end if;
  select token into v_token from private.rona_ai_coordination_runtime_secret where singleton=true;
  if coalesce(v_token,'')='' then raise exception 'ai coordination runtime token missing'; end if;
  v_body := coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('action',p_action);
  select net.http_post(
    url := 'https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-ai-coordination-runtime',
    headers := jsonb_build_object('Content-Type','application/json','x-rona-ai-runtime-key',v_token),
    body := v_body,timeout_milliseconds := 25000
  ) into v_request_id;
  return v_request_id;
end $$;

create or replace function portal_private.wake_ai_runtime_after_queue_insert()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private','private' as $$
begin
  perform private.invoke_rona_ai_coordination_runtime('dispatch',jsonb_build_object('queue_id',new.id));
  return new;
exception when others then return new;
end $$;
drop trigger if exists trg_ai_runtime_queue_wake on portal_private.ai_runtime_queue;
create trigger trg_ai_runtime_queue_wake after insert on portal_private.ai_runtime_queue for each row execute function portal_private.wake_ai_runtime_after_queue_insert();

create or replace function portal_private.settle_ai_runtime_on_coordination_insert()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare v_rows record;
begin
  if new.parent_record_id is null then return new; end if;
  for v_rows in
    update portal_private.ai_runtime_queue
       set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now()
     where source_type='COORDINATION' and source_record_id=new.parent_record_id and state not in ('PROCESSED','DEAD_LETTER')
     returning id,target_role,source_type,source_id
  loop
    insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
    values(v_rows.id,v_rows.target_role,'1.2.0','DISPATCH','PROCESSED','COORDINATION_RESPONSE_RECORDED',jsonb_build_array(v_rows.source_type||':'||v_rows.source_id),jsonb_build_object('response_record_id',new.record_id,'response_record_type',new.record_type,'response_status',new.status),now());
  end loop;
  return new;
end $$;
drop trigger if exists trg_coordination_ai_runtime_settle on portal_private.ai_coordination_records;
create trigger trg_coordination_ai_runtime_settle after insert on portal_private.ai_coordination_records for each row execute function portal_private.settle_ai_runtime_on_coordination_insert();

create or replace function portal_private.settle_ai_runtime_on_staff_task_update()
returns trigger language plpgsql security definer set search_path='pg_catalog','portal_private' as $$
declare v_rows record;
begin
  if new.status::text not in ('DECIDED','COMPLETED','REJECTED','CLOSED') then return new; end if;
  for v_rows in
    update portal_private.ai_runtime_queue
       set state='PROCESSED',processed_at=coalesce(processed_at,now()),lease_until=null,claimed_by=null,last_error_code=null,last_error_text=null,updated_at=now()
     where source_type in ('STAFF_TASK','PORTAL_REVERSE_EVENT') and source_id=new.task_id and state not in ('PROCESSED','DEAD_LETTER')
     returning id,target_role,source_type,source_id
  loop
    insert into portal_private.ai_runtime_runs(queue_id,target_role,worker_version,run_kind,status,reason_code,source_refs,metadata,finished_at)
    values(v_rows.id,v_rows.target_role,'1.2.0','DISPATCH','PROCESSED','STAFF_TASK_TERMINAL',jsonb_build_array(v_rows.source_type||':'||v_rows.source_id),jsonb_build_object('task_id',new.task_id,'task_status',new.status::text),now());
  end loop;
  return new;
end $$;
drop trigger if exists trg_staff_task_ai_runtime_settle on portal_private.staff_tasks;
create trigger trg_staff_task_ai_runtime_settle after update of status on portal_private.staff_tasks for each row when (old.status is distinct from new.status) execute function portal_private.settle_ai_runtime_on_staff_task_update();

create or replace view portal_private.ai_runtime_role_inbox as
select q.id,q.source_type,q.source_id,q.source_record_id,q.target_role,q.priority,q.state,q.deadline_at,q.delivered_at,q.processed_at,q.sla_breached_at,q.correlation_id,q.payload,q.created_at,q.updated_at
from portal_private.ai_runtime_queue q
where not q.qa_only and q.state not in ('PROCESSED','DEAD_LETTER');
revoke all on portal_private.ai_runtime_control,portal_private.ai_runtime_queue,portal_private.ai_runtime_runs,portal_private.ai_runtime_role_inbox from public,anon,authenticated;

-- Runtime wakeup / heartbeat / watchdog. Replace existing jobs idempotently.
select cron.unschedule(jobid) from cron.job where jobname in ('rona-ai-runtime-dispatch','rona-ai-runtime-heartbeat','rona-ai-runtime-watchdog');
select cron.schedule('rona-ai-runtime-dispatch','* * * * *',$cron$select private.invoke_rona_ai_coordination_runtime('dispatch');$cron$);
select cron.schedule('rona-ai-runtime-heartbeat','*/15 * * * *',$cron$select portal_private.enqueue_ai_runtime_heartbeat(); select private.invoke_rona_ai_coordination_runtime('heartbeat');$cron$);
select cron.schedule('rona-ai-runtime-watchdog','* * * * *',$cron$select portal_private.ai_runtime_mark_sla_breaches(); select private.invoke_rona_ai_coordination_runtime('watchdog');$cron$);

-- Current open tasks and recent open coordination are visible after rollout.
insert into portal_private.ai_runtime_queue(source_type,source_id,target_role,priority,deadline_at,payload,qa_only)
select 'STAFF_TASK',t.task_id,portal_private.ai_runtime_ai_role_for_staff(t.assigned_functional_role),portal_private.ai_runtime_priority(t.priority::text),portal_private.ai_runtime_deadline(portal_private.ai_runtime_priority(t.priority::text),now()),jsonb_build_object(
  'task_id',t.task_id,'title',t.title,'authority_domain',t.authority_domain,'staff_role',t.assigned_functional_role::text,
  'requires_human_accounting_authority',(t.assigned_functional_role::text='ACCOUNTING'),'protocol','AI_STAFF_COMMUNICATION_PROTOCOL_V1_2','backfill',true
),false
from portal_private.staff_tasks t
where not t.qa_only and t.assigned_functional_role is not null and t.status::text in ('NEW','ACKNOWLEDGED','IN_PROGRESS','WAITING') and portal_private.ai_runtime_ai_role_for_staff(t.assigned_functional_role) is not null
on conflict(source_type,source_id,target_role) do nothing;

insert into portal_private.ai_runtime_queue(source_type,source_id,source_record_id,target_role,priority,deadline_at,payload,qa_only)
select 'COORDINATION',r.record_id::text,r.record_id,r.target_role,portal_private.ai_runtime_priority(coalesce(r.payload->>'priority','NORMAL')),portal_private.ai_runtime_deadline(portal_private.ai_runtime_priority(coalesce(r.payload->>'priority','NORMAL')),now()),jsonb_build_object(
  'record_id',r.record_id,'record_type',r.record_type,'from_role',r.functional_role::text,'target_role',r.target_role::text,
  'target_type',r.target_type,'target_id',r.target_id,'status',r.status,'payload',r.payload,'source_refs',r.source_refs,
  'protocol','AI_STAFF_COMMUNICATION_PROTOCOL_V1_2','backfill',true
),false
from portal_private.ai_coordination_records r
where not r.qa_only and r.target_role is not null and r.created_at >= now()-interval '7 days' and r.status in ('REQUESTED','HOLD','OPEN','IN_PROGRESS')
on conflict(source_type,source_id,target_role) do nothing;
