import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const contextPath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const directoryPath='dist/assets/portal-runtime/portal-client-company-directory-authority-v1.js';
const lifecyclePath='dist/assets/portal-runtime/client-deal-lifecycle-v1.js';
const sha256=value=>createHash('sha256').update(value).digest('hex');
function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from,to);
}

let lifecycle=await readFile(lifecyclePath,'utf8');
lifecycle=replaceOnce(lifecycle,"const MARK='20260905-client-deal-realization-status-v6-strict-authoritative-context';","const MARK='20260911-client-deal-realization-status-v7-current-projection';",'LIFECYCLE_MARK');
lifecycle=replaceOnce(lifecycle,"const API='/portal/api';\nconst SOURCE='SERVER_AUTHORITATIVE_REALIZATION_V1';","const SOURCE='SERVER_AUTHORITATIVE_REALIZATION_V2_CURRENT_PROJECTION';",'LIFECYCLE_SOURCE');
lifecycle=replaceOnce(lifecycle,"async function getJson(url){const r=await fetch(url,{method:'GET',headers:{accept:'application/json','x-rona-client-deal-lifecycle':'authoritative-v6','x-rona-client-source':'client-deal-lifecycle-v1'},credentials:'same-origin',cache:'no-store'});const body=await r.json().catch(()=>null);if(!r.ok||body?.ok===false)throw new Error(body?.code||`HTTP_${r.status}`);return body}","async function currentProjection(){const authority=contextAuthority();if(!authority?.whenCurrentProjection)throw new Error('CURRENT_PROJECTION_AUTHORITY_REQUIRED');return await authority.whenCurrentProjection('client-deal-lifecycle-v1')}",'LIFECYCLE_FETCH_OWNER');
const oldRead="const payload=await getJson(`${API}/v1/client/deal-documents/state?clientId=${encodeURIComponent(norm(ctx.client_id))}&contractId=${encodeURIComponent(norm(ctx.contract_id))}`);\n    if(seq!==requestSeq||contextKey(currentContext())!==key)return;\n    const next=new Map();for(const row of Array.isArray(payload?.deals)?payload.deals:[]){const id=norm(row?.deal_id);if(DEAL_RE.test(id)&&row?.realization_status?.source===SOURCE)next.set(id,row.realization_status)}";
const newRead="const data=await currentProjection();\n    if(seq!==requestSeq||contextKey(currentContext())!==key)return;\n    const projectionKey=`${norm(data?.contract?.client_id)}|${norm(data?.contract?.contract_id)}`;if(projectionKey!==key)throw new Error('CURRENT_PROJECTION_SCOPE_MISMATCH');\n    const next=new Map();for(const row of Array.isArray(data?.deals)?data.deals:[]){const id=norm(row?.deal_id);if(DEAL_RE.test(id)&&row?.realization_status?.source===SOURCE)next.set(id,row.realization_status)}";
lifecycle=replaceOnce(lifecycle,oldRead,newRead,'LIFECYCLE_CURRENT_PROJECTION_READ');
lifecycle=lifecycle.split('server-authoritative-v6-strict-context').join('server-authoritative-v7-current-projection');
if(lifecycle.includes('/v1/client/deal-documents/state?clientId='))throw new Error('LIFECYCLE_PARALLEL_STATE_ENDPOINT_REMAINS');
for(const token of ["authority.whenCurrentProjection('client-deal-lifecycle-v1')",'SERVER_AUTHORITATIVE_REALIZATION_V2_CURRENT_PROJECTION','CURRENT_PROJECTION_SCOPE_MISMATCH'])if(!lifecycle.includes(token))throw new Error(`LIFECYCLE_CURRENT_PROJECTION_CONTRACT_MISSING:${token}`);

let context=await readFile(contextPath,'utf8');
context=replaceOnce(context,"const MARK='20260903-client-context-selection-authority-v5-generic-header-no-contract-download';","const MARK='20260911-client-context-selection-authority-v6-atomic-cold-start';",'CONTEXT_MARK');
const closeToken="function closeLegacyTransientSurface(){try{if(typeof window.closeDrawer==='function')window.closeDrawer()}catch{}}";
const coldStart="function failClosedCurrentBusinessSurface(){clearCurrentSlots();d.dataset.ronaClientCurrentProjectionAtomic='pending';try{if(typeof window.closeDrawer==='function')window.closeDrawer()}catch{}const grid=canonicalCompanyGrid();if(grid&&d.dataset.ronaClientCompanyDirectoryAtomic!=='true'){for(const card of grid.querySelectorAll('article.company-switch-card')){card.setAttribute('aria-hidden','true');card.setAttribute('inert','');card.setAttribute('tabindex','-1')}}}";
context=replaceOnce(context,closeToken,coldStart+closeToken,'CONTEXT_COLD_FAIL_CLOSED');
context=replaceOnce(context,"if(before!==after){clearCurrentSlots();if(before)closeLegacyTransientSurface()}","if(before!==after){failClosedCurrentBusinessSurface();if(before)closeLegacyTransientSurface()}",'CONTEXT_SWITCH_FAIL_CLOSED');
context=replaceOnce(context,"p.loadedAt=Date.now();syncAndRenderLegacyContext();","p.loadedAt=Date.now();d.dataset.ronaClientCurrentProjectionAtomic='ready';syncAndRenderLegacyContext();",'CONTEXT_ATOMIC_READY');
context=replaceOnce(context,"function start(){state.seed=legacySeed();","function start(){failClosedCurrentBusinessSurface();state.seed=legacySeed();",'CONTEXT_COLD_START');
for(const token of ['failClosedCurrentBusinessSurface','ronaClientCurrentProjectionAtomic',"='pending'","='ready'"])if(!context.includes(token))throw new Error(`CONTEXT_ATOMIC_BINDING_MISSING:${token}`);

let directory=await readFile(directoryPath,'utf8');
directory=replaceOnce(directory,"const MARK='20260908-pr431-authorized-company-directory-v2-atomic';","const MARK='20260911-pr431-authorized-company-directory-v3-current-projection-atomic';",'DIRECTORY_MARK');
const directoryLoad="await state.base.whenReady();\n    const body=force?await state.base.refreshCompanyDirectory('pr431-company-directory-runtime'):await state.base.whenCompanyDirectory();";
const directoryBarrier="await state.base.whenReady();\n    const selected=state.base.getCurrentContext?.()||null;\n    if(selected){const projection=await state.base.whenCurrentProjection('portal-client-company-directory-authority-v1');const contract=projection?.contract||{};if(key(contract)!==key(selected))throw new Error('CLIENT_COMPANY_DIRECTORY_CURRENT_PROJECTION_SCOPE_MISMATCH')}\n    const body=force?await state.base.refreshCompanyDirectory('pr431-company-directory-runtime'):await state.base.whenCompanyDirectory();";
directory=replaceOnce(directory,directoryLoad,directoryBarrier,'DIRECTORY_CURRENT_PROJECTION_BARRIER');
directory=replaceOnce(directory,"if(!base?.whenReady||!base?.getAuthorizedContexts||!base?.getCompanyDirectory||!base?.whenCompanyDirectory||!base?.refreshCompanyDirectory)return;","if(!base?.whenReady||!base?.whenCurrentProjection||!base?.getAuthorizedContexts||!base?.getCompanyDirectory||!base?.whenCompanyDirectory||!base?.refreshCompanyDirectory)return;",'DIRECTORY_AUTHORITY_REQUIREMENT');
for(const token of ["whenCurrentProjection('portal-client-company-directory-authority-v1')",'CLIENT_COMPANY_DIRECTORY_CURRENT_PROJECTION_SCOPE_MISMATCH'])if(!directory.includes(token))throw new Error(`DIRECTORY_ATOMIC_BARRIER_MISSING:${token}`);

await writeFile(lifecyclePath,lifecycle,'utf8');
await writeFile(contextPath,context,'utf8');
await writeFile(directoryPath,directory,'utf8');

let html=await readFile(htmlPath,'utf8');
const revisions={
  'client-deal-lifecycle-v1.js':sha256(Buffer.from(lifecycle)).slice(0,16),
  'client-context-selection-authority-v1.js':sha256(Buffer.from(context)).slice(0,16),
  'portal-client-company-directory-authority-v1.js':sha256(Buffer.from(directory)).slice(0,16),
};
for(const [file,digest] of Object.entries(revisions)){
  const re=new RegExp(`(/assets/portal-runtime/${file.replaceAll('.','\\.')}\\?v=)[^\"']+`,'g');
  const matches=html.match(re)||[];if(matches.length!==1)throw new Error(`POSTRELEASE_RUNTIME_REF_COUNT_${file}:${matches.length}`);
  html=html.replace(re,`/assets/portal-runtime/${file}?v=${digest}`);
}
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime=integrity.client_runtime||{};
integrity.client_runtime.postrelease_state_consistency={
  version:'OWNER_POST_RELEASE_UAT_430_V1',
  context_authority:'RONA_CLIENT_CONTEXT_CURRENT_PROJECTION',
  resource_authority:'portal_private.resolve_deal_resource_state',
  realization_source:'SERVER_AUTHORITATIVE_REALIZATION_V2_CURRENT_PROJECTION',
  lifecycle_parallel_endpoint:false,
  cold_start_business_surface:'FAIL_CLOSED_UNTIL_EXACT_CURRENT_PROJECTION',
  company_directory_commit:'AFTER_EXACT_CURRENT_PROJECTION',
  context_switch_generation_guard:'PRESERVED',
  visual_css_changed:false,
  business_data_mutation:false,
  revisions
};
integrity.client_runtime.emitted_sha256=sha256(Buffer.from(html));
integrity.client_runtime.emitted_bytes=Buffer.byteLength(html);
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`CLIENT_POSTRELEASE_STATE_CONSISTENCY=PASS context=${revisions['client-context-selection-authority-v1.js']} directory=${revisions['portal-client-company-directory-authority-v1.js']} lifecycle=${revisions['client-deal-lifecycle-v1.js']} parallel-lifecycle-endpoint=absent cold-start=fail-closed company-commit=current-projection-barrier`);
