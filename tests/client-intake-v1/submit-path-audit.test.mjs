import assert from 'node:assert/strict';
import fs from 'node:fs';

const base=fs.readFileSync('supabase/migrations/20260915123000_client_intake_unified_v1.sql','utf8');
const compat=fs.readFileSync('supabase/migrations/20260915123100_client_intake_reverse_application_policy_v1.sql','utf8');
const all=base+'\n'+compat;
const requiredPolicies=[
  'CLIENT_APPLICATION_PUBLISHED_PRICE_V1',
  'CLIENT_APPLICATION_PROPOSED_PRICE_V1',
  'CLIENT_APPLICATION_SUBMIT_EVENT_V1',
  'DELIVERED_PRICE_CALCULATION_REQUEST_V1',
  'COMMERCIAL_TERMS_REQUEST_V1',
  'CLIENT_MESSAGE_SUBMIT_V1',
  'CLIENT_CLAIM_SUBMIT_V1',
  'CLIENT_PAYMENT_PROOF_SUBMIT_V1',
  'CLIENT_DOCUMENT_ACK_V1',
];
for(const key of requiredPolicies) assert.ok(all.includes(key),`missing routing policy ${key}`);
assert.match(all,/ROUTING_POLICY_MISSING/);
assert.match(all,/client_visible/);
assert.match(all,/admin_visible/);
assert.match(all,/task_required/);
assert.match(all,/acknowledgement_required/);
assert.doesNotMatch(all,/PORTAL-EVT-2d898|PORTAL-EVT-d5cee/);
console.log(`GLOBAL_SUBMIT_PATH_COUNT=${requiredPolicies.length+1}`);
console.log('GLOBAL_SUBMIT_PATH_AUDIT=PASS');
