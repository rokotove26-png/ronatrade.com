import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const script = await readFile('dist/assets/portal-runtime/client-deal-documents-v5.js', 'utf8');
assert.ok(script.includes("authority.whenCurrentProjection('client-deal-documents-v5')"), 'central projection materialization missing');
assert.ok(script.includes('workflow_unavailable:true'), 'denial state erased by materialization');

const browser = await chromium.launch({headless:true});
let page;
try {
  page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror', e=>errors.push(String(e)));
  await page.setContent('<!doctype html><html lang="ru"><body><h1>Сделки</h1><main><section id="deal" style="width:720px;height:144px;padding:12px;border:1px solid #888;"><span>DEAL-2099-001</span><button type="button">Открыть</button><p>В исполнении</p></section></main></body></html>');
  await page.evaluate(()=>{
    window.__workflowDenied=true;
    window.__workflowFetches=[];
    const ctx={client_id:'RONA-QA-CLIENT',contract_id:'RONA-QA-CTR-2099-001'};
    const projection={
      contract:{...ctx},
      deals:[{deal_id:'DEAL-2099-001',business_status:'EXECUTING',resource_status:'RESOURCE_CONFIRMED'}],
      documents:[
        {deal_id:'DEAL-2099-001',document_id:'QA-DOC-DS',document_type:'ADDENDUM',storage_object_id:'QA-STORAGE-DS',authoritative_filename:'unsigned.pdf'},
        {deal_id:'DEAL-2099-001',document_id:'QA-DOC-INV',document_type:'INVOICE',storage_object_id:'QA-STORAGE-INV',authoritative_filename:'invoice.pdf'}
      ]
    };
    window.RONA_CLIENT_CONTEXT={
      getCurrentContext:()=>ctx,
      whenReady:async()=>ctx,
      whenCurrentProjection:async()=>projection,
      subscribe:()=>()=>{}
    };
    window.fetch=async(input,init)=>{
      const path=String(input);
      if(path.includes('/v1/client/deal-documents/state')){
        window.__workflowFetches.push({path,method:init?.method||'GET',denied:window.__workflowDenied});
        return new Response(JSON.stringify(window.__workflowDenied
          ? {ok:false,code:'PORTAL_ACCESS_DENIED'}
          : {ok:true,deals:[{deal_id:'DEAL-2099-001',client_addendum_downloaded_at:'2099-01-01T00:00:00Z'}]}),
          {status:window.__workflowDenied?401:200,headers:{'content-type':'application/json'}});
      }
      throw new Error('UNEXPECTED_NETWORK_ROUTE '+path);
    };
  });
  await page.addScriptTag({content:script});
  await page.evaluate(()=>window.dispatchEvent(new Event('rona:client:deals-rendered')));
  await page.waitForSelector('.rona-deal-documents-v5__error',{timeout:8000});
  const denied=await page.evaluate(()=>{
    const panel=document.querySelector('.rona-deal-documents-v5');
    return {
      warning:panel?.querySelector('.rona-deal-documents-v5__error')?.textContent||'',
      invoice:[...(panel?.querySelectorAll('button')||[])].some(b=>b.textContent?.includes('Инвойс')),
      addendum:[...(panel?.querySelectorAll('button')||[])].some(b=>b.textContent?.includes('Дополнительное соглашение')),
      upload:[...(panel?.querySelectorAll('button')||[])].some(b=>b.textContent?.includes('Загрузить подписанное')),
      fetches:window.__workflowFetches
    };
  });
  assert.match(denied.warning,/Статус документооборота временно недоступен/);
  assert.equal(denied.invoice,true,'canonical invoice hidden on workflow error');
  assert.equal(denied.addendum,true,'canonical unsigned addendum hidden on workflow error');
  assert.equal(denied.upload,false,'unverified workflow allowed signed upload');
  assert.ok(denied.fetches.length>=1);
  assert.ok(denied.fetches.every(x=>x.method==='GET'&&x.denied===true));
  console.log('QA_DOCUMENT_WORKFLOW_DENIAL_FAIL_CLOSED=PASS '+JSON.stringify({warning:true,invoice:true,addendum:true,upload:false,synthetic:true}));

  await page.evaluate(()=>{window.__workflowDenied=false;});
  await page.waitForTimeout(1250);
  await page.evaluate(()=>window.dispatchEvent(new Event('rona:client:deals-rendered')));
  await page.waitForFunction(()=>{
    const panel=document.querySelector('.rona-deal-documents-v5');
    return panel&&!panel.querySelector('.rona-deal-documents-v5__error')&&
      [...panel.querySelectorAll('button')].some(b=>b.textContent?.includes('Загрузить подписанное'));
  },null,{timeout:8000});
  const recovered=await page.evaluate(()=>({
    warning:!!document.querySelector('.rona-deal-documents-v5__error'),
    fetches:window.__workflowFetches.map(x=>({denied:x.denied,method:x.method}))
  }));
  assert.equal(recovered.warning,false);
  assert.ok(recovered.fetches.some(x=>x.denied===false));
  assert.deepEqual(errors,[],'unexpected JavaScript execution errors');
  console.log('QA_DOCUMENT_WORKFLOW_DENIAL_RECOVERY=PASS '+JSON.stringify({warningCleared:true,signedUploadFromConfirmedWorkflow:true,synthetic:true}));
}finally {
  if(page)await page.close();
  await browser.close();
}
