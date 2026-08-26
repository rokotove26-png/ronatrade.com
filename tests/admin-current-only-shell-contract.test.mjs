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
assert(build.includes("path: 'portal-src/current/admin.html'"));
assert(!build.includes("path: 'portal-src/canonical/RONA_Trade_Admin_Portal_v3_4_13_BOOT_ERROR_LATCH_FINAL_CANDIDATE_20260812.html',\n    sha256"),'Legacy Admin must not be a build source');
assert(!build.includes("path: 'portal-src/canonical-transfer-v1_1/admin_externalized.html',\n    sha256"),'Legacy externalized Admin must not be a build source');
console.log('Admin current-only shell contract: PASS');
