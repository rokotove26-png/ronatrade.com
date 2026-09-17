begin;

create table if not exists portal_private.finance_reconciliation_difference_components_v1 (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null
    references portal_private.finance_reconciliation_difference_publications_v1(id)
    on delete restrict,
  currency text not null
    check (currency in ('USD','RUB')),
  direction text not null
    check (direction in ('PROFICIT','DEFICIT')),
  amount numeric(30,12) not null,
  source_version text not null check (btrim(source_version) <> ''),
  source_set_identity text not null check (btrim(source_set_identity) <> ''),
  source_refs jsonb not null
    check (jsonb_typeof(source_refs) = 'array' and jsonb_array_length(source_refs) > 0),
  publisher_identity text not null default 'AI-FINANCE'
    check (publisher_identity = 'AI-FINANCE'),
  functional_role text not null default 'FINANCE'
    check (functional_role = 'FINANCE'),
  source_locked boolean not null default true check (source_locked),
  recorded_by text not null default 'SYSTEM_ADMIN'
    check (btrim(recorded_by) <> ''),
  idempotency_key text not null unique check (btrim(idempotency_key) <> ''),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint finance_reconciliation_difference_component_sign_v1 check (
    (direction = 'PROFICIT' and amount > 0)
    or
    (direction = 'DEFICIT' and amount < 0)
  ),
  constraint finance_reconciliation_difference_component_currency_once_v1
    unique (publication_id, currency)
);

comment on table portal_private.finance_reconciliation_difference_components_v1 is
  'Append-only source-locked primary currency breakdown for a Finance reconciliation difference publication. Components are published Finance facts; no cross-currency calculation occurs here.';
comment on column portal_private.finance_reconciliation_difference_components_v1.recorded_by is
  'Technical recorder of the Finance-authorized component publication. Authority remains AI-FINANCE via publisher_identity/functional_role/source lock.';

create index if not exists finance_reconciliation_difference_components_v1_publication_idx
  on portal_private.finance_reconciliation_difference_components_v1
  (publication_id, published_at, created_at, id);

create or replace function portal_private.reject_finance_reconciliation_difference_component_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $$
begin
  raise exception 'FINANCE_RECONCILIATION_DIFFERENCE_COMPONENT_IMMUTABLE';
end;
$$;

revoke all on function portal_private.reject_finance_reconciliation_difference_component_mutation_v1() from public;

drop trigger if exists finance_reconciliation_difference_components_v1_immutable
  on portal_private.finance_reconciliation_difference_components_v1;
create trigger finance_reconciliation_difference_components_v1_immutable
before update or delete on portal_private.finance_reconciliation_difference_components_v1
for each row execute function portal_private.reject_finance_reconciliation_difference_component_mutation_v1();

create or replace view portal_private.finance_reconciliation_difference_components_current_v1
as
select c.*
from portal_private.finance_reconciliation_difference_components_v1 c
join portal_private.finance_reconciliation_difference_current_v1 p
  on p.id = c.publication_id
order by c.currency desc, c.published_at, c.id;

comment on view portal_private.finance_reconciliation_difference_components_current_v1 is
  'Source-locked USD/RUB primary breakdown linked to the current Finance reconciliation difference publication.';

revoke all on table portal_private.finance_reconciliation_difference_components_v1
  from public, anon, authenticated;
revoke all on portal_private.finance_reconciliation_difference_components_current_v1
  from public, anon, authenticated;

commit;
