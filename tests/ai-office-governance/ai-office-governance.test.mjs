import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260928145226_ai_office_governance_optimization_v1.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('owner-approved Operations and System Admin policies are durable and role scoped', () => {
  assert.match(sql, /OPERATIONS_AI_OFFICE_GOVERNANCE_V1/);
  assert.match(sql, /SYSTEM_ADMIN_AI_OFFICE_GOVERNANCE_V1/);
  assert.match(sql, /GLOBAL_OPERATIONS_ROLE/);
  assert.match(sql, /GLOBAL_SYSTEM_ADMIN_ROLE/);
  assert.match(sql, /OWNER_INSTRUCTION:2026-09-28/);
  assert.match(sql, /APPEND_VERSION_ONLY/);
});

test('CURRENT_STATE_FIRST policy projection remains before task projection', () => {
  const policy = sql.indexOf('v_policies := portal_private.ai_role_global_policies_current_v1(p_role);');
  const tasks = sql.indexOf('from portal_private.staff_tasks t');
  assert.ok(policy >= 0 && tasks > policy);
  assert.match(sql, /global_policy_must_apply_before_tasks',true/);
});

test('task conclusion divergence is fail-closed diagnostic, never auto-close', () => {
  assert.match(sql, /TASK_OPEN_WITH_TERMINAL_CONCLUSION/);
  assert.match(sql, /REVIEW_REQUIRED_NO_AUTO_CLOSE/);
  assert.match(sql, /task_state_conflicts_fail_closed',true/);
  assert.doesNotMatch(sql, /update\s+portal_private\.staff_tasks/i);
  assert.doesNotMatch(sql, /delete\s+from\s+portal_private\.staff_tasks/i);
});

test('SLA and aging diagnostics are exposed without mutating tasks', () => {
  assert.match(sql, /initial_response_sla_minutes/);
  assert.match(sql, /'HIGH' then 5/);
  assert.match(sql, /'NORMAL' then 15/);
  assert.match(sql, /'LOW' then 60/);
  assert.match(sql, /'sla_state'/);
  assert.match(sql, /'aging_state'/);
  assert.match(sql, /'next_required_action'/);
});

test('commercial routing is canonicalized without deleting legacy compatibility', () => {
  assert.match(sql, /canonical_commercial_role','COMMERCIAL_DIRECTOR'/);
  assert.match(sql, /legacy_aliases',jsonb_build_object\('MARKET_ANALYST','COMMERCIAL_DIRECTOR'\)/);
  assert.match(sql, /ACCOUNTING','status','STAFF_ROLE_PRESENT_AI_ROLE_NOT_MATERIALIZED/);
  assert.match(sql, /TREASURY','status','NOT_MATERIALIZED_AS_AI_OR_STAFF_ROLE/);
});

test('price guard is retained and migration does not publish anything', () => {
  assert.match(sql, /DO_NOT_PUBLISH_BEFORE_ADMIN_APPROVAL/);
  assert.doesNotMatch(sql, /update\s+portal_private\.publications/i);
  assert.doesNotMatch(sql, /insert\s+into\s+portal_private\.publications/i);
});
