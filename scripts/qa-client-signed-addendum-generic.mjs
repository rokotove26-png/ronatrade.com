import { readFile } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');
const [html,runtime,visual,commandCenter,proxy,edge,integrityRaw,cachePolicy,...legacyRuntimes]=await Promise.all([
  read('dist/portal/client.html'),
  read('assets/portal-runtime/client-deal-documents-v5.js'),
  read('assets/portal-runtime/client-deal-canonical-visual-v2.js'),
  read('assets/portal-runtime/client-deal-command-center-v1.js'),
  read('functions/portal/api/[[path]].js'),
  read('supabase/functions/rona-client-deal-documents/index.ts'),
  read('dist/canonical-visual-integrity.json'),
  read('dist/_headers'),
  read('dist/assets/portal-runtime/client-deal-documents-v1.js'),
  read('dist/assets/portal-runtime/client-deal-documents-v2.js'),
  read('dist/assets/portal-runtime/client-deal-documents-v3.js'),
  read('dist/assets/portal-runtime/client-deal-documents-v4.js'),
]);
const integrity=JSON.parse(integrityRaw);
const must=(condition,code)=>{if(!condition)throw new Error(code)};
const count=(text,re)=>(text.match(re)||[]).length;

// One emitted runtime owner for all clients; older document bridges must not survive the current page.
must(count(html,/client-deal-documents-v5\.js/giu)===1,'SIGNED_ADDENDUM_RUNTIME_NOT_SINGLE_OWNER');
must(count(html,/client-deal-documents-v[1-4]\.js/giu)===0,'SIGNED_ADDENDUM_LEGACY_RUNTIME_PRESENT');
must(count(html,/client-deal-canonical-visual-v2\.js/giu)===1,'SIGNED_ADDENDUM_VISUAL_NOT_SINGLE_OWNER');
must(count(html,/client-deal-command-center-v1\.js/giu)===1,'DEAL_COMMAND_CENTER_NOT_SINGLE_OWNER');
must(html.includes('rona-client-deal-documents-legacy-preempt'),'SIGNED_ADDENDUM_LEGACY_PREEMPT_MISSING');
must(html.includes('20260830-single-owner-prepaint-v8'),'SIGNED_ADDENDUM_PREPAINT_CACHE_BUSTER_MISSING');
must(html.includes('20260830-command-center-v1'),'DEAL_COMMAND_CENTER_CACHE_BUSTER_MISSING');
for(const marker of [
  '__RONA_CLIENT_DEAL_DOCUMENTS_V1__',
  '__RONA_CLIENT_DEAL_DOCUMENTS_V2__',
  '__RONA_CLIENT_DEAL_DOCUMENTS_V3__',
  '__RONA_CLIENT_DEAL_DOCUMENTS_V4__',
]) must(html.includes(marker),`SIGNED_ADDENDUM_PREPAINT_GUARD_MISSING:${marker}`);

// Legacy URLs remain only as compatibility entry points for stale HTML. They are forbidden from rendering UI;
// every one must delegate to the same v5 owner and v2 visual runtime.
const retiredMarker='20260830-client-deal-documents-legacy-retired-to-v5';
must(new Set(legacyRuntimes).size===1,'SIGNED_ADDENDUM_LEGACY_COMPATIBILITY_SHIMS_DIVERGED');
legacyRuntimes.forEach((legacy,index)=>{
  const version=index+1;
  must(legacy.includes(retiredMarker),`SIGNED_ADDENDUM_LEGACY_V${version}_NOT_RETIRED`);
  must(legacy.includes('/assets/portal-runtime/client-deal-documents-v5.js?v=20260830-single-owner-prepaint-v8'),`SIGNED_ADDENDUM_LEGACY_V${version}_V5_DELEGATE_MISSING`);
  must(legacy.includes('/assets/portal-runtime/client-deal-canonical-visual-v2.js?v=20260830-single-owner-prepaint-v8'),`SIGNED_ADDENDUM_LEGACY_V${version}_VISUAL_DELEGATE_MISSING`);
  must(!legacy.includes('Загрузить подписанное ДС'),`SIGNED_ADDENDUM_LEGACY_V${version}_RENDERER_SURVIVED`);
  must(!legacy.includes('Загрузить подписанное доп. соглашение'),`SIGNED_ADDENDUM_LEGACY_V${version}_UI_TEXT_SURVIVED`);
});

// Browser flow is server-context driven, not tied to one company/deal.
for(const marker of [
  '/v1/client/bootstrap',
  '/v1/client/context?clientId=',
  '/v1/client/deal-documents/state?clientId=',
  'sourceUnsignedDocumentId',
  '/signed-addendum',
  'SIGNED_ADDENDUM',
  'supersedes_document_id',
  "client_stage:'DOCUMENTS_SIGNED'",
]) must(runtime.includes(marker),`SIGNED_ADDENDUM_BROWSER_MARKER_MISSING:${marker}`);

// Deal detail command center is semantic, presentation-only, and generic across clients/deals.
for(const marker of [
  '20260830-client-deal-command-center-v1',
  'Паспорт сделки',
  'Схема реализации сделки',
  'Контракт и сделка',
  'Документы',
  'Оплата',
  'Ресурс',
  'Логистика и поставка',
  'Закрытие сделки',
  'data-rona-command-field',
  'data-rona-command-heading',
]) must(commandCenter.includes(marker),`DEAL_COMMAND_CENTER_MARKER_MISSING:${marker}`);
must(!commandCenter.includes('/v1/client/context'),'DEAL_COMMAND_CENTER_MUST_NOT_FETCH_OR_INFER_BUSINESS_CONTEXT');
must(!commandCenter.includes('fetch('),'DEAL_COMMAND_CENTER_NETWORK_REQUEST_FORBIDDEN');
must(commandCenter.includes('PRESENTATION')===false,'DEAL_COMMAND_CENTER_RUNTIME_SHOULD_NOT_CARRY_BUSINESS_POLICY_LABELS');

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
  'RONA-C002',
  'RONA-C003',
  'DEAL-2026-004',
  'DEAL-2026-005',
  'DEAL-2026-006',
  'FARGONA GAZ',
  'UNIVERSAL SOLYARIS',
  '01/PT-01-1926',
  '01/PT-02-1926',
];
for(const value of forbidden){
  must(!runtime.includes(value),`SIGNED_ADDENDUM_RUNTIME_HARDCODED:${value}`);
  must(!visual.includes(value),`SIGNED_ADDENDUM_VISUAL_HARDCODED:${value}`);
  must(!commandCenter.includes(value),`DEAL_COMMAND_CENTER_HARDCODED:${value}`);
  must(!proxy.includes(value),`SIGNED_ADDENDUM_PROXY_HARDCODED:${value}`);
  must(!edge.includes(value),`SIGNED_ADDENDUM_EDGE_HARDCODED:${value}`);
  for(const legacy of legacyRuntimes)must(!legacy.includes(value),`SIGNED_ADDENDUM_LEGACY_COMPAT_HARDCODED:${value}`);
}

// Client page and all deal runtime URLs are non-cacheable so an old renderer
// cannot reappear after a production deploy or navigation.
for(const marker of [
  '/portal/client',
  '/assets/portal-runtime/client-deal-documents-v*.js',
  '/assets/portal-runtime/client-deal-canonical-visual-v*.js',
  '/assets/portal-runtime/client-deal-command-center-v*.js',
  'Cache-Control: no-store, no-cache, must-revalidate, max-age=0',
]) must(cachePolicy.includes(marker),`CLIENT_DEAL_CACHE_POLICY_MISSING:${marker}`);

const bridge=integrity?.client_runtime?.deal_documents_bridge;
must(bridge?.scope==='ALL_AUTHORIZED_CLIENT_CONTEXTS','SIGNED_ADDENDUM_SCOPE_NOT_GENERIC');
must(bridge?.authorization==='SERVER_CLIENT_USER_HAS_DEAL_ACCESS','SIGNED_ADDENDUM_AUTH_SCOPE_NOT_SERVER');
must(bridge?.client_specific_hardcoding===false,'SIGNED_ADDENDUM_HARDCODING_GUARD_MISSING');
must(bridge?.prepaint_single_owner===true,'SIGNED_ADDENDUM_PREPAINT_SINGLE_OWNER_MISSING');
must(bridge?.replacement_semantics==='SIGNED_ADDENDUM_SUPERSEDES_CURRENT_UNSIGNED_ADDENDUM','SIGNED_ADDENDUM_REPLACEMENT_SEMANTICS_MISSING');
must(bridge?.command_center_scope==='ALL_AUTHORIZED_CLIENT_DEAL_DRAWERS','DEAL_COMMAND_CENTER_SCOPE_NOT_GENERIC');
must(bridge?.command_center_data_policy==='PRESENTATION_ONLY_FROM_CURRENT_RENDERED_SERVER_PROJECTION','DEAL_COMMAND_CENTER_DATA_POLICY_INVALID');
must(bridge?.command_center_marker==='20260830-client-deal-command-center-v1','DEAL_COMMAND_CENTER_INTEGRITY_MARKER_MISSING');

console.log('CLIENT_SIGNED_ADDENDUM_GENERIC_QA=PASS scope=ALL_AUTHORIZED_CLIENT_CONTEXTS; client deal command center=ALL_AUTHORIZED_CLIENT_DEAL_DRAWERS; presentation-only; no client/deal hardcoding; no-store cache policy; signed document supersedes current unsigned addendum');
