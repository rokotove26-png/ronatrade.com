import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root=process.cwd();
const delta=fs.readFileSync(
  path.join(root,'supabase/migrations/20260918184500_finance_cash_stable_entity_identity_hold_629.sql'),
  'utf8'
);
const regression=fs.readFileSync(
  path.join(root,'tests/admin-cash-source-projection/hold-629-production-regression.sql'),
  'utf8'
);

test('canonical_counterparty_id can never fall back to PAYMENT identity',()=>{
  assert.ok(delta.includes('x.resolved_id as final_canonical_id'));
  assert.ok(delta.includes("'UNRESOLVED_NO_STABLE_ENTITY_ID'"));
  assert.ok(!delta.includes("then 'PAYMENT:'||x.finance_payment_id"));
  assert.ok(!delta.includes("'RESOLVED_TRANSACTION_ONLY'"));
  assert.ok(delta.includes("jsonb_build_array('PAYMENT:'||x.finance_payment_id,x.source_ref)"));
});

test('Finance counterparty IDs use stable entity prefixes',()=>{
  assert.ok(delta.includes("'COUNTERPARTY:SGTRANS'"));
  assert.ok(delta.includes("'COUNTERPARTY:ORIENT_LOGISTIC'"));
  assert.ok(delta.includes("'FINANCE_COUNTERPARTY:SGTRANS'"));
  assert.ok(delta.includes("'FINANCE_COUNTERPARTY:ORIENT_LOGISTIC'"));
  assert.ok(delta.includes("lifecycle_state='SUPERSEDED'"));
});

test('System Admin #629 production regression encodes exact acceptance totals',()=>{
  for(const token of [
    "canonical_counterparty_id like 'PAYMENT:%'",
    "'^(CLIENT|SUPPLIER|COUNTERPARTY|BANK):'",
    "canonical_counterparty_name='ЧПТУП «КУЗМАШ»'",
    'v_count<>4',
    'v_amount<>28524960',
    "v_id<>'SUPPLIER:S-009'",
    "UNVERSAL SOLYARIS GRAND",
    'v_count<>2',
    'v_amount<>251070',
    "v_id<>'CLIENT:RONA-C003'",
    'v_count<>43',
    'v_count<>20',
    '1756237.63',
    '231557.04',
    '0.91'
  ]) assert.ok(regression.includes(token),token);
});
