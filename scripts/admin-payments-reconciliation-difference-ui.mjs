export const PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT = 'PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V4';
export const PAYMENTS_RECONCILIATION_DIFFERENCE_REFRESH_MS = 30000;

export const PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME = String.raw`(()=>{
  const contract='PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V4';
  const sourceContract='FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_V1';
  const refreshMs=30000;
  const pageSelector='#page-payments';
  const rootSelector='#page-payments #ronaPaymentsV8Root';
  const headingId='rona-payments-reconciliation-heading';
  const valueClass='rona-payments-reconciliation-value';
  const styleId='rona-payments-reconciliation-style';
  const bootstrapPath='/portal/api/v1/admin/bootstrap';

  function normalize(metric){
    const status=String(metric?.status||'').trim().toUpperCase();
    const amount=metric?.amount;
    const currency=String(metric?.currency||'').trim().toUpperCase();
    const publisher=String(metric?.publisher_identity||'').trim().toUpperCase();
    const role=String(metric?.functional_role||'').trim().toUpperCase();
    const source=String(metric?.source_contract||'').trim();
    const n=amount===null||amount===undefined?NaN:Number(amount);
    const authoritative=status==='AUTHORITATIVE'
      &&Number.isFinite(n)
      &&/^[A-Z]{3}$/.test(currency)
      &&publisher==='AI-FINANCE'
      &&role==='FINANCE'
      &&source===sourceContract
      &&metric?.source_locked===true;
    if(!authoritative)return{status:'TO_VERIFY',text:'—',sourceId:String(metric?.source_id||''),sourceVersion:String(metric?.source_version||'')};
    const formatted=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n));
    const sign=n>0?'+':n<0?'−':'';
    return{
      status:'AUTHORITATIVE',
      text:sign+formatted+' '+currency,
      sourceId:String(metric?.source_id||''),
      sourceVersion:String(metric?.source_version||''),
    };
  }

  function currentMetric(){
    return window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE__
      || window.__RONA_PAYMENTS_V8_PROJECTION__?.finance_reconciliation_difference
      || window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.paymentsV7Projection?.finance_reconciliation_difference
      || null;
  }

  function installStyle(){
    if(document.getElementById(styleId))return;
    const style=document.createElement('style');
    style.id=styleId;
    style.textContent='#'+headingId+'{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 16px;margin:0 0 14px;pointer-events:none;border:1px solid rgba(93,138,178,.20);border-radius:16px;background:linear-gradient(180deg,rgba(8,21,34,.96),rgba(6,16,27,.94));box-shadow:inset 0 1px 0 rgba(255,255,255,.035)}#'+headingId+' h1{margin:0;font-size:24px;line-height:1.1;font-weight:900;letter-spacing:-.025em;color:#f7fbff}#'+headingId+' .rona-payments-reconciliation{display:flex;align-items:baseline;gap:9px;margin-left:auto;white-space:nowrap;text-align:right}#'+headingId+' .rona-payments-reconciliation-label{font-size:11px;color:#829bb0}#'+headingId+' .'+valueClass+'{font-size:16px;font-weight:900;font-variant-numeric:tabular-nums;color:#f7fbff}@media(max-width:640px){#'+headingId+'{align-items:flex-start;flex-direction:column}#'+headingId+' .rona-payments-reconciliation{margin-left:0;text-align:left}}';
    document.head.appendChild(style);
  }

  function ensureHeading(){
    const root=document.querySelector(rootSelector);
    if(!root)return null;
    installStyle();
    let heading=root.querySelector(':scope > #'+headingId);
    if(!heading){
      heading=document.createElement('header');
      heading.id=headingId;
      const title=document.createElement('h1');
      title.textContent='Платежи';
      const right=document.createElement('div');
      right.className='rona-payments-reconciliation';
      const label=document.createElement('span');
      label.className='rona-payments-reconciliation-label';
      label.textContent='Сверочная разница';
      const value=document.createElement('strong');
      value.className=valueClass;
      value.textContent='—';
      right.append(label,value);
      heading.append(title,right);
      root.prepend(heading);
    }
    return heading;
  }

  function renderMetric(metric){
    const heading=ensureHeading();
    if(!heading)return;
    const normalized=normalize(metric);
    const value=heading.querySelector('.'+valueClass);
    if(value&&value.textContent!==normalized.text)value.textContent=normalized.text;
    if(heading.dataset.status!==normalized.status)heading.dataset.status=normalized.status;
    if(heading.dataset.sourceId!==normalized.sourceId)heading.dataset.sourceId=normalized.sourceId;
    if(heading.dataset.sourceVersion!==normalized.sourceVersion)heading.dataset.sourceVersion=normalized.sourceVersion;
  }

  async function refresh(){
    if(!document.querySelector(pageSelector))return;
    try{
      const response=await fetch(bootstrapPath,{method:'GET',credentials:'include',cache:'no-store',headers:{accept:'application/json'}});
      if(!response.ok)throw new Error('FINANCE_RECONCILIATION_BOOTSTRAP_UNAVAILABLE');
      const body=await response.json();
      const metric=body?.data?.paymentsV7Projection?.finance_reconciliation_difference||null;
      window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE__=metric;
      renderMetric(metric);
    }catch{
      renderMetric(currentMetric());
    }
  }

  function start(){
    window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_RUNTIME__=contract;
    const page=document.querySelector(pageSelector);
    if(page&&!window.__RONA_PAYMENTS_RECONCILIATION_PAGE_OBSERVER__){
      const observer=new MutationObserver(()=>renderMetric(currentMetric()));
      observer.observe(page,{childList:true});
      window.__RONA_PAYMENTS_RECONCILIATION_PAGE_OBSERVER__=observer;
    }
    renderMetric(currentMetric());
    if(window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__)clearInterval(window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__);
    window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__=setInterval(refresh,refreshMs);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});
    window.addEventListener('rona:finance-sync',refresh);
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