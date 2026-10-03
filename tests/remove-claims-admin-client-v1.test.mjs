import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read=(p)=>readFileSync(p,'utf8');

test('Admin portal no longer exposes or loads Claims',()=>{
  const html=read('portal-src/current/admin.html');
  const fast=read('assets/portal-admin-shell-fast-v1.js');
  const shell=read('functions/portal/admin-approved-shell-v455-ui.js');

  assert.doesNotMatch(html,/data-page=["']claims["']/);
  assert.doesNotMatch(html,/id=["']page-claims["']/);
  assert.doesNotMatch(html,/rona-admin-approved-claims-v455-loader/);
  assert.doesNotMatch(html,/ИД претензии/);

  assert.doesNotMatch(fast,/claims:\{src:/);
  assert.doesNotMatch(fast,/loadModule\(['"]claims['"]/);
  assert.doesNotMatch(fast,/MODULES\.claims/);

  const build=read('scripts/build-pages-direct-canonical.mjs');
  const materialize=read('scripts/materialize-admin-current-modules.mjs');
  const watchdog=read('assets/portal-admin-runtime-watchdog-v1.js');
  assert.match(build,/CURRENT_ADMIN_RETIRED_CLAIMS_MARKER_PRESENT/);
  assert.doesNotMatch(materialize,/writeFile\(join\(OUT,'claims-r2-ui'\)/);
  assert.doesNotMatch(watchdog,/if\(p==='claims'\)/);

  assert.doesNotMatch(shell,/claims:'Претензии'/);
  assert.doesNotMatch(shell,/data-page=\\?"claims\\?"/);
  assert.doesNotMatch(shell,/['"]claims['"]\]\.forEach\(a\)/);
});

test('Client portal strips Claims before render and keeps a runtime guard',()=>{
  const router=read('functions/portal/[[path]].js');
  const guard=read('assets/portal-runtime/retire-claims-section-v1.js');

  assert.match(router,/CLAIMS_SECTION_RETIRE_RUNTIME/);
  assert.match(router,/retire-claims-section-v1\.js/);
  assert.match(router,/script\[src\*="claims"\]/);
  assert.match(router,/script\[id\*="claims"\]/);
  assert.match(router,/link\[href\*="claims"\]/);
  assert.match(router,/\[data-page="claims"\]/);
  assert.match(router,/#page-claims/);

  assert.match(guard,/__RONA_CLAIMS_SECTION_RETIRED_V1__/);
  assert.match(guard,/\[data-page="claims"\]/);
  assert.match(guard,/претензии/);
  assert.match(guard,/MutationObserver/);
  assert.match(guard,/sessionStorage/);
});

test('Claims historical backend/data layer is retained; no destructive data migration is part of this delta',()=>{
  assert.equal(existsSync('functions/portal/client-claims-api.js'),true);
  assert.equal(existsSync('supabase/migrations/20260824235500_owner_claims_legal_workflow.sql'),true);
  assert.equal(existsSync('supabase/migrations/20260825004500_owner_claims_bidirectional.sql'),true);

  const changed=[
    read('portal-src/current/admin.html'),
    read('assets/portal-admin-shell-fast-v1.js'),
    read('functions/portal/admin-approved-shell-v455-ui.js'),
    read('functions/portal/[[path]].js'),
    read('assets/portal-runtime/retire-claims-section-v1.js')
  ].join('\n');
  assert.doesNotMatch(changed,/\b(drop\s+table|truncate\s+table|delete\s+from)\b/i);
});
