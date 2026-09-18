import http from 'node:http';
import { chromium } from 'playwright';
import { onRequest as cashUiRequest } from '../functions/portal/cash-r2-ui.js';

const cashScript=await (await cashUiRequest()).text();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};

let sourceVersion=1;
let delayNext=0;
let projectionRequests=0;
function payload(){
  const changed=sourceVersion>1;
  return {
    modelVersion:'FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE',
    effectivePaymentVersion:'FINANCE_EFFECTIVE_PAYMENT_V1',
    authoritativeSource:'AI-FINANCE/BANK_STATEMENT',
    generatedAt:new Date().toISOString(),
    period:{from:'2026-09-17',to:'2026-09-17'},
    controls:{source_lock:'PASS',max_daily_balance_difference:0,max_statement_checkpoint_difference:0,reversal_count:0,matched_reversal_count:0,unresolved_reversal_count:0},
    periodSummary:[{
      currency:'USD',
      opening_balance:100,
      external_inflow:changed?50:0,
      external_payment:0,
      gross_external_payment:0,
      matched_external_payment_reversal:0,
      effective_external_payment:0,
      effective_external_payment_operation_count:0,
      reversal_pair_unresolved_count:0,
      effective_payment_unresolved_count:0,
      closing_balance:changed?150:100,
      balance_check:0,
      max_daily_balance_difference:0
    }],
    operations:changed?[{
      operation_date:'2026-09-17',
      executed_at_local:'2026-09-17T18:00:00',
      currency:'USD',
      amount:50,
      direction:'INCOMING',
      operation_type:'EXTERNAL_INFLOW',
      raw_operation_type:'EXTERNAL_INFLOW',
      gross_amount:50,
      reversed_amount:0,
      effective_external_payment_amount:0,
      effective_payment_status:'NOT_APPLICABLE',
      canonical_counterparty_id:'CLIENT:RONA-QA',
      canonical_counterparty_name:'QA Client',
      source_counterparty:'QA Client',
      bank_document_number:'QA-635'
    }]:[],
    dailySummary:[],
    statementSummaries:[],
    checkpointAudit:[]
  };
}

const html=[
'<!doctype html>',
'<html lang="ru"><head><meta charset="utf-8"><style>',
'html,body{min-height:100%;margin:0}',
'body.admin-auth-server-verified{background-image:url("/assets/portal-canonical/background.png");background-attachment:fixed;background-size:cover;background-color:#050b13;color:#fff}',
'#page-accounting{display:block}.rona-owner-page-content{min-height:500px}',
'</style></head><body class="admin-auth-server-verified">',
'<nav id="nav"><button class="active" aria-current="page" data-page="accounting">Касса</button></nav>',
'<section id="page-accounting" class="page active"><div class="rona-owner-page-content" data-owner-page="accounting" data-rona-cash-host="r2"></div></section>',
'<script src="/portal/cash-r2-ui.js"></script>',
'</body></html>'
].join('');

function send(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body)}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/admin')return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/portal/cash-r2-ui.js')return send(res,200,cashScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/assets/portal-canonical/background.png')return send(res,200,'','image/png');
  if(u.pathname==='/qa/change'){sourceVersion++;delayNext=500;return json(res,{ok:true,sourceVersion})}
  if(u.pathname==='/portal/owner-api'&&u.searchParams.get('path')==='/admin/cash-source'){
    projectionRequests++;
    if(delayNext){const d=delayNext;delayNext=0;await sleep(d)}
    return json(res,{ok:true,data:payload()});
  }
  return send(res,404,'not found');
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin='http://127.0.0.1:'+server.address().port;

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_CASH_R2_STATE__?.status==='READY'&&window.__RONA_CASH_R2_RUNTIME__?.applyCount===1);

  const baseline=await page.evaluate(()=>{
    const host=document.querySelector('#page-accounting>.rona-owner-page-content');
    window.__ISSUE635_HOST__=host;
    window.__ISSUE635_MUTATION__={batches:0,records:0,loadingSeen:false};
    window.__ISSUE635_OBSERVER__=new MutationObserver(records=>{
      window.__ISSUE635_MUTATION__.batches++;
      window.__ISSUE635_MUTATION__.records+=records.length;
      if((host.textContent||'').includes('Загрузка подтверждённой проекции'))window.__ISSUE635_MUTATION__.loadingSeen=true;
    });
    window.__ISSUE635_OBSERVER__.observe(host,{subtree:true,childList:true,characterData:true,attributes:true});
    return {
      html:host.innerHTML,
      background:getComputedStyle(document.body).backgroundImage,
      hostConnected:host.isConnected,
      runtime:{...window.__RONA_CASH_R2_RUNTIME__}
    };
  });
  assert(baseline.background.includes('background.png'),'canonical background missing');
  assert(baseline.runtime.loadingCount===1,'initial loading must occur exactly once');
  const initialRequests=projectionRequests;

  for(let i=0;i<3;i++){
    const before=await page.evaluate(()=>window.__RONA_CASH_R2_RUNTIME__.checkCount);
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rona:finance-sync',{detail:{changed:true,sourceSignature:'same-'+Date.now()}})));
    await page.waitForFunction(n=>window.__RONA_CASH_R2_RUNTIME__.checkCount>n,before);
    await page.waitForFunction(()=>window.__RONA_CASH_R2_RUNTIME__.hasCurrent===true);
    await sleep(80);
  }

  const unchanged=await page.evaluate(()=>{
    const host=document.querySelector('#page-accounting>.rona-owner-page-content');
    return {
      html:host.innerHTML,
      sameHost:host===window.__ISSUE635_HOST__,
      mutation:{...window.__ISSUE635_MUTATION__},
      runtime:{...window.__RONA_CASH_R2_RUNTIME__},
      background:getComputedStyle(document.body).backgroundImage,
      loadingText:(host.textContent||'').includes('Загрузка подтверждённой проекции')
    };
  });
  assert(unchanged.sameHost,'Cash host was replaced on unchanged checks');
  assert(unchanged.html===baseline.html,'unchanged source mutated Cash DOM');
  assert(unchanged.mutation.batches===0&&unchanged.mutation.records===0,'unchanged source produced DOM mutations');
  assert(unchanged.mutation.loadingSeen===false&&!unchanged.loadingText,'unchanged checks exposed loading UI');
  assert(unchanged.runtime.applyCount===1,'unchanged source caused repaint');
  assert(unchanged.runtime.unchangedCount>=3,'unchanged source signature gate did not fire');
  assert(unchanged.runtime.loadingCount===1,'background refresh added loading state');
  assert(unchanged.background===baseline.background,'canonical background changed');
  assert(projectionRequests>=initialRequests+3,'same-source checks did not execute');

  await fetch(origin+'/qa/change').then(r=>r.json());
  const beforeChange=await page.evaluate(()=>({html:document.querySelector('#page-accounting>.rona-owner-page-content').innerHTML,apply:window.__RONA_CASH_R2_RUNTIME__.applyCount}));
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rona:finance-sync',{detail:{changed:true,sourceSignature:'changed'}})));
  await sleep(120);
  const inflight=await page.evaluate(()=>({
    html:document.querySelector('#page-accounting>.rona-owner-page-content').innerHTML,
    loading:(document.querySelector('#page-accounting')?.textContent||'').includes('Загрузка подтверждённой проекции'),
    apply:window.__RONA_CASH_R2_RUNTIME__.applyCount
  }));
  assert(inflight.html===beforeChange.html,'old Cash screen was removed while changed data was still loading');
  assert(inflight.loading===false,'changed background fetch exposed loading UI');
  assert(inflight.apply===beforeChange.apply,'Cash applied before changed payload completed');

  await page.waitForFunction(n=>window.__RONA_CASH_R2_RUNTIME__.applyCount===n+1,beforeChange.apply);
  const changed=await page.evaluate(()=>{
    const host=document.querySelector('#page-accounting>.rona-owner-page-content');
    return {
      sameHost:host===window.__ISSUE635_HOST__,
      mutation:{...window.__ISSUE635_MUTATION__},
      runtime:{...window.__RONA_CASH_R2_RUNTIME__},
      text:host.textContent||'',
      background:getComputedStyle(document.body).backgroundImage,
      loading:(host.textContent||'').includes('Загрузка подтверждённой проекции')
    };
  });
  assert(changed.sameHost,'Cash host changed during atomic apply');
  assert(changed.runtime.applyCount===2,'real source update must apply exactly once');
  assert(changed.runtime.loadingCount===1,'real source update must not create a loading repaint');
  assert(changed.mutation.batches===1,'real update must produce one atomic DOM mutation batch');
  assert(changed.mutation.loadingSeen===false&&!changed.loading,'real update flashed loading content');
  assert(changed.text.includes('150 USD'),'changed Finance payload was not rendered');
  assert(changed.background===baseline.background,'background changed during real update');
  assert(errors.length===0,'browser errors: '+errors.join(' | '));

  console.log('ISSUE635_UNCHANGED_ZERO_DOM_MUTATION=PASS');
  console.log('ISSUE635_CHANGED_ATOMIC_SINGLE_APPLY=PASS');
  console.log('ISSUE635_BACKGROUND_STABLE=PASS');
  console.log(JSON.stringify({projectionRequests,baseline:baseline.runtime,unchanged:unchanged.runtime,changed:changed.runtime,mutation:changed.mutation,errors}));
  await context.close();
}catch(error){
  console.error('ISSUE635_STABLE_REFRESH_BROWSER_QA=FAIL',error?.stack||error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
