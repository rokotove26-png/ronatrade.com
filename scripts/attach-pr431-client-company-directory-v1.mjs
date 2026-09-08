import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/portal-client-company-directory-authority-v1.js';
const contractRuntimePath='dist/assets/portal-runtime/client-contract-download-v3.js';
const id='rona-portal-client-company-directory-authority-v1';
const marker='20260908-pr431-authorized-company-directory-v2-atomic';
const legacyMarker='20260906-client-contract-v11-authoritative-company-metrics';
const sha256=b=>createHash('sha256').update(b).digest('hex');
function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from,to);
}
const runtime=await readFile(runtimePath,'utf8');
for(const required of [marker,legacyMarker,'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB','CURRENT_EFFECTIVE_CONTRACTUAL_ONLY','validateCompleteDirectory','planDirectory','getCompanyDirectory','whenCompanyDirectory','refreshCompanyDirectory','data-rona-company-contract-download','/v1/client/storage/','signed-url','CLIENT_COMPANY_DIRECTORY_INCOMPLETE'])if(!runtime.includes(required))throw new Error(`PR431_COMPANY_DIRECTORY_RUNTIME_CONTRACT_MISSING: ${required}`);
if(runtime.includes("fetch('/portal/api/v1/client/bootstrap'")||runtime.includes('fetch("/portal/api/v1/client/bootstrap"'))throw new Error('PR431_COMPANY_DIRECTORY_SECOND_WRAPPED_BOOTSTRAP_FORBIDDEN');
for(const forbidden of ['neutralCard','RONA_CLIENT_OWNER_TYPOGRAPHY','style.setProperty(\'font-size\'','createElement(\'style\')','QUARANTINED_BEFORE_EXECUTION'])if(runtime.includes(forbidden))throw new Error(`PR431_COMPANY_DIRECTORY_DESTRUCTIVE_OR_VISUAL_OWNER_FORBIDDEN: ${forbidden}`);
if(/RONA-C\d{3}|RONA-C\d{3}-CTR|RONA-C\d{3}-IN|2\s*\/\s*2\s*\/\s*5/iu.test(runtime))throw new Error('PR431_COMPANY_DIRECTORY_HARDCODED_ACCEPTANCE_FIXTURE_FORBIDDEN');

// Functional-only emitted v11 stand-down. Source typography/CSS stays byte-for-byte untouched.
let contract=await readFile(contractRuntimePath,'utf8');
const helper="function allCompanyDirectoryActive(){const d=document.documentElement.dataset;return d.ronaClientCompanyDirectorySource==='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'&&d.ronaClientCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'}";
contract=replaceOnce(contract,"const TERMINAL_APPLICATIONS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED','CLOSED']);","const TERMINAL_APPLICATIONS=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED','CLOSED']);\n"+helper,'PR431_V11_DIRECTORY_ACTIVE_HELPER');
contract=replaceOnce(contract,'function hydrateFrozenClientModel(entry){\n  const model=',"function hydrateFrozenClientModel(entry){\n  if(allCompanyDirectoryActive())return 0;\n  const model=",'PR431_V11_FROZEN_MODEL_STANDDOWN');
contract=replaceOnce(contract,'function primeCompanyDirectory(ctx){\n  if(!ctx)return false;','function primeCompanyDirectory(ctx){\n  if(!ctx||allCompanyDirectoryActive())return false;','PR431_V11_PRIME_STANDDOWN');
contract=replaceOnce(contract,"  const sameReady=card.dataset.ronaCompanyDirectoryHydration==='ready'&&norm(card.dataset.ronaClientContractId)===norm(ctx.contract_id)&&norm(card.dataset.ronaClientId)===norm(ctx.client_id);\n  if(!sameReady&&!neutralizeCompanyMetrics(resolved,ctx))return false;\n  bindCompanyOwner(resolved,ctx);return true;","  const sameReady=card.dataset.ronaCompanyDirectoryHydration==='ready'&&norm(card.dataset.ronaClientContractId)===norm(ctx.contract_id)&&norm(card.dataset.ronaClientId)===norm(ctx.client_id);\n  void sameReady;\n  bindCompanyOwner(resolved,ctx);return true;",'PR431_V11_PRETAKEOVER_STABLE_SHELL');
contract=replaceOnce(contract,'function syncCompanyCard(entry,resolved){\n  if(!entry||!resolved)return false;','function syncCompanyCard(entry,resolved){\n  if(allCompanyDirectoryActive()||!entry||!resolved)return false;','PR431_V11_SYNC_STANDDOWN');
contract=replaceOnce(contract,'  if(!metrics.ready)return neutralizeCompanyMetrics(resolved,ctx);','  if(!metrics.ready)return false;','PR431_V11_NO_PENDING_NEUTRALIZE');
contract=replaceOnce(contract,'function clearRuntimeButtons(entry){\n  for(const old','function clearRuntimeButtons(entry){\n  if(allCompanyDirectoryActive())return 0;\n  for(const old','PR431_V11_BUTTON_STANDDOWN');
contract=replaceOnce(contract,'function renderEntry(entry){\n  const resolved=','function renderEntry(entry){\n  if(allCompanyDirectoryActive())return false;\n  const resolved=','PR431_V11_ENTRY_STANDDOWN');
contract=replaceOnce(contract,"function render(){\n  if(state.rendering)return false;state.rendering=true;try{ensureStyle();const entry=state.entry;","function render(){\n  if(state.rendering)return false;state.rendering=true;try{ensureStyle();if(allCompanyDirectoryActive()){document.documentElement.dataset.ronaClientContractRuntime='v11-standdown-all-authorized-directory';return true}const entry=state.entry;",'PR431_V11_RENDER_STANDDOWN');
contract=replaceOnce(contract,"function primeFromAuthority(authority){const current=authority?.getCurrentContext?.();return current?primeCompanyDirectory(current):false}","function primeFromAuthority(authority){if(allCompanyDirectoryActive())return false;const current=authority?.getCurrentContext?.();return current?primeCompanyDirectory(current):false}",'PR431_V11_PRIME_AUTHORITY_STANDDOWN');
contract=replaceOnce(contract,"window.addEventListener('rona:client-context-ready',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-context-changed',()=>{primeFromAuthority(authority);refresh(true)});","window.addEventListener('rona:client-context-ready',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-context-changed',()=>{primeFromAuthority(authority);refresh(true)});window.addEventListener('rona:client-company-directory-ready',()=>scheduleRender(0));",'PR431_V11_DIRECTORY_READY_STANDDOWN');
for(const required of [helper,'v11-standdown-all-authorized-directory','rona:client-company-directory-ready'])if(!contract.includes(required))throw new Error(`PR431_V11_STANDDOWN_CONTRACT_MISSING: ${required}`);
if(contract.includes('if(!sameReady&&!neutralizeCompanyMetrics(resolved,ctx))')||contract.includes('if(!metrics.ready)return neutralizeCompanyMetrics(resolved,ctx)'))throw new Error('PR431_V11_PRETAKEOVER_NEUTRALIZE_STILL_ACTIVE');
await writeFile(contractRuntimePath,contract,'utf8');

const digest=sha256(Buffer.from(runtime,'utf8')).slice(0,16),src=`/assets/portal-runtime/portal-client-company-directory-authority-v1.js?v=${digest}`;
let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${id}"`)||html.includes('portal-client-company-directory-authority-v1.js'))throw new Error('PR431_COMPANY_DIRECTORY_ALREADY_ATTACHED');
const headClose=html.toLowerCase().lastIndexOf('</head>');if(headClose<0)throw new Error('PR431_CLIENT_HEAD_CLOSE_MISSING');
html=html.slice(0,headClose)+`<script id="${id}" src="${src}" defer></script>`+html.slice(headClose);
const authorityIndex=html.indexOf('client-context-selection-authority-v1.js'),directoryIndex=html.indexOf('portal-client-company-directory-authority-v1.js'),legacyIndex=html.indexOf('client-contract-download-v3.js');
if(authorityIndex<0||directoryIndex<0||legacyIndex<0||!(authorityIndex<directoryIndex&&directoryIndex<legacyIndex))throw new Error(`PR431_COMPANY_DIRECTORY_EXECUTION_ORDER_INVALID authority=${authorityIndex} directory=${directoryIndex} legacy=${legacyIndex}`);
await writeFile(htmlPath,html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));integrity.client_runtime=integrity.client_runtime||{};integrity.client_runtime.emitted_sha256=sha256(Buffer.from(html,'utf8'));integrity.client_runtime.emitted_bytes=Buffer.byteLength(html);integrity.client_runtime.pr431_company_directory={id,src,marker,scope:'ALL_SERVER_AUTHORIZED_CLIENT_CONTRACT_CONTEXTS',source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',activation:'COMPLETE_DIRECTORY_ATOMIC_COMMIT',bootstrap_owner:'RONA_CLIENT_CONTEXT_NATIVE_FETCH',missing_or_partial_projection:'NON_DESTRUCTIVE_KEEP_STABLE_OWNER',refresh_failure:'KEEP_LAST_VALIDATED_DIRECTORY',contract_download:'SERVER_AUTHORIZED_SHORT_LIVED_SIGNED_URL',selected_context_required_for_directory:false,legacy_selected_context_owner:'STAND_DOWN_AFTER_ATOMIC_DIRECTORY_COMMIT',visual_runtime_owner:false,visual_redesign:false,hardcoded_business_entities:false};await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`PR431_COMPANY_DIRECTORY_ATTACH=PASS marker=${marker} order=authority->directory-atomic->legacy-standdown source=AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB bootstrap-owner=central-native visual-owner=false`);
