\set ON_ERROR_STOP on
-- Anonymous production clients must never receive licensed source data through these functions.
DO $$DECLARE v jsonb; BEGIN
 v:=portal_private.market_intelligence_admin_argus_sources_v1();
 IF v->'argus'->>'available'<>'false' OR v->'argusCaspian'->>'available'<>'false'
 THEN RAISE EXCEPTION 'NO_LICENCE_MUST_FAIL_CLOSED'; END IF;
 IF v->'products'->'AI92' IS NULL THEN RAISE EXCEPTION 'LEGACY_PAYLOAD_DISAPPEARED'; END IF;
END $$;
DO $$BEGIN
 PERFORM portal_private.market_intelligence_argus_caspian_materialize_v1(NULL,NULL);
 RAISE EXCEPTION 'MISSING_SOURCE_AUTHORITY_ACCEPTED';
EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'ARGUS_COMMERCIAL_SOURCE_AUTHORITY_REQUIRED' THEN RAISE; END IF;
END $$;
-- Entire dataset below is fabricated ONLY for isolated PG17 compilation / boundary verification.
INSERT INTO portal_private.ai_coordination_records(record_id,record_type,functional_role,status,qa_only,payload,source_refs)
VALUES
 ('11111111-1111-4111-8111-111111111111','BUSINESS_CHANGE_PROPOSAL','COMMERCIAL_DIRECTOR','PROPOSED',false,
 jsonb_build_object('proposed_field','market_intelligence.argus_saryagach_source_materialization_v1',
 'proposed_action','REGISTER_SOURCE_LOCKED_ARGUS_CASPIAN_SARYAGACH_AND_LPG_WHEN_VERIFIED',
 'proposed_value',jsonb_build_object('source_family','ARGUS','no_synthetic_records',true,
 'basis','CPT Сары-Агач','source_name','Argus Caspian Test (mock).pdf',
 'source_ref','https://example.invalid/license-only-fixture','source_date','2026-10-14','pricing_date','2026-10-13',
 'records',jsonb_build_array(
 jsonb_build_object('product','АИ-92','kind','DIRECT_ASSESSMENT','low',101,'high',111),
 jsonb_build_object('product','АИ-95','kind','DIRECT_ASSESSMENT','low',151,'high',161),
 jsonb_build_object('product','ДТ','kind','DIRECT_ASSESSMENT','low',201,'high',211)))), '[]'::jsonb),
 ('22222222-2222-4222-8222-222222222222','OPERATIONS_INTERNAL_DECISION','OPERATIONS_DIRECTOR','APPROVE_FOR_NEXT_STAGE',false,
 '{"record_id":"11111111-1111-4111-8111-111111111111"}'::jsonb,'[]'::jsonb);
INSERT INTO portal_private.telegram_market_documents(id,file_name,source_url,extraction_state,sha256,extracted_text)
VALUES('33333333-3333-4333-8333-333333333333','Argus Caspian Test (mock).pdf',
 'https://example.invalid/license-only-fixture','TEXT_AND_TABLES_EXTRACTED',repeat('a',64),
 repeat('Mock test source only. ',80)||' 101–111 151–161 201–211');
-- Both Commercial and Operations exist; missing LEGAL must still prevent all writes.
DO $$BEGIN
 PERFORM portal_private.market_intelligence_argus_caspian_materialize_v1(
 '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444');
 RAISE EXCEPTION 'MISSING_LEGAL_APPROVAL_ACCEPTED';
EXCEPTION WHEN raise_exception THEN
 IF SQLERRM<>'ARGUS_INTERNAL_ANALYTICS_LICENSE_REQUIRED' THEN RAISE; END IF;
END $$;
DO $$BEGIN
 IF (SELECT count(*) FROM portal_private.market_intelligence_facts)<>0 THEN
 RAISE EXCEPTION 'UNLICENSED_INSERT_DETECTED'; END IF;
END $$;
INSERT INTO portal_private.ai_coordination_records(record_id,record_type,functional_role,status,qa_only,payload,source_refs)
VALUES('44444444-4444-4444-8444-444444444444','FUNCTIONAL_CONCLUSION','LEGAL','APPROVED',false,
 '{"confirmed":true,"recommendation":"ARGUS_INTERNAL_ANALYTICS_LICENSE_VERIFIED","mandatory_conditions":[]}'::jsonb,
 '["DB:telegram_market_documents:33333333-3333-4333-8333-333333333333"]'::jsonb);
-- License-granted POSITIVE PATH IN ISOLATED TEST DATABASE ONLY.
DO $$DECLARE v jsonb;BEGIN
 v:=portal_private.market_intelligence_argus_caspian_materialize_v1(
 '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444');
 IF (v->>'verified_count')::int<>3 THEN RAISE EXCEPTION 'EXPECTED_THREE_MOCK_SOURCE_RANGES'; END IF;
 v:=portal_private.market_intelligence_admin_argus_sources_v1();
 IF v->'argus'->>'available'<>'false' THEN RAISE EXCEPTION 'CASPIAN_IMPERSONATED_EUROBOB'; END IF;
 IF v->'argusCaspian'->>'available'<>'true' OR
 jsonb_array_length(v->'argusCaspian'->'records')<>3 THEN
 RAISE EXCEPTION 'LICENSED_CASPIAN_PRIVATE_READ_NOT_WORKING'; END IF;
END $$;
-- Revoked LEGAL approval immediately makes old records inaccessible; no source records deleted.
INSERT INTO portal_private.ai_coordination_records(record_id,record_type,functional_role,status,qa_only,payload,source_refs,supersedes_id)
VALUES('55555555-5555-4555-8555-555555555555','FUNCTIONAL_CONCLUSION','LEGAL','HOLD',false,
 '{"confirmed":false,"recommendation":"LICENSE_WITHDRAWN","mandatory_conditions":["NO_FURTHER_USE"]}'::jsonb,
 '["DB:telegram_market_documents:33333333-3333-4333-8333-333333333333"]'::jsonb,
 '44444444-4444-4444-8444-444444444444');
DO $$DECLARE v jsonb;BEGIN
 v:=portal_private.market_intelligence_admin_argus_sources_v1();
 IF v->'argusCaspian'->>'available'<>'false' THEN
 RAISE EXCEPTION 'LEGAL_REVOCATION_NOT_ENFORCED'; END IF;
END $$;
