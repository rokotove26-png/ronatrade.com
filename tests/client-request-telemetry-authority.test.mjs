import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [shared,telemetry,index]=await Promise.all([
  readFile('supabase/functions/rona-portal-api/shared.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/request-telemetry-v1.ts','utf8'),
  readFile('supabase/functions/rona-portal-api/index.ts','utf8')
]);

test('existing append-only API event writer is reused',()=>{
  assert.match(shared,/export async function recordApiEvent/);
  assert.match(shared,/insert into portal_private\.portal_api_request_events/);
  assert.match(shared,/request_id,auth_user_id,portal_user_id,method,route,result,http_status,correlation_id,user_agent,metadata/);
});

test('telemetry contract contains operational diagnostics without secrets',()=>{
  for(const marker of [
    'PORTAL_API_REQUEST_TELEMETRY_V1',
    'caller_runtime',
    'refresh_reason',
    'client_id',
    'contract_id',
    'transport',
    'NETWORK',
    'request_cache',
    'latency_ms',
    'EdgeRuntime',
    'waitUntil'
  ]) assert.match(telemetry,new RegExp(marker));
  assert.doesNotMatch(telemetry,/authorization/i);
  assert.doesNotMatch(telemetry,/cookie/i);
  assert.doesNotMatch(telemetry,/source_ip/i);
  assert.doesNotMatch(telemetry,/SUPABASE_(?:SERVICE_ROLE|SECRET|ANON|PUBLISHABLE)/i);
});

test('status mapping stays within portal_api_request_events constraints',()=>{
  for(const result of ['SUCCESS','DENIED','NOT_FOUND','INVALID_REQUEST','FAILURE']){
    assert.match(telemetry,new RegExp('["\']'+result+'["\']'));
  }
  assert.match(telemetry,/status>=200&&status<300/);
  assert.match(telemetry,/status===401\|\|status===403/);
  assert.match(telemetry,/status===404/);
});

test('refresh reason is explicit-or-derived and defaults safely',()=>{
  assert.match(telemetry,/x-rona-client-refresh-reason/);
  assert.match(telemetry,/x-rona-client-source/);
  for(const reason of [
    'CONTEXT_CHANGE','INVALIDATION','PAGE_SHOW','RECONNECT',
    'POST_MUTATION','SECTION_OPEN','INITIAL_OR_BOOTSTRAP',
    'DIRECTORY_REFRESH','REQUEST'
  ]) assert.match(telemetry,new RegExp(reason));
});

test('canonical Edge responses are instrumented after authentication',()=>{
  assert.match(index,/import \{ portalApiReply \} from "\.\/request-telemetry-v1\.ts";/);
  assert.match(index,/startedAt=performance\.now\(\)/);
  const marker='const reply=portalApiReply(req,route,origin,c,startedAt);';
  const pos=index.indexOf(marker);
  assert.ok(pos>0,'telemetry reply factory missing');
  const postAuth=index.slice(pos+marker.length);
  assert.doesNotMatch(postAuth,/send\(origin,/);
  assert.match(postAuth,/reply\(/);
});

test('telemetry helper is response-only and delegates persistence to existing writer',()=>{
  assert.match(telemetry,/recordApiEvent\(/);
  assert.match(telemetry,/return send\(origin,status,body\)/);
  assert.doesNotMatch(telemetry,/\b(?:insert|update|delete|alter|drop|truncate)\s+/i);
});
