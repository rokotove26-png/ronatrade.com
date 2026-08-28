import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const dist=path.resolve('dist');
const html=fs.readFileSync(path.join(dist,'portal','client.html'));
const CSP="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'";
const server=http.createServer((req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/client'||u.pathname==='/portal/client.html'){
    res.writeHead(200,{
      'content-type':'text/html; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache',
      'referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY',
      'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()',
      'cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin','content-security-policy':CSP
    });
    return res.end(html);
  }
  let rel=decodeURIComponent(u.pathname).replace(/^\/+/, '');
  const file=path.resolve(dist,rel);
  if(file.startsWith(dist+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()){
    res.writeHead(200,{'cache-control':'no-store'});return fs.createReadStream(file).pipe(res);
  }
  res.writeHead(404);res.end('not found');
});
await new Promise(r=>server.listen(4174,'127.0.0.1',r));

const viewports=[
  {name:'user-narrow',width:880,height:500},
  {name:'laptop',width:1280,height:720},
  {name:'wide',width:1600,height:900},
  {name:'desktop',width:1920,height:1080}
];
const labels=['Мои компании','Цены','Заявки','Сделки','Платежи и взаиморасчёты','Онлайн ЖД','Закрывающие документы','Архив сделок','Претензии','Сообщения','Аналитика'];
const browser=await chromium.launch({headless:true});
let failed=false;
for(const vp of viewports){
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height}});
  const page=await context.newPage();
  const errors=[]; const responses=[];
  page.on('pageerror',e=>errors.push({type:'pageerror',text:String(e.message||e).slice(0,1000)}));
  page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push({type:m.type(),text:m.text().slice(0,1000)})});
  page.on('response',r=>{if(r.status()>=400)responses.push({status:r.status(),url:r.url()})});
  await page.goto('http://127.0.0.1:4174/portal/client?_m='+vp.name,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(1200);
  const layout=await page.evaluate(()=>{
    const sidebar=document.querySelector('.sidebar'); const main=document.querySelector('main,.main,.content,[class*=main]'); const drawer=document.querySelector('#drawer,.drawer');
    const info=el=>{if(!el)return null;const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{tag:el.tagName,id:el.id,cls:String(el.className||''),x:r.x,y:r.y,w:r.width,h:r.height,display:s.display,visibility:s.visibility,position:s.position,z:s.zIndex,pointerEvents:s.pointerEvents,transform:s.transform,overflow:s.overflow}};
    const hitPoints=[[10,10],[280,100],[innerWidth-20,100],[innerWidth/2,innerHeight/2]].map(([x,y])=>{const el=document.elementFromPoint(x,y);return{x,y,tag:el?.tagName,id:el?.id,cls:String(el?.className||'').slice(0,120),text:(el?.innerText||el?.textContent||'').trim().replace(/\s+/g,' ').slice(0,80)}});
    const blockers=[...document.querySelectorAll('body *')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el),z=parseInt(s.zIndex,10);const ix=Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left)),iy=Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top));return{tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,120),x:r.x,y:r.y,w:r.width,h:r.height,intersectArea:ix*iy,z:Number.isFinite(z)?z:0,position:s.position,pointerEvents:s.pointerEvents,opacity:s.opacity}}).filter(x=>x.intersectArea>innerWidth*innerHeight*.18&&x.pointerEvents!=='none'&&['fixed','absolute','sticky'].includes(x.position)).sort((a,b)=>b.z-a.z||b.intersectArea-a.intersectArea).slice(0,12);
    return{viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},scroll:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},sidebar:info(sidebar),main:info(main),drawer:info(drawer),hitPoints,blockers};
  });
  const clicks=[];
  for(const label of labels){
    const loc=page.locator('button[data-page],a[data-page],[role=button][data-page]').filter({hasText:label}).first();
    if(!(await loc.count())){clicks.push({label,found:false});continue;}
    let trial=true,error='';try{await loc.click({trial:true,timeout:1800});}catch(e){trial=false;error=String(e.message||e).slice(0,1000)}
    let clicked=false,active='';if(trial){try{await loc.click({timeout:2000});await page.waitForTimeout(100);clicked=true;active=await page.locator('.page.active').first().getAttribute('id').catch(()=>null)}catch(e){error=String(e.message||e).slice(0,1000)}}
    clicks.push({label,trial,clicked,active,error});
  }
  const pass=clicks.filter(x=>x.clicked).length;
  console.log('CLIENT_SHELL_MATRIX='+JSON.stringify({vp,layout,pass,total:labels.length,clicks,errors:errors.slice(0,30),httpErrors:responses.slice(0,30)}));
  if(pass<8){failed=true;console.error(`viewport ${vp.name} navigation pass ${pass}/${labels.length}`)}
  await context.close();
}
await browser.close();
await new Promise(r=>server.close(r));
if(failed)process.exit(1);
