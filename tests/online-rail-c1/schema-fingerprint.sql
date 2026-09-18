-- ONLINE RAIL #644 / C1 stable schema fingerprint for B1 objects.
-- Emits one SHA-256 over stable definitions only; OIDs and volatile metadata excluded.

with object_defs as (
  select
    'COLUMN|'||n.nspname||'.'||c.relname||'|'||a.attnum::text||'|'||a.attname||'|'||
    pg_catalog.format_type(a.atttypid,a.atttypmod)||'|'||
    a.attnotnull::text||'|'||
    coalesce(pg_get_expr(ad.adbin,ad.adrelid),'') as def
  from pg_attribute a
  join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace
  left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
  where a.attnum>0 and not a.attisdropped
    and n.nspname='portal_private'
    and (
      c.relname like 'rail_xlsx_%'
      or c.relname='rail_wagons'
    )

  union all

  select
    'CONSTRAINT|'||n.nspname||'.'||c.relname||'|'||con.conname||'|'||
    pg_get_constraintdef(con.oid,true)
  from pg_constraint con
  join pg_class c on c.oid=con.conrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='portal_private'
    and (
      c.relname like 'rail_xlsx_%'
      or (
        c.relname='rail_wagons'
        and con.conname like 'rail_wagons_position_%'
      )
    )

  union all

  select
    'INDEX|'||schemaname||'.'||tablename||'|'||indexname||'|'||indexdef
  from pg_indexes
  where schemaname='portal_private'
    and (
      tablename like 'rail_xlsx_%'
      or indexname like 'rail_xlsx_%'
      or indexname='source_objects_id_import_batch_v1'
    )

  union all

  select
    'TRIGGER|'||n.nspname||'.'||c.relname||'|'||t.tgname||'|'||
    pg_get_triggerdef(t.oid,true)
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal
    and n.nspname='portal_private'
    and c.relname like 'rail_xlsx_%'

  union all

  select
    'POLICY|'||n.nspname||'.'||c.relname||'|'||p.polname||'|'||
    p.polcmd||'|'||
    array_to_string(array(select pg_get_userbyid(x) from unnest(p.polroles) x),',')||'|'||
    coalesce(pg_get_expr(p.polqual,p.polrelid),'')||'|'||
    coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')
  from pg_policy p
  join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='portal_private'
    and c.relname like 'rail_xlsx_%'

  union all

  select
    'VIEW|'||n.nspname||'.'||c.relname||'|'||pg_get_viewdef(c.oid,true)
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='v'
    and n.nspname='portal_private'
    and c.relname like 'rail_xlsx_%'

  union all

  select
    'FUNCTION|'||p.oid::regprocedure::text||'|'||pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where
    (n.nspname='portal_private' and p.proname like 'rail_xlsx_%')
    or (n.nspname='public' and p.proname='rona_admin_rail_deal_read_model_v1')

  union all

  select
    'GRANT_TABLE|'||table_schema||'.'||table_name||'|'||grantee||'|'||privilege_type
  from information_schema.role_table_grants
  where table_schema='portal_private'
    and table_name like 'rail_xlsx_%'
    and grantee in ('anon','authenticated','service_role')

  union all

  select
    'GRANT_FUNCTION|'||routine_schema||'.'||routine_name||'|'||grantee||'|'||privilege_type
  from information_schema.role_routine_grants
  where (
      routine_schema='portal_private' and routine_name like 'rail_xlsx_%'
    ) or (
      routine_schema='public' and routine_name='rona_admin_rail_deal_read_model_v1'
    )
)
select encode(
  extensions.digest(
    string_agg(def,E'\n' order by def),
    'sha256'
  ),
  'hex'
) as b1_schema_sha256
from object_defs;
