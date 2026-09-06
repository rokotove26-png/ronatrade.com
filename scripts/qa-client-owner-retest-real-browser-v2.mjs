import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT=process.cwd();
const BASE_ROOT=process.env.RONA_OWNER_BASE_ROOT||'';
const LABEL=process.env.RONA_OWNER_RETEST_LABEL||'TARGET';
const DIST=join(ROOT,'dist');
const BASE_DIST=BASE_ROOT?join(BASE_ROOT,'dist'):null;
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const FIX={
  A:{client_id:'CLIENT-A',contract_id:'CONTRACT-A',legal_name:'ALPHA INDUSTRIES LLC',external:'EXT-A',deals:['DEAL-2099-101','DEAL-2099-102']},
  B:{client_id:'CLIENT-B',contract_id:'CONTRACT-B',legal_name:'BETA ENERGY LLC',external:'EXT-B',deals:['DEAL-2099-201']}
};
const EXPECTED_AMOUNT=123456.78;
const requests=[];

function contextFixture(name){const f=FIX[name];return{client_id:f.client_id,legal_name:f.legal_name,registration_country:'TEST',contract_id:f.contract_id,current_external_contract_number:f.external,contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31'}}
function stages(){return[['contract','DONE'],['documents','DONE'],['resource','CURRENT'],['payment','PENDING'],['logistics','PENDING'],['close','PENDING']].map(([key,state])=>({key,state,detail:`${key} fixture status`}))}
function projection(name='A'){
  const f=FIX[name];
  const deals=f.deals.map((id,i)=>({deal_id:id,client_id:f.client_id,contract_id:f.contract_id,current_status:'EXECUTING',current_status_label:'В исполнении',business_status:'ACTIVE',resource_status:'RESOURCE_CONFIRMED',resource_label:'Ресурс подтвержден',payment_status:'PAID',payment_label:'Оплачено',payment_obligation_amount:i===0?EXPECTED_AMOUNT:5000,payment_received_amount:i===0?EXPECTED_AMOUNT:5000,payment_currency:'USD'}));
  const applications=[0,1].map(i=>({application_id:`APP-${name}-${i+1}`,deal_id:deals[i]?.deal_id||deals[0]?.deal_id,client_id:f.client_id,contract_id:f.contract_id,product:`PRODUCT-${name}-${i+1}`,quantity_tonnes:10+i,proposed_price:100+i,proposed_currency:'USD',delivery_basis:'CPT',destination:`DEST-${name}-${i+1}`,status:'DEAL_REGISTERED'}));
  const documents=[1,2,3].map(i=>({document_id:`DOC-${name}-${i}`,client_id:f.client_id,contract_id:f.contract_id,document_type:'DOCUMENT',title:`Document ${i}`,status:'PUBLISHED'}));
  return{client_id:f.client_id,contract_id:f.contract_id,client:{client_id:f.client_id,legal_name:f.legal_name},contract:{client_id:f.client_id,contract_id:f.contract_id,current_external_contract_number:f.external},context:{client_id:f.client_id,contract_id:f.contract_id,legal_name:f.legal_name,current_external_contract_number:f.external},deals,applications,documents,payments:[]};
}
function fixtureForIds(c,k){return Object.entries(FIX).find(([,f])=>f.client_id===c&&f.contract_id===k)?.[0]||'A'}
function json(res,status,body){const text=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(text)});res.end(text)}
function record(label,req,u,body,status=200){const p=body?.data||body||{};requests.push({label,seq:requests.length+1,method:req.method,path:u.pathname,client_id:u.searchParams.get('clientId')||'',contract_id:u.searchParams.get('contractId')||'',source:norm(req.headers['x-rona-client-source']||req.headers['x-rona-client-deals-render']||req.headers['x-rona-client-deal-lifecycle']||'UNATTRIBUTED'),response_client_id:norm(p.client_id||p.context?.client_id||p.client?.client_id),response_contract_id:norm(p.contract_id||p.context?.contract_id||p.contract?.contract_id),status})}
async function api(label,req,res,u){
  const c=u.searchParams.get('clientId')||'',k=u.searchParams.get('contractId')||'',name=fixtureForIds(c,k),f=FIX[name];
  if(u.pathname==='/portal/api/v1/client/bootstrap'){const body={ok:true,data:{contexts:[contextFixture('A'),contextFixture('B')],selected_context:contextFixture('A'),requires_context_selection:false}};record(label,req,u,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/context'){const body={ok:true,data:projection(name)};record(label,req,u,body);await sleep(35);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/applications-projection'){const p=projection(name),body={ok:true,data:{client_id:f.client_id,contract_id:f.contract_id,applications:p.applications}};record(label,req,u,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/prices'){const body={ok:true,client_id:f.client_id,contract_id:f.contract_id,prices:[{publication_item_id:`PRICE-${name}`,publication_id:`PUB-${name}`,client_id:f.client_id,contract_id:f.contract_id,product:`PRODUCT-${name}`,basis:'CPT',price:100,currency:'USD',producer:`PRODUCER-${name}`,supplier:`SUPPLIER-${name}`}]};record(label,req,u,body);json(res,200,body);return true}
  if(u.pathname==='/portal/api/v1/client/deal-documents/state'){const body={ok:true,client_id:f.client_id,contract_id:f.contract_id,deals:f.deals.map(id=>({deal_id:id,client_id:f.client_id,contract_id:f.contract_id,realization_status:{source:'SERVER_AUTHORITATIVE_REALIZATION_V1',current_stage_key:'resource',stages:stages()}}))};record(label,req,u,body);json(res,200,body);return true}
  const simple={messages:{ok:true,messages:[]},archive:{ok:true,archive:{deals:[]}},payments:{ok:true,payments:[]},documents:{ok:true,documents:projection(name).documents},claims:{ok:true,claims:[]},shipments:{ok:true,shipments:[]},rail:{ok:true,shipments:[],rail:[]},deals:{ok:true,deals:projection(name).deals},market:{ok:true,analytics:[],news:[]},'market-intelligence':{ok:true,analytics:[],news:[]}};
  const leaf=u.pathname.split('/').pop();
  if(simple[leaf]){const body=simple[leaf];record(label,req,u,body);json(res,200,body);return true}
  if(u.pathname.startsWith('/portal/api/v1/client/')){const body={ok:true,data:{}};record(label,req,u,body);json(res,200,body);return true}
  return false;
}
function mime(path){const e=extname(path).toLowerCase();return e==='.html'?'text/html; charset=utf-8':e==='.js'?'application/javascript; charset=utf-8':e==='.css'?'text/css; charset=utf-8':e==='.svg'?'image/svg+xml':e==='.png'?'image/png':e==='.json'?'application/json; charset=utf-8':'application/octet-stream'}
function safePath(dist,pathname){const clean=normalize(pathname).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/,'');const full=join(dist,clean);return full.startsWith(dist)?full:null}
async function serveStatic(dist,res,pathname){const path=safePath(dist,pathname);if(!path)return false;try{const s=await stat(path);if(!s.isFile())return false;const b=await readFile(path);res.writeHead(200,{'content-type':mime(path),'cache-control':'no-store'});res.end(b);return true}catch{return false}}
async function makeServer(dist,label){const html=join(dist,'portal','client.html');const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url||'/','http://127.0.0.1');if(u.pathname==='/portal/client'||u.pathname==='/portal/client/'){const b=await readFile(html);res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(b);return}if(await api(label,req,res,u))return;if(await serveStatic(dist,res,u.pathname))return;res.writeHead(404);res.end('not found')}catch(e){res.writeHead(500);res.end(String(e?.stack||e))}});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});return{server,origin:`http://127.0.0.1:${server.address().port}`}}
function fail(list,code,detail={}){list.push({code,detail});console.log('ASSERTION_FAILED',code,JSON.stringify(detail))}
function near(a,b,min=.96,max=1.14){return Number.isFinite(a)&&Number.isFinite(b)&&b>0&&a/b>=min&&a/b<=max}

const targetServer=await makeServer(DIST,LABEL);
const baseServer=BASE_DIST?await makeServer(BASE_DIST,'BASE'):null;
let browser;
const failures=[];
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const target=await context.newPage();
  const errors=[];target.on('pageerror',e=>errors.push(String(e?.message||e)));target.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await target.goto(targetServer.origin+'/portal/client',{waitUntil:'domcontentloaded',timeout:30000});
  await target.waitForFunction(()=>window.RONA_CLIENT_CONTEXT&&typeof window.RONA_CLIENT_CONTEXT.getCurrentContext==='function',{timeout:10000});
  await target.waitForFunction(()=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();return c?.client_id==='CLIENT-A'&&c?.contract_id==='CONTRACT-A'},{timeout:10000});
  await target.waitForFunction(()=>document.documentElement.getAttribute('data-rona-client-home-state')==='ready',{timeout:5000}).catch(()=>{});

  const nav=await target.evaluate(()=>[...document.querySelectorAll('#nav button[data-page],#nav [data-page]')].map((b,i)=>({i,page:b.getAttribute('data-page')||'',text:(b.textContent||'').replace(/\s+/g,' ').trim(),visible:!!(b.offsetWidth||b.offsetHeight||b.getClientRects().length)})).filter(x=>x.visible));
  console.log('REAL_NAV_MAP',JSON.stringify(nav));
  const home=nav.find(x=>x.page==='home')||nav.find(x=>/главная|home/i.test(x.text));
  const company=nav.find(x=>/компан/i.test(x.text))||nav.find(x=>/compan|contract/i.test(x.page));
  const preferred=[company,...['deals','prices','applications','payments'].map(p=>nav.find(x=>x.page===p))].filter(Boolean);
  const sections=[];for(const x of preferred)if(x.page&&x.page!==home?.page&&!sections.some(y=>y.page===x.page))sections.push(x);
  if(!home)fail(failures,'HOME_NAV_NOT_FOUND',{nav});
  if(!company)fail(failures,'COMPANY_NAV_NOT_FOUND',{nav});
  if(sections.length<3)fail(failures,'HOME_REENTRY_SECTION_COVERAGE_INSUFFICIENT',{sections});

  const clickPage=async pageName=>{await target.evaluate(pageName=>{const b=[...document.querySelectorAll('#nav [data-page]')].find(x=>x.getAttribute('data-page')===pageName);if(!b)throw new Error('NAV_MISSING:'+pageName);b.click()},pageName);await sleep(80)};
  const state=()=>target.evaluate(()=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()||null,p=window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()||null;const visible=n=>{if(!n||!n.isConnected||n.hidden)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};const text=[...document.querySelectorAll('main *')].filter(x=>x.childElementCount===0&&visible(x)&&!x.closest('#clientContextSelect')).map(x=>(x.textContent||'').trim()).join(' ');return{selected:c?{client_id:c.client_id,contract_id:c.contract_id}:null,projection:p?{client_id:p.client_id||p.client?.client_id||p.context?.client_id,contract_id:p.contract_id||p.contract?.contract_id||p.context?.contract_id}:null,home_state:document.documentElement.getAttribute('data-rona-client-home-state'),home_ready:document.documentElement.getAttribute('data-rona-client-home-ready'),home_owner:document.querySelector('[data-rona-client-home-owner="command-center-v2"]')?.getAttribute('data-rona-client-home-owner')||'',active:[...document.querySelectorAll('.page.active,[data-page-panel].active')].map(x=>x.id||x.getAttribute('data-page-panel')),foreign:{client:text.includes('CLIENT-B'),contract:text.includes('CONTRACT-B'),company:text.includes('BETA ENERGY LLC'),external:text.includes('EXT-B')}}});
  const reentry=[];
  if(home){for(const sec of sections.slice(0,4)){
    await clickPage(sec.page);
    const beforeReq=requests.length;
    const started=Date.now();
    await clickPage(home.page);
    let ready=true;try{await target.waitForFunction(()=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.(),p=window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.();return document.documentElement.getAttribute('data-rona-client-home-state')==='ready'&&c?.client_id==='CLIENT-A'&&c?.contract_id==='CONTRACT-A'&&(p?.client_id||p?.client?.client_id||p?.context?.client_id)==='CLIENT-A'&&(p?.contract_id||p?.contract?.contract_id||p?.context?.contract_id)==='CONTRACT-A'},{timeout:2500})}catch{ready=false}
    const snap=await state();const delta=requests.slice(beforeReq).filter(r=>r.label===LABEL);const contextReq=delta.filter(r=>r.path==='/portal/api/v1/client/context');const ms=Date.now()-started;const row={section:sec.page,text:sec.text,ready,ms,snap,context_requests:contextReq};reentry.push(row);
    if(!ready)fail(failures,'HOME_REENTRY_READY',{section:sec.page,ms,snap});
    if(snap.selected?.client_id!=='CLIENT-A'||snap.selected?.contract_id!=='CONTRACT-A'||snap.projection?.client_id!=='CLIENT-A'||snap.projection?.contract_id!=='CONTRACT-A')fail(failures,'HOME_REENTRY_AUTHORITY',{section:sec.page,snap});
    if(Object.values(snap.foreign).some(Boolean))fail(failures,'HOME_REENTRY_FOREIGN_DOM',{section:sec.page,foreign:snap.foreign});
    const competing=contextReq.filter(r=>!String(r.source).startsWith('client-context-selection-authority-v1'));
    if(competing.length||contextReq.length>0)fail(failures,'HOME_REENTRY_CONTEXT_OWNER',{section:sec.page,context_requests:contextReq});
  }}
  console.log('HOME_REENTRY_TRACE',JSON.stringify(reentry));

  if(company){
    await clickPage(company.page);await sleep(500);
    const companyProof=await target.evaluate(({client,contract,name,external})=>{const visible=n=>{if(!n)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};let card=[...document.querySelectorAll('[data-rona-client-id],[data-client-card],[data-company-card],.company-card,.client-card,.contract-card')].find(x=>visible(x)&&x.getAttribute('data-rona-client-id')===client&&x.getAttribute('data-rona-client-contract-id')===contract);if(!card)card=[...document.querySelectorAll('main article,main .card,main .panel,main section')].find(x=>visible(x)&&(x.textContent||'').includes(name)&&(x.textContent||'').includes(client));const text=(card?.innerText||'').replace(/\s+/g,' ').trim();const metric=label=>{const re=new RegExp(label,'i');for(const el of card?.querySelectorAll('*')||[]){if(el.childElementCount>0||!re.test((el.textContent||'').trim()))continue;let p=el.parentElement;for(let i=0;p&&p!==card&&i<4;i++,p=p.parentElement){const t=(p.innerText||'').replace(/\s+/g,' ').trim();const m=t.match(/\b(\d+)\b/);if(m)return Number(m[1])}}const m=text.match(new RegExp('(\\d+)\\s+(?:'+label+')','i'));return m?Number(m[1]):null};return{found:!!card,text,dataset:card?{client:card.getAttribute('data-rona-client-id'),contract:card.getAttribute('data-rona-client-contract-id')}:null,contains:{client:text.includes(client),contract:text.includes(contract),name:text.includes(name),external:text.includes(external)},metrics:{applications:metric('заяв'),deals:metric('сдел'),documents:metric('документ')}}},{client:'CLIENT-A',contract:'CONTRACT-A',name:FIX.A.legal_name,external:FIX.A.external});
    console.log('REAL_COMPANY_PROOF',JSON.stringify(companyProof));
    if(!companyProof.found||!Object.values(companyProof.contains).every(Boolean)||companyProof.metrics.applications!==2||companyProof.metrics.deals!==2||companyProof.metrics.documents!==3)fail(failures,'CURRENT_COMPANY_CARD_AND_COUNTERS',companyProof);
  }

  const dealsNav=nav.find(x=>x.page==='deals')||nav.find(x=>/сделк/i.test(x.text));
  if(!dealsNav)fail(failures,'DEALS_NAV_NOT_FOUND',{nav});
  let passportProof=null;
  if(dealsNav){
    await clickPage(dealsNav.page);await sleep(650);
    const counts=await target.evaluate(ids=>{const visible=n=>{if(!n)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const out={};for(const id of ids){const rows=new Set();for(const b of document.querySelectorAll(`[data-open-deal="${id}"]`)){if(!visible(b))continue;const r=b.closest('[data-rona-authoritative-deal-row],.deal-row,.client-deal-card,[data-home-deal]')||b;if(visible(r))rows.add(r)}out[id]=rows.size}return out},FIX.A.deals);
    console.log('REAL_DEAL_ROW_COUNTS',JSON.stringify(counts));
    if(FIX.A.deals.some(id=>counts[id]!==1))fail(failures,'DEALS_ONE_VISIBLE_ROW_PER_ID',{counts});
    await target.evaluate(id=>{const list=[...document.querySelectorAll(`[data-open-deal="${id}"]`)].filter(x=>x.offsetWidth||x.offsetHeight||x.getClientRects().length);const auth=list.find(x=>x.closest('[data-rona-authoritative-deal-row]'))||list[0];if(!auth)throw new Error('OPEN_DEAL_NOT_FOUND');auth.click()},FIX.A.deals[0]).catch(e=>fail(failures,'PASSPORT_OPEN_ACTION',{error:String(e)}));
    try{await target.waitForFunction(id=>[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].some(r=>(r.offsetWidth||r.offsetHeight||r.getClientRects().length)&&r.getAttribute('data-rona-authoritative-binding')==='authoritative-binding'&&r.getAttribute('data-rona-authoritative-deal-id')===id),FIX.A.deals[0],{timeout:3500})}catch{}
    passportProof=await target.evaluate(id=>{const visible=n=>{if(!n)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const d=[...document.querySelectorAll('.rona-deal-command-center-v3,[data-rona-deal-passport]')].find(visible);if(!d)return{visible:false};let amount='';for(const p of d.querySelectorAll('.pair,[data-rona-deal-field]')){const t=(p.innerText||'').replace(/\s+/g,' ').trim();if(/Сумма/i.test(t)){amount=t;break}}const ntext=amount.replace(/[^0-9,.-]/g,'').replace(/\s/g,'');let numeric=null;if(ntext){const s=ntext.includes(',')?ntext.replace(/\./g,'').replace(',','.'):ntext;const n=Number(s);if(Number.isFinite(n))numeric=n}return{visible:true,binding:d.getAttribute('data-rona-authoritative-binding')||'',client:d.getAttribute('data-rona-authoritative-client-id')||'',contract:d.getAttribute('data-rona-authoritative-contract-id')||'',deal:d.getAttribute('data-rona-authoritative-deal-id')||'',amount,numeric,currency:/USD|долл/i.test(amount),lifecycle:d.querySelector('[data-rona-realization-owner],#rona-deal-realization-flow-v3')?.getAttribute('data-rona-realization-owner')||d.querySelector('#rona-deal-realization-flow-v3')?.dataset?.ronaRealizationOwner||'',text:(d.innerText||'').replace(/\s+/g,' ').trim().slice(0,2200)}},FIX.A.deals[0]);
    console.log('REAL_PASSPORT_PROOF',JSON.stringify(passportProof));
    if(!passportProof.visible||passportProof.binding!=='authoritative-binding'||passportProof.client!=='CLIENT-A'||passportProof.contract!=='CONTRACT-A'||passportProof.deal!==FIX.A.deals[0]||!passportProof.currency||Math.abs((passportProof.numeric??0)-EXPECTED_AMOUNT)>0.01)fail(failures,'PASSPORT_AMOUNT_AND_CONTEXT',passportProof);
  }

  if(baseServer){
    const base=await context.newPage();await base.goto(baseServer.origin+'/portal/client',{waitUntil:'domcontentloaded',timeout:30000});await sleep(900);
    const sample=async page=>page.evaluate(()=>{const visible=n=>{if(!n)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};const pick=sel=>{const n=[...document.querySelectorAll(sel)].find(visible);return n?parseFloat(getComputedStyle(n).fontSize):null};const analytics=document.querySelector('#page-analytics,[data-page-panel="analytics"]');let an=null;if(analytics){const n=[analytics,...analytics.querySelectorAll('*')].find(visible);if(n)an=parseFloat(getComputedStyle(n).fontSize)}return{body:parseFloat(getComputedStyle(document.body).fontSize),nav:pick('#nav button,#nav [data-page]'),homeTitle:pick('#page-home h1,#homePage h1'),homeSub:pick('#page-home .sub,#homePage .sub'),button:pick('#page-home button,#homePage button'),analytics:an}});
    const baseFonts=await sample(base),targetFonts=await sample(target);console.log('REAL_TYPOGRAPHY_PROOF',JSON.stringify({base:baseFonts,target:targetFonts}));
    const ratios=[];for(const key of ['body','nav','homeTitle','homeSub','button'])if(Number.isFinite(baseFonts[key])&&Number.isFinite(targetFonts[key])&&baseFonts[key]>0)ratios.push({key,ratio:targetFonts[key]/baseFonts[key],base:baseFonts[key],target:targetFonts[key]});
    const sufficientlyScaled=ratios.length>=3&&ratios.filter(x=>x.ratio>=1.075&&x.ratio<=1.125).length>=Math.ceil(ratios.length*.6)&&ratios.every(x=>x.ratio>=.98);
    const analyticsStable=!Number.isFinite(baseFonts.analytics)||!Number.isFinite(targetFonts.analytics)||near(targetFonts.analytics,baseFonts.analytics,.98,1.02);
    if(!sufficientlyScaled||!analyticsStable)fail(failures,'CLIENT_TYPOGRAPHY_REAL_UI_110',{ratios,analyticsStable,base:baseFonts,target:targetFonts});
    await base.close();
  }

  const currentContextRequests=requests.filter(r=>r.label===LABEL&&r.path==='/portal/api/v1/client/context');
  const ownerMap={};for(const r of currentContextRequests)ownerMap[r.source]=(ownerMap[r.source]||0)+1;console.log('CONTEXT_REQUEST_OWNER_MAP',JSON.stringify(ownerMap));
  console.log('PAGE_ERRORS',JSON.stringify(errors));
  if(failures.length){console.log('OWNER_RETEST_REGRESSION_RESULT=FAIL',JSON.stringify({label:LABEL,failures}));process.exitCode=1}else{console.log('OWNER_RETEST_ASSERTION_SET=PASS',JSON.stringify({label:LABEL,assertions:['real-section-home-reentry-bounded-ready','selected-context-authority-preserved','no-foreign-business-dom-after-reentry','no-home-navigation-context-request-owner','real-current-company-card-counters','one-visible-canonical-row-per-deal','real-authoritative-passport-amount-context','real-client-typography-110-analytics-excluded']}));console.log('OWNER_RETEST_REGRESSION_RESULT=PASS')}
}finally{
  if(browser)await browser.close();
  await new Promise(r=>targetServer.server.close(r));
  if(baseServer)await new Promise(r=>baseServer.server.close(r));
}
