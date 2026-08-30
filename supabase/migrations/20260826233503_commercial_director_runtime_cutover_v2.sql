-- Production-applied Commercial Director runtime cutover, source-locked from Supabase migration history.
-- Preserves the public market-analyst MCP route slug while binding it to the Commercial Director identity.

alter table portal_private.mcp_gateway_config drop constraint if exists mcp_gateway_config_coordinate_pilot_binding_check;
alter table portal_private.mcp_gateway_config add constraint mcp_gateway_config_coordinate_pilot_binding_check check (
  server_slug <> all(array['rona-mcp-operations-pilot','rona-mcp-finance-pilot','rona-mcp-legal-pilot','rona-mcp-market-analyst-pilot','rona-mcp-rail-logistics-pilot'])
  or (server_slug='rona-mcp-operations-pilot' and business_role='OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum and identity_id='AI-OPERATIONS-DIRECTOR')
  or (server_slug='rona-mcp-finance-pilot' and business_role='FINANCE'::portal_private.ai_business_role_enum and identity_id='AI-FINANCE')
  or (server_slug='rona-mcp-legal-pilot' and business_role='LEGAL'::portal_private.ai_business_role_enum and identity_id='AI-LEGAL')
  or (server_slug='rona-mcp-market-analyst-pilot' and business_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum and identity_id='AI-COMMERCIAL-DIRECTOR')
  or (server_slug='rona-mcp-rail-logistics-pilot' and business_role='RAIL_LOGISTICS'::portal_private.ai_business_role_enum and identity_id='AI-RAIL-LOGISTICS')
);

insert into portal_private.ai_service_identities(
  identity_id,business_role,display_name,status,bootstrap_secret_hash,credential_version,token_ttl_seconds,not_before,revoked_at,revoked_by,created_at,updated_at
)
select 'AI-COMMERCIAL-DIRECTOR','COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum,'Коммерческий директор','ACTIVE'::portal_private.binding_status_enum,
       bootstrap_secret_hash,greatest(credential_version+1,16),token_ttl_seconds,coalesce(not_before,now()),null,null,now(),now()
from portal_private.ai_service_identities
where identity_id='AI-MARKET-ANALYST'
  and not exists(select 1 from portal_private.ai_service_identities where identity_id='AI-COMMERCIAL-DIRECTOR')
limit 1;

update portal_private.ai_service_identities
set business_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum,
    display_name='Коммерческий директор',status='ACTIVE'::portal_private.binding_status_enum,
    revoked_at=null,revoked_by=null,not_before=coalesce(not_before,now()),updated_at=now()
where identity_id='AI-COMMERCIAL-DIRECTOR';

update portal_private.mcp_gateway_config
set business_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum,
    identity_id='AI-COMMERCIAL-DIRECTOR',
    app_name=case when server_slug='rona-mcp-market-analyst-pilot' then 'RONA Commercial Director Pilot' else 'RONA Commercial Director' end,
    enabled=true,updated_at=now()
where server_slug in ('rona-mcp-market-analyst','rona-mcp-market-analyst-pilot');

update portal_private.mcp_oauth_clients
set functional_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
where server_slug in ('rona-mcp-market-analyst','rona-mcp-market-analyst-pilot') and revoked_at is null;

update portal_private.mcp_oauth_authorization_requests
set functional_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
where server_slug in ('rona-mcp-market-analyst','rona-mcp-market-analyst-pilot') and used_at is null and expires_at>now();

update portal_private.mcp_oauth_authorization_codes
set functional_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
where server_slug in ('rona-mcp-market-analyst','rona-mcp-market-analyst-pilot') and used_at is null and expires_at>now();

update portal_private.mcp_oauth_tokens
set functional_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum,
    identity_id='AI-COMMERCIAL-DIRECTOR'
where server_slug in ('rona-mcp-market-analyst','rona-mcp-market-analyst-pilot') and revoked_at is null;

update portal_private.ai_service_identities
set status='SUSPENDED'::portal_private.binding_status_enum,
    revoked_at=coalesce(revoked_at,now()),
    credential_version=credential_version+1,
    updated_at=now()
where identity_id='AI-MARKET-ANALYST';
