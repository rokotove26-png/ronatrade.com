\set ON_ERROR_STOP on

DROP SCHEMA IF EXISTS portal_private CASCADE;
CREATE SCHEMA portal_private;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE TABLE portal_private.deals (id uuid PRIMARY KEY);
CREATE TABLE portal_private.payments (id uuid PRIMARY KEY, amount numeric(24,8) NOT NULL, currency char(3) NOT NULL);
CREATE TABLE portal_private.owner_deal_workflow (deal_key uuid);
CREATE TABLE portal_private.clients (id uuid);
CREATE TABLE portal_private.contracts (id uuid);
CREATE TABLE portal_private.payment_allocations (id uuid);
CREATE TABLE portal_private.payment_allocation_authority_history_v1 (payment_key uuid);
CREATE TABLE portal_private.owner_outgoing_payment_facts (id uuid);

INSERT INTO portal_private.deals(id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO portal_private.payments(id,amount,currency) VALUES
  ('9fda9905-e782-42f3-8441-71ca866bee0d',3644000,'RUB'),
  ('7c6dba20-eb9f-47fe-a077-ec3bbf17bf29',3000,'RUB');

\ir ../../supabase/migrations/20260913143000_admin_payments_v7_stage3a_authority.sql
\ir ../../supabase/migrations/20260913160000_admin_payments_v7_stage3d_activation_gate.sql

CREATE OR REPLACE FUNCTION public.stage3d_expect_error(label text, command text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE failed boolean := false;
BEGIN
  BEGIN EXECUTE command;
  EXCEPTION WHEN OTHERS THEN failed := true;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'expected failure not raised: %', label; END IF;
END $$;

-- AQ DB contract: high-level Owner allocation truth without a fake Deal is representable.
INSERT INTO portal_private.payment_business_attributions_v7(
  id,payment_key,classification,attribution_mode,decision_type,authority_kind,authority_source_ref,
  business_scope_refs,scope_deal_keys,lines_snapshot,materialization_status,authority_state,lifecycle_state,
  effective_at,source_version,source_timestamp,source_refs,source_locked,idempotency_key
) VALUES (
  '11111111-aaaa-4111-8111-111111111111',
  '9fda9905-e782-42f3-8441-71ca866bee0d',
  'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED','SCOPE_ONLY',NULL,'OWNER_CANON',
  'OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION',
  ARRAY['OWNER_ASSERTION:PAYEV-2026-000008:BUSINESS_ALLOCATION_KNOWN'],ARRAY[]::uuid[],'[]'::jsonb,
  'NOT_MATERIALIZED','AUTHORITATIVE','CURRENT',now(),'STAGE3D_OWNER_CANON_V1',now(),
  '["OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION","PAYEV-2026-000008"]'::jsonb,
  true,'stage3d-owner-highlevel-payev-000008-v1'
);

-- AR DB contract: associated fee may point to its principal while exact Deal attribution remains unknown.
INSERT INTO portal_private.payment_business_attributions_v7(
  id,payment_key,classification,attribution_mode,decision_type,authority_kind,authority_source_ref,
  business_scope_refs,scope_deal_keys,lines_snapshot,principal_payment_key,materialization_status,
  authority_state,lifecycle_state,effective_at,source_version,source_timestamp,source_refs,source_locked,idempotency_key
) VALUES (
  '22222222-bbbb-4222-8222-222222222222',
  '7c6dba20-eb9f-47fe-a077-ec3bbf17bf29',
  'ASSOCIATED_BANK_FEE','SCOPE_ONLY',NULL,'OWNER_CANON',
  'OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION',
  ARRAY[]::text[],ARRAY[]::uuid[],'[]'::jsonb,'9fda9905-e782-42f3-8441-71ca866bee0d',
  'NOT_MATERIALIZED','AUTHORITATIVE','CURRENT',now(),'STAGE3D_OWNER_CANON_V1',now(),
  '["OWNER_CONFIRMATION_2026-09-13_PAYEV_000008_000009_HIGH_LEVEL_ALLOCATION","PAYEV-2026-000009","PAYEV-2026-000008"]'::jsonb,
  true,'stage3d-owner-highlevel-payev-000009-v1'
);

DO $$
DECLARE c int;
BEGIN
  SELECT count(*) INTO c FROM portal_private.payment_business_attribution_lines_v7
  WHERE attribution_id IN ('11111111-aaaa-4111-8111-111111111111','22222222-bbbb-4222-8222-222222222222');
  IF c <> 0 THEN RAISE EXCEPTION 'SCOPE_ONLY must not expose exact lines'; END IF;
END $$;

SELECT public.stage3d_expect_error('empty SCOPE_ONLY without Deal/business/principal anchor', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,business_scope_refs,scope_deal_keys,lines_snapshot,effective_at,idempotency_key
  ) VALUES (
    '9fda9905-e782-42f3-8441-71ca866bee0d',
    'OWNER_ASSERTED_ALLOCATED_SYSTEM_AUTHORITY_NOT_MATERIALIZED','SCOPE_ONLY','OWNER_CANON',
    ARRAY[]::text[],ARRAY[]::uuid[],'[]'::jsonb,now(),'invalid-empty-scope-only'
  )
$q$);

SELECT public.stage3d_expect_error('principal cannot self-reference', $q$
  INSERT INTO portal_private.payment_business_attributions_v7(
    payment_key,classification,attribution_mode,authority_kind,business_scope_refs,scope_deal_keys,lines_snapshot,principal_payment_key,effective_at,idempotency_key
  ) VALUES (
    '7c6dba20-eb9f-47fe-a077-ec3bbf17bf29','ASSOCIATED_BANK_FEE','SCOPE_ONLY','OWNER_CANON',
    ARRAY[]::text[],ARRAY[]::uuid[],'[]'::jsonb,'7c6dba20-eb9f-47fe-a077-ec3bbf17bf29',now(),'invalid-self-principal'
  )
$q$);

-- AT — explicit least-privilege boundary.
DO $$
BEGIN
  IF NOT has_schema_privilege('rona_payments_v7_reader','portal_private','USAGE') THEN
    RAISE EXCEPTION 'reader lacks schema USAGE';
  END IF;
  IF NOT has_table_privilege('rona_payments_v7_reader','portal_private.payments','SELECT')
     OR NOT has_table_privilege('rona_payments_v7_reader','portal_private.payment_business_attributions_v7','SELECT')
     OR NOT has_table_privilege('rona_payments_v7_reader','portal_private.payment_business_attribution_lines_v7','SELECT')
     OR NOT has_table_privilege('rona_payments_v7_reader','portal_private.deal_finance_authority_v7','SELECT') THEN
    RAISE EXCEPTION 'reader required SELECT grant missing';
  END IF;
  IF has_table_privilege('rona_payments_v7_reader','portal_private.payment_business_attributions_v7','INSERT')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.payment_business_attributions_v7','UPDATE')
     OR has_table_privilege('rona_payments_v7_reader','portal_private.deal_finance_authority_v7','DELETE') THEN
    RAISE EXCEPTION 'reader has mutation privilege';
  END IF;
  IF has_table_privilege('rona_payments_v7_reader','portal_private.owner_payment_decision_audit_v7','SELECT') THEN
    RAISE EXCEPTION 'reader must not read Owner mutation audit';
  END IF;
  IF has_function_privilege('anon','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('authenticated','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('service_role','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE')
     OR has_function_privilege('rona_payments_v7_reader','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'dormant Owner persistence RPC is executable by application/read roles';
  END IF;
  IF has_table_privilege('anon','portal_private.payment_business_attributions_v7','SELECT')
     OR has_table_privilege('authenticated','portal_private.payment_business_attributions_v7','SELECT')
     OR has_table_privilege('service_role','portal_private.payment_business_attributions_v7','SELECT') THEN
    RAISE EXCEPTION 'application roles can read new private V7 authority table';
  END IF;
END $$;

BEGIN;
SET LOCAL ROLE rona_payments_v7_reader;
SELECT count(*) AS reader_can_read_sealed_authority FROM portal_private.payment_business_attributions_v7;
ROLLBACK;

\echo 'AQ-DB PASS — SCOPE_ONLY supports source-locked business assertion without fake Deal'
\echo 'AR-DB PASS — associated fee may reference principal while exact Deal remains TO_VERIFY'
\echo 'AT PASS — V7 DB privilege boundary is least-privilege and Owner persistence RPC is unavailable to app clients'
