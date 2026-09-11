import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const runtimePath='dist/assets/portal-runtime/portal-client-company-directory-authority-v1.js';
const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const scriptId='rona-portal-client-company-directory-authority-v1';
const oldToken="/^(?:\\d+|—)$/.test(norm(el.textContent))";
const newToken="/^(?:\\d+|—|---|…|\\.\\.\\.)$/.test(norm(el.textContent))";
const loadAnchor='async function loadDirectory(force=false){';
const loadRepair="function adoptBaseDirectory(){const rows=state.base?.getCompanyDirectory?.();const validated=validateCompleteDirectory({company_directory_source:DIRECTORY_SOURCE,company_directory:Array.isArray(rows)?rows:[]});if(!validated)return false;state.directory=validated.rows.map(clone);state.validated=true;state.lastLoad=Date.now();state.generation+=1;if(!renderDirectory(state.generation))scheduleRender(0);return true}async function loadDirectory(force=false){";
const eventToken="window.addEventListener('rona:client-authorized-directory',()=>loadDirectory(false).catch(()=>{}));";
const eventRepair="window.addEventListener('rona:client-authorized-directory',()=>{if(!adoptBaseDirectory())loadDirectory(false).catch(()=>{})});";
const sha256=value=>createHash('sha256').update(value).digest('hex');

let runtime=await readFile(runtimePath,'utf8');
if(runtime.split(oldToken).length!==2)throw new Error('ISSUE430_COMPANY_METRIC_MATCHER_NOT_UNIQUE');
runtime=runtime.replace(oldToken,newToken);
if(!runtime.includes(newToken))throw new Error('ISSUE430_COMPANY_METRIC_MATCHER_REPAIR_MISSING');
if(runtime.split(loadAnchor).length!==2)throw new Error('ISSUE430_COMPANY_DIRECTORY_LOAD_TARGET_NOT_UNIQUE');
runtime=runtime.replace(loadAnchor,loadRepair);
if(runtime.split(eventToken).length!==2)throw new Error('ISSUE430_COMPANY_DIRECTORY_EVENT_TARGET_NOT_UNIQUE');
runtime=runtime.replace(eventToken,eventRepair);
if(!runtime.includes('function adoptBaseDirectory()')||!runtime.includes("rona:client-authorized-directory',()=>{if(!adoptBaseDirectory())"))throw new Error('ISSUE430_COMPANY_DIRECTORY_RACE_REPAIR_MISSING');
await writeFile(runtimePath,runtime,'utf8');

const digest=sha256(Buffer.from(runtime,'utf8'));
const src=`/assets/portal-runtime/portal-client-company-directory-authority-v1.js?v=${digest.slice(0,16)}`;
let html=await readFile(htmlPath,'utf8');
const tagRe=new RegExp(`<script\\b([^>]*\\bid=["']${scriptId}["'][^>]*)\\bsrc=["'][^"']+["']([^>]*)><\\/script>`,'i');
const match=html.match(tagRe);
if(!match)throw new Error('ISSUE430_COMPANY_DIRECTORY_SCRIPT_TAG_MISSING');
const replacement=`<script${match[1]}src="${src}"${match[2]}></script>`;
html=html.replace(tagRe,replacement);
if((html.match(new RegExp(scriptId,'g'))||[]).length!==1)throw new Error('ISSUE430_COMPANY_DIRECTORY_SCRIPT_TAG_NOT_SINGLE');
await writeFile(htmlPath,html,'utf8');

const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime=integrity.client_runtime||{};
integrity.client_runtime.emitted_sha256=sha256(Buffer.from(html,'utf8'));
integrity.client_runtime.emitted_bytes=Buffer.byteLength(html);
integrity.client_runtime.pr431_company_directory=integrity.client_runtime.pr431_company_directory||{};
integrity.client_runtime.pr431_company_directory.src=src;
integrity.client_runtime.pr431_company_directory.issue430_metric_placeholder_repair='ACCEPT_LEGACY_PLACEHOLDER_BEFORE_AUTHORITATIVE_HYDRATION';
integrity.client_runtime.pr431_company_directory.issue430_directory_race_repair='ADOPT_VALID_BASE_DIRECTORY_ON_AUTHORITY_EVENT_DURING_INFLIGHT_REFRESH';
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');

console.log(`ISSUE430_COMPANY_METRIC_PLACEHOLDER_REPAIR=PASS src=${src}`);
console.log('ISSUE430_COMPANY_DIRECTORY_RACE_REPAIR=PASS');
