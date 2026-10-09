export const SHARED_ANALYTICS_PRESENTER_V14=String.raw`
;(()=>{
  'use strict';
  if(window.RONA_ANALYTICS_PRESENTER_V14?.version==='ADMIN_APPROVED_SHARED_V14')return;
  const keys=['AI92','AI95','DT','LPG'];
  const labels={AI92:'АИ-92',AI95:'АИ-95',DT:'ДТ',LPG:'СУГ / СПБТ'};
  const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value};
  const goodNumber=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
  const validDaily=(item,key)=>{
    const proof=item?.dailyMonitor;
    if(key!=='DT'&&key!=='LPG')return true;
    if(proof?.version!=='RONA_MARKET_OBSERVED_DAILY_V1'||proof?.granularity!=='OBSERVATION_DATE'||
       proof?.sourceFamily!=='PLATTS'||proof?.sourceStatus!=='CONFIRMED'||proof?.noInterpolation!==true||
       proof?.notMonthlyMaturityCurve===false)return false;
    if(Number(proof.observationCount)!==item.dates.length)return false;
    if(!Array.isArray(proof.observedDates)||proof.observedDates.length!==item.dates.length)return false;
    return proof.observedDates.every((d,i)=>
      /^\\d{4}-\\d{2}-\\d{2}$/.test(String(d))&&
      String(item.dates[i])===String(d).slice(8,10)+'.'+String(d).slice(5,7)&&
      (i===0||String(d)>String(proof.observedDates[i-1])));
  };
  const usable=(item,key)=>item&&Array.isArray(item.dates)&&Array.isArray(item.values)&&
    item.dates.length>0&&item.dates.length===item.values.length&&
    item.dates.every(d=>/^\\d{2}\\.\\d{2}$/.test(String(d)))&&item.values.every(goodNumber)&&validDaily(item,key);
  function apply(root,payload,{mode='admin'}={}){
    if(!root||!payload?.products||!window.RONA_ANALYTICS_VIEW)return false;
    const state=window.RONA_ANALYTICS_VIEW.getState?.()||{};
    const pressed=root.querySelector('.an2-controls [data-an2-product][aria-pressed="true"]')?.getAttribute('data-an2-product');
    const key=keys.includes(pressed)?pressed:keys.includes(state.product)?state.product:'AI92';
    const item=payload.products[key]||null,series=usable(item,key);
    const daily=item?.dailyMonitor,forecast=item?.forecast;
    const original=String(item?.basis||'').trim();
    const svg=root.querySelector('[data-chart-svg]');
    const stage=root.querySelector('[data-chart-stage]');
    if(series){
      if(svg){svg.hidden=false;svg.style.removeProperty('visibility')}
      stage?.querySelectorAll('[data-rona-client-canonical-empty],.an2-empty,.rona-market-chart-empty').forEach(x=>x.remove());
    }else{
      if(svg){svg.hidden=true;svg.style.setProperty('visibility','hidden','important')}
      if(stage&&!stage.querySelector('[data-rona-shared-empty-v14]')){
        const msg=document.createElement('div');
        msg.className='an2-empty';msg.dataset.ronaSharedEmptyV14='1';
        const strong=document.createElement('strong'),sub=document.createElement('span');
        strong.textContent='Нет подтверждённого ежедневного ряда';
        sub.textContent='График появится после подтверждения источника. Прогноз показан отдельно.';
        msg.append(strong,sub);stage.append(msg);
      }
    }
    const axisTitle=series?'Динамика '+labels[key]+' · USD/т':labels[key]+' · ежедневный ряд пока недоступен';
    text(root.querySelector('[data-chart-title]'),axisTitle);
    let source=series?original:'Ежедневные наблюдения не подтверждены для выбранного продукта';
    if(series&&daily&&(key==='DT'||key==='LPG')){
      source+=' · наблюдения '+String(daily.firstAsOf||'—')+'–'+String(daily.lastAsOf||'—');
      if(daily.sourceGap)source+=' · пропуски в источнике; без интерполяции';
      if(Number(daily.observationCount)===1)source+=' · одна подтверждённая точка';
    }
    text(root.querySelector('[data-chart-source]'),source);
    const cards=[...root.querySelectorAll('.an2-kpis .rona-owner-card')];
    if(key==='DT'||key==='LPG'){
      text(cards[0]?.querySelector('.rona-owner-kpi'),series?String(daily.lastAsOf||'—'):'—');
      text(cards[0]?.querySelector('.rona-owner-muted'),series?(
        key==='DT'?'Platts ULSD CIF NWE · отдельный физический компонент, не композит БНК':
        'Platts propane Financial · поставка '+String(daily.deliveryMonth||'—')+' · не региональный спот'
      ):'Актуальная подтверждённая серия отсутствует');
    }
    if(key==='LPG'){
      const regional=item?.regionalBenchmark;
      const regionDate=String(regional?.date||'');
      const month=/^\\d{2}\\.\\d{2}\\.\\d{4}$/.test(regionDate)?regionDate.slice(6)+'-'+regionDate.slice(3,5):'';
      const latest=String(payload.latestTradeDate||payload.cutoff||'');
      const activeMonth=/^\\d{2}\\.\\d{2}\\.\\d{4}$/.test(latest)?latest.slice(6)+'-'+latest.slice(3,5):'';
      const valid=!!activeMonth&&month>=activeMonth&&goodNumber(regional?.low)&&goodNumber(regional?.high);
      const val=valid?Number(regional.low).toLocaleString('ru-RU',{maximumFractionDigits:2})+'–'+
        Number(regional.high).toLocaleString('ru-RU',{maximumFractionDigits:2})+' USD/т':'Нет актуальных данных';
      text(cards[1]?.querySelector('.rona-owner-kpi'),val);
      text(cards[1]?.querySelector('.rona-owner-muted'),valid?
        'Petromarket · DAP Сарыагаш · '+regionDate:
        'Petromarket · DAP Сарыагаш · актуальная цена отсутствует');
      if(series&&daily?.historyIncludesAllGapSegments===true&&
         Array.isArray(daily.segmentIds)&&Array.isArray(daily.observedDates)&&
         daily.segmentIds.length===item.dates.length&&daily.observedDates.length===item.dates.length){
        root.dataset.ronaLpgHistorySegments=JSON.stringify({dates:daily.observedDates,ids:daily.segmentIds,gaps:daily.gapBeforeDays||[]});
      }else delete root.dataset.ronaLpgHistorySegments;
    }else delete root.dataset.ronaLpgHistorySegments;
    const forecastReady=forecast&&/^\\d{4}-\\d{2}$/.test(String(forecast.month||''))&&
      ['low','base','high','forward'].every(k=>goodNumber(forecast[k]))&&
      String(forecast.sourceRef||'').trim().length>0;
    if(!forecastReady){
      const box=root.querySelector('.an2-market-forecast');
      if(box){box.replaceChildren();const h=document.createElement('div'),sub=document.createElement('div');h.className='an2-mf-title';h.textContent='Прогноз недоступен';sub.className='an2-mf-sub';sub.textContent='Нет полного подтверждённого прогноза со ссылкой на источник.';box.append(h,sub)}
      text(cards[2]?.querySelector('.rona-owner-kpi'),'Нет данных');
    }
    root.dataset.ronaSelectedProduct=key;
    root.dataset.ronaChartKind=series?'OBSERVATION_DAILY':'SOURCE_UNAVAILABLE';
    root.dataset.ronaAnalyticsPresentation='ADMIN_APPROVED_SHARED_V14';
    root.dataset.ronaAnalyticsPresentationScope=mode==='client'?'CLIENT_AUTHORIZED':'ADMIN';
    return true;
  }
  window.RONA_ANALYTICS_PRESENTER_V14=Object.freeze({version:'ADMIN_APPROVED_SHARED_V14',apply});
})();
`;
export async function onRequest(){
  return new Response(SHARED_ANALYTICS_PRESENTER_V14,{
    headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','x-content-type-options':'nosniff','x-rona-analytics-presenter':'ADMIN_APPROVED_SHARED_V14'}
  });
}
