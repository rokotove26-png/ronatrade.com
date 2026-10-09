import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,normalize,extname} from 'node:path';
import {chromium} from 'playwright';

const ROOT=process.cwd(),DIST=join(ROOT,'dist');
const canonicalHtml=await readFile(join(DIST,'portal/client.html'),'utf8');
const worker=await readFile(join(ROOT,'functions/portal/[[path]].js'),'utf8');
const marketHeadBoot='<script id="rona-client-market-intelligence-server-boot-v4" src="/assets/portal-runtime/client-market-intelligence-v1.js?v=20261009-authorized-client-bootstrap-v4" defer fetchpriority="high"></script>';
const requiredServerSource=[
  "const CLIENT_ANALYTICS_HEAD_BOOT =",
  "HeadPrepend(bridge+CLIENT_ANALYTICS_HEAD_BOOT)",
  "HeadAppend(CLIENT_HOME_BOOT_PRIORITY+CLIENT_ANALYTICS_HEAD_BOOT)",
  "SERVER_HEAD_V4_AUTHORIZED_IMPERSONATION",
  "SERVER_HEAD_V4_AUTHORIZED_CLIENT"
];
for(const token of requiredServerSource)if(!worker.includes(token))throw Error('SERVER_CLIENT_ANALYTICS_BOOT_CONTRACT_MISSING: '+token);
if(!/<head(?:\s|>)/i.test(canonicalHtml))throw Error('CANONICAL_CLIENT_HEAD_NOT_FOUND');
const html=canonicalHtml.replace(/<head(?:\s[^>]*)?>/i,m=>m+marketHeadBoot);
const marker='20261009-client-analytics-current-source-safe-v3';
const bridge='<script id="rona-client-market-intelligence-v1"';
const report={
  hasBridge:html.includes(bridge),
  hasServerHeadBoot:html.includes('rona-client-market-intelligence-server-boot-v4'),
  serverImpersonationGuard:worker.includes('HeadPrepend(bridge+CLIENT_ANALYTICS_HEAD_BOOT)'),
  markerRef:html.includes('client-market-intelligence-v1.js?v=20261009-current-source-safe-v3'),
  rootStatic:/id=["']page-analytics["']/.test(html),
  analyticsNodeMatch:html.match(/.{0,180}id=["']page-analytics["'].{0,280}/)?.[0]||'not found',
  possibleIds:([...html.matchAll(/id=["']([^"']*analytic[^"']*)["']/gi)]).map(x=>x[1]).slice(0,30),
  matchesOldText:html.includes('21.08.2026')||html.includes('09.2026')
};
console.log('CLIENT_REAL_CANONICAL_HTML',JSON.stringify(report));

const payload={ok:true,data:{version:'RONA_CLIENT_MARKET_INTELLIGENCE_V1',generated_at:'2026-10-09T00:01:00Z',analytics:[],news:[]}};
const MIME={'.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const srv=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://127.0.0.1');
    res.setHeader('cache-control','no-store');
    if(u.pathname==='/portal/client'){
      res.setHeader('content-type','text/html; charset=utf-8');res.end(html);return;
    }
    if(u.pathname==='/portal/api/v1/client/market-intelligence'){
      res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(payload));return;
    }
    if(u.pathname.startsWith('/portal/api/')){
      res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:false,code:'CANONICAL_QA_NO_AUTH'}));return;
    }
    const clean=normalize(u.pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/,'');
    const file=join(DIST,clean);
    if(file.startsWith(DIST)){try{if((await stat(file)).isFile()){res.setHeader('content-type',MIME[extname(file).toLowerCase()]||'application/octet-stream');res.end(await readFile(file));return;}}catch{}}
    res.statusCode=404;res.end('not found');
  }catch(e){res.statusCode=500;res.end(String(e))}
});
await new Promise(resolve=>srv.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+srv.address().port;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1400,height:850}});
  const errors=[],requestFail=[];
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  page.on('requestfailed',r=>{if(requestFail.length<30)requestFail.push({url:r.url(),failure:r.failure()})});
  await page.goto(origin+'/portal/client?impSession=00000000-0000-4000-8000-000000000001',{waitUntil:'domcontentloaded',timeout:20000});
  await page.waitForTimeout(3000);
  const d=await page.evaluate(()=>({
    path:location.pathname,
    readyState:document.readyState,
    scriptPresence:!!document.getElementById('rona-client-market-intelligence-v1'),
    serverBootPresence:!!document.getElementById('rona-client-market-intelligence-server-boot-v4'),
    scriptSrc:document.getElementById('rona-client-market-intelligence-v1')?.getAttribute('src'),
    runtimeMarker:window.__RONA_CLIENT_MARKET_INTELLIGENCE__||null,
    rootCount:document.querySelectorAll('#page-analytics').length,
    rootIds:[...document.querySelectorAll('[id*="analyt"],[data-page*="analyt"]')].slice(0,30).map(n=>({tag:n.tagName,id:n.id,dataPage:n.dataset.page,text:String(n.textContent||'').trim().slice(0,75)})),
    rootDataset:{...document.querySelector('#page-analytics')?.dataset},
    ownerCount:document.querySelectorAll('[data-rona-client-market-intelligence-owner="analytics"]').length,
    ownerState:document.querySelector('[data-rona-client-market-intelligence-owner="analytics"]')?.dataset.renderState,
    rootExcerpt:document.querySelector('#page-analytics')?.innerText?.slice(0,650),
    htmlLegacyVisible:document.body?.innerText?.includes('21.08.2026')??null
  }));
  console.log('CLIENT_REAL_CANONICAL_BROWSER',JSON.stringify({diagnostic:d,errors:errors.slice(0,12),requestFails:requestFail.slice(0,7)}));
  if(!report.hasBridge||!report.markerRef||!report.hasServerHeadBoot||!report.serverImpersonationGuard)throw Error('CANONICAL_AND_SERVER_CLIENT_ANALYTICS_BOOT_MISSING');
  if(!d.runtimeMarker||d.ownerCount!==1||d.rootDataset.ronaClientAnalyticsMigrated!=='v3')throw Error('CANONICAL_REAL_PAGE_ANALYTICS_BOOT_FAILED: '+JSON.stringify(d).slice(0,1500));
  if((d.rootExcerpt||'').includes('21.08.2026')||(d.rootExcerpt||'').includes('Прогноз 09.2026'))throw Error('ARCHIVED_202608_DATA_VISIBLE_IN_CANONICAL_REAL_PAGE');
  // The screenshot was captured after Client navigation in an impersonated tab,
  // not on initial DOMContentLoaded. Prove the same canonical page after re-entry.
  for(const turn of ['first-nav','second-nav']){
    await page.evaluate(()=>{
      const nav=[...document.querySelectorAll('[data-page="analytics"]')].find(n=>n.tagName==='BUTTON')||
                document.querySelector('[data-page="analytics"]');
      if(!nav)throw Error('CANONICAL_ANALYTICS_NAVIGATION_NOT_FOUND');
      nav.click();
    });
    await page.waitForTimeout(1200);
    const observed=await page.evaluate(()=>{
      const root=document.getElementById('page-analytics');
      const owner=root?.querySelector('[data-rona-client-market-intelligence-owner="analytics"]');
      return {
        migrated:root?.dataset.ronaClientAnalyticsMigrated||null,
        marker:window.__RONA_CLIENT_MARKET_INTELLIGENCE__||null,
        ownerCount:root?.querySelectorAll('[data-rona-client-market-intelligence-owner="analytics"]').length||0,
        ownerState:owner?.dataset.renderState||null,
        legacyVisible:[...root?.querySelectorAll('[data-rona-client-analytics-legacy="hidden-v3"]')||[]]
          .filter(n=>getComputedStyle(n).display!=='none').length,
        visibleOldText:String(root?.innerText||'').includes('21.08.2026')||
                        String(root?.innerText||'').includes('Прогноз 09.2026')
      };
    });
    console.log('CLIENT_CANONICAL_REENTRY',JSON.stringify({turn,observed}));
    if(observed.migrated!=='v3'||observed.ownerCount!==1||observed.legacyVisible||observed.visibleOldText)
      throw Error('CLIENT_ANALYTICS_REENTRY_LEGACY_VISIBLE: '+JSON.stringify({turn,observed}));
  }
  console.log('CLIENT_CANONICAL_REAL_PAGE_ANALYTICS_BOOT=PASS');
}finally{if(browser)await browser.close();srv.closeAllConnections?.();await new Promise(resolve=>srv.close(resolve));}
