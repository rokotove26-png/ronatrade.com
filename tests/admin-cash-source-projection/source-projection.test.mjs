import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root,'supabase/migrations/20260918130000_finance_admin_cash_source_projection_v1.sql'),'utf8');
const intake = fs.readFileSync(path.join(root,'supabase/functions/rona-accounting-statement-intake/index.ts'),'utf8');
const bridge = fs.readFileSync(path.join(root,'supabase/functions/rona-accounting-mail-bridge/index.ts'),'utf8');

test('Admin Cash projection keeps external, FX and own-account semantics separate',()=>{
  for(const token of ['EXTERNAL_INFLOW','EXTERNAL_PAYMENT','FX_CONVERSION','OWN_ACCOUNT_TRANSFER','UNCLASSIFIED']){
    assert.ok(migration.includes(token), token);
  }
  assert.ok(migration.includes("owner_r1_actor('ADMIN')"));
  assert.ok(migration.includes('with (security_invoker = true)'));
  assert.ok(migration.includes('FINANCE_CASH_STATEMENT_BALANCE_MISMATCH'));
  assert.ok(migration.includes('FINANCE_CASH_STATEMENT_OPERATION_TOTAL_MISMATCH'));
  assert.ok(migration.includes("revoke all on function public.rona_admin_cash_source_projection_v1(date,date) from public,anon"));
});

test('statement intake source-locks XLSX and materializes Finance cash projection',()=>{
  assert.ok(intake.includes('sha256Hex'));
  assert.ok(intake.includes('parseStatementSheet'));
  assert.ok(intake.includes('source_checksum_sha256'));
  assert.ok(intake.includes('source_set_identity'));
  assert.ok(intake.includes('finance_cash_ingest_statement_v1'));
  assert.ok(intake.includes('cash_projection'));
});

test('finance mailbox automatically triggers bank statement intake',()=>{
  assert.ok(bridge.includes('likelyBankStatementSubject'));
  assert.ok(bridge.includes('triggerStatementIntake'));
  assert.ok(bridge.includes('/functions/v1/rona-accounting-statement-intake'));
});
