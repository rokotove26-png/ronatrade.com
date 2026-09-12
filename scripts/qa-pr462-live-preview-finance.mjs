import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const ORIGIN=String(process.env.TARGET_ORIGIN||'').replace(/\/$/,'');
const HEAD=String(process.env.EXPECTED_HEAD||'');
const SECRET=String(process.env.RONA_ADMIN_SESSION_SECRET||'');
const REPO=String(process.env.GITHUB_REPOSITORY||'rokotove26-png/ronatrade.com');
const RUN_ID=String(process.env.GITHUB_RUN_ID||'');
const LEGACY_BROKER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-ci-admin-session-broker';
const OIDC_BROKER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const OIDC_AUDIENCE='rona-pr462-live-preview';
const assert=(v,m)=>{if(!v)throw new Error(m)};
const compact=v=>String(v||'').replace(/[\s\u00a0\u202f]/g,'').replace(/,/g,'.');
const artifacts='artifacts/admin-payments-live-preview';
assert(/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i.test(ORIGIN),'IMMUTABLE_PREVIEW_REQUIRED');
assert(/^[0-9a-f]{40}$/i.test(HEAD),'EXACT_HEAD_REQUIRED');
assert(/^\d+$/.test(RUN_ID),'GITHUB_RUN_ID_REQUIRED');
await mkdir(artifacts,{recursive:true});

async function githubOidcToken(){
  const requestUrl=String(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||''),requestToken=String(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'');
  assert(requestUrl&&requestToken,'GITHUB_OIDC_REQUEST_CONTEXT_MISSING');
  const u=new URL(requestUrl);u.searchParams.set('audience',OIDC_AUDIENCE);
  const r=await fetch(u,{headers:{authorization:`Bearer ${requestToken}`,accept:'application/json'}}),j=await r.json().catch(()=>null);
  assert(r.ok&&j?.value,`GITHUB_OIDC_HTTP_${r.status}`);return String(j.value);
}
async function broker(path=''){
  if(SECRET){
    const headers={authorization:`Bearer ${SECRET}`,'content-type':'application/json','x-github-repository':REPO,'x-github-sha':HEAD,'x-github-ref':'refs/heads/release/public-go-live-v1.1','x-github-run-id':RUN_ID};
    const r=await fetch(LEGACY_BROKER+path,{method:'POST',headers,body:'{}'}),j=await r.json().catch(()=>null);
    if(!r.ok||j?.ok!==true)throw new Error(`ADMIN_BROKER${path||'/'}_HTTP_${r.status}_${String(j?.code||'INVALID_RESPONSE')}`);return j;
  }
  const oidc=await githubOidcToken();
  const r=await fetch(OIDC_BROKER+path,{method:'POST',headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json'},body:JSON.stringify({expectedHead:HEAD,origin:ORIGIN})}),j=await r.json().catch(()=>null);
  if(!r.ok||j?.ok!==true)throw new Error(`OIDC_ADMIN_BROKER${path||'/'}_HTTP_${r.status}_${String(j?.code||'INVALID_RESPONSE')}`);
  if(!path)assert(String(j?.head||'')===HEAD,'OIDC_ADMIN_BROKER_HEAD_MISMATCH');
  return j;
}
let session=null,browser=null,context=null;
const network=[];const runtimeErrors=[];
function safeBody(body){
  const data=body?.data||null,finance=data?.financeFragment||null;
  return body&&typeof body==='object'?{ok:body.ok??null,code:body.code??null,data:finance?{generatedAt:data?.generatedAt??null,financeProjectionContract:finance?.paymentProjectionContract??null,ownerPaymentScreenContract:finance?.ownerPaymentScreenContract??null,clientReceiptTotalsByCurrency:finance?.clientReceiptTotalsByCurrency??[],dealIds:(finance?.dealOwnerRows||finance?.dealPaymentRows||finance?.dealFinanceSummaries||[]).map(x=>x?.deal_id||x?.dealId).filter(Boolean),paymentIds:(finance?.incomingPayments||[]).map(x=>x?.payment_id).filter(Boolean)}:undefined}:null;
}
async function apiProof(page,path,label){
  const result=await page.evaluate(async({path,label})=>{const r=await fetch(path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-request-id':`pr462-${label}-${Date.now()}`}});const text=await r.text();let body=null;try{body=JSON.parse(text)}catch{};return{label,path,status:r.status,ok:r.ok,headers:{backend:r.headers.get('x-rona-owner-ai-sync-backend'),schedule:r.headers.get('x-rona-payment-schedule'),passport:r.headers.get('x-rona-payment-passport')},body};},{path,label});
  network.push({...result,body:safeBody(result.body)||{ok:result.body?.ok??null,code:result.body?.code??null,dataContract:result.body?.data?.projectionContract??result.body?.data?.passportContract??null,dealId:result.body?.data?.dealId??result.body?.data?.deal_id??null}});
  assert(result.status===200,`${label}_HTTP_${result.status}_${String(result.body?.code||'')}`);
  return result;
}
async function openPayments(page){const b=page.locator('#nav button[data-page="payments"]');await b.waitFor({state:'visible',timeout:30000});await b.click();await page.locator('#page-payments.active').waitFor({state:'visible',timeout:15000});await page.waitForFunction(()=>window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.financeFragment?.ownerPaymentScreenContract==='ADMIN_PAYMENTS_OWNER_CURRENT_STATE_V1',null,{timeout:30000});await page.waitForFunction(()=>window.__RONA_ADMIN_PAYMENT_SCHEDULE_RUNTIME_V2__==='20260912-payment-schedule-v2',null,{timeout:30000});await page.evaluate(()=>window.__RONA_PAYMENT_SCHEDULE_REFRESH__?.());await page.locator('#rona-payment-schedule-v1').waitFor({state:'attached',timeout:20000});}
try{
  session=await broker();
  const access=String(session?.session?.access_token||''),refresh=String(session?.session?.refresh_token||'');assert(access&&refresh,'ADMIN_BROKER_SESSION_TOKENS_MISSING');
  browser=await chromium.launch({headless:true});context=await browser.newContext({viewport:{width:1600,height:1000}});await context.addCookies([{name:'rona_portal_at',value:access,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'},{name:'rona_portal_rt',value:refresh,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();page.on('pageerror',e=>runtimeErrors.push(`pageerror:${String(e?.message||e)}`));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource:'))runtimeErrors.push(`console:${m.text()}`)});page.on('response',r=>{if(r.status()>=500)runtimeErrors.push(`http:${r.status()}:${r.url()}`)});
  await page.goto(ORIGIN+'/portal/admin?_qa='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
  const me=await apiProof(page,'/portal/api/session/me','SESSION_ME');assert(Array.isArray(me.body?.user?.roles)&&me.body.user.roles.includes('ADMIN'),'PREVIEW_ADMIN_SESSION_ROLE_MISSING');
  const sync=await apiProof(page,'/portal/owner-api?path=/admin/ai-sync','LIVE_AI_SYNC');assert(sync.headers.backend==='PR462_PREVIEW_FINANCE_AUTHORITY','LIVE_AI_SYNC_BACKEND_MISMATCH');assert(sync.body?.data?.financeFragment?.paymentProjectionContract==='ADMIN_PAYMENTS_FINANCE_AUTHORITY_V1','LIVE_AI_SYNC_FINANCE_CONTRACT_MISSING');console.log('LIVE_AI_SYNC_AVAILABLE=PASS');
  const schedule=await apiProof(page,'/portal/payment-schedule-current','LIVE_PAYMENT_SCHEDULE');assert(schedule.body?.data?.projectionContract==='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2','LIVE_PAYMENT_SCHEDULE_CONTRACT_MISSING');console.log('LIVE_PAYMENT_SCHEDULE_AVAILABLE=PASS');
  await apiProof(page,'/portal/payment-passport-current?dealId=DEAL-2026-004','LIVE_PAYMENT_PASSPORT_004');console.log('LIVE_PAYMENT_PASSPORT_AVAILABLE=PASS');
  await openPayments(page);await page.waitForTimeout(300);
  const pageText=compact(await page.locator('#page-payments').innerText());assert(pageText.includes('487320USD'),'CLIENT_RECEIPTS_TOTAL_487320_USD');console.log('CLIENT_RECEIPTS_TOTAL_487320_USD=PASS');for(const id of ['004','005','006','009']){assert(pageText.includes(`DEAL-2026-${id}`),`DEAL${id}_MISSING`);console.log(`DEAL${id}_PRESENT=PASS`)}
  const dealRows=page.locator('#page-payments').getByText('Финансовая картина по сделкам').locator('xpath=ancestor::*[contains(@class,"rona-owner-card")]').locator('tbody tr');const row=async id=>dealRows.filter({hasText:`DEAL-2026-${id}`}).first();
  assert(compact(await (await row('004')).innerText()).includes('236250USD'),'DEAL004_RECEIVED_236250');console.log('DEAL004_RECEIVED_236250=PASS');assert(compact(await (await row('005')).innerText()).includes('201750USD'),'DEAL005_RECEIVED_201750');console.log('DEAL005_RECEIVED_201750=PASS');assert(compact(await (await row('006')).innerText()).includes('49320USD'),'DEAL006_RECEIVED_49320');console.log('DEAL006_RECEIVED_49320=PASS');const row9Text=compact(await (await row('009')).innerText());assert(row9Text.includes('TO_VERIFY'),'DEAL009_ROW_TO_VERIFY');assert(!row9Text.includes('362600'),'DEAL009_STALE_USD');console.log('DEAL009_ROW_TO_VERIFY=PASS');console.log('DEAL009_OLD_USD_NOT_RENDERED=PASS');
  const r5=page.locator('#rona-payment-schedule-v1 tbody tr[data-schedule-deal="DEAL-2026-005"]'),r6=page.locator('#rona-payment-schedule-v1 tbody tr[data-schedule-deal="DEAL-2026-006"]');assert((await r5.getAttribute('data-schedule-state'))==='DEFERRED_NOT_DUE'&&(await r6.getAttribute('data-schedule-state'))==='DEFERRED_NOT_DUE','CURRENT_DUE_005_006_ZERO');console.log('CURRENT_DUE_005_006_ZERO=PASS');assert(compact(await r5.innerText()).includes('470750USD')&&compact(await r6.innerText()).includes('115080USD'),'DEFERRED_TOTAL_585830');console.log('DEFERRED_TOTAL_585830=PASS');
  assert(pageText.includes('14389568.9RUB')||pageText.includes('14389568.90RUB'),'PAID_DEAL_RUB_14389568_90');assert(pageText.includes('25464800KZT'),'PAID_DEAL_KZT_25464800');console.log('PAID_DEAL_RUB_14389568_90=PASS');console.log('PAID_DEAL_KZT_25464800=PASS');
  for(const p of ['PAYEV-2026-000001','PAYEV-2026-000002','PAYEV-2026-000003'])assert(pageText.includes(p),'CLIENT_PAYMENT_ROWS_PRESENT');console.log('CLIENT_PAYMENT_ROWS_PRESENT=PASS');const buttons=page.locator('#page-payments button[data-rona-payment-passport-open]');assert(await buttons.count()===4,'PAYMENT_PASSPORT_BUTTON_ALL_DEALS');console.log('PAYMENT_PASSPORT_BUTTON_ALL_DEALS=PASS');
  await page.screenshot({path:`${artifacts}/ADMIN_PAYMENTS_LIVE_PREVIEW.png`,fullPage:true});
  const modal=page.locator('.rona-app-passport-modal');await page.locator('button[data-rona-payment-passport-open="DEAL-2026-004"]').click();await modal.waitFor({state:'visible',timeout:15000});let mt=compact(await modal.innerText());assert(mt.includes('DEAL-2026-004')&&mt.includes('236250USD')&&mt.includes('PAYEV-2026-000001'),'PAYMENT_PASSPORT_004_OPEN');console.log('PAYMENT_PASSPORT_004_OPEN=PASS');await page.screenshot({path:`${artifacts}/PAYMENT_PASSPORT_DEAL_004_LIVE_PREVIEW.png`,fullPage:true});await modal.getByRole('button',{name:'Закрыть'}).click();
  await page.locator('button[data-rona-payment-passport-open="DEAL-2026-005"]').click();await modal.waitFor({state:'visible',timeout:15000});mt=compact(await modal.innerText());assert(mt.includes('DEAL-2026-005')&&mt.includes('201750USD'),'PAYMENT_PASSPORT_005_OPEN');console.log('PAYMENT_PASSPORT_005_OPEN=PASS');await modal.getByRole('button',{name:'Закрыть'}).click();
  await page.locator('button[data-rona-payment-passport-open="DEAL-2026-009"]').click();await modal.waitFor({state:'visible',timeout:15000});mt=compact(await modal.innerText());assert(mt.includes('DEAL-2026-009')&&mt.includes('TO_VERIFY')&&!mt.includes('362600'),'PAYMENT_PASSPORT_009_TO_VERIFY');console.log('PAYMENT_PASSPORT_009_TO_VERIFY=PASS');await page.screenshot({path:`${artifacts}/PAYMENT_PASSPORT_DEAL_009_LIVE_PREVIEW.png`,fullPage:true});await modal.getByRole('button',{name:'Закрыть'}).click();
  const html=await page.content();assert(!html.includes('QA_FINANCE_CURRENT_STATE')&&!html.includes('QA_BANK'),'QA_FIXTURE_LEAKED_IN_PREVIEW');console.log('NO_QA_FIXTURE_IN_PREVIEW=PASS');const mainSrc=await (await page.request.get(ORIGIN+'/portal/main-ui?qa='+Date.now())).text();assert(!/487320|585830/.test(mainSrc),'FRONTEND_FINANCE_HARDCODE');console.log('NO_FRONTEND_FALLBACK=PASS');await page.reload({waitUntil:'domcontentloaded',timeout:45000});await openPayments(page);assert(await page.locator('#rona-payment-schedule-v1').count()===1&&await page.locator('#page-payments button[data-rona-payment-passport-open]').count()===4,'NO_DUPLICATES');console.log('NO_DUPLICATES=PASS');assert(runtimeErrors.length===0,'NO_RUNTIME_ERRORS:'+runtimeErrors.join('|'));console.log('NO_RUNTIME_ERRORS=PASS');
  await writeFile(`${artifacts}/network-proof.json`,JSON.stringify({origin:ORIGIN,head:HEAD,authMode:SECRET?'LEGACY_SECRET':'GITHUB_OIDC',network,runtimeErrors},null,2));console.log('LIVE_PREVIEW_FINANCE_DATA=PASS');
} finally {
  if(context)await context.close().catch(()=>{});if(browser)await browser.close().catch(()=>{});if(session)await broker('/cleanup').catch(e=>console.error('BROKER_CLEANUP_FAIL',e?.message||e));
}
