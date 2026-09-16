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

const transient=mergeAdminCompletedApplications(base,{applications:[],deals:[]});
assert.equal(transient.applications.length,6,'transient workflow omission must not collapse completed applications to zero');
assert.deepEqual(transient.applications.map(x=>x.application_id),full.applications.map(x=>x.application_id));

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
assert.match(readabilityRuntime,/20260914-v8-title-2x/,'2x Applications title visual pass must be the active readability overlay');
assert.match(readabilityRuntime,/rona-app-existing-hero-v3\{width:100%!important;min-height:0!important/,'nested title card must flatten into the existing full-width hero');
assert.match(readabilityRuntime,/rona-app-title-v3\{margin:1px 0 5px!important;color:#fff!important;font-size:60px!important/,'Applications title must be exactly doubled from 30px to 60px');
assert.match(readabilityRuntime,/@media\(max-width:900px\).*rona-app-title-v3\{font-size:52px!important/,'responsive Applications title must be exactly doubled from 26px to 52px');
assert.match(readabilityRuntime,/background:transparent!important;box-shadow:none!important/,'nested hero card chrome must be removed');
assert.match(readabilityRuntime,/rona-app-lifecycle-v3>\*\{font-size:13px!important/,'lifecycle typography must be balanced at 13px');
assert.match(readabilityRuntime,/rona-app-filter button\{font-size:12\.5px!important/,'filter typography must be balanced at 12.5px');
assert.match(readabilityRuntime,/rona-owner-table\{font-size:13\.5px!important/,'queue body typography must be balanced at 13.5px');
assert.match(readabilityRuntime,/thead th\{font-size:10\.5px!important/,'queue header typography must be balanced at 10.5px');
assert.match(readabilityRuntime,/rona-app-status-chip\{font-size:10\.5px!important/,'status typography must be balanced at 10.5px');
assert.match(readabilityRuntime,/font-size:11\.5px!important/,'queue actions and supporting price text must remain compact but readable');
assert.doesNotMatch(readabilityRuntime,/font-size:20px!important|font-size:22px!important|font-size:19px!important/,'rejected oversized queue typography must be absent');
assert.match(readabilityRuntime,/-webkit-line-clamp:2!important/,'company names must wrap/clamp to two lines');
assert.match(readabilityRuntime,/nth-child\(1\).*#78ddff/,'table header must carry cyan hierarchy accent');
assert.match(readabilityRuntime,/nth-child\(4\).*#ffd58b/,'table header must carry amber hierarchy accent');
assert.match(readabilityRuntime,/nth-child\(7\).*#8fe8c9/,'table header must carry green hierarchy accent');
assert.match(readabilityRuntime,/nth-child\(8\).*#bdaeff/,'table header must carry violet hierarchy accent');
assert.match(readabilityRuntime,/rona-app-lifecycle-v3>\*:nth-child\(4\).*#c7f6e6/,'deal lifecycle stage must carry success color');
assert.doesNotMatch(readabilityRuntime,/\.rona-queue-card-v3\{/,'readability overlay must not resize/redefine the queue outer frame');
assert.doesNotMatch(readabilityRuntime,/\.rona-app-lifecycle-v3\{/,'readability overlay must not resize/redefine the lifecycle outer frame');

const wrapper=fs.readFileSync(new URL('../functions/portal/main-ui/application-passport-runtime.js',import.meta.url),'utf8');
const terminalAt=wrapper.indexOf('adminApplicationsTerminalBucketV1');
const actionAt=wrapper.indexOf('adminApplicationsPassportActionV2');
const premiumAt=wrapper.indexOf('adminApplicationsPremiumRuntime');
const readabilityAt=wrapper.lastIndexOf('adminApplicationsReadabilityV5');
assert.ok(terminalAt>=0&&actionAt>terminalAt&&premiumAt>actionAt&&readabilityAt>premiumAt,'terminal lifecycle guard and universal passport trigger must compose before premium/readability overlays');
assert.match(wrapper,/applicationPassportRuntimeBase\s*\+\s*adminApplicationsTerminalBucketV1\s*\+\s*adminApplicationsPassportActionV2\s*\+\s*adminApplicationsPremiumRuntime\s*\+\s*adminApplicationsReadabilityV5/,'passport, terminal lifecycle guard, universal trigger, premium and readability runtimes must remain composed in order');

console.log('ADMIN_APPLICATIONS_PROJECTION_STABILITY_READABLE_V5=PASS completed=6 repeated_stable=true tonnage=2145 terminal_bucket_guard=active passport_open=universal hero=clean-integrated title=60px responsive_title=52px typography=balanced color_hierarchy=cyan-violet-amber-green company_wrap=2_lines outer_frames=unchanged');
