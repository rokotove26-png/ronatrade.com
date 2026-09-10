import assert from 'node:assert/strict';
import {onRequest as ownerApi} from '../functions/portal/owner-api.js';
import {onRequest as completedBootstrap} from '../functions/portal/admin-completed-bootstrap.js';

const base={
  generatedAt:'2026-09-10T00:00:00.000Z',
  applications:[{application_id:'TEST-IN-ACTIVE',owner_status:'SUPPLIER_APPROVED',status:'ACCEPTED_AWAITING_DEAL_REGISTRATION',product:'Активный товар',quantity_tonnes:10}],
  rail:[]
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
  calls.push({url,method:String(init.method||input?.method||'GET').toUpperCase(),authorization:headers.get('authorization')});
  if(url.includes('/rest/v1/rpc/owner_r1_admin_bootstrap'))return new Response(JSON.stringify(workflow),{status:200,headers:{'content-type':'application/json'}});
  if(url.includes('/functions/v1/rona-owner-acceptance/admin/bootstrap'))return new Response(JSON.stringify({ok:true,data:base}),{status:200,headers:{'content-type':'application/json'}});
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
  const materializedRequest=new Request('https://runtime.test/portal/admin-completed-bootstrap',{headers:{cookie:'rona_portal_at=runtime-admin-token'}});
  const materializedResponse=await completedBootstrap({request:materializedRequest});
  assert.equal(materializedResponse.status,200,'server-materialized Admin bootstrap must succeed');
  assert.equal(materializedResponse.headers.get('x-rona-admin-completed-applications'),'owner-r1-server-v2');
  assert.equal(materializedResponse.headers.get('x-rona-admin-completed-restored'),'1');
  const materialized=await materializedResponse.json();
  const rows=materialized.data.applications;
  assert.equal(rows.length,2,'Admin snapshot must contain active and restored completed application before rendering');
  assert.equal(rows.filter(x=>x.application_id==='TEST-IN-DONE').length,1,'restored application must be unique');
  const done=rows.find(x=>x.application_id==='TEST-IN-DONE');
  assert.equal(done.status,'DEAL_REGISTERED');
  assert.equal(done.owner_status,'DEAL');
  assert.equal(done.lifecycle_state,'ARCHIVED');
  assert.equal(done.deal_id,'TEST-DEAL-DONE');
  assert.equal(done.product,'Завершённый товар');
  assert.equal(done.proposed_price,725);
  assert.equal(calls.length,2,'materialization must read exactly base Admin bootstrap and workflow projection');
  assert.ok(calls.every(x=>x.authorization==='Bearer runtime-admin-token'),'both authoritative reads must use the same authenticated bearer token');

  const denied=await completedBootstrap({request:new Request('https://runtime.test/portal/admin-completed-bootstrap')});
  assert.equal(denied.status,401,'materialization endpoint must remain auth-gated');

  console.log('ADMIN_APPLICATIONS_COMPLETED_AUTH_RUNTIME_V2=PASS workflow_route=authenticated server_merge=before_render restored=1 dedupe=true auth_gate=401');
}finally{
  globalThis.fetch=realFetch;
}
