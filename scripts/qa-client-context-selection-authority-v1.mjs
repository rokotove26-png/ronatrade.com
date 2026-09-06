import { readFile } from 'node:fs/promises';

const html=await readFile('dist/portal/client.html','utf8');
const runtime=await readFile('dist/assets/portal-runtime/client-context-selection-authority-v1.js','utf8');
const marker='20260903-client-context-selection-authority-v5-generic-header-no-contract-download';
const id='rona-client-context-selection-authority-v1';

if(!runtime.includes(marker))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_MARKER_MISSING');
const runtimeLower=runtime.toLocaleLowerCase('ru-RU');
for(const token of [
  'SERVER_SESSION_AUTHORITY','companyDisplayName','clientContextSelect','CLIENT_CONTEXT_SELECTION_REQUIRED','rona:client-context-changed','RONA_CLIENT_CONTEXT',
  'whenReady','getCurrentContext','getCurrentProjection','getAuthorizedContexts','selectionRequired','subscribe','scopedBootstrapResponse','requires_context_selection','selected_context',
  'normalizeHeaderTitle','purgeHeaderContractDownload','CURRENT_SLOT','data-rona-current-context-slot','legacyContextScopes','bindLegacyScope','bindHeaderSlots','renderSlot'
])if(!runtime.includes(token))throw new Error(`CLIENT_CONTEXT_AUTHORITY_QA_TOKEN_MISSING: ${token}`);
if(!runtimeLower.includes('выбрана компания'))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_EXPLICIT_LEGACY_CONTEXT_ANCHOR_MISSING');
const soleContextGuard='if(state.contexts.length===1)return state.contexts[0];';
const stateFirstReturns=(runtime.match(/return state\.contexts\[0\]/g)||[]).length;
if(!runtime.includes(soleContextGuard)||stateFirstReturns!==1||runtime.includes('return contexts[0]'))throw new Error('CLIENT_CONTEXT_AUTHORITY_MULTI_CONTEXT_FIRST_FALLBACK_FORBIDDEN');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARG(?:[‘'ʼ])?ONA/iu.test(runtime))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
if(!runtime.includes("contexts:selected?[selected]:[]"))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_SCOPED_BOOTSTRAP_MISSING');
if(!runtime.includes("url.searchParams.set('clientId',state.selected.client_id)")||!runtime.includes("url.searchParams.set('contractId',state.selected.contract_id)"))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_REQUEST_REWRITE_MISSING');
if(!runtime.includes("state.observer.observe(document.body,{childList:true,subtree:true})"))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_CHILD_LIST_ONLY_OBSERVER_MISSING');
for(const forbidden of [
  'staleHeaderNames','companyCandidate','syncContextScope','replace(CONTRACT_RE','replace(CLIENT_RE','ronaClientBaseText',
  "attributeFilter:['value','data-client-id','data-contract-id']","document.querySelectorAll('body *')","after=titleMatch[1]+' · '+display"
])if(runtime.includes(forbidden))throw new Error(`CLIENT_CONTEXT_AUTHORITY_QA_GLOBAL_OR_HEURISTIC_REWRITE_FORBIDDEN: ${forbidden}`);
if(!runtime.includes("for(const el of document.querySelectorAll(`[${CURRENT_SLOT}]`))renderSlot(el,state.selected)"))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_DIRECT_SLOT_RENDER_MISSING');
if(!runtime.includes("/^скачать\\s+договор\\s+pdf$/iu.test(norm(el.textContent))"))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_HEADER_DOWNLOAD_PURGE_MISSING');
const authorityAt=html.indexOf(`id="${id}"`),headClose=html.toLowerCase().indexOf('</head>'),firstConsumerCandidates=['client-application-lifecycle-v1.js','client-home-command-center-v2.js','client-payments-authoritative-v1.js','client-price-sync-v1.js','client-contract-download-v3.js'].map(x=>html.indexOf(x)).filter(x=>x>=0),firstConsumerAt=firstConsumerCandidates.length?Math.min(...firstConsumerCandidates):-1;
if(authorityAt<0||headClose<0||authorityAt>headClose)throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_NOT_IN_HEAD');
if(firstConsumerAt>=0&&authorityAt>firstConsumerAt)throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_ORDER_INVALID');
if(!html.includes('client-context-selection-authority-v1.js?v='))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_CONTENT_ADDRESS_MISSING');
console.log('CLIENT_CONTEXT_SELECTION_AUTHORITY_QA=PASS source=SERVER_SESSION_AUTHORITY public_api=RONA_CLIENT_CONTEXT visual_context=DIRECT_SELECTED_CONTEXT_SLOTS global_text_replacement=NONE header=GENERIC contract-download=REMOVED bootstrap=SELECTED_ONLY_OR_EMPTY sole-context-auto-select=guarded observer=CHILD_LIST_ONLY order=HEAD_DEFER_BEFORE_CONSUMERS');