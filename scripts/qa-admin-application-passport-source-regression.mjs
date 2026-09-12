import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import APPLICATION_PASSPORT_RUNTIME from '../functions/portal/main-ui/application-passport-runtime.js';
import {mergeAdminCompletedApplications} from '../functions/portal/main-ui/admin-completed-applications.js';

const currentCompleted={application_id:'TEST-IN-CURRENT',client_id:'TEST-C-CURRENT',legal_name:'Текущий завершённый клиент',contract_id:'TEST-CTR-CURRENT',deal_id:'TEST-DEAL-CURRENT',product:'Текущий товар',quantity_tonnes:12,payment_terms:'Базовые условия',proposed_price:805,proposed_currency:'USD',status:'DEAL_REGISTERED',owner_status:'DEAL',lifecycle_state:'ARCHIVED'};
const restoredCompleted={application_id:'TEST-IN-RESTORED',deal_id:'TEST-DEAL-RESTORED',client_id:'TEST-C-RESTORED',legal_name:'Восстановленный клиент',contract_id:'TEST-CTR-RESTORED',product:'Исторический товар',quantity_tonnes:25,delivery_basis:'CPT',destination:'Историческая станция',payment_terms:'100% предоплата',proposed_price:725,proposed_currency:'USD'};
const restoredNoIntake={application_id:'TEST-IN-RESTORED-NO-INTAKE',deal_id:'TEST-DEAL-RESTORED-2',client_id:'TEST-C-RESTORED-2',legal_name:'Архивный клиент без intake',contract_id:'TEST-CTR-RESTORED-2',product:'Архивный товар',quantity_tonnes:35,payment_terms:'50/50',proposed_price:760,proposed_currency:'RUB'};
const baseAdminData={applications:[currentCompleted]};
const workflowProjection={applications:[{application_id:restoredCompleted.application_id,deal_id:restoredCompleted.deal_id,owner_status:'DEAL'},{application_id:restoredNoIntake.application_id,deal_id:restoredNoIntake.deal_id,owner_status:'DEAL'}],deals:[restoredCompleted,restoredNoIntake].map(x=>({application_id:x.application_id,deal_id:x.deal_id,business_status:'EXECUTING',client_id:x.client_id,legal_name:x.legal_name,contract_id:x.contract_id,source_product:x.product,source_quantity_tonnes:x.quantity_tonnes,source_delivery_basis:x.delivery_basis,source_destination:x.destination,source_payment_terms:x.payment_terms,source_proposed_price:x.proposed_price,source_proposed_currency:x.proposed_currency}))};
const completedBootstrap=mergeAdminCompletedApplications(baseAdminData,workflowProjection);
const core={applications:[{...currentCompleted,current_external_contract_number:'CURRENT-CONTRACT-88',payment_terms:'Условия из current core',proposed_price:810}],client_intake:[{authority_target_id:restoredCompleted.application_id,event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'APPLICATION',authority_target_type:'APPLICATION',current_external_contract_number:'HIST-CONTRACT-77',payload:{message_type:'APPLICATION_DETAILS_V5',comment:'Исторический комментарий клиента'}}]};
assert.ok(completedBootstrap.applications.some(a=>a.application_id===restoredCompleted.application_id));
assert.equal(core.applications.some(a=>a.application_id===restoredCompleted.application_id),false,'restored application must be absent from current core');
assert.equal(core.applications.some(a=>a.application_id===currentCompleted.application_id),true,'current application must remain in core');

const html=`<!doctype html><html><body><table><tbody>${completedBootstrap.applications.map(a=>`<tr data-id="${a.application_id}"><td>${a.application_id}</td><td><button data-rona-app-passport-open="${a.application_id}">Открыть</button></td></tr>`).join('')}</tbody></table><script src="/passport-runtime"></script></body></html>`;
const server=http.createServer((req,res)=>{const url=new URL(req.url||'/',`http://${req.headers.host}`);const send=(status,type,body)=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body)};if(url.pathname==='/')return send(200,'text/html; charset=utf-8',html);if(url.pathname==='/passport-runtime')return send(200,'application/javascript; charset=utf-8',APPLICATION_PASSPORT_RUNTIME);if(url.pathname==='/portal/admin-completed-bootstrap')return setTimeout(()=>send(200,'application/json',JSON.stringify({ok:true,data:completedBootstrap})),250);if(url.pathname==='/portal/api/v1/admin/bootstrap')return setTimeout(()=>send(200,'application/json',JSON.stringify({ok:true,data:core})),350);return send(404,'text/plain','not found')});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
const row=id=>page.locator(`tr[data-id="${id}"]`);const open=id=>row(id).locator(`button[data-rona-app-passport-open="${id}"]`);
async function passportText(id){assert.equal(await row(id).isVisible(),true);assert.equal(await open(id).count(),1);await open(id).click();const dialog=page.locator('.rona-app-passport-modal');await dialog.waitFor({state:'visible',timeout:5000});const text=await dialog.textContent();assert.doesNotMatch(text,/ADMIN_APPLICATION_PASSPORT_SOURCE_MISSING/);assert.match(text,new RegExp(id));await page.locator('.rona-app-passport-head button').click();return text}
try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  const restoredText=await passportText(restoredCompleted.application_id);
  assert.match(restoredText,/Восстановленный клиент/);assert.match(restoredText,/HIST-CONTRACT-77|TEST-CTR-RESTORED/);assert.match(restoredText,/TEST-DEAL-RESTORED/);assert.match(restoredText,/Исторический товар/);assert.match(restoredText,/100% предоплата/);assert.match(restoredText,/725 USD/);assert.match(restoredText,/Исторический комментарий клиента/);
  const currentText=await passportText(currentCompleted.application_id);
  assert.match(currentText,/CURRENT-CONTRACT-88/);assert.match(currentText,/Условия из current core/);assert.match(currentText,/810 USD/);
  const noIntakeText=await passportText(restoredNoIntake.application_id);
  assert.match(noIntakeText,/Архивный клиент без intake/);assert.match(noIntakeText,/TEST-CTR-RESTORED-2/);assert.match(noIntakeText,/50\/50/);assert.match(noIntakeText,/760 RUB/);assert.match(noIntakeText,/Для этой заявки расширенный набор полей формы не найден/);
  assert.deepEqual(errors,[]);
  console.log('ADMIN_APPLICATION_PASSPORT_SOURCE_REGRESSION=PASS completed_projection_present=true core_application_present=false passport_open=true current_core_application=true optional_intake_missing_graceful=true exact_application=true');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
