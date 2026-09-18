\set ON_ERROR_STOP on

with defs as (
  select
    'FUNCTION|'||p.oid::regprocedure::text||'|'||pg_get_functiondef(p.oid) as def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='portal_private'
    and p.proname in (
      'rail_xlsx_owner_resolution_bridge_v1',
      'rail_xlsx_rail_resolution_bridge_v1'
    )
  union all
  select
    'GRANT|'||routine_schema||'.'||routine_name||'|'||grantee||'|'||privilege_type
  from information_schema.role_routine_grants
  where routine_schema='portal_private'
    and routine_name in (
      'rail_xlsx_owner_resolution_bridge_v1',
      'rail_xlsx_rail_resolution_bridge_v1'
    )
    and grantee in ('PUBLIC','anon','authenticated','service_role')
)
select encode(
  extensions.digest(string_agg(def,E'\n' order by def),'sha256'),
  'hex'
) as c12_schema_sha256
from defs;