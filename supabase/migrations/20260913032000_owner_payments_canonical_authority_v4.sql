-- ADMIN PAYMENTS CANONICAL OWNER WORKFLOW V4
-- Payment-layer authority only. This migration does NOT alter Deal lifecycle, owner_deal_workflow,
-- Deal statuses, or any upstream payment-handoff transition.

create table if not exists portal_private.owner_client_payment_allocation_authorizations_v4 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id) on delete restrict,
  payment_id text not null,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  actor_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  authority_state text not null default 'ACTIVE' check (authority_state in ('ACTIVE','SUPERSEDED')),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','SUPERSEDED')),
  idempotency_key text not null unique check (btrim(idempotency_key)<>''),
  supersedes_authorization_id uuid null references portal_private.owner_client_payment_allocation_authorizations_v4(id) on delete restrict,
  request_hash text not null,
  request_payload jsonb not null,
  result_payload jsonb not null default '{}'::jsonb,
  source_system text not null default 'OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4',
  source_version text not null,
  source_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_private.owner_client_payment_allocation_items_v4 (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references portal_private.owner_client_payment_allocation_authorizations_v4(id) on delete restrict,
  payment_allocation_id uuid not null unique references portal_private.payment_allocations(id) on delete restrict,
  deal_key uuid not null references portal_private.deals(id) on delete restrict,
  deal_id text not null,
  allocated_amount numeric not null check (allocated_amount>0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now()
);

create table if not exists portal_private.owner_deal_spend_allocations_v4 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id) on delete restrict,
  payment_id text not null,
  deal_key uuid not null references portal_private.deals(id) on delete restrict,
  deal_id text not null,
  allocated_amount numeric not null check (allocated_amount>0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  spend_kind text not null check (spend_kind in ('RONA_ADVANCE','BANK_FEE','OTHER_CONFIRMED')),
  actor_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  authority_state text not null default 'CONFIRMED' check (authority_state in ('CONFIRMED','SUPERSEDED')),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','SUPERSEDED')),
  idempotency_key text not null unique check (btrim(idempotency_key)<>''),
  supersedes_id uuid null references portal_private.owner_deal_spend_allocations_v4(id) on delete restrict,
  request_hash text not null,
  source_system text not null default 'OWNER_AUTHORIZED_DEAL_SPEND_V4',
  source_version text not null,
  source_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_private.owner_payment_authority_history_v4 (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('CLIENT_PAYMENT_ALLOCATION','OWNER_AUTHORIZED_DEAL_SPEND')),
  action text not null check (action in ('AUTHORIZE','SUPERSEDE')),
  entity_id uuid not null,
  payment_id text not null,
  deal_id text not null,
  allocated_amount numeric not null check (allocated_amount>0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  actor_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  authority text not null default 'OWNER',
  idempotency_key text not null,
  source_system text not null,
  source_timestamp timestamptz not null,
  supersedes_entity_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists owner_client_payment_auth_v4_payment_idx on portal_private.owner_client_payment_allocation_authorizations_v4(payment_key,authority_state,lifecycle_state);
create index if not exists owner_deal_spend_v4_payment_idx on portal_private.owner_deal_spend_allocations_v4(payment_key,authority_state,lifecycle_state);
create index if not exists owner_deal_spend_v4_deal_idx on portal_private.owner_deal_spend_allocations_v4(deal_key,currency,authority_state,lifecycle_state);
create index if not exists owner_payment_authority_history_v4_entity_idx on portal_private.owner_payment_authority_history_v4(event_type,entity_id,action);

create or replace function portal_private.owner_payment_v4_history_immutable()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','portal_private' as $$
begin raise exception using errcode='42501',message='OWNER_PAYMENT_AUTHORITY_HISTORY_IMMUTABLE'; end $$;

drop trigger if exists trg_owner_payment_authority_history_v4_immutable on portal_private.owner_payment_authority_history_v4;
create trigger trg_owner_payment_authority_history_v4_immutable before update or delete on portal_private.owner_payment_authority_history_v4 for each row execute function portal_private.owner_payment_v4_history_immutable();
