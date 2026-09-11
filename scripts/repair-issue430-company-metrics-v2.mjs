import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const runtimePath='dist/assets/portal-runtime/portal-client-company-directory-authority-v1.js';
const contextRuntimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const scriptId='rona-portal-client-company-directory-authority-v1';
const contextScriptId='rona-client-context-selection-authority-v1';
const oldToken="/^(?:\\d+|—)$/.test(norm(el.textContent))";
const newToken="/^(?:\\d+|—|---|…|\\.\\.\\.)$/.test(norm(el.textContent))";
const loadAnchor='async function loadDirectory(force=false){';
const loadRepair="function adoptBaseDirectory(){const rows=state.base?.getCompanyDirectory?.();const validated=validateCompleteDirectory({company_directory_source:DIRECTORY_SOURCE,company_directory:Array.isArray(rows)?rows:[]});if(!validated)return false;state.directory=validated.rows.map(clone);state.validated=true;state.lastLoad=Date.now();state.generation+=1;if(!renderDirectory(state.generation))scheduleRender(0);return true}async function loadDirectory(force=false){";
const eventToken="window.addEventListener('rona:client-authorized-directory',()=>loadDirectory(false).catch(()=>{}));";
const eventRepair="window.addEventListener('rona:client-authorized-directory',()=>queueMicrotask(()=>{if(!adoptBaseDirectory())loadDirectory(false).catch(()=>{})}));";
const schedulerToken="function scheduleRender(delay=20){clearTimeout(state.timer);state.timer=setTimeout(()=>{if(!renderDirectory(state.generation)&&hasLastValidatedDirectory())restoreLastValidatedDirectory()},delay)}";
const schedulerRepair="function scheduleRender(delay=20){if(state.timer)return;state.timer=setTimeout(()=>{state.timer=0;if(!renderDirectory(state.generation)&&hasLastValidatedDirectory())restoreLastValidatedDirectory()},delay)}";
const ensureToken="async function ensure(){if(state.ready)return state.contexts;if(state.loading)return state.loading;state.loading=(async()=>{state.seed=state.seed||legacySeed();const response=await nativeFetch(BOOT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':'client-context-selection-authority-v1:bootstrap'}});const body=await parseBootstrapResponse(response),rawContexts=body?.data?.contexts;captureCompanyDirectory(body?.data,rawContexts,'initial-native-bootstrap');if(!publish(rawContexts,'bootstrap',authoritativeHint(body?.data)))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');return state.contexts})().finally(()=>{state.loading=null});return state.loading}";
const ensureRepair="async function ensure(){if(state.ready)return state.contexts;if(state.loading)return state.loading;state.loading=(async()=>{state.seed=state.seed||legacySeed();const response=await nativeFetch(BOOT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':'client-context-selection-authority-v1:bootstrap'}});const body=await parseBootstrapResponse(response),rawContexts=body?.data?.contexts;if(!publish(rawContexts,'bootstrap',authoritativeHint(body?.data)))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');captureCompanyDirectory(body?.data,rawContexts,'initial-native-bootstrap');return state.contexts})().finally(()=>{state.loading=null});return state.loading}";
const refreshToken="async function refreshCompanyDirectory(source='public-api'){if(state.refreshingDirectory)return state.refreshingDirectory;state.refreshingDirectory=(async()=>{await ensure();const response=await nativeFetch(BOOT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':`client-context-selection-authority-v1:directory-refresh:${norm(source)||'public-api'}`}}),body=await parseBootstrapResponse(response),rawContexts=body?.data?.contexts,current=state.selected?{client_id:state.selected.client_id,contract_id:state.selected.contract_id}:null,validDirectory=captureCompanyDirectory(body?.data,rawContexts,'central-native-directory-refresh');if(!publish(rawContexts,'bootstrap-directory-refresh',current))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');if(!validDirectory)throw new Error('CLIENT_COMPANY_DIRECTORY_INCOMPLETE');return cloneDirectorySnapshot(state.directory.snapshot)})().finally(()=>{state.refreshingDirectory=null});return state.refreshingDirectory}";
const refreshRepair="async function refreshCompanyDirectory(source='public-api'){if(state.refreshingDirectory)return state.refreshingDirectory;state.refreshingDirectory=(async()=>{await ensure();const response=await nativeFetch(BOOT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':`client-context-selection-authority-v1:directory-refresh:${norm(source)||'public-api'}`}}),body=await parseBootstrapResponse(response),rawContexts=body?.data?.contexts,current=state.selected?{client_id:state.selected.client_id,contract_id:state.selected.contract_id}:null;if(!publish(rawContexts,'bootstrap-directory-refresh',current))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');const validDirectory=captureCompanyDirectory(body?.data,rawContexts,'central-native-directory-refresh');if(!validDirectory)throw new Error('CLIENT_COMPANY_DIRECTORY_INCOMPLETE');return cloneDirectorySnapshot(state.directory.snapshot)})().finally(()=>{state.refreshingDirectory=null});return state.refreshingDirectory}";
const scopedToken="async function scopedBootstrapResponse(response){try{if(!response?.ok)return response;const body=await response.clone().json();if(body?.ok===false)return response;const rawContexts=body?.data?.contexts;captureCompanyDirectory(body?.data,rawContexts,'wrapped-bootstrap-capture');if(!publish(rawContexts,'bootstrap-capture',authoritativeHint(body?.data)))return response;";
const scopedRepair="async function scopedBootstrapResponse(response){try{if(!response?.ok)return response;const body=await response.clone().json();if(body?.ok===false)return response;const rawContexts=body?.data?.contexts;if(!publish(rawContexts,'bootstrap-capture',authoritativeHint(body?.data)))return response;captureCompanyDirectory(body?.data,rawContexts,'wrapped-bootstrap-capture');";
const sha256=value=>createHash('sha256').update(value).digest('hex');
function replaceOnce(source,from,to,label){if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);return source.replace(from,to)}

let runtime=await readFile(runtimePath,'utf8');
runtime=replaceOnce(runtime,oldToken,newToken,'ISSUE430_COMPANY_METRIC_MATCHER');
if(!runtime.includes(newToken))throw new Error('ISSUE430_COMPANY_METRIC_MATCHER_REPAIR_MISSING');
runtime=replaceOnce(runtime,loadAnchor,loadRepair,'ISSUE430_COMPANY_DIRECTORY_LOAD');
runtime=replaceOnce(runtime,eventToken,eventRepair,'ISSUE430_COMPANY_DIRECTORY_EVENT');
runtime=replaceOnce(runtime,schedulerToken,schedulerRepair,'ISSUE430_COMPANY_RENDER_SCHEDULER');
if(!runtime.includes('function adoptBaseDirectory()')||!runtime.includes("rona:client-authorized-directory',()=>queueMicrotask(()=>{if(!adoptBaseDirectory())")||!runtime.includes('function scheduleRender(delay=20){if(state.timer)return;'))throw new Error('ISSUE430_COMPANY_DIRECTORY_RACE_REPAIR_MISSING');
await writeFile(runtimePath,runtime,'utf8');

let contextRuntime=await readFile(contextRuntimePath,'utf8');
contextRuntime=replaceOnce(contextRuntime,ensureToken,ensureRepair,'ISSUE430_CONTEXT_INITIAL_DIRECTORY_ORDER');
contextRuntime=replaceOnce(contextRuntime,refreshToken,refreshRepair,'ISSUE430_CONTEXT_REFRESH_DIRECTORY_ORDER');
contextRuntime=replaceOnce(contextRuntime,scopedToken,scopedRepair,'ISSUE430_CONTEXT_WRAPPED_DIRECTORY_ORDER');
if(!contextRuntime.includes("if(!publish(rawContexts,'bootstrap',authoritativeHint(body?.data)))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');captureCompanyDirectory(body?.data,rawContexts,'initial-native-bootstrap')")||!contextRuntime.includes("if(!publish(rawContexts,'bootstrap-directory-refresh',current))throw new Error('CLIENT_CONTEXT_NOT_AUTHORIZED');const validDirectory=captureCompanyDirectory(body?.data,rawContexts,'central-native-directory-refresh')")||!contextRuntime.includes("if(!publish(rawContexts,'bootstrap-capture',authoritativeHint(body?.data)))return response;captureCompanyDirectory(body?.data,rawContexts,'wrapped-bootstrap-capture')"))throw new Error('ISSUE430_CONTEXT_DIRECTORY_EVENT_ORDER_REPAIR_MISSING');
await writeFile(contextRuntimePath,contextRuntime,'utf8');

const digest=sha256(Buffer.from(runtime,'utf8'));
const contextDigest=sha256(Buffer.from(contextRuntime,'utf8'));
const src=`/assets/portal-runtime/portal-client-company-directory-authority-v1.js?v=${digest.slice(0,16)}`;
const contextSrc=`/assets/portal-runtime/client-context-selection-authority-v1.js?v=${contextDigest.slice(0,16)}`;
let html=await readFile(htmlPath,'utf8');
const tagRe=new RegExp(`<script\\b([^>]*\\bid=["']${scriptId}["'][^>]*)\\bsrc=["'][^"']+["']([^>]*)><\\/script>`,'i');
const match=html.match(tagRe);
if(!match)throw new Error('ISSUE430_COMPANY_DIRECTORY_SCRIPT_TAG_MISSING');
html=html.replace(tagRe,`<script${match[1]}src="${src}"${match[2]}></script>`);
const contextTagRe=new RegExp(`<script\\b([^>]*\\bid=["']${contextScriptId}["'][^>]*)\\bsrc=["'][^"']+["']([^>]*)><\\/script>`,'i');
const contextMatch=html.match(contextTagRe);
if(!contextMatch)throw new Error('ISSUE430_CONTEXT_AUTHORITY_SCRIPT_TAG_MISSING');
html=html.replace(contextTagRe,`<script${contextMatch[1]}src="${contextSrc}"${contextMatch[2]}></script>`);
if((html.match(new RegExp(scriptId,'g'))||[]).length!==1)throw new Error('ISSUE430_COMPANY_DIRECTORY_SCRIPT_TAG_NOT_SINGLE');
if((html.match(new RegExp(contextScriptId,'g'))||[]).length!==1)throw new Error('ISSUE430_CONTEXT_AUTHORITY_SCRIPT_TAG_NOT_SINGLE');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime=integrity.client_runtime||{};
integrity.client_runtime.emitted_sha256=sha256(Buffer.from(html,'utf8'));
integrity.client_runtime.emitted_bytes=Buffer.byteLength(html);
integrity.client_runtime.pr431_company_directory=integrity.client_runtime.pr431_company_directory||{};
integrity.client_runtime.pr431_company_directory.src=src;
integrity.client_runtime.pr431_company_directory.issue430_metric_placeholder_repair='ACCEPT_LEGACY_PLACEHOLDER_BEFORE_AUTHORITATIVE_HYDRATION';
integrity.client_runtime.pr431_company_directory.issue430_directory_race_repair='DEFER_AUTHORITY_ADOPTION_TO_POST_EVENT_MICROTASK';
integrity.client_runtime.pr431_company_directory.issue430_render_scheduler='COALESCED_RENDER_CANNOT_BE_STARVED_BY_DOM_MUTATION_CHURN';
integrity.client_runtime.context_selection_authority=integrity.client_runtime.context_selection_authority||{};
integrity.client_runtime.context_selection_authority.src=contextSrc;
integrity.client_runtime.context_selection_authority.issue430_directory_event_order='PUBLISH_AUTHORIZED_CONTEXTS_BEFORE_DIRECTORY_EVENT';
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');

console.log(`ISSUE430_COMPANY_METRIC_PLACEHOLDER_REPAIR=PASS src=${src}`);
console.log('ISSUE430_COMPANY_DIRECTORY_RACE_REPAIR=PASS');
console.log('ISSUE430_COMPANY_RENDER_SCHEDULER=PASS mode=coalesced-non-starving');
console.log('ISSUE430_CONTEXT_DIRECTORY_EVENT_ORDER=PASS publish-before-capture');
