-- Follow-up for already-applied AI Office Control Plane V2.
-- Keeps fresh-install migration and live function contract aligned.

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
