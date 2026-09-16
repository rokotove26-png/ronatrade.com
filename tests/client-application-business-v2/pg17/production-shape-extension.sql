\set ON_ERROR_STOP on
-- Extends the pinned Client Intake PG17 baseline. Contains no production data.
-- The session resolver below is an isolated authorization test double, not a JWT test.
create type portal_private.application_status_enum as enum
  ('DRAFT','SUBMITTED','UNDER_REVIEW','ACCEPTED_AWAITING_DEAL_REGISTRATION','DEAL_REGISTERED','REJECTED','CLOSED','CANCELLED');
create type portal_private.authority_state_enum as enum ('SOURCE_RECEIVED','VERIFIED','CONFIRMED');
alter table portal_private.client_applications alter column status drop default;
alter table portal_private.client_applications alter column status type portal_private.application_status_enum using status::portal_private.application_status_enum;
alter table portal_private.client_applications alter column status set default 'DRAFT';
alter table portal_private.client_applications add column authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED';
alter table portal_private.client_applications add column decision_by uuid;
alter table portal_private.client_applications add constraint client_applications_price_mode_fields check(
  price_mode::text='ACCEPT_PUBLISHED_PRICE' or (price_mode::text='CLIENT_PROPOSED_PRICE' and proposed_price is not null and proposed_currency is not null));
alter table portal_private.client_applications add constraint client_applications_currency_format check(proposed_currency is null or proposed_currency ~ '^[A-Z]{3}$');
alter table portal_private.client_applications add constraint client_applications_quantity_positive check(quantity_tonnes>0);
alter table portal_private.client_applications add constraint client_applications_submission_consistency check(
  status::text='DRAFT' or submitted_at is not null or source_submission_state='HISTORICAL_SUBMISSION_TIMESTAMP_UNKNOWN');
alter table portal_private.staff_tasks add column decision_at timestamptz;
alter table portal_private.application_lines add column publication_item_key uuid;
alter table portal_private.application_lines add column source_mode text;
alter table portal_private.owner_application_workflow add column business_status text not null default 'NEW';
alter table portal_private.owner_application_workflow add column counter_price numeric;
alter table portal_private.owner_application_workflow add column counter_currency char(3);
alter table portal_private.owner_application_workflow add column counter_offer_used boolean not null default false;
alter table portal_private.owner_application_workflow add column client_counter_response text;
alter table portal_private.owner_application_workflow add column admin_decided_by uuid;
alter table portal_private.owner_application_workflow add column admin_decided_at timestamptz;
alter table portal_private.owner_application_workflow add column supplier_approved_by uuid;
alter table portal_private.owner_application_workflow add column updated_at timestamptz;
alter table portal_private.owner_application_workflow add column finalized_at timestamptz;
create table portal_private.ai_service_identities(id uuid primary key default gen_random_uuid(),identity_id text not null unique,
  business_role portal_private.staff_functional_role_enum not null,status text not null,not_before timestamptz,revoked_at timestamptz);
create table portal_private.application_id_counters(client_key uuid references portal_private.clients(id),calendar_year integer,
  last_number integer not null check(last_number>=0),updated_at timestamptz not null default now(),primary key(client_key,calendar_year));
create table portal_private.deal_registrations(id uuid primary key default gen_random_uuid(),application_key uuid not null
  references portal_private.client_applications(id) on delete restrict,deal_key uuid references portal_private.deals(id));
create table portal_private.resource_decisions(id uuid primary key default gen_random_uuid(),deal_key uuid,decision_state text);
create table portal_private.audit_events(event_id uuid primary key default gen_random_uuid(),event_at timestamptz not null default now(),
  actor_user_id uuid,actor_role portal_private.portal_role_enum,action text,entity_type text,entity_id text,
  request_id uuid,correlation_id uuid,metadata jsonb not null default '{}'::jsonb);
create table portal_private.publications(id uuid primary key default gen_random_uuid(),status text not null,audience text not null);
create table portal_private.publication_items(id uuid primary key default gen_random_uuid(),publication_key uuid references portal_private.publications(id),
  product text,price numeric,currency char(3),payment_terms text,basis text,delivery_period_from date,delivery_period_to date,
  item_type text default 'PRICE',audience text default 'ALL_CLIENTS',distribution_allowed boolean default true,
  valid_from timestamptz,valid_to timestamptz);
create table portal_private.publication_client_targets(publication_key uuid,publication_item_key uuid,client_key uuid,target_scope text);
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
create table portal_private.qa_session_roles(user_id uuid primary key,roles text[] not null);
create or replace function portal_private.resolve_portal_auth(p_auth_user uuid,p_session_id uuid)
returns table(portal_user_id uuid,display_name text,roles text[],session_allowed boolean)
language sql stable as $$
  select u.id,u.display_name,r.roles,true from portal_private.portal_users u
    join auth.sessions s on s.user_id=u.auth_user_id and s.id=p_session_id
    join portal_private.qa_session_roles r on r.user_id=u.id
    where u.auth_user_id=p_auth_user and u.status::text='ACTIVE' and u.lifecycle_state::text='ACTIVE'
      and (s.not_after is null or s.not_after>now())
$$;
create or replace function portal_private.client_user_has_contract_access(p_user uuid,p_contract uuid,p_at timestamptz)
returns boolean language sql stable as $$
  select exists(select 1 from portal_private.client_user_bindings b
    where b.user_id=p_user and b.contract_key=p_contract and b.status::text='ACTIVE'
      and b.lifecycle_state::text='ACTIVE' and b.valid_from<=p_at and (b.valid_to is null or b.valid_to>p_at) and b.revoked_at is null)
$$;
-- The legacy event transport is a persistence+authorization double; the real deployed
-- intake triggers, routing functions, transactions and V2 executor run underneath it.
create function portal_private.server_submit_reverse_event(
  p_auth_user uuid,p_session text,p_event_type text,p_domain text,p_target_type text,p_target_id text,
  p_client_id text,p_contract_id text,p_deal_id text,p_payload jsonb,p_key text,p_request uuid,p_correlation uuid
) returns table(event_id text) language plpgsql as $$
declare cl uuid; ct uuid; usr uuid; event_text text;
begin
  select c.id,t.id,u.portal_user_id into cl,ct,usr from portal_private.resolve_portal_auth(p_auth_user,p_session::uuid) u
    join portal_private.clients c on c.client_id=p_client_id
    join portal_private.contracts t on t.contract_id=p_contract_id and t.client_key=c.id
    where u.session_allowed and 'CLIENT'=any(u.roles)
      and portal_private.client_user_has_contract_access(u.portal_user_id,t.id,now());
  if usr is null then raise exception 'TEST_TRANSPORT_ACCESS_DENIED'; end if;
  select e.event_id into event_text from portal_private.portal_reverse_events e where e.idempotency_key=p_key;
  if found then return query select event_text; return; end if;
  event_text:='QA-EVT-'||replace(gen_random_uuid()::text,'-','');
  insert into portal_private.portal_reverse_events(event_id,idempotency_key,actor_role,actor_user_id,actor_auth_user_id,
    client_key,contract_key,event_type,authority_domain,authority_target_type,authority_target_id,payload)
    values(event_text,p_key,'CLIENT',usr,p_auth_user,cl,ct,p_event_type,p_domain,p_target_type,p_target_id,p_payload);
  return query select event_text;
end $$;
