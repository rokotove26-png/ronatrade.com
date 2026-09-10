import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeClientCounterOffers} from '../functions/portal/client-counter-offer-projection.js';

const plain={application_id:'TEST-IN-2026-001',status:'UNDER_REVIEW',product:'Товар'};
const [plainProjected]=mergeClientCounterOffers([plain],[{application_id:plain.application_id,counter_price:null,counter_currency:null,client_counter_response:null}]);
assert.deepEqual(plainProjected,plain,'application without counter-offer must remain unchanged');

const offered={application_id:'TEST-IN-2026-002',status:'UNDER_REVIEW',product:'Товар'};
const [active]=mergeClientCounterOffers([offered],[{application_id:offered.application_id,counter_price:777.77,counter_currency:'usd',client_counter_response:null}]);
assert.equal(active.counter_price,777.77);
assert.equal(active.counter_currency,'USD');
assert.equal(active.counter_offer_active,true,'active counter-offer must be projected');
assert.equal(active.client_counter_response,null);

for(const response of ['ACCEPTED','DECLINED']){
  const [responded]=mergeClientCounterOffers([offered],[{application_id:offered.application_id,counter_price:777.77,counter_currency:'USD',client_counter_response:response}]);
  assert.equal(responded.counter_offer_active,false,`responded counter-offer must not stay actionable: ${response}`);
  assert.equal(responded.client_counter_response,response);
}

const runtime=await readFile('assets/portal-runtime/client-applications-live-render-v1.js','utf8');
for(const required of ['20260910-client-counter-offer-applications-v1','counter_offer_active','counter_price','counter_currency','client_counter_response','Принять','Отклонить','/client/applications/${encodeURIComponent(id)}/counter-offer/${decision}','/portal/owner-api?path=','invalidateCurrentProjection','rona:client-application-submitted','data-rona-live-applications="canonical-v1"'])assert.ok(runtime.includes(required),`approved Applications runtime missing ${required}`);
assert.ok(!/RONA-C\d{3}|APP-\d{4}-\d{3,}/.test(runtime),'runtime must not contain record-specific identifiers');

const context=await readFile('functions/portal/api/v1/client/context.js','utf8');
for(const required of ['rona-owner-acceptance/client/bootstrap','mergeClientCounterOffers','x-rona-counter-offer-projection'])assert.ok(context.includes(required),`context projection missing ${required}`);

const packageJson=JSON.parse(await readFile('package.json','utf8'));
assert.ok(packageJson.scripts.build.includes('materialize-portal-client-applications-canonical-v1.mjs'),'canonical Client Applications build owner must remain attached');
assert.ok(!packageJson.scripts.build.includes('attach-client-counter-offer-hotfix-v1.mjs'),'no new Client attachment is allowed for this scoped hotfix');

console.log('CLIENT_COUNTER_OFFER_HOTFIX_QA=PASS plain=unchanged active=offer+actions responses=generic backend=existing-routes canonical-owner=preserved new-attachment=false hardcoding=false');
