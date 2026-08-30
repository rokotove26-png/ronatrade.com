import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-section-first-paint-v1.js';
const styleId='rona-client-section-first-paint-v1-style';
const scriptId='rona-client-section-first-paint-v1';
const src='/assets/portal-runtime/client-section-first-paint-v1.js?v=20260830-current-only-no-legacy-flash-v1';
const marker='20260830-client-section-first-paint-v1';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [marker,'data-rona-client-deals-paint-ready','data-rona-client-payments-paint-ready','admin-client-server-v8','current-only-v1','finance-authoritative-v1','canonical-v8']){
  if(!runtime.includes(required))throw new Error(`CLIENT_SECTION_FIRST_PAINT_CONTRACT_MISSING:${required}`);
}
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_SECTION_FIRST_PAINT_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${styleId}"`)||html.includes(`id="${scriptId}"`)||html.includes('client-section-first-paint-v1.js'))throw new Error('CLIENT_SECTION_FIRST_PAINT_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
const guard=`<style id="${styleId}">
#page-deals,#dealsPage,[data-page-panel="deals"],[data-page-id="deals"],#page-payments,#paymentsPage,[data-page-panel="payments"],[data-page-id="payments"]{position:relative}
/* Keep the underlying DOM measurable and semantically visible to current runtime scanners. The opaque overlay, not visibility:hidden, blocks legacy pixels. */
html:not([data-rona-client-deals-paint-ready="true"]) #page-deals::after,html:not([data-rona-client-deals-paint-ready="true"]) #dealsPage::after,html:not([data-rona-client-deals-paint-ready="true"]) [data-page-panel="deals"]::after,html:not([data-rona-client-deals-paint-ready="true"]) [data-page-id="deals"]::after{content:"Загрузка актуальных сделок…";position:absolute;inset:0;min-height:180px;display:flex;align-items:center;justify-content:center;padding:24px;color:#dce9f3;background:#06111d;font:600 14px/1.4 system-ui,sans-serif;letter-spacing:.01em;pointer-events:all;z-index:30}
html[data-rona-client-deals-paint-state="error"] #page-deals::after,html[data-rona-client-deals-paint-state="error"] #dealsPage::after,html[data-rona-client-deals-paint-state="error"] [data-page-panel="deals"]::after,html[data-rona-client-deals-paint-state="error"] [data-page-id="deals"]::after{content:"Актуальные данные сделок временно недоступны"}
html:not([data-rona-client-payments-paint-ready="true"]) #page-payments::after,html:not([data-rona-client-payments-paint-ready="true"]) #paymentsPage::after,html:not([data-rona-client-payments-paint-ready="true"]) [data-page-panel="payments"]::after,html:not([data-rona-client-payments-paint-ready="true"]) [data-page-id="payments"]::after{content:"Загрузка актуальных платежных данных…";position:absolute;inset:0;min-height:180px;display:flex;align-items:center;justify-content:center;padding:24px;color:#dce9f3;background:#06111d;font:600 14px/1.4 system-ui,sans-serif;letter-spacing:.01em;pointer-events:all;z-index:30}
html[data-rona-client-payments-paint-state="error"] #page-payments::after,html[data-rona-client-payments-paint-state="error"] #paymentsPage::after,html[data-rona-client-payments-paint-state="error"] [data-page-panel="payments"]::after,html[data-rona-client-payments-paint-state="error"] [data-page-id="payments"]::after{content:"Актуальные платежные данные временно недоступны"}
</style>`;
html=html.slice(0,headClose)+guard+html.slice(headClose);
const bodyClose=html.toLowerCase().lastIndexOf('</body>');
if(bodyClose<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${scriptId}" src="${src}" defer></script>`;
html=html.slice(0,bodyClose)+bridge+html.slice(bodyClose);

if((html.match(/client-section-first-paint-v1\.js/gu)||[]).length!==1)throw new Error('CLIENT_SECTION_FIRST_PAINT_SINGLE_OWNER_FAILED');
if(!html.includes('data-rona-client-deals-paint-ready')||!html.includes('data-rona-client-payments-paint-ready'))throw new Error('CLIENT_SECTION_FIRST_PAINT_GUARD_MISSING');
if(/data-rona-client-(?:deals|payments)-paint-ready[^}]*visibility\s*:\s*hidden/iu.test(html))throw new Error('CLIENT_SECTION_FIRST_PAINT_MUST_NOT_HIDE_RUNTIME_DOM');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.section_first_paint={
  id:scriptId,src,marker,style_id:styleId,
  scope:['DEALS','PAYMENTS'],mode:'CURRENT_ONLY_FAIL_CLOSED_NAVIGATION_PREPAINT',
  shielding:'OPAQUE_OVERLAY_RUNTIME_DOM_REMAINS_MEASURABLE',
  deals_release:'SERVER_AUTHORITATIVE_PLUS_CANONICAL_V8_COMPOSED',
  payments_release:'FINANCE_AUTHORITATIVE_PLUS_CURRENT_ONLY_SANITATION',
  navigation_reset:['POINTERDOWN','CLICK','ACTIVE_SECTION_MUTATION'],
  legacy_visual_flash_allowed:false,runtime_dom_visibility_preserved:true,hardcoded_business_entities:false,business_logic_changed:false
};
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(htmlPath,html,'utf8');
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_SECTION_FIRST_PAINT=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}; deals=current-only; payments=current-only; shielding=opaque-overlay; runtime_dom=measurable; legacy_flash=blocked`);
