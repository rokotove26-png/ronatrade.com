import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-application-lifecycle-v1.js';
const id='rona-client-application-resource-archive-v1';
const guardId='rona-client-operations-first-paint-guard';
const src='/assets/portal-runtime/client-application-lifecycle-v1.js?v=20260829-operations-authoritative-state-v5';
const marker='20260829-client-operations-authoritative-state-v5';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_APPLICATION_LIFECYCLE_MARKER_MISSING: ${marker}`);

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-application-lifecycle-v1.js')||html.includes(guardId))throw new Error('CLIENT_APPLICATION_LIFECYCLE_BRIDGE_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
const criticalGuard=`<style id="${guardId}">html:not([data-rona-client-operations-ready="true"]) body::after{content:"";position:fixed;inset:0;z-index:2147483647;background:#06111d;pointer-events:all}html[data-rona-client-operations-state="error"] body::after{content:"Актуальные данные временно недоступны";display:flex;align-items:center;justify-content:center;padding:24px;color:#dce9f3;font:600 14px/1.4 system-ui,sans-serif;letter-spacing:.01em}</style>`;
html=html.slice(0,headClose)+criticalGuard+html.slice(headClose);
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.application_lifecycle_bridge={id,src,marker,source:'AUTHORITATIVE_CLIENT_CONTEXT',archive_trigger:'RESOURCE_CONFIRMED',deal_status_source:'OPERATIONS_DIRECTOR/AUTHORITATIVE_DEALS',deal_amount_presentation:'BADGE_WITHOUT_LABEL',resource_projection:'SINGLE_AUTHORITATIVE_OPERATIONS_STATUS',first_paint_guard:{id:guardId,mode:'AUTHORITATIVE_BEFORE_REVEAL',fail_closed:true}};
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_APPLICATION_LIFECYCLE_BRIDGE=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}`);
