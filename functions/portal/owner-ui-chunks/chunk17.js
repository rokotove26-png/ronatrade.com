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
  s.textContent=[
    '#page-market-news> :not(.rona-owner-page-content){display:none!important}',
    '#page-market-news .rona-owner-page-content{box-sizing:border-box;width:min(100%,1480px)!important;max-width:1480px!important;margin:0 auto!important;padding:28px 32px 54px!important;gap:0!important;align-content:start!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;background:#f3efe7!important;color:#11151a!important;border-left:1px solid rgba(17,21,26,.08)!important;border-right:1px solid rgba(17,21,26,.08)!important;box-shadow:0 18px 70px rgba(0,0,0,.22)!important}',
    '#page-market-news .rona-news-hero{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:22px!important;align-items:end!important;width:100%!important;margin:0!important;padding:0 0 20px!important;border:0!important;border-bottom:4px solid #c61f2f!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}',
    '#page-market-news .rona-news-brand{display:block!important;margin:0 0 11px!important;color:#c61f2f!important;font:900 11px/1.1 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.18em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-title{margin:0!important;color:#11151a!important;font:800 clamp(38px,4.2vw,64px)/.98 Georgia,Times New Roman,serif!important;letter-spacing:-.045em!important;text-transform:none!important;text-shadow:none!important}',
    '#page-market-news .rona-news-deck{max-width:870px!important;margin:12px 0 0!important;color:#4b5359!important;font:500 15px/1.55 Inter,Segoe UI,Arial,sans-serif!important}',
    '#page-market-news .rona-news-edition{align-self:start!important;padding-top:4px!important;color:#5e666b!important;text-align:right!important;font:800 10px/1.45 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.1em!important;text-transform:uppercase!important;white-space:nowrap!important}',
    '#page-market-news .rona-news-filter{display:grid!important;grid-template-columns:minmax(0,1fr) auto auto auto!important;gap:10px!important;align-items:center!important;min-height:58px!important;padding:10px 0!important;border-bottom:1px solid #b9b4ab!important;background:transparent!important}',
    '#page-market-news .rona-news-filter-context{min-width:0!important;color:#11151a!important;font:850 11px/1.35 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-filter-context span{color:#76726b!important;font-weight:650!important;letter-spacing:0!important;text-transform:none!important}',
    '#page-market-news .rona-news-filter-label{font:800 10px/1.2 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#5f625f!important}',
    '#page-market-news .rona-news-date-input{box-sizing:border-box;min-width:168px!important;height:38px!important;padding:0 10px!important;border:1px solid #a9a49b!important;border-radius:0!important;background:#faf8f3!important;color:#11151a!important;font:750 12px/1 Inter,Segoe UI,Arial,sans-serif!important;color-scheme:light!important;outline:none!important;box-shadow:none!important}',
    '#page-market-news .rona-news-date-input:focus{border-color:#c61f2f!important;box-shadow:0 0 0 2px rgba(198,31,47,.08)!important}',
    '#page-market-news .rona-news-filter-reset{appearance:none!important;height:38px!important;padding:0 12px!important;border:1px solid #11151a!important;border-radius:0!important;background:#11151a!important;color:#fff!important;font:850 10px/1 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.06em!important;text-transform:uppercase!important;cursor:pointer!important}',
    '#page-market-news .rona-news-filter-reset:disabled{border-color:#c9c4bb!important;background:#ddd8cf!important;color:#9a958d!important;cursor:default!important}',
    '#page-market-news .rona-news-front{display:grid!important;grid-template-columns:minmax(0,2.08fr) minmax(320px,.92fr)!important;gap:34px!important;padding:28px 0 30px!important;border-bottom:1px solid #8d8982!important}',
    '#page-market-news .rona-news-lead{appearance:none!important;display:block!important;width:100%!important;min-width:0!important;padding:0 32px 0 0!important;border:0!important;border-right:1px solid #b9b4ab!important;background:transparent!important;color:#11151a!important;text-align:left!important;cursor:pointer!important;font:inherit!important}',
    '#page-market-news .rona-news-story-kicker{display:block!important;margin:0 0 10px!important;color:#c61f2f!important;font:900 10px/1.2 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.12em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-story-meta{display:block!important;margin:0 0 10px!important;color:#6f716e!important;font:750 10px/1.35 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.035em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-lead-title{display:block!important;max-width:1040px!important;color:#101317!important;font:800 clamp(34px,3.8vw,54px)/1.04 Georgia,Times New Roman,serif!important;letter-spacing:-.035em!important}',
    '#page-market-news .rona-news-lead-excerpt{display:block!important;max-width:930px!important;margin-top:16px!important;color:#444b50!important;font:500 15px/1.62 Inter,Segoe UI,Arial,sans-serif!important}',
    '#page-market-news .rona-news-read{display:inline-flex!important;margin-top:18px!important;padding-bottom:3px!important;border-bottom:2px solid #c61f2f!important;color:#11151a!important;font:900 10px/1.2 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-rail{min-width:0!important}',
    '#page-market-news .rona-news-section-title{margin:0 0 4px!important;padding:0 0 10px!important;border-bottom:3px solid #11151a!important;color:#11151a!important;font:900 11px/1.2 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.13em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-rail-item{appearance:none!important;display:block!important;width:100%!important;padding:15px 0 16px!important;border:0!important;border-bottom:1px solid #c4bfb6!important;background:transparent!important;color:#11151a!important;text-align:left!important;cursor:pointer!important;font:inherit!important}',
    '#page-market-news .rona-news-rail-item:last-child{border-bottom:0!important}',
    '#page-market-news .rona-news-rail-meta{display:block!important;margin-bottom:6px!important;color:#77736d!important;font:750 9px/1.3 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.03em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-rail-title{display:block!important;color:#11151a!important;font:750 19px/1.2 Georgia,Times New Roman,serif!important;letter-spacing:-.012em!important}',
    '#page-market-news .rona-news-more{padding:28px 0 0!important}',
    '#page-market-news .rona-news-more-head{display:flex!important;align-items:end!important;justify-content:space-between!important;gap:20px!important;margin-bottom:0!important;padding-bottom:10px!important;border-bottom:3px solid #11151a!important}',
    '#page-market-news .rona-news-more-head h2{margin:0!important;color:#11151a!important;font:900 11px/1.2 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.13em!important;text-transform:uppercase!important}',
    '#page-market-news .rona-news-more-count{color:#76726b!important;font:750 10px/1.2 Inter,Segoe UI,Arial,sans-serif!important}',
    '#page-market-news .rona-news-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;column-gap:34px!important}',
    '#page-market-news .rona-news-card{appearance:none!important;display:block!important;width:100%!important;min-width:0!important;padding:21px 0 22px!important;border:0!important;border-bottom:1px solid #c4bfb6!important;background:transparent!important;color:#11151a!important;text-align:left!important;cursor:pointer!important;font:inherit!important}',
    '#page-market-news .rona-news-card:nth-child(odd){padding-right:18px!important;border-right:1px solid #d2cdc4!important}',
    '#page-market-news .rona-news-card:nth-child(even){padding-left:0!important}',
    '#page-market-news .rona-news-card-title{display:block!important;color:#11151a!important;font:750 23px/1.18 Georgia,Times New Roman,serif!important;letter-spacing:-.018em!important}',
    '#page-market-news .rona-news-card-excerpt{display:block!important;margin-top:9px!important;color:#555b5f!important;font:500 12.5px/1.55 Inter,Segoe UI,Arial,sans-serif!important}',
    '#page-market-news .rona-news-empty{padding:60px 0!important;border-bottom:1px solid #b9b4ab!important;color:#5c615f!important;font:650 14px/1.6 Inter,Segoe UI,Arial,sans-serif!important}',
    '#page-market-news button:focus-visible{outline:2px solid #c61f2f!important;outline-offset:4px!important}',
    '@media(hover:hover) and (pointer:fine){#page-market-news .rona-news-lead:hover .rona-news-lead-title,#page-market-news .rona-news-rail-item:hover .rona-news-rail-title,#page-market-news .rona-news-card:hover .rona-news-card-title{color:#a81725!important}#page-market-news .rona-news-filter-reset:not(:disabled):hover{background:#c61f2f!important;border-color:#c61f2f!important}}',
    '.rona-news-dialog{box-sizing:border-box;width:min(900px,calc(100% - 36px))!important;max-height:88vh!important;overflow:auto!important;border:0!important;border-top:5px solid #c61f2f!important;border-radius:0!important;background:#f5f1e9!important;color:#11151a!important;padding:0!important;box-shadow:0 30px 100px rgba(0,0,0,.48)!important}',
    '.rona-news-dialog::backdrop{background:rgba(2,6,10,.78)!important;backdrop-filter:blur(4px)!important}',
    '.rona-news-dialog-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:24px!important;padding:30px 34px 20px!important;border-bottom:1px solid #b9b4ab!important}',
    '.rona-news-dialog-kicker{display:block!important;margin:0 0 9px!important;color:#c61f2f!important;font:900 10px/1.2 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.15em!important;text-transform:uppercase!important}',
    '.rona-news-dialog-title{margin:0!important;color:#11151a!important;font:800 clamp(28px,4vw,44px)/1.08 Georgia,Times New Roman,serif!important;letter-spacing:-.025em!important}',
    '.rona-news-dialog-close{appearance:none!important;flex:0 0 auto!important;width:40px!important;height:40px!important;border:1px solid #11151a!important;border-radius:0!important;background:transparent!important;color:#11151a!important;cursor:pointer!important;font:500 24px/1 Inter,Segoe UI,Arial,sans-serif!important}',
    '.rona-news-dialog-meta{padding:15px 34px 0!important;color:#6c6f6c!important;font:800 10px/1.35 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.04em!important;text-transform:uppercase!important}',
    '.rona-news-dialog-body{padding:22px 34px 28px!important;white-space:pre-wrap!important;color:#252a2d!important;font:500 16px/1.72 Georgia,Times New Roman,serif!important}',
    '.rona-news-dialog-actions{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;padding:0 34px 32px!important}',
    '.rona-news-source-link{display:inline-flex!important;align-items:center!important;min-height:42px!important;padding:0 14px!important;border:1px solid #11151a!important;border-radius:0!important;background:#11151a!important;color:#fff!important;text-decoration:none!important;font:850 10px/1 Inter,Segoe UI,Arial,sans-serif!important;letter-spacing:.06em!important;text-transform:uppercase!important}',
    '.rona-news-source-link:hover{background:#c61f2f!important;border-color:#c61f2f!important}.rona-news-source-link:focus-visible,.rona-news-dialog-close:focus-visible{outline:2px solid #c61f2f!important;outline-offset:3px!important}',
    '@media(max-width:1050px){#page-market-news .rona-owner-page-content{padding:24px 24px 44px!important}#page-market-news .rona-news-front{grid-template-columns:minmax(0,1.7fr) minmax(280px,.9fr)!important;gap:26px!important}#page-market-news .rona-news-lead{padding-right:24px!important}#page-market-news .rona-news-lead-title{font-size:clamp(31px,4vw,46px)!important}}',
    '@media(max-width:820px){#page-market-news .rona-owner-page-content{padding:20px 18px 38px!important}#page-market-news .rona-news-hero{grid-template-columns:1fr!important}#page-market-news .rona-news-edition{text-align:left!important}#page-market-news .rona-news-filter{grid-template-columns:1fr auto auto!important}#page-market-news .rona-news-filter-context{grid-column:1/-1!important}#page-market-news .rona-news-front{grid-template-columns:1fr!important;gap:24px!important}#page-market-news .rona-news-lead{padding:0 0 25px!important;border-right:0!important;border-bottom:1px solid #b9b4ab!important}#page-market-news .rona-news-grid{grid-template-columns:1fr!important}#page-market-news .rona-news-card:nth-child(odd){padding-right:0!important;border-right:0!important}#page-market-news .rona-news-card:nth-child(even){padding-left:0!important}}',
    '@media(max-width:560px){#page-market-news .rona-owner-page-content{padding:16px 14px 30px!important}#page-market-news .rona-news-title{font-size:36px!important}#page-market-news .rona-news-deck{font-size:13px!important}#page-market-news .rona-news-filter{grid-template-columns:1fr auto!important}#page-market-news .rona-news-filter-label{grid-column:1/-1!important}#page-market-news .rona-news-date-input{min-width:0!important;width:100%!important}#page-market-news .rona-news-filter-reset{padding:0 9px!important}#page-market-news .rona-news-lead-title{font-size:32px!important}#page-market-news .rona-news-lead-excerpt{font-size:13.5px!important}#page-market-news .rona-news-card-title{font-size:21px!important}.rona-news-dialog{width:calc(100% - 18px)!important}.rona-news-dialog-head{padding:22px 20px 16px!important}.rona-news-dialog-meta{padding:13px 20px 0!important}.rona-news-dialog-body{padding:18px 20px 22px!important;font-size:15px!important}.rona-news-dialog-actions{padding:0 20px 22px!important}.rona-news-source-link{width:100%!important;justify-content:center!important}}'
  ].join('');
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
function sourceName(x){return String(x?.source_name||'RONA Market Intelligence').replace(/\s+/g,' ').trim()||'RONA Market Intelligence'}
function newsExcerpt(x,max){const s=String(x?.content_text||'').replace(/\s+/g,' ').trim();const n=Number(max)||220;if(!s)return'';return s.length>n?s.slice(0,n).trimEnd()+'…':s}
function newsMeta(x){return newsDate(x)+' · '+sourceName(x)}

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
  const titleWrap=e('div',{},e('span',{class:'rona-news-dialog-kicker',text:'RONA TRADE · MARKET INTELLIGENCE'}),e('h2',{class:'rona-news-dialog-title',text:x?.headline||'Новость'}));
  const close=e('button',{type:'button',class:'rona-news-dialog-close','aria-label':'Закрыть',text:'×',onclick:()=>d.close()});
  const head=e('div',{class:'rona-news-dialog-head'},titleWrap,close);
  const meta=e('div',{class:'rona-news-dialog-meta',text:newsMeta(x)});
  const body=e('div',{class:'rona-news-dialog-body',text:String(x?.content_text||'')});
  const actions=e('div',{class:'rona-news-dialog-actions'});
  const url=safeSourceUrl(x?.source_url);
  if(url)actions.append(e('a',{class:'rona-news-source-link',href:url,target:'_blank',rel:'noopener noreferrer',text:'Открыть первоисточник · '+sourceName(x)}));
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

function leadStory(x){
  return e('button',{type:'button',class:'rona-news-lead',onclick:()=>openNews(x)},
    e('span',{class:'rona-news-story-kicker',text:'Главная новость'}),
    e('span',{class:'rona-news-story-meta',text:newsMeta(x)}),
    e('span',{class:'rona-news-lead-title',text:x?.headline||'Новость'}),
    newsExcerpt(x,430)?e('span',{class:'rona-news-lead-excerpt',text:newsExcerpt(x,430)}):null,
    e('span',{class:'rona-news-read',text:'Читать материал'})
  );
}
function railStory(x){
  return e('button',{type:'button',class:'rona-news-rail-item',onclick:()=>openNews(x)},
    e('span',{class:'rona-news-rail-meta',text:newsMeta(x)}),
    e('span',{class:'rona-news-rail-title',text:x?.headline||'Новость'})
  );
}
function gridStory(x){
  return e('button',{type:'button',class:'rona-news-card',onclick:()=>openNews(x)},
    e('span',{class:'rona-news-story-meta',text:newsMeta(x)}),
    e('span',{class:'rona-news-card-title',text:x?.headline||'Новость'}),
    newsExcerpt(x,210)?e('span',{class:'rona-news-card-excerpt',text:newsExcerpt(x,210)}):null
  );
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
  host.dataset.ronaMarketNewsEditorial='v4';
  host.dataset.ronaMarketNewsSignature=signature;

  const hero=e('header',{class:'rona-news-hero','data-rona-news-canonical':'v3','data-rona-news-editorial':'v4'},
    e('div',{},
      e('span',{class:'rona-news-brand',text:'RONA TRADE · MARKET INTELLIGENCE'}),
      e('h1',{class:'rona-visual-title rona-news-title',text:'Новости топливного рынка СНГ'}),
      e('p',{class:'rona-news-deck',text:'Факты рынка, поставки, производство, логистика и торговые события — в редакционной ленте RONA Trade.'})
    ),
    e('div',{class:'rona-news-edition',text:'MARKET DESK · CIS ENERGY'})
  );

  const filter=e('div',{class:'rona-news-filter','aria-label':'Фильтр новостей по дате'});
  const context=e('div',{class:'rona-news-filter-context'},document.createTextNode('Лента рынка · '+String(xs.length)+' материалов '),e('span',{text:marketNewsDateFilter?'· выбранная дата':'· актуальный выпуск'}));
  const label=e('label',{class:'rona-news-filter-label',for:'ronaMarketNewsDate',text:'Дата'});
  const input=e('input',{id:'ronaMarketNewsDate',class:'rona-news-date-input',type:'date',value:marketNewsDateFilter,'aria-label':'Выберите дату новости'});
  input.addEventListener('change',()=>{marketNewsDateFilter=String(input.value||'');renderMarketNews()});
  const reset=e('button',{type:'button',class:'rona-news-filter-reset',disabled:!marketNewsDateFilter,text:'Сбросить',onclick:()=>{marketNewsDateFilter='';renderMarketNews()}});
  filter.append(context,label,input,reset);

  const content=e('main',{class:'rona-news-content','aria-label':'Новости топливного рынка СНГ'});
  if(!xs.length){
    const emptyText=!marketNewsLoaded?'Загрузка актуальной редакционной ленты…':marketNewsDateFilter?'За выбранную дату материалов нет.':'Материалов нет.';
    content.append(e('div',{class:'rona-news-empty',text:emptyText}));
  }else{
    const front=e('section',{class:'rona-news-front','aria-label':'Главные новости'});
    front.append(leadStory(xs[0]));
    const rail=e('aside',{class:'rona-news-rail'},e('h2',{class:'rona-news-section-title',text:'Последнее'}));
    for(const x of xs.slice(1,5))rail.append(railStory(x));
    if(xs.length===1)rail.append(e('div',{class:'rona-news-empty',text:'Других материалов в выбранной ленте нет.'}));
    front.append(rail);
    content.append(front);
    if(xs.length>5){
      const more=e('section',{class:'rona-news-more','aria-label':'Все материалы'});
      const head=e('div',{class:'rona-news-more-head'},e('h2',{text:'Все материалы'}),e('span',{class:'rona-news-more-count',text:String(xs.length-5)+' в ленте'}));
      const grid=e('div',{class:'rona-news-grid'});
      for(const x of xs.slice(5))grid.append(gridStory(x));
      more.append(head,grid);
      content.append(more);
    }
  }
  host.replaceChildren(hero,filter,content);
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
