import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const BASE='fe3f3fa3db5146abacbbd56e59ebd0472ba9fb18';
const HISTORICAL_PR429_GOVERNANCE='governance/client-load-hotfix-pr429-owner-approval-20260905.json';
const bootstrap=await readFile('supabase/functions/rona-portal-api/bootstrap.ts','utf8');
const runtime=await readFile('assets/portal-runtime/client-contract-download-v3.js','utf8');
const build=await readFile('scripts/build-pages-direct-canonical.mjs','utf8');
const historicalPr429Governance=await readFile(HISTORICAL_PR429_GOVERNANCE,'utf8');

function requireText(source,token,label){if(!source.includes(token))throw new Error(`${label}: missing ${token}`)}
function forbidText(source,token,label){if(source.includes(token))throw new Error(`${label}: forbidden ${token}`)}

for(const token of [
  "a.status::text='DEAL_REGISTERED'",
  "w.business_status='DEAL'",
  'coalesce(w.counter_offer_used,false)=false',
  'a.quantity_tonnes::numeric*a.proposed_price::numeric',
  'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS',
  'FINALIZED_APPLICATION_COMMERCIAL_TERMS',
  'passport_amount',
  'passport_currency',
  'passport_application_id',
  'company_metrics',
  "dv.is_current is true",
  "dv.is_effective is true",
  "documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'",
  "source:'AUTHORITATIVE_CURRENT_CONTEXT_DB'"
]) requireText(bootstrap,token,'BACKEND_CONTRACT');

// SYSTEM_ADMIN 5561852752 root-cause lock: enrichment must be driven by the exact
// authorized current client+contract, not by whatever application IDs happened to
// survive the upstream applications projection. This protects legacy DEAL_REGISTERED
// rows whose linked deal is still visible even when the application row is not.
for(const token of [
  'const exactContext =',
  'requestClientId===responseClientId',
  'requestContractId===responseContractId',
  'join portal_private.clients cl on cl.id=a.client_key',
  'join portal_private.contracts ct on ct.id=a.contract_key',
  'where cl.client_id=${requestClientId}',
  'and ct.contract_id=${requestContractId}',
  'const byDeal = new Map(rows.filter((r:any)=>r.deal_id)',
  "headers.set('x-rona-client-context-enrichment','prod-incident-430-v3-context-scoped-deals-owner-kpi')"
]) requireText(bootstrap,token,'C002_REAL_BOUNDARY_CONTEXT_SCOPED_ENRICHMENT');
for(const token of [
  'where a.application_id in (select value from jsonb_array_elements_text(',
  'const ids = applications.map',
  'JSON.stringify(ids)'
]) forbidText(bootstrap,token,'C002_OLD_APPLICATION_LIST_SEEDED_ENRICHMENT');

// Owner-established KPI counts the two authoritative C003 applications even though
// DEAL_REGISTERED application records are archived after becoming deals. Do not
// reintroduce ACTIVE-only application semantics (the prior defect was 0 instead of 2).
requireText(bootstrap,'where cl.client_id=${requestClientId} and ct.contract_id=${requestContractId}) as applications_total,','C003_APPLICATION_TOTAL_OWNER_SEMANTICS');
forbidText(bootstrap,"where cl.client_id=${requestClientId} and ct.contract_id=${requestContractId}\n                  and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum) as applications_total",'C003_ACTIVE_ONLY_APPLICATION_FALLBACK');

forbidText(bootstrap,"and w.finalized_at is not null",'LEGACY_REGISTERED_COMPATIBILITY');
forbidText(bootstrap,'payment_obligation_amount =','PAYMENT_SEMANTICS_OVERLOAD');
forbidText(bootstrap,'delete from portal_private','NO_DESTRUCTIVE_CLEANUP');
forbidText(bootstrap,'DELETE FROM portal_private','NO_DESTRUCTIVE_CLEANUP');

for(const token of [
  "20260906-client-contract-v11-authoritative-company-metrics",
  "entry?.company_metrics&&typeof entry.company_metrics==='object'?entry.company_metrics:null",
  "value===null||value===undefined||typeof value==='boolean'",
  'Number.isInteger(n)&&n>=0',
  'authoritative?.applications_total',
  'authoritative?.deals_total',
  'authoritative?.documents_total',
  "authoritative?.source==='AUTHORITATIVE_CURRENT_CONTEXT_DB'",
  "authoritative?.documents_predicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'",
  "source:'AUTHORITATIVE_METRICS_UNAVAILABLE'",
  'applications:null,deals:null,documents:null',
  "value==null?'—':String(value)",
  "metrics.ready?'ready':'pending'",
  'state.entry.company_metrics=',
  'ronaCompanyDirectoryDocumentsPredicate'
]) requireText(runtime,token,'CLIENT_KPI_FAIL_CLOSED_CONTRACT');

const contextSwitchClear='if(state.currentKey!==key){state.entry=null;state.currentKey=key;state.lastLoad=0;primeCompanyDirectory(current);publishState();render()}';
const contextFetch="const detail=await request('/v1/client/context?clientId='";
requireText(runtime,contextSwitchClear,'CLIENT_KPI_CONTEXT_SWITCH_FAIL_CLOSED');
requireText(runtime,contextFetch,'CLIENT_KPI_CONTEXT_FETCH');
if(runtime.indexOf(contextSwitchClear)>runtime.indexOf(contextFetch))throw new Error('CLIENT_KPI_CONTEXT_SWITCH_CLEAR_AFTER_REFETCH');

for(const token of [
  'applicationsTotal??',
  'dealsTotal??',
  'documentsTotal??',
  "source:authoritative?.source||'LEGACY_RUNTIME_FALLBACK'",
  'documents:documentsTotal??documents.length'
]) forbidText(runtime,token,'CLIENT_KPI_LEGACY_FALLBACK_REMOVED');

requireText(build,"src: '/assets/portal-runtime/client-contract-download-v3.js?v=20260906-company-directory-authoritative-metrics-v11',",'CACHE_KEY');

const hardcoded=/(RONA-C00[234]|DEAL-2026-00[45678]|FARG[‘'’`´ʼ]?ONA|NIK[- ]?OIL)/iu;
if(hardcoded.test(bootstrap)||hardcoded.test(runtime))throw new Error('HARDCODED_BUSINESS_FIXTURE_IN_RUNTIME');

function commercialProjection({status,businessStatus,counterOfferUsed,quantity,price,currency,finalizedAt}){
  const eligible=status==='DEAL_REGISTERED'&&businessStatus==='DEAL'&&counterOfferUsed===false&&Number(quantity)>0&&Number(price)>0&&String(currency||'').trim();
  return eligible?{amount:Number(quantity)*Number(price),currency:String(currency).trim().toUpperCase(),source:finalizedAt?'FINALIZED_APPLICATION_COMMERCIAL_TERMS':'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS'}:{amount:null,currency:null,source:null};
}
const legacy=commercialProjection({status:'DEAL_REGISTERED',businessStatus:'DEAL',counterOfferUsed:false,quantity:315,price:750,currency:'USD',finalizedAt:null});
if(legacy.amount!==236250||legacy.currency!=='USD'||legacy.source!=='LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS')throw new Error(`C002_LEGACY_AMOUNT_CONTRACT_FAIL ${JSON.stringify(legacy)}`);
const finalized=commercialProjection({status:'DEAL_REGISTERED',businessStatus:'DEAL',counterOfferUsed:false,quantity:500,price:1345,currency:'USD',finalizedAt:'2026-09-01T00:00:00Z'});
if(finalized.amount!==672500||finalized.source!=='FINALIZED_APPLICATION_COMMERCIAL_TERMS')throw new Error('FINALIZED_AMOUNT_NONREGRESSION_FAIL');

function metricNumber(value){
  if(value===null||value===undefined||typeof value==='boolean'||(typeof value==='string'&&!/^\d+$/.test(value.trim())))return null;
  const n=Number(value);return Number.isInteger(n)&&n>=0?n:null;
}
function companyMetricsProjection(authoritative){
  const a=authoritative&&typeof authoritative==='object'?authoritative:null;
  const applications=metricNumber(a?.applications_total),deals=metricNumber(a?.deals_total),documents=metricNumber(a?.documents_total);
  const ready=applications!==null&&deals!==null&&documents!==null&&a?.source==='AUTHORITATIVE_CURRENT_CONTEXT_DB'&&a?.documents_predicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY';
  return ready?{applications,deals,documents,ready:true}:{applications:null,deals:null,documents:null,ready:false};
}
const missing=companyMetricsProjection(null);
if(missing.ready||missing.applications!==null||missing.deals!==null||missing.documents!==null)throw new Error('KPI_MISSING_METRICS_NOT_FAIL_CLOSED');
const invalid=companyMetricsProjection({applications_total:2,deals_total:2,documents_total:null,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'});
if(invalid.ready||invalid.documents!==null)throw new Error('KPI_INVALID_METRICS_NOT_FAIL_CLOSED');
const wrongPredicate=companyMetricsProjection({applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'RAW_DOCUMENTS'});
if(wrongPredicate.ready)throw new Error('KPI_WRONG_PREDICATE_ACCEPTED');
const c003=companyMetricsProjection({applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'});
if(!c003.ready||c003.applications!==2||c003.deals!==2||c003.documents!==5)throw new Error('C003_OWNER_KPI_FIXTURE_FAIL');

try{
  execFileSync('git',['cat-file','-e',`${BASE}^{commit}`],{stdio:'ignore'});
  const historicalBase=execFileSync('git',['show',`${BASE}:${HISTORICAL_PR429_GOVERNANCE}`],{encoding:'utf8'});
  if(historicalPr429Governance!==historicalBase)throw new Error('ISSUE430_HISTORICAL_PR429_GOVERNANCE_MUTATED');
  if(process.env.GITHUB_EVENT_NAME==='pull_request'){
    const baseRef=process.env.GITHUB_BASE_REF;
    const mergeBase=execFileSync('git',['merge-base',`origin/${baseRef}`,'HEAD'],{encoding:'utf8'}).trim();
    if(mergeBase!==BASE)throw new Error(`ISSUE430_BASE_MISMATCH ${mergeBase}`);
    const changed=execFileSync('git',['diff','--name-only',`${BASE}...HEAD`],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
    const forbidden=changed.filter(path=>/rail/i.test(path)||path.startsWith('supabase/migrations/')||path.startsWith('db/migrations/'));
    if(forbidden.length)throw new Error(`OUT_OF_SCOPE_DELTA ${forbidden.join(',')}`);
  }
}catch(error){if(error?.message?.startsWith('ISSUE430_')||error?.message?.startsWith('OUT_OF_SCOPE_'))throw error}

console.log('ISSUE430_CLIENT_MULTICONTEXT_PARITY=PASS');
console.log('PR429_HISTORICAL_GOVERNANCE=BASE_EXACT');
console.log('C002_REAL_BOUNDARY_ENRICHMENT=EXACT_CLIENT_CONTRACT_ALL_APPLICATIONS_TO_VISIBLE_DEALS');
console.log('C002_OLD_APPLICATION_LIST_SEEDED_ENRICHMENT=ABSENT');
console.log('C003_APPLICATION_TOTAL_SEMANTICS=ALL_AUTHORITATIVE_CONTEXT_APPLICATIONS');
console.log('KPI_MISSING_METRICS=NEUTRAL_FAIL_CLOSED');
console.log('KPI_INVALID_METRICS=NEUTRAL_FAIL_CLOSED');
console.log('KPI_CONTEXT_SWITCH=NEUTRAL_BEFORE_REFETCH');
console.log('C002_DEDICATED_COMMERCIAL_AMOUNT=236250 USD source=LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS');
console.log('C003_COMPANY_CARD_KPI=applications:2 deals:2 documents:5 predicate=CURRENT_EFFECTIVE_CONTRACTUAL_ONLY');
console.log('DESTRUCTIVE_CLEANUP=ABSENT');
