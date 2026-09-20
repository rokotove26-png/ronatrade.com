import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const adminSource=(await readFile('dist/portal/admin.html')).toString('utf8');
const admin=Buffer.from(adminSource.replace(/<button([^>]*)><span class="nav-icon" aria-hidden="true"><\/span><span class="nav-label">([^<]+)<\/span><\/button>/g,'<button$1>$2</button>'),'utf8');
assert(!admin.toString('utf8').includes('class="nav-icon"'),'QA legacy-shell fixture must remove icon slots before runtime repair');
const logo=await readFile('dist/assets/portal-canonical/logo.svg');
const background=await readFile('dist/assets/portal-canonical/background.png');
const shellModule=await import(pathToFileURL(resolve('functions/portal/admin-approved-shell-v455-ui.js')).href+'?qa-sidebar-v14');
const shellResponse=await shellModule.onRequest();
const shellRuntime=await shellResponse.text();

assert.equal(shellResponse.headers.get('x-rona-admin-shell-visual'),'sidebar-production-self-heal-v14');
assert(!admin.toString('utf8').includes('RONA_ADMIN_COMMAND_NAVIGATION_V4'));
assert(!admin.toString('utf8').includes('RONA_ADMIN_COMMAND_NAVIGATION_V5_BRAND_ICONS'));
assert(!admin.toString('utf8').includes('RONA_ADMIN_SIDEBAR_CANONICAL_VISUAL_V12'));

function send(res,status,body,type){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
  res.end(body);
}
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/portal/admin')return send(res,200,admin,'text/html; charset=utf-8');
  if(url.pathname==='/portal/admin-approved-shell-v455-ui')return send(res,200,shellRuntime,'application/javascript; charset=utf-8');
  if(url.pathname==='/assets/portal-canonical/logo.svg')return send(res,200,logo,'image/svg+xml');
  if(url.pathname==='/assets/portal-canonical/background.png')return send(res,200,background,'image/png');
  if(url.pathname.endsWith('.css'))return send(res,200,'','text/css; charset=utf-8');
  if(url.pathname.endsWith('.js')||url.pathname.startsWith('/portal/'))return send(res,200,'','application/javascript; charset=utf-8');
  return send(res,404,'not found','text/plain; charset=utf-8');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:2048,height:1152},deviceScaleFactor:1});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e.message||e)));

  await page.goto(origin+'/portal/admin',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_ADMIN_SIDEBAR_OWNER__==='shell-v455-command-v14');
  await page.waitForFunction(()=>document.querySelectorAll('#nav .nav-icon > svg').length===14);

  const proof=await page.evaluate(()=>{
    const nav=document.getElementById('nav');
    const side=document.querySelector('.sidebar');
    const buttons=[...nav.querySelectorAll('button[data-page]')];
    const visible=buttons.filter(b=>getComputedStyle(b).display!=='none');
    const centers=visible.map(b=>{
      const icon=b.querySelector('.nav-icon');
      const svg=icon?.querySelector(':scope>svg');
      const a=icon?.getBoundingClientRect();
      const s=svg?.getBoundingClientRect();
      return {
        page:b.dataset.page,
        hasSvg:!!svg,
        text:(icon?.textContent||'').trim(),
        dx:a&&s?Math.abs((a.left+a.width/2)-(s.left+s.width/2)):999,
        dy:a&&s?Math.abs((a.top+a.height/2)-(s.top+s.height/2)):999,
        svgDisplay:svg?getComputedStyle(svg).display:'',
        pseudoBefore:icon?getComputedStyle(icon,'::before').content:''
      };
    });
    const active=nav.querySelector('button.active');
    const activeIcon=active.querySelector('.nav-icon');
    return {
      owner:document.documentElement.dataset.ronaSidebarOwner,
      sideOwner:side?.dataset.ronaSidebarOwner,
      navOwner:nav?.dataset.ronaSidebarOwner,
      diagnostic:window.__RONA_ADMIN_SIDEBAR_DIAGNOSTIC__,
      repaired:visible.map(b=>({page:b.dataset.page,structure:b.dataset.ronaNavStructure,children:b.children.length,label:b.querySelector(':scope>.nav-label')?.textContent||''})),
      styles:document.querySelectorAll('#ronaShellV455Style').length,
      iconCount:nav.querySelectorAll('.nav-icon > svg').length,
      visibleCount:visible.length,
      documentsDisplay:getComputedStyle(nav.querySelector('button[data-page="documents"]')).display,
      activePage:active?.dataset.page,
      activeIconBorder:getComputedStyle(activeIcon).borderTopColor,
      centers
    };
  });

  assert.equal(proof.owner,'shell-v455-command-v14');
  assert.equal(proof.sideOwner,'shell-v455-command-v14');
  assert.equal(proof.navOwner,'shell-v455-command-v14');
  assert.equal(proof.diagnostic?.owner,'shell-v455-command-v14');
  assert.equal(proof.diagnostic?.icons,14,'runtime diagnostic must see 14 rendered icons');
  assert.deepEqual(proof.diagnostic?.missing,[],'runtime diagnostic must report no missing icons');
  for(const item of proof.repaired){assert.equal(item.structure,'shell-v455-command-v14',item.page+': self-heal structure marker missing');assert.equal(item.children,2,item.page+': repaired button must contain exactly icon and label');assert(item.label.trim().length>0,item.page+': repaired label missing')}
  assert.equal(proof.styles,1,'expected exactly one runtime shell style owner');
  assert.equal(proof.iconCount,14,'all 14 nav items must own a real SVG icon');
  assert.equal(proof.visibleCount,13,'Documents stays structurally hidden');
  assert.equal(proof.documentsDisplay,'none');
  assert.equal(proof.activePage,'home');
  assert.match(proof.activeIconBorder,/rgba?\(/);
  for(const item of proof.centers){
    assert(item.hasSvg,item.page+': SVG missing');
    assert.equal(item.text,'',item.page+': legacy glyph/text remains');
    assert.equal(item.svgDisplay,'block',item.page+': SVG is not rendered');
    assert(item.dx<=0.75,item.page+': icon is not horizontally centered ('+item.dx+')');
    assert(item.dy<=0.75,item.page+': icon is not vertically centered ('+item.dy+')');
    assert(item.pseudoBefore==='none'||item.pseudoBefore==='normal',item.page+': pseudo icon layer returned ('+item.pseudoBefore+')');
  }

  await page.evaluate(()=>window.RONA_NAV_ATTENTION.set('agent-settlements',true,'QA attention proof'));
  await page.waitForFunction(()=>document.querySelector('#nav button[data-page="agent-settlements"]')?.classList.contains('rona-nav-attention'));
  await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('#nav button[data-page="agent-settlements"] .nav-icon svg')).opacity)>.99);
  const attention=await page.evaluate(()=>{
    const b=document.querySelector('#nav button[data-page="agent-settlements"]');
    const icon=b.querySelector('.nav-icon');
    const svg=icon.querySelector('svg');
    return {
      className:b.className,
      bg:getComputedStyle(b).backgroundImage,
      shadow:getComputedStyle(b).boxShadow,
      iconColor:getComputedStyle(icon).color,
      svgOpacity:getComputedStyle(svg).opacity
    };
  });
  assert(attention.className.includes('rona-nav-attention'));
  assert(attention.bg.includes('linear-gradient'));
  assert.notEqual(attention.shadow,'none');
  assert(Number(attention.svgOpacity)>.99,'attention icon did not reach full opacity');

  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/admin-sidebar-production-self-heal-v14.png',fullPage:false});
  assert.equal(pageErrors.length,0,'page errors: '+pageErrors.join(' | '));

  console.log('ADMIN_SIDEBAR_PRODUCTION_SELF_HEAL_VISUAL_BROWSER=PASS');
  console.log(JSON.stringify({proof,attention},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
