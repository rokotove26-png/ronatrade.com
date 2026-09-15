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

DO $$ BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM pg_type
    WHERE typnamespace='portal_private'::regnamespace AND typname='ai_business_role_enum'
  ) THEN
    CREATE TYPE portal_private.ai_business_role_enum AS ENUM('FINANCE');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION portal_private.ai_role_global_policies_current_v1(p_role portal_private.ai_business_role_enum)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT CASE WHEN p_role::text='FINANCE' THEN
    jsonb_build_array(jsonb_build_object(
      'policy_key','FINANCE_GLOBAL_PAYMENT_SEMANTICS',
      'policy_id','QA_FINANCE_POLICY_CURRENT',
      'version',77,
      'policy',jsonb_build_object(
        'policy_key','FINANCE_GLOBAL_PAYMENT_SEMANTICS',
        'policy_id','QA_FINANCE_POLICY_CURRENT',
        'version',77,
        'rules',jsonb_build_object(
          'FUNDING_CURRENCY_PRIMARY_SEMANTICS',jsonb_build_object(
            'actual_spend_owner','FINANCE',
            'remaining_owner','FINANCE',
            'missing_direct_funding_side','NOT_SUFFICIENT_FOR_TO_VERIFY',
            'to_verify_only_when_finance_cannot_determine',true,
            'finance_authoritative_zero_when_no_actual_expense',true,
            'reverse_fx_as_primary','FORBIDDEN',
            'resource_chain_accounting_amount_as_primary','FORBIDDEN'
          )
        )
      )
    ))
  ELSE '[]'::jsonb END
$$;

\ir ../../supabase/migrations/20260915010000_admin_payments_v7_server_materializer.sql
\ir ../../supabase/migrations/20260915023000_admin_payments_v7_auto_materialization.sql
SET rona.payments_v7_allow_missing_cron='on';
\ir ../../supabase/migrations/20260915030000_admin_payments_v7_materialization_maintenance.sql
\ir ../../supabase/migrations/20260915203000_admin_payments_v7_finance_execution_authority.sql

INSERT INTO portal_private.staff_tasks(task_id,title,status,priority,authority_domain,assigned_functional_role,source_type,qa_only)
VALUES('TASK-QA-FINANCE-EXECUTION','QA Finance execution authority','NEW','HIGH','FINANCE','FINANCE','OWNER_INSTRUCTION',false);

CREATE OR REPLACE FUNCTION portal_private.qa_finance_execution_result_v2(
  p_proposal uuid,
  p_deal_conclusion uuid,
  p_task_conclusion uuid,
  p_version integer,
  p_actual jsonb,
  p_remaining jsonb,
  p_status text,
  p_supersede_deal_conclusion uuid default null,
  p_supersede_task_conclusion uuid default null,
  p_created timestamptz default now()
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_proposal_payload jsonb;
  v_deal_payload jsonb;
  v_task_payload jsonb;
BEGIN
  v_deal_payload:=jsonb_build_object(
    'entity_type','DEAL','entity_id','DEAL-TEST-4','confirmed',true,'status','APPROVED',
    'summary','QA Finance execution source conclusion'
  );
  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,supersedes_id,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    p_deal_conclusion,'FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit',
    'DEAL','DEAL-TEST-4','OPERATIONS_DIRECTOR',p_version,p_supersede_deal_conclusion,
    '[]'::jsonb,'[]'::jsonb,v_deal_payload,'APPROVED',gen_random_uuid(),false,p_created,
    encode(sha256(convert_to(v_deal_payload::text,'UTF8')),'hex')
  );

  v_proposal_payload:=jsonb_build_object(
    'target_entity_type','TASK','target_entity_id','TASK-QA-FINANCE-EXECUTION',
    'proposed_action','MATERIALIZE_FINANCE_AUTHORITATIVE_RESULT',
    'proposed_field','finance_execution_authority',
    'reason','QA source-driven execution authority',
    'risk_note','QA only',
    'proposed_state',jsonb_build_object(
      'deal_id','DEAL-TEST-4','currency','USD','actual_spend',p_actual,
      'remaining',p_remaining,'status',p_status,
      'policy_required','QA_FINANCE_POLICY_CURRENT',
      'source_conclusion_id',p_deal_conclusion::text
    )
  );
  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    p_proposal,'BUSINESS_CHANGE_PROPOSAL','FINANCE','AI-FINANCE','business_change_proposal_submit',
    'TASK','TASK-QA-FINANCE-EXECUTION','OPERATIONS_DIRECTOR',p_version,
    '[]'::jsonb,jsonb_build_array('FINANCE_CONCLUSION:'||p_deal_conclusion::text),
    v_proposal_payload,'PROPOSED',gen_random_uuid(),false,p_created+interval '1 second',
    encode(sha256(convert_to(v_proposal_payload::text,'UTF8')),'hex')
  );

  v_task_payload:=jsonb_build_object(
    'entity_type','TASK','entity_id','TASK-QA-FINANCE-EXECUTION','confirmed',true,'status','APPROVED',
    'summary','QA confirms Finance authoritative execution result'
  );
  INSERT INTO portal_private.ai_coordination_records(
    record_id,record_type,functional_role,identity_id,tool_name,target_type,target_id,target_role,
    version,supersedes_id,source_refs,evidence_refs,payload,status,correlation_id,qa_only,created_at,payload_hash
  ) VALUES(
    p_task_conclusion,'FUNCTIONAL_CONCLUSION','FINANCE','AI-FINANCE','functional_conclusion_submit',
    'TASK','TASK-QA-FINANCE-EXECUTION','OPERATIONS_DIRECTOR',p_version,p_supersede_task_conclusion,
    jsonb_build_array('BUSINESS_CHANGE_PROPOSAL:'||p_proposal::text),
    '[]'::jsonb,v_task_payload,'APPROVED',gen_random_uuid(),false,p_created+interval '2 seconds',
    encode(sha256(convert_to(v_task_payload::text,'UTF8')),'hex')
  );
END $$;

-- Zero is an authoritative Finance result even with no funding-side debit event.
SELECT portal_private.qa_finance_execution_result_v2(
  'c8100000-0000-4000-8000-000000000001',
  'c8100000-0000-4000-8000-000000000002',
  'c8100000-0000-4000-8000-000000000003',
  1,'0'::jsonb,'0'::jsonb,'CONFIRMED_ZERO',null,null,'2033-01-01T00:00:00Z'
);
SELECT portal_private.run_finance_materialization_maintenance_v7(25,25,'QA_PERIODIC_WORKER');
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM portal_private.deal_finance_authority_v7 a
   WHERE a.deal_key=(SELECT id FROM portal_private.deals WHERE deal_id='DEAL-TEST-4')
     AND NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 n WHERE n.supersedes_id=a.id)
   LIMIT 1;
  IF r.actual_spend_status<>'AUTHORITATIVE' OR r.actual_spend<>0 OR r.remaining_execution_status<>'AUTHORITATIVE' OR r.remaining_execution<>0 THEN
    RAISE EXCEPTION 'FINANCE_ZERO_PASS_THROUGH_FAILED: %',row_to_json(r);
  END IF;
END $$;

-- Nonzero exact Finance result passes unchanged.
SELECT portal_private.qa_finance_execution_result_v2(
  'c8200000-0000-4000-8000-000000000001',
  'c8200000-0000-4000-8000-000000000002',
  'c8200000-0000-4000-8000-000000000003',
  2,'417.25'::jsonb,'82.75'::jsonb,'CONFIRMED_EXECUTION',
  'c8100000-0000-4000-8000-000000000002','c8100000-0000-4000-8000-000000000003','2033-01-01T00:10:00Z'
);
SELECT portal_private.run_finance_materialization_maintenance_v7(25,25,'QA_PERIODIC_WORKER');
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM portal_private.deal_finance_authority_v7 a
   WHERE a.deal_key=(SELECT id FROM portal_private.deals WHERE deal_id='DEAL-TEST-4')
     AND NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 n WHERE n.supersedes_id=a.id)
   LIMIT 1;
  IF r.actual_spend_status<>'AUTHORITATIVE' OR r.actual_spend<>417.25 OR r.remaining_execution_status<>'AUTHORITATIVE' OR r.remaining_execution<>82.75 THEN
    RAISE EXCEPTION 'FINANCE_NONZERO_PASS_THROUGH_FAILED: %',row_to_json(r);
  END IF;
END $$;

-- Genuinely unresolved Finance result remains TO_VERIFY; it is not converted to zero.
SELECT portal_private.qa_finance_execution_result_v2(
  'c8300000-0000-4000-8000-000000000001',
  'c8300000-0000-4000-8000-000000000002',
  'c8300000-0000-4000-8000-000000000003',
  3,'"TO_VERIFY"'::jsonb,'"TO_VERIFY"'::jsonb,'TO_VERIFY',
  'c8200000-0000-4000-8000-000000000002','c8200000-0000-4000-8000-000000000003','2033-01-01T00:20:00Z'
);
SELECT portal_private.run_finance_materialization_maintenance_v7(25,25,'QA_PERIODIC_WORKER');
DO $$ DECLARE r record; BEGIN
  SELECT * INTO r FROM portal_private.deal_finance_authority_v7 a
   WHERE a.deal_key=(SELECT id FROM portal_private.deals WHERE deal_id='DEAL-TEST-4')
     AND NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 n WHERE n.supersedes_id=a.id)
   LIMIT 1;
  IF r.actual_spend_status<>'TO_VERIFY' OR r.actual_spend IS NOT NULL OR r.remaining_execution_status<>'TO_VERIFY' OR r.remaining_execution IS NOT NULL THEN
    RAISE EXCEPTION 'FINANCE_UNRESOLVED_PASS_THROUGH_FAILED: %',row_to_json(r);
  END IF;
END $$;

-- The execution authority event is not a bank payment event.
DO $$ BEGIN
  IF EXISTS(
    SELECT 1 FROM portal_private.finance_events_v7
     WHERE event_type='DEAL_EXECUTION_STATE_CONFIRMED' AND payment_key IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FINANCE_EXECUTION_EVENT_MUST_NOT_SYNTHESIZE_BANK_PAYMENT';
  END IF;
END $$;

SELECT 'FINANCE_EXECUTION_AUTHORITY_V2=PASS' AS qa;
