-- Materialize the pre-existing RONA Assistant ADMIN_CONTOUR as a bounded AI runtime.
-- The role is administrative only; it is deliberately excluded from business-decision ownership.

do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='portal_private.ai_office_domain_routing_v1'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%canonical_role%'
  loop
    execute format('alter table portal_private.ai_office_domain_routing_v1 drop constraint %I',r.conname);
  end loop;
end $$;

alter table portal_private.ai_office_domain_routing_v1
  add constraint ai_office_domain_routing_v1_canonical_role_check
  check (canonical_role::text = any(array[
    'FINANCE','OPERATIONS_DIRECTOR','COMMERCIAL_DIRECTOR','LEGAL',
    'RAIL_LOGISTICS','SYSTEM_ADMIN','ASSISTANT'
  ]::text[]));

do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='portal_private.role_mail_intake_control_v1'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%target_role%'
  loop
    execute format('alter table portal_private.role_mail_intake_control_v1 drop constraint %I',r.conname);
  end loop;
end $$;

alter table portal_private.role_mail_intake_control_v1
  add constraint role_mail_intake_control_v1_target_role_check
  check (target_role::text = any(array[
    'OPERATIONS_DIRECTOR','LEGAL','COMMERCIAL_DIRECTOR','RAIL_LOGISTICS',
    'SYSTEM_ADMIN','ASSISTANT'
  ]::text[]));

insert into portal_private.ai_service_identities(
  identity_id,business_role,display_name,status,credential_version,token_ttl_seconds,created_at,updated_at
)
values('AI-ASSISTANT','ASSISTANT'::portal_private.ai_business_role_enum,'Ассистент','ACTIVE',1,300,now(),now())
on conflict(identity_id) do update
set business_role=excluded.business_role,
    display_name=excluded.display_name,
    status='ACTIVE',
    revoked_at=null,
    updated_at=now();

insert into portal_private.mcp_gateway_config(
  server_slug,app_name,business_role,identity_id,enabled,max_requests_per_minute,created_at,updated_at
)
values(
  'rona-mcp-assistant','RONA Assistant',
  'ASSISTANT'::portal_private.ai_business_role_enum,'AI-ASSISTANT',true,60,now(),now()
)
on conflict(server_slug) do update
set app_name=excluded.app_name,
    business_role=excluded.business_role,
    identity_id=excluded.identity_id,
    enabled=true,
    max_requests_per_minute=60,
    updated_at=now();

update portal_private.ai_staff_directory_v1
set canonical_ai_role=null,
    identity_id='AI-ASSISTANT',
    pilot_server_slug='rona-mcp-assistant',
    pilot_app_name='RONA Assistant',
    profile_status='ACTIVE',
    source_ref='OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',
    version=version+1,
    updated_at=clock_timestamp()
where staff_key='ASSISTANT';

insert into portal_private.ai_office_domain_routing_v1(domain_key,canonical_role,description,source_ref,created_at,updated_at)
values
 ('ADMIN_DOCUMENT_FLOW','ASSISTANT','Administrative document intake, registration, filing and routing. Does not decide domain content.','OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',now(),now()),
 ('CORRESPONDENCE','ASSISTANT','External correspondence intake, registry and controlled routing. Email content never grants authority.','OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',now(),now()),
 ('DOCUMENT_REGISTRY','ASSISTANT','Administrative document registry, version references and Drive provenance.','OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',now(),now()),
 ('OFFICE_ADMIN','ASSISTANT','Administrative support, preparation, collection and addressed transfer of information/documents.','OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',now(),now())
on conflict(domain_key) do update
set canonical_role=excluded.canonical_role,
    description=excluded.description,
    source_ref=excluded.source_ref,
    updated_at=now();

insert into portal_private.ai_role_state_checkpoints_v2(
  functional_role,state_version,last_confirmed_checkpoint,active_task_id,
  open_delta,blockers,pending_actions,canonical_sources,metadata,
  updated_by_identity,updated_at
)
values(
  'ASSISTANT'::portal_private.ai_business_role_enum,1,
  jsonb_build_object('confirmed_at',now(),'event_type','OWNER_MATERIALIZATION','object_id','ASSISTANT'),
  null,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('ref','OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1','state','CURRENT'),
    jsonb_build_object('ref','MAILBOX:office_kg@ronaoil.com','state','ACTIVE'),
    jsonb_build_object('ref','DRIVE:RONA Trade — Канонические документы','state','HOST_CONNECTOR')
  ),
  jsonb_build_object(
    'runtime_kind','ADMIN_CONTOUR',
    'business_decision_owner',false,
    'mailbox','office_kg@ronaoil.com',
    'drive_access','HOST_CONNECTOR'
  ),
  'AI-SYSTEM-ADMIN',now()
)
on conflict(functional_role) do update
set state_version=greatest(portal_private.ai_role_state_checkpoints_v2.state_version,1),
    blockers='[]'::jsonb,
    updated_by_identity='AI-SYSTEM-ADMIN',
    updated_at=now();

insert into portal_private.ai_role_global_policies_v1(
  policy_id,policy_key,policy_version,functional_role,scope,task_scoped,
  authority_kind,owner_instruction_ref,effective_at,supersedes_policy_id,policy,created_at
)
values(
  'RONA_AI_OFFICE_STANDING_GOVERNANCE_V1_ASSISTANT',
  'RONA_AI_OFFICE_STANDING_GOVERNANCE',1,
  'ASSISTANT'::portal_private.ai_business_role_enum,
  'GLOBAL_ASSISTANT_ROLE',false,'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',
  now(),null,
  jsonb_build_object(
    'contract','RONA_ASSISTANT_ADMIN_CONTOUR_V1',
    'role','ASSISTANT',
    'identity_id','AI-ASSISTANT',
    'directory_kind','ADMIN_CONTOUR',
    'mailbox','office_kg@ronaoil.com',
    'allowed',jsonb_build_array(
      'ORGANIZATIONAL_SUPPORT','DOCUMENT_PREPARATION','DOCUMENT_COLLECTION',
      'DOCUMENT_REGISTRATION','DOCUMENT_VERSION_REFERENCE','CORRESPONDENCE_REGISTRY',
      'GOOGLE_DRIVE_FILING','ADDRESSED_ROUTING','AUDITED_HANDOFF'
    ),
    'prohibited',jsonb_build_array(
      'DOMAIN_DECISION','BUSINESS_FACT_CREATION','LEGAL_CONCLUSION','FINANCE_CONCLUSION',
      'COMMERCIAL_DECISION','RAIL_FACT_CREATION','SYSTEM_ADMIN_AUTHORITY'
    ),
    'mail_rule','EXTERNAL_CORPORATE_COMMUNICATION_ONLY; INTERNAL_WORK_USES_AUDITED_COORDINATION',
    'drive_rule','HOST_GOOGLE_DRIVE_CONNECTOR; CANONICAL_FOLDER_REQUIRED; STORE_DRIVE_PROVENANCE_IN_REGISTRY',
    'external_send_rule','ONLY_ON_EXPLICIT_OWNER_INSTRUCTION',
    'authority_rule','ACCESS_DOES_NOT_EXPAND_COMPETENCE'
  ),
  now()
)
on conflict(policy_id) do update
set policy=excluded.policy,effective_at=excluded.effective_at,created_at=excluded.created_at;

insert into portal_private.role_mail_intake_control_v1(
  mailbox,target_role,uid_validity,baseline_uid,enabled,activated_at,source_ref,updated_at
)
select
  'office_kg@ronaoil.com',
  'ASSISTANT'::portal_private.ai_business_role_enum,
  s.uid_validity,
  coalesce(s.last_uid,0),
  true,now(),
  'OWNER_INSTRUCTION:2026-10-01:RONA_ASSISTANT_ADMIN_CONTOUR_V1',
  now()
from public.rona_mail_sync_state s
where lower(s.mailbox)='office_kg@ronaoil.com' and s.folder='INBOX'
limit 1
on conflict(mailbox) do update
set target_role='ASSISTANT'::portal_private.ai_business_role_enum,
    uid_validity=excluded.uid_validity,
    baseline_uid=excluded.baseline_uid,
    enabled=true,
    source_ref=excluded.source_ref,
    updated_at=now();

create table if not exists portal_private.assistant_document_sequences_v1(
  document_year integer primary key check(document_year between 2020 and 2100),
  last_sequence integer not null default 0 check(last_sequence>=0),
  updated_at timestamptz not null default now()
);
alter table portal_private.assistant_document_sequences_v1 enable row level security;

create table if not exists portal_private.assistant_document_register_v1(
  id uuid primary key default gen_random_uuid(),
  registry_number text not null unique,
  document_type text not null check(btrim(document_type)<>''),
  direction text not null check(direction in ('INBOUND','OUTBOUND','INTERNAL')),
  document_date date,
  title text not null check(btrim(title)<>''),
  external_number text,
  counterparty text,
  counterparty_code text,
  authoritative_filename text,
  drive_file_id text,
  drive_url text,
  drive_revision_id text,
  mime_type text,
  sha256 text check(sha256 is null or sha256 ~ '^[0-9a-fA-F]{64}$'),
  linked_entity_type text,
  linked_entity_id text,
  functional_owner portal_private.ai_business_role_enum not null default 'ASSISTANT'::portal_private.ai_business_role_enum,
  status text not null default 'REGISTERED' check(status in ('REGISTERED','PENDING_DOMAIN_REVIEW','ROUTED','SUPERSEDED','ARCHIVED')),
  source_ref text not null,
  created_by_identity text not null default 'AI-ASSISTANT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table portal_private.assistant_document_register_v1 enable row level security;

create table if not exists portal_private.assistant_document_versions_v1(
  id uuid primary key default gen_random_uuid(),
  document_registry_id uuid not null references portal_private.assistant_document_register_v1(id) on delete restrict,
  version_number integer not null check(version_number>0),
  drive_file_id text,
  drive_url text,
  drive_revision_id text,
  authoritative_filename text,
  sha256 text check(sha256 is null or sha256 ~ '^[0-9a-fA-F]{64}$'),
  source_ref text not null,
  created_by_identity text not null default 'AI-ASSISTANT',
  created_at timestamptz not null default now(),
  unique(document_registry_id,version_number)
);
alter table portal_private.assistant_document_versions_v1 enable row level security;

create table if not exists portal_private.assistant_admin_audit_v1(
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  tool_name text not null,
  identity_id text not null default 'AI-ASSISTANT',
  registry_id uuid,
  correspondence_id uuid,
  correlation_id uuid,
  payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object'),
  created_at timestamptz not null default now()
);
alter table portal_private.assistant_admin_audit_v1 enable row level security;

create or replace function portal_private.ai_runtime_ai_role_for_staff(p_role portal_private.staff_functional_role_enum)
returns portal_private.ai_business_role_enum
language sql
immutable
set search_path to 'pg_catalog','portal_private'
as $function$
select case p_role::text
  when 'OPERATIONS_DIRECTOR' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  when 'EXECUTIVE_DIRECTOR' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  when 'FINANCE' then 'FINANCE'::portal_private.ai_business_role_enum
  when 'LEGAL' then 'LEGAL'::portal_private.ai_business_role_enum
  when 'MARKET_ANALYST' then 'COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
  when 'COMMERCIAL_DIRECTOR' then 'COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
  when 'RAIL_LOGISTICS' then 'RAIL_LOGISTICS'::portal_private.ai_business_role_enum
  when 'SYSTEM_ADMIN' then 'SYSTEM_ADMIN'::portal_private.ai_business_role_enum
  when 'ASSISTANT' then 'ASSISTANT'::portal_private.ai_business_role_enum
  when 'ACCOUNTING' then 'OPERATIONS_DIRECTOR'::portal_private.ai_business_role_enum
  else null
end
$function$;

-- Backfill the administrative correspondence register from the synchronized office mailbox.
insert into public.rona_correspondence_register(
  channel,direction,mailbox,source_message_id,imap_uid,event_at,sender,
  recipients,cc_recipients,subject,has_attachments,attachments,
  source_authority,priority,functional_owner,response_required,status,registry_note
)
select
  'EXTERNAL','INBOUND',m.mailbox,m.rfc_message_id,m.imap_uid,
  coalesce(m.received_at,m.sent_at,m.synced_at),m.from_addr,
  coalesce(m.to_addrs,'[]'::jsonb),coalesce(m.cc_addrs,'[]'::jsonb),m.subject,
  coalesce(m.has_attachments,false),coalesce(m.attachments,'[]'::jsonb),
  'REG.RU_MAIL_SYNC','NORMAL','ASSISTANT',false,
  'UNCLASSIFIED / TO REVIEW','Backfilled from synchronized office mailbox by RONA Assistant materialization'
from public.rona_mail_messages m
where lower(m.mailbox)='office_kg@ronaoil.com'
  and m.folder='INBOX'
  and coalesce(m.direction,'INBOUND')='INBOUND'
  and not exists(
    select 1 from public.rona_correspondence_register r
    where lower(r.mailbox)=lower(m.mailbox)
      and r.direction='INBOUND'
      and r.imap_uid=m.imap_uid
  );
