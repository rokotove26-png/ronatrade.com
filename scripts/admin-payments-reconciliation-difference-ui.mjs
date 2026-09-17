export const PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT = 'PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V5';
export const PAYMENTS_RECONCILIATION_DIFFERENCE_REFRESH_MS = 30000;

export const PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME = String.raw`(()=>{
  const contract='PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V5';
  const sourceContract='FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_V1';
  const refreshMs=30000;
  const pageSelector='#page-payments';
  const rootSelector='#page-payments #ronaPaymentsV8Root';
  const heroSelector='#page-payments #ronaPaymentsV8Root > .rona-visual-hero';
  const tickerId='rona-payments-reconciliation-ticker';
  const trackClass='rona-payments-reconciliation-ticker-track';
  const styleId='rona-payments-reconciliation-ticker-style';
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
    if(!authoritative)return{status:'TO_VERIFY',tone:'verify',text:'Сверочная разница: —',sourceId:String(metric?.source_id||''),sourceVersion:String(metric?.source_version||'')};
    const formatted=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n));
    const sign=n>0?'+':n<0?'−':'';
    return{
      status:'AUTHORITATIVE',
      tone:n<0?'negative':'positive',
      text:'Сверочная разница: '+sign+formatted+' '+currency,
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
    style.textContent='#page-payments #ronaPaymentsV8Root > .rona-visual-hero{position:relative!important;overflow:hidden!important}#page-payments #ronaPaymentsV8Root > .rona-visual-hero > div:first-child{padding-right:360px;box-sizing:border-box}#'+tickerId+'{position:absolute;right:20px;top:50%;transform:translateY(-50%);width:min(330px,36%);height:30px;display:flex;align-items:center;overflow:hidden;pointer-events:none;border-left:1px solid rgba(135,174,199,.18);padding-left:14px;mask-image:linear-gradient(90deg,transparent 0,#000 12%,#000 92%,transparent 100%);-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 12%,#000 92%,transparent 100%)}#'+tickerId+' .'+trackClass+'{display:inline-block;min-width:max-content;padding-left:100%;font-size:13px;line-height:30px;font-weight:850;letter-spacing:.025em;font-variant-numeric:tabular-nums;white-space:nowrap;animation:ronaPaymentsReconciliationTicker 10s linear infinite}#'+tickerId+'[data-tone="positive"] .'+trackClass+'{color:#50e6a6;text-shadow:0 0 12px rgba(80,230,166,.20)}#'+tickerId+'[data-tone="negative"] .'+trackClass+'{color:#ff6473;text-shadow:0 0 12px rgba(255,100,115,.20)}#'+tickerId+'[data-tone="verify"] .'+trackClass+'{color:#8ba3b6}@keyframes ronaPaymentsReconciliationTicker{from{transform:translateX(0)}to{transform:translateX(-100%)}}@media(max-width:980px){#page-payments #ronaPaymentsV8Root > .rona-visual-hero > div:first-child{padding-right:250px}#'+tickerId+'{width:min(230px,34%);right:14px}}@media(max-width:720px){#page-payments #ronaPaymentsV8Root > .rona-visual-hero > div:first-child{padding-right:0}#'+tickerId+'{position:relative;right:auto;top:auto;transform:none;width:100%;height:28px;margin-top:10px;border-left:0;padding-left:0}}@media(prefers-reduced-motion:reduce){#'+tickerId+' .'+trackClass+'{animation:none;padding-left:0}}';
    document.head.appendChild(style);
  }

  function ensureRootObserver(){
    const root=document.querySelector(rootSelector);
    if(!root)return null;
    if(root.__ronaReconciliationTickerObserver)return root;
    const observer=new MutationObserver(()=>renderMetric(currentMetric()));
    observer.observe(root,{childList:true});
    root.__ronaReconciliationTickerObserver=observer;
    return root;
  }

  function ensureTicker(){
    document.getElementById('rona-payments-reconciliation-heading')?.remove();
    const root=ensureRootObserver();
    if(!root)return null;
    const hero=root.querySelector(':scope > .rona-visual-hero');
    if(!hero)return null;
    installStyle();
    let ticker=hero.querySelector(':scope > #'+tickerId);
    if(!ticker){
      ticker=document.createElement('div');
      ticker.id=tickerId;
      ticker.setAttribute('aria-label','Сверочная разница');
      const track=document.createElement('span');
      track.className=trackClass;
      track.textContent='Сверочная разница: —';
      ticker.appendChild(track);
      hero.appendChild(ticker);
    }
    return ticker;
  }

  function renderMetric(metric){
    const ticker=ensureTicker();
    if(!ticker)return;
    const normalized=normalize(metric);
    const track=ticker.querySelector('.'+trackClass);
    if(track&&track.textContent!==normalized.text)track.textContent=normalized.text;
    ticker.dataset.status=normalized.status;
    ticker.dataset.tone=normalized.tone;
    ticker.dataset.sourceId=normalized.sourceId;
    ticker.dataset.sourceVersion=normalized.sourceVersion;
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
    setTimeout(()=>renderMetric(currentMetric()),120);
    setTimeout(()=>renderMetric(currentMetric()),500);
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
