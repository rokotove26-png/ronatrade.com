\set ON_ERROR_STOP on

create schema portal_private;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'rona_payments_v7_reader') then
    create role rona_payments_v7_reader nologin;
  end if;
end;
$$;

create type portal_private.ai_business_role_enum as enum ('FINANCE', 'OPERATIONS_DIRECTOR');

create table portal_private.ai_coordination_records (
  record_id uuid primary key,
  record_type text not null,
  functional_role portal_private.ai_business_role_enum not null,
  identity_id text,
  tool_name text,
  target_type text not null,
  target_id text not null,
  target_role portal_private.ai_business_role_enum,
  version integer not null default 1,
  supersedes_id uuid,
  source_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null,
  qa_only boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

create table portal_private.deals (
  id uuid primary key,
  deal_id text not null,
  lifecycle_state text not null
);

create table portal_private.payments (
  id uuid primary key,
  payment_id text not null,
  amount numeric not null,
  currency text not null,
  lifecycle_state text not null,
  authority_state text not null,
  bank_fact_status text not null,
  finance_verification_status text not null
);

create table portal_private.payment_business_attributions_v7 (
  id uuid primary key,
  payment_key uuid not null,
  lifecycle_state text not null,
  authority_state text not null,
  source_locked boolean not null,
  attribution_mode text not null,
  authority_kind text not null
);

create table portal_private.payment_business_attribution_lines_v7 (
  id uuid primary key,
  attribution_id uuid not null,
  deal_key uuid not null,
  amount numeric not null,
  currency text not null,
  amount_status text not null
);

create table portal_private.finance_events_v7 (
  id uuid primary key,
  payment_key uuid not null,
  actor_role text not null,
  event_type text not null,
  request_snapshot jsonb not null,
  result_snapshot jsonb not null
);

insert into portal_private.deals (id, deal_id, lifecycle_state) values
  ('10000000-0000-4000-8000-000000000001', 'DEAL-GENERIC-ALPHA', 'ACTIVE');

insert into portal_private.payments (
  id, payment_id, amount, currency, lifecycle_state, authority_state, bank_fact_status, finance_verification_status
) values
  ('20000000-0000-4000-8000-000000000001', 'PAYMENT-GENERIC-RUB', 9840.25, 'RUB', 'ACTIVE', 'CONFIRMED', 'BANK_CONFIRMED', 'VERIFIED'),
  ('20000000-0000-4000-8000-000000000002', 'PAYMENT-GENERIC-KZT', 4200, 'KZT', 'ACTIVE', 'CONFIRMED', 'BANK_CONFIRMED', 'VERIFIED'),
  ('20000000-0000-4000-8000-000000000003', 'FUNDING-GENERIC-RUB', 123.45, 'USD', 'ACTIVE', 'CONFIRMED', 'BANK_CONFIRMED', 'VERIFIED'),
  ('20000000-0000-4000-8000-000000000004', 'FUNDING-GENERIC-KZT', 8.40, 'USD', 'ACTIVE', 'CONFIRMED', 'BANK_CONFIRMED', 'VERIFIED');

insert into portal_private.payment_business_attributions_v7 (
  id, payment_key, lifecycle_state, authority_state, source_locked, attribution_mode, authority_kind
) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'CURRENT', 'AUTHORITATIVE', true, 'EXACT', 'FINANCE_AI'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'CURRENT', 'AUTHORITATIVE', true, 'EXACT', 'FINANCE_AI');

insert into portal_private.payment_business_attribution_lines_v7 (
  id, attribution_id, deal_key, amount, currency, amount_status
) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 9840.25, 'RUB', 'EXACT'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 4200, 'KZT', 'EXACT');

insert into portal_private.finance_events_v7 (
  id, payment_key, actor_role, event_type, request_snapshot, result_snapshot
) values
  (
    '50000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003',
    'FINANCE',
    'OUTGOING_PAYMENT_CONFIRMED',
    '{"payload":{"funding_leg_kind":"FUNDING_SIDE_DEBIT","currency":"USD","acquired_currency":"RUB"}}'::jsonb,
    '{"accepted":true}'::jsonb
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000004',
    'FINANCE',
    'OUTGOING_PAYMENT_CONFIRMED',
    '{"payload":{"funding_leg_kind":"FUNDING_SIDE_DEBIT","currency":"USD","acquired_currency":"KZT"}}'::jsonb,
    '{"accepted":true}'::jsonb
  );

insert into portal_private.ai_coordination_records (
  record_id, record_type, functional_role, identity_id, tool_name, target_type, target_id, version,
  source_refs, evidence_refs, payload, status, qa_only, created_at
) values
  (
    '60000000-0000-4000-8000-000000000001',
    'FUNCTIONAL_CONCLUSION', 'FINANCE', 'AI-FINANCE', 'functional_conclusion_submit',
    'DEAL', 'DEAL-GENERIC-ALPHA', 28,
    '[]'::jsonb, '[]'::jsonb, '{"confirmed":true}'::jsonb, 'APPROVED', false,
    '2032-05-08T10:00:00Z'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'BUSINESS_CHANGE_PROPOSAL', 'FINANCE', 'AI-FINANCE', 'business_change_proposal_submit',
    'TASK', 'TASK-GENERIC-ALLOCATION', 1,
    '[]'::jsonb, '["60000000-0000-4000-8000-000000000001"]'::jsonb,
    '{
      "proposed_action":"MATERIALIZE_TO_PAYMENTS_PROJECTION",
      "proposed_field":"payment_passport.calculated_funding_allocations",
      "proposed_value":{
        "allocations":{"PAYMENT-GENERIC-RUB":123.45,"PAYMENT-GENERIC-KZT":8.40},
        "actual_rates":{"RUB_per_USD":79.71000405,"KZT_per_USD":500},
        "authority_status":"CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS",
        "funding_currency":"USD",
        "conversion_events":{"RUB":"FUNDING-GENERIC-RUB","KZT":"FUNDING-GENERIC-KZT"},
        "calculation_method":"ACTUAL_SETTLEMENT_DIV_ACTUAL_BANK_FX",
        "finance_conclusion_id":"60000000-0000-4000-8000-000000000001"
      }
    }'::jsonb,
    'PROPOSED', false, '2032-05-08T10:01:00Z'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    'OPERATIONS_INTERNAL_DECISION', 'OPERATIONS_DIRECTOR', 'AI-OPERATIONS', 'internal_decision_submit',
    'TASK', 'TASK-GENERIC-ALLOCATION', 1,
    '[]'::jsonb, '[]'::jsonb,
    '{"action":"APPROVE_FOR_NEXT_STAGE","record_id":"60000000-0000-4000-8000-000000000002"}'::jsonb,
    'APPROVE_FOR_NEXT_STAGE', false, '2032-05-08T10:02:00Z'
  );

\ir ../../supabase/migrations/20260916010000_admin_payments_v7_finance_settlement_allocation.sql

do $$
declare
  replay jsonb;
begin
  if (select count(*) from portal_private.payment_passport_finance_allocations_v7) <> 2 then
    raise exception 'MATERIALIZATION_ROW_COUNT_INVALID';
  end if;

  if not exists (
    select 1 from portal_private.payment_passport_finance_allocations_current_v7
    where payment_id = 'PAYMENT-GENERIC-RUB'
      and calculated_funding_amount = 123.45
      and funding_currency = 'USD'
      and funding_allocation_status = 'AUTHORITATIVE'
      and authority_status = 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS'
      and calculation_method = 'ACTUAL_SETTLEMENT_DIV_ACTUAL_BANK_FX'
      and conversion_event_id = 'FUNDING-GENERIC-RUB'
      and actual_conversion_rate = 79.71000405
      and source_version = 'FINANCE_CONCLUSION_V28'
  ) then
    raise exception 'RUB_ALLOCATION_NOT_MATERIALIZED';
  end if;

  if not exists (
    select 1 from portal_private.payment_passport_finance_allocations_current_v7
    where payment_id = 'PAYMENT-GENERIC-KZT'
      and calculated_funding_amount = 8.40
      and funding_currency = 'USD'
      and conversion_event_id = 'FUNDING-GENERIC-KZT'
      and actual_conversion_rate = 500
  ) then
    raise exception 'KZT_ALLOCATION_NOT_MATERIALIZED';
  end if;

  if (select amount from portal_private.payments where payment_id = 'PAYMENT-GENERIC-RUB') <> 9840.25
     or (select amount from portal_private.payments where payment_id = 'PAYMENT-GENERIC-KZT') <> 4200 then
    raise exception 'ACTUAL_SETTLEMENT_MUTATED';
  end if;

  if (select count(*) from portal_private.ai_coordination_records) <> 3 then
    raise exception 'FINANCE_COORDINATION_RECORDS_MUTATED';
  end if;

  replay := portal_private.materialize_payment_passport_finance_allocations_v7('60000000-0000-4000-8000-000000000002');
  if replay->>'inserted' <> '0' or (select count(*) from portal_private.payment_passport_finance_allocations_v7) <> 2 then
    raise exception 'MATERIALIZATION_NOT_IDEMPOTENT';
  end if;
end;
$$;

set role rona_payments_v7_reader;
select count(*) from portal_private.payment_passport_finance_allocations_current_v7;
reset role;

select 'MATERIALIZATION=PASS';
select 'PASSPORT_MIDDLE_COLUMN_FILLED=PASS';
select 'ACTUAL_SETTLEMENT_COLUMN_PRESERVED=PASS';
select 'FINANCE_RECORDS_UNCHANGED=PASS';
select 'BANK_FACTS_UNCHANGED=PASS';
