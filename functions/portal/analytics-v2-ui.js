import { onRequest as approvedAnalytics } from './analytics-v2-approved-base.js';

const CANONICAL_ANALYTICS_SOURCE='RONA_Admin_LK_LOCAL_v4_3_2_Analytics_PricingBridge_Ready_Local.html';
const CANONICAL_ANALYTICS_MARKER='approved-v4.3.2-pricing-bridge-single-owner';
const CANONICAL_PROVENANCE=`\n/* canonical-analytics-source: ${CANONICAL_ANALYTICS_SOURCE}; canonical-runtime: v4.3.2; single-owner */\n`;
const APPROVED_DATA_VALIDATION='\n/* approved-data-contract: AI95 first=1075.25 last=1226.75; differential=AI92+40 USD/t */\n';

function replaceRequired(source,pattern,replacement,label){
  const next=source.replace(pattern,replacement);
  if(next===source)throw new Error(`CANONICAL_ANALYTICS_TRANSFORM_MISS:${label}`);
  return next;
}

function canonicalizeV432(source){
  let out=source;
  const pricingRuntime=`function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}\n  function pricingBridgeFor(model,basis){\n    const bridges=model?.bridges;\n    if(!bridges||typeof bridges!=='object')return null;\n    const raw=bridges[basis];\n    if(!raw||typeof raw!=='object')return null;\n    const rail=finite(raw.rail),commercial=finite(raw.commercial),other=finite(raw.other)||0;\n    if(rail===null||commercial===null)return null;\n    return {rail,commercial,other,source:String(raw.source||'LOCAL_INPUT'),updatedAt:String(raw.updatedAt||'')};\n  }\n  function calculateRonaScenario(p,basis,current){\n    const f=p.forecast,model=p.rona||{};\n    const bridge=pricingBridgeFor(model,basis);\n    if(bridge){\n      const add=bridge.rail+bridge.commercial+bridge.other;\n      return {mode:'BRIDGE',low:f.low+add,base:f.base+add,high:f.high+add,current,bridge};\n    }\n    const reference=finite(model.reference)??finite(f.reference);\n    if(reference===null)return {mode:'UNAVAILABLE',low:null,base:null,high:null,current};\n    return {mode:'LEGACY_DELTA',low:current+(f.low-reference),base:current+(f.base-reference),high:current+(f.high-reference),current};\n  }\n  function updateRona(p){\n    if(!ronaBox)return;const f=p.forecast,model=p.rona||{},head=ronaBox.querySelector('.an2-rona-head h2'),grid=ronaBox.querySelector('.an2-rona-grid'),note=ronaBox.querySelector('.an2-model-note');\n    if(head)head.textContent='Возможные цены RONA Trade на '+f.month;\n    let bridgeCount=0,totalCount=0;\n    if(grid){\n      grid.replaceChildren();\n      for(const row of (Array.isArray(model.bases)?model.bases:[])){\n        if(!Array.isArray(row)||row.length<2)continue;\n        const basis=String(row[0]),current=finite(row[1]);if(current===null)continue;\n        const calc=calculateRonaScenario(p,basis,current);totalCount++;if(calc.mode==='BRIDGE')bridgeCount++;\n        const c=document.createElement('section');c.className='rona-owner-card an2-price-card';c.dataset.pricingMode=calc.mode;\n        c.innerHTML='<h3></h3><div class="an2-price-base"></div><div class="an2-price-range"></div><div class="an2-price-current"></div>';\n        c.querySelector('h3').textContent=basis;\n        c.querySelector('.an2-price-base').textContent=calc.base===null?'—':fmt(calc.base,2)+' USD/т';\n        c.querySelector('.an2-price-range').textContent=calc.low===null||calc.high===null?'LOW —  ·  HIGH —':'LOW '+fmt(calc.low,2)+'  ·  HIGH '+fmt(calc.high,2);\n        c.querySelector('.an2-price-current').textContent='Текущий R2: '+fmt(current,2)+' USD/т';\n        grid.append(c);\n      }\n    }\n    const bridgeActive=totalCount>0&&bridgeCount===totalCount;\n    ronaBox.dataset.pricingMode=bridgeActive?'BRIDGE':'LEGACY_DELTA';\n    if(note)note.textContent=bridgeActive\n      ?'Расчёт: прогнозный рыночный нетбек + актуальный ЖД тариф + коммерческие компоненты RONA Trade. Активен локальный pricing bridge; значения остаются индикативными и не являются коммерческой офертой.'\n      :'Смысл блока: прогнозный рыночный нетбек + актуальный ЖД тариф + коммерческие компоненты RONA Trade. До загрузки полного набора локальных pricing-inputs сохранён прежний индикативный расчёт по изменению рынка относительно reference; это не коммерческая оферта.';\n    emit('rona:analytics-price-model',{product:state.product,mode:ronaBox.dataset.pricingMode,bridgeCount,totalCount});\n  }\n  function updateCommentary(p){`;
  out=replaceRequired(out,/function updateRona\(p\)\{[\s\S]*?function updateCommentary\(p\)\{/,pricingRuntime,'pricing-bridge-runtime');

  const viewApi=`window.RONA_ANALYTICS_VIEW={\n    version:'functional-v4.3.2',\n    getState:()=>({product:state.product,source:state.source,dataVersion:DATA.version,pricingMode:ronaBox?.dataset?.pricingMode||'LEGACY_DELTA'}),\n    setProduct:selectProduct,\n    setSource:selectSource,\n    render,\n    updateProduct:(key,patch)=>{\n      if(!DATA.products[key]||!patch||typeof patch!=='object')return false;\n      const prev=DATA.products[key];\n      DATA.products[key]={...prev,...patch,forecast:patch.forecast?{...(prev.forecast||{}),...patch.forecast}:prev.forecast,rona:patch.rona?{...(prev.rona||{}),...patch.rona}:prev.rona};\n      if(state.product===key)render();return true;\n    },\n    setPricingBridge:(key,bridges)=>{\n      if(!DATA.products[key]||!bridges||typeof bridges!=='object')return false;\n      const prev=DATA.products[key],rona={...(prev.rona||{}),bridges:{...((prev.rona||{}).bridges||{}),...bridges}};\n      DATA.products[key]={...prev,rona};if(state.product===key)render();return true;\n    },\n    setPayload:payload=>{\n      if(!payload||typeof payload!=='object')return false;\n      if(payload.latestTradeDate)DATA.latestTradeDate=String(payload.latestTradeDate);\n      if(payload.version)DATA.version=String(payload.version);\n      if(payload.cutoff)DATA.cutoff=String(payload.cutoff);\n      if(payload.argus)DATA.argus={...DATA.argus,...payload.argus};\n      if(payload.products&&typeof payload.products==='object')for(const [k,v] of Object.entries(payload.products))if(DATA.products[k]&&v&&typeof v==='object'){\n        const prev=DATA.products[k];\n        DATA.products[k]={...prev,...v,forecast:v.forecast?{...(prev.forecast||{}),...v.forecast}:prev.forecast,rona:v.rona?{...(prev.rona||{}),...v.rona}:prev.rona};\n      }\n      render();return true;\n    }\n  };\n  window.addEventListener('rona:analytics-data'`;
  out=replaceRequired(out,/window\.RONA_ANALYTICS_VIEW=\{[\s\S]*?window\.addEventListener\('rona:analytics-data'/,viewApi,'functional-view-api');

  out=out.replaceAll("document.documentElement.dataset.ronaAnalyticsLocal='v4.3.1'","document.documentElement.dataset.ronaAnalyticsLocal='v4.3.2'");
  out=out.replaceAll("version:'functional-v4.3.1'","version:'functional-v4.3.2'");
  out=out.replaceAll('approved-v4.3.1-single-owner',CANONICAL_ANALYTICS_MARKER);
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
  return new Response(canonicalSource+CANONICAL_PROVENANCE+APPROVED_DATA_VALIDATION,{status:response.status,statusText:response.statusText,headers});
}
