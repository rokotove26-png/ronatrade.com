const base=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const sha=String(process.env.GITHUB_SHA||Date.now());
const assert=(value,message)=>{if(!value)throw new Error(message)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function retry(label,fn,attempts=30,delayMs=3000){
  let last;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await fn(attempt)}catch(error){last=error;if(attempt<attempts)await sleep(delayMs)}
  }
  throw new Error(`${label}: ${last?.message||last}`);
}

const fetchNoStore=(path,attempt=0)=>fetch(`${base}${path}${path.includes('?')?'&':'?'}_qa=${encodeURIComponent(sha)}&_attempt=${attempt}&_nonce=${Date.now()}`,{cache:'no-store',redirect:'manual'});

const integrity=await retry('Client background preload integrity',async attempt=>{
  const response=await fetchNoStore('/canonical-visual-integrity.json',attempt);
  assert(response.ok,`integrity status ${response.status}`);
  const data=await response.json();
  const preload=data?.client_runtime?.background_section_preload;
  assert(preload,'background_section_preload metadata missing');
  assert(preload.id==='rona-client-background-section-preload-v1',`id ${preload.id}`);
  assert(preload.marker==='20260831-client-background-section-preload-v1',`marker ${preload.marker}`);
  assert(preload.mode==='ALL_CLIENT_SECTIONS_BACKGROUND_PRELOAD',`mode ${preload.mode}`);
  assert(preload.trigger==='PORTAL_OPEN',`trigger ${preload.trigger}`);
  assert(preload.refresh_ms===30000,`refresh ${preload.refresh_ms}`);
  assert(preload.visibility_independent===true,'visibility_independent not true');
  assert(preload.scope==='ALL_AUTHORIZED_CLIENT_CONTEXTS',`scope ${preload.scope}`);
  assert(preload.read_only===true,'read_only not true');
  assert(preload.visual_change===false,'visual_change changed');
  assert(preload.business_mutation===false,'business_mutation changed');
  for(const section of ['company_contract','home','applications','deals','documents','payments','prices','market','rail'])assert(preload.covered_sections?.includes(section),`covered section missing ${section}`);
  return data;
});

const runtime=await retry('Client background preload runtime',async attempt=>{
  const response=await fetchNoStore('/assets/portal-runtime/client-background-section-preload-v1.js?v=20260831-all-sections-v1',attempt);
  assert(response.ok,`runtime status ${response.status}`);
  const text=await response.text();
  for(const marker of [
    '20260831-client-background-section-preload-v1',
    "cycle('open')",
    'REFRESH_MS=30000',
    "read('/v1/client/bootstrap')",
    "read('/v1/client/market')",
    "read('/v1/client/shipments')",
    "read('/v1/client/rail',{allowDisabled:true})",
    '/v1/client/context?clientId=',
    '/v1/client/prices?clientId=',
    'state.contexts.map(preloadContext)',
    'window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache',
    'rona:client:background-sections'
  ])assert(text.includes(marker),`runtime marker missing: ${marker}`);
  for(const forbidden of ["method:'POST'",'method:"POST"'])assert(!text.includes(forbidden),`write method present: ${forbidden}`);
  return text;
});

assert(runtime.length>0,'background preload runtime empty');
console.log('CLIENT_BACKGROUND_SECTION_PRELOAD_PRODUCTION=PASS',JSON.stringify({base,sha,marker:integrity.client_runtime.background_section_preload.marker,mode:integrity.client_runtime.background_section_preload.mode,scope:integrity.client_runtime.background_section_preload.scope,refresh_ms:integrity.client_runtime.background_section_preload.refresh_ms,covered_sections:integrity.client_runtime.background_section_preload.covered_sections}));
