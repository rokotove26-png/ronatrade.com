export const PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT = 'PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V5';
export const PAYMENTS_RECONCILIATION_DIFFERENCE_REFRESH_MS = 30000;

export const PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME = String.raw`(()=>{
  const contract='PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V5';
  const sourceContract='FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_V1';
  const refreshMs=30000;
  const pageSelector='#page-payments';
  const tickerId='rona-payments-reconciliation-title-ticker';
  const styleId='rona-payments-reconciliation-title-ticker-style';
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
    if(!authoritative)return{status:'TO_VERIFY',text:'Сверочная разница —',tone:'neutral',sourceId:String(metric?.source_id||''),sourceVersion:String(metric?.source_version||'')};
    const formatted=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(n));
    const sign=n>0?'+':n<0?'−':'';
    return{
      status:'AUTHORITATIVE',
      text:'Сверочная разница '+sign+formatted+' '+currency,
      tone:n<0?'negative':'positive',
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

  function findTitleFrame(){
    const page=document.querySelector(pageSelector);
    if(!page)return null;
    const title=Array.from(page.querySelectorAll('h1,h2')).find(el=>String(el.textContent||'').trim()==='Платежи');
    if(!title)return null;
    return title.closest('.rona-owner-card,.rona-fd-v5__hero,.rona-page-hero,header,section,div')||title.parentElement;
  }

  function installStyle(){
    if(document.getElementById(styleId))return;
    const style=document.createElement('style');
    style.id=styleId;
    style.textContent='@keyframes ronaReconTickerV5{0%{transform:translateX(100%)}12%,72%{transform:translateX(0)}100%{transform:translateX(-100%)}}#'+tickerId+'{position:absolute;right:16px;top:50%;transform:translateY(-50%);width:min(360px,42%);height:28px;overflow:hidden;display:flex;align-items:center;pointer-events:none;z-index:3}#'+tickerId+' .rona-recon-ticker-track{display:inline-block;min-width:max-content;padding-left:8px;font-size:13px;font-weight:900;letter-spacing:.01em;font-variant-numeric:tabular-nums;white-space:nowrap;animation:ronaReconTickerV5 8s linear infinite}#'+tickerId+'[data-tone="positive"] .rona-recon-ticker-track{color:#4ade80;text-shadow:0 0 12px rgba(74,222,128,.20)}#'+tickerId+'[data-tone="negative"] .rona-recon-ticker-track{color:#fb7185;text-shadow:0 0 12px rgba(251,113,133,.20)}#'+tickerId+'[data-tone="neutral"] .rona-recon-ticker-track{color:#8fa8ba}@media(max-width:900px){#'+tickerId+'{width:min(300px,46%);right:12px}#'+tickerId+' .rona-recon-ticker-track{font-size:12px}}@media(max-width:640px){#'+tickerId+'{position:static;transform:none;width:100%;height:24px;margin-top:6px}#'+tickerId+' .rona-recon-ticker-track{animation:none}}@media(prefers-reduced-motion:reduce){#'+tickerId+' .rona-recon-ticker-track{animation:none}}';
    document.head.appendChild(style);
  }

  function removeLegacyHeading(){
    document.getElementById('rona-payments-reconciliation-heading')?.remove();
  }

  function ensureTicker(){
    removeLegacyHeading();
    const frame=findTitleFrame();
    if(!frame)return null;
    installStyle();
    const computed=getComputedStyle(frame);
    if(computed.position==='static')frame.style.position='relative';
    let ticker=frame.querySelector('#'+tickerId);
    if(!ticker){
      ticker=document.createElement('div');
      ticker.id=tickerId;
      ticker.setAttribute('aria-label','Сверочная разница');
      const track=document.createElement('span');
      track.className='rona-recon-ticker-track';
      ticker.appendChild(track);
      frame.appendChild(ticker);
    }
    return ticker;
  }

  function renderMetric(metric){
    const ticker=ensureTicker();
    if(!ticker)return;
    const normalized=normalize(metric);
    const track=ticker.querySelector('.rona-recon-ticker-track');
    if(track&&track.textContent!==normalized.text)track.textContent=normalized.text;
    ticker.dataset.tone=normalized.tone;
    ticker.dataset.status=normalized.status;
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
      observer.observe(page,{childList:true,subtree:false});
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
