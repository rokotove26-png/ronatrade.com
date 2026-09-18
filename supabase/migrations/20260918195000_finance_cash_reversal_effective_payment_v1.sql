-- Issue #629 / System Admin comment 5733149859
-- DELTA ONLY: source-locked reversal pairing and effective external-payment semantics.
-- Raw bank operations, bank amounts, balances, fingerprints, source-lock, Payment,
-- PaymentAllocation, Deal and canonical legal identities are not mutated.

begin;

create or replace function portal_private.finance_cash_reversal_purpose_key_v1(p_purpose text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select nullif(
    regexp_replace(
      regexp_replace(upper(btrim(coalesce(p_purpose,''))),'^СТОРНО[[:space:]]+','','g'),
      '[[:space:]]+',' ','g'
    ),
    ''
  );
$$;

revoke all on function portal_private.finance_cash_reversal_purpose_key_v1(text)
from public,anon,authenticated;

comment on function portal_private.finance_cash_reversal_purpose_key_v1(text) is
  'Deterministic exact-purpose key for Finance reversal matching. Removes only a leading СТОРНО marker and normalizes case/whitespace; it is not fuzzy matching.';

create or replace view portal_private.finance_cash_reversal_pairs_v1
with (security_invoker = true)
as
with reversals as (
  select
    r.*,
    portal_private.finance_cash_reversal_purpose_key_v1(r.purpose) as reversal_purpose_key,
    portal_private.finance_counterparty_normalize_name_v1(r.source_counterparty) as raw_party_key,
    coalesce(r.executed_at_local,r.operation_date::timestamp+interval '23 hours 59 minutes 59 seconds') as reversal_at
  from portal_private.finance_cash_operations_identity_v1 r
  where r.operation_type='REVERSAL'
    and r.direction='INCOMING'
    and r.source_locked=true
),
payments as (
  select
    p.*,
    portal_private.finance_cash_reversal_purpose_key_v1(p.purpose) as payment_purpose_key,
    portal_private.finance_counterparty_normalize_name_v1(p.source_counterparty) as raw_party_key,
    coalesce(p.executed_at_local,p.operation_date::timestamp+interval '23 hours 59 minutes 59 seconds') as payment_at
  from portal_private.finance_cash_operations_identity_v1 p
  where p.operation_type='EXTERNAL_PAYMENT'
    and p.direction='OUTGOING'
    and p.source_locked=true
),
candidates as (
  select
    r.operation_fingerprint as reversal_operation_fingerprint,
    r.source_ref as reversal_source_ref,
    r.bank_document_number as reversal_bank_document_number,
    r.operation_date as reversal_operation_date,
    r.reversal_at,
    r.amount::numeric(30,8) as reversal_amount,
    r.currency,
    r.bank_fee,
    r.canonical_counterparty_id,
    r.canonical_counterparty_name,
    r.source_bank_name,
    r.raw_party_key,
    r.reversal_purpose_key,
    p.operation_fingerprint as original_operation_fingerprint,
    p.source_ref as original_source_ref,
    p.bank_document_number as original_bank_document_number,
    p.operation_date as original_operation_date,
    p.payment_at,
    p.amount::numeric(30,8) as original_amount
  from reversals r
  join payments p
    on p.account_identity=r.account_identity
   and p.currency=r.currency
   and p.bank_fee is not distinct from r.bank_fee
   and r.canonical_counterparty_id is not null
   and p.canonical_counterparty_id=r.canonical_counterparty_id
   and r.raw_party_key is not null
   and p.raw_party_key=r.raw_party_key
   and p.source_bank_name is not distinct from r.source_bank_name
   and r.reversal_purpose_key is not null
   and p.payment_purpose_key=r.reversal_purpose_key
   and p.amount>=r.amount
   and p.payment_at<=r.reversal_at
),
candidate_grouped as (
  select
    c.reversal_operation_fingerprint,
    count(*)::int as candidate_count,
    (array_agg(c.original_operation_fingerprint order by c.payment_at desc,c.original_operation_fingerprint))[1] as candidate_original_operation_fingerprint,
    (array_agg(c.original_source_ref order by c.payment_at desc,c.original_operation_fingerprint))[1] as candidate_original_source_ref,
    (array_agg(c.original_bank_document_number order by c.payment_at desc,c.original_operation_fingerprint))[1] as candidate_original_bank_document_number,
    (array_agg(c.original_operation_date order by c.payment_at desc,c.original_operation_fingerprint))[1] as candidate_original_operation_date,
    (array_agg(c.original_amount order by c.payment_at desc,c.original_operation_fingerprint))[1] as candidate_original_amount
  from candidates c
  group by c.reversal_operation_fingerprint
)
select
  r.operation_fingerprint as reversal_operation_fingerprint,
  r.source_ref as reversal_source_ref,
  r.bank_document_number as reversal_bank_document_number,
  r.operation_date as reversal_operation_date,
  r.reversal_at,
  r.amount::numeric(30,8) as reversal_amount,
  r.currency,
  r.bank_fee,
  r.canonical_counterparty_id,
  r.canonical_counterparty_name,
  r.source_bank_name,
  r.source_counterparty as raw_source_counterparty,
  r.reversal_purpose_key,
  coalesce(g.candidate_count,0)::int as candidate_count,
  case when g.candidate_count=1 then g.candidate_original_operation_fingerprint end as matched_original_operation_fingerprint,
  case when g.candidate_count=1 then g.candidate_original_source_ref end as matched_original_operation_ref,
  case when g.candidate_count=1 then g.candidate_original_bank_document_number end as matched_original_bank_document_number,
  case when g.candidate_count=1 then g.candidate_original_operation_date end as matched_original_operation_date,
  case when g.candidate_count=1 then g.candidate_original_amount end as matched_original_amount,
  case
    when g.candidate_count=1 then 'MATCHED'
    when coalesce(g.candidate_count,0)=0 then 'UNMATCHED'
    else 'AMBIGUOUS'
  end as reversal_pair_status,
  jsonb_build_object(
    'method','EXACT_SOURCE_LOCKED_REVERSAL_PURPOSE_V1',
    'candidate_count',coalesce(g.candidate_count,0),
    'reversal_source_ref',r.source_ref,
    'matched_original_source_ref',case when g.candidate_count=1 then g.candidate_original_source_ref end,
    'matched_original_operation_fingerprint',case when g.candidate_count=1 then g.candidate_original_operation_fingerprint end,
    'criteria',jsonb_build_array(
      'source_locked',
      'account_identity',
      'currency',
      'principal_vs_fee',
      'stable_canonical_counterparty_id',
      'raw_source_counterparty',
      'source_bank',
      'exact_normalized_purpose_after_leading_reversal_marker',
      'original_precedes_reversal',
      'reversal_amount_not_greater_than_original'
    )
  ) as reversal_pair_evidence
from reversals r
left join candidate_grouped g
  on g.reversal_operation_fingerprint=r.operation_fingerprint;

comment on view portal_private.finance_cash_reversal_pairs_v1 is
  'Finance-owned source-locked reversal pairing. A reversal is MATCHED only when exactly one outgoing EXTERNAL_PAYMENT satisfies all deterministic account/currency/fee/entity/raw-party/bank/purpose/sequence/amount criteria. Same amount alone is never sufficient.';

revoke all on portal_private.finance_cash_reversal_pairs_v1
from public,anon,authenticated;

create or replace view portal_private.finance_cash_operations_effective_v1
with (security_invoker = true)
as
with reversed_by_original as (
  select
    p.matched_original_operation_fingerprint as original_operation_fingerprint,
    sum(p.reversal_amount)::numeric(30,8) as matched_reversed_amount,
    jsonb_agg(
      jsonb_build_object(
        'reversal_operation_fingerprint',p.reversal_operation_fingerprint,
        'reversal_source_ref',p.reversal_source_ref,
        'reversal_bank_document_number',p.reversal_bank_document_number,
        'reversal_operation_date',p.reversal_operation_date,
        'reversal_amount',p.reversal_amount
      )
      order by p.reversal_at,p.reversal_operation_fingerprint
    ) as matched_reversal_operation_refs,
    jsonb_agg(p.reversal_pair_evidence order by p.reversal_at,p.reversal_operation_fingerprint) as reversal_pair_evidence
  from portal_private.finance_cash_reversal_pairs_v1 p
  where p.reversal_pair_status='MATCHED'
  group by p.matched_original_operation_fingerprint
)
select
  o.*,
  o.operation_type as raw_operation_type,
  o.amount::numeric(30,8) as gross_amount,
  case
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      then coalesce(rb.matched_reversed_amount,0)::numeric(30,8)
    when o.operation_type='REVERSAL' and rp.reversal_pair_status='MATCHED'
      then o.amount::numeric(30,8)
    else 0::numeric(30,8)
  end as reversed_amount,
  case
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      and coalesce(rb.matched_reversed_amount,0)>o.amount then null::numeric
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      then (o.amount-coalesce(rb.matched_reversed_amount,0))::numeric(30,8)
    else 0::numeric(30,8)
  end as effective_external_payment_amount,
  case
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      and coalesce(rb.matched_reversed_amount,0)>o.amount then 'TO_VERIFY'
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      and coalesce(rb.matched_reversed_amount,0)=o.amount
      and coalesce(rb.matched_reversed_amount,0)>0 then 'REVERSED'
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      and coalesce(rb.matched_reversed_amount,0)>0 then 'PARTIALLY_REVERSED'
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING' then 'SETTLED'
    else 'NOT_APPLICABLE'
  end as effective_payment_status,
  case
    when o.operation_type='REVERSAL' then rp.matched_original_operation_fingerprint
    else null
  end as matched_original_operation_fingerprint,
  case
    when o.operation_type='REVERSAL' then rp.matched_original_operation_ref
    else null
  end as matched_original_operation_ref,
  case
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      then coalesce(rb.matched_reversal_operation_refs,'[]'::jsonb)
    else '[]'::jsonb
  end as matched_reversal_operation_refs,
  case
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      and coalesce(rb.matched_reversed_amount,0)>o.amount then 'CONFLICT'
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      and coalesce(rb.matched_reversed_amount,0)>0 then 'MATCHED'
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING' then 'NO_REVERSAL'
    when o.operation_type='REVERSAL' then coalesce(rp.reversal_pair_status,'UNMATCHED')
    else 'NOT_APPLICABLE'
  end as reversal_pair_status,
  case
    when o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      then coalesce(rb.reversal_pair_evidence,'[]'::jsonb)
    when o.operation_type='REVERSAL'
      then coalesce(jsonb_build_array(rp.reversal_pair_evidence),'[]'::jsonb)
    else '[]'::jsonb
  end as reversal_pair_evidence
from portal_private.finance_cash_operations_identity_v1 o
left join reversed_by_original rb
  on rb.original_operation_fingerprint=o.operation_fingerprint
left join portal_private.finance_cash_reversal_pairs_v1 rp
  on rp.reversal_operation_fingerprint=o.operation_fingerprint;

comment on view portal_private.finance_cash_operations_effective_v1 is
  'Finance Cash raw operations plus effective payment semantics. Raw EXTERNAL_PAYMENT and REVERSAL movements remain unchanged; only source-locked matched reversals reduce effective_external_payment_amount.';

revoke all on portal_private.finance_cash_operations_effective_v1
from public,anon,authenticated;

create or replace view portal_private.finance_cash_effective_daily_v1
with (security_invoker = true)
as
with effective_day as (
  select
    o.operation_date,
    o.currency,
    case
      when count(*) filter(
        where o.operation_type='EXTERNAL_PAYMENT'
          and o.direction='OUTGOING'
          and o.effective_external_payment_amount is null
      )>0 then null::numeric
      else coalesce(sum(o.effective_external_payment_amount) filter(
        where o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'
      ),0)::numeric(30,8)
    end as effective_external_payment,
    coalesce(sum(o.reversed_amount) filter(
      where o.operation_type='EXTERNAL_PAYMENT'
        and o.direction='OUTGOING'
        and o.effective_payment_status<>'TO_VERIFY'
    ),0)::numeric(30,8) as matched_external_payment_reversal,
    count(*) filter(
      where o.operation_type='EXTERNAL_PAYMENT'
        and o.direction='OUTGOING'
        and coalesce(o.effective_external_payment_amount,0)>0
    )::int as effective_external_payment_operation_count,
    count(*) filter(
      where o.operation_type='REVERSAL'
        and o.reversal_pair_status<>'MATCHED'
    )::int as reversal_pair_unresolved_count,
    count(*) filter(
      where o.operation_type='EXTERNAL_PAYMENT'
        and o.direction='OUTGOING'
        and o.effective_payment_status='TO_VERIFY'
    )::int as effective_payment_unresolved_count
  from portal_private.finance_cash_operations_effective_v1 o
  group by o.operation_date,o.currency
)
select
  d.*,
  coalesce(e.effective_external_payment,0)::numeric(30,8) as effective_external_payment,
  coalesce(e.matched_external_payment_reversal,0)::numeric(30,8) as matched_external_payment_reversal,
  coalesce(e.effective_external_payment_operation_count,0)::int as effective_external_payment_operation_count,
  coalesce(e.reversal_pair_unresolved_count,0)::int as reversal_pair_unresolved_count,
  coalesce(e.effective_payment_unresolved_count,0)::int as effective_payment_unresolved_count,
  sum(coalesce(e.effective_external_payment,0)) over(
    partition by d.currency order by d.operation_date rows unbounded preceding
  )::numeric(30,8) as cumulative_effective_external_payment,
  sum(coalesce(e.matched_external_payment_reversal,0)) over(
    partition by d.currency order by d.operation_date rows unbounded preceding
  )::numeric(30,8) as cumulative_matched_external_payment_reversal
from portal_private.finance_cash_daily_summary_v1 d
left join effective_day e
  on e.operation_date=d.operation_date
 and e.currency=d.currency;

comment on view portal_private.finance_cash_effective_daily_v1 is
  'Backward-compatible raw daily Cash ledger enriched with Finance-owned effective payment totals derived only from deterministic source-locked reversal pairing.';

revoke all on portal_private.finance_cash_effective_daily_v1
from public,anon,authenticated;

create or replace function portal_private.finance_cash_source_projection_payload_v1(
  p_from date default null,
  p_to date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog,portal_private
as $$
with bounds as (
  select
    coalesce(p_from,(select min(operation_date) from portal_private.finance_cash_daily_summary_v1)) as date_from,
    coalesce(p_to,(select max(operation_date) from portal_private.finance_cash_daily_summary_v1)) as date_to
),
ops_rows as (
  select o.*
  from portal_private.finance_cash_operations_effective_v1 o,bounds b
  where o.operation_date between b.date_from and b.date_to
),
ops as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'operation_date',o.operation_date,
    'executed_at_local',o.executed_at_local,
    'account_identity',o.account_identity,
    'currency',o.currency,
    'amount',o.amount,
    'direction',o.direction,
    'operation_type',o.operation_type,
    'raw_operation_type',o.raw_operation_type,
    'counterparty',o.counterparty,
    'source_counterparty',o.source_counterparty,
    'canonical_counterparty_id',o.canonical_counterparty_id,
    'canonical_counterparty_name',o.canonical_counterparty_name,
    'raw_counterparty_name',o.raw_source_counterparty,
    'counterparty_role',o.counterparty_role,
    'counterparty_resolution_status',o.counterparty_resolution_status,
    'counterparty_resolution_source',o.counterparty_resolution_source,
    'counterparty_resolution_evidence_refs',o.counterparty_resolution_evidence_refs,
    'bank_name',o.source_bank_name,
    'intermediary_name',o.intermediary_name,
    'bank_document_number',o.bank_document_number,
    'purpose',o.purpose,
    'running_balance',o.running_balance,
    'source_ref',o.source_ref,
    'source_set_identity',o.source_set_identity,
    'source_checksum_sha256',o.source_checksum_sha256,
    'finance_payment_id',o.finance_payment_id,
    'gross_amount',o.gross_amount,
    'reversed_amount',o.reversed_amount,
    'effective_external_payment_amount',o.effective_external_payment_amount,
    'effective_payment_status',o.effective_payment_status,
    'matched_original_operation_fingerprint',o.matched_original_operation_fingerprint,
    'matched_original_operation_ref',o.matched_original_operation_ref,
    'matched_reversal_operation_refs',o.matched_reversal_operation_refs,
    'reversal_pair_status',o.reversal_pair_status,
    'reversal_pair_evidence',o.reversal_pair_evidence
  ) order by o.operation_date desc,o.executed_at_local desc nulls last,o.id desc),'[]'::jsonb) as v
  from ops_rows o
),
identity_stats as (
  select jsonb_build_object(
    'operation_count',count(*),
    'resolved_count',count(*) filter(where counterparty_resolution_status='RESOLVED'),
    'transaction_only_count',count(*) filter(where counterparty_resolution_status='RESOLVED_TRANSACTION_ONLY'),
    'to_verify_count',count(*) filter(where counterparty_resolution_status='TO_VERIFY'),
    'identity_version','FINANCE_COUNTERPARTY_IDENTITY_V1'
  ) as v
  from ops_rows
),
daily_rows as (
  select d.*
  from portal_private.finance_cash_effective_daily_v1 d,bounds b
  where d.operation_date between b.date_from and b.date_to
),
days as (
  select coalesce(jsonb_agg(to_jsonb(d) order by d.operation_date asc,d.currency),'[]'::jsonb) as v
  from daily_rows d
),
period_rollup as (
  select
    currency,
    (array_agg(opening_balance order by operation_date asc))[1]::numeric(30,8) as opening_balance,
    sum(external_inflow)::numeric(30,8) as external_inflow,
    sum(external_payment)::numeric(30,8) as external_payment,
    sum(external_payment)::numeric(30,8) as gross_external_payment,
    sum(matched_external_payment_reversal)::numeric(30,8) as matched_external_payment_reversal,
    sum(effective_external_payment)::numeric(30,8) as effective_external_payment,
    sum(effective_external_payment_operation_count)::int as effective_external_payment_operation_count,
    sum(reversal_pair_unresolved_count)::int as reversal_pair_unresolved_count,
    sum(effective_payment_unresolved_count)::int as effective_payment_unresolved_count,
    sum(reversal_inflow)::numeric(30,8) as reversal_inflow,
    sum(reversal_outflow)::numeric(30,8) as reversal_outflow,
    sum(fx_inflow)::numeric(30,8) as fx_inflow,
    sum(fx_outflow)::numeric(30,8) as fx_outflow,
    sum(own_account_inflow)::numeric(30,8) as own_account_inflow,
    sum(own_account_outflow)::numeric(30,8) as own_account_outflow,
    sum(unclassified_inflow)::numeric(30,8) as unclassified_inflow,
    sum(unclassified_outflow)::numeric(30,8) as unclassified_outflow,
    sum(bank_inflow)::numeric(30,8) as bank_inflow,
    sum(bank_outflow)::numeric(30,8) as bank_outflow,
    (array_agg(closing_balance order by operation_date desc))[1]::numeric(30,8) as closing_balance,
    sum(operation_count)::int as operation_count,
    count(*)::int as calendar_day_count,
    count(*) filter(where operation_count=0)::int as zero_turnover_day_count,
    min(operation_date) as period_first_date,
    max(operation_date) as period_last_date,
    max(abs(balance_check))::numeric(30,8) as max_daily_balance_difference,
    (array_agg(cumulative_external_inflow order by operation_date desc))[1]::numeric(30,8) as cumulative_external_inflow,
    (array_agg(cumulative_external_payment order by operation_date desc))[1]::numeric(30,8) as cumulative_external_payment,
    (array_agg(cumulative_effective_external_payment order by operation_date desc))[1]::numeric(30,8) as cumulative_effective_external_payment,
    (array_agg(cumulative_matched_external_payment_reversal order by operation_date desc))[1]::numeric(30,8) as cumulative_matched_external_payment_reversal,
    (array_agg(cumulative_reversal_inflow order by operation_date desc))[1]::numeric(30,8) as cumulative_reversal_inflow,
    (array_agg(cumulative_reversal_outflow order by operation_date desc))[1]::numeric(30,8) as cumulative_reversal_outflow,
    (array_agg(cumulative_fx_inflow order by operation_date desc))[1]::numeric(30,8) as cumulative_fx_inflow,
    (array_agg(cumulative_fx_outflow order by operation_date desc))[1]::numeric(30,8) as cumulative_fx_outflow,
    (array_agg(cumulative_bank_inflow order by operation_date desc))[1]::numeric(30,8) as cumulative_bank_inflow,
    (array_agg(cumulative_bank_outflow order by operation_date desc))[1]::numeric(30,8) as cumulative_bank_outflow
  from daily_rows
  group by currency
),
periods as (
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'currency',p.currency,
      'opening_balance',p.opening_balance,
      'external_inflow',p.external_inflow,
      'external_payment',p.external_payment,
      'gross_external_payment',p.gross_external_payment,
      'matched_external_payment_reversal',p.matched_external_payment_reversal,
      'effective_external_payment',p.effective_external_payment,
      'effective_external_payment_operation_count',p.effective_external_payment_operation_count,
      'reversal_pair_unresolved_count',p.reversal_pair_unresolved_count,
      'effective_payment_unresolved_count',p.effective_payment_unresolved_count,
      'reversal_inflow',p.reversal_inflow,
      'reversal_outflow',p.reversal_outflow,
      'fx_inflow',p.fx_inflow,
      'fx_outflow',p.fx_outflow,
      'own_account_inflow',p.own_account_inflow,
      'own_account_outflow',p.own_account_outflow,
      'unclassified_inflow',p.unclassified_inflow,
      'unclassified_outflow',p.unclassified_outflow,
      'bank_inflow',p.bank_inflow,
      'bank_outflow',p.bank_outflow,
      'closing_balance',p.closing_balance,
      'balance_check',p.closing_balance-(p.opening_balance+p.bank_inflow-p.bank_outflow),
      'operation_count',p.operation_count,
      'calendar_day_count',p.calendar_day_count,
      'zero_turnover_day_count',p.zero_turnover_day_count,
      'period_first_date',p.period_first_date,
      'period_last_date',p.period_last_date,
      'max_daily_balance_difference',p.max_daily_balance_difference,
      'cumulative_external_inflow',p.cumulative_external_inflow,
      'cumulative_external_payment',p.cumulative_external_payment,
      'cumulative_effective_external_payment',p.cumulative_effective_external_payment,
      'cumulative_matched_external_payment_reversal',p.cumulative_matched_external_payment_reversal,
      'cumulative_reversal_inflow',p.cumulative_reversal_inflow,
      'cumulative_reversal_outflow',p.cumulative_reversal_outflow,
      'cumulative_fx_inflow',p.cumulative_fx_inflow,
      'cumulative_fx_outflow',p.cumulative_fx_outflow,
      'cumulative_bank_inflow',p.cumulative_bank_inflow,
      'cumulative_bank_outflow',p.cumulative_bank_outflow
    ) order by p.currency
  ),'[]'::jsonb) as v
  from period_rollup p
),
statements as (
  select coalesce(jsonb_agg(to_jsonb(s) order by s.period_end asc,s.currency,s.account_identity),'[]'::jsonb) as v
  from portal_private.finance_cash_statement_summary_v1 s,bounds b
  where s.period_end>=b.date_from and s.period_start<=b.date_to
),
checkpoints as (
  select coalesce(jsonb_agg(to_jsonb(c) order by c.checkpoint_at asc,c.currency,c.source_uid),'[]'::jsonb) as v,
         count(*)::int as total_count,
         count(*) filter(where c.checkpoint_status='PASS')::int as pass_count,
         coalesce(max(abs(c.ledger_checkpoint_difference)),0)::numeric(30,8) as max_diff
  from portal_private.finance_cash_statement_checkpoint_audit_v2 c,bounds b
  where c.period_end>=b.date_from and c.period_start<=b.date_to
),
pair_controls as (
  select
    count(*)::int as reversal_count,
    count(*) filter(where reversal_pair_status='MATCHED')::int as matched_reversal_count,
    count(*) filter(where reversal_pair_status<>'MATCHED')::int as unresolved_reversal_count
  from portal_private.finance_cash_reversal_pairs_v1
),
controls as (
  select jsonb_build_object(
    'ledger_start',(select min(operation_date) from portal_private.finance_cash_daily_summary_v1),
    'ledger_end',(select max(operation_date) from portal_private.finance_cash_daily_summary_v1),
    'calendar_rows',(select count(*) from portal_private.finance_cash_daily_summary_v1),
    'zero_turnover_rows',(select count(*) from portal_private.finance_cash_daily_summary_v1 where operation_count=0),
    'max_daily_balance_difference',(select coalesce(max(abs(balance_check)),0) from portal_private.finance_cash_daily_summary_v1),
    'statement_checkpoint_count',checkpoints.total_count,
    'statement_checkpoint_pass_count',checkpoints.pass_count,
    'max_statement_checkpoint_difference',checkpoints.max_diff,
    'source_lock',case when checkpoints.total_count=checkpoints.pass_count and checkpoints.max_diff=0 then 'PASS' else 'FAIL' end,
    'reversal_count',pair_controls.reversal_count,
    'matched_reversal_count',pair_controls.matched_reversal_count,
    'unresolved_reversal_count',pair_controls.unresolved_reversal_count
  ) as v
  from checkpoints,pair_controls
)
select jsonb_build_object(
  'modelVersion','FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE',
  'counterpartyIdentityVersion','FINANCE_COUNTERPARTY_IDENTITY_V1',
  'effectivePaymentVersion','FINANCE_EFFECTIVE_PAYMENT_V1',
  'authoritativeSource','AI-FINANCE/BANK_STATEMENT',
  'generatedAt',clock_timestamp(),
  'period',jsonb_build_object('from',b.date_from,'to',b.date_to),
  'classification',jsonb_build_object(
    'EXTERNAL_INFLOW','real external credits only',
    'EXTERNAL_PAYMENT','raw/gross external outgoing bank payments; audit movement, not effective settlement after reversal',
    'EFFECTIVE_EXTERNAL_PAYMENT','source-locked outgoing payment amount after only uniquely matched reversals are netted',
    'REVERSAL','raw bank reversal/refund retained separately for audit; never netted without source-locked pairing',
    'FX_CONVERSION','separate internal FX movement; excluded from external inflow/payment',
    'OWN_ACCOUNT_TRANSFER','separate own-account movement; excluded from external inflow/payment',
    'ZERO_TURNOVER_DAY','calendar date with no bank movement; opening and closing balance are carried forward'
  ),
  'counterpartyResolution',identity_stats.v,
  'operations',ops.v,
  'dailySummary',days.v,
  'periodSummary',periods.v,
  'statementSummaries',statements.v,
  'checkpointAudit',checkpoints.v,
  'controls',controls.v
)
from bounds b,ops,identity_stats,days,periods,statements,checkpoints,pair_controls,controls;
$$;

revoke all on function portal_private.finance_cash_source_projection_payload_v1(date,date)
from public,anon,authenticated;

comment on function portal_private.finance_cash_source_projection_payload_v1(date,date) is
  'Finance Cash projection: raw cumulative bank ledger plus canonical identity and source-locked effective external-payment semantics. modelVersion remains V2 for backward compatibility; effectivePaymentVersion=FINANCE_EFFECTIVE_PAYMENT_V1 identifies the added contract.';

commit;
