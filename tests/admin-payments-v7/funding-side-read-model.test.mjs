import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFundingAggregate,
  buildFundingSideReadModel,
  buildNativeResidualAggregate,
  FINANCE_GLOBAL_PAYMENT_POLICY_ID,
} from '../../supabase/functions/_shared/admin-payments-v7/funding-side-read-model.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function policy() {
  return [{
    policy_id: FINANCE_GLOBAL_PAYMENT_POLICY_ID,
    scope: 'GLOBAL_FINANCE_ROLE',
    task_scoped: false,
    policy: {
      policy_id: FINANCE_GLOBAL_PAYMENT_POLICY_ID,
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
  }];
}
function deal(key, id) { return { deal_key: key, deal_id: id }; }
function payment({ key, id = key, amount, currency = 'USD', kind = 'INTERNAL_TRANSFER', at = '2031-01-01T00:00:00Z', recipient = null } = {}) {
  return {
    payment_key: key, payment_id: id, amount: String(amount), currency,
    direction: 'OUTGOING', kind, payment_at: at,
    bank_fact_status: 'BANK_CONFIRMED', finance_verification_status: 'VERIFIED',
    current: true, source_locked: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT',
    counterparty_name: recipient, recipient,
  };
}
function financeClaim({ id, paymentKey, lines, classification = 'RESOLVED', attributionMode = 'EXACT' } = {}) {
  return {
    id, payment_key: paymentKey, classification, attribution_mode: attributionMode,
    disposition: 'BIND_TO_DEAL', lines, scope_deal_keys: lines.map((line) => line.deal_key),
    current: true, source_locked: true, authority_kind: 'FINANCE_AI',
    authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [{ source_type: 'FINANCE_EVENT', source_id: id }],
  };
}
function legacyClaim({ id, paymentKey, lines, kind } = {}) {
  return {
    id, payment_key: paymentKey, classification: 'RESOLVED', attribution_mode: 'EXACT', disposition: 'BIND_TO_DEAL',
    lines, scope_deal_keys: lines.map((line) => line.deal_key), current: true, source_locked: true,
    authority_kind: kind, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT', authority_refs: [{ source_type: kind, source_id: id }],
  };
}
function event({ id, paymentKey, amount, currency = 'USD', acquiredAmount = null, acquiredCurrency = null, shares = null, basis = null, fundingLegKind = 'FUNDING_SIDE_DEBIT', rate = null } = {}) {
  return {
    id, payment_key: paymentKey, event_type: 'OUTGOING_PAYMENT_CONFIRMED', event_identity: `evt-${id}`,
    actor_id: 'finance-test', actor_role: 'FINANCE', effective_at: '2031-01-01T00:00:00Z',
    source_refs: [{ source_type: 'BANK_STATEMENT', source_id: `bank-${id}` }],
    request_snapshot: { payload: {
      amount: String(amount), currency, funding_leg_kind: fundingLegKind,
      acquired_amount: acquiredAmount === null ? null : String(acquiredAmount), acquired_currency: acquiredCurrency,
      conversion_rate: rate === null ? null : String(rate), conversion_source_basis: acquiredCurrency ? 'BANK_ACTUAL' : null,
      allocation_shares: shares, allocation_basis: basis,
    } },
    result_snapshot: { accepted: true },
  };
}
function source({ deals = [deal('deal-a', 'FUTURE-A')], payments = [], claims = [], events = [], resourceChains = [] } = {}) {
  return { contour: deals, payments, attributionClaims: claims, financeEvents: events, globalFinancePolicies: policy(), resourceChains };
}
function line(dealKey, amount, currency = 'USD') { return { deal_key: dealKey, amount: String(amount), currency, amount_status: 'EXACT' }; }
function singleFunding({ amount = '100', acquiredAmount = null, acquiredCurrency = null, settlement = null } = {}) {
  const funding = payment({ key: 'fund-a', amount });
  const claims = [financeClaim({ id: 'attr-fund-a', paymentKey: 'fund-a', lines: [line('deal-a', amount)] })];
  const payments = [funding];
  if (settlement) {
    payments.push(payment({ key: settlement.key || 'settle-a', amount: settlement.amount, currency: settlement.currency, kind: settlement.kind || 'COUNTERPARTY_PAYMENT', recipient: 'Counterparty' }));
    claims.push(financeClaim({ id: `attr-${settlement.key || 'settle-a'}`, paymentKey: settlement.key || 'settle-a', lines: [line('deal-a', settlement.amount, settlement.currency)] }));
  }
  return source({ payments, claims, events: [event({ id: 'event-a', paymentKey: 'fund-a', amount, acquiredAmount, acquiredCurrency })] });
}

// 1. single Deal / single direct funding debit
test('1 single Deal / single direct funding debit is primary actual spend', () => {
  const model = buildFundingSideReadModel(singleFunding({ amount: '125' }));
  const spend = model.computeDealSpend('deal-a', 'USD');
  assert.equal(spend.status, 'AUTHORITATIVE');
  assert.equal(spend.value.amount, '125');
  assert.equal(spend.value.currency, 'USD');
});

// 2. USD funding -> RUB settlement
test('2 USD funding to RUB settlement stays funding-first', () => {
  const model = buildFundingSideReadModel(singleFunding({ amount: '100', acquiredAmount: '8200', acquiredCurrency: 'RUB', settlement: { amount: '8000', currency: 'RUB' } }));
  const passport = model.passportEventsForDeal('deal-a')[0];
  assert.equal(passport.funding_amount, '100');
  assert.equal(passport.funding_currency, 'USD');
  assert.equal(passport.settlement_lines[0].amount, '8000');
  assert.equal(passport.settlement_lines[0].currency, 'RUB');
  assert.equal(passport.native_residuals[0].amount, '200');
});

// 3. USD funding -> KZT settlement
test('3 USD funding to KZT settlement preserves KZT settlement semantics', () => {
  const model = buildFundingSideReadModel(singleFunding({ amount: '50', acquiredAmount: '24000', acquiredCurrency: 'KZT', settlement: { amount: '23000', currency: 'KZT' } }));
  const passport = model.passportEventsForDeal('deal-a')[0];
  assert.equal(passport.funding_currency, 'USD');
  assert.equal(passport.acquired_currency, 'KZT');
  assert.equal(passport.settlement_lines[0].currency, 'KZT');
});

// 4. one funding event -> multiple settlement payments
test('4 one funding event supports multiple settlement payments', () => {
  const s = singleFunding({ amount: '100', acquiredAmount: '9000', acquiredCurrency: 'RUB', settlement: { key: 'settle-1', amount: '3000', currency: 'RUB' } });
  s.payments.push(payment({ key: 'settle-2', amount: '4500', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' }));
  s.attributionClaims.push(financeClaim({ id: 'attr-settle-2', paymentKey: 'settle-2', lines: [line('deal-a', '4500', 'RUB')] }));
  const passport = buildFundingSideReadModel(s).passportEventsForDeal('deal-a')[0];
  assert.equal(passport.settlement_lines.length, 2);
  assert.equal(passport.native_residuals[0].amount, '1500');
});

// 5. one funding debit -> multiple Deals
test('5 one funding debit can serve multiple Deals', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-shared', amount: '1000' });
  const claim = financeClaim({ id: 'attr-shared', paymentKey: p.payment_key, classification: 'KNOWN_MULTI_DEAL_EXACT_SPLIT', lines: [line('deal-a', '700'), line('deal-b', '300')] });
  const e = event({ id: 'event-shared', paymentKey: p.payment_key, amount: '1000', shares: { 'FUTURE-A': '0.7', 'FUTURE-B': '0.3' }, basis: 'PROPORTIONAL_TO_CONFIRMED_SHARES' });
  const model = buildFundingSideReadModel(source({ deals, payments: [p], claims: [claim], events: [e] }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').value.amount, '700');
  assert.equal(model.computeDealSpend('deal-b', 'USD').value.amount, '300');
});

// 6. confirmed proportional shares
test('6 confirmed proportional shares are normal Finance allocation', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-prop', amount: '100' });
  const claim = financeClaim({ id: 'attr-prop', paymentKey: p.payment_key, classification: 'KNOWN_MULTI_DEAL_EXACT_SPLIT', lines: [line('deal-a', '80'), line('deal-b', '20')] });
  const e = event({ id: 'event-prop', paymentKey: p.payment_key, amount: '100', shares: { 'FUTURE-A': '0.8', 'FUTURE-B': '0.2' }, basis: 'PROPORTIONAL_TO_CONFIRMED_SHARES' });
  const views = buildFundingSideReadModel(source({ deals, payments: [p], claims: [claim], events: [e] })).passportEventsForDeal('deal-a');
  assert.equal(views[0].allocation_share, '0.8');
  assert.equal(views[0].allocation_source, 'PROPORTIONAL_TO_CONFIRMED_SHARES');
  assert.equal(views[0].synthetic_allocation, false);
});

// 7. authoritative allocation override
test('7 authoritative allocation override takes precedence as event basis', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-override', amount: '100' });
  const claim = financeClaim({ id: 'attr-override', paymentKey: p.payment_key, classification: 'KNOWN_MULTI_DEAL_EXACT_SPLIT', lines: [line('deal-a', '65'), line('deal-b', '35')] });
  const e = event({ id: 'event-override', paymentKey: p.payment_key, amount: '100', shares: { 'FUTURE-A': '0.65', 'FUTURE-B': '0.35' }, basis: 'AUTHORITATIVE_OVERRIDE' });
  const view = buildFundingSideReadModel(source({ deals, payments: [p], claims: [claim], events: [e] })).passportEventsForDeal('deal-a')[0];
  assert.equal(view.allocation_source, 'AUTHORITATIVE_OVERRIDE');
  assert.equal(view.allocated_funding_amount, '65');
});

// 8. confirmed shares absent -> TO_VERIFY
test('8 absent confirmed exact multi-deal shares fail closed', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-no-shares', amount: '100' });
  const scopeOnly = { ...financeClaim({ id: 'attr-scope', paymentKey: p.payment_key, lines: [line('deal-a', '50'), line('deal-b', '50')] }), attribution_mode: 'SCOPE_ONLY' };
  const e = event({ id: 'event-no-shares', paymentKey: p.payment_key, amount: '100' });
  const model = buildFundingSideReadModel(source({ deals, payments: [p], claims: [scopeOnly], events: [e] }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').status, 'TO_VERIFY');
});

// 9. direct funding-side debit absent -> TO_VERIFY
test('9 settlement without direct funding-side debit is TO_VERIFY', () => {
  const p = payment({ key: 'settle-only', amount: '1000', currency: 'RUB', kind: 'COUNTERPARTY_PAYMENT' });
  const claim = financeClaim({ id: 'attr-settle-only', paymentKey: p.payment_key, lines: [line('deal-a', '1000', 'RUB')] });
  const model = buildFundingSideReadModel(source({ payments: [p], claims: [claim], events: [] }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').status, 'TO_VERIFY');
});

// 10. reverse-FX attempt -> rejected
test('10 reverse-FX-shaped event cannot become primary spend', () => {
  const p = payment({ key: 'reverse-event', amount: '100', kind: 'COUNTERPARTY_PAYMENT' });
  const claim = financeClaim({ id: 'attr-reverse', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const e = event({ id: 'event-reverse', paymentKey: p.payment_key, amount: '100', acquiredAmount: '8000', acquiredCurrency: 'RUB', fundingLegKind: 'SETTLEMENT_REVERSE_FX' });
  const model = buildFundingSideReadModel(source({ payments: [p], claims: [claim], events: [e] }));
  assert.notEqual(model.computeDealSpend('deal-a', 'USD').status, 'AUTHORITATIVE');
  assert.equal(model.reverseFxPrimaryCount, 0);
});

// 11. resource_chain.accounting_amount never becomes primary
test('11 resource-chain accounting amount is ignored for primary spend', () => {
  const s = singleFunding({ amount: '100', acquiredAmount: '8100', acquiredCurrency: 'RUB', settlement: { amount: '8000', currency: 'RUB' } });
  s.resourceChains = [{ payment_key: 'settle-a', deal_key: 'deal-a', native_amount: '8000', native_currency: 'RUB', accounting_amount: '999999', accounting_currency: 'USD' }];
  const spend = buildFundingSideReadModel(s).computeDealSpend('deal-a', 'USD');
  assert.equal(spend.value.amount, '100');
});

// 12. native residual stays native
test('12 acquired-currency residual remains native and is not FX converted', () => {
  const model = buildFundingSideReadModel(singleFunding({ amount: '100', acquiredAmount: '8123.45', acquiredCurrency: 'RUB', settlement: { amount: '8000', currency: 'RUB' } }));
  const residual = model.nativeResiduals[0];
  assert.equal(residual.amount, '123.45');
  assert.equal(residual.currency, 'RUB');
});

// 13. old physical allocation cannot override current Finance exact authority
test('13 physical allocation loses precedence to current Finance exact authority', () => {
  const p = payment({ key: 'fund-precedence-physical', amount: '100' });
  const finance = financeClaim({ id: 'finance-current', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const physical = legacyClaim({ id: 'physical-old', paymentKey: p.payment_key, kind: 'PAYMENT_ALLOCATION', lines: [line('deal-a', '90')] });
  const e = event({ id: 'event-precedence-physical', paymentKey: p.payment_key, amount: '100' });
  const spend = buildFundingSideReadModel(source({ payments: [p], claims: [physical, finance], events: [e] })).computeDealSpend('deal-a', 'USD');
  assert.equal(spend.value.amount, '100');
});

// 14. old owner outgoing fact cannot override current Finance exact authority
test('14 owner outgoing fact loses precedence to current Finance exact authority', () => {
  const p = payment({ key: 'fund-precedence-owner', amount: '100' });
  const finance = financeClaim({ id: 'finance-current-owner', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const owner = legacyClaim({ id: 'owner-old', paymentKey: p.payment_key, kind: 'OWNER_OUTGOING_PAYMENT_FACT', lines: [line('deal-a', '75')] });
  const e = event({ id: 'event-precedence-owner', paymentKey: p.payment_key, amount: '100' });
  const spend = buildFundingSideReadModel(source({ payments: [p], claims: [owner, finance], events: [e] })).computeDealSpend('deal-a', 'USD');
  assert.equal(spend.value.amount, '100');
});

// 15. conflicting current Finance exact attribution -> TO_VERIFY
test('15 conflicting current Finance exact attribution is TO_VERIFY', () => {
  const deals = [deal('deal-a', 'FUTURE-A'), deal('deal-b', 'FUTURE-B')];
  const p = payment({ key: 'fund-conflict', amount: '100' });
  const a = financeClaim({ id: 'finance-a', paymentKey: p.payment_key, lines: [line('deal-a', '100')] });
  const b = financeClaim({ id: 'finance-b', paymentKey: p.payment_key, lines: [line('deal-b', '100')] });
  const e = event({ id: 'event-conflict', paymentKey: p.payment_key, amount: '100' });
  const model = buildFundingSideReadModel(source({ deals, payments: [p], claims: [a, b], events: [e] }));
  assert.equal(model.computeDealSpend('deal-a', 'USD').status, 'TO_VERIFY');
  assert.equal(model.computeDealSpend('deal-b', 'USD').status, 'TO_VERIFY');
});

// 16. future Deal without special ID uses identical logic
test('16 arbitrary future Deal ID uses the same logic', () => {
  const arbitrary = deal('new-key-z', 'FUTURE-ZETA');
  const p = payment({ key: 'fund-zeta', amount: '321' });
  const claim = financeClaim({ id: 'finance-zeta', paymentKey: p.payment_key, lines: [line('new-key-z', '321')] });
  const e = event({ id: 'event-zeta', paymentKey: p.payment_key, amount: '321' });
  const spend = buildFundingSideReadModel(source({ deals: [arbitrary], payments: [p], claims: [claim], events: [e] })).computeDealSpend('new-key-z', 'USD');
  assert.equal(spend.value.amount, '321');
});

// 17. aggregate never mixes currencies
test('17 aggregate groups compatible funding currencies only', () => {
  const money = (amount, currency) => ({ amount, currency, status: 'AUTHORITATIVE', reason: null, authority_refs: [] });
  const groups = buildFundingAggregate([
    { deal_id: 'FUTURE-A', funding_currency: 'USD', verified_received: money('100', 'USD'), actual_spend: money('40', 'USD'), remaining_execution: money('60', 'USD') },
    { deal_id: 'FUTURE-B', funding_currency: 'EUR', verified_received: money('90', 'EUR'), actual_spend: money('30', 'EUR'), remaining_execution: money('60', 'EUR') },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.currency).sort(), ['EUR', 'USD']);
});

// 18. browser contains no arithmetic for the new funding-passport contract in Stage A
test('18 Stage A introduces no browser consumer or financial arithmetic for funding passport V2', () => {
  const browserRoot = path.join(ROOT, 'functions', 'portal', 'main-ui');
  const files = fs.existsSync(browserRoot)
    ? fs.readdirSync(browserRoot).filter((name) => /\.(?:js|mjs)$/.test(name)).map((name) => path.join(browserRoot, name))
    : [];
  const consumers = files.filter((file) => fs.readFileSync(file, 'utf8').includes('ADMIN_PAYMENTS_V7_FUNDING_PAYMENT_PASSPORT_V2'));
  assert.deepEqual(consumers, []);
});

test('native residual aggregate groups native currencies without funding conversion', () => {
  const aggregate = buildNativeResidualAggregate([
    { funding_event_id: 'evt-a', amount: '10', currency: 'RUB', status: 'AUTHORITATIVE' },
    { funding_event_id: 'evt-b', amount: '2', currency: 'RUB', status: 'AUTHORITATIVE' },
    { funding_event_id: 'evt-c', amount: '3', currency: 'KZT', status: 'AUTHORITATIVE' },
  ]);
  assert.equal(aggregate.find((x) => x.currency === 'RUB').amount, '12');
  assert.equal(aggregate.find((x) => x.currency === 'KZT').amount, '3');
});
