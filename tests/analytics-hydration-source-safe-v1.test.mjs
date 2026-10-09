import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../functions/portal/analytics-canonical-live-hydration.js',import.meta.url),'utf8');
const runtime=source.split('String.raw`')[1].split('`;')[0];

function fixture(){
  const make=()=>({textContent:'',innerHTML:''});
  const stage=make(),title=make(),sourceLabel=make(),forecastCard=make(),modelNote=make();
  const metrics=Array.from({length:3},make);
  const cards=Array.from({length:3},()=>{
    const value=make(),note=make();
    return {value,note,querySelector:k=>k==='.rona-owner-kpi'?value:k==='.rona-owner-muted'?note:null};
  });
  const prices=Array.from({length:2},()=>{
    const nodes=Object.fromEntries(['.an2-price-base','.an2-price-range','.an2-price-current'].map(k=>[k,make()]));
    return {nodes,querySelector:k=>nodes[k]||null};
  });
  const root={
    dataset:{},
    querySelector:k=>({'[data-chart-stage]':stage,'[data-chart-title]':title,'[data-chart-source]':sourceLabel,'.an2-market-forecast':forecastCard,'.an2-model-note':modelNote})[k]||null,
    querySelectorAll:k=>({'.an2-kpis .rona-owner-card':cards,'[data-metric]':metrics,'.an2-price-card':prices})[k]||[]
  };
  const callbacks={},captured=[];
  let activeProduct='DT',livePayload=null;
  const window={
    RONA_ANALYTICS_VIEW:{getState:()=>({product:activeProduct}),setPayload:x=>{captured.push(x);return true}},
    addEventListener:(k,cb)=>{callbacks[k]=cb},
    dispatchEvent(){}
  };
  const document={
    readyState:'complete',documentElement:{dataset:{}},
    querySelector:k=>k==='#rona-analytics-v2'?root:null,
    addEventListener:(k,cb)=>{callbacks['document:'+k]=cb}
  };
  const ctx={window,document,CustomEvent:class{},setInterval(){},setTimeout,queueMicrotask,
    fetch:async()=>({ok:true,json:async()=>({data:{canonicalAnalytics:livePayload}})}),console};
  vm.runInNewContext(runtime,ctx,{timeout:3000});
  const wait=()=>new Promise(r=>setTimeout(r,12));
  return {setPayload:x=>{livePayload=x},setProduct:x=>{activeProduct=x},callbacks,captured,root,stage,title,sourceLabel,forecastCard,modelNote,metrics,cards,prices,wait};
}
const forecast=(base=1250,month='2026-11',sourceRef='https://t.me/platts_digits/7510')=>
  ({month,low:base-50,base,high:base+50,forward:base,curveType:'CONTANGO',sourceRef});
function payload(){return{
  version:'RONA_ADMIN_ANALYTICS_CANONICAL_DAILY_V1',
  cutoff:'08.10.2026',latestTradeDate:'07.10.2026',
  products:{
    AI92:{dates:['07.10'],values:[1261],forecast:forecast(1098),rona:{reference:1261,bases:[['CPT Ozinki',1200]]}},
    AI95:{dates:['07.10'],values:[1301],forecast:forecast(1138)},
    DT:{dates:null,values:null,forecast:forecast(1370),rona:{reference:1270.083333,bases:[['CPT Озинки',1280],['CPT Сарыагаш',1385]]}},
    LPG:{dates:['07.10'],values:[775],forecast:forecast(725),
      basis:'Platts Propane CIF NWE Financial · delivery Oct 2026',
      dailyMonitor:{
        version:'RONA_MARKET_OBSERVED_DAILY_V1',granularity:'OBSERVATION_DATE',
        sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',noInterpolation:true,
        notMonthlyMaturityCurve:true,observationCount:1,availableTotal:4,
        observedDates:['2026-10-07'],firstAsOf:'07.10.2026',lastAsOf:'07.10.2026',
        deliveryMonth:'2026-10',instrument:'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY'
      },regionalBenchmark:{low:698.5,high:775,date:'07.10.2026'}}
  }
}}
test('forecast-only DT renders sourced November forecast while hiding stale chart',async()=>{
  const f=fixture();f.setPayload(payload());await f.wait();
  assert.equal(f.captured.length,1);
  assert.equal(f.captured[0].products.DT.forecast.month,'2026-11');
  assert.equal(f.captured[0].products.DT.forecast.base,1370);
  assert.ok(!('values' in f.captured[0].products.DT));
  assert.match(f.stage.innerHTML,/Нет актуального подтверждённого ряда/);
  assert.ok(f.metrics.every(x=>x.textContent==='—'));
  assert.deepEqual(JSON.parse(JSON.stringify(f.captured[0].products.DT.rona.bases)),[['CPT Озинки',1280],['CPT Сарыагаш',1385]]);
  assert.equal(f.stage.innerHTML.includes('Архивный график скрыт'),true);
});
test('forecast change rehydrates with unchanged physical close',async()=>{
  const f=fixture(),p=payload();f.setPayload(p);await f.wait();
  const p2=structuredClone(p);p2.products.DT.forecast.base=1380;
  f.setPayload(p2);await f.callbacks.focus();await f.wait();
  assert.equal(f.captured.length,2);
  assert.equal(f.captured[1].products.DT.forecast.base,1380);
});
test('LPG benchmark labels and regional range refresh without September fallback',async()=>{
  const f=fixture();f.setPayload(payload());await f.wait();
  f.setProduct('LPG');f.cards[0].note.textContent='Propane Sep 2026';
  f.callbacks['document:click']({target:{closest:()=>({})}});await f.wait();
  assert.match(f.cards[0].note.textContent,/2026-10/);
  assert.doesNotMatch(f.cards[0].note.textContent,/Sep 2026/);
  assert.match(f.cards[1].value.textContent,/698,5.*775 USD\/т/);
  assert.match(f.cards[1].note.textContent,/07\.10\.2026/);
});
test('LPG regional change is applied while latest closing price stays fixed',async()=>{
  const f=fixture(),p=payload();f.setPayload(p);await f.wait();
  const n=structuredClone(p);n.products.LPG.regionalBenchmark.high=780;
  f.setPayload(n);await f.callbacks.focus();await f.wait();
  assert.equal(f.captured.length,2);
});
test('stale or unproven DT forecast fails closed',async()=>{
  for(const invalid of [{month:'2026-09'},{sourceRef:''}]){
    const f=fixture(),p=payload();Object.assign(p.products.DT.forecast,invalid);
    f.setPayload(p);await f.wait();
    assert.equal(f.captured[0].products.DT,undefined);
    assert.match(f.forecastCard.innerHTML,/Прогноз недоступен/);
  }
});
test('AI92/AI95 source series and scenario months remain canonical',async()=>{
  const f=fixture();f.setPayload(payload());await f.wait();
  for(const k of ['AI92','AI95']){
    assert.equal(f.captured[0].products[k].dates[0],'07.10');
    assert.equal(f.captured[0].products[k].forecast.month,'2026-11');
  }
  assert.equal(f.captured[0].products.AI92.values[0],1261);
  assert.equal(f.captured[0].products.AI95.values[0],1301);
});

test('stale Petromarket August benchmark is not displayed as current in October',async()=>{
  const f=fixture(),p=payload();
  p.products.LPG.regionalBenchmark={low:725,high:780,base:753,date:'25.08.2026'};
  f.setPayload(p);await f.wait();
  f.setProduct('LPG');
  f.callbacks['document:click']({target:{closest:()=>({})}});await f.wait();
  assert.equal(f.cards[1].value.textContent,'Нет актуальных данных');
  assert.match(f.cards[1].note.textContent,/25\.08\.2026/);
  assert.match(f.cards[1].note.textContent,/исторический/);
});

test('source-safe v3 runtime remains guarded for raw null DT without term quote',async()=>{
 const f=fixture(),p=payload();f.setPayload(p);await f.wait();
 assert.ok(f.captured.length===1);
 assert.equal(f.captured[0].products.DT.forecast.month,'2026-11');
 assert.equal(f.captured[0].products.DT.rona.bases[0][1],1280);
 assert.equal(f.captured[0].products.DT.dates,undefined);
 assert.match(source,/source-safe-v4-observation-daily/);
});
test('missing DT spot history does not suppress valid owner price calculation',async()=>{
 const f=fixture(),p=payload();
 for(const item of f.prices)for(const v of Object.values(item.nodes))v.textContent='CANONICAL_PRICING';
 f.setPayload(p);await f.wait();
 assert.ok(f.prices.every(item=>Object.values(item.nodes).every(v=>v.textContent==='CANONICAL_PRICING')));
});

const term=(key='DT')=>({
  kind:'FORWARD_TERM_STRUCTURE',sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
  asOfDate:'07.10.2026',sourceRef:'https://t.me/platts_digits/7510',
  sourceDocId:'TG-PLATTS-CF27D158005EDC786FCBDB98',
  indexName:key==='DT'?'Composite ULSD 10 ppmS FOB ARA + CIF NWE Cargo Financial':'Propane CIF NWE Large Cargo Financial',
  basis:key==='DT'?'Composite FOB ARA + CIF NWE':'CIF NWE Large Cargo Financial',
  unit:'USD/т',dates:['10.2026','11.2026','12.2026'],
  deliveryMonths:['2026-10','2026-11','2026-12'],
  values:key==='DT'?[1403.125,1370,1328]:[775,725,698.5],
  observationCount:3
});
const monitor=(key='DT')=>({
  version:'RONA_MARKET_OBSERVED_DAILY_V1',
  granularity:'OBSERVATION_DATE',
  sourceFamily:'PLATTS',sourceStatus:'CONFIRMED',
  noInterpolation:true,notMonthlyMaturityCurve:true,
  observedDates:key==='DT'?['2026-10-01','2026-10-06','2026-10-08']:['2026-10-07'],
  observationCount:key==='DT'?3:1,
  firstAsOf:key==='DT'?'01.10.2026':'07.10.2026',
  lastAsOf:key==='DT'?'08.10.2026':'07.10.2026',
  status:key==='DT'?'VERIFIED_DAILY_OBSERVATIONS':'SINGLE_CONFIRMED_OBSERVATION',
  deliveryMonth:key==='DT'?null:'2026-10',
  instrument:key==='DT'?'DIESEL_PLATTS_ULSD_CIF_NWE_PHYSICAL_COMPONENT'
                     :'LPG_PLATTS_PROPANE_CIF_NWE_FINANCIAL_FIXED_DELIVERY'
});
test('DT plots verified SAME BASIS physical observations by actual trade dates',async()=>{
  const f=fixture(),p=payload();
  p.products.DT.dates=['01.10','06.10','08.10'];
  p.products.DT.values=[1449.25,1323,1476.25];
  p.products.DT.dailyMonitor=monitor('DT');
  p.products.DT.basis='Platts ULSD 10 ppm Cargoes CIF NWE/Basis ARA · не BNK Composite';
  p.products.DT.termCurve=term('DT');
  f.setPayload(p);await f.wait();
  const dt=f.captured[0].products.DT;
  assert.deepEqual(JSON.parse(JSON.stringify(dt.dates)),['01.10','06.10','08.10']);
  assert.deepEqual(JSON.parse(JSON.stringify(dt.values)),[1449.25,1323,1476.25]);
  assert.match(f.title.textContent,/Динамика ДТ/);
  assert.match(f.sourceLabel.textContent,/01\.10\.2026–08\.10\.2026/);
  assert.equal(f.root.dataset.ronaChartKind,'OBSERVATION_DAILY');
  assert.equal(f.cards[0].value.textContent,'08.10.2026');
  assert.equal(dt.forecast.base,1370);
  assert.deepEqual(JSON.parse(JSON.stringify(dt.rona.bases)),[['CPT Озинки',1280],['CPT Сарыагаш',1385]]);
});
test('LPG daily financial fixed-delivery index plots only AS-OF 07.10, not M1/M2/M3',async()=>{
  const f=fixture(),p=payload();p.products.LPG.termCurve=term('LPG');
  p.products.LPG.regionalBenchmark={date:'25.08.2026',low:725,high:780,base:753};
  f.setPayload(p);await f.wait();f.setProduct('LPG');
  f.callbacks['document:click']({target:{closest:()=>({})}});await f.wait();
  const lpg=f.captured[0].products.LPG;
  assert.deepEqual(JSON.parse(JSON.stringify(lpg.dates)),['07.10']);
  assert.deepEqual(JSON.parse(JSON.stringify(lpg.values)),[775]);
  assert.match(f.title.textContent,/Динамика СУГ/);
  assert.equal(f.root.dataset.ronaChartKind,'OBSERVATION_DAILY');
  assert.equal(f.cards[0].value.textContent,'07.10.2026');
  assert.equal(f.cards[1].value.textContent,'Нет актуальных данных');
  assert.match(f.cards[1].note.textContent,/25\.08\.2026/);
});
test('term M1/M2/M3 without observed-day monitor is never rendered as a daily graph',async()=>{
  const f=fixture(),p=payload();p.products.DT.termCurve=term('DT');
  f.setPayload(p);await f.wait();
  assert.equal(f.captured[0].products.DT.dates,undefined);
  assert.match(f.stage.innerHTML,/Нет актуального подтверждённого ряда/);
  assert.doesNotMatch(f.title.textContent,/Форвардная кривая/);
});
test('validated daily observation changes rehydrate but financial term changes cannot alter daily graph',async()=>{
  const f=fixture(),p=payload();
  p.products.DT.dates=['01.10','06.10','08.10'];
  p.products.DT.values=[1449.25,1323,1476.25];
  p.products.DT.dailyMonitor=monitor('DT');
  p.products.DT.termCurve=term('DT');
  f.setPayload(p);await f.wait();
  const changed=structuredClone(p);
  changed.products.DT.termCurve.values[0]=1417;
  changed.products.DT.dailyMonitor.lastAsOf='08.10.2026';
  f.setPayload(changed);await f.callbacks.focus();await f.wait();
  assert.equal(f.captured.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(f.captured[1].products.DT.values)),[1449.25,1323,1476.25]);
});
test('reject invalid DT daily proof and mixed delivery-month x-axis labels',async()=>{
  const mutations=[
    p=>{p.products.DT.dailyMonitor.sourceStatus='UNVERIFIED'},
    p=>{p.products.DT.dailyMonitor.sourceFamily='ARGUS'},
    p=>{p.products.DT.dailyMonitor.noInterpolation=false},
    p=>{p.products.DT.dailyMonitor.observedDates=['2026-10-01','2026-09-06','2026-10-08']},
    p=>{p.products.DT.dailyMonitor.observedDates[2]='2026-10-07'},
    p=>{p.products.DT.dailyMonitor.observationCount=2},
    p=>{p.products.DT.dates=['10.2026','11.2026','12.2026']},
    p=>{p.products.DT.values[1]=null}
  ];
  for(const mutate of mutations){
    const f=fixture(),p=payload();
    p.products.DT.dates=['01.10','06.10','08.10'];
    p.products.DT.values=[1449.25,1323,1476.25];
    p.products.DT.dailyMonitor=monitor('DT');
    mutate(p);f.setPayload(p);await f.wait();
    assert.equal(f.captured[0].products.DT.dates,undefined);
    assert.match(f.stage.innerHTML,/Нет актуального подтверждённого ряда/);
  }
});
