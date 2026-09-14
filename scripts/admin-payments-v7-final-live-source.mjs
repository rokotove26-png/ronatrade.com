import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  LIVE_ADMIN_SOURCE_COMMIT,
  LIVE_OWNER_API,
  STAGE5C_ROUTE_OWNER,
  recoverLiveAdminWorkspace as recoverStage5CLiveAdminWorkspace,
} from './admin-payments-v7-stage5c-live-source.mjs';

export const FINAL_PAYMENTS_ROUTE_OWNER = STAGE5C_ROUTE_OWNER;
export const FINAL_LIVE_ADMIN_SOURCE_COMMIT = LIVE_ADMIN_SOURCE_COMMIT;
export const FINAL_LIVE_OWNER_API = LIVE_OWNER_API;

const CURRENT_RELEASE_UI_DEPENDENCIES = Object.freeze([
  'functions/portal/main-ui/application-passport-runtime-base.js',
  'functions/portal/main-ui/admin-applications-premium-v1.js',
  'functions/portal/main-ui/admin-applications-readability-v5.js',
]);

function materializeCurrentReleaseFile(root, path) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, execFileSync('git', ['show', `${FINAL_LIVE_ADMIN_SOURCE_COMMIT}:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }));
}

// CURRENT_STATE_FIRST: the current release already owns the accepted Payments V7
// command-center presentation in functions/portal/main-ui/index.js. Do not replay
// an older presentation patch over it. Stage 5C only rematerializes the V7 route
// and owner-action proxy on top of the exact current release source.
export function recoverLiveAdminWorkspace(root) {
  const recovered = recoverStage5CLiveAdminWorkspace(root);
  for (const path of CURRENT_RELEASE_UI_DEPENDENCIES) materializeCurrentReleaseFile(root, path);
  return {
    ...recovered,
    files: [...new Set([...(recovered.files || []), ...CURRENT_RELEASE_UI_DEPENDENCIES])],
    presentation: 'ADMIN_PAYMENTS_V7_RELEASE_NATIVE_PARITY',
  };
}
