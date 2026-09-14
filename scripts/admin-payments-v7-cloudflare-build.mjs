import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FINAL_LIVE_ADMIN_SOURCE_COMMIT,
  recoverLiveAdminWorkspace,
} from './admin-payments-v7-final-live-source.mjs';

const ROOT = process.cwd();
const LIVE_COMMIT = FINAL_LIVE_ADMIN_SOURCE_COMMIT;
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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
