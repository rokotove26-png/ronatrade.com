import assert from 'node:assert/strict';
import {createSystemAdminDetails,SYSTEM_ADMIN_DETAIL_TOOLS} from '../../supabase/functions/rona-mcp-gateway/system-admin-details.mjs';
const ctx={role:'SYSTEM_ADMIN',identity_id:'AI-SYSTEM-ADMIN',server_slug:'rona-mcp-system-admin',scope:'mcp:read'};
let calls=0;
const tables=['admin_impersonation_sessions','admin_impersonation_events','admin_entity_retirement_operations','admin_auth_cleanup_outbox'];
const cp={state_version:96,open_delta:[{scope:'STAGE2B',status:'HOLD'},{scope:'PR836',status:'HOLD'},{scope:'PRIVATE_RLS',status:'4_TABLES_REVIEW'}]};
const sql=async(strings,...args)=>{calls++;const q=strings.join('?');assert.ok(q.trim().startsWith('select'));if(q.includes('ai_role_state_checkpoints'))return [cp];if(q.includes('ai_coordination_records'))return args.includes('PRIVATE_RLS')?[{record_id:'source',record_type:'HANDOFF_REQUEST',target_id:'INFRASTRUCTURE',payload:{requested_check:tables.join(' ')+'; prove smoke/regression'},source_refs:[]}]:[];if(q.includes('pg_class'))return tables.map(table_name=>({table_name,rls_enabled:true,force_rls:false,direct_grants:[],policies:[]}));throw Error(q);};
const run=createSystemAdminDetails({sql,isAdmin:c=>c.role==='SYSTEM_ADMIN'&&c.identity_id==='AI-SYSTEM-ADMIN'&&['rona-mcp-system-admin','rona-mcp-system-admin-pilot'].includes(c.server_slug),scopeHas:(s,v)=>s.split(' ').includes(v),requestIds:()=>({correlationId:'test'}),rateAllowed:async()=>true,recordMcpEvent:async()=>{},rpcToolResponse:(id,payload)=>payload,fetchImpl:async()=>({ok:true,json:async()=>({number:836,state:'open',draft:true,body:'Draft until full CI and visual freeze are proven.',assignees:[],user:{login:'author'}})})});
const msg=(name,id,extra={})=>({id:1,params:{name,arguments:{object_id:id,...extra}}});
let r=await run(ctx,{},msg('object_detail','STAGE2B'));assert.equal(r.data.status,'HOLD');assert.equal(r.data.gate,null);assert.equal(r.data.detail_completeness,'PARTIAL_SOURCE');assert.equal(r.data.owner,null);
r=await run(ctx,{},msg('pr_detail','PR836'));assert.match(r.data.gate,/full CI/);assert.equal(r.data.status,'HOLD');assert.equal(r.data.owner,null);
r=await run(ctx,{},msg('review_detail','PRIVATE_RLS'));assert.equal(r.data.tables.length,4);assert.ok(r.data.tables.every(t=>t.review_status==='SMOKE_REGRESSION_EVIDENCE_REQUIRED'));assert.equal(r.data.review_status,'4_TABLES_REVIEW');
for(const bad of [{...ctx,role:'FINANCE'},{...ctx,identity_id:'OTHER'},{...ctx,scope:'mcp:coordinate'}]){const before=calls;r=await run(bad,{},msg('object_detail','STAGE2B'));assert.equal(r.ok,false);assert.equal(calls,before);}
r=await run(ctx,{},msg('object_detail','STAGE2B',{role:'FINANCE'}));assert.equal(r.code,'INVALID_ARGUMENTS');
r=await run(ctx,{},msg('object_detail','SECRET'));assert.equal(r.code,'OBJECT_NOT_IN_ROLE_OPEN_DELTA');
r=await run({...ctx,server_slug:'rona-mcp-system-admin-pilot'},{},msg('object_detail','STAGE2B'));assert.equal(r.ok,true);
assert.ok(SYSTEM_ADMIN_DETAIL_TOOLS.every(t=>t.annotations.readOnlyHint&&t.securitySchemes[0].scopes[0]==='mcp:read'));
console.log('PASS: both admin slugs, read scope, role/identity denial, injection denial, object visibility, PR source, review source, unchanged HOLD and missing-field handling');
