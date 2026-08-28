(()=>{'use strict';
if(window.__RONA_CLIENT_PRICE_CONDITIONS_V1__)return;
window.__RONA_CLIENT_PRICE_CONDITIONS_V1__='20260828-premium-terms-v2';

const BLOCK_ID='ronaClientPriceConditionsV1';
const STYLE_ID='ronaClientPriceConditionsPremiumV2';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
const low=v=>norm(v).toLocaleLowerCase('ru-RU');
const dateText=value=>{const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:norm(value)};
const monthNames=['','январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

function currentState(){
  const value=window.__RONA_CLIENT_PRICE_SYNC_STATE__;
  return value&&Array.isArray(value.prices)?value:null;
}

function visible(el){
  if(!el||!el.isConnected)return false;
  const style=getComputedStyle(el);
  if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
  const rect=el.getBoundingClientRect();
  return rect.width>0&&rect.height>0;
}

function fixHeaderStatus(){
  const labels=Array.from(document.querySelectorAll('span,small,strong,div,p')).filter(el=>{
    if(!visible(el)||el.childElementCount>0)return false;
    return low(el.textContent)==='статус';
  });
  for(const label of labels){
    let card=label.parentElement;
    for(let depth=0;card&&depth<4;depth++,card=card.parentElement){
      const text=low(card.textContent);
      if(!text.includes('статус')||!text.includes('выход')||text.length>90)continue;
      let changed=false;
      for(const el of Array.from(card.querySelectorAll('span,small,strong,div,p,b'))){
        if(el===label||el.closest('button,a,[role="button"]'))continue;
        if(el.childElementCount===0&&low(el.textContent)==='выход'){
          el.textContent='Онлайн';
          el.dataset.ronaClientStatus='online';
          changed=true;
        }
      }
      for(const node of Array.from(card.childNodes)){
        if(node.nodeType===Node.TEXT_NODE&&low(node.textContent)==='выход'){
          node.textContent='Онлайн';
          changed=true;
        }
      }
      if(changed){card.dataset.ronaClientStatusCard='online';return true}
    }
  }
  return false;
}

function findPriceTable(){
  return Array.from(document.querySelectorAll('table')).find(table=>{
    const text=low(table.querySelector('thead')?.textContent||table.textContent);
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

function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${BLOCK_ID}{position:relative;isolation:isolate;margin:16px 0 0;overflow:hidden;border:1px solid rgba(116,207,245,.17);border-radius:16px;background:radial-gradient(620px 180px at 3% -20%,rgba(76,196,238,.11),transparent 64%),radial-gradient(420px 180px at 100% 0,rgba(239,187,75,.055),transparent 70%),linear-gradient(145deg,rgba(8,24,36,.91),rgba(5,15,24,.88));color:#eef6f9;box-shadow:0 16px 44px rgba(0,0,0,.19),inset 0 1px 0 rgba(255,255,255,.035)}
#${BLOCK_ID}::before{content:"";position:absolute;inset:0 auto 0 0;width:2px;background:linear-gradient(180deg,rgba(101,217,255,.9),rgba(101,217,255,.12) 54%,rgba(238,190,78,.64));opacity:.82;pointer-events:none}
#${BLOCK_ID} .rona-pc-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px 12px 18px;border-bottom:1px solid rgba(132,196,224,.10);background:linear-gradient(90deg,rgba(10,29,42,.54),rgba(7,19,29,.18))}
#${BLOCK_ID} .rona-pc-kicker{margin:0 0 3px;font-size:9px;line-height:1.2;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:#68d9fb}
#${BLOCK_ID} .rona-pc-title{margin:0;font-size:15px;line-height:1.25;font-weight:850;letter-spacing:-.01em;color:#f4f8fb}
#${BLOCK_ID} .rona-pc-state{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid rgba(239,194,83,.22);border-radius:999px;background:rgba(239,194,83,.065);font-size:9px;line-height:1;font-weight:850;letter-spacing:.09em;text-transform:uppercase;color:#e7c46f;white-space:nowrap}
#${BLOCK_ID} .rona-pc-state::before{content:"";width:5px;height:5px;border-radius:50%;background:#e3bd5c;box-shadow:0 0 0 3px rgba(227,189,92,.08)}
#${BLOCK_ID} .rona-pc-grid{display:grid;grid-template-columns:1.05fr 1fr .8fr 1.8fr;gap:9px;padding:12px 14px 10px 18px}
#${BLOCK_ID} .rona-pc-item{min-width:0;min-height:58px;padding:10px 11px;border:1px solid rgba(148,202,225,.08);border-radius:11px;background:linear-gradient(155deg,rgba(9,27,40,.60),rgba(5,17,26,.42));box-shadow:inset 0 1px 0 rgba(255,255,255,.018)}
#${BLOCK_ID} .rona-pc-label{margin:0 0 5px;font-size:9px;line-height:1.25;font-weight:850;letter-spacing:.105em;text-transform:uppercase;color:#7eafc2}
#${BLOCK_ID} .rona-pc-value{font-size:12.5px;line-height:1.42;font-weight:720;color:#e4edf1;overflow-wrap:anywhere}
#${BLOCK_ID} .rona-pc-payment{display:grid;grid-template-columns:minmax(145px,.34fr) minmax(0,1fr);align-items:center;gap:15px;margin:0 14px 14px 18px;padding:10px 12px;border:1px solid rgba(239,194,83,.11);border-radius:11px;background:linear-gradient(100deg,rgba(239,194,83,.045),rgba(11,35,48,.37) 44%,rgba(7,21,31,.46));box-shadow:inset 2px 0 0 rgba(227,189,92,.52)}
#${BLOCK_ID} .rona-pc-payment .rona-pc-label{margin:0;color:#c0a765}
#${BLOCK_ID} .rona-pc-payment .rona-pc-value{font-size:12px;line-height:1.48;font-weight:680;color:#d8e6eb}
@media(max-width:1050px){#${BLOCK_ID} .rona-pc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){#${BLOCK_ID}{border-radius:14px}#${BLOCK_ID} .rona-pc-head{align-items:flex-start;padding:13px 13px 11px 16px}#${BLOCK_ID} .rona-pc-state{margin-top:1px}#${BLOCK_ID} .rona-pc-grid{grid-template-columns:1fr;padding:10px 12px 9px 16px}#${BLOCK_ID} .rona-pc-item{min-height:0}#${BLOCK_ID} .rona-pc-payment{grid-template-columns:1fr;gap:5px;margin:0 12px 12px 16px}}
`;
  document.head.appendChild(style);
}

function metric(label,value){
  const item=document.createElement('div');
  item.className='rona-pc-item';
  const l=document.createElement('div');l.className='rona-pc-label';l.textContent=label;
  const v=document.createElement('div');v.className='rona-pc-value';v.textContent=value;
  item.append(l,v);
  return item;
}

function render(){
  fixHeaderStatus();
  const state=currentState();
  const table=findPriceTable();
  if(!state?.prices?.length||!table)return false;
  ensureStyle();
  const data=termsFrom(state.prices);
  const sig=signature(state.prices);
  let block=document.getElementById(BLOCK_ID);
  if(block?.dataset.signature===sig&&block.previousElementSibling===table)return true;
  if(block)block.remove();

  block=document.createElement('section');
  block.id=BLOCK_ID;
  block.dataset.signature=sig;
  block.setAttribute('aria-label','Условия прайс-листа');

  const head=document.createElement('div');head.className='rona-pc-head';
  const headText=document.createElement('div');
  const kicker=document.createElement('div');kicker.className='rona-pc-kicker';kicker.textContent='RONA TRADE · COMMERCIAL TERMS';
  const title=document.createElement('h3');title.className='rona-pc-title';title.textContent='Условия прайс-листа';
  const status=document.createElement('div');status.className='rona-pc-state';status.textContent='Действующий';
  headText.append(kicker,title);head.append(headText,status);

  const grid=document.createElement('div');grid.className='rona-pc-grid';
  grid.append(
    metric('Прайс-лист',data.publication),
    metric('Период поставки',data.period),
    metric('Валюта / единица',data.unit),
    metric('Условия поставки',data.delivery),
  );

  const payment=document.createElement('div');payment.className='rona-pc-payment';
  const paymentLabel=document.createElement('div');paymentLabel.className='rona-pc-label';paymentLabel.textContent='Условия оплаты';
  const paymentValue=document.createElement('div');paymentValue.className='rona-pc-value';paymentValue.textContent=data.payment;
  payment.append(paymentLabel,paymentValue);

  block.append(head,grid,payment);
  table.insertAdjacentElement('afterend',block);
  return true;
}

let attempts=0;
function tryRender(){
  fixHeaderStatus();
  if(render())return;
  if(attempts++<40)setTimeout(tryRender,500);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryRender,{once:true});else queueMicrotask(tryRender);
document.addEventListener('click',()=>setTimeout(render,250),true);
document.addEventListener('change',()=>setTimeout(render,250),true);
setInterval(()=>{if(document.visibilityState==='visible')render()},4000);
})();
