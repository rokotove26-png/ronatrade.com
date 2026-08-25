export default `(function(){
'use strict';
if(window.__RONA_OWNER_MARKET_NEWS_CANONICAL_V3__)return;
window.__RONA_OWNER_MARKET_NEWS_CANONICAL_V3__=true;
const API='/portal/owner-api';
const q=(s,r=document)=>r.querySelector(s);
function e(tag,attrs={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='class')n.className=v;else if(k==='text')n.textContent=String(v);else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2).toLowerCase(),v);else if(v!==false&&v!==null&&v!==undefined)n.setAttribute(k,v===true?'':String(v))}for(const c of children.flat(Infinity)){if(c===null||c===undefined)continue;n.append(c?.nodeType?c:document.createTextNode(String(c)))}return n}
async function load(path){const r=await fetch(API+'?path='+encodeURIComponent(path),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});let j={};try{j=await r.json()}catch{}if(!r.ok||j?.ok===false){const err=new Error(String(j?.code||'HTTP_'+r.status));err.code=String(j?.code||'REQUEST_FAILED');throw err}return j?.data||{}}
let marketNewsData=[];
let marketNewsLoading=false;
let marketNewsLoaded=false;
let marketNewsDateFilter='';

function installMarketNewsStyle(){
  if(q('#ronaMarketNewsCanonicalStyleV3'))return;
  const s=e('style',{id:'ronaMarketNewsCanonicalStyleV3'});
  s.textContent='#page-market-news> :not(.rona-owner-page-content){display:none!important}#page-market-news .rona-owner-page-content{box-sizing:border-box;width:min(100%,1360px)!important;max-width:1360px!important;margin:0 auto!important;display:grid!important;gap:10px!important;align-content:start!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}#page-market-news .rona-news-hero{box-sizing:border-box;width:100%!important;margin:0!important;border-width:1px!important;border-radius:16px!important;overflow:hidden!important}#page-market-news .rona-news-hero .rona-visual-title{margin:0!important}#page-market-news .rona-news-filter{display:flex;align-items:center;justify-content:flex-end;gap:10px;min-height:42px;padding:0 2px}#page-market-news .rona-news-filter-label{font-size:13px;line-height:1.2;font-weight:800;color:var(--rv-text,#f6f7f9)}#page-market-news .rona-news-date-input{box-sizing:border-box;min-width:178px;min-height:40px;padding:0 12px;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));border-radius:10px;background:var(--rv-card,rgba(16,21,31,.78));color:var(--rv-text,#f6f7f9);font:inherit;font-size:14px;font-weight:750;color-scheme:dark;outline:none}#page-market-news .rona-news-date-input:focus{border-color:var(--rv-accent,#2397ff);box-shadow:0 0 0 2px rgba(35,151,255,.12)}#page-market-news .rona-news-filter-reset{appearance:none;min-height:40px;padding:0 13px;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));border-radius:10px;background:transparent;color:var(--rv-text,#f6f7f9);font:inherit;font-size:13px;font-weight:800;cursor:pointer}#page-market-news .rona-news-filter-reset:disabled{opacity:.42;cursor:default}#page-market-news .rona-news-feed{box-sizing:border-box;width:100%!important;padding:0!important;overflow:hidden!important;margin:0!important;border-width:1px!important;border-radius:14px!important}#page-market-news .rona-news-item{appearance:none;width:100%;display:grid;grid-template-columns:138px minmax(0,1fr) 22px;gap:16px;align-items:center;text-align:left;background:transparent;color:var(--rv-text,#f6f7f9);border:0;border-bottom:1px solid var(--rv-border2,var(--line-soft,rgba(255,255,255,.12)));padding:16px 18px;cursor:pointer;font:inherit}#page-market-news .rona-news-item:last-child{border-bottom:0}#page-market-news .rona-news-item:focus-visible{outline:2px solid var(--rv-accent,currentColor);outline-offset:-3px}#page-market-news .rona-news-date{font-size:13px;line-height:1.35;font-weight:750;color:var(--rv-text,#f6f7f9);font-variant-numeric:tabular-nums}#page-market-news .rona-news-headline{min-width:0;font-size:16px;line-height:1.45;font-weight:800;color:var(--rv-text,#f6f7f9)}#page-market-news .rona-news-chevron{font-size:20px;line-height:1;color:var(--rv-accent,currentColor);text-align:right}#page-market-news .rona-news-loading{padding:20px;color:var(--rv-text,#f6f7f9);font-size:14px;font-weight:650}.rona-news-dialog{box-sizing:border-box;width:min(820px,calc(100% - 32px));max-height:84%;overflow:auto;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));border-radius:18px;background:var(--rv-card,#15171c);color:var(--rv-text,#f6f7f9);padding:0;box-shadow:0 24px 80px rgba(0,0,0,.38)}.rona-news-dialog::backdrop{background:rgba(4,6,10,.72);backdrop-filter:blur(3px)}.rona-news-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px 14px;border-bottom:1px solid var(--rv-border2,var(--line-soft,rgba(255,255,255,.12)))}.rona-news-dialog-title{margin:0;font-size:22px;line-height:1.4;font-weight:850}.rona-news-dialog-close{appearance:none;flex:0 0 auto;width:40px;height:40px;border-radius:12px;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:22px;line-height:1}.rona-news-dialog-meta{padding:14px 24px 0;color:var(--rv-text,#f6f7f9);font-size:13px;font-weight:700}.rona-news-dialog-body{padding:18px 24px 22px;white-space:pre-wrap;font-size:16px;line-height:1.68}.rona-news-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:0 24px 24px}.rona-news-source-link{display:inline-flex;align-items:center;min-height:42px;padding:0 14px;border-radius:11px;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));color:var(--rv-text,#f6f7f9);text-decoration:none;font-size:13px;font-weight:800}.rona-news-source-link:focus-visible,.rona-news-dialog-close:focus-visible{outline:2px solid var(--rv-accent,currentColor);outline-offset:2px}@media(hover:hover) and (pointer:fine){#page-market-news .rona-news-item:hover{background:rgba(255,255,255,.045)}#page-market-news .rona-news-filter-reset:not(:disabled):hover,.rona-news-source-link:hover,.rona-news-dialog-close:hover{background:rgba(255,255,255,.05)}}@media(max-width:700px){#page-market-news .rona-owner-page-content{width:100%!important}#page-market-news .rona-news-filter{justify-content:stretch;display:grid;grid-template-columns:1fr auto;gap:8px}#page-market-news .rona-news-filter-label{grid-column:1 / -1}#page-market-news .rona-news-date-input{width:100%;min-width:0}#page-market-news .rona-news-item{grid-template-columns:minmax(0,1fr) 20px;gap:7px 10px;padding:15px 14px}.rona-news-date{grid-column:1;font-size:13px}.rona-news-headline{grid-column:1;font-size:15px;line-height:1.42}.rona-news-chevron{grid-column:2;grid-row:1 / span 2;align-self:center}.rona-news-dialog-head{padding:18px 18px 12px}.rona-news-dialog-title{font-size:20px}.rona-news-dialog-meta{padding:12px 18px 0;font-size:13px}.rona-news-dialog-body{padding:16px 18px 18px;font-size:15px}.rona-news-dialog-actions{padding:0 18px 18px;justify-content:stretch}.rona-news-source-link{width:100%;justify-content:center}}';
  document.head.appendChild(s);
}

function page(){return q('#page-market-news')}
function newsTimestamp(x){return x?.source_published_at||x?.published_at||x?.prepared_at||''}
function newsIsoDate(x){
  const v=newsTimestamp(x);
  if(!v)return'';
  const d=new Date(v);
  if(!Number.isFinite(d.getTime()))return'';
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function newsRows(){return marketNewsDateFilter?marketNewsData.filter(x=>newsIsoDate(x)===marketNewsDateFilter):marketNewsData}

async function refreshMarketNews(){
  if(marketNewsLoading)return;
  marketNewsLoading=true;
  try{
    const data=await load('/admin/analytics-bootstrap');
    marketNewsData=Array.isArray(data?.marketNewsFeed)?data.marketNewsFeed:[];
    marketNewsLoaded=true;
    window.__RONA_OWNER_MARKET_NEWS_SNAPSHOT__={generatedAt:data?.generatedAt||null,count:marketNewsData.length,news:marketNewsData};
    renderMarketNews();
  }catch(err){
    window.__RONA_OWNER_MARKET_NEWS_ERROR__=String(err?.code||err?.message||err);
  }finally{marketNewsLoading=false}
}

function safeSourceUrl(v){
  try{
    const u=new URL(String(v||''));
    return u.protocol==='https:'||u.protocol==='http:'?u.href:'';
  }catch{return''}
}

function newsDate(x){
  const v=newsTimestamp(x);
  if(!v)return'—';
  const d=new Date(v);
  return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}):String(v);
}

function dialogNode(){
  let d=q('#ronaMarketNewsDialog');
  if(d)return d;
  d=e('dialog',{id:'ronaMarketNewsDialog',class:'rona-news-dialog'});
  d.addEventListener('click',ev=>{if(ev.target===d)d.close()});
  document.body.appendChild(d);
  return d;
}

function openNews(x){
  const d=dialogNode();
  const title=e('h2',{class:'rona-news-dialog-title',text:x?.headline||'Новость'});
  const close=e('button',{type:'button',class:'rona-news-dialog-close','aria-label':'Закрыть',text:'×',onclick:()=>d.close()});
  const head=e('div',{class:'rona-news-dialog-head'},title,close);
  const meta=e('div',{class:'rona-news-dialog-meta',text:newsDate(x)});
  const body=e('div',{class:'rona-news-dialog-body',text:String(x?.content_text||'')});
  const actions=e('div',{class:'rona-news-dialog-actions'});
  const url=safeSourceUrl(x?.source_url);
  if(url){
    const sourceName=String(x?.source_name||'').trim();
    actions.append(e('a',{class:'rona-news-source-link',href:url,target:'_blank',rel:'noopener noreferrer',text:sourceName?'Перейти к источнику · '+sourceName:'Перейти к источнику'}));
  }
  d.replaceChildren(head,meta,body,actions);
  if(typeof d.showModal==='function')d.showModal();else d.setAttribute('open','');
}

function isolateMarketNewsPage(p,host){
  if(!p||!host)return;
  p.classList.remove('rona-rs-gated');
  for(const child of Array.from(p.children)){
    if(child===host){
      child.classList.remove('rona-owner-original-hidden');
      child.removeAttribute('aria-hidden');
      child.style.setProperty('display','grid','important');
      child.style.setProperty('visibility','visible','important');
      child.style.setProperty('opacity','1','important');
      child.style.setProperty('pointer-events','auto','important');
      continue;
    }
    child.classList.add('rona-owner-original-hidden');
    child.setAttribute('aria-hidden','true');
    child.style.setProperty('display','none','important');
    child.style.setProperty('visibility','hidden','important');
    child.style.setProperty('opacity','0','important');
    child.style.setProperty('pointer-events','none','important');
  }
}

function ownerHost(p){
  let host=q(':scope > .rona-owner-page-content[data-owner-page="market-news"]',p)||q('.rona-owner-page-content[data-owner-page="market-news"]',p)||q(':scope > .rona-owner-page-content',p);
  if(host&&host.parentElement!==p)p.appendChild(host);
  if(!host){
    host=e('div',{class:'rona-owner-page-content','data-owner-page':'market-news'});
    p.appendChild(host);
  }
  host.dataset.ownerPage='market-news';
  isolateMarketNewsPage(p,host);
  return host;
}

function renderMarketNews(){
  const p=page();
  if(!p)return false;
  installMarketNewsStyle();
  const host=ownerHost(p);
  const xs=newsRows();
  const signature=String(marketNewsData.length)+'|'+String(marketNewsData[0]?.publication_id||'')+'|'+String(marketNewsData[0]?.prepared_at||'')+'|'+String(marketNewsLoaded)+'|'+marketNewsDateFilter;
  isolateMarketNewsPage(p,host);
  if(host.dataset.ronaMarketNewsCanonical==='v3'&&host.dataset.ronaMarketNewsSignature===signature&&q(':scope > .rona-news-hero',host)&&q(':scope > .rona-news-filter',host))return true;
  host.dataset.ownerPage='market-news';
  host.dataset.ronaMarketNewsCanonical='v3';
  host.dataset.ronaMarketNewsSignature=signature;
  const hero=e('section',{class:'rona-visual-hero rona-news-hero','data-rona-news-canonical':'v3'},e('div',{},e('h1',{class:'rona-visual-title',text:'Новости топливного рынка СНГ'})));
  const filter=e('div',{class:'rona-news-filter','aria-label':'Фильтр новостей по дате'});
  const label=e('label',{class:'rona-news-filter-label',for:'ronaMarketNewsDate',text:'Дата новости'});
  const input=e('input',{id:'ronaMarketNewsDate',class:'rona-news-date-input',type:'date',value:marketNewsDateFilter,'aria-label':'Выберите дату новости'});
  input.addEventListener('change',()=>{marketNewsDateFilter=String(input.value||'');renderMarketNews()});
  const reset=e('button',{type:'button',class:'rona-news-filter-reset',disabled:!marketNewsDateFilter,text:'Сбросить',onclick:()=>{marketNewsDateFilter='';renderMarketNews()}});
  filter.append(label,input,reset);
  const feed=e('section',{class:'rona-owner-card rona-news-feed','aria-label':'Новости топливного рынка СНГ'});
  if(!xs.length){
    const emptyText=!marketNewsLoaded?'Загрузка…':marketNewsDateFilter?'За выбранную дату новостей нет.':'Новостей нет.';
    feed.append(e('div',{class:'rona-news-loading',text:emptyText}));
  }else{
    for(const x of xs){
      feed.append(e('button',{type:'button',class:'rona-news-item',onclick:()=>openNews(x)},e('span',{class:'rona-news-date',text:newsDate(x)}),e('span',{class:'rona-news-headline',text:x?.headline||'Новость'}),e('span',{class:'rona-news-chevron','aria-hidden':'true',text:'›'})));
    }
  }
  host.replaceChildren(hero,filter,feed);
  isolateMarketNewsPage(p,host);
  p.classList.remove('rona-owner-hide');
  return true;
}

function watchMarketNews(){
  const p=page();
  if(!p)return false;
  if(!p.__ronaMarketNewsCanonicalObserver){
    const o=new MutationObserver(()=>queueMicrotask(renderMarketNews));
    o.observe(p,{childList:true,subtree:true});
    p.__ronaMarketNewsCanonicalObserver=o;
  }
  renderMarketNews();
  if(!marketNewsLoaded&&!marketNewsLoading)refreshMarketNews();
  return true;
}

function bindMarketNewsOwnerGuard(){
  if(document.__ronaMarketNewsOwnerGuardV3)return;
  document.__ronaMarketNewsOwnerGuardV3=true;
  document.addEventListener('click',ev=>{
    const b=ev.target&&ev.target.closest&&ev.target.closest('#nav button[data-page]');
    if(!b||String(b.dataset.page||'')!=='market-news')return;
    [0,80,220,900,1900].forEach(ms=>setTimeout(renderMarketNews,ms));
  },true);
}

let attempts=0;
const timer=setInterval(()=>{attempts++;if(watchMarketNews()||attempts>120)clearInterval(timer)},100);
bindMarketNewsOwnerGuard();
setInterval(refreshMarketNews,60000);
queueMicrotask(()=>{watchMarketNews();refreshMarketNews()});
})();
`;
