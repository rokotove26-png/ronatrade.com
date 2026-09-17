import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../../functions/portal/payments-v8-ui.js', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../../functions/portal/admin.js', import.meta.url), 'utf8');

test('Admin Payments V8 renderer reads only the canonical authenticated bootstrap projection', () => {
  assert.match(ui, /\/portal\/api\/v1\/admin\/bootstrap/);
  assert.match(ui, /paymentsV7Projection/);
  assert.match(ui, /contract==='ADMIN_PAYMENTS_V7'/);
  assert.match(ui, /verified_received/);
  assert.match(ui, /due_now/);
  assert.match(ui, /future_conditional/);
  assert.match(ui, /actual_spend/);
  assert.match(ui, /remaining_execution/);
  assert.doesNotMatch(ui, /\/portal\/owner-api/);
  assert.doesNotMatch(ui, /rona-owner-ai-sync/);
  assert.doesNotMatch(ui, /dealFinanceSummaries/);
  assert.doesNotMatch(ui, /owner_deal_finance_summary/);
});

test('Admin shell installs the isolated V8 Payments renderer without business hardcodes', () => {
  assert.match(admin, /\/portal\/payments-v8-ui/);
  assert.match(admin, /x-rona-payments-ui-loader/);
  assert.match(ui, /data-page=\"payments\"/);
  for (const forbidden of [
    /DEAL-2026-\d+/,
    /PAYEV-2026-\d+/,
    /94125|131775|225900|35574\.47|190325\.53|527100/,
  ]) assert.doesNotMatch(ui, forbidden);
});
