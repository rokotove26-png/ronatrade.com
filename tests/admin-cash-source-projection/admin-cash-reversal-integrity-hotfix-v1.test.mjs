import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const sql=fs.readFileSync('supabase/migrations/20261006203000_admin_cash_reversal_integrity_hotfix_v1.sql','utf8');
const ui=fs.readFileSync('functions/portal/cash-r2-ui.js','utf8');

test('stable reversal alias contract',()=>{
  assert.ok(sql.includes('GARANT_REVERSAL_IN_20261005'));
  assert.ok(sql.includes('COUNTERPARTY:GARANT'));
  assert.ok(sql.includes('EXACT_SOURCE_LOCKED_REVERSAL_MATCH'));
});

test('exact Finance pairing remains fail closed',()=>{
  assert.ok(sql.includes('v_candidate_count <> 1'));
  assert.ok(sql.includes('candidate_count=1'));
  assert.ok(sql.includes('CASH_GARANT_REVERSAL_PAIR_NOT_MATCHED'));
});

test('Cash integrity gate remains strict after cache refresh',()=>{
  assert.ok(sql.includes('refresh_finance_cash_projection_cache_v1(true)'));
  assert.ok(sql.includes('CASH_PROJECTION_UNRESOLVED_REVERSALS_REMAIN'));
  assert.ok(ui.includes('unresolvedReversals===0'));
  assert.ok(ui.includes('pairUnresolved===0'));
  assert.ok(ui.includes('paymentUnresolved===0'));
});
