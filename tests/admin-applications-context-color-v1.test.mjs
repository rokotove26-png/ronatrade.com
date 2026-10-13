import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {onRequest} from '../functions/portal/applications-total-kpi-ui.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const blobSha=path=>{const b=readFileSync(new URL('../'+path,import.meta.url));return createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex')};

test('Owner-frozen Admin page header and core application actions remain untouched',()=>{
  assert.equal(blobSha('portal-src/current/admin.html'),'cca468590d2353f64d30300284a302479a2b972c');
  assert.equal(blobSha('functions/portal/main-ui/index.js'),'2ab68baf32c745b462e8c332978d3628b0c7cdad');
  assert.equal(blobSha('functions/portal/owner-ui-chunks/chunk6.js'),'b2bec3095a5a491d77071d347bf94c43c08c072b');
  const shell=read('assets/portal-admin-shell-fast-v1.js');
  assert.match(shell,/applications:\{src:'\/portal\/applications-total-kpi-ui/);
  assert.match(shell,/if\(p==='applications'\)return loadModule\('applications'/);
});

test('Applications module is syntactically valid, strictly page-scoped, non-mutating, and real-data sourced',async()=>{
  const response=await onRequest();
  assert.equal(response.status,200);
  const source=await response.text();
  assert.equal(response.headers.get('x-rona-applications-total-kpi'),'context-color-v1');
  assert.doesNotThrow(()=>new vm.Script(source));
  for(const marker of [
    "q('#page-applications')",
    "q('#page-applications .rona-app-kpi-grid')",
    "q('#page-applications .rona-app-filter button[aria-pressed=\"true\"]')",
    'window.__RONA_OWNER_ADMIN_SNAPSHOT__',
    'snapshot?.applications',
    'applicationBucket(a)===bucket',
    'data-rona-app-total',
    'ria-pressed'
  ].slice(0,-1))assert.ok(source.includes(marker),'Missing functional data source: '+marker);
  assert.ok(source.includes("q(':scope > .rona-owner-muted',queue)"));
  assert.ok(source.includes("kpi?.source==='RONA_APPLICATION_BUSINESS_V2'"));
  assert.ok(source.includes("kpi.state==='READY'"));
  assert.ok(source.includes("Number.isFinite(Number(v))"));
  assert.doesNotMatch(source,/XMLHttpRequest|navigator\.sendBeacon|localStorage|innerHTML\s*=/);
  assert.equal((source.match(/\bfetch\s*\(/g)||[]).length,1,'Only the canonical read-only fallback may use fetch');
  assert.ok(source.includes("fetch('/portal/admin-completed-bootstrap'"));
  assert.ok(source.includes("method:'GET',credentials:'same-origin',cache:'no-store'"));
  assert.ok(source.includes("sameRegistryAndBucket(liveSnapshot,resolvedKpiPayload,bucket)"));
  assert.ok(source.includes('rows.every(a=>a?.business_contract'));
  assert.ok(source.includes('a?.application_price')&&source.includes('a?.application_currency')&&source.includes('a?.price_is_agreed'));
  assert.ok(source.includes("a?.retention_decision")&&source.includes("a?.business_contract"));
  assert.match(source,/#page-applications \.rona-app-table \.rona-owner-actions button\.rona-app-action--approve/);
  assert.match(source,/#page-applications \.rona-app-table \.rona-owner-actions button\.rona-app-action--reject/);
  assert.doesNotMatch(source,/#page-(home|deals|access|prices|payments|analytics)\b/);
  assert.doesNotMatch(source,/(document\.querySelector\(['"]h1['"]\)|\.topbar|\.page-title|data-rona-title)/);
  for(const stage of ['is-new','is-work','is-decision','is-completed'])assert.match(source,new RegExp('button\\.'+stage));
  for(const style of ['rona-fin-pill--danger','rona-app-action--approve','rona-app-action--reject','rona-app-action--offer','rona-app-total-kpi--selected-amount','rona-app-money-values','rona-app-filter button:active',':focus-visible','prefers-reduced-motion','td:last-child button[data-rona-app-passport-open]','width:83px!important','white-space:nowrap!important','td:nth-child(2) *{white-space:normal!important','overflow-x:auto!important'])assert.ok(source.includes(style),style);
});

class Element{
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.id='';this.className='';this.dataset={};this.attributes={};this.textContent='';this.css={};
    this.style={setProperty:(k,v)=>{this.css[k]=v}};
    this.classList={
      contains:k=>this.className.split(/\s+/).includes(k),
      add:k=>{if(!this.classList.contains(k))this.className+=(this.className?' ':'')+k}
    };
  }
  append(...items){for(const x of items){x.parentElement=this;this.children.push(x)}}
  appendChild(item){this.append(item);return item}
  prepend(...items){for(const x of items)x.parentElement=this;this.children.unshift(...items)}
  remove(){if(this.parentElement){const p=this.parentElement.children;const idx=p.indexOf(this);if(idx>=0)p.splice(idx,1);this.parentElement=null}}
  insertAdjacentElement(where,x){if(where!=='afterend'||!this.parentElement)throw Error('Unexpected insertion');const p=this.parentElement.children;p.splice(p.indexOf(this)+1,0,x);x.parentElement=this.parentElement}
  setAttribute(k,v){this.attributes[k]=String(v)}
  getAttribute(k){return this.attributes[k]??null}
  querySelector(s){
    if(s==='h2')return this.children.find(x=>x.tagName==='H2')||null;
    if(s===':scope > .rona-owner-muted')return this.children.find(x=>x.classList.contains('rona-owner-muted'))||null;
    if(s==='[data-rona-app-registry-note]')return this.children.find(x=>x.dataset.ronaAppRegistryNote)||null;
    if(s==='[data-rona-app-queue-context]')return this.children.find(x=>x.dataset.ronaAppQueueContext)||null;
    if(s==='.rona-app-table')return this.children.find(x=>x.classList.contains('rona-app-table'))||null;
    return null
  }
  querySelectorAll(s){
    if(s==='[data-rona-app-total]')return this.children.filter(x=>x.dataset.ronaAppTotal);
    if(s==='.rona-app-table button'||s==='.rona-app-table .rona-owner-actions button')return this.actions||[];
    return []
  }
}
function mockPage(){
 const page=new Element('section');page.id='page-applications';
 const grid=new Element();grid.className='rona-app-kpi-grid';page.append(grid);
 for(const type of ['new','work','decision','deal']){const c=new Element('section');c.className='rona-owner-card rona-app-kpi rona-app-kpi--'+type;grid.append(c)}
 const filter=new Element();filter.className='rona-app-filter';page.append(filter);
 const queue=new Element('section');queue.className='rona-app-table';page.append(queue);
 const title=new Element('h2');title.textContent='Рабочая очередь заявок';queue.append(title);
 const empty=new Element();empty.className='rona-owner-muted';empty.textContent='По выбранному фильтру заявок нет.';queue.append(empty);
 const accept=new Element('button');accept.textContent='Принять';
 const reject=new Element('button');reject.textContent='Отклонить';page.actions=[accept,reject];
 const head=new Element('head');
 let chosen='is-new';
 const document={
  head,__ronaApplicationsTotalBound:false,
  createElement:t=>new Element(t),
  addEventListener(){},
  querySelector(s){
   if(s==='#ronaApplicationsTotalKpiStyle')return head.children.find(x=>x.id==='ronaApplicationsTotalKpiStyle')||null;
   if(s==='#page-applications')return page;
   if(s==='#page-applications .rona-app-kpi-grid')return grid;
   if(s==='#page-applications .rona-app-filter button[aria-pressed="true"]'){
     const b=new Element('button');b.className=chosen;b.setAttribute('aria-pressed','true');return b
   }
   return null
  },
  querySelectorAll(s){return page.querySelectorAll(s)}
 };
 return{document,page,grid,queue,title,head,accept,reject,select:k=>{chosen=k}}
}
const row=(patch={})=>({
 business_contract:'RONA_APPLICATION_BUSINESS_V2',record_kind:'CLIENT_APPLICATION',retention_decision:'KEEP',
 owner_status:'NEW',status:'SUBMITTED',quantity_tonnes:10.25,client_id:'C-A',
 application_price:745,application_currency:'USD',price_is_agreed:false,price_source:'CLIENT_REQUESTED_PRICE',...patch
});
const fixture=[
 row(),
 row({owner_status:'ACCEPTED',status:'UNDER_REVIEW',quantity_tonnes:20,application_price:900}),
 row({owner_status:'REVIEW',status:'ACCEPTED',quantity_tonnes:null,client_id:'C-B',application_price:800}),
 row({owner_status:'SUPPLIER_PENDING',deal_status:'SUPPLIER_PENDING',quantity_tonnes:35,client_id:'C-B',application_price:800,price_is_agreed:true,price_source:'SUBMISSION_PRICE_SNAPSHOT'}),
 row({owner_status:'DEAL',deal_id:'DEAL-1',status:'DEAL_REGISTERED',quantity_tonnes:40,application_price:900,price_is_agreed:true,price_source:'APPROVED_APPLICATION_PRICE'}),
 row({owner_status:'REJECTED',status:'CANCELLED',quantity_tonnes:60,client_id:'C-C',application_price:950,application_currency:'EUR',price_is_agreed:true,price_source:'APPROVED_APPLICATION_PRICE'})
];
const currentSnapshot=rows=>({
 applications:rows,
 application_business_contract:'RONA_APPLICATION_BUSINESS_V2',
 application_kpi:{source:'RONA_APPLICATION_BUSINESS_V2',state:'READY',tonnage:5000,amounts:[{amount:4523675,currency:'USD'}]}
});
test('Real filter switches: quantity and currency-safe authoritative/provisional amounts, frozen title/actions',async()=>{
 const p=mockPage();
 const window={__RONA_OWNER_ADMIN_READY__:true,__RONA_OWNER_ADMIN_SNAPSHOT__:currentSnapshot(fixture),addEventListener(){}};
 const source=await(await onRequest()).text();
 const ctx=vm.createContext({window,document:p.document,queueMicrotask:f=>f(),requestAnimationFrame:f=>f(),setTimeout:()=>0,Intl});
 new vm.Script(source).runInContext(ctx);
 function summary(){
   const cards=p.grid.children.filter(x=>x.dataset.ronaAppTotal);
   assert.equal(cards.length,3,'Count, volume and amount must be three distinct selected-category KPI cards');
   const monetary=cards[2].children[1];
   return{
     count:cards[0].children[1].textContent,
     ton:cards[1].children[1].textContent,
     sum:(monetary.children.length?monetary.children.map(n=>n.textContent).join(' | '):monetary.textContent).replace(/[\u00a0\u202f]/g,' '),
     label:cards.map(x=>x.children[0].textContent),
     amountClass:cards[2].className,
     amountCaption:cards[2].children[2].textContent
   }
 }
 const names=category=>['Заявок · '+category,'Тоннаж · '+category,'Сумма · '+category];
 let current=summary();
 assert.equal(current.count,'1');assert.equal(current.ton,'10,25 т');
 assert.equal(current.sum,'7 636,25 USD');
 assert.deepEqual(current.label,names('Новые'));
 assert.match(current.amountClass,/rona-app-amount--estimated/);
 assert.match(current.amountCaption,/несогласованной ценой/);
 assert.match(p.page.querySelector('[data-rona-app-registry-note]').textContent,/Весь реестр \(без учёта фильтра\)/);
 assert.match(p.page.querySelector('[data-rona-app-registry-note]').textContent,/4\s?523\s?675 USD/);
 assert.equal(p.title.textContent,'Рабочая очередь заявок');
 assert.ok(p.accept.classList.contains('rona-app-action--approve'));
 assert.ok(p.reject.classList.contains('rona-app-action--reject'));
 assert.ok(source.includes('.rona-app-flow-step:nth-child(1){border-color:'));
 assert.ok(source.includes('.rona-app-filter{display:grid!important;grid-template-columns:repeat(4'));
 assert.ok(source.includes('.rona-app-table .rona-owner-table td:last-child button'));
 // Registered category sum must not depend on whole-registry KPI being ready.
 window.__RONA_OWNER_ADMIN_SNAPSHOT__={applications:fixture};
 current=summary();assert.equal(current.sum,'7 636,25 USD','Canonical row provenance permits scoped amount while aggregate KPI is pending');
 assert.match(p.page.querySelector('[data-rona-app-registry-note]').textContent,/итоги ещё не сформированы/);
 window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);

 p.select('is-work');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);
 current=summary();assert.equal(current.count,'2');
 assert.equal(current.ton,'—');
 assert.equal(current.sum,'—');
 assert.match(current.amountCaption,/отсутствует подтверждённая цена или объём/);

 p.select('is-decision');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);
 current=summary();assert.equal(current.count,'1');assert.equal(current.ton,'35 т');
 assert.equal(current.sum,'28 000,00 USD');assert.match(current.amountClass,/rona-app-amount--agreed/);

 p.select('is-completed');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);
 current=summary();assert.equal(current.count,'2');assert.equal(current.ton,'100 т');
 assert.equal(current.sum,'57 000,00 EUR | 36 000,00 USD','Different currencies must remain separate');
 window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot([row({owner_status:'SUPPLIER_APPROVED',status:'ACCEPTED',price_is_agreed:true})]);
 current=summary();assert.equal(current.count,'1','KPI bucket must match the actual released application2BBucket for SUPPLIER_APPROVED');
 assert.equal(current.sum,'7 636,25 USD');
 window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);
 assert.match(p.queue.querySelector('[data-rona-app-queue-context]').textContent,/Завершённые · 2 заявки/);

 p.select('is-new');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot([]);
 current=summary();assert.equal(current.count,'0');assert.equal(current.ton,'0 т');assert.equal(current.sum,'0');
 assert.match(p.queue.querySelector(':scope > .rona-owner-muted').textContent,/В категории «Новые» заявок нет/);
 assert.equal(p.title.textContent,'Рабочая очередь заявок');

 window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot([row({application_price:null,application_currency:null})]);
 current=summary();assert.equal(current.sum,'—','Missing negotiated price must not fabricate a total');
 window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot([row({retention_decision:'REVIEW'})]);
 current=summary();assert.equal(current.sum,'—','Unresolved retention source blocks amount');
 window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot([row({application_price:0})]);
 current=summary();assert.equal(current.sum,'—','Zero price is not a legitimate authoritative price');

 p.select('is-decision');window.__RONA_OWNER_ADMIN_SNAPSHOT__={application_business_contract:null,applications:null};
 current=summary();assert.equal(current.count,'—');assert.equal(current.ton,'—');assert.equal(current.sum,'—');
 assert.equal(p.head.children.filter(x=>x.id==='ronaApplicationsTotalKpiStyle').length,1,'Style must remain singleton');
 // A legacy list without row-level provenance is not sufficient evidence of an agreed amount.
 p.select('is-new');window.__RONA_OWNER_ADMIN_SNAPSHOT__={applications:[{owner_status:'NEW',quantity_tonnes:10,application_price:745,application_currency:'USD'}]};
 current=summary();assert.equal(current.sum,'—','Unverified legacy rows must never produce a trusted amount');
});

function shownAmount(page){
 const cards=page.grid.children.filter(x=>x.dataset.ronaAppTotal);
 assert.equal(cards.length,3);
 const host=cards[2].children[1];
 return (host.children.length?host.children.map(c=>c.textContent).join(' | '):host.textContent).replace(/[\u00a0\u202f]/g,' ');
}
function signedCanonicalFixture(){
 return fixture.map((a,i)=>({...a,application_id:'SCOPE-IN-2026-'+String(i+1).padStart(3,'0')}));
}
function unauthoritativeMirror(canonical){
 return {applications:canonical.map(({business_contract,record_kind,retention_decision,...legacy})=>legacy)};
}
function responseFor(payload,{ok=true}={}){
 return {ok,headers:{get:name=>name==='x-rona-application-business'?'RONA_APPLICATION_BUSINESS_V2':null},
   json:async()=>({ok:true,data:payload})};
}
test('Signed-in Admin fallback: incomplete first snapshot securely hydrates matching selected-category totals exactly once',async()=>{
 const p=mockPage();p.select('is-decision');p.document.visibilityState='visible';
 const canonical=signedCanonicalFixture(),legacy=unauthoritativeMirror(canonical),requests=[];
 const fetch=(url,options)=>{
   requests.push({url,options});
   return Promise.resolve(responseFor(currentSnapshot(canonical)));
 };
 const window={__RONA_OWNER_ADMIN_READY__:true,__RONA_OWNER_ADMIN_SNAPSHOT__:legacy,addEventListener(){}};
 const source=await(await onRequest()).text();
 const ctx=vm.createContext({window,document:p.document,location:{pathname:'/portal/admin'},fetch,queueMicrotask:f=>f(),requestAnimationFrame:f=>f(),setTimeout:()=>0,Intl});
 new vm.Script(source).runInContext(ctx);
 assert.equal(shownAmount(p),'…','Never show a definitive empty amount while canonical source is pending');
 assert.equal(requests.length,1,'One bounded supplemental read per stale bootstrap');
 assert.equal(requests[0].url,'/portal/admin-completed-bootstrap');
 assert.equal(requests[0].options.method,'GET');
 assert.equal(requests[0].options.credentials,'same-origin');
 assert.equal(requests[0].options.cache,'no-store');
 assert.ok(!('body' in requests[0].options),'Read-only request must never mutate');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(shownAmount(p),'28 000,00 USD','Real money from matching authoritative DECISION applications');
 assert.match(p.page.querySelector('[data-rona-app-registry-note]').textContent,/Весь реестр/);
 assert.equal(requests.length,1,'No fetch loop after hydration');
 p.select('is-completed');window.__RONA_OWNER_ADMIN_SNAPSHOT__=legacy;
 assert.equal(shownAmount(p),'57 000,00 EUR | 36 000,00 USD');
 assert.equal(requests.length,1,'Filter changes reuse validated same-source snapshot without network fanout');
 assert.equal(p.title.textContent,'Рабочая очередь заявок');
});
test('Source mismatch, failed canonical HTTP and unauthenticated context cannot fabricate application amounts',async()=>{
 const canonical=signedCanonicalFixture();
 for(const mode of ['WRONG_IDENTITIES','HTTP_UNAUTHORIZED','NOT_ON_ADMIN']){
   const p=mockPage();p.select('is-decision');p.document.visibilityState='visible';
   const legacy=unauthoritativeMirror(canonical);
   const window={__RONA_OWNER_ADMIN_READY__:true,__RONA_OWNER_ADMIN_SNAPSHOT__:legacy,addEventListener(){}};
   let calls=0;
   const fetch=()=>{calls++;return Promise.resolve(mode==='HTTP_UNAUTHORIZED'?
     responseFor(null,{ok:false}):
     responseFor(currentSnapshot(canonical.map((a,i)=>i===0?{...a,application_id:'OTHER-IN-2026-999'}:a))))};
   const script=await(await onRequest()).text();
   const ctx=vm.createContext({window,document:p.document,location:{pathname:mode==='NOT_ON_ADMIN'?'/portal/client':'/portal/admin'},fetch,queueMicrotask:f=>f(),requestAnimationFrame:f=>f(),setTimeout:()=>0,Intl});
   new vm.Script(script).runInContext(ctx);
   await new Promise(resolve=>setImmediate(resolve));
   assert.equal(shownAmount(p),'—','Fail closed: '+mode);
   assert.equal(calls,mode==='NOT_ON_ADMIN'?0:1,'Only authorized Admin page may request read: '+mode);
 }
});
