import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAdminPaymentsV7FromRawSources } from '../../supabase/functions/_shared/admin-payments-v7/index.mjs';
import {
  ADMIN_PAYMENTS_V7_READ_ROLE,
  ADMIN_PAYMENTS_V7_SNAPSHOT_OPTIONS,
  createAdminPaymentsV7SourceReader,
  readAdminPaymentsV7RawSources,
} from '../../supabase/functions/rona-owner-ai-sync/admin-payments-v7-source-reader.mjs';
import { createRonaOwnerAiSyncV7Handler } from '../../supabase/functions/rona-owner-ai-sync/admin-payments-v7-integration.mjs';

const SNAPSHOT_TS = '2026-09-13 12:00:00+00';

function rows({ includeUnscopedOutgoing = false } = {}) {
  const payments = [{ id: 'payment-key', payment_id: 'PAYEV-2026-000001', payment_at: '2026-09-13T10:00:00Z', payment_direction: 'INCOMING', payment_kind: 'CLIENT_PAYMENT', amount: '40.0000', currency: 'USD', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'VERIFIED', candidate_deal_ids: ['DEAL-2026-004'], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' }];
  if (includeUnscopedOutgoing) payments.push({ id: 'payment-out', payment_id: 'PAYEV-2026-009999', payment_at: '2026-09-13T11:00:00Z', payment_direction: 'OUTGOING', payment_kind: 'COUNTERPARTY_PAYMENT', amount: '7', currency: 'USD', bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED', deal_allocation_applicability: 'DEAL_ALLOCATABLE', allocation_review_status: 'TO_VERIFY', candidate_deal_ids: [], authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' });
  return {
    deals: [{ id: 'deal-key', deal_id: 'DEAL-2026-004', client_key: 'client-key', contract_key: 'contract-key', business_status: 'EXECUTING', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' }],
    workflows: [{ deal_key: 'deal-key', payment_handoff_state: 'READY', cancellation_state: 'ACTIVE' }],
    clients: [{ id: 'client-key', client_id: 'CLIENT-T', legal_name: 'Client' }],
    contracts: [{ id: 'contract-key', contract_id: 'CONTRACT-T' }],
    payments,
    paymentAllocations: [{ id: 'allocation-key', payment_key: 'payment-key', deal_key: 'deal-key', allocated_amount: '40.0000', allocation_status: 'VERIFIED', finance_status: 'PAID', authority_state: 'CONFIRMED', lifecycle_state: 'ACTIVE' }],
    paymentAllocationHistory: [], ownerOutgoingPaymentFacts: [],
  };
}

function makePort({ paymentProvider = false, financeProvider = false, resourceProvider = false, includeUnscopedOutgoing = false } = {}) {
  const data = rows({ includeUnscopedOutgoing });
  const calls = { optional: 0 };
  const port = {
    readSnapshotTimestamp: async () => SNAPSHOT_TS,
    relationExists: async (name) => {
      if (name.endsWith('payment_business_attributions_v7')) return paymentProvider;
      if (name.endsWith('payment_business_attribution_lines_v7')) return paymentProvider;
      if (name.endsWith('deal_finance_authority_v7')) return financeProvider;
      if (name.endsWith('payment_resource_chains_v7')) return resourceProvider;
      return false;
    },
    readDeals: async () => data.deals,
    readWorkflows: async () => data.workflows,
    readClients: async () => data.clients,
    readContracts: async () => data.contracts,
    readPayments: async () => data.payments,
    readPaymentAllocations: async () => data.paymentAllocations,
    readPaymentAllocationHistory: async () => data.paymentAllocationHistory,
    readOwnerOutgoingPaymentFacts: async () => data.ownerOutgoingPaymentFacts,
    readPaymentBusinessAttributions: async () => { calls.optional += 1; return []; },
    readPaymentBusinessAttributionLines: async () => { calls.optional += 1; return []; },
    readDealFinanceAuthorities: async () => { calls.optional += 1; return []; },
    readResourceChains: async () => { calls.optional += 1; return []; },
  };
  return { port, calls };
}

async function projectedRaw(options = {}) {
  const { port } = makePort(options);
  const raw = await readAdminPaymentsV7RawSources(port);
  return { raw, projection: buildAdminPaymentsV7FromRawSources(raw) };
}

test('Z — ABSENT AUTHORITY PROVIDER fails closed without source-reader crash', async () => {
  const { port, calls } = makePort({ includeUnscopedOutgoing: true });
  const raw = await readAdminPaymentsV7RawSources(port);
  assert.equal(raw.capabilities.paymentBusinessAuthority, false);
  assert.equal(raw.capabilities.financeAuthority, false);
  assert.equal(raw.providerPresence.paymentBusinessAttributions, false);
  assert.equal(calls.optional, 0);
  const projection = buildAdminPaymentsV7FromRawSources(raw);
  const deal = projection.deals[0];
  assert.equal(deal.accounting_currency.status, 'AUTHORITATIVE');
  assert.equal(deal.verified_received.amount, '40');
  assert.equal(deal.total_to_receive.status, 'TO_VERIFY');
  assert.equal(deal.total_to_receive.reason, 'AUTHORITY_MATERIALIZATION_REQUIRED');
  const outgoing = projection.payment_exceptions.find((item) => item.payment_ids.includes('PAYEV-2026-009999'));
  assert.equal(outgoing.reconciliation_class, 'AUTHORITY_MATERIALIZATION_REQUIRED');
  assert.equal(projection.owner_exception_queue.length, 0);
});

test('AA — EMPTY EXISTING PROVIDER is capability=true but does not assert authoritative absence', async () => {
  const { port, calls } = makePort({ paymentProvider: true, financeProvider: true, includeUnscopedOutgoing: true });
  const raw = await readAdminPaymentsV7RawSources(port);
  assert.equal(raw.capabilities.paymentBusinessAuthority, true);
  assert.equal(raw.capabilities.financeAuthority, true);
  assert.equal(raw.paymentBusinessAttributions.length, 0);
  assert.equal(raw.dealFinanceAuthorities.length, 0);
  assert.equal(calls.optional, 3);
  const projection = buildAdminPaymentsV7FromRawSources(raw);
  assert.equal(projection.deals[0].total_to_receive.reason, 'NO_CURRENT_FINANCE_AUTHORITY');
  assert.equal(projection.owner_exception_queue.length, 0);
  const outgoing = projection.payment_exceptions.find((item) => item.payment_ids.includes('PAYEV-2026-009999'));
  assert.equal(outgoing.reconciliation_class, 'AUTHORITY_MATERIALIZATION_REQUIRED');
});

test('AB — REAL RAW SOURCE SHAPE preserves internal keys and projection consumes raw rows', async () => {
  const { raw, projection } = await projectedRaw();
  assert.equal(raw.sourceReaderContract, 'ADMIN_PAYMENTS_V7_RAW_SOURCE_V1');
  assert.equal(raw.sourceAsOf, SNAPSHOT_TS);
  assert.deepEqual(raw.snapshotContract, { isolation: 'REPEATABLE READ', access: 'READ ONLY', sourceAsOf: 'DB_TRANSACTION_TIMESTAMP', dbRole: ADMIN_PAYMENTS_V7_READ_ROLE });
  assert.equal(raw.deals[0].id, 'deal-key');
  assert.equal(raw.payments[0].id, 'payment-key');
  assert.equal(raw.paymentAllocations[0].payment_key, 'payment-key');
  assert.equal(raw.paymentAllocations[0].deal_key, 'deal-key');
  assert.equal(Object.hasOwn(raw, 'financeFragment'), false);
  assert.equal(projection.deals[0].deal_id, 'DEAL-2026-004');
  assert.equal(projection.deals[0].verified_received.amount, '40');
  assert.equal(projection.deals[0].accounting_currency.currency, 'USD');
});

function legacyRuntime(legacyValue, unrelated = {}) {
  return async () => new Response(JSON.stringify({ ok: true, data: { ...unrelated, financeFragment: { legacyPaymentsValue: legacyValue } } }), { status: 200, headers: { 'content-type': 'application/json' } });
}

async function runIntegrated(legacyValue, unrelated = {}) {
  const { raw } = await projectedRaw();
  const handler = createRonaOwnerAiSyncV7Handler({ runtimeHandler: legacyRuntime(legacyValue, unrelated), readRawSources: async () => structuredClone(raw), logger: { error() {} } });
  const response = await handler(new Request('https://example.test/admin/sync', { headers: { authorization: 'Bearer admin' } }));
  return response.json();
}

test('AC — LEGACY V6 NOT AUTHORITATIVE for paymentsV7Projection', async () => {
  const first = await runIntegrated('legacy-a');
  const second = await runIntegrated('legacy-b');
  assert.notEqual(first.data.financeFragment.legacyPaymentsValue, second.data.financeFragment.legacyPaymentsValue);
  assert.deepEqual(first.data.paymentsV7Projection, second.data.paymentsV7Projection);
  assert.equal(first.data.paymentsV7Projection.contract, 'ADMIN_PAYMENTS_V7');
});

test('AD — NON-PAYMENTS ADMIN REGRESSION preserves unrelated Admin payload', async () => {
  const unrelated = {
    railTariffs: [{ tariff_key: 't-1' }],
    aiRuntime: { enabled: true, worker_version: 'w' },
    aiEmployees: [{ identity_id: 'AI-X' }],
    homeCoordination: { totals: { TODAY: { sent: 1 } } },
    agentRewardsFragment: { rows: [{ settlement_id: 's-1' }] },
    marketAnalystFragment: { analytics: [{ record_id: 'a-1' }] },
  };
  const payload = await runIntegrated('legacy', unrelated);
  for (const [key, value] of Object.entries(unrelated)) assert.deepEqual(payload.data[key], value);
  assert.equal(payload.data.paymentsV7Projection.contract, 'ADMIN_PAYMENTS_V7');
});

test('AE — CONSISTENT READ SNAPSHOT CONTRACT uses one REPEATABLE READ READ ONLY least-privilege transaction', async () => {
  const { port } = makePort({ paymentProvider: true, financeProvider: true, resourceProvider: true });
  let insideTransaction = false;
  let beginCalls = 0;
  let roleCalls = 0;
  let readCalls = 0;
  let outsideReads = 0;
  let beginOptions = null;
  const transactionSql = function transactionSql() { throw new Error('DIRECT_TRANSACTION_SQL_NOT_EXPECTED_IN_INJECTED_PORT_TEST'); };
  const instrumentedPort = {};
  for (const [name, fn] of Object.entries(port)) {
    instrumentedPort[name] = async (...args) => {
      readCalls += 1;
      if (!insideTransaction) outsideReads += 1;
      return fn(...args);
    };
  }
  const rootSql = function rootSql() { throw new Error('AUTHORITATIVE_READ_OUTSIDE_TRANSACTION'); };
  rootSql.begin = async (options, callback) => {
    beginCalls += 1;
    beginOptions = options;
    insideTransaction = true;
    try { return await callback(transactionSql); }
    finally { insideTransaction = false; }
  };
  const reader = createAdminPaymentsV7SourceReader(rootSql, {
    activateReadRole: async (sql) => { assert.equal(sql, transactionSql); roleCalls += 1; },
    createReadPort: (sql) => {
      assert.equal(sql, transactionSql);
      return instrumentedPort;
    },
  });
  const raw = await reader();
  assert.equal(beginCalls, 1);
  assert.equal(roleCalls, 1);
  assert.equal(beginOptions, ADMIN_PAYMENTS_V7_SNAPSHOT_OPTIONS);
  assert.equal(beginOptions, 'isolation level repeatable read read only');
  assert.equal(outsideReads, 0);
  assert.ok(readCalls >= 17);
  assert.equal(raw.sourceAsOf, SNAPSHOT_TS);
  assert.equal(raw.generatedAt, SNAPSHOT_TS);
  assert.deepEqual(raw.snapshotContract, { isolation: 'REPEATABLE READ', access: 'READ ONLY', sourceAsOf: 'DB_TRANSACTION_TIMESTAMP', dbRole: ADMIN_PAYMENTS_V7_READ_ROLE });
});

test('AF — V7 SOURCE FAILURE IS CONTROLLED and never falls back to legacy Payments truth', async () => {
  const request = new Request('https://example.test/admin/sync', { headers: { authorization: 'Bearer admin' } });
  const runtimeHandler = legacyRuntime('legacy-should-not-fallback', { railTariffs: [{ tariff_key: 'kept-only-on-success' }] });
  const sourceFailure = createRonaOwnerAiSyncV7Handler({
    runtimeHandler,
    readRawSources: async () => { throw new Error('DB_READ_FAILED'); },
    logger: { error() {} },
  });
  let response = await sourceFailure(request);
  assert.equal(response.status, 502);
  let body = await response.json();
  assert.deepEqual(body, { ok: false, code: 'ADMIN_PAYMENTS_V7_SOURCE_FAILURE', component: 'ADMIN_PAYMENTS_V7' });
  assert.equal(Object.hasOwn(body, 'paymentsV7Projection'), false);

  const projectionFailure = createRonaOwnerAiSyncV7Handler({
    runtimeHandler,
    readRawSources: async () => ({ sourceReaderContract: 'ADMIN_PAYMENTS_V7_RAW_SOURCE_V1' }),
    buildProjection: () => { throw new Error('PROJECTION_FAILED'); },
    logger: { error() {} },
  });
  response = await projectionFailure(new Request('https://example.test/admin/sync', { headers: { authorization: 'Bearer admin' } }));
  body = await response.json();
  assert.equal(response.status, 502);
  assert.deepEqual(body, { ok: false, code: 'ADMIN_PAYMENTS_V7_PROJECTION_FAILURE', component: 'ADMIN_PAYMENTS_V7' });
  assert.equal(Object.hasOwn(body, 'paymentsV7Projection'), false);
});
