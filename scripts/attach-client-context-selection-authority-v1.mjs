import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const id='rona-client-context-selection-authority-v1';
const sourceMarker='20260903-client-context-selection-authority-v4-header-current-context';
const marker='20260903-client-context-selection-authority-v5-generic-header-no-contract-download';
const sha256=b=>createHash('sha256').update(b).digest('hex');

let runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker)){
  if(!runtime.includes(sourceMarker))throw new Error(`CLIENT_CONTEXT_AUTHORITY_SOURCE_MARKER_MISSING: ${sourceMarker}`);
  runtime=runtime.replace(`const MARK='${sourceMarker}';`,`const MARK='${marker}';`);
  await writeFile(runtimePath,runtime,'utf8');
}
if(!runtime.includes(marker))throw new Error(`CLIENT_CONTEXT_AUTHORITY_MARKER_MISSING: ${marker}`);
if(!runtime.includes('/portal/api/v1/client/bootstrap')||!runtime.includes('CLIENT_CONTEXT_SELECTION_REQUIRED'))throw new Error('CLIENT_CONTEXT_AUTHORITY_SERVER_CONTRACT_MISSING');
for(const token of [
  'clientContextSelect','companyDisplayName','rona:client-context-changed','RONA_CLIENT_CONTEXT','getCurrentContext','getAuthorizedContexts','whenReady','subscribe',
  'scopedBootstrapResponse','normalizeHeaderTitle','purgeHeaderContractDownload','loadCurrentProjection','getCurrentProjection','getCallerMap','x-rona-client-source',
  'data-rona-current-context-slot','legacyContextScopes','bindLegacyScope','bindHeaderSlots','renderSlot','CURRENT_SLOT'
])if(!runtime.includes(token))throw new Error(`CLIENT_CONTEXT_AUTHORITY_SELECTION_CONTRACT_MISSING: ${token}`);
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARG(?:[‘'ʼ])?ONA/iu.test(runtime))throw new Error('CLIENT_CONTEXT_AUTHORITY_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
for(const forbidden of [
  'staleHeaderNames','companyCandidate','syncContextScope','replace(CONTRACT_RE','replace(CLIENT_RE','ronaClientBaseText',
  "attributeFilter:['value','data-client-id','data-contract-id']","document.querySelectorAll('body *')"
])if(runtime.includes(forbidden))throw new Error(`CLIENT_CONTEXT_AUTHORITY_GLOBAL_TEXT_REWRITE_FORBIDDEN: ${forbidden}`);
if(!runtime.includes("state.observer.observe(document.body,{childList:true,subtree:true})"))throw new Error('CLIENT_CONTEXT_AUTHORITY_EVENT_SAFE_OBSERVER_MISSING');

const digest=sha256(Buffer.from(runtime,'utf8')).slice(0,16);
const src=`/assets/portal-runtime/client-context-selection-authority-v1.js?v=${digest}`;
let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${id}"`)||html.includes('client-context-selection-authority-v1.js'))throw new Error('CLIENT_CONTEXT_AUTHORITY_BRIDGE_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_CONTEXT_AUTHORITY_HEAD_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,headClose)+bridge+html.slice(headClose);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime=integrity.client_runtime||{};
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.context_selection_authority={
  id,src,marker,source:'SERVER_SESSION_AUTHORITY',scope:'ALL_AUTHORIZED_CLIENT_CABINETS',selection:'EXPLICIT_AUTHORIZED_CONTEXT_OR_SINGLE_AUTO',multi_context_first_fallback:false,
  api_rewrite:'SELECTED_AUTHORIZED_CONTEXT',bootstrap_projection:'SELECTED_CONTEXT_ONLY_OR_EMPTY_UNTIL_SELECTION',public_api:'RONA_CLIENT_CONTEXT',execution_order:'HEAD_DEFER_BEFORE_CLIENT_CONSUMERS',
  company_label:'COMPACT_LEGAL_DISPLAY',header_title:'GENERIC_CLIENT_CABINET',header_contract_download:false,legacy_context_zone:'EXPLICIT_SELECTED_CONTEXT_SLOTS',
  hardcoded_business_entities:false,initial_projection_owner:'RONA_CLIENT_CONTEXT',diagnostic_source_tags:true,self_exciting_attribute_observer:false,global_text_replacement:false,
  visual_context_binding:'CLIENT_ID_CONTRACT_ID_DIRECT_SLOT_RENDER'
};
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`CLIENT_CONTEXT_SELECTION_AUTHORITY=PASS marker=${marker} asset=${src} order=head-defer-before-client-consumers header=generic contract-download=removed bootstrap=selected-only initial-projection=single-owner observer=child-list-only current-slots=direct global-text-replacement=false`);