import { readFile } from 'node:fs/promises';

const html=await readFile('dist/portal/client.html','utf8');
const runtime=await readFile('dist/assets/portal-runtime/client-context-selection-authority-v1.js','utf8');
const marker='20260902-client-context-selection-authority-v1';
const id='rona-client-context-selection-authority-v1';
const homeId='rona-client-home-command-center-v2';

if(!runtime.includes(marker))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_MARKER_MISSING');
const runtimeLower=runtime.toLocaleLowerCase('ru-RU');
for(const token of ['SERVER_SESSION_AUTHORITY','companyDisplayName','clientContextSelect','CLIENT_CONTEXT_SELECTION_REQUIRED','rona:client-context-changed'])if(!runtime.includes(token))throw new Error(`CLIENT_CONTEXT_AUTHORITY_QA_TOKEN_MISSING: ${token}`);
if(!runtimeLower.includes('выбрана компания'))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_LEGACY_CONTEXT_SYNC_MISSING');
if(runtime.includes('return state.contexts[0]')||runtime.includes('return contexts[0]'))throw new Error('CLIENT_CONTEXT_AUTHORITY_MULTI_CONTEXT_FIRST_FALLBACK_FORBIDDEN');
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');
const authorityAt=html.indexOf(`id="${id}"`),homeAt=html.indexOf(`id="${homeId}"`);
if(authorityAt<0||homeAt<0||authorityAt>homeAt)throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_ORDER_INVALID');
if(!html.includes('client-context-selection-authority-v1.js?v='))throw new Error('CLIENT_CONTEXT_AUTHORITY_QA_CONTENT_ADDRESS_MISSING');
console.log('CLIENT_CONTEXT_SELECTION_AUTHORITY_QA=PASS source=SERVER_SESSION_AUTHORITY selection=AUTHORIZED_EXPLICIT_OR_SINGLE_AUTO compact_company_label=PASS legacy_context_display_only=PASS');