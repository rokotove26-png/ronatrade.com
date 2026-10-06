import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const migration=fs.readFileSync(
  'supabase/migrations/20261006195500_finance_cash_counterparty_alias_backfill_v2.sql',
  'utf8'
);
const ui=fs.readFileSync('functions/portal/cash-r2-ui.js','utf8');

test('verified Universal alias resolves only to existing stable client entity',()=>{
  assert.match(migration,/CLIENT:RONA-C003/);
  assert.match(migration,/UNVERSAL SOLYARIS GRAND LLC/);
  assert.match(migration,/PAYEV-2026-000020/);
  assert.match(migration,/PAYEV-2026-000021/);
  assert.match(migration,/PAYEV-2026-000022/);
  assert.match(migration,/CANONICAL_CLIENT\+VERIFIED_BANK_PAYMENTS/);
  assert.match(migration,/INCOMING','USD/);
});

test('verified Garant payment anchors a stable counterparty ID and exact controlled aliases',()=>{
  assert.match(migration,/COUNTERPARTY:GARANT/);
  assert.match(migration,/PAYEV-2026-000023/);
  assert.match(migration,/ООО ГАРАНТ/);
  assert.match(migration,/VERIFIED_PAYMENT_CONTROLLED_ALIAS/);
  assert.match(migration,/EXACT_VERIFIED_PAYMENT/);
  assert.match(migration,/OUTGOING','RUB/);
  assert.doesNotMatch(migration,/similarity\s*\(/i);
  assert.doesNotMatch(migration,/levenshtein\s*\(/i);
});

test('backfill mutates identity registry/cache only and preserves bank facts',()=>{
  assert.match(migration,/finance_counterparty_identities_v1/);
  assert.match(migration,/finance_counterparty_aliases_v1/);
  assert.match(migration,/refresh_finance_cash_projection_cache_v1\(true\)/);
  assert.match(migration,/BANK:BAKAI/);
  assert.match(migration,/CASH_IDENTITY_BANK_FEE_PRECEDENCE_REGRESSION/);
  assert.match(migration,/CASH_IDENTITY_UNSTABLE_CANONICAL_ID/);
  assert.doesNotMatch(migration,/update\s+portal_private\.finance_cash_operations_v1/i);
  assert.doesNotMatch(migration,/delete\s+from\s+portal_private\.finance_cash_operations_v1/i);
  assert.doesNotMatch(migration,/update\s+portal_private\.payments/i);
  assert.doesNotMatch(migration,/insert\s+into\s+portal_private\.payments/i);
});

test('period UI renders one row per resolved stable entity',()=>{
  assert.ok(ui.includes("key=party.resolved?'ENTITY:'+party.id:'SOURCE:'+sourceIdentityKey(x)"));
  assert.ok(ui.includes("currencySubtotalNode(xs,amountField)"));
  assert.doesNotMatch(ui,/party\.id\+'\|'\+txt\(x\.currency\)/);
});
