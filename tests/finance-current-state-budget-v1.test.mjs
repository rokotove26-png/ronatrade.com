import test from 'node:test';
import assert from 'node:assert/strict';
import { compactEnvelope } from '../supabase/functions/rona-mcp-gateway/state-projection.mjs';
const ctx={role:'FINANCE',identity_id:'AI-FINANCE',scope:'mcp:read mcp:coordinate',server_slug:'rona-mcp-finance-pilot'};
const registry={source_of_truth:'GATEWAY_ROLE_REGISTRY',registered:{names:['current_state','history']},enabled:{names:['current_state','history']},authorized:{names:['current_state','history']},client_visible:{status:'UNKNOWN',reference_names:Array.from({length:28},(_,i)=>'finance_tool_'+i)}};
const envelope={jsonrpc:'2.0',id:9,result:{content:[{type:'text',text:'PRE_STATE'}]}};
const task=(i)=>({task_id:'TASK-FIN-'+i,title:'Finance settlement review '+i,status:'IN_PROGRESS',priority:'HIGH',assigned_functional_role:'FINANCE',description:'DETAIL_ONLY__'.repeat(350),source_refs:Array.from({length:8},(_,x)=>'source_'+i+'_'+x),updated_at:'2026-10-17T20:00:00Z'});
const data={
 functional_role:'FINANCE',generated_at:'2026-10-17T20:00:00Z',
 identity_profile:{identity_id:'AI-FINANCE'},checkpoint:{state_version:22427},
 competence_contract:{canonical_role:'FINANCE',owned_domains:['FINANCE']},
 active_tasks:Array.from({length:10},(_,i)=>task(i)),
 state_conflicts:[],routing_capabilities:{canonical_roles:['FINANCE','SYSTEM_ADMIN']},
 coordination:{records:Array.from({length:20},(_,i)=>({record_id:'record-'+i,record_type:'HANDOFF_REQUEST',status:'REQUESTED'}))},
 execution_recovery:{execution_resume:{workstreams:Array.from({length:10},(_,i)=>({workstream_id:'W'+i,title:'one'.repeat(200),status:'ACTIVE',updated_at:'2026-10-17T20:00:00Z'}))}},
 global_role_policies:Array.from({length:6},(_,i)=>({policy_id:'RONA_FINANCE_'+i,policy_key:'FINANCE_POLICY_'+i,version:1,scope:'GLOBAL'})),
 bootstrap:{procedure:['VERIFY_RUNTIME_IDENTITY']}
};
function wrap(currentData=data,currentCtx=ctx,currentRegistry=registry){
 return compactEnvelope(structuredClone(envelope),{ok:true,role:currentCtx.role,identity_id:currentCtx.identity_id,data:structuredClone(currentData)},currentCtx,structuredClone(currentRegistry));
}
test('finance oversized 10-task snapshot remains successful and under 24KB envelope',()=>{
 const res=wrap();
 assert.equal(res.result.isError,undefined);
 assert.ok(Buffer.byteLength(JSON.stringify(res),'utf8')<=24000);
 const p=JSON.parse(res.result.content[0].text);
 assert.equal(p.ok,true);
 assert.equal(p.data.functional_role,'FINANCE');
 assert.equal(p.data.identity_profile.identity_id,'AI-FINANCE');
 assert.equal(p.data.checkpoint.state_version,22427);
 assert.equal(p.data.active_tasks_projection.mode,'SUMMARY');
 assert.equal(p.data.active_tasks_projection.source_task_count,10);
 assert.equal(p.data.active_tasks.length,10);
 assert.equal(p.data.global_role_policies.length,6);
 assert.deepEqual(p.data.tool_registry.enabled.names,['current_state','history']);
 assert.equal(p.data.bootstrap.result.next.tool,'history');
});
test('small role projection keeps original active_tasks unmodified',()=>{
 const small=structuredClone(data);small.active_tasks=[{task_id:'ONE',status:'NEW',description:'important'}];
 const res=wrap(small);
 const p=JSON.parse(res.result.content[0].text);
 assert.equal(p.data.active_tasks[0].description,'important');
 assert.equal(p.data.active_tasks_projection,undefined);
});
test('wrong finance identity fails closed',()=>{
 const res=compactEnvelope(envelope,{ok:true,role:'FINANCE',identity_id:'NOT_AI_FINANCE',data},ctx,registry);
 const p=JSON.parse(res.result.content[0].text);
 assert.equal(p.code,'RUNTIME_IDENTITY_MISMATCH');
});
test('irreducible oversized security critical registry fails closed rather than hide authorized tools',()=>{
 const bloated=structuredClone(registry);
 bloated.enabled.names=Array.from({length:500},(_,i)=>'extremely_long_authorized_tool_name_'+i);
 bloated.authorized.names=[...bloated.enabled.names];
 bloated.registered.names=[...bloated.enabled.names];
 const res=wrap(data,ctx,bloated);
 const p=JSON.parse(res.result.content[0].text);
 assert.equal(p.code,'CURRENT_STATE_BUDGET_EXCEEDED');
});
