-- RONA Trade AI Office Control Plane V2
-- Owner-authorized architecture hardening: role registry, task dependencies,
-- exception-first state projection, and canonical routing contract.
-- No commercial, financial, legal, client, price, shipment, or payment facts are created or changed.

create table if not exists portal_private.ai_role_authority_registry_v2 (
  role_key text primary key,
  canonical_role text not null,
  organizational_title text not null,
  lifecycle_state text not null check (lifecycle_state in ('ACTIVE','LEGACY','GAP','PLANNED')),
  ai_materialized boolean not null default false,
  staff_materialized boolean not null default false,
  handoff_target_enabled boolean not null default false,
  legacy_alias_of text,
  entity_scopes jsonb not null default '[]'::jsonb check (jsonb_typeof(entity_scopes)='array'),
  source_ref text not null,
  updated_at timestamptz not null default clock_timestamp(),
  check (role_key=btrim(role_key) and role_key<>''),
  check (canonical_role=btrim(canonical_role) and canonical_role<>''),
  check (legacy_alias_of is null or legacy_alias_of<>role_key)
);

alter table portal_private.ai_role_authority_registry_v2 enable row level security;
revoke all on table portal_private.ai_role_authority_registry_v2 from public, anon, authenticated, service_role;

insert into portal_private.ai_role_authority_registry_v2
(role_key,canonical_role,organizational_title,lifecycle_state,ai_materialized,staff_materialized,handoff_target_enabled,legacy_alias_of,entity_scopes,source_ref)
values
('EXECUTIVE_DIRECTOR','EXECUTIVE_DIRECTOR','Исполнительный директор','ACTIVE',false,true,false,null,'[]'::jsonb,'OWNER_ORG_STRUCTURE'),
('OPERATIONS_DIRECTOR','OPERATIONS_DIRECTOR','Операционный директор','ACTIVE',true,true,true,null,'["CLIENT","CONTRACT","APPLICATION","DEAL","DOCUMENT","PAYMENT","SHIPMENT","RAIL_DOCUMENT","PUBLICATION","TASK"]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('FINANCE','FINANCE','Финансы','ACTIVE',true,true,true,null,'["CONTRACT","APPLICATION","DEAL","PAYMENT","TASK"]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('LEGAL','LEGAL','Юридическая функция','ACTIVE',true,true,true,null,'["CONTRACT","DEAL","DOCUMENT","TASK"]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('COMMERCIAL_DIRECTOR','COMMERCIAL_DIRECTOR','Коммерческий директор','ACTIVE',true,true,true,null,'["CLIENT","CONTRACT","APPLICATION","DEAL","PUBLICATION","TASK"]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('MARKET_ANALYST','COMMERCIAL_DIRECTOR','Market Analyst (legacy alias)','LEGACY',true,true,false,'COMMERCIAL_DIRECTOR','["CLIENT","CONTRACT","APPLICATION","DEAL","PUBLICATION","TASK"]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('RAIL_LOGISTICS','RAIL_LOGISTICS','Железнодорожная логистика','ACTIVE',true,true,true,null,'["DEAL","SHIPMENT","RAIL_DOCUMENT","TASK"]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('SYSTEM_ADMIN','SYSTEM_ADMIN','Системный администратор','ACTIVE',true,true,true,null,'["TASK","SYSTEM"]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('ACCOUNTING','ACCOUNTING','Бухгалтерия','GAP',false,true,false,null,'[]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2'),
('TREASURY','TREASURY','Казначейство','GAP',false,false,false,null,'[]'::jsonb,'RONA_ROLE_ROUTING_CONTRACT_V2')
on conflict(role_key) do update set
  canonical_role=excluded.canonical_role,
  organizational_title=excluded.organizational_title,
  lifecycle_state=excluded.lifecycle_state,
  ai_materialized=excluded.ai_materialized,
  staff_materialized=excluded.staff_materialized,
  handoff_target_enabled=excluded.handoff_target_enabled,
  legacy_alias_of=excluded.legacy_alias_of,
  entity_scopes=excluded.entity_scopes,
  source_ref=excluded.source_ref,
  updated_at=clock_timestamp();

create or replace function portal_private.ai_role_routing_contract_v2()
returns jsonb
language sql
stable security definer
set search_path='portal_private','pg_catalog'
as $function$
  with r as (
    select *
    from portal_private.ai_role_authority_registry_v2
    order by role_key
  )
  select jsonb_build_object(
    'contract','RONA_ROLE_ROUTING_CONTRACT_V2',
    'canonical_commercial_role','COMMERCIAL_DIRECTOR',
    'roles',coalesce((select jsonb_agg(to_jsonb(r) order by role_key) from r),'[]'::jsonb),
    'ai_roles',coalesce((select jsonb_agg(role_key order by role_key) from r where ai_materialized and lifecycle_state in ('ACTIVE','LEGACY')),'[]'::jsonb),
    'staff_roles',coalesce((select jsonb_agg(role_key order by role_key) from r where staff_materialized),'[]'::jsonb),
    'canonical_handoff_targets',coalesce((select jsonb_agg(role_key order by role_key) from r where handoff_target_enabled and lifecycle_state='ACTIVE'),'[]'::jsonb),
    'legacy_aliases',coalesce((
      select jsonb_object_agg(role_key,legacy_alias_of order by role_key)
      from r where lifecycle_state='LEGACY' and legacy_alias_of is not null
    ),'{}'::jsonb),
    'known_gaps',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role',role_key,
        'status',case
          when staff_materialized and not ai_materialized then 'STAFF_ROLE_PRESENT_AI_ROLE_NOT_MATERIALIZED'
          when not staff_materialized and not ai_materialized then 'NOT_MATERIALIZED_AS_AI_OR_STAFF_ROLE'
          else 'GAP'
        end
      ) order by role_key)
      from r where lifecycle_state='GAP'
    ),'[]'::jsonb)
  )
$function$;

revoke all on function portal_private.ai_role_routing_contract_v2() from public, anon, authenticated, service_role;

create table if not exists portal_private.ai_task_dependencies_v1 (
  dependency_id uuid primary key default gen_random_uuid(),
  task_id text not null references portal_private.staff_tasks(task_id) on delete restrict,
  dependency_type text not null check (dependency_type in ('TASK','ROLE','APPROVAL','SOURCE','EXTERNAL')),
  depends_on_task_id text references portal_private.staff_tasks(task_id) on delete restrict,
  depends_on_role text,
  depends_on_entity_type text,
  depends_on_entity_id text,
  required_state text not null,
  status text not null default 'OPEN' check (status in ('OPEN','SATISFIED','WAIVED','CANCELLED')),
  source_ref text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    depends_on_task_id is not null
    or depends_on_role is not null
    or depends_on_entity_id is not null
  ),
  check (task_id is distinct from depends_on_task_id)
);

create unique index if not exists ai_task_dependencies_v1_identity_idx
on portal_private.ai_task_dependencies_v1 (
  task_id,
  dependency_type,
  coalesce(depends_on_task_id,''),
  coalesce(depends_on_role,''),
  coalesce(depends_on_entity_type,''),
  coalesce(depends_on_entity_id,''),
  required_state
);

create index if not exists ai_task_dependencies_v1_open_task_idx
on portal_private.ai_task_dependencies_v1(task_id,updated_at desc)
where status='OPEN';

alter table portal_private.ai_task_dependencies_v1 enable row level security;
revoke all on table portal_private.ai_task_dependencies_v1 from public, anon, authenticated, service_role;

create or replace function portal_private.ai_task_dependency_graph_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language sql
stable security definer
set search_path='portal_private','pg_catalog'
as $function$
  select coalesce(jsonb_agg(x.obj order by x.task_updated_at desc,x.dependency_updated_at desc),'[]'::jsonb)
  from (
    select
      t.updated_at as task_updated_at,
      d.updated_at as dependency_updated_at,
      jsonb_build_object(
        'task_id',t.task_id,
        'task_status',t.status::text,
        'dependency_id',d.dependency_id,
        'dependency_type',d.dependency_type,
        'depends_on_task_id',d.depends_on_task_id,
        'depends_on_role',d.depends_on_role,
        'depends_on_entity_type',d.depends_on_entity_type,
        'depends_on_entity_id',d.depends_on_entity_id,
        'required_state',d.required_state,
        'dependency_status',d.status,
        'source_ref',d.source_ref,
        'details',d.details,
        'updated_at',d.updated_at
      ) obj
    from portal_private.staff_tasks t
    join portal_private.ai_task_dependencies_v1 d on d.task_id=t.task_id
    where t.qa_only=false
      and t.assigned_functional_role::text=p_role::text
      and t.status::text not in ('COMPLETED','REJECTED','CLOSED')
      and d.status in ('OPEN','SATISFIED')
    order by t.updated_at desc,d.updated_at desc
    limit 20
  ) x
$function$;

revoke all on function portal_private.ai_task_dependency_graph_v1(portal_private.ai_business_role_enum) from public, anon, authenticated, service_role;

create or replace function portal_private.ai_role_state_current_v3(
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
  v_cockpit jsonb;
begin
  v_state:=portal_private.ai_role_state_current_v2(p_role,p_task_limit,p_coord_limit);
  v_cockpit:=portal_private.ai_role_exception_cockpit_v1(p_role);
  v_bootstrap:=coalesce(v_state->'bootstrap','{}'::jsonb)
    || jsonb_build_object(
      'routing_contract','RONA_ROLE_ROUTING_CONTRACT_V2',
      'exception_cockpit_included',true,
      'dependency_graph_included',true
    );
  return v_state
    || jsonb_build_object(
      'data_contract','RONA_ROLE_STATE_RECOVERY_V3',
      'routing_capabilities',portal_private.ai_role_routing_contract_v2(),
      'exception_cockpit_summary',coalesce(v_cockpit->'counts','{}'::jsonb),
      'dependency_graph',portal_private.ai_task_dependency_graph_v1(p_role),
      'bootstrap',v_bootstrap
    );
end
$function$;

revoke all on function portal_private.ai_role_state_current_v3(portal_private.ai_business_role_enum,integer,integer) from public, anon, authenticated, service_role;

comment on table portal_private.ai_role_authority_registry_v2 is
'Machine-readable canonical role/authority registry. MARKET_ANALYST is legacy compatibility; COMMERCIAL_DIRECTOR is canonical.';
comment on table portal_private.ai_task_dependencies_v1 is
'Explicit dependency graph for AI-office staff tasks. Dependency rows do not themselves mutate business authority or facts.';
comment on function portal_private.ai_role_state_current_v3(portal_private.ai_business_role_enum,integer,integer) is
'RONA_ROLE_STATE_RECOVERY_V3: V2 plus canonical routing registry, exception cockpit, and task dependency graph.';
