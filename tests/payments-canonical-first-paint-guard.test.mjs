import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guard = readFileSync('functions/portal/owner-ui-chunks/chunk15.js', 'utf8');
const runtime = readFileSync('scripts/admin-payments-v7-live-runtime-current.mjs', 'utf8');

assert.match(guard, /data-rona-payments-canonical-ready/, 'Canonical ready gate missing');
assert.match(guard, /\.rona-payments-v7\[data-rona-payments-owner=\\?"admin-payments-v7-native-v2\\?"\]/, 'Guard must target the actual canonical Payments owner');
assert.match(guard, /MutationObserver/, 'Guard must fail closed across DOM replacements');
assert.match(guard, /#page-payments:not\(\['\+READY_ATTR\+'="1"\]\)>\*\{display:none!important\}/, 'Non-canonical Payments children must stay hidden');
assert.doesNotMatch(guard, /:has\(> #ronaPaymentsV8Root\)/, 'Stale V8 root readiness contract must not return');
assert.match(runtime, /class:'rona-payments-v7','data-rona-payments-owner':'\$\{CURRENT_PAYMENTS_ROUTE_OWNER\}'/, 'Canonical runtime owner marker missing');
assert.match(runtime, /CURRENT_PAYMENTS_ROUTE_OWNER = 'admin-payments-v7-native-v2'/, 'Canonical Payments route owner changed');

console.log('Payments canonical first-paint guard: PASS');
