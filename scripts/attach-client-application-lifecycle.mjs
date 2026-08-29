import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-application-lifecycle-v1.js';
const connectionRuntimePath='dist/assets/portal-runtime/client-server-connection-v1.js';
const id='rona-client-application-resource-archive-v1';
const connectionId='rona-client-server-connection-v1';
const guardId='rona-client-operations-first-paint-guard';
const src='/assets/portal-runtime/client-application-lifecycle-v1.js?v=20260830-operations-finance-authoritative-state-v6';
const connectionSrc='/assets/portal-runtime/client-server-connection-v1.js?v=20260830-server-indicator-v1';
const marker='20260830-client-operations-finance-authoritative-state-v6';
const connectionMarker='20260830-client-server-connection-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
if(!runtime.includes(marker))throw new Error(`CLIENT_APPLICATION_LIFECYCLE_MARKER_MISSING: ${marker}`);
const connectionRuntime=await readFile(connectionRuntimePath,'utf8');
if(!connectionRuntime.includes(connectionMarker))throw new Error(`CLIENT_SERVER_CONNECTION_MARKER_MISSING: ${connectionMarker}`);

let html=await readFile(htmlPath,'utf8');
if(html.includes(id)||html.includes('client-application-lifecycle-v1.js')||html.includes(guardId))throw new Error('CLIENT_APPLICATION_LIFECYCLE_BRIDGE_ALREADY_PRESENT');
if(html.includes(connectionId)||html.includes('client-server-connection-v1.js'))throw new Error('CLIENT_SERVER_CONNECTION_BRIDGE_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
const criticalGuard=`<style id="${guardId}">#page-applications,#page-deals{position:relative}html:not([data-rona-client-operations-ready="true"]) #page-applications>*,html:not([data-rona-client-operations-ready="true"]) #page-deals>*{visibility:hidden!important}html:not([data-rona-client-operations-ready="true"]) #page-applications::after,html:not([data-rona-client-operations-ready="true"]) #page-deals::after{content:"Загрузка актуальных данных…";position:absolute;inset:0;min-height:180px;display:flex;align-items:center;justify-content:center;padding:24px;color:#dce9f3;background:#06111d;font:600 14px/1.4 system-ui,sans-serif;letter-spacing:.01em;pointer-events:all;z-index:20}html[data-rona-client-operations-state="error"] #page-applications::after,html[data-rona-client-operations-state="error"] #page-deals::after{content:"Актуальные данные временно недоступны"}</style>`;
html=html.slice(0,headClose)+criticalGuard+html.slice(headClose);
const close=html.toLowerCase().lastIndexOf('</body>');
if(close<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${connectionId}" src="${connectionSrc}" defer></script><script id="${id}" src="${src}" defer></script>`;
html=html.slice(0,close)+bridge+html.slice(close);
await writeFile(htmlPath,html,'utf8');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.server_connection_indicator={id:connectionId,src:connectionSrc,marker:connectionMarker,replaces:'TOPBAR_DEALS_COUNTER',server_signal:'OBSERVED_SAME_ORIGIN_PORTAL_API_TRAFFIC',extra_network_requests:false,states:['CHECKING','ONLINE','DEGRADED','OFFLINE']};
integrity.client_runtime.application_lifecycle_bridge={id,src,marker,source:'AUTHORITATIVE_CLIENT_CONTEXT',archive_trigger:'RESOURCE_CONFIRMED',deal_status_source:'OPERATIONS_DIRECTOR/AUTHORITATIVE_DEALS',payment_status_source:'FINANCE/AUTHORITATIVE_PAYMENT_ALLOCATIONS',payment_projection:'EXTERNAL_SAFE_CONFIRMED_OR_DUE_STATE_ONLY',deal_current_status_projection:'OPERATIONS_BUSINESS_STATUS',deal_amount_presentation:'BADGE_WITHOUT_LABEL',resource_projection:'SINGLE_AUTHORITATIVE_OPERATIONS_STATUS',first_paint_guard:{id:guardId,mode:'SCOPED_AUTHORITATIVE_SECTIONS',scope:['APPLICATIONS','DEALS'],fail_closed:true,global_body_block:false}};
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_APPLICATION_LIFECYCLE_BRIDGE=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}; server connection indicator ${connectionId}; authoritative deal status/payment indicators enabled`);
