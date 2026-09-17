import assert from 'node:assert/strict';
import fs from 'node:fs';
import prepaintRuntime from '../functions/portal/owner-ui-chunks/chunk15-base.js';
import safeTickerRuntime from '../functions/portal/main-ui/admin-topbar-ticker-safe-v2.js';

const prepaintSrc=fs.readFileSync('functions/portal/owner-ui-chunks/chunk15-base.js','utf8');
const wrapperSrc=fs.readFileSync('functions/portal/owner-ui-chunks/chunk15.js','utf8');
const tickerSrc=fs.readFileSync('functions/portal/main-ui/admin-topbar-ticker-safe-v2.js','utf8');
const admin=fs.readFileSync('portal-src/current/admin.html','utf8');

assert.match(admin,/class="topbar"/,'canonical Admin topbar must remain present');
assert.match(admin,/class="search"[^>]*type="search"/,'canonical global search must remain present');
assert.match(admin,/class="role-pill"/,'canonical role pill must remain present');
assert.match(prepaintSrc,/position:fixed;right:12px;bottom:12px/,'immutable pre-paint base must retain fixed loading position');
assert.doesNotMatch(prepaintSrc,/rona-owner-build-ticker|mountAdminTicker|top\.insertBefore\(host,anchor\)/,'immutable prepaint base must not mutate the Admin topbar');
assert.match(wrapperSrc,/import basePrepaintRuntime from '\.\/chunk15-base\.js';/,'chunk15 must use the immutable safe prepaint base');
assert.match(wrapperSrc,/import adminTopbarTickerSafeRuntime from '\.\.\/main-ui\/admin-topbar-ticker-safe-v2\.js';/,'chunk15 must compose isolated post-ready ticker runtime');
assert.match(wrapperSrc,/export default basePrepaintRuntime \+ adminTopbarTickerSafeRuntime \+ paymentsCanonicalFirstPaintGuardRuntime;/,'ticker and Payments guard must remain composed after prepaint');
assert.match(tickerSrc,/__RONA_MAIN_UI_RUNTIME_LOADED__===true/,'ticker mirror must wait until complete main runtime is loaded');
assert.match(tickerSrc,/window\.__RONA_VISUAL_V2__===true/,'ticker mirror must wait for premium visual runtime');
assert.match(tickerSrc,/readyForMirror/,'post-ready mirror gate must exist');
assert.match(tickerSrc,/new MutationObserver\(sync\)/,'ticker must mirror authoritative status updates when a source indicator exists');
assert.doesNotMatch(tickerSrc,/if\(!top\|\|!indicator\)return false/,'production ticker must not require the disabled diagnostic indicator');
assert.doesNotMatch(tickerSrc,/track\.appendChild\(indicator\)|insertBefore\(indicator|appendChild\(indicator\)/,'system lifecycle indicator must never be reparented');
assert.match(tickerSrc,/width:min\(34vw,640px\)!important;max-width:640px!important/,'desktop search must be intentionally narrower');
assert.match(tickerSrc,/@keyframes ronaAdminTopbarTickerV2/,'ticker must have running-line animation');
assert.match(tickerSrc,/prefers-reduced-motion:reduce/,'ticker must respect reduced-motion preference');
assert.doesNotMatch(tickerSrc,/fetch\s*\(|\/portal\/owner-api|\/api\//,'topbar presentation layer must not access backend/API surfaces');

const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
const fixture=`<!doctype html><html><head><style>html,body{margin:0;background:#06101a;color:#fff;font-family:Arial,sans-serif}.app{min-height:100vh}.topbar{display:flex;align-items:center;gap:12px;width:1700px;height:66px;padding:10px 18px;box-sizing:border-box}.search{flex:1;min-width:0;height:40px}.role-pill,.logout,#searchButton{height:36px;white-space:nowrap}</style></head><body><header class="topbar"><input class="search" type="search"><button id="searchButton">ПОИСК</button><span class="role-pill">ВНУТРЕННИЙ КОНТУР · Администратор</span><button class="logout" data-action="logout">Выход</button></header><div class="app"></div><script>window.__RONA_OWNER_ADMIN_READY__=false;window.__RONA_OWNER_AI_SYNC_SNAPSHOT__={};window.__RONA_MAIN_UI_RUNTIME_LOADED__=false;window.__RONA_VISUAL_V2__=false;window.__RONA_UI_BUILD__='owner-main-v4-test';</script></body></html>`;

async function openFixture(){
  const page=await browser.newPage({viewport:{width:1800,height:900}});
  await page.route('http://rona.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:fixture}));
  await page.goto('http://rona.test/portal/admin');
  return page;
}

try{
  {
    const page=await openFixture();
    const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
    await page.addScriptTag({content:prepaintRuntime});
    await page.addScriptTag({content:safeTickerRuntime});
    await page.waitForFunction(()=>document.getElementById('rona-owner-build-indicator'));
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('rona-owner-paint-ready')),false,'cold load must stay behind prepaint guard');
    assert.equal(await page.evaluate(()=>!!document.getElementById('rona-admin-topbar-ticker-v2')),false,'ticker must not mount during cold load');

    await page.evaluate(()=>{window.__RONA_OWNER_ADMIN_READY__=true});
    await page.waitForFunction(()=>document.documentElement.classList.contains('rona-owner-paint-ready'));
    assert.equal(await page.evaluate(()=>!!document.getElementById('rona-admin-topbar-ticker-v2')),false,'ticker must still wait for complete premium runtime');

    await page.evaluate(()=>{window.__RONA_MAIN_UI_RUNTIME_LOADED__=true;window.__RONA_VISUAL_V2__=true});
    await page.waitForFunction(()=>document.documentElement.classList.contains('rona-admin-topbar-ticker-v2-ready')&&document.getElementById('rona-admin-topbar-ticker-v2'));
    const proof=await page.evaluate(()=>{
      const top=document.querySelector('.topbar'),search=document.querySelector('.topbar>.search'),ticker=document.getElementById('rona-admin-topbar-ticker-v2'),track=ticker?.querySelector('.rona-admin-topbar-ticker-v2__track'),indicator=document.getElementById('rona-owner-build-indicator'),role=document.querySelector('.role-pill'),searchButton=document.getElementById('searchButton'),text=ticker?.querySelector('.rona-admin-topbar-ticker-v2__text');
      return{tickerParentIsTop:ticker?.parentElement===top,tickerImmediatelyBeforeRole:ticker?.nextElementSibling===role,tickerImmediatelyAfterSearchButton:ticker?.previousElementSibling===searchButton,indicatorStillBodyChild:indicator?.parentElement===document.body,indicatorText:indicator?.textContent||'',tickerText:text?.textContent||'',searchWidth:search.getBoundingClientRect().width,topbarWidth:top.getBoundingClientRect().width,tickerWidth:ticker.getBoundingClientRect().width,animationName:getComputedStyle(track).animationName,runtimeError:window.__RONA_ADMIN_TOPBAR_TICKER_SAFE_V2_ERROR__||null,lifecycleReady:window.__RONA_OWNER_FIRST_PAINT_READY__===true,mode:document.documentElement.dataset.ronaAdminTopbarTicker||''};
    });
    assert.equal(proof.runtimeError,null);
    assert.equal(proof.tickerParentIsTop,true);
    assert.equal(proof.tickerImmediatelyBeforeRole,true);
    assert.equal(proof.tickerImmediatelyAfterSearchButton,true);
    assert.equal(proof.indicatorStillBodyChild,true,'post-ready ticker must mirror, never move, the lifecycle indicator');
    assert.equal(proof.tickerText,proof.indicatorText,'ticker text must mirror the authoritative indicator when present');
    assert.ok(proof.searchWidth<=641,`search remains too wide: ${proof.searchWidth}`);
    assert.ok(proof.searchWidth<proof.topbarWidth*.50,`search should leave a visible ticker zone: ${proof.searchWidth}/${proof.topbarWidth}`);
    assert.ok(proof.tickerWidth>=279,`ticker should retain useful visual width: ${proof.tickerWidth}`);
    assert.equal(proof.animationName,'ronaAdminTopbarTickerV2');
    assert.equal(proof.lifecycleReady,true);
    assert.equal(proof.mode,'safe-mirror-v4');
    assert.deepEqual(errors,[],'indicator-present lifecycle must produce no page errors');
    await page.close();
  }

  {
    const page=await openFixture();
    const errors=[];page.on('pageerror',e=>errors.push(String(e?.message||e)));
    await page.evaluate(()=>{
      window.__RONA_OWNER_ADMIN_READY__=true;
      window.__RONA_MAIN_UI_RUNTIME_LOADED__=true;
      window.__RONA_VISUAL_V2__=true;
      document.documentElement.classList.add('rona-owner-paint-ready');
    });
    assert.equal(await page.evaluate(()=>!!document.getElementById('rona-owner-build-indicator')),false,'production diagnostics policy fixture must have no lifecycle indicator');
    await page.addScriptTag({content:safeTickerRuntime});
    await page.waitForFunction(()=>document.documentElement.classList.contains('rona-admin-topbar-ticker-v2-ready')&&document.getElementById('rona-admin-topbar-ticker-v2'));
    const proof=await page.evaluate(()=>{
      const top=document.querySelector('.topbar'),ticker=document.getElementById('rona-admin-topbar-ticker-v2'),role=document.querySelector('.role-pill'),text=ticker?.querySelector('.rona-admin-topbar-ticker-v2__text');
      return{indicatorCount:document.querySelectorAll('#rona-owner-build-indicator').length,tickerParentIsTop:ticker?.parentElement===top,tickerImmediatelyBeforeRole:ticker?.nextElementSibling===role,tickerText:text?.textContent||'',state:ticker?.dataset.state||'',mode:document.documentElement.dataset.ronaAdminTopbarTicker||'',runtimeError:window.__RONA_ADMIN_TOPBAR_TICKER_SAFE_V2_ERROR__||null};
    });
    assert.equal(proof.indicatorCount,0,'ticker must work with the production-disabled diagnostic indicator');
    assert.equal(proof.tickerParentIsTop,true);
    assert.equal(proof.tickerImmediatelyBeforeRole,true);
    assert.match(proof.tickerText,/Сборка: owner-main-v4-test · Данные: загружены/,'ticker must show safe lifecycle fallback text when source indicator is absent');
    assert.equal(proof.state,'ok');
    assert.equal(proof.mode,'safe-mirror-v4');
    assert.equal(proof.runtimeError,null);
    assert.deepEqual(errors,[],'production-policy no-indicator lifecycle must produce no page errors');
    await page.close();
  }

  console.log('ADMIN_TOPBAR_LIFECYCLE_MIRROR_V4_QA=PASS');
}finally{await browser.close()}
