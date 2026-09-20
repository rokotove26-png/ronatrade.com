-- Ephemeral-only fixture for Stage 2 real integration QA.
-- It models only the authority/lifecycle relations exercised by the feature.
drop schema if exists portal_private cascade;
drop schema if exists auth cascade;
drop extension if exists pgcrypto cascade;
drop schema if exists extensions cascade;

create schema extensions;
create extension pgcrypto with schema extensions;
create schema auth;
create schema portal_private;

do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $stage3a_role$ begin create role authenticated nologin; exception when duplicate_object then null; end $stage3a_role$;
do $stage3a_role$ begin create role service_role nologin; exception when duplicate_object then null; end $stage3a_role$;

create type portal_private.portal_role_enum as enum ('ADMIN','RONA_OPERATOR','AGENT','CLIENT');
create type portal_private.binding_status_enum as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED','EXPIRED');
create type portal_private.lifecycle_state_enum as enum ('DRAFT','ACTIVE','SUSPENDED','CLOSED','ARCHIVED','SUPERSEDED');
create type portal_private.authority_state_enum as enum ('DRAFT','SOURCE_RECEIVED','VERIFIED','CONFIRMED','SUPERSEDED','REJECTED');
create type portal_private.portal_user_status_enum as enum ('PENDING','ACTIVE','SUSPENDED','REVOKED','ARCHIVED');
create type portal_private.application_status_enum as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','ACCEPTED_AWAITING_DEAL_REGISTRATION','REJECTED','DEAL_REGISTERED','CANCELLED','CLOSED');
create type portal_private.price_mode_enum as enum ('ACCEPT_PUBLISHED_PRICE','CLIENT_PROPOSED_PRICE','REQUEST_DELIVERED_PRICE');

create table auth.users(
  id uuid primary key,
  email text
);
create table auth.sessions(
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  not_after timestamptz
);

create table portal_private.portal_users(
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  login_name text,
  display_name text not null,
  status portal_private.portal_user_status_enum not null default 'ACTIVE',
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  activated_at timestamptz default now(),
  suspended_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table portal_private.portal_user_roles(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  role portal_private.portal_role_enum not null,
  status portal_private.binding_status_enum not null default 'ACTIVE',
  revoked_at timestamptz,
  revoked_by uuid references portal_private.portal_users(id),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.clients(
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  legal_name text not null,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  updated_at timestamptz not null default now()
);

create table portal_private.contracts(
  id uuid primary key default gen_random_uuid(),
  contract_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  current_external_contract_number text,
  contract_status text not null default 'ACTIVE',
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  signed_contract_confirmed_at timestamptz default now(),
  effective_from date,
  effective_to date,
  updated_at timestamptz not null default now()
);

create table portal_private.client_user_bindings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  status portal_private.binding_status_enum not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references portal_private.portal_users(id),
  reason text,
  deal_scope_mode text not null default 'ALL_CONTRACT_DEALS',
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.client_user_pending_company_bindings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  client_key uuid not null references portal_private.clients(id),
  requested_contract_key uuid references portal_private.contracts(id),
  status portal_private.binding_status_enum not null default 'PENDING',
  revoked_at timestamptz,
  revoked_by uuid references portal_private.portal_users(id),
  reason text,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.deals(
  id uuid primary key default gen_random_uuid(),
  deal_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  business_status text not null default 'REGISTERED',
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.client_user_deal_grants(
  id uuid primary key default gen_random_uuid(),
  binding_id uuid references portal_private.client_user_bindings(id),
  user_id uuid not null references portal_private.portal_users(id),
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  deal_key uuid not null references portal_private.deals(id),
  status portal_private.binding_status_enum not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references portal_private.portal_users(id),
  reason text,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.agent_persons(
  id uuid primary key default gen_random_uuid(),
  agent_person_id text not null unique,
  full_name text,
  display_alias text,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  updated_at timestamptz not null default now()
);

create table portal_private.agent_user_bindings(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  agent_person_key uuid not null references portal_private.agent_persons(id),
  agent_legal_entity_key uuid,
  status portal_private.binding_status_enum not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references portal_private.portal_users(id),
  reason text,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.agent_client_assignments(
  id uuid primary key default gen_random_uuid(),
  agent_person_key uuid not null references portal_private.agent_persons(id),
  agent_legal_entity_key uuid,
  client_key uuid not null references portal_private.clients(id),
  status portal_private.binding_status_enum not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.agent_deal_terms(
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references portal_private.agent_client_assignments(id),
  client_key uuid not null references portal_private.clients(id),
  deal_key uuid not null references portal_private.deals(id),
  status portal_private.binding_status_enum not null default 'ACTIVE',
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.agent_user_relation_control(
  id uuid primary key default gen_random_uuid(),
  agent_person_key uuid not null references portal_private.agent_persons(id),
  agent_legal_entity_key uuid,
  relation_status text not null default 'ACTIVE',
  authority_state portal_private.authority_state_enum not null default 'CONFIRMED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.portal_sessions_control(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_private.portal_users(id),
  session_subject text unique,
  status portal_private.binding_status_enum not null default 'ACTIVE',
  revoked_at timestamptz,
  revoked_by uuid references portal_private.portal_users(id),
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_private.documents(
  id uuid primary key default gen_random_uuid(),
  document_id text unique,
  client_key uuid references portal_private.clients(id),
  contract_key uuid references portal_private.contracts(id),
  deal_key uuid references portal_private.deals(id),
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

create table portal_private.payment_allocations(
  id uuid primary key default gen_random_uuid(),
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  deal_key uuid references portal_private.deals(id)
);

create table portal_private.rail_documents(
  id uuid primary key default gen_random_uuid(),
  client_key uuid references portal_private.clients(id),
  deal_key uuid references portal_private.deals(id)
);

create table portal_private.publications(
  id uuid primary key default gen_random_uuid(),
  publication_id text not null unique,
  status text not null default 'PUBLISHED',
  audience text not null default 'ALL_CLIENTS'
);

create table portal_private.publication_items(
  id uuid primary key default gen_random_uuid(),
  publication_key uuid not null references portal_private.publications(id),
  item_type text not null default 'PRICE',
  distribution_allowed boolean not null default true,
  audience text not null default 'ALL_CLIENTS',
  valid_from timestamptz,
  valid_to timestamptz,
  product text,
  price numeric,
  currency char(3),
  payment_terms text,
  basis text,
  delivery_period_from date,
  delivery_period_to date
);

create table portal_private.publication_client_targets(
  id uuid primary key default gen_random_uuid(),
  publication_key uuid not null references portal_private.publications(id),
  publication_item_key uuid references portal_private.publication_items(id),
  client_key uuid not null references portal_private.clients(id),
  target_scope text not null default 'PUBLICATION'
);

create table portal_private.client_applications(
  id uuid primary key default gen_random_uuid(),
  application_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  source_publication_id uuid,
  source_publication_item_id uuid,
  product text,
  quantity_tonnes numeric,
  delivery_period_from date,
  delivery_period_to date,
  delivery_basis text,
  destination text,
  delivery_method text,
  payment_terms text,
  price_mode portal_private.price_mode_enum,
  proposed_price numeric,
  proposed_currency char(3),
  status portal_private.application_status_enum not null default 'DRAFT',
  linked_deal_key uuid references portal_private.deals(id),
  submitted_at timestamptz,
  decision_at timestamptz,
  decision_reason text,
  source_system text,
  source_version text,
  source_timestamp timestamptz,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  source_price_mode text,
  source_submission_state text,
  updated_at timestamptz not null default now()
);

create table portal_private.application_lines(
  id uuid primary key default gen_random_uuid(),
  application_key uuid not null references portal_private.client_applications(id),
  line_no integer not null,
  publication_item_key uuid references portal_private.publication_items(id),
  product text,
  quantity_tonnes numeric,
  price_mode portal_private.price_mode_enum,
  published_price numeric,
  proposed_price numeric,
  currency char(3),
  source_mode text
);

create table portal_private.client_application_submit_receipts_v2(
  id uuid primary key default gen_random_uuid(),
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  application_id text not null,
  unique(client_key,contract_key,idempotency_key)
);

create table portal_private.client_application_tombstones_v2(
  id uuid primary key default gen_random_uuid(),
  application_snapshot jsonb not null
);

create table portal_private.client_application_bundle_receipts_v2(
  client_key uuid not null references portal_private.clients(id),
  contract_key uuid not null references portal_private.contracts(id),
  idempotency_key text not null,
  request_fingerprint text not null,
  application_id text not null,
  details_event_id text not null,
  created_at timestamptz not null default now(),
  primary key(client_key,contract_key,idempotency_key)
);

create table portal_private.client_intake_v1(
  intake_id uuid primary key default gen_random_uuid(),
  durable_id uuid not null default gen_random_uuid(),
  source_kind text not null,
  source_internal_key uuid,
  source_record_id text not null,
  actionable_type text,
  effective_payload jsonb not null default '{}'::jsonb,
  client_key uuid references portal_private.clients(id),
  contract_key uuid references portal_private.contracts(id),
  application_key uuid references portal_private.client_applications(id),
  source_submitted_at timestamptz not null default now(),
  routing_state text not null default 'ROUTED'
);

create table portal_private.staff_tasks(
  id uuid primary key default gen_random_uuid(),
  assigned_functional_role text not null default 'OPERATIONS_DIRECTOR',
  qa_only boolean not null default false,
  application_key uuid references portal_private.client_applications(id),
  source_reverse_event_key uuid,
  status text not null default 'NEW',
  title text,
  description text,
  created_at timestamptz not null default now()
);

create table portal_private.client_intake_task_links_v1(
  intake_id uuid not null references portal_private.client_intake_v1(intake_id),
  staff_task_id uuid not null references portal_private.staff_tasks(id),
  primary key(intake_id,staff_task_id)
);

create table portal_private.portal_reverse_events(
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  idempotency_key text not null,
  actor_user_id uuid not null references portal_private.portal_users(id),
  actor_auth_user_id uuid,
  actor_role portal_private.portal_role_enum not null,
  client_key uuid references portal_private.clients(id),
  contract_key uuid references portal_private.contracts(id),
  deal_key uuid references portal_private.deals(id),
  event_type text not null,
  authority_domain text not null,
  authority_target_type text not null,
  authority_target_id text,
  payload jsonb not null default '{}'::jsonb,
  processing_state text not null,
  acknowledgement_state text not null,
  request_id uuid,
  correlation_id uuid,
  source_version text,
  source_timestamp timestamptz,
  authority_state portal_private.authority_state_enum not null default 'SOURCE_RECEIVED',
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE',
  created_at timestamptz not null default now()
);
create unique index portal_reverse_events_actor_idem_uq on portal_private.portal_reverse_events(actor_user_id,idempotency_key);

create table portal_private.portal_reverse_event_attempts(
  id uuid primary key default gen_random_uuid(),
  event_key uuid not null references portal_private.portal_reverse_events(id),
  attempt_number integer not null,
  processing_state text,
  result text,
  metadata jsonb
);

create table portal_private.audit_events(
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id text,
  request_id uuid,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


create or replace function portal_private.stage3a_fixture_application_intake()
returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $stage3a_app$
declare i uuid; t uuid;
begin
  if new.source_intake_key is not null then
    update portal_private.client_intake_v1 set application_key=new.id where intake_id=new.source_intake_key;
    return new;
  end if;
  insert into portal_private.client_intake_v1(
    source_kind,source_internal_key,source_record_id,actionable_type,effective_payload,
    client_key,contract_key,application_key,source_submitted_at,routing_state
  ) values(
    'CLIENT_APPLICATION',new.id,new.application_id,'CLIENT_APPLICATION_SUBMIT',
    jsonb_build_object('application_id',new.application_id),new.client_key,new.contract_key,new.id,
    coalesce(new.submitted_at,now()),'ROUTED'
  ) returning intake_id into i;
  insert into portal_private.staff_tasks(assigned_functional_role,qa_only,application_key,title)
    values('OPERATIONS_DIRECTOR',false,new.id,'Application '||new.application_id) returning id into t;
  insert into portal_private.client_intake_task_links_v1(intake_id,staff_task_id) values(i,t);
  return new;
end $stage3a_app$;
create trigger stage3a_fixture_application_intake_after_insert
after insert on portal_private.client_applications
for each row execute function portal_private.stage3a_fixture_application_intake();

create or replace function portal_private.stage3a_fixture_reverse_intake()
returns trigger language plpgsql set search_path='pg_catalog','portal_private' as $stage3a_reverse$
declare i uuid; t uuid;
begin
  if new.actor_role<>'CLIENT'::portal_private.portal_role_enum then return new; end if;
  insert into portal_private.client_intake_v1(
    source_kind,source_internal_key,source_record_id,actionable_type,effective_payload,
    client_key,contract_key,source_submitted_at,routing_state
  ) values(
    'PORTAL_REVERSE_EVENT',new.id,new.event_id,coalesce(new.payload->>'message_type',new.event_type),
    new.payload,new.client_key,new.contract_key,new.created_at,'ROUTED'
  ) returning intake_id into i;
  insert into portal_private.staff_tasks(assigned_functional_role,qa_only,source_reverse_event_key,title)
    values('OPERATIONS_DIRECTOR',false,new.id,'Reverse event '||new.event_id) returning id into t;
  insert into portal_private.client_intake_task_links_v1(intake_id,staff_task_id) values(i,t);
  return new;
end $stage3a_reverse$;
create trigger stage3a_fixture_reverse_intake_after_insert
after insert on portal_private.portal_reverse_events
for each row execute function portal_private.stage3a_fixture_reverse_intake();

create or replace function portal_private.materialize_client_application_v2(p_intake_id uuid)
returns text language plpgsql security definer set search_path='pg_catalog','portal_private' as $stage3a_materialize$
declare i portal_private.client_intake_v1; p jsonb; app_id text; app_key uuid; pub_item uuid; pub_key uuid;
begin
  select * into i from portal_private.client_intake_v1 where intake_id=p_intake_id for update;
  if not found then raise exception 'APPLICATION_SOURCE_INTAKE_MISSING'; end if;
  if i.source_kind<>'PORTAL_REVERSE_EVENT' or i.actionable_type<>'DELIVERED_PRICE_CALCULATION_REQUEST_V1' then return null; end if;
  select application_id into app_id from portal_private.client_applications where source_intake_key=i.intake_id;
  if found then return app_id; end if;
  p:=i.effective_payload;
  if jsonb_typeof(p->'quantity_tonnes') is distinct from 'number'
     or (p->>'quantity_tonnes')::numeric<=0
     or nullif(btrim(p->>'product'),'') is null
     or nullif(btrim(p#>>'{destination,station}'),'') is null
  then raise exception 'APPLICATION_SOURCE_FACTS_INCOMPLETE'; end if;
  pub_item:=nullif(p#>>'{reference,publication_item_id}','')::uuid;
  select publication_key into pub_key from portal_private.publication_items where id=pub_item;
  if not found then raise exception 'APPLICATION_SOURCE_PUBLICATION_MISSING'; end if;
  app_key:=gen_random_uuid();
  app_id:=portal_private.next_application_business_id(i.client_key);
  insert into portal_private.client_applications(
    id,application_id,client_key,contract_key,source_intake_key,source_publication_id,source_publication_item_id,
    product,quantity_tonnes,delivery_basis,destination,delivery_method,payment_terms,price_mode,status,submitted_at,
    source_system,source_version,source_timestamp,authority_state,lifecycle_state,source_price_mode,source_submission_state
  ) values(
    app_key,app_id,i.client_key,i.contract_key,i.intake_id,pub_key,pub_item,p->>'product',(p->>'quantity_tonnes')::numeric,
    p#>>'{shipment,source_basis}',p#>>'{destination,station}','TO_BE_CONFIRMED',
    coalesce(nullif(p#>>'{commercial,payment_terms}',''),'TO_BE_AGREED'),
    'REQUEST_DELIVERED_PRICE','SUBMITTED',i.source_submitted_at,'CLIENT_INTAKE','APPLICATION_BUSINESS_V2',
    i.source_submitted_at,'SOURCE_RECEIVED','ACTIVE','REQUEST_DELIVERED_PRICE','SOURCE_INTAKE:'||i.intake_id::text
  );
  return app_id;
end $stage3a_materialize$;

create or replace function portal_private.process_client_intake_outbox_v1(p_limit integer default 100)
returns jsonb language sql volatile as $stage3a_sql$select jsonb_build_object('processed',0,'limit',p_limit)$stage3a_sql$;

create sequence portal_private.test_application_seq;

create or replace function portal_private.application_operations_authority_v2()
returns boolean language sql stable as $$select true$$;

create or replace function portal_private.next_application_business_id(p_client_key uuid)
returns text language sql volatile as $$
  select 'APP-T-'||lpad(nextval('portal_private.test_application_seq')::text,6,'0')
$$;

create or replace function portal_private.client_user_has_contract_access(
  p_user_id uuid,p_contract_key uuid,p_at timestamptz default now()
)
returns boolean language sql stable as $$
  select exists(
    select 1
    from portal_private.client_user_bindings b
    join portal_private.contracts ct on ct.id=b.contract_key
    join portal_private.clients cl on cl.id=b.client_key and cl.id=ct.client_key
    join portal_private.portal_users u on u.id=b.user_id
    join portal_private.portal_user_roles r on r.user_id=u.id
      and r.role='CLIENT'::portal_private.portal_role_enum
      and r.status='ACTIVE'::portal_private.binding_status_enum
      and r.revoked_at is null
    where b.user_id=p_user_id and b.contract_key=p_contract_key
      and b.status='ACTIVE'::portal_private.binding_status_enum
      and b.revoked_at is null and b.valid_from<=p_at and (b.valid_to is null or b.valid_to>p_at)
      and b.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and u.status='ACTIVE'::portal_private.portal_user_status_enum
      and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and cl.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ct.contract_status='ACTIVE'
      and ct.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ct.signed_contract_confirmed_at is not null
      and nullif(btrim(ct.current_external_contract_number),'') is not null
  )
$$;

create or replace function portal_private.client_user_has_deal_access(
  p_user_id uuid,p_deal_key uuid,p_at timestamptz default now()
)
returns boolean language sql stable as $$
  select exists(
    select 1
    from portal_private.deals d
    join portal_private.client_user_bindings b
      on b.user_id=p_user_id and b.client_key=d.client_key and b.contract_key=d.contract_key
    where d.id=p_deal_key
      and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and portal_private.client_user_has_contract_access(p_user_id,d.contract_key,p_at)
      and (
        b.deal_scope_mode='ALL_CONTRACT_DEALS'
        or exists(
          select 1 from portal_private.client_user_deal_grants g
          where g.user_id=p_user_id and g.deal_key=d.id
            and g.status='ACTIVE'::portal_private.binding_status_enum
            and g.revoked_at is null and g.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        )
      )
  )
$$;

create or replace function portal_private.agent_user_has_client_access(
  p_user_id uuid,p_client_key uuid,p_at timestamptz default now()
)
returns boolean language sql stable as $$
  select exists(
    select 1
    from portal_private.agent_user_bindings ub
    join portal_private.agent_client_assignments a on a.agent_person_key=ub.agent_person_key
    join portal_private.portal_user_roles r on r.user_id=ub.user_id
      and r.role='AGENT'::portal_private.portal_role_enum
      and r.status='ACTIVE'::portal_private.binding_status_enum
      and r.revoked_at is null
    where ub.user_id=p_user_id
      and ub.status='ACTIVE'::portal_private.binding_status_enum and ub.revoked_at is null
      and ub.valid_from<=p_at and (ub.valid_to is null or ub.valid_to>p_at)
      and ub.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and a.client_key=p_client_key
      and a.status='ACTIVE'::portal_private.binding_status_enum
      and a.valid_from<=p_at and (a.valid_to is null or a.valid_to>p_at)
      and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  )
$$;

create or replace function portal_private.agent_user_has_deal_view_access(
  p_user_id uuid,p_deal_key uuid,p_at timestamptz default now()
)
returns boolean language sql stable as $$
  select exists(
    select 1
    from portal_private.deals d
    join portal_private.agent_client_assignments a on a.client_key=d.client_key
    join portal_private.agent_user_bindings ub
      on ub.user_id=p_user_id and ub.agent_person_key=a.agent_person_key
    join portal_private.agent_deal_terms t
      on t.assignment_id=a.id and t.client_key=a.client_key and t.deal_key=d.id
    where d.id=p_deal_key
      and portal_private.agent_user_has_client_access(p_user_id,d.client_key,p_at)
      and t.status in ('ACTIVE'::portal_private.binding_status_enum,'SUSPENDED'::portal_private.binding_status_enum)
      and t.valid_from<=p_at and (t.valid_to is null or t.valid_to>p_at)
      and t.lifecycle_state in ('ACTIVE'::portal_private.lifecycle_state_enum,'SUSPENDED'::portal_private.lifecycle_state_enum)
  )
$$;
