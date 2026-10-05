import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const shell=readFileSync('assets/portal-admin-shell-fast-v1.js','utf8');
const html=readFileSync('portal-src/current/admin.html','utf8');

test('Admin shell keeps Access warm but does not preload heavy Deals/Rail/Analytics workloads',()=>{
  assert.match(shell,/LAZY_SELECTED_PAGE_V1/);
  assert.match(shell,/async function loadPageModule\(page\)/);
  const boot=shell.slice(shell.indexOf('async function bootUi()'),shell.indexOf("window.addEventListener('rona:admin-pagechange'"));
  assert.match(boot,/const accessWarm=loadAccess\(\);/);
  assert.match(boot,/Promise\.allSettled\(\[accessWarm,loadPageModule\(selectedPage\(\)\)\]\)/);
  assert.doesNotMatch(boot,/loadRail\(\)/);
  assert.doesNotMatch(boot,/loadAnalytics\(\)/);
  assert.doesNotMatch(boot,/loadModule\('deals'/);
  assert.doesNotMatch(boot,/loadModule\('applications'/);
  assert.doesNotMatch(boot,/loadModule\('cash'/);
});

test('Heavy modules load only when their page is selected',()=>{
  const loader=shell.slice(shell.indexOf('async function loadPageModule(page)'),shell.indexOf('async function bootUi()'));
  assert.match(loader,/p==='deals'/);
  assert.match(loader,/loadModule\('deals',MODULES\.deals\.src\)/);
  assert.match(loader,/loadModule\('deals-r11',MODULES\.dealsR11\.src\)/);
  assert.match(loader,/p==='monitoring'\)return loadRail\(\)/);
  assert.match(loader,/p==='analytics'\)return loadAnalytics\(\)/);
  assert.match(loader,/p==='applications'\)return loadModule\('applications'/);
  assert.match(loader,/p==='accounting'\)return loadModule\('cash'/);
  assert.match(shell,/if\(p==='analytics'\)loadAnalytics\(\)/);
  assert.match(shell,/if\(p==='monitoring'\)loadRail\(\)/);
  assert.match(shell,/if\(p==='access'\)loadAccess\(\)/);
  assert.match(html,/portal-admin-shell-fast-v1\.js\?v=20261003-remove-claims-v1&boot=20261005-lazy-selected-page-v1/);
});
