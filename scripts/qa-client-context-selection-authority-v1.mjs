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
  'normalizeHeaderTitle','purgeHeaderContractDownload','CURRENT_SLOT','data-rona-current-context-slot','legacyContextScopes','bindLegacyScope','bindHeaderSlots','renderSlot',
  'COMPANY_SCOPE_REGISTRY','canonicalCompanyGrid','companyCardAuthorizedContext','registerCompanyCards','restoreAuthorizedCompanyCard','excludeUnauthorizedCompanyCard','guardCompanyGrid','syncCompanyGrid','internal-state-contexts'
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
if(!runtime.includes("document.querySelector('section#page-companies #clientCompanyGrid')"))throw new Error('CLIENT_CONTEXT_COMPANY_GRID_CANONICAL_SELECTOR_MISSING');
const companyOwnerStart=runtime.indexOf('const COMPANY_SCOPE_REGISTRY='),companyOwnerEnd=runtime.indexOf('function syncAll(){',companyOwnerStart);
if(companyOwnerStart<0||companyOwnerEnd<=companyOwnerStart)throw new Error('CLIENT_CONTEXT_COMPANY_GRID_OWNER_SLICE_MISSING');
const companyOwner=runtime.slice(companyOwnerStart,companyOwnerEnd);
for(const forbidden of ['getAuthorizedContexts','CLIENT_CONTEXTS','frozenContexts','canonicalCompanyModels'])if(companyOwner.includes(forbidden))throw new Error(`CLIENT_CONTEXT_COMPANY_GRID_PARALLEL_AUTHORITY_FORBIDDEN: ${forbidden}`);
if(!companyOwner.includes('state.contexts.filter('))throw new Error('CLIENT_CONTEXT_COMPANY_GRID_STATE_CONTEXTS_NOT_OWNED');

const n=v=>String(v??'').trim(),low=v=>n(v).toLocaleLowerCase('ru-RU');
function resolveCard(card,contexts){const clients=new Set((card.clients||[]).map(n).filter(Boolean)),contracts=new Set((card.contracts||[]).map(n).filter(Boolean)),text=low(card.text),hasExplicit=clients.size>0||contracts.size>0,candidates=contexts.filter(ctx=>{const client=n(ctx.client_id),contract=n(ctx.contract_id),external=n(ctx.current_external_contract_number),legal=low(ctx.legal_name),display=low(ctx.display_name||ctx.legal_name);if(clients.size&&!clients.has(client))return false;if(contracts.size&&!contracts.has(contract))return false;if(hasExplicit)return true;const clientHit=client&&text.includes(low(client)),contractHit=contract&&text.includes(low(contract)),externalHit=external&&text.includes(low(external)),legalHit=legal.length>=4&&text.includes(legal),displayHit=display.length>=4&&text.includes(display);return (clientHit&&contractHit)||(clientHit&&externalHit)||contractHit||externalHit||legalHit||displayHit});return candidates.length===1?candidates[0]:null}
const A={client_id:'QA-CLIENT-A',contract_id:'QA-CONTRACT-A',current_external_contract_number:'QA-EXT-A',legal_name:'QA Company Alpha'},B={client_id:'QA-CLIENT-B',contract_id:'QA-CONTRACT-B',current_external_contract_number:'QA-EXT-B',legal_name:'QA Company Beta'},F={client_id:'QA-CLIENT-FUTURE',contract_id:'QA-CONTRACT-FUTURE',current_external_contract_number:'QA-EXT-FUTURE',legal_name:'QA Company Future'};
const eq=(ctx,want)=>ctx?.client_id===want.client_id&&ctx?.contract_id===want.contract_id;
if(!eq(resolveCard({clients:[A.client_id],contracts:[A.contract_id]},[A]),A))throw new Error('COMPANY_GRID_MATRIX_SINGLE_EXACT_FAILED');
if(resolveCard({clients:[A.client_id],contracts:[B.contract_id]},[A,B]))throw new Error('COMPANY_GRID_MATRIX_MISMATCH_NOT_DENIED');
if(resolveCard({text:'QA Company'},[A,B]))throw new Error('COMPANY_GRID_MATRIX_AMBIGUOUS_NOT_DENIED');
if(resolveCard({clients:['QA-CLIENT-UNKNOWN'],contracts:['QA-CONTRACT-UNKNOWN']},[A,B]))throw new Error('COMPANY_GRID_MATRIX_UNRESOLVED_NOT_DENIED');
if(!eq(resolveCard({clients:[B.client_id],contracts:[B.contract_id]},[A,B]),B))throw new Error('COMPANY_GRID_MATRIX_MULTI_EXACT_FAILED');
if(resolveCard({clients:['QA-CLIENT-STATIC'],contracts:['QA-CONTRACT-STATIC']},[A,B]))throw new Error('COMPANY_GRID_MATRIX_STATIC_EXPANDED_AUTHORITY');
const restorable={clients:[F.client_id],contracts:[F.contract_id]};if(resolveCard(restorable,[A,B]))throw new Error('COMPANY_GRID_MATRIX_PRE_RESTORE_SHOULD_DENY');if(!eq(resolveCard(restorable,[A,B,F]),F))throw new Error('COMPANY_GRID_MATRIX_SAME_LIFECYCLE_RESTORE_FAILED');
if(!eq(resolveCard({text:'QA-CONTRACT-FUTURE'},[A,B,F]),F))throw new Error('COMPANY_GRID_MATRIX_FUTURE_GENERIC_FAILED');
console.log('CLIENT_CONTEXT_COMPANY_GRID_MATRIX=PASS exact-pair=true mismatch=fail-closed ambiguous=fail-closed unresolved=fail-closed static-expansion=false restore=same-lifecycle future=generic');

const authorityAt=html.indexOf(`id="${id}"`),headClose=html.toLowerCase().indexOf('</head>'),firstConsumerCandidates=['client-application-lifecycle-v1.js','client-home-command-center-v2.js','client-payments-authoritative-v1.js','client-price-sync-v1.js','client-contract-download-v3.js'].map(x=>html.indexOf(x)).filter(x=>x>=0),firstConsumerAt=firstConsumerCandidates.length?Math.min(...firstConsumerCandidates):-1;
if(authorityAt<0||headClose<0||authorityAt>headClose)throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_NOT_IN_HEAD');
if(firstConsumerAt>=0&&authorityAt>firstConsumerAt)throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_ORDER_INVALID');
if(!html.includes('client-context-selection-authority-v1.js?v='))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_CONTENT_ADDRESS_MISSING');
console.log('CLIENT_CONTEXT_SELECTION_AUTHORITY_QA=PASS source=SERVER_SESSION_AUTHORITY public_api=RONA_CLIENT_CONTEXT visual_context=DIRECT_SELECTED_CONTEXT_SLOTS company_grid=INTERNAL_STATE_CONTEXTS_EXACT_PAIR global_text_replacement=NONE header=GENERIC contract-download=REMOVED bootstrap=SELECTED_ONLY_OR_EMPTY sole-context-auto-select=guarded observer=CHILD_LIST_ONLY order=HEAD_DEFER_BEFORE_CONSUMERS');
