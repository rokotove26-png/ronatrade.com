(()=>{
'use strict';
if(location.pathname!=='/portal/client')return;
const MARK='20260902-client-market-intelligence-v1';
if(window.__RONA_CLIENT_MARKET_INTELLIGENCE__===MARK)return;
window.__RONA_CLIENT_MARKET_INTELLIGENCE__=MARK;

const API_PATH='/v1/client/market-intelligence';
const API='/portal/api'+API_PATH;
const REFRESH_MS=60000;
const ROOT_ATTR='data-rona-client-market-intelligence-owner';
const state={version:MARK,loading:false,loaded:false,error:'',data:null,updatedAt:'',fingerprint:'',timer:0,renderQueued:false};
window.__RONA_CLIENT_MARKET_INTELLIGENCE_STATE__=state;

const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
const lower=v=>norm(v).toLocaleLowerCase('ru-RU');
const q=(s,r=document)=>r.querySelector(s);
function el(tag,attrs={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='class')n.className=String(v);else if(k==='text')n.textContent=String(v);else if(k==='html')n.innerHTML=String(v);else if(k==='hidden')n.hidden=Boolean(v);else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2).toLowerCase(),v);else if(v!==false&&v!==null&&v!==undefined)n.setAttribute(k,v===true?'':String(v))}for(const c of children.flat(Infinity)){if(c===null||c===undefined)continue;n.append(c?.nodeType?c:document.createTextNode(String(c)))}return n}
function safeUrl(v){try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch(_){return''}}
function dateValue(v){const d=new Date(v||'');return Number.isFinite(d.getTime())?d:null}
function dateLabel(v,withTime=false){const d=dateValue(v);if(!d)return'—';return d.toLocaleString('ru-RU',withTime?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',year:'numeric'})}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null}
function fmt(v,max=2){const n=finite(v);return n===null?'—':n.toLocaleString('ru-RU',{maximumFractionDigits:max,minimumFractionDigits:Number.isInteger(n)?0:Math.min(2,max)})}
function fingerprint(data){return JSON.stringify([data?.generated_at,(data?.analytics||[]).map(x=>[x.publication_item_id,x.published_at]),(data?.news||[]).map(x=>[x.publication_item_id,x.source_published_at])])}

function pageNodes(){return Array.from(document.querySelectorAll('main section[id^="page-"],main .page,[role="tabpanel"],[data-page-panel],[data-page-id],section[id^="page-"]'))}
function candidate(kind){
  const selectors=kind==='analytics'
    ?['#page-analytics','#analyticsPage','#page-market-analytics','[data-page-panel="analytics"]','[data-page-id="analytics"]','[data-page-panel="market-analytics"]']
    :['#page-market-news','#page-news','#marketNewsPage','#newsPage','[data-page-panel="market-news"]','[data-page-id="market-news"]','[data-page-panel="news"]','[data-page-id="news"]'];
  for(const s of selectors){const node=q(s);if(node)return node}
  const rx=kind==='analytics'?/\bаналитик[аи]\b|market\s+analytics/iu:/новост(?:и|ь).*снг|новост.*топлив|market\s+news|fuel\s+news/iu;
  for(const node of pageNodes()){
    const head=norm(node.querySelector('h1,h2,h3,[data-title],.title,.page-title')?.textContent||node.getAttribute('aria-label')||'');
    if(head&&rx.test(head))return node;
  }
  return null;
}
function pageShown(root){if(!root||!root.isConnected)return false;const s=getComputedStyle(root);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0}
function installStyle(){
  if(document.getElementById('rona-client-market-intelligence-style-v1'))return;
  const s=el('style',{id:'rona-client-market-intelligence-style-v1'});
  s.textContent=`
[${ROOT_ATTR}]{--mi-line:rgba(255,255,255,.13);--mi-soft:rgba(255,255,255,.055);--mi-soft2:rgba(255,255,255,.085);--mi-text:inherit;--mi-muted:rgba(225,235,245,.66);--mi-accent:#4aa8ff;width:100%;min-width:0;color:var(--mi-text);font:inherit}
[${ROOT_ATTR}] *{box-sizing:border-box}
[${ROOT_ATTR}] .mi-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:4px 0 20px;border-bottom:1px solid var(--mi-line)}
[${ROOT_ATTR}] .mi-kicker{margin:0 0 7px;color:var(--mi-accent);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
[${ROOT_ATTR}] h2{margin:0;font-size:clamp(24px,3vw,38px);line-height:1.05;font-weight:800;letter-spacing:-.025em}
[${ROOT_ATTR}] .mi-sub{margin:9px 0 0;max-width:880px;color:var(--mi-muted);font-size:12px;line-height:1.55}
[${ROOT_ATTR}] .mi-meta{flex:0 0 auto;color:var(--mi-muted);font-size:10px;text-align:right;line-height:1.55}
[${ROOT_ATTR}] .mi-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) 170px 210px auto;gap:10px;align-items:end;padding:14px 0;border-bottom:1px solid var(--mi-line)}
[${ROOT_ATTR}] .mi-field{display:grid;gap:5px;min-width:0}
[${ROOT_ATTR}] .mi-field span{color:var(--mi-muted);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
[${ROOT_ATTR}] input,[${ROOT_ATTR}] select,[${ROOT_ATTR}] button{font:inherit}
[${ROOT_ATTR}] .mi-input,[${ROOT_ATTR}] .mi-select{width:100%;height:38px;padding:0 10px;border:1px solid var(--mi-line);border-radius:8px;background:var(--mi-soft);color:inherit;outline:none}
[${ROOT_ATTR}] .mi-btn{height:38px;padding:0 13px;border:1px solid var(--mi-line);border-radius:8px;background:var(--mi-soft2);color:inherit;font-size:11px;font-weight:750;cursor:pointer;white-space:nowrap}
[${ROOT_ATTR}] .mi-btn:disabled{opacity:.45;cursor:default}
[${ROOT_ATTR}] .mi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;padding-top:16px}
[${ROOT_ATTR}] .mi-card{min-width:0;padding:16px;border:1px solid var(--mi-line);border-radius:12px;background:var(--mi-soft)}
[${ROOT_ATTR}] .mi-card-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
[${ROOT_ATTR}] .mi-product{font-size:11px;font-weight:850;letter-spacing:.055em;text-transform:uppercase}
[${ROOT_ATTR}] .mi-date{color:var(--mi-muted);font-size:10px;white-space:nowrap}
[${ROOT_ATTR}] .mi-card h3{margin:10px 0 0;font-size:16px;line-height:1.35;font-weight:750}
[${ROOT_ATTR}] .mi-copy{margin:9px 0 0;color:var(--mi-muted);font-size:12px;line-height:1.55;white-space:pre-wrap}
[${ROOT_ATTR}] .mi-bars{display:grid;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--mi-line)}
[${ROOT_ATTR}] .mi-bar-row{display:grid;grid-template-columns:minmax(90px,.95fr) minmax(100px,1.8fr) auto;gap:9px;align-items:center;font-size:10px}
[${ROOT_ATTR}] .mi-bar-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mi-muted)}
[${ROOT_ATTR}] .mi-track{height:7px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.07)}
[${ROOT_ATTR}] .mi-fill{height:100%;min-width:2px;border-radius:99px;background:currentColor;opacity:.72}
[${ROOT_ATTR}] .mi-value{font-variant-numeric:tabular-nums;font-weight:800;white-space:nowrap}
[${ROOT_ATTR}] .mi-news-list{display:grid;gap:0;padding-top:4px}
[${ROOT_ATTR}] .mi-news{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:16px;align-items:start;padding:16px 0;border-bottom:1px solid var(--mi-line)}
[${ROOT_ATTR}] .mi-news-time{color:var(--mi-muted);font-size:10px;line-height:1.5}
[${ROOT_ATTR}] .mi-news h3{margin:0;font-size:16px;line-height:1.35;font-weight:750}
[${ROOT_ATTR}] .mi-news p{margin:7px 0 0;color:var(--mi-muted);font-size:12px;line-height:1.55}
[${ROOT_ATTR}] .mi-source{margin-top:7px;color:var(--mi-muted);font-size:10px}
[${ROOT_ATTR}] .mi-open{padding:7px 9px;border:1px solid var(--mi-line);border-radius:7px;background:transparent;color:inherit;font-size:10px;font-weight:750;cursor:pointer}
[${ROOT_ATTR}] .mi-empty,[${ROOT_ATTR}] .mi-error{padding:34px 0;color:var(--mi-muted);font-size:13px;line-height:1.6}
[${ROOT_ATTR}] .mi-error strong{color:inherit}
[${ROOT_ATTR}] dialog{width:min(820px,calc(100% - 32px));max-height:86vh;overflow:auto;padding:0;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:#0c1724;color:#eef6ff;box-shadow:0 30px 90px rgba(0,0,0,.55)}
[${ROOT_ATTR}] dialog::backdrop{background:rgba(2,6,11,.72);backdrop-filter:blur(3px)}
[${ROOT_ATTR}] .mi-dialog-head{display:flex;justify-content:space-between;gap:20px;padding:22px;border-bottom:1px solid rgba(255,255,255,.12)}
[${ROOT_ATTR}] .mi-dialog-head h3{margin:0;font-size:22px;line-height:1.25}
[${ROOT_ATTR}] .mi-close{width:36px;height:36px;padding:0;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:transparent;color:inherit;font-size:22px;cursor:pointer}
[${ROOT_ATTR}] .mi-dialog-meta{padding:14px 22px 0;color:rgba(225,235,245,.68);font-size:10px;line-height:1.6}
[${ROOT_ATTR}] .mi-dialog-body{padding:18px 22px 22px;white-space:pre-wrap;font-size:14px;line-height:1.7}
[${ROOT_ATTR}] .mi-dialog-actions{display:flex;gap:10px;padding:0 22px 22px}
[${ROOT_ATTR}] .mi-link{display:inline-flex;align-items:center;min-height:38px;padding:0 12px;border:1px solid rgba(255,255,255,.16);border-radius:8px;background:rgba(255,255,255,.07);color:inherit;text-decoration:none;font-size:10px;font-weight:800}
@media(max-width:900px){[${ROOT_ATTR}] .mi-grid{grid-template-columns:1fr}[${ROOT_ATTR}] .mi-toolbar{grid-template-columns:1fr 1fr}[${ROOT_ATTR}] .mi-field:first-child{grid-column:1/-1}[${ROOT_ATTR}] .mi-news{grid-template-columns:100px minmax(0,1fr)}}
@media(max-width:620px){[${ROOT_ATTR}] .mi-head{align-items:flex-start;flex-direction:column}[${ROOT_ATTR}] .mi-meta{text-align:left}[${ROOT_ATTR}] .mi-toolbar{grid-template-columns:1fr}[${ROOT_ATTR}] .mi-field:first-child{grid-column:auto}[${ROOT_ATTR}] .mi-news{grid-template-columns:1fr}[${ROOT_ATTR}] .mi-open{justify-self:start}}
`;
  document.head.appendChild(s);
}
function hideLegacy(root,owner){
  if(root.dataset.ronaClientMarketIntelligenceMigrated==='v1')return;
  for(const child of Array.from(root.children)){if(child!==owner){child.dataset.ronaClientMarketLegacy='hidden-v1';child.hidden=true}}
  root.dataset.ronaClientMarketIntelligenceMigrated='v1';
}
function ensureOwner(root,kind){
  installStyle();
  let owner=root.querySelector(`:scope > [${ROOT_ATTR}="${kind}"]`);
  if(!owner){owner=el('section',{[ROOT_ATTR]:kind,'data-rona-client-market-intelligence-version':MARK});root.prepend(owner)}
  hideLegacy(root,owner);
  return owner;
}
function head(kind,data){
  const title=kind==='analytics'?'Аналитика':'Новости топливного рынка СНГ';
  const sub=kind==='analytics'?'Опубликованный клиентский аналитический слой RONA Trade. Только верифицированные производные данные, разрешённые к клиентской дистрибуции.':'Верифицированная лента топливного рынка СНГ. Дедупликация и окно публикации — 7 календарных дат по дате первичного источника.';
  return el('header',{class:'mi-head'},el('div',{},el('p',{class:'mi-kicker',text:'RONA TRADE · MARKET INTELLIGENCE'}),el('h2',{text:title}),el('p',{class:'mi-sub',text:sub})),el('div',{class:'mi-meta'},el('div',{text:'Обновлено '+dateLabel(data?.generated_at,true)}),el('div',{text:'Europe/Moscow'})));
}
function chartRows(chart){
  const labels=Array.isArray(chart?.labels)?chart.labels:[],values=Array.isArray(chart?.values)?chart.values:[];
  const nums=values.map(finite).filter(v=>v!==null);if(!labels.length||!nums.length)return null;
  const max=Math.max(...nums.map(v=>Math.abs(v)),1);
  return el('div',{class:'mi-bars'},labels.slice(0,8).map((label,i)=>{const value=finite(values[i]);const width=value===null?0:Math.max(2,Math.min(100,Math.abs(value)/max*100));return el('div',{class:'mi-bar-row'},el('span',{class:'mi-bar-label',text:norm(label)||'—'}),el('span',{class:'mi-track'},el('span',{class:'mi-fill',style:`display:block;width:${width.toFixed(2)}%`})),el('span',{class:'mi-value',text:value===null?'—':fmt(value,2)+(chart?.unit?' '+chart.unit:'')}))}));
}
function renderAnalytics(root,data){
  const owner=ensureOwner(root,'analytics');
  const rows=Array.isArray(data?.analytics)?data.analytics:[];
  const body=el('div',{});
  if(!rows.length)body.append(el('div',{class:'mi-empty',text:'Опубликованных аналитических материалов для текущего клиентского доступа нет.'}));
  else{
    const grid=el('div',{class:'mi-grid'});
    for(const row of rows){const card=el('article',{class:'mi-card'},el('div',{class:'mi-card-top'},el('span',{class:'mi-product',text:norm(row.product)||'Аналитика'}),el('span',{class:'mi-date',text:'на '+dateLabel(row.analytics_as_of)})),el('h3',{text:norm(row.headline)||norm(row.title)||'Аналитический материал'}));const copy=norm(row.content_text);if(copy)card.append(el('p',{class:'mi-copy',text:copy}));const bars=chartRows(row.public_chart);if(bars)card.append(bars);grid.append(card)}
    body.append(grid);
  }
  owner.replaceChildren(head('analytics',data),body);
  root.dataset.ronaClientAnalyticsReady='true';
  root.dataset.ronaClientMarketIntelligenceFingerprint='analytics:'+state.fingerprint;
}
function newsTimestamp(x){return x?.source_published_at||x?.published_at||''}
function newsKey(x){return norm(x?.duplicate_group)||norm(x?.news_id)||norm(x?.publication_item_id)}
function openNews(owner,row){
  let dialog=owner.querySelector('dialog[data-rona-mi-dialog]');if(dialog)dialog.remove();
  dialog=el('dialog',{'data-rona-mi-dialog':'v1'});
  const close=()=>{try{dialog.close()}catch(_){ }dialog.remove()};
  const source=safeUrl(row.source_url);
  dialog.append(el('div',{class:'mi-dialog-head'},el('h3',{text:norm(row.headline)||'Новость'}),el('button',{type:'button',class:'mi-close','aria-label':'Закрыть',text:'×',onclick:close})),el('div',{class:'mi-dialog-meta',text:[dateLabel(newsTimestamp(row),true),norm(row.source_name),norm(row.region),norm(row.product)].filter(Boolean).join(' · ')}),el('div',{class:'mi-dialog-body',text:norm(row.content_text)||norm(row.headline)}));
  if(source)dialog.append(el('div',{class:'mi-dialog-actions'},el('a',{class:'mi-link',href:source,target:'_blank',rel:'noopener noreferrer',text:'Перейти к первоисточнику'})));
  dialog.addEventListener('cancel',ev=>{ev.preventDefault();close()});owner.append(dialog);try{dialog.showModal()}catch(_){dialog.setAttribute('open','')}
}
function renderNews(root,data){
  const owner=ensureOwner(root,'news');
  const all=Array.isArray(data?.news)?data.news.slice():[];
  const filter={search:'',date:'',source:'ALL'};
  const renderList=()=>{
    const needle=lower(filter.search);
    const rows=all.filter(x=>{
      const d=dateValue(newsTimestamp(x));
      if(filter.date&&(!d||[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')!==filter.date))return false;
      if(filter.source!=='ALL'&&norm(x.source_name)!==filter.source)return false;
      if(needle&&!lower([x.headline,x.content_text,x.source_name,x.region,x.product,x.category].filter(Boolean).join(' ')).includes(needle))return false;
      return true;
    });
    list.replaceChildren();
    if(!rows.length){list.append(el('div',{class:'mi-empty',text:'По выбранным параметрам материалов нет.'}));return}
    const seen=new Set();
    for(const row of rows){const k=newsKey(row);if(k&&seen.has(k))continue;if(k)seen.add(k);const copy=norm(row.content_text);list.append(el('article',{class:'mi-news'},el('div',{class:'mi-news-time'},el('div',{text:dateLabel(newsTimestamp(row),true)}),el('div',{text:norm(row.region)||''})),el('div',{},el('h3',{text:norm(row.headline)||'Новость'}),copy?el('p',{text:copy.length>300?copy.slice(0,300).trimEnd()+'…':copy}):null,el('div',{class:'mi-source',text:[norm(row.source_name),norm(row.product)].filter(Boolean).join(' · ')})),el('button',{type:'button',class:'mi-open',text:'Открыть',onclick:()=>openNews(owner,row)})))}
  };
  const sources=Array.from(new Set(all.map(x=>norm(x.source_name)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ru'));
  const search=el('input',{class:'mi-input',type:'search',placeholder:'Событие, рынок, продукт, источник','aria-label':'Поиск по новостям'});
  const date=el('input',{class:'mi-input',type:'date','aria-label':'Дата новости'});
  const source=el('select',{class:'mi-select','aria-label':'Источник'},el('option',{value:'ALL',text:'Все источники'}),sources.map(x=>el('option',{value:x,text:x})));
  search.addEventListener('input',()=>{filter.search=search.value;renderList()});date.addEventListener('change',()=>{filter.date=date.value;renderList()});source.addEventListener('change',()=>{filter.source=source.value;renderList()});
  const refresh=el('button',{type:'button',class:'mi-btn',text:'Обновить',onclick:()=>load('manual')});
  const toolbar=el('div',{class:'mi-toolbar'},el('label',{class:'mi-field'},el('span',{text:'Поиск'}),search),el('label',{class:'mi-field'},el('span',{text:'Дата'}),date),el('label',{class:'mi-field'},el('span',{text:'Источник'}),source),refresh);
  const list=el('div',{class:'mi-news-list'});
  owner.replaceChildren(head('news',data),toolbar,list);
  renderList();
  root.dataset.ronaClientMarketNewsReady='true';
  root.dataset.ronaClientMarketIntelligenceFingerprint='news:'+state.fingerprint;
}
function renderError(root,kind,message){
  if(!root)return;const owner=ensureOwner(root,kind);owner.replaceChildren(head(kind,state.data||{}),el('div',{class:'mi-error'},el('strong',{text:'Данные временно недоступны. '}),document.createTextNode(message||'Повторная загрузка выполняется автоматически.')));
}
function apply(){
  state.renderQueued=false;
  const a=candidate('analytics'),n=candidate('news');
  if(state.data){if(a&&a.dataset.ronaClientMarketIntelligenceFingerprint!=='analytics:'+state.fingerprint)renderAnalytics(a,state.data);if(n&&n.dataset.ronaClientMarketIntelligenceFingerprint!=='news:'+state.fingerprint)renderNews(n,state.data);document.documentElement.dataset.ronaClientMarketIntelligence='ready'}
  else if(state.loaded&&state.error){if(a&&pageShown(a))renderError(a,'analytics',state.error);if(n&&pageShown(n))renderError(n,'news',state.error);document.documentElement.dataset.ronaClientMarketIntelligence='degraded'}
}
function schedule(){if(state.renderQueued)return;state.renderQueued=true;requestAnimationFrame(apply)}
function cacheData(){const entry=window.__RONA_CLIENT_BACKGROUND_CACHE__?.[API_PATH];return entry?.ok&&entry?.body?.ok&&entry?.body?.data?entry.body.data:null}
function accept(data,reason){if(!data||data.version!=='RONA_CLIENT_MARKET_INTELLIGENCE_V1'||!Array.isArray(data.analytics)||!Array.isArray(data.news))return false;const fp=fingerprint(data);state.data=data;state.loaded=true;state.error='';state.updatedAt=new Date().toISOString();if(fp!==state.fingerprint){state.fingerprint=fp;schedule()}try{window.dispatchEvent(new CustomEvent('rona:client:market-intelligence',{detail:{reason,version:data.version,generated_at:data.generated_at,analytics_count:data.analytics.length,news_count:data.news.length}}))}catch(_){ }return true}
async function load(reason='timer'){
  if(state.loading)return;
  const cached=cacheData();if(cached)accept(cached,'background-cache');
  state.loading=true;document.documentElement.dataset.ronaClientMarketIntelligence='loading';
  try{const r=await fetch(API,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-market-intelligence':MARK}});const body=await r.json().catch(()=>null);if(!r.ok||!body?.ok||!accept(body.data,reason))throw new Error(String(body?.code||`HTTP_${r.status}`));}
  catch(error){state.loaded=true;state.error=String(error?.message||error||'CLIENT_MARKET_INTELLIGENCE_LOAD_FAILED');if(!state.data)schedule()}
  finally{state.loading=false;if(state.data)document.documentElement.dataset.ronaClientMarketIntelligence='ready'}
}
function navRelevant(target){const node=target?.closest?.('a,button,[role="tab"],[role="menuitem"],[data-page],[data-page-id],[data-page-target],li');const text=lower([node?.textContent,target?.textContent,node?.getAttribute?.('data-page'),node?.getAttribute?.('data-page-id'),node?.getAttribute?.('href')].filter(Boolean).join(' '));return /аналитик|новост|market.?analytics|market.?news/.test(text)}
function start(){
  const cached=cacheData();if(cached)accept(cached,'initial-cache');
  load('open');
  state.timer=setInterval(()=>load('interval'),REFRESH_MS);
  window.addEventListener('focus',()=>load('focus'),{passive:true});
  window.addEventListener('pageshow',()=>load('pageshow'),{passive:true});
  window.addEventListener('online',()=>load('online'),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load('visible')});
  window.addEventListener('rona:client:background-sections',()=>{const c=cacheData();if(c)accept(c,'background-event')},{passive:true});
  document.addEventListener('click',ev=>{if(navRelevant(ev.target))setTimeout(schedule,0)},true);
  new MutationObserver(()=>schedule()).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','data-page','data-page-id']});
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
