import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const dist=p=>path.resolve(ROOT,'dist',p);
const runtime=p=>dist(`assets/portal-runtime/${p}`);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function projection(ctx,deals=[]){
  return {
    client_id:ctx.client_id,
    contract_id:ctx.contract_id,
    client:{client_id:ctx.client_id,legal_name:ctx.legal_name},
    contract:{client_id:ctx.client_id,contract_id:ctx.contract_id,current_external_contract_number:ctx.external},
    context:{client_id:ctx.client_id,contract_id:ctx.contract_id,legal_name:ctx.legal_name,current_external_contract_number:ctx.external},
    deals:deals.map((deal_id,index)=>({deal_id,client_id:ctx.client_id,contract_id:ctx.contract_id,current_status:'ACTIVE',current_status_label:'Активна',resource_status:'RESOURCE_CONFIRMED',resource_status_label:'Ресурс подтвержден',payment_status:'OPEN',payment_label:'Открыта',payment_obligation_amount:1000+index,payment_currency:'USD'})),
    applications:deals.map((deal_id,index)=>({deal_id,client_id:ctx.client_id,contract_id:ctx.contract_id,product:`PRODUCT-${index+1}`,quantity_tonnes:100+index,proposed_price:700+index,proposed_currency:'USD',delivery_basis:'CPT',destination:`STATION-${index+1}`}))
  };
}

async function proveHome(browser){
  const ctx={client_id:'CLIENT-A',contract_id:'CONTRACT-A',legal_name:'ALPHA INDUSTRIES LLC',external:'EXT-A'};
  const data=projection(ctx,['DEAL-2099-101']);
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  await page.route('https://rona.test/portal/api/v1/client/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/bootstrap'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{contexts:[ctx],current_context:{client_id:ctx.client_id,contract_id:ctx.contract_id}}})});
    if(url.pathname.endsWith('/context'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{}})});
  });
  const html=`<!doctype html><html><head><style id="rona-client-home-first-paint-guard" media="not all">#page-home{display:none!important}</style></head><body><select id="clientContextSelect"></select><main><section id="page-home"><section><h1>Главная</h1></section><section><span>Выбрана компания</span><span data-rona-context-client></span></section><section data-rona-client-home-owner="command-center-v2"></section></section></main><script>var CLIENT_CONTEXTS={};var activeClientContractId='';window.renderClientContext=function(){};</script></body></html>`;
  await page.route('https://rona.test/portal/client',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://rona.test/portal/client',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({path:runtime('client-context-selection-authority-v1.js')});
  await page.addScriptTag({path:runtime('client-home-command-center-v2.js')});
  await page.waitForFunction(()=>document.documentElement.getAttribute('data-rona-client-home-ready')==='true'&&window.__RONA_CLIENT_HOME_STATE__?.client_id==='CLIENT-A'&&window.__RONA_CLIENT_HOME_STATE__?.contract_id==='CONTRACT-A',{timeout:4000});
  const before=await page.evaluate(()=>({text:document.querySelector('[data-rona-client-home-owner="command-center-v2"]')?.textContent||'',font:getComputedStyle(document.querySelector('.rona-cc-live-title')).fontSize}));
  assert(!before.text.includes('Загрузка центра управления'),'command center did not reach real ready before guard');
  assert.equal(before.font,'11px','Home explicit typography is not +10% from the approved 10px baseline');
  const started=Date.now();
  await page.addScriptTag({path:runtime('client-home-current-only-v1.js')});
  await page.waitForFunction(()=>document.documentElement.getAttribute('data-rona-client-home-ready')==='true'&&document.documentElement.getAttribute('data-rona-client-home-prepaint')==='released'&&!document.querySelector('[data-rona-client-home-owner="command-center-v2"]')?.textContent.includes('Загрузка центра управления'),{timeout:1500});
  const timing=Date.now()-started;
  const after=await page.evaluate(()=>({
    state:document.documentElement.getAttribute('data-rona-client-home-state'),
    ready:document.documentElement.getAttribute('data-rona-client-home-ready'),
    release:document.documentElement.getAttribute('data-rona-client-home-prepaint-release'),
    home:window.__RONA_CLIENT_HOME_STATE__,
    neutral:document.querySelector('[data-rona-client-home-owner="command-center-v2"]')?.getAttribute('data-rona-client-home-neutral')||''
  }));
  assert.equal(after.state,'ready');
  assert.equal(after.ready,'true');
  assert.equal(after.home.client_id,ctx.client_id);
  assert.equal(after.home.contract_id,ctx.contract_id);
  assert.equal(after.neutral,'');
  console.log('SINGLE_COMPANY_HOME_READY=PASS',JSON.stringify({timing_ms:timing,release:after.release,font_before_guard:before.font}));
  await page.close();
  return timing;
}

async function proveCompanyName(browser){
  const A={client_id:'CLIENT-A',contract_id:'CONTRACT-A',legal_name:'ALPHA INDUSTRIES LLC',external:'EXT-A'};
  const B={client_id:'CLIENT-B',contract_id:'CONTRACT-B',legal_name:'BETA ENERGY LLC',external:'EXT-B'};
  let current=A;
  const page=await browser.newPage({viewport:{width:1200,height:800}});
  await page.route('https://rona.test/portal/api/v1/client/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/bootstrap'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{contexts:[A,B],current_context:{client_id:current.client_id,contract_id:current.contract_id}}})});
    if(url.pathname.endsWith('/context')){
      const c=url.searchParams.get('clientId')==='CLIENT-B'?B:A;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:projection(c,[])})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{}})});
  });
  const html=`<!doctype html><html><body><select id="clientContextSelect"></select><main><section id="companyCard" data-rona-current-context-scope="company-card"><span>Текущая компания</span><strong id="companyName" data-rona-context-client></strong><span id="companyId" data-rona-context-client-id></span><span id="companyContract" data-rona-context-contract></span><span>Подписанный контракт</span></section></main><script>var CLIENT_CONTEXTS={};var activeClientContractId='';window.renderClientContext=function(){};</script></body></html>`;
  await page.route('https://rona.test/portal/client',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://rona.test/portal/client',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({path:runtime('client-context-selection-authority-v1.js')});
  await page.evaluate(async()=>{await window.RONA_CLIENT_CONTEXT.whenReady();await window.RONA_CLIENT_CONTEXT.whenCurrentProjection('owner-company-card-test')});
  await page.waitForFunction(()=>document.getElementById('companyName')?.textContent==='ALPHA INDUSTRIES LLC');
  const a=await page.evaluate(()=>({name:document.getElementById('companyName').textContent,display:getComputedStyle(document.getElementById('companyName')).display,id:document.getElementById('companyId').textContent,contract:document.getElementById('companyContract').textContent}));
  assert.equal(a.name,A.legal_name);assert.notEqual(a.display,'none');assert.equal(a.id,A.client_id);
  await page.evaluate(()=>window.RONA_CLIENT_CONTEXT.select('CLIENT-B','CONTRACT-B'));
  await page.waitForFunction(()=>document.getElementById('companyName')?.textContent==='');
  await page.evaluate(async()=>await window.RONA_CLIENT_CONTEXT.whenCurrentProjection('owner-company-card-switch'));
  await page.waitForFunction(()=>document.getElementById('companyName')?.textContent==='BETA ENERGY LLC');
  const b=await page.evaluate(()=>({name:document.getElementById('companyName').textContent,id:document.getElementById('companyId').textContent,contract:document.getElementById('companyContract').textContent,old:document.body.textContent.includes('ALPHA INDUSTRIES LLC')}));
  assert.equal(b.name,B.legal_name);assert.equal(b.id,B.client_id);assert.equal(b.old,false);
  console.log('CURRENT_COMPANY_LEGAL_NAME=PASS',JSON.stringify({A:a,B:b,source:'RONA_CLIENT_CONTEXT_CURRENT_PROJECTION'}));
  await page.close();
}

async function proveDealsAndPassport(browser){
  const A={client_id:'CLIENT-A',contract_id:'CONTRACT-A',legal_name:'ALPHA INDUSTRIES LLC',external:'EXT-A'};
  const B={client_id:'CLIENT-B',contract_id:'CONTRACT-B',legal_name:'BETA ENERGY LLC',external:'EXT-B'};
  const idsA=['DEAL-2099-101','DEAL-2099-102'];
  const idsB=['DEAL-2099-201'];
  const page=await browser.newPage({viewport:{width:1400,height:900}});
  await page.route('https://rona.test/portal/api/v1/client/deal-documents/state**',async route=>{
    const url=new URL(route.request().url());
    const client=url.searchParams.get('clientId');
    const deals=(client==='CLIENT-B'?idsB:idsA).map(deal_id=>({deal_id,realization_status:{source:'SERVER_AUTHORITATIVE_REALIZATION_V1',current_stage_key:'resource',stages:[{key:'resource',state:'CURRENT',detail:'Confirm resource'}]}}));
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,deals})});
  });
  const fieldKinds=['identity','stage','product','quantity','price','amount','basis','station','resource','next'];
  const fields=fieldKinds.map(k=>`<div data-rona-command-field="${k}"><span data-rona-command-field-value></span></div>`).join('');
  const html=`<!doctype html><html><body><main><section id="page-deals" class="active"><div id="legacyA1" data-rona-canonical-deal-id="${idsA[0]}">${idsA[0]}</div><div id="legacyA2" data-rona-canonical-deal-id="${idsA[1]}">${idsA[1]}</div></section></main><aside id="drawer" class="rona-deal-command-center-v3" data-rona-deal-passport hidden><h2>Паспорт сделки</h2><strong id="drawerId" data-rona-canonical-deal-id=""></strong><span data-rona-current-context-slot="client-name"></span><span data-rona-current-context-slot="client-id"></span><span data-rona-current-context-slot="contract-id"></span>${fields}<button id="closeDrawer">Закрыть</button></aside><script>
  window.__ctx=${JSON.stringify(A)};window.__projection=${JSON.stringify(projection(A,idsA))};window.__subscribers=[];
  window.RONA_CLIENT_CONTEXT={getCurrentContext:()=>structuredClone(window.__ctx),getCurrentProjection:()=>structuredClone(window.__projection),whenReady:async()=>structuredClone(window.__ctx),subscribe:fn=>{window.__subscribers.push(fn);queueMicrotask(()=>fn(structuredClone(window.__ctx),{source:'qa'}));return()=>{};}};
  document.addEventListener('click',e=>{const b=e.target.closest('[data-open-deal]');if(!b)return;const id=b.getAttribute('data-open-deal'),d=document.getElementById('drawer'),di=document.getElementById('drawerId');di.setAttribute('data-rona-canonical-deal-id',id);di.textContent=id;d.hidden=false;});
  document.getElementById('closeDrawer').addEventListener('click',()=>document.getElementById('drawer').hidden=true);
  window.switchCtx=(ctx,projection)=>{window.__ctx=ctx;window.__projection=projection;for(const fn of window.__subscribers)fn(structuredClone(ctx),{source:'qa-switch'});window.dispatchEvent(new CustomEvent('rona:client-current-projection',{detail:{client_id:ctx.client_id,contract_id:ctx.contract_id}}));};
  </script></body></html>`;
  await page.route('https://rona.test/portal/client',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://rona.test/portal/client',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({path:runtime('client-deals-authoritative-v1.js')});
  await page.waitForFunction(()=>document.documentElement.dataset.ronaClientDealsLiveRender==='ready'&&document.querySelectorAll('#page-deals [data-rona-deals-authoritative-rendered]').length===2);
  const unique=async expected=>page.evaluate(expected=>{
    const root=document.getElementById('page-deals');
    const rows={};for(const id of expected){const nodes=[...root.querySelectorAll(`[data-rona-canonical-deal-id="${id}"]`)].filter(n=>!n.hidden&&getComputedStyle(n).display!=='none');rows[id]={count:nodes.length,canonical:nodes.every(n=>Boolean(n.closest('[data-rona-deals-authoritative-list]')))};}return{rows,legacy:!!document.querySelector('#legacyA1,#legacyA2')};
  },expected);
  let u=await unique(idsA);for(const id of idsA){assert.equal(u.rows[id].count,1,`duplicate visible ${id}`);assert.equal(u.rows[id].canonical,true)}assert.equal(u.legacy,false,'noncanonical Deals layer survived');
  await page.click(`[data-open-deal="${idsA[0]}"]`);
  await page.waitForFunction(()=>document.getElementById('drawer')?.dataset.ronaAuthoritativeBinding==='authoritative-binding',{timeout:2500});
  const passport=await page.evaluate(()=>{const d=document.getElementById('drawer');return{hidden:d.hidden,binding:d.dataset.ronaAuthoritativeBinding,deal:d.dataset.ronaAuthoritativeDealId,client:d.dataset.ronaAuthoritativeClientId,contract:d.dataset.ronaAuthoritativeContractId,source:window.__passportEvent?.realization_status?.source||null,stage:window.__passportEvent?.realization_status?.current_stage_key||null}});
  assert.equal(passport.hidden,false);assert.equal(passport.binding,'authoritative-binding');assert.equal(passport.deal,idsA[0]);assert.equal(passport.client,A.client_id);assert.equal(passport.contract,A.contract_id);
  await page.evaluate(()=>{window.addEventListener('rona:client:deal-authoritative-detail',e=>window.__passportEvent=e.detail,{once:true})});
  await page.click('#closeDrawer');
  await page.evaluate(({B,idsB})=>{const root=document.getElementById('page-deals');const legacy=document.createElement('div');legacy.id='legacyB';legacy.setAttribute('data-rona-canonical-deal-id',idsB[0]);legacy.textContent=idsB[0];root.prepend(legacy);window.switchCtx(B,{client_id:B.client_id,contract_id:B.contract_id,client:{client_id:B.client_id,legal_name:B.legal_name},contract:{client_id:B.client_id,contract_id:B.contract_id,current_external_contract_number:B.external},context:{client_id:B.client_id,contract_id:B.contract_id,legal_name:B.legal_name},deals:[{deal_id:idsB[0],client_id:B.client_id,contract_id:B.contract_id,current_status:'ACTIVE'}],applications:[{deal_id:idsB[0],product:'PRODUCT-B'}]});},{B,idsB});
  await page.waitForFunction(id=>document.querySelectorAll(`#page-deals [data-rona-deals-authoritative-rendered][data-rona-canonical-deal-id="${id}"]`).length===1,idsB[0]);
  u=await unique(idsB);assert.equal(u.rows[idsB[0]].count,1);assert.equal(u.rows[idsB[0]].canonical,true);assert.equal(await page.locator('#legacyB').count(),0);
  await page.evaluate(({A,idsA})=>window.switchCtx(A,{client_id:A.client_id,contract_id:A.contract_id,client:{client_id:A.client_id,legal_name:A.legal_name},contract:{client_id:A.client_id,contract_id:A.contract_id,current_external_contract_number:A.external},context:{client_id:A.client_id,contract_id:A.contract_id,legal_name:A.legal_name},deals:idsA.map(deal_id=>({deal_id,client_id:A.client_id,contract_id:A.contract_id,current_status:'ACTIVE'})),applications:idsA.map(deal_id=>({deal_id,product:'PRODUCT-A'}))}),{A,idsA});
  await page.waitForFunction(()=>document.querySelectorAll('#page-deals [data-rona-deals-authoritative-rendered]').length===2);
  u=await unique(idsA);for(const id of idsA){assert.equal(u.rows[id].count,1);assert.equal(u.rows[id].canonical,true)}
  await page.click(`[data-open-deal="${idsA[0]}"]`);
  await page.waitForFunction(()=>window.__passportEvent?.dealId==='DEAL-2099-101',{timeout:2500});
  const event=await page.evaluate(()=>window.__passportEvent);
  assert.equal(event.client_id,A.client_id);assert.equal(event.contract_id,A.contract_id);assert.equal(event.realization_status.source,'SERVER_AUTHORITATIVE_REALIZATION_V1');assert.equal(event.realization_status.current_stage_key,'resource');
  console.log('DEALS_UNIQUE_RENDER=PASS',JSON.stringify({A:idsA,B:idsB,visible_per_id:1,A_B_A:true}));
  console.log('PASSPORT_NON_REGRESSION=PASS',JSON.stringify({deal:event.dealId,client:event.client_id,contract:event.contract_id,source:event.realization_status.source,stage:event.realization_status.current_stage_key}));
  await page.close();
}

async function proveTypography(browser){
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  const html='<!doctype html><html style="font-size:10px"><head></head><body><div id="outside">Outside</div><section id="page-analytics"><div id="analytics">Analytics</div></section></body></html>';
  await page.route('https://rona.test/portal/client',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://rona.test/portal/client',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({path:runtime('client-content-responsive-v1.css')});
  const sizes=await page.evaluate(()=>({body:getComputedStyle(document.body).fontSize,outside:getComputedStyle(document.getElementById('outside')).fontSize,analytics:getComputedStyle(document.getElementById('analytics')).fontSize,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}));
  assert.equal(sizes.body,'11px');assert.equal(sizes.outside,'11px');assert.equal(sizes.analytics,'10px');assert.equal(sizes.overflow,false);
  console.log('CLIENT_TYPOGRAPHY_110=PASS',JSON.stringify(sizes));
  await page.close();
}

const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
  const homeTiming=await proveHome(browser);
  await proveCompanyName(browser);
  await proveDealsAndPassport(browser);
  await proveTypography(browser);
  console.log('OWNER_TARGETED_REMEDIATION_ASSERTION_SET=PASS',JSON.stringify({home_ready_ms:homeTiming,deals_unique:true,company_legal_name:true,typography_110:true,analytics_unchanged:true,passport_preserved:true}));
} finally {
  await browser.close();
}
