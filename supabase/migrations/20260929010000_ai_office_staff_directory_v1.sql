-- RONA Trade / AI Office Staff Directory V1
-- OWNER_AUTHORITY=OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1
-- BUSINESS_DATA_MUTATION=NONE
-- AUTHORITY_EXPANSION=NONE
-- TOPOLOGY_EXPANSION=NONE

create table if not exists portal_private.ai_staff_directory_v1 (
  staff_key text primary key,
  canonical_ai_role portal_private.ai_business_role_enum null,
  identity_id text null,
  directory_kind text not null check (directory_kind in ('CANONICAL_AI','ADMIN_CONTOUR')),
  official_title text not null,
  full_name text null,
  gender_code text null check (gender_code in ('MALE','FEMALE','OTHER')),
  gender_status text not null default 'TO_CONFIRM' check (gender_status in ('CONFIRMED','TO_CONFIRM')),
  corporate_email text null,
  pilot_server_slug text null,
  pilot_app_name text null,
  profile_status text not null check (profile_status in ('ACTIVE','TO_CONFIRM','DIRECTORY_ONLY')),
  source_ref text not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (
    (directory_kind='CANONICAL_AI' and canonical_ai_role is not null and identity_id is not null)
    or (directory_kind='ADMIN_CONTOUR' and canonical_ai_role is null)
  )
);

create unique index if not exists ai_staff_directory_v1_role_uidx
  on portal_private.ai_staff_directory_v1(canonical_ai_role)
  where canonical_ai_role is not null;

create unique index if not exists ai_staff_directory_v1_email_uidx
  on portal_private.ai_staff_directory_v1(lower(corporate_email))
  where corporate_email is not null;

revoke all on portal_private.ai_staff_directory_v1 from public,anon,authenticated,service_role;

insert into portal_private.ai_staff_directory_v1(
  staff_key,canonical_ai_role,identity_id,directory_kind,official_title,full_name,
  gender_code,gender_status,corporate_email,pilot_server_slug,pilot_app_name,
  profile_status,source_ref,version
)
values
('OPERATIONS_DIRECTOR','OPERATIONS_DIRECTOR','AI-OPERATIONS-DIRECTOR','CANONICAL_AI','Операционный директор','Флеш Роман Караевич',null,'TO_CONFIRM','exec_director@ronaoil.com','rona-mcp-operations-pilot','RONA Operations Director Pilot','ACTIVE','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',1),
('LEGAL','LEGAL','AI-LEGAL','CANONICAL_AI','Юрисконсульт','Феня Артем Игоревич',null,'TO_CONFIRM','lawyer@ronaoil.com','rona-mcp-legal-pilot','RONA Legal Pilot','ACTIVE','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',1),
('FINANCE','FINANCE','AI-FINANCE','CANONICAL_AI','Главный бухгалтер','Групп Тамара Михайловна',null,'TO_CONFIRM','finance@ronaoil.com','rona-mcp-finance-pilot','RONA Finance Pilot','ACTIVE','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',1),
('COMMERCIAL_DIRECTOR','COMMERCIAL_DIRECTOR','AI-COMMERCIAL-DIRECTOR','CANONICAL_AI','Коммерческий директор','Линукс Артем Анатольевич',null,'TO_CONFIRM','analyst@ronaoil.com','rona-mcp-market-analyst-pilot','RONA Commercial Director Pilot','ACTIVE','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',1),
('RAIL_LOGISTICS','RAIL_LOGISTICS','AI-RAIL-LOGISTICS','CANONICAL_AI','Специалист по ЖД','Шалфей Клара Арсеньевна',null,'TO_CONFIRM','rail_spec@ronaoil.com','rona-mcp-rail-logistics-pilot','RONA Rail Logistics Pilot','ACTIVE','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',1),
('SYSTEM_ADMIN','SYSTEM_ADMIN','AI-SYSTEM-ADMIN','CANONICAL_AI','Системный администратор',null,null,'TO_CONFIRM',null,'rona-mcp-system-admin-pilot','RONA System Admin Pilot','TO_CONFIRM','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',1),
('ASSISTANT',null,null,'ADMIN_CONTOUR','Ассистент','Красная Карина Карловна',null,'TO_CONFIRM','office_kg@ronaoil.com',null,null,'DIRECTORY_ONLY','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',1)
on conflict (staff_key) do update
set official_title=excluded.official_title,
    full_name=excluded.full_name,
    corporate_email=excluded.corporate_email,
    pilot_server_slug=excluded.pilot_server_slug,
    pilot_app_name=excluded.pilot_app_name,
    profile_status=excluded.profile_status,
    source_ref=excluded.source_ref,
    version=greatest(portal_private.ai_staff_directory_v1.version,excluded.version),
    updated_at=clock_timestamp();

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

comment on table portal_private.ai_staff_directory_v1 is
'Canonical office directory. Personal identity is separate from authority topology. ADMIN_CONTOUR rows do not create canonical AI roles.';
