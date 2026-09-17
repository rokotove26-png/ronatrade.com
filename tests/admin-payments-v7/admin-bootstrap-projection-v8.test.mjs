import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT,
  FINANCE_RECONCILIATION_DIFFERENCE_SOURCE,
  createAdminPaymentsV8BootstrapProjector,
  normalizeFinanceReconciliationDifferencePublication,
  normalizeFinanceReconciliationDifferenceBreakdown,
} from '../../supabase/functions/rona-portal-api/admin-payments-v8-bootstrap-projection.mjs';

const route = (url) => url.pathname;
const request = () => new Request('https://example.test/v1/admin/bootstrap', { method: 'GET' });
const baseResponse = () => new Response(JSON.stringify({
  ok: true,
  data: {
    dealFinanceSummaries: [{ deal_id: 'QA-DEAL-STALE', received_amount: 0 }],
  },
}), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });

const projection = {
  contract: 'ADMIN_PAYMENTS_V7',
  deals: [{
    deal_id: 'QA-DEAL-CURRENT',
    verified_received: { amount: '300', currency: 'USD', status: 'AUTHORITATIVE' },
    due_now: { amount: '0', currency: 'USD', status: 'AUTHORITATIVE' },
    future_conditional: { amount: '700', currency: 'USD', status: 'AUTHORITATIVE' },
    actual_spend: { amount: '50', currency: 'USD', status: 'AUTHORITATIVE' },
    remaining_execution: { amount: '250', currency: 'USD', status: 'AUTHORITATIVE' },
  }],
  finance_authority_projection_reconciliation: { status: 'AUTHORITATIVE_ALIGNED' },
};

test('admin bootstrap exposes the current Payments projection without replacing unrelated bootstrap data', async () => {
  const projector = createAdminPaymentsV8BootstrapProjector({
    sql: () => {},
    apiRoute: route,
    readProjection: async () => structuredClone(projection),
    logger: { error() {} },
  });
  const response = await projector(request(), baseResponse());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-rona-admin-payments-v8-bootstrap'), `${ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT}:authoritative`);
  const body = await response.json();
  assert.deepEqual(body.data.paymentsV7Projection, projection);
  assert.deepEqual(body.data.dealFinanceSummaries, [{ deal_id: 'QA-DEAL-STALE', received_amount: 0 }]);
  assert.equal(body.data.payments_v8_projection_contract, ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT);
});

test('admin bootstrap fails closed when the authoritative Payments projection cannot be read', async () => {
  const projector = createAdminPaymentsV8BootstrapProjector({
    sql: () => {},
    apiRoute: route,
    readProjection: async () => { throw new Error('QA_CURRENT_AUTHORITY_UNAVAILABLE'); },
    logger: { error() {} },
  });
  const response = await projector(request(), baseResponse());
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('x-rona-admin-payments-v8-bootstrap'), `${ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT}:fail-closed`);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.component, 'ADMIN_PAYMENTS_V8_BOOTSTRAP');
  assert.equal(body.code, 'QA_CURRENT_AUTHORITY_UNAVAILABLE');
  assert.equal(JSON.stringify(body).includes('QA-DEAL-STALE'), false);
});

test('Finance reconciliation difference passes through exact Finance publication only', () => {
  const metric = normalizeFinanceReconciliationDifferencePublication({
    id: 'qa-source-id',
    result_status: 'AUTHORITATIVE',
    amount: '123.4567',
    currency: 'USD',
    snapshot_at: '2026-09-17T20:00:00.000Z',
    source_version: 'QA-FINANCE-V1',
    source_set_identity: 'QA-SOURCE-SET',
    source_refs: ['QA:BANK', 'QA:FINANCE'],
    publisher_identity: 'AI-FINANCE',
    functional_role: 'FINANCE',
    source_locked: true,
    published_at: '2026-09-17T20:01:00.000Z',
  });
  assert.equal(metric.source_contract, FINANCE_RECONCILIATION_DIFFERENCE_SOURCE);
  assert.equal(metric.status, 'AUTHORITATIVE');
  assert.equal(metric.amount, '123.4567');
  assert.equal(metric.currency, 'USD');
  assert.equal(metric.publisher_identity, 'AI-FINANCE');
  assert.equal(metric.functional_role, 'FINANCE');
  assert.equal(metric.source_locked, true);
});

test('Finance reconciliation primary breakdown passes through only complete source-locked USD/RUB components', () => {
  const breakdown = normalizeFinanceReconciliationDifferenceBreakdown([
    {
      currency: 'USD',
      direction: 'PROFICIT',
      amount: '12.3456',
      source_version: 'QA-FINANCE-V2',
      source_set_identity: 'QA-USD-RUB-SOURCE-SET',
      source_refs: ['QA:USD:BANK', 'QA:FINANCE'],
      publisher_identity: 'AI-FINANCE',
      functional_role: 'FINANCE',
      source_locked: true,
      recorded_by: 'SYSTEM_ADMIN',
    },
    {
      currency: 'RUB',
      direction: 'DEFICIT',
      amount: '-78.9',
      source_version: 'QA-FINANCE-V2',
      source_set_identity: 'QA-USD-RUB-SOURCE-SET',
      source_refs: ['QA:RUB:BANK', 'QA:FINANCE'],
      publisher_identity: 'AI-FINANCE',
      functional_role: 'FINANCE',
      source_locked: true,
      recorded_by: 'SYSTEM_ADMIN',
    },
  ]);
  assert.deepEqual(breakdown.map(({ currency, direction, amount }) => ({ currency, direction, amount })), [
    { currency: 'USD', direction: 'PROFICIT', amount: '12.3456' },
    { currency: 'RUB', direction: 'DEFICIT', amount: '-78.9' },
  ]);

  assert.deepEqual(normalizeFinanceReconciliationDifferenceBreakdown([breakdown[0]]), []);
  assert.deepEqual(normalizeFinanceReconciliationDifferenceBreakdown([
    { ...breakdown[0], currency: 'KZT' },
    breakdown[1],
  ]), []);
});

test('Finance reconciliation difference fails closed to TO_VERIFY when publication is absent or not Finance-owned', () => {
  const missing = normalizeFinanceReconciliationDifferencePublication(null);
  assert.equal(missing.status, 'TO_VERIFY');
  assert.equal(missing.amount, null);
  assert.equal(missing.currency, null);

  const foreign = normalizeFinanceReconciliationDifferencePublication({
    id: 'qa-source-id',
    result_status: 'AUTHORITATIVE',
    amount: '999',
    currency: 'USD',
    snapshot_at: '2026-09-17T20:00:00.000Z',
    source_version: 'QA-NON-FINANCE',
    source_set_identity: 'QA-SOURCE-SET',
    source_refs: ['QA:OTHER'],
    publisher_identity: 'AI-OPERATIONS',
    functional_role: 'OPERATIONS_DIRECTOR',
    source_locked: true,
  });
  assert.equal(foreign.status, 'TO_VERIFY');
  assert.equal(foreign.amount, null);
  assert.equal(foreign.currency, null);
});

test('bootstrap projection runtime contains no local reconciliation calculation and no production hardcode', async () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const moduleSource = await readFile(new URL('../../supabase/functions/rona-portal-api/admin-payments-v8-bootstrap-projection.mjs', import.meta.url), 'utf8');
  const entrySource = await readFile(new URL('../../supabase/functions/rona-portal-api/application-business-bootstrap-v2.ts', import.meta.url), 'utf8');
  const source = `${moduleSource}\n${entrySource}`;
  assert.match(moduleSource, /finance_reconciliation_difference_current_v1/);
  assert.match(moduleSource, /finance_reconciliation_difference_components_v1/);
  for (const forbidden of [
    'DEAL-2026-011', '225900', '527100', '35574.47', '190325.53', '6225.53', 'owner_deal_finance_summary',
    'owner_cash_snapshots', 'RECONCILIATION_DIFFERENCE_EQUALS_BANK_BALANCE_MINUS_MANAGEMENT_BALANCE', 'bank_balance[currency]', 'management_balance[currency]',
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not be hardcoded or recalculated in runtime source`);
  }
  assert.ok(here);
});