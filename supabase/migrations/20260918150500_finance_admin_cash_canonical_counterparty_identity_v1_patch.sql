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
    (select p.counterparty_role from portal_private.payments p
      where p.payment_id=o.finance_payment_id and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE' and p.bank_fact_status::text='BANK_CONFIRMED'
      order by p.source_timestamp desc nulls last limit 1) as exact_payment_role,
    (upper(btrim(coalesce(o.purpose,''))) ~ '^(СТОРНО[[:space:]]+)?КОМИССИЯ' or o.finance_payment_kind='BANK_FEE') as bank_fee,
    (o.finance_payment_id='PAYEV-2026-000001' or (
      o.operation_type='EXTERNAL_INFLOW' and upper(coalesce(o.purpose,'')) like '%01/PT-01-1926%'
      and upper(coalesce(o.source_counterparty,o.counterparty,'')) in
        ('GAZ TULDIRISH STANTSIYASI LLC','FARGONA GAZ TULDIRISH STANTSIYASI LLC',
         'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «FARG‘ONA GAZ TO‘LDIRISH STANSIYASI»'))) as fargona,
    (o.finance_payment_id='OUT-2026-004-SGTRANS' or (
      upper(coalesce(o.purpose,'')) like '%134-1-26%'
      and upper(coalesce(o.source_counterparty,o.counterparty,'')) in ('РУП СГ-ТРАНС','РУП «СГ-ТРАНС»'))) as sgtrans,
    (o.finance_payment_id='OUT-2026-004-ORIENT' or (
      upper(coalesce(o.purpose,'')) like '%OL 9-2026%'
      and upper(coalesce(o.source_counterparty,o.counterparty,'')) in ('ТОО ORIENT LOGISTIC','ТОО «ORIENT LOGISTIC»'))) as orient,
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
    when x.finance_payment_id is not null and btrim(coalesce(x.counterparty,''))<>'' then
      'PAYMENT_PARTY:'||upper(btrim(x.counterparty))
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
    when x.sgtrans then coalesce(x.exact_payment_role,'ЖД / вагонный оператор')
    when x.orient then coalesce(x.exact_payment_role,'Логистический контрагент')
    when x.bnk then 'Поставщик'
    else x.exact_payment_role
  end as counterparty_role,
  x.source_counterparty as raw_source_counterparty,
  x.bank_name as bank_intermediary_name,
  case
    when x.bank_fee then 'FINANCE_BANK_FEE'
    when x.fargona then 'CANONICAL_CLIENT_CONTROLLED_ALIAS'
    when x.sgtrans or x.orient then 'VERIFIED_PAYMENT_CONTROLLED_ALIAS'
    when x.bnk then 'VERIFIED_PAYMENT_ALLOCATION_SUPPLIER'
    when x.finance_payment_id is not null then 'EXACT_VERIFIED_PAYMENT'
    else 'SOURCE_FALLBACK'
  end as counterparty_identity_source
from x cross join authority a;

commit;
