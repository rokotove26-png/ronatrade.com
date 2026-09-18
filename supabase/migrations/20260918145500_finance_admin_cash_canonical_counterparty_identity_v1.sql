begin;

create or replace view portal_private.finance_cash_operations_identity_v1
with (security_invoker = true)
as
with authority as (
  select
    (select c.legal_name from portal_private.clients c
      where c.client_id='RONA-C002' and c.authority_state::text='CONFIRMED' and c.lifecycle_state::text='ACTIVE'
      order by c.source_timestamp desc nulls last limit 1) as fargona_name,
    (select p.counterparty_name from portal_private.payments p
      where p.payment_id='OUT-2026-004-SGTRANS' and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE' and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last limit 1) as sgtrans_name,
    (select p.counterparty_name from portal_private.payments p
      where p.payment_id='OUT-2026-004-ORIENT' and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE' and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last limit 1) as orient_name,
    (select p.counterparty_name from portal_private.payments p
      where p.payment_id='OUT-2026-004-BNK' and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE' and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last limit 1) as bnk_name,
    (select ct.counterparty_code from portal_private.contracts ct
      where ct.contract_id='RONA-S001-CTR-2026-001' and ct.authority_state::text='CONFIRMED'
        and ct.lifecycle_state::text='ACTIVE'
      order by ct.source_timestamp desc nulls last limit 1) as bnk_code,
    (select p.counterparty_name from portal_private.payments p
      where p.counterparty_role='Банк' and upper(p.counterparty_name) like '%БАКАЙ%'
        and p.authority_state::text='CONFIRMED' and p.lifecycle_state::text='ACTIVE'
        and p.bank_fact_status::text='BANK_CONFIRMED'
      order by p.source_timestamp desc nulls last limit 1) as bakai_name
),
x as (
  select o.*,
    (upper(btrim(coalesce(o.purpose,''))) ~ '^(СТОРНО[[:space:]]+)?КОМИССИЯ' or o.finance_payment_kind='BANK_FEE') as bank_fee,
    (o.operation_type='EXTERNAL_INFLOW'
      and upper(coalesce(o.purpose,'')) like '%01/PT-01-1926%'
      and upper(coalesce(o.source_counterparty,o.counterparty,'')) in
        ('GAZ TULDIRISH STANTSIYASI LLC','FARGONA GAZ TULDIRISH STANTSIYASI LLC',
         'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «FARG‘ONA GAZ TO‘LDIRISH STANSIYASI»')) as fargona,
    (upper(coalesce(o.purpose,'')) like '%134-1-26%'
      and upper(coalesce(o.source_counterparty,o.counterparty,'')) in ('РУП СГ-ТРАНС','РУП «СГ-ТРАНС»')) as sgtrans,
    (upper(coalesce(o.purpose,'')) like '%OL 9-2026%'
      and upper(coalesce(o.source_counterparty,o.counterparty,'')) in ('ТОО ORIENT LOGISTIC','ТОО «ORIENT LOGISTIC»')) as orient,
    (o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING' and btrim(o.currency)='RUB'
      and o.amount=8484210 and upper(coalesce(o.purpose,'')) like '%190832326%'
      and upper(coalesce(o.purpose,'')) like '%БЕЛОРУССКАЯ НЕФТЯНАЯ КОМПАНИЯ%') as bnk
  from portal_private.finance_cash_operations_current_v1 o
)
select x.*,
  case
    when x.bank_fee then 'BANK:BAKAI'
    when x.fargona then 'CLIENT:RONA-C002'
    when x.sgtrans then 'COUNTERPARTY:SGTRANS'
    when x.orient then 'COUNTERPARTY:ORIENT_LOGISTIC'
    when x.bnk and a.bnk_code is not null then 'SUPPLIER:'||a.bnk_code
    when x.finance_payment_id is not null then 'PAYMENT:'||x.finance_payment_id
    else null
  end as canonical_counterparty_id,
  case
    when x.bank_fee then coalesce(a.bakai_name,'ОАО «БАКАЙ БАНК»')
    when x.fargona then coalesce(a.fargona_name,x.counterparty,x.source_counterparty)
    when x.sgtrans then coalesce(a.sgtrans_name,x.counterparty,x.source_counterparty)
    when x.orient then coalesce(a.orient_name,x.counterparty,x.source_counterparty)
    when x.bnk then coalesce(a.bnk_name,'БНК')
    else coalesce(x.counterparty,x.source_counterparty)
  end as canonical_counterparty_name,
  case
    when x.bank_fee then 'Банк'
    when x.fargona then 'CLIENT'
    when x.sgtrans then 'ЖД / вагонный оператор'
    when x.orient then 'Логистический контрагент'
    when x.bnk then 'Поставщик'
    else null
  end as counterparty_role,
  x.source_counterparty as raw_source_counterparty,
  x.bank_name as bank_intermediary_name,
  case
    when x.bank_fee then 'FINANCE_BANK_FEE'
    when x.fargona then 'CANONICAL_CLIENT_CONTROLLED_ALIAS'
    when x.sgtrans or x.orient then 'VERIFIED_PAYMENT_CONTROLLED_ALIAS'
    when x.bnk then 'VERIFIED_PAYMENT_ALLOCATION_SUPPLIER'
    when x.finance_payment_id is not null then 'EXACT_PAYMENT_LINK'
    else 'SOURCE_FALLBACK'
  end as counterparty_identity_source
from x cross join authority a;

revoke all on portal_private.finance_cash_operations_identity_v1 from public,anon,authenticated;

create or replace function portal_private.finance_cash_source_projection_payload_v2_identity(
  p_from date default null,p_to date default null
) returns jsonb
language sql stable security invoker
set search_path=pg_catalog,portal_private
as $$
with base as (
  select portal_private.finance_cash_source_projection_payload_v1(p_from,p_to) payload
), bounds as (
  select (payload->'period'->>'from')::date date_from,(payload->'period'->>'to')::date date_to from base
), ops as (
  select coalesce(jsonb_agg(to_jsonb(o)-'bank_fee'-'fargona'-'sgtrans'-'orient'-'bnk'
    order by o.operation_date desc,o.executed_at_local desc nulls last,o.id desc),'[]'::jsonb) value
  from portal_private.finance_cash_operations_identity_v1 o,bounds b
  where o.operation_date between b.date_from and b.date_to
)
select jsonb_set(base.payload,'{operations}',ops.value,true) from base,ops;
$$;

revoke all on function portal_private.finance_cash_source_projection_payload_v2_identity(date,date) from public,anon,authenticated;

create or replace function public.rona_admin_cash_source_projection_v1(
  p_from date default null,p_to date default null
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,portal_private,auth
as $$
declare v_actor uuid;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  return portal_private.finance_cash_source_projection_payload_v2_identity(p_from,p_to);
end;
$$;

revoke all on function public.rona_admin_cash_source_projection_v1(date,date) from public,anon;
grant execute on function public.rona_admin_cash_source_projection_v1(date,date) to authenticated,service_role;

commit;
