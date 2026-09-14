\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS portal_private CASCADE;
CREATE SCHEMA portal_private;

CREATE TABLE portal_private.deals (
  id uuid PRIMARY KEY
);

CREATE TABLE portal_private.payments (
  id uuid PRIMARY KEY,
  amount numeric(24,8) NOT NULL,
  currency char(3) NOT NULL
);

INSERT INTO portal_private.deals(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
INSERT INTO portal_private.payments(id,amount,currency) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100,'USD'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',50,'USD');

\ir ../../supabase/migrations/20260913143000_admin_payments_v7_stage3a_authority.sql

CREATE OR REPLACE FUNCTION public.stage3c_expect_error(label text, command text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE failed boolean := false;
BEGIN
  BEGIN
    EXECUTE command;
  EXCEPTION WHEN OTHERS THEN
    failed := true;
  END;
  IF NOT failed THEN
    RAISE EXCEPTION 'expected failure not raised: %', label;
  END IF;
END $$;

INSERT INTO portal_private.payment_business_attributions_v7(
  id,payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,
  effective_at,idempotency_key,source_locked
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'KNOWN_MULTI_DEAL_EXACT_SPLIT','EXACT','OWNER',
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid],
  '[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"60","currency":"USD","amount_status":"EXACT"},{"deal_key":"22222222-2222-4222-8222-222222222222","amount":"40","currency":"USD","amount_status":"EXACT"}]'::jsonb,
  now(),'valid-exact',true
);

DO $$
DECLARE c int; s numeric;
BEGIN
  SELECT count(*),sum(amount) INTO c,s
  FROM portal_private.payment_business_attribution_lines_v7
  WHERE attribution_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  IF c<>2 OR s<>100 THEN RAISE EXCEPTION 'valid exact aggregate expansion failed'; END IF;
END $$;

SELECT public.stage3c_expect_error('header update immutable', $q$
  UPDATE portal_private.payment_business_attributions_v7 SET classification='RESOLVED'
  WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
$q$);
SELECT public.stage3c_expect_error('header delete immutable', $q$
  DELETE FROM portal_private.payment_business_attributions_v7
  WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
$q$);
SELECT public.stage3c_expect_error('late child insert forbidden', $q$
  INSERT INTO portal_private.payment_business_attribution_lines_v7(attribution_id,deal_key,amount,currency,amount_status)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111',1,'USD','EXACT')
$q$);

SELECT public.stage3c_expect_error('partial exact coverage', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RESOLVED','EXACT','OWNER',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
    '[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"60","currency":"USD","amount_status":"EXACT"}]'::jsonb,
    now(),'partial-exact'
  )
$q$);
SELECT public.stage3c_expect_error('over exact coverage', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RESOLVED','EXACT','OWNER',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
    '[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"110","currency":"USD","amount_status":"EXACT"}]'::jsonb,
    now(),'over-exact'
  )
$q$);
SELECT public.stage3c_expect_error('wrong exact currency', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RESOLVED','EXACT','OWNER',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
    '[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"100","currency":"EUR","amount_status":"EXACT"}]'::jsonb,
    now(),'wrong-currency'
  )
$q$);
SELECT public.stage3c_expect_error('duplicate exact deal', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','KNOWN_MULTI_DEAL_EXACT_SPLIT','EXACT','OWNER',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
    '[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"},{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}]'::jsonb,
    now(),'duplicate-deal'
  )
$q$);
SELECT public.stage3c_expect_error('mixed exact scope line mode', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RESOLVED','EXACT','OWNER',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
    '[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"100","currency":"USD","amount_status":"SCOPE_ONLY"}]'::jsonb,
    now(),'mixed-mode'
  )
$q$);

INSERT INTO portal_private.payment_business_attributions_v7(
  id,payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,
  effective_at,idempotency_key,source_locked
) VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY','SCOPE_ONLY','OWNER',
  ARRAY['11111111-1111-4111-8111-111111111111'::uuid,'22222222-2222-4222-8222-222222222222'::uuid],
  '[]'::jsonb,now(),'valid-scope',true
);
SELECT public.stage3c_expect_error('late scope expansion forbidden', $q$
  UPDATE portal_private.payment_business_attributions_v7
  SET scope_deal_keys=ARRAY['11111111-1111-4111-8111-111111111111'::uuid]
  WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
$q$);

-- AN — impossible decision/mode combinations are rejected by the database itself.
SELECT public.stage3c_expect_error('BIND requires EXACT', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,decision_type,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SHARED_DEAL_SCOPE_SPLIT_TO_VERIFY','SCOPE_ONLY','BIND_TO_DEAL','OWNER',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],'[]'::jsonb,now(),'invalid-bind-scope'
  )
$q$);
SELECT public.stage3c_expect_error('ADVANCE requires NO_DEAL_BINDING', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,decision_type,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RONA_ADVANCE_DEAL_SPEND','EXACT','ASSIGN_ADVANCE_PAYMENT','OWNER',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],
    '[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"100","currency":"USD","amount_status":"EXACT"}]'::jsonb,
    now(),'invalid-advance-exact'
  )
$q$);
SELECT public.stage3c_expect_error('NO_DEAL_BINDING reserved for Owner advance', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RONA_ADVANCE_DEAL_SPEND','NO_DEAL_BINDING','SYSTEM',ARRAY[]::uuid[],'[]'::jsonb,now(),'invalid-system-no-bind'
  )
$q$);
SELECT public.stage3c_expect_error('scope-only cannot claim resolved exact class', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','RESOLVED','SCOPE_ONLY','SYSTEM',
    ARRAY['11111111-1111-4111-8111-111111111111'::uuid],'[]'::jsonb,now(),'invalid-scope-resolved'
  )
$q$);

-- AO — the DB function owns transaction serialization, optimistic lock, idempotency and audit.
SELECT portal_private.persist_owner_payment_decision_v7(
  NULL,
  '{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","classification":"RESOLVED","attribution_mode":"EXACT","decision_type":"BIND_TO_DEAL","authority_kind":"OWNER","authority_source_ref":"OWNER_PAYMENT_DECISION:ffffffff-ffff-4fff-8fff-ffffffffffff","business_scope_refs":[],"scope_deal_keys":["11111111-1111-4111-8111-111111111111"],"lines_snapshot":[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}],"materialization_status":"NOT_MATERIALIZED","authority_state":"AUTHORITATIVE","lifecycle_state":"CURRENT","effective_at":"2026-09-13T14:00:00Z","supersedes_id":null,"supersedes_authority_refs":[],"source_version":"OWNER_ACTION_V7","source_timestamp":"2026-09-13T14:00:00Z","source_refs":["OWNER_REQUEST:AO"],"source_locked":true,"actor_id":"owner-ao","actor_role":"OWNER","idempotency_key":"ao-bind-1"}'::jsonb,
  '{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","event_type":"OWNER_PAYMENT_DECISION","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","action":"BIND_TO_DEAL","actor_id":"owner-ao","actor_role":"OWNER","expected_current_authority_id":null,"expected_current_authority_ref":null,"resulting_authority_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","effective_at":"2026-09-13T14:00:00Z","idempotency_key":"ao-bind-1","request_fingerprint":"ao-bind-1","request_snapshot":{"payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","action":"BIND_TO_DEAL","expected_current_authority_id":null,"scope_deal_keys":["11111111-1111-4111-8111-111111111111"],"lines_snapshot":[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}],"idempotency_key":"ao-bind-1"},"previous_authority_snapshot":null,"current_reconciliation_snapshot":{"reconciliation_class":"GENUINELY_UNALLOCATED"},"resulting_authority_snapshot":{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","decision_type":"BIND_TO_DEAL","attribution_mode":"EXACT"}}'::jsonb
);

DO $$
DECLARE ac int; qc int;
BEGIN
  SELECT count(*) INTO ac FROM portal_private.payment_business_attributions_v7 WHERE payment_key='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  SELECT count(*) INTO qc FROM portal_private.owner_payment_decision_audit_v7 WHERE payment_key='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  IF ac<>1 OR qc<>1 THEN RAISE EXCEPTION 'AO initial atomic insert/audit failed'; END IF;
END $$;

-- Identical replay returns the existing authority and does not duplicate either table.
SELECT portal_private.persist_owner_payment_decision_v7(
  NULL,
  '{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","classification":"RESOLVED","attribution_mode":"EXACT","decision_type":"BIND_TO_DEAL","authority_kind":"OWNER","authority_source_ref":"OWNER_PAYMENT_DECISION:ffffffff-ffff-4fff-8fff-ffffffffffff","business_scope_refs":[],"scope_deal_keys":["11111111-1111-4111-8111-111111111111"],"lines_snapshot":[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}],"materialization_status":"NOT_MATERIALIZED","authority_state":"AUTHORITATIVE","lifecycle_state":"CURRENT","effective_at":"2026-09-13T14:00:00Z","supersedes_id":null,"supersedes_authority_refs":[],"source_version":"OWNER_ACTION_V7","source_timestamp":"2026-09-13T14:00:00Z","source_refs":["OWNER_REQUEST:AO"],"source_locked":true,"actor_id":"owner-ao","actor_role":"OWNER","idempotency_key":"ao-bind-1"}'::jsonb,
  '{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","event_type":"OWNER_PAYMENT_DECISION","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","action":"BIND_TO_DEAL","actor_id":"owner-ao","actor_role":"OWNER","expected_current_authority_id":null,"expected_current_authority_ref":null,"resulting_authority_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","effective_at":"2026-09-13T14:00:00Z","idempotency_key":"ao-bind-1","request_fingerprint":"ao-bind-1","request_snapshot":{"payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","action":"BIND_TO_DEAL","expected_current_authority_id":null,"scope_deal_keys":["11111111-1111-4111-8111-111111111111"],"lines_snapshot":[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}],"idempotency_key":"ao-bind-1"},"previous_authority_snapshot":null,"current_reconciliation_snapshot":{"reconciliation_class":"GENUINELY_UNALLOCATED"},"resulting_authority_snapshot":{"id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","decision_type":"BIND_TO_DEAL","attribution_mode":"EXACT"}}'::jsonb
);

DO $$
DECLARE ac int; qc int;
BEGIN
  SELECT count(*) INTO ac FROM portal_private.payment_business_attributions_v7 WHERE payment_key='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  SELECT count(*) INTO qc FROM portal_private.owner_payment_decision_audit_v7 WHERE payment_key='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  IF ac<>1 OR qc<>1 THEN RAISE EXCEPTION 'AO idempotent replay duplicated persistence'; END IF;
END $$;

SELECT public.stage3c_expect_error('same idempotency different request rejected', $q$
  SELECT portal_private.persist_owner_payment_decision_v7(
    NULL,
    '{"id":"abababab-abab-4aba-8aba-abababababab","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","classification":"RESOLVED","attribution_mode":"EXACT","decision_type":"BIND_TO_DEAL","authority_kind":"OWNER","business_scope_refs":[],"scope_deal_keys":["11111111-1111-4111-8111-111111111111"],"lines_snapshot":[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}],"effective_at":"2026-09-13T14:01:00Z","source_locked":true,"actor_id":"owner-ao","actor_role":"OWNER","idempotency_key":"ao-bind-1"}'::jsonb,
    '{"id":"12121212-1212-4212-8212-121212121212","event_type":"OWNER_PAYMENT_DECISION","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","action":"BIND_TO_DEAL","actor_id":"owner-ao","actor_role":"OWNER","resulting_authority_id":"abababab-abab-4aba-8aba-abababababab","idempotency_key":"ao-bind-1","request_snapshot":{"changed":true},"resulting_authority_snapshot":{"id":"abababab-abab-4aba-8aba-abababababab"}}'::jsonb
  )
$q$);

-- Force an audit primary-key failure after the new authority INSERT. The function statement must roll
-- back the authority insert as well, proving atomicity rather than best-effort two-step persistence.
SELECT public.stage3c_expect_error('authority insert rolls back if audit insert fails', $q$
  SELECT portal_private.persist_owner_payment_decision_v7(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
    '{"id":"99999999-9999-4999-8999-999999999999","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","classification":"RESOLVED","attribution_mode":"EXACT","decision_type":"BIND_TO_DEAL","authority_kind":"OWNER","business_scope_refs":[],"scope_deal_keys":["11111111-1111-4111-8111-111111111111"],"lines_snapshot":[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}],"materialization_status":"NOT_MATERIALIZED","authority_state":"AUTHORITATIVE","lifecycle_state":"CURRENT","effective_at":"2026-09-13T14:02:00Z","supersedes_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","supersedes_authority_refs":[{"source_type":"OWNER","source_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}],"source_locked":true,"actor_id":"owner-ao","actor_role":"OWNER","idempotency_key":"ao-atomic-fail"}'::jsonb,
    '{"id":"ffffffff-ffff-4fff-8fff-ffffffffffff","event_type":"OWNER_PAYMENT_DECISION","payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","action":"BIND_TO_DEAL","actor_id":"owner-ao","actor_role":"OWNER","expected_current_authority_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","resulting_authority_id":"99999999-9999-4999-8999-999999999999","effective_at":"2026-09-13T14:02:00Z","idempotency_key":"ao-atomic-fail","request_fingerprint":"ao-atomic-fail","request_snapshot":{"payment_key":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","action":"BIND_TO_DEAL","expected_current_authority_id":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","scope_deal_keys":["11111111-1111-4111-8111-111111111111"],"lines_snapshot":[{"deal_key":"11111111-1111-4111-8111-111111111111","amount":"50","currency":"USD","amount_status":"EXACT"}],"idempotency_key":"ao-atomic-fail"},"resulting_authority_snapshot":{"id":"99999999-9999-4999-8999-999999999999"}}'::jsonb
  )
$q$);

DO $$
DECLARE ac int; qc int;
BEGIN
  SELECT count(*) INTO ac FROM portal_private.payment_business_attributions_v7 WHERE payment_key='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  SELECT count(*) INTO qc FROM portal_private.owner_payment_decision_audit_v7 WHERE payment_key='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  IF ac<>1 OR qc<>1 THEN RAISE EXCEPTION 'AO failed statement was not atomic'; END IF;
  IF EXISTS (SELECT 1 FROM portal_private.payment_business_attributions_v7 WHERE id='99999999-9999-4999-8999-999999999999') THEN RAISE EXCEPTION 'AO orphan authority survived audit failure'; END IF;
END $$;

SELECT public.stage3c_expect_error('audit immutable', $q$
  UPDATE portal_private.owner_payment_decision_audit_v7 SET actor_role='ADMIN'
  WHERE id='ffffffff-ffff-4fff-8fff-ffffffffffff'
$q$);

INSERT INTO portal_private.deal_finance_authority_v7(
  deal_key,total_to_receive,due_now,expected_not_due,future_conditional,obligation_currency,
  contractual_payment_currency,finance_status,documentary_status,effective_at,source_locked
) VALUES (
  '11111111-1111-4111-8111-111111111111',100,0,60,40,'USD','USD','NOT_DUE','TO_VERIFY',now(),true
);
SELECT public.stage3c_expect_error('finance bucket sum over total', $q$
  INSERT INTO portal_private.deal_finance_authority_v7(
    deal_key,total_to_receive,due_now,expected_not_due,future_conditional,obligation_currency,
    contractual_payment_currency,finance_status,documentary_status,effective_at,source_locked
  ) VALUES (
    '22222222-2222-4222-8222-222222222222',100,60,50,0,'USD','USD','TO_VERIFY','TO_VERIFY',now(),true
  )
$q$);
SELECT public.stage3c_expect_error('finance negative bucket', $q$
  INSERT INTO portal_private.deal_finance_authority_v7(
    deal_key,total_to_receive,due_now,expected_not_due,future_conditional,obligation_currency,
    contractual_payment_currency,finance_status,documentary_status,effective_at,source_locked
  ) VALUES (
    '22222222-2222-4222-8222-222222222222',100,-1,0,0,'USD','USD','TO_VERIFY','TO_VERIFY',now(),true
  )
$q$);

\echo 'AH PASS — payment authority aggregate immutable after commit'
\echo 'AI PASS — exact attribution rejects partial/over/wrong-currency/duplicate/mixed coverage'
\echo 'AJ-DB PASS — Finance authority DB constraints reject internally invalid records'
\echo 'AN PASS — impossible Owner decision/attribution-mode combinations rejected by DB'
\echo 'AO PASS — Owner decision persistence atomic, optimistic, idempotent and immutably audited'
