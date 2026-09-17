export const PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT = 'PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V1';
export const PAYMENTS_RECONCILIATION_DIFFERENCE_REFRESH_MS = 30000;

export const PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME = String.raw`(()=>{
  const contract='PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V1';
  const sourceContract='FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_V1';
  const refreshMs=30000;
  const rootSelector='#page-payments .rona-payments-v7';
  const elementId='rona-payments-reconciliation-difference';
  const styleId='rona-payments-reconciliation-difference-style';
  const bootstrapPath='/portal/api/v1/admin/bootstrap';

  function normalize(metric){
    const status=String(metric?.status||'').trim().toUpperCase();
    const amount=metric?.amount;
    const currency=String(metric?.currency||'').trim().toUpperCase();
    const publisher=String(metric?.publisher_identity||'').trim().toUpperCase();
    const role=String(metric?.functional_role||'').trim().toUpperCase();
    const source=String(metric?.source_contract||'').trim();
    const n=amount===null||amount===undefined?NaN:Number(amount);
    const authoritative=status==='AUTHORITATIVE'&&Number.isFinite(n)&&/^[A-Z]{3}$/.test(currency)&&publisher==='AI-FINANCE'&&role==='FINANCE'&&source===sourceContract&&metric?.source_locked===true;
    return authoritative
      ? {status:'AUTHORITATIVE',text:new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)+' '+currency,sourceId:String(metric?.source_id||''),sourceVersion:String(metric?.source_version||'')}
      : {status:'TO_VERIFY',text:'—',sourceId:String(metric?.source_id||''),sourceVersion:String(metric?.source_version||'')};
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
    style.textContent='#page-payments .rona-payments-v7{position:relative}#page-payments .rona-payments-reconciliation-difference{position:absolute;top:0;right:0;z-index:1;display:flex;align-items:baseline;gap:8px;white-space:nowrap;max-width:calc(100% - 150px)}#page-payments .rona-payments-reconciliation-difference-value{overflow:hidden;text-overflow:ellipsis}';
    document.head.appendChild(style);
  }

  function ensureIndicator(){
    const root=document.querySelector(rootSelector);
    if(!root)return null;
    installStyle();
    let node=root.querySelector('#'+elementId);
    if(!node){
      node=document.createElement('div');
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
      root.appendChild(node);
    }
    return node;
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
