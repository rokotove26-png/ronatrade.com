\set ON_ERROR_STOP on
\ir finance-controlled-write.sql

CREATE TABLE IF NOT EXISTS portal_private.staff_tasks(
  task_id text PRIMARY KEY,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'NEW',
  priority text NOT NULL DEFAULT 'HIGH',
  authority_domain text NOT NULL,
  assigned_functional_role text,
  source_type text NOT NULL DEFAULT 'OWNER_INSTRUCTION',
  qa_only boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS portal_private.ai_coordination_records(
  record_id uuid PRIMARY KEY,
  record_type text NOT NULL,
  functional_role text NOT NULL,
  identity_id text NOT NULL,
  token_id uuid,
  client_id text,
  server_slug text,
  tool_name text,
  target_type text,
  target_id text,
  target_role text,
  parent_record_id uuid,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid,
  idempotency_key_hash text,
  payload_hash text,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  correlation_id uuid,
  mcp_request_id uuid,
  qa_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

\ir ../../supabase/migrations/20260915010000_admin_payments_v7_server_materializer.sql
\ir ../../supabase/migrations/20260915023000_admin_payments_v7_auto_materialization.sql
SET rona.payments_v7_allow_missing_cron='on';
\ir ../../supabase/migrations/20260915030000_admin_payments_v7_materialization_maintenance.sql

INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'b7300000-0000-4000-8000-000000000001','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE',
  'functional_conclusion_submit','DEAL','DEAL-TEST-4','OPERATIONS_DIRECTOR',24,
  '["TASK-PAYMENTS-V7-FINANCE-LINEAGE-QA-MAINT"]'::jsonb,'[]'::jsonb,
  '{"confirmed":true,"summary":"QA Finance maintenance source-lock lineage"}'::jsonb,'APPROVED_WITH_CONDITIONS',
  'b7300000-0000-4000-8000-000000000002',false,'2026-09-15T00:20:00Z',repeat('c',64)
);

CREATE OR REPLACE FUNCTION portal_private.qa_maintenance_manifest_v7(
  p_task text,p_manifest uuid,p_payment_id text,p_idem text,p_created timestamptz
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE v_event jsonb; v_payload jsonb;
BEGIN
  INSERT INTO portal_private.staff_tasks(task_id,title,status,priority,authority_domain,assigned_functional_role,source_type,qa_only)
  VALUES(p_task,'QA periodic maintenance','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',false);

  v_event:=jsonb_build_object(
    'event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id',p_payment_id,
    'effective_at',to_char(p_created+interval '30 seconds','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source_version','QA-MAINT-V1',
    'source_timestamp',to_char(p_created+interval '15 seconds','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'idempotency_key',p_idem,
    'source_refs',jsonb_build_array(
      jsonb_build_object('source_type','TASK','source_id',p_task),
      jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','b7300000-0000-4000-8000-000000000001')
    ),
    'payload',jsonb_build_object(
      'amount',65,'currency','USD','bank_transaction_reference','QA-MAINT-'||p_payment_id,
      'counterparty_name','QA Maintenance Client'
    )
  );

  v_payload:=jsonb_build_object(
    'target_entity_type','TASK','target_entity_id',p_task,
    'proposed_action','PAYMENTS_V7_MATERIALIZE','proposed_field','payments_v7_materialization_manifest',
    'reason','QA periodic maintenance manifest','risk_note','QA only',
    'proposed_state',jsonb_build_object(
      'schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1','source_lock_task_id',p_task,
      'source_lock_record_ids',jsonb_build_array('b7300000-0000-4000-8000-000000000001'),
      'events',jsonb_build_array(jsonb_build_object('confirmation_status','CONFIRMED','event',v_event))
    )
  );

  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    p_manifest,'BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit',
    'TASK',p_task,'OPERATIONS_DIRECTOR',1,'[]'::jsonb,
    jsonb_build_array(p_task,'FINANCE_CONCLUSION:b7300000-0000-4000-8000-000000000001'),
    v_payload,'PROPOSED',gen_random_uuid(),false,p_created,
    encode(sha256(convert_to(v_payload::text,'UTF8')),'hex')
  );
END $$;

CREATE OR REPLACE FUNCTION portal_private.qa_maintenance_conclusion_v7(
  p_task text,p_manifest uuid,p_conclusion uuid,p_created timestamptz
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE v_payload jsonb;
BEGIN
  v_payload:=jsonb_build_object(
    'entity_type','TASK','entity_id',p_task,'status','APPROVED','confirmed',true,
    'summary','QA confirms exact Payments V7 maintenance manifest',
    'open_issues',jsonb_build_array(),'risks',jsonb_build_array(),
    'mandatory_conditions',jsonb_build_array(),'recommendation','Periodic server maintenance'
  );

  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    p_conclusion,'FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit',
    'TASK',p_task,'OPERATIONS_DIRECTOR',1,
    jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:'||p_manifest::text),'[]'::jsonb,
    v_payload,'APPROVED',gen_random_uuid(),false,p_created,
    encode(sha256(convert_to(v_payload::text,'UTF8')),'hex')
  );
END $$;

-- Scenario 1: a due RETRY job is recovered by the periodic worker without calling recovery from this test.
SELECT portal_private.qa_maintenance_manifest_v7(
  'TASK-PAYMENTS-V7-QA-PERIODIC-RETRY','b7400000-0000-4000-8000-000000000001',
  'MAT-PERIODIC-RETRY-001','qa-periodic-retry-001','2026-09-15T00:21:00Z'
);
ALTER TABLE portal_private.ai_coordination_records DISABLE TRIGGER finance_auto_materialize_after_conclusion_v7;
SELECT portal_private.qa_maintenance_conclusion_v7(
  'TASK-PAYMENTS-V7-QA-PERIODIC-RETRY','b7400000-0000-4000-8000-000000000001',
  'b7500000-0000-4000-8000-000000000001','2026-09-15T00:21:10Z'
);
ALTER TABLE portal_private.ai_coordination_records ENABLE TRIGGER finance_auto_materialize_after_conclusion_v7;

INSERT INTO portal_private.finance_materialization_jobs_v7(
  manifest_record_id,conclusion_record_id,source_lock_task_id,manifest_payload_sha256,
  status,attempt_count,next_attempt_at,last_error
)
SELECT m.record_id,'b7500000-0000-4000-8000-000000000001',m.target_id,
       encode(sha256(convert_to((m.payload->'proposed_state')::text,'UTF8')),'hex'),
       'RETRY',1,now()-interval '1 second','QA seeded due RETRY'
FROM portal_private.ai_coordination_records m
WHERE m.record_id='b7400000-0000-4000-8000-000000000001';

SELECT pg_sleep(3);

DO $$
DECLARE v_events integer; v_jobs integer;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.payments
    WHERE payment_id='MAT-PERIODIC-RETRY-001' AND bank_fact_status='BANK_CONFIRMED'
  ) THEN RAISE EXCEPTION 'Periodic worker did not self-recover RETRY'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_jobs_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000001' AND status='MATERIALIZED'
  ) THEN RAISE EXCEPTION 'RETRY job did not become MATERIALIZED'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_attempts_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000001'
      AND invocation_source='RECOVERY' AND outcome='MATERIALIZED' AND persist_invoked=true
  ) THEN RAISE EXCEPTION 'Periodic RETRY recovery audit missing'; END IF;
  SELECT count(*) INTO v_jobs FROM portal_private.finance_materialization_jobs_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000001';
  SELECT count(*) INTO v_events FROM portal_private.finance_events_v7
    WHERE idempotency_key='qa-periodic-retry-001';
  IF v_jobs<>1 OR v_events<>1 THEN RAISE EXCEPTION 'Periodic RETRY recovery duplicated job/event'; END IF;
END $$;

-- Scenario 2: trigger misses durable job creation; periodic reconciliation discovers and executes it once.
SELECT portal_private.qa_maintenance_manifest_v7(
  'TASK-PAYMENTS-V7-QA-ORPHAN','b7400000-0000-4000-8000-000000000010',
  'MAT-PERIODIC-ORPHAN-001','qa-periodic-orphan-001','2026-09-15T00:22:00Z'
);
ALTER TABLE portal_private.ai_coordination_records DISABLE TRIGGER finance_auto_materialize_after_conclusion_v7;
SELECT portal_private.qa_maintenance_conclusion_v7(
  'TASK-PAYMENTS-V7-QA-ORPHAN','b7400000-0000-4000-8000-000000000010',
  'b7500000-0000-4000-8000-000000000010','2026-09-15T00:22:10Z'
);
ALTER TABLE portal_private.ai_coordination_records ENABLE TRIGGER finance_auto_materialize_after_conclusion_v7;

DO $$ BEGIN
  IF EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_jobs_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000010'
  ) THEN RAISE EXCEPTION 'Orphan fixture unexpectedly has a job before reconciliation'; END IF;
END $$;

SELECT pg_sleep(3);

DO $$
DECLARE v_jobs integer; v_events integer; v_attempts integer;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_jobs_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000010'
      AND conclusion_record_id='b7500000-0000-4000-8000-000000000010'
      AND status='MATERIALIZED'
  ) THEN RAISE EXCEPTION 'Periodic reconciliation did not create and materialize missing job'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.payments
    WHERE payment_id='MAT-PERIODIC-ORPHAN-001' AND bank_fact_status='BANK_CONFIRMED'
  ) THEN RAISE EXCEPTION 'Reconciled orphan payment missing'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_maintenance_audit_v7
    WHERE invocation_source='QA_PERIODIC_WORKER' AND reconciled_jobs>=1 AND recovered_jobs>=1
  ) THEN RAISE EXCEPTION 'Reconciliation maintenance audit missing'; END IF;

  SELECT count(*) INTO v_jobs FROM portal_private.finance_materialization_jobs_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000010';
  SELECT count(*) INTO v_events FROM portal_private.finance_events_v7
    WHERE idempotency_key='qa-periodic-orphan-001';
  SELECT count(*) INTO v_attempts FROM portal_private.finance_materialization_attempts_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000010' AND outcome='MATERIALIZED';
  IF v_jobs<>1 OR v_events<>1 OR v_attempts<>1 THEN
    RAISE EXCEPTION 'Orphan reconciliation was not exactly-once: jobs %, events %, materialized attempts %',v_jobs,v_events,v_attempts;
  END IF;
END $$;

SELECT pg_sleep(2);

DO $$
DECLARE v_jobs integer; v_events integer; v_attempts integer;
BEGIN
  SELECT count(*) INTO v_jobs FROM portal_private.finance_materialization_jobs_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000010';
  SELECT count(*) INTO v_events FROM portal_private.finance_events_v7
    WHERE idempotency_key='qa-periodic-orphan-001';
  SELECT count(*) INTO v_attempts FROM portal_private.finance_materialization_attempts_v7
    WHERE manifest_record_id='b7400000-0000-4000-8000-000000000010' AND outcome='MATERIALIZED';
  IF v_jobs<>1 OR v_events<>1 OR v_attempts<>1 THEN
    RAISE EXCEPTION 'Repeated periodic ticks created duplicates';
  END IF;
END $$;

DROP FUNCTION portal_private.qa_maintenance_conclusion_v7(text,uuid,uuid,timestamptz);
DROP FUNCTION portal_private.qa_maintenance_manifest_v7(text,uuid,text,text,timestamptz);

\echo 'PAYMENTS V7 PERIODIC MAINTENANCE PASS — RETRY SELF-RECOVERY + ORPHAN RECONCILIATION EXACTLY ONCE'
