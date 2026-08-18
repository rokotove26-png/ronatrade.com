import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  AI_ROLES, ROLE_DOMAINS, BUSINESS_WRITE_PATHS,
  roleAllowsDomain, roleAllowsHistory, sha256Hex, signAiToken, timingSafeHex, verifyAiToken,
} from '../supabase/functions/rona-ai-read-only/core.js';

const edgePath=new URL('../supabase/functions/rona-ai-read-only/index.js',import.meta.url);
const proxyPath=new URL('../functions/portal/api/v1/ai/[[path]].js',import.meta.url);
const migrationPath=new URL('../db/migrations/20260818_ai_read_only_contour.sql',import.meta.url);
const edge=await fs.readFile(edgePath,'utf8');
const proxy=await fs.readFile(proxyPath,'utf8');
const migration=await fs.readFile(migrationPath,'utf8');

assert.deepEqual(AI_ROLES,[
  'OPERATIONS_DIRECTOR','FINANCE','LEGAL','MARKET_ANALYST','RAIL_LOGISTICS','SYSTEM_ADMIN'
]);
assert(!AI_ROLES.includes('OWNER_ADMIN'));
for(const role of AI_ROLES) assert(ROLE_DOMAINS[role]?.length>0,`${role} domains`);
for(const d of ['COMMERCIAL','VED','QUALITY','PUBLICATION']) assert(roleAllowsDomain('OPERATIONS_DIRECTOR',d));
for(const d of ['PAYMENT','ACCOUNTING','FINANCIAL_CONTROL']) assert(roleAllowsDomain('FINANCE',d));
assert(roleAllowsDomain('MARKET_ANALYST','PUBLICATION'));
assert(roleAllowsDomain('SYSTEM_ADMIN','IAM'));
assert(!roleAllowsDomain('SYSTEM_ADMIN','RESOURCE'));
assert(!roleAllowsDomain('FINANCE','IAM'));
assert(roleAllowsHistory('OPERATIONS_DIRECTOR','publications'));
assert(!roleAllowsHistory('FINANCE','publications'));

const key='k'.repeat(64);
const now=2_000_000_000;
const signed=await signAiToken({
  signingKey:key,identityId:'AI-FINANCE',role:'FINANCE',credentialVersion:7,ttlSeconds:300,nowSeconds:now,
  jti:'11111111-1111-4111-8111-111111111111',
});
assert.equal(signed.payload.scope,'READ_ONLY');
assert.equal(signed.payload.actor_type,'AI');
assert.equal(signed.payload.exp-signed.payload.iat,300);
assert.equal((await verifyAiToken(signed.token,key,now+1)).ok,true);
assert.equal((await verifyAiToken(signed.token,key,now+301)).code,'AI_TOKEN_EXPIRED');
assert.equal((await verifyAiToken(signed.token,'z'.repeat(64),now+1)).ok,false);

const [h,p,s]=signed.token.split('.');
const payload=JSON.parse(Buffer.from(p.replaceAll('-','+').replaceAll('_','/'),'base64').toString('utf8'));
payload.role='SYSTEM_ADMIN';
const tamperedPayload=Buffer.from(JSON.stringify(payload)).toString('base64url');
assert.equal((await verifyAiToken(`${h}.${tamperedPayload}.${s}`,key,now+1)).ok,false);

const digest=await sha256Hex('pepper:bootstrap-secret-value');
assert.equal(digest.length,64);
assert(timingSafeHex(digest,digest));
assert(!timingSafeHex(digest,'0'.repeat(64)));

assert(BUSINESS_WRITE_PATHS.length>=10);
assert(!/OWNER_ADMIN[^\n]*ai_business_role_enum/i.test(migration));
assert(migration.includes("'AI-OPERATIONS-DIRECTOR','OPERATIONS_DIRECTOR'"));
assert((migration.match(/'SUSPENDED',null/g)||[]).length===6,'six disabled identity seeds');
assert(!/bootstrap_secret_hash\s*\)\s*values[\s\S]*'[0-9a-f]{64}'/i.test(migration),'no credential hashes seeded');
assert(!/RONA_AI_TOKEN_SIGNING_KEY\s*=\s*['\"][^'\"]+['\"]/i.test(edge),'no signing key literal');
assert(!/RONA_AI_BOOTSTRAP_PEPPER\s*=\s*['\"][^'\"]+['\"]/i.test(edge),'no bootstrap pepper literal');

const normalized=edge.toLowerCase();
const inserts=[...normalized.matchAll(/insert\s+into\s+portal_private\.([a-z0-9_]+)/g)].map(m=>m[1]);
assert.deepEqual([...new Set(inserts)],['ai_read_access_events'],'edge may only append AI read audit rows');
assert(!/update\s+portal_private\./i.test(edge),'no business UPDATE in AI edge');
assert(!/delete\s+from\s+portal_private\./i.test(edge),'no business DELETE in AI edge');
assert(edge.includes("history_included:false"));
assert(edge.includes("qa_test_debug_temp_excluded:true"));
assert(edge.includes("superseded_archived_excluded:true"));
assert(edge.includes('competing_references'));
assert(edge.includes('verification_state'));
assert(edge.includes('open_control_task_ids'));
assert(edge.includes('conflict'));

assert(proxy.includes("['/current-state',new Set(['GET'])]"));
assert(proxy.includes("['/history',new Set(['GET'])]"));
assert(proxy.includes("['/token',new Set(['POST'])]"));
assert(proxy.includes('AI_READ_ONLY_METHOD_DENIED'));

const proxyModule=await import(pathToFileURL(proxyPath.pathname).href+`?t=${Date.now()}`);
const originalFetch=globalThis.fetch;
const fetchCalls=[];
globalThis.fetch=async (url,opts)=>{
  fetchCalls.push({url:String(url),opts});
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
};
try{
  const denied=await proxyModule.onRequest({request:new Request('https://ronaoil.com/portal/api/v1/ai/current-state',{method:'POST'}),env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(denied.status,405);
  assert.equal(fetchCalls.length,0);

  const unknown=await proxyModule.onRequest({request:new Request('https://ronaoil.com/portal/api/v1/ai/anything',{method:'GET'}),env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(unknown.status,404);
  assert.equal(fetchCalls.length,0);

  const readReq=new Request('https://ronaoil.com/portal/api/v1/ai/current-state?x=1',{headers:{authorization:'Bearer test-token','x-request-id':'11111111-1111-4111-8111-111111111111','cookie':'should-not-forward=1'}});
  const read=await proxyModule.onRequest({request:readReq,env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(read.status,200);
  assert.equal(fetchCalls.length,1);
  assert(fetchCalls[0].url.endsWith('/functions/v1/rona-ai-read-only/current-state?x=1'));
  assert.equal(fetchCalls[0].opts.headers.get('authorization'),'Bearer test-token');
  assert.equal(fetchCalls[0].opts.headers.get('cookie'),null);

  const tokenReq=new Request('https://ronaoil.com/portal/api/v1/ai/token',{method:'POST',headers:{'x-rona-ai-identity-id':'AI-FINANCE','x-rona-ai-bootstrap-key':'b'.repeat(40)},body:'{}'});
  const tokenResp=await proxyModule.onRequest({request:tokenReq,env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(tokenResp.status,200);
  assert.equal(fetchCalls.length,2);
  assert.equal(fetchCalls[1].opts.headers.get('x-rona-ai-identity-id'),'AI-FINANCE');
  assert.equal(fetchCalls[1].opts.headers.get('x-rona-ai-bootstrap-key'),'b'.repeat(40));
} finally { globalThis.fetch=originalFetch; }

console.log('AI_READ_ONLY_CORE_TESTS=PASS');
console.log('AI_ROLE_COUNT='+AI_ROLES.length);
console.log('AI_BUSINESS_WRITES_IN_EDGE=0');
console.log('OWNER_ADMIN_IN_AI_ENUM=0');
console.log('CREDENTIAL_LITERALS=0');
