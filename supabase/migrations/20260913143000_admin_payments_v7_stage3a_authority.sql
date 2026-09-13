-- Admin Payments V7 Stage 3C generic authority persistence.
-- Branch migration only. PRODUCTION_DDL remains HOLD.
-- This migration is intentionally designed for a fresh application; it has not been applied in production.

create schema if not exists portal_private;
create extension if not exists pgcrypto;

create or replace function portal_private.admin_payments_v7_valid_currency(value text)
returns boolean
language sql
immutable
as $$
  select value is not null and btrim(value) ~ '^[A-Z]{3}$';
$$;

-- Payment attribution is a sealed aggregate: header + complete line snapshot are committed in one row.
-- The compatibility child relation below is a read-only view over that immutable snapshot.
create table portal_private.payment_business_attributions_v7 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id),
  classification text not null,
  attribution_mode text not null check (attribution_mode in ('EXACT','SCOPE_ONLY','NO_DEAL_BINDING')),
  decision_type text null check (decision_type is null or decision_type in ('BIND_TO_DEAL','ASSIGN_ADVANCE_PAYMENT')),
  authority_kind text not null,
  authority_source_ref text null,
  business_scope_refs text[] not null default '{}',
  scope_deal_keys uuid[] not null default '{}',
  lines_snapshot jsonb not null default '[]'::jsonb check (jsonb_typeof(lines_snapshot) = 'array'),
  principal_payment_key uuid null references portal_private.payments(id),
  materialization_status text not null default 'NOT_MATERIALIZED',
  authority_state text not null default 'AUTHORITATIVE',
  lifecycle_state text not null default 'CURRENT',
  effective_at timestamptz not null,
  supersedes_id uuid null references portal_private.payment_business_attributions_v7(id),
  supersedes_authority_refs jsonb not null default '[]'::jsonb,
  source_version text null,
  source_timestamp timestamptz null,
  source_refs jsonb not null default '[]'::jsonb,
  source_locked boolean not null default true check (source_locked),
  actor_id uuid null,
  actor_role text null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (payment_key, idempotency_key),
  check (
    (attribution_mode = 'EXACT' and jsonb_array_length(lines_snapshot) > 0 and cardinality(scope_deal_keys) > 0)
    or (attribution_mode = 'SCOPE_ONLY' and jsonb_array_length(lines_snapshot) = 0 and cardinality(scope_deal_keys) > 0)
    or (attribution_mode = 'NO_DEAL_BINDING' and jsonb_array_length(lines_snapshot) = 0 and cardinality(scope_deal_keys) = 0)
  )
);

create index payment_business_attributions_v7_payment_idx
  on portal_private.payment_business_attributions_v7(payment_key, lifecycle_state, effective_at);

create or replace function portal_private.validate_payment_business_attribution_v7()
returns trigger
language plpgsql
as $$
declare
  payment_amount numeric;
  payment_currency text;
  scope_count integer;
  scope_distinct integer;
  existing_scope_count integer;
  line_count integer;
  line_distinct integer;
  existing_line_count integer;
  line_sum numeric;
begin
  select p.amount::numeric, upper(btrim(p.currency::text))
    into payment_amount, payment_currency
  from portal_private.payments p
  where p.id = new.payment_key;

  if not found then
    raise exception 'PAYMENT_AUTHORITY_PAYMENT_NOT_FOUND';
  end if;
  if payment_amount is null or payment_amount <= 0 then
    raise exception 'PAYMENT_AUTHORITY_PAYMENT_AMOUNT_INVALID';
  end if;
  if not portal_private.admin_payments_v7_valid_currency(payment_currency) then
    raise exception 'PAYMENT_AUTHORITY_PAYMENT_CURRENCY_INVALID';
  end if;

  select count(*), count(distinct scope.deal_key)
    into scope_count, scope_distinct
  from unnest(new.scope_deal_keys) as scope(deal_key);

  if scope_count <> scope_distinct then
    raise exception 'PAYMENT_AUTHORITY_DUPLICATE_SCOPE_DEAL';
  end if;

  select count(*) into existing_scope_count
  from portal_private.deals d
  where d.id = any(new.scope_deal_keys);

  if existing_scope_count <> scope_count then
    raise exception 'PAYMENT_AUTHORITY_SCOPE_DEAL_INVALID';
  end if;

  if new.attribution_mode = 'EXACT' then
    if exists (
      select 1
      from jsonb_array_elements(new.lines_snapshot) item
      where jsonb_typeof(item) <> 'object'
         or item->>'deal_key' is null
         or item->>'amount' is null
         or item->>'currency' is null
         or coalesce(item->>'amount_status','EXACT') <> 'EXACT'
         or (item->>'amount')::numeric <= 0
         or not portal_private.admin_payments_v7_valid_currency(upper(btrim(item->>'currency')))
         or upper(btrim(item->>'currency')) <> payment_currency
    ) then
      raise exception 'PAYMENT_AUTHORITY_EXACT_LINE_INVALID';
    end if;

    select count(*),
           count(distinct (item->>'deal_key')::uuid),
           coalesce(sum((item->>'amount')::numeric),0)
      into line_count, line_distinct, line_sum
    from jsonb_array_elements(new.lines_snapshot) item;

    if line_count = 0 or line_count <> line_distinct then
      raise exception 'PAYMENT_AUTHORITY_DUPLICATE_EXACT_DEAL';
    end if;

    select count(*) into existing_line_count
    from portal_private.deals d
    where d.id in (
      select distinct (item->>'deal_key')::uuid
      from jsonb_array_elements(new.lines_snapshot) item
    );

    if existing_line_count <> line_distinct then
      raise exception 'PAYMENT_AUTHORITY_EXACT_DEAL_INVALID';
    end if;

    if line_sum <> payment_amount then
      raise exception 'PAYMENT_AUTHORITY_EXACT_COVERAGE_MISMATCH';
    end if;

    if scope_count <> line_distinct
       or exists (
         select 1 from unnest(new.scope_deal_keys) as scope(deal_key)
         where not exists (
           select 1 from jsonb_array_elements(new.lines_snapshot) item
           where (item->>'deal_key')::uuid = scope.deal_key
         )
       )
       or exists (
         select 1 from jsonb_array_elements(new.lines_snapshot) item
         where not ((item->>'deal_key')::uuid = any(new.scope_deal_keys))
       ) then
      raise exception 'PAYMENT_AUTHORITY_SCOPE_LINES_MISMATCH';
    end if;

  elsif new.attribution_mode = 'SCOPE_ONLY' then
    if jsonb_array_length(new.lines_snapshot) <> 0 or scope_count = 0 then
      raise exception 'PAYMENT_AUTHORITY_SCOPE_ONLY_INVALID';
    end if;

  elsif new.attribution_mode = 'NO_DEAL_BINDING' then
    if jsonb_array_length(new.lines_snapshot) <> 0 or scope_count <> 0 then
      raise exception 'PAYMENT_AUTHORITY_NO_DEAL_BINDING_INVALID';
    end if;
  else
    raise exception 'PAYMENT_AUTHORITY_MODE_INVALID';
  end if;

  return new;
end;
$$;

create trigger payment_business_attributions_v7_validate
before insert on portal_private.payment_business_attributions_v7
for each row execute function portal_private.validate_payment_business_attribution_v7();

create view portal_private.payment_business_attribution_lines_v7 as
select
  (a.id::text || ':' || line.ordinality::text) as id,
  a.id as attribution_id,
  (line.item->>'deal_key')::uuid as deal_key,
  (line.item->>'amount')::numeric as amount,
  upper(btrim(line.item->>'currency'))::char(3) as currency,
  'EXACT'::text as amount_status,
  coalesce(line.item->'source_refs', a.source_refs, '[]'::jsonb) as source_refs,
  a.created_at
from portal_private.payment_business_attributions_v7 a
cross join lateral jsonb_array_elements(a.lines_snapshot) with ordinality as line(item, ordinality)
where a.attribution_mode = 'EXACT';

create or replace function portal_private.reject_v7_authority_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'V7 authority records are immutable; append a superseding authority instead';
end;
$$;

create trigger payment_business_attributions_v7_immutable
before update or delete on portal_private.payment_business_attributions_v7
for each row execute function portal_private.reject_v7_authority_mutation();

create trigger payment_business_attribution_lines_v7_read_only
instead of insert or update or delete on portal_private.payment_business_attribution_lines_v7
for each row execute function portal_private.reject_v7_authority_mutation();

-- Finance authority is a complete normalized record. DB integrity and runtime integrity both fail closed.
create table portal_private.deal_finance_authority_v7 (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id),
  total_to_receive numeric(24,8) not null,
  due_now numeric(24,8) not null,
  expected_not_due numeric(24,8) not null,
  future_conditional numeric(24,8) not null,
  obligation_currency char(3) not null,
  contractual_payment_currency char(3) null,
  mixed_inbound_accounting_currency char(3) null,
  finance_status text not null,
  documentary_status text not null,
  authority_state text not null default 'AUTHORITATIVE',
  lifecycle_state text not null default 'CURRENT',
  effective_at timestamptz not null,
  supersedes_id uuid null references portal_private.deal_finance_authority_v7(id),
  supersedes_authority_refs jsonb not null default '[]'::jsonb,
  source_version text null,
  source_timestamp timestamptz null,
  source_refs jsonb not null default '[]'::jsonb,
  source_locked boolean not null default true check (source_locked),
  created_at timestamptz not null default now(),
  check (total_to_receive >= 0),
  check (due_now >= 0),
  check (expected_not_due >= 0),
  check (future_conditional >= 0),
  check (due_now <= total_to_receive),
  check (expected_not_due <= total_to_receive),
  check (future_conditional <= total_to_receive),
  check (due_now + expected_not_due + future_conditional <= total_to_receive),
  check (portal_private.admin_payments_v7_valid_currency(obligation_currency::text)),
  check (contractual_payment_currency is null or portal_private.admin_payments_v7_valid_currency(contractual_payment_currency::text)),
  check (mixed_inbound_accounting_currency is null or portal_private.admin_payments_v7_valid_currency(mixed_inbound_accounting_currency::text))
);

create index deal_finance_authority_v7_deal_idx
  on portal_private.deal_finance_authority_v7(deal_key, lifecycle_state, effective_at);

create trigger deal_finance_authority_v7_immutable
before update or delete on portal_private.deal_finance_authority_v7
for each row execute function portal_private.reject_v7_authority_mutation();
