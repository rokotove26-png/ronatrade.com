import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const shell=readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
const html=readFileSync('portal-src/current/admin.html','utf8');

test('Admin shell does not preload heavy page modules or Access on boot',()=>{
  assert.match(shell,/LAZY_SELECTED_PAGE_V2/);
  assert.match(shell,/async function loadPageModule\(page\)/);
  const boot=shell.slice(shell.indexOf('async function bootUi()'),shell.indexOf("window.addEventListener('rona:admin-pagechange'"));
  assert.doesNotMatch(boot,/accessWarm/);
  assert.doesNotMatch(boot,/loadAccess\(\)/);
  assert.doesNotMatch(boot,/loadRail\(\)/);
  assert.doesNotMatch(boot,/loadAnalytics\(\)/);
  assert.doesNotMatch(boot,/loadModule\('deals'/);
  assert.doesNotMatch(boot,/loadModule\('applications'/);
  assert.doesNotMatch(boot,/loadModule\('cash'/);
  assert.match(boot,/await loadPageModule\(selectedPage\(\)\)/);
  assert.doesNotMatch(html,/id="rona-clients-agents-current-loader"/);
});

test('Page modules load only for the selected Admin section',()=>{
  const loader=shell.slice(shell.indexOf('async function loadPageModule(page)'),shell.indexOf('async function bootUi()'));
  assert.match(loader,/p==='deals'/);
  assert.match(loader,/loadModule\('deals',MODULES\.deals\.src\)/);
  assert.match(loader,/loadModule\('deals-r11',MODULES\.dealsR11\.src\)/);
  assert.match(loader,/p==='monitoring'\)return loadRail\(\)/);
  assert.match(loader,/p==='analytics'\)return loadAnalytics\(\)/);
  assert.match(loader,/p==='applications'\)return loadModule\('applications'/);
  assert.match(loader,/p==='accounting'\)return loadModule\('cash'/);
  assert.match(loader,/p==='access'\)return loadAccess\(\)/);
  assert.match(shell,/if\(p==='analytics'\)loadAnalytics\(\)/);
  assert.match(shell,/if\(p==='monitoring'\)loadRail\(\)/);
  assert.match(shell,/if\(p==='access'\)loadAccess\(\)/);
  assert.match(html,/portal-admin-shell-fast-v1\.js\?v=20261006-agent-rewards-finance-v4/);
});
