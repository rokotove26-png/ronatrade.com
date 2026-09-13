-- Admin Payments V7 Stage 3D.1 provider readiness gate.
-- Branch migration only. Production DDL/DML/deploy remain HOLD.
-- This migration runs after Stage 3D and does not modify upstream payment lifecycle/status enums.

create table if not exists portal_private.admin_payments_v7_provider_readiness (
  provider_key text primary key,
  is_ready boolean not null default false,
  ready_at timestamptz,
  validation_ref text,
  updated_at timestamptz not null default now(),
  constraint admin_payments_v7_provider_readiness_key_ck
    check (provider_key = upper(btrim(provider_key)) and btrim(provider_key) <> ''),
  constraint admin_payments_v7_provider_readiness_ready_ck
    check (
      (is_ready = false and ready_at is null)
      or
      (is_ready = true and ready_at is not null and validation_ref is not null and btrim(validation_ref) <> '')
    )
);

comment on table portal_private.admin_payments_v7_provider_readiness is
  'Infrastructure activation/readiness state for optional Admin Payments V7 providers. This is not a Deal or Payment lifecycle state.';
comment on column portal_private.admin_payments_v7_provider_readiness.provider_key is
  'Generic provider identifier. Runtime logic must not encode Deal IDs or Payment IDs here.';
comment on column portal_private.admin_payments_v7_provider_readiness.is_ready is
  'May become true only after controlled initial provider bootstrap/materialization validation.';

-- Application-facing roles do not receive readiness mutation rights.
revoke all on table portal_private.admin_payments_v7_provider_readiness
  from public, anon, authenticated, service_role;

-- The sealed V7 snapshot reader can observe readiness but cannot mutate it.
grant select on table portal_private.admin_payments_v7_provider_readiness
  to rona_payments_v7_reader;
revoke insert, update, delete, truncate, references, trigger
  on table portal_private.admin_payments_v7_provider_readiness
  from rona_payments_v7_reader;
