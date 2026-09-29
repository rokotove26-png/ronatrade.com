-- RONA Trade / AI Office Stage D.2 hotfix — standard rowtype-safe preflight
-- Corrects the production preflight introduced by document_generation_preflight_stage_d2.
-- No business data mutation. No authority expansion.

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

comment on function portal_private.owner_document_generation_preflight_v1(text) is
'Stage D.2 fail-closed generation preflight. Rowtype-safe hotfix after production smoke; exposes metadata only.';
