import assert from 'node:assert/strict';
import fs from 'node:fs';
import lifecycle from '../functions/portal/owner-ui-chunks/chunk15.js';
import {adminTopbarTickerV2} from '../functions/portal/owner-ui-chunks/chunk18.js';

const lifecycleSrc=fs.readFileSync('functions/portal/owner-ui-chunks/chunk15.js','utf8');
const tickerSrc=fs.readFileSync('functions/portal/owner-ui-chunks/chunk18.js','utf8');
const admin=fs.readFileSync('portal-src/current/admin.html','utf8');

assert.match(admin,/class="topbar"/,'canonical Admin topbar must remain present');
assert.match(admin,/class="search"[^>]*type="search"/,'canonical global search must remain present');
assert.match(admin,/class="role-pill"/,'canonical role pill must remain present');
assert.match(lifecycleSrc,/position:fixed;right:12px;bottom:12px/,'system indicator must retain fixed fail-safe position');
assert.doesNotMatch(lifecycleSrc,/mountAdminTicker|rona-owner-build-ticker|track\.appendChild\(n\)|topbar>\.search/,'prepaint lifecycle must contain no topbar/ticker mutation');
assert.match(tickerSrc,/adminTopbarTickerV2/,'isolated post-ready ticker must exist');
assert.match(tickerSrc,/window\.__RONA_OWNER_ADMIN_READY__===true&&root\.classList\.contains\('rona-owner-paint-ready'\)/,'ticker must require completed Admin lifecycle');
assert.doesNotMatch(adminTopbarTickerV2,/appendChild\(n\)|insertBefore\(n/,'ticker must never move the system indicator');
assert.doesNotMatch(adminTopbarTickerV2,/fetch\s*\(|\/portal\/owner-api|\/api\//,'visual ticker must not access backend/API surfaces');

const {chromium}=await import('playwright');
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  const fixture=`<!doctype html><html><head><style>
  html,body{margin:0;background:#06101a;color:#fff;font-family:Arial,sans-serif}.app{min-height:100vh}.topbar{display:flex;align-items:center;gap:12px;width:1400px;height:66px;padding:10px 18px;box-sizing:border-box}.search{flex:1;min-width:0;height:40px}.role-pill,.logout,#searchButton{height:36px;white-space:nowrap}
  </style></head><body><header class="topbar"><input class="search" type="search"><button id="searchButton">ПОИСК</button><span class="role-pill">ВНУТРЕННИЙ КОНТУР · Администратор</span><button class="logout">Выход</button></header><div class="app"></div><script>window.__RONA_OWNER_ADMIN_READY__=false;window.__RONA_OWNER_AI_SYNC_SNAPSHOT__={};window.__RONA_UI_BUILD__='owner-main-v4-test';</script></body></html>`;
  await page.route('http://rona.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:fixture}));
  await page.goto('http://rona.test/portal/admin');
  await page.addScriptTag({content:lifecycle});
  await page.addScriptTag({content:adminTopbarTickerV2});
  await page.waitForFunction(()=>document.getElementById('rona-owner-build-indicator'));

  const cold=await page.evaluate(()=>{const n=document.getElementById('rona-owner-build-indicator');return{ready:document.documentElement.classList.contains('rona-owner-paint-ready'),ticker:!!document.getElementById('rona-admin-build-ticker-v2'),sourceParent:n?.parentElement?.tagName||'',position:getComputedStyle(n).position}});
  assert.equal(cold.ready,false,'cold start must remain behind prepaint guard');
  assert.equal(cold.ticker,false,'ticker must not mount before Admin READY');
  assert.equal(cold.sourceParent,'BODY','system indicator must remain a body child during boot');
  assert.equal(cold.position,'fixed','system indicator must retain fail-safe positioning during boot');

  await page.waitForTimeout(250);
  await page.evaluate(()=>{window.__RONA_OWNER_ADMIN_READY__=true});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-owner-paint-ready'));
  await page.waitForFunction(()=>document.getElementById('rona-admin-build-ticker-v2'));
  await page.waitForTimeout(80);

  const proof=await page.evaluate(()=>{
    const top=document.querySelector('.topbar'),search=document.querySelector('.topbar>.search'),ticker=document.getElementById('rona-admin-build-ticker-v2'),track=ticker?.querySelector('.track'),indicator=document.getElementById('rona-owner-build-indicator'),role=document.querySelector('.role-pill'),searchButton=document.getElementById('searchButton'),text=ticker?.querySelector('.text');
    return {
      tickerParentIsTop:ticker?.parentElement===top,
      tickerImmediatelyBeforeRole:ticker?.nextElementSibling===role,
      tickerImmediatelyAfterSearchButton:ticker?.previousElementSibling===searchButton,
      indicatorCount:document.querySelectorAll('#rona-owner-build-indicator').length,
      indicatorStillBodyChild:indicator?.parentElement===document.body,
      indicatorPosition:getComputedStyle(indicator).position,
      indicatorVisibility:getComputedStyle(indicator).visibility,
      indicatorText:indicator?.textContent||'',
      tickerText:text?.textContent||'',
      searchWidth:search.getBoundingClientRect().width,
      topbarWidth:top.getBoundingClientRect().width,
      tickerWidth:ticker.getBoundingClientRect().width,
      animationName:getComputedStyle(track).animationName,
      lifecycleReady:window.__RONA_OWNER_FIRST_PAINT_READY__===true,
      tickerReady:document.documentElement.dataset.ronaAdminTopbarTicker==='ready'
    };
  });
  assert.equal(proof.tickerParentIsTop,true);
  assert.equal(proof.tickerImmediatelyBeforeRole,true);
  assert.equal(proof.tickerImmediatelyAfterSearchButton,true);
  assert.equal(proof.indicatorCount,1);
  assert.equal(proof.indicatorStillBodyChild,true,'post-ready ticker must mirror, never reparent, system indicator');
  assert.equal(proof.indicatorPosition,'fixed');
  assert.equal(proof.indicatorVisibility,'hidden','desktop post-ready mirror hides only the original presentation, not its lifecycle node');
  assert.match(proof.indicatorText,/Сборка: owner-main-v4-test · Данные: загружены/);
  assert.equal(proof.tickerText,proof.indicatorText,'ticker must mirror authoritative indicator text');
  assert.ok(proof.searchWidth<=761,`search remains too wide: ${proof.searchWidth}`);
  assert.ok(proof.searchWidth<proof.topbarWidth*.60,`search should leave a visible ticker zone: ${proof.searchWidth}/${proof.topbarWidth}`);
  assert.ok(proof.tickerWidth>=219,`ticker should retain useful visual width: ${proof.tickerWidth}`);
  assert.equal(proof.animationName,'ronaAdminTickerV2');
  assert.equal(proof.lifecycleReady,true);
  assert.equal(proof.tickerReady,true);
  assert.deepEqual(errors,[],'cold-start lifecycle/ticker must produce no page errors');

  await page.reload();
  await page.addScriptTag({content:lifecycle});
  await page.addScriptTag({content:adminTopbarTickerV2});
  await page.waitForFunction(()=>document.getElementById('rona-owner-build-indicator'));
  const hardReloadCold=await page.evaluate(()=>({ready:document.documentElement.classList.contains('rona-owner-paint-ready'),ticker:!!document.getElementById('rona-admin-build-ticker-v2'),sourceParent:document.getElementById('rona-owner-build-indicator')?.parentElement?.tagName||''}));
  assert.equal(hardReloadCold.ready,false);
  assert.equal(hardReloadCold.ticker,false);
  assert.equal(hardReloadCold.sourceParent,'BODY');
  await page.evaluate(()=>{window.__RONA_OWNER_ADMIN_READY__=true});
  await page.waitForFunction(()=>document.documentElement.classList.contains('rona-owner-paint-ready')&&document.getElementById('rona-admin-build-ticker-v2'));
  assert.equal(await page.evaluate(()=>document.getElementById('rona-owner-build-indicator')?.parentElement===document.body),true,'hard reload must preserve lifecycle indicator ownership');

  console.log('ADMIN_TOPBAR_LIFECYCLE_ISOLATION_V2=PASS',JSON.stringify(proof));
}finally{
  await browser.close();
}
