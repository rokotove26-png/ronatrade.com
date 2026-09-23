import { chromium } from 'playwright';
import { createHash } from 'node:crypto';

export const ORIGIN=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
export const HEAD=String(process.env.EXPECTED_HEAD||'');
export const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
export const ISSUER_REGION='eu-central-1';
export const DIRECT_PORTAL_API='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-portal-api';
export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
export const AUDIENCE='rona-radio-stage2a-production-v1';
export const QA={admin:'a2a0b91e-4c2a-4d3e-8f11-2a2a00000001',clientA:'a2a0b91e-4c2a-4d3e-8f11-2a2a00000002',clientB:'a2a0b91e-4c2a-4d3e-8f11-2a2a00000003',clientA2:'a2a0b91e-4c2a-4d3e-8f11-2a2a00000004',agentA:'a2a0b91e-4c2a-4d3e-8f11-2a2a00000005',agentB:'a2a0b91e-4c2a-4d3e-8f11-2a2a00000006'};
export const CLIENT_IDS=['RONA-C002','RONA-C003','RONA-C004','RONA-C005'];
export const AGENT_IDS=['AGP-2026-001','AGP-2026-002'];
export const C002={client_id:'RONA-C002',contract_id:'RONA-C002-CTR-2026-001'};
export const C003={client_id:'RONA-C003',contract_id:'RONA-C003-CTR-2026-001'};
export const C005={client_id:'RONA-C005',contract_id:'RONA-C005-CTR-2026-001'};
export const A001={agent_person_id:'AGP-2026-001',name:'Артем Белов'};
export const A002={agent_person_id:'AGP-2026-002',name:'Егор Кузнецов'};
export const VISUAL={client:'f3c49ac46cc32ee0cd92eefadb905f8ac52778ca',adminFinal:'89391945e49e49570e22e6cbfecd5a6e7e46b40c',adminWide:'1e32655109534962580e96057def98208f69eaa4'};

export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export const assert=(v,m)=>{if(!v)throw new Error(m)};
export const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
export const sameSet=(a,b)=>JSON.stringify([...(a||[])].map(String).sort())===JSON.stringify([...(b||[])].map(String).sort());
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');

if(ORIGIN!=='https://ronaoil.com')throw new Error('PRODUCTION_ORIGIN_REQUIRED');
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('EXACT_RELEASE_HEAD_REQUIRED');

async function oidc(){
  const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');
  const url=base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE);
  let last='UNKNOWN';
  for(let attempt=0;attempt<6;attempt++){
    let r,j;
    try{
      r=await fetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
      j=await r.json().catch(()=>null);
    }catch(error){
      last='NETWORK_OR_TIMEOUT';
      if(attempt<5){await sleep(Math.min(1000*(attempt+1),5000));continue}
      throw new Error(`GITHUB_OIDC_${last}`);
    }
    if(r.ok&&j?.value)return j.value;
    last=String(r.status);
    if([429,500,502,503,504,520,522,524].includes(r.status)&&attempt<5){
      await sleep(Math.min(1000*(attempt+1),5000));continue
    }
    throw new Error(`GITHUB_OIDC_${last}`);
  }
  throw new Error(`GITHUB_OIDC_${last}`);
}
export async function issuerCall(path,body={},waitForActive=false){
  let last='';
  const maxAttempts=waitForActive?12:6;
  const requestTimeoutMs=path==='/issue'?90000:45000;
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const token=await oidc();
    let r,j;
    try{
      r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','cache-control':'no-store','x-region':ISSUER_REGION},body:JSON.stringify(body),signal:AbortSignal.timeout(requestTimeoutMs)});
      j=await r.json().catch(()=>null);
    }catch(error){
      last='NETWORK_OR_TIMEOUT';
      if(attempt<maxAttempts-1){await sleep(Math.min(1000*(attempt+1),5000));continue}
      throw new Error(`ISSUER_${path}_${last}`);
    }
    if(r.ok&&j?.ok)return j;
    last=`${r.status}:${j?.code||'UNKNOWN'}`;
    const transient=[429,500,502,503,504,520,522,524,546].includes(r.status)||/TIMEOUT|RESOURCE_LIMIT|TEMPORAR|OVERLOAD/i.test(String(j?.code||''));
    if((waitForActive&&r.status===410)||transient){
      if(attempt<maxAttempts-1){await sleep(waitForActive&&r.status===410?5000:Math.min(1000*(attempt+1),5000));continue}
    }
    throw new Error(`ISSUER_${path}_${last}`);
  }
  throw new Error(`ISSUER_ACTIVE_TIMEOUT:${last}`);
}
export async function cleanupQa(){return issuerCall('/cleanup')}
export async function directory(){return (await issuerCall('/directory')).directory}
export async function issue(portalUserId){
  const j=await issuerCall('/issue',{portalUserId},true);
  assert(j.access_token&&j.session_id&&j.auth_user_id,'ISSUER_SESSION_RESPONSE_INVALID');
  return{portalUserId,accessToken:j.access_token,sessionId:j.session_id,authUserId:j.auth_user_id,role:j.role,revoked:false};
}
export async function revoke(s){
  if(s.revoked)return;
  const j=await issuerCall('/revoke',{accessToken:s.accessToken,sessionId:s.sessionId,authUserId:s.authUserId});
  assert(j.revoked===true&&j.session_absent===true,'QA_SESSION_REVOKE_NOT_PROVEN');s.revoked=true;
}
export async function browser(){return chromium.launch({headless:true})}
export async function context(browser,session){
  const c=await browser.newContext({viewport:{width:1440,height:1000}});
  await c.addCookies([{name:'rona_portal_at',value:session.accessToken,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  return c;
}
export async function api(c,path,{method='GET',body=null,headers={},referer='/portal/admin',timeoutMs=30000}={}){
  const r=await c.request.fetch(ORIGIN+path,{method,headers:{accept:'application/json',origin:ORIGIN,referer:ORIGIN+referer,'cache-control':'no-store',...headers},data:body??undefined,failOnStatusCode:false,timeout:timeoutMs});
  return{status:r.status(),body:await r.json().catch(()=>null)};
}
export async function directAgentBootstrap(session){
  const r=await fetch(DIRECT_PORTAL_API+'/v1/agent/bootstrap',{headers:{
    authorization:`Bearer ${session.accessToken}`,
    apikey:SUPABASE_PUBLISHABLE_KEY,
    accept:'application/json',
    'cache-control':'no-store'
  }});
  return{status:r.status,body:await r.json().catch(()=>null)};
}
export const proxyAgentBootstrap=c=>api(c,'/portal/api/v1/agent/bootstrap',{referer:'/portal/agent'});
export async function wait(fn,label,timeout=30000,interval=300){
  const started=Date.now();let last=null;
  while(Date.now()-started<timeout){try{last=await fn();if(last)return last}catch(e){last=e}await sleep(interval)}
  throw new Error(`${label}_TIMEOUT:${last instanceof Error?last.message:JSON.stringify(last)}`);
}
export async function selectClient(page,target){
  await wait(()=>page.evaluate(()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady)),'CLIENT_CONTEXT_RUNTIME_READY',30000,250);
  await page.evaluate(async t=>{const x=window.RONA_CLIENT_CONTEXT;await x.whenReady();x.select(t.client_id,t.contract_id)},target);
  await wait(()=>page.evaluate(t=>{const x=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();return x?.client_id===t.client_id&&x?.contract_id===t.contract_id},target),'CLIENT_CONTEXT_SELECTION',15000,250);
}
export async function openMessages(page){
  const n=page.locator('[data-page="messages"]').first();await n.waitFor({state:'visible',timeout:20000});await n.click();await page.locator('#page-messages').waitFor({state:'visible',timeout:10000});
}
export const clientMessages=(c,t)=>api(c,'/portal/api/v1/client/messages?clientId='+encodeURIComponent(t.client_id)+'&contractId='+encodeURIComponent(t.contract_id),{referer:'/portal/client'});
export const agentMessages=c=>api(c,'/portal/api/v1/agent/messages',{referer:'/portal/agent'});
export const adminBoot=c=>api(c,'/portal/api/v1/admin/radio/bootstrap',{referer:'/portal/admin',headers:{'x-rona-client-source':'ADMIN_RADIO_STAGE2A_OPERATIONAL_PRODUCTION_QA'}});
export async function retire(c,ids){
  const eventIds=[...new Set((ids||[]).filter(Boolean))];
  if(!eventIds.length)return{status:200,body:{ok:true,retired_events:0,retired_tasks:0}};
  return api(c,'/portal/api/v1/admin/radio/qa-retire',{method:'POST',body:{eventIds},referer:'/portal/admin'});
}
export async function adminDirectories(page){
  const n=page.locator('[data-page="messages"]').first();await n.waitFor({state:'visible',timeout:20000});await n.click();
  const root=page.locator('#page-messages > .rona-rs-root[data-kind="radio"]');await root.waitFor({state:'visible',timeout:30000});
  const s=root.locator('select');assert(await s.count()===3,'ADMIN_RADIO_COMPOSER_SELECT_COUNT_CHANGED');
  await s.nth(0).selectOption('MESSAGE');await s.nth(1).selectOption('CLIENT');
  const clients=await wait(async()=>{const x=await s.nth(2).locator('option').evaluateAll(os=>os.map(o=>({value:o.value,text:o.textContent||''})).filter(o=>o.value));return x.length===4?x:null},'REAL_CLIENT_UI_DIRECTORY');
  await s.nth(1).selectOption('AGENT');
  const agents=await wait(async()=>{const x=await s.nth(2).locator('option').evaluateAll(os=>os.map(o=>({value:o.value,text:o.textContent||''})).filter(o=>o.value));return x.length===2?x:null},'REAL_AGENT_UI_DIRECTORY');
  const values=[...clients,...agents].map(x=>x.value+' '+x.text).join(' ');
  assert(!/PORTAL-EVT-|TASK-|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(values),'INTERNAL_ID_VISIBLE_IN_DIRECTORY');
  return{root,selects:s,clients,agents};
}
export async function clientSubmit(page,target,subject,message){
  await selectClient(page,target);await openMessages(page);await page.locator('#msgSubject').fill(subject);await page.locator('#msgText').fill(message);await page.locator('#sendMessage').click();
  await page.locator('#page-messages .message-grid').getByText(subject,{exact:true}).first().waitFor({state:'visible',timeout:20000});
}
export async function agentSubmit(page,subject,message){
  await openMessages(page);const r=page.locator('#page-messages');await r.locator('.card-body input').fill(subject);await r.locator('.card-body textarea').fill(message);await r.locator('.actions .btn').click();
  await r.getByText(subject,{exact:true}).first().waitFor({state:'visible',timeout:30000});
}
export async function liveBlob(path,expected){
  const r=await fetch(ORIGIN+path+(path.includes('?')?'&':'?')+'_qa='+Date.now(),{headers:{'cache-control':'no-cache'}});
  assert(r.status===200,`LIVE_ASSET_HTTP_${r.status}`);const b=Buffer.from(await r.arrayBuffer()),sha=gitBlobSha(b);assert(sha===expected,`LIVE_ASSET_BLOB_DRIFT_${path}_${sha}`);return{path,bytes:b.length,gitBlobSha:sha};
}
export const isQa=x=>norm(x?.payload?.subject).startsWith('QA STAGE2A')||norm(x?.payload?.message).startsWith('QA STAGE2A');
export const broadcastSignature=d=>JSON.stringify((d?.radio_broadcasts||[]).map(x=>[x.id,x.item_kind,x.target_scope,x.target_id,x.body_text,x.active_from,x.active_until]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
