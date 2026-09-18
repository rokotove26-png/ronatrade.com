begin;

create or replace function portal_private.finance_cash_source_projection_payload_v2_identity(
  p_from date default null,
  p_to date default null
)
returns jsonb
language sql
stable
security invoker
set search_path=pg_catalog,portal_private
as $$
with base as (
  select portal_private.finance_cash_source_projection_payload_v1(p_from,p_to) as payload
),
bounds as (
  select
    (payload->'period'->>'from')::date as date_from,
    (payload->'period'->>'to')::date as date_to
  from base
),
ops as (
  select coalesce(jsonb_agg(
    (
      to_jsonb(o)-'bank_fee'-'fargona'-'sgtrans'-'orient'-'bnk'
    ) || jsonb_build_object(
      'canonical_counterparty_id',
      case
        when o.finance_payment_id='PAYEV-2026-000001' then 'CLIENT:RONA-C002'
        when o.finance_payment_id='OUT-2026-004-SGTRANS' then 'COUNTERPARTY:SGTRANS'
        when o.finance_payment_id='OUT-2026-004-ORIENT' then 'COUNTERPARTY:ORIENT_LOGISTIC'
        else o.canonical_counterparty_id
      end
    )
    order by o.operation_date desc,o.executed_at_local desc nulls last,o.id desc
  ),'[]'::jsonb) as value
  from portal_private.finance_cash_operations_identity_v1 o,bounds b
  where o.operation_date between b.date_from and b.date_to
)
select jsonb_set(base.payload,'{operations}',ops.value,true)
from base,ops;
$$;

commit;
