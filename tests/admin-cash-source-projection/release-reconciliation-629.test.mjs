import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const mustExist=[
  'supabase/migrations/20260918130000_finance_admin_cash_source_projection_v1.sql',
  'supabase/migrations/20260918132500_finance_admin_cash_cumulative_ledger_v2.sql',
  'supabase/migrations/20260918171000_finance_cash_counterparty_identity_v1.sql',
  'supabase/migrations/20260918184500_finance_cash_stable_entity_identity_hold_629.sql',
  'supabase/functions/rona-accounting-statement-intake/index.ts',
  'supabase/functions/rona-accounting-mail-bridge/index.ts',
  'supabase/functions/rona-role-mail-bridge/index.ts',
  'tests/admin-cash-source-projection/source-projection.test.mjs',
  'tests/admin-cash-source-projection/cumulative-ledger-v2.test.mjs',
  'tests/admin-cash-source-projection/counterparty-identity-v1.test.mjs',
  'tests/admin-cash-source-projection/hold-629-stable-entity-id.test.mjs',
  'tests/admin-cash-source-projection/hold-629-production-regression.sql'
];

test('release baseline contains the selected Finance Cash artifacts only by explicit path',()=>{
  for(const path of mustExist)assert.ok(fs.existsSync(path),path);
});

test('release role-mail bridge contains the production Finance statement intake hook',()=>{
  const source=fs.readFileSync('supabase/functions/rona-role-mail-bridge/index.ts','utf8');
  assert.ok(source.includes('triggerFinanceCashStatementIntake'));
  assert.ok(source.includes('/functions/v1/rona-accounting-statement-intake'));
  assert.ok(source.includes('finance@ronaoil.com'));
});

test('reconciled migrations preserve source-lock and Admin RPC boundaries',()=>{
  const source=fs.readFileSync('supabase/migrations/20260918130000_finance_admin_cash_source_projection_v1.sql','utf8');
  const cumulative=fs.readFileSync('supabase/migrations/20260918132500_finance_admin_cash_cumulative_ledger_v2.sql','utf8');
  const identity=fs.readFileSync('supabase/migrations/20260918171000_finance_cash_counterparty_identity_v1.sql','utf8');
  const stable=fs.readFileSync('supabase/migrations/20260918184500_finance_cash_stable_entity_identity_hold_629.sql','utf8');

  assert.ok(source.includes("owner_r1_actor('ADMIN')"));
  assert.ok(source.includes('source_locked'));
  assert.ok(cumulative.includes('finance_cash_statement_checkpoint_audit_v2'));
  assert.ok(cumulative.includes("'REVERSAL'"));
  assert.ok(identity.includes('counterparty_resolution_status'));
  assert.ok(stable.includes("'UNRESOLVED_NO_STABLE_ENTITY_ID'"));
  assert.doesNotMatch(stable,/then 'PAYMENT:'\|\|x\.finance_payment_id/);
});

test('repository reconciliation does not embed effective-payment semantics before Finance handoff',()=>{
  const ui=fs.readFileSync('functions/portal/cash-r2-ui.js','utf8');
  assert.ok(ui.includes("summaryMap(p,'external_payment')"));
  assert.doesNotMatch(ui,/effective_external_payment|effective_payment_amount|reversal_match_id/);
});
