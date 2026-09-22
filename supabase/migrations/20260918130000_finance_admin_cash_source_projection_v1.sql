begin;

create table if not exists portal_private.finance_cash_statement_sources_v1 (
  id uuid primary key default gen_random_uuid(),
  source_uid bigint not null,
  source_ref text not null check (btrim(source_ref) <> ''),
  source_filename text not null check (btrim(source_filename) <> ''),
  source_checksum_sha256 text not null unique check (source_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  source_set_identity text not null unique check (btrim(source_set_identity) <> ''),
  bank_name text not null check (btrim(bank_name) <> ''),
  account_identity text not null check (btrim(account_identity) <> ''),
  currency char(3) not null check (btrim(currency) ~ '^[A-Z]{3}$'),
  statement_date date not null,
  period_start date not null,
  period_end date not null,
  generated_at_local timestamp without time zone,
  opening_balance numeric(30,8) not null,
  closing_balance numeric(30,8) not null,
  total_credit numeric(30,8) not null check (total_credit >= 0),
  total_debit numeric(30,8) not null check (total_debit >= 0),
  source_locked boolean not null default true check (source_locked),
  created_at timestamptz not null default clock_timestamp(),
  constraint finance_cash_statement_sources_v1_period_ck check (period_start <= period_end)
);

create table if not exists portal_private.finance_cash_operations_v1 (
  id uuid primary key default gen_random_uuid(),
  statement_source_id uuid not null references portal_private.finance_cash_statement_sources_v1(id) on delete restrict,
  operation_fingerprint text not null check (operation_fingerprint ~ '^[0-9a-f]{64}$'),
  source_set_identity text not null check (btrim(source_set_identity) <> ''),
  account_identity text not null check (btrim(account_identity) <> ''),
  currency char(3) not null check (btrim(currency) ~ '^[A-Z]{3}$'),
  operation_date date not null,
  executed_at_local timestamp without time zone,
  bank_document_number text,
  direction text not null check (direction in ('INCOMING','OUTGOING')),
  amount numeric(30,8) not null check (amount > 0),
  operation_type text not null check (operation_type in ('EXTERNAL_INFLOW','EXTERNAL_PAYMENT','FX_CONVERSION','OWN_ACCOUNT_TRANSFER','UNCLASSIFIED')),
  source_counterparty text,
  purpose text,
  running_balance numeric(30,8),
  source_ref text not null check (btrim(source_ref) <> ''),
  source_locked boolean not null default true check (source_locked),
  created_at timestamptz not null default clock_timestamp(),
  constraint finance_cash_operations_v1_source_fingerprint_uq unique (statement_source_id, operation_fingerprint)
);

create index if not exists finance_cash_operations_v1_date_currency_idx
  on portal_private.finance_cash_operations_v1(operation_date, currency);
create index if not exists finance_cash_operations_v1_statement_idx
  on portal_private.finance_cash_operations_v1(statement_source_id);
create index if not exists finance_cash_operations_v1_fingerprint_idx
  on portal_private.finance_cash_operations_v1(operation_fingerprint);

comment on table portal_private.finance_cash_statement_sources_v1 is
  'Append-only Finance-owned source projection of authoritative bank statement balances for Admin Cash. No deal/business data is mutated.';
comment on table portal_private.finance_cash_operations_v1 is
  'Append-only Finance-classified bank operation projection for Admin Cash. External inflow/payment are mutually exclusive; FX and own-account movements are separate.';

alter table portal_private.finance_cash_statement_sources_v1 enable row level security;
alter table portal_private.finance_cash_operations_v1 enable row level security;
revoke all on portal_private.finance_cash_statement_sources_v1 from public,anon,authenticated;
revoke all on portal_private.finance_cash_operations_v1 from public,anon,authenticated;

create or replace function portal_private.reject_finance_cash_projection_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, portal_private
as $$
begin
  raise exception 'FINANCE_CASH_PROJECTION_IMMUTABLE';
end;
$$;
revoke all on function portal_private.reject_finance_cash_projection_mutation_v1() from public;

drop trigger if exists finance_cash_statement_sources_v1_immutable on portal_private.finance_cash_statement_sources_v1;
create trigger finance_cash_statement_sources_v1_immutable
before update or delete on portal_private.finance_cash_statement_sources_v1
for each row execute function portal_private.reject_finance_cash_projection_mutation_v1();

drop trigger if exists finance_cash_operations_v1_immutable on portal_private.finance_cash_operations_v1;
create trigger finance_cash_operations_v1_immutable
before update or delete on portal_private.finance_cash_operations_v1
for each row execute function portal_private.reject_finance_cash_projection_mutation_v1();

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

create or replace function portal_private.finance_cash_ingest_statement_v1(p_statement jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, portal_private, extensions
as $$
declare
  v_source_id uuid;
  v_source_uid bigint;
  v_source_ref text;
  v_source_filename text;
  v_checksum text;
  v_source_set_identity text;
  v_bank_name text;
  v_account text;
  v_currency text;
  v_statement_date date;
  v_period_start date;
  v_period_end date;
  v_generated_at_local timestamp without time zone;
  v_opening numeric(30,8);
  v_closing numeric(30,8);
  v_total_credit numeric(30,8);
  v_total_debit numeric(30,8);
  v_ops_credit numeric(30,8);
  v_ops_debit numeric(30,8);
  v_op jsonb;
  v_direction text;
  v_amount numeric(30,8);
  v_op_date date;
  v_executed timestamp without time zone;
  v_doc text;
  v_source_counterparty text;
  v_purpose text;
  v_running numeric(30,8);
  v_operation_type text;
  v_fingerprint text;
  v_inserted int := 0;
  v_rowcount int := 0;
begin
  if p_statement is null or jsonb_typeof(p_statement) <> 'object' then
    raise exception 'FINANCE_CASH_STATEMENT_INVALID_PAYLOAD';
  end if;

  v_source_uid := nullif(p_statement->>'source_uid','')::bigint;
  v_source_ref := btrim(coalesce(p_statement->>'source_ref',''));
  v_source_filename := btrim(coalesce(p_statement->>'source_filename',''));
  v_checksum := lower(btrim(coalesce(p_statement->>'source_checksum_sha256','')));
  v_source_set_identity := btrim(coalesce(p_statement->>'source_set_identity',''));
  v_bank_name := btrim(coalesce(p_statement->>'bank_name',''));
  v_account := btrim(coalesce(p_statement->>'account_identity',''));
  v_currency := upper(btrim(coalesce(p_statement->>'currency','')));
  v_statement_date := nullif(p_statement->>'statement_date','')::date;
  v_period_start := nullif(p_statement->>'period_start','')::date;
  v_period_end := nullif(p_statement->>'period_end','')::date;
  v_generated_at_local := nullif(p_statement->>'generated_at_local','')::timestamp without time zone;
  v_opening := nullif(p_statement->>'opening_balance','')::numeric;
  v_closing := nullif(p_statement->>'closing_balance','')::numeric;
  v_total_credit := nullif(p_statement->>'total_credit','')::numeric;
  v_total_debit := nullif(p_statement->>'total_debit','')::numeric;

  if v_source_uid is null or v_source_uid <= 0
     or v_source_ref = '' or v_source_filename = ''
     or v_checksum !~ '^[0-9a-f]{64}$'
     or v_source_set_identity = ''
     or v_bank_name = '' or v_account = ''
     or v_currency !~ '^[A-Z]{3}$'
     or v_statement_date is null or v_period_start is null or v_period_end is null
     or v_opening is null or v_closing is null
     or v_total_credit is null or v_total_debit is null
     or jsonb_typeof(coalesce(p_statement->'operations','null'::jsonb)) <> 'array'
  then
    raise exception 'FINANCE_CASH_STATEMENT_REQUIRED_SOURCE_FIELDS_MISSING';
  end if;

  if abs((v_opening + v_total_credit - v_total_debit) - v_closing) > 0.01 then
    raise exception 'FINANCE_CASH_STATEMENT_BALANCE_MISMATCH';
  end if;

  select
    coalesce(sum(case when upper(x->>'direction')='INCOMING' then (x->>'amount')::numeric else 0 end),0),
    coalesce(sum(case when upper(x->>'direction')='OUTGOING' then (x->>'amount')::numeric else 0 end),0)
  into v_ops_credit, v_ops_debit
  from jsonb_array_elements(p_statement->'operations') x;

  if abs(v_ops_credit - v_total_credit) > 0.01
     or abs(v_ops_debit - v_total_debit) > 0.01 then
    raise exception 'FINANCE_CASH_STATEMENT_OPERATION_TOTAL_MISMATCH';
  end if;

  insert into portal_private.finance_cash_statement_sources_v1(
    source_uid,source_ref,source_filename,source_checksum_sha256,
    source_set_identity,bank_name,account_identity,currency,
    statement_date,period_start,period_end,generated_at_local,
    opening_balance,closing_balance,total_credit,total_debit,source_locked
  ) values (
    v_source_uid,v_source_ref,v_source_filename,v_checksum,
    v_source_set_identity,v_bank_name,v_account,v_currency,
    v_statement_date,v_period_start,v_period_end,v_generated_at_local,
    v_opening,v_closing,v_total_credit,v_total_debit,true
  )
  on conflict (source_checksum_sha256) do nothing
  returning id into v_source_id;

  if v_source_id is null then
    select id into v_source_id
    from portal_private.finance_cash_statement_sources_v1
    where source_checksum_sha256=v_checksum;
  end if;

  for v_op in select value from jsonb_array_elements(p_statement->'operations')
  loop
    v_direction := upper(btrim(coalesce(v_op->>'direction','')));
    v_amount := nullif(v_op->>'amount','')::numeric;
    v_op_date := nullif(v_op->>'operation_date','')::date;
    v_executed := nullif(v_op->>'executed_at_local','')::timestamp without time zone;
    v_doc := nullif(btrim(coalesce(v_op->>'bank_document_number','')),'');
    v_source_counterparty := nullif(btrim(coalesce(v_op->>'source_counterparty','')),'');
    v_purpose := nullif(btrim(coalesce(v_op->>'purpose','')),'');
    v_running := nullif(v_op->>'running_balance','')::numeric;

    if v_direction not in ('INCOMING','OUTGOING') or v_amount is null or v_amount<=0 or v_op_date is null then
      raise exception 'FINANCE_CASH_OPERATION_INVALID';
    end if;

    v_operation_type := portal_private.finance_cash_classify_bank_operation_v1(v_direction,v_purpose,v_source_counterparty);
    v_fingerprint := encode(
      extensions.digest(
        concat_ws('|',v_account,v_currency,v_op_date::text,coalesce(v_executed::text,''),coalesce(v_doc,''),
          v_direction,trim(to_char(v_amount,'FM999999999999999999999999990D99999999')),coalesce(v_purpose,'')),
        'sha256'
      ),
      'hex'
    );

    insert into portal_private.finance_cash_operations_v1(
      statement_source_id,operation_fingerprint,source_set_identity,
      account_identity,currency,operation_date,executed_at_local,
      bank_document_number,direction,amount,operation_type,
      source_counterparty,purpose,running_balance,source_ref,source_locked
    ) values (
      v_source_id,v_fingerprint,v_source_set_identity,
      v_account,v_currency,v_op_date,v_executed,
      v_doc,v_direction,v_amount,v_operation_type,
      v_source_counterparty,v_purpose,v_running,
      v_source_ref || case when v_doc is null then '' else ':DOC' || v_doc end,true
    )
    on conflict (statement_source_id,operation_fingerprint) do nothing;

    get diagnostics v_rowcount = row_count;
    v_inserted := v_inserted + v_rowcount;
  end loop;

  return jsonb_build_object(
    'status','PASS','statement_source_id',v_source_id,'source_set_identity',v_source_set_identity,
    'source_ref',v_source_ref,'operations_inserted',v_inserted,
    'operations_in_source',jsonb_array_length(p_statement->'operations')
  );
end;
$$;
revoke all on function portal_private.finance_cash_ingest_statement_v1(jsonb)
  from public,anon,authenticated;

create or replace view portal_private.finance_cash_operations_current_v1
with (security_invoker = true)
as
with ranked as (
  select o.*,s.source_uid,s.source_filename,s.source_checksum_sha256,s.bank_name,s.statement_date,
         s.period_start,s.period_end,s.generated_at_local,
         row_number() over (
           partition by o.operation_fingerprint
           order by s.period_end desc,s.generated_at_local desc nulls last,s.source_uid desc,o.created_at desc,o.id desc
         ) rn
  from portal_private.finance_cash_operations_v1 o
  join portal_private.finance_cash_statement_sources_v1 s on s.id=o.statement_source_id
  where o.source_locked=true and s.source_locked=true
), dedup as (select * from ranked where rn=1)
select
  d.id,d.operation_fingerprint,d.account_identity,btrim(d.currency) currency,d.operation_date,d.executed_at_local,
  d.bank_document_number,d.direction,d.amount,
  case when pm.payment_kind='FX_CONVERSION' then 'FX_CONVERSION'
       when pm.payment_kind='INTERNAL_TRANSFER' then 'OWN_ACCOUNT_TRANSFER'
       else d.operation_type end operation_type,
  coalesce(pm.counterparty_name,d.source_counterparty) counterparty,
  d.source_counterparty,d.purpose,d.running_balance,d.source_ref,d.source_set_identity,d.source_uid,d.source_filename,
  d.source_checksum_sha256,d.bank_name,d.statement_date,d.period_start,d.period_end,d.generated_at_local,
  pm.payment_id finance_payment_id,d.source_locked,pm.payment_kind finance_payment_kind
from dedup d
left join lateral (
  select p.payment_id,p.counterparty_name,p.payment_kind::text payment_kind
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

create or replace view portal_private.finance_cash_statement_summary_v1
with (security_invoker = true)
as
select s.id statement_source_id,s.source_uid,s.source_ref,s.source_filename,s.source_checksum_sha256,s.source_set_identity,
       s.bank_name,s.account_identity,btrim(s.currency) currency,s.statement_date,s.period_start,s.period_end,s.generated_at_local,
       s.opening_balance,
       coalesce(sum(o.amount) filter(where o.operation_type='EXTERNAL_INFLOW' and o.direction='INCOMING'),0)::numeric(30,8) external_inflow,
       coalesce(sum(o.amount) filter(where o.operation_type='EXTERNAL_PAYMENT' and o.direction='OUTGOING'),0)::numeric(30,8) external_payment,
       coalesce(sum(o.amount) filter(where o.operation_type='FX_CONVERSION' and o.direction='INCOMING'),0)::numeric(30,8) fx_inflow,
       coalesce(sum(o.amount) filter(where o.operation_type='FX_CONVERSION' and o.direction='OUTGOING'),0)::numeric(30,8) fx_outflow,
       coalesce(sum(o.amount) filter(where o.operation_type='OWN_ACCOUNT_TRANSFER' and o.direction='INCOMING'),0)::numeric(30,8) own_account_inflow,
       coalesce(sum(o.amount) filter(where o.operation_type='OWN_ACCOUNT_TRANSFER' and o.direction='OUTGOING'),0)::numeric(30,8) own_account_outflow,
       coalesce(sum(o.amount) filter(where o.operation_type='UNCLASSIFIED' and o.direction='INCOMING'),0)::numeric(30,8) unclassified_inflow,
       coalesce(sum(o.amount) filter(where o.operation_type='UNCLASSIFIED' and o.direction='OUTGOING'),0)::numeric(30,8) unclassified_outflow,
       s.total_credit,s.total_debit,s.closing_balance,
       ((s.opening_balance+s.total_credit-s.total_debit)-s.closing_balance)::numeric(30,8) balance_check,
       count(o.id)::int operation_count,s.source_locked
from portal_private.finance_cash_statement_sources_v1 s
left join portal_private.finance_cash_operations_v1 o on o.statement_source_id=s.id
where s.source_locked=true
group by s.id;

create or replace view portal_private.finance_cash_daily_summary_v1
with (security_invoker = true)
as
with ordered as (
  select o.*,case when o.direction='INCOMING' then o.amount else -o.amount end signed_amount,
         row_number() over(partition by o.account_identity,o.currency,o.operation_date
           order by o.executed_at_local nulls last,o.bank_document_number nulls last,o.id) rn_first,
         row_number() over(partition by o.account_identity,o.currency,o.operation_date
           order by o.executed_at_local desc nulls first,o.bank_document_number desc nulls first,o.id desc) rn_last
  from portal_private.finance_cash_operations_current_v1 o
), per_account as (
  select operation_date,account_identity,currency,
         max(case when rn_first=1 and running_balance is not null then running_balance-signed_amount end) opening_balance,
         max(case when rn_last=1 then running_balance end) closing_balance,
         sum(amount) filter(where operation_type='EXTERNAL_INFLOW' and direction='INCOMING') external_inflow,
         sum(amount) filter(where operation_type='EXTERNAL_PAYMENT' and direction='OUTGOING') external_payment,
         sum(amount) filter(where operation_type='FX_CONVERSION' and direction='INCOMING') fx_inflow,
         sum(amount) filter(where operation_type='FX_CONVERSION' and direction='OUTGOING') fx_outflow,
         sum(amount) filter(where operation_type='OWN_ACCOUNT_TRANSFER' and direction='INCOMING') own_account_inflow,
         sum(amount) filter(where operation_type='OWN_ACCOUNT_TRANSFER' and direction='OUTGOING') own_account_outflow,
         sum(amount) filter(where operation_type='UNCLASSIFIED' and direction='INCOMING') unclassified_inflow,
         sum(amount) filter(where operation_type='UNCLASSIFIED' and direction='OUTGOING') unclassified_outflow,
         count(*)::int operation_count
  from ordered
  group by operation_date,account_identity,currency
)
select operation_date,currency,
       sum(opening_balance)::numeric(30,8) opening_balance,
       coalesce(sum(external_inflow),0)::numeric(30,8) external_inflow,
       coalesce(sum(external_payment),0)::numeric(30,8) external_payment,
       coalesce(sum(fx_inflow),0)::numeric(30,8) fx_inflow,
       coalesce(sum(fx_outflow),0)::numeric(30,8) fx_outflow,
       coalesce(sum(own_account_inflow),0)::numeric(30,8) own_account_inflow,
       coalesce(sum(own_account_outflow),0)::numeric(30,8) own_account_outflow,
       coalesce(sum(unclassified_inflow),0)::numeric(30,8) unclassified_inflow,
       coalesce(sum(unclassified_outflow),0)::numeric(30,8) unclassified_outflow,
       sum(closing_balance)::numeric(30,8) closing_balance,
       (sum(closing_balance)-(
         sum(opening_balance)+coalesce(sum(external_inflow),0)+coalesce(sum(fx_inflow),0)+coalesce(sum(own_account_inflow),0)+coalesce(sum(unclassified_inflow),0)
         -coalesce(sum(external_payment),0)-coalesce(sum(fx_outflow),0)-coalesce(sum(own_account_outflow),0)-coalesce(sum(unclassified_outflow),0)
       ))::numeric(30,8) balance_check,
       sum(operation_count)::int operation_count,
       case when count(*) filter(where opening_balance is null or closing_balance is null)>0
            then 'TO_VERIFY' else 'SOURCE_DECLARED_RUNNING_BALANCE' end balance_source_status
from per_account
group by operation_date,currency;

create or replace function portal_private.finance_cash_source_projection_payload_v1(p_from date default null,p_to date default null)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog,portal_private
as $$
with bounds as (
  select coalesce(p_from,(select min(operation_date) from portal_private.finance_cash_operations_current_v1)) date_from,
         coalesce(p_to,(select max(operation_date) from portal_private.finance_cash_operations_current_v1)) date_to
), ops as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'operation_date',o.operation_date,'executed_at_local',o.executed_at_local,'account_identity',o.account_identity,
    'currency',o.currency,'amount',o.amount,'direction',o.direction,'operation_type',o.operation_type,
    'counterparty',o.counterparty,'source_counterparty',o.source_counterparty,'bank_document_number',o.bank_document_number,
    'purpose',o.purpose,'running_balance',o.running_balance,'source_ref',o.source_ref,
    'source_set_identity',o.source_set_identity,'source_checksum_sha256',o.source_checksum_sha256,
    'finance_payment_id',o.finance_payment_id
  ) order by o.operation_date desc,o.executed_at_local desc nulls last,o.id desc),'[]'::jsonb) v
  from portal_private.finance_cash_operations_current_v1 o,bounds b
  where o.operation_date between b.date_from and b.date_to
), daily_rows as (
  select d.* from portal_private.finance_cash_daily_summary_v1 d,bounds b
  where d.operation_date between b.date_from and b.date_to
), days as (
  select coalesce(jsonb_agg(to_jsonb(d) order by d.operation_date desc,d.currency),'[]'::jsonb) v from daily_rows d
), period_rollup as (
  select currency,(array_agg(opening_balance order by operation_date asc))[1]::numeric(30,8) opening_balance,
         sum(external_inflow)::numeric(30,8) external_inflow,sum(external_payment)::numeric(30,8) external_payment,
         sum(fx_inflow)::numeric(30,8) fx_inflow,sum(fx_outflow)::numeric(30,8) fx_outflow,
         sum(own_account_inflow)::numeric(30,8) own_account_inflow,sum(own_account_outflow)::numeric(30,8) own_account_outflow,
         sum(unclassified_inflow)::numeric(30,8) unclassified_inflow,sum(unclassified_outflow)::numeric(30,8) unclassified_outflow,
         (array_agg(closing_balance order by operation_date desc))[1]::numeric(30,8) closing_balance,
         sum(operation_count)::int operation_count,min(operation_date) first_activity_date,max(operation_date) last_activity_date,
         bool_and(balance_source_status='SOURCE_DECLARED_RUNNING_BALANCE') source_declared_balances
  from daily_rows group by currency
), periods as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'currency',p.currency,'opening_balance',p.opening_balance,'external_inflow',p.external_inflow,
    'external_payment',p.external_payment,'fx_inflow',p.fx_inflow,'fx_outflow',p.fx_outflow,
    'own_account_inflow',p.own_account_inflow,'own_account_outflow',p.own_account_outflow,
    'unclassified_inflow',p.unclassified_inflow,'unclassified_outflow',p.unclassified_outflow,
    'closing_balance',p.closing_balance,
    'balance_check',p.closing_balance-(p.opening_balance+p.external_inflow+p.fx_inflow+p.own_account_inflow+p.unclassified_inflow
      -p.external_payment-p.fx_outflow-p.own_account_outflow-p.unclassified_outflow),
    'operation_count',p.operation_count,'first_activity_date',p.first_activity_date,'last_activity_date',p.last_activity_date,
    'balance_source_status',case when p.source_declared_balances then 'SOURCE_DECLARED_RUNNING_BALANCE' else 'TO_VERIFY' end
  ) order by p.currency),'[]'::jsonb) v from period_rollup p
), statements as (
  select coalesce(jsonb_agg(to_jsonb(s) order by s.period_end desc,s.currency,s.account_identity),'[]'::jsonb) v
  from portal_private.finance_cash_statement_summary_v1 s,bounds b
  where s.period_end>=b.date_from and s.period_start<=b.date_to
)
select jsonb_build_object(
  'modelVersion','FINANCE_CASH_SOURCE_PROJECTION_V1','authoritativeSource','AI-FINANCE/BANK_STATEMENT',
  'generatedAt',clock_timestamp(),'period',jsonb_build_object('from',b.date_from,'to',b.date_to),
  'classification',jsonb_build_object(
    'EXTERNAL_INFLOW','real external credits only',
    'EXTERNAL_PAYMENT','real external debits only',
    'FX_CONVERSION','separate internal FX movement; excluded from external inflow/payment',
    'OWN_ACCOUNT_TRANSFER','separate own-account movement; excluded from external inflow/payment'
  ),
  'operations',ops.v,'dailySummary',days.v,'periodSummary',periods.v,'statementSummaries',statements.v
)
from bounds b,ops,days,periods,statements;
$$;

revoke all on portal_private.finance_cash_operations_current_v1 from public,anon,authenticated;
revoke all on portal_private.finance_cash_statement_summary_v1 from public,anon,authenticated;
revoke all on portal_private.finance_cash_daily_summary_v1 from public,anon,authenticated;
revoke all on function portal_private.finance_cash_source_projection_payload_v1(date,date) from public,anon,authenticated;

create or replace function public.rona_admin_cash_source_projection_v1(p_from date default null,p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog,public,portal_private,auth
as $$
declare v_actor uuid;
begin
  v_actor:=portal_private.owner_r1_actor('ADMIN');
  return portal_private.finance_cash_source_projection_payload_v1(p_from,p_to);
end;
$$;

revoke all on function public.rona_admin_cash_source_projection_v1(date,date) from public,anon;
grant execute on function public.rona_admin_cash_source_projection_v1(date,date) to authenticated;

commit;
