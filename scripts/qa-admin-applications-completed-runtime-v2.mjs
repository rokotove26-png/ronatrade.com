import assert from 'node:assert/strict';
import {onRequest as ownerApi} from '../functions/portal/owner-api.js';
import {onRequest as completedBootstrap} from '../functions/portal/admin-completed-bootstrap.js';

const base={
  generatedAt:'2026-09-10T00:00:00.000Z',
  clients:[{client_id:'TEST-C-REQUEST',legal_name:'Клиент новой заявки'}],
  applications:[{application_id:'TEST-IN-ACTIVE',owner_status:'SUPPLIER_APPROVED',status:'ACCEPTED_AWAITING_DEAL_REGISTRATION',product:'Активный товар',quantity_tonnes:10}],
  rail:[]
};
const intake={
  application_business_contract:'RONA_APPLICATION_BUSINESS_V2',
  applications:[
    {
      business_contract:'RONA_APPLICATION_BUSINESS_V2',record_kind:'CLIENT_APPLICATION',
      application_id:'TEST-IN-2026-001',client_id:'TEST-C-REQUEST',client_name:'Клиент новой заявки',contract_id:'TEST-CTR-REQUEST',
      product:'СУГ',status:'SUBMITTED',lifecycle_state:'ACTIVE',business_bucket:'NEW',quantity_tonnes:1000,
      application_price:null,application_currency:null,deal_id:null,price_is_owner_agreed:false,price_is_agreed:false
    },
    {
      business_contract:'RONA_APPLICATION_BUSINESS_V2',record_kind:'CLIENT_APPLICATION',
      application_id:'TEST-IN-2026-002',client_id:'TEST-C-DONE',client_name:'Завершённый клиент',contract_id:'TEST-CTR-DONE',
      product:'Завершённый товар',status:'DEAL_REGISTERED',lifecycle_state:'ARCHIVED',business_bucket:'COMPLETED',quantity_tonnes:25,
      application_price:725,application_currency:'USD',deal_id:'TEST-DEAL-DONE',price_is_owner_agreed:true,price_is_agreed:true
    }
  ],
  application_kpi:{source:'RONA_APPLICATION_BUSINESS_V2',total:2,active:1,new:1,in_work:0,decision:0,completed:1,deal_registered:1,tonnage:1025,amounts:null}
};
const workflow={
  applications:[
    {application_id:'TEST-IN-ACTIVE',deal_id:null,owner_status:'SUPPLIER_APPROVED'},
    {application_id:'TEST-IN-DONE',deal_id:'TEST-DEAL-DONE',owner_status:'DEAL'}
  ],
  deals:[
    {application_id:'TEST-IN-DONE',deal_id:'TEST-DEAL-DONE',business_status:'EXECUTING',client_id:'TEST-C-DONE',legal_name:'Завершённый клиент',contract_id:'TEST-CTR-DONE',source_product:'Завершённый товар',source_quantity_tonnes:25,delivery_basis:'CPT',destination:'Тестовая станция',source_proposed_price:725,source_proposed_currency:'USD'}
  ]
};

const realFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async(input,init={})=>{
  const url=String(input?.url||input);
  const headers=new Headers(init.headers||input?.headers||{});
  calls.push({url,method:String(init.method||input?.method||'GET').toUpperCase(),authorization:headers.get('authorization'),source:headers.get('x-rona-client-source'),reason:headers.get('x-rona-client-refresh-reason')});
  if(url.includes('/rest/v1/rpc/owner_r1_admin_bootstrap'))return new Response(JSON.stringify(workflow),{status:200,headers:{'content-type':'application/json'}});
  if(url.includes('/functions/v1/rona-owner-acceptance/admin/bootstrap'))return new Response(JSON.stringify({ok:true,data:base}),{status:200,headers:{'content-type':'application/json'}});
  if(url.includes('/functions/v1/rona-portal-api/v1/admin/bootstrap'))return new Response(JSON.stringify({ok:true,data:intake}),{status:200,headers:{'content-type':'application/json'}});
  throw new Error('UNEXPECTED_FETCH '+url);
};

try{
  const workflowRequest=new Request('https://runtime.test/portal/owner-api?path=%2Fadmin%2Fworkflow-bootstrap',{headers:{cookie:'rona_portal_at=runtime-admin-token'}});
  const workflowResponse=await ownerApi({request:workflowRequest});
  assert.equal(workflowResponse.status,200,'existing /admin/workflow-bootstrap must resolve for authenticated runtime');
  const workflowPayload=await workflowResponse.json();
  assert.equal(workflowPayload.ok,true);
  assert.equal(workflowPayload.data.applications.find(x=>x.application_id==='TEST-IN-DONE')?.owner_status,'DEAL');
  assert.equal(calls.at(-1)?.authorization,'Bearer runtime-admin-token','workflow RPC must receive the authenticated bearer token');

  calls.length=0;
  const materializedRequest=new Request('https://runtime.test/portal/admin-completed-bootstrap',{headers:{cookie:'rona_portal_at=runtime-admin-token','x-rona-client-source':'ADMIN_MAIN_BOOT','x-rona-client-refresh-reason':'ADMIN_MAIN_BOOT'}});
  const materializedResponse=await completedBootstrap({request:materializedRequest});
  assert.equal(materializedResponse.status,200,'server-materialized Admin bootstrap must succeed');
  assert.equal(materializedResponse.headers.get('x-rona-application-business'),'RONA_APPLICATION_BUSINESS_V2');
  const materialized=await materializedResponse.json();
  const rows=materialized.data.applications;
  assert.equal(rows.length,2,'Admin snapshot must use the canonical application-business projection');
  assert.equal(rows.filter(x=>x.application_id==='TEST-IN-2026-002').length,1,'completed application must remain unique');
  const request=rows.find(x=>x.application_id==='TEST-IN-2026-001');
  assert(request,'current canonical application must be visible in Admin applications');
  assert.equal(request.quantity_tonnes,1000);
  assert.equal(request.business_bucket,'NEW');
  const done=rows.find(x=>x.application_id==='TEST-IN-2026-002');
  assert.equal(done.status,'DEAL_REGISTERED');
  assert.equal(done.business_bucket,'COMPLETED');
  assert.equal(done.lifecycle_state,'ARCHIVED');
  assert.equal(done.deal_id,'TEST-DEAL-DONE');
  assert.equal(done.product,'Завершённый товар');
  assert.equal(done.application_price,725);
  assert.equal(calls.length,2,'materialization must read base Admin bootstrap and canonical application projection');
  assert.ok(calls.every(x=>x.authorization==='Bearer runtime-admin-token'),'all authoritative reads must use the same authenticated bearer token');
  assert.ok(calls.every(x=>x.source==='ADMIN_MAIN_BOOT'&&x.reason==='ADMIN_MAIN_BOOT'),'materialization must propagate runtime source/reason telemetry');

  const denied=await completedBootstrap({request:new Request('https://runtime.test/portal/admin-completed-bootstrap')});
  assert.equal(denied.status,401,'materialization endpoint must remain auth-gated');

  console.log('ADMIN_APPLICATIONS_COMPLETED_AUTH_RUNTIME_V4=PASS workflow_route=authenticated canonical_projection=before_render telemetry_forwarded=1 auth_gate=401');
}finally{
  globalThis.fetch=realFetch;
}
