-- OWNER PAYMENTS V4: outgoing RONA payment attribution.
-- Semantically separate from incoming PAYMENT_ALLOCATION and client receipts.

create or replace function portal_private.owner_deal_spend_allocate_core_v4(
  p_payment_id text,p_deal_id text,p_amount numeric,p_actor_user_id uuid,p_idempotency_key text,
  p_supersedes_id uuid default null,p_dry_run boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  v_payment portal_private.payments%rowtype;
  v_deal record;
  v_old portal_private.owner_deal_spend_allocations_v4%rowtype;
  v_existing portal_private.owner_deal_spend_allocations_v4%rowtype;
  v_existing_total numeric:=0; v_before_amount numeric; v_kind text; v_hash text;
  v_id uuid; v_ts timestamptz:=clock_timestamp(); v_result jsonb;
begin
  perform portal_private.owner_payment_v4_assert_admin(p_actor_user_id);
  if p_idempotency_key is null or btrim(p_idempotency_key)='' then raise exception using errcode='22023',message='IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_amount is null or p_amount<=0 then raise exception using errcode='22023',message='INVALID_SPEND_ALLOCATION_AMOUNT'; end if;

  select * into v_payment from portal_private.payments where payment_id=p_payment_id for update;
  if not found then raise exception using errcode='P0002',message='PAYMENT_NOT_FOUND'; end if;
  if v_payment.payment_direction<>'OUTGOING'::portal_private.payment_direction_enum
     or v_payment.payment_kind not in ('COUNTERPARTY_PAYMENT'::portal_private.payment_kind_enum,'BANK_FEE'::portal_private.payment_kind_enum)
     or v_payment.bank_fact_status<>'BANK_CONFIRMED'::portal_private.payment_bank_state_enum
     or v_payment.finance_verification_status<>'VERIFIED'::portal_private.finance_verification_state_enum
     or v_payment.deal_allocation_applicability<>'DEAL_ALLOCATABLE'::portal_private.deal_allocation_applicability_enum
     or v_payment.lifecycle_state<>'ACTIVE'::portal_private.lifecycle_state_enum
     or v_payment.authority_state not in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum) then
    raise exception using errcode='23514',message='PAYMENT_NOT_ELIGIBLE_FOR_OWNER_DEAL_SPEND';
  end if;
  v_before_amount:=v_payment.amount;
  v_kind:=case when v_payment.payment_kind='BANK_FEE'::portal_private.payment_kind_enum then 'BANK_FEE' else 'RONA_ADVANCE' end;
  select * into v_deal from portal_private.owner_payment_v4_assert_existing_payment_contour(p_deal_id);

  v_hash:=md5(jsonb_build_object('paymentId',p_payment_id,'dealId',p_deal_id,'amount',p_amount,'supersedes',p_supersedes_id)::text);
  select * into v_existing from portal_private.owner_deal_spend_allocations_v4 where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>v_hash then raise exception using errcode='23505',message='IDEMPOTENCY_KEY_CONFLICT'; end if;
    return jsonb_build_object('contract','OWNER_AUTHORIZED_DEAL_SPEND_V4','allocationId',v_existing.id,'paymentId',v_existing.payment_id,'dealId',v_existing.deal_id,'amount',v_existing.allocated_amount,'currency',v_existing.currency,'spendKind',v_existing.spend_kind,'idempotentReplay',true,'dryRun',false);
  end if;

  if p_supersedes_id is not null then
    select * into v_old from portal_private.owner_deal_spend_allocations_v4
    where id=p_supersedes_id and payment_key=v_payment.id and authority_state='CONFIRMED' and lifecycle_state='ACTIVE' for update;
    if not found then raise exception using errcode='23514',message='SUPERSEDED_DEAL_SPEND_NOT_ACTIVE'; end if;
  end if;

  select coalesce(sum(a.allocated_amount),0) into v_existing_total
  from portal_private.owner_deal_spend_allocations_v4 a
  where a.payment_key=v_payment.id and a.authority_state='CONFIRMED' and a.lifecycle_state='ACTIVE'
    and (p_supersedes_id is null or a.id<>p_supersedes_id);
  if v_existing_total+p_amount>v_payment.amount then raise exception using errcode='23514',message='DEAL_SPEND_ALLOCATION_EXCEEDS_PAYMENT_AMOUNT'; end if;

  v_result:=jsonb_build_object(
    'contract','OWNER_AUTHORIZED_DEAL_SPEND_V4','paymentId',p_payment_id,'dealId',p_deal_id,'amount',p_amount,
    'currency',v_payment.currency,'paymentAmount',v_payment.amount,'existingAllocatedTotal',v_existing_total,
    'allocatedTotal',v_existing_total+p_amount,'unallocatedResidue',v_payment.amount-v_existing_total-p_amount,
    'spendKind',v_kind,'dryRun',p_dry_run,'wouldMutate',not p_dry_run,'idempotentReplay',false);
  if p_dry_run then return v_result; end if;

  if p_supersedes_id is not null then
    perform set_config('rona.owner_payment_authority_v4','supersede_spend',true);
    update portal_private.owner_deal_spend_allocations_v4
    set authority_state='SUPERSEDED',lifecycle_state='SUPERSEDED',updated_at=clock_timestamp()
    where id=p_supersedes_id;
    insert into portal_private.owner_payment_authority_history_v4(
      event_type,action,entity_id,payment_id,deal_id,allocated_amount,currency,actor_user_id,
      idempotency_key,source_system,source_timestamp,payload)
    values('OWNER_AUTHORIZED_DEAL_SPEND','SUPERSEDE',v_old.id,v_old.payment_id,v_old.deal_id,v_old.allocated_amount,v_old.currency,
      p_actor_user_id,p_idempotency_key,'OWNER_AUTHORIZED_DEAL_SPEND_V4',v_ts,jsonb_build_object('supersededByRequest',true));
  end if;

  v_id:=gen_random_uuid();
  insert into portal_private.owner_deal_spend_allocations_v4(
    id,payment_key,payment_id,deal_key,deal_id,allocated_amount,currency,spend_kind,actor_user_id,
    idempotency_key,supersedes_id,request_hash,source_version,source_timestamp)
  values(v_id,v_payment.id,p_payment_id,v_deal.deal_key,p_deal_id,p_amount,v_payment.currency,v_kind,p_actor_user_id,
    p_idempotency_key,p_supersedes_id,v_hash,'OWNER_AUTHORIZATION:'||v_id::text,v_ts);

  insert into portal_private.owner_payment_authority_history_v4(
    event_type,action,entity_id,payment_id,deal_id,allocated_amount,currency,actor_user_id,idempotency_key,
    source_system,source_timestamp,supersedes_entity_id,payload)
  values('OWNER_AUTHORIZED_DEAL_SPEND','AUTHORIZE',v_id,p_payment_id,p_deal_id,p_amount,v_payment.currency,p_actor_user_id,
    p_idempotency_key,'OWNER_AUTHORIZED_DEAL_SPEND_V4',v_ts,p_supersedes_id,jsonb_build_object('spendKind',v_kind));

  if (select amount from portal_private.payments where id=v_payment.id) is distinct from v_before_amount then raise exception using errcode='23514',message='PAYMENT_AMOUNT_MUTATED'; end if;
  return v_result||jsonb_build_object('allocationId',v_id,'dryRun',false,'wouldMutate',true);
end $$;

revoke all on function portal_private.owner_deal_spend_allocate_core_v4(text,text,numeric,uuid,text,uuid,boolean) from public,anon,authenticated,service_role;

create or replace function public.owner_deal_spend_allocate_v4(
  p_payment_id text,p_deal_id text,p_amount numeric,p_actor_user_id uuid,p_idempotency_key text,
  p_supersedes_id uuid default null,p_dry_run boolean default true
) returns jsonb
language sql security definer set search_path to 'pg_catalog','public','portal_private' as $$
  select portal_private.owner_deal_spend_allocate_core_v4(p_payment_id,p_deal_id,p_amount,p_actor_user_id,p_idempotency_key,p_supersedes_id,p_dry_run)
$$;
revoke all on function public.owner_deal_spend_allocate_v4(text,text,numeric,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.owner_deal_spend_allocate_v4(text,text,numeric,uuid,text,uuid,boolean) to service_role;

comment on table portal_private.owner_deal_spend_allocations_v4 is
'Owner-authorized outgoing bank-payment attribution to Deal spend. Does not reduce customer obligation or increase client receipts.';
