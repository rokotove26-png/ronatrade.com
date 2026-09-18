import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const sql=fs.readFileSync(
  path.join(process.cwd(),'supabase/migrations/20260918145500_finance_admin_cash_canonical_counterparty_identity_v1.sql'),
  'utf8'
);

test('Finance Cash identity layer exposes canonical and raw identities without changing ledger semantics',()=>{
  for(const token of [
    'canonical_counterparty_id',
    'canonical_counterparty_name',
    'counterparty_role',
    'raw_source_counterparty',
    'bank_intermediary_name',
    'counterparty_identity_source',
    'CLIENT:RONA-C002',
    'SUPPLIER:',
    'COUNTERPARTY:SGTRANS',
    'COUNTERPARTY:ORIENT_LOGISTIC',
    'BANK:BAKAI'
  ]) assert.ok(sql.includes(token),token);

  assert.ok(sql.includes('finance_cash_source_projection_payload_v1'));
  assert.ok(sql.includes("jsonb_set(base.payload,'{operations}'"));
  assert.ok(sql.includes("OUT-2026-004-BNK"));
  assert.ok(sql.includes("190832326"));
  assert.ok(sql.includes("RONA-S001-CTR-2026-001"));
});

test('migration is projection-only and does not mutate Finance, Payments or Deals business rows',()=>{
  assert.doesNotMatch(sql,/\binsert\s+into\s+portal_private\.(payments|payment_allocations|deals)\b/i);
  assert.doesNotMatch(sql,/\bupdate\s+portal_private\.(payments|payment_allocations|deals)\b/i);
  assert.doesNotMatch(sql,/\bdelete\s+from\s+portal_private\.(payments|payment_allocations|deals)\b/i);
  assert.ok(sql.includes('create or replace view portal_private.finance_cash_operations_identity_v1'));
  assert.ok(sql.includes('create or replace function portal_private.finance_cash_source_projection_payload_v2_identity'));
});
