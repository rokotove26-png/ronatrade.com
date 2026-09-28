-- RONA Trade / AI Office Stage D.2 — document generation preflight + Finance report readiness
-- OWNER_AUTHORITY=PENDING_SEPARATE_PRODUCTION_WRITE_APPROVAL
-- BUSINESS_DATA_MUTATION=NONE
-- AUTHORITY_EXPANSION=NONE
-- MIXED_SCOPE=SYSTEM_ADMIN_TECHNICAL_ENFORCEMENT_ONLY__FINANCE_CONTENT_NOT_MATERIALIZED
-- DOCUMENT_GENERATION=FAIL_CLOSED
-- FINANCE_REPORT_POPULATION=SOURCE_ABSENT_DO_NOT_INVENT

create or replace function portal_private.owner_document_generation_preflight_v1(
  p_document_kind text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','portal_private','extensions'
as $function$
declare
  v_asset_preflight jsonb;
  v_standard portal_private.owner_canonical_document_standards%rowtype;
  v_assets jsonb;
  v_issues jsonb:='[]'::jsonb;
  v_kind text:=nullif(btrim(coalesce(p_document_kind,'')),'');
begin
  v_asset_preflight:=portal_private.owner_document_standard_v2_preflight_v1();

  select *
    into v_standard
  from portal_private.owner_canonical_document_standards
  where standard_key='RONA-DOC-STANDARD'
    and status='ACTIVE'
  order by version desc,updated_at desc
  limit 1;

  if not found then
    v_issues:=v_issues||jsonb_build_array('ACTIVE_DOCUMENT_STANDARD_MISSING');
  elsif v_standard.version<>2 then
    v_issues:=v_issues||jsonb_build_array('ACTIVE_DOCUMENT_STANDARD_NOT_V2');
  end if;

  if coalesce((v_asset_preflight->>'ready')::boolean,false) is not true then
    v_issues:=v_issues||jsonb_build_array('CANONICAL_ASSET_PREFLIGHT_NOT_READY');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
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
  ) order by a.asset_key),'[]'::jsonb)
    into v_assets
  from portal_private.owner_canonical_document_assets a
  where a.status='ACTIVE'
    and a.asset_key in (
      'RONA-CANONICAL-LETTERHEAD',
      'RONA-CANONICAL-SEAL',
      'RONA-CANONICAL-SIGNATURE'
    );

  if jsonb_array_length(v_assets)<>3 then
    v_issues:=v_issues||jsonb_build_array('CANONICAL_ASSET_SET_INCOMPLETE');
  end if;

  return jsonb_build_object(
    'contract','RONA_DOCUMENT_GENERATION_PREFLIGHT_V1',
    'ready',jsonb_array_length(v_issues)=0,
    'document_kind',coalesce(v_kind,'GENERIC_EXTERNAL_DOCUMENT'),
    'issues',v_issues,
    'active_standard',case when v_standard.standard_key is null then '{}'::jsonb else jsonb_build_object(
      'standard_key',v_standard.standard_key,
      'version',v_standard.version,
      'status',v_standard.status,
      'scope',v_standard.scope,
      'title',v_standard.title,
      'master_filename',v_standard.master_filename,
      'master_sha256',v_standard.master_sha256,
      'source_ref',v_standard.source_ref,
      'rules',v_standard.rules
    ) end,
    'assets',v_assets,
    'source_lock_required',true,
    'binary_assets_exposed_in_projection',false,
    'generation_rules',jsonb_build_object(
      'must_assert_before_generation_or_issuance',true,
      'canonical_assets_only',true,
      'invent_assets_prohibited',true,
      'redraw_assets_prohibited',true,
      'silent_asset_substitution_prohibited',true,
      'fail_closed_on_missing_or_conflicting_standard',true
    )
  );
end
$function$;

revoke all on function portal_private.owner_document_generation_preflight_v1(text)
from public,anon,authenticated,service_role;

create or replace function portal_private.owner_document_generation_assert_v1(
  p_document_kind text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','portal_private'
as $function$
declare
  v_preflight jsonb;
begin
  v_preflight:=portal_private.owner_document_generation_preflight_v1(p_document_kind);
  if coalesce((v_preflight->>'ready')::boolean,false) is not true then
    raise exception 'RONA_DOCUMENT_GENERATION_PREFLIGHT_FAILED: %',v_preflight->'issues';
  end if;
  return v_preflight;
end
$function$;

revoke all on function portal_private.owner_document_generation_assert_v1(text)
from public,anon,authenticated,service_role;

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
    'generation_preflight',portal_private.owner_document_generation_preflight_v1(null),
    'source_lock_required',true,
    'invent_or_redraw_assets_prohibited',true
  )
$function$;

revoke all on function portal_private.ai_canonical_document_resources_v1()
from public,anon,authenticated,service_role;

create or replace function portal_private.finance_canonical_report_registry_guard_v1()
returns trigger
language plpgsql
set search_path='pg_catalog','portal_private'
as $function$
begin
  if new.status='ACTIVE' then
    if new.owner_approved_at is null then
      raise exception 'FINANCE_CANONICAL_REPORT_OWNER_APPROVAL_REQUIRED';
    end if;
    if nullif(btrim(coalesce(new.source_ref,'')),'') is null then
      raise exception 'FINANCE_CANONICAL_REPORT_SOURCE_REF_REQUIRED';
    end if;
    if jsonb_typeof(new.authoritative_sources)<>'array'
       or jsonb_array_length(new.authoritative_sources)=0 then
      raise exception 'FINANCE_CANONICAL_REPORT_AUTHORITATIVE_SOURCES_REQUIRED';
    end if;
    if nullif(btrim(coalesce(new.template_ref,'')),'') is null
       and nullif(btrim(coalesce(new.methodology_ref,'')),'') is null then
      raise exception 'FINANCE_CANONICAL_REPORT_TEMPLATE_OR_METHODOLOGY_REQUIRED';
    end if;
  end if;

  new.updated_at:=clock_timestamp();
  return new;
end
$function$;

drop trigger if exists trg_finance_canonical_report_registry_guard_v1
on portal_private.finance_canonical_report_registry_v1;

create trigger trg_finance_canonical_report_registry_guard_v1
before insert or update
on portal_private.finance_canonical_report_registry_v1
for each row
execute function portal_private.finance_canonical_report_registry_guard_v1();

create or replace function portal_private.finance_canonical_report_registry_readiness_v1()
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  with counts as (
    select
      count(*) filter(where status='ACTIVE')::integer as active_count,
      count(*) filter(where status='TO_VERIFY')::integer as to_verify_count,
      count(*) filter(where status='SUPERSEDED')::integer as superseded_count
    from portal_private.finance_canonical_report_registry_v1
  )
  select jsonb_build_object(
    'contract','FINANCE_CANONICAL_REPORT_REGISTRY_READINESS_V1',
    'population_status',case when active_count>0 then 'READY' else 'SOURCE_ABSENT' end,
    'active_count',active_count,
    'to_verify_count',to_verify_count,
    'superseded_count',superseded_count,
    'content_owner','FINANCE',
    'owner_approval_required',true,
    'system_admin_scope','TECHNICAL_MATERIALIZATION_ONLY',
    'do_not_invent_report_types',true,
    'current_blocker',case when active_count=0 then 'NO_OWNER_APPROVED_SOURCE_LOCKED_FINANCE_REPORT_DEFINITION' else null end
  )
  from counts
$function$;

revoke all on function portal_private.finance_canonical_report_registry_readiness_v1()
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
    'readiness',portal_private.finance_canonical_report_registry_readiness_v1(),
    'empty_registry_semantics','DO_NOT_INVENT_REPORT_TYPES__SOURCE_LOCK_OWNER_APPROVED_REPORTS_BEFORE_INSERT'
  )
$function$;

revoke all on function portal_private.finance_canonical_report_catalog_v1()
from public,anon,authenticated,service_role;

comment on function portal_private.owner_document_generation_preflight_v1(text) is
'Stage D.2 fail-closed generation preflight. Exposes metadata only; exact canonical binary assets remain private.';

comment on function portal_private.owner_document_generation_assert_v1(text) is
'Any document-producing workflow must call this before generation or issuance. Raises on stale/missing/conflicting standard or asset state.';

comment on function portal_private.finance_canonical_report_registry_readiness_v1() is
'Finance report catalog readiness. Empty means SOURCE_ABSENT, not permission for SYSTEM_ADMIN to invent report content.';
