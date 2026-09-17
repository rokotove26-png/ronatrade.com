begin;

create table if not exists portal_private.finance_reconciliation_difference_publications_v1 (
  id uuid primary key default gen_random_uuid(),
  result_status text not null check (result_status in ('AUTHORITATIVE','TO_VERIFY')),
  amount numeric(30,12),
  currency text,
  snapshot_at timestamptz not null,
  source_version text not null check (btrim(source_version) <> ''),
  source_set_identity text not null check (btrim(source_set_identity) <> ''),
  source_refs jsonb not null check (jsonb_typeof(source_refs) = 'array' and jsonb_array_length(source_refs) > 0),
  publisher_identity text not null default 'AI-FINANCE' check (publisher_identity = 'AI-FINANCE'),
  functional_role text not null default 'FINANCE' check (functional_role = 'FINANCE'),
  source_locked boolean not null default true check (source_locked),
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint finance_reconciliation_difference_publication_shape_v1 check (
    (
      result_status = 'AUTHORITATIVE'
      and amount is not null
      and currency is not null
      and currency = upper(currency)
      and currency ~ '^[A-Z]{3}$'
    )
    or
    (
      result_status = 'TO_VERIFY'
      and amount is null
      and currency is null
    )
  )
);

comment on table portal_private.finance_reconciliation_difference_publications_v1 is
  'Append-only Finance-owned publication channel for the already calculated reconciliation difference. This table stores Finance output only; it does not calculate the metric.';
comment on column portal_private.finance_reconciliation_difference_publications_v1.amount is
  'Exact value published by Finance. No calculation or fallback is permitted in the Payments reader.';
comment on column portal_private.finance_reconciliation_difference_publications_v1.source_set_identity is
  'Finance-provided identity of the exact source set used for the published result.';

create index if not exists finance_reconciliation_difference_publications_v1_latest_idx
  on portal_private.finance_reconciliation_difference_publications_v1 (published_at desc, created_at desc, id desc);

create or replace function portal_private.reject_finance_reconciliation_difference_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $$
begin
  raise exception 'FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_IMMUTABLE';
end;
$$;

revoke all on function portal_private.reject_finance_reconciliation_difference_mutation_v1() from public;

drop trigger if exists finance_reconciliation_difference_publications_v1_immutable
  on portal_private.finance_reconciliation_difference_publications_v1;
create trigger finance_reconciliation_difference_publications_v1_immutable
before update or delete on portal_private.finance_reconciliation_difference_publications_v1
for each row execute function portal_private.reject_finance_reconciliation_difference_mutation_v1();

create or replace view portal_private.finance_reconciliation_difference_current_v1
as
select
  id,
  result_status,
  amount,
  currency,
  snapshot_at,
  source_version,
  source_set_identity,
  source_refs,
  publisher_identity,
  functional_role,
  source_locked,
  idempotency_key,
  published_at,
  created_at
from portal_private.finance_reconciliation_difference_publications_v1
order by published_at desc, created_at desc, id desc
limit 1;

comment on view portal_private.finance_reconciliation_difference_current_v1 is
  'Current Finance-published reconciliation difference. Latest publication wins; TO_VERIFY explicitly invalidates display without local recalculation.';

revoke all on table portal_private.finance_reconciliation_difference_publications_v1 from public, anon, authenticated;
revoke all on portal_private.finance_reconciliation_difference_current_v1 from public, anon, authenticated;

commit;
