-- AI Office Control Plane V3 current-state compaction.
-- Keep the full routing registry available via ai_role_routing_contract_v3(),
-- but do not duplicate the full role list inside every current_state response.

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

revoke all on function portal_private.ai_role_state_current_v4(portal_private.ai_business_role_enum,integer,integer) from public, anon, authenticated, service_role;
