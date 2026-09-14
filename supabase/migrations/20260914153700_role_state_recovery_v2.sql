-- RONA ROLE STATE RECOVERY V2
-- Production migration applied 2026-09-14. Reproducible source of truth.

create table if not exists portal_private.ai_role_state_checkpoints_v2 (
  functional_role portal_private.ai_business_role_enum primary key,
  state_version bigint not null default 1 check (state_version > 0),
  last_confirmed_checkpoint jsonb not null default '{}'::jsonb,
  active_task_id text null,
  open_delta jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  pending_actions jsonb not null default '[]'::jsonb,
  canonical_sources jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  updated_by_identity text null,
  updated_at timestamptz not null default now(),
  constraint ai_role_state_cp_checkpoint_budget check (octet_length(last_confirmed_checkpoint::text) <= 1800),
  constraint ai_role_state_cp_delta_budget check (octet_length(open_delta::text) <= 1800),
  constraint ai_role_state_cp_blockers_budget check (octet_length(blockers::text) <= 1800),
  constraint ai_role_state_cp_actions_budget check (octet_length(pending_actions::text) <= 1800),
  constraint ai_role_state_cp_sources_budget check (octet_length(canonical_sources::text) <= 3000),
  constraint ai_role_state_cp_metadata_budget check (octet_length(metadata::text) <= 1200)
);

create table if not exists portal_private.ai_role_state_history_v2 (
  id bigint generated always as identity primary key,
  functional_role portal_private.ai_business_role_enum not null,
  state_version bigint not null,
  event_type text not null,
  active_task_id text null,
  snapshot jsonb not null,
  actor_identity text null,
  created_at timestamptz not null default now(),
  unique(functional_role,state_version)
);

create index if not exists ai_role_state_history_v2_role_created_idx
  on portal_private.ai_role_state_history_v2(functional_role,created_at desc,id desc);

revoke all on portal_private.ai_role_state_checkpoints_v2 from public, anon, authenticated;
revoke all on portal_private.ai_role_state_history_v2 from public, anon, authenticated;

create or replace function portal_private.ai_role_state_snapshot_v2(p_role portal_private.ai_business_role_enum)
returns jsonb language sql stable security definer set search_path = portal_private, pg_catalog as $$
  select jsonb_build_object(
    'functional_role',c.functional_role::text,'state_version',c.state_version,
    'last_confirmed_checkpoint',c.last_confirmed_checkpoint,'active_task_id',c.active_task_id,
    'open_delta',c.open_delta,'blockers',c.blockers,'pending_actions',c.pending_actions,
    'canonical_sources',c.canonical_sources,'metadata',c.metadata,
    'updated_by_identity',c.updated_by_identity,'updated_at',c.updated_at)
  from portal_private.ai_role_state_checkpoints_v2 c where c.functional_role=p_role
$$;

create or replace function portal_private.ai_role_state_record_history_v2()
returns trigger language plpgsql security definer set search_path = portal_private, pg_catalog as $$
begin
  insert into portal_private.ai_role_state_history_v2(functional_role,state_version,event_type,active_task_id,snapshot,actor_identity,created_at)
  values(new.functional_role,new.state_version,
    case when tg_op='INSERT' then 'CHECKPOINT_BOOTSTRAP' else coalesce(new.metadata->>'last_event_type','CHECKPOINT_UPDATE') end,
    new.active_task_id,
    jsonb_build_object('last_confirmed_checkpoint',new.last_confirmed_checkpoint,'active_task_id',new.active_task_id,
      'open_delta',new.open_delta,'blockers',new.blockers,'pending_actions',new.pending_actions,
      'canonical_sources',new.canonical_sources,'metadata',new.metadata,'updated_at',new.updated_at),
    new.updated_by_identity,new.updated_at)
  on conflict(functional_role,state_version) do nothing;
  return new;
end
$$;

drop trigger if exists trg_ai_role_state_history_v2 on portal_private.ai_role_state_checkpoints_v2;
create trigger trg_ai_role_state_history_v2 after insert or update on portal_private.ai_role_state_checkpoints_v2
for each row execute function portal_private.ai_role_state_record_history_v2();

create or replace function portal_private.ai_role_state_write_v2(
  p_role portal_private.ai_business_role_enum,
  p_expected_version bigint,
  p_patch jsonb,
  p_actor_identity text default null)
returns jsonb language plpgsql security definer set search_path = portal_private, pg_catalog as $$
declare
  v_row portal_private.ai_role_state_checkpoints_v2%rowtype;
  v_new portal_private.ai_role_state_checkpoints_v2%rowtype;
  v_allowed text[] := array['last_confirmed_checkpoint','active_task_id','open_delta','blockers','pending_actions','canonical_sources','metadata'];
  v_key text;
begin
  if p_patch is null or jsonb_typeof(p_patch)<>'object' then return jsonb_build_object('ok',false,'code','INVALID_PATCH'); end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if not (v_key=any(v_allowed)) then return jsonb_build_object('ok',false,'code','INVALID_PATCH_KEY','key',v_key); end if;
  end loop;

  select * into v_row from portal_private.ai_role_state_checkpoints_v2 where functional_role=p_role for update;
  if not found then
    if coalesce(p_expected_version,0)<>0 then return jsonb_build_object('ok',false,'code','STALE_STATE','current_version',0,'refresh_required',true); end if;
    insert into portal_private.ai_role_state_checkpoints_v2(functional_role,updated_by_identity,metadata)
      values(p_role,p_actor_identity,jsonb_build_object('last_event_type','CHECKPOINT_BOOTSTRAP')) returning * into v_row;
  elsif p_expected_version is distinct from v_row.state_version then
    return jsonb_build_object('ok',false,'code','STALE_STATE','current_version',v_row.state_version,'refresh_required',true);
  end if;

  update portal_private.ai_role_state_checkpoints_v2 c set
    state_version=c.state_version+1,
    last_confirmed_checkpoint=case when p_patch?'last_confirmed_checkpoint' then p_patch->'last_confirmed_checkpoint' else c.last_confirmed_checkpoint end,
    active_task_id=case when p_patch?'active_task_id' then nullif(p_patch->>'active_task_id','') else c.active_task_id end,
    open_delta=case when p_patch?'open_delta' then p_patch->'open_delta' else c.open_delta end,
    blockers=case when p_patch?'blockers' then p_patch->'blockers' else c.blockers end,
    pending_actions=case when p_patch?'pending_actions' then p_patch->'pending_actions' else c.pending_actions end,
    canonical_sources=case when p_patch?'canonical_sources' then p_patch->'canonical_sources' else c.canonical_sources end,
    metadata=(case when p_patch?'metadata' then p_patch->'metadata' else c.metadata end)||jsonb_build_object('last_event_type','CHECKPOINT_UPDATE'),
    updated_by_identity=p_actor_identity,updated_at=now()
  where c.functional_role=p_role returning * into v_new;
  return jsonb_build_object('ok',true,'checkpoint',portal_private.ai_role_state_snapshot_v2(p_role));
exception when check_violation then
  return jsonb_build_object('ok',false,'code','CHECKPOINT_TOO_LARGE');
end
$$;

create or replace function portal_private.ai_role_state_touch_v2(
  p_role portal_private.ai_business_role_enum,
  p_event_type text,
  p_object_id text default null)
returns void language plpgsql security definer set search_path = portal_private, pg_catalog as $$
declare
  v_event text := left(coalesce(p_event_type,'SYSTEM_TOUCH'),120);
  v_object text := left(coalesce(p_object_id,''),240);
  v_checkpoint jsonb := jsonb_build_object('event_type',left(coalesce(p_event_type,'SYSTEM_TOUCH'),120),
    'object_id',nullif(left(coalesce(p_object_id,''),240),''),'confirmed_at',now());
begin
  insert into portal_private.ai_role_state_checkpoints_v2(functional_role,state_version,last_confirmed_checkpoint,open_delta,blockers,pending_actions,canonical_sources,metadata,updated_at)
  values(p_role,1,v_checkpoint,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
    jsonb_build_object('last_event_type',v_event,'last_event_object_id',v_object,'bootstrap_source','production'),now())
  on conflict(functional_role) do update set
    state_version=portal_private.ai_role_state_checkpoints_v2.state_version+1,
    last_confirmed_checkpoint=v_checkpoint,
    metadata=(portal_private.ai_role_state_checkpoints_v2.metadata-'last_event_type'-'last_event_object_id')||jsonb_build_object('last_event_type',v_event,'last_event_object_id',v_object),
    updated_at=now();
end
$$;

create or replace function portal_private.ai_role_state_staff_task_touch_v2()
returns trigger language plpgsql security definer set search_path = portal_private, pg_catalog as $$
declare v_role portal_private.ai_business_role_enum; v_next_task text;
begin
  if tg_op='INSERT' then
    if new.qa_only=false and new.assigned_functional_role is not null then
      v_role:=new.assigned_functional_role::text::portal_private.ai_business_role_enum;
      perform portal_private.ai_role_state_touch_v2(v_role,'STAFF_TASK_INSERT',new.task_id);
      if new.status::text not in ('COMPLETED','REJECTED','CLOSED') then update portal_private.ai_role_state_checkpoints_v2 set active_task_id=new.task_id where functional_role=v_role; end if;
    end if;
  else
    if old.qa_only=false and old.assigned_functional_role is not null and new.assigned_functional_role is distinct from old.assigned_functional_role then
      v_role:=old.assigned_functional_role::text::portal_private.ai_business_role_enum;
      perform portal_private.ai_role_state_touch_v2(v_role,'STAFF_TASK_REASSIGNED_FROM',old.task_id);
      select t.task_id into v_next_task from portal_private.staff_tasks t where t.qa_only=false and t.assigned_functional_role::text=v_role::text and t.status::text not in ('COMPLETED','REJECTED','CLOSED') order by t.updated_at desc,t.created_at desc limit 1;
      update portal_private.ai_role_state_checkpoints_v2 set active_task_id=v_next_task where functional_role=v_role;
    end if;
    if new.qa_only=false and new.assigned_functional_role is not null and (new.status is distinct from old.status or new.assigned_functional_role is distinct from old.assigned_functional_role or new.updated_at is distinct from old.updated_at) then
      v_role:=new.assigned_functional_role::text::portal_private.ai_business_role_enum;
      perform portal_private.ai_role_state_touch_v2(v_role,'STAFF_TASK_UPDATE',new.task_id);
      if new.status::text not in ('COMPLETED','REJECTED','CLOSED') then
        update portal_private.ai_role_state_checkpoints_v2 set active_task_id=new.task_id where functional_role=v_role;
      else
        select t.task_id into v_next_task from portal_private.staff_tasks t where t.qa_only=false and t.assigned_functional_role::text=v_role::text and t.status::text not in ('COMPLETED','REJECTED','CLOSED') order by t.updated_at desc,t.created_at desc limit 1;
        update portal_private.ai_role_state_checkpoints_v2 set active_task_id=v_next_task where functional_role=v_role;
      end if;
    end if;
  end if;
  return new;
exception when invalid_text_representation then return new;
end
$$;

drop trigger if exists trg_ai_role_state_staff_task_touch_v2 on portal_private.staff_tasks;
create trigger trg_ai_role_state_staff_task_touch_v2 after insert or update on portal_private.staff_tasks
for each row execute function portal_private.ai_role_state_staff_task_touch_v2();

create or replace function portal_private.ai_role_state_coord_touch_v2()
returns trigger language plpgsql security definer set search_path = portal_private, pg_catalog as $$
begin
  if new.qa_only=false then
    perform portal_private.ai_role_state_touch_v2(new.functional_role,'COORDINATION_INSERT',new.record_id::text);
    if new.target_role is not null and new.target_role is distinct from new.functional_role then perform portal_private.ai_role_state_touch_v2(new.target_role,'COORDINATION_TARGET_INSERT',new.record_id::text); end if;
  end if;
  return new;
end
$$;

drop trigger if exists trg_ai_role_state_coord_touch_v2 on portal_private.ai_coordination_records;
create trigger trg_ai_role_state_coord_touch_v2 after insert on portal_private.ai_coordination_records
for each row execute function portal_private.ai_role_state_coord_touch_v2();

create or replace function portal_private.ai_role_state_current_v2(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = portal_private, pg_catalog as $$
declare
  v_cp jsonb; v_tasks jsonb; v_coord jsonb;
  v_task_limit int:=greatest(1,least(coalesce(p_task_limit,10),20));
  v_coord_limit int:=greatest(1,least(coalesce(p_coord_limit,20),20));
begin
  v_cp:=coalesce(portal_private.ai_role_state_snapshot_v2(p_role),jsonb_build_object('functional_role',p_role::text,'state_version',0,'last_confirmed_checkpoint','{}'::jsonb,'active_task_id',null,'open_delta','[]'::jsonb,'blockers','[]'::jsonb,'pending_actions','[]'::jsonb,'canonical_sources','[]'::jsonb,'metadata','{}'::jsonb,'updated_at',null));
  select coalesce(jsonb_agg(x.obj order by x.updated_at desc),'[]'::jsonb) into v_tasks from (
    select t.updated_at,jsonb_build_object('task_id',t.task_id,'title',left(t.title,240),'status',t.status::text,'priority',t.priority::text,'authority_domain',t.authority_domain,'source_type',t.source_type,'source_object_id',t.source_object_id,'due_at',t.due_at,'updated_at',t.updated_at) obj
    from portal_private.staff_tasks t where t.qa_only=false and t.assigned_functional_role::text=p_role::text and t.status::text not in ('COMPLETED','REJECTED','CLOSED') order by t.updated_at desc limit v_task_limit) x;
  select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb) into v_coord from (
    select r.created_at,jsonb_build_object('record_id',r.record_id,'record_type',r.record_type,'from_role',r.functional_role::text,'target_role',r.target_role::text,'target_type',r.target_type,'target_id',r.target_id,'parent_record_id',r.parent_record_id,'version',r.version,'supersedes_id',r.supersedes_id,'status',r.status,'created_at',r.created_at) obj
    from portal_private.ai_coordination_records r where r.qa_only=false and (r.functional_role=p_role or r.target_role=p_role or (p_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum and r.record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION') and r.target_type<>'SYSTEM'))
      and not exists(select 1 from portal_private.ai_coordination_records n where n.qa_only=false and n.supersedes_id=r.record_id)
    order by r.created_at desc limit v_coord_limit) x;
  return jsonb_build_object('data_contract','RONA_ROLE_STATE_RECOVERY_V2','generated_at',now(),'functional_role',p_role::text,'checkpoint',v_cp,'active_tasks',v_tasks,
    'coordination',jsonb_build_object('projection','LATEST_NON_SUPERSEDED','max_records',v_coord_limit,'records',v_coord,'heavy_fields_included',false),
    'bootstrap',jsonb_build_object('precedence',jsonb_build_array('PRODUCTION_CANONICAL','ROLE_CHECKPOINT','ACTIVE_TASK','EVENT_HISTORY','HANDOFF','CHAT_MEMORY'),
      'procedure',jsonb_build_array('READ_THIS_COMPACT_STATE','CONTINUE_FROM_LAST_CONFIRMED_CHECKPOINT','DRILL_DOWN_ONLY_ACTIVE_OBJECTS','NEVER_RECONSTRUCT_FROM_CHAT_MEMORY_IF_CANONICAL_STATE_EXISTS'),
      'history_included',false,'heavy_coordination_fields_included',false,'response_budget_bytes',20000));
end
$$;

create or replace function portal_private.ai_role_state_history_read_v2(
  p_role portal_private.ai_business_role_enum,p_before timestamptz default null,p_limit integer default 20)
returns jsonb language sql stable security definer set search_path = portal_private, pg_catalog as $$
  select jsonb_build_object('functional_role',p_role::text,'records',coalesce(jsonb_agg(jsonb_build_object('state_version',q.state_version,'event_type',q.event_type,'active_task_id',q.active_task_id,'snapshot',q.snapshot,'actor_identity',q.actor_identity,'created_at',q.created_at) order by q.created_at desc,q.id desc),'[]'::jsonb))
  from (select * from portal_private.ai_role_state_history_v2 h where h.functional_role=p_role and (p_before is null or h.created_at<p_before) order by h.created_at desc,h.id desc limit greatest(1,least(coalesce(p_limit,20),50))) q
$$;

create or replace function portal_private.ai_role_task_detail_v2(p_role portal_private.ai_business_role_enum,p_task_id text)
returns jsonb language plpgsql stable security definer set search_path = portal_private, pg_catalog as $$
declare v_task jsonb; v_hist jsonb;
begin
  select to_jsonb(x) into v_task from (select t.task_id,t.title,t.description,t.status::text as status,t.priority::text as priority,t.authority_domain,t.assigned_functional_role::text as assigned_functional_role,t.due_at,t.source_type,t.source_object_id,t.source_version,t.acknowledged_at,t.decision,t.decision_at,t.created_at,t.updated_at from portal_private.staff_tasks t where t.qa_only=false and t.task_id=p_task_id and (t.assigned_functional_role::text=p_role::text or p_role='SYSTEM_ADMIN'::portal_private.ai_business_role_enum) limit 1) x;
  if v_task is null then return jsonb_build_object('ok',false,'code','TASK_NOT_FOUND_OR_OUT_OF_SCOPE'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('event_type',h.event_type,'from_status',h.from_status::text,'to_status',h.to_status::text,'note',left(coalesce(h.note,''),1200),'created_at',h.created_at) order by h.created_at desc),'[]'::jsonb) into v_hist
  from portal_private.staff_task_history h join portal_private.staff_tasks t on t.id=h.task_key where t.task_id=p_task_id;
  return jsonb_build_object('ok',true,'task',v_task,'history',v_hist);
end
$$;

revoke all on function portal_private.ai_role_state_snapshot_v2(portal_private.ai_business_role_enum) from public, anon, authenticated;
revoke all on function portal_private.ai_role_state_write_v2(portal_private.ai_business_role_enum,bigint,jsonb,text) from public, anon, authenticated;
revoke all on function portal_private.ai_role_state_touch_v2(portal_private.ai_business_role_enum,text,text) from public, anon, authenticated;
revoke all on function portal_private.ai_role_state_current_v2(portal_private.ai_business_role_enum,integer,integer) from public, anon, authenticated;
revoke all on function portal_private.ai_role_state_history_read_v2(portal_private.ai_business_role_enum,timestamptz,integer) from public, anon, authenticated;
revoke all on function portal_private.ai_role_task_detail_v2(portal_private.ai_business_role_enum,text) from public, anon, authenticated;

insert into portal_private.ai_role_state_checkpoints_v2(functional_role,state_version,metadata,updated_at)
select r::portal_private.ai_business_role_enum,1,jsonb_build_object('last_event_type','CHECKPOINT_BOOTSTRAP','bootstrap_source','production_migration'),now()
from unnest(array['OPERATIONS_DIRECTOR','FINANCE','LEGAL','MARKET_ANALYST','COMMERCIAL_DIRECTOR','RAIL_LOGISTICS','SYSTEM_ADMIN']) r
on conflict(functional_role) do nothing;

with latest_task as (
  select distinct on (assigned_functional_role::text) assigned_functional_role::text role_text,task_id
  from portal_private.staff_tasks where qa_only=false and assigned_functional_role is not null and status::text not in ('COMPLETED','REJECTED','CLOSED')
  order by assigned_functional_role::text,updated_at desc,created_at desc),
latest_coord as (
  select distinct on (role_text) role_text,record_id,created_at from (
    select functional_role::text role_text,record_id,created_at from portal_private.ai_coordination_records where qa_only=false
    union all select target_role::text role_text,record_id,created_at from portal_private.ai_coordination_records where qa_only=false and target_role is not null) q
  order by role_text,created_at desc)
update portal_private.ai_role_state_checkpoints_v2 c
set active_task_id=lt.task_id,
    last_confirmed_checkpoint=case when lc.record_id is not null then jsonb_build_object('event_type','RECOVERY_V2_BASELINE','object_id',lc.record_id::text,'confirmed_at',lc.created_at) else c.last_confirmed_checkpoint end,
    metadata=c.metadata||jsonb_build_object('baseline_aligned_at',now()),updated_at=now()
from latest_task lt left join latest_coord lc on lc.role_text=lt.role_text
where c.functional_role::text=lt.role_text;
