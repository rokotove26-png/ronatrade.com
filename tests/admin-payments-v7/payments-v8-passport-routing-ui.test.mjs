import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../functions/portal/payments-v8-ui.js', import.meta.url), 'utf8');

test('live V8 Payments exposes a canonical Payment Passport modal trigger', () => {
  assert.match(source, /PASSPORT_MODAL_ID='ronaPaymentsV8PassportModal'/);
  assert.match(source, /data-payments-v8-passport-deal|paymentsV8PassportDeal/);
  assert.match(source, /function openPassport\(dealId\)/);
  assert.match(source, /payment_passport/);
});

test('passport presents business recipient and bank routing as separate fields', () => {
  assert.match(source, /kv\('Получатель',recipient,'recipient'\)/);
  assert.match(source, /kv\('Банковский получатель',beneficiary,'bank-beneficiary'\)/);
  assert.match(source, /kv\('Банковский маршрут',route,'bank-route'\)/);
  assert.match(source, /const recipient=text\(item\?\.recipient\)/);
  assert.match(source, /const beneficiary=text\(item\?\.bank_beneficiary_name\|\|item\?\.beneficiary_name\)/);
  assert.match(source, /const route=text\(item\?\.bank_route_reference\|\|item\?\.bank_document\)/);
  assert.doesNotMatch(source, /const recipient=text\(item\?\.(?:bank_beneficiary_name|beneficiary_name)\)/);
});

test('passport remains projection-only and has no business mutation path', () => {
  assert.match(source, /const ENDPOINT='\/portal\/api\/v1\/admin\/bootstrap'/);
  assert.doesNotMatch(source, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(source, /finance_event_submit|payment_allocations|insert\s+into|update\s+portal_private/i);
});
