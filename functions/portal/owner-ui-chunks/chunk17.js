export default `(()=>{'use strict';
if(location.pathname!=='/portal/admin')return;

function ensurePaymentsPresentationStyle(){
  let style=document.getElementById('ronaPaymentsFramePresentationV3');
  if(style)return;
  style=document.createElement('style');
  style.id='ronaPaymentsFramePresentationV3';
  style.textContent='#page-payments .rona-payments-v7{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important;gap:0!important;overflow:visible!important}#page-payments .rona-payments-v7::before{display:none!important;content:none!important}#page-payments .rona-payments-v7-board{margin-top:40px!important}#page-payments .rona-payments-v7-native-spend{display:grid;gap:3px}#page-payments .rona-payments-v7-native-spend strong{display:block;font-variant-numeric:tabular-nums}#page-payments .rona-payments-v7-native-note{display:block;margin-top:4px;font-size:9px;line-height:1.25;font-weight:750;color:#7894aa}#page-payments .rona-payments-v7-native-note.warn{color:#ffc169}@media(max-width:760px){#page-payments .rona-payments-v7-board{margin-top:26px!important}}';
  document.head.appendChild(style);
}

function nativeMoney(v){
  const n=Number(v?.amount),c=String(v?.currency||'').trim().toUpperCase();
  return Number.isFinite(n)&&c?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' '+c:'TO_VERIFY';
}
function nativeMoneyList(rows){
  return (Array.isArray(rows)?rows:[]).map(nativeMoney).filter(Boolean).join(' · ')||'TO_VERIFY';
}
function spendCell(article){
  return Array.from(article?.querySelectorAll?.('.rona-payments-v7-deal-cell')||[]).find(cell=>String(cell.querySelector('span')?.textContent||'').trim()==='Потрачено / Остаток')||null;
}
function applyNativeSpendProjection(payments){
  const projection=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection;
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7'||!projection.actual_spend_native_summary)return;
  const deals=new Map((Array.isArray(projection.deals)?projection.deals:[]).map(d=>[String(d?.deal_id||''),d]));
  for(const article of payments.querySelectorAll('.rona-payments-v7-deal[data-deal-id]')){
    const deal=deals.get(String(article.dataset.dealId||''));
    if(!deal)continue;
    const cell=spendCell(article);
    if(!cell)continue;
    const strong=cell.querySelector('strong');
    let small=cell.querySelector('small');
    if(!small){small=document.createElement('small');cell.appendChild(small)}
    const status=String(deal.actual_spend_native_status||'').toUpperCase();
    const native=Array.isArray(deal.actual_spend_native)?deal.actual_spend_native:[];
    const unresolved=Array.isArray(deal.actual_spend_native_unresolved_scope)?deal.actual_spend_native_unresolved_scope:[];
    if((status==='AUTHORITATIVE'||status==='PARTIAL_TO_VERIFY')&&native.length){
      strong.textContent=nativeMoneyList(native);
      const remaining=deal?.remaining_execution;
      const remainingReady=String(remaining?.status||'').toUpperCase()==='AUTHORITATIVE';
      small.textContent='Остаток: '+(remainingReady?nativeMoney(remaining):'TO_VERIFY');
      if(status==='PARTIAL_TO_VERIFY'&&unresolved.length)small.textContent+=' · Без распределения: '+nativeMoneyList(unresolved);
    }else if(status==='TO_VERIFY'&&unresolved.length){
      strong.textContent='TO_VERIFY';
      small.textContent='Общий расход без распределения: '+nativeMoneyList(unresolved);
    }
  }
  const summary=projection.actual_spend_native_summary;
  const spendKpi=Array.from(payments.querySelectorAll('.rona-payments-v7-kpi')).find(k=>String(k.querySelector('.rona-payments-v7-kpi-label')?.textContent||'').trim()==='Потрачено / Остаток');
  if(spendKpi){
    const label=spendKpi.querySelector('.rona-payments-v7-kpi-label');
    for(const child of Array.from(spendKpi.children))if(child!==label)child.remove();
    const box=document.createElement('div');box.className='rona-payments-v7-native-spend';
    const exact=document.createElement('strong');exact.className='rona-payments-v7-kpi-value';exact.textContent=nativeMoneyList(summary.totals);
    box.appendChild(exact);
    const note=document.createElement('small');note.className='rona-payments-v7-native-note';note.textContent='Подтвержденный фактический расход';box.appendChild(note);
    const unresolved=Array.isArray(summary.unresolved_scope_totals)?summary.unresolved_scope_totals:[];
    if(unresolved.length){const warn=document.createElement('small');warn.className='rona-payments-v7-native-note warn';warn.textContent='Без распределения по сделкам: '+nativeMoneyList(unresolved);box.appendChild(warn)}
    const residue=document.createElement('small');residue.className='rona-payments-v7-native-note';residue.textContent='Остаток в валюте учета: TO_VERIFY до точной bank/Treasury связи';box.appendChild(residue);
    spendKpi.appendChild(box);
  }
}

function applyPaymentsFrame(){
  const page=document.getElementById('page-payments');
  if(!page)return;
  ensurePaymentsPresentationStyle();
  const mobile=window.innerWidth<=760;
  const pageWidth=Math.max(0,page.clientWidth||page.getBoundingClientRect().width||0);
  const target=mobile?'100%':Math.max(1,Math.round(pageWidth*0.75))+'px';
  for(const el of Array.from(page.children).filter(el=>el&&el.nodeType===1)){
    el.style.setProperty('width',target,'important');
    el.style.setProperty('max-width',target,'important');
    el.style.setProperty('min-width','0','important');
    el.style.setProperty('margin-left','auto','important');
    el.style.setProperty('margin-right','auto','important');
    el.style.setProperty('box-sizing','border-box','important');
  }
  const host=page.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"],:scope > .rona-owner-page-content');
  if(host){
    for(const [k,v] of [['width',target],['max-width',target],['min-width','0'],['margin-left','auto'],['margin-right','auto'],['padding-left','0'],['padding-right','0'],['box-sizing','border-box']])host.style.setProperty(k,v,'important');
    for(const child of Array.from(host.children)){
      if(!child||child.nodeType!==1)continue;
      for(const [k,v] of [['width','100%'],['max-width','100%'],['min-width','0'],['margin-left','0'],['margin-right','0'],['box-sizing','border-box']])child.style.setProperty(k,v,'important');
    }
  }
  const payments=page.querySelector('.rona-payments-v7');
  if(payments){
    for(const [k,v] of [['width','100%'],['max-width','100%'],['min-width','0'],['margin-left','0'],['margin-right','0'],['box-sizing','border-box'],['background','transparent'],['border','0'],['box-shadow','none'],['padding','0'],['gap','0'],['overflow','visible']])payments.style.setProperty(k,v,'important');
    const board=payments.querySelector('.rona-payments-v7-board');
    if(board){
      board.style.setProperty('grid-template-columns','minmax(0,1fr)','important');
      board.style.setProperty('margin-top',mobile?'26px':'40px','important');
    }
    for(const label of payments.querySelectorAll('.rona-payments-v7-kpi-label,.rona-payments-v7-deal-cell>span')){
      if(String(label.textContent||'').trim()==='К получению')label.textContent='Сумма по сделке';
    }
    applyNativeSpendProjection(payments);
  }
  page.dataset.ronaPaymentsFrameWidth=target;
}

let paymentsFrameQueued=false;
function schedulePaymentsFrame(){
  if(paymentsFrameQueued)return;
  paymentsFrameQueued=true;
  requestAnimationFrame(()=>{paymentsFrameQueued=false;applyPaymentsFrame()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedulePaymentsFrame,{once:true});else schedulePaymentsFrame();
window.addEventListener('resize',schedulePaymentsFrame,{passive:true});
window.addEventListener('rona:finance-sync',schedulePaymentsFrame);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="payments"],#nav a[data-page="payments"],#nav [role="button"][data-page="payments"]'))[0,60,180,500].forEach(ms=>setTimeout(schedulePaymentsFrame,ms))},true);
new MutationObserver(schedulePaymentsFrame).observe(document.documentElement,{childList:true,subtree:true});
setInterval(()=>{const p=document.getElementById('page-payments');if(p&&getComputedStyle(p).display!=='none')schedulePaymentsFrame()},1500);

if(window.__RONA_APPLICATION_RESOURCE_STAGE_LABELS_V1__)return;
window.__RONA_APPLICATION_RESOURCE_STAGE_LABELS_V1__=true;
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
function apply(){
  const root=document.getElementById('page-applications');
  if(!root)return;
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
let queued=false;
const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-authority-refresh',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="applications"],#page-applications button'))setTimeout(schedule,0)},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();`;
