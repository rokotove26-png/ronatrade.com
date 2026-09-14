\set ON_ERROR_STOP on
\ir finance-controlled-write.sql

create temp table finance_hardening_before as
select
  (select count(*) from portal_private.finance_events_v7) as finance_events,
  (select count(*) from portal_private.payment_resource_chains_v7) as resource_chains,
  (select count(*) from portal_private.payment_business_attributions_v7) as attributions,
  (select count(*) from portal_private.deal_finance_authority_v7) as finance_authorities;

\ir ../../supabase/migrations/20260914213000_admin_payments_v7_finance_current_authority_hardening.sql

DO $qa$
declare
  v_definition text;
  v_unsafe text := $unsafe$select * into v_current_finance from portal_private.deal_finance_authority_v7 a where a.deal_key=v_deal.id and a.source_locked=true and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')) limit 1;$unsafe$;
  v_safe text := $safe$select * into v_current_finance from portal_private.deal_finance_authority_v7 a where a.deal_key=v_deal.id and a.source_locked=true and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE') and not exists(select 1 from portal_private.deal_finance_authority_v7 n where n.supersedes_id=a.id and n.source_locked=true and upper(n.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(n.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')) limit 1;$safe$;
  b finance_hardening_before%rowtype;
begin
  select pg_get_functiondef('portal_private.persist_finance_event_v7(jsonb,jsonb)'::regprocedure) into v_definition;
  if position(v_unsafe in v_definition)>0 then
    raise exception 'FINANCE_CURRENT_AUTHORITY_UNSAFE_SELECTOR_REMAINS';
  end if;
  if position(v_safe in v_definition)=0 then
    raise exception 'FINANCE_CURRENT_AUTHORITY_SAFE_SELECTOR_MISSING';
  end if;

  select * into b from finance_hardening_before;
  if b.finance_events<>(select count(*) from portal_private.finance_events_v7)
     or b.resource_chains<>(select count(*) from portal_private.payment_resource_chains_v7)
     or b.attributions<>(select count(*) from portal_private.payment_business_attributions_v7)
     or b.finance_authorities<>(select count(*) from portal_private.deal_finance_authority_v7) then
    raise exception 'FINANCE_HARDENING_MUTATED_BUSINESS_DATA';
  end if;

  if has_function_privilege('anon','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE')
     or has_function_privilege('authenticated','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE')
     or has_function_privilege('service_role','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE')
     or has_function_privilege('rona_payments_v7_reader','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE') then
    raise exception 'FINANCE_HARDENING_PRIVILEGE_REGRESSION';
  end if;
end
$qa$;

-- The corrective migration is deliberately idempotent for deterministic deployment retries.
\ir ../../supabase/migrations/20260914213000_admin_payments_v7_finance_current_authority_hardening.sql

DO $qa$
declare v_definition text;
begin
  select pg_get_functiondef('portal_private.persist_finance_event_v7(jsonb,jsonb)'::regprocedure) into v_definition;
  if position($needle$and upper(a.authority_state) not in ('SUPERSEDED','REJECTED','REVERSED','INVALID','INACTIVE') and upper(a.lifecycle_state) not in ('SUPERSEDED','REJECTED','REVERSED','ARCHIVED','INACTIVE')$needle$ in v_definition)=0 then
    raise exception 'FINANCE_HARDENING_IDEMPOTENT_VERIFY_FAILED';
  end if;
end
$qa$;

\echo 'FINANCE CURRENT AUTHORITY HARDENING PASS'
\echo 'RESOURCE CHAIN SELECTOR = UNIQUE LIVE AUTHORITATIVE FINANCE LEAF'
\echo 'BUSINESS DATA MUTATION = NONE'
