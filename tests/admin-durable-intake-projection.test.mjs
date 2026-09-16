import assert from 'node:assert/strict';
import { mergeAdminDurableIntakeApplications } from '../functions/portal/main-ui/admin-durable-intake-applications.js';

const base={
  clients:[{client_id:'RONA-C002',legal_name:'Client Two'}],
  applications:[{
    application_id:'APP-1',client_id:'RONA-C002',legal_name:'Client Two',quantity_tonnes:50,
    status:'SUBMITTED',owner_status:'NEW',lifecycle_state:'ACTIVE'
  }]
};

const intake={applications:[
  {
    application_id:'APP-1',record_kind:'CLIENT_APPLICATION',quantity_tonnes:55,
    intake_id:'11111111-1111-4111-8111-111111111111',durable_id:'22222222-2222-4222-8222-222222222222',
    source_id:'APP-1',intake_status:'APPLIED',intake_contract:'RONA_CLIENT_INTAKE_V1',
    effective_payload:{quantity_tonnes:55}
  },
  {
    application_id:'PORTAL-EVT-A',request_id:'PORTAL-EVT-A',record_kind:'CLIENT_REQUEST',
    product:'LPG',quantity_tonnes:1000,destination:'Kirghili',status:'APPLIED',
    intake_id:'33333333-3333-4333-8333-333333333333',durable_id:'44444444-4444-4444-8444-444444444444',
    source_id:'PORTAL-EVT-A',actionable_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',
    intake_status:'APPLIED',intake_responsible_role:'OPERATIONS_DIRECTOR',intake_contract:'RONA_CLIENT_INTAKE_V1',
    effective_payload:{
      client_id:'RONA-C002',contract_id:'RONA-C002-CTR-2026-001',product:'LPG',quantity_tonnes:1000,
      destination:{station:'Kirghili'},commercial:{currency:'USD',price_mode:'REQUEST_DELIVERED_PRICE',payment_terms:'30/70'}
    }
  }
]};

const result=mergeAdminDurableIntakeApplications(base,intake);
assert.equal(result.restored,1);
assert.equal(result.updated,1);
assert.equal(result.data.applications.length,2);

const existing=result.data.applications.find(x=>x.application_id==='APP-1');
assert.equal(existing.quantity_tonnes,55);
assert.equal(existing.owner_status,'NEW');
assert.equal(existing.status,'SUBMITTED');
assert.equal(existing.intake_status,'APPLIED');

const request=result.data.applications.find(x=>x.application_id==='PORTAL-EVT-A');
assert(request);
assert.equal(request.record_kind,'CLIENT_REQUEST');
assert.equal(request.quantity_tonnes,1000);
assert.equal(request.client_id,'RONA-C002');
assert.equal(request.legal_name,'Client Two');
assert.equal(request.contract_id,'RONA-C002-CTR-2026-001');
assert.equal(request.owner_status,'NEW');
assert.equal(request.status,'SUBMITTED');
assert.equal(request.intake_status,'APPLIED');
assert.equal(request.proposed_currency,'USD');
assert.equal(request.payment_terms,'30/70');
assert.equal(request.intake_responsible_role,'OPERATIONS_DIRECTOR');

console.log('ADMIN_DURABLE_INTAKE_PROJECTION=PASS');
