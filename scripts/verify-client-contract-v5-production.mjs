const base=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const sha=String(process.env.GITHUB_SHA||Date.now());
const assert=(value,message)=>{if(!value)throw new Error(message)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function retry(label,fn,attempts=30,delayMs=3000){
  let last;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await fn(attempt)}catch(error){
      last=error;
      if(attempt<attempts)await sleep(delayMs);
    }
  }
  throw new Error(`${label}: ${last?.message||last}`);
}

const fetchNoStore=(path,attempt=0)=>fetch(`${base}${path}${path.includes('?')?'&':'?'}_qa=${encodeURIComponent(sha)}&_attempt=${attempt}&_nonce=${Date.now()}`,{cache:'no-store',redirect:'manual'});

const integrity=await retry('Client CURRENT_ONLY integrity',async attempt=>{
  const response=await fetchNoStore('/canonical-visual-integrity.json',attempt);
  assert(response.ok,`status ${response.status}`);
  const data=await response.json();
  const client=data.client_runtime||{};
  assert(data.architecture==='CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS',`architecture ${data.architecture}`);
  assert(client.state==='CURRENT_ONLY',`client state ${client.state}`);
  assert(client.legacy_runtime_in_deployment===false,'legacy Client runtime is deployed');
  assert(client.source_sha256==='d07d7cbee5fd3466c8729861a6e6a6acb4ba463ad6d89dd7f748209cacab6183',`client source ${client.source_sha256}`);
  assert(client.source_bytes===484970,`client bytes ${client.source_bytes}`);
  assert(client.functional_bridge?.id==='rona-client-contract-authoritative-projection-v5',`bridge id ${client.functional_bridge?.id}`);
  assert(client.functional_bridge?.marker==='20260829-client-contract-v3-authoritative-projection-v5',`bridge marker ${client.functional_bridge?.marker}`);
  assert(client.functional_bridge?.src==='/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-projection-v5',`bridge src ${client.functional_bridge?.src}`);
  return data;
});

const runtime=await retry('Client authoritative contract runtime',async attempt=>{
  const response=await fetchNoStore('/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-projection-v5',attempt);
  assert(response.ok,`status ${response.status}`);
  const text=await response.text();
  for(const marker of [
    '20260902-client-contract-v4-current-context-authority',
    '20260829-client-contract-v3-authoritative-projection-v5',
    'RONA_CLIENT_CONTEXT',
    '/v1/client/context?clientId=',
    'current_external_contract_number',
    'function currentContractDocument',
    'function effectiveContext',
    "context_source:'RONA_CLIENT_CONTEXT_AUTHORITY'",
    "scope:'CURRENT_CONTEXT_ONLY'",
    "ronaClientContractModel='authoritative'"
  ])assert(text.includes(marker),`runtime marker missing: ${marker}`);
  for(const forbidden of ['01/РТ-01-1926','01/РТ-02-1926','01/PT-02-1926'])assert(!text.includes(forbidden),`runtime hardcodes contract number: ${forbidden}`);
  return text;
});

assert(runtime.length>0,'Client authoritative runtime body is empty');
console.log('CLIENT_CONTRACT_V5_PRODUCTION=PASS',JSON.stringify({base,sha,architecture:integrity.architecture,clientState:integrity.client_runtime.state,bridge:integrity.client_runtime.functional_bridge,sourceSha256:integrity.client_runtime.source_sha256,sourceBytes:integrity.client_runtime.source_bytes}));
