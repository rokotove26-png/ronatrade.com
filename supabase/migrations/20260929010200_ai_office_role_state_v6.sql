-- RONA Trade / Role State Recovery V6
-- OWNER_AUTHORITY=OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1
-- BUSINESS_DATA_MUTATION=NONE
-- AUTHORITY_EXPANSION=NONE
-- DEPENDS_ON=20260929010000_ai_office_staff_directory_v1.sql,20260929010100_ai_office_competence_governance_v1.sql

create table if not exists portal_private.finance_canonical_report_registry_v1 (
  report_key text primary key,
  report_title text not null,
  version integer not null check (version > 0),
  status text not null check (status in ('ACTIVE','SUPERSEDED','TO_VERIFY')),
  output_format text not null,
  template_ref text null,
  authoritative_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(authoritative_sources)='array'),
  methodology_ref text null,
  source_ref text not null,
  owner_approved_at timestamptz null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

revoke all on portal_private.finance_canonical_report_registry_v1 from public,anon,authenticated,service_role;

create or replace function portal_private.ai_role_mailbox_state_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language plpgsql
stable
security definer
set search_path='portal_private','public','pg_catalog'
as $function$
declare
  v_role text:=portal_private.ai_canonical_role_map_v1(p_role::text);
  v_mailbox text;
  v_row record;
begin
  select d.corporate_email
    into v_mailbox
  from portal_private.ai_staff_directory_v1 d
  where d.canonical_ai_role=v_role::portal_private.ai_business_role_enum
  limit 1;

  if v_mailbox is null then
    return jsonb_build_object(
      'corporate_email',null,
      'binding_status','TO_CONFIRM',
      'sync_status','NOT_CONFIGURED',
      'transport_poll_minutes',null,
      'internal_staff_channel','AUDITED_COORDINATION',
      'external_mail_channel','ROLE_MAILBOX'
    );
  end if;

  select s.mailbox,s.folder,s.last_uid,s.last_sync_at,s.status,s.last_error,s.updated_at
    into v_row
  from public.rona_mail_sync_state s
  where lower(s.mailbox)=lower(v_mailbox)
    and s.folder='INBOX'
  order by s.updated_at desc
  limit 1;

  return jsonb_build_object(
    'corporate_email',v_mailbox,
    'binding_status','BOUND',
    'sync_status',coalesce(v_row.status,'NO_SYNC_STATE'),
    'last_sync_at',v_row.last_sync_at,
    'last_uid',v_row.last_uid,
    'last_error',case when coalesce(v_row.status,'')='ERROR' then v_row.last_error else null end,
    'transport_poll_minutes',5,
    'internal_staff_channel','AUDITED_COORDINATION',
    'external_mail_channel','ROLE_MAILBOX'
  );
end
$function$;

revoke all on function portal_private.ai_role_mailbox_state_v1(
  portal_private.ai_business_role_enum
) from public,anon,authenticated,service_role;

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

create or replace function portal_private.ai_role_state_current_v6(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path='portal_private','public','pg_catalog'
as $function$
declare
  v_role text:=portal_private.ai_canonical_role_map_v1(p_role::text);
  v_state jsonb;
  v_bootstrap jsonb;
  v_routing jsonb;
  v_reports jsonb;
begin
  v_state:=portal_private.ai_role_state_current_v3(
    v_role::portal_private.ai_business_role_enum,
    p_task_limit,
    p_coord_limit
  );

  v_routing:=portal_private.ai_role_routing_contract_v4()
    - 'roles'
    - 'task_assignment_roles';

  v_bootstrap:=coalesce(v_state->'bootstrap','{}'::jsonb)
    || jsonb_build_object(
      'routing_contract','RONA_ROLE_ROUTING_CONTRACT_V4',
      'human_actor_rule','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
      'canonical_role_topology','OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
      'standing_governance','RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',
      'competence_gate','RONA_AI_COMPETENCE_GATE_V1',
      'nonexistent_roles',jsonb_build_array('ACCOUNTING','EXECUTIVE_DIRECTOR'),
      'dependency_materializer','RONA_AI_TASK_DEPENDENCY_MATERIALIZER_V2',
      'full_role_registry_in_current_state',false,
      'office_directory_in_current_state',true,
      'mailbox_state_in_current_state',true
    );

  if v_role='FINANCE' then
    v_reports:=portal_private.finance_canonical_report_catalog_v1();
  else
    v_reports:=jsonb_build_object(
      'registry','FINANCE_CANONICAL_REPORT_REGISTRY_V1',
      'reports','[]'::jsonb,
      'visible_to_role',false
    );
  end if;

  return v_state
    || jsonb_build_object(
      'data_contract','RONA_ROLE_STATE_RECOVERY_V6',
      'functional_role',v_role,
      'routing_capabilities',v_routing,
      'dependency_graph',portal_private.ai_task_dependency_graph_v1(
        v_role::portal_private.ai_business_role_enum
      ),
      'bootstrap',v_bootstrap,
      'identity_profile',portal_private.ai_staff_identity_profile_v1(
        v_role::portal_private.ai_business_role_enum
      ),
      'office_directory',portal_private.ai_staff_office_directory_v1(),
      'competence_contract',portal_private.ai_role_competence_contract_v1(
        v_role::portal_private.ai_business_role_enum
      ),
      'mailbox',portal_private.ai_role_mailbox_state_v1(
        v_role::portal_private.ai_business_role_enum
      ),
      'canonical_document_resources',portal_private.ai_canonical_document_resources_v1(),
      'canonical_report_catalog',v_reports
    );
end
$function$;

revoke all on function portal_private.ai_role_state_current_v6(
  portal_private.ai_business_role_enum,integer,integer
) from public,anon,authenticated,service_role;

-- Compatibility bridges: existing callers receive the current V6 recovery state.
create or replace function portal_private.ai_role_state_current_v5(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select portal_private.ai_role_state_current_v6(p_role,p_task_limit,p_coord_limit)
$function$;

revoke all on function portal_private.ai_role_state_current_v5(
  portal_private.ai_business_role_enum,integer,integer
) from public,anon,authenticated,service_role;

create or replace function portal_private.ai_role_state_current_v4(
  p_role portal_private.ai_business_role_enum,
  p_task_limit integer default 10,
  p_coord_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  select portal_private.ai_role_state_current_v6(p_role,p_task_limit,p_coord_limit)
$function$;

revoke all on function portal_private.ai_role_state_current_v4(
  portal_private.ai_business_role_enum,integer,integer
) from public,anon,authenticated,service_role;

comment on table portal_private.finance_canonical_report_registry_v1 is
'Owner-approved canonical Finance report registry. Report rows must not be invented from chat memory.';
comment on function portal_private.ai_role_state_current_v6(portal_private.ai_business_role_enum,integer,integer) is
'RONA role recovery V6: V5 canonical topology plus persistent staff identity, office directory, competence contract, mailbox state, canonical document resources and canonical report catalog.';
