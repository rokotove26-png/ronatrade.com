import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../supabase/migrations/20260917012000_payments_v8_atomic_canonical_state_executor_v1.sql', import.meta.url), 'utf8');

test('atomic canonical state executor is approval-gated and proposal-driven', () => {
  assert.match(sql, /ATOMIC_MATERIALIZE_PAYMENTS_V7_CANONICAL_STATE/);
  assert.match(sql, /jsonb_array_elements\(v_receipts\)/);
  assert.match(sql, /jsonb_each\(v_per_deal\)/);
  assert.match(sql, /RECEIVED_UNVERIFIED/);
  assert.match(sql, /payment_allocations/);
  assert.match(sql, /payment_business_attributions_v7/);
  assert.match(sql, /deal_finance_authority_v7/);
  assert.match(sql, /FINANCE_CANONICAL_PAYMENT_SCHEDULE_POLICY_V1/);
});

test('atomic canonical state executor contains no deal/client/amount patch literals', () => {
  for (const forbidden of [
    /DEAL-2026-\d+/,
    /94125|131775|6225\.53|35574\.47|225900|527100|713220|481662\.96/,
    /ГазОнэ|UNVERSAL SOLYARIS|FARGONA/i,
  ]) assert.doesNotMatch(sql, forbidden);
});
