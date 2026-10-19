-- RONA lifecycle invariant: Owner commercial price approval != supplier resource approval.
-- This migration is idempotent with an earlier live deployment of the same exact patch.
-- It never changes existing commercial prices, resource approvals, payment facts, or actual documents.
do $repair$
declare
 v_before text;
 v_after text;
 v_guard_anchor text := '  did:=portal_private.next_deal_business_id();';
 v_workflow_anchor text := '  returning id into dk;';
 v_guard text := $guard$
  if not exists(
    select 1 from portal_private.owner_application_workflow w
    where w.application_key=a.id
      and w.supplier_approved_at is not null
      and w.business_status in ('SUPPLIER_APPROVED','DEAL')
  ) then
    raise exception using errcode='23514',
      message='SUPPLIER_RESOURCE_CONFIRMATION_REQUIRED_BEFORE_DEAL_REGISTRATION';
  end if;

$guard$;
 v_init text := $init$
  -- Defaults only: execution shell, NOT product/volume/payment approval.
  insert into portal_private.owner_deal_workflow(deal_key)
    values(dk) on conflict (deal_key) do nothing;
$init$;
begin
 select pg_get_functiondef(p.oid) into v_before
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='portal_private'
   and p.proname='server_executive_register_deal_v12'
   and pg_get_function_identity_arguments(p.oid)=
   'p_actor uuid, p_role portal_private.staff_functional_role_enum, p_application_id text, p_request_id uuid, p_correlation_id uuid';
 if v_before is null then raise exception 'REGISTRATION_FUNCTION_NOT_FOUND'; end if;
 if position('SUPPLIER_RESOURCE_CONFIRMATION_REQUIRED_BEFORE_DEAL_REGISTRATION' in v_before)>0 then
   if position('insert into portal_private.owner_deal_workflow(deal_key)' in v_before)=0
   then raise exception 'REGISTRATION_GUARD_PARTIAL_PATCH'; end if;
 else
   if encode(extensions.digest(v_before,'sha256'),'hex') <>
     'd1ea9ffe120ff21d0948f38f8b5317c354272b4a7d2ad402e045dc362983182a'
   then raise exception 'REGISTRATION_FUNCTION_SOURCE_CHANGED_REVIEW_REQUIRED'; end if;
   if (length(v_before)-length(replace(v_before,v_guard_anchor,'')))<>length(v_guard_anchor)
   or (length(v_before)-length(replace(v_before,v_workflow_anchor,'')))<>length(v_workflow_anchor)
   then raise exception 'REGISTRATION_FUNCTION_PATCH_ANCHOR_MISMATCH'; end if;
   insert into portal_private.operations_rpc_source_backups_v1
    (routine_name,backup_tag,source_sha256,sql_definition)
   values (
     'portal_private.server_executive_register_deal_v12(uuid,portal_private.staff_functional_role_enum,text,uuid,uuid)',
     'BEFORE_SUPPLIER_RESOURCE_AND_WORKFLOW_REPAIR_20261019',
     encode(extensions.digest(v_before,'sha256'),'hex'),v_before
   ) on conflict (routine_name,backup_tag) do nothing;
   v_after:=replace(v_before,v_guard_anchor,v_guard||v_guard_anchor);
   v_after:=replace(v_after,v_workflow_anchor,v_workflow_anchor||v_init);
   execute v_after;
 end if;
end
$repair$;

insert into portal_private.owner_deal_workflow(deal_key)
select distinct d.id
from portal_private.deals d
join portal_private.deal_registrations reg on reg.deal_key=d.id
join portal_private.client_applications a
  on a.id=reg.application_key and a.linked_deal_key=d.id
join portal_private.owner_application_workflow w
  on w.application_key=a.id
  and w.supplier_approved_at is not null
  and w.business_status='DEAL'
where d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
  and d.business_status='REGISTERED'
  and not exists(
    select 1 from portal_private.owner_deal_workflow ow where ow.deal_key=d.id
  )
on conflict (deal_key) do nothing;
