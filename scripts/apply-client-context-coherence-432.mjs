import {readFile,writeFile} from 'node:fs/promises';

const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const COHERENCE_MARK='RONA_CLIENT_CONTEXT_COHERENCE_432_V1';
const PROJECTION_MAX_AGE_MS=15000;

function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from,to);
}

let runtime=await readFile(runtimePath,'utf8');
if(runtime.includes(COHERENCE_MARK)){
  console.log(`CLIENT_CONTEXT_COHERENCE_432=PASS marker=${COHERENCE_MARK} already-applied=true`);
  process.exit(0);
}

runtime=replaceOnce(
  runtime,
  "const state={contexts:[],selected:null,seed:null,ready:false,loading:null,observer:null,queued:false,syncing:false,projection:{key:'',promise:null,text:'',json:null,status:0,statusText:'',headers:[],loadedAt:0},callerMap:[]};",
  `const PROJECTION_MAX_AGE_MS=${PROJECTION_MAX_AGE_MS};\nconst MUTATION_METHODS=new Set(['POST','PUT','PATCH','DELETE']);\nconst COHERENCE_MARK='${COHERENCE_MARK}';\nconst state={contexts:[],selected:null,seed:null,ready:false,loading:null,observer:null,queued:false,syncing:false,projectionGeneration:0,projection:{key:'',promise:null,text:'',json:null,status:0,statusText:'',headers:[],loadedAt:0,generation:0},callerMap:[]};`,
  'ISSUE432_STATE'
);

runtime=replaceOnce(
  runtime,
  "function taggedInit(input,init,source){const headers=requestHeaders(input,init);if(!headers.has('x-rona-client-source'))headers.set('x-rona-client-source',source);return{...(init||{}),headers}}\nfunction invalidateProjection(){Object.assign(state.projection,{key:'',promise:null,text:'',json:null,status:0,statusText:'',headers:[],loadedAt:0})}",
  "function requestMethod(input,init){return String(init?.method||(input instanceof Request?input.method:'GET')||'GET').toUpperCase()}\nfunction explicitFreshRead(input,init){const cache=String(init?.cache||(input instanceof Request?input.cache:'')||'').toLowerCase(),headers=requestHeaders(input,init),signal=norm(headers.get('x-rona-client-force-refresh')).toLowerCase();return cache==='no-store'||cache==='reload'||cache==='no-cache'||['1','true','yes','force','refresh'].includes(signal)}\nfunction taggedInit(input,init,source){const headers=requestHeaders(input,init);if(!headers.has('x-rona-client-source'))headers.set('x-rona-client-source',source);return{...(init||{}),headers}}\nfunction invalidateProjection(reason='manual'){state.projectionGeneration+=1;Object.assign(state.projection,{key:'',promise:null,text:'',json:null,status:0,statusText:'',headers:[],loadedAt:0,generation:state.projectionGeneration});window.dispatchEvent(new CustomEvent('rona:client-current-projection-invalidated',{detail:{generation:state.projectionGeneration,reason,key:key(state.selected)}}));return state.projectionGeneration}\nfunction projectionFresh(wanted){const p=state.projection;return p.key===wanted&&p.generation===state.projectionGeneration&&p.text&&p.status>=200&&p.status<300&&p.loadedAt>0&&(Date.now()-p.loadedAt)<=PROJECTION_MAX_AGE_MS}",
  'ISSUE432_INVALIDATION_HELPERS'
);

const loadFrom="async function loadCurrentProjection(source='client-context-selection-authority-v1:coordinator'){const ctx=state.selected;if(!ctx)return null;const wanted=key(ctx),p=state.projection;if(p.key===wanted&&p.text&&p.status>=200&&p.status<300)return cloneProjection();if(p.key===wanted&&p.promise){recordCaller(new URL(`${CONTEXT_ROUTE}?clientId=${encodeURIComponent(ctx.client_id)}&contractId=${encodeURIComponent(ctx.contract_id)}`,location.origin),source,'join');await p.promise;return cloneProjection()}invalidateProjection();p.key=wanted;const url=new URL(CONTEXT_ROUTE,location.origin);url.searchParams.set('clientId',ctx.client_id);url.searchParams.set('contractId',ctx.contract_id);recordCaller(url,source,'network');p.promise=(async()=>{const response=await nativeFetch(url.pathname+url.search,taggedInit(url.pathname+url.search,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}},source));const text=await response.text();const body=JSON.parse(text||'null');if(!response.ok)throw new Error(String(body?.code||`HTTP_${response.status}`));validateProjection(body,ctx);if(key(state.selected)!==wanted)throw new Error('CLIENT_CONTEXT_CHANGED_DURING_PROJECTION');p.text=text;p.json=body;p.status=response.status;p.statusText=response.statusText;p.headers=[...response.headers.entries()];p.loadedAt=Date.now();syncAndRenderLegacyContext();syncVisualContext();exposeSelection();window.dispatchEvent(new CustomEvent('rona:client-current-projection',{detail:{client_id:ctx.client_id,contract_id:ctx.contract_id,source,loaded_at:new Date(p.loadedAt).toISOString()}}))})().catch(error=>{if(p.key===wanted)invalidateProjection();throw error}).finally(()=>{if(p.key===wanted)p.promise=null});await p.promise;return cloneProjection()}";
const loadTo="async function loadCurrentProjection(source='client-context-selection-authority-v1:coordinator',options={}){const ctx=state.selected;if(!ctx)return null;const wanted=key(ctx),p=state.projection,forceFresh=options?.forceFresh===true;if(p.key===wanted&&p.promise&&p.generation===state.projectionGeneration){recordCaller(new URL(`${CONTEXT_ROUTE}?clientId=${encodeURIComponent(ctx.client_id)}&contractId=${encodeURIComponent(ctx.contract_id)}`,location.origin),source,'join');try{await p.promise}catch(error){if(key(state.selected)===wanted&&String(error?.message||'').includes('CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE'))return loadCurrentProjection(source,{forceFresh:true});throw error}if(projectionFresh(wanted))return cloneProjection();return loadCurrentProjection(source,{forceFresh:true})}if(!forceFresh&&projectionFresh(wanted)){recordCaller(new URL(`${CONTEXT_ROUTE}?clientId=${encodeURIComponent(ctx.client_id)}&contractId=${encodeURIComponent(ctx.contract_id)}`,location.origin),source,'memory');return cloneProjection()}const generation=invalidateProjection(forceFresh?'explicit-fresh-read':'ttl-revalidate');p.key=wanted;p.generation=generation;const url=new URL(CONTEXT_ROUTE,location.origin);url.searchParams.set('clientId',ctx.client_id);url.searchParams.set('contractId',ctx.contract_id);recordCaller(url,source,'network');let requestPromise;requestPromise=(async()=>{const response=await nativeFetch(url.pathname+url.search,taggedInit(url.pathname+url.search,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}},source));const text=await response.text();const body=JSON.parse(text||'null');if(!response.ok)throw new Error(String(body?.code||`HTTP_${response.status}`));validateProjection(body,ctx);if(state.projectionGeneration!==generation||p.generation!==generation||p.key!==wanted||key(state.selected)!==wanted)throw new Error('CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE');p.text=text;p.json=body;p.status=response.status;p.statusText=response.statusText;p.headers=[...response.headers.entries()];p.loadedAt=Date.now();syncAndRenderLegacyContext();syncVisualContext();exposeSelection();window.dispatchEvent(new CustomEvent('rona:client-current-projection',{detail:{client_id:ctx.client_id,contract_id:ctx.contract_id,source,loaded_at:new Date(p.loadedAt).toISOString(),generation}}))})().catch(error=>{if(p.generation===generation&&p.key===wanted){Object.assign(p,{key:'',promise:null,text:'',json:null,status:0,statusText:'',headers:[],loadedAt:0,generation:state.projectionGeneration})}throw error}).finally(()=>{if(p.generation===generation&&p.key===wanted&&p.promise===requestPromise)p.promise=null});p.promise=requestPromise;await requestPromise;if(!projectionFresh(wanted))throw new Error('CLIENT_CONTEXT_PROJECTION_NOT_CURRENT');return cloneProjection()}";
runtime=replaceOnce(runtime,loadFrom,loadTo,'ISSUE432_LOAD_CURRENT_PROJECTION');

const fetchFrom="window.fetch=async function(input,init){const raw=rawInput(input),url=clientUrl(raw);if(!url)return nativeFetch(input,init);const source=callerSource(input,init);if(url.pathname===BOOT){recordCaller(url,source,'request');const response=await nativeFetch(input,taggedInit(input,init,source));return scopedBootstrapResponse(response)}const contextual=url.searchParams.has('clientId')||url.searchParams.has('contractId')||pathRequiresContext(url.pathname);if(!contextual)return nativeFetch(input,init);await ensure();if(!state.selected)throw new Error('CLIENT_CONTEXT_SELECTION_REQUIRED');url.searchParams.set('clientId',state.selected.client_id);url.searchParams.set('contractId',state.selected.contract_id);recordCaller(url,source,'request');if(url.pathname===CONTEXT_ROUTE&&(init?.method===undefined||String(init.method).toUpperCase()==='GET'))return loadCurrentProjection(source);const response=await nativeFetch(nextUrl(raw,url),taggedInit(input,init,source));recordCaller(url,source,'network');if(String(init?.method||'GET').toUpperCase()!=='GET'&&response.ok)invalidateProjection();return response}";
const fetchTo="window.fetch=async function(input,init){const raw=rawInput(input),url=clientUrl(raw);if(!url)return nativeFetch(input,init);const source=callerSource(input,init),method=requestMethod(input,init);if(url.pathname===BOOT&&method==='GET'){recordCaller(url,source,'request');const response=await nativeFetch(input,taggedInit(input,init,source));return scopedBootstrapResponse(response)}const mutation=MUTATION_METHODS.has(method),contextual=mutation||url.searchParams.has('clientId')||url.searchParams.has('contractId')||pathRequiresContext(url.pathname);if(!contextual)return nativeFetch(input,init);await ensure();if(!state.selected)throw new Error('CLIENT_CONTEXT_SELECTION_REQUIRED');url.searchParams.set('clientId',state.selected.client_id);url.searchParams.set('contractId',state.selected.contract_id);recordCaller(url,source,'request');if(url.pathname===CONTEXT_ROUTE&&method==='GET')return loadCurrentProjection(source,{forceFresh:explicitFreshRead(input,init)});const rewritten=input instanceof Request?new Request(nextUrl(raw,url),input):nextUrl(raw,url),response=await nativeFetch(rewritten,taggedInit(input,init,source));recordCaller(url,source,'network');if(mutation&&response.ok)invalidateProjection(`mutation:${method}:${url.pathname}`);return response}";
runtime=replaceOnce(runtime,fetchFrom,fetchTo,'ISSUE432_FETCH_INTERCEPTOR');

for(const token of [
  COHERENCE_MARK,
  `PROJECTION_MAX_AGE_MS=${PROJECTION_MAX_AGE_MS}`,
  "MUTATION_METHODS=new Set(['POST','PUT','PATCH','DELETE'])",
  "cache==='no-store'",
  "explicitFreshRead(input,init)",
  "mutation&&response.ok",
  "CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE",
  "state.projectionGeneration!==generation",
  "p.promise===requestPromise",
  "input instanceof Request?new Request(nextUrl(raw,url),input):nextUrl(raw,url)"
])if(!runtime.includes(token))throw new Error(`ISSUE432_RUNTIME_CONTRACT_MISSING: ${token}`);

if(/RONA-C005|ГазОнэ|GazOne|RONA-C005-IN-2026-001/iu.test(runtime))throw new Error('ISSUE432_BUSINESS_SPECIFIC_HARDCODE_FORBIDDEN');

new Function(runtime);
await writeFile(runtimePath,runtime,'utf8');
console.log(`CLIENT_CONTEXT_COHERENCE_432=PASS marker=${COHERENCE_MARK} ttl_ms=${PROJECTION_MAX_AGE_MS} no_store=backend-revalidate mutation_invalidation=central generation_guard=true context_isolation=true single_flight=true visual_delta=none`);
