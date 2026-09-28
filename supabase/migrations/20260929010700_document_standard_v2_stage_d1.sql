-- RONA Trade / AI Office Stage D.1 — RONA-DOC-STANDARD v2 + canonical document asset materialization gate
-- OWNER_AUTHORITY=PENDING_SEPARATE_PRODUCTION_WRITE_APPROVAL
-- BUSINESS_DATA_MUTATION=NONE
-- AUTHORITY_EXPANSION=NONE
-- SOURCE_LOCK_REQUIRED=TRUE
-- ALTERNATIVE_OR_REDRAW_ASSETS=FORBIDDEN
-- STANDARD_ACTIVATION=EXPLICIT_OWNER_GATED_MATERIALIZATION_ONLY

create table if not exists portal_private.owner_canonical_document_asset_manifest_v2 (
  asset_key text primary key,
  version integer not null check (version>0),
  asset_type text not null check (asset_type in ('SIGNATURE','SEAL','LETTERHEAD')),
  mime_type text not null,
  expected_sha256 text not null check (expected_sha256 ~ '^[0-9a-f]{64}$'),
  expected_width_px integer null check (expected_width_px is null or expected_width_px>0),
  expected_height_px integer null check (expected_height_px is null or expected_height_px>0),
  physical_width_mm numeric null check (physical_width_mm is null or physical_width_mm>0),
  physical_height_mm numeric null check (physical_height_mm is null or physical_height_mm>0),
  source_file_id text not null,
  source_filename text not null,
  source_file_sha256 text not null check (source_file_sha256 ~ '^[0-9a-f]{64}$'),
  source_member_path text null,
  derivation text not null,
  source_ref text not null,
  required_for_standard boolean not null default true,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on portal_private.owner_canonical_document_asset_manifest_v2
from public,anon,authenticated,service_role;

insert into portal_private.owner_canonical_document_asset_manifest_v2(
  asset_key,version,asset_type,mime_type,expected_sha256,
  expected_width_px,expected_height_px,physical_width_mm,physical_height_mm,
  source_file_id,source_filename,source_file_sha256,source_member_path,
  derivation,source_ref,required_for_standard
) values
(
  'RONA-CANONICAL-SIGNATURE',1,'SIGNATURE','image/png',
  '7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085',
  500,500,null,null,
  'file_00000000600481f48807658da7ee71ff','Канонические подпись и печать.docx',
  '8418f9d1b1d8b81937ac25b5f771c3494ec92c72cd97da6aa86191f6c2e2676d',
  'word/media/image2.png','EXACT_EMBEDDED_MEMBER_NO_TRANSFORM',
  'PROJECT_FILE:file_00000000600481f48807658da7ee71ff|member=word/media/image2.png|sha256=7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085',
  true
),
(
  'RONA-CANONICAL-SEAL',1,'SEAL','image/jpeg',
  '0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b',
  535,535,35,35,
  'file_00000000600481f48807658da7ee71ff','Канонические подпись и печать.docx',
  '8418f9d1b1d8b81937ac25b5f771c3494ec92c72cd97da6aa86191f6c2e2676d',
  'word/media/image1.jpg','EXACT_EMBEDDED_MEMBER_NO_TRANSFORM',
  'PROJECT_FILE:file_00000000600481f48807658da7ee71ff|member=word/media/image1.jpg|sha256=0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b',
  true
),
(
  'RONA-CANONICAL-LETTERHEAD',1,'LETTERHEAD','image/png',
  'fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b',
  1414,2000,210,297,
  'file_00000000b57c81f489a1cd0e61a55597','Фирменный бланк(1).docx',
  'dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca',
  null,'DIRECT_PAGE_1_RENDER_LIBREOFFICE_25_2_3_2_NO_REDRAW',
  'PROJECT_FILE:file_00000000b57c81f489a1cd0e61a55597|source_sha256=dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca|render_sha256=fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b',
  true
)
on conflict(asset_key) do update
set version=excluded.version,
    asset_type=excluded.asset_type,
    mime_type=excluded.mime_type,
    expected_sha256=excluded.expected_sha256,
    expected_width_px=excluded.expected_width_px,
    expected_height_px=excluded.expected_height_px,
    physical_width_mm=excluded.physical_width_mm,
    physical_height_mm=excluded.physical_height_mm,
    source_file_id=excluded.source_file_id,
    source_filename=excluded.source_filename,
    source_file_sha256=excluded.source_file_sha256,
    source_member_path=excluded.source_member_path,
    derivation=excluded.derivation,
    source_ref=excluded.source_ref,
    required_for_standard=excluded.required_for_standard,
    updated_at=clock_timestamp();

create or replace function portal_private.owner_document_standard_v2_rules_v1()
returns jsonb
language sql
immutable
set search_path='pg_catalog'
as $function$
  select jsonb_build_object(
    'contract','RONA-DOC-STANDARD',
    'version',2,
    'scope','ALL_EXTERNAL_DOCUMENTS',
    'layout',jsonb_build_object(
      'font','Arial Narrow',
      'font_size_pt',12.5,
      'body_alignment','JUSTIFY',
      'first_line_indent_required',true,
      'first_line_indent_value','DOCUMENT_PROFILE_CONTROLLED__DO_NOT_INVENT',
      'paragraph_spacing','CONTROLLED',
      'heading_text_spacing','CONTROLLED',
      'section_titles_alignment','CENTER',
      'corporate_layout','ENGLISH_STYLE_CORPORATE',
      'bold_company_names',true,
      'bold_director_names',true,
      'include_rona_website_in_requisites',true
    ),
    'letterhead',jsonb_build_object(
      'asset_key','RONA-CANONICAL-LETTERHEAD',
      'sha256','fe663c16e65ce65827285d3990a7324b23fcc4ff7de797effaf0546a404a984b',
      'source_docx_sha256','dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca',
      'canonical_only',true,
      'redraw_or_recreate_prohibited',true
    ),
    'signature',jsonb_build_object(
      'asset_key','RONA-CANONICAL-SIGNATURE',
      'sha256','7479526756c5d39b64ea7223d707ca20984cd8ea2cd1f9fadbf2e6df93b3d085',
      'canonical_only',true,
      'alternative_signatures_prohibited',true,
      'placement_each_page_ru','Продавец',
      'placement_each_page_en','Supplier',
      'main_signature_block_both_language_sides',true
    ),
    'seal',jsonb_build_object(
      'asset_key','RONA-CANONICAL-SEAL',
      'sha256','0d6f641853949f961eb79859b123fd48df41e84493cca121200254d673e6ca2b',
      'physical_width_mm',35,
      'physical_height_mm',35,
      'placement','MAIN_SIGNATURE_SECTION_ONLY_NEXT_TO_SELLER_SIGNATURE',
      'seal_on_each_page',false,
      'canonical_only',true,
      'alternative_seals_prohibited',true
    ),
    'source_lock',jsonb_build_object(
      'required',true,
      'asset_bytes_hash_required',true,
      'asset_provenance_required',true,
      'invent_assets_prohibited',true,
      'redraw_assets_prohibited',true,
      'silent_asset_substitution_prohibited',true
    ),
    'versioning',jsonb_build_object(
      'previous_status','SUPERSEDED',
      'previous_versions_retained_for_audit',true,
      'changes_require_explicit_owner_approval',true
    )
  )
$function$;

revoke all on function portal_private.owner_document_standard_v2_rules_v1()
from public,anon,authenticated,service_role;

create or replace function portal_private.owner_document_standard_v2_preflight_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path='pg_catalog','portal_private','extensions'
as $function$
declare
  v_issues jsonb:='[]'::jsonb;
  v_required integer:=0;
  v_materialized integer:=0;
  r record;
  a record;
begin
  if not exists(
    select 1
    from portal_private.owner_canonical_document_standards
    where standard_key='RONA-DOC-STANDARD'
      and version=1
  ) then
    v_issues:=v_issues||jsonb_build_array('V1_STANDARD_MISSING');
  end if;

  for r in
    select *
    from portal_private.owner_canonical_document_asset_manifest_v2
    where required_for_standard=true
    order by asset_key
  loop
    v_required:=v_required+1;

    select asset_key,version,asset_type,status,mime_type,sha256,content,
           width_px,height_px,physical_width_mm,physical_height_mm,source_ref
      into a
    from portal_private.owner_canonical_document_assets
    where asset_key=r.asset_key
      and version=r.version
    limit 1;

    if not found then
      v_issues:=v_issues||jsonb_build_array(r.asset_key||':ASSET_MISSING');
      continue;
    end if;

    if a.asset_type<>r.asset_type
       or a.mime_type<>r.mime_type
       or lower(a.sha256)<>lower(r.expected_sha256) then
      v_issues:=v_issues||jsonb_build_array(r.asset_key||':METADATA_MISMATCH');
      continue;
    end if;

    if encode(extensions.digest(a.content,'sha256'),'hex')<>r.expected_sha256 then
      v_issues:=v_issues||jsonb_build_array(r.asset_key||':BYTE_HASH_MISMATCH');
      continue;
    end if;

    if r.expected_width_px is not null and a.width_px is distinct from r.expected_width_px then
      v_issues:=v_issues||jsonb_build_array(r.asset_key||':WIDTH_MISMATCH');
      continue;
    end if;

    if r.expected_height_px is not null and a.height_px is distinct from r.expected_height_px then
      v_issues:=v_issues||jsonb_build_array(r.asset_key||':HEIGHT_MISMATCH');
      continue;
    end if;

    if r.physical_width_mm is not null and a.physical_width_mm is distinct from r.physical_width_mm then
      v_issues:=v_issues||jsonb_build_array(r.asset_key||':PHYSICAL_WIDTH_MISMATCH');
      continue;
    end if;

    if r.physical_height_mm is not null and a.physical_height_mm is distinct from r.physical_height_mm then
      v_issues:=v_issues||jsonb_build_array(r.asset_key||':PHYSICAL_HEIGHT_MISMATCH');
      continue;
    end if;

    v_materialized:=v_materialized+1;
  end loop;

  return jsonb_build_object(
    'contract','RONA_DOC_STANDARD_V2_PREFLIGHT_V1',
    'ready',jsonb_array_length(v_issues)=0 and v_required=3 and v_materialized=3,
    'required_assets',v_required,
    'materialized_assets',v_materialized,
    'issues',v_issues,
    'standard_rules',portal_private.owner_document_standard_v2_rules_v1(),
    'activation_requires_explicit_owner_write',true
  );
end
$function$;

revoke all on function portal_private.owner_document_standard_v2_preflight_v1()
from public,anon,authenticated,service_role;

create or replace function portal_private.owner_activate_document_standard_v2_v1()
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','portal_private'
as $function$
declare
  v_preflight jsonb;
  v_rules jsonb;
  v_existing record;
begin
  v_preflight:=portal_private.owner_document_standard_v2_preflight_v1();
  if coalesce((v_preflight->>'ready')::boolean,false) is not true then
    raise exception 'RONA_DOC_STANDARD_V2_PREFLIGHT_FAILED: %',v_preflight->'issues';
  end if;

  v_rules:=portal_private.owner_document_standard_v2_rules_v1();

  select * into v_existing
  from portal_private.owner_canonical_document_standards
  where standard_key='RONA-DOC-STANDARD'
    and version=2
  limit 1;

  if found then
    if v_existing.master_sha256 is distinct from 'dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca'
       or v_existing.rules is distinct from v_rules then
      raise exception 'RONA_DOC_STANDARD_V2_EXISTING_CONFLICT';
    end if;
  end if;

  update portal_private.owner_canonical_document_standards
     set status='SUPERSEDED',updated_at=clock_timestamp()
   where standard_key='RONA-DOC-STANDARD'
     and status='ACTIVE'
     and version<>2;

  insert into portal_private.owner_canonical_document_standards(
    standard_key,version,status,scope,title,master_filename,master_sha256,
    rules,owner_approved_at,source_ref
  ) values(
    'RONA-DOC-STANDARD',2,'ACTIVE','ALL_EXTERNAL_DOCUMENTS',
    'RONA TRADE — CANONICAL DOCUMENT STANDARD v2.0',
    'Фирменный бланк(1).docx',
    'dc7f591881b829b3888df96ad01167a4cfc056865850b140113bdf8aa53994ca',
    v_rules,clock_timestamp(),
    'OWNER_INSTRUCTION_2026-09-29_RONA_DOC_STANDARD_V2_STAGE_D1'
  )
  on conflict(standard_key,version) do update
     set status='ACTIVE',
         scope=excluded.scope,
         title=excluded.title,
         master_filename=excluded.master_filename,
         master_sha256=excluded.master_sha256,
         rules=excluded.rules,
         source_ref=excluded.source_ref,
         updated_at=clock_timestamp();

  update portal_private.owner_canonical_document_assets a
     set status='ACTIVE',updated_at=clock_timestamp()
   where exists(
     select 1
     from portal_private.owner_canonical_document_asset_manifest_v2 m
     where m.asset_key=a.asset_key
       and m.version=a.version
       and m.required_for_standard=true
   );

  return jsonb_build_object(
    'ok',true,
    'standard_key','RONA-DOC-STANDARD',
    'version',2,
    'status','ACTIVE',
    'preflight',v_preflight,
    'business_data_mutation',false,
    'authority_expansion',false
  );
end
$function$;

revoke all on function portal_private.owner_activate_document_standard_v2_v1()
from public,anon,authenticated,service_role;

comment on table portal_private.owner_canonical_document_asset_manifest_v2 is
'Stage D.1 source-lock manifest for exact canonical signature, seal and letterhead bytes. It is not an alternative asset store.';

comment on function portal_private.owner_document_standard_v2_preflight_v1() is
'Fail-closed preflight: RONA-DOC-STANDARD v2 cannot activate until all three exact source-locked asset byte hashes are materialized.';

comment on function portal_private.owner_activate_document_standard_v2_v1() is
'Owner-gated activation only. Supersedes v1 after exact asset-byte preflight; does not create business facts or expand authority.';
