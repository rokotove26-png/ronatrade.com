import { readFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { strict as assert } from 'node:assert';

const read = path => readFile(path, 'utf8');
const runtimePath = 'assets/portal-runtime/client-contract-download-v3.js';
const runtime = await read(runtimePath);
const clientApi = await read('supabase/functions/rona-portal-api/client.ts');
const phase5d = await read('supabase/functions/rona-portal-api/phase5d.ts');
const router = await read('supabase/functions/rona-portal-api/index.ts');
const builtRuntime = await read('dist/assets/portal-runtime/client-contract-download-v3.js');
const builtClient = await read('dist/portal/client.html');

const requiredRuntime = [
  '20260829-client-contract-v3-authoritative-projection-v4',
  "/v1/client/bootstrap",
  "/v1/client/context?clientId=",
  'current_external_contract_number',
  'legal_name',
  'function authoritativeContractText',
  "ronaContractNumberSynced='authoritative'",
  "ronaCompanyNameSynced='authoritative'",
  'canonicals=words.filter',
  "action.textContent='Переключиться'",
  "control.setAttribute('role','status')",
  "ronaCurrentCompanyGuard='true'",
  'Скачать договор PDF',
  "/v1/client/storage/",
  "/signed-url",
  'storage_object_id',
  'Файл подписанного контракта не опубликован в кабинете'
];
for (const marker of requiredRuntime) assert(runtime.includes(marker), `runtime missing ${marker}`);

for (const forbidden of [
  '01/РТ-01-1926',
  '01/РТ-02-1926',
  '01/PT-02-1926'
]) assert(!runtime.includes(forbidden), `runtime hardcodes contract number ${forbidden}`);

assert(runtime.indexOf("type(d)==='SIGNED_CONTRACT'&&d?.storage_object_id") < runtime.indexOf("type(d)==='SIGNED_CONTRACT')"), 'verified/materialized signed contract must be preferred over an unavailable duplicate');
assert(clientApi.includes('current_external_contract_number'), 'client bootstrap must project current external contract number');
assert(phase5d.includes('current_external_contract_number'), 'client context must project current external contract number');
assert(phase5d.includes("so.storage_state='VERIFIED'"), 'client documents must require VERIFIED storage');
assert(router.includes('clientContractProjection'), 'router must expose client contract projection');
assert(router.includes('/v1/client/context'), 'router must expose client context endpoint');
assert(router.includes('const clientStorageMatch=route.match('), 'router must define client signed-storage route');
assert(router.includes('server_client_storage_object'), 'client signed-storage route must enforce server access gate');
assert(router.includes('issueSignedUrl(c,req,route,rows[0])'), 'client signed-storage route must issue server signed URL');

assert.equal(builtRuntime, runtime, 'deployed build asset must equal authoritative source asset');
const scriptSrcs=[...builtClient.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
console.log('CLIENT_CURRENT_SCRIPT_SRCS='+JSON.stringify(scriptSrcs));
assert(scriptSrcs.some(src=>src.includes('client-contract-download-v3.js')), 'current client build must load client-contract-download-v3.js');

const manifest=JSON.parse(await read('portal-src/current/client/manifest.json'));
const encoded=(await Promise.all(manifest.chunks.map(name=>read(`portal-src/current/client/${name}`)))).join('');
const frozenClient=brotliDecompressSync(Buffer.from(encoded,'base64')).toString('utf8');
const probes=['FARG','SOLY','Номер уточняется','Открыть компанию','Текущая компания','Контракт пока недоступен'];
const excerpts={};
for(const probe of probes){
  const hits=[];let from=0;
  while(hits.length<8){const at=frozenClient.toLocaleLowerCase('ru-RU').indexOf(probe.toLocaleLowerCase('ru-RU'),from);if(at<0)break;hits.push(frozenClient.slice(Math.max(0,at-100),Math.min(frozenClient.length,at+220)).replace(/\s+/g,' '));from=at+probe.length}
  excerpts[probe]=hits;
}
console.log('CLIENT_CANONICAL_TEXT_PROBES='+JSON.stringify(excerpts));

console.log('CLIENT_CONTRACT_AUTHORITATIVE_PROJECTION=PASS');
