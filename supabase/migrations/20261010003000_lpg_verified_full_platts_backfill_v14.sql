-- Backfill only absent verified LPG full-edition observations.
-- Historical records and official prices are unchanged.
CREATE OR REPLACE FUNCTION portal_private.mi_backfill_lpg_observations_v14()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','portal_private'
AS $$
DECLARE n integer:=0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM portal_private.ai_coordination_records c
    WHERE c.record_id='5697e762-4cdc-47a8-972c-eeb4a2a67c8f'::uuid
      AND c.record_type='BUSINESS_CHANGE_PROPOSAL'
      AND c.functional_role::text='COMMERCIAL_DIRECTOR'
      AND c.status='PROPOSED'
      AND c.payload->>'proposed_field'='analytics.full_platts_curve_forecast_v1'
  ) OR NOT EXISTS (
    SELECT 1 FROM portal_private.ai_coordination_records c
    WHERE c.record_id='b295fe31-92ca-4702-8e5c-4a199699fb30'::uuid
      AND c.record_type='OPERATIONS_INTERNAL_DECISION'
      AND c.functional_role::text='OPERATIONS_DIRECTOR'
      AND c.status='APPROVE_FOR_NEXT_STAGE'
      AND c.payload->>'record_id'='5697e762-4cdc-47a8-972c-eeb4a2a67c8f'
  ) THEN
    RAISE EXCEPTION 'LPG_V14_AUTHORITY_NOT_CONFIRMED';
  END IF;
  WITH editions AS (
    SELECT DISTINCT ON (s.source_date)
      s.source_date, s.source_doc_id, s.source_ref, d.sha256, d.extracted_text
    FROM portal_private.market_intelligence_source_documents s
    JOIN portal_private.telegram_market_documents d ON d.sha256=s.checksum_sha256
    WHERE s.source_family='PLATTS'
      AND s.data_status='CONFIRMED' AND s.processing_state='INGESTED'
      AND s.source_date BETWEEN current_date-85 AND current_date
      AND d.extraction_state IN ('TEXT_EXTRACTED','TEXT_AND_TABLES_EXTRACTED')
      AND d.extracted_text LIKE '%Platts European Marketscan%'
      AND d.extracted_text LIKE '%ABWFT00%'
      AND d.extracted_text LIKE '%AAEBW00%'
      AND d.extracted_text LIKE '%ABWFV00%'
      AND d.extracted_text LIKE '%PAAAJ00%'
      AND d.extracted_text LIKE '%ABWEA00%'
      AND d.extracted_text LIKE '%ABWEB00%'
      AND d.extracted_text LIKE '%ABWDM00%'
      AND d.extracted_text LIKE '%ABWDN00%'
    ORDER BY s.source_date,octet_length(d.extracted_text) DESC
  ), readings AS (
    SELECT e.*,v.month_date,v.code,
      portal_private.mi_curve_code_value_v1(e.extracted_text,v.code) AS assessment
    FROM editions e CROSS JOIN LATERAL (VALUES
      (date_trunc('month',e.source_date)::date,'ABWFX00'),
      ((date_trunc('month',e.source_date)+interval '1 month')::date,'AAHIK00'),
      ((date_trunc('month',e.source_date)+interval '2 months')::date,'AAHIM00')
    ) v(month_date,code)
  ), added AS (
    INSERT INTO portal_private.market_intelligence_facts (
      fact_id,source_doc_id,as_of_date,publication_date,product,market_family,
      index_name,basis,value_type,delivery_month,assessment_value,
      currency,unit,data_status,quality_status,source_ref,source_note,metadata)
    SELECT 'FWD-'||to_char(source_date,'YYYYMMDD')||'-SUG-'||to_char(month_date,'YYYYMM'),
      source_doc_id,source_date,source_date,'СУГ','FINANCIAL_FORWARD',
      'Propane CIF NWE Large Cargo Financial','CIF NWE Large Cargo Financial',
      'FORWARD',month_date,assessment,
      'USD','USD/т','CONFIRMED','CONFIRMED',source_ref,
      'Verified full Platts financial issue; no interpolation',
      jsonb_build_object('curve_code',code,'raw_quotes_private',true,
        'parser','FULL_PLATTS_CURVE_V1','materializer','LPG_V14',
        'source_sha256',sha256,
        'commercial_proposal_id','5697e762-4cdc-47a8-972c-eeb4a2a67c8f',
        'operations_approval_id','b295fe31-92ca-4702-8e5c-4a199699fb30')
    FROM readings WHERE assessment>0 AND assessment<=100000
    ON CONFLICT (fact_id) DO NOTHING RETURNING fact_id
  ) SELECT count(*) INTO n FROM added;
  RETURN jsonb_build_object('ok',true,'inserted_facts',n);
END;
$$;
REVOKE ALL ON FUNCTION portal_private.mi_backfill_lpg_observations_v14() FROM PUBLIC,anon,authenticated,service_role;
