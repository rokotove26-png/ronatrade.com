import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const DIST=join(ROOT,'dist');
const CLIENT_HTML=join(DIST,'portal','client.html');
const t0=Date.now();
const now=()=>Date.now()-t0;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();

const FIXTURES={
  A:{client_id:'CLIENT-A',contract_id:'CONTRACT-A',legal_name:'ALPHA HOLDING LLC',external:'EXT-A',deal_id:'DEAL-2099-101',product:'PRODUCT-A'},
  B:{client_id:'CLIENT-B',contract_id:'CONTRACT-B',legal_name:'BETA ENERGY LLC',external:'EXT-B',deal_id:'DEAL-2099-202',product:'PRODUCT-B'}
};
let selected='A';
const requests=[];

function contextFixture(name){
  const f=FIXTURES[name];
  return {client_id:f.client_id,legal_name:f.legal_name,registration_country:'TEST',contract_id:f.contract_id,current_external_contract_number:f.external,contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31'};
}
function stages(){
  const defs=[['contract','DONE'],['documents','DONE'],['resource','CURRENT'],['payment','PENDING'],['logistics','PENDING'],['close','PENDING']];
  return defs.map(([key,state])=>({key,state,detail:`${key} fixture status`}));
}
function projection(name){
  const f=FIXTURES[name],ctx=contextFixture(name);
  return {
    client_id:f.client_id,contract_id:f.contract_id,
    client:{client_id:f.client_id,legal_name:f.legal_name},
    contract:{client_id:f.client_id,contract_id:f.contract_id,current_external_contract_number:f.external},
    context:{client_id:f.client_id,contract_id:f.contract_id,legal_name:f.legal_name,current_external_contract_number:f.external},
    deals:[{deal_id:f.deal_id,client_id:f.client_id,contract_id:f.contract_id,current_status:'EXECUTING',current_status_label:'В исполнении',business_status:'ACTIVE',resource_status:'RESOURCE_CONFIRMED',resource_label:'Ресурс подтвержден',payment_status:'PAID',payment_label:'Оплачено',payment_obligation_amount:1000,payment_received_amount:1000,payment_currency:'USD'}],
    applications:[{application_id:`APP-${name}`,deal_id:f.deal_id,client_id:f.client_id,contract_id:f.contract_id,product:f.product,quantity_tonnes:10,proposed_price:100,proposed_currency:'USD',delivery_basis:'CPT',destination:`DEST-${name}`,status:'DEAL_REGISTERED'}],
    documents:[],payments:[]
  };
}
function json(res,status,body){const text=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(text)});res.end(text)}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':e==='.jpg'||e==='.jpeg'?'image/jpeg':e==='.json'?'application/json; charset=utf-8':'application/octet-stream'}
function safeDist(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
async function serveStatic(res,pathname){const path=safeDist(pathname);if(!path)return false;try{const s=await stat(path);if(!s.isFile())return false;const b=await readFile(path);res.writeHead(200,{'content-type':mime(path),'cache-control':'no-store'});res.end(b);return true}catch{return false}}
function fixtureForIds(clientId,contractId){return Object.entries(FIXTURES).find(([,f])=>f.client_id===clientId&&f.contract_id===contractId)?.[0]||null}
function record(req,u,responseName,responseBody,status=200){
  const source=norm(req.headers['x-rona-client-source']||req.headers['x-rona-client-deals-render']||req.headers['x-rona-client-deal-lifecycle']||'UNATTRIBUTED');
  const p=responseBody?.data||responseBody||{};
  requests.push({at_ms:now(),method:req.method,path:u.pathname,client_id:u.searchParams.get('clientId')||'',contract_id:u.searchParams.get('contractId')||'',source,response_fixture:responseName||'',response_client_id:norm(p.client_id||p.context?.client_id||p.client?.client_id),response_contract_id:norm(p.contract_id||p.context?.contract_id||p.contract?.contract_id),status});
}
async function api(req,res,u){
  const clientId=u.searchParams.get('clientId')||'',contractId=u.searchParams.get('contractId')||'';
  const name=fixtureForIds(clientId,contractId)||selected;
  if(u.pathname==='/portal/api/v1/client/bootstrap'){
    const body={ok:true,data:{contexts:[contextFixture('A'),contextFixture('B')],selected_context:contextFixture(selected),requires_context_selection:false}};
    record(req,u,selected,body);await sleep(20);json(res,200,body);return true;
  }
  if(u.pathname==='/portal/api/v1/client/context'){
    const resolved=fixtureForIds(clientId,contractId);if(!resolved){const body={ok:false,code:'BAD_CONTEXT'};record(req,u,'',body,400);json(res,400,body);return true}
    const body={ok:true,data:projection(resolved)};record(req,u,resolved,body);await sleep(resolved==='A'?110:140);json(res,200,body);return true;
  }
  if(u.pathname==='/portal/api/v1/client/prices'){
    const resolved=fixtureForIds(clientId,contractId);const f=FIXTURES[resolved]||FIXTURES.A;
    const body={ok:true,client_id:f.client_id,contract_id:f.contract_id,prices:[{publication_item_id:`PRICE-${resolved}`,publication_id:`PUB-${resolved}`,client_id:f.client_id,contract_id:f.contract_id,product:f.product,basis:'CPT',price:100,currency:'USD',producer:`PRODUCER-${resolved}`,supplier:`SUPPLIER-${resolved}`} ]};
    record(req,u,resolved,body);await sleep(90);json(res,200,body);return true;
  }
  if(u.pathname==='/portal/api/v1/client/deal-documents/state'){
    const resolved=fixtureForIds(clientId,contractId);const f=FIXTURES[resolved]||FIXTURES.A;
    const body={ok:true,client_id:f.client_id,contract_id:f.contract_id,deals:[{deal_id:f.deal_id,client_id:f.client_id,contract_id:f.contract_id,realization_status:{source:'SERVER_AUTHORITATIVE_REALIZATION_V1',current_stage_key:'resource',stages:stages()}}]};
    record(req,u,resolved,body);await sleep(80);json(res,200,body);return true;
  }
  if(u.pathname==='/portal/api/v1/client/messages'){const body={ok:true,messages:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/archive'){const body={ok:true,archive:{deals:[]}};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/market'){const body={ok:true,analytics:[],news:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/shipments'){const body={ok:true,shipments:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/rail'){const body={ok:true,shipments:[],rail:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/payments'){const body={ok:true,payments:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/deals'){const body={ok:true,deals:projection(name).deals};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/documents'){const body={ok:true,documents:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/claims'){const body={ok:true,claims:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname.startsWith('/portal/api/v1/client/')){const body={ok:true,data:{}};record(req,u,name,body);json(res,200,body);return true}
  return false;
}

const built=await readFile(CLIENT_HTML,'utf8');
for(const token of ['CLIENT_CONTEXTS','activeClientContractId','renderClientContext','restoreClientIdentityUI']){
  const pos=built.indexOf(token),snippet=pos>=0?built.slice(Math.max(0,pos-220),Math.min(built.length,pos+520)).replace(/\s+/g,' '):'ABSENT';
  console.log('STATIC_CONTEXT_OWNER',JSON.stringify({token,present:pos>=0,snippet}));
}

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url||'/', 'http://127.0.0.1');
    if(u.pathname==='/portal/client'||u.pathname==='/portal/client/'){
      const b=await readFile(CLIENT_HTML);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(b);return;
    }
    if(await api(req,res,u))return;
    if(await serveStatic(res,u.pathname))return;
    res.writeHead(404,{'content-type':'text/plain'});res.end('not found');
  }catch(error){res.writeHead(500,{'content-type':'text/plain'});res.end(String(error?.stack||error))}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;

let browser;
try{
  browser=await chromium.launch({headless:true,channel:process.env.CHROME_CHANNEL||undefined});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({fixtures})=>{
    window.__RONA_ROOT_CAUSE_TRACE__={events:[],calls:[],phase:'BOOT',expected:fixtures.A};
    const push=(type,detail={})=>window.__RONA_ROOT_CAUSE_TRACE__.events.push({at:performance.now(),type,phase:window.__RONA_ROOT_CAUSE_TRACE__.phase,detail});
    for(const name of ['rona:client-context-changed','rona:client-context-ready','rona:client-current-projection','rona:client:deals-rendered','rona:client:deal-authoritative-detail','rona:client:background-sections'])window.addEventListener(name,e=>push(name,e?.detail||{}),true);
    document.addEventListener('change',e=>{if(e.target?.id==='clientContextSelect'){push('SELECT_CHANGE_CAPTURE',{value:e.target.value,client_id:e.target.selectedOptions?.[0]?.dataset?.clientId||'',contract_id:e.target.selectedOptions?.[0]?.dataset?.contractId||''});queueMicrotask(()=>push('SELECT_CHANGE_AFTER_MICROTASK',{value:e.target.value}))}},true);
  },{fixtures:FIXTURES});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push({at_ms:now(),message:String(e?.message||e)}));
  page.on('console',m=>{if(m.type()==='error')pageErrors.push({at_ms:now(),message:'console:'+m.text()})});
  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RONA_CLIENT_CONTEXT&&typeof window.RONA_CLIENT_CONTEXT.getCurrentContext==='function',{timeout:10000});

  await page.evaluate(()=>{
    const trace=window.__RONA_ROOT_CAUSE_TRACE__;
    const ids=()=>{
      const text=document.querySelector('main')?.innerText||'';
      const uniq=re=>[...new Set(text.match(re)||[])];
      return {client_ids:uniq(/(?:RONA-C\d{3}|CLIENT-[A-Z0-9-]+)/g),contract_ids:uniq(/(?:RONA-C\d{3}-CTR-\d{4}-\d{3,}|CONTRACT-[A-Z0-9-]+)/g),deal_ids:uniq(/DEAL-\d{4}-\d{3,}/g)};
    };
    window.__RONA_TRACE_SNAPSHOT__=label=>{
      const a=window.RONA_CLIENT_CONTEXT,ctx=a?.getCurrentContext?.()||null,p=a?.getCurrentProjection?.()||null;
      let frozen=null,activeLegacy=null;
      try{frozen=typeof CLIENT_CONTEXTS!=='undefined'?Object.fromEntries(Object.entries(CLIENT_CONTEXTS).slice(0,12).map(([k,v])=>[k,{clientId:v?.clientId||null,contractId:v?.contractId||null,company:v?.company||v?.companyName||v?.legalName||null}])):null}catch{}
      try{activeLegacy=typeof activeClientContractId!=='undefined'?activeClientContractId:null}catch{}
      const snap={at:performance.now(),label,phase:trace.phase,selected:ctx?{client_id:ctx.client_id,contract_id:ctx.contract_id}:null,projection:p?{client_id:p.client_id||p.client?.client_id||p.context?.client_id||null,contract_id:p.contract_id||p.contract?.contract_id||p.context?.contract_id||null,deals:(p.deals||[]).map(x=>x.deal_id)}:null,visible_business_ids:ids(),home:window.__RONA_CLIENT_HOME_STATE__||null,home_status:document.documentElement.getAttribute('data-rona-client-home-state'),prices:window.__RONA_CLIENT_PRICE_SYNC_STATE__||null,deals_source:document.documentElement.getAttribute('data-rona-client-deals-projection-source')||document.documentElement.dataset.ronaClientDealsProjectionSource||null,deals_live:document.documentElement.dataset.ronaClientDealsLiveRender||null,contract_state:window.__RONA_CLIENT_CONTRACT_DOWNLOAD_STATE__||null,background_cache_keys:Object.keys(window.__RONA_CLIENT_BACKGROUND_CACHE__||{}),selector:{value:document.getElementById('clientContextSelect')?.value||null,title:document.getElementById('clientContextSelect')?.title||null,client_id:document.getElementById('clientContextSelect')?.dataset?.clientId||null,contract_id:document.getElementById('clientContextSelect')?.dataset?.contractId||null},legacy:{activeClientContractId:activeLegacy,frozen},callers:a?.getCallerMap?.()||[]};
      trace.events.push({at:snap.at,type:'SNAPSHOT',phase:trace.phase,detail:snap});return snap;
    };
    for(const name of ['renderClientContext','restoreClientIdentityUI']){
      const original=window[name];if(typeof original!=='function'||original.__ronaTraceWrapped)continue;
      const wrapped=function(...args){trace.events.push({at:performance.now(),type:name+':before',phase:trace.phase,detail:{}});let out;try{out=original.apply(this,args)}finally{queueMicrotask(()=>{const snap=window.__RONA_TRACE_SNAPSHOT__?.(name+':after');trace.calls.push({at:performance.now(),name,snapshot:snap})})}return out};wrapped.__ronaTraceWrapped=true;window[name]=wrapped;
    }
  });

  const snapshot=label=>page.evaluate(label=>window.__RONA_TRACE_SNAPSHOT__(label),label);
  async function waitProjection(f,timeout=7000){await page.waitForFunction(({client_id,contract_id})=>{const a=window.RONA_CLIENT_CONTEXT,p=a?.getCurrentProjection?.(),c=a?.getCurrentContext?.();if(!p||!c)return false;const pc=p.client_id||p.client?.client_id||p.context?.client_id,pk=p.contract_id||p.contract?.contract_id||p.context?.contract_id;return c.client_id===client_id&&c.contract_id===contract_id&&pc===client_id&&pk===contract_id},{client_id:f.client_id,contract_id:f.contract_id},{timeout})}
  async function waitHome(f,timeout=6500){return page.waitForFunction(({client_id,contract_id})=>{const h=window.__RONA_CLIENT_HOME_STATE__;return document.documentElement.getAttribute('data-rona-client-home-state')==='ready'&&h?.client_id===client_id&&h?.contract_id===contract_id},{client_id:f.client_id,contract_id:f.contract_id},{timeout}).then(()=>true).catch(()=>false)}
  async function nav(label){const loc=page.getByText(label,{exact:true});if(await loc.count()){await loc.first().click({timeout:2000}).catch(()=>{});await page.waitForTimeout(30);return true}return false}
  async function waitPrices(f,timeout=3000){return page.waitForFunction(({client_id,contract_id})=>{const s=window.__RONA_CLIENT_PRICE_SYNC_STATE__;return s?.context?.client_id===client_id&&s?.context?.contract_id===contract_id&&Array.isArray(s.prices)&&s.prices.length>0},{client_id:f.client_id,contract_id:f.contract_id},{timeout}).then(()=>true).catch(()=>false)}
  async function waitDeals(f,timeout=3000){return page.waitForFunction(deal=>{const p=window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.();return Array.isArray(p?.deals)&&p.deals.some(x=>x.deal_id===deal)&&document.documentElement.dataset.ronaClientDealsLiveRender==='ready'},f.deal_id,{timeout}).then(()=>true).catch(()=>false)}
  async function switchTo(name){
    const f=FIXTURES[name];selected=name;
    await page.evaluate(({name,f})=>{window.__RONA_ROOT_CAUSE_TRACE__.phase=name;window.__RONA_ROOT_CAUSE_TRACE__.expected=f},{name,f});
    await snapshot(`${name}:before-select`);
    const switched=await page.evaluate(({client_id,contract_id})=>{const sel=document.getElementById('clientContextSelect');if(!sel)return false;const opt=[...sel.options].find(o=>o.dataset.clientId===client_id&&o.dataset.contractId===contract_id);if(!opt)return false;sel.value=opt.value;sel.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));return true},{client_id:f.client_id,contract_id:f.contract_id});
    assert(switched,`selector option missing for ${name}`);
    await snapshot(`${name}:after-change-sync`);
    await page.waitForTimeout(0);await snapshot(`${name}:after-change-task`);
    const projectionStarted=performance.now();await waitProjection(f);const projectionMs=Math.round(performance.now()-projectionStarted);await snapshot(`${name}:projection-ready`);
    const homeStarted=performance.now();const homeReady=await waitHome(f);const homeMs=Math.round(performance.now()-homeStarted);await snapshot(`${name}:home-${homeReady?'ready':'timeout'}`);
    await nav('Цены');const priceStarted=performance.now();const pricesReady=await waitPrices(f);const pricesMs=Math.round(performance.now()-priceStarted);await snapshot(`${name}:prices-${pricesReady?'ready':'timeout'}`);
    await nav('Сделки');const dealStarted=performance.now();const dealsReady=await waitDeals(f);const dealsMs=Math.round(performance.now()-dealStarted);await snapshot(`${name}:deals-${dealsReady?'ready':'timeout'}`);
    let passportVisible=false,passportMs=null;
    const button=page.locator(`[data-open-deal="${f.deal_id}"]`).first();if(await button.count()){
      const started=performance.now();await button.click({timeout:1500}).catch(()=>{});passportVisible=await page.waitForFunction(deal=>[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].some(r=>{const s=getComputedStyle(r),t=r.textContent||'';return s.display!=='none'&&s.visibility!=='hidden'&&t.includes(deal)}),f.deal_id,{timeout:1800}).then(()=>true).catch(()=>false);passportMs=Math.round(performance.now()-started);await snapshot(`${name}:passport-${passportVisible?'visible':'missing'}`)
    }
    return {projection_ms:projectionMs,home_ready:homeReady,home_ms:homeMs,prices_ready:pricesReady,prices_ms:pricesMs,deals_ready:dealsReady,deals_ms:dealsMs,passport_visible:passportVisible,passport_ms:passportMs};
  }

  await page.evaluate(f=>{window.__RONA_ROOT_CAUSE_TRACE__.phase='A';window.__RONA_ROOT_CAUSE_TRACE__.expected=f},FIXTURES.A);
  await waitProjection(FIXTURES.A);const timingA=await switchTo('A');
  const timingB=await switchTo('B');
  const timingA2=await switchTo('A');

  const trace=await page.evaluate(()=>window.__RONA_ROOT_CAUSE_TRACE__);
  function foreignFor(event){
    const d=event?.detail;if(event?.type!=='SNAPSHOT'||!d?.visible_business_ids)return null;
    const f=FIXTURES[event.phase];if(!f)return null;
    const ids=d.visible_business_ids;
    const foreign={client_ids:ids.client_ids.filter(x=>x!==f.client_id),contract_ids:ids.contract_ids.filter(x=>x!==f.contract_id),deal_ids:ids.deal_ids.filter(x=>x!==f.deal_id)};
    return foreign.client_ids.length||foreign.contract_ids.length||foreign.deal_ids.length?foreign:null;
  }
  let first=null;for(const event of trace.events){const foreign=foreignFor(event);if(foreign){first={at:event.at,type:event.type,phase:event.phase,label:event.detail?.label,foreign,selected:event.detail?.selected,projection:event.detail?.projection,selector:event.detail?.selector,legacy:event.detail?.legacy};break}}
  const counts={};for(const r of requests){const key=`${r.path}|${r.source}`;counts[key]=(counts[key]||0)+1}
  const events=trace.events.filter(e=>['SELECT_CHANGE_CAPTURE','SELECT_CHANGE_AFTER_MICROTASK','rona:client-context-changed','rona:client-current-projection','rona:client:deals-rendered','rona:client:deal-authoritative-detail','SNAPSHOT','renderClientContext:before','restoreClientIdentityUI:before'].includes(e.type));
  console.log('FIRST_DIVERGENCE_TRACE',JSON.stringify(first));
  for(const e of events)console.log('TRACE_EVENT',JSON.stringify(e));
  for(const r of requests)console.log('TRACE_REQUEST',JSON.stringify(r));
  console.log('REQUEST_CALLER_MAP',JSON.stringify(counts));
  console.log('PERFORMANCE_TRACE',JSON.stringify({A:timingA,B:timingB,A2:timingA2}));
  console.log('PAGE_ERRORS',JSON.stringify(pageErrors));
  console.log('ROOT_CAUSE_TRACE_COMPLETE',JSON.stringify({first_divergence:Boolean(first),events:events.length,requests:requests.length,origin}));
  await context.close();
}catch(error){console.error('ROOT_CAUSE_TRACE_FATAL',error?.stack||error);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});await new Promise(resolve=>server.close(resolve))}
