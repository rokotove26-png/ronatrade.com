import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const ui = readFileSync(new URL('../../functions/portal/payments-v8-ui.js', import.meta.url), 'utf8');
const mainUiMiddleware = readFileSync(new URL('../../functions/portal/main-ui/_middleware.js', import.meta.url), 'utf8');
const adminRoute = readFileSync(new URL('../../functions/portal/admin.js', import.meta.url), 'utf8');

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

test('current-only main UI loads the V8 bootstrap as a data/passport bridge while V7 remains visual owner', () => {
  assert.match(mainUiMiddleware, /PAYMENTS_V8_BOOTSTRAP_OWNER='payments-v8-bootstrap-v1'/);
  assert.match(mainUiMiddleware, /\/portal\/payments-v8-ui\?v=20260921-passport-selfheal-v1/);
  assert.match(mainUiMiddleware, /canonical-v8-bootstrap/);
  assert.match(mainUiMiddleware, /x-rona-payments-current-runtime','due-now-conditional-v3/);
  assert.match(ui, /DATA_AND_PASSPORT_BRIDGE/);
  assert.match(ui, /VISUAL_OWNER='admin-payments-v7-native-v2'/);
  assert.doesNotMatch(ui, /page\.replaceChildren\(/);
});
test('Admin route remains current-only and non-rewriting', () => {
  assert.match(adminRoute, /ASSETS\?\.fetch/);
  assert.doesNotMatch(adminRoute, /HTMLRewriter/);
  assert.doesNotMatch(adminRoute, /payments-v8-ui/);
});

test('Payments V8 UI contains no production business hardcodes', () => {
  for (const source of [ui, mainUiMiddleware]) {
    for (const forbidden of [
      /DEAL-2026-\d+/,
      /PAYEV-2026-\d+/,
      /94125|131775|225900|35574\.47|190325\.53|527100/,
    ]) assert.doesNotMatch(source, forbidden);
  }
});
