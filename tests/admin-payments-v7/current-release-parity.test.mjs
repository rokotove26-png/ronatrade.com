import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FINAL_LIVE_ADMIN_SOURCE_COMMIT,
  recoverLiveAdminWorkspace,
} from '../../scripts/admin-payments-v7-final-live-source.mjs';

const CURRENT_RELEASE_HEAD = 'a45be4eb65d07794c3d7d848c8a222631d99c7ad';
const show = (path) => execFileSync('git', ['show', `${FINAL_LIVE_ADMIN_SOURCE_COMMIT}:${path}`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

test('Payments V7 materializes from the exact current release head', () => {
  assert.equal(FINAL_LIVE_ADMIN_SOURCE_COMMIT, CURRENT_RELEASE_HEAD);
});

test('locked release includes the Admin Add Company signed-contract workflow', () => {
  const access = show('functions/portal/clients-agents-current-ui.js');
  assert.match(access, /Добавить компанию/);
  assert.match(access, /Название компании/);
  assert.match(access, /ИНН/);
  assert.match(access, /Страна регистрации/);
  assert.match(access, /Прикрепить договор/);
  assert.doesNotMatch(access, /void choosePdf\(row,up\)/);
  assert.match(access, /реестра ИИ операционного директора/);
  assert.match(access, /Реестр подтверждён:/);
});

test('locked release Create User has no pre-PDF toggle and lists only current companies', () => {
  const access = show('functions/portal/clients-agents-current-ui.js');
  const control = show('supabase/functions/rona-admin-control-plane/index.ts');
  const authority = show('supabase/functions/rona-admin-authority/index.ts');
  assert.doesNotMatch(access, /Открыть учётную запись до подтверждения PDF/);
  assert.doesNotMatch(access, /openWithoutContract/);
  assert.match(access, /Учётная запись создаётся независимо от статуса PDF/);
  assert.match(access, /for\(const c of activeContracts\(\)\)/);
  assert.doesNotMatch(access, /for\(const cl of clients\(\)\)/);
  assert.match(control, /accountCreationIndependentFromSignedPdfGate: true/);
  assert.match(control, /pendingContractAccessFailClosed: true/);
  assert.match(authority, /cl\.lifecycle_state='ACTIVE'/);
});

test('current release UI layers remain byte-identical through Payments V7 recovery', () => {
  const root = mkdtempSync(join(tmpdir(), 'rona-payments-release-parity-'));
  try {
    recoverLiveAdminWorkspace(root);
    for (const path of [
      'functions/portal/main-ui/index.js',
      'functions/portal/main-ui/application-passport-runtime.js',
      'functions/portal/main-ui/application-passport-runtime-base.js',
      'functions/portal/owner-ui-chunks/chunk18.js',
      'functions/portal/owner-ui-chunks/chunk18-base.js',
      'assets/portal-admin-shell-fast-v1.js',
      'portal-src/current/admin.html',
    ]) {
      assert.equal(readFileSync(join(root, path), 'utf8'), show(path), path);
    }

    const currentMainUi = readFileSync(join(root, 'functions/portal/main-ui/index.js'), 'utf8');
    assert.match(currentMainUi, /patchPaymentsV7Runtime/);
    assert.match(currentMainUi, /applicationPassportRuntime/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('focused Prices and Applications behavior and visual layers remain byte-identical to current release', () => {
  const root = mkdtempSync(join(tmpdir(), 'rona-payments-focused-release-parity-'));
  try {
    recoverLiveAdminWorkspace(root);
    const focusedPaths = [
      'functions/portal/prices-current-ui.js',
      'functions/portal/price-updates-api.js',
      'assets/portal-market-news-no-gray-bands-v1.css',
      'functions/portal/main-ui/admin-applications-premium-v1.js',
      'functions/portal/main-ui/application-passport-runtime.js',
      'functions/portal/main-ui/application-passport-runtime-base.js',
    ];
    for (const path of focusedPaths) {
      assert.equal(readFileSync(join(root, path), 'utf8'), show(path), path);
    }

    const pricesRuntime = readFileSync(join(root, 'functions/portal/prices-current-ui.js'), 'utf8');
    const pricesApi = readFileSync(join(root, 'functions/portal/price-updates-api.js'), 'utf8');
    const pricesCss = readFileSync(join(root, 'assets/portal-market-news-no-gray-bands-v1.css'), 'utf8');
    assert.match(pricesRuntime, /window\.__RONA_PRICES_CURRENT_UI__/);
    assert.match(pricesRuntime, /updateApi\('apply'/);
    assert.match(pricesRuntime, /updateApi\('reject'/);
    assert.match(pricesRuntime, /updateApi\('audience'/);
    assert.match(pricesApi, /owner_apply_price_change_proposal/);
    assert.match(pricesApi, /owner_reject_price_change_proposal/);
    assert.match(pricesApi, /owner_set_price_publication_audience/);
    assert.match(pricesCss, /ADMIN_PRICES_PREMIUM_EXECUTIVE_V1/);

    const applicationsRuntime = readFileSync(join(root, 'functions/portal/main-ui/admin-applications-premium-v1.js'), 'utf8');
    const passportWrapper = readFileSync(join(root, 'functions/portal/main-ui/application-passport-runtime.js'), 'utf8');
    assert.match(applicationsRuntime, /#page-applications/);
    assert.doesNotMatch(applicationsRuntime, /#page-prices/);
    assert.doesNotMatch(applicationsRuntime, /#page-deals/);
    assert.doesNotMatch(applicationsRuntime, /fetch\(/);
    assert.match(applicationsRuntime.toLocaleLowerCase('ru-RU'), /отправить в сделки/);
    assert.match(passportWrapper, /application-passport-runtime-base\.js/);
    assert.match(passportWrapper, /admin-applications-premium-v1\.js/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Cloudflare materialization starts from the locked release worktree rather than branch snapshot', () => {
  const build = readFileSync('scripts/admin-payments-v7-cloudflare-build.mjs', 'utf8');
  assert.match(build, /FINAL_LIVE_ADMIN_SOURCE_COMMIT/);
  assert.match(build, /worktree', 'add', '--detach', worktree, LIVE_COMMIT/);
});