begin;

create or replace function portal_private.finance_counterparty_normalize_name_v1(p_value text)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          upper(btrim(coalesce(p_value,''))),
          '[«»“”"''´]+',
          ' ',
          'g'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

revoke all on function portal_private.finance_counterparty_normalize_name_v1(text)
from public,anon,authenticated;

create table if not exists portal_private.finance_counterparty_identities_v1 (
  canonical_counterparty_id text primary key,
  canonical_counterparty_name text not null check (btrim(canonical_counterparty_name)<>''),
  counterparty_role text,
  identity_authority_type text not null check (btrim(identity_authority_type)<>''),
  identity_authority_ref text not null check (btrim(identity_authority_ref)<>''),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  source_locked boolean not null default true check (source_locked),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','SUPERSEDED')),
  created_at timestamptz not null default clock_timestamp()
);

comment on table portal_private.finance_counterparty_identities_v1 is
  'Finance counterparty identity-resolution registry only. It does not create or mutate business master entities; each identity is anchored to authoritative Client/Payment/Contract/Bank source evidence.';

create table if not exists portal_private.finance_counterparty_aliases_v1 (
  alias_id text primary key,
  canonical_counterparty_id text not null
    references portal_private.finance_counterparty_identities_v1(canonical_counterparty_id) on delete restrict,
  alias_scope text not null check (alias_scope in ('RAW_SOURCE','PAYMENT_COUNTERPARTY','SOURCE_BANK')),
  raw_alias text not null check (btrim(raw_alias)<>''),
  normalized_alias text not null check (btrim(normalized_alias)<>''),
  required_purpose_regex text,
  direction text check (direction is null or direction in ('INCOMING','OUTGOING')),
  currency char(3) check (currency is null or btrim(currency) ~ '^[A-Z]{3}$'),
  intermediary_from_raw boolean not null default false,
  priority integer not null default 100,
  resolution_source text not null check (btrim(resolution_source)<>''),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs)='array'),
  source_locked boolean not null default true check (source_locked),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','SUPERSEDED')),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists finance_counterparty_aliases_v1_lookup_idx
  on portal_private.finance_counterparty_aliases_v1(alias_scope,normalized_alias,priority desc);

alter table portal_private.finance_counterparty_identities_v1 enable row level security;
alter table portal_private.finance_counterparty_aliases_v1 enable row level security;
revoke all on portal_private.finance_counterparty_identities_v1 from public,anon,authenticated;
revoke all on portal_private.finance_counterparty_aliases_v1 from public,anon,authenticated;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select 'CLIENT:RONA-C002',c.legal_name,'CLIENT','CANONICAL_CLIENT','RONA-C002',
       jsonb_build_array('portal_private.clients:RONA-C002','PAYMENT:PAYEV-2026-000001')
from portal_private.clients c
where c.client_id='RONA-C002'
  and c.authority_state::text='CONFIRMED'
  and c.lifecycle_state::text='ACTIVE'
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select 'CLIENT:RONA-C003',c.legal_name,'CLIENT','CANONICAL_CLIENT','RONA-C003',
       jsonb_build_array('portal_private.clients:RONA-C003','PAYMENT:PAYEV-2026-000002','PAYMENT:PAYEV-2026-000003')
from portal_private.clients c
where c.client_id='RONA-C003'
  and c.authority_state::text='CONFIRMED'
  and c.lifecycle_state::text='ACTIVE'
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select 'CLIENT:RONA-C005',c.legal_name,'CLIENT','CANONICAL_CLIENT','RONA-C005',
       jsonb_build_array('portal_private.clients:RONA-C005')
from portal_private.clients c
where c.client_id='RONA-C005'
  and c.authority_state::text='CONFIRMED'
  and c.lifecycle_state::text='ACTIVE'
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select 'FINANCE_COUNTERPARTY:SGTRANS',p.counterparty_name,p.counterparty_role,
       'VERIFIED_PAYMENT','OUT-2026-004-SGTRANS',
       jsonb_build_array('PAYMENT:OUT-2026-004-SGTRANS','BANK_DOC:5967658','CONTRACT_NO:134-1-26')
from portal_private.payments p
where p.payment_id='OUT-2026-004-SGTRANS'
  and p.authority_state::text='CONFIRMED'
  and p.lifecycle_state::text='ACTIVE'
  and p.bank_fact_status::text='BANK_CONFIRMED'
  and p.finance_verification_status::text='VERIFIED'
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select 'FINANCE_COUNTERPARTY:ORIENT_LOGISTIC',p.counterparty_name,p.counterparty_role,
       'VERIFIED_PAYMENT','OUT-2026-004-ORIENT',
       jsonb_build_array('PAYMENT:OUT-2026-004-ORIENT','BANK_DOC:1808256','CONTRACT_NO:OL 9-2026')
from portal_private.payments p
where p.payment_id='OUT-2026-004-ORIENT'
  and p.authority_state::text='CONFIRMED'
  and p.lifecycle_state::text='ACTIVE'
  and p.bank_fact_status::text='BANK_CONFIRMED'
  and p.finance_verification_status::text='VERIFIED'
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select 'BANK:BAKAI',p.counterparty_name,'BANK','VERIFIED_BANK_PAYMENT',p.payment_id,
       jsonb_build_array('PAYMENT:'||p.payment_id,'BANK_SOURCE:BAKAI_BANK_STATEMENT')
from portal_private.payments p
where p.counterparty_name='ОАО «БАКАЙ БАНК»'
  and p.authority_state::text='CONFIRMED'
  and p.lifecycle_state::text='ACTIVE'
  and p.bank_fact_status::text='BANK_CONFIRMED'
order by p.source_timestamp desc nulls last
limit 1
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select 'SUPPLIER:S-009',p.counterparty_name,'SUPPLIER',
       'VERIFIED_PAYMENT_AND_CONTRACT','RONA-S009-CTR-2026-001',
       jsonb_build_array('PAYMENT:OUT-2026-005006-KUZMASH','CONTRACT:RONA-S009-CTR-2026-001')
from portal_private.payments p
where p.payment_id='OUT-2026-005006-KUZMASH'
  and p.authority_state::text='CONFIRMED'
  and p.lifecycle_state::text='ACTIVE'
  and p.bank_fact_status::text='BANK_CONFIRMED'
  and p.finance_verification_status::text='VERIFIED'
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs
)
select
  'SUPPLIER:S-001',
  'ЗАО «Белорусская нефтяная компания»',
  'SUPPLIER',
  'VERIFIED_PAYMENT_CONTRACT_AND_SIGNED_DRIVE_SOURCE',
  'RONA-S001-CTR-2026-001',
  jsonb_build_array(
    'PAYMENT:OUT-2026-004-BNK',
    'CONTRACT:RONA-S001-CTR-2026-001',
    'BANK_PURPOSE:UNP_190832326',
    'DRIVE:CONTRACT_ЗАО_БНК_8-4-9-598_2026-07-14_SIGNED.pdf',
    'DRIVE:LETTER_OUT_ЗАО_БНК_RONA-S001-OUT-2026-001_2026-08-25_SIGNED_STAMPED_REGISTERED.pdf'
  )
where exists (
  select 1
  from portal_private.payments p
  join portal_private.contracts c
    on c.contract_id='RONA-S001-CTR-2026-001'
   and c.counterparty_code='S-001'
   and c.authority_state::text='CONFIRMED'
   and c.lifecycle_state::text='ACTIVE'
  where p.payment_id='OUT-2026-004-BNK'
    and p.counterparty_name='ЗАО «БНК»'
    and p.beneficiary_name='ЗАО «БНК»'
    and p.amount=8484210
    and btrim(p.currency)='RUB'
    and p.authority_state::text='CONFIRMED'
    and p.lifecycle_state::text='ACTIVE'
    and p.bank_fact_status::text='BANK_CONFIRMED'
    and p.finance_verification_status::text='VERIFIED'
)
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_aliases_v1(
 alias_id,canonical_counterparty_id,alias_scope,raw_alias,normalized_alias,
 required_purpose_regex,direction,currency,intermediary_from_raw,priority,
 resolution_source,evidence_refs
)
values
('FARGONA_RAW_1','CLIENT:RONA-C002','RAW_SOURCE','FARGONA GAZ TULDIRISH STANTSIYASI LLC',
 portal_private.finance_counterparty_normalize_name_v1('FARGONA GAZ TULDIRISH STANTSIYASI LLC'),
 '01/(PT|РТ)-01-1926',null,'USD',false,200,
 'CANONICAL_CLIENT+CONTRACT_PURPOSE',
 jsonb_build_array('CLIENT:RONA-C002','CONTRACT:RONA-C002-CTR-2026-001','BANK_DOC:2301886','BANK_DOC:2304421')),

('FARGONA_RAW_2','CLIENT:RONA-C002','RAW_SOURCE','GAZ TULDIRISH STANTSIYASI LLC',
 portal_private.finance_counterparty_normalize_name_v1('GAZ TULDIRISH STANTSIYASI LLC'),
 '01/(PT|РТ)-01-1926',null,'USD',false,200,
 'CANONICAL_CLIENT+VERIFIED_PAYMENT',
 jsonb_build_array('CLIENT:RONA-C002','PAYMENT:PAYEV-2026-000001')),

('FARGONA_PAY','CLIENT:RONA-C002','PAYMENT_COUNTERPARTY',
 'Общество с ограниченной ответственностью «FARG‘ONA GAZ TO‘LDIRISH STANSIYASI»',
 portal_private.finance_counterparty_normalize_name_v1('Общество с ограниченной ответственностью «FARG‘ONA GAZ TO‘LDIRISH STANSIYASI»'),
 null,null,null,false,300,
 'CANONICAL_CLIENT+EXACT_PAYMENT',
 jsonb_build_array('CLIENT:RONA-C002','PAYMENT:PAYEV-2026-000001')),

('UNIVERSAL_RAW','CLIENT:RONA-C003','RAW_SOURCE','UNVERSAL SOLYARIS GRAND JV LLC',
 portal_private.finance_counterparty_normalize_name_v1('UNVERSAL SOLYARIS GRAND JV LLC'),
 null,'INCOMING','USD',false,150,
 'CANONICAL_CLIENT+VERIFIED_PAYMENT',
 jsonb_build_array('CLIENT:RONA-C003','PAYMENT:PAYEV-2026-000002','PAYMENT:PAYEV-2026-000003')),

('UNIVERSAL_PAY','CLIENT:RONA-C003','PAYMENT_COUNTERPARTY',
 'Совместное предприятие Общество с ограниченной ответственностью «UNVERSAL SOLYARIS GRAND»',
 portal_private.finance_counterparty_normalize_name_v1('Совместное предприятие Общество с ограниченной ответственностью «UNVERSAL SOLYARIS GRAND»'),
 null,null,null,false,300,
 'CANONICAL_CLIENT+EXACT_PAYMENT',
 jsonb_build_array('CLIENT:RONA-C003','PAYMENT:PAYEV-2026-000002')),

('GAZONE_RAW','CLIENT:RONA-C005','RAW_SOURCE','OSOO GAZONe',
 portal_private.finance_counterparty_normalize_name_v1('OSOO GAZONe'),
 null,'INCOMING','RUB',false,150,
 'CANONICAL_CLIENT_CONTROLLED_ALIAS',
 jsonb_build_array('CLIENT:RONA-C005')),

('SGTRANS_RAW_1','FINANCE_COUNTERPARTY:SGTRANS','RAW_SOURCE','РУП СГ-ТРАНС',
 portal_private.finance_counterparty_normalize_name_v1('РУП СГ-ТРАНС'),
 '134-1-26',null,'RUB',false,220,
 'VERIFIED_PAYMENT_CONTROLLED_ALIAS',
 jsonb_build_array('PAYMENT:OUT-2026-004-SGTRANS','BANK_DOC:5967658','CONTRACT_NO:134-1-26')),

('SGTRANS_RAW_2','FINANCE_COUNTERPARTY:SGTRANS','RAW_SOURCE','РУП «СГ-ТРАНС»',
 portal_private.finance_counterparty_normalize_name_v1('РУП «СГ-ТРАНС»'),
 null,null,'RUB',false,210,
 'VERIFIED_PAYMENT_CONTROLLED_ALIAS',
 jsonb_build_array('PAYMENT:OUT-2026-004-SGTRANS')),

('SGTRANS_PAY','FINANCE_COUNTERPARTY:SGTRANS','PAYMENT_COUNTERPARTY','РУП «СГ-ТРАНС»',
 portal_private.finance_counterparty_normalize_name_v1('РУП «СГ-ТРАНС»'),
 null,null,'RUB',false,320,
 'EXACT_VERIFIED_PAYMENT',
 jsonb_build_array('PAYMENT:OUT-2026-004-SGTRANS')),

('ORIENT_RAW_1','FINANCE_COUNTERPARTY:ORIENT_LOGISTIC','RAW_SOURCE','ТОО ORIENT LOGISTIC',
 portal_private.finance_counterparty_normalize_name_v1('ТОО ORIENT LOGISTIC'),
 'OL 9-2026',null,'KZT',false,220,
 'VERIFIED_PAYMENT_CONTROLLED_ALIAS',
 jsonb_build_array('PAYMENT:OUT-2026-004-ORIENT','BANK_DOC:1808256','CONTRACT_NO:OL 9-2026')),

('ORIENT_RAW_2','FINANCE_COUNTERPARTY:ORIENT_LOGISTIC','RAW_SOURCE','ТОО «Orient Logistic»',
 portal_private.finance_counterparty_normalize_name_v1('ТОО «Orient Logistic»'),
 null,null,'KZT',false,210,
 'VERIFIED_PAYMENT_CONTROLLED_ALIAS',
 jsonb_build_array('PAYMENT:OUT-2026-004-ORIENT')),

('ORIENT_PAY','FINANCE_COUNTERPARTY:ORIENT_LOGISTIC','PAYMENT_COUNTERPARTY','ТОО «Orient Logistic»',
 portal_private.finance_counterparty_normalize_name_v1('ТОО «Orient Logistic»'),
 null,null,'KZT',false,320,
 'EXACT_VERIFIED_PAYMENT',
 jsonb_build_array('PAYMENT:OUT-2026-004-ORIENT')),

('BAKAI_PAY_1','BANK:BAKAI','PAYMENT_COUNTERPARTY','ОАО «БАКАЙ БАНК»',
 portal_private.finance_counterparty_normalize_name_v1('ОАО «БАКАЙ БАНК»'),
 null,null,null,false,350,
 'VERIFIED_BANK_PAYMENT',
 jsonb_build_array('BAKAI_BANK_STATEMENT','PAYMENT:PAYEV-2026-000017')),

('BAKAI_PAY_2','BANK:BAKAI','PAYMENT_COUNTERPARTY','BAKAI Bank',
 portal_private.finance_counterparty_normalize_name_v1('BAKAI Bank'),
 null,null,null,false,340,
 'VERIFIED_BANK_PAYMENT_ALIAS',
 jsonb_build_array('PAYMENT:OUT-2026-004-SGTRANS-FEE','PAYMENT:OUT-2026-004-ORIENT-FEE')),

('BAKAI_PAY_3','BANK:BAKAI','PAYMENT_COUNTERPARTY','BAKAI BANK FX CONVERSION',
 portal_private.finance_counterparty_normalize_name_v1('BAKAI BANK FX CONVERSION'),
 null,null,null,false,340,
 'VERIFIED_FX_PAYMENT_ALIAS',
 jsonb_build_array('BANK_CONFIRMED_INTERNAL_TRANSFER')),

('BAKAI_BANK_1','BANK:BAKAI','SOURCE_BANK','ОАО "БАКАЙ БАНК"',
 portal_private.finance_counterparty_normalize_name_v1('ОАО "БАКАЙ БАНК"'),
 null,null,null,false,400,
 'BANK_STATEMENT_SOURCE_BANK',
 jsonb_build_array('AI-FINANCE/BANK_STATEMENT')),

('BAKAI_BANK_2','BANK:BAKAI','SOURCE_BANK','ОАО «БАКАЙ БАНК»',
 portal_private.finance_counterparty_normalize_name_v1('ОАО «БАКАЙ БАНК»'),
 null,null,null,false,400,
 'BANK_STATEMENT_SOURCE_BANK',
 jsonb_build_array('AI-FINANCE/BANK_STATEMENT')),

('KUZMASH_PAY','SUPPLIER:S-009','PAYMENT_COUNTERPARTY','ЧПТУП «КУЗМАШ»',
 portal_private.finance_counterparty_normalize_name_v1('ЧПТУП «КУЗМАШ»'),
 null,null,'RUB',false,320,
 'VERIFIED_PAYMENT+SUPPLIER_CONTRACT',
 jsonb_build_array('PAYMENT:OUT-2026-005006-KUZMASH','CONTRACT:RONA-S009-CTR-2026-001')),

('BNK_PAY','SUPPLIER:S-001','PAYMENT_COUNTERPARTY','ЗАО «БНК»',
 portal_private.finance_counterparty_normalize_name_v1('ЗАО «БНК»'),
 null,null,'RUB',false,350,
 'VERIFIED_PAYMENT+SUPPLIER_CONTRACT',
 jsonb_build_array('PAYMENT:OUT-2026-004-BNK','CONTRACT:RONA-S001-CTR-2026-001')),

('BNK_INTERMEDIARY_FULL','SUPPLIER:S-001','RAW_SOURCE',
 'ОАО АКЦИОНЕРНЫЙ СБЕРЕГАТЕЛЬНЫЙ БАНК БЕЛАРУСБАНК',
 portal_private.finance_counterparty_normalize_name_v1('ОАО АКЦИОНЕРНЫЙ СБЕРЕГАТЕЛЬНЫЙ БАНК БЕЛАРУСБАНК'),
 '(190832326.*БЕЛОРУССКАЯ[[:space:]]+НЕФТЯНАЯ[[:space:]]+КОМПАНИЯ|БЕЛОРУССКАЯ[[:space:]]+НЕФТЯНАЯ[[:space:]]+КОМПАНИЯ.*190832326)',
 'OUTGOING','RUB',true,500,
 'BANK_PURPOSE_UNP+VERIFIED_PAYMENT+SUPPLIER_CONTRACT',
 jsonb_build_array('BANK_DOC:2443983','BANK_PURPOSE:UNP_190832326','PAYMENT:OUT-2026-004-BNK','CONTRACT:RONA-S001-CTR-2026-001')),

('BNK_INTERMEDIARY_SHORT','SUPPLIER:S-001','RAW_SOURCE',
 'ОАО АСБ БЕЛАРУСБАНК',
 portal_private.finance_counterparty_normalize_name_v1('ОАО АСБ БЕЛАРУСБАНК'),
 '(190832326.*БЕЛОРУССКАЯ[[:space:]]+НЕФТЯНАЯ[[:space:]]+КОМПАНИЯ|БЕЛОРУССКАЯ[[:space:]]+НЕФТЯНАЯ[[:space:]]+КОМПАНИЯ.*190832326)',
 'OUTGOING','RUB',true,500,
 'BANK_PURPOSE_UNP+VERIFIED_PAYMENT+SUPPLIER_CONTRACT',
 jsonb_build_array('PAYMENT:OUT-2026-004-BNK','CONTRACT:RONA-S001-CTR-2026-001'))
on conflict (alias_id) do nothing;

update portal_private.finance_counterparty_aliases_v1
set normalized_alias=portal_private.finance_counterparty_normalize_name_v1(raw_alias)
where normalized_alias is distinct from portal_private.finance_counterparty_normalize_name_v1(raw_alias);

create or replace view portal_private.finance_cash_operations_identity_v1
with (security_invoker = true)
as
with base as (
  select
    o.*,
    p.counterparty_name as payment_counterparty_name,
    p.counterparty_role as payment_counterparty_role,
    p.bank_fact_status::text as payment_bank_fact_status,
    p.finance_verification_status::text as payment_verification_status,
    (
      coalesce(o.finance_payment_kind='BANK_FEE',false)
      or upper(btrim(coalesce(o.purpose,''))) ~ '^(СТОРНО[[:space:]]+)?КОМИССИЯ'
    ) as bank_fee_flag
  from portal_private.finance_cash_operations_current_v1 o
  left join portal_private.payments p
    on p.payment_id=o.finance_payment_id
   and p.authority_state::text='CONFIRMED'
   and p.lifecycle_state::text='ACTIVE'
   and p.bank_fact_status::text='BANK_CONFIRMED'
   and p.finance_verification_status::text='VERIFIED'
),
resolved as (
  select
    b.*,
    r.alias_id,
    r.alias_scope,
    r.canonical_counterparty_id as resolved_id,
    r.canonical_counterparty_name as resolved_name,
    r.resolved_role,
    r.intermediary_from_raw,
    r.resolution_source,
    r.resolution_evidence_refs
  from base b
  left join lateral (
    select
      a.alias_id,
      a.alias_scope,
      i.canonical_counterparty_id,
      i.canonical_counterparty_name,
      i.counterparty_role as resolved_role,
      a.intermediary_from_raw,
      a.resolution_source,
      (i.evidence_refs || a.evidence_refs) as resolution_evidence_refs
    from portal_private.finance_counterparty_aliases_v1 a
    join portal_private.finance_counterparty_identities_v1 i
      on i.canonical_counterparty_id=a.canonical_counterparty_id
     and i.lifecycle_state='ACTIVE'
     and i.source_locked=true
    where a.lifecycle_state='ACTIVE'
      and a.source_locked=true
      and (
        (
          b.bank_fee_flag
          and a.alias_scope='SOURCE_BANK'
          and a.normalized_alias=portal_private.finance_counterparty_normalize_name_v1(b.bank_name)
        )
        or
        (
          not b.bank_fee_flag
          and b.finance_payment_id is not null
          and a.alias_scope='PAYMENT_COUNTERPARTY'
          and a.normalized_alias=portal_private.finance_counterparty_normalize_name_v1(b.payment_counterparty_name)
        )
        or
        (
          not b.bank_fee_flag
          and a.alias_scope='RAW_SOURCE'
          and a.normalized_alias=portal_private.finance_counterparty_normalize_name_v1(b.source_counterparty)
        )
        or
        (
          not b.bank_fee_flag
          and b.operation_type='FX_CONVERSION'
          and a.alias_scope='SOURCE_BANK'
          and a.normalized_alias=portal_private.finance_counterparty_normalize_name_v1(b.bank_name)
        )
      )
      and (a.required_purpose_regex is null or coalesce(b.purpose,'') ~* a.required_purpose_regex)
      and (a.direction is null or a.direction=b.direction)
      and (a.currency is null or btrim(a.currency)=b.currency)
    order by
      case
        when b.bank_fee_flag and a.alias_scope='SOURCE_BANK' then 1000
        when b.finance_payment_id is not null and a.alias_scope='PAYMENT_COUNTERPARTY' then 900
        when a.alias_scope='RAW_SOURCE' and a.required_purpose_regex is not null then 850
        when a.alias_scope='RAW_SOURCE' then 800
        when a.alias_scope='SOURCE_BANK' then 700
        else 0
      end + a.priority desc,
      a.alias_id
    limit 1
  ) r on true
),
final as (
  select
    x.*,
    case
      when x.resolved_id is not null then x.resolved_id
      when x.finance_payment_id is not null and x.payment_counterparty_name is not null
        then 'PAYMENT:'||x.finance_payment_id
      else null
    end as final_canonical_id,
    case
      when x.resolved_name is not null then x.resolved_name
      when x.finance_payment_id is not null and x.payment_counterparty_name is not null
        then x.payment_counterparty_name
      else null
    end as final_canonical_name,
    case
      when x.resolved_role is not null then x.resolved_role
      when x.finance_payment_id is not null then x.payment_counterparty_role
      else null
    end as final_role,
    case
      when x.resolved_id is not null then 'RESOLVED'
      when x.finance_payment_id is not null and x.payment_counterparty_name is not null
        then 'RESOLVED_TRANSACTION_ONLY'
      else 'TO_VERIFY'
    end as resolution_status,
    case
      when x.resolution_source is not null then x.resolution_source
      when x.finance_payment_id is not null and x.payment_counterparty_name is not null
        then 'EXACT_PAYMENT_LINK_NO_ENTITY_ALIAS'
      else 'UNRESOLVED_RAW_SOURCE'
    end as final_resolution_source,
    case
      when x.resolution_evidence_refs is not null then x.resolution_evidence_refs
      when x.finance_payment_id is not null then jsonb_build_array('PAYMENT:'||x.finance_payment_id)
      else jsonb_build_array(x.source_ref)
    end as final_evidence_refs,
    case
      when x.intermediary_from_raw then x.source_counterparty
      when x.resolved_id is not null
       and portal_private.finance_counterparty_normalize_name_v1(x.source_counterparty)
           is distinct from portal_private.finance_counterparty_normalize_name_v1(x.resolved_name)
       and upper(coalesce(x.source_counterparty,'')) ~ '(БАНК|BANK)'
        then x.source_counterparty
      when x.finance_payment_id is not null
       and portal_private.finance_counterparty_normalize_name_v1(x.source_counterparty)
           is distinct from portal_private.finance_counterparty_normalize_name_v1(x.payment_counterparty_name)
       and upper(coalesce(x.source_counterparty,'')) ~ '(БАНК|BANK)'
        then x.source_counterparty
      else null
    end as final_intermediary_name
  from resolved x
)
select
  f.id,
  f.operation_fingerprint,
  f.account_identity,
  f.currency,
  f.operation_date,
  f.executed_at_local,
  f.bank_document_number,
  f.direction,
  f.amount,
  f.operation_type,
  coalesce(f.final_canonical_name,f.counterparty,f.source_counterparty) as counterparty,
  f.source_counterparty,
  f.purpose,
  f.running_balance,
  f.source_ref,
  f.source_set_identity,
  f.source_uid,
  f.source_filename,
  f.source_checksum_sha256,
  f.bank_name,
  f.statement_date,
  f.period_start,
  f.period_end,
  f.generated_at_local,
  f.finance_payment_id,
  f.source_locked,
  f.finance_payment_kind,
  f.bank_fee_flag as bank_fee,
  f.final_canonical_id='CLIENT:RONA-C002' as fargona,
  f.final_canonical_id='FINANCE_COUNTERPARTY:SGTRANS' as sgtrans,
  f.final_canonical_id='FINANCE_COUNTERPARTY:ORIENT_LOGISTIC' as orient,
  f.final_canonical_id='SUPPLIER:S-001' as bnk,
  f.final_canonical_id as canonical_counterparty_id,
  f.final_canonical_name as canonical_counterparty_name,
  f.final_role as counterparty_role,
  f.source_counterparty as raw_source_counterparty,
  f.final_intermediary_name as bank_intermediary_name,
  f.final_resolution_source as counterparty_identity_source,
  f.resolution_status as counterparty_resolution_status,
  f.final_resolution_source as counterparty_resolution_source,
  f.final_evidence_refs as counterparty_resolution_evidence_refs,
  f.bank_name as source_bank_name,
  f.final_intermediary_name as intermediary_name
from final f;

comment on view portal_private.finance_cash_operations_identity_v1 is
  'Finance-owned canonical counterparty resolution for Admin Cash. Raw bank party is preserved; canonical business identity is resolved only through source-locked Client/Payment/Contract/controlled-alias evidence. Unknown identities remain TO_VERIFY.';

revoke all on portal_private.finance_cash_operations_identity_v1
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
  from portal_private.finance_cash_operations_identity_v1 o,bounds b
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
    'finance_payment_id',o.finance_payment_id
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
  'counterpartyIdentityVersion','FINANCE_COUNTERPARTY_IDENTITY_V1',
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
  'counterpartyResolution',identity_stats.v,
  'operations',ops.v,
  'dailySummary',days.v,
  'periodSummary',periods.v,
  'statementSummaries',statements.v,
  'checkpointAudit',checkpoints.v,
  'controls',controls.v
)
from bounds b,ops,identity_stats,days,periods,statements,checkpoints,controls;
$$;

revoke all on function portal_private.finance_cash_source_projection_payload_v1(date,date)
from public,anon,authenticated;

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
  select portal_private.finance_cash_source_projection_payload_v1(p_from,p_to);
$$;

revoke all on function portal_private.finance_cash_source_projection_payload_v2_identity(date,date)
from public,anon,authenticated;

comment on function portal_private.finance_cash_source_projection_payload_v2_identity(date,date) is
  'Backward-compatible identity projection wrapper. Canonical counterparty resolution is fully Finance-owned inside FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE; no UI/hardcoded identity rewrite is permitted here.';

commit;
