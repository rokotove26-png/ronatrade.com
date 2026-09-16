import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('supabase/migrations/20260915123000_client_intake_unified_v1.sql','utf8');
const correction=fs.readFileSync('supabase/migrations/20260915123200_client_intake_correction_api_v1.sql','utf8');
const runtimeFix=fs.readFileSync('supabase/migrations/20260915123300_client_intake_stage21_runtime_fix.sql','utf8');
const executor=fs.readFileSync('supabase/migrations/20260915123400_client_intake_automatic_executor_v1.sql','utf8');
const completion=fs.readFileSync('supabase/migrations/20260916010000_client_intake_p1_completion_v1.sql','utf8');
const bootstrap=fs.readFileSync('supabase/functions/rona-portal-api/bootstrap.ts','utf8');
const api=fs.readFileSync('supabase/functions/rona-portal-api/stage21-bootstrap.ts','utf8');
const stage23=fs.readFileSync('supabase/functions/rona-portal-api/stage23-bootstrap.ts','utf8');
const allSql=[sql,correction,runtimeFix,executor,completion].join('\n');

for(const token of [
  'client_intake_v1','client_intake_routing_registry_v1','client_intake_routing_outbox_v1','client_intake_task_links_v1',
  'client_intake_corrections_v1','client_intake_audit_v1','client_intake_client_projection_v1','client_intake_admin_projection_v1',
  'client_intake_projection_for_lk_v1','client_intake_submit_contract_v1','ensure_client_intake_from_reverse_event_v1',
  'ensure_client_intake_from_application_v1','process_client_intake_outbox_v1','reconcile_client_intake_v1',
  'client_intake_reconciliation_tick_v1','cron.schedule',
  'PENDING','QUEUED','PROCESSING','APPLIED','FAILED_RETRYABLE','DEAD_LETTER',
  'ACCEPT_PUBLISHED_PRICE','CLIENT_PROPOSED_PRICE','PUBLISHED_PRICE_APPLICATION','CLIENT_PROPOSED_PRICE_APPLICATION',
  'DELIVERED_PRICE_CALCULATION_REQUEST_V1','ROUTING_POLICY_MISSING','REQUIRED_TASK_MISSING','STUCK_PROCESSING_RECOVERED'
]) assert.ok(allSql.includes(token),`missing ${token}`);

const digestCalls=[...allSql.matchAll(/(?:[A-Za-z_][\w]*\.)?digest\s*\(/g)].map(x=>x[0]);
assert.ok(digestCalls.length>=2,'expected pgcrypto digest calls');
assert.ok(digestCalls.every(x=>x.startsWith('extensions.digest(')),`unqualified digest: ${digestCalls.join(', ')}`);
assert.doesNotMatch(allSql,/['"]CLIENT_PROPOSED['"]/);
assert.match(sql,/ACCEPT_PUBLISHED_PRICE[\s\S]{0,160}PUBLISHED_PRICE_APPLICATION/);
assert.match(sql,/CLIENT_PROPOSED_PRICE[\s\S]{0,160}CLIENT_PROPOSED_PRICE_APPLICATION/);
assert.match(runtimeFix,/on conflict on constraint client_intake_task_links_v1_pkey/i);
assert.match(executor,/drop trigger if exists client_intake_outbox_auto_consumer_v1/i);
assert.match(executor,/client_intake_application_trigger_v1[\s\S]*ensure_client_intake_from_application_v1[\s\S]*process_client_intake_outbox_v1\(100\)/i);
assert.match(executor,/client_intake_reverse_event_trigger_v1[\s\S]*ensure_client_intake_from_reverse_event_v1[\s\S]*process_client_intake_outbox_v1\(100\)/i);
assert.match(sql,/client_intake_reconciliation_tick_v1/);
assert.match(sql,/cron\.schedule\('rona-client-intake-reconcile-v1','\*\/2 \* \* \* \*'/);
assert.match(sql,/REQUIRED_TASK_MISSING/);
assert.match(sql,/not exists\([\s\S]*client_intake_routing_outbox_v1/i);
assert.match(sql,/before update or delete on portal_private\.client_intake_corrections_v1/i);
assert.doesNotMatch(allSql,/update\s+portal_private\.portal_reverse_events\s+set\s+payload/i);
assert.doesNotMatch(allSql,/update\s+portal_private\.client_applications\s+set\s+quantity_tonnes/i);

assert.match(correction,/append_client_intake_correction_v1/);
assert.match(correction,/CLIENT_INTAKE_CORRECTION_SOURCE_VALUE_MISMATCH/);
assert.doesNotMatch(correction,/update\s+portal_private\.(portal_reverse_events|client_applications)/i);

assert.match(bootstrap,/import "\.\/stage23-bootstrap\.ts"/);
assert.match(stage23,/import\("\.\/stage21-bootstrap\.ts"\)/);
assert.match(stage23,/CLIENT_INTAKE_DURABILITY_UNAVAILABLE/);
assert.match(stage23,/CLIENT_INTAKE_DURABILITY_MISSING/);
assert.match(api,/77588541119bb1a96375beed3e853e067ab1422f/);
assert.match(api,/\/v1\/client\/applications/);
assert.match(api,/\/v1\/events/);
assert.match(api,/\/v1\/client\/context/);
assert.match(api,/\/v1\/admin\/bootstrap/);
assert.match(api,/client_intake_projection_for_lk_v1/);
assert.match(api,/client_intake_submit_contract_v1/);
assert.match(api,/mergeIntoApplications/);
for(const field of ['intake_id','durable_id','source_id','submitted_at','status'])assert.ok(api.includes(field),`submit response field missing ${field}`);

assert.match(completion,/not exists\([\s\S]*source_kind='PORTAL_REVERSE_EVENT'/i);
assert.match(completion,/not exists\([\s\S]*source_kind='CLIENT_APPLICATION'/i);
assert.match(completion,/rona_client_application_projection/);
assert.match(completion,/client_intake_effective_payload_v1/);

console.log('DIGEST_SCHEMA_FIX=PASS');
console.log('PRICE_MODE_PRODUCTION_ENUM=PASS');
console.log('AUTOMATIC_OUTBOX_CONSUMER_CONTRACT=PASS');
console.log('RECONCILIATION_EXECUTOR_CONTRACT=PASS');
console.log('REAL_LK_PROJECTION_WIRING_CONTRACT=PASS');
console.log('SUBMIT_DURABLE_RESPONSE_CONTRACT=PASS');
console.log('PRODUCTION_LINEAGE_PIN_CONTRACT=PASS');
console.log('STAGE23_FAIL_CLOSED_CONTRACT=PASS');
console.log('BOUNDED_HISTORY_PROGRESS_CONTRACT=PASS');
console.log('RAW_SOURCE_IMMUTABILITY_CONTRACT=PASS');
