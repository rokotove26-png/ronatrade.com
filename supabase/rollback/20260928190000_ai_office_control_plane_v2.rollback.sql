-- ROLLBACK ONLY — do not run automatically.
-- Reverts AI Office Control Plane V2 objects without touching business data.

drop function if exists portal_private.ai_role_state_current_v3(portal_private.ai_business_role_enum,integer,integer);
drop function if exists portal_private.ai_task_dependency_graph_v1(portal_private.ai_business_role_enum);
drop table if exists portal_private.ai_task_dependencies_v1;
drop function if exists portal_private.ai_role_routing_contract_v2();
drop table if exists portal_private.ai_role_authority_registry_v2;
