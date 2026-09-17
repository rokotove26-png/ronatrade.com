export default `(()=>{'use strict';
if(location.pathname!=='/portal/admin')return;

function ensurePaymentsPresentationStyle(){
  document.getElementById('ronaPaymentsFramePresentationV4')?.remove();
  let style=document.getElementById('ronaPaymentsFramePresentationV5');
  if(style)return;
  style=document.createElement('style');
  style.id='ronaPaymentsFramePresentationV5';
  style.textContent='#page-payments .rona-payments-v7{--pay-cyan:#63d8ff;--pay-green:#56dda1;--pay-amber:#ffc861;--pay-violet:#ad8cff;--pay-red:#ff7180;--pay-line:rgba(126,183,214,.18);--pay-line-strong:rgba(126,203,238,.32);--pay-text:#f3f8fc;--pay-muted:#829caf;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;gap:0!important;overflow:visible!important;font-family:"Segoe UI Variable Text","Segoe UI",Inter,Arial,sans-serif!important;font-feature-settings:"tnum" 1;font-variant-numeric:tabular-nums}#page-payments .rona-payments-v7::before{display:none!important;content:none!important}#page-payments .rona-payments-v7-board{margin-top:34px!important;display:grid!important;gap:10px!important}#page-payments .rona-payments-v7-kpis{gap:10px!important}#page-payments .rona-payments-v7-kpi{--pay-tone:var(--pay-cyan);position:relative!important;overflow:hidden!important;min-height:104px!important;padding:15px 16px 14px 18px!important;border:1px solid var(--pay-line)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(11,27,42,.96),rgba(6,17,29,.91))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 28px rgba(0,0,0,.16)!important;transition:border-color .16s ease,background .16s ease,transform .16s ease,box-shadow .16s ease!important}#page-payments .rona-payments-v7-kpi::before{content:""!important;display:block!important;position:absolute!important;left:0!important;top:11px!important;bottom:11px!important;width:3px!important;border-radius:0 5px 5px 0!important;background:var(--pay-tone)!important;box-shadow:0 0 18px var(--pay-tone)!important;opacity:.92!important}#page-payments .rona-payments-v7-kpi::after{content:""!important;display:block!important;position:absolute!important;left:16px!important;right:16px!important;top:0!important;height:1px!important;background:linear-gradient(90deg,var(--pay-tone),transparent 72%)!important;opacity:.34!important}#page-payments .rona-payments-v7-kpi:hover{transform:translateY(-1px)!important;border-color:var(--pay-line-strong)!important;background:linear-gradient(155deg,rgba(14,34,52,.98),rgba(7,20,34,.94))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 14px 32px rgba(0,0,0,.21)!important}#page-payments .rona-payments-v7-kpi[data-tone="total"]{--pay-tone:var(--pay-cyan)}#page-payments .rona-payments-v7-kpi[data-tone="received"]{--pay-tone:var(--pay-green)}#page-payments .rona-payments-v7-kpi[data-tone="expected"]{--pay-tone:var(--pay-amber)}#page-payments .rona-payments-v7-kpi[data-tone="conditional"]{--pay-tone:var(--pay-violet)}#page-payments .rona-payments-v7-kpi[data-tone="spent"]{--pay-tone:#72dceb}#page-payments .rona-payments-v7-kpi-label{display:flex!important;align-items:center!important;gap:7px!important;margin:0 0 8px!important;color:#91a9bb!important;font-size:10.5px!important;line-height:1.2!important;font-weight:760!important;letter-spacing:.075em!important;text-transform:uppercase!important}#page-payments .rona-payments-v7-kpi-label::before{content:""!important;display:block!important;width:6px!important;height:6px!important;min-width:6px!important;border-radius:50%!important;background:var(--pay-tone)!important;box-shadow:0 0 10px var(--pay-tone)!important}#page-payments .rona-payments-v7-kpi-value{display:block!important;color:var(--pay-text)!important;font-size:clamp(18px,1.28vw,27px)!important;line-height:1.04!important;font-weight:820!important;letter-spacing:-.026em!important;font-variant-numeric:tabular-nums!important}#page-payments .rona-payments-v7-kpi[data-tone="received"] .rona-payments-v7-kpi-value{color:#dcffed!important}#page-payments .rona-payments-v7-kpi[data-tone="expected"] .rona-payments-v7-kpi-value{color:#fff0bf!important}#page-payments .rona-payments-v7-kpi[data-tone="conditional"] .rona-payments-v7-kpi-value{color:#eee7ff!important}#page-payments .rona-payments-v7-kpi small{color:#7892a5!important;font-size:9.5px!important;line-height:1.35!important;font-weight:650!important}#page-payments .rona-payments-v7-deal{position:relative!important;overflow:hidden!important;min-height:64px!important;border:1px solid rgba(119,176,207,.14)!important;border-radius:12px!important;background:linear-gradient(180deg,rgba(7,20,33,.91),rgba(6,17,29,.87))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.022),0 5px 18px rgba(0,0,0,.10)!important;transition:border-color .15s ease,background .15s ease,transform .15s ease,box-shadow .15s ease!important}#page-payments .rona-payments-v7-deal::before{content:""!important;display:block!important;position:absolute!important;left:0!important;top:10px!important;bottom:10px!important;width:2px!important;border-radius:0 4px 4px 0!important;background:linear-gradient(180deg,var(--pay-cyan),rgba(99,216,255,.18))!important;box-shadow:0 0 14px rgba(99,216,255,.32)!important;opacity:.9!important}#page-payments .rona-payments-v7-deal:hover{transform:translateY(-1px)!important;border-color:rgba(99,216,255,.28)!important;background:linear-gradient(180deg,rgba(10,27,44,.95),rgba(7,20,34,.92))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 10px 24px rgba(0,0,0,.16)!important}#page-payments .rona-payments-v7-deal-cell{--cell-tone:#718da2;position:relative!important;min-width:0!important;padding:10px 13px!important;border-left:1px solid rgba(119,176,207,.075)!important}#page-payments .rona-payments-v7-deal-cell:first-of-type{border-left:0!important}#page-payments .rona-payments-v7-deal-cell[data-tone="total"]{--cell-tone:var(--pay-cyan)}#page-payments .rona-payments-v7-deal-cell[data-tone="received"]{--cell-tone:var(--pay-green)}#page-payments .rona-payments-v7-deal-cell[data-tone="expected"]{--cell-tone:var(--pay-amber)}#page-payments .rona-payments-v7-deal-cell[data-tone="conditional"]{--cell-tone:var(--pay-violet)}#page-payments .rona-payments-v7-deal-cell[data-tone="spent"]{--cell-tone:#72dceb}#page-payments .rona-payments-v7-deal-cell>span{display:flex!important;align-items:center!important;gap:6px!important;margin-bottom:5px!important;color:#718ba0!important;font-size:9.2px!important;line-height:1.2!important;font-weight:760!important;letter-spacing:.06em!important;text-transform:uppercase!important}#page-payments .rona-payments-v7-deal-cell>span::before{content:""!important;display:block!important;width:5px!important;height:5px!important;min-width:5px!important;border-radius:50%!important;background:var(--cell-tone)!important;box-shadow:0 0 8px var(--cell-tone)!important;opacity:.96!important}#page-payments .rona-payments-v7-deal-cell>strong{display:block!important;color:#edf5fb!important;font-size:13.5px!important;line-height:1.18!important;font-weight:790!important;letter-spacing:-.012em!important;font-variant-numeric:tabular-nums!important}#page-payments .rona-payments-v7-deal-cell[data-tone="received"]>strong{color:#cffff0!important}#page-payments .rona-payments-v7-deal-cell[data-tone="expected"]>strong{color:#ffe4a0!important}#page-payments .rona-payments-v7-deal-cell[data-tone="conditional"]>strong{color:#e6dcff!important}#page-payments .rona-payments-v7-deal-cell[data-tone="spent"]>strong{color:#d5f8ff!important}#page-payments .rona-payments-v7-deal-cell>small{display:block!important;margin-top:4px!important;color:#718a9d!important;font-size:9.2px!important;line-height:1.3!important;font-weight:600!important}#page-payments .rona-payments-v7-deal-cell[data-alert="verify"]{background:linear-gradient(180deg,rgba(255,113,128,.035),transparent)!important}#page-payments .rona-payments-v7-deal-cell[data-alert="verify"]>span::before{background:var(--pay-red)!important;box-shadow:0 0 10px var(--pay-red)!important}#page-payments .rona-payments-v7-deal-cell[data-alert="verify"]>strong,#page-payments .rona-payments-v7-deal-cell[data-alert="verify"]>small{color:#ffb6bf!important}#page-payments [data-state-tone="conditional"]{display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;padding:3px 7px!important;border:1px solid rgba(173,140,255,.30)!important;border-radius:999px!important;background:rgba(173,140,255,.08)!important;color:#cdbaff!important;font-size:8.5px!important;line-height:1.2!important;font-weight:800!important;letter-spacing:.07em!important;text-transform:uppercase!important}#page-payments .rona-payments-v7-native-spend{display:grid;gap:3px}#page-payments .rona-payments-v7-native-spend strong{display:block;font-variant-numeric:tabular-nums}#page-payments .rona-payments-v7-native-note{display:block;margin-top:4px;font-size:9.2px;line-height:1.3;font-weight:650;color:#7894aa}#page-payments .rona-payments-v7-native-note.warn{color:#ffc169}#page-payments .rona-payments-v7-deal button{min-height:30px!important;padding:0 10px!important;border:1px solid rgba(105,184,221,.20)!important;border-radius:9px!important;background:rgba(17,43,65,.54)!important;color:#dcecf6!important;font-size:10px!important;font-weight:760!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important}#page-payments .rona-payments-v7-deal button:hover{border-color:rgba(99,216,255,.40)!important;background:rgba(21,58,86,.68)!important;color:#fff!important}@media(max-width:760px){#page-payments .rona-payments-v7-board{margin-top:26px!important}#page-payments .rona-payments-v7-kpi{min-height:96px!important;padding:14px 14px 13px 17px!important}#page-payments .rona-payments-v7-deal-cell{padding:9px 10px!important}}@media(prefers-reduced-motion:reduce){#page-payments .rona-payments-v7-kpi,#page-payments .rona-payments-v7-deal{transition:none!important}#page-payments .rona-payments-v7-kpi:hover,#page-payments .rona-payments-v7-deal:hover{transform:none!important}}';
  document.head.appendChild(style);
}

const spendUpper=v=>String(v??'').trim().toUpperCase();
const spendNum=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
function spendMoney(amount,currency){
  const n=spendNum(amount),c=spendUpper(currency);
  return n!==null&&c?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(n))+' '+c:'TO_VERIFY';
}
function spendCell(article){return Array.from(article?.querySelectorAll?.('.rona-payments-v7-deal-cell')||[]).find(cell=>String(cell.querySelector('span')?.textContent||'').trim()==='Потрачено / Остаток')||null}
function authoritativeAccountingCurrency(deal){
  const value=deal?.accounting_currency,currency=spendUpper(value?.currency),status=spendUpper(value?.status);
  return status==='AUTHORITATIVE'&&/^[A-Z]{3}$/.test(currency)?currency:'';
}
function authoritativeDealMoney(value,currency){
  const amount=spendNum(value?.amount),valueCurrency=spendUpper(value?.currency),status=spendUpper(value?.status);
  return status==='AUTHORITATIVE'&&amount!==null&&valueCurrency===currency?{amount,currency}:null;
}
function aggregateDealMoney(rows){
  const map=new Map();
  for(const row of Array.isArray(rows)?rows:[]){
    const amount=spendNum(row?.amount),currency=spendUpper(row?.currency);if(amount===null||!currency)continue;
    map.set(currency,(map.get(currency)||0)+amount);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([currency,amount])=>({currency,amount}));
}
function spendMoneyList(rows){return (Array.isArray(rows)?rows:[]).map(x=>spendMoney(x.amount,x.currency)).filter(Boolean).join(' · ')||'TO_VERIFY'}
function spendModel(data){
  const projection=data?.paymentsV7Projection;
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7')return null;
  const deals=new Map(),spentRows=[],remainingRows=[];
  let allReady=true;
  for(const deal of Array.isArray(projection.deals)?projection.deals:[]){
    const id=String(deal?.deal_id||''),currency=authoritativeAccountingCurrency(deal),actualStatus=spendUpper(deal?.actual_spend_status);
    const spent=currency&&actualStatus==='AUTHORITATIVE'?authoritativeDealMoney(deal?.actual_spend,currency):null;
    const remaining=currency&&actualStatus==='AUTHORITATIVE'?authoritativeDealMoney(deal?.remaining_execution,currency):null;
    const ready=!!currency&&!!spent&&!!remaining;
    if(!ready)allReady=false;
    if(spent)spentRows.push(spent);
    if(remaining)remainingRows.push(remaining);
    deals.set(id,{currency,spent,remaining,ready,issues:Array.isArray(deal?.actual_spend_issues)?deal.actual_spend_issues:[]});
  }
  return {deals,allReady,spent:allReady?aggregateDealMoney(spentRows):[],remaining:allReady?aggregateDealMoney(remainingRows):[],sourceAsOf:projection.source_as_of||data?.financeFragment?.sourceAsOf||null};
}
function setSpendKpi(payments,model){
  const kpi=Array.from(payments.querySelectorAll('.rona-payments-v7-kpi')).find(k=>String(k.querySelector('.rona-payments-v7-kpi-label')?.textContent||'').trim()==='Потрачено / Остаток');
  if(!kpi)return;
  const label=kpi.querySelector('.rona-payments-v7-kpi-label');
  for(const child of Array.from(kpi.children))if(child!==label)child.remove();
  const box=document.createElement('div');box.className='rona-payments-v7-native-spend';
  const value=document.createElement('strong');value.className='rona-payments-v7-kpi-value';
  value.textContent=model.allReady?spendMoneyList(model.spent):'TO_VERIFY';box.appendChild(value);
  const note=document.createElement('small');note.className='rona-payments-v7-native-note';
  note.textContent=model.allReady?'Потрачено — строго в валюте суммы каждой сделки':'Потрачено — только source-locked данные в валюте суммы сделки';box.appendChild(note);
  const residue=document.createElement('small');residue.className='rona-payments-v7-native-note';
  residue.textContent='Остаток: '+(model.allReady?spendMoneyList(model.remaining):'TO_VERIFY');box.appendChild(residue);
  kpi.appendChild(box);
}
function applyFinanceSpend(payments,data){
  const model=spendModel(data);if(!model)return false;
  for(const article of payments.querySelectorAll('.rona-payments-v7-deal[data-deal-id]')){
    const d=model.deals.get(String(article.dataset.dealId||''));if(!d)continue;
    const cell=spendCell(article);if(!cell)continue;
    const strong=cell.querySelector('strong');if(!strong)continue;
    let small=cell.querySelector('small');if(!small){small=document.createElement('small');cell.appendChild(small)}
    if(d.ready){
      strong.textContent=spendMoney(d.spent.amount,d.currency);
      small.textContent='Остаток: '+spendMoney(d.remaining.amount,d.currency);
    }else{
      strong.textContent='TO_VERIFY';
      small.textContent='Остаток: TO_VERIFY'+(d.currency?' · Валюта сделки: '+d.currency:'');
    }
  }
  setSpendKpi(payments,model);
  payments.dataset.financeSpendSource='FINANCE_V23_ACCOUNTING_CURRENCY_STRICT';
  decoratePaymentsPresentation(payments);
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
      if(r.ok&&data?.paymentsV7Projection?.contract==='ADMIN_PAYMENTS_V7'){financeSpendData=data;financeSpendFetchedAt=Date.now();return data}
    }catch(_){ }
    return null;
  })().finally(()=>{financeSpendPromise=null});
  return financeSpendPromise;
}
function refreshFinanceSpend(payments){
  if(financeSpendData)applyFinanceSpend(payments,financeSpendData);
  fetchFinanceSpend().then(data=>{if(data&&document.contains(payments))applyFinanceSpend(payments,data)});
}

function paymentsPresentationTone(label){
  const t=String(label||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
  if(t.includes('получено')||t.includes('поступило'))return'received';
  if(t.includes('ожидается сейчас')||t==='ожидается')return'expected';
  if(t.includes('conditional')||t.includes('условн'))return'conditional';
  if(t.includes('потрачено')||t.includes('остаток'))return'spent';
  if(t.includes('сумма по сделке')||t.includes('сумма по сделкам')||t.includes('к получению'))return'total';
  return'';
}
function decoratePaymentsPresentation(payments){
  if(!payments)return;
  for(const kpi of payments.querySelectorAll('.rona-payments-v7-kpi')){
    const label=kpi.querySelector('.rona-payments-v7-kpi-label');
    const tone=paymentsPresentationTone(label?.textContent||'');
    if(tone)kpi.dataset.tone=tone;else delete kpi.dataset.tone;
  }
  for(const cell of payments.querySelectorAll('.rona-payments-v7-deal-cell')){
    const label=cell.querySelector(':scope > span');
    const tone=paymentsPresentationTone(label?.textContent||'');
    if(tone)cell.dataset.tone=tone;else delete cell.dataset.tone;
    const valueText=Array.from(cell.querySelectorAll('strong,small')).map(x=>String(x.textContent||'')).join(' ').toUpperCase();
    if(valueText.includes('TO_VERIFY'))cell.dataset.alert='verify';else delete cell.dataset.alert;
  }
  for(const el of payments.querySelectorAll('small,span')){
    const t=String(el.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
    if(t==='CONDITIONAL')el.dataset.stateTone='conditional';
    else if(el.dataset.stateTone==='conditional')delete el.dataset.stateTone;
  }
  payments.dataset.presentation='status-visual-v5';
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
    const board=payments.querySelector('.rona-payments-v7-board');if(board){board.style.setProperty('grid-template-columns','minmax(0,1fr)','important');board.style.setProperty('margin-top',mobile?'26px':'34px','important')}
    for(const label of payments.querySelectorAll('.rona-payments-v7-kpi-label,.rona-payments-v7-deal-cell>span'))if(String(label.textContent||'').trim()==='К получению')label.textContent='Сумма по сделке';
    decoratePaymentsPresentation(payments);
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
