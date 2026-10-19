-- RONA canonical Deals read projection: distinguish a published basis from an Owner-approved
-- delivery basis. V4 forwards these fields from V3 unchanged (deal_json || closeout fields).
-- Run source-locked, only once. No business-data mutation.
do $basis_projection$
declare
  before_ddl text;
  after_ddl text;
  old_line text := E'          a.delivery_basis,\n          a.destination,';
  new_line text := E'          a.delivery_basis,\n          a.source_price_mode,\n          exists(\n            select 1 from portal_private.client_application_audit_v2 ba\n            where ba.application_id=a.application_id\n              and ba.event_type=''OWNER_APPROVED_DELIVERY_BASIS_RECONCILED_V1''\n              and ba.evidence->>''approved_basis''=a.delivery_basis\n              and nullif(ba.evidence->>''owner_directive_source'','''') is not null\n          ) as delivery_basis_owner_confirmed,\n          a.destination,';
begin
  select pg_get_functiondef(p.oid) into before_ddl
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='owner_deals_current_v3'
    and pg_get_function_identity_arguments(p.oid)='';
  if before_ddl is null then raise exception 'OWNER_DEALS_CURRENT_V3_MISSING';end if;
  if position('delivery_basis_owner_confirmed' in before_ddl)>0 then
    if position('a.source_price_mode' in before_ddl)=0 then
      raise exception 'OWNER_BASIS_PROJECTION_PARTIAL_PATCH';
    end if;
    return;
  end if;
  if encode(extensions.digest(before_ddl,'sha256'),'hex')
   <> 'e878e24cd344ea161a2226aedb30d8518deeafbc7c2ffa1006f62627dce668f2'
  then raise exception 'OWNER_DEALS_CURRENT_V3_SOURCE_DRIFT';end if;
  if length(before_ddl)-length(replace(before_ddl,old_line,''))<>length(old_line)
  then raise exception 'OWNER_BASIS_PROJECTION_ANCHOR_MISMATCH';end if;
  insert into portal_private.operations_rpc_source_backups_v1
    (routine_name,backup_tag,source_sha256,sql_definition)
  values('public.owner_deals_current_v3()',
    'BEFORE_OWNER_BASIS_PROVENANCE_20261019',
    encode(extensions.digest(before_ddl,'sha256'),'hex'),before_ddl)
  on conflict do nothing;
  after_ddl:=replace(before_ddl,old_line,new_line);
  execute after_ddl;
end
$basis_projection$;
