\set ON_ERROR_STOP on

-- C1.2 QA-only production-compatible authority substrate.
-- This is used only by the ephemeral PostgreSQL rehearsal.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='portal_private' and t.typname='portal_role_enum'
  ) then
    create type portal_private.portal_role_enum as enum ('ADMIN','RONA_OPERATOR','CLIENT','AGENT');
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='portal_private' and t.typname='portal_user_status_enum'
  ) then
    create type portal_private.portal_user_status_enum as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED','ARCHIVED');
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='portal_private' and t.typname='binding_status_enum'
  ) then
    create type portal_private.binding_status_enum as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED','EXPIRED');
  end if;
end
$$;

alter table portal_private.portal_users
  add column if not exists auth_user_id uuid,
  add column if not exists display_name text not null default 'C1.2 QA User',
  add column if not exists status portal_private.portal_user_status_enum not null default 'ACTIVE',
  add column if not exists lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE';

create table if not exists portal_private.portal_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  role portal_private.portal_role_enum not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  status portal_private.binding_status_enum not null default 'ACTIVE',
  unique(user_id,role)
);

create table if not exists portal_private.mcp_oauth_clients (
  client_id text primary key,
  client_name text not null
);

create table if not exists portal_private.mcp_oauth_tokens (
  token_id uuid primary key default gen_random_uuid(),
  server_slug text not null,
  functional_role portal_private.ai_business_role_enum not null,
  identity_id text not null,
  client_id text not null references portal_private.mcp_oauth_clients(client_id),
  owner_portal_user_id uuid not null references portal_private.portal_users(id),
  scope text not null,
  access_expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists c12_mcp_token_scope_idx
  on portal_private.mcp_oauth_tokens(server_slug,functional_role,identity_id,client_id);

select 'C12_AUTHORITY_SUBSTRATE=PASS' as result;