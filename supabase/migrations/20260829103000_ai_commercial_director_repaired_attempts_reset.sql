-- Repaired MARKET_ANALYST compatibility queue rows inherited hundreds of historical
-- dispatch attempts. After canonical rerouting they must re-enter model execution with
-- a clean attempt budget; the source coordination records remain untouched.
update portal_private.ai_runtime_queue q
set attempts=0,
    lease_until=null,
    claimed_by=null,
    available_at=now(),
    last_error_code=null,
    last_error_text=null,
    payload=coalesce(q.payload,'{}'::jsonb)
      || jsonb_build_object('attempt_budget_reset_after_role_repair',true,'attempt_budget_reset_at',now()),
    updated_at=now()
where q.target_role='COMMERCIAL_DIRECTOR'::portal_private.ai_business_role_enum
  and q.state='DELIVERED'
  and coalesce((q.payload->>'role_alias_normalized')::boolean,false)=true
  and q.payload->>'source_target_role'='MARKET_ANALYST'
  and q.attempts >= coalesce((select max_attempts from portal_private.ai_model_executor_control where singleton=true),3);

insert into portal_private.ai_coordination_audit_events(
  functional_role,identity_id,client_id,server_slug,tool_name,target_type,target_id,
  correlation_id,mcp_request_id,result,qa_only,metadata
)
values(
  'SYSTEM_ADMIN','AI-SYSTEM-ADMIN',null,'rona-system-admin',
  'ai_commercial_director_repaired_attempts_reset','SYSTEM','AI_RUNTIME_QUEUE',
  gen_random_uuid(),gen_random_uuid(),'SUCCESS',false,
  jsonb_build_object('reason','ROLE_REPAIR_CREATED_NEW_EXECUTION_ELIGIBILITY','historical_coordination_records_rewritten',false)
);
