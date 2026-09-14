export default `(()=>{'use strict';
if(location.pathname!=='/portal/admin')return;

function applyPaymentsFrame(){
  const page=document.getElementById('page-payments');
  if(!page)return;
  const mobile=window.innerWidth<=760;
  const pageWidth=Math.max(0,page.clientWidth||page.getBoundingClientRect().width||0);
  const target=mobile?'100%':Math.max(1,Math.round(pageWidth*0.60))+'px';
  const children=Array.from(page.children).filter(el=>el&&el.nodeType===1);
  for(const el of children){
    el.style.setProperty('width',target,'important');
    el.style.setProperty('max-width',target,'important');
    el.style.setProperty('min-width','0','important');
    el.style.setProperty('margin-left','auto','important');
    el.style.setProperty('margin-right','auto','important');
    el.style.setProperty('box-sizing','border-box','important');
  }
  const host=page.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"],:scope > .rona-owner-page-content');
  if(host){
    host.style.setProperty('width',target,'important');
    host.style.setProperty('max-width',target,'important');
    host.style.setProperty('min-width','0','important');
    host.style.setProperty('margin-left','auto','important');
    host.style.setProperty('margin-right','auto','important');
    host.style.setProperty('padding-left','0','important');
    host.style.setProperty('padding-right','0','important');
    host.style.setProperty('box-sizing','border-box','important');
    for(const child of Array.from(host.children)){
      if(!child||child.nodeType!==1)continue;
      child.style.setProperty('width','100%','important');
      child.style.setProperty('max-width','100%','important');
      child.style.setProperty('min-width','0','important');
      child.style.setProperty('margin-left','0','important');
      child.style.setProperty('margin-right','0','important');
      child.style.setProperty('box-sizing','border-box','important');
    }
  }
  const payments=page.querySelector('.rona-payments-v7');
  if(payments){
    payments.style.setProperty('width','100%','important');
    payments.style.setProperty('max-width','100%','important');
    payments.style.setProperty('min-width','0','important');
    payments.style.setProperty('margin-left','0','important');
    payments.style.setProperty('margin-right','0','important');
    payments.style.setProperty('box-sizing','border-box','important');
    const board=payments.querySelector('.rona-payments-v7-board');
    if(board)board.style.setProperty('grid-template-columns','minmax(0,1fr)','important');
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
let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-authority-refresh',schedule);
document.addEventListener('click',ev=>{if(ev.target?.closest?.('#nav button[data-page="applications"],#page-applications button'))setTimeout(schedule,0)},true);
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();`;
