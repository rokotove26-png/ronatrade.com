(()=>{'use strict';
if(window.__RONA_CLIENT_PRICE_SYNC_V1__)return;
window.__RONA_CLIENT_PRICE_SYNC_V1__='20260902-authoritative-price-current-context-server-projection';

const API='/portal/api';
const PRICE_TTL=15000;
const state={context:null,prices:[],loading:false,renderSignature:'',refreshTimer:0,lastRefresh:0,priceLoadedAt:0,priceContextKey:'',priceSeq:0,refreshPending:false,renderQueued:false,observer:null,unsubscribe:null};
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
function contextAuthority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const authority=contextAuthority();if(!authority)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');return authority.getCurrentContext()||await authority.whenReady()}
function contextKey(ctx){return `${ctx?.client_id||''}|${ctx?.contract_id||''}`}

function findPriceTable(){
  return Array.from(document.querySelectorAll('table')).find(table=>{
    const text=norm(table.querySelector('thead')?.textContent||table.textContent);
    return text.includes('продукт')&&(text.includes('класс')||text.includes('производитель')||text.includes('cpt озинки')||text.includes('cpt сарыагаш')||text.includes('cpt наушки'));
  })||null;
}
function uniqueBases(){const out=[];for(const item of state.prices){const basis=String(item.basis||'').trim();if(basis&&!out.includes(basis))out.push(basis)}return out}
function groupedProducts(){const map=new Map();for(const item of state.prices){const key=String(item.product||'').trim();if(!map.has(key))map.set(key,[]);map.get(key).push(item)}return [...map.entries()]}
function productLabel(product){return String(product||'').trim()}
function producerLabel(items){const values=[...new Set((items||[]).map(x=>String(x.producer||'').trim()).filter(Boolean))];return values.length?values.join(' / '):'—'}
function priceText(item){const value=num(item.price);const price=value===null?String(item.price||'—'):new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);return `${price} ${String(item.currency||'')}/т`}

function statusScope(){const labels=Array.from(document.querySelectorAll('div,p,span,strong,small'));const anchor=labels.find(el=>norm(el.textContent)==='прайс-лист');return anchor?.closest('section,article,.card,.panel')||anchor?.parentElement?.parentElement||document}
function syncPublicationStatus(){
  if(!state.prices.length)return;
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
  const signature=['server-authoritative-current-context',state.context?.client_id||'',state.context?.contract_id||'',...state.prices.map(x=>[x.publication_item_id,x.publication_id,x.product,x.basis,x.price,x.currency,x.producer,x.supplier].join(':'))].join('|');
  if(table.dataset.ronaPriceSyncSignature===signature){syncPublicationStatus();return true}
  Object.assign(table.style,{fontSize:'16px',lineHeight:'1.35',tableLayout:'auto'});
  const head=table.tHead?.rows?.[0]||table.querySelector('thead tr');
  if(head){head.textContent='';['№','Продукт','Производитель',...bases].forEach((value,index)=>{const th=document.createElement('th');th.textContent=value;styleHeadCell(th,index);head.appendChild(th)})}
  let body=table.tBodies?.[0]||table.querySelector('tbody');if(!body){body=document.createElement('tbody');table.appendChild(body)}body.textContent='';
  groupedProducts().forEach(([product,items],index)=>{const row=document.createElement('tr');[String(index+1),productLabel(product),producerLabel(items)].forEach((value,cellIndex)=>{const cell=document.createElement('td');cell.textContent=value;styleBodyCell(cell,cellIndex);row.appendChild(cell)});for(const basis of bases){const cell=document.createElement('td');styleBodyCell(cell,row.children.length);const item=items.find(x=>String(x.basis||'').trim()===basis);if(item)cell.appendChild(makePriceButton(item));else cell.textContent='—';row.appendChild(cell)}body.appendChild(row)});
  table.dataset.ronaPriceSyncSignature=signature;state.renderSignature=signature;syncPublicationStatus();return true;
}

function clearPriceState(){state.prices=[];state.priceContextKey='';state.priceLoadedAt=0;state.renderSignature='';window.__RONA_CLIENT_PRICE_SYNC_STATE__={context:state.context,prices:[],authority:'SERVER_AUTHORITATIVE_PRICE_PROJECTION',loadedAt:null}}
function publishPriceState(next,source){state.prices=Array.isArray(source)?source:[];state.priceContextKey=contextKey(next);state.priceLoadedAt=Date.now();window.__RONA_CLIENT_PRICE_SYNC_STATE__={context:next,prices:state.prices,authority:'SERVER_AUTHORITATIVE_PRICE_PROJECTION',loadedAt:new Date().toISOString()}}
async function loadPrices(next,force=false){
  const key=contextKey(next);
  if(!force&&state.prices.length&&state.priceContextKey===key&&Date.now()-state.priceLoadedAt<PRICE_TTL){render();return}
  const seq=++state.priceSeq;
  const result=await request('/v1/client/prices?clientId='+encodeURIComponent(next.client_id)+'&contractId='+encodeURIComponent(next.contract_id));
  if(seq!==state.priceSeq||contextKey(state.context)!==key||contextKey(contextAuthority()?.getCurrentContext())!==key)return;
  publishPriceState(next,result?.prices);
}

async function refresh(forcePrices=false){
  if(state.loading){state.refreshPending=true;render();return}
  state.loading=true;
  try{
    ensureContractDownloadRuntime();
    const next=await currentContext();
    if(!next){if(state.context){state.context=null;state.priceSeq++;clearPriceState()}return}
    const changed=contextKey(state.context)!==contextKey(next);state.context=next;
    if(changed){state.priceSeq++;clearPriceState()}
    await loadPrices(next,changed||forcePrices||!state.prices.length);
    state.lastRefresh=Date.now();render();
  }catch(error){console.error('RONA client price sync',error)}finally{
    state.loading=false;
    if(state.refreshPending){state.refreshPending=false;queueMicrotask(()=>refresh(false))}
  }
}
function queueRender(){if(state.renderQueued||!state.prices.length)return;state.renderQueued=true;requestAnimationFrame(()=>{state.renderQueued=false;render()})}
function observePriceMount(){if(state.observer||!document.body)return;state.observer=new MutationObserver(()=>queueRender());state.observer.observe(document.body,{childList:true,subtree:true})}
function isPriceInteraction(target){const el=target?.closest?.('button,[role="button"],[role="tab"],a');if(!el)return false;const text=[norm(el.textContent),norm(el.getAttribute?.('aria-label')),norm(el.getAttribute?.('title'))].join(' ');return text.includes('цены')||text.includes('прайс')}
function scheduleRefresh(forcePrices=false){clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(()=>refresh(forcePrices),80)}
function maybeRefresh(event){if(isPriceInteraction(event.target)){queueRender();if(Date.now()-state.priceLoadedAt>PRICE_TTL)scheduleRefresh(false)}}

function start(){
  observePriceMount();
  const authority=contextAuthority();
  if(!authority){console.error('RONA client price sync: context authority unavailable');return}
  state.unsubscribe=authority.subscribe(ctx=>{const changed=contextKey(state.context)!==contextKey(ctx);state.context=ctx||null;if(changed){state.priceSeq++;clearPriceState()}scheduleRefresh(true)});
  refresh(true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else queueMicrotask(start);
document.addEventListener('click',maybeRefresh,true);
document.addEventListener('change',maybeRefresh,true);
window.addEventListener('pageshow',()=>{queueRender();if(Date.now()-state.lastRefresh>PRICE_TTL)refresh(false)});
setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},30000);
})();
