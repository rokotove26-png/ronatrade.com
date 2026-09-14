import assert from 'node:assert/strict';
import fs from 'node:fs';
import prepaintRuntime from '../functions/portal/owner-ui-chunks/chunk15.js';
import safeTickerRuntime from '../functions/portal/main-ui/admin-topbar-ticker-safe-v2.js';

const prepaintSrc=fs.readFileSync('functions/portal/owner-ui-chunks/chunk15.js','utf8');
const tickerSrc=fs.readFileSync('functions/portal/main-ui/admin-topbar-ticker-safe-v2.js','utf8');
const applicationRuntime=fs.readFileSync('functions/portal/main-ui/application-passport-runtime.js','utf8');
const admin=fs.readFileSync('portal-src/current/admin.html','utf8');

assert.match(admin,/class="topbar"/,'canonical Admin topbar must remain present');
assert.match(admin,/class="search"[^>]*type="search"/,'canonical global search must remain present');
assert.match(admin,/class="role-pill"/,'canonical role pill must remain present');
assert.match(prepaintSrc,/position:fixed;right:12px;bottom:12px/,'pre-paint build indicator must retain fixed loading position');
assert.doesNotMatch(prepaintSrc,/rona-owner-build-ticker|mountAdminTicker|top\.insertBefore\(host,anchor\)/,'prepaint runtime must not mutate the Admin topbar');
assert.match(tickerSrc,/__RONA_MAIN_UI_RUNTIME_LOADED__===true/,'ticker relocation must wait until the complete main runtime has loaded');
assert.match(tickerSrc,/window\.__RONA_VISUAL_V2__===true/,'ticker relocation must wait for premium visual runtime');
assert.match(tickerSrc,/directChildOf\(top,top\.querySelector\('\.role-pill'\)\)/,'role fallback must be normalized to a direct topbar child');
assert.match(tickerSrc,/try\{if\(!readyForRelocation\(\)\)return false/,'post-ready relocation must fail safely');
assert.match(tickerSrc,/width:min\(34vw,640px\)!important;max-width:640px!important/,'desktop search must be intentionally narrower');
assert.match(tickerSrc,/@keyframes ronaAdminTopbarTickerV2/,'ticker must have running-line animation');
assert.match(tickerSrc,/track\.appendChild\(indicator\)/,'existing build indicator must be moved, not recreated');
assert.match(tickerSrc,/prefers-reduced-motion:reduce/,'ticker must respect reduced-motion preference');
assert.doesNotMatch(tickerSrc,/fetch\s*\(|\/portal\/owner-api|\/api\//,'topbar recovery layer must not access backend/API surfaces');
assert.match(applicationRuntime,/import adminTopbarTickerSafeRuntime from '\.\/admin-topbar-ticker-safe-v2\.js';/,'safe ticker must be imported by the post-base application runtime composition');
assert.match(applicationRuntime,/adminApplicationsReadabilityV5 \+ adminTopbarTickerSafeRuntime;/,'safe ticker must run after accepted Applications premium/readability runtimes');

const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1800,height:900}});
  const fixture=`<!doctype html><html><head><style>
  html,body{margin:0;background:#06101a;color:#fff;font-family:Arial,sans-serif}.app{min-height:100vh}.topbar{display:flex;align-items:center;gap:12px;width:1700px;height:66px;padding:10px 18px;box-sizing:border-box}.search{flex:1;min-width:0;height:40px}.role-pill,.logout,#searchButton{height:36px;white-space:nowrap}
  </style></head><body><header class="topbar"><input class="search" type="search"><button id="searchButton">ПОИСК</button><span class="role-pill">ВНУТРЕННИЙ КОНТУР · Администратор</span><button class="logout" data-action="logout">Выход</button></header><div class="app"></div><script>window.__RONA_OWNER_ADMIN_READY__=true;window.__RONA_OWNER_AI_SYNC_SNAPSHOT__={};window.__RONA_UI_BUILD__='owner-main-v4-test';</script></body></html>`;
  await page.route('http://rona.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:fixture}));
  await page.goto('http://rona.test/portal/admin');
  await page.addScriptTag({content:prepaintRuntime});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-owner-paint-ready')&&document.getElementById('rona-owner-build-indicator'));
  const loadingProof=await page.evaluate(()=>{const i=document.getElementById('rona-owner-build-indicator');return{parentIsBody:i?.parentElement===document.body,position:getComputedStyle(i).position,text:i?.textContent||''}});
  assert.equal(loadingProof.parentIsBody,true,'loading indicator must stay in bottom fail-safe position until full runtime completion');
  assert.equal(loadingProof.position,'fixed');
  assert.match(loadingProof.text,/Сборка: owner-main-v4-test · Данные: загружены/);
  await page.evaluate(()=>{window.__RONA_MAIN_UI_RUNTIME_LOADED__=true;window.__RONA_VISUAL_V2__=true});
  await page.addScriptTag({content:safeTickerRuntime});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-admin-topbar-ticker-v2-ready')&&document.getElementById('rona-admin-topbar-ticker-v2'));
  const proof=await page.evaluate(()=>{
    const top=document.querySelector('.topbar');
    const search=document.querySelector('.topbar>.search');
    const ticker=document.getElementById('rona-admin-topbar-ticker-v2');
    const track=ticker?.querySelector('.rona-admin-topbar-ticker-v2__track');
    const indicator=document.getElementById('rona-owner-build-indicator');
    const role=document.querySelector('.role-pill');
    const searchButton=document.getElementById('searchButton');
    return {
      tickerParentIsTop:ticker?.parentElement===top,
      tickerImmediatelyBeforeRole:ticker?.nextElementSibling===role,
      tickerImmediatelyAfterSearchButton:ticker?.previousElementSibling===searchButton,
      indicatorCount:document.querySelectorAll('#rona-owner-build-indicator').length,
      indicatorMovedIntoTrack:indicator?.parentElement===track,
      indicatorPosition:getComputedStyle(indicator).position,
      searchWidth:search.getBoundingClientRect().width,
      topbarWidth:top.getBoundingClientRect().width,
      tickerWidth:ticker.getBoundingClientRect().width,
      animationName:getComputedStyle(track).animationName,
      runtimeError:window.__RONA_ADMIN_TOPBAR_TICKER_SAFE_V2_ERROR__||null
    };
  });
  assert.equal(proof.runtimeError,null);
  assert.equal(proof.tickerParentIsTop,true);
  assert.equal(proof.tickerImmediatelyBeforeRole,true);
  assert.equal(proof.tickerImmediatelyAfterSearchButton,true);
  assert.equal(proof.indicatorCount,1);
  assert.equal(proof.indicatorMovedIntoTrack,true);
  assert.equal(proof.indicatorPosition,'static');
  assert.ok(proof.searchWidth<=641,`search remains too wide: ${proof.searchWidth}`);
  assert.ok(proof.searchWidth<proof.topbarWidth*.50,`search should leave a visible ticker zone: ${proof.searchWidth}/${proof.topbarWidth}`);
  assert.ok(proof.tickerWidth>=279,`ticker should retain useful visual width: ${proof.tickerWidth}`);
  assert.equal(proof.animationName,'ronaAdminTopbarTickerV2');
  console.log('ADMIN_TOPBAR_RUNTIME_RECOVERY_V2_QA=PASS',JSON.stringify({loadingProof,proof}));
}finally{
  await browser.close();
}
