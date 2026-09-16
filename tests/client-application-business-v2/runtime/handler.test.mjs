import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApplicationBusinessHandler} from '../../../supabase/functions/_shared/client-application-business-v2/handler.mjs';
import {validateApplicationProjection,applyCanonicalApplications} from '../../../functions/portal/application-business-contract-v2.js';
import {sql,rows,execute,literal,verifyDisposableDatabase,fixture} from './database.mjs';
let f;
before(async()=>{await verifyDisposableDatabase();f=await fixture()});
const route=url=>url.pathname;
const base={ok:true,data:{applications:[{application_id:'TECHNICAL-MUST-NOT-LEAK'}],payments:[{bank_sentinel:'UNCHANGED'}],deals:[{deal_sentinel:'UNCHANGED'}],documents:[],prices:[]}};
function handler(n=1){return createApplicationBusinessHandler(async()=>Response.json(structuredClone(base)),{sql,apiRoute:route,authenticate:async()=>n?{auth:f['auth'+n],sid:f['session'+n],roles:[n===3?'ADMIN':'CLIENT']}:null})}
async function bundle(n=1,key=randomUUID(),quantity=27.29){return (await sql`select test_application_v2.bundle(${n},${key},${quantity}) as body`)[0].body}
async function send(h,path,body){return h(new Request('https://ronaoil.com'+path,body?{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':body.idempotencyKey||body.idempotency_key},body:JSON.stringify(body)}:{}))}
async function ownerAction(applicationId,action,payload={}){
 const claims=JSON.stringify({sub:f.auth3,session_id:f.session3,role:'authenticated'});
 await execute(`select set_config('request.jwt.claims',${literal(claims)},false);select public.owner_r1_application_business_action_v2(${literal(applicationId)},${literal(action)},${literal(payload)}::jsonb);`);
}
let receipt;
test('actual handler commits atomic standard bundle and exposes one canonical ID',async()=>{
 const body=await bundle();const result=await send(handler(),'/v1/client/applications',body);assert.equal(result.status,200);receipt=(await result.json()).application;
 assert.match(receipt.application_id,/^QA-C-.+-IN-[0-9]{4}-[0-9]+$/);assert.equal(receipt.bundle_complete,true);assert.ok(receipt.intake_id&&receipt.durable_id);
 const retry=await send(handler(),'/v1/client/applications',body);assert.equal((await retry.json()).application.application_id,receipt.application_id);
});
test('old split-submit route fails rather than claiming success without details',async()=>{const body=await bundle();delete body.applicationDetails;const result=await send(handler(),'/v1/client/applications',body);assert.equal(result.status,400)});
test('header/body intent conflict fails before any write',async()=>{const body=await bundle();const result=await handler()(new Request('https://ronaoil.com/v1/client/applications',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':'DIFFERENT'},body:JSON.stringify(body)}));assert.equal(result.status,400)});
test('actual canonical GET preserves unrelated base collections byte-for-byte',async()=>{
 const result=await send(handler(3),'/v1/admin/bootstrap');assert.equal(result.status,200);const data=(await result.json()).data;
 assert.deepEqual(data.payments,base.data.payments);assert.deepEqual(data.deals,base.data.deals);
 assert.ok(data.applications.some(x=>x.application_id===receipt.application_id));assert.ok(data.applications.every(x=>x.record_kind==='CLIENT_APPLICATION'));
 validateApplicationProjection({contract:data.application_business_contract,applications:data.applications,application_kpi:data.application_kpi});
});
test('Client/Admin facts and fresh passports resolve identical canonical business data',async()=>{
 const scope='?clientId='+f.client_id1+'&contractId='+f.contract_id1;
 const client=await (await send(handler(),'/v1/client/context'+scope)).json();
 const admin=await (await send(handler(3),'/v1/admin/bootstrap')).json();
 assert.deepEqual(client.data.applications.find(x=>x.application_id===receipt.application_id),admin.data.applications.find(x=>x.application_id===receipt.application_id));
 const passport=await (await send(handler(),'/v1/client/applications/'+receipt.application_id+'/passport'+scope)).json();
 assert.equal(passport.data.application.application_id,receipt.application_id);
 assert.equal((await send(handler(2),'/v1/client/applications/'+receipt.application_id+'/passport?clientId='+f.client_id2+'&contractId='+f.contract_id2)).status,404);
 assert.equal((await send(handler(),'/v1/client/applications/PORTAL-EVT-invalid/passport'+scope)).status,400);
});
test('session denial, cross-role denial and invalid origin do not delegate protected reads',async()=>{
 assert.equal((await send(handler(0),'/v1/admin/bootstrap')).status,401);
 assert.equal((await send(handler(),'/v1/admin/bootstrap')).status,403);
 assert.equal((await handler(3)(new Request('https://ronaoil.com/v1/admin/bootstrap',{headers:{origin:'https://not-authorized.invalid'}}))).status,403);
});
test('disabled policy denies reachable handler writes and reads including an existing receipt',async()=>{
 const body=await bundle();const created=await send(handler(),'/v1/client/applications',body);assert.equal(created.status,200);
 await execute('update portal_private.client_application_policy_v2 set enabled=false;');
 try{assert.equal((await send(handler(),'/v1/client/applications',body)).status,503);assert.equal((await send(handler(3),'/v1/admin/bootstrap')).status,503)}
 finally{await execute('update portal_private.client_application_policy_v2 set enabled=true;')}
});
test('missing/duplicate identity, missing client and inconsistent KPI fail closed in actual validator',async()=>{
 const data=(await (await send(handler(3),'/v1/admin/bootstrap')).json()).data;
 const p={contract:data.application_business_contract,applications:data.applications,application_kpi:data.application_kpi};
 const copy=()=>structuredClone(p);
 let q=copy();q.applications[0].client_name='';assert.throws(()=>validateApplicationProjection(q),/REQUIRED_FIELD/);
 q=copy();q.applications.push(q.applications[0]);assert.throws(()=>validateApplicationProjection(q),/CANONICAL_ID/);
 q=copy();q.application_kpi.total++;assert.throws(()=>validateApplicationProjection(q),/KPI_PROJECTION/);
 q=copy();q.applications[0].price_is_owner_agreed=true;q.applications[0].application_price=null;assert.throws(()=>validateApplicationProjection(q),/AGREEMENT/);
 assert.throws(()=>applyCanonicalApplications({},p,{clientId:'OTHER',contractId:'OTHER'}),/SCOPE_CONFLICT/);
});
test('real concurrent sessions retry same intent exactly once; different clients never share ID',async()=>{
 const key=randomUUID();const body=await bundle(1,key,19.45);
 const replies=await Promise.all(Array.from({length:8},()=>send(handler(1),'/v1/client/applications',body)));
 assert.ok(replies.every(x=>x.status===200));const ids=await Promise.all(replies.map(async x=>(await x.json()).application.application_id));assert.equal(new Set(ids).size,1);
 const other=await send(handler(2),'/v1/client/applications',await bundle(2,key,19.45));assert.equal(other.status,200);assert.notEqual((await other.json()).application.application_id,ids[0]);
 const reserve=await rows('select count(*)::integer as n from portal_private.client_application_number_reservations_v2 where application_id='+literal(ids[0]));assert.equal(reserve[0].n,1);
});
test('immediate Owner rejection is physically deleted before response and retry cannot resurrect it',async()=>{
 const body=await bundle(1,randomUUID(),31.19);const id=(await (await send(handler(),'/v1/client/applications',body)).json()).application.application_id;
 await ownerAction(id,'REJECT',{reason:'ISOLATED_HANDLER_OWNER_REJECT'});
 assert.equal((await send(handler(),'/v1/client/applications',body)).status,410);
 const exists=await rows('select exists(select 1 from portal_private.client_applications where application_id='+literal(id)+') as alive');assert.equal(exists[0].alive,false);
 const common=await sql`select portal_private.canonical_target_snapshot('APPLICATION',${id}) as item`;assert.equal(common[0].item.business_visible,false);
});
test('two different clients submit concurrently with the same intent string and retain independent ownership',async()=>{
 const key=randomUUID(),a=await bundle(1,key,17.131),b=await bundle(2,key,17.131);
 const responses=await Promise.all([send(handler(1),'/v1/client/applications',a),send(handler(2),'/v1/client/applications',b)]);
 assert.ok(responses.every(x=>x.status===200));const values=await Promise.all(responses.map(x=>x.json()));assert.notEqual(values[0].application.application_id,values[1].application.application_id);
 for(let i=0;i<2;i++){const row=await sql`select portal_private.application_common_snapshot_v2(${values[i].application.application_id}) as a`;assert.equal(row[0].a.client_id,f['client_id'+(i+1)])}
});
test('legacy delivered-event path is denied while policy is disabled',async()=>{
 const body=(await sql`select test_application_v2.delivered(1,${randomUUID()},18.11) as b`)[0].b;
 await execute('update portal_private.client_application_policy_v2 set enabled=false;');
 try{await assert.rejects(()=>sql`select * from portal_private.server_submit_reverse_event(${f.auth1}::uuid,${f.session1},'CLIENT_MESSAGE_SUBMIT','PRICE_CALCULATION','PUBLICATION_ITEM',${f.publication_item},${f.client_id1},${f.contract_id1},null,${body.payload}::jsonb,${body.idempotency_key},gen_random_uuid(),gen_random_uuid())`,/POLICY_NOT_ACTIVE/)}
 finally{await execute('update portal_private.client_application_policy_v2 set enabled=true;')}
});