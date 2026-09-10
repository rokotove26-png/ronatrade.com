\set ON_ERROR_STOP on

create schema if not exists portal_private;
do $$ begin
  create type portal_private.lifecycle_state_enum as enum ('ACTIVE','SUPERSEDED','ARCHIVED');
exception when duplicate_object then null;
end $$;

create table portal_private.deals(
  id uuid primary key,
  deal_id text not null unique
);
create table portal_private.owner_deal_workflow(
  deal_key uuid primary key references portal_private.deals(id),
  product_confirmed_at timestamptz,
  quantity_confirmed_at timestamptz,
  cancellation_state text default 'ACTIVE',
  payment_handoff_state text default 'NOT_SENT',
  payment_expectation_state text default 'NOT_CREATED',
  payment_handoff_at timestamptz,
  payment_handoff_by uuid,
  payment_expectation_amount numeric,
  payment_expectation_currency text,
  updated_at timestamptz default now()
);
create table portal_private.owner_deal_finance_summary(
  deal_id text primary key,
  client_remaining_amount numeric,
  currency text,
  authority_state text,
  lifecycle_state text
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
  deal_key uuid not null references portal_private.deals(id),
  tranche_no integer not null,
  share_text text,
  planned_amount numeric,
  currency text,
  status text,
  source_system text,
  updated_at timestamptz default now(),
  primary key(deal_key,tranche_no)
);

-- Authentication is deliberately outside the payment-handoff scope. This identity
-- fixture satisfies the existing actor dependency but does not replace or mock the
-- candidate owner_r1_send_to_payments function under test.
create function portal_private.owner_r1_actor(text) returns uuid
language sql stable as $$ select '00000000-0000-0000-0000-000000000099'::uuid $$;

-- Apply the exact PR candidate function.
\i supabase/migrations/20260910171000_owner_r1_payment_handoff_no_finance_preblock_v1.sql

insert into portal_private.deals(id,deal_id) values
 ('00000000-0000-0000-0000-000000000001','QA-NOFIN-GO'),
 ('00000000-0000-0000-0000-000000000002','QA-FIN-GO'),
 ('00000000-0000-0000-0000-000000000003','QA-HOLD'),
 ('00000000-0000-0000-0000-000000000004','QA-MISSING-DOC');

insert into portal_private.owner_deal_workflow(deal_key,product_confirmed_at,quantity_confirmed_at,cancellation_state) values
 ('00000000-0000-0000-0000-000000000001',now(),now(),'ACTIVE'),
 ('00000000-0000-0000-0000-000000000002',now(),now(),'ACTIVE'),
 ('00000000-0000-0000-0000-000000000003',null,now(),'ACTIVE'),
 ('00000000-0000-0000-0000-000000000004',now(),now(),'ACTIVE');

insert into portal_private.owner_deal_finance_summary(deal_id,client_remaining_amount,currency,authority_state,lifecycle_state) values
 ('QA-FIN-GO',12500,'USD','CONFIRMED','ACTIVE');

insert into portal_private.documents(id,lifecycle_state) values
 ('10000000-0000-0000-0000-000000000001','ACTIVE'),
 ('10000000-0000-0000-0000-000000000002','ACTIVE'),
 ('20000000-0000-0000-0000-000000000001','ACTIVE'),
 ('20000000-0000-0000-0000-000000000002','ACTIVE'),
 ('30000000-0000-0000-0000-000000000001','ACTIVE'),
 ('30000000-0000-0000-0000-000000000002','ACTIVE'),
 ('40000000-0000-0000-0000-000000000001','ACTIVE');

insert into portal_private.owner_deal_documents(deal_key,document_key,document_kind) values
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','INVOICE'),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM'),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','INVOICE'),
 ('00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM'),
 ('00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','INVOICE'),
 ('00000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM');

notify pgrst, 'reload schema';
select 'ADMIN_GO_PAYMENT_NO_FINANCE_EPHEMERAL_SETUP=PASS' as result;
