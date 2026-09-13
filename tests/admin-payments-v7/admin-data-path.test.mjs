import test from 'node:test';
import assert from 'node:assert/strict';
import { attachAdminPaymentsV7Projection } from '../../supabase/functions/rona-portal-api/admin-payments-v7/index.mjs';

test('authenticated Admin data path attaches exactly one canonical projection', () => {
  const rawSources = {
    generatedAt: '2026-09-13T00:00:00Z', sourceAsOf: '2026-09-13T00:00:00Z',
    deals: [], workflows: [], clients: [], contracts: [], payments: [], paymentAllocations: [], paymentAllocationHistory: [],
    paymentBusinessAttributions: [], paymentBusinessAttributionLines: [], dealFinanceAuthorities: [], resourceChains: [],
  };
  const payload = attachAdminPaymentsV7Projection({ actor: { authenticated: true, role: 'ADMIN' }, adminPayload: { existing: true }, rawSources });
  assert.equal(payload.existing, true);
  assert.equal(payload.paymentsV7Projection.contract, 'ADMIN_PAYMENTS_V7');
  assert.throws(() => attachAdminPaymentsV7Projection({ actor: { authenticated: false, role: 'ADMIN' }, rawSources }), /AUTH_REQUIRED/);
});
