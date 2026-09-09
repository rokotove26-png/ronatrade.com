import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/portal-client-company-directory-authority-v1.js';
const selectionRuntimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const contractRuntimePath='dist/assets/portal-runtime/client-contract-download-v3.js';
const id='rona-portal-client-company-directory-authority-v1';
const marker='20260908-pr431-authorized-company-directory-v2-atomic';
const materializationMarker='PR431_SERVER_DRIVEN_CARD_MATERIALIZATION_V1';
const ownershipFixMarker='PR431_REAL_AUTH_ALL_CONTEXT_TAKEOVER_V1';
const legacyMarker='20260906-client-contract-v11-authoritative-company-metrics';
const sha256=b=>createHash('sha256').update(b).digest('hex');
function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from,to);
}
let runtime=await readFile(runtimePath,'utf8');
for(const required of [marker,materializationMarker,legacyMarker,'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB','CURRENT_EFFECTIVE_CONTRACTUAL_ONLY','validateCompleteDirectory','captureTemplate','materializeCard','planDirectory','replaceChildren','getCompanyDirectory','whenCompanyDirectory','refreshCompanyDirectory','data-rona-company-contract-download','/v1/client/storage/','signed-url','CLIENT_COMPANY_DIRECTORY_INCOMPLETE','ALL_AUTHORIZED_CONTEXT_DIRECTORY'])if(!runtime.includes(required))throw new Error(`PR431_COMPANY_DIRECTORY_RUNTIME_CONTRACT_MISSING: ${required}`);
if(runtime.includes("fetch('/portal/api/v1/client/bootstrap'")||runtime.includes('fetch("/portal/api/v1/client/bootstrap"'))throw new Error('PR431_COMPANY_DIRECTORY_SECOND_WRAPPED_BOOTSTRAP_FORBIDDEN');
for(const forbidden of ['neutralCard','RONA_CLIENT_OWNER_TYPOGRAPHY','style.setProperty(\'font-size\'','createElement(\'style\')','QUARANTINED_BEFORE_EXECUTION'])if(runtime.includes(forbidden))throw new Error(`PR431_COMPANY_DIRECTORY_DESTRUCTIVE_OR_VISUAL_OWNER_FORBIDDEN: ${forbidden}`);
if(/RONA-C\d{3}|RONA-C\d{3}-CTR|RONA-C\d{3}-IN|2\s*\/\s*2\s*\/\s*5/iu.test(runtime))throw new Error('PR431_COMPANY_DIRECTORY_HARDCODED_ACCEPTANCE_FIXTURE_FORBIDDEN');

// SYSTEM_ADMIN 5593681625: real-auth evidence classified BUG-1 as an all-context
// directory takeover/retention failure (not a bootstrap-data failure). Patch the emitted
// directory owner itself, generically, without touching BUG-2 Applications or backend data.
runtime=replaceOnce(
  runtime,
  "const REFRESH_MS=30000;",
  `const REFRESH_MS=30000;\nconst OWNERSHIP_FIX='${ownershipFixMarker}';`,
  'PR431_REAL_AUTH_OWNERSHIP_FIX_MARKER'
);
runtime=replaceOnce(
  runtime,
  "const canonicalGrid=()=>document.querySelector('section#page-companies #clientCompanyGrid');",
  "const canonicalGrid=()=>document.getElementById('clientCompanyGrid');",
  'PR431_REAL_AUTH_GRID_RESOLVER'
);
runtime=replaceOnce(
  runtime,
  "  opener.removeAttribute('aria-disabled');\n  card.dataset.ronaCompanyAuthorizationScope='authorized-directory';",
  "  opener.removeAttribute('aria-disabled');\n  opener.addEventListener('click',event=>{if(same(currentContext(),row))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();try{state.base.select(row.client_id,row.contract_id)}catch(error){console.error('RONA company directory selection',error)}});\n  card.dataset.ronaCompanyAuthorizationScope='authorized-directory';",
  'PR431_REAL_AUTH_DIRECT_DIRECTORY_SELECTION'
);
runtime=replaceOnce(
  runtime,
  "  if(state.active&&state.renderedGeneration===generation)return syncCurrentMarkers();",
  "  if(state.active&&state.renderedGeneration===generation){if(syncCurrentMarkers())return true;state.active=false;delete window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__;document.documentElement.dataset.ronaClientCompanyDirectoryAtomic='recovering'}",
  'PR431_REAL_AUTH_TAKEOVER_SELF_HEAL'
);
runtime=replaceOnce(
  runtime,
  "    root.dataset.ronaClientCompanyDirectoryGeneration=String(generation);\n    window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__=MARK;",
  "    root.dataset.ronaClientCompanyDirectoryGeneration=String(generation);\n    root.dataset.ronaClientCompanyDirectoryOwnershipFix=OWNERSHIP_FIX;\n    window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__=MARK;",
  'PR431_REAL_AUTH_TAKEOVER_MARKER'
);
runtime=replaceOnce(
  runtime,
  "    if(state.active){syncCurrentMarkers();return}",
  "    if(state.active){if(!syncCurrentMarkers()){state.active=false;delete window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__;document.documentElement.dataset.ronaClientCompanyDirectoryAtomic='recovering';scheduleRender(0)}return}",
  'PR431_REAL_AUTH_MUTATION_RETENTION'
);
const oldStart=`async function start(){
  if(window.__RONA_CLIENT_COMPANY_DIRECTORY_AUTHORITY__===MARK)return;
  const base=window.RONA_CLIENT_CONTEXT;if(!base?.whenReady||!base?.getAuthorizedContexts||!base?.getCompanyDirectory||!base?.whenCompanyDirectory||!base?.refreshCompanyDirectory)return;
  window.__RONA_CLIENT_COMPANY_DIRECTORY_AUTHORITY__=MARK;
  state.base=base;
  captureTemplate();
  startObserver();
  if(base.subscribe)base.subscribe(()=>state.active?syncCurrentMarkers():scheduleRender(0));
  window.addEventListener('rona:client-authorized-directory',()=>loadDirectory(false).catch(()=>{}));
  window.addEventListener('pageshow',()=>loadDirectory(true).catch(()=>{}));
  window.addEventListener('rona:client-context-changed',()=>state.active?syncCurrentMarkers():scheduleRender(0));
  await loadDirectory(false).catch(()=>{});
  setInterval(()=>{if(document.visibilityState==='visible')loadDirectory(false).catch(()=>{})},REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();`;
const newStart=`function multiCompanyPending(reason='loading'){
  if(state.active||authorizedSnapshot().length<=1)return false;
  const grid=canonicalGrid();if(!grid)return false;
  captureTemplate();if(!state.template)return false;
  const pending=document.createElement('div');pending.dataset.ronaCompanyDirectoryPending=reason;pending.setAttribute('role','status');pending.setAttribute('aria-live','polite');pending.textContent=reason==='error'?'Данные компаний временно недоступны. Повторяем загрузку…':'Данные компаний загружаются…';
  grid.replaceChildren(pending);
  const root=document.documentElement;root.dataset.ronaClientCompanyDirectoryAtomic='pending';root.dataset.ronaClientCompanyDirectorySource=DIRECTORY_SOURCE;root.dataset.ronaClientCompanyDirectoryDocumentsPredicate=DOCUMENTS_PREDICATE;root.dataset.ronaClientCompanyDirectoryOwnershipFix=OWNERSHIP_FIX;
  delete window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__;
  return true;
}
async function waitForDirectoryBase(timeoutMs=15000){const started=Date.now();while(Date.now()-started<timeoutMs){const base=window.RONA_CLIENT_CONTEXT;if(base?.whenReady&&base?.getAuthorizedContexts&&base?.getCompanyDirectory&&base?.whenCompanyDirectory&&base?.refreshCompanyDirectory&&base?.select)return base;await new Promise(resolve=>setTimeout(resolve,50))}return null}
async function waitForDirectoryTemplate(timeoutMs=10000){const started=Date.now();while(Date.now()-started<timeoutMs){const template=captureTemplate();if(template)return template;await new Promise(resolve=>setTimeout(resolve,50))}return null}
let startPromise=null,startRetry=0,started=false;
async function start(){
  if(started)return true;if(startPromise)return startPromise;
  startPromise=(async()=>{
    const base=await waitForDirectoryBase();if(!base){clearTimeout(startRetry);startRetry=setTimeout(()=>start().catch(()=>{}),150);return false}
    state.base=base;await base.whenReady();if(!await waitForDirectoryTemplate()){clearTimeout(startRetry);startRetry=setTimeout(()=>start().catch(()=>{}),150);return false}
    window.__RONA_CLIENT_COMPANY_DIRECTORY_AUTHORITY__=MARK;
    startObserver();if(authorizedSnapshot().length>1)multiCompanyPending('loading');
    if(base.subscribe)base.subscribe(()=>{if(state.active){if(!syncCurrentMarkers()){state.active=false;delete window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__;document.documentElement.dataset.ronaClientCompanyDirectoryAtomic='recovering';scheduleRender(0)}}else scheduleRender(0)});
    window.addEventListener('rona:client-authorized-directory',()=>loadDirectory(false).catch(()=>{}));
    window.addEventListener('pageshow',()=>loadDirectory(true).catch(()=>{}));
    window.addEventListener('rona:client-context-changed',()=>{if(state.active){if(!syncCurrentMarkers()){state.active=false;delete window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__;document.documentElement.dataset.ronaClientCompanyDirectoryAtomic='recovering';scheduleRender(0)}}else scheduleRender(0)});
    started=true;
    await loadDirectory(true).catch(()=>{if(!state.active)multiCompanyPending('error')});
    setInterval(()=>{if(document.visibilityState==='visible')loadDirectory(false).catch(()=>{})},REFRESH_MS);
    return true;
  })().finally(()=>{startPromise=null});return startPromise;
}
function boot(){start().catch(error=>{console.error('RONA company directory boot',error);clearTimeout(startRetry);startRetry=setTimeout(()=>start().catch(()=>{}),150)})}
window.addEventListener('rona:client-context-ready',boot);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
setTimeout(boot,0);`;
runtime=replaceOnce(runtime,oldStart,newStart,'PR431_REAL_AUTH_START_RETRY_FAIL_CLOSED');
for(const required of [ownershipFixMarker,"getElementById('clientCompanyGrid')",'multiCompanyPending','waitForDirectoryBase','waitForDirectoryTemplate',"loadDirectory(true)","ronaClientCompanyDirectoryAtomic='recovering'",'state.base.select(row.client_id,row.contract_id)'])if(!runtime.includes(required))throw new Error(`PR431_REAL_AUTH_TAKEOVER_CONTRACT_MISSING: ${required}`);
await writeFile(runtimePath,runtime,'utf8');

// Preserve canonical frozen company-card shells until the atomic server-driven directory owns the grid,
// then stand the central selection grid mutator down while retaining its delegated selection guard.
let selection=await readFile(selectionRuntimePath,'utf8');
const selectionActiveHelper="function allAuthorizedCompanyDirectoryActive(){return d.dataset.ronaClientCompanyDirectorySource===DIRECTORY_SOURCE&&d.dataset.ronaClientCompanyDirectoryDocumentsPredicate===DOCUMENTS_PREDICATE&&d.dataset.ronaClientCompanyDirectoryAtomic==='true'}";
selection=replaceOnce(selection,'const COMPANY_SCOPE_GUARDED=new WeakSet();','const COMPANY_SCOPE_GUARDED=new WeakSet();\n'+selectionActiveHelper,'PR431_SELECTION_DIRECTORY_ACTIVE_HELPER');
selection=replaceOnce(selection,"function excludeUnauthorizedCompanyCard(entry,reason){const {card}=entry;if(!entry.scoped){entry.ariaHidden=card.getAttribute('aria-hidden');entry.inert=card.hasAttribute('inert');entry.tabIndex=card.getAttribute('tabindex');entry.scoped=true}card.dataset.ronaCompanyAuthorizationScope=reason;delete card.dataset.ronaCompanyCurrent;card.setAttribute('aria-hidden','true');card.setAttribute('inert','');card.setAttribute('tabindex','-1');if(card.isConnected)card.remove()}","function excludeUnauthorizedCompanyCard(entry,reason){const {card}=entry;if(!entry.scoped){entry.ariaHidden=card.getAttribute('aria-hidden');entry.inert=card.hasAttribute('inert');entry.tabIndex=card.getAttribute('tabindex');entry.scoped=true}card.dataset.ronaCompanyAuthorizationScope=reason;delete card.dataset.ronaCompanyCurrent;card.setAttribute('aria-hidden','true');card.setAttribute('inert','');card.setAttribute('tabindex','-1')}",'PR431_SELECTION_PRETAKEOVER_SHELL_PRESERVE');
selection=replaceOnce(selection,"function syncCompanyGrid(){const grid=canonicalCompanyGrid();if(!grid)return false;registerCompanyCards(grid);guardCompanyGrid(grid);let rendered=0;for(const entry of COMPANY_SCOPE_REGISTRY.entries){const ctx=companyCardAuthorizedContext(entry.card);if(ctx){restoreAuthorizedCompanyCard(entry,ctx);rendered++}else excludeUnauthorizedCompanyCard(entry,state.ready?'denied-or-ambiguous':'pending-authority')}d.dataset.ronaClientCompanyAuthorizationScope='internal-state-contexts';d.dataset.ronaClientCompanyAuthorizedCards=String(rendered);return true}","function syncCompanyGrid(){const grid=canonicalCompanyGrid();if(!grid)return false;if(allAuthorizedCompanyDirectoryActive()){guardCompanyGrid(grid);const rendered=[...grid.querySelectorAll('article.company-switch-card[data-rona-client-id][data-rona-client-contract-id]')].filter(card=>card.dataset.ronaCompanyDirectoryHydration==='ready'&&card.dataset.ronaCompanyDirectorySource===DIRECTORY_SOURCE&&card.dataset.ronaCompanyDirectoryDocumentsPredicate===DOCUMENTS_PREDICATE).length;d.dataset.ronaClientCompanyAuthorizationScope='all-authorized-directory';d.dataset.ronaClientCompanyAuthorizedCards=String(rendered);return true}registerCompanyCards(grid);guardCompanyGrid(grid);let rendered=0;for(const entry of COMPANY_SCOPE_REGISTRY.entries){const ctx=companyCardAuthorizedContext(entry.card);if(ctx){restoreAuthorizedCompanyCard(entry,ctx);rendered++}else excludeUnauthorizedCompanyCard(entry,state.ready?'denied-or-ambiguous':'pending-authority')}d.dataset.ronaClientCompanyAuthorizationScope='internal-state-contexts';d.dataset.ronaClientCompanyAuthorizedCards=String(rendered);return true}",'PR431_SELECTION_POSTTAKEOVER_STANDDOWN');
for(const required of [selectionActiveHelper,"ronaClientCompanyAuthorizationScope='all-authorized-directory'","card.setAttribute('tabindex','-1')}"])if(!selection.includes(required))throw new Error(`PR431_SELECTION_COMPOSITION_CONTRACT_MISSING: ${required}`);
if(selection.includes("card.setAttribute('tabindex','-1');if(card.isConnected)card.remove()"))throw new Error('PR431_SELECTION_PRETAKEOVER_SHELL_REMOVAL_STILL_ACTIVE');
await writeFile(selectionRuntimePath,selection,'utf8');

// v11 Company Directory stand-down is source-native. Do not mutate the emitted product runtime here.
const contract=await readFile(contractRuntimePath,'utf8');
for(const required of [legacyMarker,'function authoritativeCompanyDirectoryOwnsCards()','window.__RONA_PORTAL_CLIENT_COMPANY_DIRECTORY__','v11-source-standdown-all-authorized-directory','rona:client-company-directory-ready'])if(!contract.includes(required))throw new Error(`PR431_V11_SOURCE_NATIVE_STANDDOWN_CONTRACT_MISSING: ${required}`);
for(const forbidden of ["function allCompanyDirectoryActive(){","v11-standdown-all-authorized-directory"])if(contract.includes(forbidden))throw new Error(`PR431_V11_OBSOLETE_EMITTED_STANDDOWN_PRESENT: ${forbidden}`);
if(!contract.includes('if(!ctx||authoritativeCompanyDirectoryOwnsCards())return false')||!contract.includes('if(authoritativeCompanyDirectoryOwnsCards()||!entry||!resolved)return false')||!contract.includes("if(authoritativeCompanyDirectoryOwnsCards()){document.documentElement.dataset.ronaClientContractRuntime='v11-source-standdown-all-authorized-directory';return true}"))throw new Error('PR431_V11_SOURCE_NATIVE_SINGLE_OWNER_GUARD_INCOMPLETE');

const digest=sha256(Buffer.from(runtime,'utf8')).slice(0,16),src=`/assets/portal-runtime/portal-client-company-directory-authority-v1.js?v=${digest}`;
const selectionDigest=sha256(Buffer.from(selection,'utf8')).slice(0,16),selectionSrc=`/assets/portal-runtime/client-context-selection-authority-v1.js?v=${selectionDigest}`;
let html=await readFile(htmlPath,'utf8');
const selectionSrcMatch=html.match(/\/assets\/portal-runtime\/client-context-selection-authority-v1\.js\?v=[a-f0-9]+/i);
if(!selectionSrcMatch)throw new Error('PR431_SELECTION_CONTENT_ADDRESS_TARGET_MISSING');
html=replaceOnce(html,selectionSrcMatch[0],selectionSrc,'PR431_SELECTION_CONTENT_ADDRESS_REFRESH');
if(html.includes(`id="${id}"`)||html.includes('portal-client-company-directory-authority-v1.js'))throw new Error('PR431_COMPANY_DIRECTORY_ALREADY_ATTACHED');
const headClose=html.toLowerCase().lastIndexOf('</head>');if(headClose<0)throw new Error('PR431_CLIENT_HEAD_CLOSE_MISSING');
html=html.slice(0,headClose)+`<script id="${id}" src="${src}" defer></script>`+html.slice(headClose);
const authorityIndex=html.indexOf('client-context-selection-authority-v1.js'),directoryIndex=html.indexOf('portal-client-company-directory-authority-v1.js'),legacyIndex=html.indexOf('client-contract-download-v3.js');
if(authorityIndex<0||directoryIndex<0||legacyIndex<0||!(authorityIndex<directoryIndex&&directoryIndex<legacyIndex))throw new Error(`PR431_COMPANY_DIRECTORY_EXECUTION_ORDER_INVALID authority=${authorityIndex} directory=${directoryIndex} legacy=${legacyIndex}`);
await writeFile(htmlPath,html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));integrity.client_runtime=integrity.client_runtime||{};integrity.client_runtime.emitted_sha256=sha256(Buffer.from(html,'utf8'));integrity.client_runtime.emitted_bytes=Buffer.byteLength(html);if(integrity.client_runtime.context_selection_authority)integrity.client_runtime.context_selection_authority.src=selectionSrc;integrity.client_runtime.pr431_company_directory={id,src,marker,materialization:materializationMarker,ownership_fix:ownershipFixMarker,scope:'ALL_SERVER_AUTHORIZED_CLIENT_CONTRACT_CONTEXTS',source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',activation:'COMPLETE_DIRECTORY_ATOMIC_COMMIT_WITH_REAL_AUTH_RETRY',card_materialization:'CLONE_EXISTING_CANONICAL_CARD_STRUCTURE_PER_AUTHORIZED_ROW',pre_takeover_shell_policy:'MULTI_COMPANY_FAIL_CLOSED_PENDING',post_takeover_central_grid_mutator:'STAND_DOWN_KEEP_DELEGATED_SELECTION_GUARD',takeover_retention:'SELF_HEAL_ON_LEGACY_RERENDER',bootstrap_owner:'RONA_CLIENT_CONTEXT_NATIVE_FETCH',missing_or_partial_projection:'NON_DESTRUCTIVE_NEUTRAL_PENDING',refresh_failure:'KEEP_LAST_VALIDATED_DIRECTORY',contract_download:'SERVER_AUTHORIZED_SHORT_LIVED_SIGNED_URL',selected_context_required_for_directory:false,legacy_selected_context_owner:'SOURCE_NATIVE_STAND_DOWN_WHEN_DIRECTORY_OWNER_PRESENT',visual_runtime_owner:false,visual_redesign:false,hardcoded_business_entities:false};await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`PR431_COMPANY_DIRECTORY_ATTACH=PASS marker=${marker} materialization=${materializationMarker} ownership-fix=${ownershipFixMarker} order=authority->directory-atomic->legacy-source-native-standdown source=AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB bootstrap-owner=central-native pre-takeover=fail-closed post-takeover=self-heal visual-owner=false`);
