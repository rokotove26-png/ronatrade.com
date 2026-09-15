begin;

create table if not exists portal_private.payment_passport_finance_allocations_v7 (
  id uuid primary key default gen_random_uuid(),
  proposal_record_id uuid not null,
  finance_conclusion_id uuid not null,
  approval_record_id uuid not null,
  deal_key uuid not null,
  deal_id text not null,
  payment_key uuid not null,
  payment_id text not null,
  calculated_funding_amount numeric not null check (calculated_funding_amount >= 0),
  funding_currency text not null check (btrim(funding_currency) <> ''),
  conversion_event_id text not null check (btrim(conversion_event_id) <> ''),
  actual_conversion_rate numeric not null check (actual_conversion_rate > 0),
  calculation_method text not null,
  authority_status text not null,
  funding_allocation_status text not null default 'AUTHORITATIVE',
  source_locked boolean not null default true,
  source_version text not null,
  source_timestamp timestamptz not null,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint payment_passport_finance_allocations_v7_authority_ck
    check (authority_status = 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS'),
  constraint payment_passport_finance_allocations_v7_method_ck
    check (calculation_method = 'ACTUAL_SETTLEMENT_DIV_ACTUAL_BANK_FX'),
  constraint payment_passport_finance_allocations_v7_status_ck
    check (funding_allocation_status = 'AUTHORITATIVE'),
  constraint payment_passport_finance_allocations_v7_source_locked_ck
    check (source_locked = true),
  constraint payment_passport_finance_allocations_v7_proposal_payment_uq
    unique (proposal_record_id, payment_key)
);

create index if not exists payment_passport_finance_allocations_v7_deal_payment_idx
  on portal_private.payment_passport_finance_allocations_v7 (deal_key, payment_key, source_timestamp desc, created_at desc);

create or replace view portal_private.payment_passport_finance_allocations_current_v7 as
select distinct on (deal_key, payment_key)
  id,
  proposal_record_id,
  finance_conclusion_id,
  approval_record_id,
  deal_key,
  deal_id,
  payment_key,
  payment_id,
  calculated_funding_amount,
  funding_currency,
  conversion_event_id,
  actual_conversion_rate,
  calculation_method,
  authority_status,
  funding_allocation_status,
  source_locked,
  source_version,
  source_timestamp,
  source_refs,
  created_at
from portal_private.payment_passport_finance_allocations_v7
where source_locked = true
  and funding_allocation_status = 'AUTHORITATIVE'
order by deal_key, payment_key, source_timestamp desc, created_at desc, id desc;

create or replace function portal_private.payment_passport_finance_allocations_immutable_v7()
returns trigger
language plpgsql
set search_path = portal_private, public
as $$
begin
  raise exception 'PAYMENT_PASSPORT_FINANCE_ALLOCATIONS_V7_IMMUTABLE';
end;
$$;

revoke all on function portal_private.payment_passport_finance_allocations_immutable_v7() from public;

drop trigger if exists payment_passport_finance_allocations_immutable_v7
  on portal_private.payment_passport_finance_allocations_v7;
create trigger payment_passport_finance_allocations_immutable_v7
before update or delete on portal_private.payment_passport_finance_allocations_v7
for each row execute function portal_private.payment_passport_finance_allocations_immutable_v7();

create or replace function portal_private.materialize_payment_passport_finance_allocations_v7(
  p_proposal_record_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = portal_private, public
as $$
declare
  v_proposal portal_private.ai_coordination_records%rowtype;
  v_conclusion portal_private.ai_coordination_records%rowtype;
  v_approval portal_private.ai_coordination_records%rowtype;
  v_value jsonb;
  v_conclusion_id uuid;
  v_deal_key uuid;
  v_deal_id text;
  v_deal_count integer;
  v_funding_currency text;
  v_authority_status text;
  v_calculation_method text;
  v_allocation record;
  v_payment record;
  v_payment_count integer;
  v_attribution_count integer;
  v_conversion_count integer;
  v_conversion_event_id text;
  v_actual_rate numeric;
  v_calculated_amount numeric;
  v_inserted integer := 0;
begin
  select * into v_proposal
  from portal_private.ai_coordination_records
  where record_id = p_proposal_record_id;

  if not found
    or v_proposal.record_type <> 'BUSINESS_CHANGE_PROPOSAL'
    or v_proposal.functional_role::text <> 'FINANCE'
    or v_proposal.status <> 'PROPOSED'
    or coalesce(v_proposal.qa_only, false)
    or v_proposal.payload->>'proposed_action' <> 'MATERIALIZE_TO_PAYMENTS_PROJECTION'
  then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_PROPOSAL_INVALID';
  end if;

  if exists (
    select 1 from portal_private.ai_coordination_records newer
    where newer.supersedes_id = v_proposal.record_id
  ) then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_PROPOSAL_SUPERSEDED';
  end if;

  v_value := v_proposal.payload->'proposed_value';
  if jsonb_typeof(v_value) <> 'object'
    or jsonb_typeof(v_value->'allocations') <> 'object'
  then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_VALUE_INVALID';
  end if;

  begin
    v_conclusion_id := (v_value->>'finance_conclusion_id')::uuid;
  exception when others then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_CONCLUSION_ID_INVALID';
  end;

  select * into v_conclusion
  from portal_private.ai_coordination_records
  where record_id = v_conclusion_id;

  if not found
    or v_conclusion.record_type <> 'FUNCTIONAL_CONCLUSION'
    or v_conclusion.functional_role::text <> 'FINANCE'
    or v_conclusion.target_type <> 'DEAL'
    or v_conclusion.status not in ('APPROVED', 'APPROVED_WITH_CONDITIONS')
    or coalesce(v_conclusion.qa_only, false)
    or coalesce((v_conclusion.payload->>'confirmed')::boolean, false) <> true
  then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_CONCLUSION_INVALID';
  end if;

  if exists (
    select 1 from portal_private.ai_coordination_records newer
    where newer.supersedes_id = v_conclusion.record_id
  ) then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_CONCLUSION_SUPERSEDED';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_proposal.evidence_refs, '[]'::jsonb)) ref(value)
    where ref.value = v_conclusion.record_id::text
  ) then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_CONCLUSION_NOT_BOUND';
  end if;

  select approval.* into v_approval
  from portal_private.ai_coordination_records approval
  where approval.record_type = 'OPERATIONS_INTERNAL_DECISION'
    and approval.status = 'APPROVE_FOR_NEXT_STAGE'
    and coalesce(approval.qa_only, false) = false
    and approval.payload->>'action' = 'APPROVE_FOR_NEXT_STAGE'
    and approval.payload->>'record_id' = v_proposal.record_id::text
    and not exists (
      select 1 from portal_private.ai_coordination_records newer
      where newer.supersedes_id = approval.record_id
    )
  order by approval.created_at desc, approval.record_id desc
  limit 1;

  if not found then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_OPERATIONS_APPROVAL_REQUIRED';
  end if;

  v_deal_id := v_conclusion.target_id;
  select count(*) into v_deal_count
  from portal_private.deals
  where deal_id = v_deal_id
    and lifecycle_state::text <> 'ARCHIVED';

  if v_deal_count <> 1 then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_DEAL_NOT_UNIQUE';
  end if;

  select id into v_deal_key
  from portal_private.deals
  where deal_id = v_deal_id
    and lifecycle_state::text <> 'ARCHIVED';

  v_funding_currency := upper(btrim(v_value->>'funding_currency'));
  v_authority_status := upper(btrim(v_value->>'authority_status'));
  v_calculation_method := upper(btrim(v_value->>'calculation_method'));

  if v_funding_currency is null or v_funding_currency = ''
    or v_authority_status <> 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS'
    or v_calculation_method <> 'ACTUAL_SETTLEMENT_DIV_ACTUAL_BANK_FX'
  then
    raise exception 'FINANCE_SETTLEMENT_ALLOCATION_AUTHORITY_CONTRACT_INVALID';
  end if;

  for v_allocation in
    select key as payment_id, value as calculated_funding_amount
    from jsonb_each_text(v_value->'allocations')
    order by key
  loop
    begin
      v_calculated_amount := v_allocation.calculated_funding_amount::numeric;
    exception when others then
      raise exception 'FINANCE_SETTLEMENT_ALLOCATION_AMOUNT_INVALID';
    end;
    if v_calculated_amount < 0 then
      raise exception 'FINANCE_SETTLEMENT_ALLOCATION_AMOUNT_INVALID';
    end if;

    select count(*) into v_payment_count
    from portal_private.payments p
    where p.payment_id = v_allocation.payment_id
      and p.lifecycle_state::text = 'ACTIVE'
      and p.authority_state::text in ('VERIFIED', 'CONFIRMED')
      and p.bank_fact_status::text = 'BANK_CONFIRMED'
      and p.finance_verification_status::text in ('VERIFIED', 'PAID', 'CONFIRMED');

    if v_payment_count <> 1 then
      raise exception 'FINANCE_SETTLEMENT_ALLOCATION_BANK_PAYMENT_NOT_UNIQUE';
    end if;

    select p.id, p.payment_id, p.amount, p.currency into v_payment
    from portal_private.payments p
    where p.payment_id = v_allocation.payment_id
      and p.lifecycle_state::text = 'ACTIVE'
      and p.authority_state::text in ('VERIFIED', 'CONFIRMED')
      and p.bank_fact_status::text = 'BANK_CONFIRMED'
      and p.finance_verification_status::text in ('VERIFIED', 'PAID', 'CONFIRMED');

    select count(*) into v_attribution_count
    from portal_private.payment_business_attributions_v7 a
    join portal_private.payment_business_attribution_lines_v7 l on l.attribution_id = a.id
    where a.payment_key = v_payment.id
      and l.deal_key = v_deal_key
      and a.lifecycle_state::text = 'CURRENT'
      and a.authority_state::text = 'AUTHORITATIVE'
      and a.source_locked = true
      and upper(a.attribution_mode::text) = 'EXACT'
      and replace(upper(a.authority_kind::text), '_', '-') in ('FINANCE', 'FINANCE-AI', 'AI-FINANCE')
      and upper(coalesce(l.amount_status, 'EXACT')) = 'EXACT'
      and l.amount::numeric = v_payment.amount::numeric
      and upper(l.currency) = upper(v_payment.currency);

    if v_attribution_count <> 1 then
      raise exception 'FINANCE_SETTLEMENT_ALLOCATION_DEAL_ATTRIBUTION_INVALID';
    end if;

    v_conversion_event_id := v_value->'conversion_events'->>upper(v_payment.currency);
    if v_conversion_event_id is null or btrim(v_conversion_event_id) = '' then
      raise exception 'FINANCE_SETTLEMENT_ALLOCATION_CONVERSION_EVENT_MISSING';
    end if;

    select rate.value::numeric into v_actual_rate
    from jsonb_each_text(coalesce(v_value->'actual_rates', '{}'::jsonb)) rate(key, value)
    where upper(rate.key) = upper(v_payment.currency || '_per_' || v_funding_currency)
    limit 1;

    if v_actual_rate is null or v_actual_rate <= 0 then
      raise exception 'FINANCE_SETTLEMENT_ALLOCATION_ACTUAL_RATE_MISSING';
    end if;

    select count(*) into v_conversion_count
    from portal_private.payments funding_payment
    join portal_private.finance_events_v7 event on event.payment_key = funding_payment.id
    where funding_payment.payment_id = v_conversion_event_id
      and funding_payment.lifecycle_state::text = 'ACTIVE'
      and funding_payment.authority_state::text in ('VERIFIED', 'CONFIRMED')
      and funding_payment.bank_fact_status::text = 'BANK_CONFIRMED'
      and funding_payment.finance_verification_status::text in ('VERIFIED', 'PAID', 'CONFIRMED')
      and upper(funding_payment.currency) = v_funding_currency
      and event.actor_role = 'FINANCE'
      and event.event_type = 'OUTGOING_PAYMENT_CONFIRMED'
      and coalesce((event.result_snapshot->>'accepted')::boolean, false) = true
      and upper(event.request_snapshot->'payload'->>'funding_leg_kind') = 'FUNDING_SIDE_DEBIT'
      and upper(event.request_snapshot->'payload'->>'currency') = v_funding_currency
      and upper(event.request_snapshot->'payload'->>'acquired_currency') = upper(v_payment.currency);

    if v_conversion_count <> 1 then
      raise exception 'FINANCE_SETTLEMENT_ALLOCATION_CONVERSION_EVENT_INVALID';
    end if;

    insert into portal_private.payment_passport_finance_allocations_v7 (
      proposal_record_id,
      finance_conclusion_id,
      approval_record_id,
      deal_key,
      deal_id,
      payment_key,
      payment_id,
      calculated_funding_amount,
      funding_currency,
      conversion_event_id,
      actual_conversion_rate,
      calculation_method,
      authority_status,
      funding_allocation_status,
      source_locked,
      source_version,
      source_timestamp,
      source_refs
    ) values (
      v_proposal.record_id,
      v_conclusion.record_id,
      v_approval.record_id,
      v_deal_key,
      v_deal_id,
      v_payment.id,
      v_payment.payment_id,
      v_calculated_amount,
      v_funding_currency,
      v_conversion_event_id,
      v_actual_rate,
      v_calculation_method,
      v_authority_status,
      'AUTHORITATIVE',
      true,
      'FINANCE_CONCLUSION_V' || v_conclusion.version::text,
      greatest(v_conclusion.created_at, v_proposal.created_at, v_approval.created_at),
      coalesce(v_proposal.evidence_refs, '[]'::jsonb)
        || jsonb_build_array(
          v_proposal.record_id::text,
          v_conclusion.record_id::text,
          v_approval.record_id::text,
          v_payment.payment_id,
          v_conversion_event_id
        )
    )
    on conflict (proposal_record_id, payment_key) do nothing;

    if found then
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'accepted', true,
    'materialized', true,
    'proposal_record_id', v_proposal.record_id,
    'finance_conclusion_id', v_conclusion.record_id,
    'approval_record_id', v_approval.record_id,
    'deal_id', v_deal_id,
    'inserted', v_inserted,
    'projection_refresh_required', true
  );
end;
$$;

revoke all on function portal_private.materialize_payment_passport_finance_allocations_v7(uuid) from public;

revoke all on portal_private.payment_passport_finance_allocations_v7 from public;
revoke all on portal_private.payment_passport_finance_allocations_current_v7 from public;
grant select on portal_private.payment_passport_finance_allocations_current_v7 to rona_payments_v7_reader;

-- Backfill only already-approved structured Finance proposals. Values are copied from immutable
-- Finance source records; this migration contains no Deal/payment IDs, amounts or FX arithmetic.
do $$
declare
  candidate record;
begin
  for candidate in
    select proposal.record_id
    from portal_private.ai_coordination_records proposal
    where proposal.record_type = 'BUSINESS_CHANGE_PROPOSAL'
      and proposal.functional_role::text = 'FINANCE'
      and proposal.status = 'PROPOSED'
      and coalesce(proposal.qa_only, false) = false
      and proposal.payload->>'proposed_action' = 'MATERIALIZE_TO_PAYMENTS_PROJECTION'
      and jsonb_typeof(proposal.payload->'proposed_value'->'allocations') = 'object'
      and proposal.payload->'proposed_value'->>'finance_conclusion_id' is not null
      and exists (
        select 1
        from portal_private.ai_coordination_records approval
        where approval.record_type = 'OPERATIONS_INTERNAL_DECISION'
          and approval.status = 'APPROVE_FOR_NEXT_STAGE'
          and coalesce(approval.qa_only, false) = false
          and approval.payload->>'action' = 'APPROVE_FOR_NEXT_STAGE'
          and approval.payload->>'record_id' = proposal.record_id::text
      )
    order by proposal.created_at, proposal.record_id
  loop
    perform portal_private.materialize_payment_passport_finance_allocations_v7(candidate.record_id);
  end loop;
end;
$$;

commit;
