-- RONA Trade / AI Office Competence + Standing Governance V1
-- OWNER_AUTHORITY=OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1
-- BUSINESS_DATA_MUTATION=NONE
-- AUTHORITY_EXPANSION=NONE
-- CANONICAL_ROLE_ROUTING_ONLY=YES

create table if not exists portal_private.ai_office_domain_routing_v1 (
  domain_key text primary key,
  canonical_role portal_private.ai_business_role_enum not null,
  description text not null,
  source_ref text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check (canonical_role::text in (
    'FINANCE','OPERATIONS_DIRECTOR','COMMERCIAL_DIRECTOR',
    'LEGAL','RAIL_LOGISTICS','SYSTEM_ADMIN'
  ))
);

revoke all on portal_private.ai_office_domain_routing_v1 from public,anon,authenticated,service_role;

insert into portal_private.ai_office_domain_routing_v1(domain_key,canonical_role,description,source_ref)
values
('OPERATIONS_COORDINATION','OPERATIONS_DIRECTOR','Межфункциональная координация, процесс исполнения, Deal/process flow и контроль зависимостей.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('ADMIN_LK_PRICE_PROCESS','OPERATIONS_DIRECTOR','Owner-gated процесс Admin/LK цен и координация business-change proposal.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('DEAL_PROCESS','OPERATIONS_DIRECTOR','Операционная оркестрация сделки без подмены профильных functional conclusions.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('FINANCE','FINANCE','Финансовая экономика, Finance status, финансовые заключения и контрольные проекции.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('PAYMENT','FINANCE','Платежные факты, банковские операции и платежные статусы в пределах Finance authority.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('ALLOCATION','FINANCE','Распределение подтвержденных платежей/расходов и финансовые allocations.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('CASH_PROJECTION','FINANCE','Cash projection и связанные финансовые read models.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('FINANCIAL_REPORTING','FINANCE','Каноническая финансовая отчетность и повторяемые Owner-approved Finance outputs.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('ACCOUNTING_COMPATIBILITY','FINANCE','Compatibility-контур старого ACCOUNTING; отдельной AI-роли ACCOUNTING не существует.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('CONTRACT','LEGAL','Договоры, дополнительные соглашения, legal review и canonical legal references.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('LEGAL_DOCUMENT','LEGAL','Юридические документы, provenance и document authority.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('KYC','LEGAL','KYC review в юридическом контуре.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('SANCTIONS','LEGAL','Sanctions review и связанные legal risks.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('LEGAL_RISK','LEGAL','Юридические риски и legal functional conclusion.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('CLIENT','COMMERCIAL_DIRECTOR','Клиенты, коммерческая квалификация и коммерческий relationship scope.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('COMMERCIAL_OFFER','COMMERCIAL_DIRECTOR','Коммерческие предложения и коммерческие условия.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('PRICING_INPUT','COMMERCIAL_DIRECTOR','Коммерческие pricing inputs и коммерческая оценка без Finance/Rail/Legal fact creation.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('MARKET','COMMERCIAL_DIRECTOR','Рыночные факты и market intelligence; MARKET_ANALYST является только legacy alias.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('MARKET_NEWS','COMMERCIAL_DIRECTOR','Канонический поток новостей топливного рынка.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('PUBLICATION_CONTENT','COMMERCIAL_DIRECTOR','Коммерческий/рыночный контент публикаций в пределах publication gates.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('RAIL','RAIL_LOGISTICS','Железнодорожная логистика и профильные Rail conclusions.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('RAIL_TARIFF','RAIL_LOGISTICS','ЖД-тарифы и точный scope их применимости.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('RAIL_DOCUMENT','RAIL_LOGISTICS','Железнодорожные документы и readiness.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('SHIPMENT','RAIL_LOGISTICS','Shipment readiness/review; физические факты только из trusted operational source.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('RAIL_MOVEMENT','RAIL_LOGISTICS','Trusted physical rail movement/monitoring evidence.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('TECHNICAL','SYSTEM_ADMIN','Техническая инфраструктура и техническая материализация без business fact creation.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('IAM','SYSTEM_ADMIN','IAM, технические права и identity/runtime configuration.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('MCP','SYSTEM_ADMIN','MCP gateways, Pilot connectors и tool contracts.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('RUNTIME','SYSTEM_ADMIN','AI/runtime/cron/queue infrastructure.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('CONNECTOR','SYSTEM_ADMIN','Connectors/integrations и их technical health.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('LK_TECHNICAL','SYSTEM_ADMIN','Техническая реализация ЛК без владения бизнес-содержанием.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1'),
('INFRASTRUCTURE','SYSTEM_ADMIN','Инфраструктура, observability, deployment и security technical scope.','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1')
on conflict (domain_key) do update
set canonical_role=excluded.canonical_role,
    description=excluded.description,
    source_ref=excluded.source_ref,
    updated_at=clock_timestamp();

create or replace function portal_private.ai_role_competence_contract_v1(
  p_role portal_private.ai_business_role_enum
)
returns jsonb
language sql
stable
security definer
set search_path='portal_private','pg_catalog'
as $function$
  with canonical as (
    select portal_private.ai_canonical_role_map_v1(p_role::text) as role_name
  )
  select jsonb_build_object(
    'contract','RONA_AI_COMPETENCE_GATE_V1',
    'canonical_role',(select role_name from canonical),
    'gate_required_before_accepting_owner_task',true,
    'allowed_results',jsonb_build_array('IN_SCOPE','MIXED_SCOPE','OUT_OF_SCOPE'),
    'in_scope_action','ACCEPT_AND_EXECUTE_WITHIN_AUTHORITY',
    'mixed_scope_action','EXECUTE_OWN_PART_AND_ROUTE_REMAINDER',
    'out_of_scope_action','DO_NOT_ACCEPT_OR_EXECUTE__RETURN_CORRECT_ROLE_AND_READY_ASSIGNMENT',
    'helpful_override_prohibited',true,
    'authority_expansion_prohibited',true,
    'owned_domains',coalesce((
      select jsonb_agg(jsonb_build_object(
        'domain_key',r.domain_key,
        'description',r.description
      ) order by r.domain_key)
      from portal_private.ai_office_domain_routing_v1 r
      where r.canonical_role::text=(select role_name from canonical)
    ),'[]'::jsonb),
    'office_routing',coalesce((
      select jsonb_object_agg(r.domain_key,r.canonical_role::text order by r.domain_key)
      from portal_private.ai_office_domain_routing_v1 r
    ),'{}'::jsonb),
    'compatibility_role_map',jsonb_build_object(
      'ACCOUNTING','FINANCE',
      'EXECUTIVE_DIRECTOR','OPERATIONS_DIRECTOR',
      'MARKET_ANALYST','COMMERCIAL_DIRECTOR'
    )
  )
$function$;

revoke all on function portal_private.ai_role_competence_contract_v1(
  portal_private.ai_business_role_enum
) from public,anon,authenticated,service_role;

insert into portal_private.ai_role_global_policies_v1(
  policy_id,policy_key,policy_version,functional_role,scope,task_scoped,
  authority_kind,owner_instruction_ref,effective_at,supersedes_policy_id,policy
)
select
  'RONA_AI_OFFICE_STANDING_GOVERNANCE_V1_'||r.role_name,
  'RONA_AI_OFFICE_STANDING_GOVERNANCE',
  1,
  r.role_name::portal_private.ai_business_role_enum,
  'GLOBAL_'||r.role_name||'_ROLE',
  false,
  'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1:'||r.role_name,
  clock_timestamp(),
  null,
  jsonb_build_object(
    'policy_id','RONA_AI_OFFICE_STANDING_GOVERNANCE_V1_'||r.role_name,
    'policy_key','RONA_AI_OFFICE_STANDING_GOVERNANCE',
    'version',1,
    'scope','GLOBAL_'||r.role_name||'_ROLE',
    'task_scoped',false,
    'authority','OWNER_INSTRUCTION',
    'owner_instruction_family','OWNER_INSTRUCTION:2026-09-29:RONA_AI_OFFICE_STANDING_GOVERNANCE_V1',
    'rules',jsonb_build_object(
      'CURRENT_STATE_FIRST',true,
      'COMPETENCE_GATE','MANDATORY_BEFORE_ACCEPTING_OWNER_TASK',
      'COMPETENCE_RESULTS',jsonb_build_array('IN_SCOPE','MIXED_SCOPE','OUT_OF_SCOPE'),
      'OUT_OF_SCOPE','DO_NOT_ACCEPT_OR_EXECUTE__RETURN_CORRECT_ROLE_AND_READY_ASSIGNMENT',
      'MIXED_SCOPE','EXECUTE_OWN_PART_AND_ROUTE_REMAINDER',
      'HELPFUL_OVERRIDE_PROHIBITED',true,
      'NO_AUTHORITY_EXPANSION',true,
      'NO_BUSINESS_FACT_CREATION',true,
      'AUTO_EXECUTE_WITHIN_EXISTING_AUTHORITY',true,
      'AUTHORITATIVE_MUTATION_REQUIRES_EXISTING_WORKFLOW_AND_GATES',true,
      'INTERNAL_STAFF_CHANNEL','AUDITED_COORDINATION',
      'ROLE_MAILBOX_REQUIRED_FOR_EXTERNAL_EMAIL',true,
      'MAIL_TRANSPORT_POLL_MAX_MINUTES',5,
      'SAFETY_HEARTBEAT_MAX_MINUTES',15,
      'DOCUMENT_SOURCE_LOCK',true,
      'CANONICAL_DOCUMENT_ASSETS_ONLY',true,
      'CANONICAL_REPORT_REGISTRY_REQUIRED',true,
      'LK_ROLE_SAFE',true,
      'FAIL_CLOSED_ON_MISSING_OR_CONFLICTING_AUTHORITY',true,
      'HUMAN_ACTOR_RULE','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
      'CANONICAL_AI_ROLES',jsonb_build_array(
        'FINANCE','OPERATIONS_DIRECTOR','COMMERCIAL_DIRECTOR',
        'LEGAL','RAIL_LOGISTICS','SYSTEM_ADMIN'
      ),
      'NONEXISTENT_ROLES',jsonb_build_array('ACCOUNTING','EXECUTIVE_DIRECTOR'),
      'LEGACY_ALIASES',jsonb_build_object('MARKET_ANALYST','COMMERCIAL_DIRECTOR')
    ),
    'durability',jsonb_build_object(
      'survives_new_chat',true,
      'survives_new_task',true,
      'survives_task_closure',true,
      'bootstrap_required',true,
      'load_before_active_task',true
    ),
    'supersession',jsonb_build_object(
      'mode','APPEND_VERSION_ONLY',
      'required_authority','NEW_VERSIONED_OWNER_INSTRUCTION'
    )
  )
from (
  values
    ('FINANCE'),
    ('OPERATIONS_DIRECTOR'),
    ('COMMERCIAL_DIRECTOR'),
    ('LEGAL'),
    ('RAIL_LOGISTICS'),
    ('SYSTEM_ADMIN')
) as r(role_name)
where not exists (
  select 1 from portal_private.ai_role_global_policies_v1 p
  where p.policy_id='RONA_AI_OFFICE_STANDING_GOVERNANCE_V1_'||r.role_name
);

comment on table portal_private.ai_office_domain_routing_v1 is
'Canonical competence routing map. Compatibility enum values do not become current employees or current owners.';
