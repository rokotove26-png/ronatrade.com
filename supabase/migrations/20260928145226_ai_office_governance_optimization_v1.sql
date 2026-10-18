-- RONA Trade AI Office governance optimization v1.
-- Owner approval: 2026-09-28.
-- Scope: policy materialization + current-state diagnostics only.
-- Business authoritative mutation: none.
-- Task auto-close: forbidden.
-- Publication mutation: none.

insert into portal_private.ai_role_global_policies_v1 (
  policy_id, policy_key, policy_version, functional_role, scope, task_scoped,
  authority_kind, owner_instruction_ref, effective_at, supersedes_policy_id, policy
)
select
  'OPERATIONS_AI_OFFICE_GOVERNANCE_V1',
  'OPERATIONS_AI_OFFICE_GOVERNANCE',
  1,
  'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,
  'GLOBAL_OPERATIONS_ROLE',
  false,
  'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-09-28:OPERATIONS_AI_OFFICE_GOVERNANCE_V1',
  timestamptz '2026-09-28 14:42:00+00',
  null,
  jsonb_build_object(
    'policy_id','OPERATIONS_AI_OFFICE_GOVERNANCE_V1',
    'policy_key','OPERATIONS_AI_OFFICE_GOVERNANCE',
    'version',1,
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
      'TASK_CONCLUSION_RECONCILIATION','DIAGNOSTIC_ONLY_NO_AUTO_CLOSE',
      'STALE_TASK_ESCALATION','RECHECK_CURRENT_AUTHORITY_BEFORE_ESCALATION',
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
where not exists (
  select 1 from portal_private.ai_role_global_policies_v1
  where policy_id='OPERATIONS_AI_OFFICE_GOVERNANCE_V1'
);

insert into portal_private.ai_role_global_policies_v1 (
  policy_id, policy_key, policy_version, functional_role, scope, task_scoped,
  authority_kind, owner_instruction_ref, effective_at, supersedes_policy_id, policy
)
select
  'SYSTEM_ADMIN_AI_OFFICE_GOVERNANCE_V1',
  'SYSTEM_ADMIN_AI_OFFICE_GOVERNANCE',
  1,
  'SYSTEM_ADMIN'::portal_private.ai_business_role_enum,
  'GLOBAL_SYSTEM_ADMIN_ROLE',
  false,
  'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-09-28:SYSTEM_ADMIN_AI_OFFICE_GOVERNANCE_V1',
  timestamptz '2026-09-28 14:42:00+00',
  null,
  jsonb_build_object(
    'policy_id','SYSTEM_ADMIN_AI_OFFICE_GOVERNANCE_V1',
    'policy_key','SYSTEM_ADMIN_AI_OFFICE_GOVERNANCE',
    'version',1,
    'scope','GLOBAL_SYSTEM_ADMIN_ROLE',
    'task_scoped',false,
    'authority','OWNER_INSTRUCTION',
    'rules',jsonb_build_object(
      'IMPLEMENTATION_MODE','DELTA_ONLY',
      'ROLLBACK_POINT_REQUIRED',true,
      'CONTRACT_TESTS_REQUIRED',true,
      'CURRENT_STATE_SMOKE_REQUIRED',true,
      'NO_BUSINESS_FACT_CREATION',true,
      'NO_SILENT_CONNECTOR_DISCONNECT',true,
      'NO_AUTHORITY_EXPANSION',true,
      'ROLE_ROUTING_ALIGNMENT','COMMERCIAL_DIRECTOR_CANONICAL_MARKET_ANALYST_LEGACY',
      'POLICY_REGISTRY_MATERIALIZATION_REQUIRED',true,
      'TASK_STATE_CONFLICT_DIAGNOSTICS_REQUIRED',true
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
where not exists (
  select 1 from portal_private.ai_role_global_policies_v1
  where policy_id='SYSTEM_ADMIN_AI_OFFICE_GOVERNANCE_V1'
);

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
as $$
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
        'task_id',t.task_id,'title',left(t.title,240),'status',t.status::text,'priority',t.priority::text,
        'authority_domain',t.authority_domain,'source_type',t.source_type,'source_object_id',t.source_object_id,
        'due_at',t.due_at,'created_at',t.created_at,'updated_at',t.updated_at,
        'age_minutes',greatest(0,floor(extract(epoch from (now()-t.created_at))/60)::int),
        'initial_response_sla_minutes',case t.priority::text when 'CRITICAL' then 0 when 'HIGH' then 5 when 'NORMAL' then 15 when 'LOW' then 60 else 15 end,
        'sla_state',case
          when t.status::text='NEW' and now() > t.created_at + make_interval(mins => case t.priority::text when 'CRITICAL' then 0 when 'HIGH' then 5 when 'NORMAL' then 15 when 'LOW' then 60 else 15 end) then 'BREACHED'
          when t.status::text='NEW' then 'WITHIN_SLA'
          when t.status::text in ('ACKNOWLEDGED','IN_PROGRESS') then 'STARTED'
          else 'OPEN_STATUS'
        end,
        'aging_state',case
          when t.due_at is not null and t.due_at < now() then 'OVERDUE'
          when t.status::text='NEW' and t.updated_at < now()-interval '4 hours' then 'STALE'
          when t.status::text in ('ACKNOWLEDGED','IN_PROGRESS') and t.updated_at < now()-interval '24 hours' then 'STALE'
          else 'CURRENT'
        end,
        'next_required_action',case
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
        'conflict_code','TASK_OPEN_WITH_TERMINAL_CONCLUSION',
        'task_id',t.task_id,'task_status',t.status::text,'task_updated_at',t.updated_at,
        'conclusion_record_id',c.record_id,'conclusion_status',c.status,'conclusion_version',c.version,
        'conclusion_created_at',c.created_at,'resolution_policy','REVIEW_REQUIRED_NO_AUTO_CLOSE'
      ) obj
    from portal_private.staff_tasks t
    join lateral (
      select r.record_id,r.status,r.version,r.created_at
      from portal_private.ai_coordination_records r
      where r.qa_only=false and r.record_type='FUNCTIONAL_CONCLUSION' and r.target_type='TASK'
        and r.target_id=t.task_id and r.functional_role=p_role
        and not exists (select 1 from portal_private.ai_coordination_records n where n.qa_only=false and n.supersedes_id=r.record_id)
      order by r.version desc,r.created_at desc limit 1
    ) c on true
    where t.qa_only=false
      and t.assigned_functional_role::text=p_role::text
      and t.status::text not in ('COMPLETED','REJECTED','CLOSED')
      and c.status in ('APPROVED','APPROVED_WITH_CONDITIONS','REJECTED')
    order by t.updated_at desc limit 20
  ) x;

  select jsonb_build_object(
    'contract','RONA_ROLE_ROUTING_CONTRACT_V1',
    'canonical_commercial_role','COMMERCIAL_DIRECTOR',
    'legacy_aliases',jsonb_build_object('MARKET_ANALYST','COMMERCIAL_DIRECTOR'),
    'ai_roles',coalesce((select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_catalog.pg_enum e join pg_catalog.pg_type t on t.oid=e.enumtypid join pg_catalog.pg_namespace n on n.oid=t.typnamespace where n.nspname='portal_private' and t.typname='ai_business_role_enum'),'[]'::jsonb),
    'staff_roles',coalesce((select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_catalog.pg_enum e join pg_catalog.pg_type t on t.oid=e.enumtypid join pg_catalog.pg_namespace n on n.oid=t.typnamespace where n.nspname='portal_private' and t.typname='staff_functional_role_enum'),'[]'::jsonb),
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
      and (r.functional_role=p_role or r.target_role=p_role or
        (p_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum and r.record_type in ('FUNCTIONAL_CONCLUSION','HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION') and r.target_type<>'SYSTEM'))
      and not exists(select 1 from portal_private.ai_coordination_records n where n.qa_only=false and n.supersedes_id=r.record_id)
    order by r.created_at desc limit v_coord_limit
  ) x;

  return jsonb_build_object(
    'data_contract','RONA_ROLE_STATE_RECOVERY_V2','generated_at',now(),'functional_role',p_role::text,
    'global_role_policies',v_policies,'checkpoint',v_cp,'active_tasks',v_tasks,
    'state_conflicts',v_conflicts,'routing_capabilities',v_routing,
    'coordination',jsonb_build_object('projection','LATEST_NON_SUPERSEDED','max_records',v_coord_limit,'records',v_coord,'heavy_fields_included',false),
    'bootstrap',jsonb_build_object(
      'precedence',jsonb_build_array('PRODUCTION_CANONICAL','GLOBAL_ROLE_POLICY','ROLE_CHECKPOINT','ACTIVE_TASK','EVENT_HISTORY','HANDOFF','CHAT_MEMORY'),
      'procedure',jsonb_build_array('READ_THIS_COMPACT_STATE','READ_GLOBAL_ROLE_POLICIES','APPLY_GLOBAL_ROLE_POLICIES_BEFORE_ACTIVE_TASK','CONTINUE_FROM_LAST_CONFIRMED_CHECKPOINT','DRILL_DOWN_ONLY_ACTIVE_OBJECTS','NEVER_RECONSTRUCT_FROM_CHAT_MEMORY_IF_CANONICAL_STATE_EXISTS'),
      'global_policy_count',jsonb_array_length(v_policies),'global_policy_must_apply_before_tasks',true,
      'task_state_conflict_count',jsonb_array_length(v_conflicts),'task_state_conflicts_fail_closed',true,
      'sla_diagnostics_included',true,'routing_contract','RONA_ROLE_ROUTING_CONTRACT_V1',
      'history_included',false,'heavy_coordination_fields_included',false,'response_budget_bytes',24000
    )
  );
end
$$;

revoke execute on function portal_private.ai_role_state_current_v2(
  portal_private.ai_business_role_enum,integer,integer
) from public, anon, authenticated, service_role;

comment on function portal_private.ai_role_state_current_v2(
  portal_private.ai_business_role_enum,integer,integer
) is 'RONA role current state v2; 2026-09-28 adds effective owner-policy materialization, SLA/aging diagnostics, task/conclusion conflict detection, and routing-gap visibility without auto-close or authority expansion.';
