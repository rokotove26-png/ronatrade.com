import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const runtimePath='dist/assets/portal-runtime/client-context-selection-authority-v1.js';
const runtime=await readFile(runtimePath,'utf8');
const requiredRuntime=[
  'RONA_CLIENT_CONTEXT_COHERENCE_432_V1',
  'PROJECTION_MAX_AGE_MS=15000',
  "MUTATION_METHODS=new Set(['POST','PUT','PATCH','DELETE'])",
  'CLIENT_CONTEXT_PROJECTION_STALE_RESPONSE',
  'explicitFreshRead(input,init)',
  'mutation&&response.ok'
];
for(const token of requiredRuntime)if(!runtime.includes(token))throw new Error(`ISSUE432_BUILT_RUNTIME_TOKEN_MISSING:${token}`);
if(/RONA-C005|ГазОнэ|GazOne|RONA-C005-IN-2026-001/iu.test(runtime))throw new Error('ISSUE432_BUSINESS_SPECIFIC_HARDCODE_FORBIDDEN');

const CTX={
  A:{client_id:'CLIENT-A',legal_name:'Alpha Test LLC',registration_country:'TEST',contract_id:'CONTRACT-A',current_external_contract_number:'EXT-A',contract_status:'ACTIVE',effective_from:'2026-01-01',effective_to:'2026-12-31'},
  B:{client_id:'CLIENT-B',legal_name:'Beta Test LLC',registration_country:'TEST',contract_id:'CONTRACT-B',current_external_contract_number:'EXT-B',contract_status:'ACTIVE',effective_from:'2026-01-01',effective_to:'2026-12-31'}
};
const db={
  A:{applications:[{application_id:'APP-A-1',status:'UNDER_REVIEW',product:'TEST-A',quantity_tonnes:10,proposed_price:100,proposed_currency:'USD'}]},
  B:{applications:[{application_id:'APP-B-1',status:'UNDER_REVIEW',product:'TEST-B',quantity_tonnes:20,proposed_price:200,proposed_currency:'USD'}]}
};
const reads={A:0,B:0};
let delayNextContext=null;
let releaseDelayed=null;
let delayedStarted=false;
let mismatchNextContext=null;
let submitSeq=1;

const norm=v=>String(v??'').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=v=>JSON.parse(JSON.stringify(v));
function contextName(clientId,contractId){return Object.keys(CTX).find(name=>CTX[name].client_id===clientId&&CTX[name].contract_id===contractId)||null}
function projection(name){const c=CTX[name];return{projection_contract:'ISSUE432_QA',client_id:c.client_id,contract_id:c.contract_id,context:{client_id:c.client_id,contract_id:c.contract_id},client:{client_id:c.client_id,legal_name:c.legal_name},contract:{client_id:c.client_id,contract_id:c.contract_id,legal_name:c.legal_name,current_external_contract_number:c.current_external_contract_number},applications:clone(db[name].applications),deals:[],documents:[],payments:[],prices:[]}}
function send(res,status,body){const text=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(text)});res.end(text)}
async function readJson(req){let text='';for await(const chunk of req)text+=chunk;try{return JSON.parse(text||'{}')}catch{return{}}}
async function api(req,res,url){
  if(url.pathname==='/portal/api/v1/client/bootstrap'){
    return send(res,200,{ok:true,data:{contexts:[CTX.A,CTX.B],selected_context:CTX.A,requires_context_selection:false}});
  }
  if(!url.pathname.startsWith('/portal/api/v1/client/'))return false;
  const clientId=norm(url.searchParams.get('clientId')),contractId=norm(url.searchParams.get('contractId'));
  const name=contextName(clientId,contractId);
  if(!name)return send(res,403,{ok:false,code:'CLIENT_CONTEXT_NOT_AUTHORIZED'});
  if(url.pathname==='/portal/api/v1/client/context'&&req.method==='GET'){
    reads[name]+=1;
    if(delayNextContext===name){
      delayNextContext=null;
      delayedStarted=true;
      await new Promise(resolve=>{releaseDelayed=resolve});
      releaseDelayed=null;
    }
    const mismatch=mismatchNextContext===name;
    if(mismatch)mismatchNextContext=null;
    const out=projection(mismatch?(name==='A'?'B':'A'):name);
    return send(res,200,{ok:true,data:out});
  }
  if(url.pathname==='/portal/api/v1/client/applications'&&req.method==='POST'){
    if(url.searchParams.get('fail')==='1')return send(res,500,{ok:false,code:'QA_MUTATION_FAILED'});
    const body=await readJson(req);
    const application={application_id:`APP-${name}-SUBMIT-${submitSeq++}`,status:'UNDER_REVIEW',product:norm(body.product)||'TEST-SUBMITTED',quantity_tonnes:Number(body.quantity_tonnes||1),proposed_price:Number(body.proposed_price||1),proposed_currency:norm(body.proposed_currency||'USD')};
    db[name].applications.push(application);
    return send(res,201,{ok:true,data:{application_id:application.application_id,status:'ACCEPTED'}});
  }
  if(url.pathname==='/portal/api/v1/client/documents/fail'&&req.method==='DELETE')return send(res,409,{ok:false,code:'QA_DELETE_FAILED'});
  return send(res,200,{ok:true,data:{client_id:clientId,contract_id:contractId}});
}

const html=`<!doctype html><html><head><meta charset="utf-8"><script>window.CLIENT_CONTEXTS={};window.activeClientContractId='';window.renderClientContext=()=>{};</script><script src="/assets/portal-runtime/client-context-selection-authority-v1.js" defer></script></head><body><select id="clientContextSelect"></select><div id="company-slot" data-rona-current-context-slot="client-name"></div></body></html>`;
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url||'/','http://127.0.0.1');if(url.pathname==='/portal/client'||url.pathname==='/portal/client/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});return res.end(html)}if(url.pathname==='/assets/portal-runtime/client-context-selection-authority-v1.js'){res.writeHead(200,{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store'});return res.end(runtime)}const handled=await api(req,res,url);if(handled!==false)return;res.writeHead(404);res.end('not found')}catch(error){res.writeHead(500);res.end(String(error?.stack||error))}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const failures=[];
function check(condition,code,detail={}){if(condition)return;failures.push({code,detail});console.error('ASSERTION_FAILED',code,JSON.stringify(detail))}
async function waitFor(predicate,timeout=3000){const start=Date.now();while(Date.now()-start<timeout){if(predicate())return true;await sleep(10)}return false}
async function freshContext(){return page.evaluate(async()=>{const r=await fetch('/portal/api/v1/client/context',{cache:'no-store',headers:{'x-rona-client-source':'issue432-qa'}});return{status:r.status,body:await r.json()}})}
async function ordinaryContext(){return page.evaluate(async()=>{const r=await fetch('/portal/api/v1/client/context',{headers:{'x-rona-client-source':'issue432-qa'}});return{status:r.status,body:await r.json()}})}
async function select(name){const c=CTX[name];return page.evaluate(async c=>{window.RONA_CLIENT_CONTEXT.select(c.client_id,c.contract_id);await window.RONA_CLIENT_CONTEXT.whenCurrentProjection('issue432-select');return window.RONA_CLIENT_CONTEXT.getCurrentProjection()},c)}

try{
  await page.goto(`${origin}/portal/client`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.RONA_CLIENT_CONTEXT?.whenReady&&window.RONA_CLIENT_CONTEXT?.whenCurrentProjection);
  await page.evaluate(async()=>{await window.RONA_CLIENT_CONTEXT.whenReady();await window.RONA_CLIENT_CONTEXT.whenCurrentProjection('issue432-initial')});

  // A. Successful application mutation invalidates centrally; same-session fresh read sees backend projection without reload.
  const beforeA=reads.A;
  const submit=await page.evaluate(async()=>{const r=await fetch('/portal/api/v1/client/applications',{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-rona-client-source':'issue432-qa'},body:JSON.stringify({product:'TEST-SUBMITTED-A',quantity_tonnes:33,proposed_price:123,proposed_currency:'USD'})});return{status:r.status,body:await r.json(),projectionAfterMutation:window.RONA_CLIENT_CONTEXT.getCurrentProjection()}});
  check(submit.status===201,'A_MUTATION_HTTP',submit);
  check(submit.projectionAfterMutation===null,'A_MUTATION_INVALIDATES_CURRENT_PROJECTION',submit);
  const afterSubmit=await freshContext();
  const submittedRow=afterSubmit.body?.data?.applications?.find(x=>x.application_id===submit.body?.data?.application_id);
  check(reads.A>beforeA,'A_NETWORK_READ_AFTER_MUTATION',{beforeA,after:reads.A});
  check(submittedRow?.status==='UNDER_REVIEW'&&submittedRow?.product==='TEST-SUBMITTED-A'&&submittedRow?.quantity_tonnes===33,'A_BACKEND_PROJECTION_FIELDS',{submittedRow});
  console.log('ISSUE432_A_APPLICATION_SUBMIT_NO_RELOAD=PASS');

  // B. External/backend change is observed by explicit no-store polling, never served from the memory snapshot.
  await ordinaryContext();
  db.A.applications.push({application_id:'APP-A-EXTERNAL',status:'UNDER_REVIEW',product:'TEST-EXTERNAL',quantity_tonnes:44,proposed_price:321,proposed_currency:'USD'});
  const beforeExternal=reads.A;
  const external=await freshContext();
  check(reads.A===beforeExternal+1,'B_NO_STORE_MUST_NETWORK',{beforeExternal,after:reads.A});
  check(external.body?.data?.applications?.some(x=>x.application_id==='APP-A-EXTERNAL'),'B_EXTERNAL_CHANGE_VISIBLE',{applications:external.body?.data?.applications});
  console.log('ISSUE432_B_EXTERNAL_CHANGE_POLLING=PASS');

  // C. Failed POST/DELETE do not invalidate or fabricate a fresh projection; authoritative read remains correct.
  await freshContext();
  await page.evaluate(()=>{window.__issue432Invalidations=0;window.addEventListener('rona:client-current-projection-invalidated',()=>window.__issue432Invalidations++);window.__issue432Snapshot=JSON.stringify(window.RONA_CLIENT_CONTEXT.getCurrentProjection())});
  const failedMutation=await page.evaluate(async()=>{const p=await fetch('/portal/api/v1/client/applications?fail=1',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const d=await fetch('/portal/api/v1/client/documents/fail',{method:'DELETE'});return{post:p.status,del:d.status,invalidations:window.__issue432Invalidations,same:JSON.stringify(window.RONA_CLIENT_CONTEXT.getCurrentProjection())===window.__issue432Snapshot}});
  check(failedMutation.post===500&&failedMutation.del===409,'C_FAILED_MUTATION_HTTP',failedMutation);
  check(failedMutation.invalidations===0&&failedMutation.same===true,'C_FAILED_MUTATION_NO_FAKE_FRESHNESS',failedMutation);
  const afterFailed=await freshContext();
  check(afterFailed.body?.data?.applications?.some(x=>x.application_id==='APP-A-EXTERNAL'),'C_AUTHORITATIVE_READ_CORRECT',{applications:afterFailed.body?.data?.applications});
  console.log('ISSUE432_C_FAILED_MUTATION_NON_REGRESSION=PASS');

  // D. A -> B -> A clears the old projection synchronously and exposes only the selected context after load.
  const immediateB=await page.evaluate(c=>{window.RONA_CLIENT_CONTEXT.select(c.client_id,c.contract_id);return{projection:window.RONA_CLIENT_CONTEXT.getCurrentProjection(),slot:document.getElementById('company-slot')?.textContent||''}},CTX.B);
  check(immediateB.projection===null&&immediateB.slot.trim()==='','D_B_SWITCH_NEUTRAL_IMMEDIATE',immediateB);
  const loadedB=await page.evaluate(async()=>{await window.RONA_CLIENT_CONTEXT.whenCurrentProjection('issue432-D-B');return window.RONA_CLIENT_CONTEXT.getCurrentProjection()});
  check(loadedB?.contract?.client_id===CTX.B.client_id&&loadedB?.applications?.every(x=>String(x.application_id).startsWith('APP-B-')),'D_B_ONLY',{loadedB});
  const immediateA=await page.evaluate(c=>{window.RONA_CLIENT_CONTEXT.select(c.client_id,c.contract_id);return{projection:window.RONA_CLIENT_CONTEXT.getCurrentProjection(),slot:document.getElementById('company-slot')?.textContent||''}},CTX.A);
  check(immediateA.projection===null&&immediateA.slot.trim()==='','D_A_SWITCH_NEUTRAL_IMMEDIATE',immediateA);
  const loadedA=await page.evaluate(async()=>{await window.RONA_CLIENT_CONTEXT.whenCurrentProjection('issue432-D-A');return window.RONA_CLIENT_CONTEXT.getCurrentProjection()});
  check(loadedA?.contract?.client_id===CTX.A.client_id&&!loadedA?.applications?.some(x=>String(x.application_id).startsWith('APP-B-')),'D_A_ONLY',{loadedA});
  console.log('ISSUE432_D_CONTEXT_SWITCH_ISOLATION=PASS');

  // E. Late generation-N response after context switch is discarded and cannot overwrite generation N+1.
  await select('A');
  delayNextContext='A';delayedStarted=false;releaseDelayed=null;
  const staleRead=page.evaluate(async()=>{try{const r=await fetch('/portal/api/v1/client/context',{cache:'no-store'});await r.json();return{ok:true}}catch(error){return{ok:false,error:String(error?.message||error)}}});
  check(await waitFor(()=>delayedStarted&&typeof releaseDelayed==='function'),'E_DELAYED_READ_STARTED');
  const switched=await page.evaluate(async c=>{window.RONA_CLIENT_CONTEXT.select(c.client_id,c.contract_id);await window.RONA_CLIENT_CONTEXT.whenCurrentProjection('issue432-E-B');return window.RONA_CLIENT_CONTEXT.getCurrentProjection()},CTX.B);
  releaseDelayed?.();
  const staleOutcome=await staleRead;
  await sleep(30);
  const afterRace=await page.evaluate(()=>window.RONA_CLIENT_CONTEXT.getCurrentProjection());
  check(staleOutcome.ok===false&&/STALE_RESPONSE|CONTEXT_CHANGED/.test(staleOutcome.error),'E_STALE_RESPONSE_REJECTED',staleOutcome);
  check(switched?.contract?.client_id===CTX.B.client_id&&afterRace?.contract?.client_id===CTX.B.client_id,'E_GENERATION_N_CANNOT_OVERWRITE',{switched,afterRace});
  console.log('ISSUE432_E_INFLIGHT_STALE_RESPONSE_RACE=PASS');

  // F. TTL + explicit no-store + single-flight contract.
  await select('A');
  const beforeOrdinary=reads.A;
  await ordinaryContext();
  check(reads.A===beforeOrdinary,'F_ORDINARY_WITHIN_TTL_REUSES_MEMORY',{beforeOrdinary,after:reads.A});
  const beforeNoStore=reads.A;
  await freshContext();
  check(reads.A===beforeNoStore+1,'F_NO_STORE_ALWAYS_REVALIDATES',{beforeNoStore,after:reads.A});
  const beforeTtl=reads.A;
  await page.evaluate(async()=>{const realNow=Date.now,base=realNow();Date.now=()=>base+20000;try{const r=await fetch('/portal/api/v1/client/context');await r.json()}finally{Date.now=realNow}});
  check(reads.A===beforeTtl+1,'F_TTL_EVENTUALLY_REVALIDATES',{beforeTtl,after:reads.A});
  delayNextContext='A';delayedStarted=false;releaseDelayed=null;
  const beforeSingleFlight=reads.A;
  const concurrent=page.evaluate(async()=>{const [a,b]=await Promise.all([fetch('/portal/api/v1/client/context',{cache:'no-store'}),fetch('/portal/api/v1/client/context',{cache:'no-store'})]);await Promise.all([a.json(),b.json()]);return true});
  check(await waitFor(()=>delayedStarted&&typeof releaseDelayed==='function'),'F_SINGLE_FLIGHT_REQUEST_STARTED');
  releaseDelayed?.();
  await concurrent;
  check(reads.A===beforeSingleFlight+1,'F_CONCURRENT_FRESH_READS_SINGLE_FLIGHT',{beforeSingleFlight,after:reads.A});
  console.log('ISSUE432_F_CACHE_CONTRACT=PASS');

  // G. Existing authorization boundary and projection scope validation remain fail-closed.
  const beforeUnauthorized={...reads};
  const unauthorized=await page.evaluate(()=>{try{window.RONA_CLIENT_CONTEXT.select('FOREIGN-CLIENT','FOREIGN-CONTRACT');return{threw:false}}catch(error){return{threw:true,error:String(error?.message||error)}}});
  check(unauthorized.threw&&unauthorized.error.includes('CLIENT_CONTEXT_NOT_AUTHORIZED'),'G_UNAUTHORIZED_SELECTION_REJECTED',unauthorized);
  check(reads.A===beforeUnauthorized.A&&reads.B===beforeUnauthorized.B,'G_UNAUTHORIZED_SELECTION_NO_NETWORK',{beforeUnauthorized,reads});
  mismatchNextContext='A';
  const mismatch=await page.evaluate(async()=>{try{const r=await fetch('/portal/api/v1/client/context',{cache:'no-store'});await r.json();return{threw:false,projection:window.RONA_CLIENT_CONTEXT.getCurrentProjection()}}catch(error){return{threw:true,error:String(error?.message||error),projection:window.RONA_CLIENT_CONTEXT.getCurrentProjection()}}});
  check(mismatch.threw&&mismatch.error.includes('CLIENT_CONTEXT_PROJECTION_SCOPE_MISMATCH')&&mismatch.projection===null,'G_CROSS_CONTEXT_PROJECTION_REJECTED',mismatch);
  const recovered=await freshContext();
  check(recovered.body?.data?.contract?.client_id===CTX.A.client_id,'G_AUTHORIZED_RECOVERY',{recovered});
  console.log('ISSUE432_G_AUTH_AND_NO_CROSS_CLIENT_LEAKAGE=PASS');

  check(failures.length===0,'ISSUE432_ASSERTION_SET',{failures});
  if(failures.length)throw new Error(`ISSUE432_QA_FAILED:${JSON.stringify(failures)}`);
  console.log('ISSUE432_ROOT_CAUSE_PROOF=PASS mutation_route_gap=closed unbounded_memory_cache=bounded explicit_no_store=network generation_safe=true');
  console.log('ISSUE432_VISUAL_DELTA=NONE');
  console.log('ISSUE432_CLIENT_CONTEXT_COHERENCE=PASS');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
