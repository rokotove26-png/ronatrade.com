import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolveAuthoritativeDealEconomics} from '../supabase/functions/rona-portal-api/client-deal-economics.js';
import {projectAuthoritativeOperationalState,REALIZATION_SOURCE} from '../supabase/functions/rona-portal-api/client-deal-state.js';

const BASELINE=process.env.BASELINE_SHA||'0f85c0455e2df319fed49b1a84016929a905e025';
const HEAD=process.env.PR_HEAD_SHA||process.env.GITHUB_SHA||'';
const assert=(ok,code,detail={})=>{if(!ok)throw new Error(`${code} ${JSON.stringify(detail)}`)};
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=path=>readFile(path,'utf8');

const projection=await read('supabase/functions/rona-portal-api/client-deal-economics-projection.ts');
const stateSource=await read('supabase/functions/rona-portal-api/client-deal-state.js');
const patchSource=await read('scripts/apply-client-postrelease-state-consistency-v1.mjs');
for(const token of ['portal_private.resolve_deal_resource_state(d.id)','applyClientDealPassportEconomics','applyAuthoritativeOperationalState','x-rona-client-deal-authoritative-state'])assert(projection.includes(token),'SERVER_PROJECTION_CONTRACT_MISSING',{token});
assert(!/RONA-C\d{3}|DEAL-2026-\d{3}/.test(projection+stateSource+patchSource),'PRODUCTION_ENTITY_HARDCODE_IN_PRODUCT_SOURCE');
assert(REALIZATION_SOURCE==='SERVER_AUTHORITATIVE_REALIZATION_V2_CURRENT_PROJECTION','REALIZATION_SOURCE_MISMATCH');

const accepted=resolveAuthoritativeDealEconomics({application_status:'DEAL_REGISTERED',workflow_business_status:'DEAL',counter_offer_used:true,client_counter_response:'ACCEPTED',finalized_at:'2099-01-01T00:00:00Z',confirmed_quantity_tonnes:7.5,counter_price:123.45,counter_currency:'USD',application_price:999,application_currency:'EUR'});
assert(accepted.passport_amount===925.88&&accepted.passport_unit_price===123.45&&accepted.passport_currency==='USD','ECONOMICS_ACCEPTED_REGRESSION',accepted);
const fallback=resolveAuthoritativeDealEconomics({application_status:'DEAL_REGISTERED',workflow_business_status:'DEAL',counter_offer_used:false,finalized_at:'2099-01-01T00:00:00Z',confirmed_quantity_tonnes:120,application_price:810,application_currency:'EUR'});
assert(fallback.passport_amount===97200&&fallback.passport_currency==='EUR','ECONOMICS_FALLBACK_REGRESSION',fallback);

const confirmed=projectAuthoritativeOperationalState({business_status:'EXECUTING',payment_status:'AWAITING_PAYMENT'},{resource_status:'RESOURCE_CONFIRMED',resource_source:'RESOURCE_DECISION',resource_confirmed_at:'2099-01-01T00:00:00Z',signed_supplement_document_key:'00000000-0000-4000-8000-000000000001',signed_supplement_checked_at:'2099-01-01T00:00:00Z'});
const confirmedStages=new Map(confirmed.realization_status.stages.map(s=>[s.key,s.state]));
assert(confirmed.resource_confirmed===true&&confirmed.resource_status==='RESOURCE_CONFIRMED','RESOURCE_CONFIRMED_PROJECTION_FAILED',confirmed);
assert(confirmedStages.get('resource')==='DONE','RESOURCE_CONFIRMED_LEFT_PENDING',{stages:Object.fromEntries(confirmedStages)});
assert(confirmedStages.get('documents')==='DONE','DOCUMENT_CONFIRMED_LEFT_PENDING',{stages:Object.fromEntries(confirmedStages)});
assert(confirmedStages.get('logistics')==='CURRENT','EXECUTING_LOGISTICS_NOT_CURRENT',{stages:Object.fromEntries(confirmedStages)});
const denied=projectAuthoritativeOperationalState({business_status:'REGISTERED',payment_status:'TO_VERIFY'},{resource_status:'RESOURCE_DENIED',resource_source:'RESOURCE_DECISION'});
assert(denied.realization_status.stages.find(s=>s.key==='resource')?.state==='BLOCKED','RESOURCE_DENIED_NOT_BLOCKED');
const pending=projectAuthoritativeOperationalState({business_status:'REGISTERED',payment_status:'TO_VERIFY'},{resource_status:'RESOURCE_PENDING',resource_source:'NO_AUTHORITATIVE_RESOURCE_FACT'});
assert(pending.resource_confirmed===false&&pending.realization_status.stages.find(s=>s.key==='resource')?.state==='PENDING','RESOURCE_PENDING_FAIL_CLOSED');
const closed=projectAuthoritativeOperationalState({business_status:'CLOSED',payment_status:'PAID'},{resource_status:'RESOURCE_CONFIRMED',resource_source:'DEAL_BUSINESS_STATUS'});
assert(closed.realization_status.stages.every(s=>s.state==='DONE'),'COMPLETED_DEAL_STAGE_LEFT_PENDING',closed.realization_status);

const lifecycle=await read('dist/assets/portal-runtime/client-deal-lifecycle-v1.js');
const context=await read('dist/assets/portal-runtime/client-context-selection-authority-v1.js');
const directory=await read('dist/assets/portal-runtime/portal-client-company-directory-authority-v1.js');
const sourceLifecycle=await read('assets/portal-runtime/client-deal-lifecycle-v1.js');
assert(lifecycle.includes("authority.whenCurrentProjection('client-deal-lifecycle-v1')"),'LIFECYCLE_CURRENT_PROJECTION_OWNER_MISSING');
assert(!lifecycle.includes('/v1/client/deal-documents/state?clientId='),'LIFECYCLE_PARALLEL_ENDPOINT_REMAINS');
assert(lifecycle.includes(REALIZATION_SOURCE),'LIFECYCLE_REALIZATION_SOURCE_MISMATCH');
assert(context.includes('failClosedCurrentBusinessSurface'),'COLD_START_FAIL_CLOSED_MISSING');
assert(context.includes("ronaClientCurrentProjectionAtomic='pending'")&&context.includes("ronaClientCurrentProjectionAtomic='ready'"),'ATOMIC_CONTEXT_STATE_MISSING');
assert(context.includes('CLIENT_CONTEXT_CHANGED_DURING_PROJECTION'),'A_B_A_GENERATION_GUARD_MISSING');
assert(directory.includes("whenCurrentProjection('portal-client-company-directory-authority-v1')"),'DIRECTORY_CURRENT_PROJECTION_BARRIER_MISSING');
assert(directory.includes('CLIENT_COMPANY_DIRECTORY_CURRENT_PROJECTION_SCOPE_MISMATCH'),'DIRECTORY_SCOPE_FAIL_CLOSED_MISSING');
const cssBlock=text=>{const a=text.indexOf('function installStyle(){'),b=text.indexOf('function contextAuthority()');return a>=0&&b>a?text.slice(a,b):''};
assert(cssBlock(lifecycle)===cssBlock(sourceLifecycle),'LIFECYCLE_VISUAL_CSS_CHANGED');

const html=await read('dist/portal/client.html');
for(const file of ['client-deal-lifecycle-v1.js','client-context-selection-authority-v1.js','portal-client-company-directory-authority-v1.js'])assert(new RegExp(`/assets/portal-runtime/${file.replaceAll('.','\\.')}\\?v=[0-9a-f]{16}`).test(html),'CACHE_BUST_NOT_BOUND',{file});

const changed=['package.json','scripts/apply-client-postrelease-state-consistency-v1.mjs','scripts/qa-client-postrelease-state-consistency-v1.mjs','supabase/functions/rona-portal-api/client-deal-economics-projection.ts','supabase/functions/rona-portal-api/client-deal-state.js','.github/workflows/client-postrelease-state-consistency-qa.yml'];
const artifact={version:'owner-post-release-uat-430-v1',baseline:BASELINE,head:HEAD,freeResourcesOnly:true,productionBusinessDataMutation:false,ownerUatClaimed:false,checks:{canonicalResourceResolver:'PASS',resourceConfirmedNotPending:'PASS',resourceDeniedBlocked:'PASS',missingResourceFailsClosed:'PASS',completedDealNoPendingStages:'PASS',lifecycleUsesCurrentProjectionOnly:'PASS',coldStartFailClosed:'PASS',companyDirectoryExactProjectionBarrier:'PASS',contextGenerationGuard:'PASS',economicsAcceptedRegression:'PASS',economicsFallbackRegression:'PASS',visualCssUnchanged:'PASS',productionEntityHardcodeAbsent:'PASS'},hashes:{serverProjection:sha(projection),stateProjector:sha(stateSource),emittedLifecycle:sha(lifecycle),emittedContext:sha(context),emittedDirectory:sha(directory)},changedFiles:changed,result:'PASS'};
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/client-postrelease-state-consistency-v1.json',JSON.stringify(artifact,null,2)+'\n');
console.log('CLIENT_POSTRELEASE_STATE_CONSISTENCY_QA=PASS '+JSON.stringify(artifact));
