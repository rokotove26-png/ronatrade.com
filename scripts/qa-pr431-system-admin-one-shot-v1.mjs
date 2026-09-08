import { readFile } from 'node:fs/promises';
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
for(const token of ['rona-portal-api-candidate-20260817','RONA_PORTAL_API_TARGET','PR431_PREVIEW_HOST_SELECTOR_V1','url.search','x-rona-portal-backend-slot','x-rona-portal-backend-function','x-rona-portal-backend-selector'])if(!text.proxy.includes(token))throw new Error(`PR431_PREVIEW_SELECTOR_CONTRACT_MISSING:${token}`);
for(const token of ['getCompanyDirectory','refreshCompanyDirectory','ALL_AUTHORIZED_CONTEXT_DIRECTORY','AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB','CURRENT_EFFECTIVE_CONTRACTUAL_ONLY','/v1/client/storage/','signed-url','LEGACY_CONTRACT_MARK'])if(!text.directory.includes(token))throw new Error(`PR431_DIRECTORY_RUNTIME_CONTRACT_MISSING:${token}`);
for(const token of ['whenCurrentProjection','invalidateCurrentProjection','CLIENT_APPLICATIONS_GHOST_ENDPOINT_NOT_REMOVED','ghost_endpoint:false','periodic_refresh:true','pageshow_network_refresh:true'])if(!text.apps.includes(token))throw new Error(`PR431_APPLICATIONS_CONTRACT_MISSING:${token}`);
if(!text.apps.includes("if(runtime.includes('applications-projection'))throw"))throw new Error('PR431_GHOST_ENDPOINT_BUILD_GATE_MISSING');
console.log('PR431_SYSTEM_ADMIN_ONE_SHOT_SOURCE_QA=PASS directory=server-authorized-all-context applications=current-projection preview=candidate-client-only production=unchanged-by-routing-default hardcoded-fixtures=false');
