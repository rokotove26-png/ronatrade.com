-- FINAL OWNER DELTA V6 — generic accounting-currency execution evidence.
-- Additive to V5: historical USD evidence is preserved and not rewritten.
-- Cross-currency execution may enter Owner deal spend only from exact Finance/Treasury source-lock.
-- No synthetic/current/CBR/market FX. No Deal lifecycle or PAYMENT mutation.

create table if not exists portal_private.finance_deal_execution_accounting_currency_links_v6 (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null check (btrim(deal_id)<>''),
  conversion_source_payment_id text null,
  execution_payment_id text null,
  accounting_currency char(3) not null check (accounting_currency ~ '^[A-Z]{3}$'),
  accounting_amount numeric not null check (accounting_amount>0),
  execution_native_amount numeric null check (execution_native_amount is null or execution_native_amount>0),
  execution_native_currency char(3) null check (execution_native_currency is null or execution_native_currency ~ '^[A-Z]{3}$'),
  execution_state text not null check (execution_state in ('COMPLETED','CONVERTED_EXECUTION_PENDING')),
  obligation_reference text null,
  bank_source_reference text not null check (btrim(bank_source_reference)<>''),
  treasury_source_reference text null,
  source_system text not null default 'FINANCE_TREASURY_ACCOUNTING_CURRENCY_SOURCE_LOCK'
    check (source_system='FINANCE_TREASURY_ACCOUNTING_CURRENCY_SOURCE_LOCK'),
  source_version text not null check (btrim(source_version)<>''),
  source_timestamp timestamptz not null,
  authority_state text not null default 'CONFIRMED' check (authority_state='CONFIRMED'),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state='ACTIVE'),
  supersedes_link_id uuid null references portal_private.finance_deal_execution_accounting_currency_links_v6(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (execution_state='COMPLETED'
      and execution_payment_id is not null and btrim(execution_payment_id)<>''
      and execution_native_amount is not null and execution_native_currency is not null)
    or
    (execution_state='CONVERTED_EXECUTION_PENDING'
      and execution_payment_id is null
      and (
        (obligation_reference is not null and btrim(obligation_reference)<>'')
        or (treasury_source_reference is not null and btrim(treasury_source_reference)<>'')
      ))
  )
);

create index if not exists finance_deal_execution_accounting_currency_links_v6_deal_idx
  on portal_private.finance_deal_execution_accounting_currency_links_v6(deal_id,accounting_currency,execution_state,source_timestamp);
create index if not exists finance_deal_execution_accounting_currency_links_v6_execution_idx
  on portal_private.finance_deal_execution_accounting_currency_links_v6(execution_payment_id)
  where execution_payment_id is not null;
create index if not exists finance_deal_execution_accounting_currency_links_v6_conversion_idx
  on portal_private.finance_deal_execution_accounting_currency_links_v6(conversion_source_payment_id)
  where conversion_source_payment_id is not null;

revoke all on table portal_private.finance_deal_execution_accounting_currency_links_v6 from public,anon,authenticated,service_role;
grant select on table portal_private.finance_deal_execution_accounting_currency_links_v6 to service_role;

create or replace function portal_private.finance_deal_execution_accounting_currency_links_v6_immutable()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
begin
  raise exception using errcode='42501',message='FINANCE_ACCOUNTING_CURRENCY_EXECUTION_LINK_IMMUTABLE';
end
$$;
revoke all on function portal_private.finance_deal_execution_accounting_currency_links_v6_immutable() from public,anon,authenticated,service_role;

drop trigger if exists trg_finance_deal_execution_accounting_currency_links_v6_immutable
  on portal_private.finance_deal_execution_accounting_currency_links_v6;
create trigger trg_finance_deal_execution_accounting_currency_links_v6_immutable
before update or delete on portal_private.finance_deal_execution_accounting_currency_links_v6
for each row execute function portal_private.finance_deal_execution_accounting_currency_links_v6_immutable();

comment on table portal_private.finance_deal_execution_accounting_currency_links_v6 is
'Immutable generic Finance/Treasury evidence linking an executed obligation to exact resource consumption in the Deal accounting currency. COMPLETED requires the exact executed native bank leg. CONVERTED_EXECUTION_PENDING remains separate from completed actual spend. This V6 table is additive; V5 factual USD evidence remains historical provenance.';
