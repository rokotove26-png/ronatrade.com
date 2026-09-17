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
  assert.match(source, /recipient=text\(item\?\.recipient\)/);
  assert.match(source, /beneficiary=text\(item\?\.bank_beneficiary_name\|\|item\?\.beneficiary_name\)/);
  assert.match(source, /route=text\(item\?\.bank_route_reference\|\|item\?\.bank_document\)/);
  assert.doesNotMatch(source, /recipient=text\(item\?\.(?:bank_beneficiary_name|beneficiary_name)\)/);
});

test('canonical V8 disables the legacy V7 passport capture runtime', () => {
  assert.match(source, /LEGACY_PASSPORT_MODAL_ID='ronaPaymentsV7PassportDesignerModal'/);
  assert.match(source, /document\.__ronaPaymentsV7PassportOwnerTableV2Handler/);
  assert.match(source, /removeEventListener\('click',handler,true\)/);
  assert.match(source, /\.rona-payments-v7-passport-trigger,\.rona-payments-v7-passport > summary/);
  assert.match(source, /__RONA_PAYMENTS_V8_OPEN_PASSPORT__/);
  assert.match(source, /__RONA_PAYMENTS_V8_LEGACY_PASSPORT_DISABLED__/);
});

test('multi-currency passport shows native debit and deal-accounting amount together', () => {
  assert.match(source, /kv\('Фактическое списание'/);
  assert.match(source, /kv\('В валюте сделки'/);
  assert.match(source, /allocated_funding_amount/);
  assert.match(source, /funding_currency/);
});

test('passport remains projection-only and has no business mutation path', () => {
  assert.match(source, /const ENDPOINT='\/portal\/api\/v1\/admin\/bootstrap'/);
  assert.doesNotMatch(source, /method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(source, /finance_event_submit|payment_allocations|insert\s+into|update\s+portal_private/i);
});
