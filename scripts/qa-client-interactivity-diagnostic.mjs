import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const dist = path.resolve('dist');
const clientFile = path.join(dist, 'portal', 'client.html');
if (!fs.existsSync(clientFile)) throw new Error(`missing built client artifact: ${clientFile}`);

const mime = new Map([
  ['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],
  ['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg']
]);
const server = http.createServer((req,res)=>{
  const u = new URL(req.url || '/', 'http://127.0.0.1');
  let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  if (!rel) rel = 'index.html';
  const file = path.resolve(dist, rel);
  if (!file.startsWith(dist + path.sep) && file !== dist) { res.writeHead(403); return res.end('forbidden'); }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, {'content-type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream', 'cache-control':'no-store'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));

const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,16);
const labels = [
  'Главная','Мои компании','Цены','Заявки','Сделки','ДС / Инвойсы','Платежи и взаиморасчёты',
  'Онлайн ЖД','Закрывающие документы','Архив сделок','Претензии','Сообщения','Аналитика'
];

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1920,height:1080}});
const page = await context.newPage();
const diagnostics = { console:[], pageerror:[], requestfailed:[], httpErrors:[] };
page.on('console',m=>diagnostics.console.push({type:m.type(),text:m.text().slice(0,1200)}));
page.on('pageerror',e=>diagnostics.pageerror.push(String(e.message||e).slice(0,1600)));
page.on('requestfailed',r=>diagnostics.requestfailed.push({url:r.url(),error:r.failure()?.errorText||''}));
page.on('response',r=>{ if(r.status()>=400) diagnostics.httpErrors.push({status:r.status(),url:r.url()}); });

try {
  await page.goto('http://127.0.0.1:4173/portal/client.html?_qa='+Date.now(), {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(1500);

  const initial = await page.evaluate(()=>({
    title:document.title,
    bodyText:(document.body?.innerText||'').slice(0,20000),
    readyState:document.readyState,
    scripts:[...document.scripts].map(s=>({src:s.src||'',inline:!s.src,text:(s.textContent||'').slice(0,160)})),
    clickable:[...document.querySelectorAll('a,button,[role="button"],[onclick],[data-page],[data-nav]')].map((el,i)=>{
      const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
      return {i,tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,200),text:(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),display:cs.display,visibility:cs.visibility,pointerEvents:cs.pointerEvents,opacity:cs.opacity,x:r.x,y:r.y,w:r.width,h:r.height};
    }).filter(x=>x.w>0&&x.h>0&&x.visibility!=='hidden'&&x.display!=='none').slice(0,300),
    overlays:[...document.querySelectorAll('body *')].map(el=>{
      const r=el.getBoundingClientRect(); const cs=getComputedStyle(el); const z=parseInt(cs.zIndex,10);
      const area=Math.max(0,r.width)*Math.max(0,r.height);
      return {tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,180),text:(el.innerText||'').trim().replace(/\s+/g,' ').slice(0,100),position:cs.position,z:Number.isFinite(z)?z:0,pointerEvents:cs.pointerEvents,opacity:cs.opacity,x:r.x,y:r.y,w:r.width,h:r.height,area};
    }).filter(x=>['fixed','absolute','sticky'].includes(x.position)&&x.pointerEvents!=='none'&&x.area>150000).sort((a,b)=>b.z-a.z||b.area-a.area).slice(0,30)
  }));
  const initialBodyHash = hash(initial.bodyText);
  console.log('CLIENT_DIAG_INITIAL='+JSON.stringify({...initial,bodyTextHash:initialBodyHash,bodyText:initial.bodyText.slice(0,2500)}));

  const results=[];
  for (const label of labels) {
    const loc = page.locator('a,button,[role="button"],[onclick],[data-page],[data-nav]').filter({hasText:label}).first();
    if (!(await loc.count()) || !(await loc.isVisible().catch(()=>false))) {
      results.push({label,found:false});
      continue;
    }
    const before = await page.evaluate(()=>({url:location.href,body:(document.body?.innerText||''),visible:[...document.querySelectorAll('[id^="page-"],.page,[data-page]')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}).map(el=>({id:el.id,cls:String(el.className||'').slice(0,120),dataPage:el.getAttribute('data-page'),text:(el.innerText||'').trim().replace(/\s+/g,' ').slice(0,120)})).slice(0,30)}));
    const meta = await loc.evaluate(el=>{
      const r=el.getBoundingClientRect(); const x=r.left+r.width/2,y=r.top+r.height/2; const top=document.elementFromPoint(x,y); const cs=getComputedStyle(el); const tcs=top?getComputedStyle(top):null;
      return {outer:el.outerHTML.slice(0,900),rect:{x:r.x,y:r.y,w:r.width,h:r.height},pointerEvents:cs.pointerEvents,zIndex:cs.zIndex,top:top?{tag:top.tagName,id:top.id,cls:String(top.className||'').slice(0,180),text:(top.innerText||top.textContent||'').trim().replace(/\s+/g,' ').slice(0,120),pointerEvents:tcs?.pointerEvents,zIndex:tcs?.zIndex,outer:top.outerHTML.slice(0,900)}:null};
    });
    let trialOk=true,trialError='';
    try { await loc.click({trial:true,timeout:1800}); } catch(e) { trialOk=false; trialError=String(e.message||e).slice(0,1400); }
    let clickOk=false,clickError='';
    if (trialOk) {
      try { await loc.click({timeout:2500}); clickOk=true; await page.waitForTimeout(350); } catch(e) { clickError=String(e.message||e).slice(0,1400); }
    }
    const after = await page.evaluate(()=>({url:location.href,body:(document.body?.innerText||''),visible:[...document.querySelectorAll('[id^="page-"],.page,[data-page]')].filter(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}).map(el=>({id:el.id,cls:String(el.className||'').slice(0,120),dataPage:el.getAttribute('data-page'),text:(el.innerText||'').trim().replace(/\s+/g,' ').slice(0,120)})).slice(0,30)}));
    const row={label,found:true,trialOk,trialError,clickOk,clickError,meta,before:{url:before.url,bodyHash:hash(before.body),visible:before.visible},after:{url:after.url,bodyHash:hash(after.body),visible:after.visible}};
    row.changed = row.before.url!==row.after.url || row.before.bodyHash!==row.after.bodyHash || JSON.stringify(row.before.visible)!==JSON.stringify(row.after.visible);
    results.push(row);
    console.log('CLIENT_DIAG_CLICK='+JSON.stringify(row));
  }

  const found=results.filter(x=>x.found).length;
  const trialPass=results.filter(x=>x.trialOk).length;
  const clicked=results.filter(x=>x.clickOk).length;
  const changed=results.filter(x=>x.changed).length;
  const intercepts=results.filter(x=>x.found&&!x.trialOk).map(x=>({label:x.label,error:x.trialError,top:x.meta?.top}));
  const summary={found,trialPass,clicked,changed,intercepts,diagnostics};
  console.log('CLIENT_INTERACTIVITY_DIAGNOSTIC='+JSON.stringify(summary));
  if (found < 5) throw new Error(`too few client navigation controls found: ${found}`);
  if (trialPass < 3) throw new Error(`client navigation is pointer-blocked: trialPass=${trialPass}/${found}`);
  if (clicked < 3) throw new Error(`client navigation click handlers are failing: clicked=${clicked}/${found}`);
} finally {
  await context.close().catch(()=>{});
  await browser.close().catch(()=>{});
  await new Promise(resolve=>server.close(resolve));
}
