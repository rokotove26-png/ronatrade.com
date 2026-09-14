\set ON_ERROR_STOP on

-- Final aggregate observability contract:
-- top-level persist_invoked is true iff at least one event actually entered
-- portal_private.persist_finance_event_v7 during this materializer call.

-- 1. Synthetic FX is denied before persistence: aggregate must remain false.
DO $$
DECLARE r jsonb; before_events integer;
BEGIN
  before_events:=(SELECT count(*) FROM portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7400000-0000-4000-8000-000000000001'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000050','conclusion_id','a7200000-0000-4000-8000-000000000050')
  );
  IF r#>>'{events,0,reason_code}'<>'SYNTHETIC_FX_FORBIDDEN'
     OR coalesce((r#>>'{events,0,persist_invoked}')::boolean,true) IS DISTINCT FROM false
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR before_events<>(SELECT count(*) FROM portal_private.finance_events_v7) THEN
    RAISE EXCEPTION 'Synthetic FX aggregate persistence observability failed: %',r;
  END IF;
END $$;

-- 2. Caller payload override is denied before event processing: aggregate false.
DO $$
DECLARE r jsonb; before_events integer;
BEGIN
  before_events:=(SELECT count(*) FROM portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7400000-0000-4000-8000-000000000002'),
    jsonb_build_object(
      'manifest_id','a7100000-0000-4000-8000-000000000001',
      'conclusion_id','a7200000-0000-4000-8000-000000000001',
      'amount',999999
    )
  );
  IF r->>'reason_code'<>'CALLER_PAYLOAD_OVERRIDE_FORBIDDEN'
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR before_events<>(SELECT count(*) FROM portal_private.finance_events_v7) THEN
    RAISE EXCEPTION 'Caller override aggregate persistence observability failed: %',r;
  END IF;
END $$;

-- 3. TO_VERIFY is skipped without persistence: aggregate false.
DO $$
DECLARE r jsonb; before_events integer;
BEGIN
  before_events:=(SELECT count(*) FROM portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7400000-0000-4000-8000-000000000003'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000030','conclusion_id','a7200000-0000-4000-8000-000000000030')
  );
  IF coalesce((r->>'skipped')::boolean,false) IS DISTINCT FROM true
     OR r#>>'{events,0,reason_code}'<>'TO_VERIFY_NOT_MATERIALIZED'
     OR coalesce((r#>>'{events,0,persist_invoked}')::boolean,true) IS DISTINCT FROM false
     OR coalesce((r->>'persist_invoked')::boolean,true) IS DISTINCT FROM false
     OR before_events<>(SELECT count(*) FROM portal_private.finance_events_v7) THEN
    RAISE EXCEPTION 'TO_VERIFY aggregate persistence observability failed: %',r;
  END IF;
END $$;

-- 4. Exact confirmed manifest enters the canonical persistence call: aggregate true.
DO $$
DECLARE r jsonb;
BEGIN
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7400000-0000-4000-8000-000000000004'),
    jsonb_build_object('manifest_id','a7100000-0000-4000-8000-000000000001','conclusion_id','a7200000-0000-4000-8000-000000000001')
  );
  IF coalesce((r->>'materialized')::boolean,false) IS DISTINCT FROM true
     OR coalesce((r#>>'{events,0,persist_invoked}')::boolean,false) IS DISTINCT FROM true
     OR coalesce((r->>'persist_invoked')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Exact confirmed manifest aggregate persistence observability failed: %',r;
  END IF;
END $$;

-- 5. Mixed manifest: one skipped event + one persisted event => aggregate true.
DO $$
DECLARE
  v_task constant text:='TASK-PAYMENTS-V7-QA-OBS-MIXED';
  v_manifest constant uuid:='a7100000-0000-4000-8000-000000000090';
  v_conclusion constant uuid:='a7200000-0000-4000-8000-000000000090';
  v_lock constant text:='a7000000-0000-4000-8000-000000000001';
  v_skip_event jsonb;
  v_persist_event jsonb;
  v_manifest_payload jsonb;
  v_conclusion_payload jsonb;
  r jsonb;
  before_events integer;
  after_events integer;
  actual_any boolean;
BEGIN
  INSERT INTO portal_private.staff_tasks(
    task_id,title,status,priority,authority_domain,assigned_functional_role,source_type,qa_only
  ) VALUES(
    v_task,'QA materializer observability mixed manifest','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',true
  ) ON CONFLICT(task_id) DO NOTHING;

  v_skip_event:=jsonb_build_object(
    'event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id','MAT-MIXED-SKIP-001',
    'effective_at','2026-09-15T00:09:00Z','source_version','QA-OBS-MIXED-V1',
    'source_timestamp','2026-09-15T00:08:30Z','idempotency_key','qa-observability-mixed-skip-001',
    'source_refs',jsonb_build_array(
      jsonb_build_object('source_type','TASK','source_id',v_task),
      jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id',v_lock)
    ),
    'payload',jsonb_build_object('amount',45,'currency','USD','bank_transaction_reference','QA-OBS-MIX-SKIP')
  );

  v_persist_event:=jsonb_build_object(
    'event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-4','payment_id','MAT-MIXED-PERSIST-001',
    'effective_at','2026-09-15T00:09:10Z','source_version','QA-OBS-MIXED-V1',
    'source_timestamp','2026-09-15T00:08:35Z','idempotency_key','qa-observability-mixed-persist-001',
    'source_refs',jsonb_build_array(
      jsonb_build_object('source_type','TASK','source_id',v_task),
      jsonb_build_object('source_type','FINANCE_CONCLUSION','source_id',v_lock)
    ),
    'payload',jsonb_build_object('amount',46,'currency','USD','bank_transaction_reference','QA-OBS-MIX-PERSIST','counterparty_name','QA Observability Client')
  );

  v_manifest_payload:=jsonb_build_object(
    'target_entity_type','TASK','target_entity_id',v_task,
    'proposed_action','PAYMENTS_V7_MATERIALIZE',
    'proposed_field','payments_v7_materialization_manifest',
    'reason','QA aggregate persistence observability',
    'risk_note','QA only',
    'evidence_refs',jsonb_build_array(v_task,'FINANCE_CONCLUSION:'||v_lock),
    'proposed_state',jsonb_build_object(
      'schema','PAYMENTS_V7_MATERIALIZATION_MANIFEST_V1',
      'source_lock_task_id',v_task,
      'source_lock_record_ids',jsonb_build_array(v_lock),
      'events',jsonb_build_array(
        jsonb_build_object('confirmation_status','TO_VERIFY','event',v_skip_event),
        jsonb_build_object('confirmation_status','CONFIRMED','event',v_persist_event)
      )
    )
  );

  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    v_manifest,'BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit',
    'TASK',v_task,'OPERATIONS_DIRECTOR',1,'[]'::jsonb,
    jsonb_build_array(v_task,'FINANCE_CONCLUSION:'||v_lock),v_manifest_payload,'PROPOSED',
    'a7400000-0000-4000-8000-000000000090',false,'2026-09-15T00:08:00Z',
    encode(sha256(convert_to(v_manifest_payload::text,'UTF8')),'hex')
  );

  v_conclusion_payload:=jsonb_build_object(
    'entity_type','TASK','entity_id',v_task,'status','APPROVED','confirmed',true,
    'summary','QA confirms exact mixed manifest','open_issues',jsonb_build_array(),'risks',jsonb_build_array(),
    'mandatory_conditions',jsonb_build_array(),'recommendation','Materialize exact manifest only',
    'source_refs',jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:'||v_manifest::text)
  );

  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    v_conclusion,'FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit',
    'TASK',v_task,'OPERATIONS_DIRECTOR',1,
    jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:'||v_manifest::text),'[]'::jsonb,
    v_conclusion_payload,'APPROVED','a7400000-0000-4000-8000-000000000091',false,'2026-09-15T00:08:01Z',
    encode(sha256(convert_to(v_conclusion_payload::text,'UTF8')),'hex')
  );

  before_events:=(SELECT count(*) FROM portal_private.finance_events_v7);
  r:=portal_private.materialize_finance_manifest_v7(
    jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','a7400000-0000-4000-8000-000000000092'),
    jsonb_build_object('manifest_id',v_manifest::text,'conclusion_id',v_conclusion::text)
  );
  after_events:=(SELECT count(*) FROM portal_private.finance_events_v7);

  SELECT coalesce(bool_or(coalesce((e.value->>'persist_invoked')::boolean,false)),false)
    INTO actual_any
    FROM jsonb_array_elements(r->'events') e(value);

  IF coalesce((r->>'persist_invoked')::boolean,false) IS DISTINCT FROM actual_any
     OR actual_any IS DISTINCT FROM true
     OR r#>>'{counts,total}'<>'2'
     OR r#>>'{counts,skipped}'<>'1'
     OR r#>>'{counts,materialized}'<>'1'
     OR coalesce((r#>>'{events,0,persist_invoked}')::boolean,true) IS DISTINCT FROM false
     OR coalesce((r#>>'{events,1,persist_invoked}')::boolean,false) IS DISTINCT FROM true
     OR after_events<>before_events+1
     OR EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-MIXED-SKIP-001')
     OR NOT EXISTS(SELECT 1 FROM portal_private.payments WHERE payment_id='MAT-MIXED-PERSIST-001') THEN
    RAISE EXCEPTION 'Mixed manifest aggregate persistence observability failed: %',r;
  END IF;
END $$;

\echo 'SERVER MATERIALIZER AGGREGATE PERSIST_INVOKED OBSERVABILITY PASS'
\echo 'SYNTHETIC_FX / CALLER_OVERRIDE / TO_VERIFY => persist_invoked=false'
\echo 'EXACT CONFIRMED / MIXED WITH REAL PERSISTENCE => persist_invoked=true'
