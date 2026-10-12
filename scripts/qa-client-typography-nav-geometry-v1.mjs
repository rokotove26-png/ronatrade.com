// Read-only visual geometry diagnostic for the disposable Client LK build.
// All traffic is loopback; no credentials, API writes, production or source mutations.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(process.cwd(),'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url||'/','http://127.0.0.1').pathname;
  if(pathname.startsWith('/portal/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{"ok":false,"code":"QA_OFFLINE"}');return}
  const path=pathname==='/portal/client'||pathname==='/portal/client/'?'portal/client.html':pathname.replace(/^[/\\]+/,'');
  const full=resolve(root,path);
  if(full!==root&&!full.startsWith(root+sep)){res.writeHead(403);res.end();return}
  try{const content=await readFile(full);res.writeHead(200,{'content-type':mime[extname(full)]||'application/octet-stream','cache-control':'no-store'});res.end(content)}
  catch{res.writeHead(404);res.end()}
});
let browser;
try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const port=server.address().port;
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:'+port+'/portal/client',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>Boolean(document.documentElement.dataset.ronaClientOwnerTypography),{timeout:9000}).catch(()=>{});
  await page.waitForTimeout(700);
  const result=await page.evaluate(()=>{
    const nav=document.querySelector('#nav');
    const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0};
    const buttons=[...document.querySelectorAll('#nav button')].filter(visible).map(el=>{
      const css=getComputedStyle(el),label=el.querySelector('.nav-label'),spanCss=label?getComputedStyle(label):null,rect=el.getBoundingClientRect();
      return{text:String(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,90),
        clientWidth:el.clientWidth,scrollWidth:el.scrollWidth,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,
        rectWidth:rect.width,rectHeight:rect.height,overflowX:css.overflowX,overflowY:css.overflowY,
        whiteSpace:css.whiteSpace,fontSize:css.fontSize,lineHeight:css.lineHeight,padding:css.padding,
        minHeight:css.minHeight,maxHeight:css.maxHeight,height:css.height,boxSizing:css.boxSizing,
        labelWidth:label?.clientWidth??null,labelScrollWidth:label?.scrollWidth??null,
        labelFont:spanCss?.fontSize??null,labelLineHeight:spanCss?.lineHeight??null,labelWhiteSpace:spanCss?.whiteSpace??null,
        contentRect:label?(()=>{const range=document.createRange();range.selectNodeContents(label);const q=range.getBoundingClientRect();return{top:q.top-rect.top,bottom:q.bottom-rect.top,left:q.left-rect.left,right:q.right-rect.left,height:q.height}})():null,
        children:[...el.children].map(node=>{const c=getComputedStyle(node),r=node.getBoundingClientRect();return{tag:node.tagName,cls:String(node.className||''),position:c.position,display:c.display,overflow:c.overflow,top:r.top-rect.top,bottom:r.bottom-rect.top,height:r.height,transform:c.transform,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight}}),
        pseudo:['::before','::after'].map(which=>{const c=getComputedStyle(el,which);return{which,content:c.content,position:c.position,top:c.top,bottom:c.bottom,height:c.height,transform:c.transform,overflow:c.overflow,display:c.display}}),
        clipX:['hidden','clip'].includes(css.overflowX)&&el.scrollWidth>el.clientWidth+1,
        clipY:['hidden','clip'].includes(css.overflowY)&&el.scrollHeight>el.clientHeight+1};
    });
    return{marker:document.documentElement.dataset.ronaClientOwnerTypography||'',navFound:!!nav,
      navHeight:nav?.getBoundingClientRect().height??null,buttons};
  });
  console.log('QA_CLIENT_NAV_GEOMETRY_READ_ONLY',JSON.stringify(result));
  if(!result.marker||result.buttons.length<5)throw Error('QA_NAV_GEOMETRY_NO_RUNTIME_OR_BUTTONS');
  if(process.env.RONA_NAV_SCREENSHOT_PATH)await page.screenshot({path:process.env.RONA_NAV_SCREENSHOT_PATH,fullPage:false});
}finally{
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
