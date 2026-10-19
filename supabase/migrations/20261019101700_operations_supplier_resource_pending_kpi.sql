-- RONA Operations supplier decision KPI, 2026-10-19.
-- Source of truth: owner_application_workflow.SUPPLIER_PENDING, supplier_approved_at NULL.
-- This is read-only; client_application.status is NOT supplier-confirmation authority.
-- No mutation of client applications, resource decisions, deals, or reverse events.
create or replace view portal_private.operations_supplier_resource_pending_v1
with (security_invoker=true)
as
select a.application_id, a.id as application_key, a.source_system, a.product,
       a.quantity_tonnes, a.destination, a.submitted_at,
       a.status::text as client_application_status,
       w.business_status as supplier_workflow_status, w.admin_decided_at,
       w.supplier_approved_at, a.linked_deal_key,
       (a.status::text='ACCEPTED_AWAITING_DEAL_REGISTRATION') as needs_stage_semantics_review,
       'OWNER_APPLICATION_WORKFLOW'::text as authority_source,
       'SUPPLIER_RESOURCE_NOT_CONFIRMED'::text as resource_decision_state
from portal_private.client_applications a
join portal_private.owner_application_workflow w on w.application_key=a.id
where a.lifecycle_state::text='ACTIVE'
  and w.business_status='SUPPLIER_PENDING'
  and w.supplier_approved_at is null and a.linked_deal_key is null;
revoke all on portal_private.operations_supplier_resource_pending_v1 from public,anon,authenticated;

create table if not exists portal_private.operations_rpc_source_backups_v1(
 routine_name text not null,backup_tag text not null,source_sha256 text not null,
 sql_definition text not null,backed_up_at timestamptz not null default now(),
 primary key(routine_name,backup_tag)
);
alter table portal_private.operations_rpc_source_backups_v1 enable row level security;
revoke all on portal_private.operations_rpc_source_backups_v1 from public,anon,authenticated;

do $body$
declare
  original_source text;
  new_source text;
  kpi_old text := '''criticalEvents'',am.critical_events,';
  kpi_new text := $kpi$
'criticalEvents',am.critical_events,
    'supplierResourcePending',(select count(*)::int from portal_private.operations_supplier_resource_pending_v1),
    'supplierResourceStageConflict',(select count(*)::int from portal_private.operations_supplier_resource_pending_v1 where needs_stage_semantics_review),
    'failedPortalEvents',(
      select count(*)::int from portal_private.portal_reverse_events ev
      where ev.lifecycle_state::text='ACTIVE'
        and ev.processing_state='FAILED'
        and ev.event_type='CLIENT_MESSAGE_SUBMIT'
        and not exists(
           select 1 from portal_private.staff_tasks t
           where t.source_type='PORTAL_REVERSE_EVENT' and t.source_object_id=ev.event_id
             and coalesce(t.qa_only,false)=false and upper(t.status::text)
               not in ('ACKNOWLEDGED','COMPLETED','CLOSED','REJECTED','CANCELLED','CANCELED','DONE')
        )
    ),
$kpi$;
  action_old text := '''actions'',ap.actions,';
  action_new text := $act$
'supplierResourceAuthority','OWNER_APPLICATION_WORKFLOW',
  'supplierResourceQueue', (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'applicationId',pending.application_id,'product',pending.product,
        'quantityTonnes',pending.quantity_tonnes,'destination',pending.destination,
        'clientStatus',pending.client_application_status,
        'supplierStatus',pending.supplier_workflow_status,
        'supplierApprovedAt',pending.supplier_approved_at,
        'submittedAt',pending.submitted_at,
        'stageMismatch',pending.needs_stage_semantics_review,
        'resourceState',pending.resource_decision_state
      ) order by pending.submitted_at,pending.application_id
    ),'[]'::jsonb)
    from (select * from portal_private.operations_supplier_resource_pending_v1
       order by submitted_at,application_id limit 100) pending
  ),
  'actions',ap.actions,
$act$;
begin
  select pg_get_functiondef(p.oid) into original_source
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='rona_admin_operations_current_v2'
    and pg_get_function_identity_arguments(p.oid)='';
  if original_source is null then raise exception 'OPS_V2_FUNCTION_MISSING'; end if;
  -- Production might already include these read-only fields; never patch twice.
  if position('supplierResourcePending' in original_source)>0 then return; end if;
  if (length(original_source)-length(replace(original_source,kpi_old,'')))<>length(kpi_old)
      or (length(original_source)-length(replace(original_source,action_old,'')))<>length(action_old)
  then raise exception 'OPS_V2_SOURCE_ANCHOR_MISMATCH'; end if;
  insert into portal_private.operations_rpc_source_backups_v1
    (routine_name,backup_tag,source_sha256,sql_definition)
  values
    ('public.rona_admin_operations_current_v2()','BEFORE_SUPPLIER_RESOURCE_KPI_20261019',
     encode(extensions.digest(original_source,'sha256'),'hex'),original_source)
  on conflict do nothing;
  new_source:=replace(replace(original_source,kpi_old,kpi_new),action_old,action_new);
  execute new_source;
end;
$body$;
