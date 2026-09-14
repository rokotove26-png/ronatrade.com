import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mergeAdminCompletedApplications} from '../functions/portal/main-ui/admin-completed-applications.js';
import readabilityRuntime from '../functions/portal/main-ui/admin-applications-readability-v5.js';

const deals=Array.from({length:6},(_,i)=>({
  application_id:`APP-${i+1}`,
  deal_id:`DEAL-${i+1}`,
  business_status:'EXECUTING',
  client_id:`CLIENT-${i+1}`,
  legal_name:`Общество с ограниченной ответственностью «Тестовая компания номер ${i+1}»`,
  contract_id:`CTR-${i+1}`,
  source_product:'Тестовый продукт',
  source_quantity_tonnes:[315,500,120,470,250,490][i],
  source_proposed_price:[750,1345,1370,464,464,740][i],
  source_proposed_currency:'USD'
}));
const workflowApps=deals.map(d=>({application_id:d.application_id,deal_id:d.deal_id,owner_status:'DEAL'}));
const base={applications:[],deals,rail:[]};

const full=mergeAdminCompletedApplications(base,{applications:workflowApps,deals});
assert.equal(full.applications.length,6,'full authoritative projection must restore all six completed applications');
assert.ok(full.applications.every(x=>x.owner_status==='DEAL'&&x.status==='DEAL_REGISTERED'&&x.lifecycle_state==='ARCHIVED'));
assert.equal(full.applications.reduce((n,x)=>n+Number(x.quantity_tonnes||0),0),2145,'restored tonnage must remain stable');

// Critical regression: one workflow projection may transiently omit both application and deal arrays.
// The base Admin registered deals are still durable evidence and must prevent a 6 -> 0 UI collapse.
const transient=mergeAdminCompletedApplications(base,{applications:[],deals:[]});
assert.equal(transient.applications.length,6,'transient workflow omission must not collapse completed applications to zero');
assert.deepEqual(transient.applications.map(x=>x.application_id),full.applications.map(x=>x.application_id));

// Repeated reads must produce the same application set instead of oscillating.
let repeated=base;
for(const workflow of [{applications:workflowApps,deals},{applications:[],deals:[]},{applications:workflowApps,deals}]){
  repeated=mergeAdminCompletedApplications({...base,applications:[]},workflow);
  assert.equal(repeated.applications.length,6,'every repeated projection must contain six completed rows');
}

const duplicateBase={...base,applications:[full.applications[0]]};
const deduped=mergeAdminCompletedApplications(duplicateBase,{applications:workflowApps,deals});
assert.equal(deduped.applications.filter(x=>x.application_id==='APP-1').length,1,'completed projection must remain deduplicated');
assert.equal(deduped.applications.length,6);

const pendingDeal={...deals[0],application_id:'APP-PENDING',deal_id:'DEAL-PENDING',business_status:'SUPPLIER_PENDING'};
const pending=mergeAdminCompletedApplications({applications:[],deals:[pendingDeal]},{applications:[],deals:[]});
assert.equal(pending.applications.length,0,'deal still awaiting supplier resource must not be promoted to completed');

const contradicted=mergeAdminCompletedApplications(
  {applications:[],deals:[{...deals[0],application_id:'APP-CONTRA',deal_id:'DEAL-CONTRA'}]},
  {applications:[{application_id:'APP-CONTRA',deal_id:'DEAL-CONTRA',owner_status:'SUPPLIER_PENDING'}],deals:[]}
);
assert.equal(contradicted.applications.length,0,'present workflow application state must stay authoritative over fallback');

assert.match(readabilityRuntime,/__RONA_ADMIN_APPLICATIONS_READABILITY_V5__/);
assert.match(readabilityRuntime,/rona-app-lifecycle-v3>\*\{font-size:20px!important/,'lifecycle typography must be doubled from 10px to 20px');
assert.match(readabilityRuntime,/rona-app-filter button\{font-size:20px!important/,'filter typography must be doubled from 10px to 20px');
assert.match(readabilityRuntime,/rona-owner-table\{font-size:22px!important/,'queue body typography must be doubled from 11px to 22px');
assert.match(readabilityRuntime,/thead th\{font-size:17px!important/,'queue header typography must be doubled from 8.5px to 17px');
assert.match(readabilityRuntime,/rona-app-status-chip\{font-size:17px!important/,'status typography must be doubled from 8.5px to 17px');
assert.match(readabilityRuntime,/font-size:19px!important/,'queue action typography must be doubled from 9.5px to 19px');
assert.match(readabilityRuntime,/-webkit-line-clamp:2!important/,'company names must wrap/clamp to two lines');
assert.doesNotMatch(readabilityRuntime,/\.rona-queue-card-v3\{/,'readability overlay must not resize/redefine the queue outer frame');
assert.doesNotMatch(readabilityRuntime,/\.rona-app-lifecycle-v3\{/,'readability overlay must not resize/redefine the lifecycle outer frame');

const wrapper=fs.readFileSync(new URL('../functions/portal/main-ui/application-passport-runtime.js',import.meta.url),'utf8');
const premiumAt=wrapper.indexOf('adminApplicationsPremiumRuntime');
const readabilityAt=wrapper.lastIndexOf('adminApplicationsReadabilityV5');
assert.ok(premiumAt>=0&&readabilityAt>premiumAt,'readability overlay must compose after the existing premium runtime');
assert.match(wrapper,/applicationPassportRuntimeBase \+ adminApplicationsPremiumRuntime \+ adminApplicationsReadabilityV5/,'existing passport and premium runtime must remain composed');

console.log('ADMIN_APPLICATIONS_PROJECTION_STABILITY_READABLE_V5=PASS completed=6 repeated_stable=true tonnage=2145 typography=2x company_wrap=2_lines outer_frames=unchanged');
