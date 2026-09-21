import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read=path=>readFile(path,'utf8');
const [shell,priceSync,priceConditions]=await Promise.all([
  read('assets/portal-runtime/client-shell-guard-v3.js'),
  read('assets/portal-runtime/client-price-sync-v1.js'),
  read('assets/portal-runtime/client-price-conditions-v1.js')
]);

assert.match(shell,/20260921-client-single-logout-v4-event-driven/);
assert.doesNotMatch(shell,/setInterval\s*\(/);
assert.match(shell,/new MutationObserver\(records=>\{if\(mutationTouchesShell\(records\)\)schedule\(\)\}\)/);

assert.match(priceSync,/rona:client-prices-updated/);
assert.match(priceSync,/emitPriceUpdate\('loaded'\)/);
assert.match(priceSync,/emitPriceUpdate\('cleared'\)/);

assert.match(priceConditions,/20260921-premium-terms-v4-event-driven/);
assert.doesNotMatch(priceConditions,/setInterval\s*\(/);
assert.match(priceConditions,/rona:client-prices-updated/);
assert.match(priceConditions,/rona:client-context-changed/);

console.log('CLIENT_EVENT_DRIVEN_REFRESH_V1=PASS');
console.log('PERPETUAL_CLIENT_POLLING_REMOVED=SHELL_PRICE_CONDITIONS');
