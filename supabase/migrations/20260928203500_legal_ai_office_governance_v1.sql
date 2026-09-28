-- RONA Trade / LEGAL AI Office Governance V1
-- OWNER_AUTHORITY=OWNER_INSTRUCTION:2026-09-28:LEGAL_AI_OFFICE_GOVERNANCE_V1
-- BUSINESS_DATA_MUTATION=NONE
-- AUTHORITY_EXPANSION=NONE

insert into portal_private.ai_role_global_policies_v1 (
  policy_id,
  policy_key,
  policy_version,
  functional_role,
  scope,
  task_scoped,
  authority_kind,
  owner_instruction_ref,
  effective_at,
  supersedes_policy_id,
  policy
)
select
  'LEGAL_AI_OFFICE_GOVERNANCE_V1',
  'LEGAL_AI_OFFICE_GOVERNANCE',
  1,
  'LEGAL'::portal_private.ai_business_role_enum,
  'GLOBAL_LEGAL_ROLE',
  false,
  'OWNER_INSTRUCTION',
  'OWNER_INSTRUCTION:2026-09-28:LEGAL_AI_OFFICE_GOVERNANCE_V1',
  clock_timestamp(),
  null,
  jsonb_build_object(
    'policy_id','LEGAL_AI_OFFICE_GOVERNANCE_V1',
    'policy_key','LEGAL_AI_OFFICE_GOVERNANCE',
    'version',1,
    'scope','GLOBAL_LEGAL_ROLE',
    'task_scoped',false,
    'authority','OWNER_INSTRUCTION',
    'rules',jsonb_build_object(
      'CURRENT_STATE_FIRST',true,
      'IMPLEMENTATION_MODE','DELTA_ONLY',
      'NO_CROSS_ROLE_AUTHORITY_EXPANSION',true,
      'LEGAL_AUTHORITY_SCOPE','UNCHANGED',
      'HUMAN_ACTOR_RULE','ONLY_OWNER_AND_TREASURY_ARE_HUMAN',
      'CANONICAL_ROLE_TOPOLOGY','OWNER_INSTRUCTION:2026-09-28:CANONICAL_AI_ROLE_TOPOLOGY_V2',
      'CANONICAL_AI_ROLES',jsonb_build_array(
        'FINANCE',
        'OPERATIONS_DIRECTOR',
        'COMMERCIAL_DIRECTOR',
        'LEGAL',
        'RAIL_LOGISTICS',
        'SYSTEM_ADMIN'
      ),
      'NONEXISTENT_ROLES',jsonb_build_array('ACCOUNTING','EXECUTIVE_DIRECTOR'),
      'MARKET_ANALYST_ROLE','LEGACY_COMPATIBILITY_ONLY',
      'MARKET_ANALYST_CANONICAL_ALIAS','COMMERCIAL_DIRECTOR',
      'CANONICAL_HANDOFF_TARGETS',jsonb_build_array(
        'COMMERCIAL_DIRECTOR',
        'FINANCE',
        'LEGAL',
        'OPERATIONS_DIRECTOR',
        'RAIL_LOGISTICS',
        'SYSTEM_ADMIN'
      ),
      'FAIL_CLOSED_ON_MISSING_OR_CONFLICTING_AUTHORITY',true
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
where not exists (
  select 1
  from portal_private.ai_role_global_policies_v1 p
  where p.policy_id='LEGAL_AI_OFFICE_GOVERNANCE_V1'
);
