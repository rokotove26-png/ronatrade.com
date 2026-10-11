import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

// Execute the exact protected Operations runtime in Chromium without live account credentials.
const source=readFileSync('functions/portal/admin-operations-command-center-v10-clean.js','utf8');
const m=source.match(/const CLEAN_RUNTIME=String.raw`([\s\S]*?)`;/);
assert.ok(m,'Canonical operations runtime missing');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
try{
  await page.setContent('<!DOCTYPE html><html><body><div id="page-home">Operations</div></body></html>');
  const setup=`
   window.__QA_OPS__={mode:'DEGRADED',renders:0};
   function page(name){return document.getElementById('page-'+name)}
   function renderAdminHome(){window.__QA_OPS__.renders++}
   async function call(path){
     if(path.includes('operations-attention-seen'))return {seen:[]};
     if(window.__QA_OPS__.mode==='ERROR')throw new Error('QA_TRANSPORT_ERROR');
     const state=window.__QA_OPS__.mode;
     return {version:'OPERATIONS_CURRENT_V2',generatedAt:new Date().toISOString(),
       readiness:{contract:'ADMIN_OPERATIONS_SOURCE_TRUTH_V11',state,
         sources:{deals:'RECONFIRM_REQUIRED',finance:'AUTHORITY_DATE_OLD',
           rail:'NO_ACTIVE_MONITORING',actions:'AGED_OPEN_TASKS'}},
       dataHealth:{contract:'ADMIN_OPERATIONS_SOURCE_TRUTH_V11'},
       kpis:{activeDeals:6},deals:[],actions:[]};
   }
  `;
  await page.addScriptTag({content:setup+'\n'+m[1]});
  const first=await page.evaluate(async()=>{
    const value=await ronaOpsV10Refresh('QA_FIRST_DEGRADED');
    return {status:window.__RONA_ADMIN_OPERATIONS_V2_STATUS__,
      ready:ronaOpsV10Ready(value),
      marker:value?.readiness?.contract,
      display:window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__?.readiness?.state};
  });
  assert.deepEqual(first,{status:'DEGRADED',ready:true,
    marker:'ADMIN_OPERATIONS_SOURCE_TRUTH_V11',display:'DEGRADED'});
  const stale=await page.evaluate(()=>({
    legacy:ronaOpsV10Ready({version:'OPERATIONS_CURRENT_V2',
      generatedAt:new Date().toISOString(),readiness:{state:'READY'}}),
    old:ronaOpsV10Ready({version:'OPERATIONS_CURRENT_V2',
      generatedAt:'2026-09-16T00:00:00Z',
      readiness:{state:'READY',contract:'ADMIN_OPERATIONS_SOURCE_TRUTH_V11'}})
  }));
  assert.equal(stale.legacy,false);
  assert.equal(stale.old,false);
  const error=await page.evaluate(async()=>{
    window.__QA_OPS__.mode='ERROR';
    await ronaOpsV10Refresh('QA_FAILURE');
    return {status:window.__RONA_ADMIN_OPERATIONS_V2_STATUS__,
      current:window.__RONA_ADMIN_OPERATIONS_CURRENT_V2__,
      oldVisible:ronaOpsV10Ready(ronaOpsV10Snapshot),
      code:window.__RONA_ADMIN_OPERATIONS_V2_ERROR__};
  });
  assert.equal(error.status,'ERROR');
  assert.equal(error.current,null);
  assert.equal(error.oldVisible,false);
  assert.ok(error.code.includes('QA_TRANSPORT_ERROR'));
  console.log('OPS_V11_CHROMIUM_DEGRADED_HONEST_AND_FAILED_REFRESH_NO_STALE=PASS');
}finally{
 await browser.close();
}
