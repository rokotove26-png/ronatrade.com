
-- RONA Trade AI task lifecycle v1.
-- Owner instruction: 2026-09-28, Priority #1 task lifecycle.
-- Goals:
--   1) explicit audited task_complete/task_close lifecycle;
--   2) never infer task terminality from a generic functional conclusion alone;
--   3) keep cross-role and business authority boundaries unchanged.

-- Coordination contract gains an explicit terminal lifecycle record.
alter table portal_private.ai_coordination_records
  drop constraint if exists ai_coordination_records_record_type_check;

alter table portal_private.ai_coordination_records
  add constraint ai_coordination_records_record_type_check
  check (
    record_type = any (array[
      'FUNCTIONAL_CONCLUSION'::text,
      'TASK_ACKNOWLEDGEMENT'::text,
      'TASK_PROGRESS'::text,
      'TASK_TERMINAL_ACTION'::text,
      'HANDOFF_REQUEST'::text,
      'BUSINESS_CHANGE_PROPOSAL'::text,
      'OPERATIONS_INTERNAL_DECISION'::text
    ])
  );

-- Explicit terminalization is the only generic task terminal contract.
create or replace function portal_private.apply_task_terminal_ai_coordination_v1(
  p_record_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $function$
declare
  v_record portal_private.ai_coordination_records%rowtype;
  v_task portal_private.staff_tasks%rowtype;
  v_conclusion portal_private.ai_coordination_records%rowtype;
  v_terminal text;
  v_basis text;
  v_conclusion_id uuid;
  v_note text;
  v_evidence jsonb;
  v_from portal_private.staff_task_status_enum;
begin
  select * into v_record
  from portal_private.ai_coordination_records
  where record_id=p_record_id;

  if not found
     or v_record.qa_only
     or v_record.record_type<>'TASK_TERMINAL_ACTION'
     or upper(coalesce(v_record.target_type,''))<>'TASK'
  then
    return false;
  end if;

  select * into v_task
  from portal_private.staff_tasks
  where task_id=v_record.target_id
  for update;

  if not found then
    raise exception 'TASK_TERMINAL_TARGET_NOT_FOUND';
  end if;

  if v_task.qa_only then
    raise exception 'TASK_TERMINAL_QA_TARGET_DENIED';
  end if;

  if v_task.assigned_functional_role is null
     or v_task.assigned_functional_role::text<>v_record.functional_role::text
  then
    raise exception 'TASK_TERMINAL_ROLE_SCOPE_DENIED';
  end if;

  v_terminal := upper(coalesce(v_record.payload->>'terminal_status',v_record.status,''));
  v_note := btrim(coalesce(v_record.payload->>'note',''));
  v_evidence := coalesce(v_record.evidence_refs,'[]'::jsonb);

  if v_terminal not in ('COMPLETED','CLOSED') then
    raise exception 'TASK_TERMINAL_STATUS_INVALID';
  end if;

  if v_note='' then
    raise exception 'TASK_TERMINAL_NOTE_REQUIRED';
  end if;

  if jsonb_typeof(v_evidence)<>'array' or jsonb_array_length(v_evidence)=0 then
    raise exception 'TASK_TERMINAL_EVIDENCE_REQUIRED';
  end if;

  -- Idempotent terminal replay is harmless; conflicting terminal state is fail-closed.
  if v_task.status::text in ('COMPLETED','CLOSED','REJECTED') then
    if v_task.status::text=v_terminal then
      return false;
    end if;
    raise exception 'TASK_TERMINAL_STATE_CONFLICT';
  end if;

  if v_terminal='COMPLETED' then
    begin
      v_conclusion_id := nullif(v_record.payload->>'conclusion_record_id','')::uuid;
    exception when others then
      raise exception 'TASK_COMPLETION_CONCLUSION_ID_INVALID';
    end;

    if v_conclusion_id is null then
      raise exception 'TASK_COMPLETION_CONCLUSION_REQUIRED';
    end if;

    select * into v_conclusion
    from portal_private.ai_coordination_records c
    where c.record_id=v_conclusion_id
      and c.qa_only=false
      and c.record_type='FUNCTIONAL_CONCLUSION'
      and c.target_type='TASK'
      and c.target_id=v_task.task_id
      and c.functional_role=v_record.functional_role
      and c.status='APPROVED'
      and coalesce((c.payload->>'confirmed')::boolean,false)=true
      and coalesce(jsonb_array_length(c.payload->'mandatory_conditions'),0)=0
      and not exists (
        select 1
        from portal_private.ai_coordination_records n
        where n.qa_only=false
          and n.supersedes_id=c.record_id
      )
      and c.version=(
        select max(x.version)
        from portal_private.ai_coordination_records x
        where x.qa_only=false
          and x.record_type='FUNCTIONAL_CONCLUSION'
          and x.functional_role=v_record.functional_role
          and x.target_type='TASK'
          and x.target_id=v_task.task_id
      );

    if not found then
      raise exception 'TASK_COMPLETION_APPROVED_CONCLUSION_NOT_CURRENT';
    end if;

  else
    -- Administrative close is intentionally narrower than completion.
    if v_record.functional_role::text not in ('OPERATIONS_DIRECTOR','SYSTEM_ADMIN') then
      raise exception 'TASK_CLOSE_ROLE_DENIED';
    end if;

    if v_record.functional_role::text='SYSTEM_ADMIN'
       and upper(coalesce(v_task.authority_domain,'')) not in ('TECHNICAL','SYSTEM','SECURITY')
    then
      raise exception 'TASK_CLOSE_SYSTEM_ADMIN_BUSINESS_SCOPE_DENIED';
    end if;

    v_basis := upper(coalesce(v_record.payload->>'closure_basis',''));
    if v_basis not in ('SUPERSEDED','DUPLICATE','OBSOLETE_SOURCE','NO_LONGER_APPLICABLE') then
      raise exception 'TASK_CLOSE_BASIS_INVALID';
    end if;
  end if;

  v_from := v_task.status;

  update portal_private.staff_tasks
     set status=v_terminal::portal_private.staff_task_status_enum,
         acknowledged_at=coalesce(acknowledged_at,v_record.created_at,clock_timestamp()),
         decision=case
           when v_terminal='COMPLETED'
             then 'AI_TASK_COMPLETED:'||coalesce(v_conclusion_id::text,'')
           else 'AI_TASK_CLOSED:'||coalesce(v_basis,'')
         end,
         decision_at=coalesce(decision_at,v_record.created_at,clock_timestamp()),
         updated_at=clock_timestamp()
   where id=v_task.id;

  insert into portal_private.staff_task_history(
    task_key,event_type,actor_user_id,actor_functional_role,
    from_status,to_status,note,request_id,correlation_id,metadata
  )
  values(
    v_task.id,
    'AI_TASK_TERMINAL_ACTION',
    null,
    v_record.functional_role::text::portal_private.staff_functional_role_enum,
    v_from,
    v_terminal::portal_private.staff_task_status_enum,
    v_note,
    v_record.mcp_request_id,
    v_record.correlation_id,
    jsonb_build_object(
      'actor_type','AI',
      'coordination_record_id',v_record.record_id,
      'terminal_status',v_terminal,
      'conclusion_record_id',v_conclusion_id,
      'closure_basis',v_basis,
      'evidence_refs',v_evidence,
      'business_mutation',false
    )
  );

  insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,
    request_id,correlation_id,metadata
  )
  values(
    null,
    v_record.functional_role::text,
    'AI_TASK_TERMINAL_SETTLED',
    'TASK',
    v_task.task_id,
    v_record.mcp_request_id,
    v_record.correlation_id,
    jsonb_build_object(
      'coordination_record_id',v_record.record_id,
      'from_status',v_from::text,
      'to_status',v_terminal,
      'conclusion_record_id',v_conclusion_id,
      'closure_basis',v_basis,
      'business_mutation',false
    )
  );

  return true;
end
$function$;

revoke all on function portal_private.apply_task_terminal_ai_coordination_v1(uuid)
from public, anon, authenticated, service_role;

create or replace function portal_private.settle_task_terminal_from_ai_coordination_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $function$
begin
  if new.record_type='TASK_TERMINAL_ACTION' then
    perform portal_private.apply_task_terminal_ai_coordination_v1(new.record_id);
  end if;
  return new;
end
$function$;

drop trigger if exists trg_ai_coordination_task_terminal_settle_v1
on portal_private.ai_coordination_records;

create trigger trg_ai_coordination_task_terminal_settle_v1
after insert on portal_private.ai_coordination_records
for each row
execute function portal_private.settle_task_terminal_from_ai_coordination_v1();

-- Owner policy v2: a functional conclusion is not itself a generic task terminal event.
insert into portal_private.ai_role_global_policies_v1(
  policy_id,policy_key,policy_version,functional_role,scope,task_scoped,
  authority_kind,owner_instruction_ref,effective_at,supersedes_policy_id,policy
)
select
  'OPERATIONS_AI_OFFICE_GOVERNANCE_V2',
  'OPERATIONS_AI_OFFICE_GOVERNANCE',
  2,
  'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,
  'GLOBAL_OPERATIONS_ROLE',
  false,
  'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-09-28:OPERATIONS_TASK_LIFECYCLE_V1',
  clock_timestamp(),
  'OPERATIONS_AI_OFFICE_GOVERNANCE_V1',
  jsonb_build_object(
    'policy_id','OPERATIONS_AI_OFFICE_GOVERNANCE_V2',
    'policy_key','OPERATIONS_AI_OFFICE_GOVERNANCE',
    'version',2,
    'scope','GLOBAL_OPERATIONS_ROLE',
    'task_scoped',false,
    'authority','OWNER_INSTRUCTION',
    'rules',jsonb_build_object(
      'CURRENT_STATE_FIRST',true,
      'DELTA_ONLY',true,
      'MINIMUM_CHECKS',true,
      'AUDIT_REQUIRED',true,
      'FAIL_CLOSED_ON_MISSING_OR_CONFLICTING_AUTHORITY',true,
      'NO_CROSS_ROLE_AUTHORITY_EXPANSION',true,
      'FUNCTIONAL_CONCLUSION_IS_TASK_TERMINAL',false,
      'TASK_COMPLETION_CONTRACT','EXPLICIT_TASK_COMPLETE_REQUIRES_ASSIGNED_ROLE_CURRENT_APPROVED_CONFIRMED_CONCLUSION_AND_EVIDENCE',
      'TASK_CLOSE_CONTRACT','OPERATIONS_OR_SYSTEM_ADMIN_ASSIGNED_TASK_ONLY_WITH_ENUMERATED_BASIS_AND_EVIDENCE',
      'AUTO_CLOSE_ON_FUNCTIONAL_CONCLUSION',false,
      'PRICE_PUBLICATION_GUARD','DO_NOT_PUBLISH_BEFORE_ADMIN_APPROVAL',
      'COMMERCIAL_CANONICAL_ROLE','COMMERCIAL_DIRECTOR',
      'MARKET_ANALYST_ROLE','LEGACY_COMPATIBILITY_ONLY'
    ),
    'durability',jsonb_build_object(
      'survives_task_closure',true,
      'survives_new_task',true,
      'survives_new_chat',true,
      'bootstrap_required',true,
      'load_before_active_task',true
    ),
    'supersession',jsonb_build_object(
      'mode','APPEND_VERSION_ONLY',
      'required_authority','NEW_VERSIONED_OWNER_INSTRUCTION'
    )
  )
where not exists(
  select 1
  from portal_private.ai_role_global_policies_v1
  where policy_id='OPERATIONS_AI_OFFICE_GOVERNANCE_V2'
);

-- Current-state conflict semantics: only an explicit terminal action that failed to settle is a lifecycle conflict.
create or replace function portal_private.ai_role_state_current_v2(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = portal_private, pg_catalog
as $function$
declare
  v_policies jsonb;
  v_cp jsonb;
  v_tasks jsonb;
  v_coord jsonb;
  v_conflicts jsonb;
  v_routing jsonb;
  v_task_limit int := greatest(1,least(coalesce(p_task_limit,10),20));
  v_coord_limit int := greatest(1,least(coalesce(p_coord_limit,20),20));
begin
  v_policies := portal_private.ai_role_global_policies_current_v1(p_role);

  v_cp := coalesce(portal_private.ai_role_state_snapshot_v2(p_role),jsonb_build_object(
    'functional_role',p_role::text,'state_version',0,'last_confirmed_checkpoint','{}'::jsonb,'active_task_id',null,
    'open_delta','[]'::jsonb,'blockers','[]'::jsonb,'pending_actions','[]'::jsonb,'canonical_sources','[]'::jsonb,'metadata','{}'::jsonb,'updated_at',null
  ));

  select coalesce(jsonb_agg(x.obj order by x.updated_at desc),'[]'::jsonb) into v_tasks
  from (
    select t.updated_at,
      jsonb_build_object(
        'task_id',t.task_id,
        'title',left(t.title,240),
        'status',t.status::text,
        'priority',t.priority::text,
        'authority_domain',t.authority_domain,
        'source_type',t.source_type,
        'source_object_id',t.source_object_id,
        'due_at',t.due_at,
        'created_at',t.created_at,
        'updated_at',t.updated_at,
        'age_minutes',greatest(0,floor(extract(epoch from (now()-t.created_at))/60)::int),
        'initial_response_sla_minutes',
          case t.priority::text
            when 'CRITICAL' then 0
            when 'HIGH' then 5
            when 'NORMAL' then 15
            when 'LOW' then 60
            else 15
          end,
        'sla_state',
          case
            when t.status::text='NEW' and now() >
              t.created_at + make_interval(mins =>
                case t.priority::text
                  when 'CRITICAL' then 0
                  when 'HIGH' then 5
                  when 'NORMAL' then 15
                  when 'LOW' then 60
                  else 15
                end
              ) then 'BREACHED'
            when t.status::text='NEW' then 'WITHIN_SLA'
            when t.status::text in ('ACKNOWLEDGED','IN_PROGRESS') then 'STARTED'
            else 'OPEN_STATUS'
          end,
        'aging_state',
          case
            when t.due_at is not null and t.due_at < now() then 'OVERDUE'
            when t.status::text='NEW' and t.updated_at < now()-interval '4 hours' then 'STALE'
            when t.status::text in ('ACKNOWLEDGED','IN_PROGRESS') and t.updated_at < now()-interval '24 hours' then 'STALE'
            else 'CURRENT'
          end,
        'next_required_action',
          case
            when t.status::text='NEW' then 'ACKNOWLEDGE_AND_START'
            when t.status::text in ('ACKNOWLEDGED','IN_PROGRESS') then 'CONTINUE_OR_SET_BLOCKED'
            else 'REVIEW_OPEN_STATUS'
          end
      ) obj
    from portal_private.staff_tasks t
    where t.qa_only=false
      and t.assigned_functional_role::text=p_role::text
      and t.status::text not in ('COMPLETED','REJECTED','CLOSED')
    order by t.updated_at desc
    limit v_task_limit
  ) x;

  select coalesce(jsonb_agg(x.obj order by x.task_updated_at desc),'[]'::jsonb) into v_conflicts
  from (
    select t.updated_at as task_updated_at,
      jsonb_build_object(
        'conflict_code','TASK_TERMINAL_ACTION_NOT_MATERIALIZED',
        'task_id',t.task_id,
        'task_status',t.status::text,
        'task_updated_at',t.updated_at,
        'terminal_record_id',a.record_id,
        'requested_terminal_status',a.status,
        'terminal_action_created_at',a.created_at,
        'resolution_policy','FAIL_CLOSED_REVIEW_TERMINAL_ACTION'
      ) obj
    from portal_private.staff_tasks t
    join lateral (
      select r.record_id,r.status,r.created_at
      from portal_private.ai_coordination_records r
      where r.qa_only=false
        and r.record_type='TASK_TERMINAL_ACTION'
        and r.target_type='TASK'
        and r.target_id=t.task_id
        and r.functional_role=p_role
      order by r.created_at desc
      limit 1
    ) a on true
    where t.qa_only=false
      and t.assigned_functional_role::text=p_role::text
      and t.status::text not in ('COMPLETED','REJECTED','CLOSED')
    order by t.updated_at desc
    limit 20
  ) x;

  select jsonb_build_object(
    'contract','RONA_ROLE_ROUTING_CONTRACT_V1',
    'canonical_commercial_role','COMMERCIAL_DIRECTOR',
    'legacy_aliases',jsonb_build_object('MARKET_ANALYST','COMMERCIAL_DIRECTOR'),
    'ai_roles',coalesce((
      select jsonb_agg(e.enumlabel order by e.enumsortorder)
      from pg_catalog.pg_enum e
      join pg_catalog.pg_type t on t.oid=e.enumtypid
      join pg_catalog.pg_namespace n on n.oid=t.typnamespace
      where n.nspname='portal_private' and t.typname='ai_business_role_enum'
    ),'[]'::jsonb),
    'staff_roles',coalesce((
      select jsonb_agg(e.enumlabel order by e.enumsortorder)
      from pg_catalog.pg_enum e
      join pg_catalog.pg_type t on t.oid=e.enumtypid
      join pg_catalog.pg_namespace n on n.oid=t.typnamespace
      where n.nspname='portal_private' and t.typname='staff_functional_role_enum'
    ),'[]'::jsonb),
    'known_gaps',jsonb_build_array(
      jsonb_build_object('role','ACCOUNTING','status','STAFF_ROLE_PRESENT_AI_ROLE_NOT_MATERIALIZED'),
      jsonb_build_object('role','TREASURY','status','NOT_MATERIALIZED_AS_AI_OR_STAFF_ROLE')
    )
  ) into v_routing;

  select coalesce(jsonb_agg(x.obj order by x.created_at desc),'[]'::jsonb) into v_coord
  from (
    select r.created_at,
      jsonb_build_object(
        'record_id',r.record_id,'record_type',r.record_type,'from_role',r.functional_role::text,
        'target_role',r.target_role::text,'target_type',r.target_type,'target_id',r.target_id,
        'parent_record_id',r.parent_record_id,'version',r.version,'supersedes_id',r.supersedes_id,
        'status',r.status,'created_at',r.created_at
      ) obj
    from portal_private.ai_coordination_records r
    where r.qa_only=false
      and (
        r.functional_role=p_role or r.target_role=p_role or
        (p_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
          and r.record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION','TASK_TERMINAL_ACTION')
          and r.target_type<>'SYSTEM')
      )
      and not exists(
        select 1 from portal_private.ai_coordination_records n
        where n.qa_only=false and n.supersedes_id=r.record_id
      )
    order by r.created_at desc
    limit v_coord_limit
  ) x;

  return jsonb_build_object(
    'data_contract','RONA_ROLE_STATE_RECOVERY_V2',
    'generated_at',now(),
    'functional_role',p_role::text,
    'global_role_policies',v_policies,
    'checkpoint',v_cp,
    'active_tasks',v_tasks,
    'state_conflicts',v_conflicts,
    'routing_capabilities',v_routing,
    'coordination',jsonb_build_object(
      'projection','LATEST_NON_SUPERSEDED',
      'max_records',v_coord_limit,
      'records',v_coord,
      'heavy_fields_included',false
    ),
    'bootstrap',jsonb_build_object(
      'precedence',jsonb_build_array('PRODUCTION_CANONICAL','GLOBAL_ROLE_POLICY','ROLE_CHECKPOINT','ACTIVE_TASK','EVENT_HISTORY','HANDOFF','CHAT_MEMORY'),
      'procedure',jsonb_build_array('READ_THIS_COMPACT_STATE','READ_GLOBAL_ROLE_POLICIES','APPLY_GLOBAL_ROLE_POLICIES_BEFORE_ACTIVE_TASK','CONTINUE_FROM_LAST_CONFIRMED_CHECKPOINT','DRILL_DOWN_ONLY_ACTIVE_OBJECTS','NEVER_RECONSTRUCT_FROM_CHAT_MEMORY_IF_CANONICAL_STATE_EXISTS'),
      'global_policy_count',jsonb_array_length(v_policies),
      'global_policy_must_apply_before_tasks',true,
      'task_state_conflict_count',jsonb_array_length(v_conflicts),
      'task_state_conflicts_fail_closed',true,
      'task_lifecycle_contract','RONA_AI_TASK_LIFECYCLE_V1',
      'functional_conclusion_implies_task_terminal',false,
      'sla_diagnostics_included',true,
      'routing_contract','RONA_ROLE_ROUTING_CONTRACT_V1',
      'history_included',false,
      'heavy_coordination_fields_included',false,
      'response_budget_bytes',24000
    )
  );
end
$function$;

-- Exception cockpit uses the same explicit lifecycle semantics.
create or replace function portal_private.ai_role_exception_cockpit_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language plpgsql
stable
security definer
set search_path = portal_private, pg_catalog
as $function$
declare
  v_conflicts jsonb;
  v_candidates jsonb;
  v_action_now jsonb;
  v_waiting jsonb;
  v_stale jsonb;
  v_blocked jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
      'task_id',t.task_id,
      'task_status',t.status::text,
      'terminal_record_id',r.record_id,
      'requested_terminal_status',r.status,
      'code','TASK_TERMINAL_ACTION_NOT_MATERIALIZED'
    ) order by t.updated_at desc),'[]'::jsonb)
  into v_conflicts
  from portal_private.staff_tasks t
  join lateral (
    select c.record_id,c.status
    from portal_private.ai_coordination_records c
    where c.qa_only=false
      and c.record_type='TASK_TERMINAL_ACTION'
      and c.target_type='TASK'
      and c.target_id=t.task_id
      and c.functional_role=p_role
    order by c.created_at desc
    limit 1
  ) r on true
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text not in ('COMPLETED','CLOSED','REJECTED');

  v_candidates := portal_private.ai_reverse_event_reconciliation_candidates_v1(p_role);

  select coalesce(jsonb_agg(jsonb_build_object(
      'task_id',t.task_id,'priority',t.priority::text,'status',t.status::text,
      'age_minutes',greatest(0,floor(extract(epoch from (now()-t.created_at))/60)::int),
      'source_ref',t.source_type||':'||coalesce(t.source_object_id,'UNKNOWN')
    ) order by
      case t.priority::text when 'CRITICAL' then 0 when 'HIGH' then 1 when 'NORMAL' then 2 else 3 end,
      t.created_at asc
    ),'[]'::jsonb)
  into v_action_now
  from portal_private.staff_tasks t
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text='NEW'
    and now() > t.created_at + make_interval(mins =>
      case t.priority::text when 'CRITICAL' then 0 when 'HIGH' then 5 when 'NORMAL' then 15 when 'LOW' then 60 else 15 end
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'task_id',t.task_id,'status',t.status::text,'updated_at',t.updated_at
  ) order by t.updated_at asc),'[]'::jsonb)
  into v_waiting
  from portal_private.staff_tasks t
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text='WAITING';

  select coalesce(jsonb_agg(jsonb_build_object(
    'task_id',t.task_id,'status',t.status::text,'updated_at',t.updated_at,
    'stale_hours',floor(extract(epoch from (now()-t.updated_at))/3600)::int
  ) order by t.updated_at asc),'[]'::jsonb)
  into v_stale
  from portal_private.staff_tasks t
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text in ('NEW','ACKNOWLEDGED','IN_PROGRESS')
    and (
      (t.status::text='NEW' and t.updated_at < now()-interval '4 hours') or
      (t.status::text in ('ACKNOWLEDGED','IN_PROGRESS') and t.updated_at < now()-interval '24 hours')
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'task_id',t.task_id,'progress_record_id',p.record_id,'created_at',p.created_at
  ) order by p.created_at desc),'[]'::jsonb)
  into v_blocked
  from portal_private.staff_tasks t
  join lateral (
    select c.record_id,c.created_at,c.status
    from portal_private.ai_coordination_records c
    where c.qa_only=false
      and c.record_type='TASK_PROGRESS'
      and c.target_type='TASK'
      and c.target_id=t.task_id
      and c.functional_role=p_role
    order by c.created_at desc
    limit 1
  ) p on true
  where t.qa_only=false
    and t.assigned_functional_role::text=p_role::text
    and t.status::text not in ('COMPLETED','CLOSED','REJECTED')
    and p.status='BLOCKED';

  return jsonb_build_object(
    'contract','RONA_EXCEPTION_FIRST_COCKPIT_V1',
    'generated_at',now(),
    'role',p_role::text,
    'ACTION_NOW',v_action_now,
    'WAITING_EXTERNAL',v_waiting,
    'BLOCKED',v_blocked,
    'STALE',v_stale,
    'STATE_CONFLICTS',v_conflicts,
    'RECONCILIATION_CANDIDATES',v_candidates,
    'counts',jsonb_build_object(
      'action_now',jsonb_array_length(v_action_now),
      'waiting_external',jsonb_array_length(v_waiting),
      'blocked',jsonb_array_length(v_blocked),
      'stale',jsonb_array_length(v_stale),
      'state_conflicts',jsonb_array_length(v_conflicts),
      'reconciliation_candidates',jsonb_array_length(v_candidates),
      'safe_reconciliation_candidates',(
        select count(*) from jsonb_array_elements(v_candidates) j
        where coalesce((j->>'safe_to_auto_resolve')::boolean,false)=true
      )
    ),
    'mutation_mode','READ_ONLY_DIAGNOSTIC',
    'task_lifecycle_contract','RONA_AI_TASK_LIFECYCLE_V1'
  );
end
$function$;

-- Fail-fast migration QA.
do $qa$
declare
  v_count integer;
begin
  select count(*) into v_count
  from portal_private.ai_role_global_policies_v1
  where policy_id='OPERATIONS_AI_OFFICE_GOVERNANCE_V2'
    and supersedes_policy_id='OPERATIONS_AI_OFFICE_GOVERNANCE_V1';
  if v_count<>1 then
    raise exception 'TASK_LIFECYCLE_QA_POLICY_V2_MISSING';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_trigger
  where tgrelid='portal_private.ai_coordination_records'::regclass
    and tgname='trg_ai_coordination_task_terminal_settle_v1'
    and not tgisinternal;
  if v_count<>1 then
    raise exception 'TASK_LIFECYCLE_QA_TRIGGER_MISSING';
  end if;

  if not exists(
    select 1
    from pg_catalog.pg_constraint
    where conrelid='portal_private.ai_coordination_records'::regclass
      and conname='ai_coordination_records_record_type_check'
      and pg_get_constraintdef(oid,true) like '%TASK_TERMINAL_ACTION%'
  ) then
    raise exception 'TASK_LIFECYCLE_QA_RECORD_TYPE_MISSING';
  end if;
end
$qa$;
