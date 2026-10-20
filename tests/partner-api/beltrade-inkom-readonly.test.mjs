import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { READ_SQL, RESOURCE_TYPES, DOCUMENT_DOWNLOAD_SQL } from '../../supabase/functions/rona-beltrade-partner-v1/read-sql.mjs';
import { OPENAPI_SPEC } from '../../supabase/functions/rona-beltrade-partner-v1/openapi.mjs';
const src=fs.readFileSync('supabase/functions/rona-beltrade-partner-v1/index.ts','utf8');
const names=['applications','deals','payments','documents','wagons'];
test('source-locked contract, prior key, GET only and exact BelTrade partner',()=>{
  assert.deepEqual(RESOURCE_TYPES,names);
  assert.match(src,/if\(req\.method!=="GET"\)return response\(405/);
  assert.match(src,/rows\[0\]\?\.partner_code==="BELTRADE_DESK"/);
  assert.match(src,/KEY_PATTERN = \/\^rona_beltrade_live_/);
  assert.doesNotMatch(src,/POST.*v1\/(deals|documents|payments|wagons)/i);
  assert.equal(OPENAPI_SPEC.info.version,'1.1.0');
  assert.equal(OPENAPI_SPEC.openapi,'3.1.0');
});
test('EVERY resource SQL needs original exact grant and six-current-addenda agency filter',()=>{
  for(const name of names){
    const sql=READ_SQL[name];
    assert.match(sql,/partner_api_entity_grants dg/,'missing deal grant '+name);
    assert.match(sql,/dg\.resource='deals'/,'missing granted deal '+name);
    assert.match(sql,/ad\.is_current=true/,'not current agency contract '+name);
    assert.match(sql,/ae\.agent_legal_entity_id='S-005'/,'wrong agent '+name);
    assert.match(sql,/agency_document_key/);
    assert.match(sql,/document_kind='AGENCY_CONTRACT'/);
    assert.match(sql,/document_kind='AGENCY_ADDENDUM'/);
    assert.match(sql,new RegExp("g\\.resource='"+name+"'"),'resource permission bypass '+name);
    assert.match(sql,/g\.active=true/,'revoked resource grant not checked '+name);
    assert.match(sql,/\(\$2::uuid IS NULL OR /,'must support exact id '+name);
    assert.match(sql,/\$5::timestamptz/,'must implement change filtering '+name);
    assert.match(sql,/ORDER BY [\w.]+updated_at DESC/);
  }
});
test('no origin inference, no fictitious trade price, no unverified payment',()=>{
  assert.match(src,/APPLICATION_PROPOSAL_NOT_SIGNED_TRADE_PRICE/);
  assert.match(src,/origin_station_code:null/);
  assert.match(READ_SQL.applications,/proposed_price/);
  assert.match(READ_SQL.deals,/proposed_price/);
  assert.match(READ_SQL.payments,/allocation_status='VERIFIED'/);
  assert.match(READ_SQL.payments,/authority_state='CONFIRMED'/);
  assert.match(READ_SQL.payments,/lifecycle_state='ACTIVE'/);
  assert.match(READ_SQL.payments,/p\.finance_verification_status='VERIFIED'/);
  assert.match(READ_SQL.payments,/alloc\.allocated_total/);
  assert.match(READ_SQL.payments,/NOT EXISTS[\s\S]*payment_allocations other/);
  assert.doesNotMatch(READ_SQL.payments,/payer_account_masked|bank_account_reference|bank_transaction_reference/);
});
test('document listing excludes storage secret; binary requires private current effective verified version and original grant',()=>{
  assert.match(READ_SQL.documents,/document_versions v/);
  assert.match(READ_SQL.documents,/v\.superseded_by/);
  assert.match(READ_SQL.documents,/download_available/);
  assert.doesNotMatch(READ_SQL.documents,/so\.object_name AS|v\.storage_path AS/);
  assert.match(DOCUMENT_DOWNLOAD_SQL,/partner_api_entity_grants g/);
  assert.match(DOCUMENT_DOWNLOAD_SQL,/g\.active=true/);
  assert.match(DOCUMENT_DOWNLOAD_SQL,/bucket\.public=false/);
  assert.match(DOCUMENT_DOWNLOAD_SQL,/so\.storage_state='VERIFIED'/);
  assert.match(DOCUMENT_DOWNLOAD_SQL,/v\.is_current=true/);
  assert.match(DOCUMENT_DOWNLOAD_SQL,/v\.is_effective=true/);
  assert.match(DOCUMENT_DOWNLOAD_SQL,/d\.authority_state='CONFIRMED'/);
  assert.match(src,/storage\/v1\/object\/authenticated\//);
  assert.match(src,/DOCUMENT_BINARY_READ/);
  assert.match(src,/Cache-Control":"private, no-store/);
  assert.match(src,/Content-Disposition":"attachment/);
});
test('revocation manifest, scoped delta and audit precede bytes',()=>{
  assert.match(src,/path==="\/v1\/scope"/);
  assert.match(src,/path==="\/v1\/changes"/);
  assert.match(src,/Remove previously cached record IDs absent/);
  assert.match(src,/const recorded=await audited/);
  assert.match(src,/if\(recorded\.status!==200\)/);
  assert.match(src,/if\(!await canRead\(p\.partner_id,resource\)\)/);
  assert.match(src,/sinceDate\(url\.searchParams\.get\("updated_since"\)\)/);
  assert.match(OPENAPI_SPEC.info.description,/Revocations stop future reads immediately/);
});
test('OpenAPI lists existing + new paths, bearer, binary and verified finance warning',()=>{
  const paths=OPENAPI_SPEC.paths;
  for(const p of ['/health','/openapi.json','/v1/catalog','/v1/scope','/v1/changes','/v1/{resource}','/v1/{resource}/{id}','/v1/documents/{id}/download'])
    assert.ok(paths[p]?.get,'missing OpenAPI GET '+p);
  assert.equal(OPENAPI_SPEC.components.securitySchemes.PartnerBearer.scheme,'bearer');
  assert.match(OPENAPI_SPEC.components.schemas.Payment.description,/VERIFIED/);
  assert.match(OPENAPI_SPEC.components.schemas.Wagon.description,/none currently granted/);
  assert.match(OPENAPI_SPEC.paths['/v1/documents/{id}/download'].get.description,/current/);
  assert.equal(Object.keys(paths).every(p=>Object.keys(paths[p]).every(m=>m==='get')),true);
});

test('canonical binary checksum gate',()=>{
 assert.match(src,/DOCUMENT_VERIFICATION_FAILED/);
 assert.match(src,/crypto\.subtle\.digest/);
 assert.match(src,/bytes\.byteLength/);
 assert.match(src,/new Response\(bytes,/);
});
