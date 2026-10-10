import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const home=readFileSync('assets/portal-runtime/client-home-command-center-v2.js','utf8');
const freeze=JSON.parse(readFileSync('governance/client-home-live-source-refresh-v1-20261010.json','utf8'));
for(const token of [
  "HOME_LIVE_FRESHNESS_V1='20261010-client-home-live-freshness-v1'",
  'SOURCE_REFRESH_MS=30000',
  "authority.invalidateCurrentProjection()",
  "authority.whenCurrentProjection(forceFresh",
  "window.setInterval(()=>refreshVisible('timer'),SOURCE_REFRESH_MS)",
  "document.visibilityState!=='visible'",
  "if(contextKey(authority.getCurrentContext?.())!==key)return",
  "if(contextKey(contextAuthority()?.getCurrentContext?.())!==key)queueMicrotask(schedule)",
  "root?.querySelectorAll('[data-open-deal]')"
])assert.ok(home.includes(token),'Missing current-only refresh contract: '+token);
for(const forbidden of ['RONA-C001','UNIVERSAL SOLYARIS','DEAL-2026-004'])assert.ok(!home.includes(forbidden));
assert.equal(freeze.requirements.no_business_calculation_changes,true);
assert.equal(freeze.requirements.exact_blob_enforcement,true);
assert.equal(freeze.requirements.wildcard_exception,false);

const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1320,height:860}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message||e)));
await page.clock.install({time:new Date('2026-10-10T17:00:00Z')});
await page.addInitScript(()=>{
  const listeners=new Set();
  const contextA={client_id:'QA-CLIENT-A',contract_id:'QA-CONTRACT-A'};
  const contextB={client_id:'QA-CLIENT-B',contract_id:'QA-CONTRACT-B'};
  let selected=contextA,cache=null,failNext=false,networkCalls=0,invalidations=0;
  const generate=(ctx,value)=>({
    contract:{client_id:ctx.client_id,contract_id:ctx.contract_id,legal_name:ctx.client_id},
    deals:[{deal_id:ctx.client_id==='QA-CLIENT-A'?'QA-DEAL-A':'QA-DEAL-B',
      current_status:'ACTIVE',current_status_label:'Сделка зарегистрирована',
      resource_status:'CONFIRMED',resource_label:'Ресурс подтверждён',
      payment_status:value>300?'PARTIALLY_PAID':'WAITING',
      payment_label:value>300?'Оплачено частично':'Ожидается оплата',
      payment_obligation_amount:1000,payment_received_amount:value,payment_currency:'USD'}],
    applications:[{deal_id:ctx.client_id==='QA-CLIENT-A'?'QA-DEAL-A':'QA-DEAL-B',quantity_tonnes:125,product:'АИ-95'}],
    payments:[],
    generated_at:new Date().toISOString()
  });
  const values={A:150,B:80};
  const key=()=>selected.client_id==='QA-CLIENT-A'?'A':'B';
  const copy=x=>structuredClone(x);
  window.RONA_CLIENT_CONTEXT={
    getCurrentContext:()=>copy(selected),
    whenReady:async()=>copy(selected),
    subscribe:fn=>{listeners.add(fn);queueMicrotask(()=>fn(copy(selected)));return()=>listeners.delete(fn)},
    getCurrentProjection:()=>cache?copy(cache):null,
    invalidateCurrentProjection:()=>{cache=null;invalidations++},
    whenCurrentProjection:async()=>{
      if(cache)return copy(cache);
      networkCalls++;
      if(failNext){failNext=false;throw new Error('QA_AUTHORITATIVE_SOURCE_UNAVAILABLE')}
      const ctx=copy(selected),v=values[key()];
      await Promise.resolve();
      if(selected.contract_id!==ctx.contract_id)throw new Error('QA_CONTEXT_CHANGED');
      cache=generate(ctx,v);
      window.dispatchEvent(new CustomEvent('rona:client-current-projection',{
        detail:{client_id:ctx.client_id,contract_id:ctx.contract_id,source:'fixture-authorized-network'}
      }));
      return copy(cache);
    }
  };
  window.__QA_HOME={
    setReceived:value=>{values[key()]=value},
    switchContext:()=>{selected=selected.client_id==='QA-CLIENT-A'?contextB:contextA;cache=null;for(const fn of listeners)fn(copy(selected))},
    errorNext:()=>{failNext=true},
    counters:()=>({networkCalls,invalidations,selected:selected.client_id}),
    getCache:()=>cache?copy(cache):null
  };
  window.addEventListener('DOMContentLoaded',()=>{
    const nav=document.querySelector('#navDeals');
    nav.addEventListener('click',()=>{
      document.querySelector('#page-home').style.display='none';
      document.querySelector('#page-deals').style.display='block';
      document.querySelector('#page-deals').innerHTML='<button type="button" data-open-deal="QA-DEAL-A">Открыть</button>'+
        '<button type="button" data-open-deal="QA-DEAL-B">Открыть</button>';
    });
    document.querySelector('#navHome').addEventListener('click',()=>{
      document.querySelector('#page-deals').style.display='none';
      document.querySelector('#page-home').style.display='block';
    });
    document.querySelector('#page-deals').addEventListener('click',e=>{
      if(e.target.matches('[data-open-deal]'))window.__QA_OPENED=e.target.getAttribute('data-open-deal');
    });
  },{once:true});
});
const html='<html><head><meta charset="utf-8"><style>'+
  '#page-home,#page-deals{width:1050px;min-height:400px}'+
  '.frame{width:1010px;border:1px solid #345;border-radius:12px;padding:12px}'+
  '</style></head><body><nav><button id="navHome">Главная</button><button id="navDeals">Сделки</button></nav>'+
  '<main><section id="page-home"><div class="frame"><h1>Главная</h1></div><div class="frame"><span>Выбрана компания</span></div></section>'+
  '<section id="page-deals" style="display:none"></section></main></body></html>';
await page.route('https://rona.test/portal/client',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
await page.goto('https://rona.test/portal/client',{waitUntil:'domcontentloaded'});
await page.addScriptTag({path:resolve('assets/portal-runtime/client-home-command-center-v2.js')});
await page.waitForFunction(()=>document.querySelector('[data-rona-client-home-owner] .rona-cc-kpis')!==null);
await page.addScriptTag({path:resolve('assets/portal-runtime/client-home-current-only-v1.js')});
await page.addScriptTag({path:resolve('assets/portal-runtime/client-home-actions-polish-v1.js')});
const snapshot=()=>page.evaluate(()=>({
  labels:[...document.querySelectorAll('.rona-cc-kpi-value')].map(x=>x.textContent.trim()),
  ready:document.documentElement.getAttribute('data-rona-client-home-ready'),
  status:document.documentElement.getAttribute('data-rona-client-home-state'),
  error:document.documentElement.getAttribute('data-rona-client-home-degraded'),
  markers:window.__RONA_CLIENT_HOME_STATE__||null,
  owner:document.querySelectorAll('[data-rona-client-home-owner]').length,
  counters:window.__QA_HOME.counters()
}));
const initial=await snapshot();
assert.ok(initial.labels[2].includes('150'),'initial authorized amount missing '+JSON.stringify(initial));
assert.equal(initial.counters.networkCalls,1,'first context fetch must be coalesced');
console.log('HOME_V1_INITIAL_CURRENT_CONTEXT=PASS');

await page.evaluate(()=>window.__QA_HOME.setReceived(420));
await page.clock.fastForward(31000);
await page.waitForFunction(()=>[...document.querySelectorAll('.rona-cc-kpi-value')][2]?.textContent.includes('420'),null,{timeout:5000});
const refreshed=await snapshot();
assert.equal(refreshed.counters.networkCalls,2,'no actual fresh network roundtrip on 30sec timer');
assert.equal(refreshed.counters.invalidations,1,'central current projection was not invalidated');
assert.equal(refreshed.status,'ready','healthy refresh should remain ready');
assert.equal(refreshed.markers.refresh_ms,30000);
console.log('HOME_V1_REAL_30S_SOURCE_REFRESH=PASS');

await page.click('[data-home-action="deal"][data-deal-id="QA-DEAL-A"]');
await page.waitForFunction(()=>window.__QA_OPENED==='QA-DEAL-A',null,{timeout:5200});
console.log('HOME_V1_CANONICAL_EXACT_DEAL_NAV=PASS');
const callsBeforeHidden=(await snapshot()).counters.networkCalls;
await page.clock.fastForward(31000);
assert.equal((await snapshot()).counters.networkCalls,callsBeforeHidden,'Home must not poll while hidden');
console.log('HOME_V1_HIDDEN_HOME_NO_POLL=PASS');

await page.click('#navHome');
await page.waitForFunction(()=>document.querySelector('#page-home').style.display!=='none');
await page.waitForFunction(()=>window.__QA_HOME.counters().networkCalls>2,null,{timeout:5200});
await page.evaluate(()=>window.__QA_HOME.switchContext());
await page.waitForFunction(()=>document.querySelector('[data-rona-client-home-owner]')?.textContent.includes('QA-DEAL-B'),null,{timeout:5200});
const switched=await snapshot();
assert.ok(!JSON.stringify(switched.labels).includes('420'),'old tenant value leaked');
assert.equal(switched.markers.client_id,'QA-CLIENT-B');
console.log('HOME_V1_TENANT_SWITCH_FAIL_CLOSED=PASS');

await page.evaluate(()=>{
  window.__QA_HOME.errorNext();
  window.dispatchEvent(new Event('rona:client-home-invalidated'));
});
await page.waitForFunction(()=>document.documentElement.getAttribute('data-rona-client-home-state')==='error',null,{timeout:5000});
await page.waitForFunction(()=>document.querySelector('[data-rona-client-home-owner]')?.textContent.includes('не удалось'),null,{timeout:5000}).catch(()=>{});
const failed=await snapshot();
assert.equal(failed.status,'error');
assert.ok(!failed.labels.some(x=>x.includes('420')||x.includes('80')),'old numbers survived source failure: '+JSON.stringify(failed));
console.log('HOME_V1_ERROR_FAIL_CLOSED=PASS');
assert.deepEqual(errors,[],'Browser script errors');
await browser.close();
console.log('CLIENT_HOME_LIVE_REFRESH_V1_QA=PASS');