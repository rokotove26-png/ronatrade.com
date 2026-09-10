import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {applyClientDealPassportEconomics,resolveClientDealPassportEconomics} from '../supabase/functions/rona-portal-api/client-deal-economics.js';

const BASELINE='1843477cb66315bdb7ce7b4e5f0ed13f6d68e412';
const head=String(process.env.PR_HEAD_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'})).trim();
const artifactPath=String(process.env.ECONOMICS_E2E_ARTIFACT||'artifacts/client-deal-passport-authoritative-economics-v1.json');
const sha256=value=>createHash('sha256').update(value).digest('hex');

const accepted=resolveClientDealPassportEconomics({
  application_status:'DEAL_REGISTERED',
  workflow_business_status:'DEAL',
  counter_offer_used:true,
  finalized_at:'2026-09-10T12:00:00Z',
  confirmed_quantity_tonnes:490,
  application_quantity_tonnes:500,
  counter_price:740,
  counter_currency:'usd',
  application_price:743,
  application_currency:'USD',
});
assert.equal(accepted.passport_unit_price,740);
assert.equal(accepted.confirmed_quantity_tonnes,490);
assert.equal(accepted.passport_amount,362600);
assert.equal(accepted.passport_currency,'USD');
assert.equal(accepted.passport_amount_source,'FINALIZED_ACCEPTED_COUNTEROFFER');
assert.equal(accepted.counter_offer_used,true);

const fallback=resolveClientDealPassportEconomics({
  application_status:'DEAL_REGISTERED',
  workflow_business_status:'DEAL',
  counter_offer_used:false,
  finalized_at:'2026-09-10T12:00:00Z',
  confirmed_quantity_tonnes:120,
  application_quantity_tonnes:125,
  counter_price:805,
  counter_currency:'EUR',
  application_price:810,
  application_currency:'eur',
});
assert.equal(fallback.passport_unit_price,810);
assert.equal(fallback.confirmed_quantity_tonnes,120);
assert.equal(fallback.passport_amount,97200);
assert.equal(fallback.passport_currency,'EUR');
assert.equal(fallback.passport_amount_source,'FINALIZED_APPLICATION_COMMERCIAL_TERMS');
assert.equal(fallback.counter_offer_used,false);

const nonFinalCounter=resolveClientDealPassportEconomics({
  application_status:'DEAL_REGISTERED',
  workflow_business_status:'DEAL',
  counter_offer_used:true,
  finalized_at:null,
  confirmed_quantity_tonnes:10,
  counter_price:700,
  counter_currency:'USD',
  application_price:710,
  application_currency:'USD',
});
assert.equal(nonFinalCounter.passport_unit_price,710);
assert.equal(nonFinalCounter.passport_amount,7100);
assert.equal(nonFinalCounter.passport_amount_source,'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS');
assert.equal(nonFinalCounter.counter_offer_used,false);

const incompleteAccepted=resolveClientDealPassportEconomics({
  application_status:'DEAL_REGISTERED',
  workflow_business_status:'DEAL',
  counter_offer_used:true,
  finalized_at:'2026-09-10T12:00:00Z',
  confirmed_quantity_tonnes:25,
  counter_price:740,
  counter_currency:null,
  application_price:743,
  application_currency:'USD',
});
assert.equal(incompleteAccepted.passport_amount,null,'finalized accepted economics must not fall back to stale application economics when incomplete');
assert.equal(incompleteAccepted.passport_currency,null);
assert.equal(incompleteAccepted.passport_amount_source,'FINALIZED_ACCEPTED_COUNTEROFFER_INCOMPLETE');
assert.equal(incompleteAccepted.counter_offer_used,true);

const projectedDeal={deal_id:'QA-DEAL-GENERIC'};
applyClientDealPassportEconomics(projectedDeal,{
  application_id:'QA-APP-GENERIC',
  application_status:'DEAL_REGISTERED',
  workflow_business_status:'DEAL',
  counter_offer_used:true,
  finalized_at:'2026-09-10T12:00:00Z',
  confirmed_quantity_tonnes:7.5,
  counter_price:123.45,
  counter_currency:'usd',
  application_price:130,
  application_currency:'USD',
});
assert.deepEqual(projectedDeal,{
  deal_id:'QA-DEAL-GENERIC',
  confirmed_quantity_tonnes:7.5,
  passport_unit_price:123.45,
  passport_amount:925.88,
  passport_currency:'USD',
  passport_amount_source:'FINALIZED_ACCEPTED_COUNTEROFFER',
  passport_application_id:'QA-APP-GENERIC',
  counter_offer_used:true,
});

const projectionSource=await readFile('supabase/functions/rona-portal-api/client-deal-economics-projection.ts','utf8');
const resolverSource=await readFile('supabase/functions/rona-portal-api/client-deal-economics.js','utf8');
const clientSource=await readFile('supabase/functions/rona-portal-api/client.ts','utf8');
const runtimeSource=await readFile('assets/portal-runtime/client-deals-authoritative-v1.js','utf8');
const contextProxySource=await readFile('functions/portal/api/v1/client/context.js','utf8');

for(const required of [
  "cl.client_id=${requestClientId}",
  "ct.contract_id=${requestContractId}",
  'd.client_key=a.client_key',
  'd.contract_key=a.contract_key',
  'coalesce(w.counter_offer_used,false)=true and w.finalized_at is not null',
  'd.quantity_tonnes as confirmed_quantity_tonnes',
  'a.counter_price',
  'a.counter_currency::text',
  'coalesce(a.proposed_price,line.application_price) as application_price',
  "headers.set('x-rona-client-deal-economics',PROJECTION_VERSION)",
])assert.ok(projectionSource.includes(required),`projection contract missing: ${required}`);
assert.ok(clientSource.startsWith('import "./client-deal-economics-projection.ts";'),'authoritative projection is not installed in the production Client API source');

for(const required of ['passport_unit_price','confirmed_quantity_tonnes','counter_offer_used','detailText(d,a)','authoritativeAmount(deal)']){
  assert.ok(runtimeSource.includes(required),`Client deal consumer does not consume projected economics: ${required}`);
}
assert.equal(runtimeSource.includes("const price=app?numberText(app.proposed_price,2):''"),false,'drawer still binds price directly from stale application economics');
assert.ok(runtimeSource.includes('projectedPrice=numberText(deal?.passport_unit_price,2)'),'drawer price is not projection-first');
assert.ok(runtimeSource.includes('quantity=numberText(deal?.confirmed_quantity_tonnes??app?.quantity_tonnes,3)'),'drawer quantity is not confirmed-deal-first');

for(const forbidden of ['DEAL-2026-009','RONA-C005-IN-2026-001','362600']){
  for(const [path,source] of [
    ['client-deal-economics.js',resolverSource],
    ['client-deal-economics-projection.ts',projectionSource],
    ['client.ts',clientSource],
    ['client-deals-authoritative-v1.js',runtimeSource],
  ])assert.equal(source.includes(forbidden),false,`production source hardcode detected: ${path}:${forbidden}`);
}

for(const required of ['MAIN_CONTEXT_API','clientId','contractId','enrichCounterOfferProjection','cache-control'])assert.ok(contextProxySource.includes(required),`current-context proxy contract missing: ${required}`);

const changedFiles=execFileSync('git',['diff','--name-only',`${BASELINE}..HEAD`],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const allowed=new Set([
  '.github/workflows/client-deal-passport-authoritative-economics-qa.yml',
  'assets/portal-runtime/client-deals-authoritative-v1.js',
  'scripts/qa-client-deal-passport-authoritative-economics-v1.mjs',
  'supabase/functions/rona-portal-api/client-deal-economics.js',
  'supabase/functions/rona-portal-api/client-deal-economics-projection.ts',
  'supabase/functions/rona-portal-api/client.ts',
]);
for(const path of changedFiles)assert.ok(allowed.has(path),`unexpected changed file outside corrective scope: ${path}`);

const proof={
  version:'client-deal-passport-authoritative-economics-v1',
  baseline:BASELINE,
  head,
  proofMode:'free-github-actions-shared-production-resolver-and-source-projection',
  paidResources:false,
  productionBusinessDataMutation:false,
  ownerUatClaimed:false,
  checks:{
    finalizedAcceptedEconomicsWins:'PASS',
    fallbackWithoutAcceptedCounterOffer:'PASS',
    nonFinalCounterDoesNotOverride:'PASS',
    confirmedDealQuantityDrivesAmount:'PASS',
    incompleteAcceptedEconomicsDoesNotLeakStaleFallback:'PASS',
    currentContextExactPairScope:'PASS',
    tenantDealContractScope:'PASS',
    clientConsumerProjectionFirst:'PASS',
    genericNoProductionDealHardcode:'PASS',
    changedFilesAllowlist:'PASS',
  },
  evidence:{
    accepted:{unitPrice:accepted.passport_unit_price,quantityTonnes:accepted.confirmed_quantity_tonnes,amount:accepted.passport_amount,currency:accepted.passport_currency,source:accepted.passport_amount_source},
    fallback:{unitPrice:fallback.passport_unit_price,quantityTonnes:fallback.confirmed_quantity_tonnes,amount:fallback.passport_amount,currency:fallback.passport_currency,source:fallback.passport_amount_source},
    sourceSha256:{resolver:sha256(resolverSource),projection:sha256(projectionSource),runtime:sha256(runtimeSource),contextProxy:sha256(contextProxySource)},
    changedFiles,
  },
  result:'PASS',
};
await mkdir(artifactPath.split('/').slice(0,-1).join('/')||'.',{recursive:true});
await writeFile(artifactPath,JSON.stringify(proof,null,2)+'\n','utf8');
console.log('CLIENT_DEAL_PASSPORT_AUTHORITATIVE_ECONOMICS_QA=PASS',JSON.stringify(proof));
