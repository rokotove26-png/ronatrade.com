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
for(const v of ['v2','v3']){
 const text=read('dist/assets/portal-runtime/client-application-form-'+v+'.js');
 assert.match(text,/RONA_ATOMIC_APPLICATION_FORM_V2/);assert.match(text,/RonaApplicationIntentV2.submit/);
 assert.doesNotMatch(text,/idempotency_key:detailKey|uid\('PRICE-APP-'\)/);
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
console.log('ACTUAL_BUILD_SCOPE=PASS Payments_byte_identity=true Client_real_path=true Admin_real_path=true freeze_negatives=true');
