-- FINAL OWNER DELTA — factual USD execution evidence for Admin -> Payments.
-- Finance/Treasury evidence only. No synthetic/current/CBR/market FX is permitted here.
-- No Deal lifecycle or upstream handoff state is changed.

create table if not exists portal_private.finance_deal_execution_usd_links_v5 (
  id uuid primary key default gen_random_uuid(),
  deal_id text not null check (btrim(deal_id)<>''),
  usd_source_payment_id text not null check (btrim(usd_source_payment_id)<>''),
  execution_payment_id text null,
  usd_amount numeric not null check (usd_amount>0),
  native_amount numeric null check (native_amount is null or native_amount>0),
  native_currency char(3) null check (native_currency is null or native_currency ~ '^[A-Z]{3}$'),
  execution_state text not null check (execution_state in ('COMPLETED','CONVERTED_EXECUTION_PENDING')),
  obligation_reference text null,
  bank_source_reference text not null check (btrim(bank_source_reference)<>''),
  treasury_source_reference text null,
  source_system text not null default 'FINANCE_TREASURY_EXECUTION_SOURCE_LOCK'
    check (source_system='FINANCE_TREASURY_EXECUTION_SOURCE_LOCK'),
  source_version text not null check (btrim(source_version)<>''),
  source_timestamp timestamptz not null,
  authority_state text not null default 'CONFIRMED' check (authority_state='CONFIRMED'),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state='ACTIVE'),
  supersedes_link_id uuid null references portal_private.finance_deal_execution_usd_links_v5(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (execution_state='COMPLETED'
      and execution_payment_id is not null and btrim(execution_payment_id)<>''
      and native_amount is not null and native_currency is not null)
    or
    (execution_state='CONVERTED_EXECUTION_PENDING'
      and execution_payment_id is null
      and obligation_reference is not null and btrim(obligation_reference)<>'')
  )
);

create index if not exists finance_deal_execution_usd_links_v5_deal_idx
  on portal_private.finance_deal_execution_usd_links_v5(deal_id,execution_state,source_timestamp);
create index if not exists finance_deal_execution_usd_links_v5_source_idx
  on portal_private.finance_deal_execution_usd_links_v5(usd_source_payment_id,source_timestamp);
create index if not exists finance_deal_execution_usd_links_v5_execution_idx
  on portal_private.finance_deal_execution_usd_links_v5(execution_payment_id)
  where execution_payment_id is not null;

revoke all on table portal_private.finance_deal_execution_usd_links_v5 from public,anon,authenticated,service_role;
grant select on table portal_private.finance_deal_execution_usd_links_v5 to service_role;

create or replace function portal_private.finance_deal_execution_usd_links_v5_immutable()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
begin
  raise exception using errcode='42501',message='FINANCE_FACTUAL_USD_EXECUTION_LINK_IMMUTABLE';
end
$$;
revoke all on function portal_private.finance_deal_execution_usd_links_v5_immutable() from public,anon,authenticated,service_role;

drop trigger if exists trg_finance_deal_execution_usd_links_v5_immutable
  on portal_private.finance_deal_execution_usd_links_v5;
create trigger trg_finance_deal_execution_usd_links_v5_immutable
before update or delete on portal_private.finance_deal_execution_usd_links_v5
for each row execute function portal_private.finance_deal_execution_usd_links_v5_immutable();

comment on table portal_private.finance_deal_execution_usd_links_v5 is
'Immutable Finance/Treasury factual USD resource-consumption evidence for Owner Payments. Native-currency legs remain evidence detail. COMPLETED means exact USD source is tied to an executed Deal obligation; CONVERTED_EXECUTION_PENDING is excluded from completed actual spend.';
