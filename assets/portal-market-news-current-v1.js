(()=>{
'use strict';
if(window.__RONA_MARKET_NEWS_CURRENT_V1__)return;
window.__RONA_MARKET_NEWS_CURRENT_V1__='20260902-hourly-refresh-v3';

const PAGE_ID='page-market-news';
const ROOT_ID='rona-market-news-current';
const STYLE_ID='rona-market-news-current-style';
const API='/portal/owner-api';
const state={rows:[],loading:false,loaded:false,error:'',date:'',source:'ALL',search:'',updatedAt:'',fingerprint:''};
const AUTO_REFRESH_MS=3600000;
let autoRefreshTimer=null;

const q=(s,r=document)=>r.querySelector(s);
function el(tag,attrs={},...children){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(k==='class')n.className=String(v);
    else if(k==='text')n.textContent=String(v);
    else if(k==='html')n.innerHTML=String(v);
    else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2).toLowerCase(),v);
    else if(v!==false&&v!==null&&v!==undefined)n.setAttribute(k,v===true?'':String(v));
  }
  for(const c of children.flat(Infinity)){
    if(c===null||c===undefined)continue;
    n.append(c?.nodeType?c:document.createTextNode(String(c)));
  }
  return n;
}
function page(){return document.getElementById(PAGE_ID)}
function timestamp(x){return x?.source_published_at||x?.published_at||x?.prepared_at||x?.created_at||''}
function parsedDate(x){const v=timestamp(x);if(!v)return null;const d=new Date(v);return Number.isFinite(d.getTime())?d:null}
function isoDate(x){const d=parsedDate(x);if(!d)return'';return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function dateLabel(x){const d=parsedDate(x);return d?d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):'—'}
function sourceName(x){return String(x?.source_name||'RONA Market Intelligence').replace(/\s+/g,' ').trim()||'RONA Market Intelligence'}
function headline(x){return String(x?.headline||x?.title||x?.subject||'Новость').replace(/\s+/g,' ').trim()||'Новость'}
function bodyText(x){return String(x?.content_text||x?.summary||x?.body_text||x?.reason||'').replace(/\r\n?/g,'\n').trim()}
function excerpt(x,max=260){const s=bodyText(x).replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max).trimEnd()+'…':s}
function safeUrl(v){try{const u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch(_){return''}}
function sourceUrl(x){return safeUrl(x?.source_url||x?.url||x?.source_link)}
function rowKey(x){return String(x?.duplicate_group||x?.news_id||x?.source_version||x?.publication_id||x?.id||[headline(x),timestamp(x),sourceName(x)].join('|'))}
function dedupeRows(rows){const seen=new Set(),out=[];for(const x of rows){const k=rowKey(x);if(seen.has(k))continue;seen.add(k);out.push(x)}return out}
function rowsFingerprint(rows){return JSON.stringify(rows.map(x=>[rowKey(x),String(x?.updated_at||x?.published_at||x?.prepared_at||x?.created_at||timestamp(x)||'')]))}
function uniqueSources(){return Array.from(new Set(state.rows.map(sourceName))).sort((a,b)=>a.localeCompare(b,'ru'))}
function filteredRows(){
  const needle=state.search.trim().toLocaleLowerCase('ru-RU');
  return state.rows.filter(x=>{
    if(state.date&&isoDate(x)!==state.date)return false;
    if(state.source!=='ALL'&&sourceName(x)!==state.source)return false;
    if(needle){
      const hay=[headline(x),bodyText(x),sourceName(x),x?.region,x?.market,x?.product].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU');
      if(!hay.includes(needle))return false;
    }
    return true;
  });
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const s=el('style',{id:STYLE_ID});
  s.textContent=`
#page-market-news{--mn-paper:#f2eee5;--mn-paper2:#faf8f2;--mn-ink:#111317;--mn-copy:#3f464b;--mn-muted:#72766f;--mn-rule:#b9b3aa;--mn-red:#be1e2d;--mn-deep:#0f151b;color-scheme:light}
#page-market-news>.rona-market-news-current{width:min(100%,1500px);max-width:1500px;margin:0 auto;min-height:calc(100vh - 66px);padding:28px 34px 56px;background:var(--mn-paper);color:var(--mn-ink);border-inline:1px solid rgba(17,19,23,.08);box-shadow:0 24px 80px rgba(0,0,0,.26);font-family:Inter,Segoe UI,Arial,sans-serif}
#page-market-news>.rona-market-news-current *{box-sizing:border-box}
#page-market-news .mn-masthead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:end;padding:3px 0 22px;border-bottom:5px solid var(--mn-red)}
#page-market-news .mn-brand{display:block;margin-bottom:12px;color:var(--mn-red);font-size:10px;font-weight:900;letter-spacing:.19em;text-transform:uppercase}
#page-market-news .mn-title{margin:0;max-width:1160px;color:var(--mn-ink);font:800 clamp(42px,4.8vw,72px)/.96 Georgia,'Times New Roman',serif;letter-spacing:-.048em}
#page-market-news .mn-deck{max-width:900px;margin:14px 0 0;color:#51575a;font-size:14px;line-height:1.55}
#page-market-news .mn-edition{align-self:start;padding-top:3px;color:#646760;text-align:right;font-size:9px;font-weight:850;line-height:1.45;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
#page-market-news .mn-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 170px 220px auto auto;gap:10px;align-items:end;padding:14px 0;border-bottom:1px solid var(--mn-rule)}
#page-market-news .mn-field{display:grid;gap:5px;min-width:0}
#page-market-news .mn-field span{color:#6d706b;font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
#page-market-news .mn-input,#page-market-news .mn-select{width:100%;height:40px;padding:0 11px;border:1px solid #aaa49a;border-radius:0;background:var(--mn-paper2);color:var(--mn-ink);outline:none;font:700 12px/1 Inter,Segoe UI,Arial,sans-serif}
#page-market-news .mn-input:focus,#page-market-news .mn-select:focus{border-color:var(--mn-red);box-shadow:0 0 0 2px rgba(190,30,45,.08)}
#page-market-news .mn-button{height:40px;padding:0 14px;border:1px solid var(--mn-deep);border-radius:0;background:var(--mn-deep);color:#fff;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
#page-market-news .mn-button.mn-button-light{background:transparent;color:var(--mn-deep)}
#page-market-news .mn-button:disabled{opacity:.45;cursor:default}
#page-market-news .mn-statusline{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--mn-rule);color:#646862;font-size:10px;font-weight:750}
#page-market-news .mn-statusline strong{color:var(--mn-ink);font-weight:900}
#page-market-news .mn-front{display:grid;grid-template-columns:minmax(0,2fr) minmax(320px,.92fr);gap:34px;padding:30px 0 32px;border-bottom:2px solid #77736d}
#page-market-news .mn-lead{appearance:none;display:block;width:100%;padding:0 34px 0 0;border:0;border-right:1px solid var(--mn-rule);background:transparent;color:var(--mn-ink);text-align:left;cursor:pointer}
#page-market-news .mn-kicker{display:block;margin-bottom:10px;color:var(--mn-red);font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
#page-market-news .mn-meta{display:block;margin-bottom:10px;color:#73756f;font-size:9px;font-weight:800;letter-spacing:.035em;text-transform:uppercase}
#page-market-news .mn-lead-title{display:block;max-width:1050px;color:var(--mn-ink);font:800 clamp(34px,3.8vw,56px)/1.03 Georgia,'Times New Roman',serif;letter-spacing:-.035em}
#page-market-news .mn-lead-copy{display:block;max-width:940px;margin-top:16px;color:var(--mn-copy);font-size:14px;line-height:1.65}
#page-market-news .mn-read{display:inline-flex;margin-top:18px;padding-bottom:3px;border-bottom:2px solid var(--mn-red);color:var(--mn-ink);font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
#page-market-news .mn-rail-title,#page-market-news .mn-section-title{margin:0;padding:0 0 10px;border-bottom:3px solid var(--mn-deep);color:var(--mn-deep);font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
#page-market-news .mn-rail-item{appearance:none;display:block;width:100%;padding:15px 0 16px;border:0;border-bottom:1px solid #c6c0b7;background:transparent;color:var(--mn-ink);text-align:left;cursor:pointer}
#page-market-news .mn-rail-item:last-child{border-bottom:0}
#page-market-news .mn-rail-item .mn-meta{margin-bottom:6px}
#page-market-news .mn-rail-headline{display:block;color:var(--mn-ink);font:750 19px/1.2 Georgia,'Times New Roman',serif;letter-spacing:-.012em}
#page-market-news .mn-all{padding-top:30px}
#page-market-news .mn-all-head{display:flex;align-items:end;justify-content:space-between;gap:16px;padding-bottom:10px;border-bottom:3px solid var(--mn-deep)}
#page-market-news .mn-all-head h2{margin:0;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
#page-market-news .mn-count{color:#73766f;font-size:10px;font-weight:750}
#page-market-news .mn-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));column-gap:28px}
#page-market-news .mn-card{appearance:none;display:block;width:100%;min-width:0;padding:21px 0 23px;border:0;border-bottom:1px solid #c8c2b9;background:transparent;color:var(--mn-ink);text-align:left;cursor:pointer}
#page-market-news .mn-card-title{display:block;color:var(--mn-ink);font:750 22px/1.18 Georgia,'Times New Roman',serif;letter-spacing:-.017em}
#page-market-news .mn-card-copy{display:block;margin-top:9px;color:#555b5d;font-size:12px;line-height:1.55}
#page-market-news .mn-empty,#page-market-news .mn-error{padding:64px 0;border-bottom:1px solid var(--mn-rule);color:#565d5b;font-size:14px;line-height:1.6}
#page-market-news .mn-error strong{display:block;margin-bottom:8px;color:var(--mn-red)}
#page-market-news button:focus-visible,#page-market-news input:focus-visible,#page-market-news select:focus-visible{outline:2px solid var(--mn-red);outline-offset:3px}
#page-market-news .mn-dialog{width:min(920px,calc(100% - 36px));max-height:88vh;overflow:auto;padding:0;border:0;border-top:5px solid var(--mn-red);border-radius:0;background:#f5f1e9;color:var(--mn-ink);box-shadow:0 30px 100px rgba(0,0,0,.48)}
#page-market-news .mn-dialog::backdrop{background:rgba(2,6,10,.8);backdrop-filter:blur(4px)}
#page-market-news .mn-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:30px 34px 20px;border-bottom:1px solid var(--mn-rule)}
#page-market-news .mn-dialog-head h2{margin:0;color:var(--mn-ink);font:800 clamp(28px,4vw,44px)/1.08 Georgia,'Times New Roman',serif;letter-spacing:-.025em}
#page-market-news .mn-dialog-close{flex:0 0 auto;width:40px;height:40px;border:1px solid var(--mn-deep);border-radius:0;background:transparent;color:var(--mn-deep);font-size:24px;cursor:pointer}
#page-market-news .mn-dialog-meta{padding:15px 34px 0;color:#6d706b;font-size:9px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}
#page-market-news .mn-dialog-body{padding:22px 34px 28px;white-space:pre-wrap;color:#252b2e;font:500 16px/1.72 Georgia,'Times New Roman',serif}
#page-market-news .mn-dialog-actions{display:flex;gap:10px;padding:0 34px 32px}
#page-market-news .mn-source-link{display:inline-flex;align-items:center;min-height:42px;padding:0 14px;border:1px solid var(--mn-deep);background:var(--mn-deep);color:#fff;text-decoration:none;font-size:9px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
@media(hover:hover) and (pointer:fine){#page-market-news .mn-lead:hover .mn-lead-title,#page-market-news .mn-rail-item:hover .mn-rail-headline,#page-market-news .mn-card:hover .mn-card-title{color:#a81725}#page-market-news .mn-button:not(:disabled):hover,#page-market-news .mn-source-link:hover{background:var(--mn-red);border-color:var(--mn-red);color:#fff}}
@media(max-width:1160px){#page-market-news .mn-toolbar{grid-template-columns:minmax(220px,1fr) 160px 190px auto auto}#page-market-news .mn-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){#page-market-news>.rona-market-news-current{padding:22px 20px 44px}#page-market-news .mn-masthead{grid-template-columns:1fr}#page-market-news .mn-edition{text-align:left}#page-market-news .mn-toolbar{grid-template-columns:1fr 1fr}#page-market-news .mn-field:first-child{grid-column:1/-1}#page-market-news .mn-front{grid-template-columns:1fr}#page-market-news .mn-lead{padding:0 0 24px;border-right:0;border-bottom:1px solid var(--mn-rule)}}
@media(max-width:620px){#page-market-news>.rona-market-news-current{min-height:calc(100vh - 108px);padding:18px 14px 34px}#page-market-news .mn-title{font-size:40px}#page-market-news .mn-toolbar{grid-template-columns:1fr}#page-market-news .mn-field:first-child{grid-column:auto}#page-market-news .mn-grid{grid-template-columns:1fr}#page-market-news .mn-statusline{align-items:flex-start;flex-direction:column}}
`;
  document.head.appendChild(s);
}

function ensureRoot(){
  installStyle();
  const p=page();
  if(!p)return null;
  let root=document.getElementById(ROOT_ID);
  if(!root){root=el('section',{id:ROOT_ID,class:'rona-market-news-current','data-rona-market-news-owner':'clean-rebuild-v1'});}
  if(root.parentElement!==p)p.replaceChildren(root);
  else for(const child of Array.from(p.children))if(child!==root)child.remove();
  return root;
}
function metaText(x){return dateLabel(x)+' · '+sourceName(x)}
function storyButton(x,kind){
  if(kind==='lead')return el('button',{type:'button',class:'mn-lead',onclick:()=>openArticle(x)},
    el('span',{class:'mn-kicker',text:'Главная новость'}),
    el('span',{class:'mn-meta',text:metaText(x)}),
    el('span',{class:'mn-lead-title',text:headline(x)}),
    excerpt(x,480)?el('span',{class:'mn-lead-copy',text:excerpt(x,480)}):null,
    el('span',{class:'mn-read',text:'Читать материал'})
  );
  if(kind==='rail')return el('button',{type:'button',class:'mn-rail-item',onclick:()=>openArticle(x)},
    el('span',{class:'mn-meta',text:metaText(x)}),
    el('span',{class:'mn-rail-headline',text:headline(x)})
  );
  return el('button',{type:'button',class:'mn-card',onclick:()=>openArticle(x)},
    el('span',{class:'mn-meta',text:metaText(x)}),
    el('span',{class:'mn-card-title',text:headline(x)}),
    excerpt(x,230)?el('span',{class:'mn-card-copy',text:excerpt(x,230)}):null
  );
}
function openArticle(x){
  const root=ensureRoot();
  if(!root)return;
  let d=q('.mn-dialog',root);
  if(!d){d=el('dialog',{class:'mn-dialog'});root.append(d)}
  const close=el('button',{type:'button',class:'mn-dialog-close','aria-label':'Закрыть',text:'×',onclick:()=>d.close()});
  const head=el('div',{class:'mn-dialog-head'},el('div',{},el('span',{class:'mn-kicker',text:'RONA Market Intelligence'}),el('h2',{text:headline(x)})),close);
  const meta=el('div',{class:'mn-dialog-meta',text:metaText(x)});
  const body=el('div',{class:'mn-dialog-body',text:bodyText(x)||'Текст материала отсутствует.'});
  const actions=el('div',{class:'mn-dialog-actions'});
  const url=sourceUrl(x);
  if(url)actions.append(el('a',{class:'mn-source-link',href:url,target:'_blank',rel:'noopener noreferrer',text:'Открыть первоисточник · '+sourceName(x)}));
  d.replaceChildren(head,meta,body,actions);
  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
}
function sourceSelect(){
  const select=el('select',{class:'mn-select','aria-label':'Источник'});
  select.append(new Option('Все источники','ALL'));
  for(const s of uniqueSources())select.append(new Option(s,s));
  select.value=uniqueSources().includes(state.source)?state.source:'ALL';
  if(select.value!==state.source)state.source='ALL';
  select.onchange=()=>{state.source=select.value;render()};
  return select;
}
function render(){
  const root=ensureRoot();
  if(!root)return false;
  const rows=filteredRows();
  const sources=uniqueSources();
  const masthead=el('header',{class:'mn-masthead'},
    el('div',{},el('span',{class:'mn-brand',text:'RONA TRADE · MARKET INTELLIGENCE'}),el('h1',{class:'mn-title',text:'Новости топливного рынка СНГ'}),el('p',{class:'mn-deck',text:'Рыночные события, производство, поставки, логистика и торговые сигналы — в самостоятельной редакционной ленте RONA Trade.'})),
    el('div',{class:'mn-edition',text:'MARKET DESK · CIS ENERGY\nCURRENT EDITION'})
  );
  const search=el('input',{class:'mn-input',type:'search',placeholder:'Событие, рынок, продукт, источник',value:state.search,'aria-label':'Поиск по новостям'});
  search.oninput=()=>{state.search=search.value};
  search.onchange=()=>render();
  search.onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();render()}};
  const dateInput=el('input',{class:'mn-input',type:'date',value:state.date,'aria-label':'Дата новости'});
  dateInput.onchange=()=>{state.date=dateInput.value;render()};
  const refresh=el('button',{type:'button',class:'mn-button',disabled:state.loading,text:state.loading?'Обновление…':'Обновить',onclick:()=>loadData(true)});
  const reset=el('button',{type:'button',class:'mn-button mn-button-light',disabled:!(state.search||state.date||state.source!=='ALL'),text:'Сбросить',onclick:()=>{state.search='';state.date='';state.source='ALL';render()}});
  const toolbar=el('div',{class:'mn-toolbar'},
    el('label',{class:'mn-field'},el('span',{text:'Поиск'}),search),
    el('label',{class:'mn-field'},el('span',{text:'Дата'}),dateInput),
    el('label',{class:'mn-field'},el('span',{text:'Источник'}),sourceSelect()),
    refresh,reset
  );
  const status=el('div',{class:'mn-statusline'},
    el('span',{},el('strong',{text:String(rows.length)}),document.createTextNode(' материалов · '+String(sources.length)+' источников')),
    el('span',{text:state.updatedAt?'Обновлено: '+new Date(state.updatedAt).toLocaleString('ru-RU'):'Актуализация при открытии раздела'})
  );
  const content=el('main',{});
  if(state.error&&!state.rows.length){
    content.append(el('div',{class:'mn-error'},el('strong',{text:'Не удалось получить новостную ленту'}),document.createTextNode(state.error)));
  }else if(state.loading&&!state.loaded){
    content.append(el('div',{class:'mn-empty',text:'Загрузка актуальной новостной ленты…'}));
  }else if(!rows.length){
    content.append(el('div',{class:'mn-empty',text:'По выбранным параметрам материалов нет.'}));
  }else{
    const front=el('section',{class:'mn-front','aria-label':'Главные новости'});
    front.append(storyButton(rows[0],'lead'));
    const rail=el('aside',{},el('h2',{class:'mn-rail-title',text:'Последнее'}));
    for(const x of rows.slice(1,5))rail.append(storyButton(x,'rail'));
    if(rows.length===1)rail.append(el('div',{class:'mn-empty',text:'Других материалов в текущей выборке нет.'}));
    front.append(rail);
    content.append(front);
    if(rows.length>5){
      const all=el('section',{class:'mn-all','aria-label':'Все материалы'});
      const allHead=el('div',{class:'mn-all-head'},el('h2',{text:'Все материалы'}),el('span',{class:'mn-count',text:String(rows.length-5)+' материалов'}));
      all.append(allHead);
      const grid=el('div',{class:'mn-grid'});
      for(const x of rows.slice(5))grid.append(storyButton(x,'card'));
      all.append(grid);
      content.append(all);
    }
  }
  root.replaceChildren(masthead,toolbar,status,content);
  return true;
}
async function loadData(force=false){
  if(state.loading)return;
  if(state.loaded&&!force){render();return}
  state.loading=true;state.error='';render();
  try{
    const r=await fetch(API+'?path='+encodeURIComponent('/admin/analytics-bootstrap'),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
    let j={};try{j=await r.json()}catch(_){ }
    if(!r.ok||j?.ok===false)throw new Error(String(j?.code||'HTTP_'+r.status));
    const data=j?.data||{};
    const incoming=dedupeRows(Array.isArray(data.marketNewsFeed)?data.marketNewsFeed.slice():[]);
    incoming.sort((a,b)=>String(timestamp(b)).localeCompare(String(timestamp(a))));
    const fingerprint=rowsFingerprint(incoming);
    if(!state.loaded||fingerprint!==state.fingerprint){state.rows=incoming;state.fingerprint=fingerprint}
    state.loaded=true;state.updatedAt=new Date().toISOString();
  }catch(err){
    state.error=String(err?.message||err||'MARKET_NEWS_LOAD_FAILED');
    state.loaded=true;
  }finally{
    state.loading=false;render();
  }
}
function isActive(){return Boolean(page()?.classList.contains('active')||document.documentElement.dataset.ronaAdminPage==='market-news')}
function refreshIfDue(){
  if(document.visibilityState!=='visible'||!isActive())return;
  const last=Date.parse(state.updatedAt||'');
  if(!last||Date.now()-last>=AUTO_REFRESH_MS)loadData(true);
}
function startAutoRefresh(){if(autoRefreshTimer)return;autoRefreshTimer=setInterval(refreshIfDue,AUTO_REFRESH_MS)}
function activate(){ensureRoot();startAutoRefresh();loadData(true)}
window.addEventListener('focus',refreshIfDue);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshIfDue()});
window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')==='market-news')activate()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{if(page()?.classList.contains('active')||document.documentElement.dataset.ronaAdminPage==='market-news')activate()},{once:true});
else if(page()?.classList.contains('active')||document.documentElement.dataset.ronaAdminPage==='market-news')activate();
})();