import fs from 'node:fs';
import assert from 'node:assert/strict';

const shell=fs.readFileSync('portal-src/current/admin.html','utf8');
const build=fs.readFileSync('scripts/build-pages-direct-canonical.mjs','utf8');
const route=fs.readFileSync('functions/portal/admin.js','utf8');

const requiredPages=['home','prices','applications','deals','payments','accounting','monitoring','messages','access','agent-settlements','claims','analytics','market-news'];
for(const id of requiredPages){assert(shell.includes(`data-page="${id}"`),`Admin nav missing ${id}`);assert(shell.includes(`id="page-${id}"`),`Admin page host missing ${id}`)}
for(const marker of ['adminLoginGate','rona-admin-auth-v3413','Временный автономный вход','canonical-transfer-v1_1/admin_externalized.html','RONA_Trade_Admin_Portal_v3_4_13']){assert(!shell.includes(marker),`Legacy marker in current shell: ${marker}`);assert(!route.includes(marker),`Legacy marker in current Admin route: ${marker}`)}
assert(shell.includes('rona-admin-shell" content="current-only-v2"'),'Admin shell v2 meta marker missing');
assert(shell.includes('rona-admin-runtime-build" content="20260826-1345-single-owner"'),'Admin single-owner runtime build marker missing');
assert(shell.includes('data-rona-admin-shell="current-only-v2"'),'Admin shell v2 runtime marker missing');
assert(shell.includes("window.__RONA_ADMIN_CURRENT_ROUTER__='current-only-router-v2'"),'Authoritative current router marker missing');
assert(shell.includes("document.documentElement.dataset.ronaAdminNavigationOwner='current-only-router-v2'"),'Navigation owner marker missing');
assert(shell.includes('grid-template-columns:272px minmax(0,1fr)'),'Canonical Home-scale sidebar must be source-level');
assert(shell.includes('min-height:48px')&&shell.includes('font-size:14.5px'),'Canonical Home-scale navigation sizing missing');
assert(shell.includes('data-action="create-access">Создать доступ</button>'),'Source-level primary access entry missing');
assert(shell.includes("sessionStorage.setItem('rona.admin.currentPage',page)"),'Selected Admin page must survive late runtime races');
assert(shell.includes('new MutationObserver(scheduleGuard)'),'Navigation drift guard missing');
assert(shell.includes("'rona:admin-pagechange'"),'Current router page-change event missing');
for(const forbidden of ['rona-admin-approved-shell-v455-loader','rona-admin-approved-claims-v455-loader','rona-admin-approved-analytics-v455-loader','20260827-approved-v455','rona-topbar-premium','rona-nav-attention'])assert(!shell.includes(forbidden),`Retired Admin overlay leaked into live shell: ${forbidden}`);
for(const required of ['rona-admin-fast-shell-runtime','rona-clients-agents-current-loader','rona-admin-approved-polish-loader','rona-admin-runtime-watchdog-loader'])assert(shell.includes(required),`Single-owner Admin runtime missing: ${required}`);
assert(route.includes("'x-rona-admin-shell','current-only-v2'"),'Admin route must identify current-only v2 shell');
assert(route.includes("'x-rona-admin-current-only','main-v2-shell-v2'"),'Admin route lifecycle marker missing');
assert(build.includes("path: 'portal-src/current/admin.html'"));
assert(build.includes('current-only-router-v2'),'Pages build must require authoritative current router');
assert(!build.includes("path: 'portal-src/canonical/RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html',\n    sha256"),'Legacy Admin must not be a build source');
assert(!build.includes("path: 'portal-src/canonical-transfer-v1_1/admin_externalized.html',\n    sha256"),'Legacy externalized Admin must not be a build source');
console.log('Admin current-only shell v2 contract: PASS');