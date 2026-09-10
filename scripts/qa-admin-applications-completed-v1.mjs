import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeAdminCompletedApplications} from '../functions/portal/main-ui/admin-completed-applications.js';

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
  "call('/admin/workflow-bootstrap')",
  'mergeAdminCompletedApplications',
  "owner==='DEAL'",
  "app==='DEAL_REGISTERED'",
  "return'COMPLETED'",
  'x-rona-admin-completed-applications'
])assert.ok(index.includes(required),`Admin main runtime missing ${required}`);

const passport=await readFile('functions/portal/main-ui/application-passport-runtime.js','utf8');
for(const required of ['data-rona-app-passport-open','openPassport(id,button)','currentOwnerApplication(id)'])assert.ok(passport.includes(required),`existing application passport integration missing ${required}`);

const helper=await readFile('functions/portal/main-ui/admin-completed-applications.js','utf8');
assert.ok(!/RONA-C\d+|DEAL-2026-00\d/.test(helper),'runtime helper must not contain client/application/deal hardcodes');

console.log('ADMIN_APPLICATIONS_COMPLETED_V1=PASS terminal=existing-DEAL_REGISTERED bucket=COMPLETED reload=workflow-bootstrap dedupe=true passport=existing generic=true');
