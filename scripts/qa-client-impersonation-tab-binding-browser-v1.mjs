import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const DIST=join(process.cwd(),'dist');
const SESSION='44444444-4444-4444-8444-444444444444';
const CLIENT='RONA-QA-CLIENT';
const CONTRACT='RONA-QA-CTR-2099-001';
const requests=[];

const mime=p=>{
  const e=extname(p).toLowerCase();
  return e==='.html'?'text/html; charset=utf-8'
    :e==='.js'?'application/javascript; charset=utf-8'
    :e==='.css'?'text/css; charset=utf-8'
    :e==='.svg'?'image/svg+xml'
    :e==='.png'?'image/png'
    :'application/octet-stream';
};
const send=(res,status,body)=>{
  const text=JSON.stringify(body);
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(text)});
  res.end(text);
};
const bootstrap={
  ok:true,
  data:{
    data_contract:'QA',
    requires_context_selection:false,
    contexts:[{
      client_id:CLIENT,
      legal_name:'QA Client Company',
      registration_country:'QA',
      registered_address:null,
      contact_phone:null,
      contract_id:CONTRACT,
      current_external_contract_number:'QA-EXT-001',
      contract_status:'ACTIVE',
      effective_from:'2099-01-01',
      effective_to:null,
      reference_status:'CONFIRMED'
    }],
    company_directory_source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',
    company_directory:[{
      client_id:CLIENT,
      legal_name:'QA Client Company',
      registration_country:'QA',
      contract_id:CONTRACT,
      current_external_contract_number:'QA-EXT-001',
      contract_status:'ACTIVE',
      applications_total:0,
      deals_total:0,
      documents_total:0,
      source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'
    }],
    selected_context:null,
    applications:[],deals:[],documents:[],payments:[],shipments:[],rail_documents:[],market:[],notifications:[],
    admin_entity_preview:true,
    read_only:true
  }
};
const projection={
  ok:true,
  data:{
    projection_contract:'ADMIN_CLIENT_SERVER_V1',
    contract:{
      client_id:CLIENT,
      legal_name:'QA Client Company',
      registration_country:'QA',
      registered_address:null,
      contact_phone:null,
      contract_id:CONTRACT,
      current_external_contract_number:'QA-EXT-001',
      contract_status:'ACTIVE',
      effective_from:'2099-01-01',
      effective_to:null,
      reference_status:'CONFIRMED'
    },
    applications:[],deals:[],documents:[],payments:[],prices:[]
  }
};

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/','http://127.0.0.1');
    if(u.pathname==='/portal/client'){
      const html=await readFile(join(DIST,'portal/client.html'));
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      return res.end(html);
    }
    if(u.pathname.startsWith('/portal/api/')){
      const tab=String(req.headers['x-rona-impersonation-tab']||'');
      requests.push({path:u.pathname,query:u.search,tab,method:req.method||'GET'});
      if(tab!==SESSION)return send(res,409,{ok:false,code:'IMPERSONATION_TAB_INVALID'});
      if(u.pathname==='/portal/api/v1/client/bootstrap')return send(res,200,bootstrap);
      if(u.pathname==='/portal/api/v1/client/context')return send(res,200,projection);
      if(u.pathname==='/portal/api/v1/client/prices')return send(res,200,{ok:true,client_id:CLIENT,contract_id:CONTRACT,prices:[]});
      if(u.pathname==='/portal/api/v1/client/applications-projection')return send(res,200,{ok:true,data:{client_id:CLIENT,contract_id:CONTRACT,applications:[]}});
      if(u.pathname==='/portal/api/v1/client/deal-documents/state')return send(res,200,{ok:true,client_id:CLIENT,contract_id:CONTRACT,deals:[]});
      if(u.pathname==='/portal/api/v1/client/market')return send(res,200,{ok:true,market:[]});
      if(u.pathname==='/portal/api/v1/client/messages')return send(res,200,{ok:true,messages:[]});
      if(u.pathname==='/portal/api/v1/client/archive')return send(res,200,{ok:true,archive:[]});
      if(u.pathname==='/portal/api/v1/client/claims')return send(res,200,{ok:true,claims:[]});
      if(u.pathname==='/portal/api/v1/client/deals')return send(res,200,{ok:true,deals:[]});
      if(u.pathname==='/portal/api/v1/client/documents')return send(res,200,{ok:true,documents:[]});
      if(u.pathname==='/portal/api/v1/client/payments')return send(res,200,{ok:true,payments:[]});
      if(u.pathname==='/portal/api/v1/client/rail')return send(res,200,{ok:true,rail:[]});
      if(u.pathname==='/portal/api/v1/client/shipments')return send(res,200,{ok:true,shipments:[]});
      return send(res,200,{ok:true,data:{}});
    }
    if(u.pathname==='/portal/logout')return send(res,200,{ok:true});
    const clean=normalize(u.pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');
    const p=join(DIST,clean);
    if(p.startsWith(DIST)){
      try{
        if((await stat(p)).isFile()){
          const b=await readFile(p);
          res.writeHead(200,{'content-type':mime(p),'cache-control':'no-store'});
          return res.end(b);
        }
      }catch{}
    }
    res.writeHead(404);res.end('not found');
  }catch(error){
    res.writeHead(500);res.end(String(error?.stack||error));
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;

let browser;
try{
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await ctx.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error)));
  await page.goto(origin+'/portal/client?impSession='+SESSION,{waitUntil:'domcontentloaded',timeout:30000});

  await page.waitForFunction(
    ({client,contract})=>{
      const api=window.RONA_CLIENT_CONTEXT;
      if(!api?.getCurrentContext)return false;
      const current=api.getCurrentContext();
      return current?.client_id===client&&current?.contract_id===contract;
    },
    {client:CLIENT,contract:CONTRACT},
    {timeout:8000}
  );

  await page.waitForTimeout(800);
  const state=await page.evaluate(()=>({
    contextReady:document.documentElement.dataset.ronaClientContextReady||'',
    selection:document.documentElement.dataset.ronaClientContextSelection||'',
    current:window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()||null,
    authority:document.documentElement.dataset.ronaClientContextAuthority||''
  }));

  const bootstrapRequests=requests.filter(x=>x.path==='/portal/api/v1/client/bootstrap');
  if(!bootstrapRequests.length)throw new Error('CLIENT_BROWSER_BOOTSTRAP_NOT_EMITTED');
  const missing=requests.filter(x=>x.path.startsWith('/portal/api/v1/client/')&&x.tab!==SESSION);
  if(missing.length)throw new Error('CLIENT_BROWSER_REQUEST_WITHOUT_TAB_BINDING '+JSON.stringify(missing));
  if(state.current?.client_id!==CLIENT||state.current?.contract_id!==CONTRACT)throw new Error('CLIENT_CONTEXT_NOT_READY '+JSON.stringify(state));
  if(pageErrors.some(x=>/IMPERSONATION_TAB_INVALID|CLIENT_BOOTSTRAP_HTTP_409/i.test(x)))throw new Error('CLIENT_BROWSER_TAB_BINDING_ERROR '+JSON.stringify(pageErrors));

  console.log('CLIENT_IMPERSONATION_BROWSER_QA=PASS '+JSON.stringify({
    bootstrap_requests:bootstrapRequests.length,
    client_api_requests:requests.filter(x=>x.path.startsWith('/portal/api/v1/client/')).length,
    context:state.current,
    context_ready:state.contextReady,
    selection:state.selection
  }));
}finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(()=>resolve()));
}
