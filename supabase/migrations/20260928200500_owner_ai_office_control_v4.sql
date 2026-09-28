-- RONA Trade Owner/AI Office Control V4
-- Owner instruction: only OWNER and TREASURY are human actors.
-- All operational roles in this contour are AI roles; missing AI identities remain explicit GAPs.
-- No commercial, financial, legal, client, price, shipment, or payment facts are created or changed.

alter table portal_private.ai_role_authority_registry_v2
  add column if not exists actor_kind text,
  add column if not exists human_materialized boolean not null default false;

update portal_private.ai_role_authority_registry_v2
set actor_kind=case
      when role_key in ('OWNER','TREASURY') then 'HUMAN'
      when role_key='MARKET_ANALYST' then 'LEGACY_AI'
      else 'AI'
    end,
    human_materialized=(role_key in ('OWNER','TREASURY')),
    source_ref='OWNER_INSTRUCTION:2026-09-28:HUMAN_ACTOR_TOPOLOGY_V1',
    updated_at=clock_timestamp();

insert into portal_private.ai_role_authority_registry_v2(
  role_key,canonical_role,organizational_title,lifecycle_state,
  ai_materialized,staff_materialized,handoff_target_enabled,legacy_alias_of,
  entity_scopes,source_ref,actor_kind,human_materialized
)
values
('OWNER','OWNER','Собственник','ACTIVE',false,false,false,null,'[]'::jsonb,
 'OWNER_INSTRUCTION:2026-09-28:HUMAN_ACTOR_TOPOLOGY_V1','HUMAN',true),
('TREASURY','TREASURY','Казначей','ACTIVE',false,false,false,null,'[]'::jsonb,
 'OWNER_INSTRUCTION:2026-09-28:HUMAN_ACTOR_TOPOLOGY_V1','HUMAN',true)
on conflict(role_key) do update set
  organizational_title=excluded.organizational_title,
  lifecycle_state=excluded.lifecycle_state,
  ai_materialized=excluded.ai_materialized,
  staff_materialized=excluded.staff_materialized,
  handoff_target_enabled=excluded.handoff_target_enabled,
  actor_kind=excluded.actor_kind,
  human_materialized=excluded.human_materialized,
  source_ref=excluded.source_ref,
  updated_at=clock_timestamp();

update portal_private.ai_role_authority_registry_v2
set actor_kind='AI',human_materialized=false,
    lifecycle_state=case when ai_materialized then 'ACTIVE' else 'GAP' end,
    source_ref='OWNER_INSTRUCTION:2026-09-28:HUMAN_ACTOR_TOPOLOGY_V1',
    updated_at=clock_timestamp()
where role_key in (
  'EXECUTIVE_DIRECTOR','OPERATIONS_DIRECTOR','FINANCE','LEGAL',
  'COMMERCIAL_DIRECTOR','RAIL_LOGISTICS','SYSTEM_ADMIN','ACCOUNTING'
);

update portal_private.ai_role_authority_registry_v2
set actor_kind='LEGACY_AI',human_materialized=false,lifecycle_state='LEGACY',
    canonical_role='COMMERCIAL_DIRECTOR',legacy_alias_of='COMMERCIAL_DIRECTOR',
    handoff_target_enabled=false,
    source_ref='OWNER_INSTRUCTION:2026-09-28:HUMAN_ACTOR_TOPOLOGY_V1',
    updated_at=clock_timestamp()
where role_key='MARKET_ANALYST';

do $do$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='portal_private.ai_role_authority_registry_v2'::regclass
      and conname='ai_role_authority_registry_v2_actor_kind_check'
  ) then
    alter table portal_private.ai_role_authority_registry_v2
      add constraint ai_role_authority_registry_v2_actor_kind_check
      check (actor_kind in ('AI','LEGACY_AI','HUMAN'));
  end if;
end
$do$;

alter table portal_private.ai_role_authority_registry_v2
  alter column actor_kind set not null;

create or replace function portal_private.ai_role_routing_contract_v3()
returns jsonb
language sql
stable security definer
set search_path='portal_private','pg_catalog'
as $function$
  with r as (
    select * from portal_private.ai_role_authority_registry_v2 order by role_key
  )
  select jsonb_build_object(
    'contract','RONA_ROLE_ROUTING_CONTRACT_V3',
    'topology_authority','OWNER_INSTRUCTION:2026-09-28:HUMAN_ACTOR_TOPOLOGY_V1',
    'human_actor_rule','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
    'canonical_commercial_role','COMMERCIAL_DIRECTOR',
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role_key',role_key,
        'canonical_role',canonical_role,
        'organizational_title',organizational_title,
        'lifecycle_state',lifecycle_state,
        'actor_kind',actor_kind,
        'ai_materialized',ai_materialized,
        'human_materialized',human_materialized,
        'task_role_materialized',staff_materialized,
        'handoff_target_enabled',handoff_target_enabled,
        'legacy_alias_of',legacy_alias_of,
        'entity_scopes',entity_scopes,
        'source_ref',source_ref,
        'updated_at',updated_at
      ) order by role_key) from r
    ),'[]'::jsonb),
    'human_actors',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role',role_key,'title',organizational_title,'materialized',human_materialized
      ) order by role_key)
      from r where actor_kind='HUMAN' and lifecycle_state='ACTIVE'
    ),'[]'::jsonb),
    'active_ai_roles',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r where actor_kind='AI' and lifecycle_state='ACTIVE' and ai_materialized
    ),'[]'::jsonb),
    'legacy_ai_roles',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r where actor_kind='LEGACY_AI'
    ),'[]'::jsonb),
    'ai_role_gaps',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role',role_key,'status','AI_ROLE_EXPECTED_NOT_MATERIALIZED'
      ) order by role_key)
      from r where actor_kind='AI' and not ai_materialized
    ),'[]'::jsonb),
    'task_assignment_roles',coalesce((
      select jsonb_agg(role_key order by role_key) from r where staff_materialized
    ),'[]'::jsonb),
    'task_assignment_roles_semantics','TECHNICAL_ROLE_TAXONOMY_NOT_HUMAN_HEADCOUNT',
    'canonical_ai_handoff_targets',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where actor_kind='AI'
        and lifecycle_state='ACTIVE'
        and ai_materialized
        and handoff_target_enabled
    ),'[]'::jsonb),
    'human_escalation_targets',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where actor_kind='HUMAN' and lifecycle_state='ACTIVE' and human_materialized
    ),'[]'::jsonb),
    'legacy_aliases',coalesce((
      select jsonb_object_agg(role_key,legacy_alias_of order by role_key)
      from r where lifecycle_state='LEGACY' and legacy_alias_of is not null
    ),'{}'::jsonb)
  )
$function$;

revoke all on function portal_private.ai_role_routing_contract_v3() from public,anon,authenticated,service_role;

create or replace function portal_private.ai_task_dependencies_materialize_v2()
returns jsonb
language plpgsql
security definer
set search_path='portal_private','pg_catalog'
as $function$
declare
  v_inserted_role integer:=0;
  v_updated_role integer:=0;
  v_inserted_source integer:=0;
  v_updated_source integer:=0;
begin
  with latest_handoff as (
    select distinct on (h.target_id,h.target_role)
      h.target_id task_id,
      h.target_role::text depends_on_role,
      h.record_id,h.created_at,h.status,h.payload
    from portal_private.ai_coordination_records h
    join portal_private.staff_tasks t
      on t.task_id=h.target_id
     and t.qa_only=false
     and t.status::text not in ('COMPLETED','CLOSED','REJECTED')
    where h.qa_only=false
      and h.record_type='HANDOFF_REQUEST'
      and h.target_type='TASK'
      and h.target_role is not null
    order by h.target_id,h.target_role,h.created_at desc
  ),
  ins as (
    insert into portal_private.ai_task_dependencies_v1(
      task_id,dependency_type,depends_on_role,required_state,status,source_ref,details
    )
    select h.task_id,'ROLE',h.depends_on_role,'HANDOFF_RESOLVED',
      case when exists(
        select 1
        from portal_private.ai_coordination_records c
        where c.qa_only=false
          and c.record_type='FUNCTIONAL_CONCLUSION'
          and c.target_type='TASK'
          and c.target_id=h.task_id
          and c.functional_role::text=h.depends_on_role
          and c.created_at>h.created_at
          and c.status='APPROVED'
          and coalesce((c.payload->>'confirmed')::boolean,false)=true
      ) then 'SATISFIED' else 'OPEN' end,
      'COORDINATION:'||h.record_id::text,
      jsonb_build_object(
        'record_id',h.record_id,
        'subject',h.payload->>'subject',
        'reason',h.payload->>'reason',
        'priority',h.payload->>'priority',
        'materializer','AI_TASK_DEPENDENCIES_MATERIALIZE_V2'
      )
    from latest_handoff h
    where not exists(
      select 1 from portal_private.ai_task_dependencies_v1 d
      where d.task_id=h.task_id
        and d.dependency_type='ROLE'
        and d.depends_on_role=h.depends_on_role
        and d.required_state='HANDOFF_RESOLVED'
    )
    returning 1
  )
  select count(*) into v_inserted_role from ins;

  with latest_handoff as (
    select distinct on (h.target_id,h.target_role)
      h.target_id task_id,h.target_role::text depends_on_role,
      h.record_id,h.created_at,h.payload
    from portal_private.ai_coordination_records h
    join portal_private.staff_tasks t
      on t.task_id=h.target_id
     and t.qa_only=false
     and t.status::text not in ('COMPLETED','CLOSED','REJECTED')
    where h.qa_only=false
      and h.record_type='HANDOFF_REQUEST'
      and h.target_type='TASK'
      and h.target_role is not null
    order by h.target_id,h.target_role,h.created_at desc
  )
  update portal_private.ai_task_dependencies_v1 d
  set status=case when exists(
        select 1
        from portal_private.ai_coordination_records c
        where c.qa_only=false
          and c.record_type='FUNCTIONAL_CONCLUSION'
          and c.target_type='TASK'
          and c.target_id=h.task_id
          and c.functional_role::text=h.depends_on_role
          and c.created_at>h.created_at
          and c.status='APPROVED'
          and coalesce((c.payload->>'confirmed')::boolean,false)=true
      ) then 'SATISFIED' else 'OPEN' end,
      source_ref='COORDINATION:'||h.record_id::text,
      details=jsonb_build_object(
        'record_id',h.record_id,
        'subject',h.payload->>'subject',
        'reason',h.payload->>'reason',
        'priority',h.payload->>'priority',
        'materializer','AI_TASK_DEPENDENCIES_MATERIALIZE_V2'
      ),
      updated_at=clock_timestamp()
  from latest_handoff h
  where d.task_id=h.task_id
    and d.dependency_type='ROLE'
    and d.depends_on_role=h.depends_on_role
    and d.required_state='HANDOFF_RESOLVED';
  get diagnostics v_updated_role=row_count;

  with roles as (
    select unnest(enum_range(null::portal_private.ai_business_role_enum)) role
  ),
  candidates as (
    select
      x.obj->>'task_id' task_id,
      x.obj->>'classification' classification,
      x.obj->>'source_ref' source_ref,
      x.obj->>'entity_ref' entity_ref,
      x.obj->>'event_id' event_id,
      x.obj->>'recommended_action' recommended_action
    from roles r
    cross join lateral jsonb_array_elements(
      portal_private.ai_reverse_event_reconciliation_candidates_v1(r.role)
    ) x(obj)
  ),
  holds as (
    select *,
      split_part(entity_ref,':',1) entity_type,
      substring(entity_ref from position(':' in entity_ref)+1) entity_id
    from candidates
    where classification='HOLD_SOURCE_ENTITY_ABSENT'
      and position(':' in entity_ref)>0
  ),
  ins as (
    insert into portal_private.ai_task_dependencies_v1(
      task_id,dependency_type,depends_on_entity_type,depends_on_entity_id,
      required_state,status,source_ref,details
    )
    select h.task_id,'SOURCE',h.entity_type,h.entity_id,
      'SOURCE_ENTITY_PRESENT','OPEN',h.source_ref,
      jsonb_build_object(
        'event_id',h.event_id,
        'classification',h.classification,
        'recommended_action',h.recommended_action,
        'materializer','AI_TASK_DEPENDENCIES_MATERIALIZE_V2'
      )
    from holds h
    where not exists(
      select 1 from portal_private.ai_task_dependencies_v1 d
      where d.task_id=h.task_id
        and d.dependency_type='SOURCE'
        and d.depends_on_entity_type=h.entity_type
        and d.depends_on_entity_id=h.entity_id
        and d.required_state='SOURCE_ENTITY_PRESENT'
    )
    returning 1
  )
  select count(*) into v_inserted_source from ins;

  with roles as (
    select unnest(enum_range(null::portal_private.ai_business_role_enum)) role
  ),
  candidates as (
    select
      x.obj->>'task_id' task_id,
      x.obj->>'classification' classification,
      x.obj->>'entity_ref' entity_ref
    from roles r
    cross join lateral jsonb_array_elements(
      portal_private.ai_reverse_event_reconciliation_candidates_v1(r.role)
    ) x(obj)
  ),
  parsed as (
    select *,
      split_part(entity_ref,':',1) entity_type,
      substring(entity_ref from position(':' in entity_ref)+1) entity_id
    from candidates
    where position(':' in entity_ref)>0
  )
  update portal_private.ai_task_dependencies_v1 d
  set status=case
        when p.classification='HOLD_SOURCE_ENTITY_ABSENT' then 'OPEN'
        else 'SATISFIED'
      end,
      updated_at=clock_timestamp()
  from parsed p
  where d.task_id=p.task_id
    and d.dependency_type='SOURCE'
    and d.depends_on_entity_type=p.entity_type
    and d.depends_on_entity_id=p.entity_id
    and d.required_state='SOURCE_ENTITY_PRESENT';
  get diagnostics v_updated_source=row_count;

  return jsonb_build_object(
    'contract','RONA_AI_TASK_DEPENDENCY_MATERIALIZER_V2',
    'inserted_role_dependencies',v_inserted_role,
    'updated_role_dependencies',v_updated_role,
    'inserted_source_dependencies',v_inserted_source,
    'updated_source_dependencies',v_updated_source,
    'business_data_mutated',false
  );
end
$function$;

revoke all on function portal_private.ai_task_dependencies_materialize_v2() from public,anon,authenticated,service_role;

create or replace function portal_private.ai_role_state_current_v4(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language plpgsql
stable security definer
set search_path='portal_private','pg_catalog'
as $function$
declare
  v_state jsonb;
  v_bootstrap jsonb;
  v_routing jsonb;
begin
  v_state:=portal_private.ai_role_state_current_v3(p_role,p_task_limit,p_coord_limit);
  v_routing:=portal_private.ai_role_routing_contract_v3()
    - 'roles'
    - 'task_assignment_roles';
  v_bootstrap:=coalesce(v_state->'bootstrap','{}'::jsonb)
    || jsonb_build_object(
      'routing_contract','RONA_ROLE_ROUTING_CONTRACT_V3',
      'human_actor_rule','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
      'dependency_materializer','RONA_AI_TASK_DEPENDENCY_MATERIALIZER_V2',
      'full_role_registry_in_current_state',false
    );

  return v_state
    || jsonb_build_object(
      'data_contract','RONA_ROLE_STATE_RECOVERY_V4',
      'routing_capabilities',v_routing,
      'dependency_graph',portal_private.ai_task_dependency_graph_v1(p_role),
      'bootstrap',v_bootstrap
    );
end
$function$;

revoke all on function portal_private.ai_role_state_current_v4(portal_private.ai_business_role_enum,integer,integer)
from public,anon,authenticated,service_role;

create or replace function portal_private.run_core_runtime_minute_v5()
returns jsonb
language plpgsql
set search_path='pg_catalog','portal_private'
as $function$
declare
  v_result jsonb:='{}'::jsonb;
  v_errors jsonb:='[]'::jsonb;
  v_error_count integer:=0;
  v_dependencies jsonb:=null;
begin
  begin
    v_result:=portal_private.run_core_runtime_minute_v4();
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','core_v4','error',left(sqlerrm,500)
    ));
    v_result:=jsonb_build_object('ok',false);
  end;

  begin
    if mod(extract(minute from clock_timestamp())::integer,5)=2 then
      v_dependencies:=portal_private.ai_task_dependencies_materialize_v2();
      v_result:=v_result||jsonb_build_object(
        'ai_task_dependencies',v_dependencies,
        'ai_task_dependencies_skipped',false,
        'ai_task_dependencies_gate_minutes',5,
        'ai_task_dependencies_phase_minute_mod5',2
      );
    else
      v_result:=v_result||jsonb_build_object(
        'ai_task_dependencies',null,
        'ai_task_dependencies_skipped',true,
        'ai_task_dependencies_skip_reason','FIVE_MINUTE_CORE_GATE',
        'ai_task_dependencies_gate_minutes',5,
        'ai_task_dependencies_phase_minute_mod5',2
      );
    end if;
  exception when others then
    v_error_count:=v_error_count+1;
    v_errors:=v_errors||jsonb_build_array(jsonb_build_object(
      'step','ai_task_dependencies_materialize_v2','error',left(sqlerrm,500)
    ));
  end;

  return v_result||jsonb_build_object(
    'v5_wrapper_ok',v_error_count=0,
    'v5_wrapper_error_count',v_error_count,
    'v5_wrapper_errors',v_errors,
    'worker_wrapper_version','CORE_RUNTIME_MINUTE_V5'
  );
end
$function$;

do $do$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='rona-core-runtime-minute-v1'
  order by jobid desc
  limit 1;

  if v_jobid is null then
    perform cron.schedule(
      'rona-core-runtime-minute-v1',
      '* * * * *',
      'select portal_private.run_core_runtime_minute_v5();'
    );
  else
    update cron.job
    set command='select portal_private.run_core_runtime_minute_v5();',
        active=true
    where jobid=v_jobid;
  end if;
end
$do$;

comment on function portal_private.run_core_runtime_minute_v5() is
'Core runtime V5: V4 plus confirmed-source AI task dependency materialization every 5 minutes.';

