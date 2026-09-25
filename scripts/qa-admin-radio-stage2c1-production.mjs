import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const ORIGIN=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const HEAD=String(process.env.EXPECTED_HEAD||'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-radio-stage2a-production-v1';
const QA_ADMIN='a2a0b91e-4c2a-4d3e-8f11-2a2a00000001';
const QA_CLIENT_A='a2a0b91e-4c2a-4d3e-8f11-2a2a00000004';
const QA_CLIENT_B='a2a0b91e-4c2a-4d3e-8f11-2a2a00000003';
const QA_AGENT_A='a2a0b91e-4c2a-4d3e-8f11-2a2a00000005';
const QA_AGENT_B='a2a0b91e-4c2a-4d3e-8f11-2a2a00000006';
const CLIENT_A='RONA-C005',CLIENT_B='RONA-C002',AGENT_A='AGP-2026-001',AGENT_B='AGP-2026-002';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
if(ORIGIN!=='https://ronaoil.com')throw new Error('PRODUCTION_ORIGIN_REQUIRED');
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('EXACT_RELEASE_HEAD_REQUIRED');

async function oidc(){
  const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');
  const r=await fetch(base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE),{headers:{authorization:'Bearer '+token}});
  const j=await r.json().catch(()=>null);if(!r.ok||!j?.value)throw new Error('GITHUB_OIDC_'+r.status);return j.value;
}
async function issuerCall(path,body,{waitForActive=false}={}){
  let last='';
  for(let attempt=0;attempt<(waitForActive?60:1);attempt++){
    const token=await oidc();
    const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>null);
    if(r.ok&&j?.ok)return j;
    last=r.status+':'+String(j?.code||'UNKNOWN');
    if(waitForActive&&r.status===410){await sleep(5000);continue}
    throw new Error('ISSUER_'+path+'_'+last);
  }
  throw new Error('ISSUER_ACTIVE_TIMEOUT:'+last);
}
async function issueSession(portalUserId){
  const j=await issuerCall('/issue',{portalUserId},{waitForActive:true});
  assert(j.access_token&&j.session_id&&j.auth_user_id,'ISSUER_SESSION_RESPONSE_INVALID');
  return{portalUserId,accessToken:j.access_token,sessionId:j.session_id,authUserId:j.auth_user_id,revoked:false};
}
async function revokeSession(s){
  if(s.revoked)return;
  const j=await issuerCall('/revoke',{accessToken:s.accessToken,sessionId:s.sessionId,authUserId:s.authUserId});
  assert(j.revoked===true&&j.session_absent===true,'QA_SESSION_REVOKE_NOT_PROVEN');s.revoked=true;
}
async function browserContext(browser,session){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:session.accessToken,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  return context;
}
async function contextApi(context,path,{method='GET',body=null,headers={},referer='/portal/admin'}={}){
  const r=await context.request.fetch(ORIGIN+path,{method,headers:{accept:'application/json',origin:ORIGIN,referer:ORIGIN+referer,'cache-control':'no-store',...headers},data:body??undefined,failOnStatusCode:false});
  return{status:r.status(),body:await r.json().catch(()=>null),headers:r.headers()};
}
async function ownerApi(context,path,{method='GET',body=null,referer='/portal/admin'}={}){
  return contextApi(context,'/portal/owner-api?path='+encodeURIComponent(path),{method,body,referer});
}
async function radioBootstrap(context){
  return contextApi(context,'/portal/api/v1/admin/radio/bootstrap',{referer:'/portal/admin',headers:{'x-rona-client-source':'ADMIN_RADIO_STAGE2C1_PRODUCTION_QA'}});
}
async function waitUntil(fn,label,timeout=45000,interval=350){
  const started=Date.now();let last=null;
  while(Date.now()-started<timeout){try{last=await fn();if(last)return last}catch(error){last=error}await sleep(interval)}
  throw new Error(label+'_TIMEOUT:'+(last instanceof Error?last.message:JSON.stringify(last)));
}
const broadcastRows=r=>Array.isArray(r?.body?.data?.radio_broadcasts)?r.body.data.radio_broadcasts:[];
async function portalText(page,selector){return norm(await page.locator(selector).textContent().catch(()=>''))}
async function waitText(page,selector,text,present=true,timeout=45000){
  return waitUntil(async()=>{const t=await portalText(page,selector);return (present?t.includes(text):!t.includes(text))?t:null},(present?'PRESENT_':'ABSENT_')+selector,timeout,400);
}
async function openPortal(context,path){
  const page=await context.newPage();await page.goto(ORIGIN+path+'?_qa_radio_stage2c1='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});return page;
}
async function adminComposer(page){
  await waitUntil(()=>page.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),'ADMIN_OWNER_READY',60000,300);
  await waitUntil(()=>page.evaluate(()=>Boolean(window.__RONA_REMAINING_SECTIONS_READY__)||window.__RONA_ADMIN_MODULES__?.remaining?.status==='READY'),'ADMIN_REMAINING_READY',90000,300);
  await page.locator('[data-page="messages"]').first().click();
  const root=page.locator('#page-messages > .rona-rs-root[data-kind="radio"]');await root.waitFor({state:'visible',timeout:30000});
  await waitUntil(()=>page.evaluate(()=>window.__RONA_ADMIN_RADIO_BROADCAST_BRIDGE__==='STAGE_2B_NOTIFICATION_ANNOUNCEMENT_V1_STATIC_OWNER'),'ADMIN_RADIO_OWNER',30000,300);
  return root;
}
async function uiPublish(root,{kind,scope,target=null,body}){
  const selects=root.locator('select');assert(await selects.count()===3,'RADIO_COMPOSER_SELECT_COUNT_CHANGED');
  await selects.nth(0).selectOption(kind);await selects.nth(1).selectOption(scope);
  if(target){
    await waitUntil(async()=>{const xs=await selects.nth(2).locator('option').evaluateAll(os=>os.map(o=>o.value));return xs.includes(target)},'RADIO_TARGET_'+target,30000,300);
    await selects.nth(2).selectOption(target);
  }else assert(await selects.nth(2).isDisabled(),'MASS_SCOPE_TARGET_MUST_BE_DISABLED');
  await root.locator('textarea').fill(body);await root.getByRole('button',{name:'Отправить',exact:true}).click();
  await waitUntil(async()=>norm(await root.textContent()).includes(body),'ADMIN_POST_SUBMIT_REFRESH_'+kind+'_'+scope,30000,300);
}

const proof={suite:'RADIO_STAGE2C1_REAL_ACTIVATION_PRODUCTION',releaseHead:HEAD,origin:ORIGIN,scenarios:{},negative:{},idempotency:null,expiry:null,messageRegression:null,cleanup:[],pass:false};
const sessions=[],contexts=[],qaIds=new Set(),qaBodies=new Set();let browser=null,adminContextRef=null;
try{
  const issued=await Promise.all([QA_ADMIN,QA_CLIENT_A,QA_CLIENT_B,QA_AGENT_A,QA_AGENT_B].map(issueSession));sessions.push(...issued);
  browser=await chromium.launch({headless:true});
  const [adminCtx,clientACtx,clientBCtx,agentACtx,agentBCtx]=await Promise.all(sessions.map(s=>browserContext(browser,s)));
  contexts.push(adminCtx,clientACtx,clientBCtx,agentACtx,agentBCtx);adminContextRef=adminCtx;
  const adminPage=await openPortal(adminCtx,'/portal/admin'),root=await adminComposer(adminPage);
  const clientAPage=await openPortal(clientACtx,'/portal/client'),clientBPage=await openPortal(clientBCtx,'/portal/client');
  const agentAPage=await openPortal(agentACtx,'/portal/agent'),agentBPage=await openPortal(agentBCtx,'/portal/agent');
  await waitUntil(()=>clientAPage.evaluate(()=>window.__RONA_PORTAL_RADIO_BROADCAST_V1__==='20260925-stage2c1-v1'),'CLIENT_RUNTIME',30000,300);
  await waitUntil(()=>agentAPage.evaluate(()=>window.__RONA_PORTAL_RADIO_BROADCAST_V1__==='20260925-stage2c1-v1'),'AGENT_RUNTIME',30000,300);

  const tag=Date.now().toString(36);
  const scenarios=[
    {key:'N_CLIENT',kind:'NOTIFICATION',scope:'CLIENT',target:CLIENT_A,body:'QA2C1 N CLIENT '+tag},
    {key:'N_ALL_CLIENTS',kind:'NOTIFICATION',scope:'ALL_CLIENTS',body:'QA2C1 N ALL CLIENTS '+tag},
    {key:'A_CLIENT',kind:'ANNOUNCEMENT',scope:'CLIENT',target:CLIENT_A,body:'QA2C1 A CLIENT '+tag},
    {key:'A_ALL_CLIENTS',kind:'ANNOUNCEMENT',scope:'ALL_CLIENTS',body:'QA2C1 A ALL CLIENTS '+tag},
    {key:'A_AGENT',kind:'ANNOUNCEMENT',scope:'AGENT',target:AGENT_A,body:'QA2C1 A AGENT '+tag},
    {key:'A_ALL_AGENTS',kind:'ANNOUNCEMENT',scope:'ALL_AGENTS',body:'QA2C1 A ALL AGENTS '+tag}
  ];
  for(const s of scenarios){
    qaBodies.add(s.body);await uiPublish(root,s);
    const row=await waitUntil(async()=>{const b=await radioBootstrap(adminCtx);return broadcastRows(b).find(x=>norm(x.body_text)===s.body)||null},'PERSIST_'+s.key,45000,500);
    qaIds.add(String(row.id));proof.scenarios[s.key]={id:String(row.id),kind:row.item_kind,scope:row.target_scope,target:row.target_id||null};
  }

  await waitText(clientAPage,'#ronaRadioNotificationOverlay','QA2C1 N CLIENT '+tag,true);
  await waitText(clientBPage,'#ronaRadioNotificationOverlay','QA2C1 N CLIENT '+tag,false);
  assert(!(await portalText(agentAPage,'body')).includes('QA2C1 N CLIENT '+tag),'AGENT_SEES_CLIENT_NOTIFICATION');
  proof.scenarios.N_CLIENT.clientA_modal=true;proof.scenarios.N_CLIENT.clientB_isolated=true;

  await clientAPage.reload({waitUntil:'domcontentloaded'});await waitText(clientAPage,'#ronaRadioNotificationOverlay','QA2C1 N ALL CLIENTS '+tag,true);
  await clientBPage.reload({waitUntil:'domcontentloaded'});await waitText(clientBPage,'#ronaRadioNotificationOverlay','QA2C1 N ALL CLIENTS '+tag,true);
  assert(!(await portalText(agentAPage,'body')).includes('QA2C1 N ALL CLIENTS '+tag),'AGENT_SEES_ALL_CLIENT_NOTIFICATION');
  proof.scenarios.N_ALL_CLIENTS.allClientsModal=true;

  await waitText(clientAPage,'#ronaRadioAnnouncementTicker','QA2C1 A CLIENT '+tag,true);
  await waitText(clientBPage,'#ronaRadioAnnouncementTicker','QA2C1 A CLIENT '+tag,false);
  proof.scenarios.A_CLIENT.clientTicker=true;proof.scenarios.A_CLIENT.clientIsolation=true;

  await waitText(clientAPage,'#ronaRadioAnnouncementTicker','QA2C1 A ALL CLIENTS '+tag,true);
  await waitText(clientBPage,'#ronaRadioAnnouncementTicker','QA2C1 A ALL CLIENTS '+tag,true);
  assert(!(await portalText(agentAPage,'#ronaRadioAnnouncementTicker')).includes('QA2C1 A ALL CLIENTS '+tag),'AGENT_SEES_ALL_CLIENT_ANNOUNCEMENT');
  proof.scenarios.A_ALL_CLIENTS.allClientTickers=true;

  await waitText(agentAPage,'#ronaRadioAnnouncementTicker','QA2C1 A AGENT '+tag,true);
  await waitText(agentBPage,'#ronaRadioAnnouncementTicker','QA2C1 A AGENT '+tag,false);
  proof.scenarios.A_AGENT.agentTicker=true;proof.scenarios.A_AGENT.agentIsolation=true;

  await waitText(agentAPage,'#ronaRadioAnnouncementTicker','QA2C1 A ALL AGENTS '+tag,true);
  await waitText(agentBPage,'#ronaRadioAnnouncementTicker','QA2C1 A ALL AGENTS '+tag,true);
  assert(!(await portalText(clientAPage,'#ronaRadioAnnouncementTicker')).includes('QA2C1 A ALL AGENTS '+tag),'CLIENT_SEES_ALL_AGENT_ANNOUNCEMENT');
  proof.scenarios.A_ALL_AGENTS.allAgentTickers=true;

  const badNotificationAgent=await ownerApi(adminCtx,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'AGENT',targetId:AGENT_A,body:'must fail',idempotencyKey:randomUUID()}});
  assert(badNotificationAgent.status===400&&badNotificationAgent.body?.code==='RADIO_NOTIFICATION_CLIENT_SCOPE_REQUIRED','NOTIFICATION_AGENT_SCOPE_ACCEPTED');
  const badClient=await ownerApi(adminCtx,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'CLIENT',targetId:'RONA-C999',body:'must fail',idempotencyKey:randomUUID()}});
  const badAgent=await ownerApi(adminCtx,'/admin/radio',{method:'POST',body:{kind:'ANNOUNCEMENT',scope:'AGENT',targetId:'AGENT-NOT-EXIST',body:'must fail',idempotencyKey:randomUUID()}});
  const missingClient=await ownerApi(adminCtx,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'CLIENT',targetId:null,body:'must fail',idempotencyKey:randomUUID()}});
  assert(badClient.status===409&&badAgent.status===409&&missingClient.status===400,'TARGET_NEGATIVE_VALIDATION_FAILED');
  proof.negative={notificationAgentStatus:badNotificationAgent.status,badClientStatus:badClient.status,badAgentStatus:badAgent.status,missingClientStatus:missingClient.status};

  const idem=randomUUID(),idemBody='QA2C1 IDEMPOTENCY '+tag;qaBodies.add(idemBody);
  const first=await ownerApi(adminCtx,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'ALL_CLIENTS',targetId:null,body:idemBody,idempotencyKey:idem}});
  const second=await ownerApi(adminCtx,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'ALL_CLIENTS',targetId:null,body:idemBody,idempotencyKey:idem}});
  assert(first.status===200&&second.status===200&&first.body?.data?.id===second.body?.data?.id&&second.body?.data?.reused===true,'IDEMPOTENCY_FAILED');
  qaIds.add(String(first.body.data.id));proof.idempotency={id:String(first.body.data.id),reused:true};

  const expiryId=String(proof.scenarios.A_CLIENT.id);
  const expired=await ownerApi(adminCtx,'/admin/radio/'+encodeURIComponent(expiryId)+'/expire',{method:'POST',body:{}});
  assert(expired.status===200&&String(expired.body?.data?.id)===expiryId,'EXPIRY_FAILED');
  await clientAPage.reload({waitUntil:'domcontentloaded'});await waitText(clientAPage,'#ronaRadioAnnouncementTicker','QA2C1 A CLIENT '+tag,false);
  const retained=await ownerApi(adminCtx,'/admin/radio/'+encodeURIComponent(expiryId)+'/expire',{method:'POST',body:{}});
  assert(retained.status===200&&String(retained.body?.data?.id)===expiryId,'EXPIRED_EVIDENCE_ROW_NOT_RETAINED');
  proof.expiry={id:expiryId,activeDisplayRemoved:true,evidenceRetained:true};
  qaIds.delete(expiryId);

  proof.messageRegression='DELEGATED_TO_EXISTING_STAGE2A_OPERATIONAL_PRODUCTION_GATE';

  for(const id of [...qaIds]){
    const x=await ownerApi(adminCtx,'/admin/radio/'+encodeURIComponent(id)+'/expire',{method:'POST',body:{}});
    assert(x.status===200,'QA_EXPIRE_FAILED_'+id);proof.cleanup.push({id,expired:true});
  }
  const clean=await radioBootstrap(adminCtx);assert(!broadcastRows(clean).some(x=>qaBodies.has(norm(x.body_text))),'QA_BROADCAST_STILL_ACTIVE');
  proof.pass=true;
  await writeFile('admin-radio-stage2c1-production-proof.json',JSON.stringify(proof,null,2));
  console.log('RADIO_STAGE2C1_NOTIFICATION_MODAL=PASS');
  console.log('RADIO_STAGE2C1_ANNOUNCEMENT_TICKER=PASS');
  console.log('RADIO_STAGE2C1_CLIENT_AGENT_ISOLATION=PASS');
  console.log('RADIO_STAGE2C1_IDEMPOTENCY=PASS');
  console.log('RADIO_STAGE2C1_EXPIRY=PASS');
  console.log('RADIO_STAGE2C1_MESSAGE_REGRESSION=DELEGATED_STAGE2A_OPERATIONAL_GATE');
  console.log('QA_ACTIVE_BROADCASTS=0');
}finally{
  if(adminContextRef){
    try{
      const current=await radioBootstrap(adminContextRef);
      for(const row of broadcastRows(current))if(qaBodies.has(norm(row?.body_text)))qaIds.add(String(row.id));
    }catch{}
    for(const id of qaIds){try{await ownerApi(adminContextRef,'/admin/radio/'+encodeURIComponent(id)+'/expire',{method:'POST',body:{}})}catch{}}
  }
  for(const ctx of contexts)await ctx.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  for(const s of sessions)if(!s.revoked){try{await revokeSession(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true})}catch(error){proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:false,error:String(error?.message||error)})}}
  await writeFile('admin-radio-stage2c1-production-proof.json',JSON.stringify(proof,null,2)).catch(()=>{});
}
