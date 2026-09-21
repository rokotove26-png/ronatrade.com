import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const read=path=>readFile(path,'utf8');
const [shell,priceSync,priceConditions,logoutVisual,applications,directory,marketIntelligence,marketNews,applicationLifecycle,contractV3]=await Promise.all([
  read('assets/portal-runtime/client-shell-guard-v3.js'),
  read('assets/portal-runtime/client-price-sync-v1.js'),
  read('assets/portal-runtime/client-price-conditions-v1.js'),
  read('assets/portal-runtime/client-logout-visual-v1.js'),
  read('assets/portal-runtime/client-applications-live-render-v1.js'),
  read('assets/portal-runtime/portal-client-company-directory-authority-v1.js'),
  read('assets/portal-runtime/client-market-intelligence-v1.js'),
  read('assets/portal-runtime/client-market-news-admin-parity-v1.js'),
  read('assets/portal-runtime/client-application-lifecycle-v1.js'),
  read('assets/portal-runtime/client-contract-download-v3.js')
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
assert.match(priceConditions,/function isPriceInteraction/);
assert.doesNotMatch(priceConditions,/document\.addEventListener\('change'/);

assert.match(logoutVisual,/20260830-client-logout-force-red-v2/);
assert.doesNotMatch(logoutVisual,/setInterval\s*\(/);
assert.match(logoutVisual,/window\.addEventListener\('focus',schedule/);
assert.match(logoutVisual,/EVENT_DRIVEN_FILTERED_MUTATION_V1/);
assert.match(logoutVisual,/mutationTouchesLogout/);
assert.match(logoutVisual,/\.observe\(document\.body/);
assert.doesNotMatch(logoutVisual,/\.observe\(document\.documentElement/);

assert.match(applications,/20260921-client-applications-live-render-v2-event-driven/);
assert.doesNotMatch(applications,/setInterval\s*\(/);
assert.match(applications,/rona:client-current-projection/);
assert.match(applications,/refreshCurrentProjection/);
assert.match(applications,/getCurrentProjection/);

assert.doesNotMatch(directory,/setInterval\s*\(/);
assert.match(directory,/rona:client-company-directory-invalidated/);
assert.match(directory,/rona:client-application-submitted/);

assert.match(marketIntelligence,/20260921-client-market-intelligence-v3-event-driven/);
assert.doesNotMatch(marketIntelligence,/setInterval\s*\(/);
assert.match(marketIntelligence,/rona:client-market-intelligence-invalidated/);
assert.match(marketIntelligence,/section-open/);

assert.doesNotMatch(marketNews,/setInterval\s*\(/);
assert.match(marketNews,/rona:client-market-intelligence-invalidated/);
assert.match(marketNews,/function activate\(\).*loadData\(true\)/);

assert.doesNotMatch(applicationLifecycle,/setInterval\s*\(/);
assert.match(applicationLifecycle,/rona:client-current-projection/);
assert.doesNotMatch(contractV3,/setInterval\s*\(/);
assert.match(contractV3,/rona:client-company-directory-invalidated/);

console.log('CLIENT_EVENT_DRIVEN_REFRESH_V1=PASS');
console.log('PERPETUAL_CLIENT_POLLING_REMOVED=SHELL_PRICE_CONDITIONS_LOGOUT_VISUAL_APPLICATIONS_DIRECTORY_MARKET_LIFECYCLE_CONTRACT');
