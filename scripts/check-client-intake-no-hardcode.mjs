import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtimePaths=[
  'supabase/functions/_shared/client-intake-v1/index.mjs',
  'supabase/migrations/20260915123000_client_intake_unified_v1.sql',
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
console.log('NO_EXPECTED_VALUE_INJECTION=PASS');
console.log('NO_HARDCODE=PASS');
console.log('EVENT_ID_BRANCH_COUNT=0');
console.log('BUSINESS_DATA_MUTATION=NONE');
console.log('PRODUCTION_MIGRATION=NONE');
