import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const docsRuntimePath='dist/assets/portal-runtime/client-deal-documents-v5.js';
const visualRuntimePath='dist/assets/portal-runtime/client-deal-canonical-visual-v2.js';
const commandCenterRuntimePath='dist/assets/portal-runtime/client-deal-command-center-v3.js';
const lifecycleRuntimePath='dist/assets/portal-runtime/client-deal-lifecycle-v1.js';

const docsId='rona-client-deal-documents-authoritative-v5';
const visualId='rona-client-deal-canonical-visual-authoritative-v2';
const commandCenterId='rona-client-deal-command-center-v3';
const lifecycleId='rona-client-deal-lifecycle-v1';
const legacyPreemptId='rona-client-deal-documents-legacy-preempt';
const docsSrc='/assets/portal-runtime/client-deal-documents-v5.js?v=20260830-single-owner-prepaint-v8';
const visualSrc='/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260830-single-owner-prepaint-v8';
const commandCenterSrc='/assets/portal-runtime/client-deal-command-center-v3.js?v=20260830-native-right-close-v3';
const lifecycleSrc='/assets/portal-runtime/client-deal-lifecycle-v1.js?v=20260830-lifecycle-v1';
const docsMarker='20260830-client-deal-documents-v6-signed-authoritative';
const visualMarker='20260830-client-deal-canonical-visual-v2-v9-signed-docs';
const commandCenterMarker='20260830-client-deal-command-center-v3-native-left';
const lifecycleMarker='20260830-client-deal-lifecycle-v1-authoritative-projection';
const legacyMarkers={
  __RONA_CLIENT_DEAL_DOCUMENTS_V1__:'20260829-deal-documents-v1-8-full-card-anchor',
  __RONA_CLIENT_DEAL_DOCUMENTS_V2__:'20260829-deal-documents-v2-universal-stable-ui-v3',
  __RONA_CLIENT_DEAL_DOCUMENTS_V3__:'20260829-client-deal-documents-v3-canonical-native-v3-2',
  __RONA_CLIENT_DEAL_DOCUMENTS_V4__:'20260829-client-deal-documents-v4-cabinet-canonical',
};
const sha256=b=>createHash('sha256').update(b).digest('hex');

const docsRuntime=await readFile(docsRuntimePath,'utf8');
const visualRuntime=await readFile(visualRuntimePath,'utf8');
const commandCenterRuntime=await readFile(commandCenterRuntimePath,'utf8');
const lifecycleRuntime=await readFile(lifecycleRuntimePath,'utf8');
if(!docsRuntime.includes(docsMarker))throw new Error(`CLIENT_DEAL_DOCUMENTS_MARKER_MISSING: ${docsMarker}`);
if(!visualRuntime.includes(visualMarker))throw new Error(`CLIENT_DEAL_VISUAL_MARKER_MISSING: ${visualMarker}`);
if(!commandCenterRuntime.includes(commandCenterMarker))throw new Error(`CLIENT_DEAL_COMMAND_CENTER_MARKER_MISSING: ${commandCenterMarker}`);
if(!lifecycleRuntime.includes(lifecycleMarker))throw new Error(`CLIENT_DEAL_LIFECYCLE_MARKER_MISSING: ${lifecycleMarker}`);
for(const required of [
  '/v1/client/bootstrap','/v1/client/context?clientId=','/v1/client/deal-documents/state?clientId=','sourceUnsignedDocumentId','/signed-addendum','SIGNED_ADDENDUM','supersedes_document_id',
]) if(!docsRuntime.includes(required)) throw new Error(`CLIENT_DEAL_DOCUMENTS_GENERIC_FLOW_MISSING: ${required}`);
for(const required of [
  'Паспорт сделки','Схема реализации сделки','Контракт и сделка','Логистика и поставка','Закрытие сделки','data-rona-command-field','DEAL CONTROL','grid-template-columns:repeat(2','coverage<5','r.height<70','onscreen','Native drawer geometry is deliberately preserved',
]) if(!commandCenterRuntime.includes(required)) throw new Error(`CLIENT_DEAL_COMMAND_CENTER_GENERIC_UI_MISSING: ${required}`);
for(const required of [
  'Жизненный цикл сделки','Оформление сделки','Подписание документов','Оплата','Подтверждение ресурса','Отгрузка и поставка','Закрывающие документы и завершение','Выполнено','Сейчас','Предстоит','Оплачено ${ev.paymentPct}% · осталось ${100-ev.paymentPct}%','cardTextOutside',
]) if(!lifecycleRuntime.includes(required)) throw new Error(`CLIENT_DEAL_LIFECYCLE_GENERIC_UI_MISSING: ${required}`);
if(lifecycleRuntime.includes('fetch('))throw new Error('CLIENT_DEAL_LIFECYCLE_NETWORK_REQUEST_FORBIDDEN');
for(const forbiddenGeometry of ['position:fixed!important','transform:translate(-50%,-50%)','width:min(1180px','height:min(800px']) if(commandCenterRuntime.includes(forbiddenGeometry)) throw new Error(`CLIENT_DEAL_NATIVE_DRAWER_GEOMETRY_OVERRIDDEN: ${forbiddenGeometry}`);
for(const forbidden of ['RONA-C003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','FARGONA GAZ','UNIVERSAL SOLYARIS']){
  if(docsRuntime.includes(forbidden)||visualRuntime.includes(forbidden)||commandCenterRuntime.includes(forbidden)||lifecycleRuntime.includes(forbidden))throw new Error(`CLIENT_DEAL_RUNTIME_CLIENT_SPECIFIC_FORBIDDEN: ${forbidden}`);
}

let html=await readFile(htmlPath,'utf8');
const dealScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-documents-v[1-5]\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const visualScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-canonical-visual-v[1-9]\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const commandCenterScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-command-center-v\d+\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const lifecycleScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-lifecycle-v\d+\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
html=html.replace(dealScriptRe,'').replace(visualScriptRe,'').replace(commandCenterScriptRe,'').replace(lifecycleScriptRe,'');

for(const id of [docsId,visualId,'rona-client-deal-command-center-v1','rona-client-deal-command-center-v2',commandCenterId,lifecycleId,legacyPreemptId]){
  const re=new RegExp(`<script\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`,'giu');
  html=html.replace(re,'');
}

const headOpen=/<head\b[^>]*>/iu.exec(html);
if(!headOpen)throw new Error('CLIENT_HEAD_OPEN_MISSING');
const guard=`<script id="${legacyPreemptId}">Object.assign(window,${JSON.stringify(legacyMarkers)});</script>`;
const headInsertAt=headOpen.index+headOpen[0].length;
html=html.slice(0,headInsertAt)+guard+html.slice(headInsertAt);

const bodyClose=html.toLowerCase().lastIndexOf('</body>');
if(bodyClose<0)throw new Error('CLIENT_BODY_CLOSE_MISSING');
const bridge=`<script id="${docsId}" src="${docsSrc}" defer></script><script id="${visualId}" src="${visualSrc}" defer></script><script id="${commandCenterId}" src="${commandCenterSrc}" defer></script><script id="${lifecycleId}" src="${lifecycleSrc}" defer></script>`;
html=html.slice(0,bodyClose)+bridge+html.slice(bodyClose);

const docsRefs=(html.match(/client-deal-documents-v5\.js/giu)||[]).length;
const oldDocsRefs=(html.match(/client-deal-documents-v[1-4]\.js/giu)||[]).length;
const visualRefs=(html.match(/client-deal-canonical-visual-v2\.js/giu)||[]).length;
const commandCenterV3Refs=(html.match(/client-deal-command-center-v3\.js/giu)||[]).length;
const commandCenterLegacyRefs=(html.match(/client-deal-command-center-v[12]\.js/giu)||[]).length;
const lifecycleRefs=(html.match(/client-deal-lifecycle-v1\.js/giu)||[]).length;
if(docsRefs!==1)throw new Error(`CLIENT_DEAL_DOCUMENTS_SINGLE_OWNER_FAILED refs=${docsRefs}`);
if(oldDocsRefs!==0)throw new Error(`CLIENT_DEAL_DOCUMENTS_LEGACY_OWNER_PRESENT refs=${oldDocsRefs}`);
if(visualRefs!==1)throw new Error(`CLIENT_DEAL_VISUAL_SINGLE_OWNER_FAILED refs=${visualRefs}`);
if(commandCenterV3Refs!==1)throw new Error(`CLIENT_DEAL_COMMAND_CENTER_V3_SINGLE_OWNER_FAILED refs=${commandCenterV3Refs}`);
if(commandCenterLegacyRefs!==0)throw new Error(`CLIENT_DEAL_COMMAND_CENTER_LEGACY_OWNER_PRESENT refs=${commandCenterLegacyRefs}`);
if(lifecycleRefs!==1)throw new Error(`CLIENT_DEAL_LIFECYCLE_SINGLE_OWNER_FAILED refs=${lifecycleRefs}`);
if(!html.includes(`id="${legacyPreemptId}"`))throw new Error('CLIENT_DEAL_DOCUMENTS_LEGACY_PREEMPT_MISSING');
for(const [key,marker] of Object.entries(legacyMarkers))if(!html.includes(key)||!html.includes(marker))throw new Error(`CLIENT_DEAL_DOCUMENTS_PREPAINT_GUARD_MISSING:${key}`);

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.deal_documents_bridge={
  id:docsId,src:docsSrc,marker:docsMarker,
  visual_id:visualId,visual_src:visualSrc,visual_marker:visualMarker,
  command_center_id:commandCenterId,command_center_src:commandCenterSrc,command_center_marker:commandCenterMarker,
  command_center_scope:'ALL_AUTHORIZED_CLIENT_DEAL_DRAWERS',command_center_data_policy:'PRESENTATION_ONLY_FROM_CURRENT_RENDERED_SERVER_PROJECTION',command_center_layout:'NATIVE_RIGHT_DRAWER_PRESERVED',command_center_close_behavior:'NATIVE_DRAWER_CONTROL_UNTOUCHED',command_center_detector:'SEMANTIC_LABEL_COVERAGE_NATIVE_DRAWER_VISIBILITY',
  lifecycle_id:lifecycleId,lifecycle_src:lifecycleSrc,lifecycle_marker:lifecycleMarker,lifecycle_scope:'ALL_AUTHORIZED_CLIENT_DEAL_DRAWERS',lifecycle_data_policy:'CURRENT_RENDERED_SERVER_PROJECTION_ONLY',lifecycle_status_model:['DONE','CURRENT','PENDING'],lifecycle_visual:'CONNECTED_VERTICAL_TIMELINE_WITH_PROGRESS',
  scope:'ALL_AUTHORIZED_CLIENT_CONTEXTS',context_source:'SERVER_CLIENT_BOOTSTRAP_AND_CONTEXT',authorization:'SERVER_CLIENT_USER_HAS_DEAL_ACCESS',upload_protocol:'MULTIPART_FILE_PLUS_SOURCE_UNSIGNED_DOCUMENT_ID',replacement_semantics:'SIGNED_ADDENDUM_SUPERSEDES_CURRENT_UNSIGNED_ADDENDUM',success_projection:['SIGNED_ADDENDUM_CURRENT','UPLOAD_DISABLED','DOCUMENTS_SIGNED'],client_specific_hardcoding:false,prepaint_single_owner:true,legacy_preempt:{id:legacyPreemptId,markers:legacyMarkers},
};
await writeFile(htmlPath,html,'utf8');
await writeFile(integrityPath,JSON.stringify(integrity));
console.log(`CLIENT_DEAL_DOCUMENTS_BRIDGE=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}; scope=ALL_AUTHORIZED_CLIENT_CONTEXTS; command_center=NATIVE_RIGHT_V3; lifecycle=CONNECTED_TIMELINE_V1; native_close=preserved; prepaint_single_owner=true; single owner=${docsId}`);
