import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SYSTEM_ADMIN_HANDOFF_WRITE_TOOLS,createSystemAdminHandoffWorkflow,technicalHandoffTaskId} from '../supabase/functions/rona-mcp-gateway/system-admin-handoff-workflow.mjs';
const ID='a43429c7-76bc-42ec-9029-5a60e1015a2e';
const ROOT='1d93b2fb-685a-4c02-af3c-7deed611861a';
const ctx={role:'SYSTEM_ADMIN',identity_id:'AI-SYSTEM-ADMIN',scope:'mcp:read mcp:coordinate',server_slug:'rona-mcp-system-admin-pilot',token_id:'8f111111-1111-4111-8111-111111111111',client_id:'safe-client',qaOnly:false};
const source=(target_type='SYSTEM',target_id='MCP')=>({record_id:ID,parent_record_id:ROOT,record_type:'HANDOFF_REQUEST',status:'REQUESTED',version:2,target_type,target_id,target_role:'SYSTEM_ADMIN',sender:'OPERATIONS_DIRECTOR',payload:{subject:'Investigate infrastructure bridge',requested_check:'Restore safe task lifecycle',priority:'HIGH',source_refs:['OWNER:123']},source_refs:['OWNER:123'],qa_only:false});
const args={record_id:ID,note:'Reviewed authorized technical scope',evidence_refs:['PR:1246:MERGED'],idempotency_key:'system-owner-safe-20261017-v1'};
const sha=value=>createHash('sha256').update(value).digest('hex');
function fixture(opts={}){
 const statements=[],events=[];
 const sql={async begin(fn){
  return fn({unsafe:async(query,params=[])=>{
   statements.push({query,params});
   if(query.includes('pg_advisory_xact_lock'))return[{}];
   if(query.includes('WHERE identity_id=$1 AND tool_name=$2'))return opts.prior||[];
   if(query.includes('WHERE record_id=$1::uuid AND record_type'))return opts.source===false?[]:[opts.source||source()];
   if(query.includes('WHERE supersedes_id=$1::uuid'))return opts.newer?[{record_id:ROOT}]:[];
   if(query.includes('SELECT task_id,status::text,source_type'))return opts.existing||[];
   if(query.includes('EXISTS(SELECT 1 FROM portal_private.ai_coordination_records'))return opts.completed?[{status:'COMPLETED'}]:[];
   if(query.startsWith('INSERT INTO portal_private.staff_tasks'))return[{task_id:technicalHandoffTaskId(ROOT),status:'NEW'}];
   if(query.startsWith('INSERT INTO portal_private.ai_coordination_records'))return[{record_id:'4a777777-7777-4777-8777-777777777777',status:opts.outcome||'ACKNOWLEDGED',version:3}];
   if(query.startsWith('INSERT INTO portal_private.ai_coordination_audit_events'))return[{}];
   throw Error('Unmocked SQL '+query.slice(0,90));
  }});
 }};
 const handle=createSystemAdminHandoffWorkflow({
  sql,primaryTechnicalCtx:c=>c?.identity_id==='AI-SYSTEM-ADMIN'&&c?.role==='SYSTEM_ADMIN'&&c?.server_slug==='rona-mcp-system-admin-pilot',
  scopeHas:(s,n)=>s.split(' ').includes(n),
  requestIds:()=>({mcpRequestId:'af111111-1111-4111-8111-111111111111',correlationId:'bf111111-1111-4111-8111-111111111111'}),
  rateAllowed:async()=>true,
  recordMcpEvent:async(_c,_i,tool,result)=>events.push({tool,result}),
  rpcToolResponse:(id,body,isError=false)=>({id,body,isError}),
  sha256Hex:async v=>sha(v),
  stableStringify:v=>JSON.stringify(v)
 });
 const invoke=(name,parameters=args,identity=ctx)=>handle(identity,{}, {id:9,params:{name,arguments:parameters}});
 return{invoke,statements,events};
}
test('role-scoped workflow declares exactly two audited tools and requires coordinate scope',async()=>{
 assert.deepEqual(SYSTEM_ADMIN_HANDOFF_WRITE_TOOLS.map(x=>x.name),['staff_handoff_task_materialize','staff_handoff_status_submit']);
 assert.ok(SYSTEM_ADMIN_HANDOFF_WRITE_TOOLS.every(x=>x.securitySchemes[0].scopes[0]==='mcp:coordinate'));
 const f=fixture();
 const denied=await f.invoke('staff_handoff_task_materialize',args,{...ctx,role:'FINANCE',identity_id:'AI-FINANCE'});
 assert.equal(denied.body.code,'SYSTEM_ADMIN_IDENTITY_REQUIRED');
 const readOnly=await f.invoke('staff_handoff_task_materialize',args,{...ctx,scope:'mcp:read'});
 assert.equal(readOnly.body.code,'COORDINATION_SCOPE_REQUIRED');
 const qa=await f.invoke('staff_handoff_task_materialize',args,{...ctx,qaOnly:true});
 assert.equal(qa.body.code,'QA_ONLY_MUTATION_DENIED');
 assert.equal(f.statements.length,0);
});
test('materialization writes only technical staff_task + audit under immutable source',async()=>{
 const f=fixture();
 const done=await f.invoke('staff_handoff_task_materialize');
 assert.equal(done.body.ok,true);
 assert.equal(done.body.task_status,'NEW');
 assert.equal(done.body.task_id,technicalHandoffTaskId(ROOT));
 assert.equal(done.body.no_business_fact_mutation,true);
 assert.ok(f.statements.some(x=>x.query.startsWith('INSERT INTO portal_private.staff_tasks')));
 assert.ok(f.statements.some(x=>x.query.startsWith('INSERT INTO portal_private.ai_coordination_audit_events')));
 assert.equal(f.statements.filter(x=>/INSERT INTO portal_private.staff_tasks/.test(x.query)).length,1);
 assert.ok(!f.statements.some(x=>/INSERT INTO portal_private\.(deals|documents|payments|rail_wagons)\b/.test(x.query)));
 assert.equal(f.events.at(-1).result,'SUCCESS');
});
test('materialization denies DOCUMENT handoffs and stale versions, no task insert',async()=>{
 for(const x of [{source:source('DOCUMENT','RONA-DOC-2026-000019'),expected:'TECHNICAL_SOURCE_SCOPE_REQUIRED'},{newer:true,expected:'HANDOFF_VERSION_SUPERSEDED'}]){
  const f=fixture(x);
  const res=await f.invoke('staff_handoff_task_materialize');
  assert.equal(res.body.code,x.expected);
  assert.ok(!f.statements.some(s=>s.query.startsWith('INSERT INTO portal_private.staff_tasks')));
 }
});
test('canonical completed task proof REQUIRED before VERIFIED_RESOLVED',async()=>{
 const f=fixture();
 const res=await f.invoke('staff_handoff_status_submit',{...args,outcome:'VERIFIED_RESOLVED'});
 assert.equal(res.body.code,'CANONICAL_TASK_COMPLETION_PROOF_REQUIRED');
 assert.ok(!f.statements.some(s=>s.query.startsWith('INSERT INTO portal_private.ai_coordination_records')));
});
test('acknowledge appends version, supersedes source, writes audit, without editing history',async()=>{
 const f=fixture({outcome:'ACKNOWLEDGED'});
 const res=await f.invoke('staff_handoff_status_submit',{...args,outcome:'ACKNOWLEDGED'});
 assert.equal(res.body.ok,true);
 assert.equal(res.body.version,3);
 const statements=f.statements.map(x=>x.query);
 assert.ok(statements.some(x=>x.startsWith('INSERT INTO portal_private.ai_coordination_records')));
 assert.ok(statements.some(x=>x.startsWith('INSERT INTO portal_private.ai_coordination_audit_events')));
 assert.ok(statements.every(x=>!/^UPDATE |^DELETE |^DROP /i.test(x)));
});
test('invalid idempotency, missing evidence, unauthorized status fail before any SQL',async()=>{
 const bad=[{...args,evidence_refs:[]},{...args,idempotency_key:'x'}, {...args,record_id:'not-uuid'}, {...args,admin_role:'OPERATIONS_DIRECTOR'}];
 for(const v of bad){const f=fixture();const r=await f.invoke('staff_handoff_task_materialize',v);assert.equal(r.body.code,'INVALID_ARGUMENTS');assert.equal(f.statements.length,0);}
 const f=fixture();const r=await f.invoke('staff_handoff_status_submit',{...args,outcome:'COMPLETED'});assert.equal(r.body.code,'INVALID_ARGUMENTS');
});
test('runtime dispatcher registers both tools and keeps the existing coordination/role gates',()=>{
 const index=readFileSync(new URL('../supabase/functions/rona-mcp-gateway/index.ts',import.meta.url),'utf8');
 assert.ok(index.includes('SYSTEM_ADMIN_HANDOFF_WRITE_TOOLS'));
 assert.ok(index.includes('staff_handoff_task_materialize'));
 assert.ok(index.includes('staff_handoff_status_submit'));
 assert.ok(index.includes('primaryTechnicalCtx(ctx) && scopeHas(ctx.scope, "mcp:coordinate")'));
});
