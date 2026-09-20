import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('production Operational Center exposes functional controls', () => {
  const center = read('functions/portal/admin-operations-command-center-v6.js');
  const baseline = read('functions/portal/admin-operations-command-center-v5.js');
  const main = read('functions/portal/admin-main-ui-current.js');
  const shell = read('functions/portal/admin-approved-shell-v455-ui.js');
  const deals = read('functions/portal/deals-current-state-ui.js');
  const html = read('portal-src/current/admin.html');

  assert.match(center, /v6-color-network-indicators/);
  assert.match(center, /NET-07','Клиенты в сети/);
  assert.match(center, /NET-08','Агенты в сети/);
  assert.match(center, /networkClientCount/);
  assert.match(center, /networkAgentCount/);
  assert.match(center, /deriveOperationsDealCurrentRows/);
  assert.match(center, /v1-authoritative-deals-snapshot/);
  assert.match(baseline, /v5-operational-automation/);
  assert.match(baseline, /__RONA_ADMIN_GLOBAL_SEARCH__/);
  assert.match(baseline, /ronaOpsV5OpenDeal/);
  assert.match(baseline, /operations\?\.freshness|ops\?\.freshness/);
  assert.match(main, /patchAdminOperationsCommandCenterV6/);
  assert.match(main, /authority-v1-30s-safe/);
  assert.match(shell, /__RONA_ADMIN_SEARCH_CLICK_BOUND__/);
  assert.match(shell, /\.rona-topbar-search-shell\{position:relative;z-index:2\}/);
  assert.match(shell, /\.rona-admin-topbar-ticker-v2\{pointer-events:none!important;z-index:1!important\}/);
  assert.match(deals, /rona:deal-select/);
  assert.match(deals, /selected=null;window\.__RONA_DEALS_REQUESTED_ID__=null;unmountDealDrawer\(\)/);
  assert.match(deals, /rona:deals-current-state/);
  assert.match(html, /data-page="documents"/);
  assert.doesNotMatch(html, /id="page-documents" class="page current-only-hidden-page"/);
  assert.match(html, /portal-admin-radio-final-v9\.js/);
});

test('production UI patch introduces no Finance write or browser calculation', () => {
  const paths = [
    'functions/portal/admin-operations-command-center-v6.js',
    'functions/portal/admin-operations-command-center-v5.js',
    'functions/portal/admin-main-ui-current.js',
    'functions/portal/admin-approved-shell-v455-ui.js',
    'functions/portal/deals-current-state-ui.js',
    'portal-src/current/admin.html',
  ];
  const combined = paths.map(read).join('\n');
  assert.doesNotMatch(combined, /finance_event_submit/i);
  assert.doesNotMatch(read('functions/portal/admin-operations-command-center-v6.js'), /purchase_price|sale_price|rona_margin|exchange_rate|reverse_fx/i);
  assert.doesNotMatch(read('functions/portal/admin-operations-command-center-v5.js'), /purchase_price|sale_price|rona_margin|exchange_rate|reverse_fx/i);
});
