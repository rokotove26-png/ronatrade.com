begin;

create or replace view portal_private.finance_cash_operations_identity_v1
with (security_invoker = true)
as
with refs as (
  select
    (select c.client_id
       from portal_private.clients c
      where c.client_id='RONA-C002'
        and c.authority_state::text='CONFIRMED'
        and c.lifecycle_state::text='ACTIVE'
      order by c.source_timestamp desc nulls last,c.updated_at desc
      limit 1) as fargona_client_id,
    (select c.legal_name
       from portal_private.clients c
      where c.client_id='RONA-C002'
        and c.authority_state::text='CONFIRMED'
        and c.lifecycle_state::text='ACTIVE'
      order by c.source_timestamp desc nulls last,c.updated_at desc
      limit 1) as fargona_name,
    (select p.counterparty_name
       from portal_private.payments p
      where p.payment_id='OUT-2026-004-SGTRANS'
        and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE'
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last,p.updated_at desc
      limit 1) as sgtrans_name,
    (select p.counterparty_role
       from portal_private.payments p
      where p.payment_id='OUT-2026-004-SGTRANS'
        and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE'
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last,p.updated_at desc
      limit 1) as sgtrans_role,
    (select p.counterparty_name
       from portal_private.payments p
      where p.payment_id='OUT-2026-004-ORIENT'
        and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE'
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last,p.updated_at desc
      limit 1) as orient_name,
    (select p.counterparty_role
       from portal_private.payments p
      where p.payment_id='OUT-2026-004-ORIENT'
        and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE'
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last,p.updated_at desc
      limit 1) as orient_role,
    (select ct.counterparty_code
       from portal_private.contracts ct
      where ct.contract_id='RONA-S001-CTR-2026-001'
        and ct.authority_state::text='CONFIRMED'
        and ct.lifecycle_state::text='ACTIVE'
      order by ct.source_timestamp desc nulls last,ct.updated_at desc
      limit 1) as bnk_counterparty_code,
    (select p.counterparty_role
       from portal_private.payments p
      where p.payment_id='OUT-2026-004-BNK'
        and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE'
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last,p.updated_at desc
      limit 1) as bnk_role,
    (select p.counterparty_name
       from portal_private.payments p
      where p.counterparty_name='ОАО «БАКАЙ БАНК»'
        and p.counterparty_role='Банк'
        and p.authority_state::text='CONFIRMED'
        and p.lifecycle_state::text='ACTIVE'
        and p.bank_fact_status::text='BANK_CONFIRMED'
        and p.finance_verification_status::text='VERIFIED'
      order by p.source_timestamp desc nulls last,p.updated_at desc
      limit 1) as bakai_name
),
prepared as (
  select
    o.*,
    p.counterparty_name as exact_payment_counterparty_name,
    p.counterparty_role as exact_payment_counterparty_role,
    (
      upper(btrim(coalesce(o.purpose,''))) ~ '^(СТОРНО[[:space:]]+)?КОМИССИЯ'
      or o.finance_payment_kind='BANK_FEE'
    ) as is_bank_fee,
    (
      o.operation_type='EXTERNAL_INFLOW'
      and upper(btrim(coalesce(o.source_counterparty,o.counterparty,''))) in (
        'GAZ TULDIRISH STANTSIYASI LLC',
        'FARGONA GAZ TULDIRISH STANTSIYASI LLC',
        'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «FARG‘ONA GAZ TO‘LDIRISH STANSIYASI»'
      )
      and (
        upper(coalesce(o.purpose,'')) like '%01/PT-01-1926%'
        or o.finance_payment_id='PAYEV-2026-000001'
      )
    ) as is_fargona,
    (
      upper(btrim(coalesce(o.source_counterparty,o.counterparty,''))) in (
        'РУП СГ-ТРАНС',
        'РУП «СГ-ТРАНС»'
      )
      and (
        upper(coalesce(o.purpose,'')) like '%134-1-26%'
        or o.finance_payment_id='OUT-2026-004-SGTRANS'
      )
    ) as is_sgtrans,
    (
      upper(btrim(coalesce(o.source_counterparty,o.counterparty,''))) in (
        'ТОО ORIENT LOGISTIC',
        'ТОО «ORIENT LOGISTIC»'
      )
      and (
        upper(coalesce(o.purpose,'')) like '%OL 9-2026%'
        or o.finance_payment_id='OUT-2026-004-ORIENT'
      )
    ) as is_orient,
    (
      o.operation_type='EXTERNAL_PAYMENT'
      and o.direction='OUTGOING'
      and btrim(o.currency)='RUB'
      and o.amount=8484210
      and upper(coalesce(o.purpose,'')) like '%БЕЛОРУССКАЯ НЕФТЯНАЯ КОМПАНИЯ%'
      and upper(coalesce(o.purpose,'')) like '%190832326%'
    ) as is_bnk
  from portal_private.finance_cash_operations_current_v1 o
  left join portal_private.payments p
    on p.payment_id=o.finance_payment_id
   and p.authority_state::text='CONFIRMED'
   and p.lifecycle_state::text='ACTIVE'
   and p.bank_fact_status::text='BANK_CONFIRMED'
)
select
  p.*,
  case
    when p.is_bank_fee
      or (p.operation_type='FX_CONVERSION' and upper(coalesce(p.bank_name,'')) like '%БАКАЙ%')
      then 'BANK:BAKAI'
    when p.is_fargona and r.fargona_client_id is not null
      then 'CLIENT:' || r.fargona_client_id
    when p.is_sgtrans and not p.is_bank_fee
      then 'COUNTERPARTY:SGTRANS'
    when p.is_orient and not p.is_bank_fee
      then 'COUNTERPARTY:ORIENT_LOGISTIC'
    when p.is_bnk and r.bnk_counterparty_code is not null
      then 'SUPPLIER:' || r.bnk_counterparty_code
    else null
  end as canonical_counterparty_id,
  case
    when p.is_bank_fee
      or (p.operation_type='FX_CONVERSION' and upper(coalesce(p.bank_name,'')) like '%БАКАЙ%')
      then coalesce(r.bakai_name,'ОАО «БАКАЙ БАНК»')
    when p.is_fargona
      then coalesce(r.fargona_name,p.exact_payment_counterparty_name,p.counterparty,p.source_counterparty)
    when p.is_sgtrans and not p.is_bank_fee
      then coalesce(r.sgtrans_name,p.exact_payment_counterparty_name,p.counterparty,p.source_counterparty)
    when p.is_orient and not p.is_bank_fee
      then coalesce(r.orient_name,p.exact_payment_counterparty_name,p.counterparty,p.source_counterparty)
    when p.is_bnk
      then 'ЗАО «Белорусская нефтяная компания»'
    else coalesce(p.exact_payment_counterparty_name,p.counterparty,p.source_counterparty)
  end as canonical_counterparty_name,
  case
    when p.is_bank_fee
      or (p.operation_type='FX_CONVERSION' and upper(coalesce(p.bank_name,'')) like '%БАКАЙ%')
      then 'Банк'
    when p.is_fargona then 'CLIENT'
    when p.is_sgtrans and not p.is_bank_fee then coalesce(r.sgtrans_role,p.exact_payment_counterparty_role)
    when p.is_orient and not p.is_bank_fee then coalesce(r.orient_role,p.exact_payment_counterparty_role)
    when p.is_bnk then coalesce(r.bnk_role,'Поставщик')
    else p.exact_payment_counterparty_role
  end as counterparty_role,
  p.source_counterparty as raw_source_counterparty,
  p.bank_name as bank_intermediary_name,
  case
    when p.is_bank_fee then 'FINANCE_BANK_FEE_SOURCE'
    when p.operation_type='FX_CONVERSION' and upper(coalesce(p.bank_name,'')) like '%БАКАЙ%' then 'FINANCE_BANK_SOURCE'
    when p.is_fargona then 'CANONICAL_CLIENT_PLUS_CONTROLLED_ALIAS'
    when p.is_sgtrans and not p.is_bank_fee then 'VERIFIED_PAYMENT_PLUS_CONTROLLED_ALIAS'
    when p.is_orient and not p.is_bank_fee then 'VERIFIED_PAYMENT_PLUS_CONTROLLED_ALIAS'
    when p.is_bnk then 'VERIFIED_PAYMENT_ALLOCATION_PLUS_SUPPLIER_CONTRACT'
    when p.finance_payment_id is not null then 'EXACT_VERIFIED_PAYMENT'
    else 'SOURCE_FALLBACK'
  end as counterparty_identity_source
from prepared p
cross join refs r;

comment on view portal_private.finance_cash_operations_identity_v1 is
  'Finance-approved identity projection for Admin Cash. Adds canonical business-counterparty identity and bank/source attributes without changing operation type, amount, direction, ledger or business records.';

revoke all on portal_private.finance_cash_operations_identity_v1 from public,anon,authenticated;

create or replace function portal_private.finance_cash_source_projection_payload_v2_identity(
  p_from date default null,
  p_to date default null
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog,portal_private
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
  select coalesce(jsonb_agg(jsonb_build_object(
    'operation_date',o.operation_date,
    'executed_at_local',o.executed_at_local,
    'account_identity',o.account_identity,
    'currency',o.currency,
    'amount',o.amount,
    'direction',o.direction,
    'operation_type',o.operation_type,
    'counterparty',o.counterparty,
    'canonical_counterparty_id',o.canonical_counterparty_id,
    'canonical_counterparty_name',o.canonical_counterparty_name,
    'counterparty_role',o.counterparty_role,
    'counterparty_identity_source',o.counterparty_identity_source,
    'source_counterparty',o.source_counterparty,
    'raw_source_counterparty',o.raw_source_counterparty,
    'bank_name',o.bank_name,
    'bank_intermediary_name',o.bank_intermediary_name,
    'bank_document_number',o.bank_document_number,
    'purpose',o.purpose,
    'running_balance',o.running_balance,
    'source_ref',o.source_ref,
    'source_set_identity',o.source_set_identity,
    'source_checksum_sha256',o.source_checksum_sha256,
    'finance_payment_id',o.finance_payment_id
  ) order by o.operation_date desc,o.executed_at_local desc nulls last,o.id desc),'[]'::jsonb) as value
  from portal_private.finance_cash_operations_identity_v1 o,bounds b
  where o.operation_date between b.date_from and b.date_to
)
select jsonb_set(base.payload,'{operations}',ops.value,true)
from base,ops;
$$;

revoke all on function portal_private.finance_cash_source_projection_payload_v2_identity(date,date)
  from public,anon,authenticated;

create or replace function public.rona_admin_cash_source_projection_v1(
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog,public,portal_private,auth
as $$
declare
  v_actor uuid;
begin
  v_actor := portal_private.owner_r1_actor('ADMIN');
  return portal_private.finance_cash_source_projection_payload_v2_identity(p_from,p_to);
end;
$$;

revoke all on function public.rona_admin_cash_source_projection_v1(date,date) from public,anon;
grant execute on function public.rona_admin_cash_source_projection_v1(date,date) to authenticated,service_role;

commit;
