import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {onRequest as ownerApi} from '../functions/portal/owner-api.js';

function required(name){
  const value=String(process.env[name]||'').trim();
  assert.ok(value,`${name} is required`);
  return value;
}
function b64url(value){return Buffer.from(JSON.stringify(value)).toString('base64url')}
function jwt(secret){
  const header=b64url({alg:'HS256',typ:'JWT'});
  const payload=b64url({role:'postgres',exp:Math.floor(Date.now()/1000)+900});
  const input=`${header}.${payload}`;
  const signature=createHmac('sha256',secret).update(input).digest('base64url');
  return `${input}.${signature}`;
}
function psqlScalar(sql){
  return String(execFileSync('psql',[required('DATABASE_URL'),'-X','-v','ON_ERROR_STOP=1','-Atc',sql],{encoding:'utf8'})).trim();
}
async function jsonOf(response){return response.json().catch(()=>null)}
function codeOf(payload){return String(payload?.code||payload?.message||payload?.error||'')}

const rpcUpstream=required('RONA_QA_RPC_UPSTREAM').replace(/\/$/,'');
assert.match(rpcUpstream,/^http:\/\/(127\.0\.0\.1|localhost):\d+\/rpc$/,'RONA_QA_RPC_UPSTREAM must be loopback PostgREST /rpc');
const jwtSecret=required('PGRST_JWT_SECRET');
const artifactPath=String(process.env.OWNER_E2E_ARTIFACT||'artifacts/pr448-sent-finance-materialization-e2e.json');
const accessToken=jwt(jwtSecret);

const server=createServer(async(req,res)=>{
  try{
    const chunks=[];
    for await(const chunk of req)chunks.push(chunk);
    const body=chunks.length?Buffer.concat(chunks):undefined;
    const origin=`http://127.0.0.1:${server.address().port}`;
    const request=new Request(`${origin}${req.url}`,{
      method:req.method,
      headers:req.headers,
      body:['GET','HEAD'].includes(String(req.method||'GET').toUpperCase())?undefined:body
    });
    const response=await ownerApi({request});
    res.statusCode=response.status;
    for(const [name,value] of response.headers)res.setHeader(name,value);
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){
    res.statusCode=500;
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({ok:false,code:'QA_ROUTE_ADAPTER_ERROR',message:String(error?.message||error)}));
  }
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const base=`http://127.0.0.1:${server.address().port}`;

const proof={
  version:'pr448-sent-finance-materialization-free-route-v1',
  head:String(process.env.PR_HEAD_SHA||''),
  baseline:'9109643022736e02f86285b375eb5e4a2e73e046',
  candidateMigrationSha256:String(process.env.CANDIDATE_MIGRATION_SHA256||''),
  proofMode:'free-disposable-postgres-postgrest-real-owner-api',
  immutablePreview:String(process.env.IMMUTABLE_PREVIEW_UI_ONLY||''),
  testedAt:new Date().toISOString(),
  mockRpc:false,
  rpcIntercept:false,
  paidResources:false,
  productionBusinessDataMutation:false,
  checks:{},
  evidence:{}
};

async function send(dealId){
  const response=await fetch(`${base}/portal/owner-api?path=${encodeURIComponent(`/admin/deals/${dealId}/send-to-payments`)}`,{
    method:'POST',
    headers:{
      accept:'application/json',
      'content-type':'application/json',
      cookie:`rona_portal_at=${accessToken}`,
      origin:base,
      referer:`${base}/portal/admin`
    },
    body:'{}'
  });
  return {response,payload:await jsonOf(response)};
}

try{
  assert.match(proof.head,/^[0-9a-f]{40}$/,'exact PR HEAD must be bound into proof');
  assert.match(proof.candidateMigrationSha256,/^[0-9a-f]{64}$/,'candidate migration SHA-256 must be bound into proof');

  const health=await fetch(rpcUpstream.replace(/\/rpc$/,'/'));
  assert.equal(health.status,200,'ephemeral PostgREST is not reachable');
  proof.checks.postgrestReachable='PASS';

  // Release-time generic backfill must have repaired an already-SENT fixture before any browser/API retry.
  const sentBackfill=psqlScalar("select concat_ws('|',fs.obligation_amount::text,fs.received_amount::text,fs.client_remaining_amount::text,btrim(fs.currency),w.payment_expectation_state,w.payment_expectation_amount::text,btrim(w.payment_expectation_currency)) from portal_private.deals d join portal_private.owner_deal_workflow w on w.deal_key=d.id join portal_private.owner_deal_finance_summary fs on fs.deal_id=d.deal_id where d.deal_id='QA-ALREADY-SENT'");
  const sentParts=sentBackfill.split('|');
  assert.equal(Number(sentParts[0]),1000);
  assert.equal(Number(sentParts[1]),0);
  assert.equal(Number(sentParts[2]),1000);
  assert.equal(sentParts[3],'USD');
  assert.equal(sentParts[4],'ACTIVE');
  assert.equal(Number(sentParts[5]),1000);
  assert.equal(sentParts[6],'USD');
  assert.equal(psqlScalar("select count(*) from portal_private.owner_payment_plan p join portal_private.deals d on d.id=p.deal_key where d.deal_id='QA-ALREADY-SENT'"),'2');
  proof.checks.genericAlreadySentBackfill='PASS';
  proof.evidence.alreadySent={obligation:1000,received:0,remaining:1000,currency:'USD',planRows:2};

  // Production-equivalent economics: published/application 743, accepted counter-offer 740, quantity 490.
  let result=await send('QA-ACCEPTED-COUNTER-GO');
  assert.equal(result.response.status,200,`accepted-counter GO failed: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.ok,true);
  assert.equal(result.payload?.data?.state,'SENT');
  assert.equal(Number(result.payload?.data?.obligation),362600,'must use accepted 740 x 490, not later/published 743');
  assert.equal(Number(result.payload?.data?.received),0);
  assert.equal(Number(result.payload?.data?.amount),362600);
  assert.equal(result.payload?.data?.currency,'USD');
  assert.equal(result.payload?.data?.financePending,false);
  assert.equal(result.payload?.data?.financeSource,'ACCEPTED_COUNTEROFFER');
  assert.equal(result.payload?.data?.idempotent,false);
  proof.checks.acceptedCounterEconomics='PASS';

  const finance009=psqlScalar("select concat_ws('|',obligation_amount::text,received_amount::text,client_remaining_amount::text,btrim(currency),finance_status,authority_state,lifecycle_state,source_document) from portal_private.owner_deal_finance_summary where deal_id='QA-ACCEPTED-COUNTER-GO'");
  const f=finance009.split('|');
  assert.equal(Number(f[0]),362600);
  assert.equal(Number(f[1]),0);
  assert.equal(Number(f[2]),362600);
  assert.equal(f[3],'USD');
  assert.equal(f[4],'DUE');
  assert.equal(f[5],'CONFIRMED');
  assert.equal(f[6],'ACTIVE');
  assert.equal(f[7],'APPLICATION:QA-APP-001');

  const plan009=psqlScalar("select string_agg(concat_ws('|',tranche_no::text,planned_amount::text,btrim(currency),status,case when due_at is null then 'DEFERRED' else 'DUE' end),';' order by tranche_no) from portal_private.owner_payment_plan p join portal_private.deals d on d.id=p.deal_key where d.deal_id='QA-ACCEPTED-COUNTER-GO'");
  const planRows=plan009.split(';').map(x=>x.split('|'));
  assert.equal(planRows.length,2);
  assert.equal(planRows[0][0],'1');
  assert.equal(Number(planRows[0][1]),108780);
  assert.equal(planRows[0][2],'USD');
  assert.equal(planRows[0][4],'DUE');
  assert.equal(planRows[1][0],'2');
  assert.equal(Number(planRows[1][1]),253820);
  assert.equal(planRows[1][2],'USD');
  assert.equal(planRows[1][4],'DEFERRED');
  proof.checks.contractualThirtySeventySchedule='PASS';
  proof.evidence.productionEquivalent={acceptedUnitPrice:740,quantityTonnes:490,obligation:362600,received:0,remaining:362600,currency:'USD',deposit:108780,deferred:253820};

  // Repeated send must repair/read canonically without duplicates.
  result=await send('QA-ACCEPTED-COUNTER-GO');
  assert.equal(result.response.status,200,`repeat send failed: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.data?.idempotent,true);
  assert.equal(Number(result.payload?.data?.amount),362600);
  assert.equal(psqlScalar("select count(*) from portal_private.owner_deal_finance_summary where deal_id='QA-ACCEPTED-COUNTER-GO'"),'1');
  assert.equal(psqlScalar("select count(*) from portal_private.owner_payment_plan p join portal_private.deals d on d.id=p.deal_key where d.deal_id='QA-ACCEPTED-COUNTER-GO'"),'2');
  proof.checks.repeatIdempotentNoDuplicates='PASS';

  // A valid pre-existing confirmed finance summary is authoritative and must not be overwritten.
  const financeBefore=psqlScalar("select concat_ws('|',obligation_amount::text,received_amount::text,client_remaining_amount::text,btrim(currency),finance_status,source_document,source_version) from portal_private.owner_deal_finance_summary where deal_id='QA-EXISTING-FINANCE'");
  result=await send('QA-EXISTING-FINANCE');
  assert.equal(result.response.status,200,`existing-finance send failed: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.data?.financeSource,'EXISTING_CONFIRMED_FINANCE');
  assert.equal(Number(result.payload?.data?.obligation),12500);
  assert.equal(Number(result.payload?.data?.received),2500);
  assert.equal(Number(result.payload?.data?.amount),10000);
  const financeAfter=psqlScalar("select concat_ws('|',obligation_amount::text,received_amount::text,client_remaining_amount::text,btrim(currency),finance_status,source_document,source_version) from portal_private.owner_deal_finance_summary where deal_id='QA-EXISTING-FINANCE'");
  assert.equal(financeAfter,financeBefore,'confirmed finance summary was overwritten');
  proof.checks.existingConfirmedFinancePreserved='PASS';

  // Verified bank fact is respected when finance is first materialized.
  result=await send('QA-BANK-FACT');
  assert.equal(result.response.status,200,`bank-fact send failed: ${JSON.stringify(result.payload)}`);
  assert.equal(Number(result.payload?.data?.obligation),1000);
  assert.equal(Number(result.payload?.data?.received),300);
  assert.equal(Number(result.payload?.data?.amount),700);
  assert.equal(result.payload?.data?.currency,'USD');
  proof.checks.authoritativeBankFactPreserved='PASS';

  result=await send('QA-HOLD');
  assert.notEqual(result.response.status,200,'HOLD fixture must fail closed');
  assert.equal(codeOf(result.payload),'DEAL_NOT_ACTIVE',`unexpected HOLD blocker: ${JSON.stringify(result.payload)}`);
  assert.equal(psqlScalar("select payment_handoff_state from portal_private.owner_deal_workflow w join portal_private.deals d on d.id=w.deal_key where d.deal_id='QA-HOLD'"),'NOT_SENT');
  proof.checks.holdFailClosed='DEAL_NOT_ACTIVE';

  result=await send('QA-MISSING-DOC');
  assert.notEqual(result.response.status,200,'missing-document fixture must fail closed');
  assert.equal(codeOf(result.payload),'INVOICE_REQUIRED',`unexpected document blocker: ${JSON.stringify(result.payload)}`);
  assert.equal(psqlScalar("select payment_handoff_state from portal_private.owner_deal_workflow w join portal_private.deals d on d.id=w.deal_key where d.deal_id='QA-MISSING-DOC'"),'NOT_SENT');
  proof.checks.missingDocumentFailClosed='INVOICE_REQUIRED';

  const uiSource=await readFile('functions/portal/admin-main-ui-current.js','utf8');
  assert.equal(uiSource.includes('handoffPending'),false,'handoffPending workaround still exists');
  assert.equal(uiSource.includes('Передано в оплату — сумма формируется'),false,'fallback Payments section still exists');
  assert.equal(uiSource.includes("dealFinanceSummaries"),true,'normal finance-summary projection missing');
  assert.equal(uiSource.includes('Ожидается поступлений'),true,'normal expected-payments projection missing');
  proof.checks.noFallbackPaymentsSection='PASS';
  proof.checks.normalExpectedProjectionSource='PASS';

  proof.result='PASS';
  await mkdir(artifactPath.split('/').slice(0,-1).join('/')||'.',{recursive:true});
  await writeFile(artifactPath,JSON.stringify(proof,null,2)+'\n','utf8');
  console.log('ADMIN_SENT_FINANCE_MATERIALIZATION_FREE_REAL_ROUTE_E2E=PASS',JSON.stringify(proof));
}finally{
  await new Promise(resolve=>server.close(resolve));
}
