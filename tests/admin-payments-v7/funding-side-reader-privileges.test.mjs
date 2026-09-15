import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260915043000_admin_payments_v7_funding_side_reader.sql'), 'utf8');
const reader = fs.readFileSync(path.join(ROOT, 'supabase/functions/rona-owner-ai-sync/admin-payments-v7-source-reader.mjs'), 'utf8');

test('funding-side reader migration is privilege-only and read-only', () => {
  assert.match(migration, /grant select on portal_private\.finance_events_v7 to rona_payments_v7_reader/i);
  assert.match(migration, /grant execute on function portal_private\.ai_role_global_policies_current_v1\(portal_private\.ai_business_role_enum\) to rona_payments_v7_reader/i);
  assert.doesNotMatch(migration, /\b(?:insert|update|delete|merge|truncate)\b\s+(?:into|portal_private\.)/i);
});

test('source reader reads Finance policy and funding events inside repeatable-read read-only role', () => {
  assert.match(reader, /isolation level repeatable read read only/i);
  assert.match(reader, /set local role rona_payments_v7_reader/i);
  assert.match(reader, /readFinanceEvents/);
  assert.match(reader, /finance_events_v7/);
  assert.match(reader, /ai_role_global_policies_current_v1/);
  assert.match(reader, /OUTGOING_PAYMENT_CONFIRMED/);
});
