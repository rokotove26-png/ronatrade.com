import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

function required(name){
  const value=String(process.env[name]||'').trim();
  assert.ok(value,`${name} is required`);
  return value;
}
function exactPreview(value){
  const origin=String(value||'').replace(/\/$/,'');
  assert.match(origin,/^https:\/\/[a-f0-9]+\.rona-trade-public\.pages\.dev$/,'exact immutable Cloudflare preview is required');
  return origin;
}
async function jsonOf(response){return response.json().catch(()=>null)}
function codeOf(payload){return String(payload?.code||payload?.message||payload?.error||'')}

const preview=exactPreview(required('PREVIEW_ORIGIN'));
const identifier=required('OWNER_E2E_IDENTIFIER');
const password=required('OWNER_E2E_PASSWORD');
const goDealId=required('OWNER_E2E_GO_DEAL_ID');
const holdDealId=required('OWNER_E2E_HOLD_DEAL_ID');
const missingDocDealId=required('OWNER_E2E_MISSING_DOC_DEAL_ID');
const expectedCandidateProject=required('OWNER_E2E_CANDIDATE_PROJECT');
const artifactPath=String(process.env.OWNER_E2E_ARTIFACT||'artifacts/pr452-owner-candidate-e2e.json');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1500,height:900}});
const page=await context.newPage();
const dialogs=[];
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error?.message||error)));
page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept()});

const proof={
  version:'pr452-candidate-e2e-v2',
  preview,
  candidateProject:expectedCandidateProject,
  testedAt:new Date().toISOString(),
  mockRpc:false,
  goDealId,
  holdDealId,
  missingDocDealId,
  checks:{}
};

async function requestOwner(path,method='GET'){
  const headers={accept:'application/json',referer:`${preview}/portal/admin`};
  if(method==='POST')headers.origin=preview;
  const url=`${preview}/portal/owner-api?path=${encodeURIComponent(path)}`;
  return method==='POST'?context.request.post(url,{headers,data:{}}):context.request.get(url,{headers});
}
async function assertCandidate(response,label){
  const mode=String(response.headers()['x-rona-backend-mode']||'');
  const project=String(response.headers()['x-rona-backend-project']||'');
  assert.equal(mode,'candidate',`${label}: preview must be candidate-backed`);
  assert.equal(project,expectedCandidateProject,`${label}: unexpected candidate project`);
}
async function openDeal(id){
  const row=page.locator('.rona-current-deal-table tbody tr').filter({has:page.getByText(id,{exact:true})});
  await row.waitFor({state:'visible',timeout:20000});
  await row.locator('button.rona-current-deal-open').click();
  await page.locator('#ronaCurrentDealDrawer').waitFor({state:'visible',timeout:5000});
}
function sendButton(){
  return page.locator('#ronaCurrentDealDrawer .rona-current-deal-actions button').filter({hasText:/Отправить в оплату|Передано в оплату/});
}
async function closeDrawer(){
  const drawer=page.locator('#ronaCurrentDealDrawer');
  if(await drawer.count()){
    await drawer.locator('.rona-current-deal-drawer-close').click();
    await drawer.waitFor({state:'detached',timeout:5000});
  }
}

try{
  const login=await context.request.post(`${preview}/portal/auth/login`,{
    headers:{origin:preview,referer:`${preview}/portal/login`,accept:'application/json','content-type':'application/json'},
    data:{identifier,password,next:'/portal/admin'}
  });
  const loginPayload=await jsonOf(login);
  assert.equal(login.status(),200,`candidate login failed: ${JSON.stringify(loginPayload)}`);
  assert.equal(loginPayload?.ok,true,'candidate login did not return ok=true');
  assert.equal(loginPayload?.redirect,'/portal/admin','candidate login did not resolve ADMIN');
  proof.checks.login='PASS';

  const bootstrapBefore=await requestOwner('/admin/workflow-bootstrap');
  await assertCandidate(bootstrapBefore,'bootstrap-before');
  assert.equal(bootstrapBefore.status(),200,'candidate workflow bootstrap failed');
  const initial=await jsonOf(bootstrapBefore);
  assert.equal(initial?.ok,true,'candidate workflow bootstrap did not return ok=true');
  const deals=Array.isArray(initial?.data?.deals)?initial.data.deals:[];
  assert.ok(deals.some(d=>String(d?.deal_id||'')===goDealId),'GO fixture missing from candidate bootstrap');
  assert.ok(deals.some(d=>String(d?.deal_id||'')===holdDealId),'HOLD fixture missing from candidate bootstrap');
  assert.ok(deals.some(d=>String(d?.deal_id||'')===missingDocDealId),'missing-document fixture missing from candidate bootstrap');
  proof.checks.candidateBootstrap='PASS';

  await page.goto(`${preview}/portal/admin`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-deals-current-ready'),null,{timeout:20000});

  await openDeal(goDealId);
  let send=sendButton();
  assert.equal(await send.isEnabled(),true,'GO + required docs/product/volume must enable send without finance summary');
  const dialogStart=dialogs.length;
  await send.click();
  await page.waitForFunction(id=>window.__RONA_DEALS_CURRENT_STATE_SNAPSHOT__?.deals?.some(d=>String(d?.deal_id||'')===id&&String(d?.payment_handoff_state||'').toUpperCase()==='SENT'),goDealId,{timeout:10000});
  const goDialogs=dialogs.slice(dialogStart);
  assert.ok(goDialogs.every(text=>!/финансов|обязательств|прикреп|доп\. соглаш/i.test(text)),'GO handoff surfaced a finance/document blocker');
  assert.ok(goDialogs.some(text=>/передана в оплату/i.test(text)),'GO handoff did not report successful transfer');
  proof.checks.ownerClickToSent='PASS';

  const repeat=await requestOwner(`/admin/deals/${encodeURIComponent(goDealId)}/send-to-payments`,'POST');
  await assertCandidate(repeat,'repeat-send');
  const repeatPayload=await jsonOf(repeat);
  assert.equal(repeat.status(),200,`repeat send failed: ${JSON.stringify(repeatPayload)}`);
  assert.equal(repeatPayload?.ok,true,'repeat send did not return ok=true');
  assert.equal(repeatPayload?.data?.state,'SENT','repeat send lost SENT state');
  assert.equal(repeatPayload?.data?.idempotent,true,'repeat send must be idempotent');
  assert.equal(repeatPayload?.data?.amount,null,'repeat send fabricated amount');
  assert.equal(repeatPayload?.data?.currency,null,'repeat send fabricated currency');
  proof.checks.repeatIdempotent='PASS';

  await closeDrawer();
  await page.getByRole('button',{name:'Платежи',exact:true}).click();
  const pendingCard=page.locator('#page-payments .rona-owner-card').filter({hasText:'Передано в оплату — сумма формируется'});
  await pendingCard.waitFor({state:'visible',timeout:10000});
  const paymentText=String(await pendingCard.textContent());
  assert.match(paymentText,new RegExp(goDealId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'Payments projection does not contain sent GO deal');
  assert.match(paymentText,/Не сформировано/,'Payments projection must show amount as not formed');
  assert.doesNotMatch(paymentText,/USD|RUB|KGS|EUR|\b0(?:[.,]00)?\b/,'Payments projection fabricated amount/currency');
  proof.checks.paymentsVisibleWithoutFinance='PASS';
  proof.checks.noFabricatedAmountCurrency='PASS';

  const holdResponse=await requestOwner(`/admin/deals/${encodeURIComponent(holdDealId)}/send-to-payments`,'POST');
  await assertCandidate(holdResponse,'hold-negative');
  const holdPayload=await jsonOf(holdResponse);
  assert.notEqual(holdResponse.status(),200,'HOLD fixture must fail closed');
  assert.ok(['PRODUCT_CONFIRMATION_REQUIRED','VOLUME_CONFIRMATION_REQUIRED','DEAL_NOT_ACTIVE'].includes(codeOf(holdPayload)),`unexpected HOLD blocker: ${JSON.stringify(holdPayload)}`);
  proof.checks.holdFailClosed=codeOf(holdPayload);

  const missingDocResponse=await requestOwner(`/admin/deals/${encodeURIComponent(missingDocDealId)}/send-to-payments`,'POST');
  await assertCandidate(missingDocResponse,'missing-doc-negative');
  const missingDocPayload=await jsonOf(missingDocResponse);
  assert.notEqual(missingDocResponse.status(),200,'missing-document fixture must fail closed');
  assert.ok(['ADDENDUM_REQUIRED','INVOICE_REQUIRED','SIGNED_ADDENDUM_REQUIRED'].includes(codeOf(missingDocPayload)),`unexpected document blocker: ${JSON.stringify(missingDocPayload)}`);
  proof.checks.missingDocumentsFailClosed=codeOf(missingDocPayload);

  await page.getByRole('button',{name:'Сделки',exact:true}).click();
  await openDeal(holdDealId);
  send=sendButton();
  assert.equal(await send.isDisabled(),true,'HOLD fixture send button must remain disabled');
  await closeDrawer();
  await openDeal(missingDocDealId);
  send=sendButton();
  assert.equal(await send.isDisabled(),true,'missing-document fixture send button must remain disabled');
  proof.checks.negativeUiFailClosed='PASS';

  assert.deepEqual(pageErrors,[],'real preview browser runtime threw an error');
  proof.checks.browserRuntime='PASS';
  proof.result='PASS';
  await mkdir(artifactPath.split('/').slice(0,-1).join('/')||'.',{recursive:true});
  await writeFile(artifactPath,JSON.stringify(proof,null,2)+'\n','utf8');
  console.log('ADMIN_GO_PAYMENT_NO_FINANCE_REAL_E2E=PASS',JSON.stringify(proof));
}finally{
  await browser.close();
}
