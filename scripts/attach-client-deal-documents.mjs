import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const docsRuntimePath='dist/assets/portal-runtime/client-deal-documents-v5.js';
const visualRuntimePath='dist/assets/portal-runtime/client-deal-canonical-visual-v2.js';
const passportRuntimePath='dist/assets/portal-runtime/client-deal-passport-v1.js';
const lifecycleRuntimePath='dist/assets/portal-runtime/client-deal-lifecycle-v1.js';

const docsId='rona-client-deal-documents-authoritative-v5';
const visualId='rona-client-deal-canonical-visual-authoritative-v2';
const passportId='rona-client-deal-passport-v1';
const lifecycleId='rona-client-deal-lifecycle-v1';
const legacyPreemptId='rona-client-deal-documents-legacy-preempt';
const docsSrc='/assets/portal-runtime/client-deal-documents-v5.js?v=20260830-single-owner-prepaint-v8';
const visualSrc='/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260830-single-owner-prepaint-v8';
const passportSrc='/assets/portal-runtime/client-deal-passport-v1.js?v=20260831-status-center-v2';
const lifecycleSrc='/assets/portal-runtime/client-deal-lifecycle-v1.js?v=20260831-realization-single-owner-v3';
const docsMarker='20260830-client-deal-documents-v6-signed-authoritative';
const visualMarker='20260830-client-deal-canonical-visual-v2-v9-signed-docs';
const passportMarker='20260831-client-deal-passport-v2-status-center';
const lifecycleMarker='20260831-client-deal-realization-status-v3-single-owner';
const legacyMarkers={
  __RONA_CLIENT_DEAL_DOCUMENTS_V1__:'20260829-deal-documents-v1-8-full-card-anchor',
  __RONA_CLIENT_DEAL_DOCUMENTS_V2__:'20260829-deal-documents-v2-universal-stable-ui-v3',
  __RONA_CLIENT_DEAL_DOCUMENTS_V3__:'20260829-client-deal-documents-v3-canonical-native-v3-2',
  __RONA_CLIENT_DEAL_DOCUMENTS_V4__:'20260829-client-deal-documents-v4-cabinet-canonical',
};
const sha256=b=>createHash('sha256').update(b).digest('hex');

const docsRuntime=await readFile(docsRuntimePath,'utf8');
const visualRuntime=await readFile(visualRuntimePath,'utf8');
const passportRuntime=await readFile(passportRuntimePath,'utf8');
const lifecycleRuntime=await readFile(lifecycleRuntimePath,'utf8');
if(!docsRuntime.includes(docsMarker))throw new Error(`CLIENT_DEAL_DOCUMENTS_MARKER_MISSING: ${docsMarker}`);
if(!visualRuntime.includes(visualMarker))throw new Error(`CLIENT_DEAL_VISUAL_MARKER_MISSING: ${visualMarker}`);
if(!passportRuntime.includes(passportMarker))throw new Error(`CLIENT_DEAL_PASSPORT_MARKER_MISSING: ${passportMarker}`);
if(!lifecycleRuntime.includes(lifecycleMarker))throw new Error(`CLIENT_DEAL_REALIZATION_STATUS_MARKER_MISSING: ${lifecycleMarker}`);
for(const required of ['/v1/client/bootstrap','/v1/client/context?clientId=','/v1/client/deal-documents/state?clientId=','sourceUnsignedDocumentId','/signed-addendum','SIGNED_ADDENDUM','supersedes_document_id'])
  if(!docsRuntime.includes(required))throw new Error(`CLIENT_DEAL_DOCUMENTS_GENERIC_FLOW_MISSING: ${required}`);
for(const required of ['Паспорт сделки','data-rona-command-field','DEAL CONTROL','grid-template-columns:repeat(2','coverage<5','r.height<70','onscreen','passport-only'])
  if(!passportRuntime.includes(required))throw new Error(`CLIENT_DEAL_PASSPORT_GENERIC_UI_MISSING: ${required}`);
for(const forbidden of ['Схема реализации сделки','Контракт и сделка','function stageData(','function renderFlow(','rona-deal-flow-v3__grid','setInterval(schedule,2200)'])
  if(passportRuntime.includes(forbidden))throw new Error(`RETIRED_DEAL_REALIZATION_RENDERER_REMAINS:${forbidden}`);
for(const required of ['Статус реализации','Оформление сделки','Подписание документов','Подтверждение ресурса','Оплата','Отгрузка и поставка','Закрывающие документы и завершение','Выполнено','В работе','Предстоит','Требует решения','/v1/client/bootstrap','/v1/client/deal-documents/state?clientId=','SERVER_AUTHORITATIVE_REALIZATION_V1','REFRESH_MS=7000',"const STAGE_ORDER=['contract','documents','resource','payment','logistics','close']",'function ensureFlow(root)',"ronaRealizationOwner='server-authoritative-v3'"])
  if(!lifecycleRuntime.includes(required))throw new Error(`CLIENT_DEAL_REALIZATION_STATUS_GENERIC_UI_MISSING: ${required}`);
for(const forbiddenInference of ['function evidence(','function lifecycle(','cardTextOutside','fieldValue(root','resourceDone=','paymentPct=pctMatch','Статусы формируются из текущей карточки сделки'])
  if(lifecycleRuntime.includes(forbiddenInference))throw new Error(`CLIENT_DEAL_REALIZATION_LOCAL_BUSINESS_INFERENCE_FORBIDDEN: ${forbiddenInference}`);
for(const forbiddenGeometry of ['position:fixed!important','transform:translate(-50%,-50%)','width:min(1180px','height:min(800px'])
  if(passportRuntime.includes(forbiddenGeometry))throw new Error(`CLIENT_DEAL_NATIVE_DRAWER_GEOMETRY_OVERRIDDEN: ${forbiddenGeometry}`);
for(const forbidden of ['RONA-C003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','FARGONA GAZ','UNIVERSAL SOLYARIS'])
  if(docsRuntime.includes(forbidden)||visualRuntime.includes(forbidden)||passportRuntime.includes(forbidden)||lifecycleRuntime.includes(forbidden))throw new Error(`CLIENT_DEAL_RUNTIME_CLIENT_SPECIFIC_FORBIDDEN: ${forbidden}`);

let html=await readFile(htmlPath,'utf8');
const dealScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-documents-v[1-5]\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const visualScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-canonical-visual-v[1-9]\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const retiredCommandCenterScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-command-center-v\d+\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const passportScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-passport-v\d+\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const lifecycleScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-lifecycle-v\d+\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
html=html.replace(dealScriptRe,'').replace(visualScriptRe,'').replace(retiredCommandCenterScriptRe,'').replace(passportScriptRe,'').replace(lifecycleScriptRe,'');

for(const id of [docsId,visualId,'rona-client-deal-command-center-v1','rona-client-deal-command-center-v2','rona-client-deal-command-center-v3',passportId,lifecycleId,legacyPreemptId]){
  const re=new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`,'giu');html=html.replace(re,'');
}
const headOpen=/<head\b[^>]*>/iu.exec(html);if(!headOpen)throw new Error('CLIENT_HEAD_OPEN_MISSING');
const guard=`<script id="${legacyPreemptId}">Object.assign(window,${JSON.stringify(legacyMarkers)});</script>`;
const headInsertAt=headOpen.index+headOpen[0].length;html=html.slice(0,headInsertAt)+guard+html.slice(headInsertAt);
const bodyClose=html.toLowerCase().lastIndexOf('</body>');if(bodyClose<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${docsId}" src="${docsSrc}" defer></script><script id="${visualId}" src="${visualSrc}" defer></script><script id="${passportId}" src="${passportSrc}" defer></script><script id="${lifecycleId}" src="${lifecycleSrc}" defer></script>`;
html=html.slice(0,bodyClose)+bridge+html.slice(bodyClose);

const docsRefs=(html.match(/client-deal-documents-v5\.js/giu)||[]).length;
const oldDocsRefs=(html.match(/client-deal-documents-v[1-4]\.js/giu)||[]).length;
const visualRefs=(html.match(/client-deal-canonical-visual-v2\.js/giu)||[]).length;
const retiredCommandCenterRefs=(html.match(/client-deal-command-center-v\d+\.js/giu)||[]).length;
const passportRefs=(html.match(/client-deal-passport-v1\.js/giu)||[]).length;
const lifecycleRefs=(html.match(/client-deal-lifecycle-v1\.js/giu)||[]).length;
if(docsRefs!==1)throw new Error(`CLIENT_DEAL_DOCUMENTS_SINGLE_OWNER_FAILED refs=${docsRefs}`);
if(oldDocsRefs!==0)throw new Error(`CLIENT_DEAL_DOCUMENTS_LEGACY_OWNER_PRESENT refs=${oldDocsRefs}`);
if(visualRefs!==1)throw new Error(`CLIENT_DEAL_VISUAL_SINGLE_OWNER_FAILED refs=${visualRefs}`);
if(retiredCommandCenterRefs!==0)throw new Error(`RETIRED_DEAL_COMMAND_CENTER_PRESENT refs=${retiredCommandCenterRefs}`);
if(passportRefs!==1)throw new Error(`CLIENT_DEAL_PASSPORT_SINGLE_OWNER_FAILED refs=${passportRefs}`);
if(lifecycleRefs!==1)throw new Error(`CLIENT_DEAL_REALIZATION_STATUS_SINGLE_OWNER_FAILED refs=${lifecycleRefs}`);
if(!html.includes(`id="${legacyPreemptId}"`))throw new Error('CLIENT_DEAL_DOCUMENTS_LEGACY_PREEMPT_MISSING');
for(const [key,marker] of Object.entries(legacyMarkers))if(!html.includes(key)||!html.includes(marker))throw new Error(`CLIENT_DEAL_DOCUMENTS_PREPAINT_GUARD_MISSING:${key}`);

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.deal_documents_bridge={
  id:docsId,src:docsSrc,marker:docsMarker,
  visual_id:visualId,visual_src:visualSrc,visual_marker:visualMarker,
  passport_id:passportId,passport_src:passportSrc,passport_marker:passportMarker,passport_scope:'ALL_AUTHORIZED_CLIENT_DEAL_DRAWERS',passport_data_policy:'PRESENTATION_ONLY_FROM_CURRENT_RENDERED_SERVER_PROJECTION',passport_layout:'NATIVE_RIGHT_DRAWER_PRESERVED',passport_close_behavior:'NATIVE_DRAWER_CONTROL_UNTOUCHED',passport_detector:'SEMANTIC_LABEL_COVERAGE_NATIVE_DRAWER_VISIBILITY',
  lifecycle_id:lifecycleId,lifecycle_src:lifecycleSrc,lifecycle_marker:lifecycleMarker,lifecycle_scope:'ALL_AUTHORIZED_CLIENT_DEAL_DRAWERS',lifecycle_data_policy:'SERVER_AUTHORITATIVE_DEAL_STATE_ONLY',lifecycle_source:'CLIENT_DEAL_DOCUMENTS_STATE_API',lifecycle_status_model:['DONE','CURRENT','PENDING','BLOCKED'],lifecycle_visual:'CONNECTED_VERTICAL_TIMELINE_WITH_PROGRESS',lifecycle_refresh:'7000MS_PLUS_FOCUS_AND_VISIBILITY',lifecycle_fail_closed:true,lifecycle_single_owner:true,lifecycle_host_owner:'SERVER_AUTHORITATIVE_V3',retired_local_realization_renderer:'PHYSICALLY_REMOVED',
  scope:'ALL_AUTHORIZED_CLIENT_CONTEXTS',context_source:'SERVER_CLIENT_BOOTSTRAP_AND_CONTEXT',authorization:'SERVER_CLIENT_USER_HAS_DEAL_ACCESS',upload_protocol:'MULTIPART_FILE_PLUS_SOURCE_UNSIGNED_DOCUMENT_ID',replacement_semantics:'SIGNED_ADDENDUM_SUPERSEDES_CURRENT_UNSIGNED_ADDENDUM',success_projection:['SIGNED_ADDENDUM_CURRENT','UPLOAD_DISABLED','DOCUMENTS_SIGNED'],client_specific_hardcoding:false,prepaint_single_owner:true,legacy_preempt:{id:legacyPreemptId,markers:legacyMarkers},
};
await writeFile(htmlPath,html,'utf8');await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_DEAL_DOCUMENTS_BRIDGE=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}; scope=ALL_AUTHORIZED_CLIENT_CONTEXTS; passport=PRESENTATION_ONLY_V1; realization_status=SERVER_AUTHORITATIVE_SINGLE_OWNER_V3; native_close=preserved; retired_local_realization_renderer=removed; single owner=${docsId}`);