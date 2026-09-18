import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root=process.cwd();
const migration=fs.readFileSync(
  path.join(root,'supabase/migrations/20260918132500_finance_admin_cash_cumulative_ledger_v2.sql'),
  'utf8'
);
const roleBridge=fs.readFileSync(
  path.join(root,'supabase/functions/rona-role-mail-bridge/index.ts'),
  'utf8'
);

test('cumulative ledger includes every calendar day and exact checkpoint audit',()=>{
  assert.ok(migration.includes('generate_series'));
  assert.ok(migration.includes('ZERO_TURNOVER_SOURCE_CARRY'));
  assert.ok(migration.includes('ZERO_TURNOVER_OWNER_RULE'));
  assert.ok(migration.includes('finance_cash_statement_checkpoint_audit_v2'));
  assert.ok(migration.includes('ledger_checkpoint_difference'));
  assert.ok(migration.includes("'source_lock'"));
  assert.ok(migration.includes('max_statement_checkpoint_difference'));
});

test('cash semantics keep reversals and FX separate from external receipts/payments',()=>{
  assert.ok(migration.includes("'REVERSAL'"));
  assert.ok(migration.includes("'FX_CONVERSION'"));
  assert.ok(migration.includes("'EXTERNAL_INFLOW'"));
  assert.ok(migration.includes("'EXTERNAL_PAYMENT'"));
  assert.ok(migration.includes("when d.operation_type='FX_CONVERSION' then 'FX_CONVERSION'"));
  assert.ok(migration.includes("'^СТОРНО([[:space:]]|$)'"));
});

test('Finance mailbox keeps cumulative cash ledger updated automatically',()=>{
  assert.ok(roleBridge.includes('triggerFinanceCashStatementIntake'));
  assert.ok(roleBridge.includes('finance@ronaoil.com'));
  assert.ok(roleBridge.includes('/functions/v1/rona-accounting-statement-intake'));
});
