import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('production Operational Center exposes functional controls', () => {
  const center = read('functions/portal/admin-operations-command-center-v5.js');
  const main = read('functions/portal/admin-main-ui-current.js');
  const shell = read('functions/portal/admin-approved-shell-v455-ui.js');
  const deals = read('functions/portal/deals-current-state-ui.js');
  const html = read('portal-src/current/admin.html');

  assert.match(center, /v5-operational-automation/);
  assert.match(center, /__RONA_ADMIN_GLOBAL_SEARCH__/);
  assert.match(center, /ronaOpsV5OpenDeal/);
  assert.match(center, /operations\?\.freshness|ops\?\.freshness/);
  assert.match(main, /patchAdminOperationsCommandCenterV5/);
  assert.match(main, /authority-v1-30s-safe/);
  assert.match(shell, /__RONA_ADMIN_SEARCH_CLICK_BOUND__/);
  assert.match(shell, /\.rona-topbar-search-shell\{position:relative;z-index:2\}/);
  assert.match(shell, /\.rona-admin-topbar-ticker-v2\{pointer-events:none!important;z-index:1!important\}/);
  assert.match(deals, /rona:deal-select/);
  assert.match(html, /data-page="documents"/);
  assert.doesNotMatch(html, /id="page-documents" class="page current-only-hidden-page"/);
  assert.match(html, /portal-admin-radio-final-v9\.js/);
});

test('production UI patch introduces no Finance write or browser calculation', () => {
  const paths = [
    'functions/portal/admin-operations-command-center-v5.js',
    'functions/portal/admin-main-ui-current.js',
    'functions/portal/admin-approved-shell-v455-ui.js',
    'functions/portal/deals-current-state-ui.js',
    'portal-src/current/admin.html',
  ];
  const combined = paths.map(read).join('\n');
  assert.doesNotMatch(combined, /finance_event_submit/i);
  assert.doesNotMatch(read('functions/portal/admin-operations-command-center-v5.js'), /purchase_price|sale_price|rona_margin|exchange_rate|reverse_fx/i);
});


test('Operational Center V5 preserves pre-#599 Flightdeck presentation with current functionality', () => {
  const center = read('functions/portal/admin-operations-command-center-v5.js');
  const main = read('functions/portal/admin-main-ui-current.js');
  const shell = read('functions/portal/admin-approved-shell-v455-ui.js');

  assert.match(center, /rona-flightdeck-v5/);
  assert.match(center, /RONA TRADE · OPERATIONS FLIGHTDECK/);
  assert.match(center, /data-rona-flightdeck':'v5-full-rebuild/);
  assert.match(center, /rona-fd-v5__instruments\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);gap:10px/);
  assert.match(center, /rona-fd-v5-gauge__value\{[^}]*font-size:40px/);
  assert.match(center, /rona-fd-v5-screen__title\{[^}]*font-size:17px/);
  assert.doesNotMatch(center, /rona-ops-v4__metrics\{display:grid;grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);

  assert.match(center, /__RONA_ADMIN_GLOBAL_SEARCH__/);
  assert.match(center, /ronaOpsV5OpenDeal\(id\)/);
  assert.match(center, /rona:deal-select/);
  assert.match(center, /opsMetrics=ops\.metrics\|\|\{\}/);
  assert.match(center, /for\(const x of opsAlerts\)queueRows\.push/);
  assert.match(center, /AUTOMATION · /);
  assert.match(center, /ops\?\.freshness\?\.source_as_of/);
  assert.match(center, /ownerAdminRefreshTick\(true\)/);
  assert.match(main, /authority-v1-30s-safe/);

  assert.match(shell, /grid-template-columns:46px minmax\(160px,220px\) minmax\(360px,480px\) 1fr auto/);
  assert.match(shell, /\.rona-search-focus\{grid-column:5/);
});
