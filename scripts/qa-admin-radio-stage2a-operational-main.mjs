import { writeFile } from 'node:fs/promises';
import {
  ORIGIN,HEAD,QA,CLIENT_IDS,AGENT_IDS,C003,A001,A002,
  assert,sameSet,norm,issue,revoke,cleanupQa,directory,browser,context,api,wait,
  adminBoot,adminDirectories,retire,clientMessages,agentMessages,broadcastSignature
} from './qa-admin-radio-stage2a-operational-helpers.mjs';
import { runRoundTrips } from './qa-admin-radio-stage2a-operational-scenarios.mjs';

const proof={
  suite:'RADIO_STAGE2A_OPERATIONAL_CLIENT_AGENT_MESSAGE_PRODUCTION',
  releaseHead:HEAD,origin:ORIGIN,preIdentity:null,preRecipientUi:null,
  directories:null,adminToClient:null,clientToAdmin:null,adminToAgent:null,agentToAdmin:null,
  agentBootstrapParity:null,companySecurity:null,agentSecurity:null,domainIsolation:null,businessIsolation:null,
  cleanup:[],postCleanup:null,visual:null,assets:null,pass:false
};
const sessions=[],contexts=[],qaEvents=[];
let browserRef=null,adminContext=null,qaRetired=false;

async function save(){await writeFile('admin-radio-message-stage2a-production-proof.json',JSON.stringify(proof,null,2))}
async function waitAdminBackendHealthy(c,label){
  const started=Date.now();
  let lastStatus=null;
  while(Date.now()-started<240000){
    let r;
    try{
      r=await api(c,'/portal/api/v1/admin/bootstrap',{referer:'/portal/admin',timeoutMs:90000});
    }catch(error){
      const message=String(error?.message||error);
      if(!/TimeoutError|apiRequestContext\.fetch: Timeout/i.test(message))throw error;
      lastStatus='TRANSPORT_TIMEOUT';
      await new Promise(resolve=>setTimeout(resolve,5000));
      continue;
    }
    lastStatus=r.status;
    if(r.status===200)return r;
    if([401,403].includes(r.status))throw new Error(label+'_AUTH_'+r.status);
    if(![500,502,503,504,520,522,524,546].includes(r.status))throw new Error(label+'_BACKEND_HTTP_'+r.status);
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error(label+'_BACKEND_HEALTH_TIMEOUT_'+String(lastStatus??'NONE'));
}
async function loadAdminReady(page,c,label,{navigate=true}={}){
  const attempts=[];
  for(let attempt=1;attempt<=3;attempt++){
    const health=await waitAdminBackendHealthy(c,label+'_ATTEMPT_'+attempt);
    const pageErrors=[];
    const onError=e=>pageErrors.push(String(e?.message||e));
    page.on('pageerror',onError);
    try{
      if(navigate)await page.goto(ORIGIN+'/portal/admin?_qa_radio_stage2a_operational='+HEAD+'&_ready_attempt='+attempt,{waitUntil:'domcontentloaded',timeout:30000});
      else await page.reload({waitUntil:'domcontentloaded',timeout:30000});
      await wait(()=>page.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),label+'_OWNER_READY',45000,500);
      await wait(()=>page.evaluate(()=>Boolean(window.__RONA_REMAINING_SECTIONS_READY__)||window.__RONA_ADMIN_MODULES__?.remaining?.status==='READY'),label+'_REMAINING_READY',60000,500);
      attempts.push({attempt,backendStatus:health.status,pageErrors,ready:true});
      proof.adminRuntimeAttempts=(proof.adminRuntimeAttempts||[]).concat(attempts);
      return true;
    }catch(error){
      attempts.push({attempt,backendStatus:health.status,pageErrors,ready:false,error:String(error?.message||error)});
      if(attempt===3){
        proof.adminRuntimeAttempts=(proof.adminRuntimeAttempts||[]).concat(attempts);
        throw error;
      }
      await new Promise(r=>setTimeout(r,5000));
      navigate=false;
    }finally{
      page.off('pageerror',onError);
    }
  }
}
async function cleanupFailure(){
  if(!qaRetired&&adminContext&&qaEvents.length){
    try{
      const ids=[...new Set(qaEvents.filter(x=>String(x).startsWith('PORTAL-EVT-')))];
      if(ids.length){const r=await retire(adminContext,ids);proof.cleanup.push({failurePath:true,eventIds:ids,retiredEvents:Number(r.body?.retired_events||0),retiredTasks:Number(r.body?.retired_tasks||0)})}
    }catch(e){proof.cleanup.push({failurePath:true,error:String(e?.message||e)})}
  }
  for(const s of sessions)if(!s.revoked){try{await revoke(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true,failurePath:true})}catch(e){proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:false,failurePath:true,error:String(e?.message||e)})}}
  try{const r=await cleanupQa();proof.cleanup.push({globalQaCleanup:true,retired:Number(r?.retired||0),failurePath:true})}catch(e){proof.cleanup.push({globalQaCleanup:false,failurePath:true,error:String(e?.message||e)})}
  for(const c of contexts)await c.close().catch(()=>{});
  if(browserRef)await browserRef.close().catch(()=>{});
  await save().catch(()=>{});
}

try{
  // Phase 0: attempt stale-QA cleanup, but acceptance is governed by the authoritative observed QA state.
  try{
    const preflightCleanup=await cleanupQa();
    proof.cleanup.push({preflightQaCleanup:true,retired:Number(preflightCleanup?.retired||0)});
  }catch(error){
    proof.cleanup.push({preflightQaCleanup:false,error:String(error?.message||error)});
  }
  const pre=await directory();
  assert(sameSet((pre.clients||[]).map(x=>x.client_id),CLIENT_IDS),'PRE_IDENTITY_REAL_CLIENT_DIRECTORY_MISMATCH');
  assert(sameSet((pre.agents||[]).map(x=>x.agent_person_id),AGENT_IDS),'PRE_IDENTITY_REAL_AGENT_DIRECTORY_MISMATCH');
  assert(Number(pre.qa?.active_users||0)===0,'PREEXISTING_QA_ACTIVE_USERS');
  assert(Number(pre.qa?.active_client_bindings||0)===0,'PREEXISTING_QA_CLIENT_BINDINGS');
  assert(Number(pre.qa?.active_agent_bindings||0)===0,'PREEXISTING_QA_AGENT_BINDINGS');
  proof.preIdentity=pre;

  // Admin observer only: UI directory must already be operational without temporary recipient users.
  const adminSession=await issue(QA.admin);sessions.push(adminSession);
  browserRef=await browser();adminContext=await context(browserRef,adminSession);contexts.push(adminContext);
  const adminPage=await adminContext.newPage();
  await loadAdminReady(adminPage,adminContext,'ADMIN_INITIAL_READY');

  let boot=await adminBoot(adminContext);assert(boot.status===200,'ADMIN_RADIO_BOOTSTRAP_FAILED');
  const qaPrefix=v=>/^QA STAGE2[AB]\b/.test(norm(v?.payload?.subject))||/^QA STAGE2[AB]\b/.test(norm(v?.payload?.message));
  const historical=(boot.body?.data?.radio_messages||[]).filter(qaPrefix).map(v=>v.event_id);
  if(historical.length){
    const r=await retire(adminContext,historical);assert(r.status===200&&Number(r.body?.retired_events)===historical.length,'HISTORICAL_QA_RETIRE_FAILED');
    proof.cleanup.push({historicalEventIds:historical,retiredEvents:r.body.retired_events,retiredTasks:r.body.retired_tasks});
  }
  const afterHistorical=await directory();
  assert(Number(afterHistorical.qa?.visible_client_messages||0)===0,'HISTORICAL_QA_CLIENT_MESSAGES_REMAIN');
  assert(Number(afterHistorical.qa?.visible_agent_messages||0)===0,'HISTORICAL_QA_AGENT_MESSAGES_REMAIN');
  boot=await adminBoot(adminContext);assert(boot.status===200,'ADMIN_RADIO_BOOTSTRAP_AFTER_CLEANUP_FAILED');
  const beforeBroadcasts=broadcastSignature(boot.body?.data||{});
  assert(sameSet((boot.body?.data?.radio_clients||[]).map(x=>x.client_id),CLIENT_IDS),'REAL_CLIENT_API_DIRECTORY_MISMATCH');
  assert(sameSet((boot.body?.data?.radio_agents||[]).map(x=>x.agent_person_id),AGENT_IDS),'REAL_AGENT_API_DIRECTORY_MISMATCH');

  let ui=await adminDirectories(adminPage);
  assert(sameSet(ui.clients.map(x=>x.value),CLIENT_IDS),'REAL_CLIENT_UI_DIRECTORY_MISMATCH');
  assert(sameSet(ui.agents.map(x=>x.value),AGENT_IDS),'REAL_AGENT_UI_DIRECTORY_MISMATCH');
  assert(ui.agents.find(x=>x.value===A001.agent_person_id)?.text.includes(A001.name),'AGENT_A_DISPLAY_NAME_MISSING');
  assert(ui.agents.find(x=>x.value===A002.agent_person_id)?.text.includes(A002.name),'AGENT_B_DISPLAY_NAME_MISSING');
  proof.preRecipientUi={clients:ui.clients,agents:ui.agents};

  // C003 proves company target is independent from Portal binding and signed-contract state.
  await ui.selects.nth(1).selectOption('CLIENT');await ui.selects.nth(2).selectOption(C003.client_id);
  const noRecipientText=`QA STAGE2A NO RECIPIENT ${Date.now().toString(36)}`;await ui.root.locator('textarea').fill(noRecipientText);
  const noRecipientWait=adminPage.waitForResponse(r=>r.url().includes('/portal/api/v1/admin/radio/messages')&&r.request().method()==='POST',{timeout:20000});
  await ui.root.getByRole('button',{name:'Отправить',exact:true}).click();
  const noRecipientResp=await noRecipientWait,noRecipientBody=await noRecipientResp.json().catch(()=>null);
  assert([200,201].includes(noRecipientResp.status()),`C003_COMPANY_TARGET_SEND_FAILED_${noRecipientResp.status()}`);
  const noRecipientEvent=String(noRecipientBody?.message?.event_id||'');assert(noRecipientEvent.startsWith('PORTAL-EVT-'),'C003_COMPANY_EVENT_MISSING');qaEvents.push(noRecipientEvent);

  // Only now create transient Client/Agent identities for round-trip tests.
  const issued=await Promise.all([issue(QA.clientA),issue(QA.clientA2),issue(QA.clientB),issue(QA.agentA),issue(QA.agentB)]);
  sessions.push(...issued);
  const [clientASession,clientA2Session,clientBSession,agentASession,agentBSession]=issued;
  const clientAContext=await context(browserRef,clientASession),clientA2Context=await context(browserRef,clientA2Session),clientBContext=await context(browserRef,clientBSession),agentAContext=await context(browserRef,agentASession),agentBContext=await context(browserRef,agentBSession);
  contexts.push(clientAContext,clientA2Context,clientBContext,agentAContext,agentBContext);
  const clientAPage=await clientAContext.newPage(),clientA2Page=await clientA2Context.newPage(),clientBPage=await clientBContext.newPage(),agentAPage=await agentAContext.newPage(),agentBPage=await agentBContext.newPage();

  await runRoundTrips({adminContext,adminPage,clientAContext,clientA2Context,clientBContext,agentAContext,agentBContext,agentASession,agentBSession,clientAPage,clientA2Page,clientBPage,agentAPage,agentBPage,qaEvents,beforeBroadcasts,proof});

  // Audit-retire all current-run Client + Agent message events before identity revocation.
  const eventIds=[...new Set(qaEvents.filter(x=>String(x).startsWith('PORTAL-EVT-')))];
  const retired=await retire(adminContext,eventIds);
  assert(retired.status===200&&Number(retired.body?.retired_events)===eventIds.length,'CURRENT_QA_RETIRE_FAILED');
  proof.cleanup.push({eventIds,retiredEvents:retired.body.retired_events,retiredTasks:retired.body.retired_tasks});qaRetired=true;

  boot=await adminBoot(adminContext);assert(!(boot.body?.data?.radio_messages||[]).some(x=>eventIds.includes(x.event_id)),'QA_EVENT_STILL_IN_ADMIN_RADIO');
  const clientAfter=await clientMessages(clientAContext,{client_id:'RONA-C005',contract_id:'RONA-C005-CTR-2026-001'});
  const agentAfter=await agentMessages(agentAContext);
  assert(!(clientAfter.body?.messages||[]).some(x=>eventIds.includes(x.event_id)),'QA_CLIENT_EVENT_STILL_VISIBLE');
  assert(!(agentAfter.body?.messages||[]).some(x=>eventIds.includes(x.eventId)),'QA_AGENT_EVENT_STILL_VISIBLE');

  // Revoke recipients first. Admin stays solely for post-cleanup UI proof.
  for(const s of [clientASession,clientA2Session,clientBSession,agentASession,agentBSession]){await revoke(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true})}
  const revokedAgent=await api(agentAContext,'/portal/api/v1/agent/messages',{referer:'/portal/agent'});
  assert([401,403].includes(revokedAgent.status),'REVOKED_AGENT_STILL_AUTHORIZED');

  const post=await directory();
  assert(sameSet((post.clients||[]).map(x=>x.client_id),CLIENT_IDS),'POST_CLEANUP_CLIENT_DIRECTORY_SOURCE_MISMATCH');
  assert(sameSet((post.agents||[]).map(x=>x.agent_person_id),AGENT_IDS),'POST_CLEANUP_AGENT_DIRECTORY_SOURCE_MISMATCH');
  assert(Number(post.qa?.active_client_bindings||0)===0,'POST_CLEANUP_QA_CLIENT_BINDINGS_ACTIVE');
  assert(Number(post.qa?.active_agent_bindings||0)===0,'POST_CLEANUP_QA_AGENT_BINDINGS_ACTIVE');

  await loadAdminReady(adminPage,adminContext,'ADMIN_POST_CLEANUP_READY',{navigate:false});
  ui=await adminDirectories(adminPage);
  assert(sameSet(ui.clients.map(x=>x.value),CLIENT_IDS),'POST_QA_CLEANUP_CLIENT_DIRECTORY_UI_MISMATCH');
  assert(sameSet(ui.agents.map(x=>x.value),AGENT_IDS),'POST_QA_CLEANUP_AGENT_DIRECTORY_UI_MISMATCH');
  boot=await adminBoot(adminContext);assert(broadcastSignature(boot.body?.data||{})===beforeBroadcasts,'RADIO_BROADCAST_CHANGED_AFTER_CLEANUP');

  await revoke(adminSession);proof.cleanup.push({portalUserId:adminSession.portalUserId,sessionRevoked:true});
  const final=await directory();
  assert(sameSet((final.clients||[]).map(x=>x.client_id),CLIENT_IDS),'FINAL_CLIENT_DIRECTORY_MISMATCH');
  assert(sameSet((final.agents||[]).map(x=>x.agent_person_id),AGENT_IDS),'FINAL_AGENT_DIRECTORY_MISMATCH');
  assert(Number(final.qa?.active_users||0)===0,'QA_ACTIVE_USERS_NOT_ZERO');
  assert(Number(final.qa?.active_client_bindings||0)===0,'QA_ACTIVE_CLIENT_BINDINGS_NOT_ZERO');
  assert(Number(final.qa?.active_agent_bindings||0)===0,'QA_ACTIVE_AGENT_BINDINGS_NOT_ZERO');
  assert(Number(final.qa?.visible_client_messages||0)===0,'QA_VISIBLE_CLIENT_MESSAGES_NOT_ZERO');
  assert(Number(final.qa?.visible_agent_messages||0)===0,'QA_VISIBLE_AGENT_MESSAGES_NOT_ZERO');

  proof.postCleanup={directory:post,final};proof.directories={clients:CLIENT_IDS,agents:AGENT_IDS};proof.pass=true;await save();

  for(const line of [
    'REAL_CLIENT_DIRECTORY_VISIBLE=PASS','REAL_CLIENT_DIRECTORY_COUNT=4',
    'REAL_AGENT_DIRECTORY_VISIBLE=PASS','REAL_AGENT_DIRECTORY_COUNT=2',
    'POST_QA_CLEANUP_CLIENT_DIRECTORY_VISIBLE=PASS','POST_QA_CLEANUP_AGENT_DIRECTORY_VISIBLE=PASS',
    'ADMIN_TO_CLIENT_MESSAGE=PASS','CLIENT_TO_ADMIN_MESSAGE=PASS',
    'ADMIN_TO_AGENT_MESSAGE=PASS','AGENT_TO_ADMIN_MESSAGE=PASS',
    'AGENT_A_BOOT=PASS','AGENT_B_BOOT=PASS','AGENT_BOOTSTRAP_DIRECT_PROXY_PARITY=PASS',
    'COMPANY_SCOPE_SECURITY=PASS','AGENT_SCOPE_SECURITY=PASS',
    'CROSS_CLIENT_ISOLATION=PASS','CROSS_AGENT_ISOLATION=PASS','CLIENT_AGENT_DOMAIN_ISOLATION=PASS',
    'NO_QA_IDENTITY_DEPENDENCY=PASS','BUSINESS_EVENTS_EXCLUDED_FROM_RADIO=PASS',
    'QA_CLEANUP=PASS','QA_ACTIVE_USERS=0','QA_VISIBLE_CLIENT_MESSAGES=0','QA_VISIBLE_AGENT_MESSAGES=0',
    'NOTIFICATION_CHANGED=false','ANNOUNCEMENT_CHANGED=false','VISUAL_DELTA=0'
  ])console.log(line);
}finally{
  if(!proof.pass)await cleanupFailure();
  else{
    for(const c of contexts)await c.close().catch(()=>{});
    if(browserRef)await browserRef.close().catch(()=>{});
  }
}
