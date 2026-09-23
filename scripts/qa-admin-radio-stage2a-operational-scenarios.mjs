import {
  ORIGIN,HEAD,C002,C005,A001,A002,VISUAL,assert,norm,wait,
  adminDirectories,adminBoot,clientMessages,agentMessages,
  selectClient,openMessages,clientSubmit,agentSubmit,api,liveBlob,broadcastSignature,
  directAgentBootstrap,proxyAgentBootstrap
} from './qa-admin-radio-stage2a-operational-helpers.mjs';

const AGENT_MESSAGE_KEYS=['eventId','agentPersonId','subject','text','relatedObject','direction','processingState','acknowledgementState','createdAt','updatedAt'];
const AGENT_MESSAGE_FORBIDDEN_KEYS=['payload','actorUserId','actor_user_id','actorRole','actor_role','requestId','request_id','correlationId','correlation_id','agentPersonKey','agent_person_key','clientKey','client_key','contractKey','contract_key','dealKey','deal_key','authorityDomain','authority_domain','authorityTargetType','authority_target_type','sourceSystem','source_system','sourceVersion','source_version'];
const canonicalAgentMessage=m=>Object.fromEntries(AGENT_MESSAGE_KEYS.map(k=>[k,m?.[k]??null]));
const orderedMessages=xs=>(Array.isArray(xs)?xs:[]).map(canonicalAgentMessage).sort((a,b)=>String(a.eventId).localeCompare(String(b.eventId)));

async function proveAgentBootstrapParity(session,ctx,label,expectedAgentPersonId){
  const direct=await directAgentBootstrap(session),proxy=await proxyAgentBootstrap(ctx);
  assert(direct.status===200,label+'_DIRECT_BOOT_HTTP_'+direct.status);
  assert(proxy.status===200,label+'_PROXY_BOOT_HTTP_'+proxy.status);
  const d=direct.body?.data,p=proxy.body?.data;
  assert(d&&p,label+'_BOOT_DATA_MISSING');
  assert(d.agentPersonId===expectedAgentPersonId&&p.agentPersonId===expectedAgentPersonId,label+'_AGENT_PERSON_ID_UNEXPECTED');
  assert(d.agentPersonId===p.agentPersonId,label+'_AGENT_PERSON_ID_PARITY');
  assert(d.userId===p.userId,label+'_USER_ID_PARITY');
  assert(d.displayAlias===p.displayAlias,label+'_DISPLAY_ALIAS_PARITY');
  assert(d.legalEntity?.id&&p.legalEntity?.id&&d.legalEntity.id===p.legalEntity.id,label+'_LEGAL_ENTITY_ID_PARITY');
  assert(Array.isArray(p.clients)&&Array.isArray(p.deals)&&Array.isArray(p.applications)&&Array.isArray(p.settlements)&&Array.isArray(p.economics)&&Array.isArray(p.documents)&&Array.isArray(p.messages),label+'_CANONICAL_ARRAY_CONTRACT_MISSING');
  assert(!Object.prototype.hasOwnProperty.call(p,'assignedClients'),label+'_STALE_ASSIGNED_CLIENTS_PRESENT');
  for(const m of p.messages){
    assert(Object.keys(m).every(k=>AGENT_MESSAGE_KEYS.includes(k)),label+'_MESSAGE_ALLOWLIST_DRIFT');
    assert(!AGENT_MESSAGE_FORBIDDEN_KEYS.some(k=>Object.prototype.hasOwnProperty.call(m,k)),label+'_MESSAGE_SENSITIVE_FIELD_EXPOSED');
    assert(m.agentPersonId===expectedAgentPersonId,label+'_MESSAGE_AGENT_SCOPE_DRIFT');
    assert(['ADMIN_TO_AGENT','AGENT_TO_ADMIN'].includes(String(m.direction)),label+'_MESSAGE_DIRECTION_DRIFT');
  }
  const dm=orderedMessages(d.messages),pm=orderedMessages(p.messages);
  assert(JSON.stringify(dm)===JSON.stringify(pm),label+'_MESSAGE_PROJECTION_PARITY');
  return{
    directHttp:direct.status,proxyHttp:proxy.status,
    agentPersonId:p.agentPersonId,userId:p.userId,displayAlias:p.displayAlias,
    legalEntityId:p.legalEntity.id,messageCount:pm.length,messageEventIds:pm.map(x=>x.eventId)
  };
}

export async function runRoundTrips(x){
  const {adminContext,adminPage,clientAContext,clientA2Context,clientBContext,agentAContext,agentBContext,agentASession,agentBSession,clientAPage,clientA2Page,clientBPage,agentAPage,agentBPage,qaEvents,beforeBroadcasts,proof}=x;
  const tag=Date.now().toString(36);

  // A. Admin -> Client plus company-scope and cross-client isolation.
  let ui=await adminDirectories(adminPage);
  await ui.selects.nth(1).selectOption('CLIENT');await ui.selects.nth(2).selectOption(C005.client_id);
  const adminClientMessage=`QA STAGE2A ADMIN CLIENT ${tag}`;await ui.root.locator('textarea').fill(adminClientMessage);
  const acWait=adminPage.waitForResponse(r=>r.url().includes('/portal/api/v1/admin/radio/messages')&&r.request().method()==='POST',{timeout:20000});
  await ui.root.getByRole('button',{name:'Отправить',exact:true}).click();
  const acResp=await acWait,acBody=await acResp.json().catch(()=>null);
  assert([200,201].includes(acResp.status()),'ADMIN_TO_CLIENT_SEND_FAILED');
  const adminClientEvent=String(acBody?.message?.event_id||'');assert(adminClientEvent.startsWith('PORTAL-EVT-'),'ADMIN_TO_CLIENT_EVENT_MISSING');qaEvents.push(adminClientEvent);

  await clientAPage.goto(ORIGIN+'/portal/client?_qa_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await selectClient(clientAPage,C005);await openMessages(clientAPage);await clientAPage.getByText(adminClientMessage,{exact:true}).first().waitFor({state:'visible',timeout:30000});
  const ar=await clientMessages(clientAContext,C005);assert((ar.body?.messages||[]).some(v=>v.event_id===adminClientEvent),'ADMIN_TO_CLIENT_API_NOT_VISIBLE');
  proof.adminToClient={eventId:adminClientEvent,visible:true};

  await clientA2Page.goto(ORIGIN+'/portal/client?_qa_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await selectClient(clientA2Page,C005);await openMessages(clientA2Page);await clientA2Page.getByText(adminClientMessage,{exact:true}).first().waitFor({state:'visible',timeout:30000});
  const a2=await clientMessages(clientA2Context,C005);assert((a2.body?.messages||[]).some(v=>v.event_id===adminClientEvent),'SAME_COMPANY_SECOND_USER_NOT_VISIBLE');

  await clientBPage.goto(ORIGIN+'/portal/client?_qa_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await selectClient(clientBPage,C002);await openMessages(clientBPage);
  const br=await clientMessages(clientBContext,C002);assert(!(br.body?.messages||[]).some(v=>v.event_id===adminClientEvent),'CROSS_CLIENT_MESSAGE_LEAK');
  const bf=await clientMessages(clientBContext,C005);assert(bf.status===404,'CROSS_CLIENT_CONTEXT_SUBSTITUTION_ALLOWED');
  proof.companySecurity={sameCompanySecondUser:true,crossClientStatus:bf.status};

  // B. Client -> Admin and existing mediated Admin response path.
  const subject=`QA STAGE2A CLIENT ${tag}`,body=`QA STAGE2A CLIENT BODY ${tag}`,reply=`QA STAGE2A CLIENT REPLY ${tag}`;
  await clientSubmit(clientAPage,C005,subject,body);
  const clientEvent=await wait(async()=>{const r=await clientMessages(clientAContext,C005);return(r.body?.messages||[]).find(v=>norm(v?.payload?.subject)===subject)||null},'CLIENT_TO_ADMIN_EVENT');
  qaEvents.push(String(clientEvent.event_id));
  await adminPage.reload({waitUntil:'domcontentloaded',timeout:30000});
  await wait(()=>adminPage.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),'ADMIN_RELOAD_READY',60000,250);
  ui=await adminDirectories(adminPage);
  await wait(async()=>norm(await ui.root.innerText()).includes(subject),'CLIENT_TO_ADMIN_ADMIN_UI');
  await ui.selects.nth(1).selectOption('CLIENT');await ui.selects.nth(2).selectOption(C005.client_id);await ui.root.locator('textarea').fill(reply);await ui.root.getByRole('button',{name:'Отправить',exact:true}).click();
  const replied=await wait(async()=>{const r=await clientMessages(clientAContext,C005),v=(r.body?.messages||[]).find(z=>z.event_id===clientEvent.event_id);return v?.client_response_text===reply?v:null},'CLIENT_REPLY_PERSIST',45000,400);
  proof.clientToAdmin={eventId:clientEvent.event_id,responsePublishedAt:replied.client_response_published_at};

  // C. Admin -> Agent.
  ui=await adminDirectories(adminPage);await ui.selects.nth(1).selectOption('AGENT');await ui.selects.nth(2).selectOption(A001.agent_person_id);
  const adminAgentMessage=`QA STAGE2A ADMIN AGENT ${tag}`;await ui.root.locator('textarea').fill(adminAgentMessage);
  const aaWait=adminPage.waitForResponse(r=>r.url().includes('/portal/api/v1/admin/radio/agent-messages')&&r.request().method()==='POST',{timeout:20000});
  await ui.root.getByRole('button',{name:'Отправить',exact:true}).click();
  const aaResp=await aaWait,aaBody=await aaResp.json().catch(()=>null);assert([200,201].includes(aaResp.status()),'ADMIN_TO_AGENT_SEND_FAILED');
  const adminAgentEvent=String(aaBody?.message?.event_id||'');assert(adminAgentEvent.startsWith('PORTAL-EVT-'),'ADMIN_TO_AGENT_EVENT_MISSING');qaEvents.push(adminAgentEvent);

  proof.agentBootDiagnostics={agentA:{pageErrors:[]},agentB:{pageErrors:[]}};
  agentAPage.on('pageerror',error=>proof.agentBootDiagnostics.agentA.pageErrors.push(String(error?.message||error)));
  await agentAPage.goto(ORIGIN+'/portal/agent?_qa_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await wait(async()=>{
    const state=await agentAPage.evaluate(()=>({agentId:window.RONA_AGENT_PORTAL?.getAgentId?.()||null,diag:window.__RONA_AGENT_BOOT_DIAGNOSTIC__||null,portalVersion:window.RONA_AGENT_PORTAL?.version||null}));
    proof.agentBootDiagnostics.agentA.state=state;
    if(state.agentId==='AGP-2026-001')return true;
    if(state.diag?.finished)throw new Error('AGENT_A_BOOT_DIAGNOSTIC:'+JSON.stringify(state));
    return false
  },'AGENT_A_BOOT',30000,250);
  proof.agentBootstrapParity=proof.agentBootstrapParity||{};
  proof.agentBootstrapParity.agentA=await proveAgentBootstrapParity(agentASession,agentAContext,'AGENT_A','AGP-2026-001');
  await openMessages(agentAPage);await agentAPage.getByText(adminAgentMessage,{exact:true}).first().waitFor({state:'visible',timeout:30000});
  const agentARead=await agentMessages(agentAContext);assert(agentARead.status===200&&(agentARead.body?.messages||[]).some(v=>v.eventId===adminAgentEvent),'ADMIN_TO_AGENT_API_NOT_VISIBLE');
  proof.adminToAgent={eventId:adminAgentEvent,visible:true};

  // E. Cross-Agent isolation before Agent A writes anything.
  agentBPage.on('pageerror',error=>proof.agentBootDiagnostics.agentB.pageErrors.push(String(error?.message||error)));
  await agentBPage.goto(ORIGIN+'/portal/agent?_qa_stage2a='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
  await wait(async()=>{
    const state=await agentBPage.evaluate(()=>({agentId:window.RONA_AGENT_PORTAL?.getAgentId?.()||null,diag:window.__RONA_AGENT_BOOT_DIAGNOSTIC__||null,portalVersion:window.RONA_AGENT_PORTAL?.version||null}));
    proof.agentBootDiagnostics.agentB.state=state;
    if(state.agentId==='AGP-2026-002')return true;
    if(state.diag?.finished)throw new Error('AGENT_B_BOOT_DIAGNOSTIC:'+JSON.stringify(state));
    return false
  },'AGENT_B_BOOT',30000,250);
  proof.agentBootstrapParity.agentB=await proveAgentBootstrapParity(agentBSession,agentBContext,'AGENT_B','AGP-2026-002');
  await openMessages(agentBPage);
  const agentBRead=await agentMessages(agentBContext);assert(agentBRead.status===200&&!(agentBRead.body?.messages||[]).some(v=>v.eventId===adminAgentEvent),'CROSS_AGENT_MESSAGE_LEAK');

  // D. Agent -> Admin through the existing Agent Messages form.
  const agentSubject=`QA STAGE2A AGENT ${tag}`,agentBody=`QA STAGE2A AGENT BODY ${tag}`;
  await agentSubmit(agentAPage,agentSubject,agentBody);
  const agentEvent=await wait(async()=>{const r=await agentMessages(agentAContext);return(r.body?.messages||[]).find(v=>norm(v?.subject)===agentSubject&&v.direction==='AGENT_TO_ADMIN')||null},'AGENT_TO_ADMIN_EVENT');
  qaEvents.push(String(agentEvent.eventId));
  const inbound=await wait(async()=>{const r=await adminBoot(adminContext);return(r.body?.data?.radio_messages||[]).find(v=>v.event_id===agentEvent.eventId&&v.direction==='AGENT_TO_ADMIN')||null},'AGENT_TO_ADMIN_ADMIN_PROJECTION');
  assert(inbound.agent_person_id===A001.agent_person_id,'AGENT_TO_ADMIN_IDENTITY_MISMATCH');
  await adminPage.reload({waitUntil:'domcontentloaded',timeout:30000});await wait(()=>adminPage.evaluate(()=>window.__RONA_OWNER_ADMIN_READY__===true),'ADMIN_AGENT_RELOAD_READY',60000,250);
  ui=await adminDirectories(adminPage);await wait(async()=>{const t=norm(await ui.root.innerText());return t.includes(agentSubject)&&t.includes(A001.name)},'AGENT_TO_ADMIN_ADMIN_UI');
  proof.agentToAdmin={eventId:agentEvent.eventId,adminIdentity:A001.agent_person_id,taskId:inbound.task_id||null};
  proof.agentSecurity={crossAgentVisible:false};

  // F. Client / Agent domains are route- and data-isolated.
  const ca=await api(clientAContext,'/portal/api/v1/agent/messages',{referer:'/portal/client'});
  const ac=await api(agentAContext,'/portal/api/v1/client/messages?clientId='+encodeURIComponent(C005.client_id)+'&contractId='+encodeURIComponent(C005.contract_id),{referer:'/portal/agent'});
  assert(ca.status===403,'CLIENT_CAN_READ_AGENT_ROUTE');assert(ac.status===403,'AGENT_CAN_READ_CLIENT_ROUTE');
  const cm=await clientMessages(clientAContext,C005),am=await agentMessages(agentAContext);
  assert(!(cm.body?.messages||[]).some(v=>[adminAgentEvent,agentEvent.eventId].includes(v.event_id)),'AGENT_EVENT_LEAKED_TO_CLIENT_DOMAIN');
  assert(!(am.body?.messages||[]).some(v=>[adminClientEvent,clientEvent.event_id].includes(v.eventId)),'CLIENT_EVENT_LEAKED_TO_AGENT_DOMAIN');
  proof.domainIsolation={clientToAgentStatus:ca.status,agentToClientStatus:ac.status};

  // Only four canonical chat event types may enter Radio MESSAGE projection.
  const boot=await adminBoot(adminContext);assert(boot.status===200,'ADMIN_RADIO_BOOTSTRAP_POST_ROUNDTRIP_FAILED');
  const messages=boot.body?.data?.radio_messages||[],allowed=new Set(['CLIENT_MESSAGE_SUBMIT','ADMIN_CLIENT_MESSAGE_SUBMIT','AGENT_MESSAGE_SUBMIT','ADMIN_AGENT_MESSAGE_SUBMIT']);
  assert(messages.every(v=>allowed.has(String(v.event_type))),'NON_CHAT_EVENT_IN_RADIO_PROJECTION');
  const leak=messages.filter(v=>['CLIENT_PRICE_APPLICATION','CLIENT_PRICE_CALCULATION_REQUEST'].includes(norm(v?.payload?.source))||['APPLICATION_DETAILS_V5','DELIVERED_PRICE_CALCULATION_REQUEST_V1'].includes(norm(v?.payload?.message_type)));
  assert(leak.length===0,'BUSINESS_EVENT_LEAKED_INTO_RADIO');assert(broadcastSignature(boot.body?.data||{})===beforeBroadcasts,'RADIO_BROADCAST_PROJECTION_CHANGED');
  proof.businessIsolation={businessLeak:0,radioMessageCount:messages.length};

  // Visual non-regression: frozen Admin assets + unchanged Agent Messages geometry.
  const state=await adminPage.evaluate(()=>{const r=document.querySelector('#page-messages > .rona-rs-root[data-kind="radio"]'),s=r?[...r.querySelectorAll('select')]:[];return{bridge:window.__RONA_ADMIN_RADIO_MESSAGE_BRIDGE__||null,operational:window.__RONA_ADMIN_RADIO_OPERATIONAL_MESSAGE__||null,kind:Array.from(s[0]?.options||[]).map(o=>o.value),rootKind:r?.dataset.kind||null,finalV9:r?.dataset.radioFinalV9||null,dom:{main:Boolean(r?.querySelector('.rf-main')),compose:Boolean(r?.querySelector('.rf-compose')),network:Boolean(r?.querySelector('.rf-network')),bottom:Boolean(r?.querySelector('.rf-bottom')),feed:Boolean(r?.querySelector('.rf-feed')),routing:Boolean(r?.querySelector('.rf-routing'))}}});
  assert(state.bridge==='STAGE_2A_CORRECTIVE_CLIENT_CHAT_V3_STATIC_OWNER','ADMIN_RADIO_STATIC_OWNER_MARKER_MISSING');assert(state.operational==='STAGE_2A_OPERATIONAL_CLIENT_AGENT_MESSAGE_V1','ADMIN_RADIO_OPERATIONAL_OWNER_MISSING');
  assert(JSON.stringify(state.kind)===JSON.stringify(['MESSAGE','NOTIFICATION','ANNOUNCEMENT']),'RADIO_KIND_OPTIONS_CHANGED');assert(state.rootKind==='radio'&&state.finalV9==='1'&&Object.values(state.dom).every(Boolean),'ADMIN_RADIO_VISUAL_FREEZE_CHANGED');
  const av=await agentAPage.evaluate(()=>{const p=document.getElementById('page-messages');return{head:Boolean(p?.querySelector('.page-head')),card:Boolean(p?.querySelector('.card')),selects:p?.querySelectorAll('select').length||0,inputs:p?.querySelectorAll('input').length||0,textareas:p?.querySelectorAll('textarea').length||0,buttons:p?.querySelectorAll('.actions .btn').length||0,panels:p?.querySelectorAll('.panel').length||0,bridge:window.__RONA_AGENT_MESSAGE_BRIDGE_V1__||null}});
  assert(av.head&&av.card&&av.selects===1&&av.inputs===1&&av.textareas===1&&av.buttons===1&&av.panels>=1,'AGENT_MESSAGES_VISUAL_GEOMETRY_CHANGED');assert(av.bridge==='AGENT_ADMIN_CANONICAL_MESSAGE_V1','AGENT_MESSAGE_BRIDGE_MISSING');
  proof.visual={visualDelta:0,adminRadio:state,agentMessages:av};
  proof.assets={client:await liveBlob('/assets/portal-runtime/client-messages-archive-v1.js',VISUAL.client),adminFinal:await liveBlob('/assets/portal-admin-radio-final-v9.js',VISUAL.adminFinal),adminWide:await liveBlob('/assets/portal-admin-radio-wide-v10.js',VISUAL.adminWide)};

  return{adminClientEvent,clientEventId:clientEvent.event_id,adminAgentEvent,agentEventId:agentEvent.eventId};
}
