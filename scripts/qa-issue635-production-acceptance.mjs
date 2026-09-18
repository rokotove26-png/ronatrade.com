import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN='https://ronaoil.com';
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-issue635-production-acceptance';
const EXPECTED_PRODUCTION_SHA='79e0a2c9d6ca1f2fb1532fa8e41af98a1cd2be8c';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};

async function oidc(){
  const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');
  const url=base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE);
  const r=await fetch(url,{headers:{authorization:'Bearer '+token}});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.value)throw new Error('GITHUB_OIDC_'+r.status);
  return j.value;
}
async function issuerCall(path,body={}){
  const jwt=await oidc();
  const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:'Bearer '+jwt,'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.ok)throw new Error('ISSUER_'+path+'_'+r.status+'_'+String(j?.code||'UNKNOWN'));
  return j;
}
async function issueSession(){
  const j=await issuerCall('/issue');
  assert(j.session?.access_token&&j.broker_admin_id,'ISSUER_SESSION_RESPONSE_INVALID');
  return j;
}
async function cleanup(){return issuerCall('/cleanup')}

const proof={
  suite:'ISSUE635_PRODUCTION_ACCEPTANCE',
  expectedProductionSha:EXPECTED_PRODUCTION_SHA,
  origin:ORIGIN,
  startedAt:new Date().toISOString(),
  durationSeconds:185,
  samples:[],
  requests:[],
  consoleErrors:[],
  navigation:{}
};

let browser,context,issued;
try{
  issued=await issueSession();
  proof.qaPortalUserId=issued.broker_admin_id;
  proof.oidcHead=issued.head;
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:issued.session.access_token,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  const started=Date.now();

  page.on('request',req=>{
    const u=req.url();
    if(u.includes('/admin/ai-sync')||u.includes('/admin/cash-source')||u.includes('/admin/bootstrap')||u.includes('/admin-completed-bootstrap')){
      proof.requests.push({atMs:Date.now()-started,url:u.replace(ORIGIN,''),method:req.method()});
    }
  });
  page.on('console',m=>{if(m.type()==='error')proof.consoleErrors.push({kind:'console',text:m.text().slice(0,500)})});
  page.on('pageerror',e=>proof.consoleErrors.push({kind:'pageerror',text:String(e?.message||e).slice(0,500)}));

  const response=await page.goto(ORIGIN+'/portal/admin?_issue635='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
  assert(response&&response.status()===200,'ADMIN_HTTP_'+(response?.status()||'NO_RESPONSE'));
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:45000});

  await page.locator('#nav button[data-page="accounting"]').click();
  await page.waitForFunction(()=>window.__RONA_CASH_R2_STATE__?.status==='READY'&&window.__RONA_CASH_R2_RUNTIME__?.applyCount>=1,{timeout:45000});
  await page.locator('#page-accounting .rona-cash-r2-root').waitFor({state:'visible',timeout:30000});
  await sleep(1500);

  await mkdir('issue635-production-proof',{recursive:true});
  await page.screenshot({path:'issue635-production-proof/cash-start.png',fullPage:true});

  const baselineRequestIndex=proof.requests.length;
  const baseline=await page.evaluate(()=>{
    const host=document.querySelector('#page-accounting > .rona-owner-page-content');
    if(!host)throw new Error('CASH_HOST_MISSING');
    window.__ISSUE635_PROD_HOST__=host;
    window.__ISSUE635_PROD_MUTATION__={batches:0,records:0,loadingSeen:false};
    window.__ISSUE635_PROD_OBSERVER__=new MutationObserver(records=>{
      window.__ISSUE635_PROD_MUTATION__.batches++;
      window.__ISSUE635_PROD_MUTATION__.records+=records.length;
      if((host.textContent||'').includes('Загрузка подтверждённой проекции'))window.__ISSUE635_PROD_MUTATION__.loadingSeen=true;
    });
    window.__ISSUE635_PROD_OBSERVER__.observe(host,{subtree:true,childList:true,characterData:true,attributes:true});
    return {
      html:host.innerHTML,
      background:getComputedStyle(document.body).backgroundImage,
      bodyClass:document.body.className,
      adminRefreshMode:window.__RONA_OWNER_ADMIN_AUTO_REFRESH__||null,
      aiPollMs:window.__RONA_OWNER_AI_SYNC_POLL_MS__||null,
      cashRuntime:{...window.__RONA_CASH_R2_RUNTIME__},
      cashState:{...window.__RONA_CASH_R2_STATE__},
      cashText:(host.textContent||'').replace(/\s+/g,' ').trim().slice(0,1200)
    };
  });
  proof.baseline=baseline;

  assert(baseline.background.includes('/assets/portal-canonical/background.png'),'CANONICAL_BACKGROUND_MISSING');
  assert(baseline.bodyClass.includes('admin-auth-server-verified'),'ADMIN_AUTH_BACKGROUND_CLASS_MISSING');
  assert(baseline.adminRefreshMode==='authority-change-only-v2','ADMIN_REFRESH_MODE_MISMATCH_'+baseline.adminRefreshMode);
  assert(baseline.aiPollMs===60000,'AI_POLL_NOT_60S_'+baseline.aiPollMs);

  for(let i=0;i<37;i++){
    await sleep(5000);
    if(i%3===0){
      const sample=await page.evaluate(()=>({
        at:Date.now(),
        background:getComputedStyle(document.body).backgroundImage,
        bodyClass:document.body.className,
        hostSame:document.querySelector('#page-accounting > .rona-owner-page-content')===window.__ISSUE635_PROD_HOST__,
        loading:(document.getElementById('page-accounting')?.textContent||'').includes('Загрузка подтверждённой проекции'),
        cashRuntime:{...window.__RONA_CASH_R2_RUNTIME__},
        cashState:{...window.__RONA_CASH_R2_STATE__}
      }));
      proof.samples.push(sample);
    }
  }

  const final=await page.evaluate(()=>{
    const host=document.querySelector('#page-accounting > .rona-owner-page-content');
    return {
      html:host?.innerHTML||'',
      background:getComputedStyle(document.body).backgroundImage,
      bodyClass:document.body.className,
      hostSame:host===window.__ISSUE635_PROD_HOST__,
      loading:(host?.textContent||'').includes('Загрузка подтверждённой проекции'),
      mutation:{...window.__ISSUE635_PROD_MUTATION__},
      cashRuntime:{...window.__RONA_CASH_R2_RUNTIME__},
      cashState:{...window.__RONA_CASH_R2_STATE__},
      cashText:(host?.textContent||'').replace(/\s+/g,' ').trim().slice(0,1200),
      adminRefreshState:window.__RONA_OWNER_ADMIN_REFRESH_STATE__||null,
      aiRefreshState:window.__RONA_OWNER_AI_SYNC_REFRESH_STATE__||null
    };
  });
  proof.final=final;
  proof.windowRequests=proof.requests.slice(baselineRequestIndex);
  proof.requestCounts={
    adminBootstrap:proof.windowRequests.filter(x=>x.url.includes('/admin/bootstrap')||x.url.includes('/admin-completed-bootstrap')).length,
    aiSync:proof.windowRequests.filter(x=>x.url.includes('/admin/ai-sync')).length,
    cashSource:proof.windowRequests.filter(x=>x.url.includes('/admin/cash-source')).length
  };

  await page.screenshot({path:'issue635-production-proof/cash-after-185s.png',fullPage:true});

  assert(final.hostSame,'CASH_HOST_REPLACED');
  assert(final.background===baseline.background,'BACKGROUND_CHANGED');
  assert(final.bodyClass.includes('admin-auth-server-verified'),'BACKGROUND_CLASS_DISAPPEARED');
  assert(proof.samples.every(x=>x.hostSame&&!x.loading&&x.background===baseline.background),'VISUAL_STABILITY_SAMPLE_FAILED');
  assert(final.loading===false&&final.mutation.loadingSeen===false,'LOADING_FLASH_OBSERVED');
  assert(final.cashRuntime.lastSignature===baseline.cashRuntime.lastSignature,'FINANCE_SOURCE_CHANGED_DURING_STABLE_WINDOW');
  assert(final.cashRuntime.applyCount===baseline.cashRuntime.applyCount,'UNCHANGED_SOURCE_REPAINTED');
  assert(final.cashRuntime.loadingCount===baseline.cashRuntime.loadingCount,'BACKGROUND_LOADING_REPAINTED');
  assert(final.html===baseline.html,'UNCHANGED_SOURCE_MUTATED_CASH_DOM');
  assert(final.mutation.batches===0&&final.mutation.records===0,'UNCHANGED_SOURCE_DOM_MUTATIONS_'+JSON.stringify(final.mutation));
  assert(final.cashRuntime.checkCount>=baseline.cashRuntime.checkCount+3,'THREE_60S_CHECKS_NOT_OBSERVED');
  assert(final.cashRuntime.unchangedCount>=baseline.cashRuntime.unchangedCount+3,'THREE_UNCHANGED_CHECKS_NOT_GATED');
  assert(proof.requestCounts.adminBootstrap===0,'UNEXPECTED_ADMIN_BOOTSTRAP_POLL_'+proof.requestCounts.adminBootstrap);
  assert(proof.requestCounts.aiSync<=4,'AI_SYNC_FASTER_THAN_60S_'+proof.requestCounts.aiSync);
  assert(proof.requestCounts.cashSource<=4,'CASH_POLL_FASTER_THAN_60S_'+proof.requestCounts.cashSource);
  assert(proof.consoleErrors.length===0,'BROWSER_ERRORS_'+JSON.stringify(proof.consoleErrors));

  for(const id of ['home','payments','deals','access']){
    const btn=page.locator('#nav button[data-page="'+id+'"]').first();
    await btn.waitFor({state:'visible',timeout:15000});
    await btn.click();
    await page.waitForFunction(pageId=>document.getElementById('page-'+pageId)?.classList.contains('active')===true,id,{timeout:15000});
    const snap=await page.evaluate(pageId=>{
      const el=document.getElementById('page-'+pageId),s=el?getComputedStyle(el):null,r=el?.getBoundingClientRect();
      return{exists:!!el,active:!!el?.classList.contains('active'),display:s?.display||null,width:r?.width||0,height:r?.height||0,text:(el?.textContent||'').replace(/\s+/g,' ').trim().slice(0,300)};
    },id);
    proof.navigation[id]=snap;
    assert(snap.exists&&snap.active&&snap.display!=='none'&&snap.width>0&&snap.height>0,'NAV_REGRESSION_'+id);
    await sleep(600);
  }

  await page.locator('#nav button[data-page="accounting"]').click();
  await page.waitForFunction(()=>document.getElementById('page-accounting')?.classList.contains('active')&&window.__RONA_CASH_R2_STATE__?.status==='READY',{timeout:15000});
  proof.navigation.accounting={active:true,ready:'READY'};
  await page.screenshot({path:'issue635-production-proof/admin-navigation-smoke.png',fullPage:true});

  proof.status='PASS';
  proof.completedAt=new Date().toISOString();
  await writeFile('issue635-production-proof/proof.json',JSON.stringify(proof,null,2));
  console.log('ISSUE635_PRODUCTION_3MIN_STABLE=PASS');
  console.log('ISSUE635_NO_30S_REPAINT=PASS');
  console.log('ISSUE635_UNCHANGED_60S_ZERO_DOM=PASS');
  console.log('ISSUE635_BACKGROUND_PERSISTENT=PASS');
  console.log('ISSUE635_HOME_PAYMENTS_DEALS_ACCESS=PASS');
  console.log('ISSUE635_PRODUCTION_SHA='+EXPECTED_PRODUCTION_SHA);
}catch(e){
  proof.status='FAIL';
  proof.error=String(e?.stack||e);
  proof.completedAt=new Date().toISOString();
  await mkdir('issue635-production-proof',{recursive:true}).catch(()=>{});
  await writeFile('issue635-production-proof/proof.json',JSON.stringify(proof,null,2)).catch(()=>{});
  console.error('ISSUE635_PRODUCTION_ACCEPTANCE=FAIL',e?.stack||e);
  process.exitCode=1;
}finally{
  if(context)await context.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  if(issued){
    try{
      const retired=await cleanup();
      console.log('ISSUE635_QA_SESSION_CLEANUP=PASS retired='+String(retired.retired));
    }catch(e){
      console.error('ISSUE635_QA_SESSION_CLEANUP=FAIL',e?.message||e);
      process.exitCode=1;
    }
  }
}
