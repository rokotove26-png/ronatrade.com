import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const visual=await readFile('functions/portal/main-ui/admin-visual-redesign-v1.js','utf8');
const statusChips=await readFile('functions/portal/main-ui/admin-visual-status-chips-v1.js','utf8');
const index=await readFile('functions/portal/main-ui/index.js','utf8');

for(const required of [
  "if(location.pathname!=='/portal/admin')return",
  'rona-admin-redesign-v1',
  '#page-home',
  '#page-applications',
  '#page-deals',
  '.rona-app-filter',
  'data-rona-app-passport-open',
  'data-rona-col',
  'rona-admin-status-chip',
  'rona-admin-action--primary',
  'rona-admin-action--success',
  'rona-admin-action--danger',
  '1440px',
  '1180px',
  '900px',
  'queueMicrotask(applyAll)'
])assert.ok(visual.includes(required),`visual redesign missing ${required}`);

for(const required of [
  '__RONA_ADMIN_VISUAL_STATUS_CHIPS_V1__',
  'statusHeader',
  'statusValue',
  'rona-admin-status-chip',
  "['applications','deals']",
  'queueMicrotask(apply)'
])assert.ok(statusChips.includes(required),`status presentation fallback missing ${required}`);

for(const [name,source] of [['visual',visual],['statusChips',statusChips]])for(const forbidden of [
  'RONA-C005','DEAL-2026-009','TEST-IN-DONE','SUPABASE_URL','fetch(','XMLHttpRequest','setInterval(','setTimeout('
])assert.ok(!source.includes(forbidden),`${name} runtime must remain presentation-only: ${forbidden}`);

for(const preserved of [
  "'data-rona-app-passport-open':String(a?.application_id||'')",
  "text:'Ресурс одобрен'",
  "text:'В ресурсе отказано'",
  "text:'Отправить в сделки'",
  "'/portal/admin-completed-bootstrap'",
  'applicationPassportRuntime',
  'adminVisualRedesign',
  'adminVisualStatusChips'
])assert.ok(index.includes(preserved),`functional hook/action must remain preserved: ${preserved}`);

const response=await serveAdminMainUi({});
assert.equal(response.status,200,'current Admin main UI must materialize');
assert.equal(response.headers.get('x-rona-admin-visual-redesign'),'home-applications-deals-v1');
assert.equal(response.headers.get('x-rona-application-passport'),'first-render-v2');
const emitted=await response.text();
for(const required of [
  '__RONA_ADMIN_VISUAL_REDESIGN_V1__',
  '__RONA_ADMIN_VISUAL_STATUS_CHIPS_V1__',
  'rona-admin-redesign-v1',
  'rona:admin-visual-redesign-ready',
  'data-rona-app-passport-open',
  'openApplicationPassport'
])assert.ok(emitted.includes(required),`emitted runtime missing ${required}`);

console.log('ADMIN_VISUAL_REDESIGN_SOURCE_V2=PASS scope=home_applications_deals client_design_tokens=reused presentation_only=true semantic_status_chips=true business_hooks_preserved=true passport_preserved=true');
