import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  LIVE_ADMIN_SOURCE_COMMIT,
  LIVE_ADMIN_ENTRYPOINT,
  LIVE_MAIN_UI_SOURCE,
  LIVE_PAYMENTS_RENDERER,
  LIVE_DEPLOYMENT_LINEAGE,
  LIVE_BLOBS,
  PAYMENTS_V7_BROWSER_RUNTIME,
  STAGE5B_ROUTE_OWNER,
  patchAssembledLiveAdminScript,
  patchLiveAdminMainUiSource,
  recoverLiveAdminWorkspace,
} from '../../scripts/admin-payments-v7-stage5b-live-source.mjs';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
}
function show(path) {
  return execFileSync('git', ['show', `${LIVE_ADMIN_SOURCE_COMMIT}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

test('Stage 5B — exact live Admin source lineage is source-locked', () => {
  assert.equal(LIVE_ADMIN_SOURCE_COMMIT, '86133bfa66f044944434aeb0baed07af5d84621e');
  for (const [path, blob] of Object.entries(LIVE_BLOBS)) {
    assert.equal(git('rev-parse', `${LIVE_ADMIN_SOURCE_COMMIT}:${path}`), blob, path);
  }
  assert.equal(LIVE_ADMIN_ENTRYPOINT, 'assets/portal-admin-shell-fast-v1.js');
  assert.match(LIVE_MAIN_UI_SOURCE, /admin-main-ui-current\.js/);
  assert.match(LIVE_PAYMENTS_RENDERER, /chunk3\.js::renderPayments/);
  assert.match(LIVE_DEPLOYMENT_LINEAGE, /Cloudflare Workers ronatrade-com/);
  assert.match(LIVE_DEPLOYMENT_LINEAGE, /admin-shell-live-production PASS/);
});

test('Stage 5B — recovered live shell proves the actual Payments owner before patch', () => {
  const shell = show('assets/portal-admin-shell-fast-v1.js');
  const html = show('portal-src/current/admin.html');
  const mainIndex = show('functions/portal/main-ui/index.js');
  const chunk3 = show('functions/portal/owner-ui-chunks/chunk3.js');
  assert.match(shell, /__RONA_ADMIN_SHELL_RESILIENCE__='single-owner-v3'/);
  assert.match(shell, /\/portal\/main-ui/);
  assert.match(html, /class="sidebar"/);
  assert.match(html, /class="topbar"/);
  assert.match(html, /data-page="payments"/);
  assert.match(html, /id="page-payments"/);
  assert.match(mainIndex, /serveCurrentAdminUi.*admin-main-ui-current\.js/s);
  assert.match(chunk3, /function financeFragment\(\)/);
  assert.match(chunk3, /function renderPayments\(\)/);
  assert.match(chunk3, /Поступило от клиентов/);
});

test('Stage 5B — build-time integration retires legacy Payments renderer, not the shell', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rona-stage5b-'));
  try {
    recoverLiveAdminWorkspace(root);
    const adminMain = join(root, 'functions/portal/admin-main-ui-current.js');
    const original = readFileSync(join(root, 'functions/portal/admin-main-ui-current.live-original.js'), 'utf8');
    const patchedSource = readFileSync(adminMain, 'utf8');
    assert.match(original, /x-rona-payments-ui':'finance-current-v2/);
    assert.match(patchedSource, /patchPaymentsV7/);
    assert.match(patchedSource, /x-rona-payments-ui':'admin-payments-v7-native/);
    assert.match(patchedSource, /x-rona-payments-handoff':'payments-v7-projection/);
    assert.doesNotMatch(patchedSource, /portal-src\/current\/admin\.html/);

    const mod = await import(`${pathToFileURL(adminMain).href}?stage5b=${Date.now()}`);
    const response = await mod.onRequest({});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-rona-payments-ui'), 'admin-payments-v7-native');
    assert.equal(response.headers.get('x-rona-payments-handoff'), 'payments-v7-projection');
    const script = await response.text();
    const rendererStart = script.indexOf('function paymentsV7Projection()');
    const rendererEnd = script.indexOf('function renderCash(){', rendererStart);
    assert.ok(rendererStart >= 0 && rendererEnd > rendererStart);
    const paymentsRuntime = script.slice(rendererStart, rendererEnd);
    assert.equal((script.match(/function renderPayments\(\)\{/g) || []).length, 1);
    assert.match(paymentsRuntime, /paymentsV7Projection/);
    assert.match(paymentsRuntime, /owner_exception_queue/);
    assert.match(paymentsRuntime, new RegExp(STAGE5B_ROUTE_OWNER));
    assert.doesNotMatch(paymentsRuntime, /financeFragment/);
    assert.doesNotMatch(paymentsRuntime, /Поступило от клиентов/);
    assert.doesNotMatch(paymentsRuntime, /MutationObserver|rebind|takeover/i);
    assert.match(script, /function financeFragment\(\)/); // retained for Cash / other consumers only
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Stage 5B — global KPI layout is 4x1 / 2x2 / 1x4 and data-driven', () => {
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /@media\(max-width:1100px\).*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /@media\(max-width:640px\).*grid-template-columns:1fr/s);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /paymentsV7Aggregate\(deals,'total_to_receive'\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /paymentsV7Aggregate\(deals,'verified_received'\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /paymentsV7Aggregate\(deals,'expected_not_due'\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /paymentsV7Aggregate\(deals,'future_conditional'\)/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /actual_spend_status/);
  assert.match(PAYMENTS_V7_BROWSER_RUNTIME, /TO_VERIFY/);
});

test('Stage 5B — production integration logic contains zero Deal/client/amount hardcodes', () => {
  const productionSource = [PAYMENTS_V7_BROWSER_RUNTIME, patchLiveAdminMainUiSource(show('functions/portal/admin-main-ui-current.js'))].join('\n');
  for (const forbidden of [
    /DEAL-2026-00[4569]/,
    /236250|672500|201750|470750|164400|49320|115080|31002300|9300690|21701610|362600/,
    /ГазОнэ|UNVERSAL SOLYARIS|FARG.O?NA/i,
  ]) assert.doesNotMatch(productionSource, forbidden);
});

test('Stage 5B — assembled patch fails closed if exact legacy renderer marker drifts', () => {
  assert.throws(() => patchAssembledLiveAdminScript('function renderPayments(){} function renderCash(){}'), /SOURCE_MISMATCH/);
});
