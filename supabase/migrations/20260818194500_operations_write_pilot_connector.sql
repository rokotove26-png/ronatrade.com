-- Separate Operations controlled-write pilot connector. Existing six primary connectors remain unique/read-only.

alter table portal_private.mcp_gateway_config
  drop constraint if exists mcp_gateway_config_business_role_key;

alter table portal_private.mcp_gateway_config
  drop constraint if exists mcp_gateway_config_identity_id_key;

create unique index if not exists uq_mcp_gateway_primary_business_role
  on portal_private.mcp_gateway_config (business_role)
  where server_slug <> 'rona-mcp-operations-pilot';

create unique index if not exists uq_mcp_gateway_primary_identity
  on portal_private.mcp_gateway_config (identity_id)
  where server_slug <> 'rona-mcp-operations-pilot';

do $$
begin
  if not exists (select 1 from pg_constraint where conname='mcp_gateway_config_operations_pilot_binding_check' and conrelid='portal_private.mcp_gateway_config'::regclass) then
    alter table portal_private.mcp_gateway_config
      add constraint mcp_gateway_config_operations_pilot_binding_check
      check (server_slug <> 'rona-mcp-operations-pilot' or (business_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum and identity_id='AI-OPERATIONS-DIRECTOR'));
  end if;
end $$;

insert into portal_private.mcp_gateway_config(server_slug,app_name,business_role,identity_id,enabled,max_requests_per_minute)
values('rona-mcp-operations-pilot','RONA Operations Director Pilot','OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum,'AI-OPERATIONS-DIRECTOR',true,60)
on conflict (server_slug) do update set
  app_name=excluded.app_name,
  business_role=excluded.business_role,
  identity_id=excluded.identity_id,
  enabled=true,
  max_requests_per_minute=excluded.max_requests_per_minute,
  updated_at=now();
