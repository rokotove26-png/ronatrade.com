do $$
declare
  v_now timestamptz := clock_timestamp();
  v_corr uuid := gen_random_uuid();
  v_req uuid := gen_random_uuid();
  v_task uuid;
  v_count integer;
begin
  select count(*) into v_count
  from portal_private.ai_runtime_queue
  where state = 'DEAD_LETTER'
    and processed_at is null
    and source_type = 'SYSTEM_CHECK'
    and source_id = 'SLA-ESCALATION-202608261830'
    and target_role = 'OPERATIONS_DIRECTOR'
    and last_error_code = 'MODEL_INPUT_BUDGET_EXCEEDED'
    and last_error_text = 'input_chars=33995;limit=18000';

  if v_count <> 1 then
    raise exception 'Expected exactly one terminal historical DLQ residual, found %', v_count;
  end if;

  update portal_private.ai_runtime_queue
     set processed_at = v_now,
         updated_at = v_now
   where state = 'DEAD_LETTER'
     and processed_at is null
     and source_type = 'SYSTEM_CHECK'
     and source_id = 'SLA-ESCALATION-202608261830'
     and target_role = 'OPERATIONS_DIRECTOR'
     and last_error_code = 'MODEL_INPUT_BUDGET_EXCEEDED'
     and last_error_text = 'input_chars=33995;limit=18000';

  select count(*) into v_count
  from portal_private.staff_tasks
  where (task_id = 'TASK-CONTRACT-CF001-20260816' and status = 'NEW' and assigned_functional_role = 'LEGAL')
     or (task_id = 'TASK-CONTRACT-CF002-20260816' and status = 'NEW' and assigned_functional_role = 'LEGAL')
     or (task_id = 'TASK-CONTRACT-CF003-20260816' and status = 'NEW' and assigned_functional_role = 'LEGAL')
     or (task_id = 'TASK-SYS-OWNER-UAT-READINESS-20260816' and status = 'IN_PROGRESS' and assigned_functional_role = 'SYSTEM_ADMIN');

  if v_count <> 4 then
    raise exception 'Expected four exact stale task-registry rows in known states, found %', v_count;
  end if;

  update portal_private.staff_tasks
     set status = 'CLOSED',
         decision = 'TECHNICAL_REGISTRY_RECONCILIATION_LEGAL_REVIEW_COMPLETE_C001_BUSINESS_STATE_PRESERVED',
         decision_at = v_now
   where task_id = 'TASK-CONTRACT-CF001-20260816'
     and status = 'NEW'
   returning id into v_task;

  insert into portal_private.staff_task_history
    (id, task_key, event_type, actor_functional_role, from_status, to_status, note, request_id, correlation_id, metadata, created_at)
  values
    (gen_random_uuid(), v_task, 'STATUS_CHANGE', 'SYSTEM_ADMIN', 'NEW', 'CLOSED',
     'Technical registry reconciliation after completed Legal authority review. C001 business state remains PENDING_SIGNATURE/SOURCE_RECEIVED/DRAFT; closure does not infer bilateral execution.',
     v_req, v_corr,
     jsonb_build_object(
       'registry_reconciliation', true,
       'authoritative_business_records_changed', false,
       'evidence_refs', jsonb_build_array('9e33bf3f-592c-472f-a673-30909ebc9e48','0b84d40d-5c0f-44e4-9513-49b81b4ebd6b','49f96f80-396e-419c-8b99-cc08f9968600','RONA-C001-CTR-2026-001'),
       'preserved_state', 'PENDING_SIGNATURE/SOURCE_RECEIVED/DRAFT'
     ), v_now);

  update portal_private.staff_tasks
     set status = 'CLOSED',
         decision = 'TECHNICAL_REGISTRY_RECONCILIATION_CURRENT_REFERENCE_01_RT_01_1926_HISTORY_PRESERVED',
         decision_at = v_now
   where task_id = 'TASK-CONTRACT-CF002-20260816'
     and status = 'NEW'
   returning id into v_task;

  insert into portal_private.staff_task_history
    (id, task_key, event_type, actor_functional_role, from_status, to_status, note, request_id, correlation_id, metadata, created_at)
  values
    (gen_random_uuid(), v_task, 'STATUS_CHANGE', 'SYSTEM_ADMIN', 'NEW', 'CLOSED',
     'Technical registry reconciliation after completed Legal authority review. Current C002 reference remains 01/РТ-01-1926; superseded/historical references are preserved and not rewritten.',
     v_req, v_corr,
     jsonb_build_object(
       'registry_reconciliation', true,
       'authoritative_business_records_changed', false,
       'evidence_refs', jsonb_build_array('b26411a5-e4b0-44e7-9e8a-7e52650c877a','d64e12a2-4eb1-4eb0-a3bb-e2ff355c0c34','0b84d40d-5c0f-44e4-9513-49b81b4ebd6b','RONA-C002-CTR-2026-001'),
       'preserved_current_external_contract_number', '01/РТ-01-1926'
     ), v_now);

  update portal_private.staff_tasks
     set status = 'CLOSED',
         decision = 'TECHNICAL_REGISTRY_RECONCILIATION_CANONICAL_C003_ID_PRESERVED_LEGACY_REFS_UNPROMOTED',
         decision_at = v_now
   where task_id = 'TASK-CONTRACT-CF003-20260816'
     and status = 'NEW'
   returning id into v_task;

  insert into portal_private.staff_task_history
    (id, task_key, event_type, actor_functional_role, from_status, to_status, note, request_id, correlation_id, metadata, created_at)
  values
    (gen_random_uuid(), v_task, 'STATUS_CHANGE', 'SYSTEM_ADMIN', 'NEW', 'CLOSED',
     'Technical registry reconciliation after completed Legal authority review. C003 canonical ID remains RONA-C003-CTR-2026-001; current external number remains NULL and legacy spellings remain unpromoted internal provenance.',
     v_req, v_corr,
     jsonb_build_object(
       'registry_reconciliation', true,
       'authoritative_business_records_changed', false,
       'evidence_refs', jsonb_build_array('58491159-4e4b-4682-b58f-61921db9189b','0c43889b-faa2-4544-9ef1-f7b8e5a5ad00','0b84d40d-5c0f-44e4-9513-49b81b4ebd6b','RONA-C003-CTR-2026-001'),
       'preserved_current_external_contract_number', null,
       'legacy_references_promoted', false
     ), v_now);

  update portal_private.staff_tasks
     set status = 'CLOSED',
         decision = 'TECHNICAL_UAT_REGISTRY_RECONCILIATION_COMPLETE_BY_LATER_PRODUCTION_EVIDENCE_AND_OWNER_DIRECTION',
         decision_at = v_now
   where task_id = 'TASK-SYS-OWNER-UAT-READINESS-20260816'
     and status = 'IN_PROGRESS'
   returning id into v_task;

  insert into portal_private.staff_task_history
    (id, task_key, event_type, actor_functional_role, from_status, to_status, note, request_id, correlation_id, metadata, created_at)
  values
    (gen_random_uuid(), v_task, 'STATUS_CHANGE', 'SYSTEM_ADMIN', 'IN_PROGRESS', 'CLOSED',
     'Technical UAT registry reconciliation. Later production browser/runtime and four-role E2E evidence supersede the stale technical task wording; current Owner direction is to finish the cleanup. This closure does not fabricate a separate historical manual visual signoff and does not close independent business/IAM/Rail/Accounting/Market gates.',
     v_req, v_corr,
     jsonb_build_object(
       'registry_reconciliation', true,
       'authoritative_business_records_changed', false,
       'manual_visual_signoff_fabricated', false,
       'evidence_refs', jsonb_build_array('30361452-f22c-489e-8d05-3eccb9f1ac5a','db3b6a9d-f4ac-4eb1-a7c6-edf8170afaca','ec64619f-02e6-4f63-bf31-916733edce54','44f54363-63fb-4181-99b1-684da12f9bbb','003d182d37ea5fa072a6b41b7f9c500f970221e7'),
       'independent_business_gates_preserved', true
     ), v_now);

  insert into portal_private.ai_coordination_audit_events
    (functional_role, identity_id, client_id, server_slug, tool_name, target_type, target_id,
     correlation_id, mcp_request_id, result, qa_only, metadata)
  values
    ('SYSTEM_ADMIN', 'AI-SYSTEM-ADMIN', null, 'rona-system-admin',
     'final_runtime_and_staff_registry_reconciliation', 'SYSTEM', 'PRODUCTION_CURRENT_STATE',
     v_corr, v_req, 'SUCCESS', false,
     jsonb_build_object(
       'migration', 'final_runtime_and_staff_registry_reconciliation_20260827',
       'terminal_dead_letter_residual_settled', true,
       'dead_letter_state_preserved', true,
       'dead_letter_error_evidence_preserved', true,
       'staff_tasks_closed', 4,
       'authoritative_business_records_changed', false,
       'contract_states_preserved', true,
       'owner_uat_manual_signoff_fabricated', false
     ));
end $$;
