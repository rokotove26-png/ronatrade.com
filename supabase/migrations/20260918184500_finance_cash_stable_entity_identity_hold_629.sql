-- System Admin HOLD #629 / comment 5731946119
-- DELTA ONLY: enforce stable legal-entity canonical IDs in Finance Cash identity projection.
-- No bank amount, ledger, Payment, PaymentAllocation, Deal or source-lock business fact is mutated.

begin;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs,source_locked,lifecycle_state
)
select
  'COUNTERPARTY:SGTRANS',canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs,source_locked,'ACTIVE'
from portal_private.finance_counterparty_identities_v1
where canonical_counterparty_id='FINANCE_COUNTERPARTY:SGTRANS'
on conflict (canonical_counterparty_id) do nothing;

insert into portal_private.finance_counterparty_identities_v1(
  canonical_counterparty_id,canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs,source_locked,lifecycle_state
)
select
  'COUNTERPARTY:ORIENT_LOGISTIC',canonical_counterparty_name,counterparty_role,
  identity_authority_type,identity_authority_ref,evidence_refs,source_locked,'ACTIVE'
from portal_private.finance_counterparty_identities_v1
where canonical_counterparty_id='FINANCE_COUNTERPARTY:ORIENT_LOGISTIC'
on conflict (canonical_counterparty_id) do nothing;

update portal_private.finance_counterparty_aliases_v1
set canonical_counterparty_id='COUNTERPARTY:SGTRANS'
where canonical_counterparty_id='FINANCE_COUNTERPARTY:SGTRANS';

update portal_private.finance_counterparty_aliases_v1
set canonical_counterparty_id='COUNTERPARTY:ORIENT_LOGISTIC'
where canonical_counterparty_id='FINANCE_COUNTERPARTY:ORIENT_LOGISTIC';

update portal_private.finance_counterparty_identities_v1
set lifecycle_state='SUPERSEDED'
where canonical_counterparty_id in (
  'FINANCE_COUNTERPARTY:SGTRANS',
  'FINANCE_COUNTERPARTY:ORIENT_LOGISTIC'
);

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
    x.resolved_id as final_canonical_id,
    x.resolved_name as final_canonical_name,
    x.resolved_role as final_role,
    case
      when x.resolved_id is not null then 'RESOLVED'
      else 'TO_VERIFY'
    end as resolution_status,
    case
      when x.resolution_source is not null then x.resolution_source
      else 'UNRESOLVED_NO_STABLE_ENTITY_ID'
    end as final_resolution_source,
    case
      when x.resolution_evidence_refs is not null then x.resolution_evidence_refs
      when x.finance_payment_id is not null then jsonb_build_array('PAYMENT:'||x.finance_payment_id,x.source_ref)
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
  f.final_canonical_id='COUNTERPARTY:SGTRANS' as sgtrans,
  f.final_canonical_id='COUNTERPARTY:ORIENT_LOGISTIC' as orient,
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
  'Finance-owned canonical counterparty resolution for Admin Cash. Raw bank party is preserved; canonical business identity is resolved only through source-locked Client/Payment/Contract/controlled-alias evidence. Unknown identities remain TO_VERIFY and never receive PAYMENT:* as canonical_counterparty_id.';

revoke all on portal_private.finance_cash_operations_identity_v1
from public,anon,authenticated;



commit;
