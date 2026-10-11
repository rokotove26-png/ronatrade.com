import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';
import { CANONICAL_LIVE_HYDRATION_RUNTIME } from './analytics-canonical-live-hydration.js';

const CANONICAL_ANALYTICS_SOURCE='RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html';
const CANONICAL_ANALYTICS_MARKER='approved-v4.3.2-pricing-bridge-single-owner';
const CANONICAL_PROVENANCE=`\n/* canonical-analytics-source: ${CANONICAL_ANALYTICS_SOURCE}; canonical-runtime: v4.3.2; single-owner */\n`;
const APPROVED_DATA_VALIDATION='\n/* approved-data-contract: AI95 first=1075.25 last=1226.75; differential=AI92+40 USD/t; live-payload=RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1 */\n';

// Source-only prepaint V7. The immutable approved R4 visual base contains a
// historical August demo fixture, used only as layout scaffolding. It must
// never become visible until the server returns CURRENT source-backed data.
const CANONICAL_SOURCE_ONLY_PREPAINT_V7=String.raw`
;(()=>{
  const state=document.documentElement.dataset;
  const root=()=>document.querySelector('#page-analytics > #rona-analytics-v2');
  if(!root()&&state.ronaAnalyticsData==='canonical-daily-live-v3')
    state.ronaAnalyticsData='SOURCE_PENDING';
  if(window.__RONA_ANALYTICS_CURRENT_SOURCE_PREPAINT_V7__)return;
  window.__RONA_ANALYTICS_CURRENT_SOURCE_PREPAINT_V7__='source-only-v7';
  if(state.ronaAnalyticsData!=='canonical-daily-live-v3')
    state.ronaAnalyticsData='SOURCE_PENDING';
  const id='rona-analytics-source-only-prepaint-v7';
  if(!document.getElementById(id)){
    const style=document.createElement('style');
    style.id=id;
    style.textContent=[
      'html:not([data-rona-analytics-data="canonical-daily-live-v3"]) body #page-analytics > #rona-analytics-v2{visibility:hidden!important;opacity:0!important;pointer-events:none!important}',
      'html:not([data-rona-analytics-data="canonical-daily-live-v3"]) body #page-analytics.page.active::before{content:"Загрузка подтверждённых котировок за последние 30 дней…";display:block;margin:18px auto;padding:20px 24px;max-width:850px;box-sizing:border-box;border:1px solid rgba(111,198,235,.22);border-radius:14px;background:rgba(9,24,40,.86);color:#c6eaff;font:600 14px/1.55 Segoe UI,Arial,sans-serif}',
      'html[data-rona-analytics-data="SOURCE_UNAVAILABLE"] body #page-analytics.page.active::before{content:"Подтверждённые данные недоступны. Архивные значения скрыты."}'
    ].join('');
    (document.head||document.documentElement).appendChild(style);
  }
  // Capture comes before the frozen R4 raw demo's own pagechange renderer.
  // Hide the old samples until the next authenticated response is validated.
  window.addEventListener('rona:admin-pagechange',event=>{
    if(String(event?.detail?.page||'')==='analytics')
      document.documentElement.dataset.ronaAnalyticsData='SOURCE_PENDING';
  },true);
})();
`;

const CANONICAL_PRICING_BRIDGE_RUNTIME=String.raw`
;(()=>{
  if(window.__RONA_ANALYTICS_PRICING_BRIDGE_V432__==='canonical-v4.3.2')return;
  window.__RONA_ANALYTICS_PRICING_BRIDGE_V432__='canonical-v4.3.2';
  const baseView=window.RONA_ANALYTICS_VIEW;
  if(!baseView)return;
  const models=new Map();
  function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
  function pricingBridgeFor(model,basis){
    const bridges=model?.bridges;
    if(!bridges||typeof bridges!=='object')return null;
    const raw=bridges[basis];
    if(!raw||typeof raw!=='object')return null;
    const rail=finite(raw.rail),commercial=finite(raw.commercial),other=finite(raw.other)||0;
    if(rail===null||commercial===null)return null;
    return {rail,commercial,other,source:String(raw.source||'LOCAL_INPUT'),updatedAt:String(raw.updatedAt||'')};
  }
  function calculateRonaScenario(p,basis,current){
    const f=p.forecast,model=p.rona||{};
    const bridge=pricingBridgeFor(model,basis);
    if(bridge){
      const add=bridge.rail+bridge.commercial+bridge.other;
      return {mode:'BRIDGE',low:f.low+add,base:f.base+add,high:f.high+add,current,bridge};
    }
    const reference=finite(model.reference)??finite(f.reference);
    if(reference===null)return {mode:'UNAVAILABLE',low:null,base:null,high:null,current};
    return {mode:'LEGACY_DELTA',low:current+(f.low-reference),base:current+(f.base-reference),high:current+(f.high-reference),current};
  }
  const fmt=(v,d=2)=>Number(v).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});
  const readNumber=node=>{
    const text=String(node?.textContent||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
    const m=text.match(/-?[0-9][0-9\s]*(?:[,.][0-9]+)?/);
    if(!m)return null;
    return finite(m[0].replace(/\s/g,'').replace(',','.'));
  };
  const root=()=>document.querySelector('#rona-analytics-v2');
  const ronaBox=()=>root()?.querySelector('.an2-rona')||null;
  const currentState=()=>{try{return baseView.getState?.()||{}}catch(_){return {}}};
  function readForecast(){
    const rows=Array.from(root()?.querySelectorAll('.an2-market-forecast .an2-mf-row, .an2-mf-row')||[]);
    const out={};
    for(const row of rows){
      const label=String(row.querySelector('span')?.textContent||'').trim().toUpperCase();
      const value=readNumber(row.querySelector('strong'));
      if(value===null)continue;
      if(label==='LOW')out.low=value;else if(label==='BASE')out.base=value;else if(label==='HIGH')out.high=value;
    }
    return finite(out.low)!==null&&finite(out.base)!==null&&finite(out.high)!==null?out:null;
  }
  function captureCards(){
    return Array.from(ronaBox()?.querySelectorAll('.an2-price-card')||[]).map(card=>{
      const basis=String(card.querySelector('h3')?.textContent||'').trim();
      let current=finite(card.dataset.ronaCurrent);
      if(current===null){current=readNumber(card.querySelector('.an2-price-current'));if(current!==null)card.dataset.ronaCurrent=String(current)}
      return {card,basis,current};
    }).filter(x=>x.basis&&x.current!==null);
  }
  function mergeModel(key,patch){
    if(!key||!patch||typeof patch!=='object')return;
    const prev=models.get(key)||{};
    const next={...prev,...patch};
    if(patch.bridges&&typeof patch.bridges==='object')next.bridges={...(prev.bridges||{}),...patch.bridges};
    models.set(key,next);
  }
  function extractPricingModels(payload){
    if(!payload?.products||typeof payload.products!=='object')return;
    for(const [key,product] of Object.entries(payload.products))if(product?.rona&&typeof product.rona==='object')mergeModel(key,product.rona);
  }
  function applyPricingBridge(){
    const box=ronaBox();if(!box)return false;
    const state=currentState(),key=state.product||'';
    const model=models.get(key)||{};
    const forecast=readForecast();
    const cards=captureCards();
    let bridgeCount=0,totalCount=0;
    if(forecast){
      for(const {card,basis,current} of cards){
        const bridge=pricingBridgeFor(model,basis);
        totalCount++;
        if(!bridge){card.dataset.pricingMode='LEGACY_DELTA';continue}
        const calc=calculateRonaScenario({forecast,rona:model},basis,current);
        if(calc.mode!=='BRIDGE')continue;
        bridgeCount++;
        card.dataset.pricingMode='BRIDGE';
        const baseEl=card.querySelector('.an2-price-base'),rangeEl=card.querySelector('.an2-price-range'),currentEl=card.querySelector('.an2-price-current');
        if(baseEl)baseEl.textContent=fmt(calc.base,2)+' USD/т';
        if(rangeEl)rangeEl.textContent='LOW '+fmt(calc.low,2)+'  ·  HIGH '+fmt(calc.high,2);
        if(currentEl)currentEl.textContent='Текущий R2: '+fmt(current,2)+' USD/т';
      }
    }
    const bridgeActive=totalCount>0&&bridgeCount===totalCount;
    box.dataset.pricingMode=bridgeActive?'BRIDGE':'LEGACY_DELTA';
    const note=box.querySelector('.an2-model-note');
    if(note)note.textContent=bridgeActive
      ?'Расчёт: прогнозный рыночный нетбек + актуальный ЖД тариф + коммерческие компоненты RONA Trade. Активен локальный pricing bridge; значения остаются индикативными и не являются коммерческой офертой.'
      :'Смысл блока: прогнозный рыночный нетбек + актуальный ЖД тариф + коммерческие компоненты RONA Trade. До загрузки полного набора локальных pricing-inputs сохранён прежний индикативный расчёт по изменению рынка относительно reference; это не коммерческая оферта.';
    try{window.dispatchEvent(new CustomEvent('rona:analytics-price-model',{detail:{product:key,mode:box.dataset.pricingMode,bridgeCount,totalCount}}))}catch(_){ }
    return bridgeActive;
  }
  const callAndApply=(name,args)=>{const fn=baseView?.[name];if(typeof fn!=='function')return false;const result=fn.apply(baseView,args);applyPricingBridge();return result};
  window.RONA_ANALYTICS_VIEW={
    version:'functional-v4.3.2',
    getState:()=>({...currentState(),pricingMode:ronaBox()?.dataset?.pricingMode||'LEGACY_DELTA'}),
    setProduct:(...args)=>callAndApply('setProduct',args),
    setSource:(...args)=>callAndApply('setSource',args),
    render:(...args)=>callAndApply('render',args),
    updateProduct:(key,patch)=>{
      if(!patch||typeof patch!=='object')return false;
      if(patch.rona&&typeof patch.rona==='object')mergeModel(key,patch.rona);
      const safePatch={...patch};
      if(safePatch.rona&&Object.keys(safePatch.rona).every(k=>k==='bridges'))delete safePatch.rona;
      const result=typeof baseView.updateProduct==='function'?baseView.updateProduct(key,safePatch):false;
      applyPricingBridge();return result;
    },
    setPricingBridge:(key,bridges)=>{
      if(!key||!bridges||typeof bridges!=='object')return false;
      mergeModel(key,{bridges});applyPricingBridge();return true;
    },
    setPayload:payload=>{
      if(!payload||typeof payload!=='object')return false;
      extractPricingModels(payload);
      const safe={...payload};
      if(payload.products&&typeof payload.products==='object'){
        safe.products={};
        for(const [key,product] of Object.entries(payload.products)){
          if(!product||typeof product!=='object'){safe.products[key]=product;continue}
          const copy={...product};
          if(copy.rona&&Object.keys(copy.rona).every(k=>k==='bridges'))delete copy.rona;
          safe.products[key]=copy;
        }
      }
      const result=typeof baseView.setPayload==='function'?baseView.setPayload(safe):false;
      applyPricingBridge();return result;
    }
  };
  applyPricingBridge();
})();
`;

const CANONICAL_LPG_NETBACK_TARIFF_UI_V9=String.raw`
    // V9: previously approved LPG model — Platts netback plus only verified,
    // nonexpired owner-approved rail tariffs whose destination equals the
    // published CPT quote. Never imply that missing full-route costs are zero.
    // V11 remove only synthetic source cards from a previous decoration pass.
    for(const transientV11 of root.querySelectorAll('.an2-price-card[data-rona-source-card-v11="1"]'))
      transientV11.remove();
    if(key==='LPG'&&forecast&&document.documentElement.dataset.ronaAnalyticsData!=='SOURCE_UNAVAILABLE'){
      const tariffBridgesV9=product?.rona?.netbackTariffBridges;
      // Populate all CPT cards from the owner-authorized source, not frozen August DATA.
      const sourceQuotesV11=Array.isArray(product?.rona?.bases)?product.rona.bases:[];
      const quotedCptsV11=new Map(sourceQuotesV11.filter(x=>
        Array.isArray(x)&&typeof x[0]==='string'&&x[0].startsWith('CPT ')));
      const existingCptsV11=Array.from(root.querySelectorAll('.an2-price-card'));
      const cardHostV11=existingCptsV11[0]?.parentElement;
      if(cardHostV11&&quotedCptsV11.size){
        const seenV11=new Set(existingCptsV11.map(c=>
          String(c.querySelector('h3')?.textContent||'').trim()));
        for(const [cptV11] of quotedCptsV11){
          if(seenV11.has(cptV11))continue;
          const cloneV11=existingCptsV11[0].cloneNode(true);
          for(const nodeV11 of [cloneV11,...cloneV11.querySelectorAll('[id]')])
            nodeV11.removeAttribute('id');
          const titleV11=cloneV11.querySelector('h3');
          const baseV11=cloneV11.querySelector('.an2-price-base');
          const rangeV11=cloneV11.querySelector('.an2-price-range');
          const lineV11=cloneV11.querySelector('.an2-price-current');
          if(!titleV11||!baseV11||!rangeV11||!lineV11)continue;
          titleV11.textContent=cptV11;
          baseV11.textContent='—';rangeV11.textContent='—';lineV11.textContent='—';
          cloneV11.removeAttribute('data-rona-current');
          cloneV11.removeAttribute('data-pricing-mode');
          cloneV11.dataset.ronaSourceCardV11='1';
          cardHostV11.appendChild(cloneV11);
          seenV11.add(cptV11);
        }
        if(Array.from(cardHostV11.children).every(c=>
          c.classList.contains('an2-price-card'))){
          cardHostV11.style.display='grid';
          cardHostV11.style.gridTemplateColumns='repeat(auto-fit,minmax(min(210px,100%),1fr))';
          cardHostV11.style.gap='10px';
        }
      }
      const pricingCardsV9=Array.from(root.querySelectorAll('.an2-price-card'));
      let matchedTariffCardsV9=0;
      const matchedCptV10=new Set();
      if(tariffBridgesV9&&typeof tariffBridgesV9==='object'){
        for(const priceCardV9 of pricingCardsV9){
          const basisV9=String(priceCardV9.querySelector('h3')?.textContent||'').trim();
          const bV9=tariffBridgesV9[basisV9];
          if(!bV9||bV9.model!=='PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1'||
             bV9.tariffStatus!=='WORKING_CONFIRMED'||
             bV9.marketMonth!==forecast.month||
             bV9.marketSourceRef!==forecast.sourceRef||
             !String(bV9.tariffKey||'').trim()||
             !String(bV9.route||'').endsWith(basisV9.slice(4))||
             !Array.isArray(bV9.sourceRefs)||!bV9.sourceRefs.length||
             !bV9.approvedAt||
             bV9.railUsdT===null||bV9.railUsdT===undefined||
             !(Number(bV9.railUsdT)>0&&Number.isFinite(Number(bV9.railUsdT))))continue;
          const railV9=Number(bV9.railUsdT);
          const lowV9=Number(forecast.low)+railV9;
          const baseV9=Number(forecast.base)+railV9;
          const highV9=Number(forecast.high)+railV9;
          if(![lowV9,baseV9,highV9].every(Number.isFinite))continue;
          const mainV9=priceCardV9.querySelector('.an2-price-base');
          const rangeV9=priceCardV9.querySelector('.an2-price-range');
          const railLineV9=priceCardV9.querySelector('.an2-price-current');
          if(!mainV9||!rangeV9||!railLineV9)continue;
          mainV9.textContent=formatValue(baseV9)+' USD/т';
          rangeV9.textContent='LOW '+formatValue(lowV9)+' · HIGH '+formatValue(highV9);
          railLineV9.textContent='ЖД тариф '+formatValue(railV9)+' USD/т · '+String(bV9.route)+' · подтверждённый участок, не полная логистика';
          priceCardV9.dataset.pricingMode='PLATTS_NETBACK_PLUS_CONFIRMED_RAIL_V1';
          matchedCptV10.add(basisV9);
          matchedTariffCardsV9++;
        }
      }
      // V10: every published CPT basis gets a truthful source-readiness status.
      // The server-provided V9 bridge is the only authority for a Nov price.
      // Unmatched bases retain NO projected price (never reuse published R12).
      for(const priceCardV10 of pricingCardsV9){
        const basisV10=String(priceCardV10.querySelector('h3')?.textContent||'').trim();
        if(matchedCptV10.has(basisV10))continue;
        const mainV10=priceCardV10.querySelector('.an2-price-base');
        const rangeV10=priceCardV10.querySelector('.an2-price-range');
        const lineV10=priceCardV10.querySelector('.an2-price-current');
        if(!basisV10.startsWith('CPT ')||!mainV10||!rangeV10||!lineV10)continue;
        const coverageV10=product?.rona?.netbackTariffCoverage?.[basisV10];
        const routesV10=Array.isArray(coverageV10?.matches)?coverageV10.matches:[];
        const linesV10=routesV10.map(route=>{
          const value=route.railUsdT;
          const rate=value===null||value===undefined||!Number.isFinite(Number(value))
            ?'ставка отсутствует':formatValue(Number(value))+' USD/т';
          return String(route.route||'Маршрут')+': '+rate+' · '+String(route.tariffStatus||'TO_VERIFY');
        });
        mainV10.textContent='Не рассчитана';
        rangeV10.textContent='Прогноз '+forecast.month+' · недостаточно текущих тарифных данных';
        lineV10.textContent=linesV10.length?linesV10.join(' | '):
          'Для '+basisV10+' нет точного подтверждённого тарифного плеча';
        lineV10.title=lineV10.textContent;
        lineV10.style.whiteSpace='normal';
        lineV10.style.overflowWrap='anywhere';
        priceCardV10.dataset.pricingMode='MISSING_CONFIRMED_ROUTE_TARIFF';
      }
      root.dataset.ronaPricingCardsReviewed=String(pricingCardsV9.length);
      if(matchedTariffCardsV9>0){
        root.dataset.ronaPricingReadiness=matchedTariffCardsV9===pricingCardsV9.length
          ?'PLATTS_NETBACK_TARIFF_FULL':'PLATTS_NETBACK_TARIFF_PARTIAL';
        const modelNoteV9=root.querySelector('.an2-model-note');
        if(modelNoteV9)modelNoteV9.textContent='СУГ: Platts '+forecast.month+
          ' как прогнозный нетбек + утверждённый действующий ЖД тариф по совпадающему CPT-маршруту. Рассчитано '+
          matchedTariffCardsV9+' из '+pricingCardsV9.length+
          ' направлений. Остальные карточки показывают отсутствующие и исторические тарифные данные без подмены их ноябрьской ценой. Неучтённые расходы и коммерческая маржа не приравниваются к нулю. Индикативно, не коммерческая оферта.';
      }
    }
`;

function canonicalizeV432(source){
  let out=CANONICAL_SOURCE_ONLY_PREPAINT_V7+source;
  out=out.replaceAll("document.documentElement.dataset.ronaAnalyticsLocal='v4.3.1'","document.documentElement.dataset.ronaAnalyticsLocal='v4.3.2'");
  out=out.replaceAll("version:'functional-v4.3.1'","version:'functional-v4.3.2'");
  out=out.replaceAll('approved-v4.3.1-single-owner',CANONICAL_ANALYTICS_MARKER);
  out+=CANONICAL_PRICING_BRIDGE_RUNTIME+CANONICAL_LIVE_HYDRATION_RUNTIME+APPROVED_DATA_VALIDATION;
  // V8: show the *exact missing pricing component* in the existing R4 note.
  // This changes neither the R4 painter nor a value or commercial formula.
  // Keep the already approved fail-closed behavior of the PRICE cards.
  const priceMissingNote="      if(note)note.textContent='Нет полного актуального базиса для расчёта индикативной цены. Исторические цены скрыты.';";
  if(out.split(priceMissingNote).length!==2)
    throw new Error('ANALYTICS_V8_PRICE_GUARD_SOURCE_LOCK_MISMATCH');
  out=out.replace(priceMissingNote,
    "      const quote=product?.rona;"+
    "      const bases=Array.isArray(quote?.bases)?quote.bases:[];"+
    "      const reference=quote?.reference;"+
    "      const reason=!forecast?'SOURCE_FORECAST_UNVERIFIED':"+
    "        !bases.length?'RONA_CPT_QUOTATIONS_MISSING':"+
    "        reference===null||reference===undefined||!Number.isFinite(Number(reference))?"+
    "          'MARKET_REFERENCE_NOT_CONFIRMED':"+
    "          'INCOMPLETE_PRICE_BASIS';"+
    "      root.dataset.ronaPricingReadiness=reason;"+
    "      if(note)note.textContent="+
    "        reason==='SOURCE_FORECAST_UNVERIFIED'"+
    "          ?'Нет подтверждённого прогноза LOW / BASE / HIGH на выбранный месяц с проверяемым источником. Расчёт возможных цен RONA Trade не выполняется.'"+
    "        : reason==='RONA_CPT_QUOTATIONS_MISSING'"+
    "          ?'Нет актуальных подтверждённых цен RONA Trade по базисам CPT. Нельзя рассчитать возможные цены без исходных котировок.'"+
    "        : reason==='MARKET_REFERENCE_NOT_CONFIRMED'"+
    "          ?'Котировки CPT имеются, но отсутствует подтверждённый сопоставимый рыночный референс для пересчёта на месяц прогноза. Исторические или несопоставимые значения не используются.'"+
    "          :'Недостаточно подтверждённых компонентов для индикативного расчёта цены. Исторические значения исключены.';");
  const priceGuard="    if(!forecast||!hasPriceBase(product)){";
  if(out.split(priceGuard).length!==2)
    throw new Error('ANALYTICS_V8_PRICING_STATUS_SOURCE_LOCK_MISMATCH');
  out=out.replace(priceGuard,"    root.dataset.ronaPricingReadiness=forecast&&hasPriceBase(product)?'CALCULATED':'UNAVAILABLE';\n"+priceGuard);

  // V9 plugs the existing R4 price-card contract AFTER R3/R4 source-safe
  // decoration. It uses the approved Admin-only LPG tariff projection, never
  // changes compressed original visuals and never invents an absent tariff.
  const lpgVerifiedDecorationAnchor="    if(key==='LPG'&&cards[0]&&series&&!term&&!confirmedDaily){";
  if(out.split(lpgVerifiedDecorationAnchor).length!==2)
    throw new Error('ANALYTICS_V9_LPG_TARIFF_DECORATION_SOURCE_LOCK_MISMATCH');
  out=out.replace(lpgVerifiedDecorationAnchor,CANONICAL_LPG_NETBACK_TARIFF_UI_V9+'\n'+lpgVerifiedDecorationAnchor);

  // A pagechange hides the frozen August bootstrap while fresh data is
  // revalidated. A same-signature confirmed response must unhide it again.
  const unchanged="if(sig===lastApplied){decorate(lastSource);return true}";
  if(out.split(unchanged).length!==2)
    throw new Error('ANALYTICS_V7_LIVE_CACHE_REVALIDATION_SOURCE_LOCK_MISMATCH');
  out=out.replace(unchanged,"if(sig===lastApplied){decorate(lastSource);document.documentElement.dataset.ronaAnalyticsData='canonical-daily-live-v3';return true}");
  // Dedicated Admin R4 painter is the only SVG writer. No V13 competing
  // observer/repaint runtime may be shipped in this canonical endpoint.
  for(const stale of ['__RONA_LPG_OBSERVATION_GAPS_V13__','source-observation-gaps-v13','svg.dataset.ronaLpgHistoryV13=sig'])
    if(out.includes(stale))throw new Error('ANALYTICS_V6_DUPLICATE_SVG_LAYER:'+stale);
  const required=['RONA TRADE · ANALYTICS','Внутренний аналитический контур','Базовая котировка','Возможные цены RONA Trade','Аналитический вывод','function pricingBridgeFor','function calculateRonaScenario',"version:'functional-v4.3.2'",'setPricingBridge','rona:analytics-price-model','RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1','canonical-daily-live','1075.25','1226.75'];
  for(const token of required)if(!out.includes(token))throw new Error(`CANONICAL_ANALYTICS_V432_MISSING:${token}`);
  for(const stale of ['rona-analytics-canonical-title','Комментарий Коммерческого директора','Аналитическая лента'])if(out.includes(stale))throw new Error(`CANONICAL_ANALYTICS_STALE_OWNER:${stale}`);
  return out;
}

export async function onRequest(context){
  const response=await approvedAnalytics(context);
  const source=await response.text();
  const canonicalSource=canonicalizeV432(source);
  const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('etag');
  headers.set('cache-control','no-store, no-cache, must-revalidate');
  headers.set('pragma','no-cache');
  headers.set('expires','0');
  headers.set('x-rona-analytics-ui',CANONICAL_ANALYTICS_MARKER);
  headers.set('x-rona-analytics-source-file',CANONICAL_ANALYTICS_SOURCE);
  headers.set('x-rona-analytics-owner','approved-v432-exclusive');
  headers.set('x-rona-analytics-visual','approved-hero-v432-pricing-bridge');
  headers.set('x-rona-analytics-chart','designer-v3-shared-gasoline-axis');
  headers.set('x-rona-analytics-data','canonical-daily-live-v1');
  return new Response(canonicalSource+CANONICAL_PROVENANCE,{status:response.status,statusText:response.statusText,headers});
}
