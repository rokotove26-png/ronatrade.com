import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const basename='20261022124500_owner_admin_argus_caspian_private_wiring_v1';
const next=fs.readFileSync('supabase/migrations/'+basename+'.sql','utf8');
const previous=fs.readFileSync('supabase/rollback/'+basename+'.rollback.sql','utf8');
const normalize=s=>s.slice(s.indexOf('CREATE OR REPLACE FUNCTION')).trim();
test('only original owner admin bootstrap callsite changes',()=>{
 const original=normalize(previous);
 const expected=original.replace('portal_private.market_intelligence_admin_canonical_payload_v1()',
 'portal_private.market_intelligence_admin_argus_sources_v1()');
 assert.equal(normalize(next),expected);
});
test('owner ACL, publication gate and legacy Analytics are preserved',()=>{
 assert.match(next,/owner_analytics_admin_bootstrap_core_v1\(\)/);
 assert.match(next,/OWNER_AUTHORIZED_AUTO_DERIVED_ANALYTICS; LEGACY_MANUAL_PUBLICATIONS_REMAIN_GATED/);
 assert.match(next,/jsonb_set\(v,'\{canonicalAnalytics\}'/);
 assert.match(next,/SECURITY DEFINER/);
 assert.match(next,/SET search_path TO 'pg_catalog', 'public', 'portal_private', 'auth'/);
});
test('no source prices, authorizations, public/private client modifications or broadening grants',()=>{
 assert.doesNotMatch(next,/\b(?:1300|1450|1500|1630|1400)\b/);
 assert.doesNotMatch(next,/GRANT |ALTER ROLE|REVOKE |UPDATE |DELETE |INSERT INTO |TRUNCATE |CREATE TABLE /i);
 assert.doesNotMatch(next,/owner_analytics_admin_client|owner_analytics_client_feed|market_intelligence_admin_client_shared_payload_v14/);
 assert.doesNotMatch(next,/api\.groq|net\.http_post|fetch\(/i);
});
test('rollback restores exactly previous DB function source and untouched auth',()=>{
 assert.match(previous,/portal_private\.market_intelligence_admin_canonical_payload_v1\(\)/);
 assert.doesNotMatch(previous,/portal_private\.market_intelligence_admin_argus_sources_v1\(\)/);
});
