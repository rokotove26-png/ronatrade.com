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
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',100,'USD');

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
