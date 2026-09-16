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
    product:'LPG',quantity_tonnes:1000,destination:'Kirghili',status:'SUBMITTED',owner_status:'NEW',lifecycle_state:'ACTIVE',
    intake_id:'33333333-3333-4333-8333-333333333333',durable_id:'44444444-4444-4444-8444-444444444444',
    source_id:'PORTAL-EVT-A',actionable_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',
    intake_status:'APPLIED',intake_responsible_role:'OPERATIONS_DIRECTOR',intake_contract:'RONA_CLIENT_INTAKE_V1',
    effective_payload:{
      client_id:'RONA-C002',contract_id:'RONA-C002-CTR-2026-001',product:'LPG',quantity_tonnes:1000,
      destination:{station:'Kirghili'},commercial:{currency:'USD',price_mode:'REQUEST_DELIVERED_PRICE',payment_terms:'30/70'}
    }
  },
  {
    application_id:'PORTAL-EVT-OLD',request_id:'PORTAL-EVT-OLD',record_kind:'CLIENT_REQUEST',
    product:'LPG',quantity_tonnes:500,status:'COMPLETED',owner_status:'COMPLETED',lifecycle_state:'ARCHIVED',
    intake_id:'55555555-5555-4555-8555-555555555555',durable_id:'66666666-6666-4666-8666-666666666666',
    source_id:'PORTAL-EVT-OLD',actionable_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',intake_status:'APPLIED',
    intake_task_status:'COMPLETED',intake_contract:'RONA_CLIENT_INTAKE_V1',effective_payload:{client_id:'RONA-C002',quantity_tonnes:500}
  },
  {
    application_id:'APP-DEAL',record_kind:'CLIENT_APPLICATION',product:'LPG',quantity_tonnes:490,
    status:'DEAL_REGISTERED',owner_status:'DEAL',lifecycle_state:'ARCHIVED',deal_id:'DEAL-9',deal_status:'DEAL',
    intake_id:'77777777-7777-4777-8777-777777777777',durable_id:'88888888-8888-4888-8888-888888888888',
    source_id:'APP-DEAL',actionable_type:'PUBLISHED_PRICE_APPLICATION',intake_status:'APPLIED',intake_contract:'RONA_CLIENT_INTAKE_V1',effective_payload:{client_id:'RONA-C002',quantity_tonnes:490}
  },
  {
    application_id:'PORTAL-EVT-DETAIL',record_kind:'CLIENT_REQUEST',status:'COMPLETED',owner_status:'COMPLETED',lifecycle_state:'ARCHIVED',
    intake_id:'99999999-9999-4999-8999-999999999999',durable_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    source_id:'PORTAL-EVT-DETAIL',actionable_type:'APPLICATION_DETAILS_V5',intake_status:'APPLIED',intake_contract:'RONA_CLIENT_INTAKE_V1',
    effective_payload:{application_id:'APP-DEAL',client_id:'RONA-C002',quantity_tonnes:490}
  }
]};

const result=mergeAdminDurableIntakeApplications(base,intake);
assert.equal(result.restored,3);
assert.equal(result.updated,1);
assert.equal(result.data.applications.length,4);

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
assert.equal(request.lifecycle_state,'ACTIVE');
assert.equal(request.intake_status,'APPLIED');
assert.equal(request.proposed_currency,'USD');
assert.equal(request.payment_terms,'30/70');
assert.equal(request.intake_responsible_role,'OPERATIONS_DIRECTOR');

const completed=result.data.applications.find(x=>x.application_id==='PORTAL-EVT-OLD');
assert.equal(completed.owner_status,'COMPLETED');
assert.equal(completed.status,'COMPLETED');
assert.equal(completed.lifecycle_state,'ARCHIVED');
assert.equal(completed.intake_task_status,'COMPLETED');

const deal=result.data.applications.find(x=>x.application_id==='APP-DEAL');
assert.equal(deal.owner_status,'DEAL');
assert.equal(deal.status,'DEAL_REGISTERED');
assert.equal(deal.lifecycle_state,'ARCHIVED');
assert.equal(deal.deal_id,'DEAL-9');
assert.equal(result.data.applications.some(x=>x.application_id==='PORTAL-EVT-DETAIL'),false);

console.log('ADMIN_DURABLE_INTAKE_PROJECTION=PASS');
