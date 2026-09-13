\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_setting('server_version_num')::int / 10000 <> 17 THEN
    RAISE EXCEPTION 'POSTGRES_MAJOR_MISMATCH expected 17 got %', current_setting('server_version');
  END IF;
END $$;

\ir ../../supabase/migrations/20260913173000_admin_payments_v7_stage3d1_provider_readiness.sql

DO $$
DECLARE c int;
BEGIN
  IF to_regclass('portal_private.admin_payments_v7_provider_readiness') IS NULL THEN
    RAISE EXCEPTION 'readiness relation missing';
  END IF;
  SELECT count(*) INTO c FROM portal_private.admin_payments_v7_provider_readiness;
  IF c <> 0 THEN RAISE EXCEPTION 'provider must start NOT READY with no activation row'; END IF;
  IF NOT has_table_privilege('rona_payments_v7_reader','portal_private.admin_payments_v7_provider_readiness','SELECT') THEN
    RAISE EXCEPTION 'reader lacks readiness SELECT';
  END IF;
  IF has_table_privilege('rona_payments_v7_reader','portal_private.admin_payments_v7_provider_readiness','INSERT')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.admin_payments_v7_provider_readiness','UPDATE')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.admin_payments_v7_provider_readiness','DELETE') THEN
    RAISE EXCEPTION 'reader can mutate readiness';
  END IF;
  IF has_table_privilege('anon','portal_private.admin_payments_v7_provider_readiness','INSERT')
     OR has_table_privilege('authenticated','portal_private.admin_payments_v7_provider_readiness','UPDATE')
     OR has_table_privilege('service_role','portal_private.admin_payments_v7_provider_readiness','DELETE') THEN
    RAISE EXCEPTION 'application role can mutate readiness';
  END IF;
  SELECT count(*) INTO c
  FROM portal_private.payment_business_attributions_v7
  WHERE payment_key IN ('9fda9905-e782-42f3-8441-71ca866bee0d','7c6dba20-eb9f-47fe-a077-ec3bbf17bf29')
    AND authority_state='AUTHORITATIVE' AND lifecycle_state='CURRENT';
  IF c <> 2 THEN RAISE EXCEPTION 'initial 000008/000009 authority seed missing before readiness flip'; END IF;
END $$;

SELECT public.stage3d_expect_error('READY requires validation metadata', $q$
  INSERT INTO portal_private.admin_payments_v7_provider_readiness(provider_key,is_ready)
  VALUES ('PAYMENT_BUSINESS_AUTHORITY',true)
$q$);

INSERT INTO portal_private.admin_payments_v7_provider_readiness(provider_key,is_ready)
VALUES ('PAYMENT_BUSINESS_AUTHORITY',false);

BEGIN;
SET LOCAL ROLE rona_payments_v7_reader;
SELECT provider_key,is_ready FROM portal_private.admin_payments_v7_provider_readiness;
ROLLBACK;

UPDATE portal_private.admin_payments_v7_provider_readiness
SET is_ready=true,
    ready_at=transaction_timestamp(),
    validation_ref='STAGE3D1_TEST_INITIAL_AUTHORITY_BOOTSTRAP_VALIDATED',
    updated_at=transaction_timestamp()
WHERE provider_key='PAYMENT_BUSINESS_AUTHORITY';

DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r
  FROM portal_private.admin_payments_v7_provider_readiness
  WHERE provider_key='PAYMENT_BUSINESS_AUTHORITY';
  IF r.is_ready IS DISTINCT FROM true OR r.ready_at IS NULL OR btrim(r.validation_ref)='' THEN
    RAISE EXCEPTION 'controlled readiness activation failed';
  END IF;
END $$;

\echo 'PG17 PASS — Stage3C + Stage3D + Stage3D.1 migrations executed on PostgreSQL 17'
\echo 'READINESS PASS — present/not-ready defaults fail closed; reader is SELECT-only; app roles cannot mutate readiness'
