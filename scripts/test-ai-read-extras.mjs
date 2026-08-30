import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const edge=await fs.readFile(new URL('../supabase/functions/rona-ai-read-extras/index.js',import.meta.url),'utf8');
const marketPath=new URL('../functions/portal/api/v1/ai/market-data.js',import.meta.url);
const docPath=new URL('../functions/portal/api/v1/ai/documents/[[path]].js',import.meta.url);
const market=await fs.readFile(marketPath,'utf8'),docs=await fs.readFile(docPath,'utf8');

assert(edge.includes("!['MARKET_ANALYST','COMMERCIAL_DIRECTOR'].includes(auth.role)"));
assert(edge.includes('AI_MARKET_SCOPE_DENIED'));
assert(edge.includes('distinct on (source_object_type,source_object_id)'));
assert(edge.includes('LATEST_PER_TYPE_AND_SOURCE_OBJECT_ID'));
assert(edge.includes('AI_DOCUMENT_SCOPE_DENIED'));
assert(edge.includes("role==='OPERATIONS_DIRECTOR'||role==='LEGAL'"));
assert(edge.includes("role==='FINANCE'"));
assert(edge.includes("role==='RAIL_LOGISTICS'"));
assert(edge.includes('createSignedUrl'));
assert(edge.includes('expiresIn=120'));
assert(edge.includes("x.status!=='ACTIVE'||x.revoked_at"));
assert(edge.includes('Number(x.credential_version)!==Number(payload.ver)'));
assert(!edge.includes("OWNER_ADMIN','"));
const normalized=edge.toLowerCase();
const inserts=[...normalized.matchAll(/insert\s+into\s+portal_private\.([a-z0-9_]+)/g)].map(m=>m[1]);
assert.deepEqual([...new Set(inserts)],['ai_read_access_events']);
assert(!/update\s+portal_private\./i.test(edge));
assert(!/delete\s+from\s+portal_private\./i.test(edge));
assert(!/RONA_AI_TOKEN_SIGNING_KEY\s*=\s*['\"][^'\"]+['\"]/i.test(edge));
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['\"][^'\"]+['\"]/i.test(edge));

const originalFetch=globalThis.fetch,calls=[];
globalThis.fetch=async(url,opts)=>{calls.push({url:String(url),opts});return new Response('{"ok":true}',{status:200,headers:{'content-type':'application/json'}})};
try{
  const marketModule=await import(pathToFileURL(marketPath.pathname).href+`?t=${Date.now()}`);
  let r=await marketModule.onRequest({request:new Request('https://ronaoil.com/portal/api/v1/ai/market-data',{method:'POST'}),env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(r.status,405);assert.equal(calls.length,0);
  r=await marketModule.onRequest({request:new Request('https://ronaoil.com/portal/api/v1/ai/market-data',{headers:{authorization:'Bearer x',cookie:'never=forward'}}),env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(r.status,200);assert.equal(calls.length,1);assert(calls[0].url.endsWith('/functions/v1/rona-ai-read-extras/market-data'));assert.equal(calls[0].opts.headers.get('cookie'),null);

  const docModule=await import(pathToFileURL(docPath.pathname).href+`?t=${Date.now()}`);
  r=await docModule.onRequest({request:new Request('https://ronaoil.com/portal/api/v1/ai/documents/DOC-2026-001/signed-url',{method:'PATCH'}),env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(r.status,405);assert.equal(calls.length,1);
  r=await docModule.onRequest({request:new Request('https://ronaoil.com/portal/api/v1/ai/documents/DOC-2026-001/signed-url',{headers:{authorization:'Bearer x',cookie:'never=forward'}}),env:{SUPABASE_URL:'https://example.supabase.co'}});
  assert.equal(r.status,200);assert.equal(calls.length,2);assert(calls[1].url.endsWith('/functions/v1/rona-ai-read-extras/documents/DOC-2026-001/signed-url'));assert.equal(calls[1].opts.headers.get('cookie'),null);
} finally {globalThis.fetch=originalFetch}

assert(market.includes("req.method!=='GET'"));
assert(docs.includes("req.method!=='GET'"));
console.log('AI_READ_EXTRAS_TESTS=PASS');
console.log('AI_MARKET_RAW_READ=PASS');
console.log('AI_DOCUMENT_CONTENT_READ=PASS');
console.log('AI_EXTRAS_BUSINESS_WRITES=0');
