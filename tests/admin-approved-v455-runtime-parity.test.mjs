import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const html = read('portal-src/current/admin.html');
const shell = read('functions/portal/admin-approved-shell-v455-ui.js');
const claims = read('functions/portal/admin-approved-claims-v455-ui.js');
const analytics = read('functions/portal/admin-approved-analytics-v455-ui.js');

assert.match(html, /admin-approved-shell-v455-ui/);
assert.match(html, /admin-approved-claims-v455-ui/);
assert.match(html, /admin-approved-analytics-v455-ui/);

assert.match(shell, /__RONA_ADMIN_SHELL_V455__='20260827'/);
assert.match(shell, /x-rona-admin-shell-visual':'approved-v4\.5\.5/);
assert.match(claims, /__RONA_CLAIMS_VISUAL_V455__='20260827'/);
assert.match(claims, /x-rona-claims-visual':'approved-v4\.5\.5/);

assert.match(analytics, /__RONA_ANALYTICS_APPROVED_V455__='20260827-v455'/);
assert.doesNotMatch(analytics, /retired-single-owner-v1/);
assert.match(analytics, /rona-visual-kicker/);
assert.match(analytics, /data-rona-approved-data/);
assert.match(analytics, /normalizeAnalytics/);
assert.match(analytics, /createElementNS/);
assert.match(analytics, /x-rona-analytics-visual':'approved-v4\.5\.5/);

console.log('ADMIN_APPROVED_V455_RUNTIME_PARITY=PASS');
