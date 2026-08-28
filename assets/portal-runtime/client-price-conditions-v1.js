(()=>{'use strict';
if(window.__RONA_CLIENT_PRICE_CONDITIONS_V1__)return;
window.__RONA_CLIENT_PRICE_CONDITIONS_V1__='20260828-below-table-v1';

const BLOCK_ID='ronaClientPriceConditionsV1';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
const dateText=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:norm(value)};
const monthNames=['','январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

function currentState(){
  const value=window.__RONA_CLIENT_PRICE_SYNC_STATE__;
  return value&&Array.isArray(value.prices)?value:null;
}

function findPriceTable(){
  return Array.from(document.querySelectorAll('table')).find(table=>{
    const text=norm(table.querySelector('thead')?.textContent||table.textContent).toLocaleLowerCase('ru-RU');
    return text.includes('продукт')&&text.includes('производитель')&&(text.includes('cpt озинки')||text.includes('cpt сарыагаш')||text.includes('cpt наушки'));
  })||null;
}

function publicationLabel(item){
  const id=norm(item?.publication_id||item?.publicationId);
  const m=id.match(/RONA-PRICE-LIST-(\d{4})-(\d{2})(?:-R(\d+))?/i);
  if(!m)return id||'Действующий прайс-лист';
  const month=monthNames[Number(m[2])]||m[2];
  return `${month} ${m[1]}${m[3]?` · редакция ${m[3]}`:''}`;
}

function uniq(values){return [...new Set(values.map(norm).filter(Boolean))]}

function termsFrom(prices){
  const from=prices.map(x=>norm(x.delivery_period_from)).filter(Boolean).sort()[0]||'';
  const to=prices.map(x=>norm(x.delivery_period_to)).filter(Boolean).sort().at(-1)||'';
  const payments=uniq(prices.map(x=>x.payment_terms));
  const currencies=uniq(prices.map(x=>x.currency));
  const bases=uniq(prices.map(x=>x.basis));
  return {
    publication:publicationLabel(prices[0]),
    period:from&&to?`${dateText(from)}–${dateText(to)}`:(dateText(from)||dateText(to)||'—'),
    payment:payments.join(' / ')||'—',
    unit:currencies.length?`${currencies.join(' / ')}/т`:'—',
    delivery:bases.join(' · ')||'—',
  };
}

function signature(prices){
  const t=termsFrom(prices);
  return [t.publication,t.period,t.payment,t.unit,t.delivery].join('|');
}

function render(){
  const state=currentState();
  const table=findPriceTable();
  if(!state?.prices?.length||!table)return false;
  const data=termsFrom(state.prices);
  const sig=signature(state.prices);
  let block=document.getElementById(BLOCK_ID);
  if(block?.dataset.signature===sig&&block.previousElementSibling===table)return true;
  if(block)block.remove();

  block=document.createElement('section');
  block.id=BLOCK_ID;
  block.dataset.signature=sig;
  block.setAttribute('aria-label','Условия прайс-листа');
  Object.assign(block.style,{margin:'14px 0 0',padding:'16px 18px',border:'1px solid rgba(101,217,255,.18)',borderRadius:'12px',background:'linear-gradient(180deg,rgba(10,29,42,.74),rgba(6,19,29,.62))',color:'#f4f8fb',boxShadow:'inset 0 1px 0 rgba(255,255,255,.025)'});

  const title=document.createElement('div');
  title.textContent='Условия прайс-листа';
  Object.assign(title.style,{margin:'0 0 12px',fontSize:'14px',lineHeight:'1.3',fontWeight:'850',letterSpacing:'.02em',color:'#f4f8fb'});
  block.appendChild(title);

  const grid=document.createElement('div');
  Object.assign(grid.style,{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:'10px 18px'});
  const rows=[
    ['Прайс-лист',data.publication],
    ['Период поставки',data.period],
    ['Условия оплаты',data.payment],
    ['Валюта / единица',data.unit],
    ['Условия поставки',data.delivery],
  ];
  rows.forEach(([label,value],index)=>{
    const item=document.createElement('div');
    Object.assign(item.style,{minWidth:'0',padding:index===2?'2px 0 0':'0'});
    if(index===2)item.style.gridColumn='1 / -1';
    const l=document.createElement('div');
    l.textContent=label;
    Object.assign(l.style,{margin:'0 0 3px',fontSize:'11px',lineHeight:'1.3',fontWeight:'800',letterSpacing:'.06em',textTransform:'uppercase',color:'#65d9ff'});
    const v=document.createElement('div');
    v.textContent=value;
    Object.assign(v.style,{fontSize:'14px',lineHeight:'1.5',fontWeight:'650',color:'#dce9ef',overflowWrap:'anywhere'});
    item.append(l,v);grid.appendChild(item);
  });
  block.appendChild(grid);
  table.insertAdjacentElement('afterend',block);
  return true;
}

let attempts=0;
function tryRender(){
  if(render())return;
  if(attempts++<40)setTimeout(tryRender,500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryRender,{once:true});else queueMicrotask(tryRender);
document.addEventListener('click',()=>setTimeout(render,350),true);
document.addEventListener('change',()=>setTimeout(render,350),true);
setInterval(()=>{if(document.visibilityState==='visible')render()},5000);
})();
