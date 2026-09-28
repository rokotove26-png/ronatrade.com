import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260928150924_ai_office_exception_reconciliation_v1.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

test('exception cockpit is explicitly read-only', () => {
  assert.match(sql, /RONA_EXCEPTION_FIRST_COCKPIT_V1/);
  assert.match(sql, /mutation_mode','READ_ONLY_DIAGNOSTIC/);
  assert.doesNotMatch(sql, /update\s+portal_private\.(staff_tasks|portal_reverse_events|deals|client_applications)/i);
  assert.doesNotMatch(sql, /delete\s+from\s+portal_private/i);
});

test('reverse-event reconciliation uses exact authoritative state', () => {
  assert.match(sql, /DEAL_CANCELLED/);
  assert.match(sql, /business_status/);
  assert.match(sql, /APPLICATION_RESOURCE_CONFIRMED/);
  assert.match(sql, /linked_deal_key/);
  assert.match(sql, /HOLD_SOURCE_ENTITY_ABSENT/);
  assert.match(sql, /safe_to_auto_resolve/);
});

test('exception cockpit exposes action, waiting, blocked, stale and conflicts', () => {
  for (const marker of ['ACTION_NOW','WAITING_EXTERNAL','BLOCKED','STALE','STATE_CONFLICTS','RECONCILIATION_CANDIDATES']) {
    assert.ok(sql.includes(marker), `missing cockpit marker ${marker}`);
  }
});

test('diagnostics stay server-only', () => {
  assert.match(sql, /revoke execute on function portal_private\.ai_reverse_event_reconciliation_candidates_v1/);
  assert.match(sql, /revoke execute on function portal_private\.ai_role_exception_cockpit_v1/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = portal_private, pg_catalog/);
});
