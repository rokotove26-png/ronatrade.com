-- PostgreSQL 17 ISOLATED TEST FIXTURE. No real licensed Argus bytes or live records.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA portal_private;
CREATE TABLE portal_private.ai_coordination_records(
 record_id uuid PRIMARY KEY,record_type text,functional_role text,status text,
 qa_only boolean NOT NULL DEFAULT false,payload jsonb,source_refs jsonb,supersedes_id uuid
);
CREATE TABLE portal_private.telegram_market_documents(
 id uuid PRIMARY KEY,file_name text,source_url text,extraction_state text,
 sha256 text,extracted_text text,ingested_at timestamptz DEFAULT now()
);
CREATE TABLE portal_private.market_intelligence_source_documents(
 source_doc_id text PRIMARY KEY,source_family text,source_name text,source_date date,
 source_ref text,checksum_sha256 text,data_status text,processing_state text,
 metadata jsonb,created_at timestamptz DEFAULT now()
);
CREATE TABLE portal_private.market_intelligence_facts(
 fact_id text PRIMARY KEY,source_doc_id text REFERENCES portal_private.market_intelligence_source_documents(source_doc_id),
 as_of_date date,publication_date date,product text,market_family text,index_name text,basis text,
 value_type text,value_low numeric,value_high numeric,assessment_value numeric,calc_value numeric,
 currency text,unit text,data_status text,quality_status text,source_ref text,source_page text,
 source_note text,metadata jsonb,created_at timestamptz DEFAULT now()
);
CREATE FUNCTION portal_private.market_intelligence_admin_canonical_payload_v1()
RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT '{"argus":{"available":false,"required":"EUROBOB"},"products":{"AI92":{}}}'::jsonb
$$;
