\set ON_ERROR_STOP on
\ir finance-controlled-write.sql

-- Production-like immutable coordination substrate for manifest-bound QA.
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
  qa_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

\ir ../../supabase/migrations/20260915010000_admin_payments_v7_server_materializer.sql

INSERT INTO portal_private.staff_tasks(task_id,title,status,priority,authority_domain,assigned_functional_role,source_type,qa_only)
VALUES
('TASK-PAYMENTS-V7-QA-CONFIRMED','QA confirmed manifest','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true),
('TASK-PAYMENTS-V7-QA-UNCONFIRMED','QA unconfirmed manifest','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true),
('TASK-PAYMENTS-V7-QA-SUPERSEDED','QA superseded manifest','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true),
('TASK-PAYMENTS-V7-QA-TO-VERIFY','QA TO_VERIFY manifest','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true),
('TASK-PAYMENTS-V7-QA-SCOPE','QA unresolved allocation manifest','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true),
('TASK-PAYMENTS-V7-QA-FX','QA synthetic FX manifest','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true)
ON CONFLICT(task_id) DO NOTHING;

-- Existing Finance source-lock lineage. This is not the materialization confirmation itself.
INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7000000-0000-4000-8000-000000000001','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE',
  'functional_conclusion_submit','DEAL','DEAL-TEST-4','OPERATIONS_DIRECTOR',24,
  '["TASK-PAYMENTS-V7-FINANCE-LINEAGE-QA"]'::jsonb,'[]'::jsonb,
  '{"confirmed":true,"summary":"QA Finance source-lock lineage"}'::jsonb,'APPROVED_WITH_CONDITIONS',
  'a7000000-0000-4000-8000-000000000002',false,'2026-09-15T00:00:00Z',repeat('a',64)
) ON CONFLICT(record_id) DO NOTHING;

-- Exact confirmed manifest. The authoritative event exists only in proposed_state.
INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7100000-0000-4000-8000-000000000001','BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE',
  'business_change_proposal_submit','TASK','TASK-PAYMENTS-V7-QA-CONFIRMED','OPERATIONS_DIRECTOR',1,
  '[]'::jsonb,
  '["TASK-PAYMENTS-V7-QA-CONFIRMED","FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001"]'::jsonb,
  jsonb_build_object(
    'target_entity_type','TASK','target_entity_id','TASK-PAYMENTS-V7-QA-CONFIRMED',
    'proposed_action','PAYMENTS_V7_MATERIALIZE','proposed_field','payments_v7_materialization_manifest',
    'reason','QA exact immutable manifest','risk_note','QA only',
    'evidence_refs',jsonb_build_array('TASK-PAYMENTS-V7-QA-CONFIRMED','FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001'),
    'proposed_state',jsonb_build_object(
      'schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1',
      'source_lock_task_id','TASK-PAYMENTS-V7-QA-CONFIRMED',
      'source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),
      'events',jsonb_build_array(jsonb_build_object(
        'confirmation_status','CONFIRMED',
        'event',jsonb_build_object(
          'event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id','MAT-IN-CONFIRMED-001',
          'effective_at','2026-09-15T00:01:00Z',
          'source_refs',jsonb_build_array(
            jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-CONFIRMED'),
            jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001'),
            jsonb_build_object('source_type','BANK_STATEMENT','source_id','QA-STMT-MAT-001')
          ),
          'source_version','QA-MANIFEST-V1','source_timestamp','2026-09-15T00:00:30Z',
          'idempotency_key','qa-manifest-confirmed-001',
          'payload',jsonb_build_object('amount',33,'currency','USD','bank_transaction_reference','QA-MAT-BANK-001','counterparty_name','QA Materializer Client')
        )
      ))
    )
  ),
  'PROPOSED','a7100000-0000-4000-8000-000000000002',false,'2026-09-15T00:00:10Z',repeat('b',64)
) ON CONFLICT(record_id) DO NOTHING;

INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7200000-0000-4000-8000-000000000001','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE',
  'functional_conclusion_submit','TASK','TASK-PAYMENTS-V7-QA-CONFIRMED','OPERATIONS_DIRECTOR',1,
  '["BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000001"]'::jsonb,'[]'::jsonb,
  jsonb_build_object(
    'entity_type','TASK','entity_id','TASK-PAYMENTS-V7-QA-CONFIRMED','status','APPROVED','confirmed',true,
    'summary','Exact Payments V7 manifest confirmed','open_issues',jsonb_build_array(),'risks',jsonb_build_array(),
    'mandatory_conditions',jsonb_build_array('Materialize exact manifest only'),'recommendation','Materialize exact manifest',
    'source_refs',jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000001')
  ),
  'APPROVED','a7200000-0000-4000-8000-000000000002',false,'2026-09-15T00:00:20Z',repeat('c',64)
) ON CONFLICT(record_id) DO NOTHING;

DO $$
DECLARE r jsonb; before_events int;
BEGIN
  -- Mandatory QA: amount injected after source-lock is denied before persistence.
  before_events:=(select count(*) from portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000001'),
    jsonb_build_object(
      'manifest_id','a7100000-0000-4000-8000-000000000001',
      'conclusion_id','a7200000-0000-4000-8000-000000000001',
      'amount',999999
    )
  );
  IF r->>'reason_code'<>'CALLER_PAYLOAD_OVERRIDE_FORBIDDEN'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR before_events<>(select count(*) from portal_private.finance_events_v7)
     OR exists(select 1 from portal_private.payments where payment_id='MAT-IN-CONFIRMED-001') THEN
    RAISE EXCEPTION 'AMOUNT tamper was not denied: %',r;
  END IF;
END $$;

DO $$
DECLARE r jsonb; before_events int;
BEGIN
  -- Mandatory QA: deal/payment injected after source-lock is denied before persistence.
  before_events:=(select count(*) from portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000002'),
    jsonb_build_object(
      'manifest_id','a7100000-0000-4000-8000-000000000001',
      'conclusion_id','a7200000-0000-4000-8000-000000000001',
      'deal_id','DEAL-TEST-1','payment_id','CALLER-TAMPERED-PAYMENT'
    )
  );
  IF r->>'reason_code'<>'CALLER_PAYLOAD_OVERRIDE_FORBIDDEN'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR before_events<>(select count(*) from portal_private.finance_events_v7)
     OR exists(select 1 from portal_private.payments where payment_id='CALLER-TAMPERED-PAYMENT') THEN
    RAISE EXCEPTION 'DEAL/PAYMENT tamper was not denied: %',r;
  END IF;
END $$;

-- Unconfirmed manifest confirmation.
INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7100000-0000-4000-8000-000000000010','BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE',
  'business_change_proposal_submit','TASK','TASK-PAYMENTS-V7-QA-UNCONFIRMED','OPERATIONS_DIRECTOR',1,'[]'::jsonb,
  '["TASK-PAYMENTS-V7-QA-UNCONFIRMED","FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001"]'::jsonb,
  jsonb_build_object(
    'target_entity_type','TASK','target_entity_id','TASK-PAYMENTS-V7-QA-UNCONFIRMED','proposed_action','PAYMENTS_V7_MATERIALIZE',
    'proposed_field','payments_v7_materialization_manifest','reason','QA','risk_note','QA',
    'proposed_state',jsonb_build_object('schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1','source_lock_task_id','TASK-PAYMENTS-V7-QA-UNCONFIRMED','source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),'events',jsonb_build_array(jsonb_build_object('confirmation_status','CONFIRMED','event',jsonb_build_object('event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id','MAT-UNCONFIRMED-001','effective_at','2026-09-15T00:02:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-UNCONFIRMED'),jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001')),'source_version','QA','source_timestamp','2026-09-15T00:01:30Z','idempotency_key','qa-unconfirmed-001','payload',jsonb_build_object('amount',34,'currency','USD','bank_transaction_reference','QA-U-1')))))
  ),
  'PROPOSED','a7100000-0000-4000-8000-000000000011',false,'2026-09-15T00:01:00Z',repeat('d',64)
),(
  'a7200000-0000-4000-8000-000000000010','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE',
  'functional_conclusion_submit','TASK','TASK-PAYMENTS-V7-QA-UNCONFIRMED','OPERATIONS_DIRECTOR',1,
  '["BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000010"]'::jsonb,'[]'::jsonb,
  jsonb_build_object('entity_type','TASK','entity_id','TASK-PAYMENTS-V7-QA-UNCONFIRMED','status','HOLD','confirmed',false,'summary','Not confirmed','open_issues',jsonb_build_array('Not confirmed'),'risks',jsonb_build_array(),'mandatory_conditions',jsonb_build_array(),'recommendation','Do not materialize','source_refs',jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000010')),
  'HOLD','a7200000-0000-4000-8000-000000000011',false,'2026-09-15T00:01:10Z',repeat('e',64)
) ON CONFLICT(record_id) DO NOTHING;

DO $$
DECLARE r jsonb;
BEGIN
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000010'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000010','conclusion_id','a7200000-0000-4000-8000-000000000010')
  );
  IF r->>'reason_code'<>'MANIFEST_CONCLUSION_NOT_CONFIRMED'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR exists(select 1 from portal_private.payments where payment_id='MAT-UNCONFIRMED-001') THEN
    RAISE EXCEPTION 'UNCONFIRMED manifest was not denied: %',r;
  END IF;
END $$;

-- Superseded manifest: new proposal explicitly supersedes the old one.
INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,supersedes_id,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7100000-0000-4000-8000-000000000020','BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit','TASK','TASK-PAYMENTS-V7-QA-SUPERSEDED','OPERATIONS_DIRECTOR',1,null,'[]'::jsonb,
  '["TASK-PAYMENTS-V7-QA-SUPERSEDED","FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001"]'::jsonb,
  jsonb_build_object('target_entity_type','TASK','target_entity_id','TASK-PAYMENTS-V7-QA-SUPERSEDED','proposed_action','PAYMENTS_V7_MATERIALIZE','proposed_field','payments_v7_materialization_manifest','reason','old','risk_note','old','proposed_state',jsonb_build_object('schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1','source_lock_task_id','TASK-PAYMENTS-V7-QA-SUPERSEDED','source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),'events',jsonb_build_array(jsonb_build_object('confirmation_status','CONFIRMED','event',jsonb_build_object('event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id','MAT-SUPERSEDED-OLD','effective_at','2026-09-15T00:03:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-SUPERSEDED'),jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001')),'source_version','QA','source_timestamp','2026-09-15T00:02:30Z','idempotency_key','qa-super-old-001','payload',jsonb_build_object('amount',35,'currency','USD','bank_transaction_reference','QA-S-OLD')))))),'PROPOSED','a7100000-0000-4000-8000-000000000021',false,'2026-09-15T00:02:00Z',repeat('f',64)),
  ('a7100000-0000-4000-8000-000000000021','BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit','TASK','TASK-PAYMENTS-V7-QA-SUPERSEDED','OPERATIONS_DIRECTOR',1,'a7100000-0000-4000-8000-000000000020','[]'::jsonb,
  '["TASK-PAYMENTS-V7-QA-SUPERSEDED","FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001"]'::jsonb,
  jsonb_build_object('target_entity_type','TASK','target_entity_id','TASK-PAYMENTS-V7-QA-SUPERSEDED','proposed_action','PAYMENTS_V7_MATERIALIZE','proposed_field','payments_v7_materialization_manifest','reason','new','risk_note','new','proposed_state',jsonb_build_object('schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1','source_lock_task_id','TASK-PAYMENTS-V7-QA-SUPERSEDED','source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),'events',jsonb_build_array(jsonb_build_object('confirmation_status','TO_VERIFY','event',jsonb_build_object('event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id','MAT-SUPERSEDED-NEW','effective_at','2026-09-15T00:03:10Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-SUPERSEDED'),jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001')),'source_version','QA','source_timestamp','2026-09-15T00:02:35Z','idempotency_key','qa-super-new-001','payload',jsonb_build_object('amount',36,'currency','USD','bank_transaction_reference','QA-S-NEW')))))),'PROPOSED','a7100000-0000-4000-8000-000000000022',false,'2026-09-15T00:02:10Z',repeat('1',64))
ON CONFLICT(record_id) DO NOTHING;

INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
  version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7200000-0000-4000-8000-000000000020','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit','TASK','TASK-PAYMENTS-V7-QA-SUPERSEDED','OPERATIONS_DIRECTOR',1,
  '["BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000020"]'::jsonb,'[]'::jsonb,
  jsonb_build_object('entity_type','TASK','entity_id','TASK-PAYMENTS-V7-QA-SUPERSEDED','status','APPROVED','confirmed',true,'summary','Old confirmed','open_issues',jsonb_build_array(),'risks',jsonb_build_array(),'mandatory_conditions',jsonb_build_array(),'recommendation','Old','source_refs',jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000020')),
  'APPROVED','a7200000-0000-4000-8000-000000000021',false,'2026-09-15T00:02:20Z',repeat('2',64)
) ON CONFLICT(record_id) DO NOTHING;

DO $$
DECLARE r jsonb;
BEGIN
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000020'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000020','conclusion_id','a7200000-0000-4000-8000-000000000020')
  );
  IF r->>'reason_code'<>'MANIFEST_SUPERSEDED'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR exists(select 1 from portal_private.payments where payment_id='MAT-SUPERSEDED-OLD') THEN
    RAISE EXCEPTION 'SUPERSEDED manifest was not denied: %',r;
  END IF;
END $$;

DO $$
DECLARE
  r jsonb;
  expected_manifest_hash text;
  expected_event_hash text;
  audit_id uuid;
BEGIN
  -- Mandatory QA: exact current confirmed manifest is materialized from stored proposed_state.
  select encode(digest(convert_to(payload->'proposed_state'::text,'UTF8'),'sha256'),'hex')
    into expected_manifest_hash
    from portal_private.ai_coordination_records
   where record_id='a7100000-0000-4000-8000-000000000001';
  select encode(digest(convert_to((payload->'proposed_state'->'events'->0->'event')::text,'UTF8'),'sha256'),'hex')
    into expected_event_hash
    from portal_private.ai_coordination_records
   where record_id='a7100000-0000-4000-8000-000000000001';

  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000030'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000001','conclusion_id','a7200000-0000-4000-8000-000000000001')
  );
  IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true
     OR coalesce((r->>'materialized')::boolean,false) IS DISTINCT FROM true
     OR r->>'manifest_payload_sha256'<>expected_manifest_hash
     OR r#>>'{counts,materialized}'<>'1' THEN
    RAISE EXCEPTION 'EXACT confirmed manifest rejected: %',r;
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.payments p
    JOIN portal_private.payment_allocations a ON a.payment_key=p.id
    WHERE p.payment_id='MAT-IN-CONFIRMED-001'
      AND p.bank_fact_status='BANK_CONFIRMED'
      AND p.finance_verification_status='VERIFIED'
      AND a.allocated_amount=33
      AND a.allocation_status='VERIFIED'
  ) THEN RAISE EXCEPTION 'EXACT manifest event missing from Payments V7'; END IF;
  audit_id:=(r#>>'{events,0,materializer_audit_id}')::uuid;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materializer_audit_v7
    WHERE id=audit_id
      AND outcome='MATERIALIZED' AND persist_invoked=true
      AND manifest_payload_sha256=expected_manifest_hash
      AND event_payload_sha256=expected_event_hash
      AND length(manifest_payload_sha256)=64 AND length(event_payload_sha256)=64
  ) THEN RAISE EXCEPTION 'Exact content hash/audit binding missing'; END IF;
END $$;

-- TO_VERIFY manifest event: confirmed manifest, but event itself remains source-locked TO_VERIFY.
INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7100000-0000-4000-8000-000000000030','BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit','TASK','TASK-PAYMENTS-V7-QA-TO-VERIFY','OPERATIONS_DIRECTOR',1,'[]'::jsonb,
  '["TASK-PAYMENTS-V7-QA-TO-VERIFY","FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001"]'::jsonb,
  jsonb_build_object('target_entity_type','TASK','target_entity_id','TASK-PAYMENTS-V7-QA-TO-VERIFY','proposed_action','PAYMENTS_V7_MATERIALIZE','proposed_field','payments_v7_materialization_manifest','reason','TO_VERIFY','risk_note','TO_VERIFY','proposed_state',jsonb_build_object('schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1','source_lock_task_id','TASK-PAYMENTS-V7-QA-TO-VERIFY','source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),'events',jsonb_build_array(jsonb_build_object('confirmation_status','TO_VERIFY','event',jsonb_build_object('event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id','MAT-IN-TO-VERIFY-001','effective_at','2026-09-15T00:04:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-TO-VERIFY'),jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001')),'source_version','QA','source_timestamp','2026-09-15T00:03:30Z','idempotency_key','qa-manifest-toverify-001','payload',jsonb_build_object('amount',44,'currency','USD','bank_transaction_reference','QA-TV-1')))))),'PROPOSED','a7100000-0000-4000-8000-000000000031',false,'2026-09-15T00:03:00Z',repeat('3',64)),
  ('a7200000-0000-4000-8000-000000000030','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit','TASK','TASK-PAYMENTS-V7-QA-TO-VERIFY','OPERATIONS_DIRECTOR',1,
  '["BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000030"]'::jsonb,'[]'::jsonb,
  jsonb_build_object('entity_type','TASK','entity_id','TASK-PAYMENTS-V7-QA-TO-VERIFY','status','APPROVED','confirmed',true,'summary','Manifest confirmed, fact TO_VERIFY','open_issues',jsonb_build_array(),'risks',jsonb_build_array(),'mandatory_conditions',jsonb_build_array(),'recommendation','Skip unverified event','source_refs',jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000030')),'APPROVED','a7200000-0000-4000-8000-000000000031',false,'2026-09-15T00:03:10Z',repeat('4',64)
) ON CONFLICT(record_id) DO NOTHING;

DO $$
DECLARE r jsonb; before_events int;
BEGIN
  before_events:=(select count(*) from portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000040'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000030','conclusion_id','a7200000-0000-4000-8000-000000000030')
  );
  IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true
     OR coalesce((r->>'skipped')::boolean,false) IS DISTINCT FROM true
     OR r#>>'{counts,skipped}'<>'1'
     OR before_events<>(select count(*) from portal_private.finance_events_v7)
     OR exists(select 1 from portal_private.payments where payment_id='MAT-IN-TO-VERIFY-001') THEN
    RAISE EXCEPTION 'TO_VERIFY manifest event did not skip: %',r;
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM portal_private.finance_materializer_audit_v7
     WHERE manifest_record_id='a7100000-0000-4000-8000-000000000030'
       AND outcome='SKIPPED' AND persist_invoked=false AND reason_code='TO_VERIFY_NOT_MATERIALIZED'
  ) THEN RAISE EXCEPTION 'TO_VERIFY audit missing'; END IF;
END $$;

-- Unresolved confirmed outgoing allocation must remain SCOPE_ONLY / TO_VERIFY allocation review.
INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7100000-0000-4000-8000-000000000040','BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit','TASK','TASK-PAYMENTS-V7-QA-SCOPE','OPERATIONS_DIRECTOR',1,'[]'::jsonb,
  '["TASK-PAYMENTS-V7-QA-SCOPE","FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001"]'::jsonb,
  jsonb_build_object('target_entity_type','TASK','target_entity_id','TASK-PAYMENTS-V7-QA-SCOPE','proposed_action','PAYMENTS_V7_MATERIALIZE','proposed_field','payments_v7_materialization_manifest','reason','Scope','risk_note','Scope','proposed_state',jsonb_build_object('schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1','source_lock_task_id','TASK-PAYMENTS-V7-QA-SCOPE','source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),'events',jsonb_build_array(jsonb_build_object('confirmation_status','CONFIRMED','event',jsonb_build_object('event_type','OUTGOING_PAYMENT_CONFIRMED','payment_id','MAT-OUT-SCOPE-001','effective_at','2026-09-15T00:05:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-SCOPE'),jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001')),'source_version','QA','source_timestamp','2026-09-15T00:04:30Z','idempotency_key','qa-manifest-scope-001','payload',jsonb_build_object('amount',55,'currency','USD','payment_kind','COUNTERPARTY_PAYMENT','bank_transaction_reference','QA-SCOPE-1','beneficiary','QA Shared Supplier','attribution_mode','SCOPE_ONLY','scope_deal_ids',jsonb_build_array('DEAL-TEST-3','DEAL-TEST-4'))))))),'PROPOSED','a7100000-0000-4000-8000-000000000041',false,'2026-09-15T00:04:00Z',repeat('5',64)),
  ('a7200000-0000-4000-8000-000000000040','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit','TASK','TASK-PAYMENTS-V7-QA-SCOPE','OPERATIONS_DIRECTOR',1,
  '["BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000040"]'::jsonb,'[]'::jsonb,
  jsonb_build_object('entity_type','TASK','entity_id','TASK-PAYMENTS-V7-QA-SCOPE','status','APPROVED','confirmed',true,'summary','Scope confirmed','open_issues',jsonb_build_array(),'risks',jsonb_build_array(),'mandatory_conditions',jsonb_build_array(),'recommendation','Materialize unresolved scope','source_refs',jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000040')),'APPROVED','a7200000-0000-4000-8000-000000000041',false,'2026-09-15T00:04:10Z',repeat('6',64)
) ON CONFLICT(record_id) DO NOTHING;

DO $$
DECLARE r jsonb; attr uuid;
BEGIN
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000050'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000040','conclusion_id','a7200000-0000-4000-8000-000000000040')
  );
  IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true OR r#>>'{counts,materialized}'<>'1' THEN
    RAISE EXCEPTION 'SCOPE_ONLY manifest rejected: %',r;
  END IF;
  SELECT id INTO attr FROM portal_private.payment_business_attributions_v7 a
   WHERE a.payment_key=(SELECT id FROM portal_private.payments WHERE payment_id='MAT-OUT-SCOPE-001')
     AND NOT EXISTS(SELECT 1 FROM portal_private.payment_business_attributions_v7 n WHERE n.supersedes_id=a.id)
   LIMIT 1;
  IF NOT EXISTS(SELECT 1 FROM portal_private.payment_business_attributions_v7 WHERE id=attr AND attribution_mode='SCOPE_ONLY' AND jsonb_array_length(lines_snapshot)=0 AND cardinality(scope_deal_keys)=2)
     OR NOT EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-OUT-SCOPE-001' AND allocation_review_status='TO_VERIFY') THEN
    RAISE EXCEPTION 'Unresolved allocation not preserved';
  END IF;
END $$;

-- Synthetic FX manifest is source-locked but still denied before persistence.
INSERT INTO portal_private.ai_coordination_records(
  record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
) VALUES(
  'a7100000-0000-4000-8000-000000000050','BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit','TASK','TASK-PAYMENTS-V7-QA-FX','OPERATIONS_DIRECTOR',1,'[]'::jsonb,
  '["TASK-PAYMENTS-V7-QA-FX","FINANCE_CONCLUSION:a7000000-0000-4000-8000-000000000001"]'::jsonb,
  jsonb_build_object('target_entity_type','TASK','target_entity_id','TASK-PAYMENTS-V7-QA-FX','proposed_action','PAYMENTS_V7_MATERIALIZE','proposed_field','payments_v7_materialization_manifest','reason','FX','risk_note','FX','proposed_state',jsonb_build_object('schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1','source_lock_task_id','TASK-PAYMENTS-V7-QA-FX','source_lock_record_ids',jsonb_build_array('a7000000-0000-4000-8000-000000000001'),'events',jsonb_build_array(jsonb_build_object('confirmation_status','CONFIRMED','event',jsonb_build_object('event_type','PAYMENT_RESOURCE_CHAIN_CONFIRMED','deal_id','DEAL-TEST-1','payment_id','FIN-OUT-RUB-1','effective_at','2026-09-15T00:06:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','TASK','source_id','TASK-PAYMENTS-V7-QA-FX'),jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id','a7000000-0000-4000-8000-000000000001')),'source_version','QA','source_timestamp','2026-09-15T00:05:30Z','idempotency_key','qa-manifest-synthfx-001','payload',jsonb_build_object('native_amount',100,'native_currency','RUB','accounting_amount',1,'accounting_currency','USD','conversion_source_basis','CBR_MARKET_RATE')))))),'PROPOSED','a7100000-0000-4000-8000-000000000051',false,'2026-09-15T00:05:00Z',repeat('7',64)),
  ('a7200000-0000-4000-8000-000000000050','FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit','TASK','TASK-PAYMENTS-V7-QA-FX','OPERATIONS_DIRECTOR',1,
  '["BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000050"]'::jsonb,'[]'::jsonb,
  jsonb_build_object('entity_type','TASK','entity_id','TASK-PAYMENTS-V7-QA-FX','status','APPROVED','confirmed',true,'summary','FX manifest confirmed','open_issues',jsonb_build_array(),'risks',jsonb_build_array(),'mandatory_conditions',jsonb_build_array(),'recommendation','Still reject synthetic FX','source_refs',jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:a7100000-0000-4000-8000-000000000050')),'APPROVED','a7200000-0000-4000-8000-000000000051',false,'2026-09-15T00:05:10Z',repeat('8',64)
) ON CONFLICT(record_id) DO NOTHING;

DO $$
DECLARE r jsonb; before_chains int;
BEGIN
  before_chains:=(select count(*) from portal_private.payment_resource_chains_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7300000-0000-4000-8000-000000000060'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000050','conclusion_id','a7200000-0000-4000-8000-000000000050')
  );
  IF coalesce((r->>'accepted')::boolean,true) IS DISTINCT FROM false
     OR r#>>'{events,0,reason_code}'<>'SYNTHETIC_FX_FORBIDDEN'
     OR coalesce((r#>>'{events,0,persist_invoked}')::boolean,true) IS DISTINCT FROM false
     OR before_chains<>(select count(*) from portal_private.payment_resource_chains_v7) THEN
    RAISE EXCEPTION 'Synthetic FX guard failed: %',r;
  END IF;
END $$;

DO $$
DECLARE r jsonb;
BEGIN
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','LEGAL','identity_id','AI-LEGAL','correlation_id','a7300000-0000-4000-8000-000000000070'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000001','conclusion_id','a7200000-0000-4000-8000-000000000001')
  );
  IF r->>'reason_code'<>'FINANCE_ROLE_BINDING_REQUIRED' OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Role binding guard failed: %',r;
  END IF;
END $$;

DO $$
BEGIN
  IF has_function_privilege('anon','portal_private.materialize_finance_manifest_v7(jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','portal_private.materialize_finance_manifest_v7(jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','portal_private.materialize_finance_manifest_v7(jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('rona_payments_v7_reader','portal_private.materialize_finance_manifest_v7(jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Server materializer privilege leak';
  END IF;
  IF EXISTS(SELECT 1 FROM portal_private.finance_materializer_audit_v7 WHERE outcome='MATERIALIZED' AND (actor_role<>'FINANCE' OR actor_id<>'AI-FINANCE')) THEN
    RAISE EXCEPTION 'Materialized audit actor mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM portal_private.finance_materializer_audit_v7 WHERE manifest_payload_sha256 is not null and manifest_payload_sha256 !~ '^[0-9a-f]{64}$')
     OR EXISTS(SELECT 1 FROM portal_private.finance_materializer_audit_v7 WHERE event_payload_sha256 is not null and event_payload_sha256 !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION 'Exact payload hash format invalid';
  END IF;
END $$;

\echo 'PAYMENTS V7 MANIFEST CONTENT BINDING PASS — exact confirmed manifest materialized server-side'
\echo 'CALLER TAMPER PASS — amount/deal/payment override denied'
\echo 'UNCONFIRMED / SUPERSEDED MANIFEST PASS — denied before canonical persistence'
\echo 'TO_VERIFY PASS — confirmed manifest event remains skipped'
\echo 'EXACT SHA-256 / SCOPE_ONLY / NO SYNTHETIC FX / ROLE BINDING / AUDIT TRAIL PASS'
