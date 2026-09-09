import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const files={
  candidate:'supabase/functions/rona-portal-api-candidate-20260817/index.ts',
  proxy:'functions/portal/api/[[path]].js',
  directory:'assets/portal-runtime/portal-client-company-directory-authority-v1.js',
  attach:'scripts/attach-pr431-client-company-directory-v1.mjs',
  apps:'scripts/materialize-portal-client-applications-canonical-v1.mjs'
};
const text={};for(const [k,p] of Object.entries(files))text[k]=await readFile(p,'utf8');
for(const [name,source] of Object.entries(text))if(/RONA-C003|RONA-C005|RONA-C005-IN-2026-001|2\s*\/\s*2\s*\/\s*5/iu.test(source))throw new Error(`PR431_HARDCODED_ACCEPTANCE_FIXTURE_FORBIDDEN:${name}`);
for(const token of ['AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB','CURRENT_EFFECTIVE_CONTRACTUAL_ONLY','company_directory','current_signed_contract','storage_object_id'])if(!text.candidate.includes(token))throw new Error(`PR431_CANDIDATE_DIRECTORY_CONTRACT_MISSING:${token}`);
for(const token of ['CANDIDATE_API','rona-portal-api-candidate-20260817','PR431_PREVIEW_HOST_SELECTOR_V2_AUTHORITATIVE','isProductionHost','isPreviewHost','isCandidateOverlayRead',"path==='/v1/client/bootstrap'","path==='/v1/client/context'","method==='GET'",'x-rona-portal-backend-slot','x-rona-portal-backend-function','x-rona-portal-backend-selector'])if(!text.proxy.includes(token))throw new Error(`PR431_PREVIEW_SELECTOR_CONTRACT_MISSING:${token}`);
for(const token of ['company_directory','company_directory_source','company_metrics','documents_predicate','current_signed_contract','storage_object_id','application_price','application_currency','resource_status','resource_label','resource_source','resource_confirmed_at','passport_amount','passport_currency','passport_amount_source','passport_application_id'])if(!text.proxy.includes(token))throw new Error(`PR431_SAFE_PROXY_FIELD_MISSING:${token}`);
for(const token of ['CLIENT_DEAL_DOCUMENTS_API','isClientDealDocumentsPath','isSignedAddendumUpload',"request.formData()","form.get('sourceUnsignedDocumentId')","h.delete('content-type')",'new FormData()',"fd.append('sourceUnsignedDocumentId'",'safeDocument','safeClientContext','safeClientBootstrap','safeAgentSettlement','safeAgentBootstrap','safeAgentPayment','sanitize(path,response)','authRefresh','tokenCookies','sameOrigin'])if(!text.proxy.includes(token))throw new Error(`PR431_PARENT_PROXY_NONREGRESSION_MISSING:${token}`);
for(const forbidden of ["startsWith('/v1/client/')",'startsWith("/v1/client/")'])if(text.proxy.includes(forbidden))throw new Error(`PR431_GENERIC_CLIENT_CANDIDATE_ROUTING_FORBIDDEN:${forbidden}`);
if(!text.proxy.includes("const target=isClientDealDocumentsPath(path)?`${CLIENT_DEAL_DOCUMENTS_API}${path}${query}`:`${selection.base}${path}${query}`"))throw new Error('PR431_DEAL_DOCUMENTS_PRIORITY_ROUTING_MISSING');
for(const token of ['getCompanyDirectory','refreshCompanyDirectory','ALL_AUTHORIZED_CONTEXT_DIRECTORY','AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB','CURRENT_EFFECTIVE_CONTRACTUAL_ONLY','validateCompleteDirectory','authorizedSnapshot','CLIENT_COMPANY_DIRECTORY_INCOMPLETE','planDirectory','state.validated','state.active','/v1/client/storage/','signed-url','LEGACY_CONTRACT_MARK'])if(!text.directory.includes(token))throw new Error(`PR431_DIRECTORY_RUNTIME_CONTRACT_MISSING:${token}`);
for(const forbidden of ['neutralCard','RONA_CLIENT_OWNER_TYPOGRAPHY','style.setProperty(\'font-size\'','createElement(\'style\')','window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__=LEGACY_CONTRACT_MARK','window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__=LEGACY_CONTRACT_MARK','window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__=LEGACY_CONTRACT_MARK'])if(text.directory.includes(forbidden))throw new Error(`PR431_DIRECTORY_PREAUTH_DESTRUCTIVE_OR_VISUAL_OWNER_FORBIDDEN:${forbidden}`);
for(const token of ['PR431_CANONICAL_COMPANY_CARD_FACTORY_V1','PR431_CANONICAL_FACTORY_SINGLE_CARD_OWNER_V1','COMPLETE_VALIDATED_DIRECTORY_ATOMIC_COMMIT','ONE_SANITIZED_STRUCTURAL_TEMPLATE_DATA_ONLY','RETIRED_NOT_OWNERS','DELEGATED_SELECTION_GUARD_ONLY','KEEP_LAST_VALIDATED_FULL_DIRECTORY',"applications_bug2:'UNCHANGED_NO_TOUCH'",'visual_runtime_owner:false'])if(!text.attach.includes(token))throw new Error(`PR431_ATTACH_ATOMIC_CONTRACT_MISSING:${token}`);
for(const token of ['whenCurrentProjection','invalidateCurrentProjection','CLIENT_APPLICATIONS_GHOST_ENDPOINT_NOT_REMOVED','ghost_endpoint:false','periodic_refresh:true','pageshow_network_refresh:true'])if(!text.apps.includes(token))throw new Error(`PR431_APPLICATIONS_CONTRACT_MISSING:${token}`);
if(!text.apps.includes("if(runtime.includes('applications-projection'))throw"))throw new Error('PR431_GHOST_ENDPOINT_BUILD_GATE_MISSING');

const sandbox={URL,Headers,Response,Blob,FormData,console};vm.createContext(sandbox);
const executable=text.proxy.replace('export async function onRequest','async function onRequest')+"\nglobalThis.__pr431BackendSelection=backendSelection;globalThis.__pr431DealDocuments=isClientDealDocumentsPath;";
vm.runInContext(executable,sandbox,{filename:'pr431-pages-proxy-matrix.js'});
const select=sandbox.__pr431BackendSelection,dealDocs=sandbox.__pr431DealDocuments;
if(typeof select!=='function'||typeof dealDocs!=='function')throw new Error('PR431_BACKEND_MATRIX_EXPORT_MISSING');
const preview='https://branch-a.rona-trade-public.pages.dev',production='https://rona-trade-public.pages.dev',other='https://example.invalid';
const matrix=[
  ['preview-env-production-bootstrap',{env:{RONA_PORTAL_API_TARGET:'production'}},new URL(preview),'/v1/client/bootstrap','GET','candidate'],
  ['preview-env-production-context',{env:{RONA_PORTAL_API_TARGET:'production'}},new URL(preview),'/v1/client/context','GET','candidate'],
  ['preview-env-candidate-context',{env:{RONA_PORTAL_API_TARGET:'candidate'}},new URL(preview),'/v1/client/context','GET','candidate'],
  ['production-env-candidate-bootstrap',{env:{RONA_PORTAL_API_TARGET:'candidate'}},new URL(production),'/v1/client/bootstrap','GET','production'],
  ['production-env-candidate-context',{env:{RONA_PORTAL_API_TARGET:'candidate'}},new URL(production),'/v1/client/context','GET','production'],
  ['preview-post-context',{env:{RONA_PORTAL_API_TARGET:'candidate'}},new URL(preview),'/v1/client/context','POST','production'],
  ['preview-nonoverlay-route',{env:{RONA_PORTAL_API_TARGET:'candidate'}},new URL(preview),'/v1/client/prices','GET','production'],
  ['nonpreview-env-candidate-context',{env:{RONA_PORTAL_API_TARGET:'candidate'}},new URL(other),'/v1/client/context','GET','production']
];
for(const [name,context,url,path,method,expected] of matrix){const actual=select(context,url,path,method);if(actual?.slot!==expected)throw new Error(`PR431_BACKEND_MATRIX_FAIL:${name}:expected=${expected}:actual=${actual?.slot}`)}
for(const path of ['/v1/client/deal-documents/state','/v1/client/deals/DEAL-2099-123/documents/DOC-1/downloaded','/v1/client/deals/DEAL-2099-123/signed-addendum'])if(!dealDocs(path))throw new Error(`PR431_DEAL_DOCUMENT_MATRIX_FAIL:${path}`);
console.log('PR431_BACKEND_SELECTION_MATRIX=PASS preview+env-production=candidate production+env-candidate=production nonoverlay=production deal-docs=dedicated-service');
console.log('PR431_SYSTEM_ADMIN_ONE_SHOT_SOURCE_QA=PASS directory=atomic-complete-all-context applications=current-projection preview=hostname-authoritative parent-proxy=restored signed-addendum=preserved visual-owner=false hardcoded-fixtures=false');
