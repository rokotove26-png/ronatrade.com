-- ROLLBACK POINT: Canonical Role Registry Correction V3
-- The Owner topology correction is NOT reversible by rollback.
-- ACCOUNTING and EXECUTIVE_DIRECTOR must not be restored as separate AI roles.
-- Payment proof routing remains FINANCE.
-- This rollback only returns runtime contract surfaces from V5/V4 to V4/V3 compatibility.

drop function if exists portal_private.ai_role_state_current_v5(
  portal_private.ai_business_role_enum,integer,integer
);
drop function if exists portal_private.ai_role_routing_contract_v4();

create or replace function portal_private.ai_role_routing_contract_v3()
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
    'contract','RONA_ROLE_ROUTING_CONTRACT_V3',
    'topology_authority','OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
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

create or replace function portal_private.ai_role_state_current_v4(
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

revoke all on function portal_private.ai_role_routing_contract_v3()
from public,anon,authenticated,service_role;
revoke all on function portal_private.ai_role_state_current_v4(
  portal_private.ai_business_role_enum,integer,integer
) from public,anon,authenticated,service_role;
