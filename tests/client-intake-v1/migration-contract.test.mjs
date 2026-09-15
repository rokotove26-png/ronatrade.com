import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../../supabase/migrations/20260915123000_client_intake_unified_v1.sql',import.meta.url),'utf8');
const required=[
  'client_intake_v1','client_intake_routing_registry_v1','client_intake_routing_outbox_v1','client_intake_task_links_v1',
  'client_intake_corrections_v1','client_intake_audit_v1','client_intake_client_projection_v1','client_intake_admin_projection_v1',
  'ensure_client_intake_from_reverse_event_v1','ensure_client_intake_from_application_v1','process_client_intake_outbox_v1','reconcile_client_intake_v1',
  'PENDING','QUEUED','PROCESSING','APPLIED','FAILED_RETRYABLE','DEAD_LETTER',
  'DELIVERED_PRICE_CALCULATION_REQUEST_V1','OPERATIONS_DIRECTOR','ROUTING_POLICY_MISSING','CLIENT_INTAKE_CORRECTION_APPEND_ONLY',
  'actionable_client_intake_total','unrouted_client_intake_count','client_invisible_intake_count','admin_invisible_intake_count','stuck_intake_count','oldest_stuck_intake_age'
];
for(const token of required) assert.ok(sql.includes(token),`missing ${token}`);
assert.match(sql,/unique\s*\(source_kind\s*,\s*source_record_id\)/i);
assert.match(sql,/unique\s*\(intake_id\s*,\s*stage_key\)/i);
assert.match(sql,/before update or delete on portal_private\.client_intake_corrections_v1/i);
assert.match(sql,/new\.actor_role='CLIENT'.*ensure_client_intake_from_reverse_event_v1/s);
assert.doesNotMatch(sql,/new\.actor_role\s*=\s*'CLIENT'[\s\S]{0,160}then\s+return\s+new;/i);
assert.doesNotMatch(sql,/10000\s*\/\s*10/);
assert.doesNotMatch(sql,/PORTAL-EVT-2d898|PORTAL-EVT-d5cee/);
assert.doesNotMatch(sql,/update\s+portal_private\.portal_reverse_events\s+set\s+payload/i);
assert.doesNotMatch(sql,/update\s+portal_private\.client_applications\s+set\s+quantity_tonnes/i);
console.log('CLIENT_INTAKE_MIGRATION_CONTRACT=PASS');
console.log('BLANKET_CLIENT_SUPPRESSION_REMOVED=PASS');
console.log('RAW_SOURCE_IMMUTABILITY_CONTRACT=PASS');
