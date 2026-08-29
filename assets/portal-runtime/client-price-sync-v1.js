(()=>{'use strict';
if(window.__RONA_CLIENT_PRICE_SYNC_V1__)return;
window.__RONA_CLIENT_PRICE_SYNC_V1__='20260830-authoritative-price-v10-parallel-prefetch';

const API='/portal/api';
const BOOTSTRAP_TTL=30000;
const PRICE_TTL=15000;
const CLIENT_ID_RE=/\bRONA-C\d{3}\b/;
const CONTRACT_ID_RE=/\bRONA-C\d{3}-CTR-\d{4}-\d{3,}\b/;
const state={contexts:[],context:null,prices:[],priceAuthority:new Map(),loading:false,renderSignature:'',refreshTimer:0,lastRefresh:0,bootstrapAt:0,bootstrapPromise:null,priceLoadedAt:0,priceContextKey:'',priceSeq:0,refreshPending:false,renderQueued:false,observer:null,prefetchKey:'',prefetchPromise:null};
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};

function ensureContractDownloadRuntime(){
  if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__||window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V2__||window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__||document.getElementById('rona-client-contract-download-v3-fallback'))return;
  const script=document.createElement('script');
  script.id='rona-client-contract-download-v3-fallback';
  script.src='/assets/portal-runtime/client-contract-download-v3.js?v=20260829-authoritative-context-v3';
  script.defer=true;
  (document.head||document.documentElement).appendChild(script);
}
ensureContractDownloadRuntime();

async function request(path,init={}){
  const headers={accept:'application/json',...(init.headers||{})};
  const response=await fetch(API+path,{credentials:'same-origin',cache:'no-store',...init,headers});
  const body=await response.json().catch(()=>null);
  if(!response.ok||body?.ok===false)throw new Error(String(body?.code||body?.error?.code||('HTTP_'+response.status)));
  return body;
}

function visible(el){
  if(!el||!el.isConnected)return false;
  const s=getComputedStyle(el);
  if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0;
}

function currentControlTexts(){
  const selector='button,[role="button"],select,option:checked,[aria-selected="true"],[data-active="true"],.active,.selected,[class*="company"],[class*="contract"],[data-client-id],[data-contract-id]';
  return Array.from(document.querySelectorAll(selector)).filter(visible).map(el=>norm(el.textContent||el.value)).filter(Boolean);
}

function chooseContext(contexts){
  if(!contexts.length)return null;
  const texts=currentControlTexts();
  let best=contexts[0],bestScore=-1;
  for(const ctx of contexts){
    const keys=[ctx.legal_name,ctx.current_external_contract_number,ctx.contract_id,ctx.client_id].map(norm).filter(Boolean);
    let score=0;
    for(const text of texts){
      keys.forEach((key,index)=>{if(key&&text.includes(key))score+=index===0?9:index===1?8:index===2?5:3});
    }
    if(score>bestScore){bestScore=score;best=ctx}
  }
  return best;
}

function contextKey(ctx){return `${ctx?.client_id||''}|${ctx?.contract_id||''}`}
function domContextHint(){
  const scopes=[document.querySelector('header'),document.querySelector('.topbar'),document.querySelector('[class*="topbar"]'),document.querySelector('[class*="header"]'),document.body].filter(Boolean);
  for(const scope of scopes){const raw=String(scope.innerText||scope.textContent||'');const contract=raw.match(CONTRACT_ID_RE)?.[0]||'';const client=raw.match(CLIENT_ID_RE)?.[0]||'';if(client&&contract)return{client_id:client,contract_id:contract}}
  return null;
}
function prefetchPrices(hint){
  if(!hint)return null;const key=contextKey(hint);if(!key||key==='|')return null;
  if(state.prefetchKey===key&&state.prefetchPromise)return state.prefetchPromise;
  state.prefetchKey=key;
  state.prefetchPromise=request('/v1/client/prices?clientId='+encodeURIComponent(hint.client_id)+'&contractId='+encodeURIComponent(hint.contract_id)).catch(()=>null).finally(()=>{setTimeout(()=>{if(state.prefetchKey===key){state.prefetchKey='';state.prefetchPromise=null}},1000)});
  return state.prefetchPromise;
}

function findPriceTable(){
  return Array.from(document.querySelectorAll('table')).find(table=>{
    const text=norm(table.querySelector('thead')?.textContent||table.textContent);
    return text.includes('продукт')&&(text.includes('класс')||text.includes('производитель')||text.includes('cpt озинки')||text.includes('cpt сарыагаш')||text.includes('cpt наушки'));
  })||null;
}

function uniqueBases(){
  const out=[];
  for(const item of state.prices){const basis=String(item.basis||'').trim();if(basis&&!out.includes(basis))out.push(basis)}
  return out;
}

function groupedProducts(){
  const map=new Map();
  for(const item of state.prices){const key=String(item.product||'').trim();if(!map.has(key))map.set(key,[]);map.get(key).push(item)}
  return [...map.entries()];
}

function productLabel(product){return String(product||'').trim()}
function producerLabel(items){
  const values=[...new Set((items||[]).map(x=>String(x.producer||'').trim()).filter(Boolean))];
  return values.length?values.join(' / '):'—';
}
function priceText(item){
  const value=num(item.price);
  const price=value===null?String(item.price||'—'):new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  return `${price} ${String(item.currency||'')}/т`;
}

function authorityIsPublished(a){
  if(!a)return false;
  const pub=String(a.publication_status||'').toUpperCase(),pa=String(a.publication_authority_state||'').toUpperCase(),pl=String(a.publication_lifecycle_state||'').toUpperCase();
  const ia=String(a.item_authority_state||'').toUpperCase(),il=String(a.item_lifecycle_state||'').toUpperCase(),bs=String(a.business_status||'').toUpperCase();
  return pub==='PUBLISHED'&&['CONFIRMED','VERIFIED'].includes(pa)&&pl==='ACTIVE'&&['CONFIRMED','VERIFIED'].includes(ia)&&il==='ACTIVE'&&bs==='PUBLISHED'&&a.publish_client===true;
}
function authoritativeItem(item){
  const id=String(item?.publication_item_id||''),a=state.priceAuthority.get(id);
  if(!authorityIsPublished(a))return null;
  if(String(a.publication_id||'')!==String(item.publication_id||''))return null;
  const sourcePrice=num(item.price),snapshotPrice=num(a.snapshot_price);
  if(sourcePrice===null||snapshotPrice===null||Math.abs(sourcePrice-snapshotPrice)>.00001)return null;
  if(String(item.currency||'').toUpperCase()!==String(a.snapshot_currency||'').toUpperCase())return null;
  return {...item,producer:String(a.producer||'').trim()||null,supplier:String(a.supplier||'').trim()||null,authority:a};
}

function statusScope(){
  const labels=Array.from(document.querySelectorAll('div,p,span,strong,small'));
  const anchor=labels.find(el=>norm(el.textContent)==='прайс-лист');
  return anchor?.closest('section,article,.card,.panel')||anchor?.parentElement?.parentElement||document;
}
function syncPublicationStatus(){
  if(!state.prices.length||!state.prices.every(x=>authorityIsPublished(x.authority)))return;
  const scope=statusScope();
  for(const el of Array.from(scope.querySelectorAll('span,div,small,strong'))){
    const value=norm(el.textContent);
    if(value==='ожидает публикации'||value==='ожидает публикацию'||value==='опубликовано'){
      if(el.textContent!=='Опубликовано')el.textContent='Опубликовано';
      if(el.dataset.ronaPriceSyncStatus!=='published-authoritative')el.dataset.ronaPriceSyncStatus='published-authoritative';
    }
  }
}

function ensurePriceInteractionStyle(){
  if(document.getElementById('ronaClientPriceInteractionV1'))return;
  const style=document.createElement('style');style.id='ronaClientPriceInteractionV1';
  style.textContent=`
button[data-rona-price-item]{border:1px solid transparent!important;border-radius:9px!important;padding:7px 10px!important;transition:background-color .14s ease,border-color .14s ease,color .14s ease,box-shadow .14s ease,transform .14s ease!important;outline:none!important}
@media (hover:hover) and (pointer:fine){button[data-rona-price-item]:hover{background:rgba(101,217,255,.11)!important;border-color:rgba(101,217,255,.58)!important;color:#c9f5ff!important;box-shadow:inset 0 0 0 1px rgba(101,217,255,.08),0 0 16px rgba(101,217,255,.10)!important;transform:translateY(-1px)!important}}
button[data-rona-price-item]:focus-visible{background:rgba(101,217,255,.12)!important;border-color:rgba(101,217,255,.72)!important;color:#d9f9ff!important;box-shadow:0 0 0 2px rgba(101,217,255,.18)!important}
button[data-rona-price-item]:active{background:rgba(101,217,255,.17)!important;border-color:rgba(101,217,255,.78)!important;transform:translateY(0)!important}
@media (prefers-reduced-motion:reduce){button[data-rona-price-item]{transition:none!important;transform:none!important}}
`;
  document.head.appendChild(style);
}
function styleHeadCell(cell,index){Object.assign(cell.style,{fontSize:'15px',lineHeight:'1.25',fontWeight:'800',padding:'14px 12px',verticalAlign:'middle',whiteSpace:'nowrap'});if(index===0)cell.style.width='52px';if(index===1)cell.style.minWidth='180px';if(index===2)cell.style.minWidth='210px'}
function styleBodyCell(cell,index){Object.assign(cell.style,{fontSize:'16px',lineHeight:'1.35',fontWeight:index===0?'650':'700',padding:'15px 12px',verticalAlign:'middle'});if(index===0){cell.style.width='52px';cell.style.whiteSpace='nowrap'}if(index>=3)cell.style.whiteSpace='nowrap'}
function makePriceButton(item){
  ensurePriceInteractionStyle();const button=document.createElement('button');button.type='button';button.dataset.ronaPriceItem=String(item.publication_item_id||'');button.textContent=priceText(item);button.title='Нажмите, чтобы подать заявку по этой цене';button.setAttribute('aria-label',`Подать заявку: ${productLabel(item.product)}, ${item.basis}, ${priceText(item)}`);Object.assign(button.style,{appearance:'none',border:'1px solid transparent',background:'transparent',padding:'7px 10px',margin:'0',color:'inherit',fontFamily:'inherit',fontSize:'16px',lineHeight:'1.35',fontWeight:'800',cursor:'pointer',width:'100%',textAlign:'left',whiteSpace:'nowrap'});return button;
}

function render(){
  if(!state.prices.length)return false;const table=findPriceTable();if(!table)return false;
  const bases=uniqueBases();
  const signature=['admin-authority-v10',state.context?.client_id||'',state.context?.contract_id||'',...state.prices.map(x=>[x.publication_item_id,x.publication_id,x.product,x.basis,x.price,x.currency,x.producer,x.supplier,x.authority?.updated_at].join(':'))].join('|');
  if(table.dataset.ronaPriceSyncSignature===signature){syncPublicationStatus();return true}
  Object.assign(table.style,{fontSize:'16px',lineHeight:'1.35',tableLayout:'auto'});
  const head=table.tHead?.rows?.[0]||table.querySelector('thead tr');
  if(head){head.textContent='';['№','Продукт','Производитель',...bases].forEach((value,index)=>{const th=document.createElement('th');th.textContent=value;styleHeadCell(th,index);head.appendChild(th)})}
  let body=table.tBodies?.[0]||table.querySelector('tbody');if(!body){body=document.createElement('tbody');table.appendChild(body)}body.textContent='';
  groupedProducts().forEach(([product,items],index)=>{const row=document.createElement('tr');[String(index+1),productLabel(product),producerLabel(items)].forEach((value,cellIndex)=>{const cell=document.createElement('td');cell.textContent=value;styleBodyCell(cell,cellIndex);row.appendChild(cell)});for(const basis of bases){const cell=document.createElement('td');styleBodyCell(cell,row.children.length);const item=items.find(x=>String(x.basis||'').trim()===basis);if(item)cell.appendChild(makePriceButton(item));else cell.textContent='—';row.appendChild(cell)}body.appendChild(row)});
  table.dataset.ronaPriceSyncSignature=signature;state.renderSignature=signature;syncPublicationStatus();return true;
}

async function loadBootstrap(force=false){
  const now=Date.now();
  if(!force&&state.contexts.length&&now-state.bootstrapAt<BOOTSTRAP_TTL)return;
  if(state.bootstrapPromise)return state.bootstrapPromise;
  state.bootstrapPromise=(async()=>{
    const boot=await request('/v1/client/bootstrap'),data=boot?.data||{};
    state.contexts=Array.isArray(data.contexts)?data.contexts:[];
    state.priceAuthority=new Map((Array.isArray(data.price_authority)?data.price_authority:[]).map(x=>[String(x.publication_item_id||''),x]).filter(x=>x[0]));
    state.bootstrapAt=Date.now();
  })().finally(()=>{state.bootstrapPromise=null});
  return state.bootstrapPromise;
}

function clearPriceState(){
  state.prices=[];
  state.priceContextKey='';
  state.priceLoadedAt=0;
  state.renderSignature='';
  window.__RONA_CLIENT_PRICE_SYNC_STATE__={context:state.context,prices:[],authority:'ADMIN_PUBLISHED_PRICE_SNAPSHOT',loadedAt:null};
}

function publishPriceState(next,source){
  const accepted=[],rejected=[];
  for(const item of source){const verified=authoritativeItem(item);if(verified)accepted.push(verified);else rejected.push(String(item?.publication_item_id||''))}
  state.prices=accepted;
  state.priceContextKey=contextKey(next);
  state.priceLoadedAt=Date.now();
  if(rejected.length)console.error('RONA client price authority mismatch',{rejected});
  window.__RONA_CLIENT_PRICE_SYNC_STATE__={context:next,prices:state.prices,authority:'ADMIN_PUBLISHED_PRICE_SNAPSHOT',loadedAt:new Date().toISOString()};
}

async function loadPrices(next,force=false,prefetched=null){
  const key=contextKey(next);
  if(!force&&state.prices.length&&state.priceContextKey===key&&Date.now()-state.priceLoadedAt<PRICE_TTL){render();return}
  const seq=++state.priceSeq;
  const result=prefetched||await request('/v1/client/prices?clientId='+encodeURIComponent(next.client_id)+'&contractId='+encodeURIComponent(next.contract_id));
  if(seq!==state.priceSeq||contextKey(state.context)!==key)return;
  publishPriceState(next,Array.isArray(result?.prices)?result.prices:[]);
}

async function refresh(forcePrices=false,forceBootstrap=false){
  if(state.loading){state.refreshPending=true;render();return}
  state.loading=true;
  try{
    ensureContractDownloadRuntime();
    const hint=!state.contexts.length?domContextHint():null;
    const warm=hint?prefetchPrices(hint):null;
    await loadBootstrap(forceBootstrap);
    const next=chooseContext(state.contexts);if(!next)throw new Error('CLIENT_CONTEXT_NOT_FOUND');
    const changed=contextKey(state.context)!==contextKey(next);state.context=next;
    if(changed){state.priceSeq++;clearPriceState()}
    let prefetched=null;
    if(warm&&contextKey(hint)===contextKey(next))prefetched=await warm;
    await loadPrices(next,changed||forcePrices||!state.prices.length,prefetched);
    state.lastRefresh=Date.now();render();
  }catch(error){console.error('RONA client price sync',error)}finally{
    state.loading=false;
    if(state.refreshPending){state.refreshPending=false;queueMicrotask(()=>refresh(false,false))}
  }
}

function queueRender(){
  if(state.renderQueued||!state.prices.length)return;
  state.renderQueued=true;
  requestAnimationFrame(()=>{state.renderQueued=false;render()});
}

function observePriceMount(){
  if(state.observer||!document.body)return;
  state.observer=new MutationObserver(()=>queueRender());
  state.observer.observe(document.body,{childList:true,subtree:true});
}

function isContextInteraction(target){
  const el=target?.closest?.('select,[data-client-id],[data-contract-id],[class*="company"],[class*="contract"],button,[role="button"],[role="tab"]');if(!el)return false;
  if(el.matches('select,[data-client-id],[data-contract-id],[class*="company"],[class*="contract"]'))return true;
  const t=norm(el.textContent),aria=norm(el.getAttribute?.('aria-label')),title=norm(el.getAttribute?.('title'));
  return state.contexts.some(ctx=>[ctx.legal_name,ctx.current_external_contract_number,ctx.contract_id,ctx.client_id].map(norm).filter(Boolean).some(k=>(t&&t.includes(k))||(aria&&aria.includes(k))||(title&&title.includes(k))));
}
function isPriceInteraction(target){
  const el=target?.closest?.('button,[role="button"],[role="tab"],a');if(!el)return false;
  const text=[norm(el.textContent),norm(el.getAttribute?.('aria-label')),norm(el.getAttribute?.('title'))].join(' ');
  return text.includes('цены')||text.includes('прайс');
}
function scheduleRefresh(forcePrices=false){clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(()=>refresh(forcePrices,false),80)}
function maybeRefresh(event){
  if(isContextInteraction(event.target)){scheduleRefresh(false);return}
  if(isPriceInteraction(event.target)){queueRender();if(Date.now()-state.priceLoadedAt>PRICE_TTL)scheduleRefresh(false)}
}

function start(){observePriceMount();refresh(true,false)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
document.addEventListener('click',maybeRefresh,true);
document.addEventListener('change',maybeRefresh,true);
window.addEventListener('pageshow',()=>{queueRender();if(Date.now()-state.lastRefresh>PRICE_TTL)refresh(false,false)});
setInterval(()=>{if(document.visibilityState==='visible')refresh(false,false)},30000);
})();