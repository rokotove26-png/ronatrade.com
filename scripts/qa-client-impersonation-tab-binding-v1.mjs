import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const htmlPath='dist/portal/client.html';
const runtime=await readFile(runtimePath,'utf8');
const html=await readFile(htmlPath,'utf8');
const digest=createHash('sha256').update(runtime).digest('hex').slice(0,16);

const required=[
  'RONA_CLIENT_IMPERSONATION_TAB_BINDING_V1',
  "new URLSearchParams(location.search).get('impSession')",
  'RONA_IMPERSONATION_TAB_UUID',
  "headers.set('x-rona-impersonation-tab',ronaImpersonationTab)",
  "url.pathname.startsWith('/portal/api/')",
  'const nativeFetch=(input,init)=>',
  "const BOOT='/portal/api/v1/client/bootstrap'"
];
for(const token of required)if(!runtime.includes(token))throw new Error('CLIENT_IMPERSONATION_RUNTIME_TOKEN_MISSING:'+token);

if(runtime.includes("headers.set('x-rona-impersonation-tab','")||/RONA-C\d{3}|DEAL-2026-\d{3}|FARG(?:[‘'ʼ])?ONA|PRODUCTION PETROL/iu.test(runtime.slice(runtime.indexOf('RONA_CLIENT_IMPERSONATION_TAB_BINDING_V1'),runtime.indexOf('RONA_CLIENT_IMPERSONATION_TAB_BINDING_V1')+2400))){
  throw new Error('CLIENT_IMPERSONATION_RUNTIME_HARDCODE_FORBIDDEN');
}

const expected='/assets/portal-runtime/client-context-selection-authority-v1.js?v='+digest;
if(!html.includes(expected))throw new Error('CLIENT_IMPERSONATION_EMITTED_RUNTIME_DIGEST_MISMATCH:'+expected);
const tagIndex=html.indexOf(expected);
const headClose=html.toLowerCase().indexOf('</head>');
if(tagIndex<0||headClose<0||tagIndex>headClose)throw new Error('CLIENT_IMPERSONATION_CONTEXT_AUTHORITY_NOT_IN_HEAD');

console.log('CLIENT_IMPERSONATION_TAB_BINDING_QA=PASS digest='+digest+' runtime=head-defer native_tab_binding=true');
