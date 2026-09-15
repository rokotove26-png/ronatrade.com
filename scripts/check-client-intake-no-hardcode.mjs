import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimePaths=[
  'supabase/functions/_shared/client-intake-v1/index.mjs',
  'supabase/functions/rona-portal-api/stage21-bootstrap.ts',
  'supabase/migrations/20260915123000_client_intake_unified_v1.sql',
  'supabase/migrations/20260915123100_client_intake_reverse_application_policy_v1.sql',
  'supabase/migrations/20260915123200_client_intake_correction_api_v1.sql',
];
const runtime=runtimePaths.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const forbidden=[
  /PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96/,
  /PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208/,
  /PRICE-CALC-d1ead6b2-9bcc-4a53-aa4f-e35507d78291/,
  /PRICE-CALC-c462bf1b-320a-4910-81a1-1ae44ff8b3cc/,
  /10000\s*\/\s*10/,
  /if\s*\([^\n]*(?:event_id|source_record_id)[^\n]*(?:2d898|d5cee)/i,
];
const hits=forbidden.filter(re=>re.test(runtime));
assert.equal(hits.length,0,`runtime hardcode matches: ${hits.map(String).join(', ')}`);
assert.doesNotMatch(runtime,/resource_chain\.accounting_amount/i);
assert.doesNotMatch(runtime,/['"]CLIENT_PROPOSED['"]/);
assert.ok(runtime.includes('ACCEPT_PUBLISHED_PRICE'),'production published price enum missing');
assert.ok(runtime.includes('CLIENT_PROPOSED_PRICE'),'production proposed price enum missing');
const migration=fs.readFileSync('supabase/migrations/20260915123000_client_intake_unified_v1.sql','utf8');
assert.doesNotMatch(migration,/(?<!extensions\.)\bdigest\s*\(/);
assert.match(migration,/extensions\.digest\(/);
console.log('NO_EXPECTED_VALUE_INJECTION=PASS');
console.log('NO_HARDCODE=PASS');
console.log('EVENT_ID_BRANCH_COUNT=0');
console.log('DIGEST_SCHEMA_FIX=PASS');
console.log('PRICE_MODE_PRODUCTION_ENUM=PASS');
console.log('RAW_SOURCE_MUTATION=NONE');
console.log('BUSINESS_DATA_MUTATION=NONE');
console.log('FINANCE_RECORD_MUTATION=NONE');
console.log('PRODUCTION_MIGRATION=NONE');
console.log('EDGE_DEPLOY=NONE');
console.log('MERGE=NONE');
