-- RONA Trade Step 2B-1: AI read-only contour
-- Deployment candidate only. Does not provision or activate credentials.

begin;

create extension if not exists pgcrypto;

do $$
begin
  create type portal_private.ai_business_role_enum as enum (
    'OPERATIONS_DIRECTOR',
    'FINANCE',
    'LEGAL',
    'MARKET_ANALYST',
    'RAIL_LOGISTICS',
    'SYSTEM_ADMIN'
  );
exception when duplicate_object then null;
end $$;

create table if not exists portal_private.ai_service_identities (
  id uuid primary key default gen_random_uuid(),
  identity_id text not null unique,
  business_role portal_private.ai_business_role_enum not null unique,
  display_name text not null,
  status portal_private.binding_status_enum not null default 'SUSPENDED',
  bootstrap_secret_hash text,
  credential_version integer not null default 1 check (credential_version > 0),
  token_ttl_seconds integer not null default 300 check (token_ttl_seconds between 60 and 900),
  not_before timestamptz,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (identity_id ~ '^AI-[A-Z0-9_-]{3,80}$'),
  check (bootstrap_secret_hash is null or bootstrap_secret_hash ~ '^[0-9a-f]{64}$'),
  check (business_role::text <> 'OWNER_ADMIN')
);

create unique index if not exists ai_service_identities_one_active_role_idx
  on portal_private.ai_service_identities (business_role)
  where status='ACTIVE'::portal_private.binding_status_enum and revoked_at is null;

create table if not exists portal_private.ai_read_access_events (
  event_id uuid primary key default gen_random_uuid(),
  event_at timestamptz not null default now(),
  ai_identity_key uuid references portal_private.ai_service_identities(id),
  ai_identity_id text not null,
  functional_role portal_private.ai_business_role_enum,
  actor_type text not null default 'AI' check (actor_type='AI'),
  action text not null default 'READ' check (action='READ'),
  domain text not null,
  request_path text not null,
  request_id uuid not null,
  correlation_id uuid,
  token_jti uuid,
  result text not null check (result in ('SUCCESS','DENIED','ERROR')),
  http_status integer not null check (http_status between 100 and 599),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_read_access_events_identity_time_idx
  on portal_private.ai_read_access_events (ai_identity_id,event_at desc);
create index if not exists ai_read_access_events_request_idx
  on portal_private.ai_read_access_events (request_id,event_at desc);

-- Human OWNER/ADMIN remains outside the AI enum. Existing ADMIN authority is retained;
-- business designation OWNER_ADMIN is metadata/UI responsibility and is never issued here.

insert into portal_private.ai_service_identities(identity_id,business_role,display_name,status,bootstrap_secret_hash)
values
  ('AI-OPERATIONS-DIRECTOR','OPERATIONS_DIRECTOR','Операционный директор','SUSPENDED',null),
  ('AI-FINANCE','FINANCE','Финансовый директор','SUSPENDED',null),
  ('AI-LEGAL','LEGAL','Юрист','SUSPENDED',null),
  ('AI-MARKET-ANALYST','MARKET_ANALYST','Аналитик рынков','SUSPENDED',null),
  ('AI-RAIL-LOGISTICS','RAIL_LOGISTICS','ЖД-логистика','SUSPENDED',null),
  ('AI-SYSTEM-ADMIN','SYSTEM_ADMIN','Системный администратор','SUSPENDED',null)
on conflict (identity_id) do nothing;

create or replace function portal_private.ai_role_allowed_domain(
  p_role portal_private.ai_business_role_enum,
  p_domain text
) returns boolean
language sql
stable
set search_path = pg_catalog, portal_private
as $$
  select case p_role
    when 'OPERATIONS_DIRECTOR' then upper(btrim(p_domain)) = any(array[
      'CLIENT','CONTRACT','APPLICATION','DEAL','DOCUMENT','CONTROL','SHIPMENT','RAIL_SUMMARY',
      'RESOURCE','PUBLICATION','COMMERCIAL','VED','QUALITY','TASK','PORTAL_EVENT'
    ])
    when 'FINANCE' then upper(btrim(p_domain)) = any(array[
      'DEAL','CONTRACT','FINANCE_DOCUMENT','PAYMENT','PAYMENT_ALLOCATION','ACCOUNTING','FINANCIAL_CONTROL','TASK','AUDIT'
    ])
    when 'LEGAL' then upper(btrim(p_domain)) = any(array[
      'CONTRACT','DOCUMENT','APPLICATION','DEAL','LEGAL_CONTROL','TASK','PORTAL_EVENT','SOURCE_METADATA'
    ])
    when 'MARKET_ANALYST' then upper(btrim(p_domain)) = any(array[
      'MARKET','PUBLICATION','PUBLICATION_HISTORY','SOURCE_METADATA','TASK','PORTAL_EVENT'
    ])
    when 'RAIL_LOGISTICS' then upper(btrim(p_domain)) = any(array[
      'DEAL','SHIPMENT','RAIL_DOCUMENT','RAIL_MOVEMENT','RAIL_MONITORING','LOGISTICS_CONTROL','DOCUMENT','TASK','PORTAL_EVENT'
    ])
    when 'SYSTEM_ADMIN' then upper(btrim(p_domain)) = any(array[
      'TECHNICAL','IAM','AUDIT','SESSION_SECURITY','INTEGRATION_HEALTH','TASK','PORTAL_EVENT'
    ])
    else false
  end;
$$;

revoke all on portal_private.ai_service_identities from anon, authenticated;
revoke all on portal_private.ai_read_access_events from anon, authenticated;
revoke all on function portal_private.ai_role_allowed_domain(portal_private.ai_business_role_enum,text) from public;

comment on table portal_private.ai_service_identities is
  'Step 2B-1 AI service identities. Seed rows are SUSPENDED and contain no credentials until a separate activation approval.';
comment on table portal_private.ai_read_access_events is
  'Append-only AI read access attribution; never stores bearer/bootstrap credentials.';

commit;
