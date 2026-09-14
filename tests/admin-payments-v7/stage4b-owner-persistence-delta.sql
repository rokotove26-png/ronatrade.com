\set ON_ERROR_STOP on
\ir stage4b-production-substrate.sql

DO $$
BEGIN
  IF to_regclass('portal_private.payment_business_attributions_v7') IS NULL OR to_regclass('portal_private.payment_business_attribution_lines_v7') IS NULL OR to_regclass('portal_private.owner_payment_decision_audit_v7') IS NULL OR to_regclass('portal_private.deal_finance_authority_v7') IS NULL OR to_regclass('portal_private.admin_payments_v7_provider_readiness') IS NULL THEN RAISE EXCEPTION 'STAGE4B substrate relation missing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='rona_payments_v7_reader') THEN RAISE EXCEPTION 'STAGE4B reader role missing'; END IF;
  IF (SELECT is_ready FROM portal_private.admin_payments_v7_provider_readiness WHERE provider_key='PAYMENT_BUSINESS_AUTHORITY') IS DISTINCT FROM true THEN RAISE EXCEPTION 'STAGE4B provider not ready'; END IF;
  IF (SELECT count(*) FROM portal_private.payment_business_attributions_v7)<>2 OR (SELECT count(*) FROM portal_private.deal_finance_authority_v7)<>4 OR (SELECT count(*) FROM portal_private.owner_payment_decision_audit_v7)<>0 THEN RAISE EXCEPTION 'STAGE4B seed counts mismatch'; END IF;
  IF to_regprocedure('portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'STAGE4B primitive must be absent before delta'; END IF;
  IF (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version BETWEEN '20260913160703' AND '20260913161909')<>11 THEN RAISE EXCEPTION 'STAGE4B split lineage mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260913160703') THEN RAISE EXCEPTION 'STAGE4B 160703 lineage marker missing'; END IF;
END $$;

CREATE TEMP TABLE stage4b_before AS SELECT
 (SELECT count(*) FROM portal_private.deals) deals_rows,
 (SELECT count(*) FROM portal_private.payments) payments_rows,
 (SELECT count(*) FROM portal_private.payment_allocations) allocation_rows,
 (SELECT count(*) FROM portal_private.payment_business_attributions_v7) attribution_rows,
 (SELECT count(*) FROM portal_private.deal_finance_authority_v7) finance_rows,
 (SELECT count(*) FROM portal_private.owner_payment_decision_audit_v7) audit_rows,
 (SELECT count(*) FROM portal_private.admin_payments_v7_provider_readiness) readiness_rows,
 (SELECT is_ready FROM portal_private.admin_payments_v7_provider_readiness WHERE provider_key='PAYMENT_BUSINESS_AUTHORITY') readiness_value;

\ir ../../supabase/migrations/20260913182849_admin_payments_v7_stage4b_owner_persistence_delta.sql

DO $$
DECLARE fn oid; cfg text[];
BEGIN
 fn:=to_regprocedure('portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)');
 IF fn IS NULL THEN RAISE EXCEPTION 'STAGE4B function missing'; END IF;
 IF (SELECT prorettype FROM pg_proc WHERE oid=fn)<>'portal_private.payment_business_attributions_v7'::regtype THEN RAISE EXCEPTION 'STAGE4B return type mismatch'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid=fn) THEN RAISE EXCEPTION 'STAGE4B must be SECURITY INVOKER'; END IF;
 SELECT proconfig INTO cfg FROM pg_proc WHERE oid=fn;
 IF NOT(cfg@>ARRAY['search_path=pg_catalog, portal_private']::text[]) THEN RAISE EXCEPTION 'STAGE4B search_path mismatch: %',cfg; END IF;
 IF has_function_privilege('anon','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE') OR has_function_privilege('authenticated','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE') OR has_function_privilege('service_role','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE') OR has_function_privilege('rona_payments_v7_reader','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'STAGE4B app/read EXECUTE leak'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid=fn AND a.grantee=0 AND a.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'STAGE4B PUBLIC EXECUTE leak'; END IF;
 IF NOT has_function_privilege('postgres','portal_private.persist_owner_payment_decision_v7(uuid,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'STAGE4B trusted postgres cannot execute'; END IF;
END $$;

DO $$ DECLARE b stage4b_before%rowtype; BEGIN
 SELECT * INTO b FROM stage4b_before;
 IF b.deals_rows<>(SELECT count(*) FROM portal_private.deals) OR b.payments_rows<>(SELECT count(*) FROM portal_private.payments) OR b.allocation_rows<>(SELECT count(*) FROM portal_private.payment_allocations) OR b.attribution_rows<>(SELECT count(*) FROM portal_private.payment_business_attributions_v7) OR b.finance_rows<>(SELECT count(*) FROM portal_private.deal_finance_authority_v7) OR b.audit_rows<>(SELECT count(*) FROM portal_private.owner_payment_decision_audit_v7) OR b.readiness_rows<>(SELECT count(*) FROM portal_private.admin_payments_v7_provider_readiness) OR b.readiness_value IS DISTINCT FROM(SELECT is_ready FROM portal_private.admin_payments_v7_provider_readiness WHERE provider_key='PAYMENT_BUSINESS_AUTHORITY') THEN RAISE EXCEPTION 'STAGE4B schema delta changed business rows'; END IF;
END $$;

CREATE TEMP TABLE stage4b_payload(authority jsonb,audit jsonb);
INSERT INTO stage4b_payload VALUES(
 jsonb_build_object('id','50000000-0000-4000-8000-000000000001','payment_key','20000000-0000-4000-8000-000000000003','classification','RESOLVED','attribution_mode','EXACT','decision_type','BIND_TO_DEAL','authority_kind','OWNER','authority_source_ref','OWNER_PAYMENT_DECISION:60000000-0000-4000-8000-000000000001','business_scope_refs','[]'::jsonb,'scope_deal_keys',jsonb_build_array('10000000-0000-4000-8000-000000000001'),'lines_snapshot',jsonb_build_array(jsonb_build_object('deal_key','10000000-0000-4000-8000-000000000001','amount','50','currency','USD','amount_status','EXACT')),'materialization_status','NOT_MATERIALIZED','authority_state','AUTHORITATIVE','lifecycle_state','CURRENT','effective_at','2026-09-13T18:11:00Z','supersedes_id',NULL,'supersedes_authority_refs','[]'::jsonb,'source_version','STAGE4B_SYNTHETIC','source_timestamp','2026-09-13T18:11:00Z','source_refs',jsonb_build_array('STAGE4B_SYNTHETIC'),'source_locked',true,'actor_id','stage4b-owner','actor_role','OWNER','idempotency_key','stage4b-bind-1'),
 jsonb_build_object('id','60000000-0000-4000-8000-000000000001','event_type','OWNER_PAYMENT_DECISION','payment_key','20000000-0000-4000-8000-000000000003','action','BIND_TO_DEAL','actor_id','stage4b-owner','actor_role','OWNER','expected_current_authority_id',NULL,'expected_current_authority_ref',NULL,'resulting_authority_id','50000000-0000-4000-8000-000000000001','effective_at','2026-09-13T18:11:00Z','idempotency_key','stage4b-bind-1','request_fingerprint','stage4b-bind-1','request_snapshot',jsonb_build_object('payment_key','20000000-0000-4000-8000-000000000003','action','BIND_TO_DEAL','expected_current_authority_id',NULL,'idempotency_key','stage4b-bind-1'),'previous_authority_snapshot',NULL,'current_reconciliation_snapshot',jsonb_build_object('reconciliation_class','GENUINELY_UNALLOCATED'),'resulting_authority_snapshot',jsonb_build_object('id','50000000-0000-4000-8000-000000000001','decision_type','BIND_TO_DEAL','attribution_mode','EXACT'))
);

BEGIN;
SELECT portal_private.persist_owner_payment_decision_v7(NULL,authority,audit) FROM stage4b_payload;
SELECT portal_private.persist_owner_payment_decision_v7(NULL,authority,audit) FROM stage4b_payload;
DO $$ BEGIN
 IF (SELECT count(*) FROM portal_private.payment_business_attributions_v7 WHERE payment_key='20000000-0000-4000-8000-000000000003')<>1 OR (SELECT count(*) FROM portal_private.owner_payment_decision_audit_v7 WHERE payment_key='20000000-0000-4000-8000-000000000003')<>1 THEN RAISE EXCEPTION 'STAGE4B idempotent replay duplicated rows'; END IF;
END $$;

DO $$ DECLARE a jsonb; q jsonb; failed boolean:=false; BEGIN
 SELECT authority,audit INTO a,q FROM stage4b_payload;
 a:=a||jsonb_build_object('id','50000000-0000-4000-8000-000000000002','idempotency_key','stage4b-stale','effective_at','2026-09-13T18:12:00Z');
 q:=q||jsonb_build_object('id','60000000-0000-4000-8000-000000000002','resulting_authority_id','50000000-0000-4000-8000-000000000002','idempotency_key','stage4b-stale','request_snapshot',jsonb_build_object('idempotency_key','stage4b-stale'));
 BEGIN PERFORM portal_private.persist_owner_payment_decision_v7(NULL,a,q); EXCEPTION WHEN OTHERS THEN IF position('STALE_OWNER_DECISION' IN SQLERRM)=0 THEN RAISE; END IF; failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'STAGE4B stale authority was accepted'; END IF;
END $$;

DO $$ DECLARE a jsonb; q jsonb; failed boolean:=false; BEGIN
 SELECT authority,audit INTO a,q FROM stage4b_payload;
 a:=a||jsonb_build_object('id','50000000-0000-4000-8000-000000000003','idempotency_key','stage4b-atomic','effective_at','2026-09-13T18:13:00Z','supersedes_id','50000000-0000-4000-8000-000000000001');
 q:=q||jsonb_build_object('resulting_authority_id','50000000-0000-4000-8000-000000000003','idempotency_key','stage4b-atomic','expected_current_authority_id','50000000-0000-4000-8000-000000000001','request_snapshot',jsonb_build_object('idempotency_key','stage4b-atomic'));
 BEGIN PERFORM portal_private.persist_owner_payment_decision_v7('50000000-0000-4000-8000-000000000001',a,q); EXCEPTION WHEN unique_violation THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'STAGE4B forced audit failure did not occur'; END IF;
 IF EXISTS(SELECT 1 FROM portal_private.payment_business_attributions_v7 WHERE id='50000000-0000-4000-8000-000000000003') THEN RAISE EXCEPTION 'STAGE4B orphan authority survived audit failure'; END IF;
END $$;

DO $$ DECLARE failed boolean:=false; BEGIN
 BEGIN UPDATE portal_private.owner_payment_decision_audit_v7 SET actor_role='ADMIN' WHERE id='60000000-0000-4000-8000-000000000001'; EXCEPTION WHEN OTHERS THEN IF position('immutable' IN lower(SQLERRM))=0 THEN RAISE; END IF; failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'STAGE4B audit mutation was accepted'; END IF;
END $$;
ROLLBACK;

DO $$ DECLARE b stage4b_before%rowtype; BEGIN
 SELECT * INTO b FROM stage4b_before;
 IF b.deals_rows<>(SELECT count(*) FROM portal_private.deals) OR b.payments_rows<>(SELECT count(*) FROM portal_private.payments) OR b.allocation_rows<>(SELECT count(*) FROM portal_private.payment_allocations) OR b.attribution_rows<>(SELECT count(*) FROM portal_private.payment_business_attributions_v7) OR b.finance_rows<>(SELECT count(*) FROM portal_private.deal_finance_authority_v7) OR b.audit_rows<>(SELECT count(*) FROM portal_private.owner_payment_decision_audit_v7) OR b.readiness_rows<>(SELECT count(*) FROM portal_private.admin_payments_v7_provider_readiness) OR b.readiness_value IS DISTINCT FROM(SELECT is_ready FROM portal_private.admin_payments_v7_provider_readiness WHERE provider_key='PAYMENT_BUSINESS_AUTHORITY') THEN RAISE EXCEPTION 'STAGE4B synthetic test escaped rollback'; END IF;
END $$;

\echo 'STAGE4B LINEAGE PASS — split schema_migrations + pg_catalog preflight modeled; full 160703 replay is not assumed'
\echo 'STAGE4B CONTRACT PASS — exact signature/return/search_path/privilege matrix verified'
\echo 'STAGE4B TRANSACTION PASS — server call/idempotency/stale/atomic rollback/immutable audit verified'
\echo 'business_rows_changed=0'
