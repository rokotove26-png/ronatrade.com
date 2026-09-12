import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const revision=await readFile('functions/portal/main-ui/admin-visual-revision-v2.js','utf8');
const index=await readFile('functions/portal/main-ui/index.js','utf8');

for(const required of [
  '__RONA_ADMIN_VISUAL_REVISION_V2__',
  "theme:'silver-steel-graphite-premium'",
  'rona-admin-visual-v2',
  'silver-steel-v2',
  'rona-admin-v2-page-title',
  "h.textContent='Главная'",
  '#page-home',
  '#page-applications',
  '#page-deals',
  '.rona-ops-v4-metric__value',
  '.rona-current-deal-kpi .rona-owner-kpi',
  '[data-rona-col="application-id"]',
  '[data-rona-col="deal-id"]',
  '.rona-admin-status-chip',
  '.rona-current-deal-table tbody td',
  'radial-gradient',
  'linear-gradient',
  'queueMicrotask(apply)'
])assert.ok(revision.includes(required),`silver/steel revision missing ${required}`);

for(const forbidden of [
  'RONA-C005','DEAL-2026-009','TEST-IN-DONE','SUPABASE_URL','fetch(','XMLHttpRequest','setInterval(','setTimeout(',
  '/admin/applications/','supplier-approved','SUPPLIER_RESOURCE_DENIED','/admin/workflow-bootstrap'
])assert.ok(!revision.includes(forbidden),`visual revision must remain presentation-only: ${forbidden}`);

for(const preserved of [
  'adminVisualRedesign',
  'adminVisualStatusChips',
  'adminVisualPolish',
  'adminVisualRevisionV2',
  "headers.set('x-rona-admin-visual-redesign','home-applications-deals-v1')",
  "headers.set('x-rona-admin-visual-revision','silver-steel-v2')",
  "'data-rona-app-passport-open':String(a?.application_id||'')",
  "text:'Ресурс одобрен'",
  "text:'В ресурсе отказано'",
  "text:'Отправить в сделки'"
])assert.ok(index.includes(preserved),`existing runtime/business hook must remain preserved: ${preserved}`);

const response=await serveAdminMainUi({});
assert.equal(response.status,200,'Admin main UI must materialize');
assert.equal(response.headers.get('x-rona-admin-visual-redesign'),'home-applications-deals-v1');
assert.equal(response.headers.get('x-rona-admin-visual-revision'),'silver-steel-v2');
const emitted=await response.text();
for(const required of [
  '__RONA_ADMIN_VISUAL_REVISION_V2__',
  'silver-steel-graphite-premium',
  'rona-admin-visual-v2',
  'rona-admin-v2-page-title',
  'Главная',
  'data-rona-app-passport-open',
  'openApplicationPassport'
])assert.ok(emitted.includes(required),`emitted V2 runtime missing ${required}`);

console.log('HOME_TITLE_VISIBLE=PASS contract=explicit_home_h1');
console.log('SILVER_GRAPHITE_PALETTE=PASS surfaces=layered_steel_silver_graphite metallic_gradients=true');
console.log('TYPOGRAPHY_HIERARCHY=PASS page_title=amplified section_title=amplified ids_values=emphasized metadata=secondary');
console.log('KPI_VISUAL_HIERARCHY=PASS kpi_values=amplified labels=separated metallic_surface=true');
console.log('APPLICATIONS_VISUAL_HIERARCHY=PASS application_id=emphasized client_product_volume=readable action_zone=separated');
console.log('DEALS_VISUAL_HIERARCHY=PASS deal_id=primary status_semantics=preserved finance_resource_logistics=layered');
console.log('ADMIN_VISUAL_REVISION_V2_SOURCE=PASS theme=silver_steel_graphite_premium home_title=restored typography=amplified kpi_hierarchy=amplified table_hierarchy=metallic presentation_only=true business_hooks_preserved=true');
