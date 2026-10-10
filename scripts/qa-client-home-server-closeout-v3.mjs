import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const source=readFileSync('assets/portal-runtime/client-home-command-center-v2.js','utf8');
const approval=JSON.parse(readFileSync('governance/client-home-server-closeout-attention-v3-20261010.json','utf8'));
const backend=readFileSync('supabase/functions/rona-portal-api/payments-v8-production-hardening.ts','utf8');
const required=[
  "HOME_SERVER_CLOSEOUT_V3='20261010-client-home-server-closeout-attention-v3'",
  "d?.post_rail_completion_attention===true",
  "upper(d?.client_deal_stage)==='ATTENTION'",
  "upper(d?.client_deal_stage_source)==='RAIL_COMPLETED_AND_100_PERCENT_PAID_OWNER_RULE_V2'",
  "function latestSourceEventAt(detail)",
  "renderLivebar(loadedAt,detail)",
  "function attentionItems(deals,detail)",
  "stage=isServerCloseoutAttention(d)?"
];
for(const token of required)assert.ok(source.includes(token),'Missing server flag contract: '+token);
for(const token of ['deal.post_rail_completion_attention=closeout;',"deal.client_deal_stage='ATTENTION';","deal.client_deal_stage_source='RAIL_COMPLETED_AND_100_PERCENT_PAID_OWNER_RULE_V2';"])
  assert.ok(backend.includes(token),'Backend stage source missing: '+token);
const loadBody=source.slice(source.indexOf('async function load(forceFresh=false){'),source.indexOf('\nfunction schedule()'));
assert.ok(loadBody.indexOf('state.loading=true;')>=0&&loadBody.indexOf('state.loading=true;')<loadBody.indexOf('const ctx=await currentContext();'),'a source load must lock before awaiting context selection');
assert.ok(loadBody.includes('if(state.loading){if(forceFresh)state.refreshPending=true;return}'),'forced concurrent refresh must be coalesced');
assert.equal(approval.requirements.loading_lock_acquired_before_first_await,true);
assert.equal(approval.requirements.no_parallel_context_loads,true);
assert.equal(approval.requirements.exact_blob_enforcement,true);
assert.equal(approval.requirements.wildcard_exception,false);
assert.equal(approval.requirements.no_backend_or_rail_provider_changes,true);
assert.ok(!source.includes('Только актуальные данные выбранного договора'));
console.log('HOME_V3_SOURCE_AUTHORITY_CONTRACT=PASS');

const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1320,height:850}});
  const jsErrors=[];
  page.on('pageerror',e=>jsErrors.push(e.message));
  await page.clock.install({time:new Date('2026-10-10T18:00:00Z')});
  await page.addInitScript(()=>{
    const contexts=[
      {client_id:'QA-C001',contract_id:'QA-CTR-1'},
      {client_id:'QA-C002',contract_id:'QA-CTR-2'}
    ];
    const subs=new Set();
    let selected=0,cache=null,mode='VERIFIED',failNext=false;
    const clone=x=>JSON.parse(JSON.stringify(x));
    const create=()=>{
      const ctx=contexts[selected];
      const isA=selected===0;
      const date='2026-10-03T18:30:24Z';
      const allowed=isA&&mode==='VERIFIED';
      const sourceName=mode==='FORGED_SOURCE'?'OTHER_UNVERIFIED_RULE':'RAIL_COMPLETED_AND_100_PERCENT_PAID_OWNER_RULE_V2';
      const id=isA?'QA-DEAL-004':'QA-DEAL-010';
      return {
        contract:{client_id:ctx.client_id,contract_id:ctx.contract_id},
        deals:[{
          deal_id:id,business_status:'EXECUTING',current_status:'EXECUTING',
          current_status_label:'В исполнении',resource_status:'RESOURCE_CONFIRMED',
          resource_label:'Ресурс подтверждён',payment_status:'PAID',
          payment_label:'Оплачено 100%',payment_received_amount:236250,
          payment_obligation_amount:236250,payment_currency:'USD',
          payment_source:'FINANCE_V7_AUTHORITATIVE',payment_authority_state:'AUTHORITATIVE',
          payment_source_timestamp:'2026-09-17T17:57:40Z',
          post_rail_completion_attention:isA&&mode!=='FALSE_FLAG',
          client_deal_stage:isA&&mode!=='FALSE_FLAG'?'ATTENTION':'IN_PROGRESS',
          client_deal_stage_label:'Требует внимания',
          client_deal_stage_source:sourceName,
          rail_monitoring_completed_at:isA?date:null,
          opened_at:'2026-08-13T17:16:00Z',updated_at:'2026-09-16T19:33:59Z'
        }],
        applications:[{application_id:'QA-APP',deal_id:id,quantity_tonnes:315,
          product:'СУГ',updated_at:'2026-09-16T19:33:59Z'}],
        payments:[],documents:[]
      };
    };
    window.RONA_CLIENT_CONTEXT={
      getCurrentContext:()=>clone(contexts[selected]),
      whenReady:async()=>clone(contexts[selected]),
      subscribe:fn=>{subs.add(fn);queueMicrotask(()=>fn(clone(contexts[selected])));return()=>subs.delete(fn)},
      getCurrentProjection:()=>cache?clone(cache):null,
      invalidateCurrentProjection:()=>{cache=null},
      whenCurrentProjection:async()=>{
        if(failNext){failNext=false;throw new Error('QA_SOURCE_FAILURE')}
        if(!cache)cache=create();
        return clone(cache)
      }
    };
    window.__QA_HOME_V3={
      setMode:value=>{mode=value;cache=null;window.dispatchEvent(new Event('rona:client-home-invalidated'))},
      switchContext:()=>{selected=1;cache=null;for(const fn of subs)fn(clone(contexts[selected]))},
      fail:()=>{failNext=true;cache=null;window.dispatchEvent(new Event('rona:client-home-invalidated'))}
    };
  });
  const html='<html><head><meta charset="utf-8"><style>'+
    '#page-home{display:block;width:1120px;min-height:640px}'+
    '.frame{width:1000px;border:1px solid #345;border-radius:12px;padding:16px}'+
    '</style></head><body><nav><button data-page="home">Главная</button></nav>'+
    '<section id="page-home"><div class="frame"><h1>Главная</h1></div>'+
    '<div class="frame">Выбрана компания</div></section></body></html>';
  await page.route('https://rona.test/portal/client',route=>route.fulfill({status:200,contentType:'text/html',body:html}));
  await page.goto('https://rona.test/portal/client',{waitUntil:'domcontentloaded'});
  await page.addScriptTag({path:resolve('assets/portal-runtime/client-home-command-center-v2.js')});
  await page.waitForFunction(()=>document.querySelector('.rona-cc-kpis')!==null);
  await page.addScriptTag({path:resolve('assets/portal-runtime/client-home-current-only-v1.js')});
  await page.addScriptTag({path:resolve('assets/portal-runtime/client-home-actions-polish-v1.js')});
  await page.waitForFunction(()=>document.querySelector('.rona-cc-attention')?.textContent.includes('QA-DEAL-004'),null,{timeout:7000});
  const current=await page.evaluate(()=>({
    alerts:document.querySelector('.rona-cc-attention')?.textContent||'',
    pills:[...document.querySelectorAll('.rona-cc-deal .rona-cc-pill')].map(x=>({value:x.textContent.trim(),tone:x.dataset.tone})),
    source:document.querySelector('.rona-cc-livebar .rona-cc-panel-sub')?.textContent||'',
    checked:document.querySelector('.rona-cc-live-note')?.textContent||'',
    owners:document.querySelectorAll('[data-rona-client-home-owner]').length
  }));
  assert.ok(current.alerts.includes('QA-DEAL-004 · закрытие сделки'),JSON.stringify(current));
  assert.ok(current.alerts.includes('Ж/д-мониторинг завершён'),JSON.stringify(current));
  assert.equal(current.pills[0].value,'Требует внимания');
  assert.equal(current.pills[0].tone,'wait');
  assert.ok(current.source.includes('03.10.2026'),current.source);
  assert.ok(current.checked.includes('10.10.2026'),current.checked);
  assert.equal(current.owners,1);
  console.log('HOME_V3_CLOSEOUT_ATTENTION_AND_SOURCE_TIMESTAMP=PASS');

  await page.evaluate(()=>window.__QA_HOME_V3.setMode('FORGED_SOURCE'));
  await page.waitForFunction(()=>document.querySelector('.rona-cc-attention')?.textContent.includes('По проверяемым статусам исключений нет'),null,{timeout:7000});
  assert.equal(await page.locator('.rona-cc-deal .rona-cc-pill').first().textContent(),'В исполнении');
  console.log('HOME_V3_WRONG_PROVENANCE_NO_FALSE_ALERT=PASS');

  await page.evaluate(()=>window.__QA_HOME_V3.setMode('FALSE_FLAG'));
  await page.waitForFunction(()=>document.querySelector('.rona-cc-attention')?.textContent.includes('По проверяемым статусам исключений нет'),null,{timeout:7000});
  console.log('HOME_V3_FLAG_FALSE_NO_FALSE_ALERT=PASS');

  await page.evaluate(()=>window.__QA_HOME_V3.switchContext());
  await page.waitForFunction(()=>document.querySelector('.rona-cc-deals')?.textContent.includes('QA-DEAL-010'),null,{timeout:7000});
  const other=await page.locator('[data-rona-client-home-owner]').innerText();
  assert.ok(!other.includes('QA-DEAL-004'),other);
  assert.ok(!other.includes('закрытие сделки'),other);
  console.log('HOME_V3_CONTRACT_SWITCH_NO_STALE_ALERT=PASS');

  await page.evaluate(()=>window.__QA_HOME_V3.fail());
  await page.waitForFunction(()=>document.documentElement.dataset.ronaClientHomeState==='error',null,{timeout:7000});
  const text=await page.locator('#page-home').innerText();
  assert.ok(!text.includes('QA-DEAL-004'));
  assert.ok(!text.includes('QA-DEAL-010'));
  assert.deepEqual(jsErrors,[]);
  console.log('HOME_V3_SOURCE_ERROR_FAIL_CLOSED=PASS');
} finally {await browser.close()}
console.log('CLIENT_HOME_SERVER_CLOSEOUT_ATTENTION_V3_QA=PASS');
