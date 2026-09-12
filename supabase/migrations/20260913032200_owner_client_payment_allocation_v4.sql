-- OWNER PAYMENTS V4: incoming CLIENT_PAYMENT allocation.
-- PAYMENT.amount is immutable; PAYMENT_ALLOCATION means credited to a Deal payment obligation, not Deal spend.

create or replace function portal_private.owner_client_payment_allocate_core_v4(
  p_payment_id text,p_allocations jsonb,p_actor_user_id uuid,p_idempotency_key text,
  p_supersedes_authorization_id uuid default null,p_dry_run boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  v_payment portal_private.payments%rowtype;
  v_old_auth portal_private.owner_client_payment_allocation_authorizations_v4%rowtype;
  v_existing_auth portal_private.owner_client_payment_allocation_authorizations_v4%rowtype;
  v_item jsonb; v_deal_id text; v_amount numeric; v_new_total numeric:=0; v_existing_total numeric:=0;
  v_request_hash text; v_auth_id uuid; v_pa_id uuid; v_deal record; v_result jsonb;
  v_result_items jsonb:='[]'::jsonb; v_old_item record; v_before_amount numeric; v_source_ts timestamptz:=clock_timestamp();
begin
  perform portal_private.owner_payment_v4_assert_admin(p_actor_user_id);
  if p_idempotency_key is null or btrim(p_idempotency_key)='' then raise exception using errcode='22023',message='IDEMPOTENCY_KEY_REQUIRED'; end if;
  if jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)<1 or jsonb_array_length(p_allocations)>20 then raise exception using errcode='22023',message='ALLOCATIONS_ARRAY_REQUIRED'; end if;
  if exists(select 1 from jsonb_array_elements(p_allocations) x group by x.value->>'dealId' having count(*)>1) then raise exception using errcode='22023',message='DUPLICATE_DEAL_IN_ALLOCATION_REQUEST'; end if;

  select * into v_payment from portal_private.payments where payment_id=p_payment_id for update;
  if not found then raise exception using errcode='P0002',message='PAYMENT_NOT_FOUND'; end if;
  if v_payment.payment_direction<>'INCOMING'::portal_private.payment_direction_enum
     or v_payment.payment_kind<>'CLIENT_PAYMENT'::portal_private.payment_kind_enum
     or v_payment.bank_fact_status<>'BANK_CONFIRMED'::portal_private.payment_bank_state_enum
     or v_payment.finance_verification_status<>'VERIFIED'::portal_private.finance_verification_state_enum
     or v_payment.deal_allocation_applicability<>'DEAL_ALLOCATABLE'::portal_private.deal_allocation_applicability_enum
     or v_payment.lifecycle_state<>'ACTIVE'::portal_private.lifecycle_state_enum
     or v_payment.authority_state not in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum) then
    raise exception using errcode='23514',message='PAYMENT_NOT_ELIGIBLE_FOR_OWNER_CLIENT_ALLOCATION';
  end if;
  v_before_amount:=v_payment.amount;
  v_request_hash:=md5(jsonb_build_object('paymentId',p_payment_id,'allocations',p_allocations,'supersedes',p_supersedes_authorization_id)::text);
  select * into v_existing_auth from portal_private.owner_client_payment_allocation_authorizations_v4 where idempotency_key=p_idempotency_key;
  if found then
    if v_existing_auth.request_hash<>v_request_hash then raise exception using errcode='23505',message='IDEMPOTENCY_KEY_CONFLICT'; end if;
    return v_existing_auth.result_payload||jsonb_build_object('idempotentReplay',true,'dryRun',false);
  end if;
  if p_supersedes_authorization_id is not null then
    select * into v_old_auth from portal_private.owner_client_payment_allocation_authorizations_v4
    where id=p_supersedes_authorization_id and payment_key=v_payment.id and authority_state='ACTIVE' and lifecycle_state='ACTIVE' for update;
    if not found then raise exception using errcode='23514',message='SUPERSEDED_CLIENT_AUTHORIZATION_NOT_ACTIVE'; end if;
  end if;

  select coalesce(sum(pa.allocated_amount),0) into v_existing_total
  from portal_private.payment_allocations pa
  where pa.payment_key=v_payment.id
    and pa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and pa.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
    and (p_supersedes_authorization_id is null or not exists(
      select 1 from portal_private.owner_client_payment_allocation_items_v4 oi
      where oi.authorization_id=p_supersedes_authorization_id and oi.payment_allocation_id=pa.id));

  for v_item in select value from jsonb_array_elements(p_allocations) loop
    v_deal_id:=nullif(btrim(v_item->>'dealId'),'');
    begin v_amount:=nullif(btrim(v_item->>'amount'),'')::numeric; exception when others then v_amount:=null; end;
    if v_deal_id is null or v_amount is null or v_amount<=0 then raise exception using errcode='22023',message='INVALID_ALLOCATION_ITEM'; end if;
    select * into v_deal from portal_private.owner_payment_v4_assert_existing_payment_contour(v_deal_id);
    v_new_total:=v_new_total+v_amount;
  end loop;
  if v_existing_total+v_new_total>v_payment.amount then raise exception using errcode='23514',message='ALLOCATION_EXCEEDS_PAYMENT_AMOUNT'; end if;

  v_result:=jsonb_build_object(
    'contract','OWNER_CLIENT_PAYMENT_ALLOCATION_V4','paymentId',p_payment_id,'currency',v_payment.currency,
    'paymentAmount',v_payment.amount,'existingAllocatedTotal',v_existing_total,'requestedAllocationTotal',v_new_total,
    'allocatedTotal',v_existing_total+v_new_total,'unallocatedResidue',v_payment.amount-v_existing_total-v_new_total,
    'dryRun',p_dry_run,'wouldMutate',not p_dry_run,'idempotentReplay',false);
  if p_dry_run then return v_result; end if;

  if p_supersedes_authorization_id is not null then
    perform set_config('rona.owner_payment_authority_v4','supersede_client',true);
    update portal_private.owner_client_payment_allocation_authorizations_v4
    set authority_state='SUPERSEDED',lifecycle_state='SUPERSEDED',updated_at=clock_timestamp()
    where id=p_supersedes_authorization_id;
    for v_old_item in
      select i.*,pa.source_timestamp from portal_private.owner_client_payment_allocation_items_v4 i
      join portal_private.payment_allocations pa on pa.id=i.payment_allocation_id
      where i.authorization_id=p_supersedes_authorization_id
    loop
      update portal_private.payment_allocations
      set authority_state='SUPERSEDED'::portal_private.authority_state_enum,lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum,updated_at=clock_timestamp()
      where id=v_old_item.payment_allocation_id;
      insert into portal_private.owner_payment_authority_history_v4(event_type,action,entity_id,payment_id,deal_id,allocated_amount,currency,actor_user_id,idempotency_key,source_system,source_timestamp,payload)
      values('CLIENT_PAYMENT_ALLOCATION','SUPERSEDE',v_old_item.payment_allocation_id,p_payment_id,v_old_item.deal_id,v_old_item.allocated_amount,v_old_item.currency,p_actor_user_id,p_idempotency_key,'OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4',v_source_ts,jsonb_build_object('supersededAuthorizationId',p_supersedes_authorization_id));
    end loop;
  end if;

  v_auth_id:=gen_random_uuid();
  insert into portal_private.owner_client_payment_allocation_authorizations_v4(
    id,payment_key,payment_id,currency,actor_user_id,idempotency_key,supersedes_authorization_id,
    request_hash,request_payload,result_payload,source_version,source_timestamp)
  values(v_auth_id,v_payment.id,p_payment_id,v_payment.currency,p_actor_user_id,p_idempotency_key,p_supersedes_authorization_id,
    v_request_hash,p_allocations,'{}'::jsonb,'OWNER_AUTHORIZATION:'||v_auth_id::text,v_source_ts);

  for v_item in select value from jsonb_array_elements(p_allocations) loop
    v_deal_id:=btrim(v_item->>'dealId'); v_amount:=(v_item->>'amount')::numeric;
    select * into v_deal from portal_private.owner_payment_v4_assert_existing_payment_contour(v_deal_id);
    v_pa_id:=gen_random_uuid();
    insert into portal_private.payment_allocations(
      id,payment_key,client_key,contract_key,deal_key,allocated_amount,allocation_status,finance_status,accounting_closure_status,
      allocation_reference,allocated_at,allocated_by,source_system,source_version,source_timestamp,authority_state,lifecycle_state)
    values(v_pa_id,v_payment.id,v_deal.client_key,v_deal.contract_key,v_deal.deal_key,v_amount,
      'VERIFIED'::portal_private.payment_allocation_state_enum,v_payment.finance_status,v_payment.accounting_closure_status,
      'OWNER_AUTHORIZATION:'||v_auth_id::text,v_source_ts,p_actor_user_id,'OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4',
      'OWNER_AUTHORIZATION:'||v_auth_id::text,v_source_ts,'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum);
    insert into portal_private.owner_client_payment_allocation_items_v4(authorization_id,payment_allocation_id,deal_key,deal_id,allocated_amount,currency)
    values(v_auth_id,v_pa_id,v_deal.deal_key,v_deal_id,v_amount,v_payment.currency);
    insert into portal_private.owner_payment_authority_history_v4(event_type,action,entity_id,payment_id,deal_id,allocated_amount,currency,actor_user_id,idempotency_key,source_system,source_timestamp,payload)
    values('CLIENT_PAYMENT_ALLOCATION','AUTHORIZE',v_pa_id,p_payment_id,v_deal_id,v_amount,v_payment.currency,p_actor_user_id,p_idempotency_key,'OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4',v_source_ts,jsonb_build_object('authorizationId',v_auth_id));
    v_result_items:=v_result_items||jsonb_build_array(jsonb_build_object('paymentAllocationId',v_pa_id,'dealId',v_deal_id,'amount',v_amount,'currency',v_payment.currency));
  end loop;

  if (select amount from portal_private.payments where id=v_payment.id) is distinct from v_before_amount then raise exception using errcode='23514',message='PAYMENT_AMOUNT_MUTATED'; end if;
  v_result:=v_result||jsonb_build_object('authorizationId',v_auth_id,'items',v_result_items,'dryRun',false,'wouldMutate',true);
  update portal_private.owner_client_payment_allocation_authorizations_v4 set result_payload=v_result,updated_at=clock_timestamp() where id=v_auth_id;
  return v_result;
end $$;

revoke all on function portal_private.owner_client_payment_allocate_core_v4(text,jsonb,uuid,text,uuid,boolean) from public,anon,authenticated,service_role;

create or replace function public.owner_client_payment_allocate_v4(
  p_payment_id text,p_allocations jsonb,p_actor_user_id uuid,p_idempotency_key text,
  p_supersedes_authorization_id uuid default null,p_dry_run boolean default true
) returns jsonb
language sql security definer set search_path to 'pg_catalog','public','portal_private' as $$
  select portal_private.owner_client_payment_allocate_core_v4(p_payment_id,p_allocations,p_actor_user_id,p_idempotency_key,p_supersedes_authorization_id,p_dry_run)
$$;
revoke all on function public.owner_client_payment_allocate_v4(text,jsonb,uuid,text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.owner_client_payment_allocate_v4(text,jsonb,uuid,text,uuid,boolean) to service_role;
