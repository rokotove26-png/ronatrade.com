import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const ORIGIN=String(process.env.TARGET_ORIGIN||'').replace(/\/$/,'');
const HEAD=String(process.env.EXPECTED_HEAD||'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-issue430-owner-uat-browser-v2';
const C005_USER='724ff368-5ba3-449a-bd19-665ee487ee6f';
const MULTI_USER='65d78d10-3722-4dba-9d77-8252e7c62527';
const DIRECTORY_SOURCE='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB';
const C005={client_id:'RONA-C005',contract_id:'RONA-C005-CTR-2026-001',deal_id:'DEAL-2026-009'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const closeRect=(a,b,t=1.5)=>['x','y','width','height'].every(k=>Math.abs(Number(a?.[k])-Number(b?.[k]))<=t);
if(!/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i.test(ORIGIN))throw new Error(`IMMUTABLE_PREVIEW_REQUIRED:${ORIGIN}`);
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('EXACT_HEAD_REQUIRED');

async function oidc(){
  const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');
  const url=base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE);
  const r=await fetch(url,{headers:{authorization:`Bearer ${token}`}}),j=await r.json().catch(()=>null);
  if(!r.ok||!j?.value)throw new Error(`GITHUB_OIDC_${r.status}`);
  return j.value;
}
async function issuerCall(path,body,{waitForActive=false}={}){
  let last='';
  for(let attempt=0;attempt<(waitForActive?60:1);attempt++){
    const jwt=await oidc();
    const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
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
  return{accessToken:j.access_token,sessionId:j.session_id,authUserId:j.auth_user_id,portalUserId};
}
async function revokeSession(s){
  const j=await issuerCall('/revoke',{accessToken:s.accessToken,sessionId:s.sessionId,authUserId:s.authUserId});
  assert(j.revoked===true&&j.session_absent===true,'QA_SESSION_REVOKE_NOT_PROVEN');
  return{portalUserId:s.portalUserId,revoked:true,sessionAbsent:true};
}
async function authenticatedContext(browser,session){
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:session.accessToken,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  return context;
}
function captureRuntime(page,bucket){
  page.on('console',msg=>{if(msg.type()==='error')bucket.push({kind:'console',text:msg.text().slice(0,500)})});
  page.on('pageerror',error=>bucket.push({kind:'pageerror',text:String(error?.message||error).slice(0,500)}));
}
async function waitVisible(page,selector,timeout=20000){const loc=page.locator(selector).first();await loc.waitFor({state:'visible',timeout});return loc}
async function waitForEval(page,fn,arg,label,timeout=30000){
  const started=Date.now();let lastError='';
  while(Date.now()-started<timeout){
    try{const value=await page.evaluate(fn,arg);if(value)return value}catch(error){lastError=String(error?.message||error)}
    await sleep(50);
  }
  throw new Error(`${label}_TIMEOUT${lastError?`:${lastError}`:''}`);
}
async function companySnapshot(page,clientId,contractId){
  return page.evaluate(({clientId,contractId})=>{
    const card=[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].find(c=>c.dataset.ronaClientId===clientId&&c.dataset.ronaClientContractId===contractId);
    if(!card)return null;
    const r=card.getBoundingClientRect(),slot=n=>card.querySelector(`[data-rona-company-factory-slot="${n}"]`)?.textContent?.trim()||null,action=card.querySelector('[data-rona-company-factory-slot="action"]');
    return{hydration:card.dataset.ronaCompanyDirectoryHydration||null,current:card.dataset.ronaCompanyCurrent||null,applications:slot('applications'),deals:slot('deals'),documents:slot('documents'),action:action?.textContent?.trim()||null,rect:{x:r.x,y:r.y,width:r.width,height:r.height},text:(card.innerText||'').replace(/\s+/g,' ').trim()};
  },{clientId,contractId});
}
async function waitCompanyReady(page,target,timeout=30000){
  await waitForEval(page,({clientId,contractId})=>[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].some(c=>c.dataset.ronaClientId===clientId&&c.dataset.ronaClientContractId===contractId&&c.dataset.ronaCompanyDirectoryHydration==='ready'),target,'COMPANY_READY',timeout);
  return companySnapshot(page,target.client_id,target.contract_id);
}
async function activateCompanies(page){
  const selector='#nav button[data-page="companies"]';
  const before=await page.evaluate(()=>{
    const target=document.querySelector('#nav button[data-page="companies"]'),section=document.getElementById('page-companies'),grid=document.getElementById('clientCompanyGrid');
    const visible=e=>{if(!e||!e.isConnected||e.hidden)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
    return{tag:target?.tagName||null,dataPage:target?.getAttribute('data-page')||null,label:(target?.querySelector('.nav-label')?.textContent||target?.textContent||'').replace(/\s+/g,' ').trim(),targetVisible:visible(target),targetActive:target?.classList.contains('active')||false,targetAriaCurrent:target?.getAttribute('aria-current')||null,sectionExists:Boolean(section),sectionActive:section?.classList.contains('active')||false,sectionVisible:visible(section),gridExists:Boolean(grid),gridVisible:visible(grid)};
  });
  assert(before.tag==='BUTTON'&&before.dataPage==='companies','CANONICAL_COMPANIES_NAV_TARGET_CONTRACT_MISMATCH');
  assert(before.label==='Мои компании','CANONICAL_COMPANIES_NAV_LABEL_MISMATCH');
  assert(before.sectionExists&&before.gridExists,'CANONICAL_COMPANIES_SECTION_CONTRACT_MISSING');
  await waitVisible(page,selector);
  await page.locator(selector).click();
  await waitForEval(page,()=>{
    const target=document.querySelector('#nav button[data-page="companies"]'),section=document.getElementById('page-companies'),grid=document.getElementById('clientCompanyGrid');
    const visible=e=>{if(!e||!e.isConnected||e.hidden)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
    return Boolean(target?.classList.contains('active')&&target?.getAttribute('aria-current')==='page'&&section?.classList.contains('active')&&visible(section)&&visible(grid));
  },null,'CANONICAL_COMPANIES_NAV_ACTIVATION',10000);
  const after=await page.evaluate(()=>{
    const target=document.querySelector('#nav button[data-page="companies"]'),section=document.getElementById('page-companies'),grid=document.getElementById('clientCompanyGrid');
    const visible=e=>{if(!e||!e.isConnected||e.hidden)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
    return{targetActive:target?.classList.contains('active')||false,targetAriaCurrent:target?.getAttribute('aria-current')||null,sectionActive:section?.classList.contains('active')||false,sectionVisible:visible(section),gridVisible:visible(grid)};
  });
  assert(after.targetActive&&after.targetAriaCurrent==='page'&&after.sectionActive&&after.sectionVisible&&after.gridVisible,'CANONICAL_COMPANIES_NAV_ACTIVATION_FAILED');
  console.log(`ISSUE430_CANONICAL_COMPANIES_NAV_TARGET=PASS selector=${selector} label=${before.label} section=#page-companies grid=#clientCompanyGrid`);
  console.log('ISSUE430_CANONICAL_COMPANIES_NAV_ACTIVATION=PASS');
  return{selector,before,after};
}
async function refreshCanonicalDirectory(page,source,expectedCount){
  const eventBaseline=await page.evaluate(()=>{
    const key='__ronaIssue430AuthorizedDirectoryEvents';
    if(!window[key]){
      const state={count:0};
      window[key]=state;
      window.addEventListener('rona:client-authorized-directory',()=>{state.count+=1});
    }
    return window[key].count;
  });
  const result=await page.evaluate(async({source})=>{
    const api=window.RONA_CLIENT_CONTEXT;
    if(!api?.refreshCompanyDirectory)throw new Error('CANONICAL_COMPANY_DIRECTORY_REFRESH_API_MISSING');
    const payload=await api.refreshCompanyDirectory(source);
    return{source:payload?.data?.company_directory_source||null,count:Array.isArray(payload?.data?.company_directory)?payload.data.company_directory.length:null};
  },{source});
  await page.waitForFunction(baseline=>(window.__ronaIssue430AuthorizedDirectoryEvents?.count||0)>baseline,eventBaseline,{timeout:30000});
  assert(result?.source===DIRECTORY_SOURCE,`CANONICAL_DIRECTORY_SOURCE_MISMATCH:${JSON.stringify(result)}`);
  assert(result?.count===expectedCount,`CANONICAL_DIRECTORY_COUNT_MISMATCH:${JSON.stringify(result)}`);
  return result;
}
async function stateProof(page){
  return page.evaluate(async target=>{
    const u=`/portal/api/v1/client/deal-documents/state?clientId=${encodeURIComponent(target.client_id)}&contractId=${encodeURIComponent(target.contract_id)}&_qa=${Date.now()}`;
    const r=await fetch(u,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}}),body=await r.json().catch(()=>null);
    return{status:r.status,authority:r.headers.get('x-rona-resource-authority'),composition:r.headers.get('x-rona-workflow-composition'),body};
  },C005);
}
function resourceFromState(state){const row=(state?.body?.deals||[]).find(d=>norm(d?.deal_id)===C005.deal_id),stage=(row?.realization_status?.stages||[]).find(s=>norm(s?.key)==='resource');return{row,stage}}
async function activateDeals(page){
  const selector='#nav button[data-page="deals"]';
  const target=await page.evaluate(()=>{const e=document.querySelector('#nav button[data-page="deals"]');return{tag:e?.tagName||null,dataPage:e?.getAttribute('data-page')||null,label:(e?.querySelector('.nav-label')?.textContent||e?.textContent||'').replace(/\s+/g,' ').trim()}});
  assert(target.tag==='BUTTON'&&target.dataPage==='deals'&&target.label==='Сделки','CANONICAL_DEALS_NAV_TARGET_MISMATCH');
  await waitVisible(page,selector);await page.locator(selector).click();
  await waitForEval(page,()=>{const target=document.querySelector('#nav button[data-page="deals"]'),section=document.getElementById('page-deals');if(!target||!section)return false;const s=getComputedStyle(section),r=section.getBoundingClientRect();return target.classList.contains('active')&&target.getAttribute('aria-current')==='page'&&section.classList.contains('active')&&!section.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0},null,'CANONICAL_DEALS_NAV_ACTIVATION',10000);
}
async function passportProof(page){
  await activateDeals(page);
  const open=page.locator(`[data-open-deal="${C005.deal_id}"]`).first();await open.waitFor({state:'visible',timeout:30000});await open.click();
  await waitForEval(page,id=>[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].some(d=>{const r=d.getBoundingClientRect(),s=getComputedStyle(d);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&d.dataset.ronaAuthoritativeDealId===id&&d.dataset.ronaAuthoritativeBinding==='authoritative-binding'}),C005.deal_id,'PASSPORT_AUTHORITATIVE_BINDING',30000);
  return page.evaluate(id=>{
    const d=[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].find(x=>x.dataset.ronaAuthoritativeDealId===id&&x.dataset.ronaAuthoritativeBinding==='authoritative-binding');if(!d)return null;
    const field=d.querySelector('[data-rona-command-field="resource"]'),value=field?.querySelector('[data-rona-command-field-value]'),flow=d.querySelector('#rona-deal-realization-flow-v3'),resourceItem=flow?[...flow.querySelectorAll('.rona-deal-lifecycle-v1__item')].find(x=>(x.innerText||'').includes('Подтверждение ресурса')):null;
    return{resourceText:(value?.textContent||'').trim(),resourceStatus:field?.dataset.ronaResourceStatus||null,resourceAuthority:field?.dataset.ronaResourceAuthority||null,timelineText:(resourceItem?.innerText||'').replace(/\s+/g,' ').trim(),binding:d.dataset.ronaAuthoritativeBinding||null};
  },C005.deal_id);
}
async function c005Acceptance(browser,proof){
  const session=await issueSession(C005_USER);proof.sessions.push({portalUserId:C005_USER,issued:true});let context;
  try{
    context=await authenticatedContext(browser,session);const page=await context.newPage();captureRuntime(page,proof.runtimeErrors.c005);
    let delayedBootstrap=true,delayedContext=true;
    await page.route('**/portal/api/v1/client/bootstrap**',async route=>{if(delayedBootstrap){delayedBootstrap=false;await sleep(900)}await route.continue()});
    await page.route('**/portal/api/v1/client/context**',async route=>{if(delayedContext){delayedContext=false;await sleep(700)}await route.continue()});
    await page.goto(ORIGIN+'/portal/client?_qa_head='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});
    proof.navigation=await activateCompanies(page);
    await waitVisible(page,'#clientCompanyGrid article.company-switch-card');
    await waitForEval(page,()=>Boolean(document.querySelector('#clientCompanyGrid article.company-switch-card[data-rona-company-directory-hydration="loading"],#clientCompanyGrid article.company-switch-card[data-rona-company-directory-hydration="error"]')),null,'C005_PENDING_SHELL',15000);
    const pending=await companySnapshot(page,C005.client_id,C005.contract_id);assert(pending,'C005_PENDING_CARD_MISSING');
    assert(['…','1'].includes(pending.applications)&&['…','1'].includes(pending.deals)&&['…','3'].includes(pending.documents),'C005_PENDING_METRICS_INVALID');
    assert(!pending.text.includes('---'),'C005_LEGACY_TRIPLE_DASH_VISIBLE');
    const firstRect=pending.rect;
    const recovery=await refreshCanonicalDirectory(page,'issue430-owner-browser-delayed-recovery',1);
    const ready=await waitCompanyReady(page,C005,30000);
    assert(ready.applications==='1'&&ready.deals==='1'&&ready.documents==='3',`C005_KPI_MISMATCH:${JSON.stringify(ready)}`);
    assert(!ready.text.includes('---'),'C005_PERMANENT_TRIPLE_DASH');
    assert(closeRect(firstRect,ready.rect),`C005_CARD_JUMP:${JSON.stringify({first:firstRect,ready:ready.rect})}`);
    const state=await stateProof(page),rs=resourceFromState(state);
    assert(state.status===200,'STATE_ROUTE_HTTP_'+state.status);assert(state.authority==='PORTAL_CONTEXT_CANONICAL_RESOURCE_V1','STATE_RESOURCE_AUTHORITY_HEADER');assert(rs.row?.resource_status==='RESOURCE_CONFIRMED','STATE_RESOURCE_NOT_CONFIRMED');assert(rs.row?.resource_source==='OWNER_APPLICATION_WORKFLOW','STATE_RESOURCE_SOURCE_MISMATCH');assert(rs.stage?.state==='DONE'&&/подтвержд/iu.test(norm(rs.stage?.detail)),'STATE_TIMELINE_RESOURCE_NOT_DONE');
    const passport=await passportProof(page);assert(passport?.resourceStatus==='RESOURCE_CONFIRMED','PASSPORT_RESOURCE_STATUS_MISMATCH');assert(/ресурс подтвержд/iu.test(passport?.resourceText||''),'PASSPORT_RESOURCE_TEXT_MISMATCH');assert(/подтверждение ресурса/iu.test(passport?.timelineText||'')&&/выполнено/iu.test(passport.timelineText),'PASSPORT_TIMELINE_NOT_DONE');
    delayedBootstrap=true;delayedContext=true;await page.reload({waitUntil:'domcontentloaded',timeout:30000});await activateCompanies(page);
    await waitVisible(page,'#clientCompanyGrid article.company-switch-card');
    const hardRecovery=await refreshCanonicalDirectory(page,'issue430-owner-browser-hard-refresh',1);
    const hard=await waitCompanyReady(page,C005,30000);assert(hard.applications==='1'&&hard.deals==='1'&&hard.documents==='3','HARD_REFRESH_KPI_MISMATCH');
    const hardState=resourceFromState(await stateProof(page));assert(hardState.row?.resource_status==='RESOURCE_CONFIRMED'&&hardState.stage?.state==='DONE','HARD_REFRESH_RESOURCE_MISMATCH');
    proof.c005={pending,ready,recovery,state:{status:state.status,authority:state.authority,composition:state.composition,resource_status:rs.row.resource_status,resource_source:rs.row.resource_source,resource_stage:rs.stage.state},passport,hardRefresh:{metrics:[hard.applications,hard.deals,hard.documents],resource_status:hardState.row.resource_status,resource_stage:hardState.stage.state,recovery:hardRecovery},delayedRecovery:true};
  }finally{
    if(context)await context.close().catch(()=>{});const revoked=await revokeSession(session);proof.cleanup.push(revoked);
  }
}
async function multiContextAcceptance(browser,proof){
  const session=await issueSession(MULTI_USER);proof.sessions.push({portalUserId:MULTI_USER,issued:true});let context;
  try{
    context=await authenticatedContext(browser,session);const page=await context.newPage();captureRuntime(page,proof.runtimeErrors.multi);
    await page.goto(ORIGIN+'/portal/client?_qa_multi='+HEAD,{waitUntil:'domcontentloaded',timeout:30000});await activateCompanies(page);await waitVisible(page,'#clientCompanyGrid article.company-switch-card');
    const recovery=await refreshCanonicalDirectory(page,'issue430-owner-browser-multi-context',2);
    await waitForEval(page,()=>document.querySelectorAll('#clientCompanyGrid article.company-switch-card[data-rona-company-directory-hydration="ready"]').length===2,null,'MULTI_COMPANY_READY',30000);
    const initial=await page.evaluate(()=>{const a=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();return{current:a,cards:[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card[data-rona-company-directory-hydration="ready"]')].map(c=>({client_id:c.dataset.ronaClientId,contract_id:c.dataset.ronaClientContractId,current:c.dataset.ronaCompanyCurrent,action:c.querySelector('[data-rona-company-factory-slot="action"]')?.textContent?.trim()}))}});
    assert(initial.current?.client_id&&initial.current?.contract_id,'MULTI_INITIAL_CONTEXT_MISSING');const A={client_id:initial.current.client_id,contract_id:initial.current.contract_id},B=initial.cards.find(c=>c.client_id!==A.client_id||c.contract_id!==A.contract_id);assert(B,'MULTI_SECOND_CONTEXT_MISSING');
    const clickContext=async target=>{
      await page.evaluate(t=>{const card=[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].find(c=>c.dataset.ronaClientId===t.client_id&&c.dataset.ronaClientContractId===t.contract_id),b=card?.querySelector('[data-rona-company-factory-slot="action"]');if(!b)throw new Error('COMPANY_ACTION_MISSING');b.click()},target);
      await waitForEval(page,t=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();return c?.client_id===t.client_id&&c?.contract_id===t.contract_id},target,'CONTEXT_SWITCH',20000);
      await waitForEval(page,t=>[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].some(c=>c.dataset.ronaClientId===t.client_id&&c.dataset.ronaClientContractId===t.contract_id&&c.dataset.ronaCompanyCurrent==='true'),target,'CURRENT_MARKER',20000);
      return page.evaluate(t=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.(),p=window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.(),visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return !e.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const currentCards=[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].filter(x=>x.dataset.ronaCompanyCurrent==='true').map(x=>x.dataset.ronaClientId+'|'+x.dataset.ronaClientContractId),foreign=[...document.querySelectorAll('[data-rona-authoritative-context]')].filter(visible).map(x=>x.getAttribute('data-rona-authoritative-context')).filter(Boolean).filter(k=>k!==t.client_id+'|'+t.contract_id);return{current:c,projection:{client_id:p?.contract?.client_id,contract_id:p?.contract?.contract_id},currentCards,foreign}},target);
    };
    const afterB=await clickContext(B);assert(afterB.currentCards.length===1&&afterB.currentCards[0]===B.client_id+'|'+B.contract_id,'B_CURRENT_MARKER_INVALID');assert(afterB.projection.client_id===B.client_id&&afterB.projection.contract_id===B.contract_id,'B_PROJECTION_SCOPE_MISMATCH');assert(afterB.foreign.length===0,'B_FOREIGN_CONTEXT_VISIBLE');
    const afterA=await clickContext(A);assert(afterA.currentCards.length===1&&afterA.currentCards[0]===A.client_id+'|'+A.contract_id,'A_CURRENT_MARKER_INVALID');assert(afterA.projection.client_id===A.client_id&&afterA.projection.contract_id===A.contract_id,'A_PROJECTION_SCOPE_MISMATCH');assert(afterA.foreign.length===0,'A_FOREIGN_CONTEXT_VISIBLE');
    proof.multi={recovery,A,B,afterB,afterA};
  }finally{
    if(context)await context.close().catch(()=>{});const revoked=await revokeSession(session);proof.cleanup.push(revoked);
  }
}

const browser=await chromium.launch({headless:true});
const proof={suite:'ISSUE430_OWNER_AUTHORIZED_BROWSER_V4',head:HEAD,origin:ORIGIN,sessions:[],cleanup:[],runtimeErrors:{c005:[],multi:[]},navigation:null,c005:null,multi:null};
try{
  await c005Acceptance(browser,proof);await multiContextAcceptance(browser,proof);
  assert(proof.cleanup.length===2&&proof.cleanup.every(x=>x.revoked&&x.sessionAbsent),'QA_SESSION_CLEANUP_INCOMPLETE');
  proof.pass=true;await writeFile('issue430-owner-authorized-browser-proof.json',JSON.stringify(proof,null,2));
  console.log('ISSUE430_AUTHORIZED_BROWSER_PROOF=PASS');
  console.log('RESOURCE_PASSPORT_TIMELINE=PASS');
  console.log('COMPANY_KPI_1_1_3=PASS');
  console.log('COMPANY_CARD_GEOMETRY_STABLE=PASS');
  console.log('COLD_LOAD=PASS');
  console.log('HARD_REFRESH=PASS');
  console.log('DELAYED_RECOVERY=PASS');
  console.log('A_B_A_CONTEXT_ISOLATION=PASS');
  console.log('QA_SESSION_CLEANUP=PASS');
}finally{await browser.close().catch(()=>{})}
