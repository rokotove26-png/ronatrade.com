-- Admin Payments V7 Stage 3A/3A.1 generic authority models.
-- Branch migration only. PRODUCTION_DDL remains HOLD.

create table if not exists portal_private.payment_business_attributions_v7 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id),
  classification text not null,
  decision_type text null check (decision_type is null or decision_type in ('BIND_TO_DEAL','ASSIGN_ADVANCE_PAYMENT')),
  authority_kind text not null,
  authority_source_ref text null,
  business_scope_refs text[] not null default '{}',
  scope_deal_keys uuid[] not null default '{}',
  principal_payment_key uuid null references portal_private.payments(id),
  materialization_status text not null,
  authority_state text not null,
  lifecycle_state text not null,
  effective_at timestamptz not null,
  -- Same-table convenience link plus generic typed cross-source supersession references.
  supersedes_id uuid null references portal_private.payment_business_attributions_v7(id),
  supersedes_authority_refs jsonb not null default '[]'::jsonb,
  source_version text null,
  source_timestamp timestamptz null,
  source_refs jsonb not null default '[]'::jsonb,
  source_locked boolean not null default false,
  actor_id uuid null,
  actor_role text null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (payment_key, idempotency_key)
);

create table if not exists portal_private.payment_business_attribution_lines_v7 (
  id uuid primary key default gen_random_uuid(),
  attribution_id uuid not null references portal_private.payment_business_attributions_v7(id),
  deal_key uuid not null references portal_private.deals(id),
  amount numeric null,
  currency char(3) null,
  amount_status text not null check (amount_status in ('EXACT','SCOPE_ONLY')),
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (attribution_id, deal_key),
  check (
    (amount_status = 'EXACT' and amount is not null and amount > 0 and currency is not null)
    or (amount_status = 'SCOPE_ONLY' and amount is null)
  )
);

create index if not exists payment_business_attributions_v7_payment_idx
  on portal_private.payment_business_attributions_v7(payment_key, lifecycle_state, effective_at);
create index if not exists payment_business_attribution_lines_v7_attr_idx
  on portal_private.payment_business_attribution_lines_v7(attribution_id, deal_key);

create table if not exists portal_private.deal_finance_authority_v7 (
  id uuid primary key default gen_random_uuid(),
  deal_key uuid not null references portal_private.deals(id),
  total_to_receive numeric null,
  due_now numeric null,
  expected_not_due numeric null,
  future_conditional numeric null,
  obligation_currency char(3) null,
  contractual_payment_currency char(3) null,
  mixed_inbound_accounting_currency char(3) null,
  finance_status text not null,
  documentary_status text not null,
  authority_state text not null,
  lifecycle_state text not null,
  effective_at timestamptz not null,
  supersedes_id uuid null references portal_private.deal_finance_authority_v7(id),
  supersedes_authority_refs jsonb not null default '[]'::jsonb,
  source_version text null,
  source_timestamp timestamptz null,
  source_refs jsonb not null default '[]'::jsonb,
  source_locked boolean not null default false,
  created_at timestamptz not null default now(),
  check ((total_to_receive is null and obligation_currency is null) or (total_to_receive is not null and obligation_currency is not null))
);

create index if not exists deal_finance_authority_v7_deal_idx
  on portal_private.deal_finance_authority_v7(deal_key, lifecycle_state, effective_at);

create or replace function portal_private.reject_v7_authority_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'V7 authority records are immutable; append a superseding record instead';
end;
$$;

drop trigger if exists payment_business_attributions_v7_immutable on portal_private.payment_business_attributions_v7;
create trigger payment_business_attributions_v7_immutable before update or delete on portal_private.payment_business_attributions_v7
for each row execute function portal_private.reject_v7_authority_mutation();

drop trigger if exists payment_business_attribution_lines_v7_immutable on portal_private.payment_business_attribution_lines_v7;
create trigger payment_business_attribution_lines_v7_immutable before update or delete on portal_private.payment_business_attribution_lines_v7
for each row execute function portal_private.reject_v7_authority_mutation();

drop trigger if exists deal_finance_authority_v7_immutable on portal_private.deal_finance_authority_v7;
create trigger deal_finance_authority_v7_immutable before update or delete on portal_private.deal_finance_authority_v7
for each row execute function portal_private.reject_v7_authority_mutation();
