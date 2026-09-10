import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const EXPECTED_ARCHITECTURE='CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS';
const EXPECTED_SOURCE_SHA='d07d7cbee5fd3466c8729861a6e6a6acb4ba463ad6d89dd7f748209cacab6183';
const candidates=[
  {name:'ronatrade.com',origin:'https://ronatrade.com'},
  {name:'ronaoil.com',origin:'https://ronaoil.com'}
];

function bodyClass(body,contentType){
  const text=String(body||'').trim();
  try{
    const parsed=JSON.parse(text);
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return 'JSON_OBJECT';
    return 'JSON_OTHER';
  }catch(_){ }
  if(/<br\s*\/?\s*>\s*<b\b|\b(?:PHP|Fatal error|Warning|Notice)\b/i.test(text))return 'PHP_HTML';
  if(String(contentType||'').toLowerCase().includes('text/html')||/^<!doctype\s+html|^<html\b|^</i.test(text))return 'HTML';
  return text?'TEXT':'EMPTY';
}

async function probe({name,origin}){
  const url=`${origin}/canonical-visual-integrity.json?_issue444=${Date.now()}-${encodeURIComponent(name)}`;
  const response=await fetch(url,{cache:'no-store',redirect:'manual',headers:{accept:'application/json','cache-control':'no-cache'}});
  const body=await response.text();
  const contentType=String(response.headers.get('content-type')||'');
  let parsed=null;
  try{parsed=JSON.parse(body)}catch(_){ }
  return {
    name,origin,status:response.status,contentType,bodyClass:bodyClass(body,contentType),
    bodyBytes:Buffer.byteLength(body),location:String(response.headers.get('location')||''),
    server:String(response.headers.get('server')||''),cfRay:String(response.headers.get('cf-ray')||''),
    architecture:parsed?.architecture||null,clientState:parsed?.client_runtime?.state||null,
    sourceSha256:parsed?.client_runtime?.source_sha256||null
  };
}

const results=[];
for(const candidate of candidates)results.push(await probe(candidate));
for(const result of results)console.log('ISSUE444_HTTP_EVIDENCE',JSON.stringify(result));

const legacy=results.find(x=>x.name==='ronatrade.com');
const authoritative=results.find(x=>x.name==='ronaoil.com');
assert.ok(legacy&&authoritative,'both candidate origins must be probed');
assert.equal(authoritative.status,200,`ronaoil.com integrity status ${authoritative.status}`);
assert.match(authoritative.contentType,/application\/json/i,`ronaoil.com content-type ${authoritative.contentType}`);
assert.equal(authoritative.bodyClass,'JSON_OBJECT',`ronaoil.com body class ${authoritative.bodyClass}`);
assert.equal(authoritative.architecture,EXPECTED_ARCHITECTURE,`ronaoil.com architecture ${authoritative.architecture}`);
assert.equal(authoritative.clientState,'CURRENT_ONLY',`ronaoil.com client state ${authoritative.clientState}`);
assert.equal(authoritative.sourceSha256,EXPECTED_SOURCE_SHA,`ronaoil.com source SHA ${authoritative.sourceSha256}`);

const verifier=await readFile('scripts/verify-client-contract-v5-production.mjs','utf8');
const gate=await readFile('.github/workflows/final-production-activation-synchronized-v2.yml','utf8');
const g82=await readFile('.github/workflows/g82-real-browser-qa.yml','utf8');
assert.ok(verifier.includes("TARGET_ORIGIN||'https://ronaoil.com'"),'verifier default must use authoritative production origin');
assert.ok(verifier.includes("contentType.includes('application/json')"),'integrity response must fail closed on non-JSON content type');
assert.ok(verifier.includes(EXPECTED_SOURCE_SHA),'existing Client source SHA assertion must remain');
assert.ok(verifier.includes("client.source_bytes===484970"),'existing Client source byte assertion must remain');
assert.ok(verifier.includes("client.legacy_runtime_in_deployment===false"),'existing CURRENT_ONLY legacy-runtime assertion must remain');
assert.ok(verifier.includes("client.functional_bridge?.id==='rona-client-contract-authoritative-projection-v5'"),'existing bridge assertion must remain');
assert.match(gate,/Verify Client v11 contract projection in production[\s\S]*?TARGET_ORIGIN:\s*https:\/\/ronaoil\.com/,'final production verifier step must use ronaoil.com');
assert.match(g82,/github\.ref_name == 'release\/public-go-live-v1\.1' && 'https:\/\/ronaoil\.com'/,'existing release browser authority must agree on ronaoil.com');

console.log('PRODUCTION_GATE_ORIGIN_QA=PASS',JSON.stringify({authoritative:'https://ronaoil.com',candidate:'https://ronatrade.com',candidateHttp:{status:legacy.status,contentType:legacy.contentType,bodyClass:legacy.bodyClass,server:legacy.server},authoritativeHttp:{status:authoritative.status,contentType:authoritative.contentType,bodyClass:authoritative.bodyClass,server:authoritative.server},failClosedIntegrityAssertions:'PRESERVED_AND_CONTENT_TYPE_STRENGTHENED'}));
