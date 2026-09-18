import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN=String(process.env.TARGET_ORIGIN||'https://ronaoil.com').replace(/\/$/,'');
const HEAD=String(process.env.EXPECTED_HEAD||'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-issue635-github-oidc-admin-qa';
const AUDIENCE='rona-issue635-production-browser-v1';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
if(!/^https:\/\/ronaoil\.com$/i.test(ORIGIN))throw new Error('ISSUE635_PRODUCTION_ORIGIN_REQUIRED');
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('ISSUE635_EXACT_HEAD_REQUIRED');

async function oidc(){
  const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');
  const url=base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE);
  const r=await fetch(url,{headers:{authorization:'Bearer '+token,accept:'application/json'}});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.value)throw new Error('GITHUB_OIDC_'+r.status);
  return j.value;
}
async function broker(path,body={}){
  const token=await oidc();
  const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.ok)throw new Error('ISSUE635_BROKER_'+path+'_'+r.status+'_'+String(j?.code||'UNKNOWN'));
  return j;
}

let issued=null,browser=null,context=null;
const proof={expectedHead:HEAD,origin:ORIGIN,startedAt:new Date().toISOString(),windowSeconds:185,requests:[],consoleErrors:[],navigation:{}};
try{
  issued=await broker('/issue',{expectedHead:HEAD});
  assert(issued.head===HEAD,'OIDC broker head mismatch');
  assert(issued.session?.access_token,'OIDC broker session missing');
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:issued.session.access_token,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  const t0=Date.now();
  page.on('request',req=>{
    const u=req.url();
    if(u.includes('/admin/ai-sync')||u.includes('/admin/cash-source')||u.includes('/admin/bootstrap'))proof.requests.push({atMs:Date.now()-t0,url:u.replace(ORIGIN,''),method:req.method()});
  });
  page.on('console',msg=>{if(msg.type()==='error')proof.consoleErrors.push({kind:'console',text:msg.text().slice(0,600)})});
  page.on('pageerror',err=>proof.consoleErrors.push({kind:'pageerror',text:String(err?.message||err).slice(0,600)}));

  const response=await page.goto(ORIGIN+'/portal/admin?_issue635='+Date.now(),{waitUntil:'domcontentloaded',timeout:60000});
  assert(response&&response.status()===200,'Admin production page did not return 200');
  await page.waitForFunction(()=>window.__RONA_OWNER_ADMIN_READY__===true,{timeout:45000});
  await page.locator('#nav button[data-page="accounting"]').click();
  await page.waitForFunction(()=>window.__RONA_CASH_R2_STATE__?.status==='READY'&&window.__RONA_CASH_R2_RUNTIME__?.applyCount>=1,{timeout:45000});
  await page.locator('#page-accounting .rona-cash-r2-root').waitFor({state:'visible',timeout:30000});
  await sleep(1500);

  await mkdir('issue635-proof',{recursive:true});
  await page.screenshot({path:'issue635-proof/cash-start.png',fullPage:true});

  const baselineRequestIndex=proof.requests.length;
  const baseline=await page.evaluate(()=>{
    const page=document.getElementById('page-accounting');
    const host=page?.querySelector(':scope > .rona-owner-page-content');
    if(!page||!host)throw new Error('CASH_HOST_MISSING');
    window.__ISSUE635_PROD_HOST__=host;
    window.__ISSUE635_PROD_MUTATION__={batches:0,records:0,loadingSeen:false};
    window.__ISSUE635_PROD_OBSERVER__=new MutationObserver(records=>{
      window.__ISSUE635_PROD_MUTATION__.batches++;
      window.__ISSUE635_PROD_MUTATION__.records+=records.length;
      if((host.textContent||'').includes('Загрузка подтверждённой проекции'))window.__ISSUE635_PROD_MUTATION__.loadingSeen=true;
    });
    window.__ISSUE635_PROD_OBSERVER__.observe(host,{subtree:true,childList:true,characterData:true,attributes:true});
    return{
      html:host.innerHTML,
      background:getComputedStyle(document.body).backgroundImage,
      bodyClass:document.body.className,
      cashRuntime:{...window.__RONA_CASH_R2_RUNTIME__},
      cashState:{...window.__RONA_CASH_R2_STATE__},
      adminRefreshMode:window.__RONA_OWNER_ADMIN_AUTO_REFRESH__||null,
      aiPollMs:window.__RONA_OWNER_AI_SYNC_POLL_MS__||null,
      hostConnected:host.isConnected
    };
  });
  assert(baseline.background.includes('/assets/portal-canonical/background.png'),'canonical background is not mounted');
  assert(baseline.bodyClass.includes('admin-auth-server-verified'),'canonical Admin background class missing');
  assert(baseline.adminRefreshMode==='authority-change-only-v2','30-second Admin repaint runtime still active');
  assert(baseline.aiPollMs===60000,'AI sync fallback polling is not 60 seconds');

  const samples=[];
  for(let i=0;i<37;i++){
    await sleep(5000);
    if(i%3===0){
      samples.push(await page.evaluate(()=>({
        at:Date.now(),
        background:getComputedStyle(document.body).backgroundImage,
        bodyClass:document.body.className,
        cashRuntime:{...window.__RONA_CASH_R2_RUNTIME__},
        cashState:{...window.__RONA_CASH_R2_STATE__},
        hostSame:document.querySelector('#page-accounting>.rona-owner-page-content')===window.__ISSUE635_PROD_HOST__,
        loading:(document.getElementById('page-accounting')?.textContent||'').includes('Загрузка подтверждённой проекции')
      })));
    }
  }
  const final=await page.evaluate(()=>{
    const host=document.querySelector('#page-accounting>.rona-owner-page-content');
    return{
      html:host?.innerHTML||'',
      background:getComputedStyle(document.body).backgroundImage,
      bodyClass:document.body.className,
      hostSame:host===window.__ISSUE635_PROD_HOST__,
      mutation:{...window.__ISSUE635_PROD_MUTATION__},
      cashRuntime:{...window.__RONA_CASH_R2_RUNTIME__},
      cashState:{...window.__RONA_CASH_R2_STATE__},
      adminRefreshState:window.__RONA_OWNER_ADMIN_REFRESH_STATE__||null,
      aiRefreshState:window.__RONA_OWNER_AI_SYNC_REFRESH_STATE__||null,
      loading:(host?.textContent||'').includes('Загрузка подтверждённой проекции')
    };
  });
  await page.screenshot({path:'issue635-proof/cash-after-185s.png',fullPage:true});

  proof.baseline=baseline;
  proof.samples=samples;
  proof.final=final;
  proof.windowRequests=proof.requests.slice(baselineRequestIndex);
  const windowAdminBootstrap=proof.windowRequests.filter(x=>x.url.includes('/admin/bootstrap'));
  const windowAiSync=proof.windowRequests.filter(x=>x.url.includes('/admin/ai-sync'));
  const windowCash=proof.windowRequests.filter(x=>x.url.includes('/admin/cash-source'));
  proof.requestCounts={adminBootstrap:windowAdminBootstrap.length,aiSync:windowAiSync.length,cashSource:windowCash.length};

  assert(final.hostSame,'Cash owner host changed during 3-minute window');
  assert(final.background===baseline.background,'canonical background changed during 3-minute window');
  assert(final.bodyClass.includes('admin-auth-server-verified'),'canonical background class disappeared');
  assert(samples.every(x=>x.hostSame&&!x.loading&&x.background===baseline.background),'flicker/background instability observed in periodic samples');
  assert(final.loading===false&&final.mutation.loadingSeen===false,'loading screen appeared during background checks');
  assert(final.cashRuntime.lastSignature===baseline.cashRuntime.lastSignature,'Finance source changed during no-change acceptance window; rerun required');
  assert(final.cashRuntime.applyCount===baseline.cashRuntime.applyCount,'unchanged source caused Cash repaint');
  assert(final.cashRuntime.loadingCount===baseline.cashRuntime.loadingCount,'background checks created a loading repaint');
  assert(final.html===baseline.html,'unchanged source mutated Cash DOM');
  assert(final.mutation.batches===0&&final.mutation.records===0,'unchanged source produced Cash DOM mutations');
  assert(final.cashRuntime.checkCount>=baseline.cashRuntime.checkCount+3,'60-second fallback checks did not run three times');
  assert(final.cashRuntime.unchangedCount>=baseline.cashRuntime.unchangedCount+3,'unchanged source checks were not signature-gated');
  assert(windowAdminBootstrap.length===0,'Admin bootstrap repainted/polled during stable window');
  assert(windowAiSync.length<=4,'AI sync polled more often than once per 60 seconds');
  assert(windowCash.length<=4,'Cash source polled more often than once per 60 seconds');

  for(const id of ['home','payments','deals','access']){
    const button=page.locator('#nav button[data-page="'+id+'"]').first();
    await button.click();
    await page.waitForFunction(pageId=>document.getElementById('page-'+pageId)?.classList.contains('active')===true,id,{timeout:15000});
    const snap=await page.evaluate(pageId=>{
      const el=document.getElementById('page-'+pageId);
      const style=el?getComputedStyle(el):null;
      return{exists:!!el,active:!!el?.classList.contains('active'),display:style?.display||null,childCount:el?.childElementCount||0,text:(el?.textContent||'').replace(/\s+/g,' ').trim().slice(0,240)};
    },id);
    proof.navigation[id]=snap;
    assert(snap.exists&&snap.active&&snap.display!=='none','Admin regression on '+id);
    await sleep(500);
  }
  await page.locator('#nav button[data-page="accounting"]').click();
  await page.waitForFunction(()=>document.getElementById('page-accounting')?.classList.contains('active')&&window.__RONA_CASH_R2_STATE__?.status==='READY');
  proof.navigation.accounting=await page.evaluate(()=>({active:document.getElementById('page-accounting')?.classList.contains('active')||false,ready:window.__RONA_CASH_R2_STATE__?.status||null}));

  proof.completedAt=new Date().toISOString();
  proof.status='PASS';
  await writeFile('issue635-proof/production-proof.json',JSON.stringify(proof,null,2));
  console.log('ISSUE635_PRODUCTION_3MIN_STABLE=PASS');
  console.log('ISSUE635_NO_30S_ADMIN_REPAINT=PASS');
  console.log('ISSUE635_UNCHANGED_ZERO_DOM_MUTATION=PASS');
  console.log('ISSUE635_CANONICAL_BACKGROUND_STABLE=PASS');
  console.log('ISSUE635_HOME_PAYMENTS_DEALS_ACCESS=PASS');
  console.log('ISSUE635_PRODUCTION_SHA='+HEAD);
}catch(error){
  proof.completedAt=new Date().toISOString();
  proof.status='FAIL';
  proof.error=String(error?.stack||error);
  await mkdir('issue635-proof',{recursive:true}).catch(()=>{});
  await writeFile('issue635-proof/production-proof.json',JSON.stringify(proof,null,2)).catch(()=>{});
  console.error('ISSUE635_PRODUCTION_BROWSER=FAIL',error?.stack||error);
  process.exitCode=1;
}finally{
  if(context)await context.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  if(issued)await broker('/cleanup',{expectedHead:HEAD}).catch(error=>{console.error('ISSUE635_QA_CLEANUP_FAIL',error?.message||error);process.exitCode=1});
}
