-- ONLINE RAIL #644 / C1 object inventory assertions.
\set ON_ERROR_STOP on

do $$
declare
  v_missing text;
begin
  select string_agg(x.obj,', ')
  into v_missing
  from (
    values
      ('table:rail_xlsx_dislocation_events_v1',
       to_regclass('portal_private.rail_xlsx_dislocation_events_v1') is not null),
      ('table:rail_xlsx_resolution_decisions_v1',
       to_regclass('portal_private.rail_xlsx_resolution_decisions_v1') is not null),
      ('table:rail_xlsx_correction_decisions_v1',
       to_regclass('portal_private.rail_xlsx_correction_decisions_v1') is not null),
      ('view:rail_xlsx_resolution_effective_v1',
       to_regclass('portal_private.rail_xlsx_resolution_effective_v1') is not null),
      ('view:rail_xlsx_dislocation_effective_v1',
       to_regclass('portal_private.rail_xlsx_dislocation_effective_v1') is not null),
      ('view:rail_xlsx_dislocation_latest_state_v1',
       to_regclass('portal_private.rail_xlsx_dislocation_latest_state_v1') is not null),
      ('view:rail_xlsx_dislocation_latest_trusted_v1',
       to_regclass('portal_private.rail_xlsx_dislocation_latest_trusted_v1') is not null),
      ('view:rail_xlsx_dislocation_current_position_v1',
       to_regclass('portal_private.rail_xlsx_dislocation_current_position_v1') is not null),
      ('view:rail_xlsx_dislocation_current_audit_v1',
       to_regclass('portal_private.rail_xlsx_dislocation_current_audit_v1') is not null)
  ) as x(obj,ok)
  where not x.ok;

  if v_missing is not null then
    raise exception 'C1_MISSING_OBJECTS: %',v_missing;
  end if;
end
$$;

do $$
declare
  v_expected text[]:=array[
    'portal_private.rail_xlsx_source_row_is_canonical_v1(jsonb,text,integer)',
    'portal_private.rail_xlsx_append_only_guard_v1()',
    'portal_private.rail_xlsx_validate_resolution_authority_v1(text,uuid,uuid,text,uuid,uuid)',
    'portal_private.rail_xlsx_validate_correction_authority_v1(text,uuid,uuid,uuid,text,uuid,uuid)',
    'portal_private.rail_xlsx_dislocation_ingest_v1(uuid,uuid,text,integer,jsonb,text,timestamp without time zone,text,text,uuid,uuid,text,text,text,timestamp with time zone,text,text,jsonb,jsonb)',
    'portal_private.rail_xlsx_resolution_decide_v1(uuid,text,uuid,uuid,text,uuid,timestamp with time zone,jsonb,jsonb)',
    'portal_private.rail_xlsx_correction_decide_v1(uuid,uuid,text,text,uuid,timestamp with time zone,jsonb,jsonb)',
    'portal_private.rail_xlsx_refresh_wagon_projection_v1(uuid)',
    'public.rona_admin_rail_deal_read_model_v1(text)'
  ];
  v_sig text;
begin
  foreach v_sig in array v_expected loop
    if to_regprocedure(v_sig) is null then
      raise exception 'C1_MISSING_FUNCTION: %',v_sig;
    end if;
  end loop;
end
$$;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_trigger t
  join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='portal_private'
    and c.relname in (
      'rail_xlsx_dislocation_events_v1',
      'rail_xlsx_resolution_decisions_v1',
      'rail_xlsx_correction_decisions_v1'
    )
    and t.tgname in (
      'rail_xlsx_dislocation_append_only_v1',
      'rail_xlsx_resolution_append_only_v1',
      'rail_xlsx_correction_append_only_v1'
    )
    and not t.tgisinternal;
  if v_count<>3 then
    raise exception 'C1_APPEND_ONLY_TRIGGER_COUNT expected 3 got %',v_count;
  end if;
end
$$;

do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='portal_private'
    and c.relname in (
      'rail_xlsx_dislocation_events_v1',
      'rail_xlsx_resolution_decisions_v1',
      'rail_xlsx_correction_decisions_v1'
    )
    and not c.relrowsecurity;
  if v_bad<>0 then
    raise exception 'C1_RLS_NOT_ENABLED count=%',v_bad;
  end if;
end
$$;

do $$
declare
  v_insert integer;
  v_select integer;
begin
  select count(*) into v_insert
  from information_schema.role_table_grants
  where table_schema='portal_private'
    and table_name='rail_xlsx_dislocation_events_v1'
    and grantee='service_role'
    and privilege_type='INSERT';
  if v_insert<>0 then
    raise exception 'C1_SERVICE_ROLE_DIRECT_EVIDENCE_INSERT_GRANTED';
  end if;

  select count(*) into v_select
  from information_schema.role_table_grants
  where table_schema='portal_private'
    and table_name='rail_xlsx_dislocation_events_v1'
    and grantee='service_role'
    and privilege_type='SELECT';
  if v_select<>1 then
    raise exception 'C1_SERVICE_ROLE_EVIDENCE_SELECT_GRANT_MISSING';
  end if;
end
$$;

-- Emit inventory for logs/report.
select
  n.nspname as schema_name,
  c.relname as object_name,
  c.relkind,
  c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('portal_private','public')
  and (
    c.relname like 'rail_xlsx_%'
    or c.relname='rona_admin_rail_deal_read_model_v1'
  )
order by n.nspname,c.relkind,c.relname;

select
  c.relname as table_name,
  con.conname,
  con.contype,
  pg_get_constraintdef(con.oid,true) as definition
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='portal_private'
  and c.relname like 'rail_xlsx_%'
order by c.relname,con.conname;

select
  tablename,indexname,indexdef
from pg_indexes
where schemaname='portal_private'
  and (tablename like 'rail_xlsx_%' or indexname like 'rail_xlsx_%')
order by tablename,indexname;

select
  c.relname as table_name,p.polname,p.polcmd,
  array(select pg_get_userbyid(x) from unnest(p.polroles) x) as roles,
  pg_get_expr(p.polqual,p.polrelid) as using_expr,
  pg_get_expr(p.polwithcheck,p.polrelid) as check_expr
from pg_policy p
join pg_class c on c.oid=p.polrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='portal_private'
  and c.relname like 'rail_xlsx_%'
order by c.relname,p.polname;
