import fs from 'node:fs';
import assert from 'node:assert/strict';

const shell=fs.readFileSync('portal-src/current/admin.html','utf8');
const build=fs.readFileSync('scripts/build-pages-direct-canonical.mjs','utf8');
const route=fs.readFileSync('functions/portal/admin.js','utf8');

const requiredPages=['home','prices','applications','deals','payments','accounting','monitoring','messages','access','agent-settlements','claims','analytics','market-news'];
for(const id of requiredPages){
  assert(shell.includes(`data-page="${id}"`),`Admin nav missing ${id}`);
  assert(shell.includes(`id="page-${id}"`),`Admin page host missing ${id}`);
}
for(const marker of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','canonical-transfer-v1_1/admin_externalized.html','RONA_Trade_Admin_Portal_v3_4_13']){
  assert(!shell.includes(marker),`Legacy marker in current shell: ${marker}`);
  assert(!route.includes(marker),`Legacy marker in current Admin route: ${marker}`);
}
assert(shell.includes('rona-admin-shell" content="current-only-v2"'),'Admin shell v2 meta marker missing');
assert(shell.includes('data-rona-admin-shell="current-only-v2"'),'Admin shell v2 runtime marker missing');
assert(shell.includes("window.__RONA_ADMIN_CURRENT_ROUTER__='current-only-router-v2'"),'Authoritative current router marker missing');
assert(shell.includes("document.documentElement.dataset.ronaAdminNavigationOwner='current-only-router-v2'"),'Navigation owner marker missing');
assert(shell.includes('grid-template-columns:238px minmax(0,1fr)'),'Canonical-scale sidebar must be source-level, not a late module patch');
assert(shell.includes('data-action="create-access">Создать доступ</button>'),'Source-level primary access entry missing');
assert(shell.includes("sessionStorage.setItem('rona.admin.currentPage',page)"),'Selected Admin page must survive late runtime races');
assert(shell.includes('new MutationObserver(scheduleGuard)'),'Navigation drift guard missing');
assert(shell.includes("'rona:admin-pagechange'"),'Current router page-change event missing');
assert(shell.includes("data-page=\"agent-settlements\""),'Agent rewards route missing');
assert(shell.includes("data-page=\"claims\""),'Claims route missing');
assert(route.includes("'x-rona-admin-shell','current-only-v2'"),'Admin route must identify current-only v2 shell');
assert(route.includes("'x-rona-admin-current-only','main-v2-shell-v2'"),'Admin route current-only v2 lifecycle marker missing');
assert(build.includes("path: 'portal-src/current/admin.html'"));
assert(build.includes('current-only-router-v2'),'Pages build must require authoritative current router');
assert(!build.includes("path: 'portal-src/canonical/RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html',\n    sha256"),'Legacy Admin must not be a build source');
assert(!build.includes("path: 'portal-src/canonical-transfer-v1_1/admin_externalized.html',\n    sha256"),'Legacy externalized Admin must not be a build source');
console.log('Admin current-only shell v2 contract: PASS');