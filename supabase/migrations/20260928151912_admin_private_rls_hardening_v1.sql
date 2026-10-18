-- RONA Trade Admin private-table RLS hardening.
-- Owner-approved 2026-09-28.
-- These tables are server-only. Client/API roles retain zero direct table privileges.
-- RLS is enabled but not FORCEd so postgres-owned SECURITY DEFINER/server DB paths continue to work.

revoke all on portal_private.admin_impersonation_sessions from public, anon, authenticated, service_role;
revoke all on portal_private.admin_impersonation_events from public, anon, authenticated, service_role;
revoke all on portal_private.admin_entity_retirement_operations from public, anon, authenticated, service_role;
revoke all on portal_private.admin_auth_cleanup_outbox from public, anon, authenticated, service_role;

alter table portal_private.admin_impersonation_sessions enable row level security;
alter table portal_private.admin_impersonation_events enable row level security;
alter table portal_private.admin_entity_retirement_operations enable row level security;
alter table portal_private.admin_auth_cleanup_outbox enable row level security;

comment on table portal_private.admin_impersonation_sessions is
  'Server-only Admin impersonation sessions. RLS enabled; no direct anon/authenticated/service_role table grants.';
comment on table portal_private.admin_impersonation_events is
  'Append-only immutable Admin impersonation provenance. RLS enabled; no direct anon/authenticated/service_role table grants.';
comment on table portal_private.admin_entity_retirement_operations is
  'Fail-closed server-only Company/Agent retirement orchestration. RLS enabled; no direct anon/authenticated/service_role table grants.';
comment on table portal_private.admin_auth_cleanup_outbox is
  'Server-only Auth cleanup outbox. RLS enabled; no direct anon/authenticated/service_role table grants.';

do $qa$
declare
  v_rel regclass;
  v_role text;
  v_rls boolean;
  v_force boolean;
begin
  foreach v_rel in array array[
    'portal_private.admin_impersonation_sessions'::regclass,
    'portal_private.admin_impersonation_events'::regclass,
    'portal_private.admin_entity_retirement_operations'::regclass,
    'portal_private.admin_auth_cleanup_outbox'::regclass
  ] loop
    select c.relrowsecurity,c.relforcerowsecurity
      into v_rls,v_force
      from pg_catalog.pg_class c
     where c.oid=v_rel;

    if coalesce(v_rls,false) is not true then
      raise exception 'ADMIN_PRIVATE_RLS_QA_FAILED rls_not_enabled table=%',v_rel::text;
    end if;
    if coalesce(v_force,false) is true then
      raise exception 'ADMIN_PRIVATE_RLS_QA_FAILED force_rls_unexpected table=%',v_rel::text;
    end if;

    foreach v_role in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(v_role,v_rel,'SELECT')
         or has_table_privilege(v_role,v_rel,'INSERT')
         or has_table_privilege(v_role,v_rel,'UPDATE')
         or has_table_privilege(v_role,v_rel,'DELETE')
      then
        raise exception 'ADMIN_PRIVATE_RLS_QA_FAILED direct_privilege role=% table=%',v_role,v_rel::text;
      end if;
    end loop;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='portal_private'
      and p.proname='assert_admin_client_impersonation_business_v2'
      and p.prosecdef
      and pg_catalog.pg_get_userbyid(p.proowner)='postgres'
  ) then
    raise exception 'ADMIN_PRIVATE_RLS_QA_FAILED admin_impersonation_server_gate_missing';
  end if;

  perform count(*) from portal_private.admin_impersonation_sessions;
  perform count(*) from portal_private.admin_impersonation_events;
  perform count(*) from portal_private.admin_entity_retirement_operations;
  perform count(*) from portal_private.admin_auth_cleanup_outbox;
end
$qa$;
