-- PAYMENT_ALLOCATION AUTHORITY EXCLUSIVITY V1
-- Hardens fresh Finance reconciliation authority against direct service_role DML.
-- This migration defines integrity enforcement only. It does not materialize production data.

-- service_role must never write the immutable authority ledger directly.
revoke all on table portal_private.payment_allocation_authority_history_v1
  from public, anon, authenticated, service_role;

-- Defense in depth: even if table INSERT is accidentally re-granted later, only the
-- SECURITY DEFINER materialization path may create a history row. This trigger is
-- intentionally SECURITY INVOKER so current_user remains the statement execution role.
create or replace function portal_private.guard_payment_allocation_authority_history_insert_v1()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  v_core_owner name;
begin
  select pg_get_userbyid(p.proowner)::name
    into v_core_owner
    from pg_proc p
   where p.oid='portal_private.payment_allocation_fresh_authority_core_v1(text,uuid,text,uuid,uuid,text,boolean)'::regprocedure;

  if v_core_owner is null or current_user::name is distinct from v_core_owner then
    raise exception using errcode='42501',message='PAYMENT_ALLOCATION_AUTHORITY_HISTORY_DIRECT_INSERT_FORBIDDEN';
  end if;
  return new;
end
$$;

revoke all on function portal_private.guard_payment_allocation_authority_history_insert_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_payment_allocation_authority_history_insert_guard_v1
  on portal_private.payment_allocation_authority_history_v1;
create trigger trg_payment_allocation_authority_history_insert_guard_v1
before insert on portal_private.payment_allocation_authority_history_v1
for each row execute function portal_private.guard_payment_allocation_authority_history_insert_v1();

-- Commit-time integrity is the security boundary. PR #462 treats reconciliation lineage
-- as authoritative when source_system contains RECONCIL, so every future row entering
-- that reconciliation-visible class must be backed by exactly one immutable history event.
-- The unique(new_allocation_id) constraint on the ledger makes the existence check exact-one.
create or replace function portal_private.enforce_payment_allocation_authority_commit_integrity_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog','public','portal_private'
as $$
declare
  v_count integer;
  v_payment_id text;
  v_new_reconciliation_visible boolean;
  v_old_reconciliation_visible boolean;
begin
  select p.payment_id into v_payment_id
    from portal_private.payments p
   where p.id=new.payment_key;

  v_new_reconciliation_visible := position('RECONCIL' in upper(coalesce(new.source_system,'')))>0;
  v_old_reconciliation_visible := case when tg_op='UPDATE'
    then position('RECONCIL' in upper(coalesce(old.source_system,'')))>0
    else false end;

  -- INSERT of any reconciliation-visible allocation, or UPDATE that converts an existing
  -- row into reconciliation-visible provenance, must have one matching immutable ledger row.
  if (tg_op='INSERT' and v_new_reconciliation_visible)
     or (tg_op='UPDATE' and v_new_reconciliation_visible and not v_old_reconciliation_visible) then
    select count(*) into v_count
      from portal_private.payment_allocation_authority_history_v1 h
     where h.new_allocation_id=new.id
       and h.payment_key=new.payment_key
       and h.payment_id=v_payment_id
       and h.source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION'
       and h.source_version is not distinct from new.source_version
       and h.source_timestamp is not distinct from new.source_timestamp;
    if v_count<>1 then
      raise exception using errcode='23514',message='FRESH_ALLOCATION_HISTORY_REQUIRED_AT_COMMIT';
    end if;
  end if;

  -- A canonical fresh authority may leave ACTIVE only through a new immutable history event
  -- that names it as old_allocation_id. A caller-controlled GUC cannot satisfy this invariant.
  if tg_op='UPDATE'
     and old.source_system='FINANCE_SOURCE_LOCKED_RECONCILIATION'
     and old.authority_state='CONFIRMED'::portal_private.authority_state_enum
     and old.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
     and new.authority_state='SUPERSEDED'::portal_private.authority_state_enum
     and new.lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum then
    select count(*) into v_count
      from portal_private.payment_allocation_authority_history_v1 h
     where h.old_allocation_id=old.id
       and h.payment_key=old.payment_key
       and h.payment_id=v_payment_id
       and h.new_allocation_id<>old.id;
    if v_count<>1 then
      raise exception using errcode='23514',message='FRESH_SUPERSEDE_HISTORY_REQUIRED_AT_COMMIT';
    end if;
  end if;

  return new;
end
$$;

revoke all on function portal_private.enforce_payment_allocation_authority_commit_integrity_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_payment_allocation_authority_commit_integrity_v1
  on portal_private.payment_allocations;
create constraint trigger trg_payment_allocation_authority_commit_integrity_v1
after insert or update on portal_private.payment_allocations
deferrable initially deferred
for each row execute function portal_private.enforce_payment_allocation_authority_commit_integrity_v1();

comment on function portal_private.enforce_payment_allocation_authority_commit_integrity_v1() is
'DEFERRABLE commit-time invariant: reconciliation-visible allocation creation and canonical fresh ACTIVE->SUPERSEDED transitions require immutable authority-history linkage. Custom GUCs are not an authorization boundary.';
