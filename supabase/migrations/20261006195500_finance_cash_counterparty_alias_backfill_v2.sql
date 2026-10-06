-- Finance Cash canonical counterparty alias backfill v2
-- Owner instruction 2026-10-06.
-- DELTA ONLY: identity registry + controlled aliases + projection cache refresh.
-- Financial amounts, raw/source-locked bank rows, fingerprints, reversals and Payments are immutable.

begin;

-- Fail closed: existing Universal entity authority must be current and source-locked.
do $$
begin
  if not exists (
    select 1
    from portal_private.finance_counterparty_identities_v1 i
    where i.canonical_counterparty_id='CLIENT:RONA-C003'
      and i.lifecycle_state='ACTIVE'
      and i.source_locked=true
  ) then
    raise exception 'CASH_IDENTITY_REQUIRED_CLIENT_RONA_C003';
  end if;

  if (
    select count(*)
    from portal_private.payments p
    where p.payment_id in ('PAYEV-2026-000020','PAYEV-2026-000021','PAYEV-2026-000022')
      and p.counterparty_name='UNVERSAL SOLYARIS GRAND LLC'
      and p.counterparty_role='CLIENT'
      and p.payment_direction::text='INCOMING'
      and p.payment_kind::text='CLIENT_PAYMENT'
      and p.authority_state::text='CONFIRMED'
      and p.lifecycle_state::text='ACTIVE'
      and p.bank_fact_status::text='BANK_CONFIRMED'
      and p.finance_verification_status::text='VERIFIED'
  ) <> 3 then
    raise exception 'CASH_IDENTITY_UNIVERSAL_VERIFIED_PAYMENTS_REQUIRED';
  end if;

  if not exists (
    select 1
    from portal_private.deals d
    join portal_private.clients c on c.id=d.client_key
    where d.deal_id='DEAL-2026-005' and c.client_id='RONA-C003'
  ) or not exists (
    select 1
    from portal_private.deals d
    join portal_private.clients c on c.id=d.client_key
    where d.deal_id='DEAL-2026-006' and c.client_id='RONA-C003'
  ) then
    raise exception 'CASH_IDENTITY_UNIVERSAL_DEAL_CLIENT_BINDING_REQUIRED';
  end if;

  if not exists (
    select 1
    from portal_private.payments p
    where p.payment_id='PAYEV-2026-000023'
      and p.counterparty_name='ООО ГАРАНТ'
      and p.counterparty_role='COUNTERPARTY'
      and p.payment_direction::text='OUTGOING'
      and p.payment_kind::text='COUNTERPARTY_PAYMENT'
      and p.authority_state::text='CONFIRMED'
      and p.lifecycle_state::text='ACTIVE'
      and p.bank_fact_status::text='BANK_CONFIRMED'
      and p.finance_verification_status::text='VERIFIED'
  ) then
    raise exception 'CASH_IDENTITY_GARANT_VERIFIED_PAYMENT_REQUIRED';
  end if;
end $$;

-- No confirmed alias may already point to another stable entity.
do $$
begin
  if exists (
    select 1
    from portal_private.finance_counterparty_aliases_v1 a
    where a.lifecycle_state='ACTIVE'
      and a.source_locked=true
      and a.normalized_alias in ('UNVERSAL SOLYARIS GRAND LLC','ООО ГАРАНТ')
      and a.canonical_counterparty_id not in ('CLIENT:RONA-C003','COUNTERPARTY:GARANT')
  ) then
    raise exception 'CASH_IDENTITY_ALIAS_CONFLICT';
  end if;
end $$;

-- Create the stable Finance counterparty entity from an already verified Payment.
insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,
  canonical_counterparty_name,
  counterparty_role,
  identity_authority_type,
  identity_authority_ref,
  evidence_refs,
  source_locked,
  lifecycle_state
)
select
  'COUNTERPARTY:GARANT',
  p.counterparty_name,
  p.counterparty_role,
  'VERIFIED_PAYMENT',
  p.payment_id,
  jsonb_build_array(
    'PAYMENT:'||p.payment_id,
    'OWNER_INSTRUCTION:2026-10-06:CASH_COUNTERPARTY_CANONICALIZATION',
    'FINANCE_PROPOSAL:23711a56-4eea-45e8-9d73-d568ff62dd85',
    'OPERATIONS_APPROVAL:13fd6e54-806d-4396-9ee3-41ecaf7e339f'
  ),
  true,
  'ACTIVE'
from portal_private.payments p
where p.payment_id='PAYEV-2026-000023'
  and p.authority_state::text='CONFIRMED'
  and p.lifecycle_state::text='ACTIVE'
  and p.bank_fact_status::text='BANK_CONFIRMED'
  and p.finance_verification_status::text='VERIFIED'
on conflict (canonical_counterparty_id) do nothing;

do $$
begin
  if not exists (
    select 1
    from portal_private.finance_counterparty_identities_v1 i
    where i.canonical_counterparty_id='COUNTERPARTY:GARANT'
      and i.canonical_counterparty_name='ООО ГАРАНТ'
      and i.identity_authority_ref='PAYEV-2026-000023'
      and i.lifecycle_state='ACTIVE'
      and i.source_locked=true
  ) then
    raise exception 'CASH_IDENTITY_GARANT_STABLE_ENTITY_CONFLICT';
  end if;
end $$;

-- Controlled aliases. Exact normalized string only; no fuzzy matching.
insert into portal_private.finance_counterparty_aliases_v1(
  alias_id,canonical_counterparty_id,alias_scope,raw_alias,normalized_alias,
  required_purpose_regex,direction,currency,intermediary_from_raw,priority,
  resolution_source,evidence_refs,source_locked,lifecycle_state
)
values
(
  'UNIVERSAL_RAW_LLC_20260925',
  'CLIENT:RONA-C003',
  'RAW_SOURCE',
  'UNVERSAL SOLYARIS GRAND LLC',
  portal_private.finance_counterparty_normalize_name_v1('UNVERSAL SOLYARIS GRAND LLC'),
  null,'INCOMING','USD',false,230,
  'CANONICAL_CLIENT+VERIFIED_BANK_PAYMENTS',
  jsonb_build_array(
    'CLIENT:RONA-C003',
    'DEAL:DEAL-2026-005',
    'DEAL:DEAL-2026-006',
    'PAYMENT:PAYEV-2026-000020',
    'PAYMENT:PAYEV-2026-000021',
    'PAYMENT:PAYEV-2026-000022',
    'FINANCE_PROPOSAL:fa7c87db-4f4d-4736-82b2-5e44d9b8faf8',
    'OPERATIONS_APPROVAL:4463f88c-bfaf-47db-b211-3539b4c59764'
  ),
  true,'ACTIVE'
),
(
  'UNIVERSAL_PAY_LLC_20260925',
  'CLIENT:RONA-C003',
  'PAYMENT_COUNTERPARTY',
  'UNVERSAL SOLYARIS GRAND LLC',
  portal_private.finance_counterparty_normalize_name_v1('UNVERSAL SOLYARIS GRAND LLC'),
  null,'INCOMING','USD',false,330,
  'CANONICAL_CLIENT+VERIFIED_BANK_PAYMENTS',
  jsonb_build_array(
    'CLIENT:RONA-C003',
    'PAYMENT:PAYEV-2026-000020',
    'PAYMENT:PAYEV-2026-000021',
    'PAYMENT:PAYEV-2026-000022',
    'FINANCE_PROPOSAL:fa7c87db-4f4d-4736-82b2-5e44d9b8faf8',
    'OPERATIONS_APPROVAL:4463f88c-bfaf-47db-b211-3539b4c59764'
  ),
  true,'ACTIVE'
),
(
  'GARANT_RAW_20260925',
  'COUNTERPARTY:GARANT',
  'RAW_SOURCE',
  'ООО ГАРАНТ',
  portal_private.finance_counterparty_normalize_name_v1('ООО ГАРАНТ'),
  null,'OUTGOING','RUB',false,230,
  'VERIFIED_PAYMENT_CONTROLLED_ALIAS',
  jsonb_build_array(
    'PAYMENT:PAYEV-2026-000023',
    'FINANCE_PROPOSAL:23711a56-4eea-45e8-9d73-d568ff62dd85',
    'OPERATIONS_APPROVAL:13fd6e54-806d-4396-9ee3-41ecaf7e339f'
  ),
  true,'ACTIVE'
),
(
  'GARANT_PAY_20260925',
  'COUNTERPARTY:GARANT',
  'PAYMENT_COUNTERPARTY',
  'ООО ГАРАНТ',
  portal_private.finance_counterparty_normalize_name_v1('ООО ГАРАНТ'),
  null,'OUTGOING','RUB',false,330,
  'EXACT_VERIFIED_PAYMENT',
  jsonb_build_array(
    'PAYMENT:PAYEV-2026-000023',
    'FINANCE_PROPOSAL:23711a56-4eea-45e8-9d73-d568ff62dd85',
    'OPERATIONS_APPROVAL:13fd6e54-806d-4396-9ee3-41ecaf7e339f'
  ),
  true,'ACTIVE'
)
on conflict (alias_id) do nothing;

-- Backfill is resolution-only: the immutable raw cash table is not updated.
-- Existing historical/current cash rows resolve dynamically through the identity view.
do $$
begin
  if exists (
    select 1
    from portal_private.finance_cash_operations_identity_v1 o
    where not o.bank_fee
      and o.operation_type='EXTERNAL_INFLOW'
      and o.direction='INCOMING'
      and btrim(o.currency)='USD'
      and portal_private.finance_counterparty_normalize_name_v1(o.source_counterparty)='UNVERSAL SOLYARIS GRAND LLC'
      and (
        o.canonical_counterparty_id is distinct from 'CLIENT:RONA-C003'
        or o.counterparty_resolution_status<>'RESOLVED'
      )
  ) then
    raise exception 'CASH_IDENTITY_UNIVERSAL_BACKFILL_INCOMPLETE';
  end if;

  if exists (
    select 1
    from portal_private.finance_cash_operations_identity_v1 o
    where not o.bank_fee
      and o.operation_type='EXTERNAL_PAYMENT'
      and o.direction='OUTGOING'
      and btrim(o.currency)='RUB'
      and portal_private.finance_counterparty_normalize_name_v1(o.source_counterparty)='ООО ГАРАНТ'
      and (
        o.canonical_counterparty_id is distinct from 'COUNTERPARTY:GARANT'
        or o.counterparty_resolution_status<>'RESOLVED'
      )
  ) then
    raise exception 'CASH_IDENTITY_GARANT_BACKFILL_INCOMPLETE';
  end if;

  -- Bank fees with the same raw business party must retain the bank canonical identity.
  if exists (
    select 1
    from portal_private.finance_cash_operations_identity_v1 o
    where o.bank_fee
      and portal_private.finance_counterparty_normalize_name_v1(o.source_counterparty)='ООО ГАРАНТ'
      and o.canonical_counterparty_id is distinct from 'BANK:BAKAI'
  ) then
    raise exception 'CASH_IDENTITY_BANK_FEE_PRECEDENCE_REGRESSION';
  end if;

  -- Stable IDs only. PAYMENT:* is never a canonical counterparty identity.
  if exists (
    select 1
    from portal_private.finance_cash_operations_identity_v1 o
    where o.canonical_counterparty_id like 'PAYMENT:%'
       or (
         o.canonical_counterparty_id is not null
         and o.canonical_counterparty_id !~ '^(CLIENT|SUPPLIER|COUNTERPARTY|BANK):'
       )
  ) then
    raise exception 'CASH_IDENTITY_UNSTABLE_CANONICAL_ID';
  end if;
end $$;

-- Refresh cache so historical period selection sees the new canonical identities immediately.
select portal_private.refresh_finance_cash_projection_cache_v1(true);

-- Cache must carry the same stable identity resolution after refresh.
do $$
begin
  if exists (
    select 1
    from portal_private.finance_cash_operations_effective_cache_v1 o
    where o.raw_operation_type='EXTERNAL_INFLOW'
      and o.direction='INCOMING'
      and btrim(o.currency)='USD'
      and portal_private.finance_counterparty_normalize_name_v1(o.raw_source_counterparty)='UNVERSAL SOLYARIS GRAND LLC'
      and o.canonical_counterparty_id is distinct from 'CLIENT:RONA-C003'
  ) then
    raise exception 'CASH_IDENTITY_UNIVERSAL_CACHE_BACKFILL_INCOMPLETE';
  end if;

  if exists (
    select 1
    from portal_private.finance_cash_operations_effective_cache_v1 o
    where not o.bank_fee
      and o.raw_operation_type='EXTERNAL_PAYMENT'
      and o.direction='OUTGOING'
      and btrim(o.currency)='RUB'
      and portal_private.finance_counterparty_normalize_name_v1(o.raw_source_counterparty)='ООО ГАРАНТ'
      and o.canonical_counterparty_id is distinct from 'COUNTERPARTY:GARANT'
  ) then
    raise exception 'CASH_IDENTITY_GARANT_CACHE_BACKFILL_INCOMPLETE';
  end if;
end $$;

commit;
