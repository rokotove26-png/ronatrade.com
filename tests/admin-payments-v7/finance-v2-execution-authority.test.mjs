import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyFinanceExecutionAuthority, financeExecutionAuthorityEnabled } from '../../supabase/functions/_shared/admin-payments-v7/truth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function money(amount, currency = 'USD', status = 'AUTHORITATIVE', reason = null) {
  return { amount: status === 'AUTHORITATIVE' ? String(amount) : null, currency, status, reason, authority_refs: [{ source_type: 'FINANCE_AUTHORITY', source_id: 'future-finance-authority' }] };
}

function policyV2() {
  return [{
    policy_key: 'FINANCE_GLOBAL_PAYMENT_SEMANTICS',
    version: 2,
    policy: {
      policy_key: 'FINANCE_GLOBAL_PAYMENT_SEMANTICS',
      version: 2,
      rules: {
        FUNDING_CURRENCY_PRIMARY_SEMANTICS: {
          payments_role: 'DISPLAY_ONLY',
          actual_spend_owner: 'FINANCE',
          remaining_owner: 'FINANCE',
          missing_direct_funding_side: 'NOT_SUFFICIENT_FOR_TO_VERIFY',
          to_verify_only_when_finance_cannot_determine: true,
          finance_authoritative_zero_when_no_actual_expense: true,
          primary_actual_spend_source: 'BANK_CONFIRMED_FUNDING_SIDE_DEBIT',
          reverse_fx_as_primary: 'FORBIDDEN',
          resource_chain_accounting_amount_as_primary: 'FORBIDDEN',
        },
      },
    },
  }];
}

function financeClaim({ spend, remaining, spendStatus = 'AUTHORITATIVE', remainingStatus = 'AUTHORITATIVE', currency = 'USD' }) {
  return {
    id: 'future-finance-authority',
    deal_key: 'future-deal-key',
    total_to_receive: money('1000', currency),
    due_now: money('0', currency),
    expected_not_due: money('1000', currency),
    future_conditional: money('0', currency),
    actual_spend: money(spend, currency, spendStatus, spendStatus === 'TO_VERIFY' ? 'FINANCE_EXECUTION_TO_VERIFY' : null),
    actual_spend_status: spendStatus,
    remaining_execution: money(remaining, currency, remainingStatus, remainingStatus === 'TO_VERIFY' ? 'FINANCE_EXECUTION_TO_VERIFY' : null),
    remaining_execution_status: remainingStatus,
    execution_currency: currency,
    execution_status: spendStatus === 'TO_VERIFY' || remainingStatus === 'TO_VERIFY' ? 'TO_VERIFY' : 'CONFIRMED_EXECUTION_STATE',
    finance_status: 'OPEN',
    documentary_status: 'CONFIRMED',
    contractual_payment_currency: currency,
    mixed_inbound_accounting_currency: null,
    current: true,
    source_locked: true,
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    effective_at: '2032-01-01T00:00:00Z',
    source_version: 'future-v2',
    authority_refs: [{ source_type: 'FINANCE_AUTHORITY', source_id: 'future-finance-authority' }],
  };
}

function baseProjection(currency = 'USD') {
  const unresolved = money(null, currency, 'TO_VERIFY', 'DIRECT_FUNDING_SIDE_DEBIT_MISSING');
  return {
    deals: [{
      deal_key: 'future-deal-key',
      deal_id: 'FUTURE-DEAL-X',
      funding_currency: currency,
      accounting_currency: { currency, status: 'AUTHORITATIVE' },
      actual_spend: unresolved,
      actual_spend_status: 'TO_VERIFY',
      remaining_execution: unresolved,
      payment_passport: {
        funding_spent: unresolved,
        funding_remaining: unresolved,
        funding_status: 'TO_VERIFY',
        funding_reason: 'DIRECT_FUNDING_SIDE_DEBIT_MISSING',
        settlement_status: 'AUTHORITATIVE',
        settlement_reason: null,
        residual_status: 'AUTHORITATIVE',
        residual_reason: null,
        status: 'TO_VERIFY',
        reason: 'DIRECT_FUNDING_SIDE_DEBIT_MISSING',
      },
      authority_refs: [],
    }],
    payment_passports: [],
  };
}

function source(claim) {
  return {
    capabilities: { financeAuthority: true },
    financeAuthorities: [claim],
    globalFinancePolicies: policyV2(),
  };
}

test('Finance V2 semantics are detected from stable policy rules, not policy id', () => {
  assert.equal(financeExecutionAuthorityEnabled(policyV2()), true);
  const incompatible = structuredClone(policyV2());
  incompatible[0].policy.rules.FUNDING_CURRENCY_PRIMARY_SEMANTICS.missing_direct_funding_side = 'TO_VERIFY';
  assert.equal(financeExecutionAuthorityEnabled(incompatible), false);
});

test('future Finance authoritative actual_spend=0 and remaining=0 override missing funding event', () => {
  const result = applyFinanceExecutionAuthority(baseProjection(), source(financeClaim({ spend: '0', remaining: '0' })));
  const deal = result.deals[0];
  assert.equal(deal.actual_spend.status, 'AUTHORITATIVE');
  assert.equal(deal.actual_spend.amount, '0');
  assert.equal(deal.remaining_execution.status, 'AUTHORITATIVE');
  assert.equal(deal.remaining_execution.amount, '0');
  assert.equal(deal.finance_execution_authority, true);
  assert.equal(deal.payment_passport.funding_reason, null);
});

test('future Finance authoritative nonzero actual_spend passes exact amount and remaining', () => {
  const result = applyFinanceExecutionAuthority(baseProjection(), source(financeClaim({ spend: '417.25', remaining: '82.75' })));
  const deal = result.deals[0];
  assert.equal(deal.actual_spend.amount, '417.25');
  assert.equal(deal.actual_spend.status, 'AUTHORITATIVE');
  assert.equal(deal.remaining_execution.amount, '82.75');
  assert.equal(deal.remaining_execution.status, 'AUTHORITATIVE');
});

test('future Finance unresolved execution remains TO_VERIFY and is never converted to zero', () => {
  const result = applyFinanceExecutionAuthority(baseProjection(), source(financeClaim({ spend: null, remaining: null, spendStatus: 'TO_VERIFY', remainingStatus: 'TO_VERIFY' })));
  const deal = result.deals[0];
  assert.equal(deal.actual_spend.status, 'TO_VERIFY');
  assert.equal(deal.actual_spend.amount, null);
  assert.equal(deal.remaining_execution.status, 'TO_VERIFY');
  assert.equal(deal.remaining_execution.amount, null);
});

test('legacy Finance authority without execution fields keeps existing funding-side result unchanged', () => {
  const claim = financeClaim({ spend: '5', remaining: '95' });
  claim.actual_spend = null;
  claim.actual_spend_status = null;
  claim.remaining_execution = null;
  claim.remaining_execution_status = null;
  claim.execution_currency = null;
  const before = baseProjection();
  const result = applyFinanceExecutionAuthority(before, source(claim));
  assert.deepEqual(result.deals[0].actual_spend, before.deals[0].actual_spend);
  assert.equal(result.deals[0].finance_execution_authority, undefined);
});

test('reader and materializer are generic and contain no production Deal id/value hardcode', () => {
  const reader = fs.readFileSync(path.join(ROOT, 'supabase/functions/rona-owner-ai-sync/admin-payments-v7-source-reader.mjs'), 'utf8');
  const migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260915203000_admin_payments_v7_finance_execution_authority.sql'), 'utf8');
  const truth = fs.readFileSync(path.join(ROOT, 'supabase/functions/_shared/admin-payments-v7/truth.mjs'), 'utf8');
  const combined = `${reader}\n${migration}\n${truth}`;
  assert.match(reader, /actual_spend::text actual_spend/);
  assert.match(reader, /remaining_execution::text remaining_execution/);
  assert.match(migration, /DEAL_EXECUTION_STATE_CONFIRMED/);
  assert.match(migration, /MATERIALIZE_FINANCE_AUTHORITATIVE_RESULT/);
  assert.doesNotMatch(combined, /DEAL-2026-00[4569]/);
  assert.doesNotMatch(combined, /229862\.96|168000|42000|9300690/);
});
