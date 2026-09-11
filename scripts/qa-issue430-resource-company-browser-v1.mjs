import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST=normalize(process.env.RONA_DIST_DIR||'dist');
const SOURCE='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB';
const PREDICATE='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY';
const REALIZATION='SERVER_AUTHORITATIVE_REALIZATION_V1';
const ACCEPTANCE={client_id:'RONA-C005',contract_id:'RONA-C005-CTR-2026-001',deal_id:'DEAL-2026-009'};
const B={client_id:'RONA-C900',contract_id:'RONA-C900-CTR-2099-001'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fail=message=>{throw new Error(message)};
const assert=(value,message)=>{if(!value)fail(message)};
const rectClose=(a,b,tolerance=1)=>['x','y','width','height'].every(k=>Math.abs(Number(a?.[k])-Number(b?.[k]))<=tolerance);

function context(client_id,contract_id,legal_name){return{client_id,contract_id,legal_name,registration_country:'KG',current_external_contract_number:contract_id,effective_from:'2026-09-01'}}
function directoryRow(ctx,applications_total,deals_total,documents_total){return{...ctx,contract_status:'ACTIVE',effective_to:null,applications_total,deals_total,documents_total,source:SOURCE,documents_predicate:PREDICATE,current_signed_contract:null}}
function templateCard(ctx,current=false){return `<article class="company-switch-card"><div class="eyebrow">${ctx.legal_name}</div><h3>${ctx.legal_name}</h3><div class="ids"><span>${ctx.client_id}</span><span>${ctx.contract_id}</span></div><div>Контракт № ${ctx.current_external_contract_number} · 01.09.2026</div><div class="metric"><strong>0</strong><span>ЗАЯВОК</span></div><div class="metric"><strong>0</strong><span>СДЕЛОК</span></div><div class="metric"><strong>0</strong><span>ДОКУМЕНТОВ</span></div><div>ИД КОНТРАКТА</div><b>${ctx.contract_id}</b><button type="button">${current?'Текущая компания':'Открыть компанию'}</button><span>Файл подписанного контракта не опубликован в кабинете</span></article>`}
function companyFixture(kind){
  const A=context(ACCEPTANCE.client_id,ACCEPTANCE.contract_id,'ОсОО RONA C005');
  const C=context(B.client_id,B.contract_id,'ОсОО RONA C900');
  const contexts=kind==='multi'?[A,C]:[A];
  const rows=kind==='multi'?[directoryRow(A,1,1,3),directoryRow(C,2,2,5)]:[directoryRow(A,1,1,3)];
  const errorOnce=kind==='recovery';
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:40px;font-family:Arial,sans-serif}#clientCompanyGrid{display:grid;grid-template-columns:repeat(${contexts.length},360px);gap:24px;align-items:start}.company-switch-card{box-sizing:border-box;width:360px;min-height:300px;padding:20px;border:1px solid #999;border-radius:12px}.metric{display:flex;justify-content:space-between;padding:8px 0}.ids{display:flex;gap:8px;flex-direction:column}button{margin-top:16px}</style></head><body><section id="page-companies"><div id="clientCompanyGrid">${contexts.map((c,i)=>templateCard(c,i===0)).join('')}</div></section><script>
  window.__qaInitialRects=[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}});
  window.__qaContexts=${JSON.stringify(contexts)};
  window.__qaDirectoryBody={company_directory_source:${JSON.stringify(SOURCE)},company_directory:${JSON.stringify(rows)}};
  window.__qaDirectoryMode=${JSON.stringify(errorOnce?'error-once':'delay')};
  window.__qaRefreshCalls=0;window.__qaPending=[];window.__qaSubscribers=[];window.__qaCurrent={...window.__qaContexts[0]};
  const clone=v=>JSON.parse(JSON.stringify(v));
  function projection(){const c=window.__qaCurrent;return{contract:{client_id:c.client_id,contract_id:c.contract_id,legal_name:c.legal_name,current_external_contract_number:c.current_external_contract_number},client:{client_id:c.client_id,legal_name:c.legal_name},context:{client_id:c.client_id,contract_id:c.contract_id},company_metrics:{applications_total:99,deals_total:99,documents_total:99,source:'LEGACY_SHOULD_NOT_OWN',documents_predicate:${JSON.stringify(PREDICATE)}}}}
  function delayed(){return new Promise((resolve,reject)=>window.__qaPending.push({resolve,reject}))}
  window.__qaResolveDirectory=()=>{const p=window.__qaPending.shift();if(!p)throw new Error('NO_PENDING_DIRECTORY_REQUEST');p.resolve(clone(window.__qaDirectoryBody))};
  window.__qaRejectDirectory=()=>{const p=window.__qaPending.shift();if(!p)throw new Error('NO_PENDING_DIRECTORY_REQUEST');p.reject(new Error('QA_DIRECTORY_DELAYED_FAILURE'))};
  window.__qaSelect=(client_id,contract_id)=>{const next=window.__qaContexts.find(x=>x.client_id===client_id&&x.contract_id===contract_id);if(!next)throw new Error('UNKNOWN_QA_CONTEXT');window.__qaCurrent={...next};for(const fn of [...window.__qaSubscribers])fn(clone(window.__qaCurrent));window.dispatchEvent(new CustomEvent('rona:client-context-changed',{detail:clone(window.__qaCurrent)}));window.dispatchEvent(new CustomEvent('rona:client-current-projection',{detail:projection()}));return clone(window.__qaCurrent)};
  window.RONA_CLIENT_CONTEXT={
    whenReady:async()=>clone(window.__qaCurrent),
    getAuthorizedContexts:()=>clone(window.__qaContexts),
    getCurrentContext:()=>clone(window.__qaCurrent),
    getCurrentProjection:()=>projection(),
    getCompanyDirectory:()=>null,
    whenCompanyDirectory:async()=>delayed(),
    refreshCompanyDirectory:async()=>{window.__qaRefreshCalls++;if(window.__qaDirectoryMode==='error-once'){window.__qaDirectoryMode='delay';await new Promise(r=>setTimeout(r,80));throw new Error('QA_DIRECTORY_FIRST_FAILURE')}return delayed()},
    subscribe:fn=>{window.__qaSubscribers.push(fn);return()=>{window.__qaSubscribers=window.__qaSubscribers.filter(x=>x!==fn)}},
    select:(client_id,contract_id)=>window.__qaSelect(client_id,contract_id),
    request:async()=>({ok:false,code:'QA_NO_LEGACY_REQUEST'})
  };
</script><script src="/assets/portal-runtime/portal-client-company-directory-authority-v1.js"></script><script src="/assets/portal-runtime/client-contract-download-v3.js"></script></body></html>`;
}

function dealFields(){const kinds=['identity','stage','product','quantity','price','amount','basis','station','resource','next'];return kinds.map(k=>`<div data-rona-command-field="${k}"><span>${k}</span><b data-rona-command-field-value></b></div>`).join('')}
function resourceFixture(){
  const A={client_id:ACCEPTANCE.client_id,contract_id:ACCEPTANCE.contract_id};
  const C={client_id:B.client_id,contract_id:B.contract_id};
  const projections={};
  for(const x of [A,C])projections[`${x.client_id}|${x.contract_id}`]={contract:{client_id:x.client_id,contract_id:x.contract_id,legal_name:x.client_id},client:{client_id:x.client_id,legal_name:x.client_id},context:{client_id:x.client_id,contract_id:x.contract_id},applications:[{deal_id:ACCEPTANCE.deal_id,product:'ДТ',quantity_tonnes:490,proposed_price:740,proposed_currency:'USD',delivery_basis:'DAP',destination:'QA'}],deals:[{deal_id:ACCEPTANCE.deal_id,business_status:'EXECUTING',current_status:'EXECUTING',current_status_label:'В исполнении',resource_status:'RESOURCE_DENIED',resource_label:'STALE DEAL PROJECTION MUST NOT WIN',passport_amount:362600,passport_currency:'USD',passport_amount_source:'FINALIZED_APPLICATION_COMMERCIAL_TERMS',updated_at:'2026-09-11T00:00:00Z'}]};
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif}#page-deals,.rona-deal-command-center-v3{display:block}.rona-deal-command-center-v3{width:700px;min-height:400px;border:1px solid #999;padding:12px}</style></head><body><section id="page-deals" class="active"></section><div class="rona-deal-command-center-v3" data-rona-deal-passport="true" data-rona-authoritative-context="${A.client_id}|${A.contract_id}" data-rona-authoritative-deal-id="${ACCEPTANCE.deal_id}"><div>Паспорт сделки</div><h3 data-rona-command-heading>${ACCEPTANCE.deal_id}</h3>${dealFields()}</div><script>
  window.__qaResourceContexts=${JSON.stringify([A,C])};window.__qaResourceCurrent={...window.__qaResourceContexts[0]};window.__qaResourceSubscribers=[];window.__qaResourceProjections=${JSON.stringify(projections)};
  const key=v=>v.client_id+'|'+v.contract_id;const clone=v=>JSON.parse(JSON.stringify(v));
  function projection(){return clone(window.__qaResourceProjections[key(window.__qaResourceCurrent)])}
  window.__qaResourceSelect=(client_id,contract_id)=>{const next=window.__qaResourceContexts.find(x=>x.client_id===client_id&&x.contract_id===contract_id);if(!next)throw new Error('UNKNOWN_RESOURCE_CONTEXT');window.__qaResourceCurrent={...next};const drawer=document.querySelector('.rona-deal-command-center-v3');drawer.dataset.ronaAuthoritativeContext=key(next);for(const fn of [...window.__qaResourceSubscribers])fn(clone(next));window.dispatchEvent(new CustomEvent('rona:client-context-changed',{detail:clone(next)}));window.dispatchEvent(new CustomEvent('rona:client-current-projection',{detail:projection()}));return clone(next)};
  window.RONA_CLIENT_CONTEXT={whenReady:async()=>clone(window.__qaResourceCurrent),getCurrentContext:()=>clone(window.__qaResourceCurrent),getCurrentProjection:()=>projection(),subscribe:fn=>{window.__qaResourceSubscribers.push(fn);return()=>{window.__qaResourceSubscribers=window.__qaResourceSubscribers.filter(x=>x!==fn)}}};
</script><script src="/assets/portal-runtime/client-deals-authoritative-v1.js"></script><script src="/assets/portal-runtime/client-deal-lifecycle-v1.js"></script></body></html>`;
}

function realization(status){
  const resource=status==='RESOURCE_CONFIRMED'?{state:'DONE',detail:'Ресурс подтверждён'}:status==='RESOURCE_DENIED'?{state:'BLOCKED',detail:'Ресурс не подтверждён'}:{state:'CURRENT',detail:'Ресурс ожидает подтверждения'};
  const stages=[{key:'contract',state:'DONE',detail:'Сделка зарегистрирована'},{key:'documents',state:'DONE',detail:'Документы подписаны'},{key:'resource',...resource},{key:'payment',state:status==='RESOURCE_PENDING'?'PENDING':'CURRENT',detail:'Ожидается оплата'},{key:'logistics',state:'PENDING',detail:'Отгрузка ещё не начата'},{key:'close',state:'PENDING',detail:'Закрытие предстоит'}];
  return{source:REALIZATION,completed_count:stages.filter(x=>x.state==='DONE').length,total_count:6,current_stage_key:stages.find(x=>x.state==='CURRENT')?.key||null,has_blocker:stages.some(x=>x.state==='BLOCKED'),stages};
}
function workflowPayload(status){return{ok:true,deals:[{deal_id:ACCEPTANCE.deal_id,realization_status:realization(status)}]}}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    if(u.pathname==='/portal/client'){
      const qa=u.searchParams.get('qa')||'company-one';
      const body=qa==='resource'?resourceFixture():companyFixture(qa==='company-multi'?'multi':qa==='company-recovery'?'recovery':'one');
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(body);return;
    }
    const relative=decodeURIComponent(u.pathname).replace(/^\/+/,''),file=normalize(join(DIST,relative));
    if(!file.startsWith(normalize(DIST)))throw new Error('PATH_ESCAPE');
    const data=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
  }catch(error){res.writeHead(404,{'content-type':'text/plain'});res.end(String(error?.message||error))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address(),origin=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true});
const proof={suite:'ISSUE430_RESOURCE_COMPANY_BROWSER_V1',browser:'chromium',acceptance:ACCEPTANCE,company:{},resource:{}};

async function cardSnapshot(page){return page.evaluate(()=>[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].map(card=>{const r=card.getBoundingClientRect(),metric=slot=>card.querySelector(`[data-rona-company-factory-slot="${slot}"]`)?.textContent?.trim()||null,button=card.querySelector('[data-rona-company-factory-slot="action"]');return{client_id:card.dataset.ronaClientId||null,contract_id:card.dataset.ronaClientContractId||null,hydration:card.dataset.ronaCompanyDirectoryHydration||null,source:card.dataset.ronaCompanyDirectorySource||null,predicate:card.dataset.ronaCompanyDirectoryDocumentsPredicate||null,current:card.dataset.ronaCompanyCurrent||null,action:button?.textContent?.trim()||null,applications:metric('applications'),deals:metric('deals'),documents:metric('documents'),rect:{x:r.x,y:r.y,width:r.width,height:r.height}}}))}
async function waitFor(page,fn,arg,label,timeout=10000){const start=Date.now();while(Date.now()-start<timeout){const value=await page.evaluate(fn,arg).catch(()=>null);if(value)return value;await sleep(50)}fail(`${label}_TIMEOUT`)}
async function resolveDirectoryWhenPending(page){await waitFor(page,()=>window.__qaPending?.length>0,null,'DIRECTORY_REQUEST_PENDING');await page.evaluate(()=>window.__qaResolveDirectory())}
function assertGeometry(initial,cards,label){assert(initial.length===cards.length,`${label}_COUNT_CHANGED`);for(let i=0;i<initial.length;i++)assert(rectClose(initial[i],cards[i].rect),`${label}_RECT_${i}_CHANGED ${JSON.stringify({initial:initial[i],actual:cards[i].rect})}`)}

try{
  {
    const context=await browser.newContext();const page=await context.newPage();
    await page.goto(`${origin}/portal/client?qa=company-one`,{waitUntil:'domcontentloaded'});
    await waitFor(page,()=>Boolean(window.__RONA_CLIENT_COMPANY_DIRECTORY_AUTHORITY__),null,'COMPANY_AUTHORITY_CLAIM');
    await waitFor(page,()=>document.documentElement.dataset.ronaClientCompanyDirectoryAtomic==='pending'&&document.querySelector('[data-rona-company-directory-hydration="loading"]'),null,'COMPANY_PENDING_SHELL');
    const initial=await page.evaluate(()=>window.__qaInitialRects),pending=await cardSnapshot(page);
    assert(pending.length===1,'COLD_PENDING_CARD_COUNT');assert(pending[0].applications==='…'&&pending[0].deals==='…'&&pending[0].documents==='…','COLD_PENDING_METRICS_NOT_LOADING_SHELL');assert(![pending[0].applications,pending[0].deals,pending[0].documents].includes('—'),'COLD_PENDING_LEGACY_DASH_VISIBLE');assertGeometry(initial,pending,'COLD_PENDING');
    await resolveDirectoryWhenPending(page);
    await waitFor(page,()=>document.documentElement.dataset.ronaClientCompanyDirectoryAtomic==='true'&&document.querySelector('[data-rona-company-directory-hydration="ready"]'),null,'COMPANY_READY');
    const ready=await cardSnapshot(page);assert(ready[0].client_id===ACCEPTANCE.client_id&&ready[0].contract_id===ACCEPTANCE.contract_id,'COLD_READY_SCOPE');assert(ready[0].applications==='1'&&ready[0].deals==='1'&&ready[0].documents==='3','COLD_READY_KPI');assert(ready[0].source===SOURCE&&ready[0].predicate===PREDICATE,'COLD_READY_AUTHORITY');assert(ready[0].current==='true'&&ready[0].action==='Текущая компания','COLD_READY_CURRENT_MARKER');assertGeometry(initial,ready,'COLD_READY');
    proof.company.cold_load={pending,ready,geometry_stable:true,legacy_runtime:String(await page.evaluate(()=>window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__||''))};
    const cdp=await context.newCDPSession(page);await cdp.send('Network.clearBrowserCache');await page.reload({waitUntil:'domcontentloaded'});
    await waitFor(page,()=>document.documentElement.dataset.ronaClientCompanyDirectoryAtomic==='pending'&&document.querySelector('[data-rona-company-directory-hydration="loading"]'),null,'HARD_REFRESH_PENDING');const hardInitial=await page.evaluate(()=>window.__qaInitialRects),hardPending=await cardSnapshot(page);assertGeometry(hardInitial,hardPending,'HARD_REFRESH_PENDING');await resolveDirectoryWhenPending(page);await waitFor(page,()=>document.documentElement.dataset.ronaClientCompanyDirectoryAtomic==='true',null,'HARD_REFRESH_READY');const hardReady=await cardSnapshot(page);assert(hardReady[0].applications==='1'&&hardReady[0].deals==='1'&&hardReady[0].documents==='3','HARD_REFRESH_KPI');assertGeometry(hardInitial,hardReady,'HARD_REFRESH_READY');proof.company.hard_refresh={pending:hardPending,ready:hardReady,geometry_stable:true};await context.close();
  }
  {
    const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/portal/client?qa=company-recovery`,{waitUntil:'domcontentloaded'});await waitFor(page,()=>document.querySelector('[data-rona-company-directory-hydration="error"]'),null,'RECOVERY_ERROR_SHELL');const initial=await page.evaluate(()=>window.__qaInitialRects),error=await cardSnapshot(page);assert(error[0].applications==='…'&&error[0].deals==='…'&&error[0].documents==='…','RECOVERY_ERROR_METRICS');assertGeometry(initial,error,'RECOVERY_ERROR');await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await resolveDirectoryWhenPending(page);await waitFor(page,()=>document.documentElement.dataset.ronaClientCompanyDirectoryAtomic==='true',null,'RECOVERY_READY');const ready=await cardSnapshot(page);assert(ready[0].applications==='1'&&ready[0].deals==='1'&&ready[0].documents==='3','RECOVERY_READY_KPI');assertGeometry(initial,ready,'RECOVERY_READY');proof.company.delayed_recovery={error,ready,geometry_stable:true};await context.close();
  }
  {
    const context=await browser.newContext();const page=await context.newPage();await page.goto(`${origin}/portal/client?qa=company-multi`,{waitUntil:'domcontentloaded'});await waitFor(page,()=>document.querySelectorAll('[data-rona-company-directory-hydration="loading"]').length===2,null,'MULTI_PENDING');const initial=await page.evaluate(()=>window.__qaInitialRects),pending=await cardSnapshot(page);assertGeometry(initial,pending,'MULTI_PENDING');await page.evaluate(({c,k})=>window.__qaSelect(c,k),{c:B.client_id,k:B.contract_id});await page.evaluate(({c,k})=>window.__qaSelect(c,k),{c:ACCEPTANCE.client_id,k:ACCEPTANCE.contract_id});await resolveDirectoryWhenPending(page);await waitFor(page,()=>document.documentElement.dataset.ronaClientCompanyDirectoryAtomic==='true',null,'MULTI_READY');const ready=await cardSnapshot(page);assertGeometry(initial,ready,'MULTI_READY');assert(ready.find(x=>x.client_id===ACCEPTANCE.client_id)?.applications==='1'&&ready.find(x=>x.client_id===ACCEPTANCE.client_id)?.deals==='1'&&ready.find(x=>x.client_id===ACCEPTANCE.client_id)?.documents==='3','MULTI_A_KPI');assert(ready.filter(x=>x.current==='true').length===1&&ready.find(x=>x.current==='true')?.client_id===ACCEPTANCE.client_id,'MULTI_A_CURRENT');await page.evaluate(({c,k})=>window.__qaSelect(c,k),{c:B.client_id,k:B.contract_id});await waitFor(page,c=>{const cards=[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')];return cards.filter(x=>x.dataset.ronaCompanyCurrent==='true').length===1&&cards.find(x=>x.dataset.ronaCompanyCurrent==='true')?.dataset.ronaClientId===c},B.client_id,'MULTI_B_CURRENT');const bState=await cardSnapshot(page);assertGeometry(initial,bState,'MULTI_B_GEOMETRY');assert(bState.find(x=>x.client_id===ACCEPTANCE.client_id)?.applications==='1','MULTI_B_STALE_A_KPI');await page.evaluate(({c,k})=>window.__qaSelect(c,k),{c:ACCEPTANCE.client_id,k:ACCEPTANCE.contract_id});await waitFor(page,c=>[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].find(x=>x.dataset.ronaCompanyCurrent==='true')?.dataset.ronaClientId===c,ACCEPTANCE.client_id,'MULTI_A_RETURN_CURRENT');const returned=await cardSnapshot(page);assertGeometry(initial,returned,'MULTI_A_RETURN_GEOMETRY');assert(returned.find(x=>x.client_id===ACCEPTANCE.client_id)?.applications==='1'&&returned.find(x=>x.client_id===ACCEPTANCE.client_id)?.deals==='1'&&returned.find(x=>x.client_id===ACCEPTANCE.client_id)?.documents==='3','MULTI_A_RETURN_KPI');proof.company.multi_context={pending,ready,b:bState,a_return:returned,geometry_stable:true};await context.close();
  }

  async function runResourceCase(status){const context=await browser.newContext();const page=await context.newPage();await page.route('**/portal/api/v1/client/deal-documents/state?**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(workflowPayload(status))}));await page.goto(`${origin}/portal/client?qa=resource`,{waitUntil:'domcontentloaded'});const open=page.locator(`[data-open-deal="${ACCEPTANCE.deal_id}"]`).first();await open.waitFor({state:'visible',timeout:10000});await open.click();await waitFor(page,s=>document.querySelector('[data-rona-command-field="resource"]')?.dataset.ronaResourceStatus===s,status,`RESOURCE_${status}_PASSPORT`);await waitFor(page,()=>Boolean(document.querySelector('#rona-deal-realization-flow-v3 [data-lifecycle-stage="resource"]')),null,`RESOURCE_${status}_TIMELINE`);const snap=await page.evaluate(()=>{const field=document.querySelector('[data-rona-command-field="resource"]'),stage=document.querySelector('#rona-deal-realization-flow-v3 [data-lifecycle-stage="resource"]');return{passport_status:field?.dataset.ronaResourceStatus||'',passport_authority:field?.dataset.ronaResourceAuthority||'',passport_label:field?.querySelector('[data-rona-command-field-value]')?.textContent?.trim()||'',timeline_class:stage?.className||'',timeline_text:stage?.textContent?.replace(/\s+/g,' ').trim()||''}});assert(snap.passport_authority===REALIZATION,`${status}_PASSPORT_AUTHORITY`);if(status==='RESOURCE_CONFIRMED'){assert(snap.passport_label==='Ресурс подтверждён',`${status}_PASSPORT_LABEL`);assert(snap.timeline_class.includes('is-done')&&snap.timeline_text.includes('Ресурс подтверждён'),`${status}_TIMELINE_DONE`)}else if(status==='RESOURCE_DENIED'){assert(snap.passport_label==='Ресурс не подтверждён',`${status}_PASSPORT_LABEL`);assert(snap.timeline_class.includes('is-blocked')&&snap.timeline_text.includes('Ресурс не подтверждён'),`${status}_TIMELINE_BLOCKED`)}else{assert(snap.passport_label==='Ресурс ожидает подтверждения',`${status}_PASSPORT_LABEL`);assert(snap.timeline_class.includes('is-current')&&snap.timeline_text.includes('Ресурс ожидает подтверждения'),`${status}_TIMELINE_PENDING`)}await context.close();return snap}
  proof.resource.confirmed=await runResourceCase('RESOURCE_CONFIRMED');proof.resource.pending=await runResourceCase('RESOURCE_PENDING');proof.resource.denied=await runResourceCase('RESOURCE_DENIED');

  {
    const context=await browser.newContext();const page=await context.newPage();let firstA=true,releaseFirstA,firstASeen;const firstSeen=new Promise(r=>firstASeen=r),release=new Promise(r=>releaseFirstA=r);await page.route('**/portal/api/v1/client/deal-documents/state?**',async route=>{const u=new URL(route.request().url()),clientId=u.searchParams.get('clientId');if(clientId===ACCEPTANCE.client_id&&firstA){firstA=false;firstASeen();await release;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(workflowPayload('RESOURCE_DENIED'))})}return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(workflowPayload('RESOURCE_CONFIRMED'))})});await page.goto(`${origin}/portal/client?qa=resource`,{waitUntil:'domcontentloaded'});let open=page.locator(`[data-open-deal="${ACCEPTANCE.deal_id}"]`).first();await open.waitFor({state:'visible',timeout:10000});await open.click();await firstSeen;await page.evaluate(({c,k})=>window.__qaResourceSelect(c,k),{c:B.client_id,k:B.contract_id});await waitFor(page,c=>window.RONA_CLIENT_CONTEXT.getCurrentContext().client_id===c,B.client_id,'RESOURCE_STALE_B_CONTEXT');await page.evaluate(({c,k})=>window.__qaResourceSelect(c,k),{c:ACCEPTANCE.client_id,k:ACCEPTANCE.contract_id});await waitFor(page,c=>window.RONA_CLIENT_CONTEXT.getCurrentContext().client_id===c,ACCEPTANCE.client_id,'RESOURCE_STALE_A_RETURN');open=page.locator(`[data-open-deal="${ACCEPTANCE.deal_id}"]`).first();await open.waitFor({state:'visible',timeout:10000});await open.click();await waitFor(page,()=>document.querySelector('[data-rona-command-field="resource"]')?.dataset.ronaResourceStatus==='RESOURCE_CONFIRMED',null,'RESOURCE_STALE_FINAL_CONFIRMED');releaseFirstA();await sleep(250);const snap=await page.evaluate(()=>({status:document.querySelector('[data-rona-command-field="resource"]')?.dataset.ronaResourceStatus||'',label:document.querySelector('[data-rona-command-field="resource"] [data-rona-command-field-value]')?.textContent?.trim()||'',context:document.querySelector('.rona-deal-command-center-v3')?.dataset.ronaAuthoritativeContext||''}));assert(snap.status==='RESOURCE_CONFIRMED'&&snap.label==='Ресурс подтверждён','RESOURCE_STALE_RESPONSE_OVERWROTE_CURRENT');assert(snap.context===`${ACCEPTANCE.client_id}|${ACCEPTANCE.contract_id}`,'RESOURCE_STALE_CONTEXT_MISMATCH');proof.resource.stale_a_b_a=snap;await context.close();
  }

  proof.pass=true;
  await writeFile('issue430-resource-company-browser-proof.json',JSON.stringify(proof,null,2));
  console.log('ISSUE430_REAL_BROWSER_QA=PASS');
  console.log('RESOURCE_AUTHORITY_CONFIRMED_PENDING_DENIED=PASS');
  console.log('RESOURCE_STALE_A_B_A=PASS');
  console.log('MY_COMPANIES_COLD_LOAD=PASS');
  console.log('MY_COMPANIES_HARD_REFRESH=PASS');
  console.log('MY_COMPANIES_DELAYED_RECOVERY=PASS');
  console.log('MY_COMPANIES_A_B_A=PASS');
  console.log('RONA_C005_KPI=1/1/3');
  console.log('COMPANY_CARD_GEOMETRY_STABLE=PASS');
} finally {
  await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve));
}
