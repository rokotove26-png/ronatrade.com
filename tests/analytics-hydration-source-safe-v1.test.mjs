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
    LPG:{dates:['07.10'],values:[725],forecast:forecast(725),
      regionalBenchmark:{low:698.5,high:775,date:'07.10.2026'}}
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
  assert.match(f.cards[0].note.textContent,/07\.10/);
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
 assert.match(source,/source-safe-v3-term/);
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
 unit:'USD/т',dates:['10.2026','11.2026','12.2026'],deliveryMonths:['2026-10','2026-11','2026-12'],
 values:key==='DT'?[1403.125,1370,1328]:[775,725,698.5],observationCount:3
});
test('DB source-locked DT M1/M2/M3 has three plotted delivery months and source attribution',async()=>{
 const f=fixture(),p=payload();p.products.DT.termCurve=term();
 f.setPayload(p);await f.wait();
 const dt=f.captured.at(-1).products.DT;
 assert.deepEqual(JSON.parse(JSON.stringify(dt.dates)),['10.2026','11.2026','12.2026']);
 assert.deepEqual(JSON.parse(JSON.stringify(dt.values)),[1403.125,1370,1328]);
 assert.match(f.title.textContent,/Форвардная кривая ДТ/);
 assert.match(f.sourceLabel.textContent,/Composite FOB ARA \+ CIF NWE/);
 assert.match(f.sourceLabel.textContent,/07\.10\.2026/);
 assert.match(f.cards[0].note.textContent,/НЕ спотовый BNK Composite/);
 assert.equal(f.root.dataset.ronaChartKind,'FORWARD_TERM_STRUCTURE');
 assert.equal(f.captured[0].products.DT.forecast.base,1370);
 assert.deepEqual(JSON.parse(JSON.stringify(dt.rona.bases)),[['CPT Озинки',1280],['CPT Сарыагаш',1385]]);
});
test('LPG Platts M1/M2/M3 forward curve replaces one-point November history without mixing delivery months',async()=>{
 const f=fixture(),p=payload();p.products.LPG.termCurve=term('LPG');
 p.products.LPG.regionalBenchmark={date:'25.08.2026',low:725,high:780,base:753};
 f.setPayload(p);await f.wait();f.setProduct('LPG');
 f.callbacks['document:click']({target:{closest:()=>({})}});await f.wait();
 const lpg=f.captured[0].products.LPG;
 assert.deepEqual(JSON.parse(JSON.stringify(lpg.dates)),['10.2026','11.2026','12.2026']);
 assert.deepEqual(JSON.parse(JSON.stringify(lpg.values)),[775,725,698.5]);
 assert.match(f.title.textContent,/Форвардная кривая СУГ/);
 assert.match(f.cards[0].note.textContent,/поставка 11\.2026/);
 assert.equal(f.cards[1].value.textContent,'Нет актуальных данных');
 assert.match(f.cards[1].note.textContent,/25\.08\.2026/);
});
test('curve changes trigger hydration even when physical close and forecast unchanged',async()=>{
 const f=fixture(),p=payload();p.products.DT.termCurve=term();
 f.setPayload(p);await f.wait();
 const p2=structuredClone(p);p2.products.DT.termCurve.values[1]=1371;
 f.setPayload(p2);await f.callbacks.focus();await f.wait();
 assert.equal(f.captured.length,2);
 assert.equal(f.captured[1].products.DT.values[1],1371);
});
test('reject inconsistent delivery months, missing doc or mixed future as daily curve',async()=>{
 for(const mutation of [
   t=>{t.deliveryMonths=['2026-10','2026-12','2026-11']},
   t=>{t.sourceDocId=''},
   t=>{t.dates=['07.10','08.10','09.10']},
   t=>{t.values[1]=null},
   t=>{t.indexName='Unrelated diesel FOB Med'},
   t=>{t.sourceStatus='UNVERIFIED'},
   t=>{t.asOfDate='01.09.2026'}
 ]){
   const f=fixture(),p=payload();p.products.DT.termCurve=term();
   mutation(p.products.DT.termCurve);
   f.setPayload(p);await f.wait();
   assert.equal(f.captured[0].products.DT.values,undefined);
   assert.match(f.stage.innerHTML,/Нет актуального подтверждённого ряда/);
 }
});
