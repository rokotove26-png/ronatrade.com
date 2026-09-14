export default `(()=>{'use strict';
if(location.pathname!=='/portal/admin')return;

function ensurePaymentsPresentationStyle(){
  let style=document.getElementById('ronaPaymentsFramePresentationV4');
  if(style)return;
  style=document.createElement('style');
  style.id='ronaPaymentsFramePresentationV4';
  style.textContent='#page-payments .rona-payments-v7{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;gap:0!important;overflow:visible!important}#page-payments .rona-payments-v7::before{display:none!important;content:none!important}#page-payments .rona-payments-v7-board{margin-top:40px!important}#page-payments .rona-payments-v7-native-spend{display:grid;gap:3px}#page-payments .rona-payments-v7-native-spend strong{display:block;font-variant-numeric:tabular-nums}#page-payments .rona-payments-v7-native-note{display:block;margin-top:4px;font-size:9px;line-height:1.25;font-weight:750;color:#7894aa}#page-payments .rona-payments-v7-native-note.warn{color:#ffc169}@media(max-width:760px){#page-payments .rona-payments-v7-board{margin-top:26px!important}}';
  document.head.appendChild(style);
}

const spendUpper=v=>String(v??'').trim().toUpperCase();
const spendNum=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
function spendMoney(amount,currency){
  const n=spendNum(amount),c=spendUpper(currency);
  return n!==null&&c?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(n))+' '+c:'TO_VERIFY';
}
function spendSum(rows){
  const map=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const n=spendNum(row?.amount),c=spendUpper(row?.currency);if(n===null||!c)continue;
    map.set(c,(map.get(c)||0)+n);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([currency,amount])=>({currency,amount}));
}
function spendMoneyList(rows){return (Array.isArray(rows)?rows:[]).map(x=>spendMoney(x.amount,x.currency)).filter(Boolean).join(' · ')||'TO_VERIFY'}
function spendCell(article){return Array.from(article?.querySelectorAll?.('.rona-payments-v7-deal-cell')||[]).find(cell=>String(cell.querySelector('span')?.textContent||'').trim()==='Потрачено / Остаток')||null}
function spendSourceRows(data){
  const rows=Array.isArray(data?.financeFragment?.outgoingPayments)?data.financeFragment.outgoingPayments:[];
  return rows.filter(row=>spendUpper(row?.lifecycle_state)==='ACTIVE'&&spendUpper(row?.authority_state)==='CONFIRMED'&&spendUpper(row?.bank_fact_status)==='BANK_CONFIRMED'&&!spendUpper(row?.flow_kind).includes('FX'));
}
function spendModel(data){
  const projection=data?.paymentsV7Projection;
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7')return null;
  const rows=spendSourceRows(data),exact=rows.filter(row=>spendUpper(row?.deal_allocation_status)==='CONFIRMED'&&Array.isArray(row?.deal_ids)&&row.deal_ids.length===1),shared=rows.filter(row=>spendUpper(row?.deal_allocation_status)==='TO_VERIFY'&&Array.isArray(row?.source_deal_ids)&&row.source_deal_ids.length>0);
  const deals=new Map();
  for(const deal of Array.isArray(projection.deals)?projection.deals:[]){
    const id=String(deal?.deal_id||''),own=exact.filter(r=>String(r.deal_ids[0]||'')===id),unresolved=shared.filter(r=>r.source_deal_ids.map(String).includes(id));
    const currency=spendUpper(deal?.accounting_currency?.currency);
    deals.set(id,{exact:spendSum(own),unresolved:spendSum(unresolved),zero:own.length===0&&unresolved.length===0&&!!currency?{amount:0,currency}:null,remaining:deal?.remaining_execution});
  }
  return {deals,exact:spendSum(exact),unresolved:spendSum(shared),sourceAsOf:data?.financeFragment?.sourceAsOf||null};
}
function setSpendKpi(payments,model){
  const kpi=Array.from(payments.querySelectorAll('.rona-payments-v7-kpi')).find(k=>String(k.querySelector('.rona-payments-v7-kpi-label')?.textContent||'').trim()==='Потрачено / Остаток');
  if(!kpi)return;
  const label=kpi.querySelector('.rona-payments-v7-kpi-label');
  for(const child of Array.from(kpi.children))if(child!==label)child.remove();
  const box=document.createElement('div');box.className='rona-payments-v7-native-spend';
  const value=document.createElement('strong');value.className='rona-payments-v7-kpi-value';value.textContent=spendMoneyList(model.exact);box.appendChild(value);
  const note=document.createElement('small');note.className='rona-payments-v7-native-note';note.textContent='Подтвержденный фактический расход';box.appendChild(note);
  if(model.unresolved.length){const warn=document.createElement('small');warn.className='rona-payments-v7-native-note warn';warn.textContent='Без распределения по сделкам: '+spendMoneyList(model.unresolved);box.appendChild(warn)}
  const residue=document.createElement('small');residue.className='rona-payments-v7-native-note';residue.textContent='Остаток: TO_VERIFY без точной bank/Treasury связи';box.appendChild(residue);
  kpi.appendChild(box);
}
function applyFinanceSpend(payments,data){
  const model=spendModel(data);if(!model)return false;
  for(const article of payments.querySelectorAll('.rona-payments-v7-deal[data-deal-id]')){
    const d=model.deals.get(String(article.dataset.dealId||''));if(!d)continue;
    const cell=spendCell(article);if(!cell)continue;
    const strong=cell.querySelector('strong');if(!strong)continue;
    let small=cell.querySelector('small');if(!small){small=document.createElement('small');cell.appendChild(small)}
    if(d.exact.length){
      strong.textContent=spendMoneyList(d.exact);
      const remainingReady=spendUpper(d.remaining?.status)==='AUTHORITATIVE'&&spendNum(d.remaining?.amount)!==null&&spendUpper(d.remaining?.currency);
      small.textContent='Остаток: '+(remainingReady?spendMoney(d.remaining.amount,d.remaining.currency):'TO_VERIFY');
      if(d.unresolved.length)small.textContent+=' · Без распределения: '+spendMoneyList(d.unresolved);
    }else if(d.unresolved.length){
      strong.textContent='TO_VERIFY';
      small.textContent='Общий подтвержденный расход без распределения: '+spendMoneyList(d.unresolved);
    }else if(d.zero){
      strong.textContent=spendMoney(d.zero.amount,d.zero.currency);
      const remainingReady=spendUpper(d.remaining?.status)==='AUTHORITATIVE'&&spendNum(d.remaining?.amount)!==null&&spendUpper(d.remaining?.currency);
      small.textContent='Остаток: '+(remainingReady?spendMoney(d.remaining.amount,d.remaining.currency):'TO_VERIFY');
    }
  }
  setSpendKpi(payments,model);
  payments.dataset.financeSpendSource='FINANCE_FRAGMENT_OUTGOING_PAYMENTS';
  return true;
}

let financeSpendData=null,financeSpendPromise=null,financeSpendFetchedAt=0;
async function fetchFinanceSpend(){
  const now=Date.now();
  if(financeSpendData&&now-financeSpendFetchedAt<15000)return financeSpendData;
  if(financeSpendPromise)return financeSpendPromise;
  financeSpendPromise=(async()=>{
    try{
      const r=await fetch('/portal/owner-api?path=/admin/ai-sync&_payments_spend='+now,{cache:'no-store',headers:{'cache-control':'no-store'}});
      const j=await r.json().catch(()=>null);const data=j?.data||null;
      if(r.ok&&data?.paymentsV7Projection?.contract==='ADMIN_PAYMENTS_V7'&&Array.isArray(data?.financeFragment?.outgoingPayments)){financeSpendData=data;financeSpendFetchedAt=Date.now();return data}
    }catch(_){ }
    return null;
  })().finally(()=>{financeSpendPromise=null});
  return financeSpendPromise;
}
function refreshFinanceSpend(payments){
  if(financeSpendData)applyFinanceSpend(payments,financeSpendData);
  fetchFinanceSpend().then(data=>{if(data&&document.contains(payments))applyFinanceSpend(payments,data)});
}

function applyPaymentsFrame(){
  const page=document.getElementById('page-payments');
  if(!page)return;
  ensurePaymentsPresentationStyle();
  const mobile=window.innerWidth<=760;
  const pageWidth=Math.max(0,page.clientWidth||page.getBoundingClientRect().width||0);
  const target=mobile?'100%':Math.max(1,Math.round(pageWidth*0.75))+'px';
  for(const el of Array.from(page.children).filter(el=>el&&el.nodeType===1)){
    el.style.setProperty('width',target,'important');el.style.setProperty('max-width',target,'important');el.style.setProperty('min-width','0','important');el.style.setProperty('margin-left','auto','important');el.style.setProperty('margin-right','auto','important');el.style.setProperty('box-sizing','border-box','important');
  }
  const host=page.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"],:scope > .rona-owner-page-content');
  if(host){
    for(const [k,v] of [['width',target],['max-width',target],['min-width','0'],['margin-left','auto'],['margin-right','auto'],['padding-left','0'],['padding-right','0'],['box-sizing','border-box']])host.style.setProperty(k,v,'important');
    for(const child of Array.from(host.children)){if(!child||child.nodeType!==1)continue;for(const [k,v] of [['width','100%'],['max-width','100%'],['min-width','0'],['margin-left','0'],['margin-right','0'],['box-sizing','border-box']])child.style.setProperty(k,v,'important')}
  }
  const payments=page.querySelector('.rona-payments-v7');
  if(payments){
    for(const [k,v] of [['width','100%'],['max-width','100%'],['min-width','0'],['margin-left','0'],['margin-right','0'],['box-sizing','border-box'],['background','transparent'],['border','0'],['box-shadow','none'],['padding','0'],['gap','0'],['overflow','visible']])payments.style.setProperty(k,v,'important');
    const board=payments.querySelector('.rona-payments-v7-board');if(board){board.style.setProperty('grid-template-columns','minmax(0,1fr)','important');board.style.setProperty('margin-top',mobile?'26px':'40px','important')}
    for(const label of payments.querySelectorAll('.rona-payments-v7-kpi-label,.rona-payments-v7-deal-cell>span'))if(String(label.textContent||'').trim()==='К получению')label.textContent='Сумма по сделке';
    refreshFinanceSpend(payments);
  }
  page.dataset.ronaPaymentsFrameWidth=target;
}

let paymentsFrameQueued=false;
function schedulePaymentsFrame(){if(paymentsFrameQueued)return;paymentsFrameQueued=true;requestAnimationFrame(()=>{paymentsFrameQueued=false;applyPaymentsFrame()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedulePaymentsFrame,{once:true});else schedulePaymentsFrame();
window.addEventListener('resize',schedulePaymentsFrame,{passive:true});
window.addEventListener('rona:finance-sync',()=>{financeSpendFetchedAt=0;schedulePaymentsFrame()});
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="payments"],#nav a[data-page="payments"],#nav [role="button"][data-page="payments"]'))[0,60,180,500].forEach(ms=>setTimeout(schedulePaymentsFrame,ms))},true);
new MutationObserver(schedulePaymentsFrame).observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>{const p=document.getElementById('page-payments');if(p&&getComputedStyle(p).display!=='none')schedulePaymentsFrame()},1500);

if(window.__RONA_APPLICATION_RESOURCE_STAGE_LABELS_V1__)return;
window.__RONA_APPLICATION_RESOURCE_STAGE_LABELS_V1__=true;
if(location.pathname!=='/portal/admin')return;
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
function apply(){
  const root=document.getElementById('page-applications');
  if(!root)return;
  for(const el of root.querySelectorAll('h1,h2,h3,button,span,div')){
    const t=norm(el.textContent);
    if(t==='Требуют решения'&&el.childElementCount===0)el.textContent='Требует подтверждения';
    else if(/^Требует решения · \d+$/.test(t)&&el.childElementCount===0)el.textContent=t.replace('Требует решения','Требует подтверждения');
    else if(t==='Нужен ответ клиента или поставщика'&&el.childElementCount===0)el.textContent='Подтверждение ресурса по принятой заявке';
    else if(t==='3. Одобрение'&&el.childElementCount===0)el.textContent='3. Подтверждение ресурса';
    else if(t==='Ожидается одобрение поставщика'&&el.childElementCount===0)el.textContent='Требует подтверждения ресурса';
    else if(t==='Ожидается решение'&&el.childElementCount===0)el.textContent='Ресурс не подтвержден';
    else if(t==='Поставщик одобрил'&&el.childElementCount===0)el.textContent='Ресурс подтвержден';
  }
}
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-authority-refresh',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="applications"],#page-applications button'))setTimeout(schedule,0)},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();`;
