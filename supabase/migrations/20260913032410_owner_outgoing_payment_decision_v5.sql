-- Explicit Owner decision for outgoing bank payments.

create or replace function portal_private.owner_outgoing_payment_decide_core_v5(
  p_payment_id text,p_decision_type text,p_deal_id text,p_idempotency_key text,
  p_supersedes_id uuid default null,p_dry_run boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','portal_private'
as $$
declare
  v_actor uuid;
  v_payment portal_private.payments%rowtype;
  v_existing portal_private.owner_outgoing_payment_decisions_v5%rowtype;
  v_active portal_private.owner_outgoing_payment_decisions_v5%rowtype;
  v_deal record;
  v_type text:=upper(btrim(coalesce(p_decision_type,'')));
  v_deal_id text:=nullif(btrim(coalesce(p_deal_id,'')),'');
  v_hash text; v_id uuid; v_ts timestamptz:=clock_timestamp(); v_before numeric; v_result jsonb;
begin
  v_actor:=portal_private.owner_payment_v5_current_admin();
  if p_idempotency_key is null or btrim(p_idempotency_key)='' then raise exception using errcode='22023',message='IDEMPOTENCY_KEY_REQUIRED'; end if;
  if v_type not in ('DEAL_BINDING','ADVANCE_PAYMENT') then raise exception using errcode='22023',message='OWNER_DECISION_TYPE_REQUIRED'; end if;

  select * into v_payment from portal_private.payments where payment_id=p_payment_id for update;
  if not found then raise exception using errcode='P0002',message='PAYMENT_NOT_FOUND'; end if;
  if v_payment.payment_direction<>'OUTGOING'::portal_private.payment_direction_enum
    or v_payment.payment_kind not in ('COUNTERPARTY_PAYMENT'::portal_private.payment_kind_enum,'BANK_FEE'::portal_private.payment_kind_enum)
    or v_payment.bank_fact_status<>'BANK_CONFIRMED'::portal_private.payment_bank_state_enum
    or v_payment.finance_verification_status<>'VERIFIED'::portal_private.finance_verification_state_enum
    or v_payment.deal_allocation_applicability<>'DEAL_ALLOCATABLE'::portal_private.deal_allocation_applicability_enum
    or v_payment.lifecycle_state<>'ACTIVE'::portal_private.lifecycle_state_enum
    or v_payment.authority_state not in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
  then raise exception using errcode='23514',message='PAYMENT_NOT_ELIGIBLE_FOR_OWNER_DECISION'; end if;
  v_before:=v_payment.amount;

  if v_type='DEAL_BINDING' then
    if v_deal_id is null then raise exception using errcode='22023',message='DEAL_ID_REQUIRED'; end if;
    select * into v_deal from portal_private.owner_payment_v4_assert_existing_payment_contour(v_deal_id);
  else
    if v_deal_id is not null then raise exception using errcode='22023',message='ADVANCE_STATUS_MUST_NOT_BIND_DEAL'; end if;
    if v_payment.payment_kind='BANK_FEE'::portal_private.payment_kind_enum then raise exception using errcode='23514',message='BANK_FEE_CANNOT_BE_ADVANCE_PAYMENT'; end if;
  end if;

  v_hash:=md5(jsonb_build_object('paymentId',p_payment_id,'decisionType',v_type,'dealId',v_deal_id,'supersedesId',p_supersedes_id)::text);
  select * into v_existing from portal_private.owner_outgoing_payment_decisions_v5 where idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>v_hash then raise exception using errcode='23505',message='IDEMPOTENCY_KEY_CONFLICT'; end if;
    return jsonb_build_object('contract','OWNER_OUTGOING_PAYMENT_DECISION_V5','decisionId',v_existing.id,'paymentId',v_existing.payment_id,'decisionType',v_existing.decision_type,'dealId',v_existing.deal_id,'ownerStatus',case when v_existing.decision_type='ADVANCE_PAYMENT' then 'Авансовый платеж' else null end,'idempotentReplay',true,'dryRun',false);
  end if;

  select * into v_active from portal_private.owner_outgoing_payment_decisions_v5
   where payment_key=v_payment.id and authority_state='CONFIRMED' and lifecycle_state='ACTIVE' for update;
  if found then
    if p_supersedes_id is null or p_supersedes_id<>v_active.id then raise exception using errcode='23514',message='ACTIVE_OWNER_DECISION_EXISTS'; end if;
  elsif p_supersedes_id is not null then
    raise exception using errcode='23514',message='SUPERSEDED_OWNER_DECISION_NOT_ACTIVE';
  end if;

  v_result:=jsonb_build_object('contract','OWNER_OUTGOING_PAYMENT_DECISION_V5','paymentId',p_payment_id,'paymentAmount',v_payment.amount,'currency',v_payment.currency,'decisionType',v_type,'dealId',v_deal_id,'ownerStatus',case when v_type='ADVANCE_PAYMENT' then 'Авансовый платеж' else null end,'dryRun',p_dry_run,'wouldMutate',not p_dry_run,'idempotentReplay',false);
  if p_dry_run then return v_result; end if;

  if p_supersedes_id is not null then
    update portal_private.owner_outgoing_payment_decisions_v5 set authority_state='SUPERSEDED',lifecycle_state='SUPERSEDED',updated_at=clock_timestamp() where id=p_supersedes_id;
    insert into portal_private.owner_outgoing_payment_decision_history_v5(decision_id,action,payment_id,decision_type,deal_id,actor_user_id,idempotency_key,source_system,source_timestamp,payload)
    values(v_active.id,'SUPERSEDE',v_active.payment_id,v_active.decision_type,v_active.deal_id,v_actor,p_idempotency_key,'OWNER_OUTGOING_PAYMENT_DECISION_V5',v_ts,jsonb_build_object('supersededByNewOwnerDecision',true));
  end if;

  v_id:=gen_random_uuid();
  insert into portal_private.owner_outgoing_payment_decisions_v5(id,payment_key,payment_id,decision_type,deal_key,deal_id,actor_user_id,idempotency_key,supersedes_id,request_hash,source_system,source_version,source_timestamp)
  values(v_id,v_payment.id,p_payment_id,v_type,case when v_type='DEAL_BINDING' then v_deal.deal_key else null end,v_deal_id,v_actor,p_idempotency_key,p_supersedes_id,v_hash,'OWNER_OUTGOING_PAYMENT_DECISION_V5','OWNER_DECISION:'||v_id::text,v_ts);
  insert into portal_private.owner_outgoing_payment_decision_history_v5(decision_id,action,payment_id,decision_type,deal_id,actor_user_id,idempotency_key,source_system,source_timestamp,supersedes_decision_id,payload)
  values(v_id,'AUTHORIZE',p_payment_id,v_type,v_deal_id,v_actor,p_idempotency_key,'OWNER_OUTGOING_PAYMENT_DECISION_V5',v_ts,p_supersedes_id,jsonb_build_object('ownerStatus',case when v_type='ADVANCE_PAYMENT' then 'Авансовый платеж' else null end));

  if (select amount from portal_private.payments where id=v_payment.id) is distinct from v_before then raise exception using errcode='23514',message='PAYMENT_AMOUNT_MUTATED'; end if;
  return v_result||jsonb_build_object('decisionId',v_id,'dryRun',false,'wouldMutate',true);
end
$$;
revoke all on function portal_private.owner_outgoing_payment_decide_core_v5(text,text,text,text,uuid,boolean) from public,anon,authenticated,service_role;

create or replace function public.owner_outgoing_payment_decide_v5(
  p_payment_id text,p_decision_type text,p_deal_id text,p_idempotency_key text,
  p_supersedes_id uuid default null,p_dry_run boolean default true
) returns jsonb
language sql
security definer
set search_path to 'pg_catalog','public','auth','portal_private'
as $$
  select portal_private.owner_outgoing_payment_decide_core_v5(p_payment_id,p_decision_type,p_deal_id,p_idempotency_key,p_supersedes_id,p_dry_run)
$$;
revoke all on function public.owner_outgoing_payment_decide_v5(text,text,text,text,uuid,boolean) from public,anon,service_role;
grant execute on function public.owner_outgoing_payment_decide_v5(text,text,text,text,uuid,boolean) to authenticated;

create or replace function portal_private.owner_outgoing_payment_decision_guard_v5()
returns trigger language plpgsql security invoker set search_path to 'pg_catalog','public','portal_private' as $$
declare v_owner name;
begin
  select pg_get_userbyid(p.proowner)::name into v_owner from pg_proc p where p.oid='portal_private.owner_outgoing_payment_decide_core_v5(text,text,text,text,uuid,boolean)'::regprocedure;
  if v_owner is null or current_user::name is distinct from v_owner then raise exception using errcode='42501',message='OWNER_OUTGOING_PAYMENT_DIRECT_DML_FORBIDDEN'; end if;
  if tg_op='DELETE' then raise exception using errcode='42501',message='OWNER_OUTGOING_PAYMENT_DELETE_FORBIDDEN'; end if;
  if tg_op='UPDATE' and not(old.authority_state='CONFIRMED' and old.lifecycle_state='ACTIVE' and new.authority_state='SUPERSEDED' and new.lifecycle_state='SUPERSEDED'
    and new.payment_key is not distinct from old.payment_key and new.payment_id is not distinct from old.payment_id and new.decision_type is not distinct from old.decision_type
    and new.deal_key is not distinct from old.deal_key and new.deal_id is not distinct from old.deal_id and new.actor_user_id is not distinct from old.actor_user_id
    and new.idempotency_key is not distinct from old.idempotency_key and new.request_hash is not distinct from old.request_hash and new.source_system is not distinct from old.source_system
    and new.source_version is not distinct from old.source_version and new.source_timestamp is not distinct from old.source_timestamp)
  then raise exception using errcode='42501',message='OWNER_OUTGOING_PAYMENT_DECISION_IMMUTABLE'; end if;
  return new;
end $$;
revoke all on function portal_private.owner_outgoing_payment_decision_guard_v5() from public,anon,authenticated,service_role;
drop trigger if exists trg_owner_outgoing_payment_decision_guard_v5 on portal_private.owner_outgoing_payment_decisions_v5;
create trigger trg_owner_outgoing_payment_decision_guard_v5 before insert or update or delete on portal_private.owner_outgoing_payment_decisions_v5 for each row execute function portal_private.owner_outgoing_payment_decision_guard_v5();

create or replace function portal_private.owner_outgoing_payment_history_insert_guard_v5()
returns trigger language plpgsql security invoker set search_path to 'pg_catalog','public','portal_private' as $$
declare v_owner name;
begin
  select pg_get_userbyid(p.proowner)::name into v_owner from pg_proc p where p.oid='portal_private.owner_outgoing_payment_decide_core_v5(text,text,text,text,uuid,boolean)'::regprocedure;
  if v_owner is null or current_user::name is distinct from v_owner then raise exception using errcode='42501',message='OWNER_OUTGOING_PAYMENT_HISTORY_DIRECT_INSERT_FORBIDDEN'; end if;
  return new;
end $$;
revoke all on function portal_private.owner_outgoing_payment_history_insert_guard_v5() from public,anon,authenticated,service_role;
drop trigger if exists trg_owner_outgoing_payment_history_insert_guard_v5 on portal_private.owner_outgoing_payment_decision_history_v5;
create trigger trg_owner_outgoing_payment_history_insert_guard_v5 before insert on portal_private.owner_outgoing_payment_decision_history_v5 for each row execute function portal_private.owner_outgoing_payment_history_insert_guard_v5();

create or replace function portal_private.owner_outgoing_payment_commit_integrity_v5()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','portal_private' as $$
declare v_count integer;
begin
  if tg_op='INSERT' then
    select count(*) into v_count from portal_private.owner_outgoing_payment_decision_history_v5 h where h.decision_id=new.id and h.action='AUTHORIZE' and h.payment_id=new.payment_id and h.decision_type=new.decision_type and h.deal_id is not distinct from new.deal_id;
    if v_count<>1 then raise exception using errcode='23514',message='OWNER_OUTGOING_PAYMENT_HISTORY_REQUIRED_AT_COMMIT'; end if;
  elsif old.authority_state='CONFIRMED' and old.lifecycle_state='ACTIVE' and new.authority_state='SUPERSEDED' and new.lifecycle_state='SUPERSEDED' then
    select count(*) into v_count from portal_private.owner_outgoing_payment_decision_history_v5 h where h.decision_id=old.id and h.action='SUPERSEDE' and h.payment_id=old.payment_id;
    if v_count<>1 then raise exception using errcode='23514',message='OWNER_OUTGOING_PAYMENT_SUPERSEDE_HISTORY_REQUIRED_AT_COMMIT'; end if;
  end if;
  return new;
end $$;
revoke all on function portal_private.owner_outgoing_payment_commit_integrity_v5() from public,anon,authenticated,service_role;
drop trigger if exists trg_owner_outgoing_payment_commit_integrity_v5 on portal_private.owner_outgoing_payment_decisions_v5;
create constraint trigger trg_owner_outgoing_payment_commit_integrity_v5 after insert or update on portal_private.owner_outgoing_payment_decisions_v5 deferrable initially deferred for each row execute function portal_private.owner_outgoing_payment_commit_integrity_v5();
