import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const FINAL_PAYMENTS_ROUTE_OWNER = 'admin-payments-v7-native';
export const FINAL_LIVE_ADMIN_SOURCE_COMMIT = '7bdf2bae0e0bb54a66d5e4df4d01993b70f79159';
export const FINAL_LIVE_OWNER_API = 'functions/portal/owner-api.js';

function currentReleasePortalFiles() {
  return execFileSync('git', [
    'ls-tree', '-r', '--name-only', FINAL_LIVE_ADMIN_SOURCE_COMMIT,
    'functions/portal',
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.endsWith('.js'));
}

function materializeCurrentReleaseFile(root, path) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, execFileSync('git', ['show', `${FINAL_LIVE_ADMIN_SOURCE_COMMIT}:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }));
}

// CURRENT_STATE_FIRST: the approved release already owns the Owner-accepted
// Payments V7 renderer and proxy. Finance-driven automation does not modify the
// Admin frontend. Materialize only the exact current-release Admin portal closure;
// do not depend on any historical Stage 5C source commit or presentation patch.
export function recoverLiveAdminWorkspace(root) {
  const releaseFiles = [
    'assets/portal-admin-shell-fast-v1.js',
    'assets/portal-market-news-no-gray-bands-v1.css',
    'portal-src/current/admin.html',
    ...currentReleasePortalFiles(),
  ];
  const files = [...new Set(releaseFiles)];
  for (const path of files) materializeCurrentReleaseFile(root, path);
  return {
    root,
    files,
    liveCommit: FINAL_LIVE_ADMIN_SOURCE_COMMIT,
    presentation: 'ADMIN_PAYMENTS_V7_RELEASE_NATIVE_PARITY',
  };
}