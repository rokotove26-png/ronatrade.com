export const CANONICAL_LIVE_HYDRATION_RUNTIME=String.raw`
;(()=>{
  if(window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__==='source-safe-v2')return;
  window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__='source-safe-v2';
  let inFlight=null,lastApplied='',lastSource=null;
  const API='/portal/api/v1/admin/analytics';
  function valid(payload){
    if(!payload||payload.version!=='RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1'||!payload.products)return false;
    return ['AI92','AI95','DT','LPG'].every(k=>{const p=payload.products[k];return p&&typeof p==='object'&&(p.dates==null||Array.isArray(p.dates))&&(p.values==null||Array.isArray(p.values));});
  }
  function signature(payload){
    return JSON.stringify({
      cutoff: payload.cutoff,
      latestTradeDate: payload.latestTradeDate,
      products: ['AI92','AI95','DT','LPG'].map(key=>{
        const product=payload.products[key]||{};
        return [key,product.dates,product.values,product.forecast,product.rona,product.regionalBenchmark];
      })
    });
  }
  const KEYS=['AI92','AI95','DT','LPG'];
  function referenceMonth(payload){
    const date=String(payload?.latestTradeDate||payload?.cutoff||'');
    if(/^\d{2}\.\d{2}\.\d{4}$/.test(date))return date.slice(6)+'-'+date.slice(3,5);
    if(/^\d{4}-\d{2}/.test(date))return date.slice(0,7);
    return '';
  }
  function hasSeries(p){
    return Array.isArray(p?.dates)&&Array.isArray(p?.values)
      &&p.dates.length>0&&p.dates.length===p.values.length
      &&p.values.every(v=>v!==null&&v!==''&&Number.isFinite(Number(v)));
  }
  function backedForecast(product,payload,key){
    const f=product?.forecast;
    if(!f||typeof f!=='object')return null;
    const date=String(f.month||'');
    const month=/^\d{4}-\d{2}$/.test(date)?date:/^\d{2}\.\d{4}$/.test(date)?date.slice(3)+'-'+date.slice(0,2):'';
    const current=referenceMonth(payload);
    if(!month||!current||month<current||!String(f.sourceRef||'').trim())return null;
    if(!['low','base','high','forward'].every(k=>f[k]!==null&&f[k]!==undefined&&f[k]!==''&&Number.isFinite(Number(f[k]))))return null;
    return {...f,month,low:Number(f.low),base:Number(f.base),high:Number(f.high),forward:Number(f.forward),
      forwardLabel:(key==='LPG'?'Platts propane ':'Forward ')+month,
      curve:String(f.curveType||f.curve||'—'),direction:String(f.direction||'—'),confidence:String(f.confidence||'—'),
      comment:'Прогноз на '+month+' по источнику '+String(f.sourceRef).slice(0,250)+'. Индикативно; не оферта.'};
  }
  function hasPriceBase(product){
    const m=product?.rona;
    return Boolean(m&&m.reference!==null&&m.reference!==undefined&&Number.isFinite(Number(m.reference))
      &&Array.isArray(m.bases)&&m.bases.length>0
      &&m.bases.every(b=>Array.isArray(b)&&b.length===2&&b[1]!==null&&Number.isFinite(Number(b[1]))));
  }
  function availablePayload(payload){
    const products={};
    for(const key of KEYS){
      const product=payload.products?.[key];
      if(!product||typeof product!=='object')continue;
      const dates=Array.isArray(product.dates)?product.dates:[];
      const values=Array.isArray(product.values)?product.values:[];
      if(dates.length!==values.length)continue;
      const series=hasSeries(product),forecast=backedForecast(product,payload,key);
      if(!series&&!forecast)continue;
      const safe=series?{...product}:{};
      if(!series&&hasPriceBase(product))safe.rona=product.rona;
      if(forecast)safe.forecast=forecast;else delete safe.forecast;
      if(!hasPriceBase(product))delete safe.rona;
      if(!series&&product.regionalBenchmark)safe.regionalBenchmark=product.regionalBenchmark;
      products[key]=safe;
    }
    if(!Object.keys(products).length)return null;
    return {...payload,products};
  }
  function decorate(payload){
    if(!payload)return;
    const root=document.querySelector('#rona-analytics-v2');
    const view=window.RONA_ANALYTICS_VIEW;
    if(!root||!view)return;
    const key=String(view.getState?.()?.product||'AI92');
    const product=payload.products?.[key],series=hasSeries(product),forecast=backedForecast(product,payload,key);
    const cards=Array.from(root.querySelectorAll('.an2-kpis .rona-owner-card'));
    if(!series){
      const stage=root.querySelector('[data-chart-stage]');
      if(stage)stage.innerHTML='<div class="an2-empty"><strong>Нет актуального подтверждённого ряда</strong><span>Архивный график скрыт. Прогноз показан отдельно при наличии проверенного источника.</span></div>';
      const title=root.querySelector('[data-chart-title]');if(title)title.textContent='Динамика · нет актуального ряда';
      const source=root.querySelector('[data-chart-source]');if(source)source.textContent='SOURCE UNAVAILABLE';
      root.querySelectorAll('[data-metric]').forEach(el=>{el.textContent='—'});
      if(cards[0]){
        const value=cards[0].querySelector('.rona-owner-kpi');if(value)value.textContent='Нет ряда';
        const note=cards[0].querySelector('.rona-owner-muted');if(note)note.textContent='Актуальная серия по продукту отсутствует';
      }
    }
    if(!forecast){
      const box=root.querySelector('.an2-market-forecast');
      if(box)box.innerHTML='<div class="an2-mf-title">Прогноз недоступен</div><div class="an2-mf-sub">Нет полного актуального прогноза со ссылкой на источник.</div>';
      if(cards[2]){const v=cards[2].querySelector('.rona-owner-kpi');if(v)v.textContent='Нет данных'}
    }
    if(!forecast||!hasPriceBase(product)){
      root.querySelectorAll('.an2-price-card').forEach(card=>{
        for(const selector of ['.an2-price-base','.an2-price-range','.an2-price-current']){
          const el=card.querySelector(selector);if(el)el.textContent='—';
        }
      });
      const note=root.querySelector('.an2-model-note');
      if(note)note.textContent='Нет полного актуального базиса для расчёта индикативной цены. Исторические цены скрыты.';
    }
    if(key==='LPG'&&cards[0]&&series){
      const date=String(product.dates[product.dates.length-1]);
      const note=cards[0].querySelector('.rona-owner-muted');
      if(note)note.textContent='Platts propane · последняя точка ряда: '+date;
      const source=root.querySelector('[data-chart-source]');
      if(source)source.textContent='Platts propane · последняя точка ряда: '+date;
    }
    if(key==='LPG'&&cards[1]){
      const regional=product?.regionalBenchmark;
      const date=String(regional?.date||'');
      const regionalMonth=/^\d{2}\.\d{2}\.\d{4}$/.test(date)?date.slice(6)+'-'+date.slice(3,5):'';
      const valid=regional&&regionalMonth>=referenceMonth(payload)&&['low','high'].every(k=>regional[k]!==null&&regional[k]!==undefined&&Number.isFinite(Number(regional[k])));
      const value=cards[1].querySelector('.rona-owner-kpi'),note=cards[1].querySelector('.rona-owner-muted');
      if(value)value.textContent=valid?Number(regional.low).toLocaleString('ru-RU',{maximumFractionDigits:2})+'–'+Number(regional.high).toLocaleString('ru-RU',{maximumFractionDigits:2})+' USD/т':'Нет актуальных данных';
      if(note)note.textContent=valid?'Petromarket · DAP Сарыагаш · '+date:'Petromarket · DAP Сарыагаш · последняя дата '+(date||'не указана')+'; исторический ориентир скрыт';
    }
  }
  function indicateUnavailable(reason){
    const root=document.querySelector('#rona-analytics-v2');
    document.documentElement.dataset.ronaAnalyticsData='SOURCE_UNAVAILABLE';
    document.documentElement.dataset.ronaAnalyticsError=String(reason||'DATA_NOT_AVAILABLE').slice(0,60);
    if(!root)return;
    const stage=root.querySelector('[data-chart-stage]');
    if(stage)stage.innerHTML='<div class="an2-empty"><strong>Текущие данные недоступны</strong><span>Загрузка подтверждённых котировок и прогнозов не выполнена. Архивные значения скрыты.</span></div>';
    root.querySelectorAll('[data-metric],.an2-kpis .rona-owner-kpi,.an2-price-base,.an2-price-range,.an2-price-current').forEach(el=>{el.textContent='—'});
    const box=root.querySelector('.an2-market-forecast');
    if(box)box.innerHTML='<div class="an2-mf-title">Прогноз недоступен</div><div class="an2-mf-sub">Нет действующего ответа аналитического сервера. Неподтверждённые значения скрыты.</div>';
    const model=root.querySelector('.an2-model-note');
    if(model)model.textContent='Проверьте соединение и полномочия. До восстановления источника прогнозная цена не рассчитывается.';
  }
  async function hydrate(){
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      try{
        const response=await fetch(API,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
        if(!response.ok){indicateUnavailable('HTTP_'+response.status);return false;}
        const body=await response.json().catch(()=>null);
        const payload=body?.data?.canonicalAnalytics;
        if(!valid(payload)){indicateUnavailable('INVALID_CANONICAL_PAYLOAD');return false;}
        const sig=signature(payload);
        if(sig===lastApplied){decorate(lastSource);return true}
        const view=window.RONA_ANALYTICS_VIEW;
        if(!view||typeof view.setPayload!=='function'){indicateUnavailable('VISUAL_RUNTIME_NOT_READY');return false;}
        const livePayload=availablePayload(payload);
        if(!livePayload){decorate(payload);indicateUnavailable('NO_SOURCE_BACKED_ITEMS');return false;}
        const applied=view.setPayload(livePayload);
        if(applied===false){indicateUnavailable('RENDER_REJECTED');return false;}
        lastApplied=sig;lastSource=payload;
        decorate(payload);
        document.documentElement.dataset.ronaAnalyticsData='canonical-daily-live-v2';
        document.documentElement.dataset.ronaAnalyticsAsOf=String(payload.latestTradeDate||payload.cutoff||'');
        try{window.dispatchEvent(new CustomEvent('rona:analytics-live-applied',{detail:{version:payload.version,cutoff:payload.cutoff,latestTradeDate:payload.latestTradeDate,availableProducts:Object.keys(livePayload.products)}}))}catch(_){ }
        return true;
      }catch(_){indicateUnavailable('REQUEST_FAILED');return false}
      finally{inFlight=null}
    })();
    return inFlight;
  }
  function boot(){hydrate()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);
  window.addEventListener('focus',hydrate,{passive:true});
  window.addEventListener('rona:admin-pagechange',hydrate);
  // Capture before controls() replaces the clicked button during its bubble-phase render.
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#rona-analytics-v2 .an2-controls button[data-product]'))setTimeout(()=>decorate(lastSource),0);
  },true);
  setInterval(hydrate,300000);
})();
`;
