import assert from 'node:assert/strict';
import {normalizeClientIntakeBusinessRows} from '../../supabase/functions/_shared/client-intake-v1/business-lifecycle-v1.mjs';

const rows=[
  {application_id:'APP-NEW',record_kind:'CLIENT_APPLICATION',status:'APPLIED',owner_status:'NEW',lifecycle_state:'ACTIVE',intake_id:'I-NEW'},
  {application_id:'APP-DEAL',record_kind:'CLIENT_APPLICATION',status:'APPLIED',owner_status:'NEW',lifecycle_state:'ACTIVE',intake_id:'I-DEAL'},
  {application_id:'EVT-DETAIL',record_kind:'CLIENT_REQUEST',actionable_type:'APPLICATION_DETAILS_V5',effective_payload:{application_id:'APP-DEAL'},intake_id:'I-DETAIL',source_id:'EVT-DETAIL'},
  {application_id:'EVT-CURRENT',record_kind:'CLIENT_REQUEST',actionable_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',status:'APPLIED',owner_status:'NEW',lifecycle_state:'ACTIVE',intake_id:'I-CURRENT',source_id:'EVT-CURRENT'},
  {application_id:'EVT-OLD',record_kind:'CLIENT_REQUEST',actionable_type:'DELIVERED_PRICE_CALCULATION_REQUEST_V1',status:'APPLIED',owner_status:'NEW',lifecycle_state:'ACTIVE',intake_id:'I-OLD',source_id:'EVT-OLD'}
];

const applications=[
  {application_id:'APP-NEW',status:'SUBMITTED',lifecycle_state:'ACTIVE',deal_id:null,business_status:null},
  {application_id:'APP-DEAL',status:'DEAL_REGISTERED',lifecycle_state:'ARCHIVED',deal_id:'DEAL-9',business_status:'DEAL'}
];
const tasks=[
  {intake_id:'I-CURRENT',task_status:'NEW',task_decision:null,task_decision_at:null},
  {intake_id:'I-OLD',task_status:'COMPLETED',task_decision:'APPROVED_WITH_CONDITIONS',task_decision_at:'2026-08-30T23:12:27Z'}
];

const out=normalizeClientIntakeBusinessRows(rows,applications,tasks);
assert.equal(out.length,4,'technical application-details event must not become a business row');

const deal=out.find(x=>x.application_id==='APP-DEAL');
assert.equal(deal.status,'DEAL_REGISTERED');
assert.equal(deal.owner_status,'DEAL');
assert.equal(deal.lifecycle_state,'ARCHIVED');
assert.equal(deal.deal_id,'DEAL-9');

const current=out.find(x=>x.request_id==='EVT-CURRENT');
assert.equal(current.status,'SUBMITTED');
assert.equal(current.owner_status,'NEW');
assert.equal(current.lifecycle_state,'ACTIVE');

const old=out.find(x=>x.request_id==='EVT-OLD');
assert.equal(old.status,'COMPLETED');
assert.equal(old.owner_status,'COMPLETED');
assert.equal(old.lifecycle_state,'ARCHIVED');
assert.equal(old.intake_task_status,'COMPLETED');

const deduped=normalizeClientIntakeBusinessRows([...rows,rows[0]],applications,tasks);
assert.equal(deduped.filter(x=>x.application_id==='APP-NEW').length,1,'logical applications must be exactly-once in projection');

console.log('CLIENT_INTAKE_BUSINESS_LIFECYCLE_V1=PASS');
