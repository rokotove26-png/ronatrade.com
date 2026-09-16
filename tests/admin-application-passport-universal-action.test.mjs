import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import actionRuntime from '../functions/portal/main-ui/admin-applications-passport-action-v2.js';

assert.match(actionRuntime,/data-rona-app-passport-open/,'universal action must bind to canonical passport delegated handler');
assert.match(actionRuntime,/textContent='Открыть'/,'visible Open label must be restored');
assert.match(actionRuntime,/\.rona-owner-table tbody tr/,'all rendered application rows must be covered');
assert.match(actionRuntime,/host\.prepend\(button\)/,'Open action must coexist with current business actions');
assert.match(actionRuntime,/MutationObserver/,'action must survive application table re-render');
assert.ok(!/RONA-C\d+|DEAL-2026-|PORTAL-EVT-[0-9a-f]{8}/i.test(actionRuntime),'runtime must not hardcode production records');
assert.ok(!/\bpost\s*\(|\/admin\/applications\//.test(actionRuntime),'passport action overlay must not mutate application business state');

const composer=await readFile('functions/portal/main-ui/application-passport-runtime.js','utf8');
assert.match(composer,/admin-applications-passport-action-v2\.js/,'passport action runtime must be mounted');
assert.match(composer,/applicationPassportRuntimeBase\s*\+\s*adminApplicationsPassportActionV2/,'delegated passport handler must load before the universal trigger overlay');

console.log('ADMIN_APPLICATION_PASSPORT_UNIVERSAL_ACTION=PASS');
