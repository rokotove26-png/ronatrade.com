-- Runtime regression proof for effective_at activation semantics.
-- Test fixtures are transaction-local and are rolled back.
-- BUSINESS_DATA_MUTATION=NONE
-- FINANCE_RECORD_MUTATION=NONE

begin;

do $$
declare
  v_now timestamptz := clock_timestamp();
  v_today jsonb;
  v_after jsonb;
  v_state_def text;
begin
  insert into portal_private.ai_role_global_policies_v1 (
    policy_id, policy_key, policy_version, functional_role, scope, task_scoped,
    authority_kind, owner_instruction_ref, effective_at, supersedes_policy_id, policy
  ) values (
    'REGRESSION_EFFECTIVE_AT_V1',
    'REGRESSION_EFFECTIVE_AT',
    1,
    'LEGAL'::portal_private.ai_business_role_enum,
    'GLOBAL_LEGAL_ROLE_REGRESSION',
    false,
    'OWNER_INSTRUCTION',
    'OWNER_INSTRUCTION:REGRESSION:EFFECTIVE_AT:V1',
    v_now - interval '1 minute',
    null,
    jsonb_build_object(
      'policy_id','REGRESSION_EFFECTIVE_AT_V1',
      'policy_key','REGRESSION_EFFECTIVE_AT',
      'version',1,
      'scope','GLOBAL_LEGAL_ROLE_REGRESSION',
      'task_scoped',false
    )
  );

  insert into portal_private.ai_role_global_policies_v1 (
    policy_id, policy_key, policy_version, functional_role, scope, task_scoped,
    authority_kind, owner_instruction_ref, effective_at, supersedes_policy_id, policy
  ) values (
    'REGRESSION_EFFECTIVE_AT_V2',
    'REGRESSION_EFFECTIVE_AT',
    2,
    'LEGAL'::portal_private.ai_business_role_enum,
    'GLOBAL_LEGAL_ROLE_REGRESSION',
    false,
    'OWNER_INSTRUCTION',
    'OWNER_INSTRUCTION:REGRESSION:EFFECTIVE_AT:V2',
    v_now + interval '1 day',
    'REGRESSION_EFFECTIVE_AT_V1',
    jsonb_build_object(
      'policy_id','REGRESSION_EFFECTIVE_AT_V2',
      'policy_key','REGRESSION_EFFECTIVE_AT',
      'version',2,
      'scope','GLOBAL_LEGAL_ROLE_REGRESSION',
      'task_scoped',false
    )
  );

  -- 1 + 3: future V2 must not suppress currently-effective V1.
  v_today := portal_private.ai_role_global_policies_at_v1(
    'LEGAL'::portal_private.ai_business_role_enum,
    v_now
  );
  if jsonb_array_length(v_today) <> 1
     or v_today->0->>'policy_id' <> 'REGRESSION_EFFECTIVE_AT_V1' then
    raise exception 'REGRESSION: future V2 suppressed current V1';
  end if;

  -- 2: after V2 effective_at, V2 is the current authoritative version.
  v_after := portal_private.ai_role_global_policies_at_v1(
    'LEGAL'::portal_private.ai_business_role_enum,
    v_now + interval '2 days'
  );
  if jsonb_array_length(v_after) <> 1
     or v_after->0->>'policy_id' <> 'REGRESSION_EFFECTIVE_AT_V2' then
    raise exception 'REGRESSION: V2 not activated after effective_at';
  end if;

  -- 4: bootstrap still resolves global policy before reading active tasks.
  select pg_get_functiondef(
    'portal_private.ai_role_state_current_v2(portal_private.ai_business_role_enum,integer,integer)'::regprocedure
  ) into v_state_def;
  if position('ai_role_global_policies_current_v1' in v_state_def) = 0
     or position('staff_tasks' in v_state_def) = 0
     or position('ai_role_global_policies_current_v1' in v_state_def) > position('staff_tasks' in v_state_def) then
    raise exception 'REGRESSION: global policy bootstrap ordering changed';
  end if;
end
$$;

rollback;
