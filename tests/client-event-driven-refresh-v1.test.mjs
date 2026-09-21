import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read=path=>readFile(path,'utf8');
const [shell,priceSync,priceConditions,railAdapter,adminRail,railAttach]=await Promise.all([
  read('assets/portal-runtime/client-shell-guard-v3.js'),
  read('assets/portal-runtime/client-price-sync-v1.js'),
  read('assets/portal-runtime/client-price-conditions-v1.js'),
  read('functions/portal/client-rail-current-ui.js'),
  read('functions/portal/rail-current-v4-ui.js'),
  read('scripts/attach-client-rail-production-v1.mjs')
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

assert.match(adminRail,/timer=setInterval\(sync,30000\)/);
assert.match(railAdapter,/CLIENT_TIMER_FROM=";timer=setInterval\(sync,30000\)"/);
assert.match(railAdapter,/\.replace\(CLIENT_TIMER_FROM,CLIENT_TIMER_TO\)/);
assert.match(railAdapter,/CLIENT_RAIL_EVENT_DRIVEN_REFRESH_V1/);
assert.match(railAdapter,/rona:client-rail-invalidated/);
assert.match(railAdapter,/CLIENT_RAIL_PERIODIC_REFRESH_REMAINS/);
assert.match(railAttach,/authoritative_refresh_ms:null/);
assert.match(railAttach,/auto_refresh:false/);
assert.match(railAttach,/refresh_policy:'OPEN_CONTEXT_CHANGE_INVALIDATION'/);

console.log('CLIENT_EVENT_DRIVEN_REFRESH_V1=PASS');
console.log('PERPETUAL_CLIENT_POLLING_REMOVED=SHELL_PRICE_CONDITIONS_RAIL');
console.log('ADMIN_RAIL_REFRESH_UNCHANGED=PASS');
