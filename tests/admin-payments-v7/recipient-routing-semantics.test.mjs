import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { adaptBankFacts } from '../../supabase/functions/_shared/admin-payments-v7/adapters.mjs';
import { createAdminPaymentsV7SourceBundle } from '../../supabase/functions/_shared/admin-payments-v7/truth.mjs';
import {
  applyPaymentRecipientSemantics,
  resolvePaymentBankBeneficiary,
  resolvePaymentRecipient,
} from '../../supabase/functions/_shared/admin-payments-v7/recipient.mjs';

const counterparty = 'Business Counterparty';
const beneficiary = 'Bank Route Beneficiary';

function rawPayment(overrides = {}) {
  return {
    id: 'payment-key',
    payment_id: 'payment-public-id',
    payment_at: '2030-01-01T00:00:00Z',
    amount: '1',
    currency: 'USD',
    payment_direction: 'OUTGOING',
    payment_kind: 'SUPPLIER_PAYMENT',
    bank_fact_status: 'BANK_CONFIRMED',
    finance_status: 'VERIFIED',
    finance_verification_status: 'VERIFIED',
    deal_allocation_applicability: 'NOT_APPLICABLE',
    allocation_review_status: 'VERIFIED',
    candidate_deal_ids: [],
    counterparty_name: counterparty,
    beneficiary_name: beneficiary,
    bank_transaction_reference: 'bank-route-ref',
    authority_state: 'VERIFIED',
    lifecycle_state: 'ACTIVE',
    ...overrides,
  };
}

test('recipient uses business counterparty before bank beneficiary', () => {
  assert.equal(resolvePaymentRecipient({ counterparty_name: counterparty, beneficiary_name: beneficiary }), counterparty);
  assert.equal(resolvePaymentBankBeneficiary({ counterparty_name: counterparty, beneficiary_name: beneficiary }), beneficiary);
  const routed = applyPaymentRecipientSemantics({}, { counterparty_name: counterparty, beneficiary_name: beneficiary });
  assert.equal(routed.recipient, counterparty);
  assert.equal(routed.counterparty_name, counterparty);
  assert.equal(routed.beneficiary_name, beneficiary);
});

test('recipient falls back to beneficiary only when counterparty is absent', () => {
  assert.equal(resolvePaymentRecipient({ counterparty_name: '  ', beneficiary_name: beneficiary }), beneficiary);
  assert.equal(resolvePaymentRecipient({ beneficiary_name: beneficiary }), beneficiary);
  assert.equal(resolvePaymentRecipient({ counterparty_name: counterparty }, { beneficiary_name: beneficiary }), counterparty);
});

test('bank fact adapter preserves business and bank identities separately', () => {
  const [payment] = adaptBankFacts([rawPayment()]);
  assert.equal(payment.recipient, counterparty);
  assert.equal(payment.counterparty_name, counterparty);
  assert.equal(payment.beneficiary_name, beneficiary);
  assert.equal(payment.bank_transaction_reference, 'bank-route-ref');
});

test('truth source bundle applies the same recipient contract without mutating raw input', () => {
  const payment = rawPayment();
  const snapshot = JSON.stringify(payment);
  const source = createAdminPaymentsV7SourceBundle({
    generatedAt: '2030-01-01T00:00:00Z',
    sourceAsOf: '2030-01-01T00:00:00Z',
    deals: [], workflows: [], clients: [], contracts: [],
    payments: [payment], paymentAllocations: [], paymentAllocationHistory: [],
    ownerOutgoingPaymentFacts: [], paymentBusinessAttributions: [], paymentBusinessAttributionLines: [],
    dealFinanceAuthorities: [], resourceChains: [], financeEvents: [], globalFinancePolicies: [], settlementFundingAllocations: [],
    capabilities: {},
  });
  assert.equal(source.payments[0].recipient, counterparty);
  assert.equal(source.payments[0].counterparty_name, counterparty);
  assert.equal(source.payments[0].beneficiary_name, beneficiary);
  assert.equal(JSON.stringify(payment), snapshot);
});

test('all source-bundle paths delegate recipient precedence to the shared resolver', () => {
  const root = new URL('../../supabase/functions/_shared/admin-payments-v7/', import.meta.url);
  const adapters = readFileSync(new URL('adapters.mjs', root), 'utf8');
  const truth = readFileSync(new URL('truth.mjs', root), 'utf8');
  const projection = readFileSync(new URL('projection.mjs', root), 'utf8');
  for (const [name, source] of Object.entries({ adapters, truth, projection })) {
    assert.match(source, /applyPaymentRecipientSemantics/,
      `${name} must delegate recipient selection to the shared resolver`);
    assert.doesNotMatch(source, /recipient\s*:\s*[^\n]*beneficiary_name\s*\|\|[^\n]*counterparty_name/,
      `${name} must not restore beneficiary-first recipient precedence`);
  }
  assert.match(projection, /function fundingAwareSourceBundle\(raw\)[\s\S]*applyPaymentRecipientSemantics/);
});
