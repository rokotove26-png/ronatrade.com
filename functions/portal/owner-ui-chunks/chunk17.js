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
  return n!==null&&c?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' '+c:'TO_VERIFY';
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

function ensurePricesCommandStyle(){
  if(document.getElementById('ronaPricesCommandStyleV1'))return;
  const s=document.createElement('style');s.id='ronaPricesCommandStyleV1';
  s.textContent='#page-prices.rona-prices-command{--price-cyan:#59d7ff;--price-green:#4ce1b8;--price-amber:#ffc76b;--price-violet:#a78bfa;--price-line:rgba(137,190,218,.16);--price-panel:rgba(7,15,24,.88);--price-panel2:rgba(10,22,34,.92)}#page-prices.rona-prices-command .rona-fin-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important;margin:0 0 14px!important}#page-prices.rona-prices-command .rona-fin-kpi{--price-accent:var(--price-cyan);position:relative;overflow:hidden;min-height:104px!important;padding:15px 17px 14px!important;border:1px solid var(--price-line)!important;border-radius:16px!important;background:linear-gradient(145deg,rgba(12,27,41,.94),rgba(6,14,22,.91))!important;box-shadow:0 12px 32px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.035)!important;transform:none!important}#page-prices.rona-prices-command .rona-fin-kpi::after{content:""!important;position:absolute!important;left:0!important;right:auto!important;top:0!important;width:3px!important;height:100%!important;opacity:.95!important;background:var(--price-accent)!important;box-shadow:0 0 18px var(--price-accent)!important}#page-prices.rona-prices-command .rona-fin-kpi--paid{--price-accent:var(--price-cyan)}#page-prices.rona-prices-command .rona-fin-kpi--received{--price-accent:var(--price-green)}#page-prices.rona-prices-command .rona-fin-kpi--expected{--price-accent:var(--price-amber)}#page-prices.rona-prices-command .rona-fin-kpi h2{margin:0!important;font-size:10px!important;line-height:1.2!important;font-weight:900!important;letter-spacing:.11em!important;text-transform:uppercase!important;color:#89a3b7!important}#page-prices.rona-prices-command .rona-fin-kpi .rona-owner-kpi{margin:8px 0 6px!important;font-size:23px!important;line-height:1.05!important;font-weight:950!important;letter-spacing:-.025em!important;background:none!important;color:#f7fbff!important;-webkit-text-fill-color:#f7fbff!important;font-variant-numeric:tabular-nums!important}#page-prices.rona-prices-command .rona-fin-kpi .rona-owner-muted{font-size:10px!important;line-height:1.32!important;color:#6f8da4!important}#page-prices.rona-prices-command .rona-fin-filter{display:flex!important;justify-content:flex-end!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important;margin:0 0 10px!important;padding:0!important}#page-prices.rona-prices-command .rona-fin-filter button{min-height:29px!important;padding:6px 10px!important;border:1px solid rgba(121,164,193,.18)!important;border-radius:999px!important;background:rgba(5,13,21,.72)!important;color:#86a0b5!important;font-size:10px!important;font-weight:850!important;box-shadow:none!important;transform:none!important}#page-prices.rona-prices-command .rona-fin-filter button[aria-pressed="true"]{color:#f7fbff!important;border-color:rgba(89,215,255,.38)!important;background:linear-gradient(135deg,rgba(34,135,185,.22),rgba(74,88,184,.18))!important;box-shadow:inset 0 0 0 1px rgba(89,215,255,.08),0 7px 20px rgba(0,0,0,.16)!important}#page-prices.rona-prices-command .rona-prices2a-table{margin:0 0 15px!important;padding:0 0 3px!important;overflow:hidden!important;border:1px solid rgba(119,173,204,.18)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(8,18,28,.93),rgba(5,12,20,.89))!important;box-shadow:0 16px 40px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.028)!important;transform:none!important}#page-prices.rona-prices-command .rona-prices2a-table::after{display:none!important}#page-prices.rona-prices-command .rona-prices2a-table>h2{margin:0!important;padding:15px 17px 12px!important;border-bottom:1px solid rgba(116,166,196,.12)!important;font-size:17px!important;line-height:1.2!important;font-weight:900!important;letter-spacing:-.015em!important;color:#f5faff!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table-wrap{margin:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table{width:100%!important;min-width:760px!important;border-spacing:0!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table th{padding:10px 12px!important;background:rgba(4,11,18,.91)!important;border-bottom:1px solid rgba(89,215,255,.13)!important;color:#6f8da4!important;font-size:9px!important;line-height:1.25!important;font-weight:900!important;letter-spacing:.09em!important;text-transform:uppercase!important;white-space:nowrap!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table td{padding:12px!important;border-bottom:1px solid rgba(125,169,196,.075)!important;background:rgba(5,13,21,.30)!important;color:#c9d7e2!important;font-size:11px!important;line-height:1.32!important;vertical-align:middle!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table tbody tr:nth-child(even) td{background:rgba(11,24,35,.28)!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table tbody tr:hover td{background:rgba(45,112,151,.12)!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table td:first-child strong{font-size:12px!important;font-weight:900!important;letter-spacing:.005em!important;color:#f1f7fb!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table th:nth-child(n+4),#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table td:nth-child(n+4){text-align:center!important}#page-prices.rona-prices-command .rona-prices2a-table .rona-owner-table td:nth-child(n+4)>span:not(.rona-fin-pill){font-size:12px!important;font-weight:900!important;color:#f8fbff!important;font-variant-numeric:tabular-nums!important}#page-prices.rona-prices-command .rona-fin-pill{min-height:23px!important;padding:4px 7px!important;border-radius:999px!important;font-size:9px!important;font-weight:850!important;line-height:1.1!important;justify-content:center!important;text-align:center!important}#page-prices.rona-prices-command .rona-prices-terms,#page-prices.rona-prices-command .rona-prices-publication,#page-prices.rona-prices-command .rona-prices-history{margin:0 0 14px!important;padding:15px 17px!important;border:1px solid rgba(119,173,204,.16)!important;border-radius:17px!important;background:linear-gradient(145deg,rgba(9,21,32,.91),rgba(5,13,21,.86))!important;box-shadow:0 13px 34px rgba(0,0,0,.19),inset 0 1px 0 rgba(255,255,255,.026)!important;transform:none!important}#page-prices.rona-prices-command .rona-prices-terms::after,#page-prices.rona-prices-command .rona-prices-publication::after,#page-prices.rona-prices-command .rona-prices-history::after{display:none!important}#page-prices.rona-prices-command .rona-prices-terms>h2,#page-prices.rona-prices-command .rona-prices-publication>h2,#page-prices.rona-prices-command .rona-prices-history>h2{margin:0 0 12px!important;font-size:15px!important;font-weight:900!important;color:#f4f9fc!important}#page-prices.rona-prices-command .rona-prices2a-meta{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important}#page-prices.rona-prices-command .rona-prices2a-meta>div{position:relative;min-height:68px!important;padding:11px 12px 10px 14px!important;border:1px solid rgba(116,163,192,.13)!important;border-radius:11px!important;background:rgba(3,10,17,.48)!important;overflow:hidden!important}#page-prices.rona-prices-command .rona-prices2a-meta>div::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:2px;border-radius:2px;background:var(--price-cyan);opacity:.75}#page-prices.rona-prices-command .rona-prices2a-meta>div:nth-child(2)::before{background:var(--price-green)}#page-prices.rona-prices-command .rona-prices2a-meta>div:nth-child(3)::before{background:var(--price-amber)}#page-prices.rona-prices-command .rona-prices2a-meta .rona-owner-muted{font-size:9px!important;font-weight:850!important;letter-spacing:.07em!important;text-transform:uppercase!important;color:#6c889e!important}#page-prices.rona-prices-command .rona-prices2a-meta strong{display:block!important;margin-top:7px!important;font-size:12px!important;line-height:1.25!important;font-weight:900!important;color:#eef7fb!important}#page-prices.rona-prices-command .rona-prices-publication .rona-owner-actions{display:flex!important;gap:7px!important;flex-wrap:wrap!important;margin:0!important}#page-prices.rona-prices-command .rona-prices2a-publish{display:grid!important;grid-template-columns:auto minmax(180px,1fr) auto!important;gap:9px!important;align-items:center!important;margin-top:12px!important;padding:11px!important;border:1px solid rgba(116,163,192,.12)!important;border-radius:11px!important;background:rgba(3,10,17,.44)!important}#page-prices.rona-prices-command .rona-prices2a-publish>span{font-size:10px!important;font-weight:850!important;color:#7894a9!important}#page-prices.rona-prices-command .rona-prices2a-publish select,#page-prices.rona-prices-command .rona-prices2a-publish button{min-height:34px!important;margin:0!important;padding:7px 10px!important;border-radius:9px!important;font-size:10px!important;font-weight:850!important}#page-prices.rona-prices-command .rona-prices2a-publish select{border:1px solid rgba(121,170,199,.20)!important;background:#07131e!important;color:#eaf5fb!important}#page-prices.rona-prices-command .rona-prices2a-publish select option{color:#111827!important;background:#fff!important}#page-prices.rona-prices-command .rona-prices2a-publish button{border:1px solid rgba(89,215,255,.35)!important;background:linear-gradient(135deg,rgba(24,137,190,.34),rgba(69,83,185,.28))!important;color:#f6fbff!important;box-shadow:0 8px 20px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.06)!important;cursor:pointer!important}#page-prices.rona-prices-command .rona-prices2a-publish button:hover{border-color:rgba(89,215,255,.58)!important;background:linear-gradient(135deg,rgba(29,164,219,.40),rgba(82,98,211,.34))!important;transform:translateY(-1px)!important}#page-prices.rona-prices-command .rona-prices2a-publish button:disabled{opacity:.6!important;transform:none!important}#page-prices.rona-prices-command .rona-prices-publication>.rona-owner-muted,#page-prices.rona-prices-command .rona-prices-terms>.rona-owner-muted{font-size:10px!important;line-height:1.4!important;color:#718da3!important}#page-prices.rona-prices-command .rona-prices-history .rona-owner-table-wrap{border-color:rgba(116,163,192,.12)!important;background:rgba(3,10,17,.38)!important}@media(max-width:980px){#page-prices.rona-prices-command .rona-fin-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}#page-prices.rona-prices-command .rona-prices2a-meta{grid-template-columns:1fr!important}#page-prices.rona-prices-command .rona-prices2a-publish{grid-template-columns:1fr!important}}@media(max-width:620px){#page-prices.rona-prices-command .rona-fin-kpi-grid{grid-template-columns:1fr!important}#page-prices.rona-prices-command .rona-fin-filter{justify-content:flex-start!important}#page-prices.rona-prices-command .rona-prices2a-table>h2{font-size:15px!important}}';
  document.head.appendChild(s);
}
function applyPricesCommandVisual(){
  const page=document.getElementById('page-prices');if(!page)return;
  ensurePricesCommandStyle();page.classList.add('rona-prices-command');page.dataset.ronaPricesPresentation='command-center-v1';
  for(const card of page.querySelectorAll('.rona-owner-card')){
    const title=String(card.querySelector(':scope > h2')?.textContent||'').trim();
    card.classList.toggle('rona-prices-terms',title==='Условия прайса');
    card.classList.toggle('rona-prices-publication',title==='Публикация прайса');
    card.classList.toggle('rona-prices-history',title==='История решений');
  }
}
let pricesVisualQueued=false;
function schedulePricesVisual(){if(pricesVisualQueued)return;pricesVisualQueued=true;requestAnimationFrame(()=>{pricesVisualQueued=false;applyPricesCommandVisual()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedulePricesVisual,{once:true});else schedulePricesVisual();
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="prices"],#nav a[data-page="prices"],#nav [role="button"][data-page="prices"],#page-prices button,#page-prices select'))[0,50,160,420].forEach(ms=>setTimeout(schedulePricesVisual,ms))},true);
new MutationObserver(schedulePricesVisual).observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>{const p=document.getElementById('page-prices');if(p&&getComputedStyle(p).display!=='none')schedulePricesVisual()},1600);

if(window.__RONA_APPLICATION_RESOURCE_STAGE_LABELS_V1__)return;
window.__RONA_APPLICATION_RESOURCE_STAGE_LABELS_V1__=true;
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
function apply(){
  const root=document.getElementById('page-applications');if(!root)return;
  for(const el of root.querySelectorAll('h1,h2,h3,button,span,div')){
    const t=norm(el.textContent);
    if(t==='Требуют решения'&&el.childElementCount===0)el.textContent='Требует подтверждения';
    else if(/^Требует решения ¯ \d+$/.test(t)&&el.childElementCount===0)el.textContent=t.replace('Требует решения','Требует подтверждения');
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
