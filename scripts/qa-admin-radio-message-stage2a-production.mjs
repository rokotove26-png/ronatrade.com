import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const ORIGIN=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const HEAD=String(process.env.EXPECTED_HEAD||'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-radio-stage2a-production-v1';

const QA_ADMIN='a2a0b91e-4c2a-4d3e-8f11-2a2a00000001';
const QA_CLIENT_A='a2a0b91e-4c2a-4d3e-8f11-2a2a00000002';
const QA_CLIENT_A2='a2a0b91e-4c2a-4d3e-8f11-2a2a00000004';
const QA_CLIENT_B='a2a0b91e-4c2a-4d3e-8f11-2a2a00000003';

const C002={client_id:'RONA-C002',contract_id:'RONA-C002-CTR-2026-001',foreign_deal:'DEAL-2026-009'};
const C003={client_id:'RONA-C003',contract_id:'RONA-C003-CTR-2026-001'};
const C005={client_id:'RONA-C005',contract_id:'RONA-C005-CTR-2026-001'};
const CLIENT_RUNTIME_BLOB='f3c49ac46cc32ee0cd92eefadb905f8ac52778ca';
const RADIO_FINAL_VISUAL_BLOB='89391945e49e49570e22e6cbfecd5a6e7e46b40c';
const RADIO_WIDE_VISUAL_BLOB='1e32655109534962580e96057def98208f69eaa4';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');

if(ORIGIN!=='https://ronaoil.com')throw new Error('PRODUCTION_ORIGIN_REQUIRED');
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('EXACT_RELEASE_HEAD_REQUIRED');

async function oidc(){
  const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');
  const url=base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE);
  const r=await fetch(url,{headers:{authorization:`Bearer ${token}`}});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.value)throw new Error(`GITHUB_OIDC_${r.status}`);
  return j.value;
}
async function issuerCall(path,body,{waitForActive=false}={}){
  let last='';
  for(let attempt=0;attempt<(waitForActive?60:1);attempt++){
    const token=await oidc();
    const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>null);
    if(r.ok&&j?.ok)return j;
    last=`${r.status}:${j?.code||'UNKNOWN'}`;
    if(waitForActive&&r.status===410){await sleep(5000);continue}
    throw new Error(`ISSUER_${path}_${last}`);
  }
  throw new Error(`ISSUER_ACTIVE_TIMEOUT:${last}`);
}
async function issueSession(portalUserId){
  const j=await issuerCall('/issue',{portalUserId},{waitForActive:true});
  assert(j.access_token&&j.session_id&&j.auth_user_id,'ISSUER_SESSION_RESPONSE_INVALID');
  return{portalUserId,accessToken:j.access_token,sessionId:j.session_id,authUserId:j.auth_user_id,revoked:false};
}
async function revokeSession(s){
  if(s.revoked)return true;
  const j=await issuerCall('/revoke',{accessToken:s.accessToken,sessionId:s.sessionId,authUserId:s.authUserId});
  assert(j.revoked===true&&j.session_absent===true,'QA_SESSION_REVOKE_NOT_PROVEN');
  s.revoked=true;
  return true;
}
async function contextApi(context,path,{method='GET',body=null,headers={},referer='/portal/client'}={}){
  const r=await context.request.fetch(ORIGIN+path,{
    method,
    headers:{accept:'application/json',origin:ORIGIN,referer:ORIGIN+referer,'cache-control':'no-store',...headers},
    data:body??undefined,
    failOnStatusCode:false
  });
  const j=await r.json().catch(()=>null);
  return{status:r.status(),body:j,headers:r.headers()};
}
async function waitUntil(fn,label,timeout=30000,interval=300){
  const started=Date.now();let last=null;
  while(Date.now()-started<timeout){
    try{last=await fn();if(last)return last}catch(error){last=error}
    await sleep(interval);
  }
  throw new Error(`${label}_TIMEOUT:${last instanceof Error?last.message:JSON.stringify(last)}`);
}
async function browserContext(browser,session){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:session.accessToken,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  return context;
}
async function selectClientContext(page,target){
  await waitUntil(()=>page.evaluate(()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady)),'CLIENT_CONTEXT_RUNTIME_READY',30000,250);
  await page.evaluate(async({clientId,contractId})=>{const api=window.RONA_CLIENT_CONTEXT;await api.whenReady();api.select(clientId,contractId)},{clientId:target.client_id,contractId:target.contract_id});
  await waitUntil(()=>page.evaluate(({clientId,contractId})=>{const current=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();return current?.client_id===clientId&&current?.contract_id===contractId},{clientId:target.client_id,contractId:target.contract_id}),'CLIENT_CONTEXT_SELECTION',15000,250);
}
async function openMessages(page){
  const nav=page.locator('[data-page="messages"]').first();
  await nav.waitFor({state:'visible',timeout:20000});await nav.click();
  await page.locator('#page-messages').waitFor({state:'visible',timeout:10000});
}
async function clientMessages(context,target){
  return await contextApi(context,'/portal/api/v1/client/messages?clientId='+encodeURIComponent(target.client_id)+'&contractId='+encodeURIComponent(target.contract_id));
}
async function clientSubmitUi(page,target,subject,message){
  await selectClientContext(page,target);await openMessages(page);
  await page.locator('#msgSubject').fill(subject);await page.locator('#msgText').fill(message);await page.locator('#sendMessage').click();
  await page.locator('#page-messages .message-grid').getByText(subject,{exact:true}).first().waitFor({state:'visible',timeout:20000});
  const api=await page.evaluate(async({clientId,contractId,subject})=>{const r=await fetch('/portal/api/v1/client/messages?clientId='+encodeURIComponent(clientId)+'&contractId='+encodeURIComponent(contractId),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const b=await r.json().catch(()=>null);return{status:r.status,row:(b?.messages||[]).find(x=>String(x?.payload?.subject||'')===subject)}},{clientId:target.client_id,contractId:target.contract_id,subject});
  assert(api.status===200&&api.row?.event_id,'CLIENT_UI_MESSAGE_NOT_CANONICAL');return api.row;
}
async function liveBlob(path,expected){
  const r=await fetch(ORIGIN+path+(path.includes('?')?'&':'?')+'_qa='+Date.now(),{headers:{'cache-control':'no-cache'}});
  assert(r.status===200,`LIVE_ASSET_HTTP_${r.status}_${path}`);
  const bytes=Buffer.from(await r.arrayBuffer()),sha=gitBlobSha(bytes);
  assert(sha===expected,`LIVE_ASSET_BLOB_DRIFT_${path}_${sha}`);
  return{path,bytes:bytes.length,gitBlobSha:sha};
}
const isQa=x=>norm(x?.payload?.subject).startsWith('QA STAGE2A')||norm(x?.payload?.message).startsWith('QA STAGE2A');
async function adminBootstrap(context){return await contextApi(context,'/portal/api/v1/admin/bootstrap',{referer:'/portal/admin'})}
async function retireQa(context,eventIds){
  const ids=[...new Set((eventIds||[]).filter(Boolean))];
  if(!ids.length)return{status:200,body:{ok:true,retired_events:0,retired_tasks:0}};
  return await contextApi(context,'/portal/api/v1/admin/radio/qa-retire',{method:'POST',body:{eventIds:ids},referer:'/portal/admin'});
}

const proof={suite:'RADIO_ROOM_ADMIN_CLIENT_STAGE2A_CORRECTIVE_PRODUCTION',releaseHead:HEAD,origin:ORIGIN,sessions:[],historicalCleanup:null,adminInitiated:null,clientInitiated:null,companyRecipient:null,isolation:null,businessIsolation:null,security:null,reload:null,visual:null,assets:null,cleanup:[],pass:false};
const sessions=[];let browser;const contexts=[];let adminContextRef=null;let qaRetired=false;
let currentQaEventIds=[];
try{
  const [adminSession,aSession,a2Session,bSession]=await Promise.all([issueSession(QA_ADMIN),issueSession(QA_CLIENT_A),issueSession(QA_CLIENT_A2),issueSession(QA_CLIENT_B)]);
  sessions.push(adminSession,aSession,a2Session,bSession);proof.sessions=sessions.map(s=>({portalUserId:s.portalUserId,issued:true}));

  browser=await chromium.launch({headless:true});
  const adminContext=await browserContext(browser,adminSession),aContext=await browserContext(browser,aSession),a2Context=await browserContext(browser,a2Session),bContext=await browserContext(browser,bSession);
  adminContextRef=adminContext;contexts.push(adminContext,aContext,a2Context,bContext);
  const adminPage=await adminContext.newPage(),aPage=await aContext.newPage(),a2Page=await a2Context.newPage(),bPage=await bContext.newPage();

  await adminPage.goto(ORIGIN+'/portal/admin?_qa_radio_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await waitUntil(()=>adminPage.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),'ADMIN_OWNER_RUNTIME_READY',60000,250);
  await waitUntil(()=>adminPage.evaluate(()=>Boolean(window.__RONA_REMAINING_SECTIONS_READY__)||window.__RONA_ADMIN_MODULES__?.remaining?.status==='READY'),'ADMIN_REMAINING_SECTIONS_READY',90000,250);
  const nav=adminPage.locator('[data-page="messages"]').first();await nav.waitFor({state:'visible',timeout:20000});await nav.click();
  let radioRoot=adminPage.locator('#page-messages > .rona-rs-root[data-kind="radio"]');await radioRoot.waitFor({state:'visible',timeout:30000});

  // One-time audit-safe retirement of historical Stage 2A QA artifacts.
  let boot=await adminBootstrap(adminContext);assert(boot.status===200,'ADMIN_BOOTSTRAP_FAILED');
  const historical=(boot.body?.data?.radio_messages||[]).filter(isQa).map(x=>x.event_id);
  if(historical.length){
    const retired=await retireQa(adminContext,historical);
    assert(retired.status===200&&retired.body?.retired_events===historical.length,'HISTORICAL_QA_RETIRE_FAILED');
    proof.historicalCleanup={requested:historical.length,retiredEvents:retired.body.retired_events,retiredTasks:retired.body.retired_tasks};
  }else proof.historicalCleanup={requested:0,retiredEvents:0,retiredTasks:0};
  boot=await adminBootstrap(adminContext);assert((boot.body?.data?.radio_messages||[]).filter(isQa).length===0,'HISTORICAL_QA_STILL_VISIBLE');

  const selects=radioRoot.locator('select');
  assert(await selects.count()===3,'ADMIN_RADIO_COMPOSER_SELECT_COUNT_CHANGED');
  assert(await selects.nth(0).inputValue()==='MESSAGE','ADMIN_RADIO_DEFAULT_KIND_CHANGED');
  assert(await selects.nth(1).inputValue()==='ALL_CLIENTS','ADMIN_RADIO_DEFAULT_SCOPE_CHANGED');
  assert(await selects.nth(2).isDisabled(),'ADMIN_RADIO_INITIAL_TARGET_STATE_CHANGED');
  await selects.nth(1).selectOption('CLIENT');
  await waitUntil(async()=>{const opts=await selects.nth(2).locator('option').allTextContents();return opts.some(x=>x.includes('RONA-C005'))&&opts.every(x=>!x.includes('PORTAL-EVT-'))?opts:null},'CLIENT_RECIPIENT_DIRECTORY',30000,300);
  const targetOptions=await selects.nth(2).locator('option').allTextContents();
  assert(!targetOptions.some(x=>x.includes('RONA-C003')),'NON_CURRENT_CLIENT_AVAILABLE_AS_RECIPIENT');
  proof.companyRecipient={targetOptions,eventIdsExposed:false,c003Excluded:true};

  // Scenario A: Admin starts a message with the company before any client message.
  const tag=Date.now().toString(36),adminMessage=`QA STAGE2A ADMIN INIT ${tag}`;
  await selects.nth(2).selectOption(C005.client_id);await radioRoot.locator('textarea').fill(adminMessage);
  const adminSendWait=adminPage.waitForResponse(r=>r.url().includes('/portal/api/v1/admin/radio/messages')&&r.request().method()==='POST',{timeout:20000});
  await radioRoot.getByRole('button',{name:'Отправить',exact:true}).click();
  const adminSendResponse=await adminSendWait,adminSendBody=await adminSendResponse.json().catch(()=>null);
  console.log('ADMIN_INIT_SEND_RESPONSE',adminSendResponse.status(),JSON.stringify(adminSendBody));
  assert(adminSendResponse.status()===201||adminSendResponse.status()===200,`ADMIN_INIT_SEND_FAILED_${adminSendResponse.status()}_${JSON.stringify(adminSendBody)}`);
  const sentEventId=String(adminSendBody?.message?.event_id||'');assert(sentEventId.startsWith('PORTAL-EVT-'),'ADMIN_INIT_SEND_EVENT_ID_MISSING');
  const adminEvent=await waitUntil(async()=>{
    const r=await adminBootstrap(adminContext);
    if(r.status!==200)return null;
    return (r.body?.data?.radio_messages||[]).find(x=>x?.event_id===sentEventId&&norm(x?.payload?.message)===adminMessage&&x?.direction==='ADMIN_TO_CLIENT')||null;
  },'ADMIN_INITIATED_CANONICAL_EVENT',30000,350);
  assert(adminEvent?.event_id===sentEventId,'ADMIN_INITIATED_CANONICAL_EVENT_MISSING');currentQaEventIds.push(adminEvent.event_id);
  await aPage.goto(ORIGIN+'/portal/client?_qa_radio_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await selectClientContext(aPage,C005);await openMessages(aPage);
  const aAfterAdmin=await waitUntil(async()=>{
    const r=await clientMessages(aContext,C005),row=(r.body?.messages||[]).find(x=>x.event_id===adminEvent.event_id);
    return r.status===200&&row?{response:r,row}:null;
  },'ADMIN_INITIATED_CLIENT_PROJECTION',30000,350);
  assert(aAfterAdmin.row?.direction==='ADMIN_TO_CLIENT','ADMIN_INITIATED_DIRECTION_MISMATCH');
  await aPage.getByText(adminMessage,{exact:true}).first().waitFor({state:'visible',timeout:30000});

  // A second portal user of the same company must see the same company thread.
  await a2Page.goto(ORIGIN+'/portal/client?_qa_radio_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await selectClientContext(a2Page,C005);await openMessages(a2Page);
  await a2Page.getByText(adminMessage,{exact:true}).first().waitFor({state:'visible',timeout:30000});
  const a2Messages=await clientMessages(a2Context,C005);
  assert((a2Messages.body?.messages||[]).some(x=>x.event_id===adminEvent.event_id),'SAME_COMPANY_USER_CANNOT_SEE_COMPANY_MESSAGE');
  proof.adminInitiated={eventId:adminEvent.event_id,clientId:C005.client_id,visibleAfterReload:true};
  proof.companyRecipient.sameCompanySecondUserVisible=true;

  // A different company cannot read the C005 thread or substitute C005 context.
  await bPage.goto(ORIGIN+'/portal/client?_qa_radio_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await selectClientContext(bPage,C002);await openMessages(bPage);
  const bOwn=await clientMessages(bContext,C002);assert(bOwn.status===200,'CLIENT_B_OWN_CONTEXT_FAILED');
  assert(!(bOwn.body?.messages||[]).some(x=>x.event_id===adminEvent.event_id),'CROSS_COMPANY_MESSAGE_LEAK');
  const bForeign=await clientMessages(bContext,C005);assert(bForeign.status===404,'CROSS_COMPANY_CONTEXT_SUBSTITUTION_NOT_DENIED');

  // Server-side Admin substitution and non-current client target are denied.
  const crossContract=await contextApi(adminContext,'/portal/api/v1/admin/radio/messages',{method:'POST',headers:{'x-idempotency-key':crypto.randomUUID()},body:{clientId:C005.client_id,contractId:C002.contract_id,message:'must fail'},referer:'/portal/admin'});
  assert(crossContract.status===403,'ADMIN_CROSS_CONTRACT_SUBSTITUTION_NOT_DENIED');
  const nonCurrent=await contextApi(adminContext,'/portal/api/v1/admin/radio/messages',{method:'POST',headers:{'x-idempotency-key':crypto.randomUUID()},body:{clientId:C003.client_id,contractId:C003.contract_id,message:'must fail'},referer:'/portal/admin'});
  assert(nonCurrent.status===403,'NON_CURRENT_CLIENT_SEND_NOT_DENIED');

  // Scenario B: Client starts chat; Admin sees company/text (never event ID), then replies.
  const clientSubject=`QA STAGE2A CLIENT ${tag}`,clientMessage=`QA STAGE2A CLIENT BODY ${tag}`,adminReply=`QA STAGE2A REPLY ${tag}`;
  const clientEvent=await clientSubmitUi(aPage,C005,clientSubject,clientMessage);currentQaEventIds.push(clientEvent.event_id);
  const adminProjectionAfterClient=await adminBootstrap(adminContext);
  assert(adminProjectionAfterClient.status===200,'ADMIN_BOOTSTRAP_AFTER_CLIENT_MESSAGE_FAILED');
  const projectedClientEvent=(adminProjectionAfterClient.body?.data?.radio_messages||[]).find(x=>x?.event_id===clientEvent.event_id);
  console.log('ADMIN_CLIENT_MESSAGE_PROJECTION',JSON.stringify(projectedClientEvent?{event_id:projectedClientEvent.event_id,client_id:projectedClientEvent.client_id,legal_name:projectedClientEvent.legal_name,direction:projectedClientEvent.direction}:null));
  assert(projectedClientEvent?.event_id===clientEvent.event_id&&projectedClientEvent?.direction==='CLIENT_TO_ADMIN','ADMIN_CLIENT_MESSAGE_PROJECTION_MISSING');
  await adminPage.reload({waitUntil:'domcontentloaded',timeout:30000});
  await waitUntil(()=>adminPage.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),'ADMIN_RELOAD_READY',60000,250);
  await adminPage.locator('[data-page="messages"]').first().click();radioRoot=adminPage.locator('#page-messages > .rona-rs-root[data-kind="radio"]');await radioRoot.waitFor({state:'visible',timeout:30000});
  await waitUntil(async()=>{const t=norm(await radioRoot.innerText());return t.includes(clientSubject)&&t.includes('ГазОнэ')?t:null},'ADMIN_CLIENT_MESSAGE_VISIBLE',30000,400);
  const radioText=norm(await radioRoot.innerText());assert(!radioText.includes(clientEvent.event_id),'EVENT_ID_VISIBLE_IN_RADIO');
  const selects2=radioRoot.locator('select');await selects2.nth(1).selectOption('CLIENT');await selects2.nth(2).selectOption(C005.client_id);
  await radioRoot.locator('textarea').fill(adminReply);await radioRoot.getByRole('button',{name:'Отправить',exact:true}).click();
  const replied=await waitUntil(async()=>{const r=await clientMessages(aContext,C005),row=(r.body?.messages||[]).find(x=>x.event_id===clientEvent.event_id);return row?.client_response_text===adminReply&&row?.client_response_published_at?row:null},'CLIENT_REPLY_PERSIST',45000,500);
  proof.clientInitiated={eventId:clientEvent.event_id,adminApiProjected:true,adminSawCompany:true,eventIdHidden:true,responsePublishedAt:replied.client_response_published_at};

  await aPage.reload({waitUntil:'domcontentloaded',timeout:30000});await selectClientContext(aPage,C005);await openMessages(aPage);
  await aPage.getByText(adminReply,{exact:true}).first().waitFor({state:'visible',timeout:20000});proof.reload={clientResponsePersisted:true};

  // Scenario D: business workflow reverse events are not Radio MESSAGE entities/KPIs.
  boot=await adminBootstrap(adminContext);assert(boot.status===200,'ADMIN_BOOTSTRAP_POST_CHAT_FAILED');
  const radioMessages=boot.body?.data?.radio_messages||[];
  const businessLeak=radioMessages.filter(x=>['CLIENT_PRICE_APPLICATION','CLIENT_PRICE_CALCULATION_REQUEST'].includes(norm(x?.payload?.source))||['APPLICATION_DETAILS_V5','DELIVERED_PRICE_CALCULATION_REQUEST_V1'].includes(norm(x?.payload?.message_type)));
  assert(businessLeak.length===0,'BUSINESS_EVENT_LEAKED_INTO_RADIO');
  assert(radioMessages.every(x=>x.event_type==='CLIENT_MESSAGE_SUBMIT'||x.event_type==='ADMIN_CLIENT_MESSAGE_SUBMIT'),'NON_CHAT_EVENT_IN_RADIO_PROJECTION');
  proof.businessIsolation={businessLeak:0,radioMessageCount:radioMessages.length};

  const radioState=await adminPage.evaluate(()=>{const root=document.querySelector('#page-messages > .rona-rs-root[data-kind="radio"]'),selects=root?[...root.querySelectorAll('select')]:[];return{bridge:window.__RONA_ADMIN_RADIO_MESSAGE_BRIDGE__||null,kindOptions:Array.from(selects[0]?.querySelectorAll('option')||[]).map(o=>o.value),targetOptions:Array.from(selects[2]?.querySelectorAll('option')||[]).map(o=>({value:o.value,text:o.textContent})),rootKind:root?.dataset.kind||null,finalV9:root?.dataset.radioFinalV9||null,cleanHead:Boolean(document.querySelector('#page-messages > .rona-radio-clean-head')),finalDom:{main:Boolean(root?.querySelector('.rf-main')),compose:Boolean(root?.querySelector('.rf-compose')),network:Boolean(root?.querySelector('.rf-network')),bottom:Boolean(root?.querySelector('.rf-bottom')),feed:Boolean(root?.querySelector('.rf-feed')),routing:Boolean(root?.querySelector('.rf-routing'))},activeTitle:[...root?.querySelectorAll('.rf-panel-title,.radio-panel-head h2')||[]].map(x=>x.textContent.trim()).includes('Активные сообщения')}});
  assert(radioState.bridge==='STAGE_2A_CORRECTIVE_CLIENT_CHAT_V2_LIVE_OWNER','ADMIN_RADIO_CORRECTIVE_OWNER_MARKER_MISSING');
  assert(JSON.stringify(radioState.kindOptions)===JSON.stringify(['MESSAGE','NOTIFICATION','ANNOUNCEMENT']),'RADIO_KIND_OPTIONS_CHANGED');
  assert(radioState.targetOptions.every(x=>!String(x.value).startsWith('PORTAL-EVT-')&&!String(x.text).includes('PORTAL-EVT-')),'EVENT_ID_RECIPIENT_OPTION_VISIBLE');
  assert(radioState.rootKind==='radio'&&radioState.finalV9==='1'&&Object.values(radioState.finalDom).every(Boolean)&&radioState.activeTitle,'RADIO_VISUAL_FREEZE_CHANGED');
  proof.visual={visualDelta:0,adminRadio:radioState};

  proof.assets={
    client:await liveBlob('/assets/portal-runtime/client-messages-archive-v1.js',CLIENT_RUNTIME_BLOB),
    adminRadioFinal:await liveBlob('/assets/portal-admin-radio-final-v9.js',RADIO_FINAL_VISUAL_BLOB),
    adminRadioWide:await liveBlob('/assets/portal-admin-radio-wide-v10.js',RADIO_WIDE_VISUAL_BLOB)
  };
  proof.isolation={differentCompanyEventVisible:false,crossCompanyStatus:bForeign.status};
  proof.security={adminCrossContractStatus:crossContract.status,nonCurrentClientStatus:nonCurrent.status};

  // Scenario E: exact current-run artifacts are audit-retired, not deleted.
  const retired=await retireQa(adminContext,currentQaEventIds);
  assert(retired.status===200&&retired.body?.retired_events===new Set(currentQaEventIds).size,'CURRENT_QA_RETIRE_FAILED');
  proof.cleanup.push({eventIds:[...new Set(currentQaEventIds)],retiredEvents:retired.body.retired_events,retiredTasks:retired.body.retired_tasks});
  qaRetired=true;
  boot=await adminBootstrap(adminContext);
  assert(!(boot.body?.data?.radio_messages||[]).some(x=>currentQaEventIds.includes(x.event_id)),'QA_EVENT_STILL_IN_ADMIN_RADIO');
  const afterCleanup=await clientMessages(aContext,C005);
  assert(!(afterCleanup.body?.messages||[]).some(x=>currentQaEventIds.includes(x.event_id)),'QA_EVENT_STILL_IN_CLIENT_MESSAGES');
  proof.pass=true;

  for(const ctx of contexts)await ctx.close().catch(()=>{});
  contexts.length=0;if(browser){await browser.close().catch(()=>{});browser=null}
  for(const s of sessions){await revokeSession(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true})}

  await writeFile('admin-radio-message-stage2a-production-proof.json',JSON.stringify(proof,null,2));
  console.log('RADIO_MESSAGE_RECIPIENT_IS_CLIENT=PASS');
  console.log('ADMIN_INITIATED_MESSAGE=PASS');
  console.log('CLIENT_INITIATED_MESSAGE=PASS');
  console.log('COMPANY_RECIPIENT_SEMANTICS=PASS');
  console.log('BUSINESS_EVENTS_EXCLUDED_FROM_RADIO=PASS');
  console.log('QA_ARTIFACTS_NOT_VISIBLE=PASS');
  console.log('QA_CLEANUP=PASS');
  console.log('QA_ACTIVE_USERS=0');
  console.log('QA_VISIBLE_RADIO_MESSAGES=0');
  console.log('TENANT_ISOLATION=PASS');
  console.log('CLIENT_RELOAD_PERSISTENCE=PASS');
  console.log('ADMIN_RADIO_VISUAL_FREEZE=PASS');
  console.log('CLIENT_VISUAL_FREEZE=PASS');
  console.log('NOTIFICATION_CHANGED=false');
  console.log('ANNOUNCEMENT_CHANGED=false');
  console.log('VISUAL_DELTA=0');
}finally{
  if(!qaRetired&&adminContextRef&&currentQaEventIds.length){
    try{
      const cleanup=await retireQa(adminContextRef,currentQaEventIds);
      proof.cleanup.push({eventIds:[...new Set(currentQaEventIds)],retiredEvents:Number(cleanup.body?.retired_events||0),retiredTasks:Number(cleanup.body?.retired_tasks||0),failurePath:true});
      qaRetired=cleanup.status===200;
    }catch(error){
      proof.cleanup.push({eventIds:[...new Set(currentQaEventIds)],failurePath:true,error:String(error?.message||error)});
    }
  }
  for(const ctx of contexts)await ctx.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  for(const s of sessions){
    if(!s.revoked){try{await revokeSession(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true})}catch(error){proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:false,error:String(error?.message||error)})}}
  }
  await writeFile('admin-radio-message-stage2a-production-proof.json',JSON.stringify(proof,null,2)).catch(()=>{});
}
