export const PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT = 'PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V2';
export const PAYMENTS_RECONCILIATION_DIFFERENCE_REFRESH_MS = 30000;

export const PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME = String.raw`(()=>{
  const contract='PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V2';
  const sourceContract='FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_V1';
  const refreshMs=30000;
  const rootSelector='#page-payments .rona-payments-v7';
  const elementId='rona-payments-reconciliation-difference';
  const dialogId='rona-payments-reconciliation-difference-dialog';
  const styleId='rona-payments-reconciliation-difference-style';
  const bootstrapPath='/portal/api/v1/admin/bootstrap';
  const allowedCurrencies=new Set(['USD','RUB']);
  const allowedDirections=new Set(['PROFICIT','DEFICIT']);

  function exactDecimalString(value){
    const raw=String(value??'').trim().replace(',', '.');
    return /^-?\\d+(?:\\.\\d+)?$/.test(raw)?raw:null;
  }

  function formatExactDecimal(value){
    const raw=exactDecimalString(value);
    if(raw===null)return'—';
    const negative=raw.startsWith('-');
    const unsigned=negative?raw.slice(1):raw;
    const [whole,fraction='']=unsigned.split('.');
    const grouped=whole.replace(/\\B(?=(\\d{3})+(?!\\d))/g,' ');
    return (negative?'−':'')+grouped+(fraction?','+fraction:'');
  }

  function normalizeBreakdown(lines){
    if(!Array.isArray(lines))return[];
    const out=[],seen=new Set();
    for(const line of lines){
      const currency=String(line?.currency||'').trim().toUpperCase();
      const direction=String(line?.direction||line?.result_status||'').trim().toUpperCase();
      const amount=exactDecimalString(line?.amount);
      if(!allowedCurrencies.has(currency)||!allowedDirections.has(direction)||amount===null||seen.has(currency))continue;
      seen.add(currency);
      out.push({currency,direction,amount});
    }
    return out;
  }

  function normalize(metric){
    const status=String(metric?.status||'').trim().toUpperCase();
    const amount=metric?.amount;
    const currency=String(metric?.currency||'').trim().toUpperCase();
    const publisher=String(metric?.publisher_identity||'').trim().toUpperCase();
    const role=String(metric?.functional_role||'').trim().toUpperCase();
    const source=String(metric?.source_contract||'').trim();
    const n=amount===null||amount===undefined?NaN:Number(amount);
    const authoritative=status==='AUTHORITATIVE'&&Number.isFinite(n)&&/^[A-Z]{3}$/.test(currency)&&publisher==='AI-FINANCE'&&role==='FINANCE'&&source===sourceContract&&metric?.source_locked===true;
    if(!authoritative)return{status:'TO_VERIFY',text:'—',sourceId:String(metric?.source_id||''),sourceVersion:String(metric?.source_version||''),breakdown:[]};
    const formatted=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n));
    const sign=n>0?'+':n<0?'−':'';
    return{
      status:'AUTHORITATIVE',
      text:sign+formatted+' '+currency,
      sourceId:String(metric?.source_id||''),
      sourceVersion:String(metric?.source_version||''),
      breakdown:normalizeBreakdown(metric?.breakdown||metric?.primary_breakdown||metric?.components),
    };
  }

  function currentSnapshotMetric(){
    return window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE__
      || window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection?.finance_reconciliation_difference
      || null;
  }

  function installStyle(){
    if(document.getElementById(styleId))return;
    const style=document.createElement('style');
    style.id=styleId;
    style.textContent='#page-payments .rona-payments-v7{position:relative}#page-payments .rona-payments-reconciliation-difference{position:absolute;top:0;right:0;z-index:1;display:flex;align-items:baseline;gap:8px;white-space:nowrap;max-width:calc(100% - 150px);padding:0;border:0;background:transparent;color:inherit;cursor:pointer;text-align:right;font:inherit}#page-payments .rona-payments-reconciliation-difference-value{overflow:hidden;text-overflow:ellipsis}#page-payments .rona-payments-reconciliation-difference[data-status=TO_VERIFY]{cursor:default}.rona-payments-reconciliation-dialog{position:fixed;inset:0;z-index:2147483638;display:grid;place-items:center;padding:20px;background:rgba(2,6,23,.72);backdrop-filter:blur(4px)}.rona-payments-reconciliation-dialog__panel{width:min(560px,100%);border:1px solid rgba(93,215,255,.22);border-radius:18px;background:#071321;color:#eefaff;box-shadow:0 28px 80px rgba(0,0,0,.5);padding:18px}.rona-payments-reconciliation-dialog__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.rona-payments-reconciliation-dialog__close{border:1px solid rgba(128,181,214,.22);border-radius:9px;background:transparent;color:inherit;padding:7px 10px;cursor:pointer}.rona-payments-reconciliation-dialog__row{display:grid;grid-template-columns:72px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-top:1px solid rgba(128,181,214,.12)}.rona-payments-reconciliation-dialog__direction{font-size:11px;opacity:.62}.rona-payments-reconciliation-dialog__amount{font-variant-numeric:tabular-nums;font-weight:900}@media(max-width:640px){#page-payments .rona-payments-reconciliation-difference{position:static;justify-content:flex-start;max-width:100%;text-align:left}.rona-payments-reconciliation-dialog__row{grid-template-columns:64px 1fr}.rona-payments-reconciliation-dialog__amount{grid-column:1/-1}}';
    document.head.appendChild(style);
  }

  function ensureIndicator(){
    const root=document.querySelector(rootSelector);
    if(!root)return null;
    installStyle();
    let node=root.querySelector('#'+elementId);
    if(!node){
      node=document.createElement('button');
      node.type='button';
      node.id=elementId;
      node.className='rona-payments-reconciliation-difference';
      node.setAttribute('data-rona-payments-reconciliation-difference',sourceContract);
      const label=document.createElement('span');
      label.className='rona-owner-muted';
      label.textContent='Сверочная разница';
      const value=document.createElement('strong');
      value.className='rona-payments-reconciliation-difference-value';
      value.textContent='—';
      node.append(label,value);
      node.addEventListener('click',()=>openDrilldown());
      root.appendChild(node);
    }
    return node;
  }

  function closeDrilldown(){document.getElementById(dialogId)?.remove()}

  function openDrilldown(){
    const normalized=normalize(currentSnapshotMetric());
    if(normalized.status!=='AUTHORITATIVE')return;
    closeDrilldown();
    const layer=document.createElement('div');
    layer.id=dialogId;
    layer.className='rona-payments-reconciliation-dialog';
    layer.setAttribute('role','dialog');
    layer.setAttribute('aria-modal','true');
    layer.setAttribute('aria-label','Детализация сверочной разницы');
    const panel=document.createElement('section');
    panel.className='rona-payments-reconciliation-dialog__panel';
    const head=document.createElement('div');
    head.className='rona-payments-reconciliation-dialog__head';
    const title=document.createElement('strong');
    title.textContent='Сверочная разница · Finance source';
    const close=document.createElement('button');
    close.type='button';
    close.className='rona-payments-reconciliation-dialog__close';
    close.textContent='Закрыть';
    close.addEventListener('click',closeDrilldown);
    head.append(title,close);
    panel.append(head);
    const lines=normalized.breakdown;
    if(lines.length){
      for(const line of lines){
        const row=document.createElement('div');
        row.className='rona-payments-reconciliation-dialog__row';
        const currency=document.createElement('strong');
        currency.textContent=line.currency;
        const direction=document.createElement('span');
        direction.className='rona-payments-reconciliation-dialog__direction';
        direction.textContent=line.direction;
        const amount=document.createElement('span');
        amount.className='rona-payments-reconciliation-dialog__amount';
        amount.textContent=(line.direction==='PROFICIT'?'+':'−')+formatExactDecimal(line.amount).replace(/^−/,'')+' '+line.currency;
        row.append(currency,direction,amount);
        panel.append(row);
      }
    }else{
      const unavailable=document.createElement('div');
      unavailable.className='rona-owner-muted';
      unavailable.textContent='Authoritative Finance breakdown не опубликован в source payload.';
      panel.append(unavailable);
    }
    layer.append(panel);
    layer.addEventListener('click',event=>{if(event.target===layer)closeDrilldown()});
    const esc=event=>{if(event.key==='Escape'){closeDrilldown();document.removeEventListener('keydown',esc,true)}};
    document.addEventListener('keydown',esc,true);
    document.body.append(layer);
    close.focus();
  }

  function renderMetric(metric){
    const node=ensureIndicator();
    if(!node)return;
    const normalized=normalize(metric);
    const value=node.querySelector('.rona-payments-reconciliation-difference-value');
    if(value)value.textContent=normalized.text;
    node.dataset.status=normalized.status;
    node.dataset.sourceId=normalized.sourceId;
    node.dataset.sourceVersion=normalized.sourceVersion;
    node.dataset.breakdown=normalized.breakdown.length?'AUTHORITATIVE':'ABSENT';
  }

  async function refresh(){
    if(!document.querySelector(rootSelector))return;
    try{
      const response=await fetch(bootstrapPath,{method:'GET',credentials:'include',cache:'no-store',headers:{accept:'application/json'}});
      if(!response.ok)throw new Error('FINANCE_RECONCILIATION_BOOTSTRAP_UNAVAILABLE');
      const body=await response.json();
      const metric=body?.data?.paymentsV7Projection?.finance_reconciliation_difference||null;
      window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE__=metric;
      renderMetric(metric);
    }catch{
      window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE__=null;
      renderMetric(null);
    }
  }

  function start(){
    window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_RUNTIME__=contract;
    renderMetric(currentSnapshotMetric());
    const observer=new MutationObserver(()=>renderMetric(currentSnapshotMetric()));
    if(document.body)observer.observe(document.body,{childList:true,subtree:true});
    if(window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__)clearInterval(window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__);
    window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__=setInterval(refresh,refreshMs);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});
    setTimeout(refresh,0);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();`;

export function appendPaymentsReconciliationDifferenceRuntime(script) {
  const input = String(script ?? '');
  if (input.includes(PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT)) return input;
  return `${input}\n${PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME}`;
}

export function patchAdminPaymentsReconciliationDifferenceSource(source) {
  const input = String(source ?? '');
  if (input.includes(PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT)) return input;
  const marker = 'const SCRIPT=';
  const start = input.indexOf(marker);
  const end = input.indexOf('\n\nexport async function', start);
  if (start < 0 || end < 0) throw new Error('PAYMENTS_RECONCILIATION_DIFFERENCE_SCRIPT_BOUNDARY_NOT_FOUND');
  const statement = input.slice(start, end);
  if (!statement.endsWith(';')) throw new Error('PAYMENTS_RECONCILIATION_DIFFERENCE_SCRIPT_STATEMENT_INVALID');
  const expression = statement.slice(marker.length, -1);
  const replacement = `${marker}(${expression})+${JSON.stringify(`\n${PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME}`)};`;
  const output = `${input.slice(0, start)}${replacement}${input.slice(end)}`;
  if (!output.includes(PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT)) throw new Error('PAYMENTS_RECONCILIATION_DIFFERENCE_PATCH_FAILED');
  return output;
}
