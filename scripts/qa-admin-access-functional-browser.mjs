import http from 'node:http';
import { chromium } from 'playwright';
import { onRequest as accessUiRequest } from '../functions/portal/admin-canonical-create-access-v441-ui.js';

const contractId='RONA-QA-C001-CTR-2026-001';
const clientId='RONA-QA-C001';
const business={
  clients:[{client_id:clientId,legal_name:'QA Client LLC',contract_id:contractId,current_external_contract_number:'QA-001'}],
  companies:[{client_id:clientId,legal_name:'QA Client LLC',contract_id:contractId,current_external_contract_number:'QA-001'}],
  agents:[{agent_person_id:'RONA-QA-A001',agent_name:'QA Agent'}]
};
let pdfReady=false;
const created=[];
let uploadRequests=0;
const authority=()=>({
  contracts:[{contractId,id:contractId,clientId,contractStatus:'ACTIVE',status:'ACTIVE',companyName:'QA Client LLC',externalContractNumber:'QA-001'}],
  signedContractGate:{contracts:[{contractId,clientId,bilateralSignedConfirmed:pdfReady,serverConfirmed:pdfReady,documentId:pdfReady?'DOC-QA-001':''}]}
});
const ui=await (await accessUiRequest()).text();
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#050b13;color:#fff;font:14px Arial,sans-serif;padding:40px}.btn{padding:10px 14px}</style></head><body><section id="page-access"><button class="btn" type="button" data-action="create-access">Создать доступ</button></section><script src="/functional-access.js"></script></body></html>`;

function send(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body)}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}
async function readBody(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks)}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/', 'http://127.0.0.1');
  if(u.pathname==='/portal/admin')return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/functional-access.js')return send(res,200,ui,'application/javascript; charset=utf-8');
  if(u.pathname==='/portal/owner-api'&&u.searchParams.get('path')==='/admin/bootstrap')return json(res,{ok:true,data:business});
  if(u.pathname==='/portal/admin-authority/bootstrap')return json(res,{ok:true,data:authority()});
  if(req.method==='POST'&&u.pathname===`/portal/admin-authority/contracts/${encodeURIComponent(contractId)}/signed-document/attach`){
    const body=await readBody(req);uploadRequests++;if(!String(req.headers['content-type']||'').includes('multipart/form-data'))return json(res,{ok:false,code:'PDF_TYPE_INVALID'},400);if(!body.includes(Buffer.from('%PDF')))return json(res,{ok:false,code:'PDF_SIGNATURE_INVALID'},400);pdfReady=true;return json(res,{ok:true,data:{contractId,clientId,documentId:'DOC-QA-001',bilateralSignedConfirmed:true,serverConfirmed:true}})
  }
  if(req.method==='POST'&&u.pathname==='/portal/admin-authority/access/users'){
    const body=await readBody(req);let payload={};try{payload=JSON.parse(body.toString('utf8'))}catch{return json(res,{ok:false,code:'INVALID_JSON'},400)}created.push(payload);return json(res,{ok:true,data:{userId:'RONA-QA-U'+created.length,pendingContractIds:[]}})
  }
  return send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;
const assert=(v,m)=>{if(!v)throw new Error(m)};
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1600,height:1000}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push('pageerror:'+String(e.message||e)));page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text())});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_ACCESS_FUNCTIONAL_BUILD__==='create-user-contract-pdf-v5-20260828');
  await page.locator('#page-access button').click();
  const modal=page.locator('.rona-approved-access-modal');await modal.waitFor({state:'visible'});
  const text=await modal.innerText();
  for(const marker of ['Тип доступа','Роль пользователя','Ф.И.О. пользователя','Единый логин','Электронная почта','Телефон','Пароль','Повторите пароль','Разрешённые компании / контракты','PDF не закреплён','Закрепить PDF'])assert(text.includes(marker),'client modal marker missing: '+marker);

  await page.getByLabel('Ф.И.О. пользователя').fill('QA Client User');
  await page.getByLabel('Единый логин').fill('qa.client');
  await page.getByLabel('Электронная почта').fill('qa.client@example.com');
  await page.getByLabel('Телефон').fill('+996700000001');
  await page.getByLabel('Пароль',{exact:true}).fill('Qa!Password1');
  await page.getByLabel('Повторите пароль').fill('Qa!Password1');
  await modal.locator('.rona-approved-contract-card input[type="checkbox"]').check();
  await modal.getByRole('button',{name:'Создать единую учётную запись'}).click();
  const gateNotice=page.locator('.ca-modal-backdrop').last();await gateNotice.waitFor({state:'visible'});assert((await gateNotice.innerText()).includes('нет подтверждённого PDF'),'missing-PDF gate did not block creation');await gateNotice.getByRole('button',{name:'Закрыть'}).click();
  assert(created.length===0,'client user was created before PDF confirmation');

  const chooserPromise=page.waitForEvent('filechooser');await modal.getByRole('button',{name:'Закрепить PDF'}).click();const chooser=await chooserPromise;await chooser.setFiles({name:'qa-contract.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n% RONA QA\n1 0 obj<<>>endobj\n%%EOF')});
  const confirm=page.locator('.ca-modal-backdrop').last();await confirm.waitFor({state:'visible'});await confirm.getByRole('button',{name:'Подтвердить'}).click();
  const uploadDone=page.locator('.ca-modal-backdrop').last();await uploadDone.waitFor({state:'visible'});assert((await uploadDone.innerText()).includes('PDF договора закреплён'),'PDF attach success notice missing');await uploadDone.getByRole('button',{name:'Закрыть'}).click();
  assert(uploadRequests===1,'expected one PDF upload, got '+uploadRequests);await page.waitForFunction(()=>document.querySelector('.rona-approved-contract-card')?.textContent?.includes('PDF подтверждён'));

  await modal.getByRole('button',{name:'Создать единую учётную запись'}).click();
  const clientDone=page.locator('.ca-modal-backdrop').last();await clientDone.waitFor({state:'visible'});assert((await clientDone.innerText()).includes('Доступ клиента создан'),'client creation success missing');
  assert(created.length===1,'client create request missing');assert(created[0].role==='Клиент','client role payload');assert(created[0].initialPassword==='Qa!Password1','client initialPassword missing');assert(created[0].contractIds?.[0]===contractId,'client contract binding missing');await clientDone.getByRole('button',{name:'Закрыть'}).click();
  await page.waitForLoadState('domcontentloaded');await page.waitForFunction(()=>window.__RONA_ACCESS_FUNCTIONAL_BUILD__==='create-user-contract-pdf-v5-20260828');

  await page.locator('#page-access button').click();const agentModal=page.locator('.rona-approved-access-modal');await agentModal.waitFor({state:'visible'});await page.getByLabel('Тип доступа').selectOption('Агент');
  assert(await page.getByLabel('Профиль агента').isVisible(),'agent profile must be visible');assert(!(await page.locator('.rona-approved-contract-grid').isVisible()),'contract grid must be hidden for agent');
  await page.getByLabel('Ф.И.О. пользователя').fill('QA Agent User');await page.getByLabel('Единый логин').fill('qa.agent');await page.getByLabel('Электронная почта').fill('qa.agent@example.com');await page.getByLabel('Пароль',{exact:true}).fill('Qa!Password2');await page.getByLabel('Повторите пароль').fill('Qa!Password2');await page.getByLabel('Профиль агента').selectOption('RONA-QA-A001');
  await agentModal.getByRole('button',{name:'Создать единую учётную запись'}).click();const agentDone=page.locator('.ca-modal-backdrop').last();await agentDone.waitFor({state:'visible'});assert((await agentDone.innerText()).includes('Доступ агента создан'),'agent creation success missing');
  assert(created.length===2,'agent create request missing');assert(created[1].role==='Агент','agent role payload');assert(created[1].agentScope==='RONA-QA-A001','agentScope missing');assert(created[1].initialPassword==='Qa!Password2','agent initialPassword missing');assert(Array.isArray(created[1].contractIds)&&created[1].contractIds.length===0,'agent must not get client contract binding');
  assert(errors.length===0,'browser errors: '+errors.join(' | '));
  console.log('ADMIN_ACCESS_FUNCTIONAL_BROWSER_QA=PASS');
  console.log(JSON.stringify({uploadRequests,created:created.map(x=>({role:x.role,login:x.login,contractIds:x.contractIds,agentScope:x.agentScope,hasInitialPassword:!!x.initialPassword})),errors}));
  await context.close();
}catch(e){console.error('ADMIN_ACCESS_FUNCTIONAL_BROWSER_QA=FAIL',e?.stack||e);process.exitCode=1}finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}
