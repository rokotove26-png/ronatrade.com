import http from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root='dist';
const html=await readFile(join(root,'portal','client.html'),'utf8');
assert.equal((html.match(/client-sidebar-command-nav-v1\.js/g)||[]).length,1,'Client sidebar runtime bridge must be single-owner');
assert(html.includes('id="rona-client-sidebar-command-nav-v1"'),'Client sidebar runtime bridge id missing');

const mimes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8'};
function safePath(urlPath){
  const clean=normalize(urlPath.split('?')[0]).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/,'');
  return join(root,clean);
}
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1');
  try{
    if(u.pathname==='/portal/client'||u.pathname==='/portal/client.html'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html);return;
    }
    if(u.pathname.startsWith('/portal/api/')||u.pathname.startsWith('/v1/')){
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      res.end(JSON.stringify({ok:true,data:{contexts:[],items:[],deals:[],payments:[]}}));return;
    }
    const file=safePath(u.pathname);
    const s=await stat(file);
    if(!s.isFile())throw new Error('not file');
    const body=await readFile(file);
    res.writeHead(200,{'content-type':mimes[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch{
    res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('not found');
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1160,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__RONA_CLIENT_SIDEBAR_DIAGNOSTIC__?.owner==='command-nav-v1');
  await page.waitForFunction(()=>window.__RONA_CLIENT_SIDEBAR_DIAGNOSTIC__?.icons===13);

  const proof=await page.evaluate(()=>{
    const nav=document.querySelector('aside.sidebar #nav');
    const buttons=[...nav.querySelectorAll(':scope>button[data-page]')];
    const iconProof=buttons.map(b=>{
      const slot=b.querySelector(':scope>.nav-icon'),svg=slot?.querySelector(':scope>svg');
      const a=slot?.getBoundingClientRect(),s=svg?.getBoundingClientRect();
      return{
        page:b.dataset.page,
        glyph:(slot?.textContent||'').trim(),
        svg:!!svg,
        dx:a&&s?Math.abs((a.left+a.width/2)-(s.left+s.width/2)):999,
        dy:a&&s?Math.abs((a.top+a.height/2)-(s.top+s.height/2)):999,
        iconColor:slot?getComputedStyle(slot).color:'',
        labelFont:Number.parseFloat(getComputedStyle(b.querySelector(':scope>.nav-label')).fontSize),
        labelLine:Number.parseFloat(getComputedStyle(b.querySelector(':scope>.nav-label')).lineHeight),
        buttonOverflow:b.scrollWidth-b.clientWidth,
        labelOverflow:b.querySelector(':scope>.nav-label').scrollWidth-b.querySelector(':scope>.nav-label').clientWidth
      };
    });
    const active=buttons.find(b=>b.classList.contains('active')||b.getAttribute('aria-current')==='page');
    return{
      owner:document.documentElement.dataset.ronaClientSidebarOwner,
      sideOwner:document.querySelector('aside.sidebar')?.dataset.ronaClientSidebarOwner,
      styles:document.querySelectorAll('#ronaClientSidebarCommandNavV1Style').length,
      buttons:buttons.length,
      icons:nav.querySelectorAll(':scope>button[data-page]>.nav-icon>svg').length,
      groups:[...nav.querySelectorAll(':scope>.nav-group')].map(x=>({text:x.textContent.trim(),font:getComputedStyle(x).fontSize,color:getComputedStyle(x).color})),
      active:active?.dataset.page||'',
      activeBackground:active?getComputedStyle(active).backgroundImage:'',
      activeIconColor:active?getComputedStyle(active.querySelector('.nav-icon')).color:'',
      footerColor:getComputedStyle(document.querySelector('aside.sidebar .sidebar-foot')).color,
      iconProof,
      diagnostic:window.__RONA_CLIENT_SIDEBAR_DIAGNOSTIC__
    };
  });
  assert.equal(proof.owner,'command-nav-v1');
  assert.equal(proof.sideOwner,'command-nav-v1');
  assert.equal(proof.styles,1,'exactly one sidebar visual style owner required');
  assert.equal(proof.buttons,13);
  assert.equal(proof.icons,13);
  assert.deepEqual(proof.diagnostic.missing,[]);
  assert.deepEqual(proof.groups.map(x=>x.text),['Операции','Рынок']);
  assert(proof.activeBackground.includes('linear-gradient'),'active row must use premium gradient');
  for(const item of proof.iconProof){
    assert(item.svg,item.page+': real SVG missing');
    assert.equal(item.glyph,'',item.page+': legacy glyph remains');
    assert(item.dx<=0.75,item.page+': SVG not horizontally centered');
    assert(item.dy<=0.75,item.page+': SVG not vertically centered');
    assert(item.labelFont>=14,item.page+': label typography too small at 1160px viewport');
    assert(item.buttonOverflow<=1,item.page+': sidebar button overflows horizontally');
    assert(item.labelOverflow<=1,item.page+': sidebar label overflows horizontally');
    if(['payments','closing','market-news'].includes(item.page))assert(item.labelLine>=18,item.page+': long-label line-height too tight');
  }

  await page.evaluate(()=>{
    const b=document.querySelector('#nav button[data-page="deals"]');
    window.__qaDealNode=b;window.__qaDealClicks=0;b.addEventListener('click',()=>window.__qaDealClicks++);
  });
  await page.click('#nav button[data-page="deals"]');
  await page.waitForTimeout(80);
  const clickProof=await page.evaluate(()=>({
    same:window.__qaDealNode===document.querySelector('#nav button[data-page="deals"]'),
    clicks:window.__qaDealClicks
  }));
  assert.equal(clickProof.same,true,'sidebar runtime replaced navigation button node');
  assert.equal(clickProof.clicks,1,'existing click listeners must survive');

  await page.evaluate(()=>window.RONA_CLIENT_NAV_ATTENTION.set('payments',true,'QA attention'));
  await page.waitForFunction(()=>document.querySelector('#nav button[data-page="payments"]')?.classList.contains('rona-client-nav-attention'));
  const attention=await page.evaluate(()=>{
    const b=document.querySelector('#nav button[data-page="payments"]'),i=b.querySelector('.nav-icon');
    return{bg:getComputedStyle(b).backgroundImage,shadow:getComputedStyle(b).boxShadow,color:getComputedStyle(i).color,reason:b.dataset.ronaAttentionReason};
  });
  assert(attention.bg.includes('linear-gradient'));
  assert.notEqual(attention.shadow,'none');
  assert.equal(attention.reason,'QA attention');

  await page.evaluate(()=>{
    const old={home:'⌂',companies:'▦',prices:'◈',applications:'▤',deals:'◆',payments:'▣',monitoring:'⇄',closing:'▥',archive:'◇',claims:'□',messages:'◉',analytics:'⌁','market-news':'◌'};
    for(const b of document.querySelectorAll('#nav button[data-page]')){
      const slot=b.querySelector(':scope>.nav-icon');if(slot)slot.textContent=old[b.dataset.page]||'?';
    }
  });
  await page.waitForFunction(()=>document.querySelectorAll('#nav button[data-page]>.nav-icon>svg').length===13);
  await page.waitForTimeout(2400);
  const heal=await page.evaluate(()=>({
    icons:document.querySelectorAll('#nav button[data-page]>.nav-icon>svg').length,
    glyphs:[...document.querySelectorAll('#nav button[data-page]>.nav-icon')].filter(x=>x.textContent.trim()).length,
    styles:document.querySelectorAll('#ronaClientSidebarCommandNavV1Style').length,
    missing:window.__RONA_CLIENT_SIDEBAR_DIAGNOSTIC__?.missing||[]
  }));
  assert.equal(heal.icons,13,'late overwrite self-heal failed');
  assert.equal(heal.glyphs,0,'late overwrite restored legacy glyphs');
  assert.equal(heal.styles,1,'duplicate sidebar style owner appeared');
  assert.deepEqual(heal.missing,[]);

  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/client-sidebar-command-nav-v1.png',fullPage:false});
  console.log('CLIENT_SIDEBAR_COMMAND_NAV_V1=PASS');
  console.log(JSON.stringify({proof,clickProof,attention,heal},null,2));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
