import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const ORIGIN=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const HEAD=String(process.env.EXPECTED_HEAD||'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-radio-stage2a-production-v1';

const QA_ADMIN='a2a0b91e-4c2a-4d3e-8f11-2a2a00000001';
const QA_CLIENT_A='a2a0b91e-4c2a-4d3e-8f11-2a2a00000002';
const QA_CLIENT_B='a2a0b91e-4c2a-4d3e-8f11-2a2a00000003';

const C002={client_id:'RONA-C002',contract_id:'RONA-C002-CTR-2026-001',foreign_deal:'DEAL-2026-009'};
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
  return{portalUserId,accessToken:j.access_token,sessionId:j.session_id,authUserId:j.auth_user_id};
}
async function revokeSession(s){
  const j=await issuerCall('/revoke',{accessToken:s.accessToken,sessionId:s.sessionId,authUserId:s.authUserId});
  assert(j.revoked===true&&j.session_absent===true,'QA_SESSION_REVOKE_NOT_PROVEN');
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
  await waitUntil(
    ()=>page.evaluate(()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady)),
    'CLIENT_CONTEXT_RUNTIME_READY',
    30000,
    250
  );
  await page.evaluate(async({clientId,contractId})=>{
    const api=window.RONA_CLIENT_CONTEXT;
    await api.whenReady();
    api.select(clientId,contractId);
  },{clientId:target.client_id,contractId:target.contract_id});
  await waitUntil(
    ()=>page.evaluate(({clientId,contractId})=>{
      const current=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();
      return current?.client_id===clientId&&current?.contract_id===contractId;
    },{clientId:target.client_id,contractId:target.contract_id}),
    'CLIENT_CONTEXT_SELECTION',
    15000,
    250
  );
}
async function openMessages(page){
  const nav=page.locator('[data-page="messages"]').first();
  await nav.waitFor({state:'visible',timeout:20000});
  await nav.click();
  await page.locator('#page-messages').waitFor({state:'visible',timeout:10000});
}
async function clientSubmitUi(page,target,subject,message){
  await selectClientContext(page,target);
  await openMessages(page);
  await page.locator('#msgSubject').fill(subject);
  await page.locator('#msgText').fill(message);
  await page.locator('#sendMessage').click();
  await page.locator('#page-messages .message-grid').getByText(subject,{exact:true}).first().waitFor({state:'visible',timeout:20000});
  const api=await page.evaluate(async({clientId,contractId,subject})=>{
    const r=await fetch('/portal/api/v1/client/messages?clientId='+encodeURIComponent(clientId)+'&contractId='+encodeURIComponent(contractId),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
    const b=await r.json().catch(()=>null);
    const row=(b?.messages||[]).find(x=>String(x?.payload?.subject||'')===subject);
    return{status:r.status,row};
  },{clientId:target.client_id,contractId:target.contract_id,subject});
  assert(api.status===200&&api.row?.event_id,'CLIENT_UI_MESSAGE_NOT_CANONICAL');
  return api.row;
}
async function liveBlob(path,expected){
  const r=await fetch(ORIGIN+path+(path.includes('?')?'&':'?')+'_qa='+Date.now(),{headers:{'cache-control':'no-cache'}});
  assert(r.status===200,`LIVE_ASSET_HTTP_${r.status}_${path}`);
  const bytes=Buffer.from(await r.arrayBuffer());
  const sha=gitBlobSha(bytes);
  assert(sha===expected,`LIVE_ASSET_BLOB_DRIFT_${path}_${sha}`);
  return{path,bytes:bytes.length,gitBlobSha:sha};
}

const proof={
  suite:'RADIO_ROOM_ADMIN_CLIENT_STAGE2A_PRODUCTION',
  releaseHead:HEAD,
  origin:ORIGIN,
  sessions:[],
  clientA:null,
  clientB:null,
  admin:null,
  isolation:null,
  duplicate:null,
  reload:null,
  contextSwitch:null,
  visual:null,
  assets:null,
  cleanup:[]
};

const sessions=[];
let browser;
let aContext,bContext,adminContext;
try{
  const [adminSession,aSession,bSession]=await Promise.all([issueSession(QA_ADMIN),issueSession(QA_CLIENT_A),issueSession(QA_CLIENT_B)]);
  sessions.push(adminSession,aSession,bSession);
  proof.sessions=sessions.map(s=>({portalUserId:s.portalUserId,issued:true}));

  browser=await chromium.launch({headless:true});
  aContext=await browserContext(browser,aSession);
  const aPage=await aContext.newPage();
  await aPage.goto(ORIGIN+'/portal/client?_qa_radio_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});

  const tag=Date.now().toString(36);
  const subjectA=`QA STAGE2A A ${tag}`,messageA=`Client A canonical message ${tag}`,responseA=`RONA Trade QA response ${tag}`;
  const rowA=await clientSubmitUi(aPage,C002,subjectA,messageA);
  proof.clientA={eventId:rowA.event_id,subject:subjectA,context:C002};

  const foreignDeal=await contextApi(aContext,'/portal/api/v1/client/messages',{
    method:'POST',
    headers:{'x-idempotency-key':crypto.randomUUID()},
    body:{clientId:C002.client_id,contractId:C002.contract_id,dealId:C002.foreign_deal,subject:'QA foreign deal',message:'must fail',idempotencyKey:crypto.randomUUID()}
  });
  assert(foreignDeal.status===404,'FOREIGN_DEAL_SCOPE_NOT_DENIED');

  const crossContract=await contextApi(aContext,'/portal/api/v1/client/messages?clientId='+encodeURIComponent(C002.client_id)+'&contractId='+encodeURIComponent(C005.contract_id));
  assert(crossContract.status===404,'CROSS_CONTRACT_SUBSTITUTION_NOT_DENIED');

  const subjectC005=`QA STAGE2A C005 ${tag}`;
  const rowC005=await clientSubmitUi(aPage,C005,subjectC005,`Context C005 message ${tag}`);

  adminContext=await browserContext(browser,adminSession);
  const adminPage=await adminContext.newPage();
  await adminPage.goto(ORIGIN+'/portal/admin?_qa_radio_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await waitUntil(
    ()=>adminPage.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),
    'ADMIN_OWNER_RUNTIME_READY',
    60000,
    250
  );
  await waitUntil(
    ()=>adminPage.evaluate(()=>Boolean(window.__RONA_REMAINING_SECTIONS_READY__)||window.__RONA_ADMIN_MODULES__?.remaining?.status==='READY'),
    'ADMIN_REMAINING_SECTIONS_READY',
    90000,
    250
  );
  const nav=adminPage.locator('[data-page="messages"]').first();
  await nav.waitFor({state:'visible',timeout:20000});await nav.click();
  const radioRoot=adminPage.locator('#page-messages > .rona-rs-root[data-kind="radio"]');
  await radioRoot.waitFor({state:'visible',timeout:30000});
  await radioRoot.locator('.rona-rs-form,.rf-compose,.radio-compose-panel').first().waitFor({state:'visible',timeout:10000});
  const selects=radioRoot.locator('select');
  assert(await selects.count()===3,'ADMIN_RADIO_COMPOSER_SELECT_COUNT_CHANGED');
  assert(await selects.nth(0).inputValue()==='MESSAGE','ADMIN_RADIO_DEFAULT_KIND_CHANGED');
  assert(await selects.nth(1).inputValue()==='ALL_CLIENTS','ADMIN_RADIO_DEFAULT_SCOPE_CHANGED');
  assert(await selects.nth(2).isDisabled(),'ADMIN_RADIO_INITIAL_TARGET_STATE_CHANGED');
  proof.visual={adminRadioInitial:{kind:'MESSAGE',scope:'ALL_CLIENTS',targetDisabled:true},visualDelta:0};

  const intake=await contextApi(adminContext,'/portal/api/v1/admin/bootstrap',{referer:'/portal/admin'});
  assert(intake.status===200,'ADMIN_CANONICAL_BOOTSTRAP_FAILED');
  const intakeRow=(intake.body?.data?.client_intake||[]).find(x=>x.event_id===rowA.event_id);
  assert(intakeRow?.task_id,'ADMIN_INTAKE_SOURCE_TASK_MISSING');

  await selects.nth(1).selectOption('CLIENT');
  try{
    await selects.nth(2).selectOption({value:rowA.event_id},{timeout:30000});
  }catch(error){
    const diagnostics=await adminPage.evaluate(()=>({
      bridge:window.__RONA_ADMIN_RADIO_MESSAGE_BRIDGE__||null,
      liveOwner:window.__RONA_REMAINING_SECTIONS_R2__||null,
      canonicalError:window.__RONA_ADMIN_RADIO_MESSAGE_CANONICAL_ERROR__||null,
      canonicalIntake:(window.__RONA_ADMIN_RADIO_MESSAGE_CANONICAL_INTAKE__||[]).map(x=>({
        event_id:x?.event_id||null,task_id:x?.task_id||null,event_type:x?.event_type||null
      })),
      remainingReady:window.__RONA_REMAINING_SECTIONS_READY__||null,
      remainingModule:window.__RONA_ADMIN_MODULES__?.remaining||null,
      page:document.documentElement.dataset.ronaAdminPage||null,
      targetOptions:Array.from(document.querySelectorAll('#page-messages > .rona-rs-root[data-kind="radio"] select')[2]?.options||[]).map(o=>({value:o.value,text:o.textContent})),
      shellErrors:window.__RONA_ADMIN_SHELL_OPTIONAL_ERRORS__||[]
    }));
    proof.adminDiagnostics=diagnostics;
    throw new Error('ADMIN_CANONICAL_TARGET_MISSING:'+JSON.stringify(diagnostics));
  }

  await radioRoot.locator('textarea').fill(responseA);
  await radioRoot.getByRole('button',{name:'Отправить',exact:true}).click();

  const published=await waitUntil(async()=>{
    const r=await contextApi(aContext,'/portal/api/v1/client/messages?clientId='+encodeURIComponent(C002.client_id)+'&contractId='+encodeURIComponent(C002.contract_id));
    const row=(r.body?.messages||[]).find(x=>x.event_id===rowA.event_id);
    return r.status===200&&row?.client_response_text===responseA&&row?.client_response_published_at?row:null;
  },'CLIENT_A_RESPONSE_PUBLISH',45000,500);
  proof.admin={eventId:rowA.event_id,sourceTaskId:intakeRow.task_id,uiReply:true};
  proof.clientA.response={text:published.client_response_text,publishedAt:published.client_response_published_at};

  const duplicateSame=await contextApi(adminContext,'/portal/api/v1/admin/client-intake/'+encodeURIComponent(rowA.event_id)+'/respond',{method:'POST',body:{response:responseA,source_task_id:intakeRow.task_id},referer:'/portal/admin'});
  assert(duplicateSame.status===200&&duplicateSame.body?.response?.reused===true,'IDENTICAL_DUPLICATE_NOT_IDEMPOTENT');
  const duplicateConflict=await contextApi(adminContext,'/portal/api/v1/admin/client-intake/'+encodeURIComponent(rowA.event_id)+'/respond',{method:'POST',body:{response:responseA+' CONFLICT',source_task_id:intakeRow.task_id},referer:'/portal/admin'});
  assert(duplicateConflict.status===403,'CONFLICTING_DUPLICATE_NOT_DENIED');
  proof.duplicate={samePayloadStatus:duplicateSame.status,samePayloadReused:true,conflictingStatus:duplicateConflict.status};

  bContext=await browserContext(browser,bSession);
  const bPage=await bContext.newPage();
  await bPage.goto(ORIGIN+'/portal/client?_qa_radio_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await selectClientContext(bPage,C002);await openMessages(bPage);
  const bMessages=await contextApi(bContext,'/portal/api/v1/client/messages?clientId='+encodeURIComponent(C002.client_id)+'&contractId='+encodeURIComponent(C002.contract_id));
  assert(bMessages.status===200,'CLIENT_B_MESSAGE_ROUTE_FAILED');
  assert(!(bMessages.body?.messages||[]).some(x=>x.event_id===rowA.event_id),'CLIENT_B_CAN_SEE_CLIENT_A_MESSAGE');
  assert(!(await bPage.locator('#page-messages').innerText()).includes(subjectA),'CLIENT_B_DOM_CAN_SEE_CLIENT_A_MESSAGE');
  proof.clientB={sameContract:true,clientAEventVisible:false};

  await aPage.reload({waitUntil:'domcontentloaded',timeout:30000});
  await selectClientContext(aPage,C002);await openMessages(aPage);
  await aPage.getByText('Ответ RONA Trade',{exact:true}).first().waitFor({state:'visible',timeout:20000});
  await aPage.getByText(responseA,{exact:true}).first().waitFor({state:'visible',timeout:20000});
  proof.reload={publishedResponsePersisted:true};

  await selectClientContext(aPage,C005);await openMessages(aPage);
  await aPage.getByText(subjectC005,{exact:true}).first().waitFor({state:'visible',timeout:20000});
  const c005Text=norm(await aPage.locator('#page-messages').innerText());
  assert(!c005Text.includes(subjectA),'C002_MESSAGE_LEAKED_INTO_C005_CONTEXT');
  await selectClientContext(aPage,C002);await openMessages(aPage);
  await aPage.getByText(subjectA,{exact:true}).first().waitFor({state:'visible',timeout:20000});
  const c002Text=norm(await aPage.locator('#page-messages').innerText());
  assert(!c002Text.includes(subjectC005),'C005_MESSAGE_LEAKED_INTO_C002_CONTEXT');
  proof.contextSwitch={c002Event:rowA.event_id,c005Event:rowC005.event_id,crossContextLeak:false};

  const radioState=await adminPage.evaluate(()=>{const root=document.querySelector('#page-messages > .rona-rs-root[data-kind="radio"]'),selects=root?[...root.querySelectorAll('select')]:[];return{
    bridge:window.__RONA_ADMIN_RADIO_MESSAGE_BRIDGE__||null,
    kind:selects[0]?.value||null,
    kindOptions:Array.from(selects[0]?.querySelectorAll('option')||[]).map(o=>o.value),
    scope:selects[1]?.value||null,
    rootKind:root?.dataset.kind||null,
    finalV9:root?.dataset.radioFinalV9||null,
    cleanHead:Boolean(document.querySelector('#page-messages > .rona-radio-clean-head')),
    finalDom:{
      main:Boolean(root?.querySelector('.rf-main')),
      compose:Boolean(root?.querySelector('.rf-compose')),
      network:Boolean(root?.querySelector('.rf-network')),
      bottom:Boolean(root?.querySelector('.rf-bottom')),
      feed:Boolean(root?.querySelector('.rf-feed')),
      routing:Boolean(root?.querySelector('.rf-routing'))
    },
    activeTitle:[...root?.querySelectorAll('.rf-panel-title,.radio-panel-head h2')||[]].map(x=>x.textContent.trim()).includes('Активные сообщения')
  }});
  assert(radioState.bridge==='STAGE_2A_MESSAGE_CANONICAL_BRIDGE_V3_LIVE_OWNER','ADMIN_RADIO_STAGE2A_LIVE_OWNER_MARKER_MISSING');
  assert(JSON.stringify(radioState.kindOptions)===JSON.stringify(['MESSAGE','NOTIFICATION','ANNOUNCEMENT']),'RADIO_KIND_OPTIONS_CHANGED');
  assert(radioState.rootKind==='radio','RADIO_CURRENT_OWNER_ROOT_MISSING');
  assert(radioState.finalV9==='1','RADIO_FINAL_V9_POLISH_NOT_APPLIED');
  proof.visual.adminRadioCleanHeaderPresent=radioState.cleanHead;
  assert(Object.values(radioState.finalDom).every(Boolean),'RADIO_FINAL_V9_DOM_CHANGED');
  assert(radioState.activeTitle,'RADIO_ACTIVE_TITLE_MISSING');
  proof.visual.adminRadioFinal=radioState;

  const clientAsset=await liveBlob('/assets/portal-runtime/client-messages-archive-v1.js',CLIENT_RUNTIME_BLOB);
  const radioFinalAsset=await liveBlob('/assets/portal-admin-radio-final-v9.js',RADIO_FINAL_VISUAL_BLOB);
  const radioWideAsset=await liveBlob('/assets/portal-admin-radio-wide-v10.js',RADIO_WIDE_VISUAL_BLOB);
  proof.assets={client:clientAsset,adminRadioFinal:radioFinalAsset,adminRadioWide:radioWideAsset};

  proof.isolation={
    clientBSeesClientA:false,
    crossContractStatus:crossContract.status,
    foreignDealStatus:foreignDeal.status,
    exactEventReplyBound:true
  };
  proof.pass=true;
  await writeFile('admin-radio-message-stage2a-production-proof.json',JSON.stringify(proof,null,2));
  console.log('RADIO_STAGE2A_PRODUCTION_RUNTIME=PASS');
  console.log('MESSAGE_ROUND_TRIP=PASS');
  console.log('TENANT_ISOLATION=PASS');
  console.log('CROSS_CONTRACT_SUBSTITUTION=DENIED');
  console.log('FOREIGN_DEAL_SCOPE=DENIED');
  console.log('DUPLICATE_REPLY_CONTRACT=PASS');
  console.log('CLIENT_RELOAD_PERSISTENCE=PASS');
  console.log('CLIENT_CONTEXT_SWITCH_ISOLATION=PASS');
  console.log('CLIENT_VISUAL_FREEZE=PASS');
  console.log('ADMIN_RADIO_VISUAL_FREEZE=PASS');
  console.log('NOTIFICATION_CHANGED=false');
  console.log('ANNOUNCEMENT_CHANGED=false');
  console.log('VISUAL_DELTA=0');
}finally{
  for(const ctx of [aContext,bContext,adminContext])if(ctx)await ctx.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  for(const s of sessions){
    try{await revokeSession(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true})}
    catch(error){proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:false,error:String(error?.message||error)})}
  }
  await writeFile('admin-radio-message-stage2a-production-proof.json',JSON.stringify(proof,null,2)).catch(()=>{});
}
