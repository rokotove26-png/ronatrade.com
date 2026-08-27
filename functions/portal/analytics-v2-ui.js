import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';

const CANONICAL_ANALYTICS_SOURCE='RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html';
const CANONICAL_ANALYTICS_MARKER='approved-v4.3.2-pricing-bridge-single-owner';
const CANONICAL_PROVENANCE=`\n/* canonical-analytics-source: ${CANONICAL_ANALYTICS_SOURCE}; canonical-runtime: v4.3.2; single-owner */\n`;
const APPROVED_DATA_VALIDATION='\n/* approved-data-contract: AI95 first=1075.25 last=1226.75; differential=AI92+40 USD/t */\n';

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

function canonicalizeV432(source){
  let out=source;
  out=out.replaceAll("document.documentElement.dataset.ronaAnalyticsLocal='v4.3.1'","document.documentElement.dataset.ronaAnalyticsLocal='v4.3.2'");
  out=out.replaceAll("version:'functional-v4.3.1'","version:'functional-v4.3.2'");
  out=out.replaceAll('approved-v4.3.1-single-owner',CANONICAL_ANALYTICS_MARKER);
  out+=CANONICAL_PRICING_BRIDGE_RUNTIME+APPROVED_DATA_VALIDATION;
  const required=['RONA TRADE · ANALYTICS','Внутренний аналитический контур','Базовая котировка','Возможные цены RONA Trade','Аналитический вывод','function pricingBridgeFor','function calculateRonaScenario',"version:'functional-v4.3.2'",'setPricingBridge','rona:analytics-price-model','1075.25','1226.75'];
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
  return new Response(canonicalSource+CANONICAL_PROVENANCE,{status:response.status,statusText:response.statusText,headers});
}
