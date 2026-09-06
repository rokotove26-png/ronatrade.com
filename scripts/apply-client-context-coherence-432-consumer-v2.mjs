import {readFile,writeFile} from 'node:fs/promises';

const lifecyclePath='dist/assets/portal-runtime/client-application-lifecycle-v1.js';
const applicationsPath='dist/assets/portal-runtime/client-applications-live-render-v1.js';
const PRIOR_MARK='ISSUE432_CONTEXT_SWITCH_RELOAD_QUEUE_V1';
const MARK='ISSUE432_CONTEXT_AUTHORITY_CONSUMER_V2';
const APPLICATIONS_MARK='ISSUE432_APPLICATIONS_CENTRAL_PROJECTION_V1';

function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from,to);
}
function assertNoBusinessHardcode(source,label){
  if(/RONA-C005|ГазОнэ|GazOne|RONA-C005-IN-2026-001/iu.test(source))throw new Error(`${label}_BUSINESS_SPECIFIC_HARDCODE_FORBIDDEN`);
}

let lifecycle=await readFile(lifecyclePath,'utf8');
if(!lifecycle.includes(PRIOR_MARK))throw new Error('ISSUE432_PRIOR_CONSUMER_GUARD_MISSING');
if(!lifecycle.includes(MARK)){
  lifecycle=replaceOnce(
    lifecycle,
    `const ${PRIOR_MARK}='${PRIOR_MARK}';`,
    `const ${PRIOR_MARK}='${PRIOR_MARK}';\nconst ${MARK}='${MARK}';`,
    'ISSUE432_CONSUMER_MARK'
  );
  const oldRead="const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));";
  const centralRead="const authority=contextAuthority();if(!authority?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');const projected=await authority.whenCurrentProjection('client-application-lifecycle-v1');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};";
  lifecycle=replaceOnce(lifecycle,oldRead,centralRead,'ISSUE432_CONSUMER_CONTEXT_READ');
}
for(const token of [MARK,"authority.whenCurrentProjection('client-application-lifecycle-v1')","CLIENT_CONTEXT_PROJECTION_UNAVAILABLE",'state.reloadRequested=true','queueMicrotask(()=>loadAuthoritativeState(true))'])if(!lifecycle.includes(token))throw new Error(`ISSUE432_CONSUMER_CONTRACT_MISSING:${token}`);
if(lifecycle.includes("request('/v1/client/context?clientId='"))throw new Error('ISSUE432_CONSUMER_DIRECT_CONTEXT_FETCH_PRESENT');
assertNoBusinessHardcode(lifecycle,'ISSUE432_CONSUMER');
new Function(lifecycle);
await writeFile(lifecyclePath,lifecycle,'utf8');

let applications=await readFile(applicationsPath,'utf8');
if(!applications.includes(APPLICATIONS_MARK)){
  applications=replaceOnce(
    applications,
    "const state={apps:[],contextKey:'',loading:false,lastLoad:0,timer:0,unsubscribe:null};",
    `const ${APPLICATIONS_MARK}='${APPLICATIONS_MARK}';\nconst state={apps:[],contextKey:'',loading:false,lastLoad:0,timer:0,unsubscribe:null};`,
    'ISSUE432_APPLICATIONS_MARK'
  );
  const oldRead="const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));";
  const centralRead="const a=authority();if(!a?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');const projected=await a.whenCurrentProjection('client-applications-live-render-v1');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};";
  applications=replaceOnce(applications,oldRead,centralRead,'ISSUE432_APPLICATIONS_CONTEXT_READ');
}
for(const token of [APPLICATIONS_MARK,"a.whenCurrentProjection('client-applications-live-render-v1')",'REFRESH_MS=30000'])if(!applications.includes(token))throw new Error(`ISSUE432_APPLICATIONS_CONTRACT_MISSING:${token}`);
if(applications.includes("request('/v1/client/context?clientId='"))throw new Error('ISSUE432_APPLICATIONS_DIRECT_CONTEXT_FETCH_PRESENT');
assertNoBusinessHardcode(applications,'ISSUE432_APPLICATIONS');
new Function(applications);
await writeFile(applicationsPath,applications,'utf8');

console.log(`CLIENT_CONTEXT_COHERENCE_432_CONSUMER=PASS marker=${MARK} lifecycle_context_source=CENTRAL_CURRENT_PROJECTION lifecycle_direct_context_fetch=absent context_switch_reload_queue=preserved applications_marker=${APPLICATIONS_MARK} applications_context_source=CENTRAL_CURRENT_PROJECTION applications_direct_context_fetch=absent applications_poll_ms=30000 visual_delta=none`);
