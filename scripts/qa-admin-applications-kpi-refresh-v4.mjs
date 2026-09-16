import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime = fs.readFileSync('functions/portal/applications-total-kpi-ui.js', 'utf8');
const owner = fs.readFileSync('functions/portal/owner-ui-chunks/chunk1.js', 'utf8');

assert.match(runtime, /20260914-admin-app-kpi-refresh-v4/, 'v4 runtime marker missing');
assert.match(runtime, /function hookSnapshotLifecycle\(\)/, 'snapshot lifecycle hook missing');
assert.match(runtime, /Object\.defineProperty\(window,key/, 'snapshot assignment is not intercepted');
assert.match(runtime, /set\(value\)\{current=value;schedule\(\)\}/, 'snapshot setter does not schedule KPI restoration');
assert.match(runtime, /queueMicrotask\(/, 'post-render microtask scheduling missing');
assert.match(runtime, /requestAnimationFrame/, 'post-render frame scheduling missing');
assert.match(runtime, /setTimeout\(apply,180\)/, 'short fallback missing');
assert.match(runtime, /setTimeout\(apply,900\)/, 'medium fallback missing');
assert.match(runtime, /setTimeout\(apply,3000\)/, 'long fallback missing');

assert.match(runtime, /application_business_contract==='RONA_APPLICATION_BUSINESS_V2'/, 'canonical business contract gate missing');
assert.match(runtime, /kpi\?\.source==='RONA_APPLICATION_BUSINESS_V2'/, 'server KPI source gate missing');
assert.match(runtime, /fmt\(kpi\.tonnage,3\)/, 'server tonnage KPI missing');
assert.match(runtime, /Array\.isArray\(kpi\.amounts\)/, 'server authoritative amount collection missing');
assert.match(runtime, /fmt\(item\.amount,2\)\+' '\+item\.currency/, 'server amount/currency rendering missing');
assert.doesNotMatch(runtime, /function applicationPrice\(a\)/, 'legacy browser price resolver must not return');
assert.doesNotMatch(runtime, /applications\.(?:reduce|map).*price/s, 'browser financial aggregation over application prices is forbidden');

assert.match(runtime, /rona-app-total-kpi--tonnage/, 'tonnage KPI missing');
assert.match(runtime, /rona-app-total-kpi--amount-(?:ok|warn)/, 'amount KPI missing');
assert.match(runtime, /grid\.prepend\(amt\);grid\.prepend\(ton\)/, 'totals are not reinserted into KPI grid');
assert.match(runtime, /x-rona-applications-total-kpi':'lifecycle-v4'/, 'response version header missing');

assert.match(owner, /window\.__RONA_OWNER_ADMIN_SNAPSHOT__=adminData;renderAdmin\(\)/, 'owner refresh lifecycle changed; re-audit required');

console.log('ADMIN_APPLICATIONS_KPI_REFRESH_V4_QA_PASS');
