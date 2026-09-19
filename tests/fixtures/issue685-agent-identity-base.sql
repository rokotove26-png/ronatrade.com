-- #685 isolated Agent identity integration substrate.
create extension if not exists pgcrypto;

create schema if not exists portal_private;

do $$ begin
  create type portal_private.binding_status_enum as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED','EXPIRED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type portal_private.authority_state_enum as enum ('DRAFT','SOURCE_RECEIVED','CONFIRMED','VERIFIED','REJECTED','SUPERSEDED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type portal_private.lifecycle_state_enum as enum ('ACTIVE','SUSPENDED','CLOSED','ARCHIVED','SUPERSEDED');
exception when duplicate_object then null; end $$;
do $$ begin
  create type portal_private.portal_role_enum as enum ('ADMIN','CLIENT','AGENT','RONA_OPERATOR');
exception when duplicate_object then null; end $$;
do $$ begin
  create type portal_private.portal_user_status_enum as enum ('ACTIVE','SUSPENDED','DELETED');
exception when duplicate_object then null; end $$;

create table portal_private.portal_users(
  id uuid primary key,
  auth_user_id uuid unique,
  login_name text unique,
  display_name text,
  status portal_private.portal_user_status_enum not null default 'ACTIVE',
  source_system text not null default 'FIXTURE',
  source_version text,
  source_timestamp timestamptz,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  activated_at timestamptz,
  last_auth_verified_at timestamptz,
  must_change_password boolean not null default false,
  password_change_required_at timestamptz,
  password_changed_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.portal_user_roles(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  role portal_private.portal_role_enum not null,
  status portal_private.binding_status_enum not null default 'ACTIVE',
  granted_by uuid references portal_private.portal_users(id),
  reason text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table portal_private.audit_events(
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  request_id uuid not null,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table portal_private.agent_persons(
  id uuid primary key default gen_random_uuid(),
  agent_person_id text not null unique,
  full_name text,
  tax_identifier text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  display_alias text
);

create table portal_private.agent_legal_entities(
  id uuid primary key default gen_random_uuid(),
  agent_legal_entity_id text not null unique,
  legal_name text not null,
  tax_identifier text,
  registration_identifier text,
  registration_country text,
  registered_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

create table portal_private.clients(
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  legal_name text not null,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

create table portal_private.agent_client_assignments(
  id uuid primary key default gen_random_uuid(),
  agent_person_key uuid not null references portal_private.agent_persons(id),
  agent_legal_entity_key uuid not null references portal_private.agent_legal_entities(id),
  client_key uuid not null references portal_private.clients(id),
  status portal_private.binding_status_enum not null default 'PENDING',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  assignment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

create table portal_private.agent_user_bindings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  agent_person_key uuid not null references portal_private.agent_persons(id),
  agent_legal_entity_key uuid not null references portal_private.agent_legal_entities(id),
  status portal_private.binding_status_enum not null default 'PENDING',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  granted_by uuid references portal_private.portal_users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references portal_private.portal_users(id),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null default 'PORTAL_BACKEND',
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid,
  authority_state portal_private.authority_state_enum not null default 'DRAFT',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

create table portal_private.deals(
  id uuid primary key default gen_random_uuid(),
  deal_id text unique,
  client_key uuid not null references portal_private.clients(id)
);

create table portal_private.agent_deal_terms(
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references portal_private.agent_client_assignments(id),
  client_key uuid not null references portal_private.clients(id),
  deal_key uuid not null references portal_private.deals(id),
  status portal_private.binding_status_enum not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

create or replace function portal_private.resolve_portal_auth(
  p_auth_user_id uuid,
  p_session_id uuid
)
returns table(
  portal_user_id uuid,
  display_name text,
  roles text[],
  session_allowed boolean
)
language sql
stable
security definer
set search_path=pg_catalog,portal_private
as $fn$
  select
    pu.id,
    coalesce(pu.display_name,''),
    coalesce(array_agg(distinct r.role::text) filter(
      where r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null
    ),array[]::text[]),
    p_session_id is not null
  from portal_private.portal_users pu
  left join portal_private.portal_user_roles r on r.user_id=pu.id
  where pu.auth_user_id=p_auth_user_id
    and pu.status='ACTIVE'::portal_private.portal_user_status_enum
  group by pu.id,pu.display_name,p_session_id
$fn$;

-- Pre-existing canonical Agent Person with no Portal user and no company assignment.
insert into portal_private.agent_persons(
  id,agent_person_id,full_name,display_alias,source_system,source_version,source_timestamp,authority_state,lifecycle_state
) values (
  '933261cc-5179-5325-a6be-cee0e5f6593a'::uuid,
  'AGP-2026-002',
  null,
  'Егор Кузнецов',
  'ISSUE685_FIXTURE',
  'v1',
  now(),
  'SOURCE_RECEIVED',
  'ACTIVE'
);

insert into portal_private.clients(id,client_id,legal_name,authority_state,lifecycle_state)
values (
  '10000000-0000-4000-8000-000000000001'::uuid,
  'RONA-QA-C001',
  'Issue 685 Client',
  'CONFIRMED',
  'ACTIVE'
);

insert into portal_private.deals(id,deal_id,client_key)
values (
  '30000000-0000-4000-8000-000000000001'::uuid,
  'DEAL-QA-685-001',
  '10000000-0000-4000-8000-000000000001'::uuid
);
