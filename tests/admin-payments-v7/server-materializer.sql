\set ON_ERROR_STOP on
\ir finance-controlled-write.sql

-- Minimal source-lock substrate for the server materializer QA. Production already owns
-- these relations; this fixture only creates them when the Stage4B test substrate does not.
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
  tool_name text,
  target_type text,
  target_id text,
  target_role text,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL,
  correlation_id uuid,
  qa_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

\ir ../../supabase/migrations/20260915010000_admin_payments_v7_server_materializer.sql

INSERT INTO portal_private.staff_tasks(task_id,title,status,priority,authority_domain,assigned_functional_role,source_type,qa_only)
VALUES('TASK-PAYMENTS-V7-QA-MATERIALIZER','QA Payments V7 server materializer','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true)
ON CONFLICT(task_id) DO NOTHING;

INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only
) VALUES(
  'a7000000-0000-4000-8000-000000000001','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE',
  'functional_conclusion_submit','TASK','TASK-PAYMENTS-V7-QA-MATERIALIZER','OPERATIONS_DIRECTOR',1,
  '["TASK-PAYMENTS-V7-QA-MATERIALIZER"]'::jsonb,'[]'::jsonb,
  '{"confirmed":true,"summary":"QA source-locked Finance fact set"}'::jsonb,'APPROVED',
  'a7000000-0000-4000-8000-000000000002',true
) ON CONFLICT(record_id) DO NOTHING;

DO $$
DECLARE
  r jsonb;
BEGIN
  -- CONFIRMED: must pass the server materializer and appear in canonical Payments V7 input.
  r:=portal_private.materialize_finance_fact_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7000000-0000-4000-8000-000000000010'),
    jsonb_build_object(
      'confirmation_status','CONFIRMED',
      'source_lock_task_id','TASK-PAYMENTS-V7-QA-MATERIALIZER',
      'source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),
      'event_type','CLIENT_PAYMENT_CONFIRMED',
      'deal_id','DEAL-TEST-4',
      'payment_id','MAT-IN-CONFIRMED-001',
      'effective_at','2026-09-15T00:01:00Z',
      'source_refs',jsonb_build_array(
        jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-MATERIALIZER'),
        jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001'),
        jsonb_build_object('source_type','BANK_STATEMENT','source_id','QA-STMT-MAT-001')
      ),
      'source_version','QA-MATERIALIZER-V1',
      'source_timestamp','2026-09-15T00:00:30Z',
      'idempotency_key','qa-materializer-confirmed-001',
      'payload',jsonb_build_object(
        'amount',33,
        'currency','USD',
        'bank_transaction_reference','QA-MAT-BANK-001',
        'counterparty_name','QA Materializer Client'
      )
    )
  );
  IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true
     OR coalesce((r->>'materialized')::boolean,false) IS DISTINCT FROM true
     OR coalesce((r->>'persist_invoked')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CONFIRMED materializer fact rejected: %',r;
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.payments p
    JOIN portal_private.payment_allocations a ON a.payment_key=p.id
    WHERE p.payment_id='MAT-IN-CONFIRMED-001'
      AND p.bank_fact_status='BANK_CONFIRMED'
      AND p.finance_verification_status='VERIFIED'
      AND a.allocated_amount=33
      AND a.allocation_status='VERIFIED'
  ) THEN RAISE EXCEPTION 'CONFIRMED fact missing from Payments V7 canonical input'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materializer_audit_v7
    WHERE id=(r->>'materializer_audit_id')::uuid
      AND outcome='MATERIALIZED' AND persist_invoked=true
  ) THEN RAISE EXCEPTION 'CONFIRMED audit trail missing'; END IF;
END $$;

DO $$
DECLARE
  r jsonb;
  before_events integer;
BEGIN
  -- TO_VERIFY: fully structured/source-locked but must never reach persist_finance_event_v7.
  before_events:=(SELECT count(*) FROM portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_fact_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7000000-0000-4000-8000-000000000011'),
    jsonb_build_object(
      'confirmation_status','TO_VERIFY',
      'source_lock_task_id','TASK-PAYMENTS-V7-QA-MATERIALIZER',
      'source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),
      'event_type','CLIENT_PAYMENT_CONFIRMED',
      'deal_id','DEAL-TEST-4',
      'payment_id','MAT-IN-TO-VERIFY-001',
      'effective_at','2026-09-15T00:02:00Z',
      'source_refs',jsonb_build_array(
        jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-MATERIALIZER'),
        jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001'),
        jsonb_build_object('source_type','BANK_STATEMENT','source_id','QA-STMT-MAT-002')
      ),
      'source_version','QA-MATERIALIZER-V1',
      'source_timestamp','2026-09-15T00:01:30Z',
      'idempotency_key','qa-materializer-toverify-001',
      'payload',jsonb_build_object('amount',44,'currency','USD','bank_transaction_reference','QA-MAT-BANK-002')
    )
  );
  IF r->>'reason_code'<>'TO_VERIFY_NOT_MATERIALIZED'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'TO_VERIFY did not fail closed: %',r;
  END IF;
  IF EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-IN-TO-VERIFY-001')
     OR before_events<>(SELECT count(*) FROM portal_private.finance_events_v7) THEN
    RAISE EXCEPTION 'TO_VERIFY leaked into Payments V7';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materializer_audit_v7
    WHERE id=(r->>'materializer_audit_id')::uuid
      AND outcome='SKIPPED' AND persist_invoked=false AND reason_code='TO_VERIFY_NOT_MATERIALIZED'
  ) THEN RAISE EXCEPTION 'TO_VERIFY audit trail missing'; END IF;
END $$;

DO $$
DECLARE
  r jsonb;
  attr uuid;
BEGIN
  -- Confirmed bank fact with unresolved Deal split remains materialized as SCOPE_ONLY.
  r:=portal_private.materialize_finance_fact_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7000000-0000-4000-8000-000000000012'),
    jsonb_build_object(
      'confirmation_status','CONFIRMED',
      'source_lock_task_id','TASK-PAYMENTS-V7-QA-MATERIALIZER',
      'source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),
      'event_type','OUTGOING_PAYMENT_CONFIRMED',
      'payment_id','MAT-OUT-SCOPE-001',
      'effective_at','2026-09-15T00:03:00Z',
      'source_refs',jsonb_build_array(
        jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-MATERIALIZER'),
        jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001'),
        jsonb_build_object('source_type','BANK_STATEMENT','source_id','QA-STMT-MAT-003')
      ),
      'source_version','QA-MATERIALIZER-V1',
      'source_timestamp','2026-09-15T00:02:30Z',
      'idempotency_key','qa-materializer-scope-001',
      'payload',jsonb_build_object(
        'amount',55,'currency','USD','payment_kind','COUNTERPARTY_PAYMENT',
        'bank_transaction_reference','QA-MAT-BANK-003','beneficiary','QA Shared Supplier',
        'attribution_mode','SCOPE_ONLY','scope_deal_ids',jsonb_build_array('DEAL-TEST-3','DEAL-TEST-4')
      )
    )
  );
  IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'SCOPE_ONLY confirmed fact rejected: %',r;
  END IF;
  attr:=(r->>'attribution_id')::uuid;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.payment_business_attributions_v7
    WHERE id=attr AND attribution_mode='SCOPE_ONLY'
      AND jsonb_array_length(lines_snapshot)=0 AND cardinality(scope_deal_keys)=2
  ) THEN RAISE EXCEPTION 'Unresolved allocation was not preserved'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.payments
    WHERE payment_id='MAT-OUT-SCOPE-001' AND allocation_review_status='TO_VERIFY'
  ) THEN RAISE EXCEPTION 'Unresolved payment review state missing'; END IF;
END $$;

DO $$
DECLARE
  r jsonb;
  before_chains integer;
BEGIN
  -- Synthetic/market FX is rejected before the canonical persistence primitive.
  before_chains:=(SELECT count(*) FROM portal_private.payment_resource_chains_v7);
  r:=portal_private.materialize_finance_fact_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7000000-0000-4000-8000-000000000013'),
    jsonb_build_object(
      'confirmation_status','CONFIRMED',
      'source_lock_task_id','TASK-PAYMENTS-V7-QA-MATERIALIZER',
      'source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),
      'event_type','PAYMENT_RESOURCE_CHAIN_CONFIRMED',
      'deal_id','DEAL-TEST-1','payment_id','FIN-OUT-RUB-1',
      'effective_at','2026-09-15T00:04:00Z',
      'source_refs',jsonb_build_array(
        jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-MATERIALIZER'),
        jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001'),
        jsonb_build_object('source_type','FX_REFERENCE','source_id','QA-CBR-001')
      ),
      'source_version','QA-MATERIALIZER-V1',
      'source_timestamp','2026-09-15T00:03:30Z',
      'idempotency_key','qa-materializer-synthfx-001',
      'payload',jsonb_build_object(
        'native_amount',100,'native_currency','RUB','accounting_amount',1,'accounting_currency','USD',
        'conversion_source_basis','CBR_MARKET_RATE'
      )
    )
  );
  IF r->>'reason_code'<>'SYNTHETIC_FX_FORBIDDEN'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR before_chains<>(SELECT count(*) FROM portal_private.payment_resource_chains_v7) THEN
    RAISE EXCEPTION 'Synthetic FX guard failed: %',r;
  END IF;
END $$;

DO $$
DECLARE r jsonb;
BEGIN
  -- Non-Finance actor never reaches canonical persistence.
  r:=portal_private.materialize_finance_fact_v7(
    jsonb_build_object('role','LEGAL','identity_id','AI-LEGAL','correlation_id','a7000000-0000-4000-8000-000000000014'),
    jsonb_build_object('confirmation_status','CONFIRMED','event_type','CLIENT_PAYMENT_CONFIRMED')
  );
  IF r->>'reason_code'<>'FINANCE_ROLE_BINDING_REQUIRED'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Role binding guard failed: %',r;
  END IF;
END $$;

DO $$
BEGIN
  IF has_function_privilege('anon','portal_private.materialize_finance_fact_v7(jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','portal_private.materialize_finance_fact_v7(jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','portal_private.materialize_finance_fact_v7(jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('rona_payments_v7_reader','portal_private.materialize_finance_fact_v7(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Server materializer privilege leak';
  END IF;
  IF EXISTS(
    SELECT 1 FROM portal_private.finance_materializer_audit_v7
    WHERE outcome='MATERIALIZED' AND (actor_role<>'FINANCE' OR actor_id<>'AI-FINANCE')
  ) THEN RAISE EXCEPTION 'Materialized audit actor mismatch'; END IF;
END $$;

\echo 'PAYMENTS V7 SERVER MATERIALIZER PASS — confirmed fact materialized through persist_finance_event_v7'
\echo 'TO_VERIFY FAIL-CLOSED PASS — unconfirmed fact absent from Payments V7'
\echo 'UNRESOLVED ALLOCATION PASS — confirmed bank fact preserved as SCOPE_ONLY / TO_VERIFY allocation'
\echo 'NO SYNTHETIC FX / ROLE BINDING / AUDIT TRAIL PASS'
