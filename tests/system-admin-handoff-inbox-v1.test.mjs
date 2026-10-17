import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM_ADMIN_DETAIL_TOOLS,createSystemAdminDetails} from '../supabase/functions/rona-mcp-gateway/system-admin-details.mjs';

const tool=SYSTEM_ADMIN_DETAIL_TOOLS.find(x=>x.name==='staff_handoff_inbox_list');
assert.ok(tool,'system admin inbox is registered as an explicit MCP tool');

function harness(){
  const queries=[],events=[];
  const sql=async (strings,...args)=>{
    const q=strings.join('$').replace(/\s+/g,' ').trim();
    queries.push({sql:q,args});
    if(/select count\(\*\)::int as n from portal_private.ai_coordination_records/.test(q))return[{n:122}];
    if(/select r.record_id,r.parent_record_id/.test(q))return[{
      record_id:'a43429c7-76bc-42ec-9029-5a60e1015a2e',from_role:'ASSISTANT',
      target_type:'DOCUMENT',target_id:'RONA-DOC-2026-000021',status:'REQUESTED',
      subject:'Source discrepancy',created_at:'2026-10-14T12:44:14Z'
    }];
    throw Error('Unexpected SQL query');
  };
  const fn=createSystemAdminDetails({
    sql,isAdmin:c=>c.role==='SYSTEM_ADMIN'&&c.identity_id==='AI-SYSTEM-ADMIN',
    scopeHas:(scope,name)=>scope.split(' ').includes(name),
    requestIds:()=>({correlationId:'corr',mcpRequestId:'mcp'}),
    rateAllowed:async()=>true,
    recordMcpEvent:async(_,__,name,result,___,data)=>events.push({name,result,data}),
    rpcToolResponse:(id,payload,isError=false)=>({id,payload,isError})
  });
  const ctx={role:'SYSTEM_ADMIN',identity_id:'AI-SYSTEM-ADMIN',scope:'mcp:read'};
  const invoke=(args={},context=ctx)=>fn(context,{}, {id:'1',params:{name:'staff_handoff_inbox_list',arguments:args}});
  return {invoke,queries,events};
}

test('scope: only SYSTEM_ADMIN with exact identity + mcp:read gets inbox',async()=>{
  const h=harness();
  const denied=await h.invoke({}, {role:'FINANCE',identity_id:'AI-FINANCE',scope:'mcp:read'});
  assert.equal(denied.payload.code,'SYSTEM_ADMIN_READ_REQUIRED');
  assert.equal(denied.isError,true);
  const absent=await h.invoke({}, {role:'SYSTEM_ADMIN',identity_id:'AI-SYSTEM-ADMIN',scope:''});
  assert.equal(absent.payload.code,'SYSTEM_ADMIN_READ_REQUIRED');
  assert.equal(h.queries.length,0);
});
test('reads complete count even though current_state is limited to 20 records',async()=>{
  const h=harness();
  const r=await h.invoke({status:'REQUESTED',limit:25,offset:25});
  assert.equal(r.isError,false);
  assert.equal(r.payload.total,122);
  assert.equal(r.payload.offset,25);
  assert.equal(r.payload.has_more,true);
  assert.equal(r.payload.records.length,1);
  assert.equal(r.payload.records[0].target_type,'DOCUMENT');
  assert.equal(h.queries.length,2);
  assert.ok(h.queries.every(x=>/r.target_role='SYSTEM_ADMIN'/.test(x.sql)));
  assert.ok(h.queries.every(x=>/newer.supersedes_id=r.record_id/.test(x.sql)));
  assert.ok(h.queries.every(x=>/r.qa_only=false/.test(x.sql)));
  assert.ok(h.queries.every(x=>!/INSERT|UPDATE|DELETE/i.test(x.sql)));
});
test('invalid filters fail closed before any SQL',async()=>{
  for(const bad of [{limit:51},{offset:-1},{status:'HACK'},{role:'FINANCE'},[]]){
    const h=harness();
    const r=await h.invoke(bad);
    assert.equal(r.isError,true);
    assert.equal(r.payload.code,'INVALID_ARGUMENTS');
    assert.equal(h.queries.length,0);
  }
});
test('MCP declaration is strictly read-only and no production write contract is added',()=>{
  assert.equal(tool.annotations.readOnlyHint,true);
  assert.equal(tool.annotations.destructiveHint,false);
  assert.deepEqual(tool.securitySchemes[0].scopes,['mcp:read']);
  assert.equal(SYSTEM_ADMIN_DETAIL_TOOLS.filter(t=>t.name==='staff_handoff_inbox_list').length,1);
});
