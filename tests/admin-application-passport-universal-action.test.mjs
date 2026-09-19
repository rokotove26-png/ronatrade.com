import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import actionRuntime from '../functions/portal/main-ui/admin-applications-passport-action-v2.js';

assert.match(actionRuntime,/data-rona-app-passport-open/,'universal action must bind to canonical passport delegated handler');
assert.match(actionRuntime,/textContent='Открыть'/,'visible Open label must be restored');
assert.match(actionRuntime,/\.rona-owner-table tbody tr/,'all rendered application rows must be covered');
assert.match(actionRuntime,/function actionsCell\(row\)/,'layout must resolve the full actions cell, not only the nested button host');
assert.match(actionRuntime,/cell\?\.querySelectorAll\?\.\('select'\)/,'currency selector must be resolved across the complete actions cell');
assert.match(actionRuntime,/rona-app-currency-open-inline/,'currency and Open must be grouped into one nowrap inline unit');
assert.match(actionRuntime,/group\.append\(anchor,button\)/,'Open must be immediately to the right of the currency control');
assert.match(actionRuntime,/flex-wrap:nowrap!important/,'currency/Open pair must not split across visual lines');
assert.match(actionRuntime,/MutationObserver/,'action must survive application table re-render');
assert.ok(!/RONA-C\d+|DEAL-2026-|PORTAL-EVT-[0-9a-f]{8}/i.test(actionRuntime),'runtime must not hardcode production records');
assert.ok(!/\bpost\s*\(|\/admin\/applications\//.test(actionRuntime),'passport action overlay must not mutate application business state');

const composer=await readFile('functions/portal/main-ui/application-passport-runtime.js','utf8');
assert.match(composer,/admin-applications-passport-action-v2\.js/,'passport action runtime must be mounted');
const baseAt=composer.indexOf('applicationPassportRuntimeBase');
const terminalAt=composer.lastIndexOf('adminApplicationsTerminalBucketV1');
const actionAt=composer.lastIndexOf('adminApplicationsPassportActionV2');
assert.ok(baseAt>=0&&terminalAt>baseAt&&actionAt>terminalAt,'delegated passport handler must load before lifecycle guard and universal trigger overlay');

console.log('ADMIN_APPLICATION_PASSPORT_UNIVERSAL_ACTION=PASS terminal_bucket_guard=compatible');
