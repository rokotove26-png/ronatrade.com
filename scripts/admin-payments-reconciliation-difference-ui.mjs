export const PAYMENTS_RECONCILIATION_DIFFERENCE_UI_CONTRACT = 'PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V7';
export const PAYMENTS_RECONCILIATION_DIFFERENCE_REFRESH_MS = 30000;

export const PAYMENTS_RECONCILIATION_DIFFERENCE_BROWSER_RUNTIME = String.raw`(()=>{
  const contract='PAYMENTS_FINANCE_RECONCILIATION_DIFFERENCE_UI_V7';
  const sourceContract='FINANCE_RECONCILIATION_DIFFERENCE_PUBLICATION_V1';
  const refreshMs=30000;
  const pageSelector='#page-payments';
  const tickerId='rona-payments-reconciliation-title-ticker';
  const tickerClass='rona-payments-reconciliation-title-ticker';
  const hostClass='rona-has-reconciliation-ticker';
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

  function exactPaymentsTitle(node){
    return String(node?.textContent||'').trim()==='Платежи';
  }

  function findTitleFrame(){
    const page=document.querySelector(pageSelector);
    if(!page)return null;
    const directHeroes=Array.from(page.querySelectorAll(':scope > .rona-visual-hero'));
    const nestedHeroes=Array.from(page.querySelectorAll('.rona-visual-hero'));
    const heroes=[...directHeroes,...nestedHeroes.filter(x=>!directHeroes.includes(x))];
    const hero=heroes.find(candidate=>Array.from(candidate.querySelectorAll('h1,h2')).some(exactPaymentsTitle));
    if(hero)return hero;
    const titles=Array.from(page.querySelectorAll('h1,h2')).filter(exactPaymentsTitle);
    const title=titles.find(el=>el.offsetParent!==null)||titles[0]||null;
    if(!title)return null;
    return title.closest('.page-header,.page-head,.rona-owner-card,header,section')||title.parentElement;
  }

  function installStyle(){
    if(document.getElementById(styleId))return;
    const style=document.createElement('style');
    style.id=styleId;
    style.textContent='@keyframes ronaReconTickerV7{0%{transform:translateX(100%)}14%,72%{transform:translateX(0)}100%{transform:translateX(-100%)}}.rona-visual-hero.'+hostClass+'{position:relative}.rona-visual-hero.'+hostClass+'>div:first-child{max-width:calc(100% - 400px)}#'+tickerId+'{position:absolute;right:22px;top:50%;transform:translateY(-50%);width:min(360px,40%);height:30px;overflow:hidden;display:flex;align-items:center;justify-content:flex-start;pointer-events:none;z-index:3}#'+tickerId+' .rona-recon-ticker-track{display:inline-block;min-width:max-content;padding-left:8px;font-size:13px;font-weight:900;letter-spacing:.01em;font-variant-numeric:tabular-nums;white-space:nowrap;animation:ronaReconTickerV7 8s linear infinite}#'+tickerId+'[data-tone="positive"] .rona-recon-ticker-track{color:#4ade80;text-shadow:0 0 12px rgba(74,222,128,.20)}#'+tickerId+'[data-tone="negative"] .rona-recon-ticker-track{color:#fb7185;text-shadow:0 0 12px rgba(251,113,133,.20)}#'+tickerId+'[data-tone="neutral"] .rona-recon-ticker-track{color:#8fa8ba}@media(max-width:900px){.rona-visual-hero.'+hostClass+'>div:first-child{max-width:calc(100% - 330px)}#'+tickerId+'{width:min(300px,42%);right:16px}#'+tickerId+' .rona-recon-ticker-track{font-size:12px}}@media(max-width:640px){.rona-visual-hero.'+hostClass+'>div:first-child{max-width:none}#'+tickerId+'{position:static;transform:none;width:100%;height:24px;margin-top:8px}#'+tickerId+' .rona-recon-ticker-track{animation:none}}@media(prefers-reduced-motion:reduce){#'+tickerId+' .rona-recon-ticker-track{animation:none}}';
    document.head.appendChild(style);
  }

  function removeLegacyNodes(){
    for(const node of document.querySelectorAll('#rona-payments-reconciliation-heading,#rona-payments-reconciliation-difference,[data-rona-payments-reconciliation-difference]')){
      node.remove();
    }
  }

  function cleanupSingleton(frame){
    removeLegacyNodes();
    for(const host of document.querySelectorAll('.'+hostClass)){
      if(host!==frame)host.classList.remove(hostClass);
    }
    const all=Array.from(document.querySelectorAll('[id="'+tickerId+'"],.'+tickerClass));
    let keeper=null;
    for(const node of all){
      const valid=!keeper&&node.id===tickerId&&node.parentElement===frame;
      if(valid){keeper=node;continue}
      node.remove();
    }
    return keeper;
  }

  function ensureTicker(){
    const frame=findTitleFrame();
    if(!frame){removeLegacyNodes();return null}
    installStyle();
    const computed=getComputedStyle(frame);
    if(computed.position==='static')frame.style.position='relative';
    if(frame.classList.contains('rona-visual-hero'))frame.classList.add(hostClass);
    let ticker=cleanupSingleton(frame);
    if(!ticker){
      ticker=document.createElement('div');
      ticker.id=tickerId;
      ticker.className=tickerClass;
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

  function bindSingletonRuntime(){
    const oldObserver=window.__RONA_PAYMENTS_RECONCILIATION_PAGE_OBSERVER__;
    if(oldObserver&&typeof oldObserver.disconnect==='function')oldObserver.disconnect();
    window.__RONA_PAYMENTS_RECONCILIATION_PAGE_OBSERVER__=null;

    const oldFocus=window.__RONA_PAYMENTS_RECONCILIATION_FOCUS_HANDLER__;
    if(oldFocus)window.removeEventListener('focus',oldFocus);
    const oldVisibility=window.__RONA_PAYMENTS_RECONCILIATION_VISIBILITY_HANDLER__;
    if(oldVisibility)document.removeEventListener('visibilitychange',oldVisibility);
    const oldFinanceSync=window.__RONA_PAYMENTS_RECONCILIATION_FINANCE_SYNC_HANDLER__;
    if(oldFinanceSync)window.removeEventListener('rona:finance-sync',oldFinanceSync);

    const focusHandler=()=>refresh();
    const visibilityHandler=()=>{if(document.visibilityState==='visible')refresh()};
    const financeSyncHandler=()=>refresh();
    window.__RONA_PAYMENTS_RECONCILIATION_FOCUS_HANDLER__=focusHandler;
    window.__RONA_PAYMENTS_RECONCILIATION_VISIBILITY_HANDLER__=visibilityHandler;
    window.__RONA_PAYMENTS_RECONCILIATION_FINANCE_SYNC_HANDLER__=financeSyncHandler;
    window.addEventListener('focus',focusHandler);
    document.addEventListener('visibilitychange',visibilityHandler);
    window.addEventListener('rona:finance-sync',financeSyncHandler);

    const page=document.querySelector(pageSelector);
    if(page){
      let cleanupQueued=false;
      const observer=new MutationObserver(records=>{
        const duplicateAdded=records.some(record=>Array.from(record.addedNodes||[]).some(node=>{
          if(!(node instanceof Element))return false;
          if(node.id===tickerId||node.classList?.contains(tickerClass))return true;
          return Boolean(node.querySelector?.('[id="'+tickerId+'"],.'+tickerClass));
        }));
        const frameReplaced=records.some(record=>record.target===page);
        if(!duplicateAdded&&!frameReplaced)return;
        if(cleanupQueued)return;
        cleanupQueued=true;
        queueMicrotask(()=>{
          cleanupQueued=false;
          renderMetric(currentMetric());
        });
      });
      observer.observe(page,{childList:true,subtree:true});
      window.__RONA_PAYMENTS_RECONCILIATION_PAGE_OBSERVER__=observer;
    }
  }

  function start(){
    window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_RUNTIME__=contract;
    cleanupSingleton(findTitleFrame());
    bindSingletonRuntime();
    renderMetric(currentMetric());
    if(window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__)clearInterval(window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__);
    window.__RONA_PAYMENTS_RECONCILIATION_DIFFERENCE_TIMER__=setInterval(refresh,refreshMs);
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