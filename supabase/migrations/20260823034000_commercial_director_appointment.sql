begin;

-- Owner appointment: the existing AI-MARKET-ANALYST service identity becomes the
-- human/organizational Commercial Director while the stable machine role key
-- MARKET_ANALYST is retained for MCP/OAuth/queue compatibility.
update portal_private.ai_service_identities
set display_name = 'Коммерческий директор',
    updated_at = now()
where identity_id = 'AI-MARKET-ANALYST'
  and business_role = 'MARKET_ANALYST'::portal_private.ai_business_role_enum;

update portal_private.mcp_gateway_config
set app_name = case server_slug
      when 'rona-mcp-market-analyst' then 'RONA Commercial Director'
      when 'rona-mcp-market-analyst-pilot' then 'RONA Commercial Director Pilot'
      else app_name
    end,
    updated_at = now()
where identity_id = 'AI-MARKET-ANALYST'
  and business_role = 'MARKET_ANALYST'::portal_private.ai_business_role_enum;

-- Commercial Director receives read/preparation scope required for client,
-- application, deal and commercial work. This does not confer Executive Director,
-- Legal, Finance, Rail, Accounting, IAM or publication-approval authority.
insert into portal_private.staff_role_domain_permissions
  (functional_role, authority_domain, action, allowed, created_at)
values
  ('MARKET_ANALYST'::portal_private.staff_functional_role_enum, 'CLIENT', 'READ', true, now()),
  ('MARKET_ANALYST'::portal_private.staff_functional_role_enum, 'CONTRACT', 'READ', true, now()),
  ('MARKET_ANALYST'::portal_private.staff_functional_role_enum, 'APPLICATION', 'READ', true, now()),
  ('MARKET_ANALYST'::portal_private.staff_functional_role_enum, 'DEAL', 'READ', true, now()),
  ('MARKET_ANALYST'::portal_private.staff_functional_role_enum, 'COMMERCIAL', 'READ', true, now()),
  ('MARKET_ANALYST'::portal_private.staff_functional_role_enum, 'COMMERCIAL', 'PREPARE', true, now())
on conflict (functional_role, authority_domain, action)
do update set allowed = excluded.allowed;

commit;
