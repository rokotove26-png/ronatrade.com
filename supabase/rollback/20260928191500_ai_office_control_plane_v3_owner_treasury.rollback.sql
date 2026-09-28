-- ROLLBACK ONLY — AI Office Control Plane V3
-- Reverts topology/runtime wrappers to the V2/V3 behavior without touching business facts.

do $$
begin
  if exists(select 1 from cron.job where jobname='rona-core-runtime-minute-v1') then
    update cron.job
    set command='select portal_private.run_core_runtime_minute_v4();'
    where jobname='rona-core-runtime-minute-v1';
  end if;
end
$$;

drop function if exists portal_private.ai_role_state_current_v4(portal_private.ai_business_role_enum,integer,integer);
drop function if exists portal_private.run_core_runtime_minute_v5();
drop function if exists portal_private.ai_task_dependencies_materialize_v2();
drop function if exists portal_private.ai_role_routing_contract_v3();

delete from portal_private.ai_role_authority_registry_v2 where role_key='OWNER';

update portal_private.ai_role_authority_registry_v2
set lifecycle_state='GAP',ai_materialized=false,staff_materialized=false,
    handoff_target_enabled=false,source_ref='RONA_ROLE_ROUTING_CONTRACT_V2'
where role_key='TREASURY';

update portal_private.ai_role_authority_registry_v2
set lifecycle_state='ACTIVE',source_ref='OWNER_ORG_STRUCTURE'
where role_key='EXECUTIVE_DIRECTOR';

update portal_private.ai_role_authority_registry_v2
set lifecycle_state='GAP',source_ref='RONA_ROLE_ROUTING_CONTRACT_V2'
where role_key='ACCOUNTING';

alter table portal_private.ai_role_authority_registry_v2
  drop constraint if exists ai_role_authority_registry_v2_actor_kind_check;
alter table portal_private.ai_role_authority_registry_v2
  drop column if exists human_materialized,
  drop column if exists actor_kind;
