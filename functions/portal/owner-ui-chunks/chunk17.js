export default `(function(){
'use strict';
if(window.__RONA_OWNER_MARKET_NEWS_CANONICAL_V1__)return;
window.__RONA_OWNER_MARKET_NEWS_CANONICAL_V1__=true;

function installMarketNewsStyle(){
  if(q('#ronaMarketNewsCanonicalStyle'))return;
  const s=e('style',{id:'ronaMarketNewsCanonicalStyle'});
  s.textContent='#page-market-news .rona-owner-page-content{display:grid!important;gap:16px!important}#page-market-news .rona-news-hero{margin:0!important}#page-market-news .rona-news-hero .rona-visual-title{margin:0!important}#page-market-news .rona-news-feed{padding:0!important;overflow:hidden!important;margin:0!important}#page-market-news .rona-news-item{appearance:none;width:100%;display:grid;grid-template-columns:148px minmax(0,1fr) 28px;gap:18px;align-items:center;text-align:left;background:transparent;color:var(--rv-text,currentColor);border:0;border-bottom:1px solid var(--rv-border2,var(--line-soft,rgba(255,255,255,.12)));padding:18px 22px;cursor:pointer;font:inherit}#page-market-news .rona-news-item:last-child{border-bottom:0}#page-market-news .rona-news-item:focus-visible{outline:2px solid var(--rv-accent,currentColor);outline-offset:-3px}#page-market-news .rona-news-date{font-size:12px;line-height:1.35;font-weight:700;color:var(--rv-muted,rgba(255,255,255,.66));font-variant-numeric:tabular-nums}#page-market-news .rona-news-headline{min-width:0;font-size:15px;line-height:1.45;font-weight:800;color:var(--rv-text,currentColor)}#page-market-news .rona-news-chevron{font-size:22px;line-height:1;color:var(--rv-accent,currentColor);text-align:right}#page-market-news .rona-news-loading{padding:22px;color:var(--rv-muted,rgba(255,255,255,.66));font-size:13px}.rona-news-dialog{box-sizing:border-box;width:min(820px,calc(100% - 32px));max-height:84%;overflow:auto;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));border-radius:18px;background:var(--rv-card,#15171c);color:var(--rv-text,#f6f7f9);padding:0;box-shadow:0 24px 80px rgba(0,0,0,.38)}.rona-news-dialog::backdrop{background:rgba(4,6,10,.72);backdrop-filter:blur(3px)}.rona-news-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:22px 24px 14px;border-bottom:1px solid var(--rv-border2,var(--line-soft,rgba(255,255,255,.12)))}.rona-news-dialog-title{margin:0;font-size:21px;line-height:1.35;font-weight:850}.rona-news-dialog-close{appearance:none;flex:0 0 auto;width:40px;height:40px;border-radius:12px;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:22px;line-height:1}.rona-news-dialog-meta{padding:14px 24px 0;color:var(--rv-muted,rgba(255,255,255,.66));font-size:12px;font-weight:700}.rona-news-dialog-body{padding:18px 24px 22px;white-space:pre-wrap;font-size:15px;line-height:1.65}.rona-news-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:0 24px 24px}.rona-news-source-link{display:inline-flex;align-items:center;min-height:42px;padding:0 14px;border-radius:11px;border:1px solid var(--rv-border2,var(--line,rgba(255,255,255,.18)));color:var(--rv-text,#f6f7f9);text-decoration:none;font-size:13px;font-weight:800}.rona-news-source-link:focus-visible,.rona-news-dialog-close:focus-visible{outline:2px solid var(--rv-accent,currentColor);outline-offset:2px}@media(hover:hover) and (pointer:fine){#page-market-news .rona-news-item:hover{background:rgba(255,255,255,.035)}.rona-news-source-link:hover,.rona-news-dialog-close:hover{background:rgba(255,255,255,.05)}}@media(max-width:700px){#page-market-news .rona-news-item{grid-template-columns:minmax(0,1fr) 24px;gap:8px 12px;padding:16px}.rona-news-date{grid-column:1}.rona-news-headline{grid-column:1}.rona-news-chevron{grid-column:2;grid-row:1 / span 2;align-self:center}.rona-news-dialog-head{padding:18px 18px 12px}.rona-news-dialog-title{font-size:18px}.rona-news-dialog-meta{padding:12px 18px 0}.rona-news-dialog-body{padding:16px 18px 18px}.rona-news-dialog-actions{padding:0 18px 18px;justify-content:stretch}.rona-news-source-link{width:100%;justify-content:center}}';
  document.head.appendChild(s);
}

function newsRows(){
  const xs=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__?.marketNewsFeed;
  return Array.isArray(xs)?xs:[];
}

function safeSourceUrl(v){
  try{
    const u=new URL(String(v||''));
    return u.protocol==='https:'||u.protocol==='http:'?u.href:'';
  }catch{return''}
}

function newsDate(x){
  const v=x?.source_published_at||x?.published_at||x?.prepared_at;
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

function renderMarketNews(){
  const p=page('market-news');
  if(!p)return false;
  installMarketNewsStyle();
  let host=q(':scope > .rona-owner-page-content',p);
  if(!host){
    replacePage('market-news',e('div'));
    host=q(':scope > .rona-owner-page-content',p);
    if(!host)return false;
  }
  const xs=newsRows();
  const signature=String(xs.length)+'|'+String(xs[0]?.publication_id||'')+'|'+String(xs[0]?.prepared_at||'');
  if(host.dataset.ronaMarketNewsCanonical==='v1'&&host.dataset.ronaMarketNewsSignature===signature&&q(':scope > .rona-news-hero',host))return true;
  host.dataset.ownerPage='market-news';
  host.dataset.ronaMarketNewsCanonical='v1';
  host.dataset.ronaMarketNewsSignature=signature;
  const hero=e('section',{class:'rona-visual-hero rona-news-hero','data-rona-news-canonical':'v1'},e('div',{},e('h1',{class:'rona-visual-title',text:'Новости топливного рынка СНГ'})));
  const feed=e('section',{class:'rona-owner-card rona-news-feed','aria-label':'Новости топливного рынка СНГ'});
  if(!xs.length){
    feed.append(e('div',{class:'rona-news-loading',text:'Загрузка…'}));
  }else{
    for(const x of xs){
      const b=e('button',{type:'button',class:'rona-news-item',onclick:()=>openNews(x)},e('span',{class:'rona-news-date',text:newsDate(x)}),e('span',{class:'rona-news-headline',text:x?.headline||'Новость'}),e('span',{class:'rona-news-chevron','aria-hidden':'true',text:'›'}));
      feed.append(b);
    }
  }
  host.replaceChildren(hero,feed);
  return true;
}

function watchMarketNews(){
  const p=page('market-news');
  if(!p)return false;
  if(!p.__ronaMarketNewsCanonicalObserver){
    const o=new MutationObserver(()=>queueMicrotask(renderMarketNews));
    o.observe(p,{childList:true,subtree:true});
    p.__ronaMarketNewsCanonicalObserver=o;
  }
  renderMarketNews();
  return true;
}

window.addEventListener('rona:ai-sync',()=>queueMicrotask(renderMarketNews));
let attempts=0;
const timer=setInterval(()=>{attempts++;if(watchMarketNews()||attempts>120)clearInterval(timer)},100);
queueMicrotask(watchMarketNews);
})();
`;
