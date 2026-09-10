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

\i supabase/migrations/20260910171000_owner_r1_payment_handoff_no_finance_preblock_v1.sql

insert into portal_private.deals(id,deal_id) values
 ('00000000-0000-0000-0000-000000000001','QA-NOFIN-GO'),
 ('00000000-0000-0000-0000-000000000002','QA-FIN-GO'),
 ('00000000-0000-0000-0000-000000000003','QA-HOLD');

insert into portal_private.owner_deal_workflow(deal_key,product_confirmed_at,quantity_confirmed_at) values
 ('00000000-0000-0000-0000-000000000001',now(),now()),
 ('00000000-0000-0000-0000-000000000002',now(),now()),
 ('00000000-0000-0000-0000-000000000003',now(),now());

insert into portal_private.owner_deal_finance_summary(deal_id,client_remaining_amount,currency,authority_state,lifecycle_state) values
 ('QA-FIN-GO',12500,'USD','CONFIRMED','ACTIVE');

insert into portal_private.documents(id,lifecycle_state) values
 ('10000000-0000-0000-0000-000000000001','ACTIVE'),
 ('10000000-0000-0000-0000-000000000002','ACTIVE'),
 ('20000000-0000-0000-0000-000000000001','ACTIVE'),
 ('20000000-0000-0000-0000-000000000002','ACTIVE'),
 ('30000000-0000-0000-0000-000000000001','ACTIVE');

insert into portal_private.owner_deal_documents(deal_key,document_key,document_kind) values
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM'),
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','INVOICE'),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','SIGNED_ADDENDUM'),
 ('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','INVOICE'),
 ('00000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','INVOICE');

do $$
declare
  r jsonb;
  r2 jsonb;
begin
  r := public.owner_r1_send_to_payments('QA-NOFIN-GO');
  if r->>'state' <> 'SENT' then raise exception 'NOFIN_GO_NOT_SENT: %',r; end if;
  if coalesce((r->>'financePending')::boolean,false) is not true then raise exception 'NOFIN_GO_FINANCE_PENDING_NOT_TRUE: %',r; end if;
  if r->'amount' <> 'null'::jsonb or r->'currency' <> 'null'::jsonb then raise exception 'NOFIN_GO_AMOUNT_OR_CURRENCY_FABRICATED: %',r; end if;
  if not exists(select 1 from portal_private.owner_deal_workflow where deal_key='00000000-0000-0000-0000-000000000001' and payment_handoff_state='SENT' and payment_expectation_state='NOT_CREATED' and payment_expectation_amount is null and payment_expectation_currency is null) then
    raise exception 'NOFIN_GO_WORKFLOW_NOT_SENT_CLEANLY';
  end if;
  if exists(select 1 from portal_private.owner_payment_plan where deal_key='00000000-0000-0000-0000-000000000001') then
    raise exception 'NOFIN_GO_PAYMENT_PLAN_MUST_NOT_BE_FABRICATED';
  end if;

  r2 := public.owner_r1_send_to_payments('QA-NOFIN-GO');
  if coalesce((r2->>'idempotent')::boolean,false) is not true or r2->>'state' <> 'SENT' then
    raise exception 'NOFIN_GO_REPEAT_NOT_IDEMPOTENT: %',r2;
  end if;

  r := public.owner_r1_send_to_payments('QA-FIN-GO');
  if r->>'state' <> 'SENT' or coalesce((r->>'financePending')::boolean,true) is not false then raise exception 'FIN_GO_NOT_SENT_WITH_EXISTING_FINANCE: %',r; end if;
  if not exists(select 1 from portal_private.owner_payment_plan where deal_key='00000000-0000-0000-0000-000000000002' and planned_amount=12500 and currency='USD' and status='EXPECTED') then
    raise exception 'FIN_GO_EXISTING_PLAN_BEHAVIOR_REGRESSED';
  end if;

  begin
    perform public.owner_r1_send_to_payments('QA-HOLD');
    raise exception 'MISSING_SIGNED_SHOULD_FAIL';
  exception when others then
    if sqlerrm <> 'SIGNED_ADDENDUM_REQUIRED' then raise; end if;
  end;
end $$;

select 'ADMIN_GO_PAYMENT_NO_FINANCE_HANDOFF_SQL=PASS' as result;
rollback;
