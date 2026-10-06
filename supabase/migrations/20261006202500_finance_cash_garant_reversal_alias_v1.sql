-- Finance Cash Garant reversal canonical identity completion v1
-- Owner UAT 2026-10-06.
-- DELTA ONLY: add exact incoming reversal alias to the already-approved stable entity.
-- Raw bank facts, amounts, fingerprints, source refs, Payments and UI fail-closed semantics are not mutated.

begin;

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
    raise exception 'CASH_GARANT_STABLE_ENTITY_REQUIRED';
  end if;

  if not exists (
    select 1
    from portal_private.finance_cash_operations_identity_v1 r
    where r.operation_fingerprint='58ad3ed6080c3e72ba204bdee7dfc3f8980df6d854fce82df8ed524b39daf9c2'
      and r.source_ref='MAIL_UID94:statement (1).xlsx:DOC6330709'
      and r.operation_type='REVERSAL'
      and r.direction='INCOMING'
      and btrim(r.currency)='RUB'
      and r.source_locked=true
      and r.counterparty_resolution_status='TO_VERIFY'
      and portal_private.finance_counterparty_normalize_name_v1(r.source_counterparty)='ООО ГАРАНТ'
  ) then
    raise exception 'CASH_GARANT_TARGET_REVERSAL_REQUIRED';
  end if;
end $$;

-- Fail closed unless the existing Finance reversal contract has exactly one deterministic
-- candidate original outgoing operation before identity completion.
do $$
declare
  v_candidate_count integer;
begin
  with rev as (
    select
      r.operation_fingerprint,
      r.account_identity,
      r.currency,
      r.bank_fee,
      portal_private.finance_counterparty_normalize_name_v1(r.source_counterparty) raw_party_key,
      r.source_bank_name,
      portal_private.finance_cash_reversal_purpose_key_v1(r.purpose) purpose_key,
      r.amount,
      coalesce(r.executed_at_local,r.operation_date::timestamp+interval '23 hours 59 minutes 59 seconds') reversal_at
    from portal_private.finance_cash_operations_identity_v1 r
    where r.operation_fingerprint='58ad3ed6080c3e72ba204bdee7dfc3f8980df6d854fce82df8ed524b39daf9c2'
  ),
  pay as (
    select
      p.operation_fingerprint,
      p.account_identity,
      p.currency,
      p.bank_fee,
      portal_private.finance_counterparty_normalize_name_v1(p.source_counterparty) raw_party_key,
      p.source_bank_name,
      portal_private.finance_cash_reversal_purpose_key_v1(p.purpose) purpose_key,
      p.amount,
      coalesce(p.executed_at_local,p.operation_date::timestamp+interval '23 hours 59 minutes 59 seconds') payment_at
    from portal_private.finance_cash_operations_identity_v1 p
    where p.operation_type='EXTERNAL_PAYMENT'
      and p.direction='OUTGOING'
      and p.source_locked=true
      and not p.bank_fee
      and p.canonical_counterparty_id='COUNTERPARTY:GARANT'
  )
  select count(*)::int into v_candidate_count
  from rev r
  join pay p
    on p.account_identity=r.account_identity
   and p.currency=r.currency
   and p.bank_fee is not distinct from r.bank_fee
   and p.raw_party_key=r.raw_party_key
   and p.source_bank_name is not distinct from r.source_bank_name
   and r.purpose_key is not null
   and p.purpose_key=r.purpose_key
   and p.amount>=r.amount
   and p.payment_at<=r.reversal_at;

  if v_candidate_count <> 1 then
    raise exception 'CASH_GARANT_REVERSAL_CANDIDATE_COUNT_%',v_candidate_count;
  end if;
end $$;

insert into portal_private.finance_counterparty_aliases_v1(
  alias_id,
  canonical_counterparty_id,
  alias_scope,
  raw_alias,
  normalized_alias,
  required_purpose_regex,
  direction,
  currency,
  intermediary_from_raw,
  priority,
  resolution_source,
  evidence_refs,
  source_locked,
  lifecycle_state
)
values (
  'GARANT_REVERSAL_IN_20261005',
  'COUNTERPARTY:GARANT',
  'RAW_SOURCE',
  'ООО ГАРАНТ',
  portal_private.finance_counterparty_normalize_name_v1('ООО ГАРАНТ'),
  null,
  'INCOMING',
  'RUB',
  false,
  240,
  'EXACT_SOURCE_LOCKED_REVERSAL_MATCH',
  jsonb_build_array(
    'PAYMENT:PAYEV-2026-000023',
    'BANK_SOURCE:MAIL_UID94:statement (1).xlsx:DOC6330709',
    'BANK_SOURCE:MAIL_UID94:statement (1).xlsx:DOC2502022',
    'FINANCE_RULE:EXACT_SOURCE_LOCKED_REVERSAL_PURPOSE_V1',
    'FINANCE_PROPOSAL:d12a3b93-5ae9-4782-9d98-9a7b51a8c46e',
    'OPERATIONS_APPROVAL:0ed7e766-e771-446c-9741-627f5ef529dd'
  ),
  true,
  'ACTIVE'
)
on conflict (alias_id) do nothing;

do $$
begin
  if not exists (
    select 1
    from portal_private.finance_counterparty_aliases_v1 a
    where a.alias_id='GARANT_REVERSAL_IN_20261005'
      and a.canonical_counterparty_id='COUNTERPARTY:GARANT'
      and a.alias_scope='RAW_SOURCE'
      and a.normalized_alias='ООО ГАРАНТ'
      and a.direction='INCOMING'
      and btrim(a.currency)='RUB'
      and a.resolution_source='EXACT_SOURCE_LOCKED_REVERSAL_MATCH'
      and a.lifecycle_state='ACTIVE'
      and a.source_locked=true
  ) then
    raise exception 'CASH_GARANT_REVERSAL_ALIAS_CONFLICT';
  end if;

  if not exists (
    select 1
    from portal_private.finance_cash_operations_identity_v1 r
    where r.operation_fingerprint='58ad3ed6080c3e72ba204bdee7dfc3f8980df6d854fce82df8ed524b39daf9c2'
      and r.canonical_counterparty_id='COUNTERPARTY:GARANT'
      and r.counterparty_resolution_status='RESOLVED'
  ) then
    raise exception 'CASH_GARANT_REVERSAL_IDENTITY_NOT_RESOLVED';
  end if;
end $$;

-- Existing Finance exact reversal matcher must now resolve this source-locked reversal.
do $$
begin
  if not exists (
    select 1
    from portal_private.finance_cash_reversal_pairs_v1 p
    where p.reversal_operation_fingerprint='58ad3ed6080c3e72ba204bdee7dfc3f8980df6d854fce82df8ed524b39daf9c2'
      and p.reversal_pair_status='MATCHED'
      and p.candidate_count=1
      and p.canonical_counterparty_id='COUNTERPARTY:GARANT'
  ) then
    raise exception 'CASH_GARANT_REVERSAL_PAIR_NOT_MATCHED';
  end if;
end $$;

select portal_private.refresh_finance_cash_projection_cache_v1(true);

-- Preserve the existing UI integrity contract: projection must become fully renderable
-- without weakening the fail-closed gate.
do $$
declare
  v_payload jsonb;
begin
  v_payload := portal_private.finance_cash_source_projection_payload_v2_identity(null,null);

  if coalesce((v_payload->'controls'->>'unresolved_reversal_count')::int,-1) <> 0 then
    raise exception 'CASH_PROJECTION_UNRESOLVED_REVERSALS_REMAIN';
  end if;

  if coalesce(v_payload->'controls'->>'source_lock','') <> 'PASS' then
    raise exception 'CASH_PROJECTION_SOURCE_LOCK_NOT_PASS';
  end if;

  if coalesce((v_payload->'controls'->>'max_daily_balance_difference')::numeric,1) <> 0
     or coalesce((v_payload->'controls'->>'max_statement_checkpoint_difference')::numeric,1) <> 0
  then
    raise exception 'CASH_PROJECTION_BALANCE_CONTROL_REGRESSION';
  end if;
end $$;

commit;
