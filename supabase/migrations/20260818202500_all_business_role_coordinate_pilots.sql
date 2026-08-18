-- Fixed-role controlled coordination pilot connectors for RONA business AI staff.
-- Primary six connectors remain unique/read-only. System Admin has no coordinate pilot.

begin;

alter table portal_private.mcp_gateway_config
  drop constraint if exists mcp_gateway_config_operations_pilot_binding_check;

alter table portal_private.mcp_gateway_config
  drop constraint if exists mcp_gateway_config_coordinate_pilot_binding_check;

drop index if exists portal_private.uq_mcp_gateway_primary_business_role;
drop index if exists portal_private.uq_mcp_gateway_primary_identity;

create unique index uq_mcp_gateway_primary_business_role
  on portal_private.mcp_gateway_config (business_role)
  where server_slug not in (
    'rona-mcp-operations-pilot',
    'rona-mcp-finance-pilot',
    'rona-mcp-legal-pilot',
    'rona-mcp-market-analyst-pilot',
    'rona-mcp-rail-logistics-pilot'
  );

create unique index uq_mcp_gateway_primary_identity
  on portal_private.mcp_gateway_config (identity_id)
  where server_slug not in (
    'rona-mcp-operations-pilot',
    'rona-mcp-finance-pilot',
    'rona-mcp-legal-pilot',
    'rona-mcp-market-analyst-pilot',
    'rona-mcp-rail-logistics-pilot'
  );

alter table portal_private.mcp_gateway_config
  add constraint mcp_gateway_config_coordinate_pilot_binding_check
  check (
    server_slug not in (
      'rona-mcp-operations-pilot',
      'rona-mcp-finance-pilot',
      'rona-mcp-legal-pilot',
      'rona-mcp-market-analyst-pilot',
      'rona-mcp-rail-logistics-pilot'
    )
    or (server_slug='rona-mcp-operations-pilot'
        and business_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
        and identity_id='AI-OPERATIONS-DIRECTOR')
    or (server_slug='rona-mcp-finance-pilot'
        and business_role='FINANCE'::portal_private.ai_business_role_enum
        and identity_id='AI-FINANCE')
    or (server_slug='rona-mcp-legal-pilot'
        and business_role='LEGAL'::portal_private.ai_business_role_enum
        and identity_id='AI-LEGAL')
    or (server_slug='rona-mcp-market-analyst-pilot'
        and business_role='MARKET_ANALYST'::portal_private.ai_business_role_enum
        and identity_id='AI-MARKET-ANALYST')
    or (server_slug='rona-mcp-rail-logistics-pilot'
        and business_role='RAIL_LOGISTICS'::portal_private.ai_business_role_enum
        and identity_id='AI-RAIL-LOGISTICS')
  );

insert into portal_private.mcp_gateway_config
  (server_slug, app_name, business_role, identity_id, enabled, max_requests_per_minute)
values
  ('rona-mcp-finance-pilot','RONA Finance Pilot','FINANCE'::portal_private.ai_business_role_enum,'AI-FINANCE',true,60),
  ('rona-mcp-legal-pilot','RONA Legal Pilot','LEGAL'::portal_private.ai_business_role_enum,'AI-LEGAL',true,60),
  ('rona-mcp-market-analyst-pilot','RONA Market Analyst Pilot','MARKET_ANALYST'::portal_private.ai_business_role_enum,'AI-MARKET-ANALYST',true,60),
  ('rona-mcp-rail-logistics-pilot','RONA Rail Logistics Pilot','RAIL_LOGISTICS'::portal_private.ai_business_role_enum,'AI-RAIL-LOGISTICS',true,60)
on conflict (server_slug) do update set
  app_name=excluded.app_name,
  business_role=excluded.business_role,
  identity_id=excluded.identity_id,
  enabled=true,
  max_requests_per_minute=excluded.max_requests_per_minute,
  updated_at=now();

commit;
