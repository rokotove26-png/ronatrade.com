import assert from 'node:assert/strict';
import fs from 'node:fs';
import runtime from '../functions/portal/owner-ui-chunks/chunk15.js';

const src=fs.readFileSync('functions/portal/owner-ui-chunks/chunk15.js','utf8');
const admin=fs.readFileSync('portal-src/current/admin.html','utf8');

assert.match(admin,/class="topbar"/,'canonical Admin topbar must remain present');
assert.match(admin,/class="search"[^>]*type="search"/,'canonical global search must remain present');
assert.match(admin,/class="role-pill"/,'canonical role pill must remain present');
assert.match(src,/position:fixed;right:12px;bottom:12px/,'pre-paint build indicator must retain fixed fail-safe position');
assert.match(src,/html\.rona-owner-paint-ready \.topbar>\.search\{flex:0 1 760px!important;width:min\(44vw,760px\)!important;max-width:760px!important;min-width:360px!important\}/,'ready Admin search must be intentionally narrower');
assert.match(src,/rona-owner-build-ticker/,'topbar ticker host must exist');
assert.match(src,/@keyframes ronaOwnerBuildTicker/,'ticker must have running-line animation');
assert.match(src,/top\.insertBefore\(host,anchor\)/,'ticker must be inserted immediately before the internal/role contour');
assert.match(src,/track\.appendChild\(n\)/,'the existing build indicator must be moved, not recreated');
assert.match(src,/внутренний\\s\+контур/,'live internal-contour label must be a preferred anchor');
assert.doesNotMatch(src,/cloneNode\s*\(/,'build/status caption must not be duplicated');
assert.match(src,/prefers-reduced-motion:reduce/,'ticker must respect reduced-motion preference');
assert.doesNotMatch(src,/fetch\s*\(|\/portal\/owner-api|\/api\//,'topbar visual change must not access backend/API surfaces');

const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const fixture=`<!doctype html><html><head><style>
  html,body{margin:0;background:#06101a;color:#fff;font-family:Arial,sans-serif}.app{min-height:100vh}.topbar{display:flex;align-items:center;gap:12px;width:1400px;height:66px;padding:10px 18px;box-sizing:border-box}.search{flex:1;min-width:0;height:40px}.role-pill,.logout,#searchButton{height:36px;white-space:nowrap}
  </style></head><body><header class="topbar"><input class="search" type="search"><button id="searchButton">ПОИСК</button><span class="role-pill">ВНУТРЕННИЙ КОНТУР · Администратор</span><button class="logout">Выход</button></header><div class="app"></div><script>window.__RONA_OWNER_ADMIN_READY__=true;window.__RONA_OWNER_AI_SYNC_SNAPSHOT__={};window.__RONA_UI_BUILD__='owner-main-v4-test';</script></body></html>`;
  await page.route('http://rona.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:fixture}));
  await page.goto('http://rona.test/portal/admin');
  await page.addScriptTag({content:runtime});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-owner-paint-ready')&&document.getElementById('rona-owner-build-ticker'));
  const proof=await page.evaluate(()=>{
    const top=document.querySelector('.topbar');
    const search=document.querySelector('.topbar>.search');
    const ticker=document.getElementById('rona-owner-build-ticker');
    const track=ticker?.querySelector('.rona-owner-build-ticker__track');
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
      indicatorText:indicator?.textContent||'',
      searchWidth:search.getBoundingClientRect().width,
      topbarWidth:top.getBoundingClientRect().width,
      tickerWidth:ticker.getBoundingClientRect().width,
      animationName:getComputedStyle(track).animationName
    };
  });
  assert.equal(proof.tickerParentIsTop,true);
  assert.equal(proof.tickerImmediatelyBeforeRole,true);
  assert.equal(proof.tickerImmediatelyAfterSearchButton,true);
  assert.equal(proof.indicatorCount,1);
  assert.equal(proof.indicatorMovedIntoTrack,true);
  assert.equal(proof.indicatorPosition,'static');
  assert.match(proof.indicatorText,/Сборка: owner-main-v4-test · Данные: загружены/);
  assert.ok(proof.searchWidth<=761,`search remains too wide: ${proof.searchWidth}`);
  assert.ok(proof.searchWidth<proof.topbarWidth*.60,`search should leave a visible ticker zone: ${proof.searchWidth}/${proof.topbarWidth}`);
  assert.ok(proof.tickerWidth>=219,`ticker should retain useful visual width: ${proof.tickerWidth}`);
  assert.equal(proof.animationName,'ronaOwnerBuildTicker');
  console.log('ADMIN_TOPBAR_BUILD_TICKER_V1_QA=PASS',JSON.stringify(proof));
}finally{
  await browser.close();
}
