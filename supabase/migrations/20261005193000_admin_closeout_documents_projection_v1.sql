-- Admin CLOSEOUT documents projection hotfix.
-- Root cause: owner_deals_current_v3() projected only ADDENDUM/INVOICE/SIGNED_ADDENDUM,
-- while Admin CLOSEOUT uploads are stored as EMPTY_WAGON_RETURN_* and client CLOSEOUT
-- uploads as SMGS_*. Uploads succeeded, but owner_deals_current_v4() inherited the stale
-- documents array from V3, so the UI kept showing "Файл ещё не прикреплён".
--
-- This migration changes only the document-kind projection of owner_deals_current_v3().
-- All authorization, Finance, Rail and deal projection logic remains byte-for-byte intact.

do $migration$
declare
  v_src text;
  v_old constant text :=
    'and odd.document_kind in (''ADDENDUM'', ''INVOICE'', ''SIGNED_ADDENDUM'')';
  v_new constant text :=
    'and odd.document_kind in (''ADDENDUM'', ''INVOICE'', ''SIGNED_ADDENDUM'', ''EMPTY_WAGON_RETURN_INSTRUCTION'', ''EMPTY_WAGON_RETURN_RAIL_CODES'', ''SMGS_DELIVERY_STAMP'', ''SMGS_EMPTY_WAGONS'')';
begin
  select p.prosrc
    into v_src
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='owner_deals_current_v3'
    and p.pronargs=0;

  if v_src is null then
    raise exception 'owner_deals_current_v3() not found';
  end if;

  if position(v_new in v_src)>0 then
    return;
  end if;

  if position(v_old in v_src)=0 then
    raise exception 'owner_deals_current_v3 document projection contract changed unexpectedly';
  end if;

  v_src := replace(v_src,v_old,v_new);

  execute format(
    'create or replace function public.owner_deals_current_v3() returns jsonb language plpgsql security definer set search_path to pg_catalog, public, portal_private, auth as %L',
    v_src
  );
end
$migration$;

comment on function public.owner_deals_current_v3() is
'ADMIN_DEALS_CURRENT_V3; closeout document projection includes EMPTY_WAGON_RETURN_* and SMGS_* as of 2026-10-05.';
