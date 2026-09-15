import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFundingAggregate,
  buildFundingSideReadModel,
  buildNativeResidualAggregate,
  FINANCE_GLOBAL_PAYMENT_POLICY_KEY,
} from '../../supabase/functions/_shared/admin-payments-v7/funding-side-read-model.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function policy({ version = 1, compatible = true } = {}) {
  const policyId = `FINANCE_GLOBAL_PAYMENT_SEMANTICS_V${version}`;
  return [{
    policy_key: FINANCE_GLOBAL_PAYMENT_POLICY_KEY,
    policy_id: policyId,
    version,
    scope: 'GLOBAL_FINANCE_ROLE',
    task_scoped: false,
    policy: {
      policy_key: FINANCE_GLOBAL_PAYMENT_POLICY_KEY,
      policy_id: policyId,
      version,
      scope: 'GLOBAL_FINANCE_ROLE',
      task_scoped: false,
      rules: {
        FUNDING_CURRENCY_PRIMARY_SEMANTICS: {
          primary_actual_spend_source: compatible ? 'BANK_CONFIRMED_FUNDING_SIDE_DEBIT' : 'SETTLEMENT_EQUIVALENT',
          reverse_fx_as_primary: compatible ? 'FORBIDDEN' : 'ALLOWED',
          resource_chain_accounting_amount_as_primary: 'FORBIDDEN',
        },
        MULTI_DEAL_PROPORTIONAL_ALLOCATION: {
          default_method: 'PROPORTIONAL_TO_CONFIRMED_SHARES',
          synthetic_allocation: false,
        },
      },
    },
  }];
}

function deal(key, id) { return { deal_key: key, deal_id: id }; }

function payment({ key, id = key, amount, currency = 'USD', kind = 'INTERNAL_TRANSFER', at = '2031-01-01T00:00:00Z', recipient = null } = {}) {
  return {
    payment_key: key,
    payment_id: id,
    amount: String(amount),
    currency,
    direction: 'OUTGOING',
    kind,
    payment_at: at,
    bank_fact_status: 'BANK_CONFIRMED',
    finance_verification_status: 'VERIFIED',
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    counterparty_name: recipient,
    recipient,
  };
}

function financeClaim({
  id,
  paymentKey,
  lines,
  classification = 'RESOLVED',
  attributionMode = 'EXACT',
  principal = null,
  sourceRefs = [],
  businessScopeRefs = [],
} = {}) {
  return {
    id,
    payment_key: paymentKey,
    classification,
    attribution_mode: attributionMode,
    disposition: 'BIND_TO_DEAL',
    lines,
    scope_deal_keys: lines.map((line) => line.deal_key),
    principal_payment_key: principal,
    source_refs: sourceRefs,
    business_scope_refs: businessScopeRefs,
    current: true,
    source_locked: true,
    authority_kind: 'FINANCE_AI',
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [{ source_type: 'FINANCE_EVENT', source_id: id }],
  };
}

function legacyClaim({ id, paymentKey, lines, kind } = {}) {
  return {
    id,
    payment_key: paymentKey,
    classification: 'RESOLVED',
    attribution_mode: 'EXACT',
    disposition: 'BIND_TO_DEAL',
    lines,
    scope_deal_keys: lines.map((line) => line.deal_key),
    current: true,
    source_locked: true,
    authority_kind: kind,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    authority_refs: [{ source_type: kind, source_id: id }],
  };
}

function event({
  id,
  paymentKey,
  amount,
  currency = 'USD',
  acquiredAmount = null,
  acquiredCurrency = null,
  shares = null,
  basis = null,
  fundingLegKind = 'FUNDING_SIDE_DEBIT',
  rate = null,
  correlationId = null,
  sourceRefs = null,
  settlementPaymentKeys = null,
} = {}) {
  return {
    id,
    payment_key: paymentKey,
    event_type: 'OUTGOING_PAYMENT_CONFIRMED',
    event_identity: `evt-${id}`,
    correlation_id: correlationId,
    actor_id: 'finance-test',
    actor_role: 'FINANCE',
    effective_at: '2031-01-01T00:00:00Z',
    source_refs: sourceRefs || [{ source_type: 'BANK_STATEMENT', source_id: `bank-${id}` }],
    request_snapshot: { payload: {
      amount: String(amount),
      currency,
      funding_leg_kind: fundingLegKind,
      acquired_amount: acquiredAmount === null ? null : String(acquiredAmount),
      acquired_currency: acquiredCurrency,
      conversion_rate: rate === null ? null : String(rate),
      conversion_source_basis: acquiredCurrency ? 'BANK_ACTUAL' : null,
      allocation_shares: shares,
      allocation_basis: basis,
      settlement_payment_keys: settlementPaymentKeys,
    } },
    result_snapshot: { accepted: true },
  };
}

function line(dealKey, amount, currency = 'USD', sourceRefs = []) {
  return {
    deal_key: dealKey,
    amount: String(amount),
    currency,
    amount_status: 'EXACT',
    source_refs: sourceRefs,
  };
}

function source({
  deals = [deal('deal-a', 'FUTURE-A')],
  payments = [],
  claims = [],
  events = [],
  resourceChains = [],
  policies = policy(),
} = {}) {
  return {
    contour: deals,
    payments,
    attributionClaims: claims,
    financeEvents: events,
    globalFinancePolicies: policies,
    resourceChains,
  };
}

function singleFunding({
  amount = '100',
  acquiredAmount = null,
  acquiredCurrency = null,
  settlement = null,
  linkSettlement = true,
} = {}) {
  const funding = payment({ key: 'fund-a', amount });
  const claims = [financeClaim({ id: 'attr-fund-a', paymentKey: 'fund-a', lines: [line('deal-a', amount)] })];
  const payments = [funding];

  if (settlement) {
    const settlementKey = settlement.key || 'settle-a';
    payments.push(payment({
      key: settlementKey,
      amount: settlement.amount,
      currency: settlement.currency,
      kind: settlement.kind || 'COUNTERPARTY_PAYMENT',
      recipient: 'Counterparty',
    }));
    claims.push(financeClaim({
      id: `attr-${settlementKey}`,
      paymentKey: settlementKey,
      principal: linkSettlement ? 'fund-a' : null,
      lines: [line('deal-a', settlement.amount, settlement.currency)],
    }));
  }

  return source({
    payments,
    claims,
    events: [event({ id: 'event-a', paymentKey: 'fund-a', amount, acquiredAmount, acquiredCurrency })],
  });
}

// Baseline funding semantics retained from Stage A.
test('1 single Deal / single direct funding debit is primary actual spend', () => {
  const model = buildFundingSideReadModel(singleFunding({ amount: '125' }));
  const spend = model.computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(spend.value.amount, '125');
  assert.equal(spend.value.currency, 'USD');
});

test('2 USD funding to RUB settlement stays funding-first with authoritative principal linkage', () => {
  const model = buildFundingSideReadModel(singleFunding({
    amount: '100', acquiredAmount: '8200', acquiredCurrency: 'RUB', settlement: { amount: '8000', currency: 'RUB' },
  }));
  const passport = model.passportEventsForDeal('deal-a')[0];
  assert.equal(passport.funding_amount, '100');
  assert.equal(passport.funding_currency, 'USD');
  assert.equal(passport.settlement_status, 'AUTHORITATIVE');
  assert.equal(passport.settlement_lines[0].amount, '8000');
  assert.equal(passport.native_residuals[0].amount, '200');
});

test('3 USD funding to KZT settlement preserves native settlement semantics', () => {
  const model = buildFundingSideReadModel(singleFunding({
    amount: '50', acquiredAmount: '24000', acquiredCurrency: 'KZT', settlement: { amount: '23000', currency: 'KZT' },
  }));
  const passport = model.passportEventsForDeal('deal-a')[0];
  assert.equal(passport.funding_currency, 'USD');
  assert.equal(passport.acquired_currency, 'KZT');
  assert.equal(passport.settlement_lines[0].currency, 'KZT');
});

test('4 one funding event supports multiple authoritatively linked settlement payments', () => {
  const s = singleFunding({
    amount: '100', acquiredAmount: '9000', acquiredCurrency: 'RUB', settlement: { key: 'settle-1', amount: '3000', currency: 'RUB' },
  });
  s.payments.push(payment({ key: 'settle-2', amount: '4500', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' }));
  s.attributionClaims.push(financeClaim({
    id: 'attr-settle-2', paymentKey: 'settle-2', principal: 'fund-a', lines: [line('deal-a', '4500', 'RUB')],
  }));
  const passport = buildFundingSideReadModel(s).passportEventsForDeal('deal-a')[0];
  assert.equal(passport.settlement_lines.length, 2);
  assert.equal(passport.native_residuals[0].amount, '1500');
});

test('5 one funding debit can serve multiple Deals', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-shared', amount: '1000' });
  const claim = financeClaim({
    id: 'attr-shared', paymentKey: p.payment_key, classification: 'KNOWN_MULTI_DEAL_EXACT_SPLIT',
    lines: [line('deal-a', '700'), line('deal-b', '300')],
  });
  const e = event({
    id: 'event-shared', paymentKey: p.payment_key, amount: '1000',
    shares: { 'FUTURE-A': '0.7', 'FUTURE-B': '0.3' }, basis: 'PROPORTIONAL_TO_CONFIRMED_SHARES',
  });
  const model = buildFundingSideReadModel(source({ deals, payments: [p], claims: [claim], events: [e] }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').value.amount, '700');
  assert.equal(model.computeDealSpend('deal-b', 'USD').value.amount, '300');
});

test('6 confirmed proportional shares are normal Finance allocation', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-prop', amount: '100' });
  const claim = financeClaim({
    id: 'attr-prop', paymentKey: p.payment_key, classification: 'KNOWN_MULTI_DEAL_EXACT_SPLIT',
    lines: [line('deal-a', '80'), line('deal-b', '20')],
  });
  const e = event({
    id: 'event-prop', paymentKey: p.payment_key, amount: '100',
    shares: { 'FUTURE-A': '0.8', 'FUTURE-B': '0.2' }, basis: 'PROPORTIONAL_TO_CONFIRMED_SHARES',
  });
  const view = buildFundingSideReadModel(source({ deals, payments: [p], claims: [claim], events: [e] })).passportEventsForDeal('deal-a')[0];
  assert.equal(view.allocation_share, '0.8');
  assert.equal(view.allocation_source, 'PROPORTIONAL_TO_CONFIRMED_SHARES');
  assert.equal(view.synthetic_allocation, false);
});

test('7 authoritative allocation override is preserved as event basis', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-override', amount: '100' });
  const claim = financeClaim({
    id: 'attr-override', paymentKey: p.payment_key, classification: 'KNOWN_MULTI_DEAL_EXACT_SPLIT',
    lines: [line('deal-a', '65'), line('deal-b', '35')],
  });
  const e = event({
    id: 'event-override', paymentKey: p.payment_key, amount: '100',
    shares: { 'FUTURE-A': '0.65', 'FUTURE-B': '0.35' }, basis: 'AUTHORITATIVE_OVERRIDE',
  });
  const view = buildFundingSideReadModel(source({ deals, payments: [p], claims: [claim], events: [e] })).passportEventsForDeal('deal-a')[0];
  assert.equal(view.allocation_source, 'AUTHORITATIVE_OVERRIDE');
  assert.equal(view.allocated_funding_amount, '65');
});

test('8 absent confirmed exact multi-deal authority fails closed', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-no-shares', amount: '100' });
  const scopeOnly = financeClaim({
    id: 'attr-scope', paymentKey: p.payment_key, attributionMode: 'SCOPE_ONLY',
    lines: [line('deal-a', '50'), line('deal-b', '50')],
  });
  const e = event({ id: 'event-no-shares', paymentKey: p.payment_key, amount: '100' });
  const model = buildFundingSideReadModel(source({ deals, payments: [p], claims: [scopeOnly], events: [e] }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').status, 'TO_VERIFY');
});

test('9 settlement without direct funding-side debit is TO_VERIFY', () => {
  const p = payment({ key: 'settle-only', amount: '1000', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' });
  const claim = financeClaim({ id: 'attr-settle-only', paymentKey: p.payment_key, lines: [line('deal-a', '1000', 'RUB')] });
  const model = buildFundingSideReadModel(source({ payments: [p], claims: [claim], events: [] }));
  const spend = model.computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'TO_VERIFY');
  assert.equal(spend.value.amount, null);
  assert.equal(spend.value.reason, 'DIRECT_FUNDING_SIDE_DEBIT_MISSING');
});

test('10 Deal with no funding event and no settlement is TO_VERIFY, never authoritative zero', () => {
  const model = buildFundingSideReadModel(source());
  const spend = model.computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'TO_VERIFY');
  assert.equal(spend.value.amount, null);
  assert.equal(spend.value.reason, 'DIRECT_FUNDING_SIDE_DEBIT_MISSING');
});

test('11 reverse-FX-shaped event cannot become primary spend', () => {
  const p = payment({ key: 'reverse-event', amount: '100', kind: 'COUNTERPARTY_PAYMENT' });
  const claim = financeClaim({ id: 'attr-reverse', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const e = event({
    id: 'event-reverse', paymentKey: p.payment_key, amount: '100', acquiredAmount: '8000', acquiredCurrency: 'RUB',
    fundingLegKind: 'SETTLEMENT_REVERSE_FX',
  });
  const model = buildFundingSideReadModel(source({ payments: [p], claims: [claim], events: [e] }));
  assert.notEqual(model.computeDealSpend('deal-a', 'USD').status, 'AUTHORITATIVE');
  assert.equal(model.reverseFxPrimaryCount, 0);
});

test('12 resource_chain.accounting_amount is ignored for primary spend', () => {
  const s = singleFunding({
    amount: '100', acquiredAmount: '8100', acquiredCurrency: 'RUB', settlement: { amount: '8000', currency: 'RUB' },
  });
  s.resourceChains = [{
    id: 'chain-corrupt', payment_key: 'settle-a', deal_key: 'deal-a', native_amount: '8000', native_currency: 'RUB',
    accounting_amount: '999999', accounting_currency: 'USD', current: true, source_locked: true,
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT',
  }];
  const spend = buildFundingSideReadModel(s).computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(spend.value.amount, '100');
});

test('13 acquired-currency residual remains native and is not FX converted', () => {
  const model = buildFundingSideReadModel(singleFunding({
    amount: '100', acquiredAmount: '8123.45', acquiredCurrency: 'RUB', settlement: { amount: '8000', currency: 'RUB' },
  }));
  const residual = model.nativeResiduals[0];
  assert.equal(residual.amount, '123.45');
  assert.equal(residual.currency, 'RUB');
});

test('14 physical allocation loses precedence to current Finance exact authority', () => {
  const p = payment({ key: 'fund-precedence-physical', amount: '100' });
  const finance = financeClaim({ id: 'finance-current', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const physical = legacyClaim({ id: 'physical-old', paymentKey: p.payment_key, kind: 'PAYMENT_ALLOCATION', lines: [line('deal-a', '90')] });
  const e = event({ id: 'event-precedence-physical', paymentKey: p.payment_key, amount: '100' });
  const spend = buildFundingSideReadModel(source({ payments: [p], claims: [physical, finance], events: [e] })).computeDealSpend('deal-a', 'USD');
  assert.equal(spend.value.amount, '100');
});

test('15 owner outgoing fact loses precedence to current Finance exact authority', () => {
  const p = payment({ key: 'fund-precedence-owner', amount: '100' });
  const finance = financeClaim({ id: 'finance-current-owner', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const owner = legacyClaim({ id: 'owner-old', paymentKey: p.payment_key, kind: 'OWNER_OUTGOING_PAYMENT_FACT', lines: [line('deal-a', '75')] });
  const e = event({ id: 'event-precedence-owner', paymentKey: p.payment_key, amount: '100' });
  const spend = buildFundingSideReadModel(source({ payments: [p], claims: [owner, finance], events: [e] })).computeDealSpend('deal-a', 'USD');
  assert.equal(spend.value.amount, '100');
});

test('16 conflicting current Finance exact attribution is TO_VERIFY', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-conflict', amount: '100' });
  const a = financeClaim({ id: 'finance-a', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const b = financeClaim({ id: 'finance-b', paymentKey: p.payment_key, lines: [line('deal-b', '100')] });
  const e = event({ id: 'event-conflict', paymentKey: p.payment_key, amount: '100' });
  const model = buildFundingSideReadModel(source({ deals, payments: [p], claims: [a, b], events: [e] }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').status, 'TO_VERIFY');
  assert.equal(model.computeDealSpend('deal-b', 'USD').status, 'TO_VERIFY');
});

test('17 arbitrary future Deal ID uses identical generic logic', () => {
  const arbitrary = deal('new-key-z', 'FUTURE-ZETA');
  const p = payment({ key: 'fund-zeta', amount: '321' });
  const claim = financeClaim({ id: 'finance-zeta', paymentKey: p.payment_key, lines: [line('new-key-z', '321')] });
  const e = event({ id: 'event-zeta', paymentKey: p.payment_key, amount: '321' });
  const spend = buildFundingSideReadModel(source({ deals: [arbitrary], payments: [p], claims: [claim], events: [e] })).computeDealSpend('new-key-z', 'USD');
  assert.equal(spend.value.amount, '321');
});

test('18 aggregate groups compatible funding currencies only', () => {
  const money = (amount, currency) => ({ amount, currency, status: 'AUTHORITATIVE', reason: null, authority_refs: [] });
  const groups = buildFundingAggregate([
    { deal_id: 'FUTURE-A', funding_currency: 'USD', verified_received: money('100', 'USD'), actual_spend: money('40', 'USD'), remaining_execution: money('60', 'USD') },
    { deal_id: 'FUTURE-B', funding_currency: 'EUR', verified_received: money('90', 'EUR'), actual_spend: money('30', 'EUR'), remaining_execution: money('60', 'EUR') },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.currency).sort(), ['EUR', 'USD']);
});

test('19 Stage A introduces no browser consumer or financial arithmetic for funding passport V2', () => {
  const browserRoot = path.join(ROOT, 'functions', 'portal', 'main-ui');
  const files = fs.existsSync(browserRoot)
    ? fs.readdirSync(browserRoot).filter((name) => /\.(?:js|mjs)$/.test(name)).map((name) => path.join(browserRoot, name))
    : [];
  const consumers = files.filter((file) => fs.readFileSync(file, 'utf8').includes('ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2'));
  assert.deepEqual(consumers, []);
});

// Blocking-correction regressions.
test('20 USD to USD direct funding and settlement works without acquired_currency', () => {
  const model = buildFundingSideReadModel(singleFunding({
    amount: '100', acquiredAmount: null, acquiredCurrency: null, settlement: { amount: '70', currency: 'USD' },
  }));
  const spend = model.computeDealSpend('deal-a', 'USD');
  const passport = model.passportEventsForDeal('deal-a')[0];
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(spend.value.amount, '100');
  assert.equal(passport.settlement_status, 'AUTHORITATIVE');
  assert.equal(passport.settlement_lines[0].amount, '70');
  assert.equal(passport.native_residuals[0].amount, '30');
  assert.notEqual(passport.settlement_reason, 'FUNDING_EVENT_LINK_MISSING');
});

test('21 two USD to RUB funding events for one Deal link settlements by principal relation', () => {
  const p1 = payment({ key: 'fund-1', amount: '100' });
  const p2 = payment({ key: 'fund-2', amount: '200' });
  const s1 = payment({ key: 'settle-1', amount: '7000', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' });
  const s2 = payment({ key: 'settle-2', amount: '15000', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' });
  const claims = [
    financeClaim({ id: 'a-f1', paymentKey: 'fund-1', lines: [line('deal-a', '100')] }),
    financeClaim({ id: 'a-f2', paymentKey: 'fund-2', lines: [line('deal-a', '200')] }),
    financeClaim({ id: 'a-s1', paymentKey: 'settle-1', principal: 'fund-1', lines: [line('deal-a', '7000', 'RUB')] }),
    financeClaim({ id: 'a-s2', paymentKey: 'settle-2', principal: 'fund-2', lines: [line('deal-a', '15000', 'RUB')] }),
  ];
  const events = [
    event({ id: 'e-f1', paymentKey: 'fund-1', amount: '100', acquiredAmount: '8000', acquiredCurrency: 'RUB' }),
    event({ id: 'e-f2', paymentKey: 'fund-2', amount: '200', acquiredAmount: '16000', acquiredCurrency: 'RUB' }),
  ];
  const model = buildFundingSideReadModel(source({ payments: [p1, p2, s1, s2], claims, events }));
  const passportEvents = model.passportEventsForDeal('deal-a');
  assert.equal(model.computeDealSpend('deal-a', 'USD').value.amount, '300');
  assert.equal(passportEvents.find((x) => x.funding_event_id === 'fund-1').settlement_lines[0].payment_id, 'settle-1');
  assert.equal(passportEvents.find((x) => x.funding_event_id === 'fund-2').settlement_lines[0].payment_id, 'settle-2');
});

test('22 settlement ambiguity does not downgrade authoritative funding spend', () => {
  const p1 = payment({ key: 'fund-1', amount: '100' });
  const p2 = payment({ key: 'fund-2', amount: '200' });
  const settlement = payment({ key: 'settle-x', amount: '5000', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' });
  const claims = [
    financeClaim({ id: 'a-f1', paymentKey: 'fund-1', lines: [line('deal-a', '100')] }),
    financeClaim({ id: 'a-f2', paymentKey: 'fund-2', lines: [line('deal-a', '200')] }),
    financeClaim({ id: 'a-sx', paymentKey: 'settle-x', lines: [line('deal-a', '5000', 'RUB')] }),
  ];
  const events = [
    event({ id: 'e-f1', paymentKey: 'fund-1', amount: '100', acquiredAmount: '8000', acquiredCurrency: 'RUB', correlationId: 'corr-shared' }),
    event({ id: 'e-f2', paymentKey: 'fund-2', amount: '200', acquiredAmount: '16000', acquiredCurrency: 'RUB', correlationId: 'corr-shared' }),
  ];
  const resourceChains = [{
    id: 'rc-x', payment_key: 'settle-x', deal_key: 'deal-a', native_amount: '5000', native_currency: 'RUB',
    accounting_amount: '1', accounting_currency: 'USD', correlation_id: 'corr-shared', current: true, source_locked: true,
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', source_refs: [],
  }];
  const model = buildFundingSideReadModel(source({ payments: [p1, p2, settlement], claims, events, resourceChains }));
  const spend = model.computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(spend.value.amount, '300');
  assert.equal(model.settlementStatusForDeal('deal-a').status, 'TO_VERIFY');
  assert.equal(model.unlinkedSettlementLinesByDeal.get('deal-a')[0].reason, 'SETTLEMENT_LINKAGE_AMBIGUOUS');
});

test('23 missing settlement linkage affects settlement/residual only, never primary funding spend', () => {
  const s = singleFunding({
    amount: '100', acquiredAmount: '8000', acquiredCurrency: 'RUB',
    settlement: { amount: '7000', currency: 'RUB' }, linkSettlement: false,
  });
  const model = buildFundingSideReadModel(s);
  const spend = model.computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(spend.value.amount, '100');
  assert.equal(model.settlementStatusForDeal('deal-a').status, 'TO_VERIFY');
  assert.equal(model.residualStatusForDeal('deal-a').status, 'TO_VERIFY');
  assert.equal(model.passportEventsForDeal('deal-a')[0].funding_status, 'AUTHORITATIVE');
});

test('24 compatible current policy V2 with stable policy_key is accepted automatically', () => {
  const model = buildFundingSideReadModel(source({ policies: policy({ version: 2, compatible: true }) }));
  assert.equal(model.policy.status, 'AUTHORITATIVE');
  assert.equal(model.policy.policy_key, FINANCE_GLOBAL_PAYMENT_POLICY_KEY);
  assert.equal(model.policy.policy_version, 2);
  assert.equal(model.computeDealSpend('deal-a', 'USD').value.reason, 'DIRECT_FUNDING_SIDE_DEBIT_MISSING');
});

test('25 incompatible future policy version fails closed with POLICY_CONTRACT_UNSUPPORTED', () => {
  const model = buildFundingSideReadModel(source({ policies: policy({ version: 3, compatible: false }) }));
  assert.equal(model.policy.status, 'TO_VERIFY');
  assert.equal(model.policy.reason, 'POLICY_CONTRACT_UNSUPPORTED');
  const spend = model.computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'TO_VERIFY');
  assert.equal(spend.value.reason, 'POLICY_CONTRACT_UNSUPPORTED');
});

test('26 shared multi-deal residual is FUNDING_EVENT_SHARED and not duplicated as Deal-owned residual', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-shared-residual', amount: '1000' });
  const claim = financeClaim({
    id: 'attr-shared-residual', paymentKey: p.payment_key, classification: 'KNOWN_MULTI_DEAL_EXACT_SPLIT',
    lines: [line('deal-a', '800'), line('deal-b', '200')],
  });
  const e = event({
    id: 'event-shared-residual', paymentKey: p.payment_key, amount: '1000', acquiredAmount: '81000', acquiredCurrency: 'RUB',
    shares: { 'FUTURE-A': '0.8', 'FUTURE-B': '0.2' }, basis: 'PROPORTIONAL_TO_CONFIRMED_SHARES',
  });
  const model = buildFundingSideReadModel(source({ deals, payments: [p], claims: [claim], events: [e] }));
  assert.equal(model.nativeResiduals.length, 1);
  assert.equal(model.nativeResiduals[0].scope, 'FUNDING_EVENT_SHARED');
  assert.deepEqual(model.nativeResiduals[0].related_deal_ids.sort(), ['FUTURE-A', 'FUTURE-B']);
  const a = model.passportEventsForDeal('deal-a')[0];
  const b = model.passportEventsForDeal('deal-b')[0];
  assert.deepEqual(a.native_residuals, []);
  assert.deepEqual(b.native_residuals, []);
  assert.equal(a.shared_native_residual_refs.length, 1);
  assert.equal(b.shared_native_residual_refs.length, 1);
});

test('27 resource-chain correlation is an authoritative settlement linkage source without using accounting_amount as spend', () => {
  const p1 = payment({ key: 'fund-r1', amount: '100' });
  const p2 = payment({ key: 'fund-r2', amount: '200' });
  const settlement = payment({ key: 'settle-r2', amount: '9000', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' });
  const claims = [
    financeClaim({ id: 'attr-r1', paymentKey: 'fund-r1', lines: [line('deal-a', '100')] }),
    financeClaim({ id: 'attr-r2', paymentKey: 'fund-r2', lines: [line('deal-a', '200')] }),
    financeClaim({ id: 'attr-settle-r2', paymentKey: 'settle-r2', lines: [line('deal-a', '9000', 'RUB')] }),
  ];
  const events = [
    event({ id: 'evt-r1', paymentKey: 'fund-r1', amount: '100', acquiredAmount: '8000', acquiredCurrency: 'RUB', correlationId: 'corr-r1' }),
    event({ id: 'evt-r2', paymentKey: 'fund-r2', amount: '200', acquiredAmount: '10000', acquiredCurrency: 'RUB', correlationId: 'corr-r2' }),
  ];
  const resourceChains = [{
    id: 'chain-r2', payment_key: 'settle-r2', deal_key: 'deal-a', native_amount: '9000', native_currency: 'RUB',
    accounting_amount: '999999999', accounting_currency: 'USD', correlation_id: 'corr-r2', current: true, source_locked: true,
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', source_refs: [],
  }];
  const model = buildFundingSideReadModel(source({ payments: [p1, p2, settlement], claims, events, resourceChains }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').value.amount, '300');
  const linked = model.passportEventsForDeal('deal-a').find((x) => x.funding_event_id === 'fund-r2');
  assert.equal(linked.settlement_lines.length, 1);
  assert.equal(linked.settlement_lines[0].payment_id, 'settle-r2');
});

test('28 native residual aggregate counts each shared funding event residual only once', () => {
  const aggregate = buildNativeResidualAggregate([
    { funding_event_id: 'evt-shared', scope: 'FUNDING_EVENT_SHARED', amount: '10', currency: 'RUB', status: 'AUTHORITATIVE' },
    { funding_event_id: 'evt-single', scope: 'DEAL', amount: '2', currency: 'RUB', status: 'AUTHORITATIVE' },
    { funding_event_id: 'evt-kzt', scope: 'DEAL', amount: '3', currency: 'KZT', status: 'AUTHORITATIVE' },
  ]);
  assert.equal(aggregate.find((x) => x.currency === 'RUB').amount, '12');
  assert.equal(aggregate.find((x) => x.currency === 'KZT').amount, '3');
  assert.deepEqual(aggregate.find((x) => x.currency === 'RUB').funding_event_ids.sort(), ['evt-shared', 'evt-single']);
});

test('29 REVERSE_FX_PRIMARY_COUNT remains zero across mixed funding and settlement inputs', () => {
  const model = buildFundingSideReadModel(singleFunding({
    amount: '100', acquiredAmount: '8000', acquiredCurrency: 'RUB', settlement: { amount: '7000', currency: 'RUB' },
  }));
  assert.equal(model.reverseFxPrimaryCount, 0);
});
