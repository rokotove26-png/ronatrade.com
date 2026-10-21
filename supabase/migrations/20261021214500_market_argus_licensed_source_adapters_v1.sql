-- RONA market adapters: independent Argus Caspian CPT and Argus European Products EUROBOB.
-- Additive code only. No business rows, raw PDF, quote numbers, public grants, UI or cron changes.
CREATE OR REPLACE FUNCTION portal_private.market_intelligence_argus_caspian_payload_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,portal_private
AS $argus$
WITH licensed AS (
 SELECT f.product,f.as_of_date,f.value_low,f.value_high,f.currency,f.unit,
   f.source_ref,f.source_page,s.source_name,s.source_date
 FROM portal_private.market_intelligence_facts f
 JOIN portal_private.market_intelligence_source_documents s ON s.source_doc_id=f.source_doc_id
 JOIN portal_private.telegram_market_documents raw
   ON raw.id::text=s.metadata->>'telegram_document_id'
  AND raw.sha256=s.checksum_sha256
  AND raw.extraction_state='TEXT_AND_TABLES_EXTRACTED'
 JOIN portal_private.ai_coordination_records legal
   ON legal.record_id::text=s.metadata->>'legal_approval_ref'
  AND legal.record_type='FUNCTIONAL_CONCLUSION'
  AND legal.functional_role::text='LEGAL'
  AND legal.status='APPROVED' AND legal.qa_only=false
  AND NOT EXISTS(SELECT 1 FROM portal_private.ai_coordination_records newer WHERE newer.supersedes_id=legal.record_id)
  AND legal.payload->>'confirmed'='true'
  AND coalesce(jsonb_array_length(legal.payload->'mandatory_conditions'),1)=0
  AND legal.payload->>'recommendation' LIKE '%ARGUS_INTERNAL_ANALYTICS_LICENSE_VERIFIED%'
  AND (legal.source_refs ? ('DB:telegram_market_documents:'||raw.id::text)
      OR legal.payload->'source_refs' ? ('DB:telegram_market_documents:'||raw.id::text))
 WHERE s.source_family='ARGUS'
   AND s.data_status='CONFIRMED'
   AND s.metadata->>'license_status'='CONFIRMED_INTERNAL_ANALYTICS'
   AND f.market_family='ARGUS_CASPIAN'
   AND f.basis=U&'CPT \0421\0430\0440\044B-\0410\0433\0430\0447'
   AND f.value_type='REGIONAL'
   AND f.data_status='CONFIRMED' AND f.quality_status='CONFIRMED'
   AND f.assessment_value IS NULL AND f.value_low>0 AND f.value_high>=f.value_low
), last_day AS (
 SELECT max(as_of_date) dt FROM licensed
), data AS (
 SELECT jsonb_agg(jsonb_build_object(
  'product',x.product,'low',x.value_low,'high',x.value_high,'currency',x.currency,
  'unit',x.unit,'basis',U&'CPT \0421\0430\0440\044B-\0410\0433\0430\0447',
  'pricing_date',x.as_of_date,'historical_only',x.as_of_date<(current_date-7),
  'source_name',x.source_name,'issue_date',x.source_date,
  'source_ref',x.source_ref,'source_page',x.source_page,
  'assessment_kind','DIRECT_SOURCE_RANGE_NO_MIDPOINT'
 ) ORDER BY x.product) items
 FROM licensed x WHERE x.as_of_date=(SELECT dt FROM last_day)
)
SELECT jsonb_build_object(
 'available',coalesce(jsonb_array_length(coalesce((SELECT items FROM data),'[]'::jsonb)),0)>0,
 'source_family','ARGUS','market','UZBEKISTAN',
 'basis',U&'CPT \0421\0430\0440\044B-\0410\0433\0430\0447',
 'pricing_date',(SELECT dt FROM last_day),
 'historical_only',coalesce((SELECT dt FROM last_day)<(current_date-7),true),
 'records',coalesce((SELECT items FROM data),'[]'::jsonb),
 'separate_from','ARGUS_EUROBOB_NORTHWEST_EUROPE',
 'reason',CASE WHEN (SELECT dt FROM last_day) IS NULL THEN
  'NO_SOURCE_SPECIFIC_LEGAL_APPROVAL_OR_VERIFIED_CASPIAN_FACTS' ELSE NULL END,
 'winter_diesel_32',jsonb_build_object('available',false,'reason','NO_SOURCE_ASSESSMENT'),
 'lpg_dap_saryagach',jsonb_build_object('available',false,'reason','NO_LICENSED_DIRECT_LPG_ASSESSMENT')
);
$argus$;

-- A separately source-locked European reader. A Caspian, Platts or RONA price can never become EUROBOB.
CREATE OR REPLACE FUNCTION portal_private.market_intelligence_argus_eurobob_payload_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO pg_catalog,portal_private
AS $euro$
WITH permitted AS (
 SELECT f.as_of_date,f.assessment_value,f.currency,f.unit,f.source_ref,s.source_name
 FROM portal_private.market_intelligence_facts f
 JOIN portal_private.market_intelligence_source_documents s ON s.source_doc_id=f.source_doc_id
 JOIN portal_private.ai_coordination_records legal
   ON legal.record_id::text=s.metadata->>'legal_approval_ref'
  AND legal.record_type='FUNCTIONAL_CONCLUSION'
  AND legal.functional_role::text='LEGAL'
  AND legal.status='APPROVED' AND legal.qa_only=false
  AND NOT EXISTS(SELECT 1 FROM portal_private.ai_coordination_records newer WHERE newer.supersedes_id=legal.record_id)
  AND legal.payload->>'confirmed'='true'
  AND coalesce(jsonb_array_length(legal.payload->'mandatory_conditions'),1)=0
  AND legal.payload->>'recommendation' LIKE '%ARGUS_INTERNAL_ANALYTICS_LICENSE_VERIFIED%'
  AND (legal.source_refs ? ('DB:market_intelligence_source_documents:'||s.source_doc_id)
       OR legal.payload->'source_refs' ? ('DB:market_intelligence_source_documents:'||s.source_doc_id))
 WHERE s.source_family='ARGUS' AND s.source_name ILIKE '%European Products%'
   AND s.data_status='CONFIRMED'
   AND s.metadata->>'license_status'='CONFIRMED_INTERNAL_ANALYTICS'
   AND f.market_family='ARGUS_EUROBOB_NWE'
   AND f.index_name='EUROBOB Oxy' AND f.basis='Northwest Europe - barge'
   AND f.value_type='PHYSICAL' AND f.assessment_value>0
   AND f.data_status='CONFIRMED' AND f.quality_status='CONFIRMED'
 ORDER BY f.as_of_date DESC,f.created_at DESC LIMIT 1
)
SELECT CASE WHEN EXISTS(SELECT 1 FROM permitted) THEN jsonb_build_object(
 'available',true,'source_family','ARGUS',
 'required','Argus European Products · EUROBOB Oxy · Northwest Europe - barge',
 'index','EUROBOB Oxy','basis','Northwest Europe - barge',
 'date',(SELECT as_of_date FROM permitted),
 'historical_only',(SELECT as_of_date FROM permitted)<(current_date-7),
 'value',(SELECT assessment_value FROM permitted),'currency',(SELECT currency FROM permitted),
 'unit',(SELECT unit FROM permitted),'source_ref',(SELECT source_ref FROM permitted),
 'source_name',(SELECT source_name FROM permitted),'internal_only',true)
ELSE jsonb_build_object('available',false,
 'required','Argus European Products · EUROBOB Oxy · Northwest Europe - barge',
 'reason','NO_LICENSED_SOURCE_LOCKED_EUROBOB_ASSESSMENT') END;
$euro$;

-- Opt-in INTERNAL Admin reader. No changes to existing canonical function or Client/Agent functions.
CREATE OR REPLACE FUNCTION portal_private.market_intelligence_admin_argus_sources_v1()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO pg_catalog,portal_private
AS $wrapper$
SELECT portal_private.market_intelligence_admin_canonical_payload_v1()
 || jsonb_build_object('argus',portal_private.market_intelligence_argus_eurobob_payload_v1(),
                       'argusCaspian',portal_private.market_intelligence_argus_caspian_payload_v1());
$wrapper$;

-- Commercial/Operations authorize staging; source-specific LEGAL independently authorizes usage.
-- This function has no scheduler or network dependency and only inserts after ALL gates pass.
CREATE OR REPLACE FUNCTION portal_private.market_intelligence_argus_caspian_materialize_v1(
 p_commercial_proposal_id uuid,p_legal_approval_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog,portal_private
AS $materializer$
DECLARE
 v_prop portal_private.ai_coordination_records%rowtype;
 v_legal portal_private.ai_coordination_records%rowtype;
 v_raw portal_private.telegram_market_documents%rowtype;
 v_data jsonb; v_list jsonb; v_item jsonb;
 v_doc_id text; v_fact_id text; v_product text; v_ref text; v_page text;
 v_basis text:=U&'CPT \0421\0430\0440\044B-\0410\0433\0430\0447';
 v_low numeric; v_high numeric; v_asof date; v_issue date;
 v_flat text; v_seen text[]:=ARRAY[]::text[]; v_count integer:=0;
BEGIN
 SELECT * INTO v_prop FROM portal_private.ai_coordination_records
 WHERE record_id=p_commercial_proposal_id AND record_type='BUSINESS_CHANGE_PROPOSAL'
   AND functional_role::text='COMMERCIAL_DIRECTOR' AND status='PROPOSED' AND qa_only=false
   AND payload->>'proposed_field'='market_intelligence.argus_saryagach_source_materialization_v1'
   AND payload->>'proposed_action'='REGISTER_SOURCE_LOCKED_ARGUS_CASPIAN_SARYAGACH_AND_LPG_WHEN_VERIFIED';
 IF NOT FOUND THEN RAISE EXCEPTION 'ARGUS_COMMERCIAL_SOURCE_AUTHORITY_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM portal_private.ai_coordination_records d
  WHERE d.record_type='OPERATIONS_INTERNAL_DECISION' AND d.functional_role::text='OPERATIONS_DIRECTOR'
   AND d.status='APPROVE_FOR_NEXT_STAGE' AND d.qa_only=false
   AND d.payload->>'record_id'=p_commercial_proposal_id::text)
 THEN RAISE EXCEPTION 'ARGUS_OPERATIONS_REVIEW_REQUIRED'; END IF;
 v_data:=v_prop.payload->'proposed_value';
 IF coalesce(v_data->>'source_family','')<>'ARGUS'
    OR coalesce(v_data->>'no_synthetic_records','false')<>'true'
    OR v_data->>'basis'<>v_basis OR v_data->>'source_name' NOT ILIKE 'Argus %'
 THEN RAISE EXCEPTION 'ARGUS_PROPOSAL_SCOPE_MISMATCH'; END IF;
 v_ref:=v_data->>'source_ref'; v_asof:=(v_data->>'pricing_date')::date;
 v_issue:=(v_data->>'source_date')::date;
 IF v_ref IS NULL OR length(v_ref)<12 OR v_asof IS NULL OR v_issue IS NULL
    OR v_asof>v_issue OR v_issue>current_date
 THEN RAISE EXCEPTION 'ARGUS_SOURCE_DATE_OR_REF_INVALID'; END IF;
 SELECT * INTO v_raw FROM portal_private.telegram_market_documents
 WHERE file_name=v_data->>'source_name' AND source_url=v_ref
   AND extraction_state='TEXT_AND_TABLES_EXTRACTED'
   AND sha256 ~ '^[a-fA-F0-9]{64}$' AND length(extracted_text)>1000
 ORDER BY ingested_at DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'ARGUS_SOURCE_ARCHIVE_REQUIRED'; END IF;
 IF coalesce(v_data->>'source_sha256',v_raw.sha256)<>v_raw.sha256
 THEN RAISE EXCEPTION 'ARGUS_SOURCE_CHECKSUM_MISMATCH'; END IF;
 SELECT * INTO v_legal FROM portal_private.ai_coordination_records
 WHERE record_id=p_legal_approval_id AND record_type='FUNCTIONAL_CONCLUSION'
   AND functional_role::text='LEGAL' AND status='APPROVED' AND qa_only=false
   AND NOT EXISTS(SELECT 1 FROM portal_private.ai_coordination_records newer WHERE newer.supersedes_id=p_legal_approval_id)
   AND payload->>'confirmed'='true'
   AND coalesce(jsonb_array_length(payload->'mandatory_conditions'),1)=0
   AND payload->>'recommendation' LIKE '%ARGUS_INTERNAL_ANALYTICS_LICENSE_VERIFIED%'
   AND (source_refs ? ('DB:telegram_market_documents:'||v_raw.id::text)
       OR payload->'source_refs' ? ('DB:telegram_market_documents:'||v_raw.id::text));
 IF NOT FOUND THEN RAISE EXCEPTION 'ARGUS_INTERNAL_ANALYTICS_LICENSE_REQUIRED'; END IF;
 v_list:=v_data->'records';
 IF jsonb_typeof(v_list)<>'array' OR jsonb_array_length(v_list)<>3
 THEN RAISE EXCEPTION 'ARGUS_EXPECTED_THREE_DIRECT_ASSESSMENTS'; END IF;
 v_flat:=replace(replace(replace(regexp_replace(v_raw.extracted_text,'[[:space:]]','','g'),
        U&'\00A0',''),U&'\2013',U&'\2014'),'-',U&'\2014');
 -- Validate all source values before any INSERT; missing evidence fails the whole transaction.
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_list) LOOP
  v_product:=v_item->>'product';
  IF v_item->>'kind'<>'DIRECT_ASSESSMENT'
     OR v_product NOT IN (U&'\0410\0418-92',U&'\0410\0418-95',U&'\0414\0422')
     OR v_product=ANY(v_seen)
  THEN RAISE EXCEPTION 'ARGUS_PRODUCT_INVALID_OR_DUPLICATED'; END IF;
  v_seen:=array_append(v_seen,v_product);
  v_low:=NULLIF(v_item->>'low','')::numeric;
  v_high:=NULLIF(v_item->>'high','')::numeric;
  IF v_low IS NULL OR v_high IS NULL OR v_low<=0 OR v_high<v_low OR v_high>100000
     OR v_low<>trunc(v_low) OR v_high<>trunc(v_high)
  THEN RAISE EXCEPTION 'ARGUS_DIRECT_RANGE_INVALID'; END IF;
  IF strpos(v_flat,v_low::bigint::text||U&'\2014'||v_high::bigint::text)=0
  THEN RAISE EXCEPTION 'ARGUS_DIRECT_RANGE_MISSING_IN_PDF_TEXT'; END IF;
 END LOOP;
 v_doc_id:='ARGUS-CASPIAN-'||upper(left(v_raw.sha256,24));
 INSERT INTO portal_private.market_intelligence_source_documents
 (source_doc_id,source_family,source_name,source_date,source_ref,checksum_sha256,
  data_status,processing_state,metadata)
 VALUES(v_doc_id,'ARGUS',v_raw.file_name,v_issue,v_ref,v_raw.sha256,'CONFIRMED','INGESTED',
 jsonb_build_object('license_status','CONFIRMED_INTERNAL_ANALYTICS',
  'legal_approval_ref',p_legal_approval_id,'commercial_proposal_id',p_commercial_proposal_id,
  'telegram_document_id',v_raw.id,'raw_quotes_private',true,
  'excluded_from_public_and_price_publication',true))
 ON CONFLICT(source_doc_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM portal_private.market_intelligence_source_documents
   WHERE source_doc_id=v_doc_id AND checksum_sha256=v_raw.sha256
     AND metadata->>'legal_approval_ref'=p_legal_approval_id::text)
 THEN RAISE EXCEPTION 'ARGUS_SOURCE_DOCUMENT_CONFLICT'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(v_list) LOOP
  v_product:=v_item->>'product';v_low:=(v_item->>'low')::numeric;
  v_high:=(v_item->>'high')::numeric;v_page:=NULLIF(v_item->>'source_page','');
  v_fact_id:='ARGUS-CASPIAN-'||to_char(v_asof,'YYYYMMDD')||'-'||upper(left(md5(v_product),12));
  INSERT INTO portal_private.market_intelligence_facts
   (fact_id,source_doc_id,as_of_date,publication_date,product,market_family,
    index_name,basis,value_type,value_low,value_high,currency,unit,
    data_status,quality_status,source_ref,source_page,source_note,metadata)
  VALUES(v_fact_id,v_doc_id,v_asof,v_issue,v_product,'ARGUS_CASPIAN',
   'Argus Caspian / Uzbekistan',v_basis,'REGIONAL',v_low,v_high,'USD',U&'USD/\0442',
   'CONFIRMED','CONFIRMED',v_ref,v_page,
   'Direct licensed source range, no midpoint or manufactured price',
   jsonb_build_object('internal_only',true,'license_ref',p_legal_approval_id,
    'raw_quotes_private',true,'proposal_ref',p_commercial_proposal_id))
  ON CONFLICT(fact_id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM portal_private.market_intelligence_facts
     WHERE fact_id=v_fact_id AND source_doc_id=v_doc_id
       AND value_low=v_low AND value_high=v_high AND assessment_value IS NULL)
  THEN RAISE EXCEPTION 'ARGUS_FACT_VERSION_CONFLICT'; END IF;
  v_count:=v_count+1;
 END LOOP;
 RETURN jsonb_build_object('ok',true,'status','SOURCE_LOCKED_INTERNAL_FACTS_ONLY',
  'source_doc_id',v_doc_id,'verified_count',v_count,'auto_published',false,
  'legal_approval_ref',p_legal_approval_id);
END;
$materializer$;

REVOKE ALL ON FUNCTION portal_private.market_intelligence_argus_caspian_payload_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_argus_eurobob_payload_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_admin_argus_sources_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION portal_private.market_intelligence_argus_caspian_materialize_v1(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION portal_private.market_intelligence_argus_caspian_payload_v1() TO service_role;
GRANT EXECUTE ON FUNCTION portal_private.market_intelligence_argus_eurobob_payload_v1() TO service_role;
GRANT EXECUTE ON FUNCTION portal_private.market_intelligence_admin_argus_sources_v1() TO service_role;
GRANT EXECUTE ON FUNCTION portal_private.market_intelligence_argus_caspian_materialize_v1(uuid,uuid) TO service_role;
