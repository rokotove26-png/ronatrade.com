import assert from 'node:assert/strict';
import {
  ADMIN_PAYMENTS_V7_PROJECTION_VERSION,
  FINANCE_RESOURCE_CHAIN_DISPLAY_AUTHORITY,
  applyFinanceSettlementAllocations,
} from '../../supabase/functions/_shared/admin-payments-v7/finance-settlement-allocation.mjs';

const originalProjection = {
  contract: 'ADMIN_PAYMENTS_V7',
  deals: [{
    deal_key: 'deal-key-generic-alpha',
    deal_id: 'DEAL-GENERIC-ALPHA',
    payment_passport: {
      funding_events: [{
        funding_event_id: 'FUNDING-GENERIC-RUB',
        settlement_lines: [{
          payment_key: 'payment-key-a',
          payment_id: 'PAYMENT-GENERIC-A',
          recipient: 'Supplier A',
          amount: '9840.25',
          currency: 'RUB',
          status: 'AUTHORITATIVE',
        }],
      }],
      unlinked_settlement_lines: [{
        payment_key: 'payment-key-b',
        payment_id: 'PAYMENT-GENERIC-B',
        recipient: 'Supplier B',
        amount: '4200',
        currency: 'KZT',
        status: 'TO_VERIFY',
        reason: 'SETTLEMENT_LINKAGE_MISSING',
      }],
    },
  }],
};

const source = {
  capabilities: { settlementFundingAllocation: true, resourceChain: true },
  settlementFundingAllocations: [
    {
      id: 'allocation-a',
      proposal_record_id: 'proposal-a',
      finance_conclusion_id: 'conclusion-a',
      approval_record_id: 'approval-a',
      deal_key: 'deal-key-generic-alpha',
      payment_key: 'payment-key-a',
      payment_id: 'PAYMENT-GENERIC-A',
      calculated_funding_amount: '123.45',
      funding_currency: 'USD',
      conversion_event_id: 'FUNDING-GENERIC-RUB',
      actual_conversion_rate: '79.71000405',
      calculation_method: 'ACTUAL_SETTLEMENT_DIV_ACTUAL_BANK_FX',
      authority_status: 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS',
      funding_allocation_status: 'AUTHORITATIVE',
      source_locked: true,
      source_refs: ['finance-source-a'],
    },
    {
      id: 'allocation-b',
      proposal_record_id: 'proposal-a',
      finance_conclusion_id: 'conclusion-a',
      approval_record_id: 'approval-a',
      deal_key: 'deal-key-generic-alpha',
      payment_key: 'payment-key-b',
      payment_id: 'PAYMENT-GENERIC-B',
      calculated_funding_amount: '8.40',
      funding_currency: 'USD',
      conversion_event_id: 'FUNDING-GENERIC-KZT',
      actual_conversion_rate: '500',
      calculation_method: 'ACTUAL_SETTLEMENT_DIV_ACTUAL_BANK_FX',
      authority_status: 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS',
      funding_allocation_status: 'AUTHORITATIVE',
      source_locked: true,
      source_refs: ['finance-source-b'],
    },
  ],
  resourceChains: [],
};

const projected = applyFinanceSettlementAllocations(originalProjection, source);
const linked = projected.deals[0].payment_passport.funding_events[0].settlement_lines[0];
const unlinked = projected.deals[0].payment_passport.unlinked_settlement_lines[0];

assert.equal(linked.allocated_funding_amount, '123.45');
assert.equal(linked.funding_currency, 'USD');
assert.equal(linked.funding_allocation_status, 'AUTHORITATIVE');
assert.equal(linked.funding_allocation_authority_status, 'CALCULATED_FROM_AUTHORITATIVE_BANK_FACTS');
assert.equal(unlinked.allocated_funding_amount, '8.40');
assert.equal(unlinked.funding_currency, 'USD');

// Actual settlement facts are untouched, including a linkage-only TO_VERIFY row.
assert.equal(linked.amount, '9840.25');
assert.equal(linked.currency, 'RUB');
assert.equal(linked.status, 'AUTHORITATIVE');
assert.equal(unlinked.amount, '4200');
assert.equal(unlinked.currency, 'KZT');
assert.equal(unlinked.status, 'TO_VERIFY');
assert.equal(unlinked.reason, 'SETTLEMENT_LINKAGE_MISSING');

// Non-authoritative derived data is never promoted into the middle column.
const rejected = applyFinanceSettlementAllocations(originalProjection, {
  capabilities: { settlementFundingAllocation: true, resourceChain: false },
  settlementFundingAllocations: [{
    ...source.settlementFundingAllocations[0],
    authority_status: 'TO_VERIFY',
  }],
});
assert.equal(rejected.deals[0].payment_passport.funding_events[0].settlement_lines[0].allocated_funding_amount, undefined);

// Conflicting current allocation rows fail closed rather than choosing a value.
const ambiguous = applyFinanceSettlementAllocations(originalProjection, {
  capabilities: { settlementFundingAllocation: true, resourceChain: false },
  settlementFundingAllocations: [
    source.settlementFundingAllocations[0],
    { ...source.settlementFundingAllocations[0], id: 'allocation-a-duplicate', calculated_funding_amount: '124.00' },
  ],
});
assert.equal(ambiguous.deals[0].payment_passport.funding_events[0].settlement_lines[0].allocated_funding_amount, undefined);

// Finance-authoritative current resource chains may supply a secondary display equivalent
// when there is no dedicated settlement allocation. They never become primary actual_spend.
const resourceChainProjection = applyFinanceSettlementAllocations(originalProjection, {
  capabilities: { settlementFundingAllocation: true, resourceChain: true },
  settlementFundingAllocations: [],
  resourceChains: [
    {
      id: 'chain-a',
      payment_key: 'payment-key-a',
      deal_key: 'deal-key-generic-alpha',
      native_amount: '9840.25',
      native_currency: 'RUB',
      accounting_amount: '117.84730539',
      accounting_currency: 'USD',
      source_locked: true,
      current: true,
      authority_state: 'AUTHORITATIVE',
      lifecycle_state: 'CURRENT',
      authority_refs: [{ source_type: 'PAYMENT_RESOURCE_CHAIN', source_id: 'chain-a' }],
    },
    {
      id: 'chain-b',
      payment_key: 'payment-key-b',
      deal_key: 'deal-key-generic-alpha',
      native_amount: '4200.0000',
      native_currency: 'KZT',
      accounting_amount: '8.4',
      accounting_currency: 'USD',
      source_locked: true,
      current: true,
      authority_state: 'AUTHORITATIVE',
      lifecycle_state: 'CURRENT',
      authority_refs: [{ source_type: 'PAYMENT_RESOURCE_CHAIN', source_id: 'chain-b' }],
    },
  ],
});
const chainLinked = resourceChainProjection.deals[0].payment_passport.funding_events[0].settlement_lines[0];
const chainUnlinked = resourceChainProjection.deals[0].payment_passport.unlinked_settlement_lines[0];
assert.equal(chainLinked.allocated_funding_amount, '117.84730539');
assert.equal(chainLinked.funding_currency, 'USD');
assert.equal(chainLinked.funding_allocation_status, 'AUTHORITATIVE');
assert.equal(chainLinked.funding_allocation_source, FINANCE_RESOURCE_CHAIN_DISPLAY_AUTHORITY);
assert.equal(chainLinked.amount, '9840.25');
assert.equal(chainLinked.currency, 'RUB');
assert.equal(chainUnlinked.allocated_funding_amount, '8.4');
assert.equal(chainUnlinked.funding_currency, 'USD');
assert.equal(chainUnlinked.status, 'TO_VERIFY');
assert.equal(chainUnlinked.reason, 'SETTLEMENT_LINKAGE_MISSING');

// A superseded resource chain is ignored; only the single newest chain can populate display equivalence.
const superseded = applyFinanceSettlementAllocations(originalProjection, {
  capabilities: { settlementFundingAllocation: false, resourceChain: true },
  resourceChains: [
    {
      id: 'old-chain', payment_key: 'payment-key-a', deal_key: 'deal-key-generic-alpha',
      native_amount: '9840.25', native_currency: 'RUB', accounting_amount: '100', accounting_currency: 'USD',
      source_locked: true, current: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT',
    },
    {
      id: 'new-chain', supersedes_id: 'old-chain', payment_key: 'payment-key-a', deal_key: 'deal-key-generic-alpha',
      native_amount: '9840.25', native_currency: 'RUB', accounting_amount: '123.45', accounting_currency: 'USD',
      source_locked: true, current: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT',
    },
  ],
});
assert.equal(superseded.deals[0].payment_passport.funding_events[0].settlement_lines[0].allocated_funding_amount, '123.45');

// Dedicated Finance allocation remains higher precedence than a resource-chain display equivalent.
const precedence = applyFinanceSettlementAllocations(originalProjection, {
  ...source,
  resourceChains: [{
    id: 'chain-a', payment_key: 'payment-key-a', deal_key: 'deal-key-generic-alpha',
    native_amount: '9840.25', native_currency: 'RUB', accounting_amount: '999', accounting_currency: 'USD',
    source_locked: true, current: true, authority_state: 'AUTHORITATIVE', lifecycle_state: 'CURRENT',
  }],
});
assert.equal(precedence.deals[0].payment_passport.funding_events[0].settlement_lines[0].allocated_funding_amount, '123.45');
assert.equal(precedence.deals[0].payment_passport.funding_events[0].settlement_lines[0].funding_allocation_source, 'FINANCE_AUTHORITATIVE_DERIVED');

assert.equal(ADMIN_PAYMENTS_V7_PROJECTION_VERSION, 'ADMIN_PAYMENTS_V7_PROJECTION_FINANCE_SETTLEMENT_ALLOCATION_V2');

console.log('MATERIALIZATION_SOURCE_TO_PROJECTION=PASS');
console.log('RESOURCE_CHAIN_SECONDARY_DISPLAY_FALLBACK=PASS');
console.log('PASSPORT_MIDDLE_COLUMN_FILLED=PASS');
console.log('ACTUAL_SETTLEMENT_COLUMN_PRESERVED=PASS');
console.log('FINANCE_AUTHORITY_FAIL_CLOSED=PASS');
console.log('PROJECTION_VERSION='+ADMIN_PAYMENTS_V7_PROJECTION_VERSION);
