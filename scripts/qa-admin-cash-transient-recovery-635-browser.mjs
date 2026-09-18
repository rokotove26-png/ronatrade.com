import http from 'node:http';
import { chromium } from 'playwright';
import { onRequest as cashUiRequest } from '../functions/portal/cash-r2-ui.js';

const cashScript=await (await cashUiRequest()).text();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};

let mode='initial-recover';
let requests=0;
let backgroundFailUsed=false;

function payload(){
  return {
    modelVersion:'FINANCE_CASH_SOURCE_PROJECTION_V2_CUMULATIVE',
    effectivePaymentVersion:'FINANCE_EFFECTIVE_PAYMENT_V1',
    authoritativeSource:'AI-FINANCE/BANK_STATEMENT',
    generatedAt:new Date().toISOString(),
    period:{from:'2026-09-17',to:'2026-09-17'},
    controls:{
      source_lock:'PASS',
      max_daily_balance_difference:0,
      max_statement_checkpoint_difference:0,
      reversal_count:0,
      matched_reversal_count:0,
      unresolved_reversal_count:0
    },
    periodSummary:[{
      currency:'USD',
      opening_balance:100,
      external_inflow:0,
      external_payment:0,
      gross_external_payment:0,
      matched_external_payment_reversal:0,
      effective_external_payment:0,
      effective_external_payment_operation_count:0,
      reversal_pair_unresolved_count:0,
      effective_payment_unresolved_count:0,
      closing_balance:100,
      balance_check:0,
      max_daily_balance_difference:0
    }],
    operations:[],
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

function send(res,status,body,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
  res.end(body);
}
function json(res,data,status=200){send(res,status,JSON.stringify(data),'application/json; charset=utf-8')}

const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/admin')return send(res,200,html,'text/html; charset=utf-8');
  if(u.pathname==='/portal/cash-r2-ui.js')return send(res,200,cashScript,'application/javascript; charset=utf-8');
  if(u.pathname==='/assets/portal-canonical/background.png')return send(res,200,'','image/png');
  if(u.pathname==='/qa/background-fail'){mode='background-fail';backgroundFailUsed=false;return json(res,{ok:true})}
  if(u.pathname==='/qa/healthy'){mode='healthy';return json(res,{ok:true})}
  if(u.pathname==='/portal/owner-api'&&u.searchParams.get('path')==='/admin/cash-source'){
    requests++;
    if(mode==='initial-recover'&&requests<=2){
      return json(res,{ok:false,code:'canceling statement due to statement timeout'},503);
    }
    if(mode==='background-fail'&&!backgroundFailUsed){
      backgroundFailUsed=true;
      return json(res,{ok:false,code:'canceling statement due to statement timeout'},503);
    }
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

  await page.waitForFunction(()=>window.__RONA_CASH_R2_STATE__?.status==='RETRYING',{timeout:5000});
  const retryState=await page.evaluate(()=>({
    text:document.querySelector('#page-accounting')?.textContent||'',
    state:{...window.__RONA_CASH_R2_STATE__},
    runtime:{...window.__RONA_CASH_R2_RUNTIME__},
    root:!!document.querySelector('#page-accounting .rona-cash-initial-state')
  }));
  assert(retryState.root,'initial retry state did not remain mounted');
  assert(retryState.text.includes('Временная задержка Finance, повторяем...'),'transient retry message missing');
  assert(retryState.runtime.loadingCount===1,'initial loading should mount once');
  assert(retryState.runtime.pollTimerCount===1,'healthy fallback poll timer must exist exactly once');
  assert(retryState.runtime.retryTimerActive===true,'bounded retry timer not scheduled');

  await page.waitForFunction(()=>window.__RONA_CASH_R2_STATE__?.status==='READY',{timeout:12000});
  const ready=await page.evaluate(()=>({
    state:{...window.__RONA_CASH_R2_STATE__},
    runtime:{...window.__RONA_CASH_R2_RUNTIME__},
    text:document.querySelector('#page-accounting')?.textContent||'',
    background:getComputedStyle(document.body).backgroundImage,
    pollTimer:window.__RONA_CASH_R2_POLL_TIMER__||null
  }));
  assert(requests===3,'expected first two transient failures then third success; requests='+requests);
  assert(ready.runtime.initialRetryCount===2,'expected two automatic retries');
  assert(ready.runtime.initialRetryScheduled===2,'expected two scheduled retries');
  assert(ready.runtime.loadingCount===1,'retry path remounted loading UI');
  assert(ready.runtime.retryTimerActive===false,'retry timer remained active after READY');
  assert(ready.runtime.pollTimerCount===1,'duplicate healthy poll timer detected');
  assert(ready.state.status==='READY','Cash did not recover automatically');
  assert(ready.background.includes('background.png'),'canonical background missing after recovery');

  const baseline=await page.evaluate(()=>{
    const host=document.querySelector('#page-accounting>.rona-owner-page-content');
    const root=host?.querySelector('.rona-cash-r2-root');
    window.__ISSUE635_RECOVERY_HOST__=host;
    window.__ISSUE635_RECOVERY_ROOT__=root;
    return {
      html:host?.innerHTML||'',
      apply:window.__RONA_CASH_R2_RUNTIME__.applyCount,
      loading:window.__RONA_CASH_R2_RUNTIME__.loadingCount,
      pollTimer:window.__RONA_CASH_R2_POLL_TIMER__||null
    };
  });

  await fetch(origin+'/qa/background-fail').then(r=>r.json());
  const beforeCheck=await page.evaluate(()=>window.__RONA_CASH_R2_RUNTIME__.checkCount);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rona:finance-sync',{detail:{changed:true,sourceSignature:'qa-transient-background'}})));
  await page.waitForFunction(n=>window.__RONA_CASH_R2_RUNTIME__.checkCount>n,beforeCheck);
  await sleep(120);

  const degraded=await page.evaluate(()=>({
    sameHost:document.querySelector('#page-accounting>.rona-owner-page-content')===window.__ISSUE635_RECOVERY_HOST__,
    sameRoot:document.querySelector('#page-accounting .rona-cash-r2-root')===window.__ISSUE635_RECOVERY_ROOT__,
    apply:window.__RONA_CASH_R2_RUNTIME__.applyCount,
    loading:window.__RONA_CASH_R2_RUNTIME__.loadingCount,
    state:{...window.__RONA_CASH_R2_STATE__},
    indicator:document.querySelector('#page-accounting .rona-cash-degraded')?.textContent||'',
    hasLoading:(document.querySelector('#page-accounting')?.textContent||'').includes('Загрузка подтверждённой проекции'),
    pollTimer:window.__RONA_CASH_R2_POLL_TIMER__||null
  }));
  assert(degraded.sameHost&&degraded.sameRoot,'valid Cash UI was replaced on transient background failure');
  assert(degraded.apply===baseline.apply,'transient background failure applied a new Cash payload');
  assert(degraded.loading===baseline.loading,'transient background failure mounted loading UI');
  assert(degraded.state.status==='READY'&&degraded.state.degraded===true,'valid state was not retained as degraded READY');
  assert(degraded.indicator.includes('Временная задержка Finance'),'degraded indicator missing');
  assert(degraded.hasLoading===false,'loading placeholder appeared over valid Cash');
  assert(degraded.pollTimer===baseline.pollTimer,'healthy polling timer was replaced/duplicated');

  await fetch(origin+'/qa/healthy').then(r=>r.json());
  const beforeRecoveryCheck=await page.evaluate(()=>window.__RONA_CASH_R2_RUNTIME__.checkCount);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('rona:finance-sync',{detail:{changed:true,sourceSignature:'qa-recovery'}})));
  await page.waitForFunction(n=>window.__RONA_CASH_R2_RUNTIME__.checkCount>n,beforeRecoveryCheck);
  await page.waitForFunction(()=>!document.querySelector('#page-accounting .rona-cash-degraded'),{timeout:3000});

  const recovered=await page.evaluate(()=>({
    sameHost:document.querySelector('#page-accounting>.rona-owner-page-content')===window.__ISSUE635_RECOVERY_HOST__,
    sameRoot:document.querySelector('#page-accounting .rona-cash-r2-root')===window.__ISSUE635_RECOVERY_ROOT__,
    apply:window.__RONA_CASH_R2_RUNTIME__.applyCount,
    loading:window.__RONA_CASH_R2_RUNTIME__.loadingCount,
    state:{...window.__RONA_CASH_R2_STATE__},
    runtime:{...window.__RONA_CASH_R2_RUNTIME__},
    pollTimer:window.__RONA_CASH_R2_POLL_TIMER__||null
  }));
  assert(recovered.sameHost&&recovered.sameRoot,'same-payload recovery replaced valid Cash UI');
  assert(recovered.apply===baseline.apply,'same-payload recovery repainted Cash');
  assert(recovered.loading===baseline.loading,'same-payload recovery remounted loading UI');
  assert(recovered.state.status==='READY'&&recovered.state.degraded===false,'degraded state did not clear after recovery');
  assert(recovered.pollTimer===baseline.pollTimer,'poll timer changed after recovery');
  assert(recovered.runtime.pollTimerCount===1,'duplicate polling timer count after recovery');
  assert(errors.length===0,'browser errors: '+errors.join(' | '));

  console.log('ISSUE635_INITIAL_TRANSIENT_AUTO_RECOVERY=PASS');
  console.log('ISSUE635_INITIAL_RETRY_BACKOFF=PASS');
  console.log('ISSUE635_VALID_UI_RETAINED_ON_TRANSIENT_REFRESH=PASS');
  console.log('ISSUE635_SINGLE_POLL_TIMER=PASS');
  console.log(JSON.stringify({requests,retryState:retryState.runtime,ready:ready.runtime,degraded,recovered:recovered.runtime,errors}));
  await context.close();
}catch(error){
  console.error('ISSUE635_TRANSIENT_RECOVERY_BROWSER_QA=FAIL',error?.stack||error);
  process.exitCode=1;
}finally{
  if(browser)await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
