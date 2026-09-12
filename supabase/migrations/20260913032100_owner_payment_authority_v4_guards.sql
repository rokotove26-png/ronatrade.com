-- OWNER PAYMENTS V4: authority guards. Existing upstream Deal handoff is consumed read-only.

revoke all on table portal_private.owner_client_payment_allocation_authorizations_v4 from public,anon,authenticated,service_role;
revoke all on table portal_private.owner_client_payment_allocation_items_v4 from public,anon,authenticated,service_role;
revoke all on table portal_private.owner_deal_spend_allocations_v4 from public,anon,authenticated,service_role;
revoke all on table portal_private.owner_payment_authority_history_v4 from public,anon,authenticated,service_role;
grant select on table portal_private.owner_client_payment_allocation_authorizations_v4 to service_role;
grant select on table portal_private.owner_client_payment_allocation_items_v4 to service_role;
grant select on table portal_private.owner_deal_spend_allocations_v4 to service_role;
grant select on table portal_private.owner_payment_authority_history_v4 to service_role;

create or replace function portal_private.owner_payment_v4_assert_admin(p_actor_user_id uuid)
returns void language plpgsql security definer set search_path to 'pg_catalog','public','portal_private' as $$
begin
  if not exists(
    select 1 from portal_private.portal_users u
    join portal_private.portal_user_roles r on r.user_id=u.id
    where u.id=p_actor_user_id and u.status::text='ACTIVE' and u.lifecycle_state::text='ACTIVE'
      and r.role::text='ADMIN' and r.status::text='ACTIVE'
  ) then raise exception using errcode='42501',message='OWNER_PAYMENT_V4_ADMIN_REQUIRED'; end if;
end $$;
revoke all on function portal_private.owner_payment_v4_assert_admin(uuid) from public,anon,authenticated,service_role;

create or replace function portal_private.owner_payment_v4_assert_existing_payment_contour(p_deal_id text)
returns table(deal_key uuid,client_key uuid,contract_key uuid)
language plpgsql security definer set search_path to 'pg_catalog','public','portal_private' as $$
begin
  return query
  select d.id,d.client_key,d.contract_key
  from portal_private.deals d
  join portal_private.owner_deal_workflow w on w.deal_key=d.id
  where d.deal_id=p_deal_id
    and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and d.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
    and w.payment_handoff_state in ('READY','SENT')
  limit 1;
  if not found then raise exception using errcode='23514',message='DEAL_NOT_IN_EXISTING_PAYMENT_CONTOUR'; end if;
end $$;
revoke all on function portal_private.owner_payment_v4_assert_existing_payment_contour(text) from public,anon,authenticated,service_role;

create or replace function portal_private.owner_client_payment_allocation_guard_v4()
returns trigger language plpgsql security invoker set search_path to 'pg_catalog','public','portal_private' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='42501',message='OWNER_CLIENT_ALLOCATION_DELETE_FORBIDDEN'; end if;
  if current_setting('rona.owner_payment_authority_v4',true) is distinct from 'supersede_client'
     or old.authority_state<>'CONFIRMED'::portal_private.authority_state_enum
     or old.lifecycle_state<>'ACTIVE'::portal_private.lifecycle_state_enum
     or new.authority_state<>'SUPERSEDED'::portal_private.authority_state_enum
     or new.lifecycle_state<>'SUPERSEDED'::portal_private.lifecycle_state_enum
     or new.payment_key is distinct from old.payment_key
     or new.client_key is distinct from old.client_key
     or new.contract_key is distinct from old.contract_key
     or new.deal_key is distinct from old.deal_key
     or new.allocated_amount is distinct from old.allocated_amount
     or new.source_system is distinct from old.source_system
     or new.source_version is distinct from old.source_version
     or new.source_timestamp is distinct from old.source_timestamp then
    raise exception using errcode='42501',message='OWNER_CLIENT_ALLOCATION_IMMUTABLE';
  end if;
  return new;
end $$;
revoke all on function portal_private.owner_client_payment_allocation_guard_v4() from public,anon,authenticated,service_role;
drop trigger if exists trg_owner_client_payment_allocation_guard_v4 on portal_private.payment_allocations;
create trigger trg_owner_client_payment_allocation_guard_v4 before update or delete on portal_private.payment_allocations
for each row when (old.source_system='OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4') execute function portal_private.owner_client_payment_allocation_guard_v4();

create or replace function portal_private.owner_client_payment_allocation_commit_integrity_v4()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','portal_private' as $$
declare v_count integer; v_payment_id text; v_currency char(3); v_deal_id text;
begin
  if coalesce(new.source_system,'')<>'OWNER_AUTHORIZED_CLIENT_PAYMENT_ALLOCATION_V4' then return new; end if;
  select p.payment_id,p.currency into v_payment_id,v_currency from portal_private.payments p where p.id=new.payment_key;
  select d.deal_id into v_deal_id from portal_private.deals d where d.id=new.deal_key;
  if tg_op='INSERT' then
    select count(*) into v_count from portal_private.owner_payment_authority_history_v4 h
    where h.event_type='CLIENT_PAYMENT_ALLOCATION' and h.action='AUTHORIZE' and h.entity_id=new.id
      and h.payment_id=v_payment_id and h.deal_id=v_deal_id and h.allocated_amount=new.allocated_amount and h.currency=v_currency;
    if v_count<>1 then raise exception using errcode='23514',message='OWNER_CLIENT_ALLOCATION_HISTORY_REQUIRED_AT_COMMIT'; end if;
  elsif old.authority_state='CONFIRMED'::portal_private.authority_state_enum and old.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and new.authority_state='SUPERSEDED'::portal_private.authority_state_enum and new.lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum then
    select count(*) into v_count from portal_private.owner_payment_authority_history_v4 h
    where h.event_type='CLIENT_PAYMENT_ALLOCATION' and h.action='SUPERSEDE' and h.entity_id=old.id
      and h.payment_id=v_payment_id and h.deal_id=v_deal_id and h.allocated_amount=old.allocated_amount and h.currency=v_currency;
    if v_count<>1 then raise exception using errcode='23514',message='OWNER_CLIENT_ALLOCATION_SUPERSEDE_HISTORY_REQUIRED_AT_COMMIT'; end if;
  end if;
  return new;
end $$;
revoke all on function portal_private.owner_client_payment_allocation_commit_integrity_v4() from public,anon,authenticated,service_role;
drop trigger if exists trg_owner_client_payment_allocation_commit_integrity_v4 on portal_private.payment_allocations;
create constraint trigger trg_owner_client_payment_allocation_commit_integrity_v4
after insert or update on portal_private.payment_allocations deferrable initially deferred
for each row execute function portal_private.owner_client_payment_allocation_commit_integrity_v4();

create or replace function portal_private.owner_deal_spend_guard_v4()
returns trigger language plpgsql security invoker set search_path to 'pg_catalog','public','portal_private' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='42501',message='OWNER_DEAL_SPEND_DELETE_FORBIDDEN'; end if;
  if current_setting('rona.owner_payment_authority_v4',true) is distinct from 'supersede_spend'
     or old.authority_state<>'CONFIRMED' or old.lifecycle_state<>'ACTIVE'
     or new.authority_state<>'SUPERSEDED' or new.lifecycle_state<>'SUPERSEDED'
     or new.payment_key is distinct from old.payment_key or new.deal_key is distinct from old.deal_key
     or new.allocated_amount is distinct from old.allocated_amount or new.currency is distinct from old.currency
     or new.spend_kind is distinct from old.spend_kind or new.actor_user_id is distinct from old.actor_user_id
     or new.source_system is distinct from old.source_system or new.source_version is distinct from old.source_version
     or new.source_timestamp is distinct from old.source_timestamp then
    raise exception using errcode='42501',message='OWNER_DEAL_SPEND_IMMUTABLE';
  end if;
  return new;
end $$;
revoke all on function portal_private.owner_deal_spend_guard_v4() from public,anon,authenticated,service_role;
drop trigger if exists trg_owner_deal_spend_guard_v4 on portal_private.owner_deal_spend_allocations_v4;
create trigger trg_owner_deal_spend_guard_v4 before update or delete on portal_private.owner_deal_spend_allocations_v4
for each row execute function portal_private.owner_deal_spend_guard_v4();

comment on function portal_private.owner_payment_v4_assert_existing_payment_contour(text) is
'Read-only consumer of existing owner_deal_workflow.payment_handoff_state. V4 creates no Deal/payment-stage state and performs no upstream lifecycle mutation.';
