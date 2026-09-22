import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  FINAL_LIVE_ADMIN_SOURCE_COMMIT,
  recoverLiveAdminWorkspace,
} from './admin-payments-v7-final-live-source.mjs';
import { stripOwnerBuildIndicator } from './admin-owner-production-diagnostics-policy.mjs';

const ROOT = process.cwd();
const LIVE_COMMIT = FINAL_LIVE_ADMIN_SOURCE_COMMIT;
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const OPERATIONS_CENTER_OVERRIDES = [
  'functions/portal/admin-approved-shell-v455-ui.js',
  'functions/portal/deals-current-state-ui.js',
  'portal-src/current/admin.html',
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function hasCommit(commit) {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}^{commit}`], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

if (!hasCommit(LIVE_COMMIT)) {
  run('git', ['fetch', '--no-tags', '--depth=1', 'origin', LIVE_COMMIT]);
}
if (!hasCommit(LIVE_COMMIT)) {
  throw new Error(`PAYMENTS_V7_LIVE_SOURCE_COMMIT_UNAVAILABLE:${LIVE_COMMIT}`);
}

const tempParent = mkdtempSync(join(tmpdir(), 'rona-payments-v7-cloudflare-'));
const worktree = join(tempParent, 'live');
let worktreeAdded = false;

try {
  run('git', ['worktree', 'add', '--detach', worktree, LIVE_COMMIT]);
  worktreeAdded = true;

  const recovered = recoverLiveAdminWorkspace(worktree);
  console.log(`PAYMENTS_V7_CLOUDFLARE_BASE=${LIVE_COMMIT}`);
  console.log(`PAYMENTS_V7_CLOUDFLARE_PRESENTATION=${recovered.presentation}`);

  for (const path of OPERATIONS_CENTER_OVERRIDES) {
    const source = join(ROOT, path);
    const destination = join(worktree, path);
    if (!existsSync(source)) throw new Error(`OPERATIONS_CENTER_OVERRIDE_MISSING:${path}`);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { force: true });
  }
  console.log('OPERATIONS_CENTER_V5_OVERRIDES=READY admin-main-ui-current=RELEASE_CURRENT operations-v5=RELEASE_CURRENT');

  // Production owner portals must never expose the internal build/data badge.
  // Enforce this against the pinned prepaint runtime before bundling. If the
  // upstream runtime changes shape, fail the build instead of shipping a new
  // diagnostic badge by accident.
  const ownerPrepaintPath = join(worktree, 'functions/portal/owner-ui-chunks/chunk15-base.js');
  if (!existsSync(ownerPrepaintPath)) {
    throw new Error('OWNER_BUILD_INDICATOR_POLICY_RUNTIME_MISSING');
  }
  const ownerPrepaintSource = readFileSync(ownerPrepaintPath, 'utf8');
  writeFileSync(ownerPrepaintPath, stripOwnerBuildIndicator(ownerPrepaintSource));
  console.log('OWNER_PRODUCTION_BUILD_INDICATOR=DISABLED');

  // The current release owns the canonical Payments V8 patching and money-display
  // contract. Do not overlay older main-branch runtime helpers over that release:
  // doing so breaks the release middleware's canonical formatter gate.
  console.log('PAYMENTS_V7_RUNTIME_SOURCE=RELEASE_CURRENT');
  console.log('PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_SOURCE=RELEASE_CURRENT');

  run(npmBin, ['run', 'build'], { cwd: worktree });

  const builtDist = join(worktree, 'dist');
  const builtFunctions = join(worktree, 'functions');
  if (!existsSync(builtDist)) throw new Error('PAYMENTS_V7_CLOUDFLARE_DIST_MISSING');
  if (!existsSync(builtFunctions)) throw new Error('PAYMENTS_V7_CLOUDFLARE_FUNCTIONS_MISSING');

  rmSync(join(ROOT, 'dist'), { recursive: true, force: true });
  cpSync(builtDist, join(ROOT, 'dist'), { recursive: true });

  rmSync(join(ROOT, 'functions'), { recursive: true, force: true });
  cpSync(builtFunctions, join(ROOT, 'functions'), { recursive: true });

  console.log('PAYMENTS_V7_CLOUDFLARE_BUILD=READY');
} finally {
  if (worktreeAdded) {
    try {
      run('git', ['worktree', 'remove', '--force', worktree]);
    } catch {
      // The Cloudflare build result has already been materialized in ROOT.
    }
  }
  rmSync(tempParent, { recursive: true, force: true });
}
