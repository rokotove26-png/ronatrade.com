-- ONLINE RAIL #644 / C1
-- Ephemeral PostgreSQL 17.6 production-compatible dependency substrate.
-- This file is QA-only and is never applied to production.

\set ON_ERROR_STOP on

create schema if not exists portal_private;
create schema if not exists extensions;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create extension if not exists pgcrypto with schema extensions;

-- Production enum snapshots used by the B1 dependency contour.
create type portal_private.accounting_closure_state_enum as enum (
  'OPEN','PENDING_RECONCILIATION','CLOSED'
);
create type portal_private.ai_business_role_enum as enum (
  'OPERATIONS_DIRECTOR','FINANCE','LEGAL','MARKET_ANALYST',
  'RAIL_LOGISTICS','SYSTEM_ADMIN','COMMERCIAL_DIRECTOR'
);
create type portal_private.audit_result_enum as enum (
  'SUCCESS','DENIED','FAILURE'
);
create type portal_private.audit_severity_enum as enum (
  'INFO','WARNING','ERROR','CRITICAL'
);
create type portal_private.authority_state_enum as enum (
  'DRAFT','SOURCE_RECEIVED','VERIFIED','CONFIRMED','SUPERSEDED','REJECTED'
);
create type portal_private.finance_state_enum as enum (
  'NOT_DUE','DUE','PARTIAL','PAID','OVERDUE','DISPUTED'
);
create type portal_private.import_result_enum as enum (
  'STARTED','SUCCEEDED','PARTIAL','FAILED','REVERSED'
);
create type portal_private.lifecycle_state_enum as enum (
  'DRAFT','ACTIVE','SUSPENDED','CLOSED','ARCHIVED','SUPERSEDED'
);

-- Minimal referenced substrate tables for production FK compatibility.
create table portal_private.portal_users (
  id uuid primary key default gen_random_uuid()
);

create table portal_private.clients (
  id uuid primary key default gen_random_uuid()
);

create table portal_private.contracts (
  id uuid primary key default gen_random_uuid(),
  client_key uuid not null references portal_private.clients(id) on delete restrict,
  unique (id, client_key)
);

create table portal_private.shipments (
  id uuid primary key default gen_random_uuid()
);

create table portal_private.documents (
  id uuid primary key default gen_random_uuid()
);

create table portal_private.import_batches (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  source_system text not null,
  source_version text,
  source_timestamp timestamptz not null,
  checksum_sha256 text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result portal_private.import_result_enum not null default 'STARTED',
  error_count integer not null default 0,
  record_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  initiated_by uuid references portal_private.portal_users(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_batches_checksum_format
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-fA-F]{64}$'),
  constraint import_batches_counts_nonnegative
    check (error_count >= 0 and record_count >= 0 and imported_count >= 0 and skipped_count >= 0),
  constraint import_batches_finish_consistency
    check (
      (result='STARTED' and finished_at is null)
      or (result<>'STARTED' and finished_at is not null)
    ),
  constraint import_batches_idempotency_nonblank check (btrim(idempotency_key)<>''),
  constraint import_batches_source_nonblank check (btrim(source_system)<>'')
);

create index import_batches_result_idx
  on portal_private.import_batches(result,started_at desc);
create index import_batches_source_idx
  on portal_private.import_batches(source_system,source_timestamp desc,result);

create table portal_private.source_objects (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references portal_private.import_batches(id) on delete restrict,
  idempotency_key text not null unique,
  source_system text not null,
  source_object_type text not null,
  source_object_id text not null,
  source_version text,
  source_timestamp timestamptz,
  checksum_sha256 text,
  raw_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint source_objects_checksum_format
    check (checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-fA-F]{64}$'),
  constraint source_objects_idempotency_nonblank check (btrim(idempotency_key)<>''),
  constraint source_objects_identity_nonblank
    check (
      btrim(source_object_type)<>'' and
      btrim(source_object_id)<>'' and
      btrim(source_system)<>''
    )
);

create index source_objects_batch_idx
  on portal_private.source_objects(import_batch_id,source_object_type,source_object_id);
create index source_objects_source_idx
  on portal_private.source_objects(source_system,source_object_type,source_object_id);

create table portal_private.deals (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null unique,
  client_key uuid not null,
  contract_key uuid not null,
  business_status text not null default 'REGISTERED',
  finance_status portal_private.finance_state_enum not null default 'NOT_DUE',
  accounting_closure_status portal_private.accounting_closure_state_enum not null default 'OPEN',
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid references portal_private.import_batches(id) on delete restrict,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  constraint deals_business_id_nonblank check (btrim(deal_id)<>''),
  constraint deals_business_status_allowed check (
    business_status=any(array[
      'REGISTERED','OPEN','SUPPLIER_PENDING','RESOURCE_CONFIRMED','RESOURCE_DENIED',
      'EXECUTING','COMPLETED','CANCELLED','CLOSED'
    ]::text[])
  ),
  constraint deals_close_consistency check (
    closed_at is null or business_status=any(array[
      'RESOURCE_DENIED','COMPLETED','CANCELLED','CLOSED'
    ]::text[])
  ),
  constraint deals_contract_client_fk
    foreign key (contract_key,client_key)
    references portal_private.contracts(id,client_key) on delete restrict,
  constraint deals_id_client_contract_unique unique(id,client_key,contract_key),
  constraint deals_id_client_unique unique(id,client_key)
);

create index deals_client_contract_idx
  on portal_private.deals(client_key,contract_key,business_status);
create index deals_deal_id_idx on portal_private.deals(deal_id);
create index deals_finance_idx
  on portal_private.deals(finance_status,accounting_closure_status);

create table portal_private.rail_documents (
  id uuid primary key default gen_random_uuid(),
  rail_document_id text not null unique,
  document_type text not null,
  gu12_number text,
  client_key uuid references portal_private.clients(id) on delete restrict,
  deal_key uuid references portal_private.deals(id) on delete restrict,
  shipment_key uuid references portal_private.shipments(id) on delete restrict,
  document_number text,
  document_date date,
  route_text text,
  source_document_key uuid references portal_private.documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid references portal_private.import_batches(id) on delete restrict,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  constraint rail_documents_business_id_nonblank check (btrim(rail_document_id)<>''),
  constraint rail_documents_type_nonblank check (btrim(document_type)<>'')
);

create index rail_documents_gu12_idx
  on portal_private.rail_documents(gu12_number) where gu12_number is not null;
create index rail_documents_scope_idx
  on portal_private.rail_documents(client_key,deal_key,shipment_key);

create table portal_private.rail_wagons (
  id uuid primary key default gen_random_uuid(),
  wagon_number text not null,
  shipment_key uuid references portal_private.shipments(id) on delete restrict,
  rail_document_key uuid references portal_private.rail_documents(id) on delete restrict,
  current_station_name text,
  current_station_code text,
  operation_code text,
  operation_at timestamptz,
  status text not null default 'REGISTERED',
  last_position_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source_system text not null,
  source_version text,
  source_timestamp timestamptz,
  import_batch_id uuid references portal_private.import_batches(id) on delete restrict,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  constraint rail_wagons_link_required
    check (shipment_key is not null or rail_document_key is not null),
  constraint rail_wagons_number_nonblank check (btrim(wagon_number)<>''),
  constraint rail_wagons_status_allowed check (
    status=any(array[
      'REGISTERED','LOADED','IN_TRANSIT','DELAYED','DETACHED',
      'ARRIVED','UNLOADED','EMPTY_RETURN','CLOSED'
    ]::text[])
  ),
  constraint rail_wagons_unique_scope
    unique(wagon_number,shipment_key,rail_document_key)
);

create index rail_wagons_document_idx
  on portal_private.rail_wagons(rail_document_key,wagon_number);
create index rail_wagons_position_idx
  on portal_private.rail_wagons(last_position_at desc);
create index rail_wagons_shipment_idx
  on portal_private.rail_wagons(shipment_key,wagon_number);

create table portal_private.audit_events (
  event_id uuid primary key default gen_random_uuid(),
  event_at timestamptz not null default now(),
  actor_user_id uuid references portal_private.portal_users(id) on delete restrict,
  actor_role text not null default 'SYSTEM',
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before_hash text,
  after_hash text,
  request_id uuid,
  correlation_id uuid,
  source_ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  severity portal_private.audit_severity_enum not null default 'INFO',
  result portal_private.audit_result_enum not null default 'SUCCESS',
  constraint audit_action_nonblank check (btrim(action)<>''),
  constraint audit_actor_role_allowed check (
    actor_role=any(array['SYSTEM','ADMIN','RONA_OPERATOR','CLIENT','AGENT']::text[])
  ),
  constraint audit_after_hash_format
    check (after_hash is null or after_hash ~ '^[0-9a-fA-F]{64}$'),
  constraint audit_before_hash_format
    check (before_hash is null or before_hash ~ '^[0-9a-fA-F]{64}$'),
  constraint audit_entity_nonblank check (btrim(entity_type)<>'' and btrim(entity_id)<>'')
);

create index audit_events_actor_idx
  on portal_private.audit_events(actor_user_id,event_at desc) where actor_user_id is not null;
create index audit_events_correlation_idx
  on portal_private.audit_events(correlation_id) where correlation_id is not null;
create index audit_events_entity_idx
  on portal_private.audit_events(entity_type,entity_id,event_at desc);
create index audit_events_time_idx
  on portal_private.audit_events(event_at desc);

create table portal_private.ai_coordination_records (
  record_id uuid primary key default gen_random_uuid(),
  record_type text not null,
  functional_role portal_private.ai_business_role_enum not null,
  identity_id text not null,
  token_id uuid,
  client_id text not null,
  server_slug text not null,
  tool_name text not null,
  target_type text not null,
  target_id text not null,
  target_role portal_private.ai_business_role_enum,
  parent_record_id uuid references portal_private.ai_coordination_records(record_id),
  version integer not null default 1,
  supersedes_id uuid references portal_private.ai_coordination_records(record_id),
  idempotency_key_hash text not null,
  payload_hash text not null,
  source_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  payload jsonb not null,
  status text not null,
  correlation_id uuid not null,
  mcp_request_id uuid not null,
  qa_only boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ai_coordination_records_evidence_refs_check
    check (jsonb_typeof(evidence_refs)='array'),
  constraint ai_coordination_records_idempotency_key_hash_check
    check (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  constraint ai_coordination_records_payload_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint ai_coordination_records_record_type_check
    check (record_type=any(array[
      'FUNCTIONAL_CONCLUSION','TASK_ACKNOWLEDGEMENT','TASK_PROGRESS',
      'HANDOFF_REQUEST','BUSINESS_CHANGE_PROPOSAL','OPERATIONS_INTERNAL_DECISION'
    ]::text[])),
  constraint ai_coordination_records_source_refs_check
    check (jsonb_typeof(source_refs)='array'),
  constraint ai_coordination_records_version_check check (version>=1),
  unique(identity_id,tool_name,idempotency_key_hash)
);

create index idx_ai_coordination_parent
  on portal_private.ai_coordination_records(parent_record_id,created_at desc);
create index idx_ai_coordination_role_feed
  on portal_private.ai_coordination_records(functional_role,created_at desc) where qa_only=false;
create index idx_ai_coordination_target_feed
  on portal_private.ai_coordination_records(target_role,created_at desc) where qa_only=false;
create unique index uq_ai_coordination_conclusion_version
  on portal_private.ai_coordination_records(functional_role,target_type,target_id,version)
  where record_type='FUNCTIONAL_CONCLUSION';

-- Production-style immutable helpers relevant to authority/source evidence.
create or replace function portal_private.reject_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode='55000',message='APPEND_ONLY';
end
$$;

create or replace function portal_private.prevent_ai_coordination_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception using errcode='55000',message='AI_COORDINATION_IMMUTABLE';
end
$$;

create trigger trg_source_objects_append_only
before update or delete on portal_private.source_objects
for each row execute function portal_private.reject_update_delete();

create trigger trg_audit_events_append_only
before update or delete on portal_private.audit_events
for each row execute function portal_private.reject_update_delete();

create trigger trg_ai_coordination_records_immutable
before update or delete on portal_private.ai_coordination_records
for each row execute function portal_private.prevent_ai_coordination_mutation();

-- Auth compatibility shim for exact production owner_r1_actor signature/body.
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('app.test_user_id',true),'')::uuid
$$;

create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'session_id',nullif(current_setting('app.test_session_id',true),'')
  )
$$;

create or replace function portal_private.resolve_portal_auth(
  p_auth_uid uuid,
  p_session_id text
)
returns table(
  portal_user_id uuid,
  session_allowed boolean,
  roles text[]
)
language sql stable
as $$
  select p_auth_uid,true,array['ADMIN']::text[]
  where p_auth_uid is not null and p_session_id is not null
$$;

create or replace function portal_private.owner_r1_actor(p_required_role text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare v_user uuid;
begin
  select a.portal_user_id into v_user
  from portal_private.resolve_portal_auth(auth.uid(),auth.jwt()->>'session_id') a
  where a.session_allowed and p_required_role=any(a.roles)
  limit 1;
  if v_user is null then
    raise exception using errcode='42501',message='PORTAL_ACCESS_DENIED';
  end if;
  return v_user;
end
$$;

-- Production role properties relevant to RLS execution.
alter role service_role bypassrls;

alter table portal_private.deals enable row level security;
alter table portal_private.rail_documents enable row level security;
alter table portal_private.rail_wagons enable row level security;
alter table portal_private.import_batches enable row level security;
alter table portal_private.source_objects enable row level security;
alter table portal_private.audit_events enable row level security;
alter table portal_private.ai_coordination_records enable row level security;

create policy rona_server_bypass_guard_deals
  on portal_private.deals for all to service_role using(false) with check(false);
create policy rona_server_bypass_guard_rail_documents
  on portal_private.rail_documents for all to service_role using(false) with check(false);
create policy rona_server_bypass_guard_rail_wagons
  on portal_private.rail_wagons for all to service_role using(false) with check(false);
create policy rona_server_bypass_guard_import_batches
  on portal_private.import_batches for all to service_role using(false) with check(false);
create policy rona_server_bypass_guard_source_objects
  on portal_private.source_objects for all to service_role using(false) with check(false);
create policy rona_server_bypass_guard_audit_events
  on portal_private.audit_events for all to service_role using(false) with check(false);

grant usage on schema portal_private to service_role,authenticated,anon;
grant select,insert,update on portal_private.deals to service_role;
grant select,insert,update on portal_private.rail_documents to service_role;
grant select,insert,update on portal_private.rail_wagons to service_role;
grant select,insert,update on portal_private.import_batches to service_role;
grant select,insert on portal_private.source_objects to service_role;
grant select,insert on portal_private.audit_events to service_role;
grant select,insert on portal_private.ai_coordination_records to service_role;

-- Authenticated/anon have no direct table write grants in this rehearsal substrate.
