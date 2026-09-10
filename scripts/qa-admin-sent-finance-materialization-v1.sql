\set ON_ERROR_STOP on

create schema if not exists portal_private;
do $$ begin create type portal_private.lifecycle_state_enum as enum ('DRAFT','ACTIVE','SUSPENDED','CLOSED','ARCHIVED','SUPERSEDED'); exception when duplicate_object then null; end $$;
do $$ begin create type portal_private.payment_bank_state_enum as enum ('RECEIVED_UNVERIFIED','BANK_CONFIRMED','REVERSED','REJECTED'); exception when duplicate_object then null; end $$;
do $$ begin create type portal_private.payment_allocation_state_enum as enum ('UNALLOCATED','PARTIAL','ALLOCATED','VERIFIED','REVERSED'); exception when duplicate_object then null; end $$;

create table portal_private.clients(
  id uuid primary key,
  client_id text not null,
  legal_name text not null
);
create table portal_private.deals(
  id uuid primary key,
  deal_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);
create table portal_private.client_applications(
  id uuid primary key,
  application_id text not null unique,
  client_key uuid not null references portal_private.clients(id),
  quantity_tonnes numeric not null,
  proposed_price numeric,
  proposed_currency char(3),
  payment_terms text not null,
  status text not null,
  linked_deal_key uuid
);
create table portal_private.deal_registrations(
  application_key uuid not null references portal_private.client_applications(id),
  deal_key uuid not null references portal_private.deals(id),
  registered_at timestamptz not null
);
create table portal_private.owner_application_workflow(
  application_key uuid primary key references portal_private.client_applications(id),
  business_status text not null,
  counter_price numeric,
  counter_currency char(3),
  counter_offer_used boolean not null default false,
  client_counter_response text,
  finalized_at timestamptz
);
create table portal_private.owner_deal_workflow(
  deal_key uuid primary key references portal_private.deals(id),
  product_confirmed_at timestamptz,
  quantity_tonnes_value numeric,
  quantity_confirmed_at timestamptz,
  cancellation_state text default 'ACTIVE',
  payment_handoff_state text default 'NOT_SENT',
  payment_expectation_state text default 'NOT_CREATED',
  payment_handoff_at timestamptz,
  payment_handoff_by uuid,
  payment_expectation_amount numeric,
  payment_expectation_currency char(3),
  updated_at timestamptz default now()
);
create table portal_private.owner_deal_finance_summary(
  id uuid primary key default gen_random_uuid(),
  deal_id text not null unique,
  client_id text,
  client_name text,
  obligation_amount numeric,
  received_amount numeric not null default 0,
  currency char(3) not null,
  client_remaining_amount numeric,
  finance_status text not null,
  accounting_status text not null,
  cash_residual_amount numeric,
  cash_residual_currency char(3),
  cash_residual_status text not null,
  cash_residual_note text,
  source_document text not null,
  source_version text not null,
  source_timestamp timestamptz,
  authority_state text not null default 'CONFIRMED',
  lifecycle_state text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table portal_private.documents(
  id uuid primary key,
  lifecycle_state portal_private.lifecycle_state_enum not null
);
create table portal_private.owner_deal_documents(
  deal_key uuid not null references portal_private.deals(id),
  document_key uuid not null references portal_private.documents(id),
  document_kind text not null
);
create table portal_private.owner_payment_plan(
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id),
  tranche_no integer not null,
  share_text text,
  planned_amount numeric not null,
  currency char(3) not null,
  due_at timestamptz,
  status text not null default 'EXPECTED',
  source_system text not null default 'FINANCE_CONTOUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(deal_key,tranche_no)
);
create table portal_private.payments(
  id uuid primary key,
  bank_fact_status portal_private.payment_bank_state_enum not null,
  currency char(3) not null,
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);
create table portal_private.payment_allocations(
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id),
  deal_key uuid references portal_private.deals(id),
  allocated_amount numeric not null,
  allocation_status portal_private.payment_allocation_state_enum not null,
  lifecycle_state portal_private.lifecycle_state_enum not null default 'ACTIVE'
);

-- Authentication itself is outside this focused handoff proof. The actual owner-api route,
-- PostgREST RPC and candidate owner_r1_send_to_payments function are not mocked.
create function portal_private.owner_r1_actor(text) returns uuid
language sql stable as $$ select '00000000-0000-0000-0000-000000000099'::uuid $$;

-- Exact released payment-handoff baseline before PR #453 correction.
\i supabase/migrations/20260910171000_owner_r1_payment_handoff_no_finance_preblock_v1.sql

insert into portal_private.clients(id,client_id,legal_name) values
 ('10000000-0000-0000-0000-000000000001','QA-C001','QA Client 1'),
 ('10000000-0000-0000-0000-000000000002','QA-C002','QA Client 2'),
 ('10000000-0000-0000-0000-000000000003','QA-C003','QA Client 3'),
 ('10000000-0000-0000-0000-000000000004','QA-C004','QA Client 4'),
 ('10000000-0000-0000-0000-000000000005','QA-C005','QA Client 5'),
 ('10000000-0000-0000-0000-000000000006','QA-C006','QA Client 6'),
 ('10000000-0000-0000-0000-000000000007','QA-C007','QA Client 7'),
 ('10000000-0000-0000-0000-000000000008','QA-C008','QA Client 8');

insert into portal_private.deals(id,deal_id,client_key) values
 ('20000000-0000-0000-0000-000000000001','QA-ACCEPTED-COUNTER-GO','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','QA-ALREADY-SENT','10000000-0000-0000-0000-000000000002'),
 ('20000000-0000-0000-0000-000000000003','QA-EXISTING-FINANCE','10000000-0000-0000-0000-000000000003'),
 ('20000000-0000-0000-0000-000000000004','QA-HOLD','10000000-0000-0000-0000-000000000004'),
 ('20000000-0000-0000-0000-000000000005','QA-MISSING-DOC','10000000-0000-0000-0000-000000000005'),
 ('20000000-0000-0000-0000-000000000006','QA-BANK-FACT','10000000-0000-0000-0000-000000000006'),
 ('20000000-0000-0000-0000-000000000007','QA-CONFIRMED-QTY-WINS','10000000-0000-0000-0000-000000000007'),
 ('20000000-0000-0000-0000-000000000008','QA-INVALID-ECONOMICS','10000000-0000-0000-0000-000000000008');

insert into portal_private.client_applications(id,application_id,client_key,quantity_tonnes,proposed_price,proposed_currency,payment_terms,status,linked_deal_key) values
 ('30000000-0000-0000-0000-000000000001','QA-APP-001','10000000-0000-0000-0000-000000000001',490,743,'USD','Оплата: 30% предварительный депозит; 70% — против ГУ-12 или СМГС по фактическому весу железнодорожных вагонов','DEAL_REGISTERED','20000000-0000-0000-0000-000000000001'),
 ('30000000-0000-0000-0000-000000000002','QA-APP-002','10000000-0000-0000-0000-000000000002',10,100,'USD','30% contractual tranche; 70% after readiness gates','DEAL_REGISTERED','20000000-0000-0000-0000-000000000002'),
 ('30000000-0000-0000-0000-000000000003','QA-APP-003','10000000-0000-0000-0000-000000000003',100,125,'USD','100% before shipment','DEAL_REGISTERED','20000000-0000-0000-0000-000000000003'),
 ('30000000-0000-0000-0000-000000000004','QA-APP-004','10000000-0000-0000-0000-000000000004',10,100,'USD','100% prepayment','DEAL_REGISTERED','20000000-0000-0000-0000-000000000004'),
 ('30000000-0000-0000-0000-000000000005','QA-APP-005','10000000-0000-0000-0000-000000000005',10,100,'USD','100% prepayment','DEAL_REGISTERED','20000000-0000-0000-0000-000000000005'),
 ('30000000-0000-0000-0000-000000000006','QA-APP-006','10000000-0000-0000-0000-000000000006',10,100,'USD','100% prepayment','DEAL_REGISTERED','20000000-0000-0000-0000-000000000006'),
 ('30000000-0000-0000-0000-000000000007','QA-APP-007','10000000-0000-0000-0000-000000000007',500,740,'USD','100% prepayment','DEAL_REGISTERED','20000000-0000-0000-0000-000000000007'),
 ('30000000-0000-0000-0000-000000000008','QA-APP-008','10000000-0000-0000-0000-000000000008',10,100,'USD','100% prepayment','DEAL_REGISTERED','20000000-0000-0000-0000-000000000008');

insert into portal_private.deal_registrations(application_key,deal_key,registered_at)
select ca.id,ca.linked_deal_key,'2026-09-10T10:00:00Z'::timestamptz from portal_private.client_applications ca;

insert into portal_private.owner_application_workflow(application_key,business_status,counter_price,counter_currency,counter_offer_used,client_counter_response,finalized_at) values
 ('30000000-0000-0000-0000-000000000001','DEAL',740,'USD',true,'ACCEPTED','2026-09-10T10:05:00Z'),
 ('30000000-0000-0000-0000-000000000002','DEAL',null,null,false,null,'2026-09-10T10:05:00Z'),
 ('30000000-0000-0000-0000-000000000003','DEAL',null,null,false,null,'2026-09-10T10:05:00Z'),
 ('30000000-0000-0000-0000-000000000004','DEAL',null,null,false,null,'2026-09-10T10:05:00Z'),
 ('30000000-0000-0000-0000-000000000005','DEAL',null,null,false,null,'2026-09-10T10:05:00Z'),
 ('30000000-0000-0000-0000-000000000006','DEAL',null,null,false,null,'2026-09-10T10:05:00Z'),
 ('30000000-0000-0000-0000-000000000007','DEAL',null,null,false,null,'2026-09-10T10:05:00Z'),
 ('30000000-0000-0000-0000-000000000008','DEAL',99,'USD',true,'DECLINED','2026-09-10T10:05:00Z');

insert into portal_private.owner_deal_workflow(deal_key,product_confirmed_at,quantity_tonnes_value,quantity_confirmed_at,cancellation_state,payment_handoff_state,payment_handoff_at) values
 ('20000000-0000-0000-0000-000000000001',now(),490,now(),'ACTIVE','NOT_SENT',null),
 ('20000000-0000-0000-0000-000000000002',now(),10,now(),'ACTIVE','SENT','2026-09-10T10:10:00Z'),
 ('20000000-0000-0000-0000-000000000003',now(),100,now(),'ACTIVE','NOT_SENT',null),
 ('20000000-0000-0000-0000-000000000004',now(),10,now(),'FINANCIAL_HOLD','NOT_SENT',null),
 ('20000000-0000-0000-0000-000000000005',now(),10,now(),'ACTIVE','NOT_SENT',null),
 ('20000000-0000-0000-0000-000000000006',now(),10,now(),'ACTIVE','NOT_SENT',null),
 ('20000000-0000-0000-0000-000000000007',now(),490,now(),'ACTIVE','NOT_SENT',null),
 ('20000000-0000-0000-0000-000000000008',now(),10,now(),'ACTIVE','NOT_SENT',null);

insert into portal_private.owner_deal_finance_summary(deal_id,client_id,client_name,obligation_amount,received_amount,currency,client_remaining_amount,finance_status,accounting_status,cash_residual_status,source_document,source_version,authority_state,lifecycle_state)
values('QA-EXISTING-FINANCE','QA-C003','QA Client 3',12500,2500,'USD',10000,'PARTIALLY_PAID','OPEN','NOT_APPLICABLE','QA-FINANCE-CANONICAL','v1','CONFIRMED','ACTIVE');

-- Canonical pre-existing plan must remain byte-for-byte semantically unchanged by send.
insert into portal_private.owner_payment_plan(deal_key,tranche_no,share_text,planned_amount,currency,status,source_system)
values('20000000-0000-0000-0000-000000000003',1,'Existing canonical finance plan',10000,'USD','EXPECTED','FINANCE_CONTOUR');

insert into portal_private.payments(id,bank_fact_status,currency) values
 ('40000000-0000-0000-0000-000000000006','BANK_CONFIRMED','USD');
insert into portal_private.payment_allocations(payment_key,deal_key,allocated_amount,allocation_status)
values('40000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000006',300,'VERIFIED');

insert into portal_private.documents(id,lifecycle_state)
select ('50000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::portal_private.lifecycle_state_enum
from generate_series(1,15) n;

insert into portal_private.owner_deal_documents(deal_key,document_key,document_kind) values
 ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','INVOICE'),
 ('20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000003','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000004','INVOICE'),
 ('20000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000005','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000006','INVOICE'),
 ('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000007','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000004','50000000-0000-0000-0000-000000000008','INVOICE'),
 ('20000000-0000-0000-0000-000000000005','50000000-0000-0000-0000-000000000009','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000010','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000006','50000000-0000-0000-0000-000000000011','INVOICE'),
 ('20000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000012','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000007','50000000-0000-0000-0000-000000000013','INVOICE'),
 ('20000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000014','SIGNED_ADDENDUM'),
 ('20000000-0000-0000-0000-000000000008','50000000-0000-0000-0000-000000000015','INVOICE');

-- Apply the exact corrective materialization migration after an already-SENT/missing-finance fixture exists.
\i supabase/migrations/20260910213000_owner_r1_payment_finance_materialization_v1.sql

notify pgrst, 'reload schema';
select 'ADMIN_SENT_FINANCE_MATERIALIZATION_EPHEMERAL_SETUP=PASS' as result;
