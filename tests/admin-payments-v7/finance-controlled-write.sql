\set ON_ERROR_STOP on
\ir stage4b-production-substrate.sql

-- Upgrade the Stage4B substrate to the production payment/deal shape used by the Finance controlled writer.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='lifecycle_state_enum') THEN CREATE TYPE portal_private.lifecycle_state_enum AS ENUM('DRAFT','ACTIVE','SUSPENDED','CLOSED','ARCHIVED','SUPERSEDED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='authority_state_enum') THEN CREATE TYPE portal_private.authority_state_enum AS ENUM('DRAFT','SOURCE_RECEIVED','VERIFIED','CONFIRMED','SUPERSEDED','REJECTED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='payment_direction_enum') THEN CREATE TYPE portal_private.payment_direction_enum AS ENUM('INCOMING','OUTGOING'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='payment_kind_enum') THEN CREATE TYPE portal_private.payment_kind_enum AS ENUM('CLIENT_PAYMENT','COUNTERPARTY_PAYMENT','BANK_FEE','FX_CONVERSION','INTERNAL_TRANSFER','OTHER'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='payment_bank_state_enum') THEN CREATE TYPE portal_private.payment_bank_state_enum AS ENUM('RECEIVED_UNVERIFIED','BANK_CONFIRMED','REVERSED','REJECTED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='finance_state_enum') THEN CREATE TYPE portal_private.finance_state_enum AS ENUM('NOT_DUE','DUE','PARTIAL','PAID','OVERDUE','DISPUTED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='accounting_closure_state_enum') THEN CREATE TYPE portal_private.accounting_closure_state_enum AS ENUM('OPEN','PENDING_RECONCILIATION','CLOSED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='finance_verification_state_enum') THEN CREATE TYPE portal_private.finance_verification_state_enum AS ENUM('TO_VERIFY','VERIFIED','REJECTED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='deal_allocation_applicability_enum') THEN CREATE TYPE portal_private.deal_allocation_applicability_enum AS ENUM('DEAL_ALLOCATABLE','NOT_APPLICABLE'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='allocation_review_state_enum') THEN CREATE TYPE portal_private.allocation_review_state_enum AS ENUM('NOT_APPLICABLE','TO_VERIFY','VERIFIED'); END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='portal_private'::regnamespace AND typname='payment_allocation_state_enum') THEN CREATE TYPE portal_private.payment_allocation_state_enum AS ENUM('UNALLOCATED','PARTIAL','ALLOCATED','VERIFIED','REVERSED'); END IF;
END $$;

CREATE TABLE portal_private.clients(id uuid PRIMARY KEY,client_id text NOT NULL UNIQUE);
CREATE TABLE portal_private.contracts(id uuid PRIMARY KEY,contract_id text NOT NULL UNIQUE,client_key uuid REFERENCES portal_private.clients(id));
ALTER TABLE portal_private.deals ADD COLUMN deal_id text;
ALTER TABLE portal_private.deals ADD COLUMN client_key uuid;
ALTER TABLE portal_private.deals ADD COLUMN contract_key uuid;
ALTER TABLE portal_private.deals ADD COLUMN lifecycle_state portal_private.lifecycle_state_enum NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE portal_private.deals ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO portal_private.clients VALUES
('90000000-0000-4000-8000-000000000001','CLIENT-1'),('90000000-0000-4000-8000-000000000002','CLIENT-2'),('90000000-0000-4000-8000-000000000003','CLIENT-3'),('90000000-0000-4000-8000-000000000004','CLIENT-4');
INSERT INTO portal_private.contracts VALUES
('91000000-0000-4000-8000-000000000001','CONTRACT-1','90000000-0000-4000-8000-000000000001'),('91000000-0000-4000-8000-000000000002','CONTRACT-2','90000000-0000-4000-8000-000000000002'),('91000000-0000-4000-8000-000000000003','CONTRACT-3','90000000-0000-4000-8000-000000000003'),('91000000-0000-4000-8000-000000000004','CONTRACT-4','90000000-0000-4000-8000-000000000004');
UPDATE portal_private.deals d SET deal_id=x.deal_id,client_key=x.client_key,contract_key=x.contract_key FROM (VALUES
('10000000-0000-4000-8000-000000000001'::uuid,'DEAL-TEST-1','90000000-0000-4000-8000-000000000001'::uuid,'91000000-0000-4000-8000-000000000001'::uuid),
('10000000-0000-4000-8000-000000000002'::uuid,'DEAL-TEST-2','90000000-0000-4000-8000-000000000002'::uuid,'91000000-0000-4000-8000-000000000002'::uuid),
('10000000-0000-4000-8000-000000000003'::uuid,'DEAL-TEST-3','90000000-0000-4000-8000-000000000003'::uuid,'91000000-0000-4000-8000-000000000003'::uuid),
('10000000-0000-4000-8000-000000000004'::uuid,'DEAL-TEST-4','90000000-0000-4000-8000-000000000004'::uuid,'91000000-0000-4000-8000-000000000004'::uuid)
) x(id,deal_id,client_key,contract_key) WHERE d.id=x.id;

ALTER TABLE portal_private.payments ADD COLUMN payment_id text;
ALTER TABLE portal_private.payments ADD COLUMN bank_transaction_reference text;
ALTER TABLE portal_private.payments ADD COLUMN bank_fact_status portal_private.payment_bank_state_enum NOT NULL DEFAULT 'RECEIVED_UNVERIFIED';
ALTER TABLE portal_private.payments ADD COLUMN payment_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE portal_private.payments ADD COLUMN payer_name text;
ALTER TABLE portal_private.payments ADD COLUMN beneficiary_name text;
ALTER TABLE portal_private.payments ADD COLUMN original_payment_purpose text;
ALTER TABLE portal_private.payments ADD COLUMN finance_status portal_private.finance_state_enum NOT NULL DEFAULT 'DUE';
ALTER TABLE portal_private.payments ADD COLUMN accounting_closure_status portal_private.accounting_closure_state_enum NOT NULL DEFAULT 'OPEN';
ALTER TABLE portal_private.payments ADD COLUMN source_system text;
ALTER TABLE portal_private.payments ADD COLUMN source_version text;
ALTER TABLE portal_private.payments ADD COLUMN source_timestamp timestamptz;
ALTER TABLE portal_private.payments ADD COLUMN authority_state portal_private.authority_state_enum NOT NULL DEFAULT 'SOURCE_RECEIVED';
ALTER TABLE portal_private.payments ADD COLUMN lifecycle_state portal_private.lifecycle_state_enum NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE portal_private.payments ADD COLUMN payment_direction portal_private.payment_direction_enum;
ALTER TABLE portal_private.payments ADD COLUMN payment_kind portal_private.payment_kind_enum;
ALTER TABLE portal_private.payments ADD COLUMN counterparty_name text;
ALTER TABLE portal_private.payments ADD COLUMN counterparty_role text;
ALTER TABLE portal_private.payments ADD COLUMN bank_account_reference text;
ALTER TABLE portal_private.payments ADD COLUMN bank_statement_date date;
ALTER TABLE portal_private.payments ADD COLUMN bank_statement_line_fingerprint text;
ALTER TABLE portal_private.payments ADD COLUMN finance_verification_status portal_private.finance_verification_state_enum;
ALTER TABLE portal_private.payments ADD COLUMN finance_verified_at timestamptz;
ALTER TABLE portal_private.payments ADD COLUMN finance_verification_note text;
ALTER TABLE portal_private.payments ADD COLUMN fx_equivalent_amount numeric;
ALTER TABLE portal_private.payments ADD COLUMN fx_equivalent_currency char(3);
ALTER TABLE portal_private.payments ADD COLUMN fx_rate numeric;
ALTER TABLE portal_private.payments ADD COLUMN fx_source_reference text;
ALTER TABLE portal_private.payments ADD COLUMN deal_allocation_applicability portal_private.deal_allocation_applicability_enum;
ALTER TABLE portal_private.payments ADD COLUMN allocation_review_status portal_private.allocation_review_state_enum;
ALTER TABLE portal_private.payments ADD COLUMN candidate_deal_ids text[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX payments_test_payment_id_uidx ON portal_private.payments(payment_id) WHERE payment_id IS NOT NULL;

ALTER TABLE portal_private.payment_allocations ADD COLUMN client_key uuid;
ALTER TABLE portal_private.payment_allocations ADD COLUMN contract_key uuid;
ALTER TABLE portal_private.payment_allocations ADD COLUMN deal_key uuid;
ALTER TABLE portal_private.payment_allocations ADD COLUMN allocated_amount numeric;
ALTER TABLE portal_private.payment_allocations ADD COLUMN allocation_status portal_private.payment_allocation_state_enum NOT NULL DEFAULT 'UNALLOCATED';
ALTER TABLE portal_private.payment_allocations ADD COLUMN finance_status portal_private.finance_state_enum NOT NULL DEFAULT 'DUE';
ALTER TABLE portal_private.payment_allocations ADD COLUMN accounting_closure_status portal_private.accounting_closure_state_enum NOT NULL DEFAULT 'OPEN';
ALTER TABLE portal_private.payment_allocations ADD COLUMN allocation_reference text;
ALTER TABLE portal_private.payment_allocations ADD COLUMN allocated_at timestamptz;
ALTER TABLE portal_private.payment_allocations ADD COLUMN allocated_by uuid;
ALTER TABLE portal_private.payment_allocations ADD COLUMN source_system text;
ALTER TABLE portal_private.payment_allocations ADD COLUMN source_version text;
ALTER TABLE portal_private.payment_allocations ADD COLUMN source_timestamp timestamptz;
ALTER TABLE portal_private.payment_allocations ADD COLUMN authority_state portal_private.authority_state_enum NOT NULL DEFAULT 'SOURCE_RECEIVED';
ALTER TABLE portal_private.payment_allocations ADD COLUMN lifecycle_state portal_private.lifecycle_state_enum NOT NULL DEFAULT 'ACTIVE';

CREATE OR REPLACE FUNCTION portal_private.resolve_deal_resource_state(p_deal_key uuid)
RETURNS TABLE(resource_status text,resource_source text,resource_confirmed_at timestamptz)
LANGUAGE sql STABLE AS $$ SELECT 'RESOURCE_CONFIRMED'::text,'QA_FIXTURE'::text,now() $$;

\ir ../../supabase/migrations/20260914210000_admin_payments_v7_finance_controlled_write.sql

DO $$ DECLARE r jsonb; c int; BEGIN
 -- CASE 1 + CASE 10: incoming client payment and idempotent replay.
 r:=portal_private.persist_finance_event_v7(
  jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  jsonb_build_object('event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-1','payment_id','FIN-IN-001','effective_at','2026-09-14T18:00:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','BANK_STATEMENT','source_id','STMT-1')),'source_version','QA-V1','source_timestamp','2026-09-14T17:59:00Z','idempotency_key','qa-client-payment-001','payload',jsonb_build_object('amount',25,'currency','USD','bank_transaction_reference','BANK-001','counterparty_name','QA Client')));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'CASE1 rejected: %',r; END IF;
 IF (SELECT count(*) FROM portal_private.payments WHERE payment_id='FIN-IN-001')<>1 OR (SELECT count(*) FROM portal_private.payment_allocations pa JOIN portal_private.payments p ON p.id=pa.payment_key WHERE p.payment_id='FIN-IN-001' AND pa.allocated_amount=25 AND pa.allocation_status='VERIFIED')<>1 THEN RAISE EXCEPTION 'CASE1 payment/allocation missing'; END IF;
 c:=(SELECT count(*) FROM portal_private.finance_events_v7);
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),jsonb_build_object('event_type','CLIENT_PAYMENT_CONFIRMED','deal_id','DEAL-TEST-1','payment_id','FIN-IN-001','effective_at','2026-09-14T18:00:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','BANK_STATEMENT','source_id','STMT-1')),'source_version','QA-V1','source_timestamp','2026-09-14T17:59:00Z','idempotency_key','qa-client-payment-001','payload',jsonb_build_object('amount',25,'currency','USD','bank_transaction_reference','BANK-001','counterparty_name','QA Client')));
 IF coalesce((r->>'idempotent_replay')::boolean,false) IS DISTINCT FROM true OR c<>(SELECT count(*) FROM portal_private.finance_events_v7) OR (SELECT count(*) FROM portal_private.payments WHERE payment_id='FIN-IN-001')<>1 THEN RAISE EXCEPTION 'CASE10 duplicate not idempotent'; END IF;
END $$;

DO $$ DECLARE cur uuid; r jsonb; nextid uuid; BEGIN
 -- CASE 2: new obligation supersedes prior Finance authority.
 SELECT id INTO cur FROM portal_private.deal_finance_authority_v7 WHERE deal_key='10000000-0000-4000-8000-000000000001' ORDER BY created_at DESC LIMIT 1;
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),jsonb_build_object('event_type','DEAL_FINANCIAL_OBLIGATION_CONFIRMED','deal_id','DEAL-TEST-1','expected_current_authority_id',cur,'effective_at','2026-09-14T18:01:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','INVOICE','source_id','INV-2')),'source_version','QA-V2','source_timestamp','2026-09-14T18:00:30Z','idempotency_key','qa-obligation-001','payload',jsonb_build_object('total_to_receive',120,'currency','USD','contractual_payment_currency','USD','finance_status','NOT_DUE')));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'CASE2 rejected: %',r; END IF; nextid:=(r->>'authority_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 WHERE id=nextid AND supersedes_id=cur AND total_to_receive=120) THEN RAISE EXCEPTION 'CASE2 supersession missing'; END IF;
END $$;

DO $$ DECLARE cur uuid; r jsonb; BEGIN
 -- CASE 3: expected receipt remains expected, not due.
 SELECT id INTO cur FROM portal_private.deal_finance_authority_v7 a WHERE deal_key='10000000-0000-4000-8000-000000000001' AND NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 n WHERE n.supersedes_id=a.id) LIMIT 1;
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc'),jsonb_build_object('event_type','DEAL_PAYMENT_SCHEDULE_CONFIRMED','deal_id','DEAL-TEST-1','expected_current_authority_id',cur,'effective_at','2026-09-14T18:02:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','ADDENDUM','source_id','DS-1')),'source_version','QA-V3','source_timestamp','2026-09-14T18:01:30Z','idempotency_key','qa-schedule-001','payload',jsonb_build_object('due_now',0,'expected_not_due',80,'future_conditional',20,'finance_status','NOT_DUE')));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 WHERE id=(r->>'authority_id')::uuid AND due_now=0 AND expected_not_due=80 AND future_conditional=20) THEN RAISE EXCEPTION 'CASE3 failed: %',r; END IF;
END $$;

DO $$ DECLARE cur uuid; stale uuid; r jsonb; before_count int; BEGIN
 -- CASE 4: Finance-confirmed trigger moves expected to due.
 SELECT id INTO cur FROM portal_private.deal_finance_authority_v7 a WHERE deal_key='10000000-0000-4000-8000-000000000001' AND NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 n WHERE n.supersedes_id=a.id) LIMIT 1; stale:=cur;
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','dddddddd-dddd-4ddd-8ddd-dddddddddddd'),jsonb_build_object('event_type','PAYMENT_TRIGGER_CONFIRMED','deal_id','DEAL-TEST-1','expected_current_authority_id',cur,'effective_at','2026-09-14T18:03:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','FINANCE_TRIGGER','source_id','TRIGGER-1')),'source_version','QA-V4','source_timestamp','2026-09-14T18:02:30Z','idempotency_key','qa-trigger-001','payload',jsonb_build_object('due_now',80,'expected_not_due',0,'future_conditional',20,'finance_status','DUE','trigger_state','TRIGGER_CONFIRMED')));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 WHERE id=(r->>'authority_id')::uuid AND due_now=80 AND expected_not_due=0) THEN RAISE EXCEPTION 'CASE4 failed: %',r; END IF;
 -- CASE 9: stale authority is rejected and no new authority appears.
 before_count:=(SELECT count(*) FROM portal_private.deal_finance_authority_v7);
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),jsonb_build_object('event_type','DOCUMENTARY_STATUS_CONFIRMED','deal_id','DEAL-TEST-1','expected_current_authority_id',stale,'effective_at','2026-09-14T18:04:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','DOC_REVIEW','source_id','DOC-1')),'source_version','QA-V9','source_timestamp','2026-09-14T18:03:30Z','idempotency_key','qa-stale-001','payload',jsonb_build_object('documentary_status','CONFIRMED')));
 IF r->>'reason_code'<>'STALE_AUTHORITY' OR before_count<>(SELECT count(*) FROM portal_private.deal_finance_authority_v7) THEN RAISE EXCEPTION 'CASE9 stale write accepted: %',r; END IF;
END $$;

DO $$ DECLARE r jsonb; attr uuid; BEGIN
 -- CASE 5: outgoing payment in accounting currency has exact authoritative attribution.
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','f1111111-1111-4111-8111-111111111111'),jsonb_build_object('event_type','OUTGOING_PAYMENT_CONFIRMED','payment_id','FIN-OUT-USD-1','effective_at','2026-09-14T18:05:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','PAYMENT_ORDER','source_id','PO-USD-1')),'source_version','QA-V5','source_timestamp','2026-09-14T18:04:30Z','idempotency_key','qa-outgoing-usd-001','payload',jsonb_build_object('amount',20,'currency','USD','payment_kind','COUNTERPARTY_PAYMENT','bank_transaction_reference','BANK-OUT-USD-1','beneficiary','QA Supplier','attribution_mode','EXACT','lines',jsonb_build_array(jsonb_build_object('deal_id','DEAL-TEST-2','amount',20)))));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'CASE5 rejected: %',r; END IF; attr:=(r->>'attribution_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM portal_private.payment_business_attribution_lines_v7 WHERE attribution_id=attr AND deal_key='10000000-0000-4000-8000-000000000002' AND amount=20 AND currency='USD') THEN RAISE EXCEPTION 'CASE5 exact spend attribution missing'; END IF;
END $$;

DO $$ DECLARE r jsonb; payment_key uuid; BEGIN
 -- CASE 6: cross-currency outgoing gets exact Finance resource chain; no synthetic FX.
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','f2222222-2222-4222-8222-222222222222'),jsonb_build_object('event_type','OUTGOING_PAYMENT_CONFIRMED','payment_id','FIN-OUT-RUB-1','effective_at','2026-09-14T18:06:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','PAYMENT_ORDER','source_id','PO-RUB-1')),'source_version','QA-V6A','source_timestamp','2026-09-14T18:05:30Z','idempotency_key','qa-outgoing-rub-001','payload',jsonb_build_object('amount',100,'currency','RUB','payment_kind','COUNTERPARTY_PAYMENT','bank_transaction_reference','BANK-OUT-RUB-1','beneficiary','QA Supplier RUB','attribution_mode','EXACT','lines',jsonb_build_array(jsonb_build_object('deal_id','DEAL-TEST-1','amount',100)))));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'CASE6A rejected: %',r; END IF; payment_key:=(r->>'payment_key')::uuid;
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','f3333333-3333-4333-8333-333333333333'),jsonb_build_object('event_type','PAYMENT_RESOURCE_CHAIN_CONFIRMED','deal_id','DEAL-TEST-1','payment_id','FIN-OUT-RUB-1','effective_at','2026-09-14T18:07:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','FINANCE_RESOURCE_CHAIN','source_id','CHAIN-1')),'source_version','QA-V6B','source_timestamp','2026-09-14T18:06:30Z','idempotency_key','qa-resource-chain-001','payload',jsonb_build_object('native_amount',100,'native_currency','RUB','accounting_amount',1,'accounting_currency','USD','conversion_source_basis','ACTUAL_SETTLEMENT_FACT')));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM portal_private.payment_resource_chains_v7 WHERE payment_key=payment_key AND native_amount=100 AND native_currency='RUB' AND accounting_amount=1 AND accounting_currency='USD') THEN RAISE EXCEPTION 'CASE6 resource chain failed: %',r; END IF;
END $$;

DO $$ DECLARE r jsonb; current_attr uuid; BEGIN
 -- CASE 7: known two-Deal scope without split stays SCOPE_ONLY / TO_VERIFY semantics.
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','f4444444-4444-4444-8444-444444444444'),jsonb_build_object('event_type','OUTGOING_PAYMENT_CONFIRMED','payment_id','FIN-OUT-SHARED-1','effective_at','2026-09-14T18:08:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','PAYMENT_ORDER','source_id','PO-SHARED-1')),'source_version','QA-V7','source_timestamp','2026-09-14T18:07:30Z','idempotency_key','qa-shared-scope-001','payload',jsonb_build_object('amount',100,'currency','USD','payment_kind','COUNTERPARTY_PAYMENT','bank_transaction_reference','BANK-SHARED-1','beneficiary','QA Shared Supplier','attribution_mode','SCOPE_ONLY','scope_deal_ids',jsonb_build_array('DEAL-TEST-3','DEAL-TEST-4'))));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true THEN RAISE EXCEPTION 'CASE7 rejected: %',r; END IF; current_attr:=(r->>'attribution_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM portal_private.payment_business_attributions_v7 WHERE id=current_attr AND attribution_mode='SCOPE_ONLY' AND jsonb_array_length(lines_snapshot)=0 AND cardinality(scope_deal_keys)=2) THEN RAISE EXCEPTION 'CASE7 synthetic split appeared'; END IF;
 -- CASE 8: exact split later supersedes scope authority.
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','f5555555-5555-4555-8555-555555555555'),jsonb_build_object('event_type','OUTGOING_PAYMENT_DEAL_ALLOCATION_CONFIRMED','payment_id','FIN-OUT-SHARED-1','expected_current_authority_id',current_attr,'effective_at','2026-09-14T18:09:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','FINANCE_ALLOCATION','source_id','SPLIT-1')),'source_version','QA-V8','source_timestamp','2026-09-14T18:08:30Z','idempotency_key','qa-shared-split-001','payload',jsonb_build_object('attribution_mode','EXACT','lines',jsonb_build_array(jsonb_build_object('deal_id','DEAL-TEST-3','amount',60),jsonb_build_object('deal_id','DEAL-TEST-4','amount',40)))));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM portal_private.payment_business_attributions_v7 WHERE id=(r->>'attribution_id')::uuid AND supersedes_id=current_attr AND attribution_mode='EXACT') THEN RAISE EXCEPTION 'CASE8 exact split failed: %',r; END IF;
END $$;

DO $$ DECLARE cur uuid; r jsonb; BEGIN
 -- Documentary status is a Finance authority event and never a portal document parser decision.
 SELECT id INTO cur FROM portal_private.deal_finance_authority_v7 a WHERE deal_key='10000000-0000-4000-8000-000000000002' AND NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 n WHERE n.supersedes_id=a.id) LIMIT 1;
 r:=portal_private.persist_finance_event_v7(jsonb_build_object('role','FINANCE','identity_id','AI-FINANCE','correlation_id','f6666666-6666-4666-8666-666666666666'),jsonb_build_object('event_type','DOCUMENTARY_STATUS_CONFIRMED','deal_id','DEAL-TEST-2','expected_current_authority_id',cur,'effective_at','2026-09-14T18:10:00Z','source_refs',jsonb_build_array(jsonb_build_object('source_type','FINANCE_DOCUMENT_REVIEW','source_id','DOC-2')),'source_version','QA-DOC','source_timestamp','2026-09-14T18:09:30Z','idempotency_key','qa-documentary-001','payload',jsonb_build_object('documentary_status','CONFIRMED')));
 IF coalesce((r->>'accepted')::boolean,false) IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM portal_private.deal_finance_authority_v7 WHERE id=(r->>'authority_id')::uuid AND documentary_status='CONFIRMED') THEN RAISE EXCEPTION 'DOCUMENTARY event failed: %',r; END IF;
END $$;

DO $$ BEGIN
 IF has_function_privilege('anon','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE') OR has_function_privilege('authenticated','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE') OR has_function_privilege('service_role','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE') OR has_function_privilege('rona_payments_v7_reader','portal_private.persist_finance_event_v7(jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Finance controlled write privilege leak'; END IF;
 IF NOT EXISTS(SELECT 1 FROM portal_private.admin_payments_v7_provider_readiness WHERE provider_key='PAYMENT_RESOURCE_CHAIN_AUTHORITY' AND is_ready=true) THEN RAISE EXCEPTION 'resource-chain provider readiness missing'; END IF;
 IF EXISTS(SELECT 1 FROM portal_private.finance_events_v7 WHERE actor_role<>'FINANCE' OR actor_id<>'AI-FINANCE') THEN RAISE EXCEPTION 'role binding audit mismatch'; END IF;
END $$;

\echo 'FINANCE CONTROLLED WRITE PASS — CASES 1-10 + documentary authority'
\echo 'NO SYNTHETIC FX PASS — resource chain requires Finance actual settlement basis'
\echo 'ROLE BINDING / IDEMPOTENCY / STALE / IMMUTABILITY CONTRACT PASS'
