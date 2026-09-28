-- RONA Trade / Finance dual official title correction V1
-- OWNER_AUTHORITY=OWNER_INSTRUCTION:2026-09-29:FINANCE_DUAL_TITLE_V1
-- BUSINESS_DATA_MUTATION=NONE
-- AUTHORITY_EXPANSION=NONE
-- TOPOLOGY_EXPANSION=NONE

alter table portal_private.ai_staff_directory_v1
  add column if not exists additional_titles jsonb not null default '[]'::jsonb
  check (jsonb_typeof(additional_titles)='array');

update portal_private.ai_staff_directory_v1
set official_title='Финансовый директор',
    additional_titles=jsonb_build_array('Главный бухгалтер'),
    source_ref='OWNER_INSTRUCTION:2026-09-29:FINANCE_DUAL_TITLE_V1',
    version=greatest(version,2),
    updated_at=clock_timestamp()
where staff_key='FINANCE'
  and canonical_ai_role='FINANCE'::portal_private.ai_business_role_enum;

create or replace function portal_private.ai_staff_office_directory_v1()
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'staff_key',d.staff_key,
      'canonical_role',case when d.canonical_ai_role is null then null else d.canonical_ai_role::text end,
      'identity_id',d.identity_id,
      'directory_kind',d.directory_kind,
      'official_title',d.official_title,
      'additional_titles',d.additional_titles,
      'official_titles',jsonb_build_array(d.official_title) || d.additional_titles,
      'full_name',d.full_name,
      'gender',d.gender_code,
      'gender_status',d.gender_status,
      'corporate_email',d.corporate_email,
      'profile_status',d.profile_status
    )
    order by case d.directory_kind when 'CANONICAL_AI' then 1 else 2 end,d.official_title,d.staff_key
  ),'[]'::jsonb)
  from portal_private.ai_staff_directory_v1 d
  where d.profile_status in ('ACTIVE','TO_CONFIRM','DIRECTORY_ONLY')
$function$;

revoke all on function portal_private.ai_staff_office_directory_v1()
from public,anon,authenticated,service_role;

create or replace function portal_private.ai_staff_identity_profile_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select coalesce((
    select jsonb_build_object(
      'canonical_role',d.canonical_ai_role::text,
      'identity_id',d.identity_id,
      'official_title',d.official_title,
      'additional_titles',d.additional_titles,
      'official_titles',jsonb_build_array(d.official_title) || d.additional_titles,
      'full_name',d.full_name,
      'gender',d.gender_code,
      'gender_status',d.gender_status,
      'corporate_email',d.corporate_email,
      'pilot_server_slug',d.pilot_server_slug,
      'pilot_app_name',d.pilot_app_name,
      'profile_status',d.profile_status,
      'profile_complete',d.full_name is not null and d.gender_status='CONFIRMED' and d.corporate_email is not null,
      'source_ref',d.source_ref,
      'version',d.version
    )
    from portal_private.ai_staff_directory_v1 d
    where d.canonical_ai_role=portal_private.ai_canonical_role_map_v1(p_role::text)::portal_private.ai_business_role_enum
    limit 1
  ),jsonb_build_object(
    'canonical_role',portal_private.ai_canonical_role_map_v1(p_role::text),
    'profile_status','MISSING',
    'profile_complete',false
  ))
$function$;

revoke all on function portal_private.ai_staff_identity_profile_v1(
  portal_private.ai_business_role_enum
) from public,anon,authenticated,service_role;

comment on column portal_private.ai_staff_directory_v1.additional_titles is
'Additional official job titles held by the same office employee. Does not create additional canonical AI roles.';
