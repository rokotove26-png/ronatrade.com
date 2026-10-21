import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const m=fs.readFileSync('supabase/migrations/20261021214500_market_argus_licensed_source_adapters_v1.sql','utf8');
const rb=fs.readFileSync('supabase/rollback/20261021214500_market_argus_licensed_source_adapters_v1.rollback.sql','utf8');
test('price sources are never fabricated or hardcoded into the production code',()=>{
 assert.doesNotMatch(m,/\b(?:1300|1450|1500|1630|1400)\b/);
 assert.doesNotMatch(m,/https:\/\/t\.me\/platts_digits\/7848/);
 assert.match(m,/DIRECT_SOURCE_RANGE_NO_MIDPOINT/);
 assert.match(m,/ARGUS_DIRECT_RANGE_MISSING_IN_PDF_TEXT/);
});
test('live commercial, Operations, immutable source and Legal evidence gates are mandatory',()=>{
 assert.match(m,/functional_role::text='COMMERCIAL_DIRECTOR'/);
 assert.match(m,/d\.status='APPROVE_FOR_NEXT_STAGE'/);
 assert.match(m,/legal\.functional_role::text='LEGAL'/);
 assert.match(m,/ARGUS_INTERNAL_ANALYTICS_LICENSE_VERIFIED/);
 assert.match(m,/raw\.sha256=s\.checksum_sha256/);
 assert.match(m,/source_refs \? \('DB:telegram_market_documents:'/);
 assert.match(m,/legal\.qa_only=false/);
 assert.match(m,/ARGUS_INTERNAL_ANALYTICS_LICENSE_REQUIRED/);
});
test('distinct series and exact market basis; EUROBOB never falls back to Caspian',()=>{
 assert.match(m,/f\.market_family='ARGUS_CASPIAN'/);
 assert.match(m,/f\.market_family='ARGUS_EUROBOB_NWE'/);
 assert.match(m,/f\.index_name='EUROBOB Oxy'/);
 assert.match(m,/f\.basis='Northwest Europe - barge'/);
 assert.match(m,/ARGUS_EUROBOB_NORTHWEST_EUROPE/);
 assert.match(m,/NO_LICENSED_SOURCE_LOCKED_EUROBOB_ASSESSMENT/);
});
test('only private internal service role access; no third-party AI, UI or cron',()=>{
 for(const name of ['market_intelligence_argus_caspian_payload_v1','market_intelligence_argus_eurobob_payload_v1','market_intelligence_admin_argus_sources_v1','market_intelligence_argus_caspian_materialize_v1'])
  assert.ok(m.includes('portal_private.'+name));
 assert.doesNotMatch(m,/GRANT EXECUTE.*TO\s+(?:anon|authenticated)/i);
 assert.match(m,/FROM PUBLIC,anon,authenticated/);
 assert.match(m,/TO service_role/);
 assert.doesNotMatch(m,/https:\/\/api\.groq|openai\.com|net\.http_post|cron\.schedule|fetch\(|auto_publish_price/i);
 assert.doesNotMatch(m,/\.css|document\.querySelector|addEventListener/);
});
test('old Admin and Client/Agent payload functions remain untouched',()=>{
 assert.match(m,/market_intelligence_admin_canonical_payload_v1\(\)/);
 assert.doesNotMatch(m,/CREATE OR REPLACE FUNCTION portal_private\.market_intelligence_admin_canonical_payload_v1\(\)/);
 assert.doesNotMatch(m,/CREATE OR REPLACE FUNCTION portal_private\.market_intelligence_admin_client_shared_payload_v14\(\)/);
 assert.match(m,/'argusCaspian',portal_private\.market_intelligence_argus_caspian_payload_v1\(\)/);
});
test('safe rollback removes only new functions and preserves all historical data',()=>{
 assert.match(rb,/DROP FUNCTION IF EXISTS portal_private\.market_intelligence_argus_caspian_payload_v1/);
 assert.match(rb,/DROP FUNCTION IF EXISTS portal_private\.market_intelligence_argus_eurobob_payload_v1/);
 assert.doesNotMatch(rb,/\b(?:DELETE|TRUNCATE|DROP TABLE|UPDATE)\b/i);
 assert.doesNotMatch(m,/\bUPDATE portal_private\.(?:deals|payments|documents|owner_price_snapshots)/i);
});
test('append-only supersession of legal approval immediately blocks reads and new inserts',()=>{
 assert.match(m,/newer\.supersedes_id=legal\.record_id/);
 assert.match(m,/newer\.supersedes_id=p_legal_approval_id/);
});
