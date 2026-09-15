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

INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'b7000000-0000-4000-8000-000000000001','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE',
  'functional_conclusion_submit','DEAL','DEAL-TEST-4','OPERATIONS_DIRECTOR',24,
  '["TASK-PAYMENTS-V7-FINANCE-LINEAGE-QA"]'::jsonb,'[]'::jsonb,
  '{"confirmed":true,"summary":"QA Finance source-lock lineage"}'::jsonb,'APPROVED_WITH_CONDITIONS',
  'b7000000-0000-4000-8000-000000000002',false,'2026-09-15T00:00:00Z',repeat('b',64)
);

CREATE OR REPLACE FUNCTION portal_private.qa_insert_auto_manifest_v7(
  p_task text,
  p_manifest uuid,
  p_payment_id text,
  p_idem text,
  p_confirmation text,
  p_created timestamptz
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_event jsonb;
  v_payload jsonb;
BEGIN
  INSERT INTO portal_private.staff_tasks(task_id,title,status,priority,authority_domain,assigned_functional_role,source_type,qa_only)
  VALUES(p_task,'QA automatic materialization','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',false);

  v_event:=jsonb_build_object(
    'event_type','CLIENT_PAYMENT_CONFIRMED',
    'deal_id','DEAL-TEST-4',
    'payment_id',p_payment_id,
    'effective_at',to_char(p_created+interval '30 seconds','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source_version','QA-AUTO-V1',
    'source_timestamp',to_char(p_created+interval '15 seconds','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'idempotency_key',p_idem,
    'source_refs',jsonb_build_array(
      jsonb_build_object('source_type','TASK','source_id',p_task),
      jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','b7000000-0000-4000-8000-000000000001')
    ),
    'payload',jsonb_build_object(
      'amount',55,
      'currency','USD',
      'bank_transaction_reference','QA-AUTO-'||p_payment_id,
      'counterparty_name','QA Auto Client'
    )
  );

  v_payload:=jsonb_build_object(
    'target_entity_type','TASK',
    'target_entity_id',p_task,
    'proposed_action','PAYMENTS_V7_MATERIALIZE',
    'proposed_field','payments_v7_materialization_manifest',
    'reason','QA exact automatic source-locked manifest',
    'risk_note','QA only',
    'proposed_state',jsonb_build_object(
      'schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1',
      'source_lock_task_id',p_task,
      'source_lock_record_ids',jsonb_build_array('b7000000-0000-4000-8000-000000000001'),
      'events',jsonb_build_array(jsonb_build_object('confirmation_status',p_confirmation,'event',v_event))
    )
  );

  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    p_manifest,'BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit',
    'TASK',p_task,'OPERATIONS_DIRECTOR',1,'[]'::jsonb,
    jsonb_build_array(p_task,'FINANCE_CONCLUSION:b7000000-0000-4000-8000-000000000001'),
    v_payload,'PROPOSED',gen_random_uuid(),false,p_created,
    encode(sha256(convert_to(v_payload::text,'UTF8')),'hex')
  );
END $$;

CREATE OR REPLACE FUNCTION portal_private.qa_insert_auto_conclusion_v7(
  p_task text,
  p_manifest uuid,
  p_conclusion uuid,
  p_version integer,
  p_created timestamptz,
  p_role text default 'FINANCE',
  p_identity text default 'AI-FINANCE'
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE v_payload jsonb;
BEGIN
  v_payload:=jsonb_build_object(
    'entity_type','TASK','entity_id',p_task,'status','APPROVED','confirmed',true,
    'summary','QA confirms exact Payments V7 manifest',
    'open_issues',jsonb_build_array(),'risks',jsonb_build_array(),
    'mandatory_conditions',jsonb_build_array(),
    'recommendation','Automatic server-side materialization'
  );

  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    p_conclusion,'FUNCTIONAL_CONCLUSION',p_role,p_identity,'functional_conclusion_submit',
    'TASK',p_task,'OPERATIONS_DIRECTOR',p_version,
    jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:'||p_manifest::text),'[]'::jsonb,
    v_payload,'APPROVED',gen_random_uuid(),false,p_created,
    encode(sha256(convert_to(v_payload::text,'UTF8')),'hex')
  );
END $$;

-- E2E: proposal alone does not write; confirming Finance conclusion automatically materializes.
SELECT portal_private.qa_insert_auto_manifest_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-1','b7100000-0000-4000-8000-000000000001',
  'MAT-AUTO-CONFIRMED-001','qa-auto-confirmed-001','CONFIRMED','2026-09-15T00:10:00Z'
);

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-AUTO-CONFIRMED-001') THEN
    RAISE EXCEPTION 'Proposal alone materialized before confirming conclusion';
  END IF;
END $$;

SELECT portal_private.qa_insert_auto_conclusion_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-1','b7100000-0000-4000-8000-000000000001',
  'b7200000-0000-4000-8000-000000000001',1,'2026-09-15T00:10:10Z'
);

DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM portal_private.ai_coordination_records WHERE record_id='b7200000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Finance conclusion was not saved';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-AUTO-CONFIRMED-001' AND bank_fact_status='BANK_CONFIRMED' AND finance_verification_status='VERIFIED') THEN
    RAISE EXCEPTION 'Automatic confirmed payment materialization missing';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_jobs_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000001'
       AND conclusion_record_id='b7200000-0000-4000-8000-000000000001'
       AND status='MATERIALIZED' AND attempt_count=1
  ) THEN RAISE EXCEPTION 'Automatic materialization job not MATERIALIZED'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_attempts_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000001'
       AND invocation_source='CONCLUSION_TRIGGER' AND outcome='MATERIALIZED' AND persist_invoked=true
  ) THEN RAISE EXCEPTION 'Automatic materialization audit missing'; END IF;
END $$;

-- Repeated confirming conclusion for the same manifest must be an idempotent no-op.
DO $$ DECLARE before_events integer; BEGIN
  before_events:=(SELECT count(*) FROM portal_private.finance_events_v7);
  PERFORM portal_private.qa_insert_auto_conclusion_v7(
    'TASK-PAYMENTS-V7-QA-AUTO-1','b7100000-0000-4000-8000-000000000001',
    'b7200000-0000-4000-8000-000000000002',2,'2026-09-15T00:10:20Z'
  );
  IF before_events<>(SELECT count(*) FROM portal_private.finance_events_v7) THEN
    RAISE EXCEPTION 'Repeated conclusion created duplicate Finance event';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_attempts_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000001'
       AND conclusion_record_id='b7200000-0000-4000-8000-000000000002'
       AND outcome='IDEMPOTENT_REPLAY' AND persist_invoked=false
  ) THEN RAISE EXCEPTION 'Repeated conclusion idempotency audit missing'; END IF;
END $$;

-- TO_VERIFY remains source-locked but is never persisted to Payments.
SELECT portal_private.qa_insert_auto_manifest_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-TV','b7100000-0000-4000-8000-000000000010',
  'MAT-AUTO-TO-VERIFY-001','qa-auto-toverify-001','TO_VERIFY','2026-09-15T00:11:00Z'
);
SELECT portal_private.qa_insert_auto_conclusion_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-TV','b7100000-0000-4000-8000-000000000010',
  'b7200000-0000-4000-8000-000000000010',1,'2026-09-15T00:11:10Z'
);

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-AUTO-TO-VERIFY-001') THEN
    RAISE EXCEPTION 'TO_VERIFY was materialized';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_jobs_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000010' AND status='SKIPPED'
  ) THEN RAISE EXCEPTION 'TO_VERIFY automatic job did not SKIP'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_attempts_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000010'
       AND outcome='SKIPPED' AND persist_invoked=false
  ) THEN RAISE EXCEPTION 'TO_VERIFY audit missing'; END IF;
END $$;

-- Non-Finance conclusion cannot launch a job.
SELECT portal_private.qa_insert_auto_manifest_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-NONFIN','b7100000-0000-4000-8000-000000000020',
  'MAT-AUTO-NONFIN-001','qa-auto-nonfin-001','CONFIRMED','2026-09-15T00:12:00Z'
);
SELECT portal_private.qa_insert_auto_conclusion_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-NONFIN','b7100000-0000-4000-8000-000000000020',
  'b7200000-0000-4000-8000-000000000020',1,'2026-09-15T00:12:10Z','LEGAL','AI-LEGAL'
);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM portal_private.finance_materialization_jobs_v7 WHERE manifest_record_id='b7100000-0000-4000-8000-000000000020') THEN
    RAISE EXCEPTION 'Non-Finance conclusion launched automatic materialization';
  END IF;
  IF EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-AUTO-NONFIN-001') THEN
    RAISE EXCEPTION 'Non-Finance conclusion materialized payment';
  END IF;
END $$;

-- Technical automation failure must not roll back the Finance conclusion; recovery later succeeds.
SELECT portal_private.qa_insert_auto_manifest_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-RECOVERY','b7100000-0000-4000-8000-000000000030',
  'MAT-AUTO-RECOVERY-001','qa-auto-recovery-001','CONFIRMED','2026-09-15T00:13:00Z'
);
ALTER TABLE portal_private.finance_materialization_jobs_v7
  ADD CONSTRAINT qa_force_auto_retry CHECK(status<>'RUNNING');

SELECT portal_private.qa_insert_auto_conclusion_v7(
  'TASK-PAYMENTS-V7-QA-AUTO-RECOVERY','b7100000-0000-4000-8000-000000000030',
  'b7200000-0000-4000-8000-000000000030',1,'2026-09-15T00:13:10Z'
);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM portal_private.ai_coordination_records WHERE record_id='b7200000-0000-4000-8000-000000000030') THEN
    RAISE EXCEPTION 'Materialization failure rolled back Finance conclusion';
  END IF;
  IF EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-AUTO-RECOVERY-001') THEN
    RAISE EXCEPTION 'Forced retry unexpectedly materialized payment';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_jobs_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000030' AND status='RETRY'
  ) THEN RAISE EXCEPTION 'Technical failure did not enter RETRY'; END IF;
END $$;

ALTER TABLE portal_private.finance_materialization_jobs_v7 DROP CONSTRAINT qa_force_auto_retry;
UPDATE portal_private.finance_materialization_jobs_v7
   SET next_attempt_at=now()
 WHERE manifest_record_id='b7100000-0000-4000-8000-000000000030';
SELECT portal_private.recover_finance_materialization_jobs_v7(10);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-AUTO-RECOVERY-001' AND bank_fact_status='BANK_CONFIRMED') THEN
    RAISE EXCEPTION 'Recovery did not materialize confirmed payment';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_jobs_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000030' AND status='MATERIALIZED'
  ) THEN RAISE EXCEPTION 'Recovery job did not become MATERIALIZED'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materialization_attempts_v7
     WHERE manifest_record_id='b7100000-0000-4000-8000-000000000030'
       AND invocation_source='RECOVERY' AND outcome='MATERIALIZED' AND persist_invoked=true
  ) THEN RAISE EXCEPTION 'Recovery audit missing'; END IF;
END $$;

DROP FUNCTION portal_private.qa_insert_auto_conclusion_v7(text,uuid,uuid,integer,timestamptz,text,text);
DROP FUNCTION portal_private.qa_insert_auto_manifest_v7(text,uuid,text,text,text,timestamptz);

\echo 'PAYMENTS V7 AUTO MATERIALIZATION PASS — Finance proposal + conclusion automatically materializes'
\echo 'FINANCE PILOT SURFACE CONTRACT = EXISTING 8 TOOLS; NO CHATGPT WRITE TOOL REQUIRED'
\echo 'TO_VERIFY / NON-FINANCE / REPLAY / FAILURE ISOLATION / RECOVERY PASS'