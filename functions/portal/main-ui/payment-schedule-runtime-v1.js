export default String.raw`
(()=>{
  const RUNTIME='20260912-payment-schedule-v2';
  const ENDPOINT='/portal/payment-schedule-current';
  window.__RONA_ADMIN_PAYMENT_SCHEDULE_RUNTIME_V1__=RUNTIME;
  window.__RONA_ADMIN_PAYMENT_SCHEDULE_RUNTIME_V2__=RUNTIME;
  let current=null,inflight=null,lastError=null;

  const text=value=>value===null||value===undefined||value===''?'TO_VERIFY':String(value);
  const amount=(value,currency)=>{
    if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return'TO_VERIFY';
    return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value))+(currency?' '+currency:'');
  };
  const node=(tag,attrs={},children=[])=>{const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else el.setAttribute(k,String(v))}for(const child of children){if(child)el.append(child)}return el};
  const cell=value=>node('td',{text:value});

  function projectionHost(){
    const page=document.querySelector('#page-payments');
    if(!page)return null;
    return page.querySelector(':scope > .rona-owner-page-content[data-owner-page="payments"]')||page.querySelector(':scope > .rona-owner-page-content')||page.firstElementChild||page;
  }

  function render(){
    const host=projectionHost();
    if(!host||!current)return;
    const existing=document.getElementById('rona-payment-schedule-v1');
    const revision=String(current.generatedAt||'unknown');
    if(existing&&existing.dataset.revision===revision)return;
    if(existing)existing.remove();

    const card=node('div',{id:'rona-payment-schedule-v1',class:'rona-owner-card','data-revision':revision});
    card.append(node('h3',{text:'График платежей по сделкам'}));
    card.append(node('div',{class:'rona-owner-muted',text:'Finance-authoritative server projection · frontend расчёт графика отключён'}));
    const wrap=node('div',{class:'rona-owner-table-wrap'}),table=node('table',{class:'rona-owner-table'}),thead=node('thead'),head=node('tr');
    for(const label of ['Deal ID','Обязательство клиента','Получено / VERIFIED','Остаток','К оплате сейчас / CURRENT DUE','Отложено / NOT DUE','Условие следующего транша','Статус trigger','Банковский факт','Allocation','Finance','Accounting','Outgoing USD-equivalent'])head.append(node('th',{text:label}));
    thead.append(head);table.append(thead);
    const tbody=node('tbody');
    for(const row of Array.isArray(current.schedules)?current.schedules:[]){
      const tr=node('tr',{'data-schedule-deal':text(row.dealId),'data-schedule-state':text(row.scheduleState),'data-projection-status':text(row.projectionStatus)});
      tr.append(
        cell(text(row.dealId)),
        cell(amount(row.obligationAmount,row.currency)),
        cell(amount(row.verifiedReceivedAmount,row.currency)),
        cell(amount(row.remainingAmount,row.currency)),
        cell(amount(row.currentDueAmount,row.currency)),
        cell(amount(row.deferredNotDueAmount,row.currency)),
        cell(text(row.nextTrancheCondition)),
        cell(text(row.triggerState)),
        cell(text(row.bankFactStatus)),
        cell(text(row.allocationStatus)),
        cell(text(row.financeStatus)),
        cell(text(row.accountingClosureStatus)),
        cell(row.outgoingUsdEquivalent===null||row.outgoingUsdEquivalent===undefined?text(row.outgoingUsdEquivalentStatus):amount(row.outgoingUsdEquivalent,'USD'))
      );
      tbody.append(tr);
    }
    table.append(tbody);wrap.append(table);card.append(wrap);
    const anchor=host.querySelector('.rona-fin-filter');
    if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(card,anchor.nextSibling);else host.prepend(card);
    window.__RONA_PAYMENT_SCHEDULE_RENDERED_AT__=revision;
  }

  async function refresh(){
    if(inflight)return inflight;
    inflight=(async()=>{
      try{
        const response=await fetch(ENDPOINT,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
        const payload=await response.json().catch(()=>null);
        if(!response.ok||payload?.ok===false||!payload?.data)throw new Error(String(payload?.code||('HTTP_'+response.status)));
        if(payload.data.projectionContract!=='ADMIN_PAYMENTS_SCHEDULE_AUTHORITY_V2')throw new Error('PAYMENT_SCHEDULE_CONTRACT_MISMATCH');
        current=payload.data;lastError=null;window.__RONA_PAYMENT_SCHEDULE_CURRENT_STATE__=current;render();
      }catch(error){lastError=String(error?.message||error);window.__RONA_PAYMENT_SCHEDULE_LAST_ERROR__=lastError}
      finally{inflight=null}
    })();
    return inflight;
  }

  const observer=new MutationObserver(()=>{if(current)queueMicrotask(render)});
  const start=()=>{
    observer.observe(document.documentElement,{subtree:true,childList:true});
    refresh();
    window.setInterval(refresh,60000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    window.addEventListener('pageshow',refresh);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.__RONA_PAYMENT_SCHEDULE_REFRESH__=refresh;
})();
`;
