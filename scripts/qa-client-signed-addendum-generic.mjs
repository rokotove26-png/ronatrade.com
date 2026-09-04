import { access, readFile } from 'node:fs/promises';

const read=p=>readFile(p,'utf8');
const [html,runtime,visual,passport,lifecycle,proxy,edge,integrityRaw,cachePolicy]=await Promise.all([
  read('dist/portal/client.html'),
  read('assets/portal-runtime/client-deal-documents-v5.js'),
  read('assets/portal-runtime/client-deal-canonical-visual-v2.js'),
  read('assets/portal-runtime/client-deal-passport-v1.js'),
  read('assets/portal-runtime/client-deal-lifecycle-v1.js'),
  read('functions/portal/api/[[path]].js'),
  read('supabase/functions/rona-client-deal-documents/index.ts'),
  read('dist/canonical-visual-integrity.json'),
  read('dist/_headers'),
]);
const integrity=JSON.parse(integrityRaw);
const must=(condition,code)=>{if(!condition)throw new Error(code)};
const count=(text,re)=>(text.match(re)||[]).length;

must(count(html,/client-deal-documents-v5\.js/giu)===1,'SIGNED_ADDENDUM_RUNTIME_NOT_SINGLE_OWNER');
must(count(html,/client-deal-documents-v[1-4]\.js/giu)===0,'SIGNED_ADDENDUM_LEGACY_RUNTIME_PRESENT');
must(count(html,/client-deal-canonical-visual-v2\.js/giu)===1,'SIGNED_ADDENDUM_VISUAL_NOT_SINGLE_OWNER');
must(count(html,/client-deal-passport-v1\.js/giu)===1,'DEAL_PASSPORT_NOT_SINGLE_OWNER');
must(count(html,/client-deal-command-center-v\d+\.js/giu)===0,'RETIRED_DEAL_COMMAND_CENTER_EMITTED');
must(count(html,/client-deal-lifecycle-v1\.js/giu)===1,'DEAL_LIFECYCLE_NOT_SINGLE_OWNER');
must(html.includes('rona-client-deal-documents-legacy-preempt'),'SIGNED_ADDENDUM_LEGACY_PREEMPT_MISSING');
must(html.includes('20260902-current-context-v9'),'SIGNED_ADDENDUM_CURRENT_CONTEXT_CACHE_BUSTER_MISSING');
must(html.includes('20260831-status-center-v2'),'DEAL_PASSPORT_CACHE_BUSTER_MISSING');
must(html.includes('20260905-strict-context-v6'),'DEAL_LIFECYCLE_CURRENT_CONTEXT_CACHE_BUSTER_MISSING');
for(const marker of ['__RONA_CLIENT_DEAL_DOCUMENTS_V1__','__RONA_CLIENT_DEAL_DOCUMENTS_V2__','__RONA_CLIENT_DEAL_DOCUMENTS_V3__','__RONA_CLIENT_DEAL_DOCUMENTS_V4__'])
  must(html.includes(marker),`SIGNED_ADDENDUM_PREPAINT_GUARD_MISSING:${marker}`);

const retiredPaths=[
  'assets/portal-runtime/client-deal-documents-v1.js','assets/portal-runtime/client-deal-documents-v2.js','assets/portal-runtime/client-deal-documents-v3.js','assets/portal-runtime/client-deal-documents-v4.js',
  'assets/portal-runtime/client-deal-command-center-v1.js','assets/portal-runtime/client-deal-command-center-v2.js','assets/portal-runtime/client-deal-command-center-v3.js',
  'dist/assets/portal-runtime/client-deal-documents-v1.js','dist/assets/portal-runtime/client-deal-documents-v2.js','dist/assets/portal-runtime/client-deal-documents-v3.js','dist/assets/portal-runtime/client-deal-documents-v4.js',
  'dist/assets/portal-runtime/client-deal-command-center-v1.js','dist/assets/portal-runtime/client-deal-command-center-v2.js','dist/assets/portal-runtime/client-deal-command-center-v3.js',
];
for(const p of retiredPaths){let present=true;try{await access(p)}catch(error){if(error?.code==='ENOENT')present=false;else throw error}must(!present,`SIGNED_ADDENDUM_RETIRED_RUNTIME_STILL_PRESENT:${p}`)}

for(const marker of ['20260902-client-deal-documents-v7-current-context','RONA_CLIENT_CONTEXT','function currentContext()','authority.subscribe','/v1/client/context?clientId=','/v1/client/deal-documents/state?clientId=','sourceUnsignedDocumentId','/signed-addendum','SIGNED_ADDENDUM','supersedes_document_id',"client_stage:'DOCUMENTS_SIGNED'"])
  must(runtime.includes(marker),`SIGNED_ADDENDUM_BROWSER_MARKER_MISSING:${marker}`);
must(!runtime.includes('/v1/client/bootstrap'),'SIGNED_ADDENDUM_PARALLEL_BOOTSTRAP_FORBIDDEN');
must(!runtime.includes('Promise.all(contexts.map'),'SIGNED_ADDENDUM_PARALLEL_CONTEXT_LOOP_FORBIDDEN');

for(const marker of ['20260831-client-deal-passport-v2-centered-status','DEAL CONTROL','Паспорт сделки','data-rona-command-field','data-rona-command-heading','grid-template-columns:repeat(2','coverage<5','r.height<70','onscreen','passport-only'])
  must(passport.includes(marker),`DEAL_PASSPORT_MARKER_MISSING:${marker}`);
for(const forbidden of ['Схема реализации сделки','Контракт и сделка','function stageData(','function renderFlow(','rona-deal-flow-v3__grid','setInterval(schedule,2200)','fetch('])
  must(!passport.includes(forbidden),`DEAL_PASSPORT_RETIRED_REALIZATION_OR_NETWORK_BEHAVIOR:${forbidden}`);
for(const forbidden of ['position:fixed!important','transform:translate(-50%,-50%)','width:min(1180px','height:min(800px'])
  must(!passport.includes(forbidden),`DEAL_PASSPORT_NATIVE_RIGHT_DRAWER_GEOMETRY_OVERRIDDEN:${forbidden}`);

for(const marker of ['20260905-client-deal-realization-status-v6-strict-authoritative-context','RONA_CLIENT_CONTEXT','function currentContext()','authority.subscribe','SERVER_AUTHORITATIVE_REALIZATION_V1',"const STAGE_ORDER=['contract','documents','resource','payment','logistics','close']",'function ensureFlow(root)',"ronaRealizationOwner='server-authoritative-v6-strict-context'",'data-rona-authoritative-deal-id','data-rona-authoritative-context','Статус реализации'])
  must(lifecycle.includes(marker),`DEAL_LIFECYCLE_MARKER_MISSING:${marker}`);
must(!lifecycle.includes('/v1/client/bootstrap'),'DEAL_LIFECYCLE_PARALLEL_BOOTSTRAP_FORBIDDEN');
for(const forbidden of ['Статусы формируются из текущей карточки сделки','function stageData(','function renderFlow(','REFRESH_MS=7000','setInterval(()=>refresh','[data-rona-command-heading]'])
  must(!lifecycle.includes(forbidden),`DEAL_LIFECYCLE_LOCAL_INFERENCE_FORBIDDEN:${forbidden}`);

for(const marker of ['isSignedAddendumUpload',"form.get('sourceUnsignedDocumentId')","fd.append('sourceUnsignedDocumentId'","h.delete('content-type')",'CLIENT_DEAL_DOCUMENTS_API'])
  must(proxy.includes(marker),`SIGNED_ADDENDUM_PROXY_MARKER_MISSING:${marker}`);
for(const marker of ['client_user_has_deal_access','sourceUnsignedDocumentId','ADDENDUM_SOURCE_CHANGED','SIGNED_ADDENDUM_ALREADY_CURRENT',"document_kind='ADDENDUM'","'SIGNED_ADDENDUM'","lifecycle_state='SUPERSEDED'",'signed_supplement_document_key','CLIENT_SIGNED_ADDENDUM_UPLOADED_AUTHORITATIVE'])
  must(edge.includes(marker),`SIGNED_ADDENDUM_EDGE_MARKER_MISSING:${marker}`);

const forbidden=['RONA-C002','RONA-C003','DEAL-2026-004','DEAL-2026-005','DEAL-2026-006','FARGONA GAZ','UNIVERSAL SOLYARIS','01/PT-01-1926','01/PT-02-1926'];
for(const value of forbidden){
  must(!runtime.includes(value),`SIGNED_ADDENDUM_RUNTIME_HARDCODED:${value}`);must(!visual.includes(value),`SIGNED_ADDENDUM_VISUAL_HARDCODED:${value}`);must(!passport.includes(value),`DEAL_PASSPORT_HARDCODED:${value}`);must(!lifecycle.includes(value),`DEAL_LIFECYCLE_HARDCODED:${value}`);must(!proxy.includes(value),`SIGNED_ADDENDUM_PROXY_HARDCODED:${value}`);must(!edge.includes(value),`SIGNED_ADDENDUM_EDGE_HARDCODED:${value}`);
}

for(const marker of ['/portal/client','/assets/portal-runtime/client-deal-documents-v*.js','/assets/portal-runtime/client-deal-canonical-visual-v*.js','/assets/portal-runtime/client-deal-passport-v*.js','/assets/portal-runtime/client-deal-lifecycle-v*.js','Cache-Control: no-store, no-cache, must-revalidate, max-age=0'])
  must(cachePolicy.includes(marker),`CLIENT_DEAL_CACHE_POLICY_MISSING:${marker}`);
must(!cachePolicy.includes('/assets/portal-runtime/client-deal-command-center-v*.js'),'RETIRED_COMMAND_CENTER_CACHE_POLICY_REMAINS');

const bridge=integrity?.client_runtime?.deal_documents_bridge;
must(bridge?.scope==='CURRENT_AUTHORIZED_CLIENT_CONTEXT','SIGNED_ADDENDUM_SCOPE_NOT_CURRENT_CONTEXT');
must(bridge?.context_source==='RONA_CLIENT_CONTEXT_AUTHORITY','SIGNED_ADDENDUM_CONTEXT_SOURCE_NOT_AUTHORITY');
must(bridge?.authorization==='SERVER_CLIENT_USER_HAS_DEAL_ACCESS','SIGNED_ADDENDUM_AUTH_SCOPE_NOT_SERVER');
must(bridge?.client_specific_hardcoding===false,'SIGNED_ADDENDUM_HARDCODING_GUARD_MISSING');
must(bridge?.prepaint_single_owner===true,'SIGNED_ADDENDUM_PREPAINT_SINGLE_OWNER_MISSING');
must(bridge?.replacement_semantics==='SIGNED_ADDENDUM_SUPERSEDES_CURRENT_UNSIGNED_ADDENDUM','SIGNED_ADDENDUM_REPLACEMENT_SEMANTICS_MISSING');
must(bridge?.passport_scope==='ALL_AUTHORIZED_CLIENT_DEAL_DRAWERS','DEAL_PASSPORT_SCOPE_NOT_GENERIC');
must(bridge?.passport_data_policy==='PRESENTATION_ONLY_FROM_CURRENT_RENDERED_SERVER_PROJECTION','DEAL_PASSPORT_DATA_POLICY_INVALID');
must(bridge?.passport_marker==='20260831-client-deal-passport-v2-centered-status','DEAL_PASSPORT_INTEGRITY_MARKER_MISSING');
must(bridge?.passport_layout==='NATIVE_RIGHT_DRAWER_PRESERVED','DEAL_PASSPORT_RIGHT_LAYOUT_POLICY_MISSING');
must(bridge?.passport_close_behavior==='NATIVE_DRAWER_CONTROL_UNTOUCHED','DEAL_PASSPORT_NATIVE_CLOSE_POLICY_MISSING');
must(bridge?.lifecycle_single_owner===true,'DEAL_LIFECYCLE_SINGLE_OWNER_MISSING');
must(bridge?.lifecycle_host_owner==='SERVER_AUTHORITATIVE_V6_STRICT_CONTEXT','DEAL_LIFECYCLE_HOST_OWNER_INVALID');
must(bridge?.lifecycle_scope==='CURRENT_AUTHORIZED_CLIENT_CONTEXT','DEAL_LIFECYCLE_SCOPE_NOT_CURRENT_CONTEXT');
must(bridge?.lifecycle_refresh==='AUTHORITATIVE_DETAIL_CONTEXT_FOCUS_VISIBILITY','DEAL_LIFECYCLE_REFRESH_POLICY_INVALID');
must(bridge?.retired_local_realization_renderer==='PHYSICALLY_REMOVED','RETIRED_LOCAL_REALIZATION_RENDERER_NOT_REMOVED');

console.log('CLIENT_SIGNED_ADDENDUM_GENERIC_QA=PASS scope=CURRENT_AUTHORIZED_CLIENT_CONTEXT; context authority=RONA_CLIENT_CONTEXT; retired deal realization renderer physically absent; passport presentation-only; authoritative lifecycle strict-context single owner; native close untouched; no client/deal hardcoding; no-store cache policy');
