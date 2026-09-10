import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
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
const artifactPath=String(process.env.OWNER_E2E_ARTIFACT||'artifacts/pr452-free-ephemeral-route-e2e.json');
const accessToken=jwt(jwtSecret);

const env={
  RONA_QA_RPC_MODE:'LOCAL_EPHEMERAL_POSTGREST',
  RONA_QA_RPC_UPSTREAM:rpcUpstream
};

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
    const response=await ownerApi({request,env});
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
  version:'pr452-free-ephemeral-route-e2e-v3',
  proofMode:'free-local-postgres-postgrest',
  testedAt:new Date().toISOString(),
  mockRpc:false,
  rpcIntercept:false,
  paidResources:false,
  productionBusinessDataMutation:false,
  ownerTestableCandidatePreview:false,
  checks:{}
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
  const health=await fetch(rpcUpstream.replace(/\/rpc$/,'/'));
  assert.equal(health.status,200,'ephemeral PostgREST is not reachable');
  proof.checks.postgrestReachable='PASS';

  let result=await send('QA-NOFIN-GO');
  assert.equal(result.response.status,200,`no-finance GO route failed: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.ok,true,'owner-api did not return ok=true');
  assert.equal(result.payload?.data?.state,'SENT','no-finance GO did not reach SENT');
  assert.equal(result.payload?.data?.financePending,true,'no-finance GO must remain financePending');
  assert.equal(result.payload?.data?.amount,null,'amount was fabricated');
  assert.equal(result.payload?.data?.currency,null,'currency was fabricated');
  assert.equal(result.payload?.data?.idempotent,false,'first send must not be idempotent');
  proof.checks.realRouteNoFinanceGo='PASS';

  result=await send('QA-NOFIN-GO');
  assert.equal(result.response.status,200,`repeat route failed: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.data?.state,'SENT','repeat route lost SENT state');
  assert.equal(result.payload?.data?.idempotent,true,'repeat route must be idempotent');
  assert.equal(result.payload?.data?.amount,null,'repeat route fabricated amount');
  assert.equal(result.payload?.data?.currency,null,'repeat route fabricated currency');
  proof.checks.repeatIdempotent='PASS';

  result=await send('QA-FIN-GO');
  assert.equal(result.response.status,200,`finance-ready GO route failed: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload?.data?.state,'SENT','finance-ready GO did not reach SENT');
  assert.equal(result.payload?.data?.financePending,false,'finance-ready GO regressed');
  assert.equal(Number(result.payload?.data?.amount),12500,'existing finance amount changed');
  assert.equal(result.payload?.data?.currency,'USD','existing finance currency changed');
  proof.checks.existingFinanceBehaviorPreserved='PASS';

  result=await send('QA-HOLD');
  assert.notEqual(result.response.status,200,'HOLD/non-active fixture must fail closed');
  assert.equal(codeOf(result.payload),'DEAL_NOT_ACTIVE',`unexpected HOLD blocker: ${JSON.stringify(result.payload)}`);
  proof.checks.holdFailClosed='DEAL_NOT_ACTIVE';

  result=await send('QA-MISSING-DOC');
  assert.notEqual(result.response.status,200,'missing-document fixture must fail closed');
  assert.equal(codeOf(result.payload),'INVOICE_REQUIRED',`unexpected document blocker: ${JSON.stringify(result.payload)}`);
  proof.checks.missingDocumentFailClosed='INVOICE_REQUIRED';

  const nofinState=psqlScalar("select concat_ws('|',payment_handoff_state,coalesce(payment_expectation_state,''),coalesce(payment_expectation_amount::text,'NULL'),coalesce(payment_expectation_currency,'NULL')) from portal_private.owner_deal_workflow w join portal_private.deals d on d.id=w.deal_key where d.deal_id='QA-NOFIN-GO'");
  assert.equal(nofinState,'SENT|NOT_CREATED|NULL|NULL','no-finance workflow state is not clean SENT without amount/currency');
  assert.equal(psqlScalar("select count(*) from portal_private.owner_payment_plan p join portal_private.deals d on d.id=p.deal_key where d.deal_id='QA-NOFIN-GO'"),'0','no-finance payment plan was fabricated');
  proof.checks.noFabricatedPaymentPlan='PASS';

  const financePlan=psqlScalar("select concat_ws('|',planned_amount::text,currency,status,source_system) from portal_private.owner_payment_plan p join portal_private.deals d on d.id=p.deal_key where d.deal_id='QA-FIN-GO' and tranche_no=1");
  assert.equal(financePlan,'12500|USD|EXPECTED|ADMIN_DEAL_HANDOFF_R1','existing finance payment-plan behavior regressed');
  proof.checks.financePlanPreserved='PASS';

  assert.equal(psqlScalar("select payment_handoff_state from portal_private.owner_deal_workflow w join portal_private.deals d on d.id=w.deal_key where d.deal_id='QA-HOLD'"),'NOT_SENT','HOLD fixture mutated despite rejection');
  assert.equal(psqlScalar("select payment_handoff_state from portal_private.owner_deal_workflow w join portal_private.deals d on d.id=w.deal_key where d.deal_id='QA-MISSING-DOC'"),'NOT_SENT','missing-document fixture mutated despite rejection');
  proof.checks.negativeCasesNotMutated='PASS';

  proof.result='PASS';
  await mkdir(artifactPath.split('/').slice(0,-1).join('/')||'.',{recursive:true});
  await writeFile(artifactPath,JSON.stringify(proof,null,2)+'\n','utf8');
  console.log('ADMIN_GO_PAYMENT_NO_FINANCE_FREE_REAL_ROUTE_E2E=PASS',JSON.stringify(proof));
}finally{
  await new Promise(resolve=>server.close(resolve));
}
