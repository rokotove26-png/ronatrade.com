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

assert.match(runtime, /function applicationPrice\(a\)/, 'application price resolver missing');
assert.match(runtime, /const explicit=explicitConfirmedPrice\(a\);if\(explicit\)return explicit/, 'authoritative price precedence missing');
assert.match(runtime, /response==='ACCEPTED'&&finite\(a\?\.counter_price\)/, 'accepted counter price fallback missing');
assert.match(runtime, /if\(finite\(a\?\.proposed_price\)\)/, 'submitted application price fallback missing');
assert.match(runtime, /for\(const pk of \['application_price','unit_price','price'\]\)/, 'generic application price fallback missing');
assert.doesNotMatch(runtime, /\['ACCEPTED','DEAL'\]\.includes\(owner\)&&finite\(a\?\.proposed_price\)/, 'submitted price is still incorrectly gated by owner status');
assert.doesNotMatch(runtime, /status==='DEAL_REGISTERED'\|\|deal/, 'submitted price is still incorrectly gated by deal state');

assert.match(runtime, /card\('Тоннаж общий'/, 'tonnage KPI missing');
assert.match(runtime, /card\('Сумма общая'/, 'amount KPI missing');
assert.match(runtime, /grid\.prepend\(amt\);grid\.prepend\(ton\)/, 'totals are not reinserted into KPI grid');
assert.match(runtime, /x-rona-applications-total-kpi':'lifecycle-v4'/, 'response version header missing');

assert.match(owner, /window\.__RONA_OWNER_ADMIN_SNAPSHOT__=adminData;renderAdmin\(\)/, 'owner refresh lifecycle changed; re-audit required');

console.log('ADMIN_APPLICATIONS_KPI_REFRESH_V4_QA_PASS');
