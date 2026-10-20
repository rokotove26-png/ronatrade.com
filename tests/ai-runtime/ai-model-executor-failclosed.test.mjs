import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('supabase/functions/rona-ai-model-executor/index.ts','utf8');
test('production deployed v1.7.0 is baseline; current role topology, read token v2',()=>{
 assert.match(src,/const VERSION="1\.7\.0"/);
 assert.match(src,/rona_ai_executor_issue_read_token_v2/);
 assert.match(src,/\["OPERATIONS_DIRECTOR","FINANCE","LEGAL","COMMERCIAL_DIRECTOR","RAIL_LOGISTICS","SYSTEM_ADMIN"\]/);
 assert.doesNotMatch(src,/AUTONOMOUS_ROLES=new Set\([^\n]*"MARKET_ANALYST"/);
});
test('blocked gate before claim, model invocation and any action',()=>{
 const run=src.slice(src.indexOf('async function handleRun('),src.indexOf('Deno.serve('));
 assert.match(run,/if\(!health\?\.enabled\|\|health\?\.state!=="ENABLED"\|\|health\?\.runtime_model_execution_state!=="ENABLED"\)return send\(200,/);
 assert.ok(run.indexOf('EXECUTOR_NOT_ARMED')<run.indexOf('rona_ai_executor_claim_v2'));
 assert.match(run,/ROLE_NOT_AUTONOMOUS/);
 assert.match(run,/TECHNICAL_SOURCES/);
 assert.match(run,/rona_ai_executor_commit_system_action_v1/);
});
test('errors cannot echo raw credentials in server response or model run diagnostics',()=>{
 assert.match(src,/function safeErrorCode\(/);
 assert.match(src,/function safeErrorDetail\(/);
 assert.match(src,/AI_EXECUTOR_ERROR_REDACTED/);
 assert.match(src,/\[REDACTED\]/);
 assert.match(src,/p_error_code:code,p_error_text:safeErrorDetail\(error\)/);
 assert.match(src,/return send\(500,\{ok:false,code\}\)/);
 assert.doesNotMatch(src,/p_error_text:String\(error\?\.detail/);
 assert.doesNotMatch(src,/code:message\.slice\(0,160\)/);
});
test('no production unblocking or historical replay in patch',()=>{
 assert.doesNotMatch(src,/rona_ai_executor_arm/);
 assert.doesNotMatch(src,/state\s*=\s*["']ENABLED["']/);
 assert.match(src,/rona_ai_executor_claim_v2/);
 assert.match(src,/AUTONOMOUS_ROLES/);
 assert.match(src,/response_format:\{type:"json_schema"/);
});

test('credential fragments are redacted with real executed error sanitizer',async()=>{
 const vm=await import('node:vm');
 const start=src.indexOf('function safeErrorCode('),end=src.indexOf('function providerKey(');
 assert.ok(start>=0&&end>start);
 const fragment=src.slice(start,end)
  .replaceAll('error:unknown','error')
  .replaceAll('(error as any)','(error)');
 const {safeErrorCode,safeErrorDetail}=vm.runInNewContext(fragment+';({safeErrorCode,safeErrorDetail})',{}, {timeout:500});
 assert.equal(safeErrorCode({message:'Invalid_header_value__Bearer_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'}),'AI_EXECUTOR_ERROR_REDACTED');
 assert.equal(safeErrorDetail({detail:'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'}),'[REDACTED]');
 assert.equal(safeErrorCode({message:'RPC_RONA_AI_EXECUTOR_COMMIT_ACTION_FAILED'}),'RPC_RONA_AI_EXECUTOR_COMMIT_ACTION_FAILED');
 assert.equal(safeErrorCode({message:'GROQ_HTTP_429'}),'GROQ_HTTP_429');
 assert.equal(safeErrorCode({message:'RUN failed key abcd!'}),'AI_EXECUTOR_ERROR_REDACTED');
 assert.equal(safeErrorDetail({message:'CONTRACT\\nERROR'}),'CONTRACT ERROR');
});
