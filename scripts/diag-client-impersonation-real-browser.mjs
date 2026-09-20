import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT=process.cwd(),DIST=join(ROOT,'dist'),SESSION='33333333-3333-4333-8333-333333333333';
const bridge=`<script id="diag-imp-bridge">(()=>{'use strict';const SESSION='${SESSION}',nativeFetch=window.fetch.bind(window);window.fetch=async(input,init={})=>{let nextInput=input,nextInit=init;try{const raw=typeof input==='string'?input:(input&&input.url)||'',u=new URL(raw,location.href);if(u.origin===location.origin&&u.pathname.startsWith('/portal/api/')){const h=new Headers((init&&init.headers)||(input instanceof Request?input.headers:undefined));h.set('x-rona-impersonation-tab',SESSION);if(input instanceof Request){nextInput=new Request(input,{...init,headers:h});nextInit=undefined}else nextInit={...init,headers:h}}}catch(e){console.error('DIAG_BRIDGE_ERROR',e)}return nativeFetch(nextInput,nextInit)};window.__DIAG_IMP_BRIDGE__=true})();<\/script>`;

function mime(p){const e=extname(p).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.png'?'image/png':e==='.svg'?'image/svg+xml':'application/octet-stream'}
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://127.0.0.1');
  if(u.pathname==='/portal/client'){
    let html=await readFile(join(DIST,'portal/client.html'),'utf8');
    html=html.replace(/<head(\s[^>]*)?>/i,m=>m+bridge);
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'"});
    return res.end(html);
  }
  const clean=normalize(u.pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');
  const p=join(DIST,clean);
  if(p.startsWith(DIST)){try{if((await stat(p)).isFile()){const b=await readFile(p);res.writeHead(200,{'content-type':mime(p),'cache-control':'no-store'});return res.end(b)}}catch{}}
  res.writeHead(404);res.end('not found');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900}});
const page=await ctx.newPage();
const requests=[],consoleRows=[],pageErrors=[];
page.on('console',m=>consoleRows.push({type:m.type(),text:m.text()}));
page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/portal/api/'))requests.push({url:r.url(),method:r.method(),headers:r.headers()})});
await page.route('**/portal/api/**',async route=>{
  const req=route.request(),u=new URL(req.url()),headers=req.headers();
  const tab=headers['x-rona-impersonation-tab']||'';
  let body={ok:true,data:{}};
  if(u.pathname==='/portal/api/v1/client/bootstrap'){
    body={ok:true,data:{contexts:[{client_id:'RONA-C001',legal_name:'Test Client',contract_id:'RONA-C001-CTR-2026-001',current_external_contract_number:'EXT-1',contract_status:'ACTIVE'}],selected_context:{client_id:'RONA-C001',legal_name:'Test Client',contract_id:'RONA-C001-CTR-2026-001',current_external_contract_number:'EXT-1',contract_status:'ACTIVE'},requires_context_selection:false}};
  } else if(u.pathname==='/portal/api/v1/client/context'){
    body={ok:true,data:{projection_contract:'ADMIN_CLIENT_SERVER_V1',contract:{client_id:'RONA-C001',legal_name:'Test Client',contract_id:'RONA-C001-CTR-2026-001',current_external_contract_number:'EXT-1',contract_status:'ACTIVE'},applications:[],deals:[],documents:[],payments:[],prices:[]}};
  } else if(u.pathname==='/portal/api/v1/client/applications-projection'){
    body={ok:true,data:{client_id:'RONA-C001',contract_id:'RONA-C001-CTR-2026-001',applications:[]}};
  } else if(u.pathname==='/portal/api/v1/client/prices'){
    body={ok:true,client_id:'RONA-C001',contract_id:'RONA-C001-CTR-2026-001',prices:[]};
  }
  await route.fulfill({status:tab===SESSION?200:409,contentType:'application/json',body:JSON.stringify(tab===SESSION?body:{ok:false,code:'IMPERSONATION_TAB_INVALID'})});
});
await page.goto(origin+'/portal/client?impSession='+SESSION,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForTimeout(5000);
const dom=await page.evaluate(()=>({
  bridge:window.__DIAG_IMP_BRIDGE__===true,
  title:document.title,
  bodyText:String(document.body?.innerText||'').replace(/\s+/g,' ').slice(0,1000),
  bodyClass:document.body?.className||'',
  htmlAttrs:[...document.documentElement.attributes].reduce((o,a)=>(o[a.name]=a.value,o),{})
}));
console.log('DIAG_BROWSER_DOM',JSON.stringify(dom));
console.log('DIAG_BROWSER_API_REQUESTS',JSON.stringify(requests));
console.log('DIAG_BROWSER_CONSOLE',JSON.stringify(consoleRows.slice(-30)));
console.log('DIAG_BROWSER_PAGE_ERRORS',JSON.stringify(pageErrors));
if(!dom.bridge)throw new Error('BRIDGE_DID_NOT_EXECUTE');
if(!requests.length)throw new Error('CLIENT_RUNTIME_EMITTED_NO_PORTAL_API_REQUESTS');
const missing=requests.filter(r=>(r.headers['x-rona-impersonation-tab']||'')!==SESSION);
if(missing.length)throw new Error('CLIENT_REQUEST_MISSING_IMPERSONATION_TAB '+JSON.stringify(missing));
await browser.close();
await new Promise(r=>server.close(()=>r()));
console.log('DIAG_CLIENT_IMPERSONATION_REAL_RUNTIME=PASS');
