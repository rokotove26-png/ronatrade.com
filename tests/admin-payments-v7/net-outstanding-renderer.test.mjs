import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminPaymentsV7NativeView } from '../../supabase/functions/_shared/admin-payments-v7/native-renderer.mjs';

function money(amount, currency) {
  return { amount: String(amount), currency, status: 'AUTHORITATIVE', reason: null, authority_refs: [] };
}

test('Ожидается renders net outstanding while conditional remains classification', () => {
  const view = createAdminPaymentsV7NativeView({
    paymentsV7Projection: {
      contract: 'ADMIN_PAYMENTS_V7',
      deals: [{
        deal_key: 'deal-009-key',
        deal_id: 'DEAL-2026-009',
        client_display: 'ГазОнэ',
        total_to_receive: money('31002300', 'RUB'),
        verified_received: money('10000000', 'RUB'),
        remaining_to_receive: money('21002300', 'RUB'),
        due_now: money('0', 'RUB'),
        expected_not_due: money('0', 'RUB'),
        future_conditional: money('21002300', 'RUB'),
        actual_spend: money('0', 'RUB'),
        actual_spend_status: 'AUTHORITATIVE',
        remaining_execution: money('10000000', 'RUB'),
        payment_progress: { percent: '32.2556709', status: 'AUTHORITATIVE' },
        financial_status: 'CONDITIONAL',
        documentary_status: 'BANK_STATEMENT_PENDING',
        accounting_currency: { currency: 'RUB', status: 'AUTHORITATIVE' },
        authority_refs: [],
        exceptions: [],
      }],
      owner_exception_queue: [],
    },
  });

  assert.equal(view.deals[0].expected, '21 002 300 RUB');
  assert.equal(view.deals[0].conditional, '21 002 300 RUB');
  assert.equal(view.deals[0].conditional_present, true);
  assert.equal(view.deals[0].financial_status, 'CONDITIONAL');
  assert.deepEqual(view.kpis.expected.rows, [{ currency: 'RUB', amount: '21 002 300' }]);
});

test('post-payment deal shows full outstanding in Ожидается even when expected_not_due is zero', () => {
  const view = createAdminPaymentsV7NativeView({
    paymentsV7Projection: {
      contract: 'ADMIN_PAYMENTS_V7',
      deals: [{
        deal_key: 'deal-010-key',
        deal_id: 'DEAL-2026-010',
        client_display: 'FARGONA GAZ',
        total_to_receive: money('131775', 'USD'),
        verified_received: money('0', 'USD'),
        remaining_to_receive: money('131775', 'USD'),
        due_now: money('0', 'USD'),
        expected_not_due: money('0', 'USD'),
        future_conditional: money('131775', 'USD'),
        actual_spend: money('6473.46', 'USD'),
        actual_spend_status: 'AUTHORITATIVE',
        remaining_execution: money('-6473.46', 'USD'),
        payment_progress: { percent: '0', status: 'AUTHORITATIVE' },
        financial_status: 'CONDITIONAL',
        documentary_status: 'TO_VERIFY',
        accounting_currency: { currency: 'USD', status: 'AUTHORITATIVE' },
        authority_refs: [],
        exceptions: [],
      }],
      owner_exception_queue: [],
    },
  });

  assert.equal(view.deals[0].expected, '131 775 USD');
  assert.equal(view.deals[0].conditional, '131 775 USD');
});
