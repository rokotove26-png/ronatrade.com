(()=>{'use strict';
const MARK='20260830-client-payments-canonical-layout-v1';
if(window.__RONA_CLIENT_PAYMENTS_CANONICAL_LAYOUT__===MARK)return;
window.__RONA_CLIENT_PAYMENTS_CANONICAL_LAYOUT__=MARK;
if(location.pathname!=='/portal/client')return;

const OWNER='[data-rona-client-payments-owner="finance-authoritative-v1"]';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const esc=v=>norm(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const formatDate=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ru-RU')};
const money=(v,c)=>{const n=num(v);if(n===null)return'—';return n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})+(c?' '+norm(c):'')};

function paymentsRoot(){
  for(const selector of ['#page-payments','#paymentsPage','[data-page-panel="payments"]','[data-page-id="payments"]']){const el=document.querySelector(selector);if(el)return el}
  let best=null;
  for(const el of document.querySelectorAll('main section,main div,section')){
    const t=norm(el.textContent);if(!t.includes('Платежи и взаиморасчёты'))continue;
    if(!best||t.length<norm(best.textContent).length)best=el;
  }
  return best;
}
function decorated(el){
  const s=getComputedStyle(el),bg=s.backgroundColor||'';
  const alpha=/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i.exec(bg);
  const visibleBg=bg&&bg!=='transparent'&&bg!=='rgba(0, 0, 0, 0)'&&(!alpha||Number(alpha[1])>0);
  return visibleBg||parseFloat(s.borderLeftWidth||'0')>0||parseFloat(s.borderTopWidth||'0')>0||s.boxShadow!=='none'||parseFloat(s.borderRadius||'0')>0;
}
function frameFromExactText(root,needle){
  const rootRect=root.getBoundingClientRect();
  const leaves=[...root.querySelectorAll('*')].filter(el=>el.childElementCount===0&&norm(el.textContent).includes(needle));
  for(const leaf of leaves){
    let node=leaf;
    while(node&&node!==root){
      const r=node.getBoundingClientRect();
      if(r.width>=Math.min(420,rootRect.width*.45)&&r.width<rootRect.width-2&&decorated(node))return node;
      node=node.parentElement;
    }
  }
  return null;
}
function canonicalFrame(root){
  return frameFromExactText(root,'Выбрана компания')||frameFromExactText(root,'Платежи и взаиморасчёты');
}
function alignOwner(root,owner){
  const frame=canonicalFrame(root);if(!frame)return false;
  const rr=root.getBoundingClientRect(),fr=frame.getBoundingClientRect();
  if(fr.width<1||rr.width<1)return false;
  const left=Math.max(0,fr.left-rr.left);
  owner.style.boxSizing='border-box';
  owner.style.width=fr.width+'px';
  owner.style.maxWidth=fr.width+'px';
  owner.style.marginLeft=left+'px';
  owner.style.marginRight='0';
  owner.setAttribute('data-rona-payments-canonical-width','header-frame');
  return true;
}
function paymentsState(){const s=window.__RONA_CLIENT_PAYMENTS_STATE__;return s&&Array.isArray(s.payments)?s.payments:[]}
function latestPaymentsByDeal(payments){
  const map=new Map();
  for(const p of payments){
    const id=norm(p?.deal_id);if(!id)continue;
    const at=p?.received_at||p?.payment_at||p?.bank_confirmed_at||null;
    const ts=at?new Date(at).getTime():0;
    const prev=map.get(id),prevTs=prev?.at?new Date(prev.at).getTime():-1;
    if(!prev||ts>=prevTs)map.set(id,{at,payment:p});
  }
  return map;
}
function projectDealReceiptDates(owner,payments){
  const latest=latestPaymentsByDeal(payments);
  for(const row of owner.querySelectorAll('.rona-payments-deal[data-deal-id]')){
    const id=norm(row.getAttribute('data-deal-id')),hit=latest.get(id);
    const amount=row.querySelector('.rona-payments-amount');if(!amount)continue;
    let date=amount.querySelector('[data-rona-payment-received-date]');
    if(!hit){if(date)date.remove();continue}
    if(!date){date=document.createElement('div');date.setAttribute('data-rona-payment-received-date','true');date.className='rona-payment-received-date';amount.appendChild(date)}
    const value=formatDate(hit.at);
    if(date.textContent!==`Дата поступления: ${value}`)date.textContent=`Дата поступления: ${value}`;
  }
}
function confirmedEventsHost(owner){
  for(const section of owner.querySelectorAll('[data-rona-payments-card]')){
    const strong=section.querySelector('.rona-payments-head strong');
    if(norm(strong?.textContent)==='Подтверждённые поступления')return section.querySelector('.rona-payments-events');
  }
  return null;
}
function projectConfirmedReceipts(owner,payments){
  const host=confirmedEventsHost(owner);if(!host)return;
  if(!payments.length)return;
  const ordered=[...payments].sort((a,b)=>new Date(b?.received_at||b?.payment_at||b?.bank_confirmed_at||0)-new Date(a?.received_at||a?.payment_at||a?.bank_confirmed_at||0));
  const signature=ordered.map(p=>[norm(p?.payment_id),norm(p?.deal_id),norm(p?.received_at||p?.payment_at||p?.bank_confirmed_at),String(p?.amount??''),norm(p?.currency)].join('|')).join('||');
  if(host.getAttribute('data-rona-payment-events-signature')===signature)return;
  host.innerHTML=ordered.map(p=>{
    const at=p?.received_at||p?.payment_at||p?.bank_confirmed_at;
    return `<div class="rona-payments-event" data-rona-payment-event="authoritative"><div><b>${esc(p?.deal_id||'Платёж')}</b><div>${esc(p?.payment_id||'')}</div></div><time>Дата поступления: ${esc(formatDate(at))}</time><b>${esc(money(p?.amount,p?.currency))}</b></div>`;
  }).join('');
  host.setAttribute('data-rona-payment-events-signature',signature);
}
function installStyle(){
  if(document.getElementById('rona-client-payments-canonical-layout-v1-style'))return;
  const style=document.createElement('style');style.id='rona-client-payments-canonical-layout-v1-style';
  style.textContent=`
    #page-payments ${OWNER}{justify-self:start}
    #page-payments ${OWNER}>[data-rona-payments-card]{width:100%;box-sizing:border-box}
    #page-payments .rona-payment-received-date{margin-top:5px;color:#8fb6c7;font-size:9px;line-height:1.25}
    #page-payments .rona-payments-event time{white-space:nowrap}
    @media(max-width:900px){#page-payments ${OWNER}{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important}}
  `;
  document.head.appendChild(style);
}
let scheduled=false;
function apply(){
  scheduled=false;installStyle();
  const root=paymentsRoot(),owner=root?.querySelector(OWNER);if(!root||!owner)return;
  alignOwner(root,owner);
  const payments=paymentsState();
  projectDealReceiptDates(owner,payments);
  projectConfirmedReceipts(owner,payments);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply)}
function start(){
  installStyle();schedule();
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule()});
  window.setInterval(schedule,1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();