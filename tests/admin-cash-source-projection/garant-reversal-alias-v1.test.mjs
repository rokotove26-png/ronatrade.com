import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const sql=fs.readFileSync('supabase/migrations/20261006202500_finance_cash_garant_reversal_alias_v1.sql','utf8');
const ui=fs.readFileSync('functions/portal/cash-r2-ui.js','utf8');

test('Garant reversal uses the approved stable entity and exact alias',()=>{
  for(const token of [
    'GARANT_REVERSAL_IN_20261005',
    'COUNTERPARTY:GARANT',
    'ООО ГАРАНТ',
    'EXACT_SOURCE_LOCKED_REVERSAL_MATCH',
    'CASH_GARANT_REVERSAL_PAIR_NOT_MATCHED'
  ]) assert.ok(sql.includes(token),token);
});

test('Finance exact reversal gate stays deterministic',()=>{
  assert.ok(sql.includes('v_candidate_count <> 1'));
  assert.ok(sql.includes('finance_cash_reversal_purpose_key_v1'));
  assert.ok(sql.includes('candidate_count=1'));
});

test('projection refresh completes only with zero unresolved reversals',()=>{
  assert.ok(sql.includes('refresh_finance_cash_projection_cache_v1(true)'));
  assert.ok(sql.includes('CASH_PROJECTION_UNRESOLVED_REVERSALS_REMAIN'));
  assert.ok(ui.includes('unresolvedReversals===0'));
  assert.ok(ui.includes('pairUnresolved===0'));
  assert.ok(ui.includes('paymentUnresolved===0'));
});
