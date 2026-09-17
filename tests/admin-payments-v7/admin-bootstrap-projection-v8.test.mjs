import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  ADMIN_PAYMENTS_V8_BOOTSTRAP_CONTRACT,
  createAdminPaymentsV8BootstrapProjector,
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

test('bootstrap projection runtime contains no production-deal or production-amount hardcode and does not read legacy owner summary', async () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const moduleSource = await readFile(new URL('../../supabase/functions/rona-portal-api/admin-payments-v8-bootstrap-projection.mjs', import.meta.url), 'utf8');
  const entrySource = await readFile(new URL('../../supabase/functions/rona-portal-api/application-business-bootstrap-v2.ts', import.meta.url), 'utf8');
  const source = `${moduleSource}\n${entrySource}`;
  for (const forbidden of ['DEAL-2026-011', '225900', '527100', '35574.47', '190325.53', '6225.53', 'owner_deal_finance_summary']) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not be hardcoded in runtime source`);
  }
  assert.ok(here);
});
