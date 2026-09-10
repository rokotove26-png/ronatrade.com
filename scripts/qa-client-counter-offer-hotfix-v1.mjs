import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeClientCounterOffers} from '../functions/portal/client-counter-offer-projection.js';

const plain={application_id:'TEST-IN-2026-001',status:'UNDER_REVIEW',product:'Товар'};
const [plainProjected]=mergeClientCounterOffers([plain],[{application_id:plain.application_id,counter_price:null,counter_currency:null,client_counter_response:null}]);
assert.deepEqual(plainProjected,plain,'application without counter-offer must remain unchanged');

const offered={application_id:'TEST-IN-2026-002',status:'UNDER_REVIEW',product:'Товар'};
const [active]=mergeClientCounterOffers([offered],[{application_id:offered.application_id,counter_price:740,counter_currency:'usd',client_counter_response:null}]);
assert.equal(active.counter_price,740);
assert.equal(active.counter_currency,'USD');
assert.equal(active.counter_offer_active,true,'active counter-offer must be projected');
assert.equal(active.client_counter_response,null);
assert.equal(`${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(active.counter_price)} ${active.counter_currency}/т`,'740 USD/т','authoritative counter-offer fields must format as the visible 740 USD/т path');

for(const response of ['ACCEPTED','DECLINED']){
  const [responded]=mergeClientCounterOffers([offered],[{application_id:offered.application_id,counter_price:740,counter_currency:'USD',client_counter_response:response}]);
  assert.equal(responded.counter_offer_active,false,`responded counter-offer must not stay actionable: ${response}`);
  assert.equal(responded.client_counter_response,response);
}

const html=await readFile('dist/portal/client.html','utf8');
const runtime=await readFile('dist/assets/portal-runtime/portal-client-applications-canonical-v1.js','utf8');
const legacySource=await readFile('assets/portal-runtime/client-applications-live-render-v1.js','utf8');

assert.equal((html.match(/portal-client-applications-canonical-v1\.js/g)||[]).length,1,'built Client HTML must reference exactly one canonical Applications runtime');
assert.ok(html.includes('id="rona-portal-client-applications-canonical-v1"'),'built Client HTML must attach the canonical Applications runtime');
assert.ok(!html.includes('client-applications-live-render-v1.js'),'built Client HTML must not attach the legacy competing Applications renderer');
assert.ok(!legacySource.includes('20260910-client-counter-offer-canonical-emitted-v1'),'counter-offer implementation must not live in the non-emitted legacy runtime');

for(const required of [
  '20260910-client-counter-offer-canonical-emitted-v1',
  'counter_offer_active',
  'counter_price',
  'counter_currency',
  'client_counter_response',
  'data-rona-counter-offer-price',
  'Встречное предложение RONA Trade',
  'Принять',
  'Отклонить',
  "'/client/applications/'+encodeURIComponent(id)+'/counter-offer/'+decision",
  "'/portal/owner-api?path='",
  'invalidateCurrentProjection',
  'rona:client-application-submitted',
  'data-rona-live-applications="canonical-v1"'
])assert.ok(runtime.includes(required),`built canonical Applications runtime missing ${required}`);

assert.ok(!/RONA-C\d{3}|APP-\d{4}-\d{3,}/.test(runtime),'built runtime must not contain record-specific identifiers');

const context=await readFile('functions/portal/api/v1/client/context.js','utf8');
for(const required of ['rona-owner-acceptance/client/bootstrap','mergeClientCounterOffers','x-rona-counter-offer-projection'])assert.ok(context.includes(required),`context projection missing ${required}`);

console.log('CLIENT_COUNTER_OFFER_BUILD_QA=PASS built-canonical-owner=1 legacy-owner=0 visible-sample=740_USD_PER_TON active=offer+actions responses=generic backend=existing-routes post-response-refresh=true hardcoding=false');
