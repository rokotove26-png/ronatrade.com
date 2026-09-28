import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260928191800_admin_private_rls_hardening_v1.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

const tables = [
  'admin_impersonation_sessions',
  'admin_impersonation_events',
  'admin_entity_retirement_operations',
  'admin_auth_cleanup_outbox',
];

test('all four Admin-private tables enable RLS', () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`alter table portal_private\\.${table} enable row level security`, 'i'));
  }
});

test('direct client/API roles retain zero table grants', () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`revoke all on portal_private\\.${table} from public, anon, authenticated, service_role`, 'i'));
  }
});

test('RLS is not forced because server-only postgres paths must remain intact', () => {
  assert.match(sql, /force_rls_unexpected/);
  assert.doesNotMatch(sql, /force row level security/i);
});

test('migration contains in-transaction privilege and server-gate QA', () => {
  assert.match(sql, /has_table_privilege/);
  assert.match(sql, /assert_admin_client_impersonation_business_v2/);
  assert.match(sql, /security_definer|prosecdef/i);
});
