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
  assert.doesNotMatch(source,/fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|localStorage|innerHTML\s*=/);
  assert.doesNotMatch(source,/#page-(home|deals|access|prices|payments|analytics)\b/);
  assert.doesNotMatch(source,/(document\.querySelector\(['"]h1['"]\)|\.topbar|\.page-title|data-rona-title)/);
  for(const stage of ['is-new','is-work','is-decision','is-completed'])assert.match(source,new RegExp('button\\.'+stage));
  for(const style of ['rona-fin-pill--danger','rona-app-action--approve','rona-app-action--reject','rona-app-action--offer',':focus-visible','prefers-reduced-motion'])assert.ok(source.includes(style),style);
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
    if(s==='.rona-app-table .rona-owner-actions button')return this.actions||[];
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
const fixture=[
 {owner_status:'NEW',status:'SUBMITTED',quantity_tonnes:10.25,client_id:'C-A'},
 {owner_status:'ACCEPTED',status:'UNDER_REVIEW',quantity_tonnes:20,client_id:'C-A'},
 {owner_status:'SUPPLIER_APPROVED',status:'ACCEPTED',quantity_tonnes:null,client_id:'C-B'},
 {owner_status:'SUPPLIER_PENDING',deal_status:'SUPPLIER_PENDING',quantity_tonnes:35,client_id:'C-B'},
 {owner_status:'DEAL',deal_id:'DEAL-1',status:'DEAL_REGISTERED',quantity_tonnes:40,client_id:'C-A'},
 {owner_status:'REJECTED',status:'CANCELLED',quantity_tonnes:60,client_id:'C-C'}
];
const currentSnapshot=rows=>({
 applications:rows,
 application_business_contract:'RONA_APPLICATION_BUSINESS_V2',
 application_kpi:{source:'RONA_APPLICATION_BUSINESS_V2',state:'READY',tonnage:5000,amounts:[{amount:4523675,currency:'USD'}]}
});
test('Real filter switch recalculates context cards without inventing metrics, altering title, or touching actions',async()=>{
 const p=mockPage();
 const window={__RONA_OWNER_ADMIN_READY__:true,__RONA_OWNER_ADMIN_SNAPSHOT__:currentSnapshot(fixture),addEventListener(){}};
 const source=await(await onRequest()).text();
 const ctx=vm.createContext({window,document:p.document,queueMicrotask:f=>f(),requestAnimationFrame:f=>f(),setTimeout:()=>0,Intl});
 new vm.Script(source).runInContext(ctx);
 function summary(){
   const cards=p.grid.children.filter(x=>x.dataset.ronaAppTotal);
   assert.equal(cards.length,2,'There must be exactly two context KPI cards');
   return{count:cards[0].children[1].textContent,ton:cards[1].children[1].textContent,labels:cards.map(x=>x.children[0].textContent)}
 }
 assert.deepEqual(summary(),{count:'1',ton:'10,25 т',labels:['Заявок · Новые','Тоннаж · Новые']});
 assert.match(p.page.querySelector('[data-rona-app-registry-note]').textContent,/Весь реестр \(без учёта фильтра\)/);
 assert.match(p.page.querySelector('[data-rona-app-registry-note]').textContent,/4\s?523\s?675 USD/);
 assert.equal(p.title.textContent,'Рабочая очередь заявок');
 assert.ok(p.accept.classList.contains('rona-app-action--approve'));
 assert.ok(p.reject.classList.contains('rona-app-action--reject'));
 p.select('is-work');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);
 assert.deepEqual(summary(),{count:'2',ton:'—',labels:['Заявок · В работе','Тоннаж · В работе']},'Incomplete per-row volume must remain unknown');
 p.select('is-decision');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);
 assert.equal(summary().count,'1');
 assert.equal(summary().ton,'35 т');
 p.select('is-completed');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot(fixture);
 assert.equal(summary().count,'2');
 assert.equal(summary().ton,'100 т');
 assert.match(p.queue.querySelector('[data-rona-app-queue-context]').textContent,/Завершённые · 2 заявок/);
 p.select('is-new');window.__RONA_OWNER_ADMIN_SNAPSHOT__=currentSnapshot([]);
 assert.equal(summary().count,'0');
 assert.equal(summary().ton,'0 т');
 assert.match(p.queue.querySelector(':scope > .rona-owner-muted').textContent,/В категории «Новые» заявок нет/);
 assert.equal(p.title.textContent,'Рабочая очередь заявок');
 p.select('is-decision');window.__RONA_OWNER_ADMIN_SNAPSHOT__={application_business_contract:null,applications:null};
 assert.equal(summary().count,'—','Unloaded source may not be represented as zero');
 assert.equal(summary().ton,'—');
 assert.equal(p.head.children.filter(x=>x.id==='ronaApplicationsTotalKpiStyle').length,1,'Style must remain singleton');
});
