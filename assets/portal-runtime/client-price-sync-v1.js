(()=>{'use strict';
if(window.__RONA_CLIENT_PRICE_SYNC_V1__)return;
window.__RONA_CLIENT_PRICE_SYNC_V1__='20260828-safe-v6-contract-download-v2';

const API='/portal/api';
const state={contexts:[],context:null,prices:[],loading:false,renderSignature:'',refreshTimer:0};
const ADMIN_PRODUCER_BY_PRODUCT=new Map([
  ['АИ-92 К5','ОАО «Мозырский НПЗ»'],
  ['АИ-95 К5','ОАО «Мозырский НПЗ»'],
  ['ДТ сорт C К5','ОАО «Мозырский НПЗ»'],
  ['СУГ / СПБТ','ОАО «Мозырский НПЗ»'],
]);
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};

function ensureContractDownloadRuntime(){
  if(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V1__||document.getElementById('rona-client-contract-download-loader'))return;
  const script=document.createElement('script');
  script.id='rona-client-contract-download-loader';
  script.src='/assets/portal-runtime/client-contract-download-v1.js?v=20260828-secure-current-contract-v2';
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
  const selector='button,[role="button"],select,option:checked,[aria-selected="true"],[data-active="true"],.active,.selected,[class*="company"],[class*="contract"]';
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

function findPriceTable(){
  return Array.from(document.querySelectorAll('table')).find(table=>{
    const text=norm(table.querySelector('thead')?.textContent||table.textContent);
    return text.includes('продукт')&&(text.includes('класс')||text.includes('производитель')||text.includes('cpt озинки')||text.includes('cpt сарыагаш')||text.includes('cpt наушки'));
  })||null;
}

function uniqueBases(){
  const out=[];
  for(const item of state.prices){
    const basis=String(item.basis||'').trim();
    if(basis&&!out.includes(basis))out.push(basis);
  }
  return out;
}

function groupedProducts(){
  const map=new Map();
  for(const item of state.prices){
    const key=String(item.product||'').trim();
    if(!map.has(key))map.set(key,[]);
    map.get(key).push(item);
  }
  return [...map.entries()];
}

function productLabel(product){return String(product||'').trim()}
function producerLabel(product){return ADMIN_PRODUCER_BY_PRODUCT.get(String(product||'').trim())||'—'}
function priceText(item){
  const value=num(item.price);
  const price=value===null?String(item.price||'—'):new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  return `${price} ${String(item.currency||'')}/т`;
}

function statusScope(){
  const labels=Array.from(document.querySelectorAll('div,p,span,strong,small'));
  const anchor=labels.find(el=>norm(el.textContent)==='прайс-лист');
  return anchor?.closest('section,article,.card,.panel')||anchor?.parentElement?.parentElement||document;
}

function markPublished(){
  const scope=statusScope();
  for(const el of Array.from(scope.querySelectorAll('span,div,small,strong'))){
    const value=norm(el.textContent);
    if(value==='ожидает публикации'||value==='ожидает публикацию'){
      el.textContent='Опубликовано';
      el.dataset.ronaPriceSyncStatus='published';
    }
  }
}

function ensurePriceInteractionStyle(){
  if(document.getElementById('ronaClientPriceInteractionV1'))return;
  const style=document.createElement('style');
  style.id='ronaClientPriceInteractionV1';
  style.textContent=`
button[data-rona-price-item]{border:1px solid transparent!important;border-radius:9px!important;padding:7px 10px!important;transition:background-color .14s ease,border-color .14s ease,color .14s ease,box-shadow .14s ease,transform .14s ease!important;outline:none!important}
@media (hover:hover) and (pointer:fine){button[data-rona-price-item]:hover{background:rgba(101,217,255,.11)!important;border-color:rgba(101,217,255,.58)!important;color:#c9f5ff!important;box-shadow:inset 0 0 0 1px rgba(101,217,255,.08),0 0 16px rgba(101,217,255,.10)!important;transform:translateY(-1px)!important}}
button[data-rona-price-item]:focus-visible{background:rgba(101,217,255,.12)!important;border-color:rgba(101,217,255,.72)!important;color:#d9f9ff!important;box-shadow:0 0 0 2px rgba(101,217,255,.18)!important}
button[data-rona-price-item]:active{background:rgba(101,217,255,.17)!important;border-color:rgba(101,217,255,.78)!important;transform:translateY(0)!important}
@media (prefers-reduced-motion:reduce){button[data-rona-price-item]{transition:none!important;transform:none!important}}
`;
  document.head.appendChild(style);
}

function styleHeadCell(cell,index){
  Object.assign(cell.style,{fontSize:'15px',lineHeight:'1.25',fontWeight:'800',padding:'14px 12px',verticalAlign:'middle',whiteSpace:'nowrap'});
  if(index===0)cell.style.width='52px';
  if(index===1)cell.style.minWidth='180px';
  if(index===2)cell.style.minWidth='210px';
}

function styleBodyCell(cell,index){
  Object.assign(cell.style,{fontSize:'16px',lineHeight:'1.35',fontWeight:index===0?'650':'700',padding:'15px 12px',verticalAlign:'middle'});
  if(index===0){cell.style.width='52px';cell.style.whiteSpace='nowrap'}
  if(index>=3)cell.style.whiteSpace='nowrap';
}

function makePriceButton(item){
  ensurePriceInteractionStyle();
  const button=document.createElement('button');
  button.type='button';
  button.dataset.ronaPriceItem=String(item.publication_item_id||'');
  button.textContent=priceText(item);
  button.title='Нажмите, чтобы подать заявку по этой цене';
  button.setAttribute('aria-label',`Подать заявку: ${productLabel(item.product)}, ${item.basis}, ${priceText(item)}`);
  Object.assign(button.style,{appearance:'none',border:'1px solid transparent',background:'transparent',padding:'7px 10px',margin:'0',color:'inherit',fontFamily:'inherit',fontSize:'16px',lineHeight:'1.35',fontWeight:'800',cursor:'pointer',width:'100%',textAlign:'left',whiteSpace:'nowrap'});
  return button;
}

function render(){
  if(!state.prices.length)return false;
  const table=findPriceTable();
  if(!table)return false;
  const bases=uniqueBases();
  const signature=['admin-parity-v4-display-only',state.context?.client_id||'',state.context?.contract_id||'',...state.prices.map(x=>[x.publication_item_id,x.product,x.basis,x.price,x.currency].join(':'))].join('|');
  if(table.dataset.ronaPriceSyncSignature===signature)return true;

  Object.assign(table.style,{fontSize:'16px',lineHeight:'1.35',tableLayout:'auto'});
  const head=table.tHead?.rows?.[0]||table.querySelector('thead tr');
  if(head){
    head.textContent='';
    ['№','Продукт','Производитель',...bases].forEach((value,index)=>{
      const th=document.createElement('th');
      th.textContent=value;
      styleHeadCell(th,index);
      head.appendChild(th);
    });
  }

  let body=table.tBodies?.[0]||table.querySelector('tbody');
  if(!body){body=document.createElement('tbody');table.appendChild(body)}
  body.textContent='';
  groupedProducts().forEach(([product,items],index)=>{
    const row=document.createElement('tr');
    [String(index+1),productLabel(product),producerLabel(product)].forEach((value,cellIndex)=>{
      const cell=document.createElement('td');
      cell.textContent=value;
      styleBodyCell(cell,cellIndex);
      row.appendChild(cell);
    });
    for(const basis of bases){
      const cell=document.createElement('td');
      styleBodyCell(cell,row.children.length);
      const item=items.find(x=>String(x.basis||'').trim()===basis);
      if(item)cell.appendChild(makePriceButton(item));else cell.textContent='—';
      row.appendChild(cell);
    }
    body.appendChild(row);
  });
  table.dataset.ronaPriceSyncSignature=signature;
  state.renderSignature=signature;
  markPublished();
  return true;
}

async function refresh(force=false){
  if(state.loading)return;
  state.loading=true;
  try{
    ensureContractDownloadRuntime();
    const boot=await request('/v1/client/bootstrap');
    const contexts=Array.isArray(boot?.data?.contexts)?boot.data.contexts:[];
    state.contexts=contexts;
    const next=chooseContext(contexts);
    if(!next)throw new Error('CLIENT_CONTEXT_NOT_FOUND');
    const changed=!state.context||state.context.client_id!==next.client_id||state.context.contract_id!==next.contract_id;
    state.context=next;
    if(changed||force||!state.prices.length){
      const result=await request('/v1/client/prices?clientId='+encodeURIComponent(next.client_id)+'&contractId='+encodeURIComponent(next.contract_id));
      state.prices=Array.isArray(result?.prices)?result.prices:[];
      window.__RONA_CLIENT_PRICE_SYNC_STATE__={context:next,prices:state.prices,loadedAt:new Date().toISOString()};
    }
    render();
  }catch(error){console.error('RONA client price sync',error)}
  finally{state.loading=false}
}

function scheduleRefresh(force=true){
  clearTimeout(state.refreshTimer);
  state.refreshTimer=setTimeout(()=>refresh(force),260);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh(true),{once:true});else queueMicrotask(()=>refresh(true));
document.addEventListener('click',()=>scheduleRefresh(true),true);
document.addEventListener('change',()=>scheduleRefresh(true),true);
setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},15000);
})();
