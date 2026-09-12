import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeAdminCompletedApplications} from '../functions/portal/main-ui/admin-completed-applications.js';
import {onRequest as serveAdminMainUi} from '../functions/portal/main-ui/index.js';

const active={application_id:'TEST-IN-2026-001',owner_status:'SUPPLIER_APPROVED',status:'ACCEPTED_AWAITING_DEAL_REGISTRATION',product:'Товар'};
const alreadyCompleted={application_id:'TEST-IN-2026-002',owner_status:'DEAL',status:'DEAL_REGISTERED',deal_id:'DEAL-2026-002',product:'Товар 2'};
const base={applications:[active,alreadyCompleted],rail:[]};
const workflow={
  applications:[
    {application_id:'TEST-IN-2026-002',deal_id:'DEAL-2026-002',owner_status:'DEAL'},
    {application_id:'TEST-IN-2026-003',deal_id:'DEAL-2026-003',owner_status:'DEAL'},
    {application_id:'TEST-IN-2026-004',deal_id:'DEAL-2026-004',owner_status:'SUPPLIER_REVIEW'}
  ],
  deals:[
    {application_id:'TEST-IN-2026-002',deal_id:'DEAL-2026-002',business_status:'EXECUTING',client_id:'TEST-C002',legal_name:'Клиент 2',contract_id:'TEST-CTR-002',source_product:'Товар 2',source_quantity_tonnes:20},
    {application_id:'TEST-IN-2026-003',deal_id:'DEAL-2026-003',business_status:'EXECUTING',client_id:'TEST-C003',legal_name:'Клиент 3',contract_id:'TEST-CTR-003',source_product:'Товар 3',source_quantity_tonnes:30,delivery_basis:'CPT',destination:'Станция',source_proposed_price:740,source_proposed_currency:'USD'},
    {application_id:'TEST-IN-2026-004',deal_id:'DEAL-2026-004',business_status:'REGISTERED',client_id:'TEST-C004'}
  ]
};

const merged=mergeAdminCompletedApplications(base,workflow);
assert.equal(merged.applications.length,3,'exactly one missing completed application must be restored');
assert.equal(merged.applications.filter(x=>x.application_id==='TEST-IN-2026-002').length,1,'existing completed application must not duplicate');
assert.equal(merged.applications.filter(x=>x.application_id==='TEST-IN-2026-004').length,0,'non-terminal workflow application must not be synthesized');
assert.deepEqual(merged.applications[0],active,'active application must remain unchanged');
const restored=merged.applications.find(x=>x.application_id==='TEST-IN-2026-003');
assert.ok(restored,'archived deal application must be restored to Admin projection');
assert.equal(restored.status,'DEAL_REGISTERED');
assert.equal(restored.owner_status,'DEAL');
assert.equal(restored.lifecycle_state,'ARCHIVED');
assert.equal(restored.deal_id,'DEAL-2026-003');
assert.equal(restored.product,'Товар 3');
assert.equal(restored.quantity_tonnes,30);
assert.equal(restored.proposed_price,740);
assert.equal(restored.proposed_currency,'USD');

const index=await readFile('functions/portal/main-ui/index.js','utf8');
for(const required of [
  '/portal/admin-completed-bootstrap',
  'owner-r1-server-v2',
  "owner==='DEAL'",
  "app==='DEAL_REGISTERED'",
  "return'COMPLETED'",
  "if(bucket==='COMPLETED')return e('button'",
  "'data-rona-app-passport-open':String(a?.application_id||'')",
  "text:'Открыть'",
  'x-rona-admin-completed-applications'
])assert.ok(index.includes(required),`Admin main runtime missing ${required}`);
assert.ok(!index.includes("call('/admin/workflow-bootstrap')"),'browser runtime must not depend on a secondary workflow-bootstrap request');
assert.ok(!index.includes("if(bucket==='COMPLETED')return e('span',{class:'rona-owner-muted',text:'—'});return applicationActions(a)}\";\nconst ADMIN_BOOTSTRAP_FROM"),'patched completed action must not remain a muted dash');

const emittedResponse=await serveAdminMainUi({});
assert.equal(emittedResponse.status,200,'materialized Admin main runtime must patch successfully');
assert.equal(emittedResponse.headers.get('x-rona-admin-completed-applications'),'owner-r1-server-v2');
assert.equal(emittedResponse.headers.get('x-rona-application-passport'),'first-render-v2');
const emitted=await emittedResponse.text();
for(const required of [
  '/portal/admin-completed-bootstrap',
  "owner==='DEAL'",
  "app==='DEAL_REGISTERED'",
  "return'COMPLETED'",
  'data-rona-app-passport-open',
  'openApplicationPassport',
  'authoritativeOwnerApplication'
])assert.ok(emitted.includes(required),`materialized Admin runtime missing ${required}`);
assert.ok(!emitted.includes("call('/admin/workflow-bootstrap')"),'emitted runtime must consume already-materialized server snapshot');

const server=await readFile('functions/portal/admin-completed-bootstrap.js','utf8');
for(const required of ['owner_r1_admin_bootstrap','mergeAdminCompletedApplications','x-rona-admin-completed-restored'])assert.ok(server.includes(required),`server materialization missing ${required}`);

const passport=await readFile('functions/portal/main-ui/application-passport-runtime.js','utf8');
for(const required of [
  'data-rona-app-passport-open',
  'openApplicationPassport(id,button=null)',
  'authoritativeOwnerApplication(id)',
  "authoritativeJson('/portal/admin-completed-bootstrap'",
  "authoritativeJson('/portal/api/v1/admin/bootstrap'",
  "document.addEventListener('click'",
  'window.openApplicationPassport'
])assert.ok(passport.includes(required),`application passport integration missing ${required}`);
for(const forbidden of ['MutationObserver','requestAnimationFrame','waitPassport','__RONA_OWNER_ADMIN_READY__','applyButtons','scheduleButtons'])assert.ok(!passport.includes(forbidden),`passport action must not depend on post-render injection primitive ${forbidden}`);

const helper=await readFile('functions/portal/main-ui/admin-completed-applications.js','utf8');
assert.ok(!/RONA-C\d+|DEAL-2026-00\d/.test(helper),'runtime helper must not contain client/application/deal hardcodes');
assert.ok(!/RONA-C\d+|TEST-IN-DONE|TEST-DEAL-DONE/.test(passport),'passport runtime must remain generic');

console.log('ADMIN_APPLICATIONS_COMPLETED_V3=PASS first_render_action=true delegated_handler=true authoritative_owner_fallback=true observer_owner=false generic=true');
