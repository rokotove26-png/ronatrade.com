-- RONA Trade / Canonical Role Registry Correction V3
-- OWNER_AUTHORITY=OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2
-- HUMAN_ACTORS=OWNER,TREASURY
-- CANONICAL_AI_ROLES=FINANCE,OPERATIONS_DIRECTOR,COMMERCIAL_DIRECTOR,LEGAL,RAIL_LOGISTICS,SYSTEM_ADMIN
-- NONEXISTENT_SEPARATE_ROLES=ACCOUNTING,EXECUTIVE_DIRECTOR
-- BUSINESS_DATA_MUTATION=NONE
-- TECHNICAL_ROUTING_CORRECTION=YES

-- ACCOUNTING and EXECUTIVE_DIRECTOR are not separate organizational roles.
-- Their historical enum/source labels remain readable elsewhere, but they must not exist
-- as expected AI actors in the canonical role registry.
delete from portal_private.ai_role_authority_registry_v2
where role_key in ('ACCOUNTING','EXECUTIVE_DIRECTOR');

update portal_private.ai_role_authority_registry_v2
set source_ref='OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
    updated_at=clock_timestamp()
where role_key in (
  'OWNER','TREASURY',
  'FINANCE','OPERATIONS_DIRECTOR','COMMERCIAL_DIRECTOR',
  'LEGAL','RAIL_LOGISTICS','SYSTEM_ADMIN','MARKET_ANALYST'
);

-- Payment proof belongs to the Financial Director, not a nonexistent Accounting role.
update portal_private.client_intake_routing_registry_v1
set responsible_role='FINANCE'::portal_private.staff_functional_role_enum
where policy_key='CLIENT_PAYMENT_PROOF_SUBMIT_V1'
  and responsible_role='ACCOUNTING'::portal_private.staff_functional_role_enum;

create or replace function portal_private.staff_role_for_reverse_event(p_event_type text)
returns portal_private.staff_functional_role_enum
language sql
immutable
set search_path='pg_catalog','portal_private'
as $function$
  select case
    when p_event_type='CLIENT_CLAIM_SUBMIT'
      then 'LEGAL'::portal_private.staff_functional_role_enum
    when p_event_type='CLIENT_PAYMENT_PROOF_SUBMIT'
      then 'FINANCE'::portal_private.staff_functional_role_enum
    else 'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum
  end
$function$;

create or replace function portal_private.ai_canonical_role_map_v1(p_role text)
returns text
language sql
immutable
set search_path='pg_catalog'
as $function$
  select case upper(btrim(coalesce(p_role,'')))
    when 'ACCOUNTING' then 'FINANCE'
    when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'
    when 'MARKET_ANALYST' then 'COMMERCIAL_DIRECTOR'
    else upper(btrim(coalesce(p_role,'')))
  end
$function$;

revoke all on function portal_private.ai_canonical_role_map_v1(text)
from public,anon,authenticated,service_role;

create or replace function portal_private.ai_role_routing_contract_v4()
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  with r as (
    select *
    from portal_private.ai_role_authority_registry_v2
    order by role_key
  )
  select jsonb_build_object(
    'contract','RONA_ROLE_ROUTING_CONTRACT_V4',
    'topology_authority','OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
    'human_actor_rule','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
    'canonical_ai_roles',jsonb_build_array(
      'FINANCE',
      'OPERATIONS_DIRECTOR',
      'COMMERCIAL_DIRECTOR',
      'LEGAL',
      'RAIL_LOGISTICS',
      'SYSTEM_ADMIN'
    ),
    'nonexistent_roles',jsonb_build_array('ACCOUNTING','EXECUTIVE_DIRECTOR'),
    'compatibility_role_map',jsonb_build_object(
      'ACCOUNTING','FINANCE',
      'EXECUTIVE_DIRECTOR','OPERATIONS_DIRECTOR',
      'MARKET_ANALYST','COMMERCIAL_DIRECTOR'
    ),
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
      ) order by role_key)
      from r
    ),'[]'::jsonb),
    'human_actors',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role',role_key,
        'title',organizational_title,
        'materialized',human_materialized
      ) order by role_key)
      from r
      where actor_kind='HUMAN'
        and lifecycle_state='ACTIVE'
    ),'[]'::jsonb),
    'active_ai_roles',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where actor_kind='AI'
        and lifecycle_state='ACTIVE'
        and ai_materialized
    ),'[]'::jsonb),
    'legacy_ai_roles',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where actor_kind='LEGACY_AI'
    ),'[]'::jsonb),
    'ai_role_gaps',coalesce((
      select jsonb_agg(jsonb_build_object(
        'role',role_key,
        'status','AI_ROLE_EXPECTED_NOT_MATERIALIZED'
      ) order by role_key)
      from r
      where actor_kind='AI'
        and not ai_materialized
    ),'[]'::jsonb),
    'task_assignment_roles',coalesce((
      select jsonb_agg(role_key order by role_key)
      from r
      where staff_materialized
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
      where actor_kind='HUMAN'
        and lifecycle_state='ACTIVE'
        and human_materialized
    ),'[]'::jsonb),
    'legacy_aliases',coalesce((
      select jsonb_object_agg(role_key,legacy_alias_of order by role_key)
      from r
      where lifecycle_state='LEGACY'
        and legacy_alias_of is not null
    ),'{}'::jsonb)
  )
$function$;

revoke all on function portal_private.ai_role_routing_contract_v4()
from public,anon,authenticated,service_role;

-- Compatibility bridge: old callers of V3 receive the current V4 contract.
create or replace function portal_private.ai_role_routing_contract_v3()
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select portal_private.ai_role_routing_contract_v4()
$function$;

revoke all on function portal_private.ai_role_routing_contract_v3()
from public,anon,authenticated,service_role;

create or replace function portal_private.ai_role_state_current_v5(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
declare
  v_state jsonb;
  v_bootstrap jsonb;
  v_routing jsonb;
begin
  v_state:=portal_private.ai_role_state_current_v3(p_role,p_task_limit,p_coord_limit);
  v_routing:=portal_private.ai_role_routing_contract_v4()
    - 'roles'
    - 'task_assignment_roles';

  v_bootstrap:=coalesce(v_state->'bootstrap','{}'::jsonb)
    || jsonb_build_object(
      'routing_contract','RONA_ROLE_ROUTING_CONTRACT_V4',
      'human_actor_rule','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
      'canonical_role_topology','OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
      'nonexistent_roles',jsonb_build_array('ACCOUNTING','EXECUTIVE_DIRECTOR'),
      'dependency_materializer','RONA_AI_TASK_DEPENDENCY_MATERIALIZER_V2',
      'full_role_registry_in_current_state',false
    );

  return v_state
    || jsonb_build_object(
      'data_contract','RONA_ROLE_STATE_RECOVERY_V5',
      'routing_capabilities',v_routing,
      'dependency_graph',portal_private.ai_task_dependency_graph_v1(p_role),
      'bootstrap',v_bootstrap
    );
end
$function$;

revoke all on function portal_private.ai_role_state_current_v5(
  portal_private.ai_business_role_enum,integer,integer
) from public,anon,authenticated,service_role;

-- Compatibility bridge: old callers of V4 receive the current V5 state.
create or replace function portal_private.ai_role_state_current_v4(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select portal_private.ai_role_state_current_v5(p_role,p_task_limit,p_coord_limit)
$function$;

revoke all on function portal_private.ai_role_state_current_v4(
  portal_private.ai_business_role_enum,integer,integer
) from public,anon,authenticated,service_role;

comment on function portal_private.ai_role_routing_contract_v4() is
'Canonical RONA Trade role topology V4. ACCOUNTING and EXECUTIVE_DIRECTOR are nonexistent separate roles and map only for compatibility.';
comment on function portal_private.ai_role_state_current_v5(portal_private.ai_business_role_enum,integer,integer) is
'Role-scoped current state V5 using canonical Owner AI topology V2 and routing contract V4.';
