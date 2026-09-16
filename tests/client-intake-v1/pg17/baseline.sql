\set ON_ERROR_STOP on

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists portal_private;

do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;

create type portal_private.staff_functional_role_enum as enum (
  'EXECUTIVE_DIRECTOR','OPERATIONS_DIRECTOR','COMMERCIAL_DIRECTOR','LEGAL','FINANCE','ACCOUNTING','MARKET_ANALYST','RAIL_LOGISTICS','SYSTEM_ADMIN'
);
create type portal_private.portal_role_enum as enum ('CLIENT','AGENT','ADMIN');
create type portal_private.price_mode_enum as enum ('ACCEPT_PUBLISHED_PRICE','CLIENT_PROPOSED_PRICE');
create type portal_private.staff_task_status_enum as enum ('NEW','ACKNOWLEDGED','IN_PROGRESS','WAITING','DECIDED','COMPLETED','REJECTED','CLOSED');
create type portal_private.staff_priority_enum as enum ('LOW','NORMAL','HIGH','CRITICAL');

create table portal_private.clients (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  client_id text not null unique,
  legal_name text
);
create table portal_private.contracts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  contract_id text not null unique,
  client_key uuid not null references portal_private.clients(id)
);
create table portal_private.deals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  deal_id text not null unique,
  client_key uuid,
  contract_key uuid
);

create table portal_private.client_applications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  application_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  source_publication_id uuid,
  source_publication_item_id uuid,
  product text not null,
  quantity_tonnes numeric not null,
  delivery_period_from date,
  delivery_period_to date,
  delivery_basis text,
  destination text,
  delivery_method text,
  payment_terms text not null default 'QA',
  price_mode portal_private.price_mode_enum not null,
  proposed_price numeric,
  proposed_currency char(3),
  status text not null default 'SUBMITTED',
  linked_deal_key uuid references portal_private.deals(id),
  submitted_at timestamptz,
  decision_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null default 'PG17_QA',
  source_version text,
  source_timestamp timestamptz,
  source_price_mode text,
  source_submission_state text
);

create table portal_private.portal_reverse_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_id text not null unique,
  idempotency_key text not null unique,
  actor_user_id uuid not null default pg_catalog.gen_random_uuid(),
  actor_auth_user_id uuid not null default pg_catalog.gen_random_uuid(),
  actor_role portal_private.portal_role_enum not null,
  client_key uuid references portal_private.clients(id),
  contract_key uuid references portal_private.contracts(id),
  deal_key uuid references portal_private.deals(id),
  event_type text not null,
  authority_domain text not null default 'PORTAL',
  authority_target_type text not null default 'REQUEST',
  authority_target_id text,
  payload jsonb not null default '{}'::jsonb,
  processing_state text not null default 'RECEIVED',
  acknowledgement_state text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null default 'PORTAL_API',
  source_version text,
  source_timestamp timestamptz not null default now()
);

create table portal_private.staff_tasks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  task_id text not null unique,
  title text not null,
  description text,
  status portal_private.staff_task_status_enum not null default 'NEW',
  priority portal_private.staff_priority_enum not null default 'NORMAL',
  authority_domain text not null,
  assigned_functional_role portal_private.staff_functional_role_enum,
  assigned_user_id uuid,
  due_at timestamptz,
  client_key uuid,
  contract_key uuid,
  application_key uuid,
  deal_key uuid,
  shipment_key uuid,
  source_reverse_event_key uuid unique,
  source_type text not null,
  source_object_id text,
  source_version text,
  source_hash text,
  qa_only boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function portal_private.staff_role_for_reverse_event(p_event_type text)
returns portal_private.staff_functional_role_enum
language sql immutable set search_path='pg_catalog','portal_private' as $$
  select case
    when p_event_type='CLIENT_CLAIM_SUBMIT' then 'LEGAL'::portal_private.staff_functional_role_enum
    when p_event_type='CLIENT_PAYMENT_PROOF_SUBMIT' then 'ACCOUNTING'::portal_private.staff_functional_role_enum
    else 'OPERATIONS_DIRECTOR'::portal_private.staff_functional_role_enum
  end
$$;

-- Existing production trigger contract. The candidate migration replaces this function body,
-- not the trigger, so disposable PG17 exercises the same delegation shape.
create or replace function portal_private.enqueue_reverse_event_staff_task()
returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $$
begin return new; end $$;
create trigger z_enqueue_reverse_event_staff_task
after insert on portal_private.portal_reverse_events
for each row execute function portal_private.enqueue_reverse_event_staff_task();
