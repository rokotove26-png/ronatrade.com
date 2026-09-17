import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../../functions/portal/payments-v8-ui.js'), 'utf8');

test('canonical V8 passport shows aggregated native debit in the summary', () => {
  assert.match(source, /function passportNativeTotals\(passport\)/);
  assert.match(source, /text:'Списано в валюте платежа'/);
  assert.match(source, /dataset:\{passportField:'native-total'\}/);
  assert.match(source, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(source, /nativeTotalCard\(passport\)/);
});

test('native debit total is built only from settlement rows and preserves native currency', () => {
  assert.match(source, /kind!==\'settlement\'&&kind!==\'unlinked\'/);
  assert.match(source, /const amount=Number\(item\?\.amount\),currency=upper\(item\?\.currency\)/);
  assert.match(source, /rawMoney\(row\.amount,row\.currency\)/);
});
