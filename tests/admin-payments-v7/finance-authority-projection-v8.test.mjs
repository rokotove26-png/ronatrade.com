import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFinanceAuthorityProjectionV8 } from '../../supabase/functions/rona-owner-ai-sync/finance-authority-projection-v8.mjs';

const money = (amount, currency = 'USD', status = 'AUTHORITATIVE') => ({
  amount: amount === null ? null : String(amount),
  currency,
  status,
  reason: status === 'AUTHORITATIVE' ? null : 'QA_TO_VERIFY',
  authority_refs: [{ source_type: 'QA', source_id: `${currency}:${amount}` }],
});

function projection({ received = '225900', spend = '0', residual = '225900' } = {}) {
  return {
    contract: 'ADMIN_PAYMENTS_V7',
    generated_at: '2026-09-17T12:00:00Z',
    source_as_of: '2026-09-17T12:00:00Z',
    source_truth: { finance_authority: 'AUTHORITATIVE' },
    deals: [{
      deal_key: 'qa-deal-key',
      deal_id: 'QA-DEAL-001',
      client_display: 'QA Client',
      payment_handoff_state: 'READY',
      accounting_currency: { currency: 'USD', status: 'AUTHORITATIVE', authority_refs: [] },
      funding_currency: 'USD',
      total_to_receive: money('753000'),
      verified_received: money(received),
      due_now: money('225900'),
      expected_not_due: money('527100'),
      future_conditional: money('0'),
      remaining_to_receive: money(String(753000 - Number(received))),
      actual_spend: money(spend),
      actual_spend_status: 'AUTHORITATIVE',
      remaining_execution: money(residual),
      remaining_execution_status: 'AUTHORITATIVE',
      payment_progress: { percent: '0', status: 'AUTHORITATIVE', reason: null },
      payment_passport: {
        funding_currency: 'USD',
        funding_received: money(received),
        funding_spent: money(spend),
        funding_remaining: money(residual),
        status: 'AUTHORITATIVE',
        reason: null,
        authority_refs: [],
      },
      financial_status: 'DUE',
      documentary_status: 'TO_VERIFY',
      exceptions: [],
      authority_refs: [],
    }],
    payment_passports: [],
    funding_aggregate: [],
    currency_aggregates: {},
  };
}

function financeAuthority({ residual = '190325.53', spend = '35574.47' } = {}) {
  return [{
    id: '11111111-1111-4111-8111-111111111111',
    deal_key: 'qa-deal-key',
    total_to_receive: '753000',
    due_now: '0',
    expected_not_due: '0',
    future_conditional: '527100',
    obligation_currency: 'USD',
    contractual_payment_currency: 'USD',
    mixed_inbound_accounting_currency: null,
    actual_spend: spend,
    actual_spend_status: 'AUTHORITATIVE',
    remaining_execution: residual,
    remaining_execution_status: 'AUTHORITATIVE',
    execution_currency: 'USD',
    execution_status: 'CONFIRMED_EXECUTION_STATE',
    finance_status: 'NOT_DUE',
    documentary_status: 'BANK_STATEMENT_PENDING',
    authority_state: 'AUTHORITATIVE',
    lifecycle_state: 'CURRENT',
    effective_at: '2026-09-17T11:59:00Z',
    source_version: 'QA_FINANCE_AUTHORITY_V8',
    source_timestamp: '2026-09-17T11:59:00Z',
    source_refs: [{ source_type: 'QA_FINANCE', source_id: 'qa-finance-authority' }],
    source_locked: true,
  }];
}

test('Payments V8 projection takes Finance-owned fields from current authority, not stale projection', () => {
  const out = applyFinanceAuthorityProjectionV8(projection(), financeAuthority());
  const deal = out.deals[0];
  assert.equal(deal.total_to_receive.amount, '753000');
  assert.equal(deal.due_now.amount, '0');
  assert.equal(deal.expected_not_due.amount, '0');
  assert.equal(deal.future_conditional.amount, '527100');
  assert.equal(deal.verified_received.amount, '225900');
  assert.equal(deal.remaining_to_receive.amount, '527100');
  assert.equal(deal.actual_spend.amount, '35574.47');
  assert.equal(deal.remaining_execution.amount, '190325.53');
  assert.equal(deal.financial_status, 'CONDITIONAL');
  assert.equal(out.finance_authority_projection_reconciliation.status, 'AUTHORITATIVE_ALIGNED');
  assert.deepEqual(
    deal.finance_authority_projection_reconciliation.corrected_fields.sort(),
    ['actual_spend', 'due_now', 'expected_not_due', 'future_conditional', 'remaining_execution'].sort(),
  );
});

test('authoritative receipt/allocation delta automatically changes Payments remaining receivable when Finance authority is coherent', () => {
  const out = applyFinanceAuthorityProjectionV8(
    projection({ received: '300000', spend: '35574.47', residual: '264425.53' }),
    financeAuthority({ spend: '35574.47', residual: '264425.53' }),
  );
  const deal = out.deals[0];
  assert.equal(deal.verified_received.amount, '300000');
  assert.equal(deal.remaining_to_receive.amount, '453000');
  assert.equal(deal.remaining_execution.amount, '264425.53');
  assert.equal(out.finance_authority_projection_reconciliation.status, 'AUTHORITATIVE_ALIGNED');
});

test('Finance authority / Payments execution divergence fails closed instead of presenting stale residual as current', () => {
  const out = applyFinanceAuthorityProjectionV8(
    projection({ received: '300000', spend: '35574.47', residual: '264425.53' }),
    financeAuthority({ spend: '35574.47', residual: '190325.53' }),
  );
  const deal = out.deals[0];
  assert.equal(deal.verified_received.amount, '300000');
  assert.equal(deal.actual_spend.amount, '35574.47');
  assert.equal(deal.remaining_execution.status, 'TO_VERIFY');
  assert.equal(deal.remaining_execution.amount, null);
  assert.equal(deal.financial_status, 'TO_VERIFY');
  assert.equal(out.finance_authority_projection_reconciliation.status, 'TO_VERIFY');
  assert.equal(out.finance_authority_projection_reconciliation.mismatch_count, 1);
  assert.equal(deal.exceptions.at(-1).code, 'FINANCE_AUTHORITY_PAYMENTS_PROJECTION_MISMATCH');
});

test('projection gate is deal-agnostic and contains no production Deal ID or production amounts', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../../supabase/functions/rona-owner-ai-sync/finance-authority-projection-v8.mjs', import.meta.url), 'utf8'));
  assert.doesNotMatch(source, /DEAL-2026-011/);
  assert.doesNotMatch(source, /225\s?900|527\s?100|35\s?574|190\s?325/);
  assert.doesNotMatch(source, /owner_deal_finance_summary/);
});
