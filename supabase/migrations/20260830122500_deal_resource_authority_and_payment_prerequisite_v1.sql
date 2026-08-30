create or replace function portal_private.resolve_deal_resource_state(p_deal_key uuid)
returns table(resource_status text, resource_source text, resource_confirmed_at timestamptz)
language sql
stable
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
with explicit_decision as (
  select rd.decision_state, rd.decided_at
  from portal_private.resource_decisions rd
  where rd.deal_key = p_deal_key
  order by rd.decided_at desc, rd.created_at desc
  limit 1
), legacy_owner_confirmation as (
  select o.supplier_approved_at
  from portal_private.client_applications a
  join portal_private.owner_application_workflow o on o.application_key = a.id
  where a.linked_deal_key = p_deal_key
    and o.supplier_approved_at is not null
  order by o.supplier_approved_at desc
  limit 1
), deal_state as (
  select upper(coalesce(d.business_status,'')) as business_status
  from portal_private.deals d
  where d.id = p_deal_key
)
select
  case
    when exists(select 1 from explicit_decision where decision_state='RESOURCE_CONFIRMED') then 'RESOURCE_CONFIRMED'
    when exists(select 1 from explicit_decision where decision_state='RESOURCE_DENIED') then 'RESOURCE_DENIED'
    when exists(select 1 from legacy_owner_confirmation) then 'RESOURCE_CONFIRMED'
    when exists(select 1 from deal_state where business_status='RESOURCE_CONFIRMED') then 'RESOURCE_CONFIRMED'
    when exists(select 1 from deal_state where business_status in ('RESOURCE_DENIED','CANCELLED')) then 'RESOURCE_DENIED'
    else 'RESOURCE_PENDING'
  end,
  case
    when exists(select 1 from explicit_decision) then 'RESOURCE_DECISION'
    when exists(select 1 from legacy_owner_confirmation) then 'OWNER_APPLICATION_WORKFLOW'
    when exists(select 1 from deal_state where business_status in ('RESOURCE_CONFIRMED','RESOURCE_DENIED','CANCELLED')) then 'DEAL_BUSINESS_STATUS'
    else 'NO_AUTHORITATIVE_RESOURCE_FACT'
  end,
  coalesce(
    (select decided_at from explicit_decision limit 1),
    (select supplier_approved_at from legacy_owner_confirmation limit 1)
  );
$$;

create or replace function portal_private.enforce_resource_confirmation_before_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_status text;
begin
  if new.deal_key is null then return new; end if;
  select r.resource_status into v_status
  from portal_private.resolve_deal_resource_state(new.deal_key) r;
  if coalesce(v_status,'RESOURCE_PENDING') <> 'RESOURCE_CONFIRMED' then
    raise exception 'RESOURCE_CONFIRMATION_REQUIRED_BEFORE_PAYMENT' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_allocation_requires_resource on portal_private.payment_allocations;
create trigger trg_payment_allocation_requires_resource
before insert or update of deal_key, allocated_amount, allocation_status
on portal_private.payment_allocations
for each row
execute function portal_private.enforce_resource_confirmation_before_payment_allocation();

create or replace function portal_private.enforce_resource_confirmation_before_finance_receipt()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private','auth'
as $$
declare
  v_deal_key uuid;
  v_status text;
begin
  if coalesce(new.received_amount,0) <= 0 then return new; end if;
  select d.id into v_deal_key
  from portal_private.deals d
  where d.deal_id = new.deal_id
    and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  order by d.updated_at desc
  limit 1;
  if v_deal_key is null then
    raise exception 'DEAL_REQUIRED_FOR_FINANCE_RECEIPT' using errcode='23514';
  end if;
  select r.resource_status into v_status
  from portal_private.resolve_deal_resource_state(v_deal_key) r;
  if coalesce(v_status,'RESOURCE_PENDING') <> 'RESOURCE_CONFIRMED' then
    raise exception 'RESOURCE_CONFIRMATION_REQUIRED_BEFORE_FINANCE_RECEIPT' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_finance_receipt_requires_resource on portal_private.owner_deal_finance_summary;
create trigger trg_finance_receipt_requires_resource
before insert or update of deal_id, received_amount
on portal_private.owner_deal_finance_summary
for each row
execute function portal_private.enforce_resource_confirmation_before_finance_receipt();

comment on function portal_private.resolve_deal_resource_state(uuid) is 'Single authoritative resource-state resolver for all client deal projections. Explicit resource_decisions win; legacy owner_application_workflow supplier approval is accepted as authoritative historical confirmation. EXECUTING alone is never treated as resource confirmation.';
