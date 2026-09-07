import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const REPO=process.env.GITHUB_REPOSITORY||'rokotove26-png/ronatrade.com';
const HEAD=String(process.env.RONA_EXACT_HEAD||process.env.GITHUB_SHA||'').trim();
const GH_TOKEN=String(process.env.RONA_GITHUB_TOKEN||'').trim();
const PR_NUMBER=String(process.env.RONA_PR_NUMBER||'431').trim();
const ISSUER=String(process.env.RONA_QA_ISSUER_URL||'https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-pr431-client-session-qa-20260907').trim();
const OIDC_AUDIENCE=String(process.env.RONA_OIDC_AUDIENCE||'rona-pr431-client-qa').trim();
const EXPECTED_BACKEND='PR429_EXISTING_CANDIDATE_SLOT';
const ARTIFACT='issue430-real-authenticated-candidate-proof.json';
const CONTRACT_RUNTIME_SRC='/assets/portal-runtime/client-contract-download-v3.js?v=20260906-company-directory-authoritative-metrics-v11';
const CONTRACT_RUNTIME_MARK='20260906-client-contract-v11-authoritative-company-metrics';
const IMMUTABLE_ORIGIN_RE=/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i;
const CF_DEPLOYMENT_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('EXACT_HEAD_REQUIRED');
if(!GH_TOKEN)throw new Error('GITHUB_TOKEN_REQUIRED');
if(!/^\d+$/.test(PR_NUMBER))throw new Error('PR_NUMBER_REQUIRED');
if(!ISSUER.startsWith('https://'))throw new Error('QA_ISSUER_URL_REQUIRED');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const compact=v=>String(v??'').replace(/\s+/gu,'').toUpperCase();
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
const safeUrl=u=>{const x=new URL(u);return `${x.pathname}${x.search}`};
async function waitEvaluate(page,predicate,arg,timeout,label){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){
    if(await page.evaluate(predicate,arg).catch(()=>false))return;
    await sleep(100);
  }
  throw new Error(`${label}_TIMEOUT`);
}

async function githubJson(path){
  const headers={accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',authorization:`Bearer ${GH_TOKEN}`};
  const r=await fetch(`https://api.github.com/repos/${REPO}${path}`,{headers});
  if(!r.ok)throw new Error(`GITHUB_HTTP_${r.status}`);
  return r.json();
}
function previewUrls(text){return[...new Set([...String(text||'').matchAll(/https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev/ig)].map(m=>m[0].toLowerCase()))]}
function deploymentFromCheck(run){
  if(run?.app?.slug!=='cloudflare-workers-and-pages')return null;
  const externalId=String(run?.external_id||'').trim().toLowerCase();
  if(!CF_DEPLOYMENT_ID_RE.test(externalId))return null;
  let details;try{details=new URL(String(run?.details_url||''))}catch{return null}
  if(details.origin!=='https://dash.cloudflare.com')return null;
  const target=String(details.searchParams.get('to')||'');
  const match=/^\/[0-9a-f]{32}\/pages\/view\/rona-trade-public\/([0-9a-f-]{36})$/i.exec(target);
  if(!match||match[1].toLowerCase()!==externalId)return null;
  const origin=`https://${externalId.slice(0,8)}.rona-trade-public.pages.dev`;
  return IMMUTABLE_ORIGIN_RE.test(origin)?{origin,externalId}:null;
}
async function verifyImmutablePreview(origin){
  if(!IMMUTABLE_ORIGIN_RE.test(origin))throw new Error('IMMUTABLE_PREVIEW_ORIGIN_INVALID');
  const integrityUrl=new URL('/canonical-visual-integrity.json',origin);integrityUrl.searchParams.set('_qa_head',HEAD);integrityUrl.searchParams.set('_qa_nonce',String(Date.now()));
  const integrityResponse=await fetch(integrityUrl,{cache:'no-store',redirect:'error',headers:{'cache-control':'no-cache'}});
  if(!integrityResponse.ok)throw new Error(`IMMUTABLE_PREVIEW_INTEGRITY_HTTP_${integrityResponse.status}`);
  const integrity=await integrityResponse.json().catch(()=>null),client=integrity?.client_runtime||{};
  if(integrity?.architecture!=='CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS')throw new Error('IMMUTABLE_PREVIEW_ARCHITECTURE_MISMATCH');
  if(client?.state!=='CURRENT_ONLY'||client?.legacy_runtime_in_deployment!==false)throw new Error('IMMUTABLE_PREVIEW_CLIENT_STATE_MISMATCH');
  if(client?.functional_bridge?.src!==CONTRACT_RUNTIME_SRC)throw new Error(`IMMUTABLE_PREVIEW_BRIDGE_SRC_MISMATCH_${String(client?.functional_bridge?.src||'MISSING')}`);
  const assetUrl=new URL(`${origin}${CONTRACT_RUNTIME_SRC}`);assetUrl.searchParams.set('_qa_head',HEAD);assetUrl.searchParams.set('_qa_nonce',String(Date.now()));
  const assetResponse=await fetch(assetUrl,{cache:'no-store',redirect:'error',headers:{'cache-control':'no-cache'}});
  if(!assetResponse.ok)throw new Error(`IMMUTABLE_PREVIEW_CLIENT_ASSET_HTTP_${assetResponse.status}`);
  const text=await assetResponse.text();
  for(const marker of [CONTRACT_RUNTIME_MARK,"authority.whenCurrentProjection('client-contract-download-v3')","authoritative?.source==='AUTHORITATIVE_CURRENT_CONTEXT_DB'","authoritative?.documents_predicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'","source:'AUTHORITATIVE_METRICS_UNAVAILABLE'","value==null?'—':String(value)"])if(!text.includes(marker))throw new Error(`IMMUTABLE_PREVIEW_CLIENT_ASSET_MARKER_MISSING_${marker}`);
  if(text.includes("request('/v1/client/context?clientId='"))throw new Error('IMMUTABLE_PREVIEW_DIRECT_CONTEXT_FETCH_PRESENT');
  return{architecture:integrity.architecture,client_state:client.state,source_sha256:client.source_sha256||null,source_bytes:client.source_bytes??null,asset:CONTRACT_RUNTIME_SRC};
}
async function exactPreview(){
  let lastError=null;
  for(let attempt=0;attempt<72;attempt++){
    const data=await githubJson(`/commits/${HEAD}/check-runs?per_page=100`);
    const runs=Array.isArray(data?.check_runs)?data.check_runs:[];
    const run=runs.find(x=>x?.name==='Cloudflare Pages'&&x?.head_sha===HEAD&&x?.status==='completed'&&x?.conclusion==='success'&&x?.app?.slug==='cloudflare-workers-and-pages');
    if(run){
      const deployment=deploymentFromCheck(run),outputUrls=previewUrls(run?.output?.summary),candidates=[];
      if(outputUrls.length>1)lastError=new Error('CLOUDFLARE_CHECK_MULTIPLE_IMMUTABLE_URLS');
      if(outputUrls.length===1)candidates.push({origin:outputUrls[0],source:'CHECK_OUTPUT'});
      if(deployment&&outputUrls.length===1&&outputUrls[0]!==deployment.origin)throw new Error('CLOUDFLARE_CHECK_IDENTITY_MISMATCH');
      if(deployment&&!candidates.some(x=>x.origin===deployment.origin))candidates.push({origin:deployment.origin,source:'CHECK_EXTERNAL_ID'});
      for(const candidate of candidates){try{const verification=await verifyImmutablePreview(candidate.origin);return{origin:candidate.origin,check_run_id:run.id,external_id:deployment?.externalId||String(run.external_id||''),source:candidate.source,verification}}catch(error){lastError=error}}
    }
    await sleep(5000);
  }
  throw new Error(`EXACT_HEAD_CLOUDFLARE_PREVIEW_NOT_READY${lastError?`_${lastError.message}`:''}`);
}
async function oidcToken(){
  const base=String(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||'');
  const bearer=String(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'');
  if(!base||!bearer)throw new Error('GITHUB_OIDC_ENV_REQUIRED');
  const u=new URL(base);u.searchParams.set('audience',OIDC_AUDIENCE);
  const r=await fetch(u,{headers:{authorization:`Bearer ${bearer}`,accept:'application/json'}});
  const body=await r.json().catch(()=>null);
  if(!r.ok||!body?.value)throw new Error(`GITHUB_OIDC_HTTP_${r.status}`);
  return String(body.value);
}
async function issueSession(oidc,target){
  const r=await fetch(ISSUER,{method:'POST',headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({clientId:target.clientId,contractId:target.contractId})});
  const body=await r.json().catch(()=>null);
  if(!r.ok||body?.ok!==true||!body?.access_token||!body?.refresh_token)throw new Error(`QA_SESSION_ISSUER_${target.key}_HTTP_${r.status}_${String(body?.code||'INVALID_RESPONSE')}`);
  const access=String(body.access_token),refresh=String(body.refresh_token);
  console.log(`::add-mask::${access}`);console.log(`::add-mask::${refresh}`);
  return{access,refresh};
}
async function cleanupSession(oidc,target,session){
  const endpoint=`${ISSUER.replace(/\/+$/,'')}/cleanup`;
  const r=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({clientId:target.clientId,contractId:target.contractId,accessToken:session.access})});
  const body=await r.json().catch(()=>null);
  if(!r.ok||body?.ok!==true||body?.cleanup!=='REVOKED')throw new Error(`QA_SESSION_CLEANUP_${target.key}_HTTP_${r.status}_${String(body?.code||'INVALID_RESPONSE')}`);
  return{revoked:true};
}
function targetDealFromPayload(payload,dealId){
  const deals=Array.isArray(payload?.data?.deals)?payload.data.deals:[];
  return deals.find(d=>String(d?.deal_id||'')===dealId)||null;
}
function sanitizedApi(responseBody,response,target){
  const deal=target.dealId?targetDealFromPayload(responseBody,target.dealId):null;
  const metrics=responseBody?.data?.company_metrics||null;
  const contract=responseBody?.data?.contract||null;
  return{
    request_path:safeUrl(response.url()),http_status:response.status(),
    backend_header:response.headers()['x-rona-client-context-backend']||null,
    client_id:String(contract?.client_id||''),contract_id:String(contract?.contract_id||''),
    deal:deal?{deal_id:String(deal.deal_id||''),passport_amount:deal.passport_amount??null,passport_currency:String(deal.passport_currency||''),passport_amount_source:String(deal.passport_amount_source||''),passport_application_id:String(deal.passport_application_id||'')}:null,
    company_metrics:metrics?{applications_total:metrics.applications_total??null,deals_total:metrics.deals_total??null,documents_total:metrics.documents_total??null,source:String(metrics.source||''),documents_predicate:String(metrics.documents_predicate||'')}:null
  };
}
async function nav(page,name){
  const selector=`#nav [data-page="${name}"],[data-rona-client-nav] [data-page="${name}"],nav [data-page="${name}"]`;
  const b=page.locator(selector).first();await b.waitFor({state:'visible',timeout:10000});await b.click();
}
async function ensureExactContext(page,target){
  await waitEvaluate(page,()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady&&window.RONA_CLIENT_CONTEXT?.getCurrentContext),null,15000,'CLIENT_CONTEXT_AUTHORITY_READY');
  await page.evaluate(async t=>{const a=window.RONA_CLIENT_CONTEXT;await a.whenReady();const c=a.getCurrentContext?.();if(!c||String(c.client_id)!==t.clientId||String(c.contract_id)!==t.contractId)await a.select(t.clientId,t.contractId);},target);
  await waitEvaluate(page,t=>{const a=window.RONA_CLIENT_CONTEXT,c=a?.getCurrentContext?.(),p=a?.getCurrentProjection?.();return String(c?.client_id||'')===t.clientId&&String(c?.contract_id||'')===t.contractId&&String(p?.contract?.client_id||'')===t.clientId&&String(p?.contract?.contract_id||'')===t.contractId;},target,20000,'CLIENT_CONTEXT_PROJECTION_READY');
}
async function dealDomProof(page,target,expectedAmount){
  await nav(page,'deals');
  const card=page.locator(`[data-rona-canonical-deal-id="${target.dealId}"]`).first();
  await card.waitFor({state:'visible',timeout:15000});
  const cardText=norm(await card.innerText());
  if(!compact(cardText).includes(`${expectedAmount}USD`))throw new Error(`${target.key}_DEAL_CARD_AMOUNT_NOT_RENDERED`);
  const open=card.locator(`[data-open-deal="${target.dealId}"]`).first();
  await open.waitFor({state:'visible',timeout:5000});await open.click();
  const drawer=page.locator('.rona-deal-command-center-v3:visible,[data-rona-deal-passport]:visible').filter({hasText:'Паспорт сделки'}).first();
  await drawer.waitFor({state:'visible',timeout:10000});
  const amountSlot=drawer.locator('[data-rona-command-field="amount"] [data-rona-command-field-value]').first();
  await amountSlot.waitFor({state:'visible',timeout:10000});
  const passportAmount=norm(await amountSlot.innerText());
  if(!compact(passportAmount).includes(`${expectedAmount}USD`))throw new Error(`${target.key}_PASSPORT_AMOUNT_NOT_RENDERED`);
  const drawerText=norm(await drawer.innerText());
  if(!drawerText.includes(target.dealId))throw new Error(`${target.key}_PASSPORT_DEAL_ID_MISMATCH`);
  return{deal_card_amount:`${expectedAmount} USD`,passport_amount:`${expectedAmount} USD`,card_contains_target_deal:true,passport_contains_target_deal:true};
}
async function companyMetrics(page,target){
  await nav(page,'companies');
  const card=page.locator(`[data-rona-client-id="${target.clientId}"][data-rona-client-contract-id="${target.contractId}"]`).first();
  await card.waitFor({state:'visible',timeout:10000});
  await waitEvaluate(page,t=>{const c=document.querySelector(`[data-rona-client-id="${t.clientId}"][data-rona-client-contract-id="${t.contractId}"]`);return c?.dataset?.ronaCompanyDirectoryHydration==='ready'&&c?.dataset?.ronaCompanyDirectorySource==='AUTHORITATIVE_CURRENT_CONTEXT_DB'&&c?.dataset?.ronaCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY';},target,15000,'COMPANY_METRICS_READY');
  return page.evaluate(t=>{const n=v=>String(v??'').replace(/\s+/g,' ').trim(),low=v=>n(v).toLocaleLowerCase('ru-RU');const card=document.querySelector(`[data-rona-client-id="${t.clientId}"][data-rona-client-contract-id="${t.contractId}"]`);function metric(label){const leaves=[...card.querySelectorAll('*')].filter(x=>x.childElementCount===0);const lab=leaves.find(x=>low(x.textContent)===label);if(!lab)return null;let box=lab.parentElement;for(let depth=0;box&&box!==card&&depth<4;depth++,box=box.parentElement){const value=[...box.querySelectorAll('*')].find(x=>x!==lab&&x.childElementCount===0&&/^(?:\d+|—)$/.test(n(x.textContent)));if(value)return n(value.textContent)}return null}return{applications:metric('заявок'),deals:metric('сделок'),documents:metric('документов'),hydration:card?.dataset?.ronaCompanyDirectoryHydration||'',source:card?.dataset?.ronaCompanyDirectorySource||'',predicate:card?.dataset?.ronaCompanyDirectoryDocumentsPredicate||''};},target);
}
async function pendingCompanyMetrics(page,target){
  await nav(page,'companies');
  const neutral=t=>{const n=v=>String(v??'').replace(/\s+/g,' ').trim(),low=v=>n(v).toLocaleLowerCase('ru-RU');const card=document.querySelector(`[data-rona-client-id="${t.clientId}"][data-rona-client-contract-id="${t.contractId}"]`);if(!card||card.dataset.ronaCompanyDirectoryHydration!=='pending')return false;function metric(label){const leaves=[...card.querySelectorAll('*')].filter(x=>x.childElementCount===0),lab=leaves.find(x=>low(x.textContent)===label);if(!lab)return null;let box=lab.parentElement;for(let d=0;box&&box!==card&&d<4;d++,box=box.parentElement){const v=[...box.querySelectorAll('*')].find(x=>x!==lab&&x.childElementCount===0&&/^(?:\d+|—)$/.test(n(x.textContent)));if(v)return n(v.textContent)}return null}return metric('заявок')==='—'&&metric('сделок')==='—'&&metric('документов')==='—'};
  await waitEvaluate(page,neutral,target,8000,'COMPANY_METRICS_PENDING_NEUTRAL');
  return page.evaluate(t=>{const n=v=>String(v??'').replace(/\s+/g,' ').trim(),low=v=>n(v).toLocaleLowerCase('ru-RU');const card=document.querySelector(`[data-rona-client-id="${t.clientId}"][data-rona-client-contract-id="${t.contractId}"]`);function metric(label){const leaves=[...card.querySelectorAll('*')].filter(x=>x.childElementCount===0),lab=leaves.find(x=>low(x.textContent)===label);if(!lab)return null;let box=lab.parentElement;for(let d=0;box&&box!==card&&d<4;d++,box=box.parentElement){const v=[...box.querySelectorAll('*')].find(x=>x!==lab&&x.childElementCount===0&&/^(?:\d+|—)$/.test(n(x.textContent)));if(v)return n(v.textContent)}return null}return{applications:metric('заявок'),deals:metric('сделок'),documents:metric('документов'),hydration:card?.dataset?.ronaCompanyDirectoryHydration||''};},target);
}
async function foreignDomProof(page,target,foreignIds){
  return page.evaluate(({target,foreignIds})=>{const seen=[...document.querySelectorAll('[data-rona-client-id]')].map(x=>String(x.getAttribute('data-rona-client-id')||'')).filter(Boolean);const body=String(document.body?.innerText||'');return{data_client_ids:[...new Set(seen)],foreign_data_attribute:seen.some(x=>x!==target.clientId),foreign_identifier_text:foreignIds.some(x=>body.includes(x))};},{target,foreignIds});
}

const preview=await exactPreview();
console.log(`IMMUTABLE_PREVIEW=${preview.origin}/portal/client source=${preview.source}`);
const oidc=await oidcToken();
const browser=await chromium.launch({headless:true});
const targets=[
  {key:'C002',clientId:'RONA-C002',contractId:'RONA-C002-CTR-2026-001',dealId:'DEAL-2026-004',amount:236250,currency:'USD',source:'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS',applicationId:'RONA-C002-IN-2026-001'},
  {key:'C003',clientId:'RONA-C003',contractId:'RONA-C003-CTR-2026-001'},
  {key:'C004',clientId:'RONA-C004',contractId:'RONA-C004-CTR-2026-001',dealId:'DEAL-2026-007',amount:113500,currency:'USD',source:'FINALIZED_APPLICATION_COMMERCIAL_TERMS',applicationId:'RONA-C004-IN-2026-004'}
];
const proof={schema:'ISSUE430_REAL_AUTHENTICATED_CANDIDATE_PROOF_V2',exact_head:HEAD,immutable_preview:`${preview.origin}/portal/client`,cloudflare_check_run_id:preview.check_run_id,cloudflare_external_id:preview.external_id,preview_source:preview.source,preview_verification:preview.verification,expected_candidate_boundary:EXPECTED_BACKEND,targets:{}};
try{
  for(const target of targets){
    const session=await issueSession(oidc,target);
    const host=new URL(preview.origin).hostname;
    const context=await browser.newContext();
    try{
      await context.addCookies([
        {name:'rona_portal_at',value:session.access,domain:host,path:'/portal',secure:true,httpOnly:true,sameSite:'Lax'},
        {name:'rona_portal_rt',value:session.refresh,domain:host,path:'/portal',secure:true,httpOnly:true,sameSite:'Lax'}
      ]);
      const page=await context.newPage();
      let apiEvidence=null,delayedResolve=null,delayed=false;
      const delayedStarted=new Promise(resolve=>{delayedResolve=resolve});
      if(target.key==='C003'){
        await page.route('**/portal/api/v1/client/context?*',async route=>{const u=new URL(route.request().url());if(!delayed&&u.searchParams.get('clientId')===target.clientId&&u.searchParams.get('contractId')===target.contractId){delayed=true;delayedResolve();await sleep(10000)}await route.continue()});
      }
      page.on('response',async response=>{try{const u=new URL(response.url());if(u.origin!==preview.origin||u.pathname!=='/portal/api/v1/client/context')return;if(u.searchParams.get('clientId')!==target.clientId||u.searchParams.get('contractId')!==target.contractId)return;const body=await response.json().catch(()=>null);if(body?.data?.contract?.client_id===target.clientId&&body?.data?.contract?.contract_id===target.contractId)apiEvidence=sanitizedApi(body,response,target)}catch{}});
      const navPromise=page.goto(`${preview.origin}/portal/client`,{waitUntil:'domcontentloaded',timeout:30000});
      if(target.key==='C003'){
        await navPromise;
        if(!page.url().startsWith(`${preview.origin}/portal/client`))throw new Error('C003_AUTHENTICATED_PORTAL_REDIRECTED');
        await waitEvaluate(page,()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady&&window.RONA_CLIENT_CONTEXT?.getCurrentContext),null,15000,'C003_CONTEXT_AUTHORITY_READY');
        await page.evaluate(async t=>{const a=window.RONA_CLIENT_CONTEXT;await a.whenReady();const c=a.getCurrentContext?.();if(!c||String(c.client_id)!==t.clientId||String(c.contract_id)!==t.contractId)a.select(t.clientId,t.contractId);},target);
        await Promise.race([delayedStarted,(async()=>{await sleep(10000);throw new Error('C003_REAL_CONTEXT_DELAY_NOT_TRIGGERED')})()]);
        const pending=await pendingCompanyMetrics(page,target);
        if(pending.hydration!=='pending'||pending.applications!=='—'||pending.deals!=='—'||pending.documents!=='—')throw new Error(`C003_FAIL_CLOSED_PENDING_MISMATCH_${JSON.stringify(pending)}`);
        proof.targets.C003={fail_closed_before_real_response:pending};
      }else await navPromise;
      if(!page.url().startsWith(`${preview.origin}/portal/client`))throw new Error(`${target.key}_AUTHENTICATED_PORTAL_REDIRECTED`);
      await ensureExactContext(page,target);
      for(let i=0;i<60&&!apiEvidence;i++)await sleep(100);
      if(!apiEvidence)throw new Error(`${target.key}_REAL_CONTEXT_RESPONSE_NOT_CAPTURED`);
      if(apiEvidence.http_status!==200||apiEvidence.client_id!==target.clientId||apiEvidence.contract_id!==target.contractId)throw new Error(`${target.key}_REAL_CONTEXT_SCOPE_FAIL`);
      if(apiEvidence.backend_header!==EXPECTED_BACKEND)throw new Error(`${target.key}_CANDIDATE_BOUNDARY_FAIL_${String(apiEvidence.backend_header||'MISSING')}`);
      const runtime=await page.evaluate(()=>({deals:String(window.__RONA_CLIENT_DEALS_AUTHORITATIVE__||''),company:String(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__||''),context:String(window.__RONA_CLIENT_CONTEXT_SELECTION_AUTHORITY__||window.__RONA_CLIENT_CONTEXT_AUTHORITY__||'')}));
      if(target.key==='C002'||target.key==='C004'){
        const d=apiEvidence.deal;if(!d||Number(d.passport_amount)!==target.amount||d.passport_currency!==target.currency||d.passport_amount_source!==target.source||d.passport_application_id!==target.applicationId)throw new Error(`${target.key}_REAL_API_PASSPORT_MISMATCH_${JSON.stringify(d)}`);
        const dom=await dealDomProof(page,target,target.amount);
        proof.targets[target.key]={api:apiEvidence,dom,runtime};
      }else{
        const m=apiEvidence.company_metrics;if(!m||Number(m.applications_total)!==2||Number(m.deals_total)!==2||Number(m.documents_total)!==5||m.source!=='AUTHORITATIVE_CURRENT_CONTEXT_DB'||m.documents_predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')throw new Error(`C003_REAL_API_KPI_MISMATCH_${JSON.stringify(m)}`);
        const dom=await companyMetrics(page,target);
        if(dom.applications!=='2'||dom.deals!=='2'||dom.documents!=='5'||dom.hydration!=='ready'||dom.source!=='AUTHORITATIVE_CURRENT_CONTEXT_DB'||dom.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')throw new Error(`C003_REAL_DOM_KPI_MISMATCH_${JSON.stringify(dom)}`);
        proof.targets.C003={...proof.targets.C003,api:apiEvidence,dom,runtime};
      }
      const foreignIds=targets.filter(x=>x.key!==target.key).map(x=>x.clientId);
      const foreign=await foreignDomProof(page,target,foreignIds);
      if(foreign.foreign_data_attribute||foreign.foreign_identifier_text)throw new Error(`${target.key}_FOREIGN_CLIENT_DOM_PRESENT_${JSON.stringify(foreign)}`);
      proof.targets[target.key].foreign_dom=foreign;
    }finally{
      await context.close().catch(()=>{});
      const cleanup=await cleanupSession(oidc,target,session);
      proof.targets[target.key]={...(proof.targets[target.key]||{}),session_cleanup:cleanup};
    }
  }
}finally{await browser.close()}

await writeFile(ARTIFACT,JSON.stringify(proof,null,2)+'\n','utf8');
console.log('ISSUE430_REAL_AUTH_CANDIDATE=PASS');
console.log(`CANDIDATE_BOUNDARY=${proof.targets.C002.api.backend_header}`);
console.log(`C002_REAL_API=passport_amount:${proof.targets.C002.api.deal.passport_amount} currency:${proof.targets.C002.api.deal.passport_currency} source:${proof.targets.C002.api.deal.passport_amount_source} application:${proof.targets.C002.api.deal.passport_application_id}`);
console.log('C002_REAL_DOM_CARD=236250 USD');
console.log('C002_REAL_DOM_PASSPORT=236250 USD');
console.log(`C003_REAL_FAIL_CLOSED=${proof.targets.C003.fail_closed_before_real_response.applications}/${proof.targets.C003.fail_closed_before_real_response.deals}/${proof.targets.C003.fail_closed_before_real_response.documents}`);
console.log('C003_REAL_API_KPI=2/2/5');
console.log('C003_REAL_DOM_KPI=2/2/5');
console.log(`C004_REAL_API_PASSPORT=${proof.targets.C004.api.deal.passport_amount} ${proof.targets.C004.api.deal.passport_currency}`);
console.log('C004_REAL_DOM_CARD=113500 USD');
console.log('C004_REAL_DOM_PASSPORT=113500 USD');
console.log('STALE_FOREIGN_DOM=ABSENT');
console.log('QA_SESSION_CLEANUP=PASS');