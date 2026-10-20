// Reconstruct exact Supabase Edge deployment v14 (2026-10-20) from canonical PR #1264 source.
// Does not touch Supabase, files, queues, secrets, or production unless output is intentionally redirected.
import fs from 'node:fs';
import assert from 'node:assert/strict';
let src=fs.readFileSync('supabase/functions/rona-ai-model-executor/index.ts','utf8');
const replacements=[["429 breaker","await recordFailure(queue,workerId,error,retryable);if(status===429){try{await rpc(\"rona_ai_executor_disarm\",{p_reason:\"GROQ_HTTP_429_RATE_LIMIT_HOLD\"})}catch{}}results.push({queueId:queue.queue_id,ok:false,code:safeErrorCode(error),retryable});if(status===429)break","await recordFailure(queue,workerId,error,retryable);results.push({queueId:queue.queue_id,ok:false,code:message.slice(0,160),retryable})"],["record failure","const code=safeErrorCode(error);try{return await rpc(\"rona_ai_executor_fail\",{p_queue_id:queue.queue_id,p_worker_id:workerId,p_error_code:code,p_error_text:safeErrorDetail(error)","const code=String(error?.code||error?.message||\"AI_EXECUTOR_ERROR\").replace(/[^A-Z0-9_]/gi,\"_\").slice(0,160);try{return await rpc(\"rona_ai_executor_fail\",{p_queue_id:queue.queue_id,p_worker_id:workerId,p_error_code:code,p_error_text:String(error?.detail||error?.message||\"\").slice(0,1000)"],["probe","const status=Number((error as any)?.status||0),code=status>=400&&status<=599?`GROQ_HTTP_${status}`:safeErrorCode(error);await rpc","const status=Number((error as any)?.status||0),code=String(status?`GROQ_HTTP_${status}`:(error as any)?.message||\"MODEL_PROBE_FAILED\").replace(/[^A-Z0-9_]/gi,\"_\").slice(0,160);await rpc"],["technical","code:safeErrorCode(error),technical:true","code:String((error as any)?.message||\"TECHNICAL_SETTLEMENT_FAILED\"),technical:true"],["top","const code=safeErrorCode(error);return send(500,{ok:false,code})","const code=String((error as any)?.message||\"AI_EXECUTOR_INTERNAL_ERROR\").replace(/[^A-Z0-9_]/gi,\"_\").slice(0,160);return send(500,{ok:false,code})"]];
for(const [name,from,to] of replacements){assert.equal(src.split(from).length-1,1,'Rollback context mismatch: '+name);src=src.replace(from,to)}
const start=src.indexOf('function safeErrorCode('),end=src.indexOf('function providerKey(');
assert.ok(start>=0&&end>start,'Rollback safety helper location mismatch');
src=src.slice(0,start)+src.slice(end);
src=src.trimEnd()+'\n';
const fnv=(v)=>{let h=0xcbf29ce484222325n;for(const ch of v)h=((h^BigInt(ch.codePointAt(0)))*0x100000001b3n)&0xffffffffffffffffn;return h.toString(16).padStart(16,'0')};
assert.equal(src.length,31731,'Baseline length mismatch');
assert.equal(fnv(src),'69f8cf91102ea31f','Baseline fingerprint mismatch');
if(process.argv.includes('--verify-only')){process.stderr.write('V14_ROLLBACK_VERIFIED\n')}else{process.stdout.write(src)}
