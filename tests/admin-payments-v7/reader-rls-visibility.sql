\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS portal_private CASCADE;
CREATE SCHEMA portal_private;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='rona_payments_v7_reader') THEN
    CREATE ROLE rona_payments_v7_reader NOLOGIN NOINHERIT;
  END IF;
END $$;

CREATE TABLE portal_private.payments (
  id uuid PRIMARY KEY,
  amount numeric NOT NULL,
  currency text NOT NULL
);
CREATE TABLE portal_private.payment_allocations (
  id uuid PRIMARY KEY,
  payment_key uuid NOT NULL
);
CREATE TABLE portal_private.payment_allocation_authority_history_v1 (
  payment_key uuid NOT NULL,
  old_allocation_id uuid,
  new_allocation_id uuid
);

ALTER TABLE portal_private.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_private.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_private.payment_allocation_authority_history_v1 ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA portal_private TO rona_payments_v7_reader;
GRANT SELECT ON TABLE
  portal_private.payments,
  portal_private.payment_allocations,
  portal_private.payment_allocation_authority_history_v1
  TO rona_payments_v7_reader;

INSERT INTO portal_private.payments(id,amount,currency)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'USD');
INSERT INTO portal_private.payment_allocations(id,payment_key)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO portal_private.payment_allocation_authority_history_v1(payment_key,old_allocation_id,new_allocation_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Reproduce the production blocker: SELECT grant + RLS + no reader policy silently yields zero rows.
BEGIN;
SET LOCAL ROLE rona_payments_v7_reader;
DO $$
BEGIN
  IF (SELECT count(*) FROM portal_private.payments) <> 0 THEN RAISE EXCEPTION 'pre-fix payments must be hidden by RLS'; END IF;
  IF (SELECT count(*) FROM portal_private.payment_allocations) <> 0 THEN RAISE EXCEPTION 'pre-fix allocations must be hidden by RLS'; END IF;
  IF (SELECT count(*) FROM portal_private.payment_allocation_authority_history_v1) <> 0 THEN RAISE EXCEPTION 'pre-fix allocation history must be hidden by RLS'; END IF;
END $$;
ROLLBACK;

\ir ../../supabase/migrations/20260914012000_admin_payments_v7_reader_rls_visibility.sql

BEGIN;
SET LOCAL ROLE rona_payments_v7_reader;
DO $$
BEGIN
  IF (SELECT count(*) FROM portal_private.payments) <> 1 THEN RAISE EXCEPTION 'payments not visible after reader policy'; END IF;
  IF (SELECT count(*) FROM portal_private.payment_allocations) <> 1 THEN RAISE EXCEPTION 'allocations not visible after reader policy'; END IF;
  IF (SELECT count(*) FROM portal_private.payment_allocation_authority_history_v1) <> 1 THEN RAISE EXCEPTION 'allocation history not visible after reader policy'; END IF;
END $$;
ROLLBACK;

DO $$
BEGIN
  IF has_table_privilege('rona_payments_v7_reader','portal_private.payments','INSERT')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.payments','UPDATE')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.payments','DELETE')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.payment_allocations','INSERT')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.payment_allocations','UPDATE')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.payment_allocations','DELETE') THEN
    RAISE EXCEPTION 'reader mutation privilege detected';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='portal_private' AND tablename='payments'
      AND policyname='admin_payments_v7_reader_payments_select'
      AND cmd='SELECT' AND 'rona_payments_v7_reader'=ANY(roles)
  ) THEN RAISE EXCEPTION 'payments reader SELECT policy missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='portal_private' AND tablename='payment_allocations'
      AND policyname='admin_payments_v7_reader_payment_allocations_select'
      AND cmd='SELECT' AND 'rona_payments_v7_reader'=ANY(roles)
  ) THEN RAISE EXCEPTION 'allocations reader SELECT policy missing'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='portal_private' AND tablename='payment_allocation_authority_history_v1'
      AND policyname='admin_payments_v7_reader_allocation_history_select'
      AND cmd='SELECT' AND 'rona_payments_v7_reader'=ANY(roles)
  ) THEN RAISE EXCEPTION 'allocation history reader SELECT policy missing'; END IF;
END $$;

\echo 'PAYMENTS_V7_READER_RLS_VISIBILITY=PASS'
\echo 'PAYMENTS_V7_READER_MUTATION_PRIVILEGES=NONE'
