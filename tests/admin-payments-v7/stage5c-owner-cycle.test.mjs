import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildAdminPaymentsV7Projection,
  renderAdminPaymentsV7NativeHtml,
} from '../../supabase/functions/_shared/admin-payments-v7/index.mjs';
import {
  ADMIN_PAYMENTS_V7_OWNER_DECISION_PATH,
  createRonaOwnerAiSyncV7Handler,
} from '../../supabase/functions/rona-owner-ai-sync/admin-payments-v7-integration.mjs';
import {
  PAYMENTS_V7_BROWSER_RUNTIME,
  patchLiveOwnerApiSource,
} from '../../scripts/admin-payments-v7-stage5c-live-source.mjs';

const ref = (id) => ({ source_type: 'TEST', source_id: id, source_version: '1', source_timestamp: '2026-09-13T00:00:00Z', authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT' });
const deal = (key, id) => ({ deal_key: key, deal_id: id, client_display: `Client ${id}`, payment_handoff_state: 'READY', current: true, source_locked: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [ref(key)] });
const payment = () => ({
  payment_key: '20000000-0000-4000-8000-000000000001',
  payment_id: 'PAY-OWNER-1',
  payment_at: '2026-09-13T18:40:00Z',
  counterparty_name: 'Synthetic Counterparty',
  direction: 'OUTGOING',
  kind: 'COUNTERPARTY_PAYMENT',
  amount: '70',
  currency: 'USD',
  bank_fact_status: 'BANK_CONFIRMED',
  finance_verification_status: 'VERIFIED',
  allocation_applicability: 'DEAL_ALLOCATABLE',
  allocation_review_status: 'TO_VERIFY',
  candidate_deal_ids: ['10000000-0000-4000-8000-000000000001'],
  current: true,
  source_locked: true,
  authority_state: 'AUTHORITATIVE',
  lifecycle_state: 'CURRENT',
  authority_refs: [ref('payment-owner-1')],
});

function source() {
  return {
    generatedAt: '2026-09-13T18:40:00Z',
    sourceAsOf: '2026-09-13T18:40:00Z',
    capabilities: {
      paymentBusinessAuthority: true,
      paymentBusinessAuthorityPresent: true,
      paymentBusinessAuthorityReady: true,
      financeAuthority: false,
      resourceChain: false,
    },
    contour: [
      deal('10000000-0000-4000-8000-000000000001', 'DEAL-A'),
      deal('10000000-0000-4000-8000-000000000002', 'DEAL-B'),
    ],
    payments: [payment()],
    attributionClaims: [],
    physicalAllocations: [],
    financeAuthorities: [],
    resourceChains: [],
    validDealKeys: [
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
    ],
  };
}

function claimFromDecision(decision) {
  return {
    ...structuredClone(decision.authority),
    disposition: decision.authority.decision_type,
    lines: structuredClone(decision.authority.lines_snapshot || []),
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [ref(decision.authority.id)],
  };
}

function harness(initial = source()) {
  const state = structuredClone(initial);
  const persisted = [];
  let adminSyncReads = 0;
  const runtimeHandler = async (req) => {
    const path = new URL(req.url).pathname;
    if (path === ADMIN_PAYMENTS_V7_OWNER_DECISION_PATH && req.method === 'POST') {
      return new Response(JSON.stringify({ ok: true, data: { ownerMutationAuth: { userId: 'admin-human', roles: ['ADMIN'] } } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (path === '/admin/sync' && req.method === 'GET') {
      adminSyncReads += 1;
      return new Response(JSON.stringify({ ok: true, data: { shellMarker: 'preserved' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, code: 'ROUTE_NOT_FOUND' }), { status: 404, headers: { 'content-type': 'application/json' } });
  };
  const handler = createRonaOwnerAiSyncV7Handler({
    runtimeHandler,
    readRawSources: async () => structuredClone(state),
    buildSourceBundle: (value) => value,
    buildProjection: (value) => buildAdminPaymentsV7Projection(value),
    persistOwnerDecision: async ({ envelope, decision }) => {
      persisted.push(structuredClone({ envelope, decision }));
      state.attributionClaims.push(claimFromDecision(decision));
      return { id: decision.authority.id };
    },
    logger: { error() {} },
  });
  return { state, persisted, handler, adminSyncReads: () => adminSyncReads };
}

async function postOwner(handler, body) {
  return handler(new Request(`https://example.test${ADMIN_PAYMENTS_V7_OWNER_DECISION_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic' },
    body: JSON.stringify(body),
  }));
}

async function getSync(handler) {
  return handler(new Request('https://example.test/admin/sync', { method: 'GET', headers: { authorization: 'Bearer synthetic' } }));
}

test('Stage 5C — full Owner BIND cycle rechecks current server state, ignores candidate hint and refreshes authoritative sync', async () => {
  const h = harness();
  const before = buildAdminPaymentsV7Projection(h.state);
  assert.equal(before.owner_exception_queue.length, 1);
  assert.deepEqual(before.owner_exception_queue[0].candidate_deal_ids, ['10000000-0000-4000-8000-000000000001']);
  assert.equal(before.owner_exception_queue[0].payment_amount, '70');
  assert.equal(before.owner_exception_queue[0].payment_currency, 'USD');

  // Candidate A is only a hint. Owner deliberately selects current-contour Deal B.
  const response = await postOwner(h.handler, {
    payment_key: before.owner_exception_queue[0].payment_key,
    action: 'BIND_TO_DEAL',
    deal_key: '10000000-0000-4000-8000-000000000002',
    expected_current_authority_id: null,
    idempotency_key: 'stage5c-bind-b',
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.refresh_required, '/admin/sync');
  assert.equal(h.persisted.length, 1);
  assert.deepEqual(h.persisted[0].decision.authority.scope_deal_keys, ['10000000-0000-4000-8000-000000000002']);
  assert.deepEqual(h.persisted[0].decision.authority.lines_snapshot, [{ deal_key: '10000000-0000-4000-8000-000000000002', amount: '70', currency: 'USD', amount_status: 'EXACT' }]);

  const refresh = await getSync(h.handler);
  assert.equal(refresh.status, 200);
  const refreshed = await refresh.json();
  assert.equal(refreshed.data.shellMarker, 'preserved');
  assert.equal(refreshed.data.paymentsV7Projection.owner_exception_queue.length, 0);
  assert.equal(h.adminSyncReads(), 1);
});

test('Stage 5C — endpoint rejects browser authority arithmetic and non-contour Deal before persistence', async () => {
  const h = harness();
  let response = await postOwner(h.handler, {
    payment_key: h.state.payments[0].payment_key,
    action: 'BIND_TO_DEAL',
    deal_key: h.state.contour[1].deal_key,
    expected_current_authority_id: null,
    idempotency_key: 'bad-client-arithmetic',
    amount: '1',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'OWNER_DECISION_CLIENT_AUTHORITY_FIELDS_FORBIDDEN');
  assert.equal(h.persisted.length, 0);

  response = await postOwner(h.handler, {
    payment_key: h.state.payments[0].payment_key,
    action: 'BIND_TO_DEAL',
    deal_key: '10000000-0000-4000-8000-000000000099',
    expected_current_authority_id: null,
    idempotency_key: 'outside-contour',
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, 'BIND_TARGET_DEAL_NOT_IN_PAYMENTS_CONTOUR');
  assert.equal(h.persisted.length, 0);
});

test('Stage 5C — ASSIGN_ADVANCE_PAYMENT has no Deal binding and removes genuine Owner queue after fresh sync', async () => {
  const h = harness();
  const response = await postOwner(h.handler, {
    payment_key: h.state.payments[0].payment_key,
    action: 'ASSIGN_ADVANCE_PAYMENT',
    expected_current_authority_id: null,
    idempotency_key: 'stage5c-advance',
  });
  assert.equal(response.status, 200);
  assert.equal(h.persisted.length, 1);
  assert.deepEqual(h.persisted[0].decision.authority.scope_deal_keys, []);
  assert.deepEqual(h.persisted[0].decision.authority.lines_snapshot, []);
  const refresh = await getSync(h.handler);
  const payload = await refresh.json();
  assert.equal(payload.data.paymentsV7Projection.owner_exception_queue.length, 0);
});

test('Stage 5C — null/undefined/empty/NaN financial values render TO_VERIFY, never synthetic zero', () => {
  const projection = {
    contract: 'ADMIN_PAYMENTS_V7',
    deals: [{
      deal_key: '10000000-0000-4000-8000-000000000001', deal_id: 'D-NULL', client_display: 'Null test',
      accounting_currency: { currency: 'USD', status: 'AUTHORITATIVE' },
      total_to_receive: { amount: null, currency: 'USD', status: 'AUTHORITATIVE' },
      verified_received: { amount: undefined, currency: 'USD', status: 'AUTHORITATIVE' },
      due_now: { amount: '', currency: 'USD', status: 'AUTHORITATIVE' },
      expected_not_due: { amount: 'NaN', currency: 'USD', status: 'AUTHORITATIVE' },
      future_conditional: { amount: null, currency: 'USD', status: 'AUTHORITATIVE' },
      actual_spend: { amount: null, currency: 'USD', status: 'AUTHORITATIVE' },
      actual_spend_status: 'AUTHORITATIVE',
      remaining_execution: { amount: undefined, currency: 'USD', status: 'AUTHORITATIVE' },
      payment_progress: { percent: 'NaN', status: 'AUTHORITATIVE' },
      authority_refs: [], exceptions: [],
    }],
    owner_exception_queue: [],
  };
  const html = renderAdminPaymentsV7NativeHtml({ paymentsV7Projection: projection });
  assert.match(html, /TO_VERIFY/);
  assert.equal(/>0 USD</.test(html), false);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /v===null\|\|v===undefined\|\|paymentsV7Text\(v\)===''/);
});

test('Stage 5C — live owner proxy routes mutation to authenticated AI sync backend, never direct browser RPC', () => {
  const source = "const AI_SYNC_UPSTREAM=`x`;const UPSTREAM=`y`;function upstreamFor(path){if(path==='/admin/ai-sync')return`${AI_SYNC_UPSTREAM}/admin/sync`;if(path==='/agent/ai-sync')return`${AI_SYNC_UPSTREAM}/agent/sync`;return`${UPSTREAM}${path}`}";
  const patched = patchLiveOwnerApiSource(source);
  assert.match(patched, /admin\/payments-v7\/owner-decision/);
  assert.match(patched, /AI_SYNC_UPSTREAM/);
  assert.doesNotMatch(patched, /persist_owner_payment_decision_v7/);
});

test('Stage 5C — production entrypoint persistence surface is only the sealed Stage 4B primitive', () => {
  const code = fs.readFileSync('supabase/functions/rona-owner-ai-sync/index.ts', 'utf8');
  assert.match(code, /portal_private\.persist_owner_payment_decision_v7/);
  assert.doesNotMatch(code, /insert\s+into\s+portal_private\.payment_business_attributions_v7/i);
  assert.doesNotMatch(code, /update\s+portal_private\.payment_business_attributions_v7/i);
  assert.doesNotMatch(code, /delete\s+from\s+portal_private\.payment_business_attributions_v7/i);
  assert.doesNotMatch(PAYMENTS_V7_BROWSER_RUNTIME, /MutationObserver|candidate_deal_ids[^\n]*\.value|proportional/i);
});
