\set ON_ERROR_STOP on

create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;

create type portal_private.portal_user_status_enum as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED');
create type portal_private.lifecycle_state_enum as enum ('DRAFT','ACTIVE','SUPERSEDED','ARCHIVED');
create type portal_private.binding_status_enum as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED');

alter table portal_private.client_applications
  add column lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE';

create table portal_private.portal_users(
  id uuid primary key default pg_catalog.gen_random_uuid(),
  auth_user_id uuid,
  display_name text not null default 'QA',
  status portal_private.portal_user_status_enum not null default 'ACTIVE',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);
create table portal_private.client_user_bindings(
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  status portal_private.binding_status_enum not null default 'ACTIVE',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  revoked_at timestamptz
);
create table portal_private.application_lines(
  id uuid primary key default pg_catalog.gen_random_uuid(),
  application_key uuid not null references portal_private.client_applications(id),
  line_no integer not null,
  product text not null,
  quantity_tonnes numeric not null,
  price_mode portal_private.price_mode_enum not null,
  published_price numeric,
  proposed_price numeric,
  currency char(3)
);
create table portal_private.owner_application_workflow(
  application_key uuid primary key references portal_private.client_applications(id),
  supplier_approved_at timestamptz
);

create or replace function portal_private.client_user_has_contract_access(uuid,uuid,timestamptz)
returns boolean language sql stable as $$ select true $$;
create or replace function portal_private.client_user_has_deal_access(uuid,uuid,timestamptz)
returns boolean language sql stable as $$ select true $$;
