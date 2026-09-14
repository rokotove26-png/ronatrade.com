import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  LIVE_OWNER_API,
  STAGE5C_ROUTE_OWNER,
  recoverLiveAdminWorkspace as recoverStage5CLiveAdminWorkspace,
} from './admin-payments-v7-stage5c-live-source.mjs';

export const FINAL_PAYMENTS_ROUTE_OWNER = STAGE5C_ROUTE_OWNER;
export const FINAL_LIVE_ADMIN_SOURCE_COMMIT = '0c136582cbe825149257994465d784f28a24ab0c';
export const FINAL_LIVE_OWNER_API = LIVE_OWNER_API;

function currentReleaseUiClosure() {
  return execFileSync('git', [
    'ls-tree', '-r', '--name-only', FINAL_LIVE_ADMIN_SOURCE_COMMIT,
    'functions/portal/main-ui',
    'functions/portal/owner-ui-chunks',
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

// CURRENT_STATE_FIRST: the current release already contains the Owner-accepted
// Payments V7 renderer. The Finance automation stage must therefore preserve the
// complete current release Admin UI module closure byte-for-byte. Stage 5C is used
// only to recover the known shell file set; every release-owned UI module is then
// replaced with the exact current-release version so no stale presentation patch,
// missing auxiliary module, or unrelated UI rollback can enter this candidate.
export function recoverLiveAdminWorkspace(root) {
  const recovered = recoverStage5CLiveAdminWorkspace(root);
  const releaseFiles = [
    ...(recovered.files || []),
    ...currentReleaseUiClosure(),
  ];
  for (const path of [...new Set(releaseFiles)]) materializeCurrentReleaseFile(root, path);
  return {
    ...recovered,
    files: [...new Set(releaseFiles)],
    liveCommit: FINAL_LIVE_ADMIN_SOURCE_COMMIT,
    presentation: 'ADMIN_PAYMENTS_V7_RELEASE_NATIVE_PARITY',
  };
}
