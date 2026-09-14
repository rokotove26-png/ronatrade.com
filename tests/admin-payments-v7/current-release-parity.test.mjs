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

const CURRENT_RELEASE_HEAD = '736a535fe245decdf79de06d32940c2cb17370aa';
const show = (path) => execFileSync('git', ['show', `${FINAL_LIVE_ADMIN_SOURCE_COMMIT}:${path}`], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

test('Payments V7 materializes from the exact current release head', () => {
  assert.equal(FINAL_LIVE_ADMIN_SOURCE_COMMIT, CURRENT_RELEASE_HEAD);
});

test('current Prices and Applications release layers remain byte-identical through Payments V7 recovery', () => {
  const root = mkdtempSync(join(tmpdir(), 'rona-payments-release-parity-'));
  try {
    recoverLiveAdminWorkspace(root);
    for (const path of [
      'functions/portal/main-ui/index.js',
      'functions/portal/main-ui/application-passport-runtime.js',
      'assets/portal-admin-shell-fast-v1.js',
      'portal-src/current/admin.html',
    ]) {
      assert.equal(readFileSync(join(root, path), 'utf8'), show(path), path);
    }

    const currentMainUi = readFileSync(join(root, 'functions/portal/main-ui/index.js'), 'utf8');
    assert.match(currentMainUi, /patchPaymentsV7Runtime/);
    assert.match(currentMainUi, /PRICES|Prices|prices/);
    assert.match(currentMainUi, /application|APPLICATION/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Cloudflare materialization starts from the locked release worktree rather than branch snapshot', () => {
  const build = readFileSync('scripts/admin-payments-v7-cloudflare-build.mjs', 'utf8');
  assert.match(build, /FINAL_LIVE_ADMIN_SOURCE_COMMIT/);
  assert.match(build, /worktree', 'add', '--detach', worktree, LIVE_COMMIT/);
});
