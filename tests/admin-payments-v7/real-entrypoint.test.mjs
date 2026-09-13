import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRonaOwnerAiSyncV7Handler } from '../../supabase/functions/rona-owner-ai-sync/admin-payments-v7-integration.mjs';

function response(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function rawSources() {
  return {
    generatedAt: '2026-09-13T12:00:00Z', sourceAsOf: '2026-09-13T12:00:00Z',
    capabilities: { paymentBusinessAuthority: false, financeAuthority: false, resourceChain: false },
    deals: [{ id: 'deal-key', deal_id: 'DEAL-TEST', client_key: 'client-key', contract_key: 'contract-key', business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' }],
    workflows: [{ deal_key: 'deal-key', payment_handoff_state: 'READY', cancellation_state: 'ACTIVE' }],
    clients: [{ id: 'client-key', legal_name: 'Client' }],
    contracts: [{ id: 'contract-key', contract_id: 'CONTRACT-TEST' }],
    payments: [{ id: 'payment-key', payment_id: 'PAYMENT-TEST', payment_at: '2026-09-13T10:00:00Z', payment_direction: 'INCOMING', payment_kind: 'CLIENT_PAYMENT', amount: '40', currency: 'USD', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'VERIFIED', candidate_deal_ids: ['DEAL-TEST'], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' }],
    paymentAllocations: [{ id: 'allocation-key', payment_key: 'payment-key', deal_key: 'deal-key', allocated_amount: '40', allocation_status: 'VERIFIED', finance_status: 'PAID', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' }],
    paymentAllocationHistory: [], ownerOutgoingPaymentFacts: [], paymentBusinessAttributions: [], paymentBusinessAttributionLines: [], dealFinanceAuthorities: [], resourceChains: [],
  };
}

function productionShapedRuntime() {
  return async (req) => {
    const auth = req.headers.get('authorization');
    if (!auth) return response(401, { ok: false, code: 'PORTAL_ACCESS_DENIED' });
    if (req.method !== 'GET') return response(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
    if (new URL(req.url).pathname !== '/admin/sync') return response(404, { ok: false, code: 'ROUTE_NOT_FOUND' });
    if (auth !== 'Bearer admin') return response(403, { ok: false, code: 'ROLE_MISMATCH' });
    return response(200, { ok: true, data: { railTariffs: [{ tariff_key: 'rail-1' }], aiRuntime: { enabled: true }, aiEmployees: [{ identity_id: 'AI-1' }], homeCoordination: { totals: {} }, agentRewardsFragment: { rows: [] }, marketAnalystFragment: { analytics: [] }, financeFragment: { legacyPaymentsState: 'PRESERVED_NON_CANONICAL' } } });
  };
}

function countV7Contracts(value) {
  if (!value || typeof value !== 'object') return 0;
  let count = value.contract === 'ADMIN_PAYMENTS_V7' ? 1 : 0;
  for (const item of Object.values(value)) count += countV7Contracts(item);
  return count;
}

test('U — REAL AUTHENTICATED GET /admin/sync production-shaped entrypoint', async () => {
  const runtimeSource = await readFile(new URL('../../supabase/functions/rona-owner-ai-sync/runtime.ts', import.meta.url), 'utf8');
  const indexSource = await readFile(new URL('../../supabase/functions/rona-owner-ai-sync/index.ts', import.meta.url), 'utf8');
  assert.match(runtimeSource, /req\.method!==\"GET\"/);
  assert.match(runtimeSource, /path===\"\/admin\/sync\"/);
  assert.match(runtimeSource, /requireRole\(ctx,\"ADMIN\"\)/);
  assert.doesNotMatch(indexSource, /enrichOwnerPaymentsAccountingCurrencyProgressV6/);
  assert.match(indexSource, /createRonaOwnerAiSyncV7Handler/);

  let sourceReads = 0;
  const handler = createRonaOwnerAiSyncV7Handler({
    runtimeHandler: productionShapedRuntime(),
    readRawSources: async () => { sourceReads += 1; return rawSources(); },
  });
  const url = 'https://example.test/functions/v1/rona-owner-ai-sync/admin/sync';

  const unauth = await handler(new Request(url));
  assert.equal(unauth.status, 401);
  assert.equal(sourceReads, 0);

  const nonAdmin = await handler(new Request(url, { headers: { authorization: 'Bearer agent' } }));
  assert.equal(nonAdmin.status, 403);
  assert.equal(sourceReads, 0);

  const post = await handler(new Request(url, { method: 'POST', headers: { authorization: 'Bearer admin' }, body: '{}' }));
  assert.equal(post.status, 405);
  assert.equal(sourceReads, 0);

  const ok = await handler(new Request(url, { headers: { authorization: 'Bearer admin' } }));
  assert.equal(ok.status, 200);
  assert.equal(sourceReads, 1);
  const payload = await ok.json();
  assert.equal(payload.data.paymentsV7Projection.contract, 'ADMIN_PAYMENTS_V7');
  assert.equal(countV7Contracts(payload), 1);
  assert.deepEqual(payload.data.railTariffs, [{ tariff_key: 'rail-1' }]);
  assert.deepEqual(payload.data.aiRuntime, { enabled: true });
  assert.equal(payload.data.financeFragment.legacyPaymentsState, 'PRESERVED_NON_CANONICAL');
  assert.equal(ok.headers.get('x-rona-owner-payments-semantics'), 'ADMIN_PAYMENTS_V7');
});
