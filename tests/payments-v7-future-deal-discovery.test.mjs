import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import paymentsRuntime from '../functions/portal/main-ui/payments-v7-owner-passport-ui.js';
import finalDisplayRuntime from '../functions/portal/main-ui/payments-v7-final-display-contract.js';

const PRODUCTION_SOURCE_ROOT = path.resolve('.qa/payments-v7-source');
const paymentsModule = await import(pathToFileURL(path.join(PRODUCTION_SOURCE_ROOT, 'supabase/functions/_shared/admin-payments-v7/index.mjs')).href);
const integrationModule = await import(pathToFileURL(path.join(PRODUCTION_SOURCE_ROOT, 'supabase/functions/rona-owner-ai-sync/admin-payments-v7-integration.mjs')).href);
const { buildAdminPaymentsV7Projection } = paymentsModule;
const { createRonaOwnerAiSyncV7Handler } = integrationModule;

function node(tag, attrs = {}, ...children) {
  return {
    tag,
    attrs: attrs || {},
    children: children.filter(Boolean),
    append(...items) { this.children.push(...items.filter(Boolean)); return this; },
    querySelector(selector) {
      if (!selector?.startsWith('.')) return null;
      const wanted = selector.slice(1);
      const queue = [...this.children];
      while (queue.length) {
        const current = queue.shift();
        if (!current || typeof current !== 'object') continue;
        const classes = String(current.attrs?.class || '').split(/\s+/);
        if (classes.includes(wanted)) return current;
        queue.push(...(current.children || []));
      }
      return null;
    },
  };
}
function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const own = value.attrs?.text ? String(value.attrs.text) : '';
  return [own, ...(value.children || []).map(textOf)].filter(Boolean).join(' | ');
}
const sandbox = {
  console,
  Intl,
  Date,
  JSON,
  document: { head: { appendChild() {} } },
  q: () => null,
  e: node,
  paymentsV7Array: (value) => Array.isArray(value) ? value : [],
  paymentsV7Text: (value) => value === null || value === undefined ? '' : String(value).trim(),
  paymentsV7Upper: (value) => value === null || value === undefined ? '' : String(value).trim().toUpperCase(),
  paymentsV7Num: (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
  paymentsV7Fmt: (value) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 8 }).format(value),
};
vm.createContext(sandbox);
vm.runInContext(paymentsRuntime + '\n' + finalDisplayRuntime + '\nthis.__paymentsUi={paymentsV7Deal};', sandbox);
const ui = sandbox.__paymentsUi;

const ref = (id) => ({
  source_type: 'QA_EPHEMERAL',
  source_id: id,
  source_version: 'runtime-generated',
  source_timestamp: '2031-01-01T00:00:00Z',
  authority_state: 'AUTHORITATIVE',
  lifecycle_state: 'CURRENT',
});
const money = (amount, currency = 'USD', id = `money-${amount}`) => ({
  amount: String(amount), currency, status: 'AUTHORITATIVE', reason: null, authority_refs: [ref(id)],
});
function policy() {
  return {
    policy_key: 'FINANCE_GLOBAL_PAYMENT_SEMANTICS',
    policy_id: 'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1',
    version: 1,
    scope: 'GLOBAL_FINANCE_ROLE',
    task_scoped: false,
    policy: {
      policy_key: 'FINANCE_GLOBAL_PAYMENT_SEMANTICS',
      policy_id: 'FINANCE_GLOBAL_PAYMENT_SEMANTICS_V1',
      version: 1,
      scope: 'GLOBAL_FINANCE_ROLE',
      task_scoped: false,
      rules: {
        FUNDING_CURRENCY_PRIMARY_SEMANTICS: {
          primary_actual_spend_source: 'BANK_CONFIRMED_FUNDING_SIDE_DEBIT',
          reverse_fx_as_primary: 'FORBIDDEN',
          resource_chain_accounting_amount_as_primary: 'FORBIDDEN',
        },
        MULTI_DEAL_PROPORTIONAL_ALLOCATION: {
          default_method: 'PROPORTIONAL_TO_CONFIRMED_SHARES',
          synthetic_allocation: false,
        },
      },
    },
  };
}
function payment({ key, direction, kind, amount, currency = 'USD' }) {
  return {
    payment_key: key,
    payment_id: key,
    payment_at: '2031-01-01T00:00:00Z',
    direction,
    kind,
    amount: String(amount),
    currency,
    bank_fact_status: 'BANK_CONFIRMED',
    finance_verification_status: 'VERIFIED',
    allocation_applicability: kind === 'FX_CONVERSION' ? 'NOT_APPLICABLE' : 'APPLICABLE',
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [ref(key)],
  };
}
function attribution({ id, paymentKey, dealKey, amount, currency = 'USD' }) {
  return {
    id,
    payment_key: paymentKey,
    classification: 'RESOLVED',
    attribution_mode: 'EXACT',
    disposition: 'BIND_TO_DEAL',
    lines: [{ deal_key: dealKey, amount: String(amount), currency, amount_status: 'EXACT', source_refs: [ref(`${id}-line`)] }],
    scope_deal_keys: [dealKey],
    current: true,
    source_locked: true,
    authority_kind: 'FINANCE_AI',
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [ref(id)],
  };
}
function physical({ id, paymentKey, dealKey, amount, currency = 'USD' }) {
  return {
    id,
    payment_key: paymentKey,
    deal_key: dealKey,
    amount: String(amount),
    currency,
    allocation_status: 'VERIFIED',
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [ref(id)],
  };
}
function financeEvent({ id, paymentKey, amount, currency = 'USD' }) {
  return {
    id,
    payment_key: paymentKey,
    event_type: 'OUTGOING_PAYMENT_CONFIRMED',
    event_identity: `evt-${id}`,
    correlation_id: `corr-${id}`,
    actor_id: 'finance-qa-runtime',
    actor_role: 'FINANCE',
    effective_at: '2031-01-01T00:00:00Z',
    source_refs: [ref(`bank-${id}`)],
    request_snapshot: { payload: {
      amount: String(amount),
      currency,
      funding_leg_kind: 'FUNDING_SIDE_DEBIT',
      acquired_amount: null,
      acquired_currency: null,
      conversion_rate: null,
      conversion_source_basis: null,
      allocation_shares: null,
      allocation_basis: null,
      settlement_payment_keys: null,
    } },
    result_snapshot: { accepted: true },
  };
}
function sourceFor(dealId, dealKey, { includeFundingEvent = true } = {}) {
  const incomingKey = `qa-in-${crypto.randomUUID()}`;
  const fundingKey = `qa-fund-${crypto.randomUUID()}`;
  return {
    generatedAt: '2031-01-01T00:00:00Z',
    sourceAsOf: '2031-01-01T00:00:00Z',
    capabilities: {
      paymentBusinessAuthority: true,
      financeAuthority: true,
      resourceChain: true,
      financeEvents: true,
      globalFinancePolicy: true,
    },
    contour: [{
      deal_key: dealKey,
      deal_id: dealId,
      client_display: `QA client ${dealId}`,
      payment_handoff_state: 'READY',
      current: true,
      authority_state: 'AUTHORITATIVE',
      lifecycle_state: 'CURRENT',
      authority_refs: [ref(`deal-${dealKey}`)],
    }],
    payments: [
      payment({ key: incomingKey, direction: 'INCOMING', kind: 'CLIENT_PAYMENT', amount: '40' }),
      payment({ key: fundingKey, direction: 'OUTGOING', kind: 'INTERNAL_TRANSFER', amount: '25' }),
    ],
    attributionClaims: [
      attribution({ id: `attr-${incomingKey}`, paymentKey: incomingKey, dealKey, amount: '40' }),
      attribution({ id: `attr-${fundingKey}`, paymentKey: fundingKey, dealKey, amount: '25' }),
    ],
    physicalAllocations: [
      physical({ id: `mat-${incomingKey}`, paymentKey: incomingKey, dealKey, amount: '40' }),
      physical({ id: `mat-${fundingKey}`, paymentKey: fundingKey, dealKey, amount: '25' }),
    ],
    financeAuthorities: [{
      id: `finance-${dealKey}`,
      deal_key: dealKey,
      total_to_receive: money('100', 'USD', `total-${dealKey}`),
      due_now: money('0', 'USD', `due-${dealKey}`),
      expected_not_due: money('60', 'USD', `expected-${dealKey}`),
      future_conditional: money('0', 'USD', `future-${dealKey}`),
      finance_status: 'OPEN',
      documentary_status: 'TO_VERIFY',
      contractual_payment_currency: 'USD',
      current: true,
      source_locked: true,
      authority_state: 'AUTHORITATIVE',
      lifecycle_state: 'CURRENT',
      effective_at: '2031-01-01T00:00:00Z',
      source_version: 'runtime-generated',
      authority_refs: [ref(`finance-${dealKey}`)],
    }],
    resourceChains: [],
    financeEvents: includeFundingEvent ? [financeEvent({ id: `event-${fundingKey}`, paymentKey: fundingKey, amount: '25' })] : [],
    globalFinancePolicies: [policy()],
  };
}
function assertNotRegisteredInRepo(value) {
  const result = spawnSync('git', ['grep', '-F', '--', value], { encoding: 'utf8' });
  assert.equal(result.status, 1, `runtime deal unexpectedly exists in tracked source: ${result.stdout || result.stderr}`);
}
async function apiProjection(source) {
  const runtimeHandler = async () => new Response(JSON.stringify({ ok: true, data: { existing_admin_payload: true } }), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
  const handler = createRonaOwnerAiSyncV7Handler({
    runtimeHandler,
    readRawSources: async () => structuredClone(source),
    buildProjection: (raw) => buildAdminPaymentsV7Projection(structuredClone(raw)),
    logger: { error() {} },
  });
  const response = await handler(new Request('https://qa.invalid/rona-owner-ai-sync/admin/sync', { method: 'GET' }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload?.data?.paymentsV7Projection?.contract, 'ADMIN_PAYMENTS_V7');
  return payload.data.paymentsV7Projection;
}
async function runOneDiscovery(iteration) {
  const dealId = `QA-FUTURE-${iteration}-${crypto.randomUUID().toUpperCase()}`;
  const dealKey = `qa-key-${crypto.randomUUID()}`;
  assertNotRegisteredInRepo(dealId);
  assertNotRegisteredInRepo(dealKey);

  const source = sourceFor(dealId, dealKey);
  assert.equal(source.contour.length, 1);
  assert.equal(source.contour[0].deal_id, dealId);

  const projection = await apiProjection(source);
  const apiDeal = projection.deals.find((deal) => deal.deal_id === dealId);
  assert.ok(apiDeal, 'new contour deal missing from Payments V7 API collection');

  assert.equal(apiDeal.funding_currency, 'USD');
  assert.equal(apiDeal.verified_received.amount, '40');
  assert.equal(apiDeal.expected_not_due.amount, '60');
  assert.equal(apiDeal.actual_spend.amount, '25');
  assert.equal(apiDeal.actual_spend.status, 'AUTHORITATIVE');
  assert.equal(apiDeal.remaining_execution.amount, '15');
  assert.equal(apiDeal.payment_passport.funding_received.amount, '40');
  assert.equal(apiDeal.payment_passport.funding_spent.amount, '25');
  assert.equal(apiDeal.payment_passport.funding_remaining.amount, '15');

  const rendered = textOf(ui.paymentsV7Deal(apiDeal));
  assert.match(rendered, new RegExp(dealId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const expected of ['40 USD', '25 USD', '15 USD', '60 USD']) assert.match(rendered, new RegExp(expected.replace(' ', '\\s*')));

  const failClosedProjection = await apiProjection(sourceFor(dealId, dealKey, { includeFundingEvent: false }));
  const failClosedDeal = failClosedProjection.deals.find((deal) => deal.deal_id === dealId);
  assert.ok(failClosedDeal);
  assert.equal(failClosedDeal.actual_spend.status, 'TO_VERIFY');
  assert.equal(failClosedDeal.actual_spend.amount, null);
  assert.equal(failClosedDeal.payment_passport.funding_spent.status, 'TO_VERIFY');
  const failClosedRendered = textOf(ui.paymentsV7Deal(failClosedDeal));
  assert.match(failClosedRendered, /Требуется проверка/);

  return { dealId, dealKey };
}

const first = await runOneDiscovery(1);
const second = await runOneDiscovery(2);
assert.notEqual(first.dealId, second.dealId);
assert.notEqual(first.dealKey, second.dealKey);

console.log('NEW_DEAL_IN_FINANCE_CONTOUR=YES');
console.log('NO_FRONTEND_CODE_CHANGE_FOR_DEAL=YES');
console.log('NO_MANUAL_DEAL_REGISTRATION=YES');
console.log('PAYMENTS_API_RETURNS_NEW_DEAL=YES');
console.log('LK_RENDERS_NEW_DEAL=YES');
console.log('AUTHORITATIVE_VALUES_PARITY=PASS');
console.log('TO_VERIFY_PRESERVED=PASS');
console.log('REPEAT_WITHOUT_CODE_CHANGE=PASS');
console.log('NO_DEAL_ID_HARDCODE=PASS');
console.log('BUSINESS_DATA_MUTATION=NONE');
console.log('FINANCE_PRODUCTION_MUTATION=NONE');
