import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const id='rona-client-context-selection-authority-v1';
const sourceMarker='20260903-client-context-selection-authority-v4-header-current-context';
const marker='20260903-client-context-selection-authority-v5-generic-header-no-contract-download';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const replaceExact=(text,before,after,label)=>{
  if(!text.includes(before))throw new Error(`CLIENT_CONTEXT_AUTHORITY_PATCH_MISSING: ${label}`);
  return text.replace(before,after);
};

let runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker)){
  if(!runtime.includes(sourceMarker))throw new Error(`CLIENT_CONTEXT_AUTHORITY_SOURCE_MARKER_MISSING: ${sourceMarker}`);
  runtime=replaceExact(runtime,`const MARK='${sourceMarker}';`,`const MARK='${marker}';`,'marker');

  const legacyTitle="      after=titleMatch[1]+' · '+display;";
  const genericTitle="      after=titleMatch[1];";
  const compactGenericTitle='if(titleMatch){after=titleMatch[1]}';
  const compactGenericTitleCanonical='if(titleMatch){after=titleMatch[1];}';
  if(runtime.includes(legacyTitle))runtime=runtime.replace(legacyTitle,genericTitle);
  else if(runtime.includes(compactGenericTitle))runtime=runtime.replace(compactGenericTitle,compactGenericTitleCanonical);
  else if(!runtime.includes(genericTitle)&&!runtime.includes(compactGenericTitleCanonical))throw new Error('CLIENT_CONTEXT_AUTHORITY_PATCH_MISSING: generic-header-title');

  if(!runtime.includes('function normalizeHeaderTitle(){')){
    const compactPurge=`function purgeHeaderContractDownload(){for(const root of headerRoots())for(const el of root.querySelectorAll('button,a,[role="button"]'))if(/скачать\\s+договор\\s+pdf/iu.test(norm(el.textContent)))el.remove()}`;
    const legacyPurge=`function purgeHeaderContractDownload(){\n  for(const root of headerRoots())for(const el of root.querySelectorAll('button,a,[role="button"]')){\n    if(/скачать\\s+договор\\s+pdf/iu.test(norm(el.textContent)))el.remove();\n  }\n}`;
    const sourcePurge=runtime.includes(compactPurge)?compactPurge:runtime.includes(legacyPurge)?legacyPurge:null;
    if(!sourcePurge)throw new Error('CLIENT_CONTEXT_AUTHORITY_PATCH_MISSING: header-contract-download-purge');
    const normalized=`function normalizeHeaderTitle(){\n  for(const leaf of document.querySelectorAll('body *')){\n    if(leaf.childElementCount!==0)continue;\n    const before=norm(leaf.textContent),match=before.match(/^(.*?личный кабинет клиента)(?:\\s*·.*)?$/iu);\n    if(match&&before!==match[1])leaf.textContent=match[1];\n  }\n}\n${sourcePurge}`;
    runtime=runtime.replace(sourcePurge,normalized);
  }

  const targetSync=`function syncVisualContext(){normalizeHeaderTitle();purgeHeaderContractDownload();const ctx=state.selected;if(!ctx)return;for(const scope of contextScopes())syncContextScope(scope,ctx);syncHeader(ctx)}`;
  if(!runtime.includes(targetSync)){
    const syncVariants=[
      `function syncVisualContext(){purgeHeaderContractDownload();const ctx=state.selected;if(!ctx)return;for(const scope of contextScopes())syncContextScope(scope,ctx);syncHeader(ctx);purgeHeaderContractDownload()}`,
      `function syncVisualContext(){const ctx=state.selected;if(!ctx)return;for(const scope of contextScopes())syncContextScope(scope,ctx);syncHeader(ctx);purgeHeaderContractDownload()}`
    ];
    const sourceSync=syncVariants.find(candidate=>runtime.includes(candidate));
    if(!sourceSync)throw new Error('CLIENT_CONTEXT_AUTHORITY_PATCH_MISSING: pre-context-header-cleanup');
    runtime=runtime.replace(sourceSync,targetSync);
  }

  const selfExcitingObserver=`state.observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['value','data-client-id','data-contract-id']});`;
  const eventSafeObserver=`state.observer.observe(document.body,{childList:true,subtree:true,characterData:true});`;
  if(runtime.includes(selfExcitingObserver))runtime=runtime.replace(selfExcitingObserver,eventSafeObserver);
  else if(!runtime.includes(eventSafeObserver))throw new Error('CLIENT_CONTEXT_AUTHORITY_PATCH_MISSING: event-safe-observer');

  const eagerSelectWrites=`if(state.selected){select.dataset.clientId=state.selected.client_id;select.dataset.contractId=state.selected.contract_id;select.dataset.ronaContextSource='server-session-authority';select.title=state.selected.legal_name}\n  else{delete select.dataset.clientId;delete select.dataset.contractId;select.dataset.ronaContextSource='server-session-authority-selection-required';select.title='Выберите компанию'}`;
  const idempotentSelectWrites=`if(state.selected){if(select.dataset.clientId!==state.selected.client_id)select.dataset.clientId=state.selected.client_id;if(select.dataset.contractId!==state.selected.contract_id)select.dataset.contractId=state.selected.contract_id;if(select.dataset.ronaContextSource!=='server-session-authority')select.dataset.ronaContextSource='server-session-authority';if(select.title!==state.selected.legal_name)select.title=state.selected.legal_name}\n  else{if(select.dataset.clientId)delete select.dataset.clientId;if(select.dataset.contractId)delete select.dataset.contractId;if(select.dataset.ronaContextSource!=='server-session-authority-selection-required')select.dataset.ronaContextSource='server-session-authority-selection-required';if(select.title!=='Выберите компанию')select.title='Выберите компанию'}`;
  if(runtime.includes(eagerSelectWrites))runtime=runtime.replace(eagerSelectWrites,idempotentSelectWrites);
  else if(!runtime.includes(idempotentSelectWrites))throw new Error('CLIENT_CONTEXT_AUTHORITY_PATCH_MISSING: idempotent-select-writes');

  await writeFile(runtimePath,runtime,'utf8');
}
if(!runtime.includes(marker))throw new Error(`CLIENT_CONTEXT_AUTHORITY_MARKER_MISSING: ${marker}`);
if(!runtime.includes('/portal/api/v1/client/bootstrap')||!runtime.includes('CLIENT_CONTEXT_SELECTION_REQUIRED'))throw new Error('CLIENT_CONTEXT_AUTHORITY_SERVER_CONTRACT_MISSING');
for(const token of ['clientContextSelect','companyDisplayName','rona:client-context-changed','RONA_CLIENT_CONTEXT','getCurrentContext','getAuthorizedContexts','whenReady','subscribe','scopedBootstrapResponse','normalizeHeaderTitle','purgeHeaderContractDownload','loadCurrentProjection','getCurrentProjection','getCallerMap','x-rona-client-source'])if(!runtime.includes(token))throw new Error(`CLIENT_CONTEXT_AUTHORITY_SELECTION_CONTRACT_MISSING: ${token}`);
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_CONTEXT_AUTHORITY_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(runtime.includes("after=titleMatch[1]+' · '+display"))throw new Error('CLIENT_CONTEXT_AUTHORITY_HEADER_COMPANY_SUFFIX_FORBIDDEN');
if(runtime.includes("attributeFilter:['value','data-client-id','data-contract-id']"))throw new Error('CLIENT_CONTEXT_AUTHORITY_SELF_EXCITING_ATTRIBUTE_OBSERVER_FORBIDDEN');

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
integrity.client_runtime.context_selection_authority={id,src,marker,source:'SERVER_SESSION_AUTHORITY',scope:'ALL_AUTHORIZED_CLIENT_CABINETS',selection:'EXPLICIT_AUTHORIZED_CONTEXT_OR_SINGLE_AUTO',multi_context_first_fallback:false,api_rewrite:'SELECTED_AUTHORIZED_CONTEXT',bootstrap_projection:'SELECTED_CONTEXT_ONLY_OR_EMPTY_UNTIL_SELECTION',public_api:'RONA_CLIENT_CONTEXT',execution_order:'HEAD_DEFER_BEFORE_CLIENT_CONSUMERS',company_label:'COMPACT_LEGAL_DISPLAY',header_title:'GENERIC_CLIENT_CABINET',header_contract_download:false,legacy_context_zone:'DISPLAY_ONLY_SERVER_SYNCED',hardcoded_business_entities:false,initial_projection_owner:'RONA_CLIENT_CONTEXT',diagnostic_source_tags:true,self_exciting_attribute_observer:false};
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`CLIENT_CONTEXT_SELECTION_AUTHORITY=PASS marker=${marker} asset=${src} order=head-defer-before-client-consumers header=generic contract-download=removed bootstrap=selected-only initial-projection=single-owner observer=event-safe`);
