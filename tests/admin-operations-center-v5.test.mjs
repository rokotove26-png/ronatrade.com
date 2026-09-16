import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Cloudflare build overlays only Operational Center files', () => {
  const source = read('scripts/admin-payments-v7-cloudflare-build.mjs');
  assert.match(source, /OPERATIONS_CENTER_V5_OVERRIDES=READY/);
  const match = source.match(/const OPERATIONS_CENTER_OVERRIDES = \[([\s\S]*?)\];/);
  assert.ok(match);
  assert.doesNotMatch(match[1], /payments|finance/i);
  assert.match(match[1], /admin-operations-command-center-v5\.js/);
});

test('Operational Center UI exposes functional controls', () => {
  const center = read('functions/portal/admin-operations-command-center-v5.js');
  const main = read('functions/portal/admin-main-ui-current.js');
  const shell = read('functions/portal/admin-approved-shell-v455-ui.js');
  const deals = read('functions/portal/deals-current-state-ui.js');
  const html = read('portal-src/current/admin.html');
  assert.match(center, /v5-operational-automation/);
  assert.match(center, /__RONA_ADMIN_GLOBAL_SEARCH__/);
  assert.match(center, /ronaOpsV5OpenDeal/);
  assert.match(center, /operations\?\.freshness|ops\?\.freshness/);
  assert.match(main, /\/admin\/documents\/'\+encodeURIComponent\(x\.document_id\)\+'\/review/);
  assert.match(main, /authority-v1-30s-safe/);
  assert.match(shell, /__RONA_ADMIN_GLOBAL_SEARCH__/);
  assert.match(shell, /addEventListener\('click',run\)/);
  assert.doesNotMatch(shell, /\.onclick=run/);
  assert.match(deals, /rona:deal-select/);
  assert.match(html, /data-page="documents"/);
  assert.doesNotMatch(html, /id="page-documents" class="page current-only-hidden-page"/);
});

test('server read model is read-only and document review is audited', () => {
  const index = read('supabase/functions/rona-owner-acceptance/index.ts');
  const operations = read('supabase/functions/rona-owner-acceptance/operations-center.ts');
  assert.match(index, /buildOperationsCenter/);
  assert.match(index, /OWNER_DOCUMENT_REVIEWED/);
  assert.match(index, /OWNER_DOCUMENT_REVIEW_CLEARED/);
  assert.match(index, /\^\\\/admin\\\/documents\\\/\(\[\^\/\]\+\)\\\/review\$/);
  assert.match(operations, /OPERATIONS_CENTER_V5/);
  assert.doesNotMatch(operations, /\b(insert|update|delete|truncate|alter|drop)\b/i);
});

test('no Finance event submit or browser financial calculation is introduced', () => {
  const paths = [
    'functions/portal/admin-operations-command-center-v5.js',
    'functions/portal/admin-main-ui-current.js',
    'functions/portal/admin-approved-shell-v455-ui.js',
    'functions/portal/deals-current-state-ui.js',
    'supabase/functions/rona-owner-acceptance/index.ts',
    'supabase/functions/rona-owner-acceptance/operations-center.ts',
  ];
  const combined = paths.map(read).join('\n');
  assert.doesNotMatch(combined, /finance_event_submit/i);
  assert.doesNotMatch(read('supabase/functions/rona-owner-acceptance/operations-center.ts'), /purchase_price|sale_price|rona_margin|exchange_rate|reverse_fx/i);
});
