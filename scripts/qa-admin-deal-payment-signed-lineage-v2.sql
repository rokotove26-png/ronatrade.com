\set ON_ERROR_STOP on
begin;

create schema portal_private;
create type portal_private.lifecycle_state_enum as enum ('ACTIVE','SUPERSEDED','ARCHIVED');

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

create function portal_private.owner_r1_actor(text) returns uuid
language sql stable as $$ select '00000000-0000-0000-0000-000000000099'::uuid $$;

\i supabase/migrations/20260910153000_owner_r1_payment_signed_addendum_lineage_v1.sql

insert into portal_private.deals(id,deal_id) values
 ('00000000-0000-0000-0000-000000000001','QA-GO'),
 ('00000000-0000-0000-0000-000000000002','QA-HOLD'),
 ('00000000-0000-0000-0000-000000000003','QA-NOFIN');
insert into portal_private.owner_deal_workflow(deal_key,product_confirmed_at,quantity_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001',now(),now()),
 ('00000000-0000-0000-0000-000000000002',now(),now()),
 ('00000000-0000-0000-0000-000000000003',now(),now());
insert into portal_private.owner_deal_finance_summary(deal_id,client_remaining_amount,currency,authority_state,lifecycle_state) values
 ('QA-GO',12500,'USD','CONFIRMED','ACTIVE'),
 ('QA-HOLD',12500,'USD','CONFIRMED','ACTIVE'),
 ('QA-NOFIN',12500,'USD','PENDING','ACTIVE');

insert into portal_private.documents(id,lifecycle_state) values
 ('10000000-0000-0000-0000-000000000001','SUPERSEDED'),
 ('10000000-0000-0000-0000-000000000002','ACTIVE'),
 ('10000000-0000-0000-0000-000000000003','ACTIVE'),
 ('20000000-0000-0000-0000-000000000001','ACTIVE'),
 ('20000000-0000-0000-0000-000000000002','ACTIVE'),
 ('30000000-0000-0000-0000-000000000001','ACTIVE'),
 ('30000000-0000-0000-0000-000000000002','ACTIVE');

-- GO: original ADDENDUM is superseded; authoritative returned SIGNED_ADDENDUM is active.
insert into portal_private.owner_deal_documents(deal_key,document_key,document_kind) values
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','ADDENDUM'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','SIGNED_ADDENDUM'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','INVOICE'),
 -- HOLD: active ADDENDUM + INVOICE, but no signed successor.
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','ADDENDUM'),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','INVOICE'),
 -- NOFIN: valid signed lineage + invoice but finance remains unconfirmed.
 ('00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM'),
 ('00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','INVOICE');

do $$
declare
  r jsonb;
begin
  r := public.owner_r1_send_to_payments('QA-GO');
  if r->>'state' <> 'SENT' then raise exception 'GO_SIGNED_SUCCESSOR_NOT_SENT: %',r; end if;
  if not exists(select 1 from portal_private.owner_payment_plan where deal_key='00000000-0000-0000-0000-000000000001' and planned_amount=12500 and status='EXPECTED') then
    raise exception 'PAYMENTS_PLAN_NOT_MATERIALIZED';
  end if;

  begin
    perform public.owner_r1_send_to_payments('QA-HOLD');
    raise exception 'MISSING_SIGNED_SHOULD_FAIL';
  exception when others then
    if sqlerrm <> 'SIGNED_ADDENDUM_REQUIRED' then raise; end if;
  end;

  begin
    perform public.owner_r1_send_to_payments('QA-NOFIN');
    raise exception 'UNCONFIRMED_FINANCE_SHOULD_FAIL';
  exception when others then
    if sqlerrm <> 'PAYMENT_OBLIGATION_NOT_CONFIRMED' then raise; end if;
  end;
end $$;

select 'ADMIN_DEAL_PAYMENT_SIGNED_LINEAGE_SQL=PASS' as result;
rollback;
