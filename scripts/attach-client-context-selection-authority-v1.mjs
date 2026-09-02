import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const id='rona-client-context-selection-authority-v1';
const marker='20260902-client-context-selection-authority-v3-scoped-bootstrap';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_CONTEXT_AUTHORITY_MARKER_MISSING: ${marker}`);
if(!runtime.includes('/portal/api/v1/client/bootstrap')||!runtime.includes('CLIENT_CONTEXT_SELECTION_REQUIRED'))throw new Error('CLIENT_CONTEXT_AUTHORITY_SERVER_CONTRACT_MISSING');
for(const token of ['clientContextSelect','companyDisplayName','rona:client-context-changed','RONA_CLIENT_CONTEXT','getCurrentContext','getAuthorizedContexts','whenReady','subscribe','scopedBootstrapResponse'])if(!runtime.includes(token))throw new Error(`CLIENT_CONTEXT_AUTHORITY_SELECTION_CONTRACT_MISSING: ${token}`);
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_CONTEXT_AUTHORITY_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

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
integrity.client_runtime.context_selection_authority={id,src,marker,source:'SERVER_SESSION_AUTHORITY',scope:'ALL_AUTHORIZED_CLIENT_CABINETS',selection:'EXPLICIT_AUTHORIZED_CONTEXT_OR_SINGLE_AUTO',multi_context_first_fallback:false,api_rewrite:'SELECTED_AUTHORIZED_CONTEXT',bootstrap_projection:'SELECTED_CONTEXT_ONLY_OR_EMPTY_UNTIL_SELECTION',public_api:'RONA_CLIENT_CONTEXT',execution_order:'HEAD_DEFER_BEFORE_CLIENT_CONSUMERS',company_label:'COMPACT_LEGAL_DISPLAY',legacy_context_zone:'DISPLAY_ONLY_SERVER_SYNCED',hardcoded_business_entities:false};
await writeFile(integrityPath,JSON.stringify(integrity,null,2)+'\n','utf8');
console.log(`CLIENT_CONTEXT_SELECTION_AUTHORITY=PASS marker=${marker} asset=${src} order=head-defer-before-client-consumers bootstrap=selected-only`);
