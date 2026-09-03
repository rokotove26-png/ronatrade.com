import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const runtimePath='dist/assets/portal-runtime/client-section-first-paint-v1.js';
const styleId='rona-client-section-first-paint-v1-style';
const scriptId='rona-client-section-first-paint-v1';
const src='/assets/portal-runtime/client-section-first-paint-v1.js?v=20260902-authoritative-empty-v3';
const marker='20260902-client-section-first-paint-v3-authoritative-empty';
const sha256=b=>createHash('sha256').update(b).digest('hex');

const runtime=await readFile(runtimePath,'utf8');
for(const required of [marker,'data-rona-client-deals-paint-ready','data-rona-client-payments-paint-ready','admin-client-server-v8','current-only-v1','finance-authoritative-v1','canonical-v8','server-authoritative-empty-v1','__RONA_CLIENT_BACKGROUND_CACHE__','rona:client:background-sections','data-rona-client-deals-empty']){
  if(!runtime.includes(required))throw new Error(`CLIENT_SECTION_FIRST_PAINT_CONTRACT_MISSING:${required}`);
}
if(/RONA-C\d{3}|DEAL-2026-\d{3}|UNIVERSAL\s+SOLYARIS|FARGONA/iu.test(runtime))throw new Error('CLIENT_SECTION_FIRST_PAINT_HARDCODED_BUSINESS_ENTITY_FORBIDDEN');

let html=await readFile(htmlPath,'utf8');
if(html.includes(`id="${styleId}"`)||html.includes(`id="${scriptId}"`)||html.includes('client-section-first-paint-v1.js'))throw new Error('CLIENT_SECTION_FIRST_PAINT_ALREADY_PRESENT');
const headClose=html.toLowerCase().lastIndexOf('</head>');
if(headClose<0)throw new Error('CLIENT_HEAD_CLOSE_MISSING');
const guard=`<style id="${styleId}">
#page-deals,#dealsPage,[data-page-panel="deals"],[data-page-id="deals"],#page-payments,#paymentsPage,[data-page-panel="payments"],[data-page-id="payments"]{position:relative}
/* Home owner-approved presentation corrections are applied in the head so stale right-side meta and the retired control contour can never flash before runtime cleanup. */
[data-rona-client-home-owner="command-center-v2"] .rona-cc-panel-meta,[data-rona-client-home-owner="command-center-v2"] .rona-cc-live-note{display:none!important}
[data-rona-client-home-owner="command-center-v2"] .rona-cc-bottom>.rona-cc-panel:nth-child(2){display:none!important}
/* Loading remains fail-closed and opaque. Once the server authoritatively confirms zero active Deals, the frozen base section stays visible and only a compact in-section notice is shown. */
html:not([data-rona-client-deals-paint-ready="true"]) #page-deals::after,html:not([data-rona-client-deals-paint-ready="true"]) #dealsPage::after,html:not([data-rona-client-deals-paint-ready="true"]) [data-page-panel="deals"]::after,html:not([data-rona-client-deals-paint-ready="true"]) [data-page-id="deals"]::after{content:"Загрузка актуальных сделок…";position:absolute;inset:0;min-height:180px;display:flex;align-items:center;justify-content:center;padding:24px;color:#dce9f3;background:#06111d;font:600 14px/1.4 system-ui,sans-serif;letter-spacing:.01em;pointer-events:all;z-index:30;text-align:center}
html[data-rona-client-deals-paint-state="empty"] #page-deals::after,html[data-rona-client-deals-paint-state="empty"] #dealsPage::after,html[data-rona-client-deals-paint-state="empty"] [data-page-panel="deals"]::after,html[data-rona-client-deals-paint-state="empty"] [data-page-id="deals"]::after{content:"Открытых сделок нет. По выбранной компании и договору активные сделки отсутствуют.";position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:min(560px,calc(100% - 48px));min-height:72px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:18px 22px;color:#dce9f3;background:rgba(5,22,36,.82);border:1px solid rgba(104,171,207,.20);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.025);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font:600 14px/1.45 system-ui,sans-serif;letter-spacing:.01em;pointer-events:none;z-index:30;text-align:center}
html[data-rona-client-deals-paint-state="empty"] #page-deals .rona-deal-card-v5,html[data-rona-client-deals-paint-state="empty"] #dealsPage .rona-deal-card-v5,html[data-rona-client-deals-paint-state="empty"] [data-page-panel="deals"] .rona-deal-card-v5,html[data-rona-client-deals-paint-state="empty"] [data-page-id="deals"] .rona-deal-card-v5,html[data-rona-client-deals-paint-state="empty"] #page-deals [data-rona-canonical-deal-id],html[data-rona-client-deals-paint-state="empty"] #dealsPage [data-rona-canonical-deal-id],html[data-rona-client-deals-paint-state="empty"] [data-page-panel="deals"] [data-rona-canonical-deal-id],html[data-rona-client-deals-paint-state="empty"] [data-page-id="deals"] [data-rona-canonical-deal-id],html[data-rona-client-deals-paint-state="empty"] #page-deals [data-rona-operations-deal-status],html[data-rona-client-deals-paint-state="empty"] #dealsPage [data-rona-operations-deal-status],html[data-rona-client-deals-paint-state="empty"] [data-page-panel="deals"] [data-rona-operations-deal-status],html[data-rona-client-deals-paint-state="empty"] [data-page-id="deals"] [data-rona-operations-deal-status],html[data-rona-client-deals-paint-state="empty"] #page-deals [data-rona-deal-projection],html[data-rona-client-deals-paint-state="empty"] #dealsPage [data-rona-deal-projection],html[data-rona-client-deals-paint-state="empty"] [data-page-panel="deals"] [data-rona-deal-projection],html[data-rona-client-deals-paint-state="empty"] [data-page-id="deals"] [data-rona-deal-projection]{display:none!important}
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
if(!html.includes('Открытых сделок нет. По выбранной компании и договору активные сделки отсутствуют.'))throw new Error('CLIENT_DEALS_AUTHORITATIVE_EMPTY_MESSAGE_MISSING');
if(!html.includes('.rona-cc-panel-meta')||!html.includes('.rona-cc-live-note')||!html.includes('.rona-cc-bottom>.rona-cc-panel:nth-child(2)'))throw new Error('CLIENT_HOME_FIRST_PAINT_PRESENTATION_GUARD_MISSING');
if(/data-rona-client-(?:deals|payments)-paint-ready[^}]*visibility\s*:\s*hidden/iu.test(html))throw new Error('CLIENT_SECTION_FIRST_PAINT_MUST_NOT_HIDE_RUNTIME_DOM');

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.section_first_paint={
  id:scriptId,src,marker,style_id:styleId,
  scope:['DEALS','PAYMENTS','HOME_FIRST_PAINT_PRESENTATION'],mode:'CURRENT_ONLY_FAIL_CLOSED_NAVIGATION_PREPAINT',
  shielding:'OPAQUE_OVERLAY_RUNTIME_DOM_REMAINS_MEASURABLE',
  home_first_paint:{right_meta:'HIDDEN_FROM_HEAD',control_contour:'HIDDEN_FROM_HEAD',runtime_cleanup_preserved:true},
  deals_release:'SERVER_AUTHORITATIVE_ACTIVE_EMPTY_OR_CANONICAL_V8_COMPOSED',
  deals_empty_state:'SERVER_CONTEXT_LOADED_AND_NO_ACTIVE_DEALS',
  deals_empty_message:'Открытых сделок нет. По выбранной компании и договору активные сделки отсутствуют.',
  deals_empty_visual:'BASE_SECTION_VISIBLE_WITH_COMPACT_IN_SECTION_NOTICE',
  payments_release:'FINANCE_AUTHORITATIVE_PLUS_CURRENT_ONLY_SANITATION',
  navigation_reset:['POINTERDOWN','CLICK','ACTIVE_SECTION_MUTATION','CONTEXT_CHANGE','BACKGROUND_PRELOAD_COMPLETE'],
  legacy_visual_flash_allowed:false,runtime_dom_visibility_preserved:true,hardcoded_business_entities:false,business_logic_changed:false,functional_empty_state_changed:true,visual_empty_state_changed:true
};
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
await writeFile(htmlPath,html,'utf8');
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_SECTION_FIRST_PAINT=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}; home=first-paint-stable; deals=current-only authoritative-empty-base-visible; payments=current-only; loading-shield=opaque-overlay; runtime_dom=measurable; legacy_flash=blocked`);
