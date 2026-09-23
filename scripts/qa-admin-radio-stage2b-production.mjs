import { chromium } from 'playwright';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const ORIGIN=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const HEAD=String(process.env.EXPECTED_HEAD||'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-radio-stage2a-production-v1';
const QA_ADMIN='a2a0b91e-4c2a-4d3e-8f11-2a2a00000001';
const QA_CLIENT_C005='a2a0b91e-4c2a-4d3e-8f11-2a2a00000004';
const QA_CLIENT_C002='a2a0b91e-4c2a-4d3e-8f11-2a2a00000003';
const C005='RONA-C005',C002='RONA-C002';
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
  s.revoked=true;return true;
}
async function browserContext(browser,session){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:session.accessToken,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  return context;
}
async function contextApi(context,path,{method='GET',body=null,headers={},referer='/portal/admin'}={}){
  const r=await context.request.fetch(ORIGIN+path,{method,headers:{accept:'application/json',origin:ORIGIN,referer:ORIGIN+referer,'cache-control':'no-store',...headers},data:body??undefined,failOnStatusCode:false});
  const j=await r.json().catch(()=>null);
  return{status:r.status(),body:j,headers:r.headers()};
}
async function ownerApi(context,path,{method='GET',body=null,referer='/portal/admin'}={}){
  return contextApi(context,'/portal/owner-api?path='+encodeURIComponent(path),{method,body,referer});
}
async function retryTransientRead(fn,label,{attempts=4,baseDelay=250}={}){
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    last=await fn();
    if(last.status<500&&last.status!==429)return last;
    if(attempt<attempts)await sleep(baseDelay*attempt);
  }
  console.error(label+'_TRANSIENT_EXHAUSTED',JSON.stringify({status:last?.status,code:last?.body?.code||last?.body?.error?.code||null}));
  return last;
}
async function radioBootstrap(context){
  return retryTransientRead(
    ()=>contextApi(context,'/portal/api/v1/admin/radio/bootstrap',{referer:'/portal/admin',headers:{'x-rona-client-source':'ADMIN_RADIO_STAGE2B_PRODUCTION_QA'}}),
    'RADIO_BOOTSTRAP'
  );
}
async function clientBootstrap(context){
  return retryTransientRead(
    ()=>ownerApi(context,'/client/bootstrap',{referer:'/portal/client'}),
    'CLIENT_BOOTSTRAP'
  );
}
async function waitUntil(fn,label,timeout=45000,interval=350){
  const started=Date.now();let last=null;
  while(Date.now()-started<timeout){
    try{last=await fn();if(last)return last}catch(error){last=error}
    await sleep(interval);
  }
  throw new Error(`${label}_TIMEOUT:${last instanceof Error?last.message:JSON.stringify(last)}`);
}
async function liveBlob(path,expected){
  const r=await fetch(ORIGIN+path+(path.includes('?')?'&':'?')+'_qa='+Date.now(),{headers:{'cache-control':'no-cache'}});
  assert(r.status===200,`LIVE_ASSET_HTTP_${r.status}_${path}`);
  const bytes=Buffer.from(await r.arrayBuffer()),sha=gitBlobSha(bytes);
  assert(sha===expected,`LIVE_ASSET_BLOB_DRIFT_${path}_${sha}`);
  return{path,bytes:bytes.length,gitBlobSha:sha};
}
function radioRows(payload){return Array.isArray(payload?.body?.data?.radio_broadcasts)?payload.body.data.radio_broadcasts:[]}
function clientRadio(payload){return Array.isArray(payload?.body?.data?.radio)?payload.body.data.radio:[]}

const proof={
  suite:'RADIO_STAGE2B_NOTIFICATION_ANNOUNCEMENT_PRODUCTION',
  releaseHead:HEAD,origin:ORIGIN,sessions:[],
  preexisting:null,targetedNotification:null,broadcastAnnouncement:null,
  idempotency:null,security:null,visual:null,assets:null,cleanup:[],pass:false
};
const sessions=[];const contexts=[];let browser=null,adminContextRef=null;const qaIds=new Set(),qaBodies=new Set();
try{
  const [adminSession,c005Session,c002Session]=await Promise.all([issueSession(QA_ADMIN),issueSession(QA_CLIENT_C005),issueSession(QA_CLIENT_C002)]);
  sessions.push(adminSession,c005Session,c002Session);proof.sessions=sessions.map(s=>({portalUserId:s.portalUserId,issued:true}));

  browser=await chromium.launch({headless:true});
  const adminContext=await browserContext(browser,adminSession),c005Context=await browserContext(browser,c005Session),c002Context=await browserContext(browser,c002Session);
  adminContextRef=adminContext;contexts.push(adminContext,c005Context,c002Context);
  const adminPage=await adminContext.newPage();

  let boot=await radioBootstrap(adminContext);
  assert(boot.status===200,'RADIO_BOOTSTRAP_PRE_FAILED');
  const preIds=radioRows(boot).map(x=>String(x.id));
  proof.preexisting={activeBroadcastIds:preIds};

  await adminPage.goto(ORIGIN+'/portal/admin?_qa_radio_stage2b='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await waitUntil(()=>adminPage.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),'ADMIN_OWNER_READY',60000,300);
  await waitUntil(()=>adminPage.evaluate(()=>Boolean(window.__RONA_REMAINING_SECTIONS_READY__)||window.__RONA_ADMIN_MODULES__?.remaining?.status==='READY'),'ADMIN_REMAINING_READY',90000,300);
  await adminPage.locator('[data-page="messages"]').first().click();
  let root=adminPage.locator('#page-messages > .rona-rs-root[data-kind="radio"]');
  await root.waitFor({state:'visible',timeout:30000});

  await waitUntil(()=>adminPage.evaluate(()=>window.__RONA_ADMIN_RADIO_BROADCAST_BRIDGE__==='STAGE_2B_NOTIFICATION_ANNOUNCEMENT_V1_STATIC_OWNER'),'STAGE2B_OWNER_MARKER',30000,300);
  let selects=root.locator('select');
  assert(await selects.count()===3,'RADIO_COMPOSER_SELECT_COUNT_CHANGED');

  // Targeted client notification through the actual Admin UI.
  const tag=Date.now().toString(36),notificationBody=`QA STAGE2B TARGETED NOTIFICATION ${tag}`;qaBodies.add(notificationBody);
  await selects.nth(0).selectOption('NOTIFICATION');
  await selects.nth(1).selectOption('CLIENT');
  await waitUntil(async()=>{const values=await selects.nth(2).locator('option').evaluateAll(opts=>opts.map(o=>({value:o.value,text:o.textContent})));return values.some(x=>x.value===C005)&&values.every(x=>!String(x.text).includes('PORTAL-EVT-'))?values:null},'NOTIFICATION_CLIENT_DIRECTORY',30000,300);
  await selects.nth(2).selectOption(C005);
  await root.locator('textarea').fill(notificationBody);
  await root.getByRole('button',{name:'Отправить',exact:true}).click();

  const targeted=await waitUntil(async()=>{const r=await radioBootstrap(adminContext);return radioRows(r).find(x=>norm(x.body_text)===notificationBody)||null},'TARGETED_NOTIFICATION_PERSIST',45000,500);
  qaIds.add(String(targeted.id));
  assert(targeted.item_kind==='NOTIFICATION'&&targeted.target_scope==='CLIENT'&&targeted.target_id===C005,'TARGETED_NOTIFICATION_SEMANTICS_INVALID');
  const c005AfterTarget=await clientBootstrap(c005Context),c002AfterTarget=await clientBootstrap(c002Context);
  assert(c005AfterTarget.status===200&&clientRadio(c005AfterTarget).some(x=>String(x.id)===String(targeted.id)),'TARGETED_NOTIFICATION_NOT_DELIVERED');
  assert(c002AfterTarget.status===200&&!clientRadio(c002AfterTarget).some(x=>String(x.id)===String(targeted.id)),'TARGETED_NOTIFICATION_CROSS_TENANT_LEAK');
  proof.targetedNotification={id:String(targeted.id),target:C005,c005Visible:true,c002Visible:false};

  // All-client announcement through the same existing composer.
  root=adminPage.locator('#page-messages > .rona-rs-root[data-kind="radio"]');selects=root.locator('select');
  const announcementBody=`QA STAGE2B ALL CLIENTS ANNOUNCEMENT ${tag}`;qaBodies.add(announcementBody);
  await selects.nth(0).selectOption('ANNOUNCEMENT');
  await selects.nth(1).selectOption('ALL_CLIENTS');
  assert(await selects.nth(2).isDisabled(),'ALL_CLIENTS_TARGET_MUST_BE_DISABLED');
  await root.locator('textarea').fill(announcementBody);
  await root.getByRole('button',{name:'Отправить',exact:true}).click();
  const announcement=await waitUntil(async()=>{const r=await radioBootstrap(adminContext);return radioRows(r).find(x=>norm(x.body_text)===announcementBody)||null},'ANNOUNCEMENT_PERSIST',45000,500);
  qaIds.add(String(announcement.id));
  assert(announcement.item_kind==='ANNOUNCEMENT'&&announcement.target_scope==='ALL_CLIENTS'&&!announcement.target_id,'ANNOUNCEMENT_SCOPE_INVALID');
  const c005AfterAnnouncement=await clientBootstrap(c005Context),c002AfterAnnouncement=await clientBootstrap(c002Context);
  assert(clientRadio(c005AfterAnnouncement).some(x=>String(x.id)===String(announcement.id)),'ALL_CLIENTS_ANNOUNCEMENT_MISSING_C005');
  assert(clientRadio(c002AfterAnnouncement).some(x=>String(x.id)===String(announcement.id)),'ALL_CLIENTS_ANNOUNCEMENT_MISSING_C002');
  proof.broadcastAnnouncement={id:String(announcement.id),c005Visible:true,c002Visible:true};

  // Legacy MESSAGE bypass is closed and invalid targets fail server-side.
  const legacyMessage=await ownerApi(adminContext,'/admin/radio',{method:'POST',body:{kind:'MESSAGE',scope:'CLIENT',targetId:C005,body:'must fail',idempotencyKey:randomUUID()}});
  assert(legacyMessage.status===409&&legacyMessage.body?.code==='RADIO_MESSAGE_CANONICAL_ROUTE_REQUIRED','LEGACY_MESSAGE_BYPASS_OPEN');
  const badTarget=await ownerApi(adminContext,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'CLIENT',targetId:'RONA-C999',body:'must fail',idempotencyKey:randomUUID()}});
  assert(badTarget.status===409&&badTarget.body?.code==='RADIO_CLIENT_TARGET_NOT_CURRENT','INVALID_CLIENT_TARGET_ACCEPTED');
  const badAgent=await ownerApi(adminContext,'/admin/radio',{method:'POST',body:{kind:'ANNOUNCEMENT',scope:'AGENT',targetId:'AGENT-DOES-NOT-EXIST',body:'must fail',idempotencyKey:randomUUID()}});
  assert(badAgent.status===409&&badAgent.body?.code==='RADIO_AGENT_TARGET_NOT_CURRENT','INVALID_AGENT_TARGET_ACCEPTED');
  proof.security={legacyMessageStatus:legacyMessage.status,badClientStatus:badTarget.status,badAgentStatus:badAgent.status};

  // Idempotency is durable for broadcast publication.
  const idem=randomUUID(),idemBody=`QA STAGE2B IDEMPOTENCY ${tag}`;qaBodies.add(idemBody);
  const first=await ownerApi(adminContext,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'ALL_CLIENTS',targetId:null,body:idemBody,idempotencyKey:idem}});
  const second=await ownerApi(adminContext,'/admin/radio',{method:'POST',body:{kind:'NOTIFICATION',scope:'ALL_CLIENTS',targetId:null,body:idemBody,idempotencyKey:idem}});
  assert(first.status===200&&second.status===200,'IDEMPOTENCY_REQUEST_FAILED');
  assert(first.body?.data?.id&&second.body?.data?.id&&first.body.data.id===second.body.data.id,'IDEMPOTENCY_DUPLICATE_CREATED');
  assert(second.body?.data?.reused===true,'IDEMPOTENCY_REUSE_NOT_REPORTED');
  qaIds.add(String(first.body.data.id));
  proof.idempotency={id:String(first.body.data.id),secondReused:Boolean(second.body?.data?.reused)};

  // Existing geometry and frozen visual assets remain unchanged.
  const visual=await adminPage.evaluate(()=>{const root=document.querySelector('#page-messages > .rona-rs-root[data-kind="radio"]'),selects=root?[...root.querySelectorAll('select')]:[];return{messageBridge:window.__RONA_ADMIN_RADIO_MESSAGE_BRIDGE__||null,broadcastBridge:window.__RONA_ADMIN_RADIO_BROADCAST_BRIDGE__||null,kindOptions:Array.from(selects[0]?.querySelectorAll('option')||[]).map(o=>o.value),rootKind:root?.dataset.kind||null,finalV9:root?.dataset.radioFinalV9||null,finalDom:{main:Boolean(root?.querySelector('.rf-main')),compose:Boolean(root?.querySelector('.rf-compose')),network:Boolean(root?.querySelector('.rf-network')),bottom:Boolean(root?.querySelector('.rf-bottom')),feed:Boolean(root?.querySelector('.rf-feed')),routing:Boolean(root?.querySelector('.rf-routing'))}}});
  assert(visual.messageBridge==='STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_STATIC_OWNER','STAGE2A_MESSAGE_OWNER_REGRESSED');
  assert(visual.broadcastBridge==='STAGE_2B_NOTIFICATION_ANNOUNCEMENT_V1_STATIC_OWNER','STAGE2B_BROADCAST_OWNER_MISSING');
  assert(JSON.stringify(visual.kindOptions)===JSON.stringify(['MESSAGE','NOTIFICATION','ANNOUNCEMENT']),'RADIO_KIND_OPTIONS_CHANGED');
  assert(visual.rootKind==='radio'&&visual.finalV9==='1'&&Object.values(visual.finalDom).every(Boolean),'RADIO_VISUAL_FREEZE_CHANGED');
  proof.visual={visualDelta:0,...visual};
  proof.assets={
    client:await liveBlob('/assets/portal-runtime/client-messages-archive-v1.js',CLIENT_RUNTIME_BLOB),
    adminRadioFinal:await liveBlob('/assets/portal-admin-radio-final-v9.js',RADIO_FINAL_VISUAL_BLOB),
    adminRadioWide:await liveBlob('/assets/portal-admin-radio-wide-v10.js',RADIO_WIDE_VISUAL_BLOB)
  };

  // Audit-safe cleanup: expire only exact QA publication IDs, never DELETE.
  for(const id of qaIds){
    const expired=await ownerApi(adminContext,`/admin/radio/${encodeURIComponent(id)}/expire`,{method:'POST',body:{}});
    assert(expired.status===200&&String(expired.body?.data?.id)===id,`QA_EXPIRE_FAILED_${id}`);
    proof.cleanup.push({id,expired:true});
  }
  boot=await radioBootstrap(adminContext);
  assert(!radioRows(boot).some(x=>qaIds.has(String(x.id))),'QA_BROADCAST_STILL_ACTIVE_IN_ADMIN');
  const c005Clean=await clientBootstrap(c005Context),c002Clean=await clientBootstrap(c002Context);
  assert(!clientRadio(c005Clean).some(x=>qaIds.has(String(x.id))),'QA_BROADCAST_STILL_VISIBLE_C005');
  assert(!clientRadio(c002Clean).some(x=>qaIds.has(String(x.id))),'QA_BROADCAST_STILL_VISIBLE_C002');
  proof.pass=true;

  for(const ctx of contexts)await ctx.close().catch(()=>{});
  contexts.length=0;if(browser){await browser.close().catch(()=>{});browser=null}
  for(const s of sessions){await revokeSession(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true})}
  await writeFile('admin-radio-stage2b-production-proof.json',JSON.stringify(proof,null,2));

  console.log('RADIO_STAGE2B_TARGETED_NOTIFICATION=PASS');
  console.log('RADIO_STAGE2B_ALL_CLIENTS_ANNOUNCEMENT=PASS');
  console.log('RADIO_STAGE2B_TENANT_ISOLATION=PASS');
  console.log('RADIO_STAGE2B_MESSAGE_BYPASS_CLOSED=PASS');
  console.log('RADIO_STAGE2B_TARGET_VALIDATION=PASS');
  console.log('RADIO_STAGE2B_IDEMPOTENCY=PASS');
  console.log('RADIO_STAGE2B_QA_CLEANUP=PASS');
  console.log('QA_ACTIVE_BROADCASTS=0');
  console.log('ADMIN_RADIO_VISUAL_FREEZE=PASS');
  console.log('CLIENT_VISUAL_FREEZE=PASS');
  console.log('VISUAL_DELTA=0');
}finally{
  if(adminContextRef){
    try{
      const current=await radioBootstrap(adminContextRef);
      for(const row of radioRows(current))if(qaBodies.has(norm(row?.body_text)))qaIds.add(String(row.id));
    }catch{}
    for(const id of qaIds){
      try{await ownerApi(adminContextRef,`/admin/radio/${encodeURIComponent(id)}/expire`,{method:'POST',body:{}})}catch{}
    }
  }
  for(const ctx of contexts)await ctx.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  for(const s of sessions){
    if(!s.revoked){try{await revokeSession(s);proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:true})}catch(error){proof.cleanup.push({portalUserId:s.portalUserId,sessionRevoked:false,error:String(error?.message||error)})}}
  }
  await writeFile('admin-radio-stage2b-production-proof.json',JSON.stringify(proof,null,2)).catch(()=>{});
}
