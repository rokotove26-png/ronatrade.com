-- Regression proof for FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1.
-- Intended for a database with the migration applied. Read-only assertions only.

do $$
declare
  v_state jsonb;
  v_policies jsonb;
  v_primary jsonb;
  v_reverse jsonb;
  v_alloc jsonb;
  v_override jsonb;
  v_policy_def text;
  v_state_def text;
begin
  v_policies := portal_private.ai_role_global_policies_current_v1('FINANCE'::portal_private.ai_business_role_enum);
  if jsonb_array_length(v_policies) < 1 then
    raise exception 'REGRESSION: FINANCE global policy missing';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_policies) p
    where p->>'policy_id' = 'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1'
      and p->>'scope' = 'GLOBAL_FINANCE_ROLE'
      and (p->>'task_scoped')::boolean = false
  ) then
    raise exception 'REGRESSION: canonical policy identity/scope mismatch';
  end if;

  -- CURRENT_STATE_FIRST must receive the global policy independently of task payload.
  v_state := portal_private.ai_role_state_current_v2('FINANCE'::portal_private.ai_business_role_enum, 1, 1);
  if not exists (
    select 1
    from jsonb_array_elements(v_state->'global_role_policies') p
    where p->>'policy_id' = 'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1'
  ) then
    raise exception 'REGRESSION: current state does not bootstrap global policy';
  end if;
  if (v_state #>> '{bootstrap,global_policy_must_apply_before_tasks}')::boolean is not true then
    raise exception 'REGRESSION: policy/task bootstrap ordering flag missing';
  end if;

  select pg_get_functiondef('portal_private.ai_role_global_policies_current_v1(portal_private.ai_business_role_enum)'::regprocedure)
    into v_policy_def;
  if position('staff_tasks' in v_policy_def) <> 0 then
    raise exception 'REGRESSION: role policy resolver became task-dependent';
  end if;

  select pg_get_functiondef('portal_private.ai_role_state_current_v2(portal_private.ai_business_role_enum,integer,integer)'::regprocedure)
    into v_state_def;
  if position('ai_role_global_policies_current_v1' in v_state_def) = 0
     or position('staff_tasks' in v_state_def) = 0
     or position('ai_role_global_policies_current_v1' in v_state_def) > position('staff_tasks' in v_state_def) then
    raise exception 'REGRESSION: global policy is not loaded before active tasks';
  end if;

  -- A fictitious future deal uses a direct BANK_CONFIRMED funding-side debit as primary spend.
  v_primary := portal_private.finance_primary_spend_semantics_v1(
    'BANK_CONFIRMED','FUNDING_SIDE_DEBIT',1000,'USD',82350,'RUB',999.99,82.35
  );
  if v_primary->>'status' <> 'AUTHORITATIVE'
     or (v_primary->>'direct_funding_side')::boolean is not true
     or (v_primary->>'funding_amount')::numeric <> 1000
     or v_primary->>'funding_currency' <> 'USD' then
    raise exception 'REGRESSION: future deal direct funding semantics failed';
  end if;

  -- Reverse FX cannot create primary spend even when settlement/accounting numbers exist.
  v_reverse := portal_private.finance_primary_spend_semantics_v1(
    'BANK_CONFIRMED','SETTLEMENT_REVERSE_FX',null,'USD',82350,'RUB',1000,82.35
  );
  if v_reverse->>'status' <> 'TO_VERIFY'
     or v_reverse->>'reason' <> 'NO_REVERSE_FX_AS_PRIMARY'
     or v_reverse->'funding_amount' <> 'null'::jsonb then
    raise exception 'REGRESSION: reverse FX primary was not rejected';
  end if;

  -- One confirmed direct funding debit is allocated 80/20 across two confirmed Deal shares.
  v_alloc := portal_private.finance_multi_deal_proportional_allocation_v1(
    1000,'USD',true,
    '[{"deal_id":"DEAL-FUTURE-A","share":0.8,"confirmed":true},{"deal_id":"DEAL-FUTURE-B","share":0.2,"confirmed":true}]'::jsonb,
    null
  );
  if v_alloc->>'status' <> 'AUTHORITATIVE'
     or v_alloc->>'allocation_source' <> 'CONFIRMED_PROPORTIONAL_SHARES'
     or (v_alloc->>'synthetic_allocation')::boolean is not false
     or not exists (
       select 1 from jsonb_array_elements(v_alloc->'allocations') a
       where a->>'deal_id'='DEAL-FUTURE-A' and (a->>'funding_amount')::numeric=800
     )
     or not exists (
       select 1 from jsonb_array_elements(v_alloc->'allocations') a
       where a->>'deal_id'='DEAL-FUTURE-B' and (a->>'funding_amount')::numeric=200
     ) then
    raise exception 'REGRESSION: confirmed multi-deal proportional allocation failed';
  end if;

  -- An authoritative override is allowed to supersede the default confirmed proportion.
  v_override := portal_private.finance_multi_deal_proportional_allocation_v1(
    1000,'USD',true,
    '[{"deal_id":"DEAL-FUTURE-A","share":0.8,"confirmed":true},{"deal_id":"DEAL-FUTURE-B","share":0.2,"confirmed":true}]'::jsonb,
    '[{"deal_id":"DEAL-FUTURE-A","share":0.7,"confirmed":true},{"deal_id":"DEAL-FUTURE-B","share":0.3,"confirmed":true}]'::jsonb
  );
  if v_override->>'allocation_source' <> 'AUTHORITATIVE_OVERRIDE'
     or not exists (
       select 1 from jsonb_array_elements(v_override->'allocations') a
       where a->>'deal_id'='DEAL-FUTURE-A' and (a->>'funding_amount')::numeric=700
     ) then
    raise exception 'REGRESSION: authoritative allocation override precedence failed';
  end if;
end
$$;
