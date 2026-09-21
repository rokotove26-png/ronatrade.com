(()=>{
'use strict';
if(location.pathname!=='/portal/client')return;
const MARK='20260902-client-market-intelligence-v2-admin-news-parity';
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
function fingerprint(data){return JSON.stringify([data?.generated_at,(data?.analytics||[]).map(x=>[x.publication_item_id,x.published_at,x.analytics_as_of])])}

function analyticsPage(){
  return q('#page-analytics')||q('#analyticsPage')||q('#page-market-analytics')||q('[data-page-panel="analytics"]')||q('[data-page-id="analytics"]')||q('[data-page-panel="market-analytics"]');
}
function pageShown(root){if(!root||!root.isConnected)return false;const s=getComputedStyle(root);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0}
function installStyle(){
  if(document.getElementById('rona-client-market-intelligence-style-v2'))return;
  const s=el('style',{id:'rona-client-market-intelligence-style-v2'});
  s.textContent=`
[${OWNER}="analytics"]{--mi-line:rgba(255,255,255,.13);--mi-soft:rgba(255,255,255,.055);--mi-soft2:rgba(255,255,255,.085);--mi-muted:rgba(225,235,245,.66);--mi-accent:#4aa8ff;width:100%;min-width:0;color:inherit;font:inherit}
[${OWNER}="analytics"] *{box-sizing:border-box}
[${OWNER}="analytics"] .mi-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:4px 0 20px;border-bottom:1px solid var(--mi-line)}
[${OWNER}="analytics"] .mi-kicker{margin:0 0 7px;color:var(--mi-accent);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
[${OWNER}="analytics"] h2{margin:0;font-size:clamp(24px,3vw,38px);line-height:1.05;font-weight:800;letter-spacing:-.025em}
[${OWNER}="analytics"] .mi-sub{margin:9px 0 0;max-width:880px;color:var(--mi-muted);font-size:12px;line-height:1.55}
[${OWNER}="analytics"] .mi-meta{flex:0 0 auto;color:var(--mi-muted);font-size:10px;text-align:right;line-height:1.55}
[${OWNER}="analytics"] .mi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding-top:16px}
[${OWNER}="analytics"] .mi-card{min-width:0;padding:16px;border:1px solid var(--mi-line);border-radius:12px;background:var(--mi-soft)}
[${OWNER}="analytics"] .mi-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
[${OWNER}="analytics"] .mi-product{font-size:11px;font-weight:850;letter-spacing:.055em;text-transform:uppercase}
[${OWNER}="analytics"] .mi-date{color:var(--mi-muted);font-size:10px;white-space:nowrap}
[${OWNER}="analytics"] .mi-card h3{margin:10px 0 0;font-size:16px;line-height:1.35;font-weight:750}
[${OWNER}="analytics"] .mi-copy{margin:9px 0 0;color:var(--mi-muted);font-size:12px;line-height:1.55;white-space:pre-wrap}
[${OWNER}="analytics"] .mi-bars{display:grid;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--mi-line)}
[${OWNER}="analytics"] .mi-bar-row{display:grid;grid-template-columns:minmax(90px,.95fr) minmax(100px,1.8fr) auto;gap:9px;align-items:center;font-size:10px}
[${OWNER}="analytics"] .mi-bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mi-muted)}
[${OWNER}="analytics"] .mi-track{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.07)}
[${OWNER}="analytics"] .mi-fill{height:100%;min-width:2px;border-radius:99px;background:currentColor;opacity:.72}
[${OWNER}="analytics"] .mi-value{font-variant-numeric:tabular-nums;font-weight:800;white-space:nowrap}
[${OWNER}="analytics"] .mi-empty,[${OWNER}="analytics"] .mi-error{padding:34px 0;color:var(--mi-muted);font-size:13px;line-height:1.6}
@media(max-width:900px){[${OWNER}="analytics"] .mi-grid{grid-template-columns:1fr}}
@media(max-width:620px){[${OWNER}="analytics"] .mi-head{align-items:flex-start;flex-direction:column}[${OWNER}="analytics"] .mi-meta{text-align:left}}
`;
  document.head.appendChild(s);
}
function ensureOwner(root){
  installStyle();
  let owner=root.querySelector(`:scope > [${OWNER}="analytics"]`);
  if(!owner){owner=el('section',{[OWNER]:'analytics','data-rona-client-market-intelligence-version':MARK});root.prepend(owner)}
  if(root.dataset.ronaClientAnalyticsMigrated!=='v2'){
    for(const child of Array.from(root.children)){if(child!==owner){child.dataset.ronaClientAnalyticsLegacy='hidden-v2';child.hidden=true}}
    root.dataset.ronaClientAnalyticsMigrated='v2';
  }
  return owner;
}
function head(data){
  return el('header',{class:'mi-head'},
    el('div',{},el('p',{class:'mi-kicker',text:'RONA TRADE · MARKET INTELLIGENCE'}),el('h2',{text:'Аналитика'}),el('p',{class:'mi-sub',text:'Опубликованный клиентский аналитический слой RONA Trade. Только верифицированные производные данные, разрешённые к клиентской дистрибуции.'})),
    el('div',{class:'mi-meta'},el('div',{text:'Обновлено '+dateLabel(data?.generated_at,true)}),el('div',{text:'Europe/Moscow'}))
  );
}
function chartRows(chart){
  const labels=Array.isArray(chart?.labels)?chart.labels:[],values=Array.isArray(chart?.values)?chart.values:[];
  const nums=values.map(finite).filter(v=>v!==null);if(!labels.length||!nums.length)return null;
  const max=Math.max(...nums.map(v=>Math.abs(v)),1);
  return el('div',{class:'mi-bars'},labels.slice(0,8).map((label,i)=>{
    const value=finite(values[i]);const width=value===null?0:Math.max(2,Math.min(100,Math.abs(value)/max*100));
    return el('div',{class:'mi-bar-row'},el('span',{class:'mi-bar-label',text:norm(label)||'—'}),el('span',{class:'mi-track'},el('span',{class:'mi-fill',style:`display:block;width:${width.toFixed(2)}%`})),el('span',{class:'mi-value',text:value===null?'—':fmt(value,2)+(chart?.unit?' '+chart.unit:'')}));
  }));
}
function renderAnalytics(root,data){
  const owner=ensureOwner(root),rows=Array.isArray(data?.analytics)?data.analytics:[],body=el('div',{});
  if(!rows.length)body.append(el('div',{class:'mi-empty',text:'Опубликованных аналитических материалов для текущего клиентского доступа нет.'}));
  else{
    const grid=el('div',{class:'mi-grid'});
    for(const row of rows){
      const card=el('article',{class:'mi-card'},el('div',{class:'mi-card-top'},el('span',{class:'mi-product',text:norm(row.product)||'Аналитика'}),el('span',{class:'mi-date',text:'на '+dateLabel(row.analytics_as_of)})),el('h3',{text:norm(row.headline)||norm(row.title)||'Аналитический материал'}));
      const copy=norm(row.content_text);if(copy)card.append(el('p',{class:'mi-copy',text:copy}));const bars=chartRows(row.public_chart);if(bars)card.append(bars);grid.append(card);
    }
    body.append(grid);
  }
  owner.replaceChildren(head(data),body);
  root.dataset.ronaClientAnalyticsReady='true';
  root.dataset.ronaClientMarketIntelligenceFingerprint='analytics:'+state.fingerprint;
}
function renderError(root,message){if(!root)return;const owner=ensureOwner(root);owner.replaceChildren(head(state.data||{}),el('div',{class:'mi-error',text:message||'Данные временно недоступны. Повторная загрузка выполняется автоматически.'}))}
function apply(){
  state.renderQueued=false;
  const root=analyticsPage();
  if(state.data){if(root&&root.dataset.ronaClientMarketIntelligenceFingerprint!=='analytics:'+state.fingerprint)renderAnalytics(root,state.data);document.documentElement.dataset.ronaClientMarketIntelligence='ready'}
  else if(state.loaded&&state.error&&root&&pageShown(root)){renderError(root,state.error);document.documentElement.dataset.ronaClientMarketIntelligence='degraded'}
}
function schedule(){if(state.renderQueued)return;state.renderQueued=true;requestAnimationFrame(apply)}
function cacheData(){const entry=window.__RONA_CLIENT_BACKGROUND_CACHE__?.[API_PATH];return entry?.ok&&entry?.body?.ok&&entry?.body?.data?entry.body.data:null}
function accept(data,reason){
  if(!data||data.version!=='RONA_CLIENT_MARKET_INTELLIGENCE_V1'||!Array.isArray(data.analytics)||!Array.isArray(data.news))return false;
  const fp=fingerprint(data);state.data=data;state.loaded=true;state.error='';state.updatedAt=new Date().toISOString();if(fp!==state.fingerprint){state.fingerprint=fp;schedule()}
  try{window.dispatchEvent(new CustomEvent('rona:client:market-intelligence',{detail:{reason,version:data.version,generated_at:data.generated_at,analytics_count:data.analytics.length,news_count:data.news.length}}))}catch(_){ }
  return true;
}
async function load(reason='timer'){
  if(state.loading)return;
  const cached=cacheData();if(cached)accept(cached,'background-cache');
  state.loading=true;document.documentElement.dataset.ronaClientMarketIntelligence='loading';
  try{const r=await fetch(API,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-market-intelligence':MARK}});const body=await r.json().catch(()=>null);if(!r.ok||!body?.ok||!accept(body.data,reason))throw new Error(String(body?.code||`HTTP_${r.status}`));}
  catch(error){state.loaded=true;state.error=String(error?.message||error||'CLIENT_MARKET_INTELLIGENCE_LOAD_FAILED');if(!state.data)schedule()}
  finally{state.loading=false;if(state.data)document.documentElement.dataset.ronaClientMarketIntelligence='ready'}
}
function start(){
  const cached=cacheData();if(cached)accept(cached,'initial-cache');
  load('open');
  state.timer=setInterval(()=>load('interval'),REFRESH_MS);
  window.addEventListener('focus',schedule,{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('online',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')schedule()});
  window.addEventListener('rona:client:background-sections',()=>{const c=cacheData();if(c)accept(c,'background-event')},{passive:true});
  new MutationObserver(()=>schedule()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-page','data-page-id']});
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();