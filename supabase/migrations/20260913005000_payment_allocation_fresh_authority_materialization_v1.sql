-- PAYMENT_ALLOCATION FRESH AUTHORITY MATERIALIZATION V1
-- Server-only, proposal-derived, compare-and-swap supersede path.
-- This migration defines the mechanism only. It does not materialize production data.

create table if not exists portal_private.payment_allocation_authority_history_v1 (
  event_id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id) on delete restrict,
  payment_id text not null,
  old_allocation_id uuid not null references portal_private.payment_allocations(id) on delete restrict,
  new_allocation_id uuid not null references portal_private.payment_allocations(id) on delete restrict,
  expected_old_source_version text not null,
  finance_conclusion_id uuid not null references portal_private.ai_coordination_records(record_id) on delete restrict,
  finance_proposal_id uuid not null references portal_private.ai_coordination_records(record_id) on delete restrict,
  idempotency_key text not null,
  request_payload jsonb not null,
  old_snapshot jsonb not null,
  new_snapshot jsonb not null,
  result_payload jsonb not null,
  source_system text not null,
  source_version text not null,
  source_timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  constraint payment_allocation_authority_history_v1_idempotency_key_nonempty
    check (length(btrim(idempotency_key)) between 12 and 200),
  constraint payment_allocation_authority_history_v1_source_system_check
    check (source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION'),
  constraint payment_allocation_authority_history_v1_idempotency_uq unique(idempotency_key),
  constraint payment_allocation_authority_history_v1_proposal_uq unique(finance_proposal_id),
  constraint payment_allocation_authority_history_v1_new_allocation_uq unique(new_allocation_id)
);

alter table portal_private.payment_allocation_authority_history_v1 enable row level security;
revoke all on table portal_private.payment_allocation_authority_history_v1 from public, anon, authenticated, service_role;

create or replace function portal_private.reject_payment_allocation_authority_history_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
begin
  raise exception using errcode='55000',message='PAYMENT_ALLOCATION_AUTHORITY_HISTORY_IMMUTABLE';
end
$$;

revoke all on function portal_private.reject_payment_allocation_authority_history_mutation_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_payment_allocation_authority_history_immutable_v1
  on portal_private.payment_allocation_authority_history_v1;
create trigger trg_payment_allocation_authority_history_immutable_v1
before update or delete on portal_private.payment_allocation_authority_history_v1
for each row execute function portal_private.reject_payment_allocation_authority_history_mutation_v1();

-- Fresh rows are immutable in place. A later authority can only supersede them through
-- the controlled core function, which sets a transaction-local guard.
create or replace function portal_private.enforce_fresh_payment_allocation_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
begin
  if old.source_system <> 'FINANCE_SOURCE_LOCKED_RECONCILIATION' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  if tg_op='DELETE' then
    raise exception using errcode='55000',message='FRESH_PAYMENT_ALLOCATION_DELETE_FORBIDDEN';
  end if;

  if coalesce(current_setting('rona.payment_allocation_authority_mutation_v1',true),'') <> 'supersede' then
    raise exception using errcode='42501',message='FRESH_PAYMENT_ALLOCATION_IN_PLACE_MUTATION_FORBIDDEN';
  end if;

  if new.id is distinct from old.id
     or new.payment_key is distinct from old.payment_key
     or new.client_key is distinct from old.client_key
     or new.contract_key is distinct from old.contract_key
     or new.deal_key is distinct from old.deal_key
     or new.allocated_amount is distinct from old.allocated_amount
     or new.allocation_status is distinct from old.allocation_status
     or new.finance_status is distinct from old.finance_status
     or new.accounting_closure_status is distinct from old.accounting_closure_status
     or new.allocation_reference is distinct from old.allocation_reference
     or new.allocated_at is distinct from old.allocated_at
     or new.allocated_by is distinct from old.allocated_by
     or new.created_at is distinct from old.created_at
     or new.source_system is distinct from old.source_system
     or new.source_version is distinct from old.source_version
     or new.source_timestamp is distinct from old.source_timestamp
     or new.import_batch_id is distinct from old.import_batch_id then
    raise exception using errcode='55000',message='FRESH_PAYMENT_ALLOCATION_BUSINESS_FIELDS_IMMUTABLE';
  end if;

  if not (
    old.authority_state='CONFIRMED'::portal_private.authority_state_enum
    and old.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and new.authority_state='SUPERSEDED'::portal_private.authority_state_enum
    and new.lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum
  ) then
    raise exception using errcode='55000',message='FRESH_PAYMENT_ALLOCATION_ONLY_SUPERSEDE_TRANSITION_ALLOWED';
  end if;
  return new;
end
$$;

revoke all on function portal_private.enforce_fresh_payment_allocation_immutability_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_payment_allocation_fresh_immutable_v1
  on portal_private.payment_allocations;
create trigger trg_payment_allocation_fresh_immutable_v1
before update or delete on portal_private.payment_allocations
for each row execute function portal_private.enforce_fresh_payment_allocation_immutability_v1();

create or replace function portal_private.payment_allocation_fresh_authority_core_v1(
  p_payment_id text,
  p_expected_active_allocation_id uuid,
  p_expected_active_source_version text,
  p_finance_conclusion_id uuid,
  p_finance_proposal_id uuid,
  p_idempotency_key text,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_payment portal_private.payments%rowtype;
  v_old portal_private.payment_allocations%rowtype;
  v_new portal_private.payment_allocations%rowtype;
  v_target_deal portal_private.deals%rowtype;
  v_history portal_private.payment_allocation_authority_history_v1%rowtype;
  v_conclusion_payload jsonb;
  v_conclusion_created_at timestamptz;
  v_proposal_payload jsonb;
  v_proposal_evidence_refs jsonb;
  v_proposal_created_at timestamptz;
  v_value jsonb;
  v_allocation jsonb;
  v_deal_id text;
  v_allocated numeric;
  v_total numeric;
  v_residue numeric;
  v_source_system text := 'FINANCE_SOURCE_LOCKED_RECONCILIATION';
  v_source_version text;
  v_source_timestamp timestamptz;
  v_active_ids uuid[];
  v_request jsonb;
  v_plan_new jsonb;
  v_result jsonb;
begin
  if coalesce(btrim(p_payment_id),'')='' then
    raise exception using errcode='22023',message='PAYMENT_ID_REQUIRED';
  end if;
  if p_expected_active_allocation_id is null then
    raise exception using errcode='22023',message='EXPECTED_ACTIVE_ALLOCATION_ID_REQUIRED';
  end if;
  if coalesce(btrim(p_expected_active_source_version),'')='' then
    raise exception using errcode='22023',message='EXPECTED_ACTIVE_SOURCE_VERSION_REQUIRED';
  end if;
  if p_finance_conclusion_id is null or p_finance_proposal_id is null then
    raise exception using errcode='22023',message='FINANCE_AUTHORITY_IDS_REQUIRED';
  end if;
  if length(coalesce(btrim(p_idempotency_key),'')) not between 12 and 200 then
    raise exception using errcode='22023',message='IDEMPOTENCY_KEY_INVALID';
  end if;

  v_request:=jsonb_build_object(
    'contract','PAYMENT_ALLOCATION_FRESH_AUTHORITY_MATERIALIZATION_V1',
    'paymentId',p_payment_id,
    'expectedActiveAllocationId',p_expected_active_allocation_id,
    'expectedActiveSourceVersion',p_expected_active_source_version,
    'financeConclusionId',p_finance_conclusion_id,
    'financeProposalId',p_finance_proposal_id
  );

  -- Idempotency has no write side effect in dry-run mode.
  if not p_dry_run then
    perform pg_advisory_xact_lock(hashtextextended('payment-allocation-fresh-authority-v1:'||p_idempotency_key,0));
    select * into v_history
      from portal_private.payment_allocation_authority_history_v1
     where idempotency_key=p_idempotency_key;
    if found then
      if v_history.request_payload is distinct from v_request then
        raise exception using errcode='23505',message='PAYMENT_ALLOCATION_IDEMPOTENCY_CONFLICT';
      end if;
      return v_history.result_payload || jsonb_build_object('idempotentReplay',true,'dryRun',false);
    end if;
    if exists(select 1 from portal_private.payment_allocation_authority_history_v1
              where finance_proposal_id=p_finance_proposal_id) then
      raise exception using errcode='23505',message='FINANCE_PROPOSAL_ALREADY_MATERIALIZED';
    end if;
  end if;

  if p_dry_run then
    select * into v_payment from portal_private.payments where payment_id=p_payment_id;
  else
    select * into v_payment from portal_private.payments where payment_id=p_payment_id for update;
  end if;
  if not found then
    raise exception using errcode='P0001',message='PAYMENT_NOT_FOUND';
  end if;

  if v_payment.payment_direction<>'INCOMING'::portal_private.payment_direction_enum
     or v_payment.payment_kind<>'CLIENT_PAYMENT'::portal_private.payment_kind_enum
     or v_payment.deal_allocation_applicability<>'DEAL_ALLOCATABLE'::portal_private.deal_allocation_applicability_enum
     or v_payment.bank_fact_status<>'BANK_CONFIRMED'::portal_private.payment_bank_state_enum
     or v_payment.finance_verification_status<>'VERIFIED'::portal_private.finance_verification_state_enum
     or v_payment.authority_state<>'CONFIRMED'::portal_private.authority_state_enum
     or v_payment.lifecycle_state<>'ACTIVE'::portal_private.lifecycle_state_enum then
    raise exception using errcode='P0001',message='PAYMENT_NOT_ELIGIBLE_FOR_FRESH_ALLOCATION_AUTHORITY';
  end if;

  if p_dry_run then
    select * into v_old from portal_private.payment_allocations
     where id=p_expected_active_allocation_id and payment_key=v_payment.id;
  else
    select * into v_old from portal_private.payment_allocations
     where id=p_expected_active_allocation_id and payment_key=v_payment.id for update;
  end if;
  if not found
     or v_old.authority_state<>'CONFIRMED'::portal_private.authority_state_enum
     or v_old.lifecycle_state<>'ACTIVE'::portal_private.lifecycle_state_enum
     or v_old.allocation_status not in (
       'PARTIAL'::portal_private.payment_allocation_state_enum,
       'ALLOCATED'::portal_private.payment_allocation_state_enum,
       'VERIFIED'::portal_private.payment_allocation_state_enum)
     or v_old.source_version is distinct from p_expected_active_source_version then
    raise exception using errcode='40001',message='PAYMENT_ALLOCATION_CAS_CONFLICT';
  end if;

  select array_agg(pa.id order by pa.id::text) into v_active_ids
    from portal_private.payment_allocations pa
   where pa.payment_key=v_payment.id
     and pa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and pa.allocation_status in (
       'PARTIAL'::portal_private.payment_allocation_state_enum,
       'ALLOCATED'::portal_private.payment_allocation_state_enum,
       'VERIFIED'::portal_private.payment_allocation_state_enum);
  if coalesce(cardinality(v_active_ids),0)<>1 or v_active_ids[1] is distinct from p_expected_active_allocation_id then
    raise exception using errcode='40001',message='PAYMENT_ALLOCATION_ACTIVE_SET_CONFLICT';
  end if;

  select r.payload,r.created_at into v_conclusion_payload,v_conclusion_created_at
    from portal_private.ai_coordination_records r
   where r.record_id=p_finance_conclusion_id
     and r.record_type='FUNCTIONAL_CONCLUSION'
     and r.functional_role='FINANCE'::portal_private.ai_business_role_enum
     and r.target_type='PAYMENT' and r.target_id=p_payment_id
     and r.status='APPROVED' and r.qa_only=false;
  if not found
     or coalesce((v_conclusion_payload->>'confirmed')::boolean,false) is not true
     or coalesce(v_conclusion_payload->>'entity_type','')<>'PAYMENT'
     or coalesce(v_conclusion_payload->>'entity_id','')<>p_payment_id
     or jsonb_typeof(coalesce(v_conclusion_payload->'open_issues','[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(v_conclusion_payload->'open_issues','[]'::jsonb))<>0 then
    raise exception using errcode='P0001',message='FRESH_FINANCE_CONCLUSION_NOT_AUTHORITATIVE';
  end if;

  select r.payload,r.evidence_refs,r.created_at
    into v_proposal_payload,v_proposal_evidence_refs,v_proposal_created_at
    from portal_private.ai_coordination_records r
   where r.record_id=p_finance_proposal_id
     and r.record_type='BUSINESS_CHANGE_PROPOSAL'
     and r.functional_role='FINANCE'::portal_private.ai_business_role_enum
     and r.target_type='PAYMENT' and r.target_id=p_payment_id
     and r.status='PROPOSED' and r.qa_only=false;
  if not found
     or coalesce(v_proposal_payload->>'proposed_action','')<>'RECONCILE_CURRENT_PAYMENT_ALLOCATION'
     or coalesce(v_proposal_payload->>'proposed_field','')<>'payment_allocation.current'
     or not (coalesce(v_proposal_evidence_refs,'[]'::jsonb)
       @> to_jsonb(array['FINANCE_CONCLUSION:'||p_finance_conclusion_id::text]::text[])) then
    raise exception using errcode='P0001',message='FRESH_FINANCE_PROPOSAL_NOT_AUTHORITATIVE';
  end if;

  v_value:=v_proposal_payload->'proposed_value';
  if jsonb_typeof(v_value)<>'object'
     or coalesce(v_value->>'payment_id','')<>p_payment_id
     or coalesce(v_value->>'currency','')<>btrim(v_payment.currency)
     or coalesce((v_value->>'payment_amount')::numeric,-1)<>v_payment.amount
     or coalesce((v_value->>'preserve_audit_history')::boolean,false) is not true
     or coalesce((v_value->>'preserve_payment_amount')::boolean,false) is not true
     or jsonb_typeof(v_value->'allocations')<>'array'
     or jsonb_array_length(v_value->'allocations')<>1 then
    raise exception using errcode='P0001',message='FRESH_FINANCE_PROPOSAL_VALUE_INVALID';
  end if;

  v_allocation:=(v_value->'allocations')->0;
  v_deal_id:=v_allocation->>'deal_id';
  v_allocated:=(v_allocation->>'allocated_amount')::numeric;
  v_total:=(v_value->>'allocated_total')::numeric;
  v_residue:=(v_value->>'unallocated_residue')::numeric;
  if coalesce(v_deal_id,'')=''
     or v_allocated is null or v_allocated<=0
     or coalesce(v_allocation->>'allocation_status','')<>'VERIFIED_SOURCE_LOCKED'
     or v_total is distinct from v_allocated
     or v_residue is distinct from (v_payment.amount-v_allocated)
     or v_allocated<>v_payment.amount or v_residue<>0 then
    raise exception using errcode='P0001',message='FRESH_FINANCE_ALLOCATION_TOTALS_INVALID';
  end if;

  select * into v_target_deal from portal_private.deals where deal_id=v_deal_id;
  if not found then
    raise exception using errcode='P0001',message='FINANCE_PROPOSAL_DEAL_NOT_FOUND';
  end if;
  if not exists(select 1 from portal_private.resolve_deal_resource_state(v_target_deal.id) r
                where r.resource_status='RESOURCE_CONFIRMED') then
    raise exception using errcode='P0001',message='RESOURCE_CONFIRMATION_REQUIRED_BEFORE_PAYMENT';
  end if;

  v_source_timestamp:=greatest(v_conclusion_created_at,v_proposal_created_at);
  v_source_version:=format(
    'PAYMENT_ALLOCATION_FRESH_AUTHORITY_V1/FINANCE_CONCLUSION:%s/FINANCE_PROPOSAL:%s',
    p_finance_conclusion_id,p_finance_proposal_id);
  v_plan_new:=jsonb_build_object(
    'allocationId',null,'paymentId',p_payment_id,'dealId',v_deal_id,
    'allocatedAmount',v_allocated,'currency',btrim(v_payment.currency),
    'allocationStatus','VERIFIED','financeStatus',v_payment.finance_status::text,
    'accountingStatus',v_payment.accounting_closure_status::text,
    'sourceSystem',v_source_system,'sourceVersion',v_source_version,
    'sourceTimestamp',v_source_timestamp,'financeConclusionId',p_finance_conclusion_id,
    'financeProposalId',p_finance_proposal_id,'authorityState','CONFIRMED','lifecycleState','ACTIVE');

  v_result:=jsonb_build_object(
    'contract','PAYMENT_ALLOCATION_FRESH_AUTHORITY_MATERIALIZATION_V1',
    'dryRun',p_dry_run,'wouldMutate',not p_dry_run,'idempotentReplay',false,
    'paymentId',p_payment_id,'paymentAmount',v_payment.amount,'currency',btrim(v_payment.currency),
    'allocatedTotal',v_total,'unallocatedResidue',v_residue,
    'old',jsonb_build_object(
      'allocationId',v_old.id,'dealId',(select d.deal_id from portal_private.deals d where d.id=v_old.deal_key),
      'allocatedAmount',v_old.allocated_amount,'sourceSystem',v_old.source_system,
      'sourceVersion',v_old.source_version,'sourceTimestamp',v_old.source_timestamp,
      'authorityState',v_old.authority_state::text,'lifecycleState',v_old.lifecycle_state::text),
    'new',v_plan_new,
    'cas',jsonb_build_object('expectedActiveAllocationId',p_expected_active_allocation_id,
      'expectedActiveSourceVersion',p_expected_active_source_version,'matched',true),
    'financeConclusionId',p_finance_conclusion_id,'financeProposalId',p_finance_proposal_id);

  if p_dry_run then
    return v_result || jsonb_build_object('wouldMutate',false);
  end if;

  perform set_config('rona.payment_allocation_authority_mutation_v1','supersede',true);
  update portal_private.payment_allocations
     set authority_state='SUPERSEDED'::portal_private.authority_state_enum,
         lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum
   where id=p_expected_active_allocation_id
     and payment_key=v_payment.id
     and authority_state='CONFIRMED'::portal_private.authority_state_enum
     and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and source_version is not distinct from p_expected_active_source_version;
  if not found then
    raise exception using errcode='40001',message='PAYMENT_ALLOCATION_CAS_CONFLICT';
  end if;

  insert into portal_private.payment_allocations(
    payment_key,client_key,contract_key,deal_key,allocated_amount,
    allocation_status,finance_status,accounting_closure_status,
    allocation_reference,allocated_at,allocated_by,source_system,source_version,source_timestamp,
    import_batch_id,authority_state,lifecycle_state)
  values(
    v_payment.id,v_target_deal.client_key,v_target_deal.contract_key,v_target_deal.id,v_allocated,
    'VERIFIED'::portal_private.payment_allocation_state_enum,
    v_payment.finance_status,v_payment.accounting_closure_status,
    'FINANCE_PROPOSAL:'||p_finance_proposal_id::text,v_source_timestamp,null,
    v_source_system,v_source_version,v_source_timestamp,null,
    'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)
  returning * into v_new;

  select array_agg(pa.id order by pa.id::text) into v_active_ids
    from portal_private.payment_allocations pa
   where pa.payment_key=v_payment.id
     and pa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and pa.allocation_status in (
       'PARTIAL'::portal_private.payment_allocation_state_enum,
       'ALLOCATED'::portal_private.payment_allocation_state_enum,
       'VERIFIED'::portal_private.payment_allocation_state_enum);
  if coalesce(cardinality(v_active_ids),0)<>1 or v_active_ids[1] is distinct from v_new.id then
    raise exception using errcode='40001',message='PAYMENT_ALLOCATION_POST_WRITE_ACTIVE_SET_CONFLICT';
  end if;

  if v_payment.amount is distinct from (select p.amount from portal_private.payments p where p.id=v_payment.id) then
    raise exception using errcode='55000',message='PAYMENT_AMOUNT_IMMUTABILITY_VIOLATION';
  end if;

  v_result:=jsonb_set(v_result,'{new,allocationId}',to_jsonb(v_new.id),true);
  insert into portal_private.payment_allocation_authority_history_v1(
    payment_key,payment_id,old_allocation_id,new_allocation_id,expected_old_source_version,
    finance_conclusion_id,finance_proposal_id,idempotency_key,request_payload,
    old_snapshot,new_snapshot,result_payload,source_system,source_version,source_timestamp)
  values(
    v_payment.id,p_payment_id,v_old.id,v_new.id,p_expected_active_source_version,
    p_finance_conclusion_id,p_finance_proposal_id,p_idempotency_key,v_request,
    to_jsonb(v_old),to_jsonb(v_new),v_result,v_source_system,v_source_version,v_source_timestamp);

  return v_result;
end
$$;

revoke all on function portal_private.payment_allocation_fresh_authority_core_v1(text,uuid,text,uuid,uuid,text,boolean)
  from public, anon, authenticated, service_role;

create or replace function public.payment_allocation_fresh_authority_materialize_v1(
  p_payment_id text,
  p_expected_active_allocation_id uuid,
  p_expected_active_source_version text,
  p_finance_conclusion_id uuid,
  p_finance_proposal_id uuid,
  p_idempotency_key text,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
begin
  return portal_private.payment_allocation_fresh_authority_core_v1(
    p_payment_id,p_expected_active_allocation_id,p_expected_active_source_version,
    p_finance_conclusion_id,p_finance_proposal_id,p_idempotency_key,p_dry_run);
end
$$;

revoke all on function public.payment_allocation_fresh_authority_materialize_v1(text,uuid,text,uuid,uuid,text,boolean)
  from public, anon, authenticated;
grant execute on function public.payment_allocation_fresh_authority_materialize_v1(text,uuid,text,uuid,uuid,text,boolean)
  to service_role;

comment on function public.payment_allocation_fresh_authority_materialize_v1(text,uuid,text,uuid,uuid,text,boolean) is
'Server-only Finance source-locked PAYMENT_ALLOCATION CAS supersede/materialize RPC. Defaults to dry-run. No frontend/AI mutation route is provided.';
