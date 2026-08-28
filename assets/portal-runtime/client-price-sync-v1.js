(()=>{'use strict';
if(window.__RONA_CLIENT_PRICE_SYNC_V1__)return;
window.__RONA_CLIENT_PRICE_SYNC_V1__='20260828-safe-v1';

const API='/portal/api';
const state={contexts:[],context:null,prices:[],loading:false,renderSignature:'',refreshTimer:0};
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
    return text.includes('продукт')&&text.includes('класс');
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

function productLabel(product){
  const value=String(product||'').trim();
  if(/^АИ-\d+/i.test(value))return value.replace(/\s+К5\b/i,'').trim();
  if(/^ДТ\b/i.test(value))return 'ДТ';
  return value;
}

function productClass(product){
  const value=String(product||'').trim();
  if(/дт/i.test(value)&&/сорт\s*c/i.test(value))return 'сорт C · К5';
  if(/\bК5\b/i.test(value))return 'К5';
  return '—';
}

function priceText(item){
  const value=num(item.price);
  const price=value===null?String(item.price||'—'):new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  return `${price} ${String(item.currency||'')}/т`;
}

function dateText(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?`${m[3]}.${m[2]}.${m[1]}`:String(value||'');
}

function periodText(item){
  return [dateText(item.delivery_period_from),dateText(item.delivery_period_to)].filter(Boolean).join('–');
}

function stationFromBasis(basis){
  return String(basis||'').replace(/^\s*(CPT|DAP|FCA|FOB|EXW)\s*/i,'').trim()||String(basis||'').trim();
}

function countryForStation(station){
  const value=norm(station);
  if(value.includes('озинки')||value.includes('наушки'))return 'Россия';
  if(value.includes('сарыагаш'))return 'Казахстан';
  if(value.includes('галаба'))return 'Узбекистан';
  return 'TO_BE_CONFIRMED';
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

function makePriceButton(item){
  const button=document.createElement('button');
  button.type='button';
  button.dataset.ronaPriceItem=String(item.publication_item_id||'');
  button.textContent=priceText(item);
  button.title='Подать заявку';
  Object.assign(button.style,{appearance:'none',border:'0',background:'transparent',padding:'0',margin:'0',color:'inherit',font:'inherit',fontWeight:'inherit',cursor:'pointer',width:'100%',textAlign:'left'});
  button.addEventListener('click',()=>openApplication(item));
  return button;
}

function render(){
  if(!state.prices.length)return false;
  const table=findPriceTable();
  if(!table)return false;
  const bases=uniqueBases();
  const signature=[state.context?.client_id||'',state.context?.contract_id||'',...state.prices.map(x=>[x.publication_item_id,x.product,x.basis,x.price,x.currency].join(':'))].join('|');
  if(table.dataset.ronaPriceSyncSignature===signature)return true;

  const head=table.tHead?.rows?.[0]||table.querySelector('thead tr');
  if(head){
    while(head.children.length>3)head.removeChild(head.lastElementChild);
    for(const basis of bases){
      const th=document.createElement('th');
      th.textContent=basis;
      head.appendChild(th);
    }
  }

  let body=table.tBodies?.[0]||table.querySelector('tbody');
  if(!body){body=document.createElement('tbody');table.appendChild(body)}
  body.textContent='';
  groupedProducts().forEach(([product,items],index)=>{
    const row=document.createElement('tr');
    [String(index+1),productLabel(product),productClass(product)].forEach(value=>{
      const cell=document.createElement('td');
      cell.textContent=value;
      row.appendChild(cell);
    });
    for(const basis of bases){
      const cell=document.createElement('td');
      const item=items.find(x=>String(x.basis||'').trim()===basis);
      if(item)cell.appendChild(makePriceButton(item)); else cell.textContent='—';
      row.appendChild(cell);
    }
    body.appendChild(row);
  });
  table.dataset.ronaPriceSyncSignature=signature;
  state.renderSignature=signature;
  markPublished();
  return true;
}

function notify(message,bad=false){
  try{if(typeof window.toast==='function'){window.toast(message);return}}catch(_e){}
  let box=document.getElementById('ronaClientPriceSyncNotice');
  if(!box){
    box=document.createElement('div');box.id='ronaClientPriceSyncNotice';
    Object.assign(box.style,{position:'fixed',right:'22px',bottom:'22px',zIndex:'2147483647',maxWidth:'420px',padding:'11px 14px',borderRadius:'10px',background:'#0d2631',border:'1px solid rgba(101,217,255,.28)',color:'#f4f8fb',font:'600 13px/1.45 Inter,Arial,sans-serif',boxShadow:'0 18px 50px rgba(0,0,0,.45)'});
    document.body.appendChild(box);
  }
  box.style.background=bad?'#3a1b21':'#0d2631';box.textContent=message;box.hidden=false;
  clearTimeout(notify.t);notify.t=setTimeout(()=>{box.hidden=true},3600);
}

function closeApplication(){document.getElementById('ronaClientPriceApplicationModal')?.remove()}

function openApplication(item){
  const ctx=state.context;
  if(!ctx){notify('Не подтверждён договорный контекст клиента.',true);return}
  closeApplication();
  const overlay=document.createElement('div');
  overlay.id='ronaClientPriceApplicationModal';
  Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483600',display:'grid',placeItems:'center',padding:'24px',background:'rgba(2,7,12,.76)'});
  const form=document.createElement('form');
  Object.assign(form.style,{width:'min(620px,calc(100vw - 32px))',maxHeight:'calc(100vh - 48px)',overflow:'auto',border:'1px solid rgba(101,217,255,.22)',borderRadius:'18px',padding:'22px',background:'linear-gradient(160deg,rgba(10,28,42,.99),rgba(5,14,23,.99))',boxShadow:'0 28px 90px rgba(0,0,0,.55)',color:'#f4f8fb',font:'13px/1.45 Inter,Arial,sans-serif'});
  form.innerHTML=`<div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#65d9ff;font-weight:800">RONA TRADE · ЗАЯВКА</div><h2 style="margin:6px 0 4px;font-size:24px">${esc(productLabel(item.product))}</h2><div style="color:#9eb3c1;margin-bottom:16px">${esc(item.basis)} · ${esc(priceText(item))} · поставка ${esc(periodText(item))}</div><label style="display:grid;gap:6px;margin:12px 0"><span>Количество, т</span><input name="quantity" inputmode="decimal" required min="0.001" step="0.001" style="padding:11px;border-radius:9px;border:1px solid rgba(145,194,216,.25);background:#081722;color:#fff"></label><label style="display:flex;gap:9px;align-items:center;margin:12px 0"><input name="listPrice" type="checkbox" checked><span>Цена по прайсу</span></label><label data-proposed style="display:none;gap:6px;margin:12px 0"><span>Предлагаемая цена, ${esc(item.currency||'USD')}/т</span><input name="proposedPrice" inputmode="decimal" min="0.01" step="0.01" style="padding:11px;border-radius:9px;border:1px solid rgba(145,194,216,.25);background:#081722;color:#fff"></label><label style="display:grid;gap:6px;margin:12px 0"><span>Комментарий</span><textarea name="comment" rows="3" style="resize:vertical;padding:11px;border-radius:9px;border:1px solid rgba(145,194,216,.25);background:#081722;color:#fff"></textarea></label><div data-error hidden style="margin:10px 0;padding:9px 11px;border-radius:8px;background:#3a1b21;color:#ffdfe3"></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px"><button type="button" data-cancel style="padding:10px 15px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#0b1a25;color:#dbe9ef;cursor:pointer">Отмена</button><button type="submit" style="padding:10px 16px;border-radius:9px;border:1px solid rgba(101,217,255,.35);background:#123b4b;color:#fff;font-weight:800;cursor:pointer">Подать заявку</button></div>`;
  overlay.appendChild(form);document.body.appendChild(overlay);
  overlay.addEventListener('mousedown',e=>{if(e.target===overlay)closeApplication()});
  form.querySelector('[data-cancel]').addEventListener('click',closeApplication);
  const listPrice=form.elements.listPrice,proposedWrap=form.querySelector('[data-proposed]');
  listPrice.addEventListener('change',()=>{proposedWrap.style.display=listPrice.checked?'none':'grid';form.elements.proposedPrice.required=!listPrice.checked});
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const error=form.querySelector('[data-error]'),submit=form.querySelector('button[type="submit"]');error.hidden=true;
    const quantity=Number(String(form.elements.quantity.value||'').replace(',','.'));
    if(!Number.isFinite(quantity)||quantity<=0){error.textContent='Укажите количество больше нуля.';error.hidden=false;return}
    const byList=listPrice.checked;
    const proposed=byList?null:Number(String(form.elements.proposedPrice.value||'').replace(',','.'));
    if(!byList&&(!Number.isFinite(proposed)||proposed<=0)){error.textContent='Укажите предлагаемую цену.';error.hidden=false;return}
    submit.disabled=true;
    const station=stationFromBasis(item.basis),country=countryForStation(station);
    const key='PRICE-APP-'+(crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2));
    try{
      const result=await request('/v1/client/applications',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':key},body:JSON.stringify({clientId:ctx.client_id,contractId:ctx.contract_id,publicationItemId:item.publication_item_id,quantityTonnes:quantity,priceMode:byList?'ACCEPT_PUBLISHED_PRICE':'CLIENT_PROPOSED_PRICE',proposedPrice:byList?null:proposed,proposedCurrency:byList?null:String(item.currency||'USD'),destinationCountry:country,destinationStation:station,deliveryPeriodFrom:item.delivery_period_from||null,deliveryPeriodTo:item.delivery_period_to||null,idempotencyKey:key})});
      const app=result?.application||result?.data||{};const applicationId=String(app.application_id||app.applicationId||'').trim();
      const comment=String(form.elements.comment.value||'').trim();
      if(comment&&applicationId){
        const commentKey=key+'-COMMENT';
        await request('/v1/events',{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':commentKey},body:JSON.stringify({role:'CLIENT',event_type:'CLIENT_MESSAGE_SUBMIT',authority_domain:'APPLICATION',authority_target_type:'APPLICATION',authority_target_id:applicationId,client_id:ctx.client_id,contract_id:ctx.contract_id,payload:{application_id:applicationId,message_type:'APPLICATION_COMMENT',comment},idempotency_key:commentKey})}).catch(()=>null);
      }
      closeApplication();notify(applicationId?`Заявка ${applicationId} подана.`:'Заявка подана.');
      window.dispatchEvent(new CustomEvent('rona:client-application-submitted',{detail:{applicationId:applicationId||null}}));
    }catch(error){error=String(error?.message||'APPLICATION_SUBMIT_FAILED');const node=form.querySelector('[data-error]');node.textContent='Не удалось подать заявку: '+error;node.hidden=false}
    finally{submit.disabled=false}
  });
}

async function refresh(force=false){
  if(state.loading)return;
  state.loading=true;
  try{
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
const observer=new MutationObserver(()=>{if(state.prices.length)requestAnimationFrame(render)});
observer.observe(document.documentElement,{subtree:true,childList:true});
setInterval(()=>{if(document.visibilityState==='visible')refresh(false)},15000);
})();
