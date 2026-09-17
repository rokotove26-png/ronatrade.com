import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guard = readFileSync('functions/portal/owner-ui-chunks/chunk15.js', 'utf8');
const runtime = readFileSync('scripts/admin-payments-v7-live-runtime-current.mjs', 'utf8');

assert.match(guard, /data-rona-payments-canonical-ready/, 'Canonical ready gate missing');
assert.match(guard, /\.rona-payments-v7\[data-rona-payments-owner=\\?"admin-payments-v7-native-v2\\?"\]/, 'Guard must target the actual canonical Payments owner');
assert.match(guard, /__RONA_PAYMENTS_CANONICAL_FIRST_PAINT_GUARD_V3__/, 'Dynamic-page guard version missing');
assert.match(guard, /const rootObserver=new MutationObserver\(scheduleSync\)/, 'Guard must observe the document for late Payments page mounts');
assert.match(guard, /rootObserver\.observe\(root,\{childList:true,subtree:true\}\)/, 'Root observer must cover SPA page insertion and replacement');
assert.match(guard, /if\(page!==observedPage\)/, 'Guard must rebind when #page-payments is created or replaced');
assert.match(guard, /pageObserver\?\.disconnect\(\)/, 'Old Payments page observer must be disconnected on replacement');
assert.match(guard, /pageObserver\.observe\(observedPage,\{childList:true,subtree:true,attributes:true,attributeFilter:\['class','data-rona-payments-owner'\]\}\)/, 'Canonical owner insertion/mutation must resync readiness');
assert.match(guard, /#page-payments:not\(\['\+READY_ATTR\+'="1"\]\)>\*\{display:none!important\}/, 'Non-canonical Payments children must stay hidden');
assert.doesNotMatch(guard, /:has\(> #ronaPaymentsV8Root\)/, 'Stale V8 root readiness contract must not return');
assert.match(runtime, /class:'rona-payments-v7','data-rona-payments-owner':'\$\{CURRENT_PAYMENTS_ROUTE_OWNER\}'/, 'Canonical runtime owner marker missing');
assert.match(runtime, /CURRENT_PAYMENTS_ROUTE_OWNER = 'admin-payments-v7-native-v2'/, 'Canonical Payments route owner changed');

console.log('Payments canonical first-paint guard: PASS');
