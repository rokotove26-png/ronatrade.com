-- Disposable fixture extensions, not a production migration.
-- The old non-application resolver is a sentinel used to prove delegation, not real Finance.
create role service_role;
create type portal_private.ai_business_role_enum as enum
 ('OPERATIONS_DIRECTOR','FINANCE','LEGAL','RAIL_LOGISTICS','MARKET_ANALYST','COMMERCIAL_DIRECTOR');
alter table portal_private.deals add column business_status text default 'EXECUTING';
alter table portal_private.deals add column lifecycle_state text default 'ACTIVE';
create function portal_private.canonical_target_snapshot(p_type text,p_id text) returns jsonb
 language sql stable as $$ select jsonb_build_object('legacy_type',p_type,'legacy_id',p_id) $$;
create function portal_private.ai_role_state_current_v2(p_role portal_private.ai_business_role_enum,p_task_limit integer default 10,p_coord_limit integer default 20)
 returns jsonb language sql stable as $$ select jsonb_build_object('functional_role',p_role::text,'unrelated_sentinel','UNCHANGED') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;

-- Production-compatible resource authority test double for the disposable PG17 shape.
-- The production function additionally carries source timestamps; this fixture needs only
-- the authority ordering used by the Application projection regression.
create or replace function portal_private.resolve_deal_resource_state(p_deal_key uuid)
returns table(resource_status text,resource_source text,resource_confirmed_at timestamptz)
language sql stable security definer set search_path='pg_catalog','portal_private' as $$
with explicit_decision as (
  select rd.decision_state
  from portal_private.resource_decisions rd
  where rd.deal_key=p_deal_key
  order by rd.id desc
  limit 1
), legacy_owner_confirmation as (
  select o.supplier_approved_at
  from portal_private.client_applications a
  join portal_private.owner_application_workflow o on o.application_key=a.id
  where a.linked_deal_key=p_deal_key and o.supplier_approved_at is not null
  order by o.supplier_approved_at desc
  limit 1
), deal_state as (
  select upper(coalesce(d.business_status,'')) business_status
  from portal_private.deals d where d.id=p_deal_key
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
  (select supplier_approved_at from legacy_owner_confirmation limit 1)
$$;
