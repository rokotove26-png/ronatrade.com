begin;

alter table portal_private.finance_cash_operations_v1
  drop constraint if exists finance_cash_operations_v1_operation_type_check;
alter table portal_private.finance_cash_operations_v1
  add constraint finance_cash_operations_v1_operation_type_check
  check (operation_type in (
    'EXTERNAL_INFLOW',
    'EXTERNAL_PAYMENT',
    'FX_CONVERSION',
    'OWN_ACCOUNT_TRANSFER',
    'REVERSAL',
    'UNCLASSIFIED'
  ));

create or replace function portal_private.finance_cash_classify_bank_operation_v1(
  p_direction text,
  p_purpose text,
  p_counterparty text
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select case
    when upper(btrim(coalesce(p_purpose,''))) ~ '^СТОРНО([[:space:]]|$)'
      then 'REVERSAL'
    when upper(coalesce(p_purpose,'') || ' ' || coalesce(p_counterparty,'')) ~
      '(КОНВЕРТ|FX[[:space:]_-]*CONVERSION|ОБМЕН[[:space:]]+ВАЛЮТ|ПОКУПКА[[:space:]].*(USD|RUB|KZT|EUR|CNY))'
      then 'FX_CONVERSION'
    when upper(coalesce(p_purpose,'') || ' ' || coalesce(p_counterparty,'')) ~
      '(МЕЖДУ[[:space:]]+СВОИМИ|СОБСТВЕНН.*СЧЕТ|ВНУТРЕНН.*СЧЕТ|RONA[[:space:]]+TRADE|РОНА[[:space:]]+ТРЕЙД)'
      then 'OWN_ACCOUNT_TRANSFER'
    when upper(coalesce(p_direction,'')) = 'INCOMING' then 'EXTERNAL_INFLOW'
    when upper(coalesce(p_direction,'')) = 'OUTGOING' then 'EXTERNAL_PAYMENT'
    else 'UNCLASSIFIED'
  end;
$$;

revoke all on function portal_private.finance_cash_classify_bank_operation_v1(text,text,text)
  from public,anon,authenticated;

create or replace view portal_private.finance_cash_operations_current_v1
with (security_invoker = true)
as
with ranked as (
  select
    o.*,
    s.source_uid,
    s.source_filename,
    s.source_checksum_sha256,
    s.bank_name,
    s.statement_date,
    s.period_start,
    s.period_end,
    s.generated_at_local,
    row_number() over (
      partition by o.operation_fingerprint
      order by s.period_end desc, s.generated_at_local desc nulls last, s.source_uid desc, o.created_at desc, o.id desc
    ) as rn
  from portal_private.finance_cash_operations_v1 o
  join portal_private.finance_cash_statement_sources_v1 s on s.id=o.statement_source_id
  where o.source_locked=true and s.source_locked=true
),
dedup as (
  select * from ranked where rn=1
)
select
  d.id,
  d.operation_fingerprint,
  d.account_identity,
  btrim(d.currency) as currency,
  d.operation_date,
  d.executed_at_local,
  d.bank_document_number,
  d.direction,
  d.amount,
  case
    when upper(btrim(coalesce(d.purpose,''))) ~ '^СТОРНО([[:space:]]|$)' then 'REVERSAL'
    when d.operation_type='FX_CONVERSION' then 'FX_CONVERSION'
    when pm.payment_kind='FX_CONVERSION' then 'FX_CONVERSION'
    when d.operation_type='OWN_ACCOUNT_TRANSFER' then 'OWN_ACCOUNT_TRANSFER'
    when pm.payment_kind='INTERNAL_TRANSFER' then 'OWN_ACCOUNT_TRANSFER'
    else d.operation_type
  end as operation_type,
  coalesce(pm.counterparty_name,d.source_counterparty) as counterparty,
  d.source_counterparty,
  d.purpose,
  d.running_balance,
  d.source_ref,
  d.source_set_identity,
  d.source_uid,
  d.source_filename,
  d.source_checksum_sha256,
  d.bank_name,
  d.statement_date,
  d.period_start,
  d.period_end,
  d.generated_at_local,
  pm.payment_id as finance_payment_id,
  d.source_locked,
  pm.payment_kind as finance_payment_kind
from dedup d
left join lateral (
  select p.payment_id,p.counterparty_name,p.payment_kind::text as payment_kind
  from portal_private.payments p
  where p.lifecycle_state::text='ACTIVE'
    and p.authority_state::text='CONFIRMED'
    and p.bank_fact_status::text='BANK_CONFIRMED'
    and upper(p.payment_direction::text)=d.direction
    and btrim(p.currency)=btrim(d.currency)
    and p.amount=d.amount
    and d.bank_document_number is not null
    and regexp_replace(coalesce(p.bank_transaction_reference,''),'[^0-9]','','g')
        = regexp_replace(d.bank_document_number,'[^0-9]','','g')
  order by p.source_timestamp desc nulls last,p.created_at desc
  limit 1
) pm on true;

comment on view portal_private.finance_cash_operations_current_v1 is
  'Canonical deduplicated Finance bank operation projection for Admin Cash. Source-declared FX and reversals take precedence over downstream payment enrichment.';

revoke all on portal_private.finance_cash_operations_current_v1 from public,anon,authenticated;

create or replace view portal_private.finance_cash_ledger_daily_v2
with (security_invoker = true)
as
with global_bounds as (
  select
    min(period_start)::date as ledger_start_date,
    max(period_end)::date as ledger_end_date
  from portal_private.finance_cash_statement_sources_v1
  where source_locked=true
),
currency_seed as (
  select distinct on (s.account_identity,btrim(s.currency))
    s.account_identity,
    btrim(s.currency) as currency,
    s.period_start::date as currency_start_date,
    s.opening_balance::numeric(30,8) as initial_opening_balance
  from portal_private.finance_cash_statement_sources_v1 s
  where s.source_locked=true
  order by s.account_identity,btrim(s.currency),s.period_start asc,s.generated_at_local asc nulls last,s.source_uid asc,s.id asc
),
currency_last_source as (
  select
    account_identity,
    btrim(currency) as currency,
    max(period_end)::date as latest_source_period_end
  from portal_private.finance_cash_statement_sources_v1
  where source_locked=true
  group by account_identity,btrim(currency)
),
calendar as (
  select
    c.account_identity,
    c.currency,
    gs::date as operation_date,
    c.currency_start_date,
    g.ledger_end_date,
    c.initial_opening_balance,
    l.latest_source_period_end
  from currency_seed c
  join currency_last_source l using(account_identity,currency)
  cross join global_bounds g
  cross join lateral generate_series(c.currency_start_date,g.ledger_end_date,interval '1 day') gs
),
day_ops as (
  select
    o.account_identity,
    o.currency,
    o.operation_date,
    count(*)::int as operation_count,
    coalesce(sum(o.amount) filter(where o.direction='INCOMING'),0)::numeric(30,8) as bank_inflow,
    coalesce(sum(o.amount) filter(where o.direction='OUTGOING'),0)::numeric(30,8) as bank_outflow,
    coalesce(sum(o.amount) filter(where o.operation_type='EXTERNAL_INFLOW' and o.direction='INCOMING'),0)::numeric(30,8) as external_inflow,
    coalesce(sum(o.amount) filter(where o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'),0)::numeric(30,8) as external_payment,
    coalesce(sum(o.amount) filter(where o.operation_type='REVERSAL' and o.direction='INCOMING'),0)::numeric(30,8) as reversal_inflow,
    coalesce(sum(o.amount) filter(where o.operation_type='REVERSAL' and o.direction='OUTGOING'),0)::numeric(30,8) as reversal_outflow,
    coalesce(sum(o.amount) filter(where o.operation_type='FX_CONVERSION' and o.direction='INCOMING'),0)::numeric(30,8) as fx_inflow,
    coalesce(sum(o.amount) filter(where o.operation_type='FX_CONVERSION' and o.direction='OUTGOING'),0)::numeric(30,8) as fx_outflow,
    coalesce(sum(o.amount) filter(where o.operation_type='OWN_ACCOUNT_TRANSFER' and o.direction='INCOMING'),0)::numeric(30,8) as own_account_inflow,
    coalesce(sum(o.amount) filter(where o.operation_type='OWN_ACCOUNT_TRANSFER' and o.direction='OUTGOING'),0)::numeric(30,8) as own_account_outflow,
    coalesce(sum(o.amount) filter(where o.operation_type='UNCLASSIFIED' and o.direction='INCOMING'),0)::numeric(30,8) as unclassified_inflow,
    coalesce(sum(o.amount) filter(where o.operation_type='UNCLASSIFIED' and o.direction='OUTGOING'),0)::numeric(30,8) as unclassified_outflow
  from portal_private.finance_cash_operations_current_v1 o
  group by o.account_identity,o.currency,o.operation_date
),
base as (
  select
    c.account_identity,
    c.currency,
    c.operation_date,
    c.currency_start_date,
    c.ledger_end_date,
    c.initial_opening_balance,
    c.latest_source_period_end,
    coalesce(d.operation_count,0)::int as operation_count,
    coalesce(d.bank_inflow,0)::numeric(30,8) as bank_inflow,
    coalesce(d.bank_outflow,0)::numeric(30,8) as bank_outflow,
    coalesce(d.external_inflow,0)::numeric(30,8) as external_inflow,
    coalesce(d.external_payment,0)::numeric(30,8) as external_payment,
    coalesce(d.reversal_inflow,0)::numeric(30,8) as reversal_inflow,
    coalesce(d.reversal_outflow,0)::numeric(30,8) as reversal_outflow,
    coalesce(d.fx_inflow,0)::numeric(30,8) as fx_inflow,
    coalesce(d.fx_outflow,0)::numeric(30,8) as fx_outflow,
    coalesce(d.own_account_inflow,0)::numeric(30,8) as own_account_inflow,
    coalesce(d.own_account_outflow,0)::numeric(30,8) as own_account_outflow,
    coalesce(d.unclassified_inflow,0)::numeric(30,8) as unclassified_inflow,
    coalesce(d.unclassified_outflow,0)::numeric(30,8) as unclassified_outflow
  from calendar c
  left join day_ops d
    on d.account_identity=c.account_identity
   and d.currency=c.currency
   and d.operation_date=c.operation_date
),
calc as (
  select
    b.*,
    (
      b.initial_opening_balance
      + coalesce(sum(b.bank_inflow-b.bank_outflow) over (
          partition by b.account_identity,b.currency
          order by b.operation_date
          rows between unbounded preceding and 1 preceding
        ),0)
    )::numeric(30,8) as opening_balance,
    (
      b.initial_opening_balance
      + sum(b.bank_inflow-b.bank_outflow) over (
          partition by b.account_identity,b.currency
          order by b.operation_date
          rows between unbounded preceding and current row
        )
    )::numeric(30,8) as closing_balance,
    sum(b.external_inflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_external_inflow,
    sum(b.external_payment) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_external_payment,
    sum(b.reversal_inflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_reversal_inflow,
    sum(b.reversal_outflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_reversal_outflow,
    sum(b.fx_inflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_fx_inflow,
    sum(b.fx_outflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_fx_outflow,
    sum(b.own_account_inflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_own_account_inflow,
    sum(b.own_account_outflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_own_account_outflow,
    sum(b.bank_inflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_bank_inflow,
    sum(b.bank_outflow) over (
      partition by b.account_identity,b.currency order by b.operation_date rows unbounded preceding
    )::numeric(30,8) as cumulative_bank_outflow
  from base b
)
select
  c.operation_date,
  c.account_identity,
  c.currency,
  c.opening_balance,
  c.external_inflow,
  c.external_payment,
  c.reversal_inflow,
  c.reversal_outflow,
  c.fx_inflow,
  c.fx_outflow,
  c.own_account_inflow,
  c.own_account_outflow,
  c.unclassified_inflow,
  c.unclassified_outflow,
  c.bank_inflow,
  c.bank_outflow,
  c.closing_balance,
  (c.closing_balance-(c.opening_balance+c.bank_inflow-c.bank_outflow))::numeric(30,8) as balance_check,
  c.operation_count,
  c.cumulative_external_inflow,
  c.cumulative_external_payment,
  c.cumulative_reversal_inflow,
  c.cumulative_reversal_outflow,
  c.cumulative_fx_inflow,
  c.cumulative_fx_outflow,
  c.cumulative_own_account_inflow,
  c.cumulative_own_account_outflow,
  c.cumulative_bank_inflow,
  c.cumulative_bank_outflow,
  (c.cumulative_bank_inflow-c.cumulative_bank_outflow)::numeric(30,8) as cumulative_net_change,
  c.currency_start_date as ledger_start_date,
  c.ledger_end_date,
  c.latest_source_period_end,
  case
    when c.operation_count>0 then 'SOURCE_OPERATION_DAY'
    when c.operation_date<=c.latest_source_period_end then 'ZERO_TURNOVER_SOURCE_CARRY'
    else 'ZERO_TURNOVER_OWNER_RULE'
  end as day_source_status
from calc c;

comment on view portal_private.finance_cash_ledger_daily_v2 is
  'Continuous cumulative Finance cash ledger from first authoritative statement through latest statement date. Every calendar date is present; missing-operation dates are zero-turnover carry-forward days.';

revoke all on portal_private.finance_cash_ledger_daily_v2 from public,anon,authenticated;

create or replace view portal_private.finance_cash_statement_checkpoint_audit_v2
with (security_invoker = true)
as
with seed as (
  select distinct on (account_identity,btrim(currency))
    account_identity,
    btrim(currency) as currency,
    period_start::date as ledger_start_date,
    opening_balance::numeric(30,8) as initial_opening_balance
  from portal_private.finance_cash_statement_sources_v1
  where source_locked=true
  order by account_identity,btrim(currency),period_start asc,generated_at_local asc nulls last,source_uid asc,id asc
),
source_cutoff as (
  select
    s.*,
    btrim(s.currency) as currency_code,
    least(
      coalesce(s.generated_at_local,(s.period_end+1)::timestamp-interval '1 microsecond'),
      (s.period_end+1)::timestamp-interval '1 microsecond'
    ) as checkpoint_at
  from portal_private.finance_cash_statement_sources_v1 s
  where s.source_locked=true
)
select
  s.id as statement_source_id,
  s.source_uid,
  s.source_ref,
  s.source_filename,
  s.source_checksum_sha256,
  s.source_set_identity,
  s.account_identity,
  s.currency_code as currency,
  s.period_start,
  s.period_end,
  s.generated_at_local,
  s.checkpoint_at,
  s.opening_balance,
  s.total_credit,
  s.total_debit,
  s.closing_balance as source_closing_balance,
  (
    z.initial_opening_balance
    + coalesce((
      select sum(case when o.direction='INCOMING' then o.amount else -o.amount end)
      from portal_private.finance_cash_operations_current_v1 o
      where o.account_identity=s.account_identity
        and o.currency=s.currency_code
        and o.operation_date>=z.ledger_start_date
        and coalesce(
          o.executed_at_local,
          o.operation_date::timestamp+interval '23 hours 59 minutes 59 seconds'
        )<=s.checkpoint_at
    ),0)
  )::numeric(30,8) as ledger_balance_at_checkpoint,
  ((s.opening_balance+s.total_credit-s.total_debit)-s.closing_balance)::numeric(30,8) as source_formula_difference,
  (
    (
      z.initial_opening_balance
      + coalesce((
        select sum(case when o.direction='INCOMING' then o.amount else -o.amount end)
        from portal_private.finance_cash_operations_current_v1 o
        where o.account_identity=s.account_identity
          and o.currency=s.currency_code
          and o.operation_date>=z.ledger_start_date
          and coalesce(
            o.executed_at_local,
            o.operation_date::timestamp+interval '23 hours 59 minutes 59 seconds'
          )<=s.checkpoint_at
      ),0)
    ) - s.closing_balance
  )::numeric(30,8) as ledger_checkpoint_difference,
  case
    when ((s.opening_balance+s.total_credit-s.total_debit)-s.closing_balance)=0
     and (
       (
         z.initial_opening_balance
         + coalesce((
           select sum(case when o.direction='INCOMING' then o.amount else -o.amount end)
           from portal_private.finance_cash_operations_current_v1 o
           where o.account_identity=s.account_identity
             and o.currency=s.currency_code
             and o.operation_date>=z.ledger_start_date
             and coalesce(
               o.executed_at_local,
               o.operation_date::timestamp+interval '23 hours 59 minutes 59 seconds'
             )<=s.checkpoint_at
         ),0)
       ) - s.closing_balance
     )=0
    then 'PASS'
    else 'FAIL'
  end as checkpoint_status
from source_cutoff s
join seed z
  on z.account_identity=s.account_identity
 and z.currency=s.currency_code;

comment on view portal_private.finance_cash_statement_checkpoint_audit_v2 is
  'Exact source-to-ledger checkpoint audit. Each authoritative statement closing balance must equal the cumulative ledger at the statement economic cutoff with zero difference.';

revoke all on portal_private.finance_cash_statement_checkpoint_audit_v2 from public,anon,authenticated;

create or replace view portal_private.finance_cash_daily_summary_v1
with (security_invoker = true)
as
select
  operation_date,
  currency,
  sum(opening_balance)::numeric(30,8) as opening_balance,
  sum(external_inflow)::numeric(30,8) as external_inflow,
  sum(external_payment)::numeric(30,8) as external_payment,
  sum(fx_inflow)::numeric(30,8) as fx_inflow,
  sum(fx_outflow)::numeric(30,8) as fx_outflow,
  sum(own_account_inflow)::numeric(30,8) as own_account_inflow,
  sum(own_account_outflow)::numeric(30,8) as own_account_outflow,
  sum(unclassified_inflow)::numeric(30,8) as unclassified_inflow,
  sum(unclassified_outflow)::numeric(30,8) as unclassified_outflow,
  sum(closing_balance)::numeric(30,8) as closing_balance,
  sum(balance_check)::numeric(30,8) as balance_check,
  sum(operation_count)::int as operation_count,
  case
    when bool_or(day_source_status='ZERO_TURNOVER_OWNER_RULE') then 'ZERO_TURNOVER_OWNER_RULE'
    when sum(operation_count)=0 then 'ZERO_TURNOVER_CARRY'
    else 'SOURCE_DECLARED_RUNNING_BALANCE'
  end as balance_source_status,
  sum(reversal_inflow)::numeric(30,8) as reversal_inflow,
  sum(reversal_outflow)::numeric(30,8) as reversal_outflow,
  sum(bank_inflow)::numeric(30,8) as bank_inflow,
  sum(bank_outflow)::numeric(30,8) as bank_outflow,
  sum(cumulative_external_inflow)::numeric(30,8) as cumulative_external_inflow,
  sum(cumulative_external_payment)::numeric(30,8) as cumulative_external_payment,
  sum(cumulative_reversal_inflow)::numeric(30,8) as cumulative_reversal_inflow,
  sum(cumulative_reversal_outflow)::numeric(30,8) as cumulative_reversal_outflow,
  sum(cumulative_fx_inflow)::numeric(30,8) as cumulative_fx_inflow,
  sum(cumulative_fx_outflow)::numeric(30,8) as cumulative_fx_outflow,
  sum(cumulative_own_account_inflow)::numeric(30,8) as cumulative_own_account_inflow,
  sum(cumulative_own_account_outflow)::numeric(30,8) as cumulative_own_account_outflow,
  sum(cumulative_bank_inflow)::numeric(30,8) as cumulative_bank_inflow,
  sum(cumulative_bank_outflow)::numeric(30,8) as cumulative_bank_outflow,
  sum(cumulative_net_change)::numeric(30,8) as cumulative_net_change
from portal_private.finance_cash_ledger_daily_v2
group by operation_date,currency;

comment on view portal_private.finance_cash_daily_summary_v1 is
  'Continuous daily Admin Cash summary. Every calendar date from the first authoritative statement through the latest statement date is present; no-operation dates are explicit zero-turnover rows with carried balances.';

revoke all on portal_private.finance_cash_daily_summary_v1 from public,anon,authenticated;

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
ops as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'operation_date',o.operation_date,
    'executed_at_local',o.executed_at_local,
    'account_identity',o.account_identity,
    'currency',o.currency,
    'amount',o.amount,
    'direction',o.direction,
    'operation_type',o.operation_type,
    'counterparty',o.counterparty,
    'source_counterparty',o.source_counterparty,
    'bank_document_number',o.bank_document_number,
    'purpose',o.purpose,
    'running_balance',o.running_balance,
    'source_ref',o.source_ref,
    'source_set_identity',o.source_set_identity,
    'source_checksum_sha256',o.source_checksum_sha256,
    'finance_payment_id',o.finance_payment_id
  ) order by o.operation_date desc,o.executed_at_local desc nulls last,o.id desc),'[]'::jsonb) as v
  from portal_private.finance_cash_operations_current_v1 o,bounds b
  where o.operation_date between b.date_from and b.date_to
),
daily_rows as (
  select d.*
  from portal_private.finance_cash_daily_summary_v1 d,bounds b
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
    'source_lock',case when checkpoints.total_count=checkpoints.pass_count and checkpoints.max_diff=0 then 'PASS' else 'FAIL' end
  ) as v
  from checkpoints
)
select jsonb_build_object(
  'modelVersion','FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE',
  'authoritativeSource','AI-FINANCE/BANK_STATEMENT',
  'generatedAt',clock_timestamp(),
  'period',jsonb_build_object('from',b.date_from,'to',b.date_to),
  'classification',jsonb_build_object(
    'EXTERNAL_INFLOW','real external credits only',
    'EXTERNAL_PAYMENT','real external outgoing payments',
    'REVERSAL','bank reversal/refund of an earlier outgoing movement; separate from external inflow',
    'FX_CONVERSION','separate internal FX movement; excluded from external inflow/payment',
    'OWN_ACCOUNT_TRANSFER','separate own-account movement; excluded from external inflow/payment',
    'ZERO_TURNOVER_DAY','calendar date with no bank movement; opening and closing balance are carried forward'
  ),
  'operations',ops.v,
  'dailySummary',days.v,
  'periodSummary',periods.v,
  'statementSummaries',statements.v,
  'checkpointAudit',checkpoints.v,
  'controls',controls.v
)
from bounds b,ops,days,periods,statements,checkpoints,controls;
$$;

revoke all on function portal_private.finance_cash_source_projection_payload_v1(date,date)
  from public,anon,authenticated;

commit;
