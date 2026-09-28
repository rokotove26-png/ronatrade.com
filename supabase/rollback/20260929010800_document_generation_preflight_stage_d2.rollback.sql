-- RONA Trade / AI Office Stage D.2 — non-destructive rollback
-- Restores pre-D.2 projections without deleting any canonical assets, reports, or audit provenance.
-- Stage D.2 helper functions remain for audit but become non-enforcing.

create or replace function portal_private.finance_canonical_report_registry_guard_v1()
returns trigger
language plpgsql
set search_path='pg_catalog','portal_private'
as $function$
begin
  new.updated_at:=clock_timestamp();
  return new;
end
$function$;

create or replace function portal_private.ai_canonical_document_resources_v1()
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select jsonb_build_object(
    'active_standard',coalesce((
      select jsonb_build_object(
        'standard_key',s.standard_key,
        'version',s.version,
        'status',s.status,
        'scope',s.scope,
        'title',s.title,
        'master_filename',s.master_filename,
        'master_sha256',s.master_sha256,
        'source_ref',s.source_ref,
        'rules',s.rules
      )
      from portal_private.owner_canonical_document_standards s
      where s.status='ACTIVE'
      order by s.version desc,s.updated_at desc
      limit 1
    ),'{}'::jsonb),
    'assets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'asset_key',a.asset_key,
        'version',a.version,
        'asset_type',a.asset_type,
        'status',a.status,
        'mime_type',a.mime_type,
        'sha256',a.sha256,
        'width_px',a.width_px,
        'height_px',a.height_px,
        'physical_width_mm',a.physical_width_mm,
        'physical_height_mm',a.physical_height_mm,
        'source_ref',a.source_ref
      ) order by a.asset_key,a.version desc)
      from portal_private.owner_canonical_document_assets a
      where a.status='ACTIVE'
    ),'[]'::jsonb),
    'source_lock_required',true,
    'invent_or_redraw_assets_prohibited',true
  )
$function$;

revoke all on function portal_private.ai_canonical_document_resources_v1()
from public,anon,authenticated,service_role;

create or replace function portal_private.finance_canonical_report_catalog_v1()
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select jsonb_build_object(
    'registry','FINANCE_CANONICAL_REPORT_REGISTRY_V1',
    'reports',coalesce((
      select jsonb_agg(jsonb_build_object(
        'report_key',r.report_key,
        'report_title',r.report_title,
        'version',r.version,
        'status',r.status,
        'output_format',r.output_format,
        'template_ref',r.template_ref,
        'authoritative_sources',r.authoritative_sources,
        'methodology_ref',r.methodology_ref,
        'source_ref',r.source_ref,
        'owner_approved_at',r.owner_approved_at
      ) order by r.report_key,r.version desc)
      from portal_private.finance_canonical_report_registry_v1 r
      where r.status='ACTIVE'
    ),'[]'::jsonb),
    'empty_registry_semantics','DO_NOT_INVENT_REPORT_TYPES__SOURCE_LOCK_OWNER_APPROVED_REPORTS_BEFORE_INSERT'
  )
$function$;

revoke all on function portal_private.finance_canonical_report_catalog_v1()
from public,anon,authenticated,service_role;

comment on function portal_private.owner_document_generation_preflight_v1(text) is
'Retained after Stage D.2 rollback for audit only. Pre-D.2 current-state projection restored.';

comment on function portal_private.finance_canonical_report_registry_readiness_v1() is
'Retained after Stage D.2 rollback for audit only. Registry enforcement restored to pre-D.2 behavior.';
