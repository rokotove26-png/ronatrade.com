export const CANONICAL_LIVE_HYDRATION_RUNTIME=String.raw`
;(()=>{
  if(window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__==='source-safe-v4-observation-daily')return;
  window.__RONA_ANALYTICS_CANONICAL_DAILY_LIVE__='source-safe-v4-observation-daily';
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
        return [key,product.dates,product.values,product.forecast,product.rona,product.regionalBenchmark,product.dailyMonitor,product.termCurve];
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
  function markLpgObservationGaps(root,p){
    const m=p?.dailyMonitor, ids=m?.segmentIds,dates=m?.observedDates;
    const svg=root.querySelector('.rona-market-chart-svg,[data-chart-svg]');
    const points=[...(svg?.querySelectorAll('circle.rmc-point')||[])];
    if(!m?.historyIncludesAllGapSegments||!Array.isArray(ids)||!Array.isArray(dates)||
       ids.length<2||ids.length!==points.length||dates.length!==points.length)return;
    const tm=dates.map(d=>Date.parse(d+'T00:00:00Z'));
    if(tm.some(t=>!Number.isFinite(t))||tm.at(-1)<=tm[0])return;
    const x=tm.map(t=>62+896*(t-tm[0])/(tm.at(-1)-tm[0]));
    const y=points.map(p=>Number(p.getAttribute('cy')));
    points.forEach((p,i)=>p.setAttribute('cx',String(x[i])));
    [...svg.querySelectorAll('text.rmc-point-label')].forEach((p,i)=>p.setAttribute('x',String(x[i])));
    svg.querySelectorAll('path.rmc-area,path.rmc-line-depth,path.rmc-line-glow,path.rmc-line').forEach(n=>n.remove());
    for(let i=1;i<ids.length;i++)if(ids[i]===ids[i-1]){
      for(const cl of ['rmc-line-depth','rmc-line-glow','rmc-line']){
        const n=document.createElementNS('http://www.w3.org/2000/svg','path');
        n.setAttribute('class',cl);n.setAttribute('d','M '+x[i-1]+' '+y[i-1]+' L '+x[i]+' '+y[i]);
        svg.insertBefore(n,points[0]);
      }
    }
    for(const t of svg.querySelectorAll('text.rmc-axis')){
      const i=dates.findIndex(d=>d.slice(8,10)+'.'+d.slice(5,7)===t.textContent.trim());
      if(i>=0&&t.getAttribute('y')==='372')t.setAttribute('x',String(x[i]));
    }
    root.dataset.ronaSourceGapSegments=String(new Set(ids).size);
    root.dataset.ronaGapInterpolation='OFF';
  }
  function hasSeries(p,key){
    const base=Array.isArray(p?.dates)&&Array.isArray(p?.values)&&
      p.dates.length>0&&p.dates.length===p.values.length&&
      p.values.every(v=>v!==null&&v!==''&&Number.isFinite(Number(v)))&&
      p.dates.every(d=>/^\d{2}\.\d{2}$/.test(String(d)));
    if(!base)return false;
    if(key!=='DT'&&key!=='LPG')return true;
    const d=p.dailyMonitor;
    return d?.version==='RONA_MARKET_OBSERVED_DAILY_V1'&&
      d?.granularity==='OBSERVATION_DATE'&&
      d?.sourceFamily==='PLATTS'&&d?.sourceStatus==='CONFIRMED'&&
      d?.noInterpolation===true&&d?.notMonthlyMaturityCurve===true&&
      Number(d.observationCount)===p.dates.length&&
      Array.isArray(d.observedDates)&&d.observedDates.length===p.dates.length&&
      d.observedDates.every((day,i)=>
        /^\d{4}-\d{2}-\d{2}$/.test(day)&&
        day.slice(8,10)+'.'+day.slice(5,7)===p.dates[i]&&
        (i===0||day>d.observedDates[i-1]));
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
  function backedTermCurve(product,payload,key,forecast){
    if(key!=='DT'&&key!=='LPG')return null;
    const term=product?.termCurve;
    if(!term||term.kind!=='FORWARD_TERM_STRUCTURE'||term.sourceFamily!=='PLATTS'||term.sourceStatus!=='CONFIRMED')return null;
    if(String(term.asOfDate||'')!==String(payload.latestTradeDate||payload.cutoff||''))return null;
    if(!String(term.sourceRef||'').trim()||!String(term.sourceDocId||'').trim()||!String(term.indexName||'').trim()||!String(term.basis||'').trim())return null;
    if(!forecast||String(forecast.sourceRef||'')!==String(term.sourceRef||''))return null;
    if(!Number.isFinite(Number(forecast.base))||Math.abs(Number(forecast.base)-Number(term.values?.[1]))>0.001)return null;
    if(!Array.isArray(term.dates)||!Array.isArray(term.values)||!Array.isArray(term.deliveryMonths))return null;
    if(term.dates.length!==3||term.values.length!==3||term.deliveryMonths.length!==3||Number(term.observationCount)!==3)return null;
    if(!term.values.every(v=>v!==null&&v!==''&&Number.isFinite(Number(v))))return null;
    if(!term.deliveryMonths.every((v,i)=>typeof v==='string'&&/^\d{4}-\d{2}$/.test(v)&&term.dates[i]===v.slice(5)+'.'+v.slice(0,4)))return null;
    const pivot=referenceMonth(payload);
    if(!pivot||term.deliveryMonths[0]!==pivot||term.deliveryMonths[1]!==forecast?.month)return null;
    const nextMonth=month=>{const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m,1));return d.toISOString().slice(0,7)};
    if(term.deliveryMonths[1]!==nextMonth(pivot)||term.deliveryMonths[2]!==nextMonth(term.deliveryMonths[1]))return null;
    if(key==='DT'&&term.indexName!=='Composite ULSD 10 ppmS FOB ARA + CIF NWE Cargo Financial')return null;
    if(key==='LPG'&&term.indexName!=='Propane CIF NWE Large Cargo Financial')return null;
    return term;
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
      const series=hasSeries(product,key),forecast=backedForecast(product,payload,key);
      const term=null; // Maturity months cannot be charted as daily observations.
      if(!series&&!forecast&&!term)continue;
      const safe=series?{...product}:{};
      if(!series&&hasPriceBase(product))safe.rona=product.rona;
      // Never replace observation dates with month-of-delivery labels.
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
    const product=payload.products?.[key],series=hasSeries(product,key),forecast=backedForecast(product,payload,key);
    const term=null; // Maturity months cannot be charted as daily observations.
    const cards=Array.from(root.querySelectorAll('.an2-kpis .rona-owner-card'));
    if(!series&&!term){
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
    const daily=product?.dailyMonitor;
    const confirmedDaily=(key==='DT'||key==='LPG')&&series&&
      daily?.version==='RONA_MARKET_OBSERVED_DAILY_V1'&&
      daily?.granularity==='OBSERVATION_DATE'&&daily?.noInterpolation===true&&
      daily?.sourceStatus==='CONFIRMED';
    if(confirmedDaily){
      const title=root.querySelector('[data-chart-title]');
      if(title)title.textContent='Динамика '+(key==='DT'?'ДТ':'СУГ / СПБТ')+' · USD/т';
      const source=root.querySelector('[data-chart-source]');
      if(source)source.textContent=String(product.basis||'Platts')+
        ' · даты наблюдений '+daily.firstAsOf+'–'+daily.lastAsOf+
        (daily.sourceGap?' · пропуски в источнике; интерполяция запрещена':'')+
        (daily.observationCount===1?' · одно подтверждённое наблюдение':'');
      if(cards[0]){
        const value=cards[0].querySelector('.rona-owner-kpi');
        if(value)value.textContent=daily.lastAsOf||'—';
        const note=cards[0].querySelector('.rona-owner-muted');
        if(note)note.textContent=key==='DT'
          ?'Platts ULSD CIF NWE · физический компонент, не композит БНК'
          :'Platts Financial · фиксированный месяц поставки '+daily.deliveryMonth+' · не региональный спот';
      }
      root.dataset.ronaChartKind='OBSERVATION_DAILY';
      root.dataset.ronaChartAsOf=String(daily.lastAsOf||'');
      root.dataset.ronaChartInstrument=String(daily.instrument||'');
      if(key==='LPG'&&daily?.historyIncludesAllGapSegments===true&&
         Array.isArray(daily.segmentIds)&&Array.isArray(daily.observedDates)){
        root.dataset.ronaLpgHistorySegments=JSON.stringify({
          dates:daily.observedDates,ids:daily.segmentIds,gaps:daily.gapBeforeDays||[]
        });
        markLpgObservationGaps(root,product);
      }else delete root.dataset.ronaLpgHistorySegments;
    }else if(root.dataset.ronaChartKind==='OBSERVATION_DAILY'){
      delete root.dataset.ronaChartKind;delete root.dataset.ronaChartAsOf;delete root.dataset.ronaChartInstrument;
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
    if(key==='LPG'&&cards[0]&&series&&!term&&!confirmedDaily){
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

    renderAdminInsight(payload,product,key,series,forecast);
  }

  const ADMIN_INSIGHT_V1='20261010-admin-analytics-source-locked-insight-v1';
  const insightNumber=x=>Number(x).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
  function renderAdminInsight(payload,product,key,series,forecast){
    const root=document.querySelector('#rona-analytics-v2');
    const panel=root?.querySelector('.an2-comment');
    if(!panel)return;
    let style=document.getElementById('ronaAdminSourceInsightV1Style');
    if(!style){
      style=document.createElement('style');style.id='ronaAdminSourceInsightV1Style';
      style.textContent='#page-analytics #rona-analytics-v2 .an2-comment{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:9px 0 8px!important;font-size:13px;line-height:1.5}'+
        '#page-analytics #rona-analytics-v2 .an2-insight-piece{display:flex;flex-direction:column;gap:7px;min-width:0;padding:12px 13px;border:1px solid rgba(105,182,216,.18);border-radius:11px;background:rgba(8,21,34,.5);overflow-wrap:anywhere}'+
        '#page-analytics #rona-analytics-v2 .an2-insight-label{font-weight:800;font-size:11px;letter-spacing:.05em;color:#86d9ef;text-transform:uppercase}'+
        '#page-analytics #rona-analytics-v2 .an2-insight-value{font-size:13px;color:#dbe9f2}'+
        '#page-analytics #rona-analytics-v2 [data-comment-source]{font-size:11px;line-height:1.5;color:#9cafbb}'+
        '@media(max-width:930px){#page-analytics #rona-analytics-v2 .an2-comment{grid-template-columns:1fr}}';
      document.head.append(style);
    }
    const sourceSelected=String(window.RONA_ANALYTICS_VIEW?.getState?.()?.source||'PLATTS').toUpperCase();
    const items=[];
    const add=(label,body)=>items.push({label,body});
    const formatDate=x=>{
      const v=String(x||'');
      return /^\d{4}-\d{2}-\d{2}$/.test(v)?v.slice(8,10)+'.'+v.slice(5,7)+'.'+v.slice(0,4):v;
    };
    const dates=Array.isArray(product?.dailyMonitor?.observedDates)&&
      product.dailyMonitor.observedDates.length===product?.values?.length?
      product.dailyMonitor.observedDates:product?.dates||[];
    const values=series&&Array.isArray(product?.values)?product.values.map(Number):[];
    let latestDate='';
    if(sourceSelected==='ARGUS'&&key!=='LPG'){
      add('Факт рынка','Подтверждённый ряд Argus по выбранному инструменту не опубликован. Динамика по Argus не рассчитывается.');
      add('Прогноз','Для выбранного источника Argus подтверждённый прогноз отсутствует.');
      add('Цены RONA Trade','Расчёт по неподтверждённому источнику не выполняется.');
    }else{
      if(values.length){
        latestDate=formatDate(dates.at(-1));
        let fact='Последнее подтверждённое наблюдение: '+insightNumber(values.at(-1))+' USD/т'+
          (latestDate?' ('+latestDate+')':'')+'.';
        if(values.length>1){
          const movement=values.at(-1)-values[0];
          const direction=movement>0?'рост':movement<0?'снижение':'без изменения';
          fact+=' За '+values.length+' опубликованных наблюдений: '+direction+
            ' на '+insightNumber(Math.abs(movement))+' USD/т'+
            (values[0]>0?' ('+insightNumber(Math.abs(movement)/values[0]*100)+'%)':'')+'.';
        }else fact+=' Для динамики необходимо минимум два наблюдения.';
        if(product.dailyMonitor?.sourceGap===true||Number(product.dailyMonitor?.segmentCount)>1)
          fact+=' Между датами есть пропуски; непрерывный тренд не подтверждён.';
        add('Подтверждённый факт',fact);
      }else add('Подтверждённый факт','Опубликованного проверенного ряда по выбранному продукту нет. Исторические значения не используются.');
      const complete=forecast&&Number.isFinite(forecast.low)&&Number.isFinite(forecast.base)&&
        Number.isFinite(forecast.high)&&forecast.low<=forecast.base&&forecast.base<=forecast.high;
      if(complete){
        const month=String(forecast.month).slice(5,7)+'.'+String(forecast.month).slice(0,4);
        let msg='Прогноз на '+month+': базовый '+insightNumber(forecast.base)+
          ', нижний '+insightNumber(forecast.low)+', верхний '+insightNumber(forecast.high)+' USD/т.';
        if(values.length)msg+=' Отклонение базового сценария от последнего наблюдения: '+
          (forecast.base-values.at(-1)>0?'+':'')+insightNumber(forecast.base-values.at(-1))+' USD/т.';
        msg+=' Это расчётный сценарий, не установленная будущая цена.';
        add('Рыночный прогноз',msg);
      }else add('Рыночный прогноз','Полный прогноз с проверенной ссылкой на источник недоступен. Направление цены не предполагается.');
      const mode=String(root.querySelector('.an2-rona')?.dataset?.pricingMode||'LEGACY_DELTA');
      if(complete&&product?.rona){
        add('Цены RONA Trade',mode==='BRIDGE'
          ?'Индикативные цены рассчитаны по прогнозу и переданным параметрам тарифа и коммерческих затрат. Их актуальность проверяется отдельно; офертой они не являются.'
          :'Показаны индикативные сценарии изменения рынка относительно базовой котировки. Актуальные тариф и коммерческие затраты отдельно не подтверждены; договорную цену этот расчёт не определяет.');
      }else add('Цены RONA Trade','Для индикативного расчёта недостаточно подтверждённых исходных данных; договорная цена не определяется.');
    }
    panel.replaceChildren(...items.map(({label,body})=>{
      const piece=document.createElement('span');piece.className='an2-insight-piece';
      const head=document.createElement('span');head.className='an2-insight-label';head.textContent=label;
      const content=document.createElement('span');content.className='an2-insight-value';content.textContent=body;
      piece.append(head,content);return piece;
    }));
    panel.dataset.insightVersion=ADMIN_INSIGHT_V1;
    panel.dataset.insightProduct=key;
    const footer=root.querySelector('[data-comment-source]');
    if(footer)footer.textContent=sourceSelected==='ARGUS'&&key!=='LPG'
      ?'Источник Argus: подтверждённые котировки отсутствуют. Вывод по другому индексу не подставляется.'
      :'Рыночный источник: Platts'+
        (latestDate?' · последнее подтверждённое наблюдение '+latestDate:' · подтверждённый ряд отсутствует')+
        (forecast?' · прогноз проверен по опубликованной ссылке':' · прогноз не подтверждён')+'.';
  }

  function indicateUnavailable(reason){
    const root=document.querySelector('#rona-analytics-v2');
    document.documentElement.dataset.ronaAnalyticsData='SOURCE_UNAVAILABLE';
    document.documentElement.dataset.ronaAnalyticsError=String(reason||'DATA_NOT_AVAILABLE').slice(0,60);
    lastApplied='';lastSource=null;
    if(!root)return;
    const stage=root.querySelector('[data-chart-stage]');
    if(stage)stage.innerHTML='<div class="an2-empty"><strong>Текущие данные недоступны</strong><span>Загрузка подтверждённых котировок и прогнозов не выполнена. Архивные значения скрыты.</span></div>';
    root.querySelectorAll('[data-metric],.an2-kpis .rona-owner-kpi,.an2-price-base,.an2-price-range,.an2-price-current').forEach(el=>{el.textContent='—'});
    const box=root.querySelector('.an2-market-forecast');
    if(box)box.innerHTML='<div class="an2-mf-title">Прогноз недоступен</div><div class="an2-mf-sub">Нет действующего ответа аналитического сервера. Неподтверждённые значения скрыты.</div>';
    const model=root.querySelector('.an2-model-note');
    if(model)model.textContent='Проверьте соединение и полномочия. До восстановления источника прогнозная цена не рассчитывается.';
    const note=root.querySelector('.an2-comment');if(note){note.textContent='Аналитический вывод недоступен: подтверждённые данные сейчас не получены. Прежний вывод скрыт.';delete note.dataset.insightProduct}
    const foot=root.querySelector('[data-comment-source]');if(foot)foot.textContent='Достоверность рыночного источника не подтверждена.';
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
        document.documentElement.dataset.ronaAnalyticsData='canonical-daily-live-v3';
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
    if(event.target?.closest?.('#rona-analytics-v2 .an2-controls button[data-product],#rona-analytics-v2 .an2-controls button[data-source]'))setTimeout(()=>lastSource?decorate(lastSource):indicateUnavailable('NO_CURRENT_SOURCE'),0);
  },true);
  setInterval(hydrate,300000);
})();
`;
