-- ADMIN PAYMENTS OWNER FINAL DELTA V5
-- Payments scope only. Existing Deal lifecycle/handoff is read-only.

revoke execute on function public.owner_client_payment_allocate_v4(text,jsonb,uuid,text,uuid,boolean) from service_role;
revoke execute on function public.owner_deal_spend_allocate_v4(text,text,numeric,uuid,text,uuid,boolean) from service_role;

create or replace function portal_private.owner_payment_v5_current_admin()
returns uuid
language plpgsql
security definer
stable
set search_path to 'pg_catalog','public','auth','portal_private'
as $$
declare v_auth_user_id uuid; v_portal_user_id uuid;
begin
  v_auth_user_id:=auth.uid();
  if v_auth_user_id is null then raise exception using errcode='42501',message='OWNER_PAYMENT_AUTHENTICATED_USER_REQUIRED'; end if;
  select u.id into v_portal_user_id
  from portal_private.portal_users u
  join portal_private.portal_user_roles r on r.user_id=u.id
  where u.auth_user_id=v_auth_user_id
    and u.status::text='ACTIVE'
    and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    and u.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
    and r.role::text='ADMIN' and r.status::text='ACTIVE' and r.revoked_at is null
  limit 1;
  if v_portal_user_id is null then raise exception using errcode='42501',message='OWNER_PAYMENT_ADMIN_REQUIRED'; end if;
  return v_portal_user_id;
end
$$;
revoke all on function portal_private.owner_payment_v5_current_admin() from public,anon,authenticated,service_role;

create or replace function public.owner_client_payment_allocate_v5(
  p_payment_id text,p_allocations jsonb,p_idempotency_key text,
  p_supersedes_authorization_id uuid default null,p_dry_run boolean default true
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','portal_private'
as $$
declare v_actor uuid;
begin
  v_actor:=portal_private.owner_payment_v5_current_admin();
  return portal_private.owner_client_payment_allocate_core_v4(
    p_payment_id,p_allocations,v_actor,p_idempotency_key,p_supersedes_authorization_id,p_dry_run
  );
end
$$;
revoke all on function public.owner_client_payment_allocate_v5(text,jsonb,text,uuid,boolean) from public,anon,service_role;
grant execute on function public.owner_client_payment_allocate_v5(text,jsonb,text,uuid,boolean) to authenticated;

create table if not exists portal_private.owner_outgoing_payment_decisions_v5 (
  id uuid primary key default gen_random_uuid(),
  payment_key uuid not null references portal_private.payments(id) on delete restrict,
  payment_id text not null,
  decision_type text not null check (decision_type in ('DEAL_BINDING','ADVANCE_PAYMENT')),
  deal_key uuid null references portal_private.deals(id) on delete restrict,
  deal_id text null,
  actor_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  authority_state text not null default 'CONFIRMED' check (authority_state in ('CONFIRMED','SUPERSEDED')),
  lifecycle_state text not null default 'ACTIVE' check (lifecycle_state in ('ACTIVE','SUPERSEDED')),
  idempotency_key text not null unique check (btrim(idempotency_key)<>''),
  supersedes_id uuid null references portal_private.owner_outgoing_payment_decisions_v5(id) on delete restrict,
  request_hash text not null,
  source_system text not null default 'OWNER_OUTGOING_PAYMENT_DECISION_V5',
  source_version text not null,
  source_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((decision_type='DEAL_BINDING' and deal_key is not null and deal_id is not null and btrim(deal_id)<>'')
      or (decision_type='ADVANCE_PAYMENT' and deal_key is null and deal_id is null))
);
create unique index if not exists owner_outgoing_payment_decisions_v5_one_active
  on portal_private.owner_outgoing_payment_decisions_v5(payment_key)
  where authority_state='CONFIRMED' and lifecycle_state='ACTIVE';

create table if not exists portal_private.owner_outgoing_payment_decision_history_v5 (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null,
  action text not null check (action in ('AUTHORIZE','SUPERSEDE')),
  payment_id text not null,
  decision_type text not null check (decision_type in ('DEAL_BINDING','ADVANCE_PAYMENT')),
  deal_id text null,
  actor_user_id uuid not null references portal_private.portal_users(id) on delete restrict,
  idempotency_key text not null,
  source_system text not null default 'OWNER_OUTGOING_PAYMENT_DECISION_V5',
  source_timestamp timestamptz not null,
  supersedes_decision_id uuid null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

revoke all on table portal_private.owner_outgoing_payment_decisions_v5 from public,anon,authenticated,service_role;
revoke all on table portal_private.owner_outgoing_payment_decision_history_v5 from public,anon,authenticated,service_role;
grant select on table portal_private.owner_outgoing_payment_decisions_v5 to service_role;
grant select on table portal_private.owner_outgoing_payment_decision_history_v5 to service_role;

create or replace function portal_private.owner_outgoing_payment_decision_history_v5_immutable()
returns trigger language plpgsql security definer set search_path to 'pg_catalog','public','portal_private' as $$
begin raise exception using errcode='42501',message='OWNER_OUTGOING_PAYMENT_DECISION_HISTORY_IMMUTABLE'; end $$;
revoke all on function portal_private.owner_outgoing_payment_decision_history_v5_immutable() from public,anon,authenticated,service_role;
drop trigger if exists trg_owner_outgoing_payment_decision_history_v5_immutable on portal_private.owner_outgoing_payment_decision_history_v5;
create trigger trg_owner_outgoing_payment_decision_history_v5_immutable
before update or delete on portal_private.owner_outgoing_payment_decision_history_v5
for each row execute function portal_private.owner_outgoing_payment_decision_history_v5_immutable();
