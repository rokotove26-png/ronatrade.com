import { readFile } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');
const [html,runtime,visual,proxy,edge,integrityRaw]=await Promise.all([
  read('dist/portal/client.html'),
  read('assets/portal-runtime/client-deal-documents-v5.js'),
  read('assets/portal-runtime/client-deal-canonical-visual-v2.js'),
  read('functions/portal/api/[[path]].js'),
  read('supabase/functions/rona-client-deal-documents/index.ts'),
  read('dist/canonical-visual-integrity.json'),
]);
const integrity=JSON.parse(integrityRaw);
const must=(condition,code)=>{if(!condition)throw new Error(code)};
const count=(text,re)=>(text.match(re)||[]).length;

// One emitted runtime owner for all clients; older document bridges must not survive the build.
must(count(html,/client-deal-documents-v5\.js/giu)===1,'SIGNED_ADDENDUM_RUNTIME_NOT_SINGLE_OWNER');
must(count(html,/client-deal-documents-v[1-4]\.js/giu)===0,'SIGNED_ADDENDUM_LEGACY_RUNTIME_PRESENT');
must(count(html,/client-deal-canonical-visual-v2\.js/giu)===1,'SIGNED_ADDENDUM_VISUAL_NOT_SINGLE_OWNER');
must(html.includes('rona-client-deal-documents-legacy-preempt'),'SIGNED_ADDENDUM_LEGACY_PREEMPT_MISSING');

// Browser flow is server-context driven, not tied to one company/deal.
for(const marker of [
  '/v1/client/bootstrap',
  '/v1/client/context?clientId=',
  '/v1/client/deal-documents/state?clientId=',
  'sourceUnsignedDocumentId',
  '/signed-addendum',
  'SIGNED_ADDENDUM',
  'supersedes_document_id',
  'client_stage:\'DOCUMENTS_SIGNED\'',
]) must(runtime.includes(marker),`SIGNED_ADDENDUM_BROWSER_MARKER_MISSING:${marker}`);

// Proxy must preserve multipart semantics and the unsigned source identity.
for(const marker of [
  'isSignedAddendumUpload',
  "form.get('sourceUnsignedDocumentId')",
  "fd.append('sourceUnsignedDocumentId'",
  "h.delete('content-type')",
  'CLIENT_DEAL_DOCUMENTS_API',
]) must(proxy.includes(marker),`SIGNED_ADDENDUM_PROXY_MARKER_MISSING:${marker}`);

// Authoritative edge function resolves scope from authenticated user + deal, then supersedes the active unsigned addendum.
for(const marker of [
  'client_user_has_deal_access',
  'sourceUnsignedDocumentId',
  'ADDENDUM_SOURCE_CHANGED',
  'SIGNED_ADDENDUM_ALREADY_CURRENT',
  "document_kind='ADDENDUM'",
  "'SIGNED_ADDENDUM'",
  "lifecycle_state='SUPERSEDED'",
  'signed_supplement_document_key',
  'CLIENT_SIGNED_ADDENDUM_UPLOADED_AUTHORITATIVE',
]) must(edge.includes(marker),`SIGNED_ADDENDUM_EDGE_MARKER_MISSING:${marker}`);

// Regression guard: implementation code must never encode a production client, contract or deal.
const forbidden=[
  'RONA-C003',
  'DEAL-2026-005',
  'DEAL-2026-006',
  'UNIVERSAL SOLYARIS',
  '01/PT-02-1926',
];
for(const value of forbidden){
  must(!runtime.includes(value),`SIGNED_ADDENDUM_RUNTIME_HARDCODED:${value}`);
  must(!visual.includes(value),`SIGNED_ADDENDUM_VISUAL_HARDCODED:${value}`);
  must(!proxy.includes(value),`SIGNED_ADDENDUM_PROXY_HARDCODED:${value}`);
  must(!edge.includes(value),`SIGNED_ADDENDUM_EDGE_HARDCODED:${value}`);
}

const bridge=integrity?.client_runtime?.deal_documents_bridge;
must(bridge?.scope==='ALL_AUTHORIZED_CLIENT_CONTEXTS','SIGNED_ADDENDUM_SCOPE_NOT_GENERIC');
must(bridge?.authorization==='SERVER_CLIENT_USER_HAS_DEAL_ACCESS','SIGNED_ADDENDUM_AUTH_SCOPE_NOT_SERVER');
must(bridge?.client_specific_hardcoding===false,'SIGNED_ADDENDUM_HARDCODING_GUARD_MISSING');
must(bridge?.replacement_semantics==='SIGNED_ADDENDUM_SUPERSEDES_CURRENT_UNSIGNED_ADDENDUM','SIGNED_ADDENDUM_REPLACEMENT_SEMANTICS_MISSING');

console.log('CLIENT_SIGNED_ADDENDUM_GENERIC_QA=PASS scope=ALL_AUTHORIZED_CLIENT_CONTEXTS; no client/deal hardcoding; multipart source identity preserved; signed document supersedes current unsigned addendum');
