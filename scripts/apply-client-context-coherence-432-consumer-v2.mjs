import {readFile,writeFile} from 'node:fs/promises';

const path='dist/assets/portal-runtime/client-application-lifecycle-v1.js';
const PRIOR_MARK='ISSUE432_CONTEXT_SWITCH_RELOAD_QUEUE_V1';
const MARK='ISSUE432_CONTEXT_AUTHORITY_CONSUMER_V2';

function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from,to);
}

let source=await readFile(path,'utf8');
if(!source.includes(PRIOR_MARK))throw new Error('ISSUE432_PRIOR_CONSUMER_GUARD_MISSING');

if(!source.includes(MARK)){
  source=replaceOnce(
    source,
    `const ${PRIOR_MARK}='${PRIOR_MARK}';`,
    `const ${PRIOR_MARK}='${PRIOR_MARK}';\nconst ${MARK}='${MARK}';`,
    'ISSUE432_CONSUMER_MARK'
  );

  const oldRead="const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));";
  const centralRead="const authority=contextAuthority();if(!authority?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');const projected=await authority.whenCurrentProjection('client-application-lifecycle-v1');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};";
  source=replaceOnce(source,oldRead,centralRead,'ISSUE432_CONSUMER_CONTEXT_READ');
}

for(const token of [
  MARK,
  "authority.whenCurrentProjection('client-application-lifecycle-v1')",
  "CLIENT_CONTEXT_PROJECTION_UNAVAILABLE",
  'state.reloadRequested=true',
  'queueMicrotask(()=>loadAuthoritativeState(true))'
])if(!source.includes(token))throw new Error(`ISSUE432_CONSUMER_CONTRACT_MISSING:${token}`);

if(source.includes("request('/v1/client/context?clientId='"))throw new Error('ISSUE432_CONSUMER_DIRECT_CONTEXT_FETCH_PRESENT');
if(/RONA-C005|ГазОнэ|GazOne|RONA-C005-IN-2026-001/iu.test(source))throw new Error('ISSUE432_CONSUMER_BUSINESS_SPECIFIC_HARDCODE_FORBIDDEN');

new Function(source);
await writeFile(path,source,'utf8');
console.log(`CLIENT_CONTEXT_COHERENCE_432_CONSUMER=PASS marker=${MARK} context_source=CENTRAL_CURRENT_PROJECTION direct_context_fetch=absent context_switch_reload_queue=preserved visual_delta=none`);
