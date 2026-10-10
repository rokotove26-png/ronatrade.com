(()=>{
'use strict';
if(location.pathname!=='/portal/client')return;
const MARK='20261009-lpg-source-gap-history-v13';
const CLIENT_CANONICAL_PARITY='CLIENT_LPG_HISTORICAL_SEGMENTS_V13';
const CLIENT_PRICE_PRESENTATION_V9='CANONICAL_AN2_PUBLISHED_CONTRACT_PRICE_VISIBLE_V9';
const CLIENT_PRICE_BRIDGE='20261009-client-analytics-published-context-prices-v8';
const CANONICAL_VISUAL_OWNER='20261009-client-analytics-canonical-visual-restored-v7';
const REENTRY_GUARD='20261009-client-analytics-reentry-guard-v4';
const VISIBLE_OWNER_GUARD='20261009-client-analytics-visible-owner-v5';
const ACTIVE_ROUTE_RECOVERY='20261009-client-analytics-active-route-recovery-v6';
if(window.__RONA_CLIENT_MARKET_INTELLIGENCE__===MARK)return;
window.__RONA_CLIENT_MARKET_INTELLIGENCE__=MARK;

const API_PATH='/v1/client/market-intelligence';
const API='/portal/api'+API_PATH;
const REFRESH_MS=3600000;
const OWNER='data-rona-client-market-intelligence-owner';
const state={version:MARK,loading:false,loaded:false,error:'',data:null,updatedAt:'',fingerprint:'',timer:0,renderQueued:false};
window.__RONA_CLIENT_MARKET_INTELLIGENCE_STATE__=state;

const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
const q=(s,r=document)=>r.querySelector(s);
const MARKET_PRODUCTS=Object.freeze(['АИ-92','АИ-95','ДТ','НАФТА','СУГ / СПБТ']);
function isMarketProduct(product){return MARKET_PRODUCTS.includes(norm(product))}
function isAuthorizedRow(row){
  if(!row||!row.publication_id||!row.publication_item_id||!row.product||!row.headline)return false;
  const chart=row.public_chart;
  if(!chart||typeof chart!=='object'||Array.isArray(chart)||!Array.isArray(chart.labels)||!Array.isArray(chart.values))return false;
  if(chart.labels.length!==chart.values.length||chart.values.some(v=>v===null||v===''||!Number.isFinite(Number(v))))return false;
  if(isMarketProduct(row.product)&&chart.source_freshness_state!=='CURRENT')return false;
  return true;
}

function el(tag,attrs={},...children){
  const n=document.createElement(tag);
  for(const[k,v]of Object.entries(attrs||{})){
    if(k==='class')n.className=String(v);
    else if(k==='text')n.textContent=String(v);
    else if(k==='hidden')n.hidden=Boolean(v);
    else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2).toLowerCase(),v);
    else if(v!==false&&v!==null&&v!==undefined)n.setAttribute(k,v===true?'':String(v));
  }
  for(const c of children.flat(Infinity)){if(c===null||c===undefined)continue;n.append(c?.nodeType?c:document.createTextNode(String(c)))}
  return n;
}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function fmt(v,max=2){const n=finite(v);return n===null?'—':n.toLocaleString('ru-RU',{maximumFractionDigits:max,minimumFractionDigits:Number.isInteger(n)?0:Math.min(2,max)})}
function dateValue(v){const d=new Date(v||'');return Number.isFinite(d.getTime())?d:null}
function dateLabel(v,withTime=false){const d=dateValue(v);if(!d)return'—';return d.toLocaleString('ru-RU',withTime?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',year:'numeric'})}
function fingerprint(data){return JSON.stringify([data?.clientCanonicalAnalytics,data?.generated_at,(data?.analytics||[]).map(x=>[x.publication_item_id,x.published_at,x.analytics_as_of,x.headline,x.content_text,x.public_chart])])}

function analyticsPage(){
  return q('#page-analytics')||q('#analyticsPage')||q('#page-market-analytics')||q('[data-page-panel="analytics"]')||q('[data-page-id="analytics"]')||q('[data-page-panel="market-analytics"]');
}
function pageShown(root){if(!root||!root.isConnected)return false;const s=getComputedStyle(root);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0}

function installStyle(){
  if(document.getElementById('rona-client-analytics-canonical-style-v7'))return;
  const s=el('style',{id:'rona-client-analytics-canonical-style-v7'});
  s.textContent=[
    '#page-analytics > #rona-analytics-v2[data-rona-client-analytics-visual-owner="canonical-v7"]{display:block!important;visibility:visible!important}',
    '#page-analytics > [data-rona-client-market-intelligence-owner="analytics"]{display:none!important}',
    '#page-analytics #rona-analytics-v2 .rona-market-chart-empty[data-rona-client-canonical-empty="v7"]{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:28px 15px;text-align:center}',
    '#page-analytics #rona-analytics-v2 .rona-market-chart-empty[data-rona-client-canonical-empty="v7"] strong{font-weight:700}',
    '#page-analytics #rona-analytics-v2 .rona-market-chart-empty[data-rona-client-canonical-empty="v7"] span{font-size:12px;opacity:.72}',
    '#page-analytics #rona-analytics-v2 .rona-market-chart-empty[data-rona-client-canonical-empty="v7"][hidden]{display:none!important}'
  ].join('\n');
  document.head.appendChild(s);
}
function recoverAnalyticsRoute(root){
  const active=[...document.querySelectorAll('.sidebar [data-page="analytics"],#nav [data-page="analytics"]')].some(n=>n.classList.contains('active')||n.getAttribute('aria-current')==='page');
  if(active){
    if(root.hidden)root.hidden=false;
    const css=getComputedStyle(root);
    if(css.display==='none'){
      root.style.setProperty('display','block','important');
      root.dataset.ronaAnalyticsRouteRecovered='v6';
    }
    if(css.visibility==='hidden'){
      root.style.setProperty('visibility','visible','important');
      root.dataset.ronaAnalyticsRouteRecovered='v6';
    }
  }else if(root.dataset.ronaAnalyticsRouteRecovered==='v6'){
    if(root.style.getPropertyValue('display')==='block'&&root.style.getPropertyPriority('display')==='important')root.style.removeProperty('display');
    if(root.style.getPropertyValue('visibility')==='visible'&&root.style.getPropertyPriority('visibility')==='important')root.style.removeProperty('visibility');
    delete root.dataset.ronaAnalyticsRouteRecovered;
  }
}

const CANONICAL_KEYS=Object.freeze({ 'АИ-92':'AI92','АИ-95':'AI95','ДТ':'DT','СУГ / СПБТ':'LPG' });
const CANONICAL_PRICE_BASES=Object.freeze(['CPT Озинки','CPT Сарыагаш','CPT Наушки']);
const EMPTY_SOURCE='Нет текущей подтверждённой публикации';
function ensureOwner(root){
  installStyle();
  // The canonical design is the sole visual owner; never replace its subtree.
  const original=root.querySelector(':scope > #rona-analytics-v2');
  if(!original){root.dataset.ronaClientAnalyticsSource='CANONICAL_VISUAL_MISSING';return null}
  const substitute=root.querySelector(':scope > [data-rona-client-market-intelligence-owner="analytics"]');
  if(substitute)substitute.remove();
  if(original.hidden)original.hidden=false;
  if(original.hasAttribute('data-rona-client-analytics-legacy'))original.removeAttribute('data-rona-client-analytics-legacy');
  if(original.style.getPropertyValue('display')==='none')original.style.removeProperty('display');
  if(original.style.getPropertyValue('visibility')==='hidden')original.style.removeProperty('visibility');
  if(original.dataset.ronaClientAnalyticsVisualOwner!=='canonical-v7')original.dataset.ronaClientAnalyticsVisualOwner='canonical-v7';
  root.dataset.ronaClientAnalyticsMigrated='canonical-restored-v7';
  root.dataset.ronaClientAnalyticsSource='CLIENT_AUTHORIZED_PUBLISHED_CURRENT_ONLY';
  return original;
}
function emptyForecast(message=EMPTY_SOURCE){
  return{month:'нет текущих данных',low:NaN,base:NaN,high:NaN,forward:NaN,forwardLabel:'FORWARD',
    direction:'нет публикации',confidence:'не подтверждено',curve:'нет ряда',comment:message};
}
function emptyProduct(){
  return{dates:[],values:[],basis:EMPTY_SOURCE,forecast:emptyForecast(),
    rona:{reference:NaN,bases:CANONICAL_PRICE_BASES.map(k=>[k,NaN])}};
}
function canonicalPayload(data){
  const approved=data?.clientCanonicalAnalytics;
  const products={AI92:emptyProduct(),AI95:emptyProduct(),DT:emptyProduct(),LPG:emptyProduct()};
  if(approved?.version==='RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1' &&
     approved?.projection===CLIENT_CANONICAL_PARITY && approved?.products){
    for(const key of Object.keys(products)){
      const input=approved.products[key];
      if(!input||typeof input!=='object')continue;
      const dates=Array.isArray(input.dates)?input.dates:[];
      const values=Array.isArray(input.values)?input.values:[];
      // The chart axis ALWAYS means observation dates; reject 10.2026-style
      // maturity labels from the previous version even when the source is valid.
      const valid=dates.length===values.length&&
        dates.every(d=>/^\d{2}\.\d{2}$/.test(String(d)))&&
        values.every(v=>v!==null&&v!==''&&Number.isFinite(Number(v)));
      const forecast=input.forecast;
      const forecastOk=forecast&&/^\d{4}-\d{2}$/.test(String(forecast.month||''))&&
        ['low','base','high','forward'].every(k=>forecast[k]!==null&&forecast[k]!==''&&Number.isFinite(Number(forecast[k])))&&
        norm(forecast.sourceRef);
      const monitor=input.dailyMonitor;
      const dailyOk=monitor?.version==='RONA_MARKET_OBSERVED_DAILY_V1'&&
        monitor?.granularity==='OBSERVATION_DATE'&&
        monitor?.sourceFamily==='PLATTS'&&monitor?.sourceStatus==='CONFIRMED'&&
        monitor?.noInterpolation===true&&
        (key==='DT'||key==='LPG')&&valid&&dates.length>0&&
        Number(monitor.observationCount)===dates.length&&
        /^\d{2}\.\d{2}\.\d{4}$/.test(String(monitor.lastAsOf||''));
      const term=input.termCurve;
      const termOk=term?.kind==='FORWARD_TERM_STRUCTURE'&&term?.sourceStatus==='CONFIRMED'&&
        term?.sourceFamily==='PLATTS'&&Array.isArray(term.dates)&&Array.isArray(term.values)&&
        term.dates.length===3&&term.values.length===3&&
        term.values.every(v=>v!==null&&Number.isFinite(Number(v)))&&forecastOk&&
        norm(term.sourceRef)===norm(forecast.sourceRef);
      products[key]={
        name:input.name||key,
        spotFreshness:norm(input.spotFreshness)||'UNAVAILABLE',
        dates:valid?dates:[],
        values:valid?values:[],
        basis:norm(input.basis)||EMPTY_SOURCE,
        forecast:forecastOk?forecast:emptyForecast(),
        termCurve:termOk?term:null,
        dailyMonitor:dailyOk?monitor:null,
        rona:{reference:NaN,bases:CANONICAL_PRICE_BASES.map(k=>[k,NaN])}
      };
    }
    return{version:'RONA_CLIENT_ADMIN_CANONICAL_PARITY_V10',cutoff:approved.cutoff,
      latestTradeDate:approved.latestTradeDate,
      argus:{available:false,reason:EMPTY_SOURCE},products};
  }
  return{version:'RONA_CLIENT_ADMIN_CANONICAL_PARITY_V10',cutoff:EMPTY_SOURCE,
    latestTradeDate:EMPTY_SOURCE,argus:{available:false,reason:EMPTY_SOURCE},products};
}
function textIfDifferent(node,value){
  if(node&&node.textContent!==value)node.textContent=value;
}
// Populate only existing frozen AN2 price fields using the SAME client/contract-scoped
// published price projection as the client Price tab. Admin quote data never crosses this bridge.
function productCode(raw){
  const s=norm(raw).toLocaleLowerCase('ru-RU').replace(/\s+/g,' ');
  if(/^(аи[- ]?92|ai[- ]?92)(?:\b|[- /]|$)/u.test(s))return 'AI92';
  if(/^(аи[- ]?95|ai[- ]?95)(?:\b|[- /]|$)/u.test(s))return 'AI95';
  if(/^(дт|дизель|diesel)(?:\b|[- /]|$)/u.test(s))return 'DT';
  if(/^(суг|спбт|lpg|сжиж)(?:\b|[- /]|$)/u.test(s))return 'LPG';
  return '';
}
function basisCode(raw){return norm(raw).toLocaleLowerCase('ru-RU').replace(/[\s\u00a0]+/g,' ').trim()}
function publishedPriceContext(){
  const state=window.__RONA_CLIENT_PRICE_SYNC_STATE__,authoritative=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();
  if(!authoritative||!state||state.authority!=='SERVER_AUTHORITATIVE_PRICE_PROJECTION'||!Array.isArray(state.prices)||!state.loadedAt)return null;
  if(String(authoritative.client_id||'')!==String(state.context?.client_id||'')||
     String(authoritative.contract_id||'')!==String(state.context?.contract_id||'')||
     !authoritative.client_id||!authoritative.contract_id)return null;
  const ts=Date.parse(state.loadedAt);
  if(!Number.isFinite(ts)||ts>Date.now()+60000||Date.now()-ts>300000)return null;
  return state;
}
function paintAuthorizedPrices(owner,selectedProduct){
  const box=owner.querySelector('.an2-rona');
  if(!box)return;
  const source=publishedPriceContext();
  let filled=0;
  for(const card of box.querySelectorAll('.an2-price-card')){
    const basis=basisCode(card.querySelector('h3')?.textContent);
    // Exactly one authorized published price for selected product and destination
    // is required; NEVER substitute a market benchmark or infer a forecast.
    const matches=source?.prices.filter(p=>productCode(p.product)===selectedProduct&&basisCode(p.basis)===basis&&
      Number.isFinite(Number(p.price))&&Number(p.price)>0&&norm(p.currency))||[];
    const shown=matches.length===1?matches[0]:null;
    const amount=card.querySelector('.an2-price-base');
    const caption=card.querySelector('.an2-price-current');
    const forecastRange=card.querySelector('.an2-price-range');
    if(shown){
      const display=Number(shown.price).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
      textIfDifferent(amount,display+' '+String(shown.currency).trim()+'/т');
      textIfDifferent(caption,'Опубликованная цена · выбранный договор');
      card.dataset.ronaClientPriceSource='PUBLISHED_CURRENT_CONTRACT';
      card.dataset.ronaClientPricePresentation='PROMINENT_PUBLISHED_PRICE_V9';
      filled++;
    }else{
      textIfDifferent(amount,'—');
      textIfDifferent(caption,matches.length>1?'Несколько предложений — см. раздел «Цены»':'—');
      delete card.dataset.ronaClientPriceSource;
      delete card.dataset.ronaClientPricePresentation;
    }
    // LOW/HIGH projections remain empty until separately authorized current
    // market forecasts. Published contract prices must not masquerade as forecasts.
    textIfDifferent(forecastRange,'LOW — · HIGH —');
  }
  // Change text ONLY inside existing frozen original headline, not its badge or DOM.
  const headline=box.querySelector('.an2-rona-head h2');
  // Owner-approved v4.3.2 canonical label is fixed for every fuel and
  // client/contract state. The populated values remain explicitly named
  // PUBLISHED prices, NOT invented LOW/BASE/HIGH scenario quotations.
  textIfDifferent(headline,'Возможные цены RONA Trade');
  const note=box.querySelector('.an2-model-note');
  if(note)textIfDifferent(note,filled
    ?'Показанные значения — опубликованные цены выбранного договора, а не рассчитанные возможные цены. Для индикативного LOW / BASE / HIGH по базисам необходимы подтверждённые логистические, финансовые и коммерческие параметры RONA Trade. Прогноз рынка показан отдельно; настоящая карточка не создаёт новую оферту.'
    :'Для расчёта возможной цены нет подтверждённой опубликованной цены выбранного договора. LOW / BASE / HIGH по базисам не рассчитываются без проверенных коммерческих параметров.');
  box.dataset.ronaClientPriceBridge=filled?'published-current-contract':'no-authorized-matching-price';
  box.dataset.ronaClientPriceAuthority=source?'SERVER_AUTHORITATIVE_PRICE_PROJECTION':'SOURCE_UNAVAILABLE';
  box.dataset.ronaClientPricePresentation=CLIENT_PRICE_PRESENTATION_V9;
}
function ensureSafeCanonicalState(owner,payload,reason){
  const selected=window.RONA_ANALYTICS_VIEW?.getState?.()||{};
  const visualProduct=owner.querySelector('.an2-controls [data-an2-product][aria-pressed="true"]')?.getAttribute('data-an2-product');
  const chosen=(visualProduct&&payload.products[visualProduct]?visualProduct:null)||
    (selected.product&&payload.products[selected.product]?selected.product:'AI92');
  const product=payload.products[chosen]||emptyProduct();
  const hasSeries=selected.source!=='ARGUS'&&product.dates.length>0&&product.values.length===product.dates.length;
  const daily=product.dailyMonitor;
  const hasDaily=hasSeries&&daily?.version==='RONA_MARKET_OBSERVED_DAILY_V1'&&
    daily?.granularity==='OBSERVATION_DATE'&&daily?.sourceStatus==='CONFIRMED';
  const chartStage=owner.querySelector('[data-chart-stage]');
  const svg=owner.querySelector('[data-chart-svg]');
  if(svg){
    if(svg.hidden===hasSeries)svg.hidden=!hasSeries;
    const wanted=hasSeries?'':'hidden';
    if(svg.style.getPropertyValue('visibility')!==wanted){
      if(wanted)svg.style.setProperty('visibility',wanted,'important');else svg.style.removeProperty('visibility');
    }
  }
  if(chartStage){
    let empty=chartStage.querySelector('[data-rona-client-canonical-empty="v7"]');
    if(hasSeries){
      // The old CSS forced display:flex over HTML [hidden], covering every
      // populated graph. Remove the no-data element rather than merely hiding.
      if(empty)empty.remove();
    }else{
      if(!empty){
        empty=el('div',{class:'rona-market-chart-empty','data-rona-client-canonical-empty':'v7'});
        empty.append(el('strong',{text:'Нет подтверждённого ежедневного ряда'}),
          el('span',{text:'Появится после публикации проверенных наблюдений по датам. Прогноз отображается отдельно.'}));
        chartStage.append(empty);
      }
      empty.hidden=false;
    }
  }
  if(hasSeries){
    if(hasDaily){
      textIfDifferent(owner.querySelector('[data-chart-title]'),
        'Динамика '+(chosen==='DT'?'ДТ':'СУГ / СПБТ')+' · USD/т');
      const sourceText=product.basis+
        ' · наблюдения '+daily.firstAsOf+'–'+daily.lastAsOf+
        (daily.sourceGap?' · пропуски в публикациях; без интерполяции':'')+
        (daily.observationCount===1?' · одна подтверждённая точка':'');
      textIfDifferent(owner.querySelector('[data-chart-source]'),sourceText);
      owner.dataset.ronaChartKind='OBSERVATION_DAILY';
    }else{
      textIfDifferent(owner.querySelector('[data-chart-title]'),
        'Динамика '+(chosen==='AI92'?'АИ-92':chosen==='AI95'?'АИ-95':
          chosen==='DT'?'ДТ':'СУГ / СПБТ')+' · USD/т');
      textIfDifferent(owner.querySelector('[data-chart-source]'),
        product.basis+' · даты фактических наблюдений');
      owner.dataset.ronaChartKind='OBSERVATION_DAILY';
    }
  }else{
    textIfDifferent(owner.querySelector('[data-chart-source]'),
      'Ежедневные наблюдения не подтверждены для выбранного продукта');
    textIfDifferent(owner.querySelector('[data-chart-title]'),
      (chosen==='DT'?'ДТ':chosen==='LPG'?'СУГ / СПБТ':chosen==='AI95'?'АИ-95':'АИ-92')+
      ' · ежедневный ряд пока недоступен');
    delete owner.dataset.ronaChartKind;
    // Clearing an entire .rona-market-chart-metric destroyed its <span>
    // label and <strong data-chart-metric> node. The approved chart engine
    // retained references to detached nodes and could NEVER repaint metrics.
    // Reset ONLY the leaf: preserve exact approved DOM and chart references.
    for(const n of owner.querySelectorAll('.rona-market-chart-metric [data-chart-metric]'))
      textIfDifferent(n,'—');
  }
  // Canonical legacy engine contains a baked historical LPG/Saryagash number
  // that does not depend on setPayload. Neutralize only that value.
  if(chosen==='LPG'||chosen==='DT'){
    const cards=owner.querySelectorAll('.an2-kpis .rona-owner-card');
    // Native LPG KPI assumes the last data point is a current physical price.
    // On a financial term structure this would mislabel December as spot.
    textIfDifferent(cards[0]?.querySelector('.rona-owner-kpi'),
      hasDaily?daily.lastAsOf:'—');
    textIfDifferent(cards[0]?.querySelector('.rona-owner-muted'),
      hasDaily?(chosen==='DT'
        ?'Platts ULSD CIF NWE: физический компонент; не композит БНК'
        :'Platts propane: финансовый контракт '+daily.deliveryMonth+'; не региональный спот'):EMPTY_SOURCE);
    if(chosen==='LPG'){
      const second=cards[1];
      textIfDifferent(second?.querySelector('.rona-owner-kpi'),'—');
      textIfDifferent(second?.querySelector('.rona-owner-muted'),
        'Региональная цена требует обновления; архив не является текущим');
    }
  }
  if(chosen==='LPG'&&hasDaily&&daily.historyIncludesAllGapSegments===true&&
     Array.isArray(daily.segmentIds)&&Array.isArray(daily.observedDates)&&
     daily.segmentIds.length===product.dates.length&&daily.observedDates.length===product.dates.length){
    owner.dataset.ronaLpgHistorySegments=JSON.stringify({
      dates:daily.observedDates,ids:daily.segmentIds,gaps:daily.gapBeforeDays||[]
    });
  }else delete owner.dataset.ronaLpgHistorySegments;
  owner.dataset.ronaSelectedProduct=chosen;
  owner.dataset.ronaPhysicalSpotFreshness=product.spotFreshness||'UNAVAILABLE';
  // Selected contract prices remain the only externally authorized RONA prices.
  paintAuthorizedPrices(owner,chosen);
  if(owner.dataset.ronaClientSourceSafe!=='1')owner.dataset.ronaClientSourceSafe='1';
  if(owner.dataset.renderState!==reason)owner.dataset.renderState=reason;
}
function renderCanonical(root,data,reason='PUBLISHED_CURRENT_ONLY'){
  const owner=ensureOwner(root);
  if(!owner)return;
  const view=window.RONA_ANALYTICS_VIEW;
  if(!view||typeof view.setPayload!=='function'){
    owner.dataset.ronaClientSourceSafe='0';
    root.dataset.ronaClientAnalyticsReady='false';
    return;
  }
  const payload=canonicalPayload(data);
  // The original RONA renderer owns its controls, chart, forecast, pricing cards and commentary.
  // Do not retrigger native rendering on our own MutationObserver-driven updates.
  const sig=reason==='PUBLISHED_CURRENT_ONLY'?state.fingerprint:reason;
  if(owner.dataset.ronaClientPayloadFingerprint!==sig||owner.dataset.renderState!==reason){
    view.setPayload(payload);
    owner.dataset.ronaClientPayloadFingerprint=sig;
  }
  ensureSafeCanonicalState(owner,payload,reason);
  root.dataset.ronaClientAnalyticsReady=reason==='PUBLISHED_CURRENT_ONLY'?'true':'false';
  root.dataset.ronaClientMarketIntelligenceFingerprint='analytics:'+state.fingerprint;
}
function renderAnalytics(root,data){renderCanonical(root,data,'PUBLISHED_CURRENT_ONLY')}
function renderError(root,message){renderCanonical(root,{analytics:[],generated_at:''},'ERROR_NO_ARCHIVE')}
function renderLoading(root){renderCanonical(root,{analytics:[],generated_at:''},'LOADING')}
function apply(){
  state.renderQueued=false;
  const root=analyticsPage();
  if(!root)return;
  recoverAnalyticsRoute(root);
  ensureOwner(root);
  if(state.data){
    if(root.dataset.ronaClientMarketIntelligenceFingerprint!=='analytics:'+state.fingerprint)renderAnalytics(root,state.data);
    else{const canonical=ensureOwner(root);if(canonical)ensureSafeCanonicalState(canonical,canonicalPayload(state.data),'PUBLISHED_CURRENT_ONLY')}
    document.documentElement.dataset.ronaClientMarketIntelligence='ready';
  }else if(state.loaded&&state.error){
    renderError(root,'Актуальная опубликованная аналитика временно недоступна. Архивные котировки и прогнозы скрыты.');
    document.documentElement.dataset.ronaClientMarketIntelligence='degraded';
  }else renderLoading(root);
}
function schedule(){if(state.renderQueued)return;state.renderQueued=true;requestAnimationFrame(apply)}
function cacheData(){const entry=window.__RONA_CLIENT_BACKGROUND_CACHE__?.[API_PATH];return entry?.ok&&entry?.body?.ok&&entry?.body?.data?entry.body.data:null}
function accept(data,reason){
  if(!data||data.version!=='RONA_CLIENT_MARKET_INTELLIGENCE_V1'||!Array.isArray(data.analytics)||!Array.isArray(data.news))return false;
  const safe={...data,analytics:data.analytics.filter(isAuthorizedRow),
    clientCanonicalAnalytics:data.clientCanonicalAnalytics?.projection===CLIENT_CANONICAL_PARITY?data.clientCanonicalAnalytics:null};
  const fp=fingerprint(safe);state.data=safe;state.loaded=true;state.error='';state.updatedAt=new Date().toISOString();
  if(fp!==state.fingerprint){state.fingerprint=fp;schedule()}
  try{window.dispatchEvent(new CustomEvent('rona:client:market-intelligence',{detail:{reason,version:safe.version,generated_at:safe.generated_at,analytics_count:safe.analytics.length,news_count:safe.news.length}}))}catch(_){ }
  return true;
}
let requestSequence=0;
async function load(reason='open'){
  const id=++requestSequence;
  // Never retain previous tenant or archive data across refresh/context switch, including failed responses.
  state.data=null;state.fingerprint='';state.loaded=false;state.error='';state.loading=true;
  const root=analyticsPage();if(root)root.dataset.ronaClientMarketIntelligenceFingerprint='';
  document.documentElement.dataset.ronaClientMarketIntelligence='loading';schedule();
  try{
    const r=await fetch(API,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-market-intelligence':MARK}});
    const body=await r.json().catch(()=>null);
    if(id!==requestSequence)return;
    if(!r.ok||!body?.ok||!accept(body.data,reason))throw new Error(String(body?.code||'CLIENT_MARKET_INTELLIGENCE_LOAD_FAILED'));
  }catch(error){
    if(id!==requestSequence)return;
    state.data=null;state.fingerprint='';state.loaded=true;state.error=String(error?.message||error||'CLIENT_MARKET_INTELLIGENCE_LOAD_FAILED');schedule();
  }finally{
    if(id===requestSequence){state.loading=false;schedule()}
  }
}
function start(){
  const cached=cacheData();if(cached)accept(cached,'initial-cache');
  load('open');
  state.timer=setInterval(()=>load('interval'),REFRESH_MS);
  window.addEventListener('focus',()=>load('focus'),{passive:true});
  window.addEventListener('pageshow',()=>load('pageshow'),{passive:true});
  window.addEventListener('online',()=>load('online'),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load('visible')});
  window.addEventListener('rona:client:background-sections',()=>{const c=cacheData();if(c)accept(c,'background-event')},{passive:true});
  window.addEventListener('rona:client-prices-updated',schedule,{passive:true});
  document.addEventListener('click',event=>{
    const productButton=event.target?.closest?.('#page-analytics #rona-analytics-v2 [data-an2-product]');
    if(productButton){
      // Native renderer changes the product synchronously after capture. Refresh
      // source/status labels in its final selection state, without new controls.
      queueMicrotask(schedule);
      requestAnimationFrame(schedule);
      return;
    }
    const trigger=event.target?.closest?.('[data-page="analytics"],[data-page-id="analytics"],[data-page-panel="analytics"]');
    if(trigger)queueMicrotask(()=>load('analytics-open'));
  },true);
  new MutationObserver(()=>schedule()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-page','data-page-id']});
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();