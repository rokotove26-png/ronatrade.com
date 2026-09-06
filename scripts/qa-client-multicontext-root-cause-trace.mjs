import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const DIST=join(ROOT,'dist');
const CLIENT_HTML=join(DIST,'portal','client.html');
const TARGET_LABEL=process.env.RONA_TRACE_TARGET_LABEL||'TARGET';
const t0=Date.now();
const now=()=>Date.now()-t0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const FIXTURES={
  A:{client_id:'CLIENT-A',contract_id:'CONTRACT-A',legal_name:'ALPHA HOLDING LLC',external:'EXT-A',deal_id:'DEAL-2099-101',product:'PRODUCT-A'},
  B:{client_id:'CLIENT-B',contract_id:'CONTRACT-B',legal_name:'BETA ENERGY LLC',external:'EXT-B',deal_id:'DEAL-2099-202',product:'PRODUCT-B'}
};
let selected='A';
const requests=[];

function contextFixture(name){const f=FIXTURES[name];return{client_id:f.client_id,legal_name:f.legal_name,registration_country:'TEST',contract_id:f.contract_id,current_external_contract_number:f.external,contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31'}}
function stages(){return[['contract','DONE'],['documents','DONE'],['resource','CURRENT'],['payment','PENDING'],['logistics','PENDING'],['close','PENDING']].map(([key,state])=>({key,state,detail:`${key} fixture status`}))}
function projection(name){const f=FIXTURES[name];return{client_id:f.client_id,contract_id:f.contract_id,client:{client_id:f.client_id,legal_name:f.legal_name},contract:{client_id:f.client_id,contract_id:f.contract_id,current_external_contract_number:f.external},context:{client_id:f.client_id,contract_id:f.contract_id,legal_name:f.legal_name,current_external_contract_number:f.external},deals:[{deal_id:f.deal_id,client_id:f.client_id,contract_id:f.contract_id,current_status:'EXECUTING',current_status_label:'В исполнении',business_status:'ACTIVE',resource_status:'RESOURCE_CONFIRMED',resource_label:'Ресурс подтвержден',payment_status:'PAID',payment_label:'Оплачено',payment_obligation_amount:1000,payment_received_amount:1000,payment_currency:'USD'}],applications:[{application_id:`APP-${name}`,deal_id:f.deal_id,client_id:f.client_id,contract_id:f.contract_id,product:f.product,quantity_tonnes:10,proposed_price:100,proposed_currency:'USD',delivery_basis:'CPT',destination:`DEST-${name}`,status:'DEAL_REGISTERED'}],documents:[],payments:[]}}
function fixtureForIds(c,k){return Object.entries(FIXTURES).find(([,f])=>f.client_id===c&&f.contract_id===k)?.[0]||null}
function json(res,status,body){const text=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(text)});res.end(text)}
function record(req,u,responseName,responseBody,status=200){const source=norm(req.headers['x-rona-client-source']||req.headers['x-rona-client-deals-render']||req.headers['x-rona-client-deal-lifecycle']||'UNATTRIBUTED');const p=responseBody?.data||responseBody||{};requests.push({seq:requests.length+1,at_ms:now(),phase:selected,method:req.method,path:u.pathname,client_id:u.searchParams.get('clientId')||'',contract_id:u.searchParams.get('contractId')||'',source,causal_event:norm(req.headers['x-rona-diagnostic-event-probe']||''),response_fixture:responseName||'',response_client_id:norm(p.client_id||p.context?.client_id||p.client?.client_id),response_contract_id:norm(p.contract_id||p.context?.contract_id||p.contract?.contract_id),status})}
async function api(req,res,u){
  const c=u.searchParams.get('clientId')||'',k=u.searchParams.get('contractId')||'',name=fixtureForIds(c,k)||selected;
  if(u.pathname==='/portal/api/v1/client/bootstrap'){const body={ok:true,data:{contexts:[contextFixture('A'),contextFixture('B')],selected_context:contextFixture(selected),requires_context_selection:false}};record(req,u,selected,body);await sleep(20);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/context'){const n=fixtureForIds(c,k);if(!n){const body={ok:false,code:'BAD_CONTEXT'};record(req,u,'',body,400);json(res,400,body);return true}const body={ok:true,data:projection(n)};record(req,u,n,body);await sleep(n==='A'?110:140);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/prices'){const n=fixtureForIds(c,k),f=FIXTURES[n]||FIXTURES.A,body={ok:true,client_id:f.client_id,contract_id:f.contract_id,prices:[{publication_item_id:`PRICE-${n}`,publication_id:`PUB-${n}`,client_id:f.client_id,contract_id:f.contract_id,product:f.product,basis:'CPT',price:100,currency:'USD',producer:`PRODUCER-${n}`,supplier:`SUPPLIER-${n}`}]};record(req,u,n,body);await sleep(90);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/deal-documents/state'){const n=fixtureForIds(c,k),f=FIXTURES[n]||FIXTURES.A,body={ok:true,client_id:f.client_id,contract_id:f.contract_id,deals:[{deal_id:f.deal_id,client_id:f.client_id,contract_id:f.contract_id,realization_status:{source:'SERVER_AUTHORITATIVE_REALIZATION_V1',current_stage_key:'resource',stages:stages()}}]};record(req,u,n,body);await sleep(80);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/messages'){const body={ok:true,messages:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/archive'){const body={ok:true,archive:{deals:[]}};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/market'||u.pathname==='/portal/api/v1/client/market-intelligence'){const body={ok:true,analytics:[],news:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/shipments'){const body={ok:true,shipments:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/rail'){const body={ok:true,shipments:[],rail:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/payments'){const body={ok:true,payments:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/deals'){const body={ok:true,deals:projection(name).deals};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/documents'){const body={ok:true,documents:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/claims'){const body={ok:true,claims:[]};record(req,u,name,body);json(res,200,body);return true}
  if(u.pathname.startsWith('/portal/api/v1/client/')){const body={ok:true,data:{}};record(req,u,name,body);json(res,200,body);return true}
  return false;
}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':e==='.jpg'||e==='.jpeg'?'image/jpeg':e==='.json'?'application/json; charset=utf-8':'application/octet-stream'}
function safeDist(pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(DIST,clean);return full.startsWith(DIST)?full:null}
async function serveStatic(res,pathname){const path=safeDist(pathname);if(!path)return false;try{const s=await stat(path);if(!s.isFile())return false;const b=await readFile(path);res.writeHead(200,{'content-type':mime(path),'cache-control':'no-store'});res.end(b);return true}catch{return false}}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url||'/','http://127.0.0.1');if(u.pathname==='/portal/client'||u.pathname==='/portal/client/'){const b=await readFile(CLIENT_HTML);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(b);return}if(await api(req,res,u))return;if(await serveStatic(res,u.pathname))return;res.writeHead(404,{'content-type':'text/plain'});res.end('not found')}catch(e){res.writeHead(500,{'content-type':'text/plain'});res.end(String(e?.stack||e))}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
const origin=`http://127.0.0.1:${server.address().port}`;

let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(({fixtures})=>{
    window.__RONA_STRICT_TRACE__={events:[],phase:'BOOT',expected:fixtures.A};
    window.__RONA_CAUSAL_EVENT__='';
    const baseFetch=window.fetch.bind(window);
    window.fetch=(input,init={})=>{const event=window.__RONA_CAUSAL_EVENT__||'';if(!event)return baseFetch(input,init);const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));headers.set('x-rona-diagnostic-event-probe',event);return baseFetch(input,{...init,headers})};
    const push=(type,detail={})=>window.__RONA_STRICT_TRACE__.events.push({at:performance.now(),type,phase:window.__RONA_STRICT_TRACE__.phase,detail});
    for(const name of ['rona:client-context-changed','rona:client-context-ready','rona:client-current-projection','rona:client:deals-rendered','rona:client:deal-authoritative-detail','rona:client:deal-context-error'])window.addEventListener(name,e=>push(name,e.detail||{}),true);
  },{fixtures:FIXTURES});
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e?.message||e)));page.on('console',m=>{if(m.type()==='error')pageErrors.push('console:'+m.text())});
  await page.goto(origin+'/portal/client',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.RONA_CLIENT_CONTEXT&&typeof window.RONA_CLIENT_CONTEXT.getCurrentContext==='function',{timeout:10000});

  await page.evaluate(fixtures=>{
    const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
    const visible=n=>{if(!n||!n.isConnected||n.hidden)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
    const trace=window.__RONA_STRICT_TRACE__;
    const businessText=()=>{const parts=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const p=n.parentElement;if(!p||p.closest('script,style,nav,#clientContextSelect'))continue;if(!p.closest('main,.rona-deal-command-center-v3,[data-rona-deal-passport]'))continue;if(!visible(p))continue;const t=norm(n.nodeValue);if(t)parts.push(t)}return norm(parts.join(' '))};
    const visibleBusiness=()=>{const text=businessText(),uniq=re=>[...new Set(text.match(re)||[])];return{client_ids:uniq(/CLIENT-[A-Z0-9-]+/g),contract_ids:uniq(/CONTRACT-[A-Z0-9-]+/g),deal_ids:uniq(/DEAL-\d{4}-\d{3,}/g),external_contracts:Object.values(fixtures).map(x=>x.external).filter(x=>text.includes(x)),company_names:Object.values(fixtures).map(x=>x.legal_name).filter(x=>text.includes(x))}};
    const legacy=()=>{let id=null,record=null;try{id=typeof activeClientContractId!=='undefined'?activeClientContractId:null;record=typeof CLIENT_CONTEXTS!=='undefined'&&CLIENT_CONTEXTS&&id?CLIENT_CONTEXTS[id]:null}catch{}return{activeClientContractId:id,activeRecord:record?{clientId:record.clientId||null,contractId:record.contractId||null,company:record.company||record.companyName||record.legalName||null,contractNo:record.contractNo||record.current_external_contract_number||null}:null,owner_marker:document.documentElement.dataset.ronaLegacyContextOwner||null}};
    const passport=()=>{const r=[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].find(visible);if(!r)return{visible:false};const flow=r.querySelector('#rona-deal-realization-flow-v3');return{visible:true,binding:r.dataset.ronaAuthoritativeBinding||'',deal_id:r.dataset.ronaAuthoritativeDealId||'',client_id:r.dataset.ronaAuthoritativeClientId||'',contract_id:r.dataset.ronaAuthoritativeContractId||'',context:r.dataset.ronaAuthoritativeContext||'',lifecycle_owner:flow?.dataset?.ronaRealizationOwner||'',text:norm(r.innerText)}};
    window.__RONA_STRICT_SNAPSHOT__=label=>{const a=window.RONA_CLIENT_CONTEXT,c=a?.getCurrentContext?.()||null,p=a?.getCurrentProjection?.()||null,s={at:performance.now(),label,phase:trace.phase,selected:c?{client_id:c.client_id,contract_id:c.contract_id}:null,projection:p?{client_id:p.client_id||p.client?.client_id||p.context?.client_id||null,contract_id:p.contract_id||p.contract?.contract_id||p.context?.contract_id||null,deals:(p.deals||[]).map(d=>({deal_id:d.deal_id,client_id:d.client_id,contract_id:d.contract_id,current_status:d.current_status||d.business_status,resource_status:d.resource_status,payment_status:d.payment_status||d.finance_status}))}:null,legacy:legacy(),visible_business:visibleBusiness(),home:window.__RONA_CLIENT_HOME_STATE__||null,home_status:document.documentElement.getAttribute('data-rona-client-home-state'),prices:window.__RONA_CLIENT_PRICE_SYNC_STATE__||null,deals_live:document.documentElement.dataset.ronaClientDealsLiveRender||'',passport:passport(),callers:a?.getCallerMap?.()||[]};trace.events.push({at:s.at,type:'SNAPSHOT',phase:trace.phase,detail:s});return s};
  },FIXTURES);

  const snapshot=label=>page.evaluate(label=>window.__RONA_STRICT_SNAPSHOT__(label),label);
  const setPhase=name=>page.evaluate(({name,f})=>{window.__RONA_STRICT_TRACE__.phase=name;window.__RONA_STRICT_TRACE__.expected=f},{name,f:FIXTURES[name]});
  const exactPair=(v,f)=>v?.client_id===f.client_id&&v?.contract_id===f.contract_id;
  const foreign=(s,f)=>{const b=s?.visible_business||{},out={client_ids:(b.client_ids||[]).filter(x=>x!==f.client_id),contract_ids:(b.contract_ids||[]).filter(x=>x!==f.contract_id),deal_ids:(b.deal_ids||[]).filter(x=>x!==f.deal_id),external_contracts:(b.external_contracts||[]).filter(x=>x!==f.external),company_names:(b.company_names||[]).filter(x=>x!==f.legal_name)};return Object.values(out).some(x=>x.length)?out:null};
  const currentDeal=(s,f)=>s?.deals_live==='ready'&&s?.projection?.deals?.some(d=>d.deal_id===f.deal_id&&d.client_id===f.client_id&&d.contract_id===f.contract_id);
  const currentPrice=(s,f)=>exactPair(s?.prices?.context,f)&&Array.isArray(s?.prices?.prices)&&s.prices.prices.length>0;
  const currentPassport=(s,f)=>s?.passport?.visible&&s.passport.binding==='authoritative-binding'&&s.passport.deal_id===f.deal_id&&s.passport.client_id===f.client_id&&s.passport.contract_id===f.contract_id;

  async function activateProductionControl(kind){return page.evaluate(kind=>{
    const norm=v=>String(v??'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
    const visible=n=>{if(!n||!n.isConnected||n.hidden)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
    const specs=kind==='prices'?{ids:['navPrices','nav-prices'],tokens:['цены','прайс']}:{ids:['navDeals','nav-deals'],tokens:['сделки']};
    const all=[...document.querySelectorAll('button,a,[role="button"],[role="tab"],[role="menuitem"]')];
    const target=specs.ids.map(id=>document.getElementById(id)).find(visible)||all.find(n=>visible(n)&&specs.tokens.some(t=>[norm(n.textContent),norm(n.getAttribute('aria-label')),norm(n.getAttribute('title'))].some(x=>x===t||x.includes(t))));
    const candidates=all.filter(visible).map(n=>({tag:n.tagName,id:n.id||'',text:String(n.textContent||'').replace(/\s+/g,' ').trim().slice(0,90),aria:n.getAttribute('aria-label')||'',role:n.getAttribute('role')||'',data_page:n.getAttribute('data-page')||''})).filter(x=>x.text||x.aria).slice(0,80);
    if(!target)return{ok:false,kind,candidates};
    const descriptor={tag:target.tagName,id:target.id||'',text:String(target.textContent||'').replace(/\s+/g,' ').trim().slice(0,120),aria:target.getAttribute('aria-label')||'',role:target.getAttribute('role')||'',data_page:target.getAttribute('data-page')||'',class_name:String(target.className||'').slice(0,160)};
    target.click();return{ok:true,kind,descriptor};
  },kind)}
  async function waitProjection(f,timeout=5000){return page.waitForFunction(({c,k})=>{const a=window.RONA_CLIENT_CONTEXT,p=a?.getCurrentProjection?.(),s=a?.getCurrentContext?.();const pc=p?.client_id||p?.client?.client_id||p?.context?.client_id,pk=p?.contract_id||p?.contract?.contract_id||p?.context?.contract_id;return s?.client_id===c&&s?.contract_id===k&&pc===c&&pk===k},{c:f.client_id,k:f.contract_id},{timeout}).then(()=>true).catch(()=>false)}
  async function waitHome(f,timeout=5000){return page.waitForFunction(({c,k})=>{const h=window.__RONA_CLIENT_HOME_STATE__;return document.documentElement.getAttribute('data-rona-client-home-state')==='ready'&&h?.client_id===c&&h?.contract_id===k},{c:f.client_id,k:f.contract_id},{timeout}).then(()=>true).catch(()=>false)}
  async function waitPrices(f,timeout=4500){
    const start=performance.now(),requestStart=requests.length,action=await activateProductionControl('prices');
    if(!action.ok)return{ready:false,representative:false,reason:'PRODUCTION_PRICES_ACTION_NOT_FOUND',ms:Math.round(performance.now()-start),action,owner:null,request:null};
    const ready=await page.waitForFunction(({c,k})=>{const s=window.__RONA_CLIENT_PRICE_SYNC_STATE__;return s?.authority==='SERVER_AUTHORITATIVE_PRICE_PROJECTION'&&s?.context?.client_id===c&&s?.context?.contract_id===k&&Array.isArray(s?.prices)&&s.prices.length>0&&s.prices.every(p=>(!p.client_id||p.client_id===c)&&(!p.contract_id||p.contract_id===k))},{c:f.client_id,k:f.contract_id},{timeout}).then(()=>true).catch(()=>false);
    const request=requests.slice(requestStart).find(r=>r.path==='/portal/api/v1/client/prices'&&r.client_id===f.client_id&&r.contract_id===f.contract_id&&r.source==='client-price-sync-v1:prices')||null;
    const owner=await page.evaluate(()=>({marker:window.__RONA_CLIENT_PRICE_SYNC_V1__||null,script:[...document.scripts].map(s=>s.src||'').find(src=>src.includes('/assets/portal-runtime/client-price-sync-v1.js'))||null,state:window.__RONA_CLIENT_PRICE_SYNC_STATE__||null}));
    const representative=Boolean(owner.marker&&owner.script);
    return{ready:ready&&!!request,representative,reason:representative?(ready&&request?'READY':'REAL_CONSUMER_DID_NOT_LOAD_CURRENT_PRICE'):'PRODUCTION_PRICE_CONSUMER_OWNER_NOT_LOADED',ms:Math.round(performance.now()-start),action,owner,request};
  }
  async function waitDeals(f,timeout=3500){const action=await activateProductionControl('deals');const ready=await page.waitForFunction(({c,k,d})=>{const a=window.RONA_CLIENT_CONTEXT,p=a?.getCurrentProjection?.(),s=a?.getCurrentContext?.();const button=[...document.querySelectorAll('[data-open-deal]')].find(n=>n.getAttribute('data-open-deal')===d);return s?.client_id===c&&s?.contract_id===k&&Array.isArray(p?.deals)&&p.deals.some(x=>x.deal_id===d&&x.client_id===c&&x.contract_id===k)&&document.documentElement.dataset.ronaClientDealsLiveRender==='ready'&&!!button},{c:f.client_id,k:f.contract_id,d:f.deal_id},{timeout}).then(()=>true).catch(()=>false);return{ready,action}}
  async function openRealPassport(f,timeout=5000){
    const start=performance.now();const dealsAction=await activateProductionControl('deals');
    const target=await page.evaluate(d=>{const visible=n=>{if(!n||!n.isConnected||n.hidden)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const n=[...document.querySelectorAll('[data-open-deal]')].find(x=>x.getAttribute('data-open-deal')===d&&visible(x));return n?{tag:n.tagName,text:String(n.textContent||'').trim(),class_name:String(n.className||''),deal:n.getAttribute('data-open-deal')}:null},f.deal_id);
    if(!target)return{visible:false,bound:false,lifecycle:false,representative:false,reason:'PRODUCTION_DEAL_OPEN_ACTION_NOT_FOUND',ms:Math.round(performance.now()-start),deals_action:dealsAction,target:null,drawer:null,runtime:null};
    await page.locator(`[data-open-deal="${f.deal_id}"]:visible`).first().click({timeout:2500}).catch(()=>{});
    const nativeVisible=await page.waitForFunction(()=>[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].some(r=>{const s=getComputedStyle(r),q=r.getBoundingClientRect();return !r.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&q.width>0&&q.height>0}),undefined,{timeout:2500}).then(()=>true).catch(()=>false);
    const runtime=await page.evaluate(()=>({passport_marker:window.__RONA_CLIENT_DEAL_PASSPORT__||null,deals_marker:window.__RONA_CLIENT_DEALS_AUTHORITATIVE__||null,lifecycle_marker:window.__RONA_CLIENT_DEAL_LIFECYCLE__||null,drawer_count:document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]').length}));
    if(!nativeVisible)return{visible:false,bound:false,lifecycle:false,representative:false,reason:'NATIVE_PRODUCTION_DRAWER_DID_NOT_OPEN',ms:Math.round(performance.now()-start),deals_action:dealsAction,target,drawer:null,runtime};
    const bound=await page.waitForFunction(({c,k,d})=>[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].some(r=>{const s=getComputedStyle(r),q=r.getBoundingClientRect();return !r.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&q.width>0&&q.height>0&&r.dataset.ronaAuthoritativeBinding==='authoritative-binding'&&r.dataset.ronaAuthoritativeClientId===c&&r.dataset.ronaAuthoritativeContractId===k&&r.dataset.ronaAuthoritativeDealId===d}),{c:f.client_id,k:f.contract_id,d:f.deal_id},{timeout}).then(()=>true).catch(()=>false);
    const lifecycle=await page.waitForFunction(({c,k,d})=>{const t=window.__RONA_STRICT_TRACE__?.events||[];const hit=t.some(e=>e.type==='rona:client:deal-authoritative-detail'&&e.detail?.dealId===d&&e.detail?.client_id===c&&e.detail?.contract_id===k&&e.detail?.realization_status?.source==='SERVER_AUTHORITATIVE_REALIZATION_V1'&&e.detail?.realization_status?.current_stage_key==='resource');const drawer=[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].find(r=>r.dataset.ronaAuthoritativeDealId===d&&r.dataset.ronaAuthoritativeClientId===c&&r.dataset.ronaAuthoritativeContractId===k);const flow=drawer?.querySelector?.('#rona-deal-realization-flow-v3');return hit&&flow?.dataset?.ronaRealizationOwner==='server-authoritative-v6-strict-context'},{c:f.client_id,k:f.contract_id,d:f.deal_id},{timeout:2500}).then(()=>true).catch(()=>false);
    const drawer=await page.evaluate(({c,k,d})=>{const visible=n=>{if(!n||!n.isConnected||n.hidden)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const r=[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].find(visible);if(!r)return null;const flow=r.querySelector('#rona-deal-realization-flow-v3');return{binding:r.dataset.ronaAuthoritativeBinding||'',deal_id:r.dataset.ronaAuthoritativeDealId||'',client_id:r.dataset.ronaAuthoritativeClientId||'',contract_id:r.dataset.ronaAuthoritativeContractId||'',context:r.dataset.ronaAuthoritativeContext||'',passport_marker:r.dataset.ronaDealPassport||'',lifecycle_owner:flow?.dataset?.ronaRealizationOwner||'',text:String(r.innerText||'').replace(/\s+/g,' ').trim().slice(0,600),expected:c+'|'+k+'|'+d}},{c:f.client_id,k:f.contract_id,d:f.deal_id});
    return{visible:!!drawer,bound:bound&&drawer?.binding==='authoritative-binding'&&drawer?.deal_id===f.deal_id&&drawer?.client_id===f.client_id&&drawer?.contract_id===f.contract_id,lifecycle,representative:true,reason:bound&&lifecycle?'READY':'NATIVE_DRAWER_BIND_OR_LIFECYCLE_FAILED',ms:Math.round(performance.now()-start),deals_action:dealsAction,target,drawer,runtime};
  }
  async function latePriorProbe(name){
    const cur=FIXTURES[name],prior=FIXTURES[name==='B'?'A':'B'];const before=await snapshot(`${name}:late-prior-before`);
    const raw=await page.evaluate(async prior=>{const r=await fetch(`/portal/api/v1/client/context?clientId=${encodeURIComponent(prior.client_id)}&contractId=${encodeURIComponent(prior.contract_id)}`,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':'diagnostic-late-prior-probe'}});return r.json()},prior);
    const stale_event={client_id:prior.client_id,contract_id:prior.contract_id,context:{client_id:prior.client_id,contract_id:prior.contract_id},deals:[{deal_id:prior.deal_id,client_id:prior.client_id,contract_id:prior.contract_id,current_status:'EXECUTING',resource_status:'RESOURCE_CONFIRMED',payment_status:'PAID'}]};
    await page.evaluate(stale=>window.dispatchEvent(new CustomEvent('rona:client-current-projection',{detail:stale})),stale_event);
    await page.waitForTimeout(180);const after=await snapshot(`${name}:late-prior-after`);const changes=[];
    if(!exactPair(after.selected,cur))changes.push({consumer:'selected',before:before.selected,after:after.selected});
    if(!exactPair(after.projection,cur))changes.push({consumer:'authoritative_projection',before:before.projection,after:after.projection});
    if(before.home_status==='ready'&&exactPair(before.home,cur)&&(after.home_status!=='ready'||!exactPair(after.home,cur)))changes.push({consumer:'home',before:before.home,after:after.home});
    if(currentDeal(before,cur)&&!currentDeal(after,cur))changes.push({consumer:'deals',before:{live:before.deals_live,deals:before.projection?.deals},after:{live:after.deals_live,deals:after.projection?.deals}});
    if(currentPrice(before,cur)&&!currentPrice(after,cur))changes.push({consumer:'prices',before:before.prices,after:after.prices});
    if(currentPassport(before,cur)&&!currentPassport(after,cur))changes.push({consumer:'passport',before:before.passport,after:after.passport});
    const beforeBad=foreign(before,cur),afterBad=foreign(after,cur);if(JSON.stringify(afterBad)!==JSON.stringify(beforeBad))changes.push({consumer:'business_dom',before:beforeBad,after:afterBad});
    return{requested_prior:{client_id:prior.client_id,contract_id:prior.contract_id,deal_id:prior.deal_id},raw_response:{client_id:raw?.data?.client_id||null,contract_id:raw?.data?.contract_id||null,deals:(raw?.data?.deals||[]).map(d=>d.deal_id)},stale_event,before:{selected:before.selected,projection:before.projection,home:before.home,prices:before.prices,passport:before.passport,visible_business:before.visible_business},after:{selected:after.selected,projection:after.projection,home:after.home,prices:after.prices,passport:after.passport,visible_business:after.visible_business},committed_changes:changes};
  }
  async function waitRequestQuiescence(quietMs=650,maxMs=6000){const start=Date.now();let last=requests.length,quietSince=Date.now();while(Date.now()-start<maxMs){await sleep(100);if(requests.length!==last){last=requests.length;quietSince=Date.now()}else if(Date.now()-quietSince>=quietMs)return{ok:true,count:last,wait_ms:Date.now()-start}}return{ok:false,count:requests.length,wait_ms:Date.now()-start}}
  async function eventProbe(type){
    const barrier=await waitRequestQuiescence();const start=requests.length;
    await page.evaluate(type=>{const prev=window.__RONA_CAUSAL_EVENT__||'';const nST=window.setTimeout,nRAF=window.requestAnimationFrame,nQM=window.queueMicrotask;const wrap=cb=>(...args)=>{const p=window.__RONA_CAUSAL_EVENT__||'';window.__RONA_CAUSAL_EVENT__=type;try{return cb(...args)}finally{window.__RONA_CAUSAL_EVENT__=p}};window.setTimeout=(cb,...rest)=>nST(typeof cb==='function'?wrap(cb):cb,...rest);window.requestAnimationFrame=cb=>nRAF(wrap(cb));window.queueMicrotask=cb=>nQM(wrap(cb));window.__RONA_CAUSAL_EVENT__=type;try{if(type==='focus')window.dispatchEvent(new Event('focus'));else if(type==='pageshow')window.dispatchEvent(new Event('pageshow'));else document.dispatchEvent(new Event('visibilitychange'))}finally{window.__RONA_CAUSAL_EVENT__=prev;window.setTimeout=nST;window.requestAnimationFrame=nRAF;window.queueMicrotask=nQM}},type);
    await sleep(350);await waitRequestQuiescence(450,2500);const windowRequests=requests.slice(start);return{type,barrier,causal_requests:windowRequests.filter(r=>r.causal_event===type),ambient_requests:windowRequests.filter(r=>r.causal_event!==type)};
  }

  await page.evaluate(f=>{try{if(typeof CLIENT_CONTEXTS!=='undefined'&&CLIENT_CONTEXTS&&typeof CLIENT_CONTEXTS==='object')CLIENT_CONTEXTS[f.contract_id]={clientId:f.client_id,company:f.legal_name,contractId:f.contract_id,contractNo:f.external,applications:[],deals:[],documents:[],payments:[]};if(typeof activeClientContractId!=='undefined')activeClientContractId=f.contract_id;if(typeof renderClientContext==='function')renderClientContext()}catch{}},FIXTURES.A);

  const cycles=[];
  async function switchTo(name){
    const f=FIXTURES[name];selected=name;await setPhase(name);await snapshot(`${name}:before-select`);
    const ok=await page.evaluate(({c,k})=>{const s=document.getElementById('clientContextSelect');if(!s)return false;const o=[...s.options].find(x=>x.dataset.clientId===c&&x.dataset.contractId===k);if(!o)return false;s.value=o.value;s.dispatchEvent(new Event('change',{bubbles:true,cancelable:true}));return true},{c:f.client_id,k:f.contract_id});
    if(!ok)throw new Error(`selector option missing ${name}`);
    const sync=await snapshot(`${name}:after-change-sync`);await page.waitForTimeout(0);const task=await snapshot(`${name}:after-change-task`);
    const p0=performance.now(),projection_ready=await waitProjection(f),projection_ms=Math.round(performance.now()-p0);const projection_snapshot=await snapshot(`${name}:projection-${projection_ready?'ready':'timeout'}`);
    const h0=performance.now(),home_ready=await waitHome(f),home_ms=Math.round(performance.now()-h0);const home_snapshot=await snapshot(`${name}:home-${home_ready?'ready':'timeout'}`);
    const prices=await waitPrices(f);const prices_snapshot=await snapshot(`${name}:prices-${prices.ready?'ready':'timeout'}`);
    const d0=performance.now(),deals=await waitDeals(f),deals_ms=Math.round(performance.now()-d0);const deals_snapshot=await snapshot(`${name}:deals-${deals.ready?'ready':'timeout'}`);
    const passport=await openRealPassport(f);const passport_snapshot=await snapshot(`${name}:passport-${passport.bound&&passport.lifecycle?'bound':'unready'}`);
    const late_prior=await latePriorProbe(name);
    const cycle={name,sync,task,projection_ready,projection_ms,projection_snapshot,home_ready,home_ms,home_snapshot,prices,prices_snapshot,deals,deals_ms,deals_snapshot,passport,passport_snapshot,late_prior};cycles.push(cycle);return cycle;
  }

  await setPhase('A');await waitProjection(FIXTURES.A);const A=await switchTo('A');const B=await switchTo('B');const A2=await switchTo('A');
  const event_probes=[];for(const type of ['focus','pageshow','visibilitychange'])event_probes.push(await eventProbe(type));
  await waitRequestQuiescence();const idleBefore={requests:requests.length,dom:await page.locator('*').count()};await page.waitForTimeout(32000);const idleAfter={requests:requests.length,dom:await page.locator('*').count()};const idle={request_delta:idleAfter.requests-idleBefore.requests,dom_delta:idleAfter.dom-idleBefore.dom};await snapshot('A:idle-stable');

  const trace=await page.evaluate(()=>window.__RONA_STRICT_TRACE__);
  const failures=[];let first=null;
  for(const cycle of cycles){const f=FIXTURES[cycle.name],s=cycle.sync;if(!exactPair(s.selected,f)){first={reason:'SELECTED_CONTEXT_MISMATCH',phase:cycle.name,label:s.label,expected:{client_id:f.client_id,contract_id:f.contract_id},selected:s.selected};break}if(s.legacy?.activeClientContractId!==f.contract_id||s.legacy?.activeRecord?.clientId!==f.client_id||s.legacy?.activeRecord?.contractId!==f.contract_id){first={reason:'LEGACY_CONTEXT_OWNER_MISMATCH',phase:cycle.name,label:s.label,expected:{client_id:f.client_id,contract_id:f.contract_id},selected:s.selected,legacy:s.legacy};break}const bad=foreign(s,f);if(bad){first={reason:'FOREIGN_BUSINESS_DOM',phase:cycle.name,label:s.label,foreign:bad,selected:s.selected,legacy:s.legacy};break}}
  if(first)failures.push({code:first.reason,trace:first});
  for(const cycle of cycles){
    const f=FIXTURES[cycle.name];
    if(!cycle.projection_ready||!exactPair(cycle.projection_snapshot.projection,f))failures.push({code:'PROJECTION_NOT_READY',cycle:cycle.name,snapshot:cycle.projection_snapshot});
    if(!cycle.home_ready)failures.push({code:'HOME_NOT_READY',cycle:cycle.name,snapshot:cycle.home_snapshot});
    if(!cycle.prices.representative)failures.push({code:'PRICES_REAL_CONSUMER_UNAVAILABLE',cycle:cycle.name,prices:cycle.prices});
    else if(!cycle.prices.ready)failures.push({code:'PRICES_NOT_READY',cycle:cycle.name,prices:cycle.prices,snapshot:cycle.prices_snapshot});
    if(!cycle.deals.ready)failures.push({code:'DEALS_NOT_READY',cycle:cycle.name,deals:cycle.deals,snapshot:cycle.deals_snapshot});
    if(!cycle.passport.representative)failures.push({code:'PASSPORT_REAL_CONSUMER_UNAVAILABLE',cycle:cycle.name,passport:cycle.passport});
    else if(!cycle.passport.visible||!cycle.passport.bound||!cycle.passport.lifecycle)failures.push({code:'PASSPORT_NOT_BOUND',cycle:cycle.name,passport:cycle.passport,snapshot:cycle.passport_snapshot});
    if(cycle.late_prior.committed_changes.length)failures.push({code:'LATE_PRIOR_COMMITTED',cycle:cycle.name,probe:cycle.late_prior,first_consumer:cycle.late_prior.committed_changes[0]});
    for(const s of [cycle.task,cycle.projection_snapshot,cycle.home_snapshot,cycle.prices_snapshot,cycle.deals_snapshot,cycle.passport_snapshot]){const bad=foreign(s,f);if(bad)failures.push({code:'FOREIGN_BUSINESS_DOM',cycle:cycle.name,label:s.label,foreign:bad})}
  }
  const realContext=requests.filter(r=>r.path==='/portal/api/v1/client/context'&&!r.source.startsWith('diagnostic-'));for(const r of realContext){if(!r.source.startsWith('client-context-selection-authority-v1:'))failures.push({code:'UNAPPROVED_CONTEXT_OWNER',request:r});if(r.client_id!==r.response_client_id||r.contract_id!==r.response_contract_id)failures.push({code:'CONTEXT_RESPONSE_SCOPE_MISMATCH',request:r})}
  const alwaysForbidden=requests.filter(r=>['/portal/api/v1/client/shipments','/portal/api/v1/client/rail','/portal/api/v1/client/messages','/portal/api/v1/client/archive'].includes(r.path));if(alwaysForbidden.length)failures.push({code:'UNAPPROVED_BACKGROUND_FANOUT',requests:alwaysForbidden});
  const eventFailures=[];for(const probe of event_probes){const causal=probe.causal_requests.filter(r=>r.path.startsWith('/portal/api/v1/client/'));const approved=causal.filter(r=>r.path==='/portal/api/v1/client/deal-documents/state'&&r.source==='client-deal-lifecycle-v1'&&r.client_id===FIXTURES.A.client_id&&r.contract_id===FIXTURES.A.contract_id);const disallowed=causal.filter(r=>!approved.includes(r));const byOwner=new Map();for(const r of causal.filter(r=>r.path==='/portal/api/v1/client/context')){const key=`${r.path}|${r.client_id}|${r.contract_id}`;byOwner.set(key,(byOwner.get(key)||0)+1)}const duplicate_context=[...byOwner].filter(([,n])=>n>1);if(disallowed.length||duplicate_context.length)eventFailures.push({event:probe.type,causal_requests:causal,disallowed,duplicate_context,ambient_requests:probe.ambient_requests})}if(eventFailures.length)failures.push({code:'FOCUS_PAGESHOW_VISIBILITY_FANOUT',events:eventFailures});
  if(idle.request_delta!==0)failures.push({code:'IDLE_REQUEST_GROWTH',idle});if(idle.dom_delta>5)failures.push({code:'WHOLE_DOCUMENT_FEEDBACK_GROWTH',idle});

  const counts={};for(const r of requests){const key=`${r.path}|${r.source}`;counts[key]=(counts[key]||0)+1}
  const priceProof=cycles.map(c=>({cycle:c.name,action:c.prices.action,owner:c.prices.owner,representative:c.prices.representative,reason:c.prices.reason,request:c.prices.request,state:{context:c.prices_snapshot.prices?.context,authority:c.prices_snapshot.prices?.authority,count:c.prices_snapshot.prices?.prices?.length||0}}));
  const passportProof=cycles.map(c=>({cycle:c.name,target:c.passport.target,runtime:c.passport.runtime,drawer:c.passport.drawer,representative:c.passport.representative,reason:c.passport.reason,bound:c.passport.bound,lifecycle:c.passport.lifecycle}));
  console.log(TARGET_LABEL==='PRE_FIX'?'FIRST_DIVERGENCE_TRACE_PRE_FIX':'FIRST_DIVERGENCE_TRACE',JSON.stringify(first));
  console.log('A_B_A_TRACE',JSON.stringify(cycles.map(c=>({name:c.name,selected:c.sync.selected,legacy:c.sync.legacy,projection_ready:c.projection_ready,home_ready:c.home_ready,prices_ready:c.prices.ready,prices_representative:c.prices.representative,deals_ready:c.deals.ready,passport:{visible:c.passport.visible,bound:c.passport.bound,lifecycle:c.passport.lifecycle,representative:c.passport.representative},late_prior_committed_changes:c.late_prior.committed_changes}))));
  console.log('PERFORMANCE_TRACE',JSON.stringify({A:{projection_ms:A.projection_ms,home_ms:A.home_ms,prices_ms:A.prices.ms,deals_ms:A.deals_ms,passport_ms:A.passport.ms},B:{projection_ms:B.projection_ms,home_ms:B.home_ms,prices_ms:B.prices.ms,deals_ms:B.deals_ms,passport_ms:B.passport.ms},A2:{projection_ms:A2.projection_ms,home_ms:A2.home_ms,prices_ms:A2.prices.ms,deals_ms:A2.deals_ms,passport_ms:A2.passport.ms}}));
  console.log('REAL_PRICES_PROOF',JSON.stringify(priceProof));console.log('REAL_PASSPORT_PROOF',JSON.stringify(passportProof));console.log('LATE_PRIOR_COMMIT_PROOF',JSON.stringify(cycles.map(c=>({cycle:c.name,probe:c.late_prior}))));
  for(const r of requests)console.log('TRACE_REQUEST',JSON.stringify(r));
  console.log('REQUEST_CALLER_MAP',JSON.stringify(counts));console.log('EVENT_REQUEST_MAP',JSON.stringify(event_probes));console.log('IDLE_STABILITY',JSON.stringify(idle));console.log('PAGE_ERRORS',JSON.stringify(pageErrors));
  if(!first&&TARGET_LABEL==='POST_FIX')console.log('POST_FIX_DIVERGENCE=NONE');
  const uniqueFailures=[...new Set(failures.map(x=>x.code))];console.log('ROOT_CAUSE_TRACE_COMPLETE',JSON.stringify({target:TARGET_LABEL,failures:uniqueFailures,requests:requests.length,events:trace.events.length}));
  if(failures.length){console.error('ASSERTION_FAILED',JSON.stringify(failures[0]));throw new Error(`ASSERTION_FAILED:${failures[0].code}`)}
  console.log('ROOT_CAUSE_ASSERTION_SET=PASS',JSON.stringify({target:TARGET_LABEL,assertions:['selected-vs-authoritative-projection','legacy-owner-sync','foreign-business-dom','home-bounded-readiness','real-prices-production-consumer-bounded-readiness','deals-bounded-readiness','real-native-passport-exact-binding','real-authoritative-lifecycle-status','late-prior-not-committed','single-context-request-owner','causal-focus-pageshow-visibility-no-fanout','idle-request-stability-32s','no-dom-feedback-growth']}));
  await context.close();
}catch(error){console.error('ROOT_CAUSE_TRACE_FATAL',error?.stack||error);process.exitCode=1}
finally{if(browser)await browser.close().catch(()=>{});await new Promise(r=>server.close(r))}
