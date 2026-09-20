import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const runtimePath='assets/portal-runtime/client-admin-impersonation-return-v1.js';
const emittedRuntimePath='dist/assets/portal-runtime/client-admin-impersonation-return-v1.js';
const scriptId='rona-client-admin-impersonation-return-v1';
const marker='RONA_CLIENT_ADMIN_IMPERSONATION_RETURN_V1';

const runtime=await readFile(runtimePath,'utf8');
for(const token of [
  marker,
  "location.pathname!=='/portal/client'",
  "new URLSearchParams(location.search).get('impSession')",
  "id='ronaReturnAdmin'",
  "/portal/admin-authority/impersonation/end",
  "'x-rona-impersonation-tab':session",
  "location.replace(target)"
])if(!runtime.includes(token))throw new Error('CLIENT_ADMIN_IMPERSONATION_RETURN_CONTRACT_MISSING:'+token);
if(/RONA-C\d{3}|DEAL-2026-\d{3}|FARG(?:[‘'ʼ])?ONA|PRODUCTION PETROL/iu.test(runtime))throw new Error('CLIENT_ADMIN_IMPERSONATION_RETURN_BUSINESS_HARDCODE_FORBIDDEN');

await writeFile(emittedRuntimePath,runtime,'utf8');
const digest=createHash('sha256').update(runtime).digest('hex').slice(0,16);
const src='/assets/portal-runtime/client-admin-impersonation-return-v1.js?v='+digest;

let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${scriptId}"`)||html.includes('client-admin-impersonation-return-v1.js'))throw new Error('CLIENT_ADMIN_IMPERSONATION_RETURN_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
const tag=`<script id="${scriptId}" src="${src}" defer></script>`;
html=html.slice(0,headClose)+tag+html.slice(headClose);
await writeFile(htmlPath,html,'utf8');

if(!html.includes(tag))throw new Error('CLIENT_ADMIN_IMPERSONATION_RETURN_ATTACH_FAILED');
console.log('CLIENT_ADMIN_IMPERSONATION_RETURN_ATTACH=PASS marker='+marker+' src='+src+' mode=STATIC_NO_SERVER_HTML_REWRITE');
