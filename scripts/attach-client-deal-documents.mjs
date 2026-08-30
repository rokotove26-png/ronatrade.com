import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const htmlPath='dist/portal/client.html';
const integrityPath='dist/canonical-visual-integrity.json';
const docsRuntimePath='dist/assets/portal-runtime/client-deal-documents-v5.js';
const visualRuntimePath='dist/assets/portal-runtime/client-deal-canonical-visual-v2.js';

const docsId='rona-client-deal-documents-authoritative-v5';
const visualId='rona-client-deal-canonical-visual-authoritative-v2';
const legacyPreemptId='rona-client-deal-documents-legacy-preempt';
const docsSrc='/assets/portal-runtime/client-deal-documents-v5.js?v=20260830-single-owner-prepaint-v8';
const visualSrc='/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260830-single-owner-prepaint-v8';
const docsMarker='20260830-client-deal-documents-v6-signed-authoritative';
const visualMarker='20260830-client-deal-canonical-visual-v2-v9-signed-docs';
const legacyMarkers={
  __RONA_CLIENT_DEAL_DOCUMENTS_V1__:'20260829-deal-documents-v1-8-full-card-anchor',
  __RONA_CLIENT_DEAL_DOCUMENTS_V2__:'20260829-deal-documents-v2-universal-stable-ui-v3',
  __RONA_CLIENT_DEAL_DOCUMENTS_V3__:'20260829-client-deal-documents-v3-canonical-native-v3-2',
  __RONA_CLIENT_DEAL_DOCUMENTS_V4__:'20260829-client-deal-documents-v4-cabinet-canonical',
};
const sha256=b=>createHash('sha256').update(b).digest('hex');

const docsRuntime=await readFile(docsRuntimePath,'utf8');
const visualRuntime=await readFile(visualRuntimePath,'utf8');
if(!docsRuntime.includes(docsMarker))throw new Error(`CLIENT_DEAL_DOCUMENTS_MARKER_MISSING: ${docsMarker}`);
if(!visualRuntime.includes(visualMarker))throw new Error(`CLIENT_DEAL_VISUAL_MARKER_MISSING: ${visualMarker}`);
for(const required of [
  '/v1/client/bootstrap',
  '/v1/client/context?clientId=',
  '/v1/client/deal-documents/state?clientId=',
  'sourceUnsignedDocumentId',
  '/signed-addendum',
  'SIGNED_ADDENDUM',
  'supersedes_document_id',
]) if(!docsRuntime.includes(required)) throw new Error(`CLIENT_DEAL_DOCUMENTS_GENERIC_FLOW_MISSING: ${required}`);
for(const forbidden of ['RONA-C003','DEAL-2026-005','DEAL-2026-006','UNIVERSAL SOLYARIS']){
  if(docsRuntime.includes(forbidden)||visualRuntime.includes(forbidden))throw new Error(`CLIENT_DEAL_DOCUMENTS_CLIENT_SPECIFIC_RUNTIME_FORBIDDEN: ${forbidden}`);
}

let html=await readFile(htmlPath,'utf8');

// The frozen current client is not edited in-place. During build, retire every older
// deal-document/visual bridge from the emitted client and attach one authoritative,
// client-agnostic owner. This applies to every authenticated CLIENT context returned
// by the server, not to a named company, contract, or deal.
const dealScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-documents-v[1-5]\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
const visualScriptRe=/<script\b[^>]*\bsrc\s*=\s*["'][^"']*\/assets\/portal-runtime\/client-deal-canonical-visual-v[1-9]\.js(?:\?[^"']*)?["'][^>]*>\s*<\/script>/giu;
html=html.replace(dealScriptRe,'').replace(visualScriptRe,'');

for(const id of [docsId,visualId,legacyPreemptId]){
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
const bridge=`<script id="${docsId}" src="${docsSrc}" defer></script><script id="${visualId}" src="${visualSrc}" defer></script>`;
html=html.slice(0,bodyClose)+bridge+html.slice(bodyClose);

const docsRefs=(html.match(/client-deal-documents-v5\.js/giu)||[]).length;
const oldDocsRefs=(html.match(/client-deal-documents-v[1-4]\.js/giu)||[]).length;
const visualRefs=(html.match(/client-deal-canonical-visual-v2\.js/giu)||[]).length;
if(docsRefs!==1)throw new Error(`CLIENT_DEAL_DOCUMENTS_SINGLE_OWNER_FAILED refs=${docsRefs}`);
if(oldDocsRefs!==0)throw new Error(`CLIENT_DEAL_DOCUMENTS_LEGACY_OWNER_PRESENT refs=${oldDocsRefs}`);
if(visualRefs!==1)throw new Error(`CLIENT_DEAL_VISUAL_SINGLE_OWNER_FAILED refs=${visualRefs}`);
if(!html.includes(`id="${legacyPreemptId}"`))throw new Error('CLIENT_DEAL_DOCUMENTS_LEGACY_PREEMPT_MISSING');
for(const [key,marker] of Object.entries(legacyMarkers)){
  if(!html.includes(key)||!html.includes(marker))throw new Error(`CLIENT_DEAL_DOCUMENTS_PREPAINT_GUARD_MISSING:${key}`);
}

const emitted=Buffer.from(html,'utf8');
const integrity=JSON.parse(await readFile(integrityPath,'utf8'));
integrity.client_runtime.emitted_sha256=sha256(emitted);
integrity.client_runtime.emitted_bytes=emitted.length;
integrity.client_runtime.deal_documents_bridge={
  id:docsId,
  src:docsSrc,
  marker:docsMarker,
  visual_id:visualId,
  visual_src:visualSrc,
  visual_marker:visualMarker,
  scope:'ALL_AUTHORIZED_CLIENT_CONTEXTS',
  context_source:'SERVER_CLIENT_BOOTSTRAP_AND_CONTEXT',
  authorization:'SERVER_CLIENT_USER_HAS_DEAL_ACCESS',
  upload_protocol:'MULTIPART_FILE_PLUS_SOURCE_UNSIGNED_DOCUMENT_ID',
  replacement_semantics:'SIGNED_ADDENDUM_SUPERSEDES_CURRENT_UNSIGNED_ADDENDUM',
  success_projection:['SIGNED_ADDENDUM_CURRENT','UPLOAD_DISABLED','DOCUMENTS_SIGNED'],
  client_specific_hardcoding:false,
  prepaint_single_owner:true,
  legacy_preempt:{id:legacyPreemptId,markers:legacyMarkers},
};
await writeFile(htmlPath,html,'utf8');
await writeFile(integrityPath,JSON.stringify(integrity));

console.log(`CLIENT_DEAL_DOCUMENTS_BRIDGE=PASS sha256=${integrity.client_runtime.emitted_sha256} bytes=${emitted.length}; scope=ALL_AUTHORIZED_CLIENT_CONTEXTS; prepaint_single_owner=true; single owner=${docsId}`);
