import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {onRequest} from '../../../functions/portal/main-ui/index.js';
const root=process.env.APPLICATION_EVIDENCE_DIR||'/tmp/application-business-evidence';fs.mkdirSync(root,{recursive:true});
const read=p=>fs.readFileSync(p,'utf8');
const base=process.env.APPLICATION_BASE_SHA||'2d47e08a8420331672692507a74db6c6484ef04d';
const original=execFileSync('git',['show',base+':functions/portal/main-ui/index.js'],{encoding:'utf8'});
const current=read('functions/portal/main-ui/index.js');
const payments=s=>s.match(/const PAYMENTS_V7_BROWSER_RUNTIME = String.raw`([\s\S]*?)`;\n/)[1];
assert.equal(payments(current),payments(original),'Payments runtime must remain byte-identical');
const admin=await (await onRequest({request:new Request('https://ronaoil.com/portal/main-ui')})).text();
const client=read('dist/assets/portal-runtime/portal-client-applications-canonical-v1.js');
assert.match(admin,/RONA_ADMIN_APPLICATION_BUSINESS_V2/);assert.match(client,/RONA_CLIENT_APPLICATION_BUSINESS_CONSUMER_V2/);
assert.match(client,/whenCurrentProjection\('applications-canonical'\)/);assert.doesNotMatch(client,/request\('\/v1\/client\/applications-projection/);
// Applications consumes the shared current projection without becoming a second forced-refresh owner.
// Same-context refreshes must retain the canonical row object/open passport while context switches clear it.
assert.match(client,/reloadRequested=Math\.max/,'application projection convergence retry missing');
assert.match(client,/const previous=new Map/,'keyed canonical application reconciliation missing');
assert.match(client,/list\.replaceChildren\(\.\.\.nodes\)/,'canonical row reconciliation commit missing');
assert.match(client,/nextKey!==state\.contextKey/,'context-key boundary missing');
assert.match(client,/state\.openPassportId===id\?"Скрыть":"Открыть"/,'open passport presentation state missing');
assert.match(client,/async function applicationPassportRequest\(path\)/,'scoped canonical passport request helper missing');
assert.match(client,/await applicationPassportRequest\('\/v1\/client\/applications\/'/,'canonical passport request is not wired');
assert.doesNotMatch(client,/await request\('\/v1\/client\/applications\/'/,'undefined legacy passport request helper must not be emitted');
assert.doesNotMatch(client,/\bsetInterval\s*\(/,'recurring application refresh interval must be absent');
assert.doesNotMatch(client,/REFRESH_MS/,'application runtime must not own a recurring refresh interval');
assert.match(client,/refreshCurrentProjection\('applications-canonical'\)/,'mutation-driven application refresh path missing');
assert.match(client,/window\.addEventListener\('rona:client-current-projection'/,'current projection invalidation listener missing');
// Active/Completed are first-class section controls above the card list, never a synthetic row inside it.
assert.match(client,/data-rona-application-business-sections/,'application section navigation missing');
assert.match(client,/list\.before\(nav\)/,'application section navigation must be a sibling above the list');
assert.doesNotMatch(client,/const tabs=.*data-rona-application-business-controls/,'legacy in-list bucket strip must be retired');
// Counter-offer presentation is rendered synchronously from the same canonical row snapshot.
assert.match(client,/counterOfferMarkup\(app\)/,'canonical inline counter-offer renderer missing');
assert.match(client,/data-rona-counter-offer-panel=\\?"v2\\?"/,'stable counter-offer panel marker missing');
assert.doesNotMatch(client,/whenCurrentProjection\('client-counter-offer-canonical'\)/,'counter offer must not launch a second projection fetch');
assert.doesNotMatch(client,/rona:client-applications-rendered',queueDecorate/,'async post-render counter decorator must be retired');
assert.doesNotMatch(client,/if\(force\)a\.invalidateCurrentProjection\?\.\(\)/,'application consumer must not invalidate shared projection on read');
assert.doesNotMatch(client,/window\.addEventListener\('pageshow',\(\)=>\{load\(true\)/,'pageshow must not force an application projection fetch');
assert.doesNotMatch(client,/window\.addEventListener\('pageshow',queueDecorate/,'counter-offer decorator must not fetch on pageshow');
for(const v of ['v2','v3']){
 const text=read('dist/assets/portal-runtime/client-application-form-'+v+'.js');
 assert.match(text,/RONA_ATOMIC_APPLICATION_FORM_V2/);assert.match(text,/RonaApplicationIntentV2.submit/);
 assert.doesNotMatch(text,/idempotency_key:detailKey|uid\('PRICE-APP-'/);
}
assert.doesNotMatch(read('functions/portal/admin-completed-bootstrap.js'),/mergeAdminCompletedApplications|mergeAdminDurableIntakeApplications/);
assert.doesNotMatch(read('functions/portal/applications-total-kpi-ui.js'),/sum\s*\+|quantity_tonnes\s*\*|applicationPrice/);
// The scope exception cannot disable the original freeze. Both an unrelated and an
// allowed-but-modified artifact must still be rejected by the actual freeze guard.
const guard='scripts/qa-client-portal-visual-freeze.mjs';
for(const file of ['assets/portal-runtime/client-application-intent-v2.js','assets/portal-runtime/client-context-selection-authority-v1.js']){
 const bytes=fs.readFileSync(file);try{fs.appendFileSync(file,'\n/* unauthorized-test-change */\n');const result=spawnSync(process.execPath,[guard],{encoding:'utf8'});assert.notEqual(result.status,0,'freeze must reject '+file)}finally{fs.writeFileSync(file,bytes)}
}
const hashes={};for(const [name,text]of Object.entries({admin,client,payments:payments(current)}))hashes[name]=createHash('sha256').update(text).digest('hex');
fs.writeFileSync(root+'/emitted-admin.js',admin);fs.writeFileSync(root+'/emitted-client.js',client);fs.writeFileSync(root+'/emitted-sha256.json',JSON.stringify(hashes,null,2));
console.log('APPLICATION_PROJECTION_CONVERGENCE=PASS shared_owner=true keyed_rows=true open_passport=true pageshow_fanout=false recurring_polling=false event_driven=true sections_above_list=true counter_offer_inline=true');
console.log('ACTUAL_BUILD_SCOPE=PASS Payments_byte_identity=true Client_real_path=true Admin_real_path=true freeze_negatives=true');
