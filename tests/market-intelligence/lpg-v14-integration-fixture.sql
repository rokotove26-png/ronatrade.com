-- TEST FIXTURE ONLY. PostgreSQL 17 ephemeral CI database. No real market data.
CREATE SCHEMA portal_private;
CREATE TABLE portal_private.market_intelligence_source_documents (
 source_doc_id text PRIMARY KEY, source_family text, data_status text,
 processing_state text, source_date date, source_ref text, checksum_sha256 text
);
CREATE TABLE portal_private.telegram_market_documents (
 sha256 text, extraction_state text, extracted_text text
);
CREATE TABLE portal_private.market_intelligence_facts (
 fact_id text PRIMARY KEY, source_doc_id text, as_of_date date, publication_date date,
 product text, market_family text,index_name text,basis text,
 value_type text,delivery_month date,assessment_value numeric,currency text,
 unit text,data_status text,quality_status text,source_ref text,
 source_note text,metadata jsonb
);
CREATE FUNCTION portal_private.mi_curve_code_value_v1(t text,c text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text[];
BEGIN
 v:=regexp_match(t,c||'[[:space:]]+(NA|[0-9]+[.][0-9]+|[0-9]+)');
 IF v IS NULL OR upper(v[1])='NA' THEN RETURN NULL; END IF;
 RETURN v[1]::numeric;
END $$;

-- Three full issues and one SHORT report lacking financial quotes.
INSERT INTO portal_private.market_intelligence_source_documents
SELECT 'DOC'||g,'PLATTS','CONFIRMED','INGESTED',
       current_date-(5-g),'FIXTURE:DAY'||g,'SHA'||g
FROM generate_series(1,4) g;
INSERT INTO portal_private.telegram_market_documents
SELECT 'SHA'||g,'TEXT_EXTRACTED',
 CASE WHEN g=4 THEN 'Short report lacking full forward table'
 ELSE format('Platts European Marketscan ABWFT00 900 AAEBW00 901 ABWFV00 700 PAAAJ00 701 ABWEA00 600 ABWEB00 601 ABWDM00 500 ABWDN00 501 ABWFX00 %s AAHIK00 %s AAHIM00 %s',700+g,600+g,500+g)
 END
FROM generate_series(1,4) g;
-- Prior approved fact: never overwritten by backfill.
INSERT INTO portal_private.market_intelligence_facts (
 fact_id,source_doc_id,as_of_date,publication_date,product,market_family,
 index_name,basis,value_type,delivery_month,assessment_value,currency,
 unit,data_status,quality_status,source_ref,source_note,metadata
)
VALUES (
 'FWD-'||to_char(current_date-4,'YYYYMMDD')||'-SUG-'||
 to_char(date_trunc('month',current_date-4),'YYYYMM'),
 'DOC1',current_date-4,current_date-4,'СУГ','FINANCIAL_FORWARD',
 'Propane CIF NWE Large Cargo Financial','CIF NWE Large Cargo Financial',
 'FORWARD',date_trunc('month',current_date-4)::date,999,'USD','USD/т',
 'CONFIRMED','CONFIRMED','FIXTURE:EXISTING',
 'TEST PREEXISTING approved value','{"seed":true}'::jsonb
);
-- Match production V5 function body for source-guarded migration.
CREATE FUNCTION portal_private.market_intelligence_source_processor_cron_tick_v3()
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"ok":true}'::jsonb $$;
CREATE FUNCTION portal_private.market_intelligence_materialize_full_curve_v1()
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"ok":false}'::jsonb $$;
CREATE FUNCTION portal_private.market_intelligence_normalize_dt_forward_v1()
RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
CREATE FUNCTION portal_private.snapshot_market_intelligence_forecast_inputs_v2()
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"ok":false}'::jsonb $$;
CREATE FUNCTION portal_private.snapshot_market_intelligence_lpg_curve_v1()
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"ok":false}'::jsonb $$;
CREATE FUNCTION portal_private.refresh_market_intelligence_analytics_v1(reason text)
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{"ok":true}'::jsonb $$;
CREATE FUNCTION portal_private.market_intelligence_source_processor_cron_tick_v5()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','portal_private'
AS $fn$
declare
  base jsonb; curve jsonb; normalized int; fc jsonb; lpg jsonb; pub jsonb;
begin
  base:=portal_private.market_intelligence_source_processor_cron_tick_v3();
  curve:=portal_private.market_intelligence_materialize_full_curve_v1();
  normalized:=portal_private.market_intelligence_normalize_dt_forward_v1();
  fc:=portal_private.snapshot_market_intelligence_forecast_inputs_v2();
  lpg:=portal_private.snapshot_market_intelligence_lpg_curve_v1();
  if coalesce((curve->>'ok')::boolean,false)
     or coalesce((fc->>'ok')::boolean,false)
     or coalesce((lpg->>'ok')::boolean,false) then
    pub:=portal_private.refresh_market_intelligence_analytics_v1('FULL_PLATTS_CURVE_V1');
  end if;
  return jsonb_build_object('ok',true,'base',base,'curve',curve,'normalized_dt',normalized,
    'forecast',fc,'lpg',lpg,'publication',pub);
end
$fn$;
