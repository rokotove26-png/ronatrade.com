const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_STICKY_SECTION_TITLES__)return;
window.__RONA_STICKY_SECTION_TITLES__='20260827-analytics-hero-exempt-v2';
function q(s,r){return(r||document).querySelector(s)}
function qa(s,r){return Array.from((r||document).querySelectorAll(s))}
function norm(v){return String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU')}
function ensureStyle(){
  if(q('#ronaStickySectionTitlesStyle'))return;
  var s=document.createElement('style');
  s.id='ronaStickySectionTitlesStyle';
  s.textContent='.rona-global-sticky-title{position:sticky!important;top:var(--rona-sticky-title-top,0px)!important;z-index:2147481200!important;display:flex!important;align-items:center!important;min-height:48px!important;box-sizing:border-box!important;margin:0 0 14px!important;padding:10px 14px!important;border:1px solid var(--line-soft,rgba(255,255,255,.14))!important;border-radius:12px!important;background:rgba(6,18,31,.94)!important;-webkit-backdrop-filter:blur(12px) saturate(120%);backdrop-filter:blur(12px) saturate(120%);box-shadow:0 8px 24px rgba(0,0,0,.16)!important}.rona-global-sticky-title .rona-global-sticky-title-text{font-size:22px!important;font-weight:850!important;line-height:1.2!important;letter-spacing:.01em!important;color:inherit!important}.rona-global-sticky-title.rona-owner-original-hidden,.rona-global-sticky-title.rona-claims-r2-hidden,.rona-global-sticky-title.rona-owner-hide{display:flex!important;visibility:visible!important;opacity:1!important}.rona-global-title-duplicate,.rona-global-title-duplicate-heading{display:none!important}@media(max-width:720px){.rona-global-sticky-title{min-height:44px!important;padding:9px 12px!important;margin-bottom:10px!important}.rona-global-sticky-title .rona-global-sticky-title-text{font-size:19px!important}}';
  document.head.appendChild(s);
}
function buttonLabel(b){
  if(!b)return'';
  var c=b.cloneNode(true);
  qa('.rona-owner-attention-badge,[aria-hidden="true"],svg,img',c).forEach(function(n){n.remove()});
  var l=q('.label',c),t=String(l?l.textContent:c.textContent||'').replace(/\s+/g,' ').trim();
  return t.replace(/^[^A-Za-zА-Яа-яЁё0-9]+/,'').trim();
}
function scrollParent(el){
  var p=el&&el.parentElement;
  while(p&&p!==document.body&&p!==document.documentElement){
    var cs=getComputedStyle(p),oy=String(cs.overflowY||'');
    if(/auto|scroll|overlay/.test(oy)&&p.scrollHeight>p.clientHeight+2)return p;
    p=p.parentElement;
  }
  return document.scrollingElement||document.documentElement;
}
function topOffset(page){
  var sp=scrollParent(page);
  if(sp!==document.scrollingElement&&sp!==document.documentElement&&sp!==document.body)return 0;
  var best=0;
  qa('header,[role="banner"],.topbar,.toolbar,.app-header,.header').forEach(function(n){
    var cs=getComputedStyle(n),r=n.getBoundingClientRect(),pos=String(cs.position||'');
    if((pos!=='fixed'&&pos!=='sticky')||r.width<window.innerWidth*.45||r.height<=0||r.height>140||r.top>4||r.bottom<=0)return;
    if(r.bottom>best)best=r.bottom;
  });
  return Math.max(0,Math.round(best));
}
function ensureTitle(pageId,title){
  var page=q('#page-'+pageId);if(!page||!title)return;
  if(pageId==='analytics'){
    var stale=q(':scope > .rona-global-sticky-title',page);if(stale)stale.remove();
    qa('.rona-global-title-duplicate',page).forEach(function(n){n.classList.remove('rona-global-title-duplicate')});
    qa('.rona-global-title-duplicate-heading',page).forEach(function(n){n.classList.remove('rona-global-title-duplicate-heading')});
    return;
  }
  var bar=q(':scope > .rona-global-sticky-title',page);
  if(!bar){
    bar=document.createElement('div');bar.className='rona-global-sticky-title';bar.dataset.page=pageId;
    var text=document.createElement('div');text.className='rona-global-sticky-title-text';bar.appendChild(text);
    var host=q(':scope > .rona-owner-page-content',page),root=q(':scope > .rona-claims-r2-root',page),before=host||root||page.firstElementChild;
    if(before)page.insertBefore(bar,before);else page.appendChild(bar);
  }
  var text=q('.rona-global-sticky-title-text',bar);if(text&&text.textContent!==title)text.textContent=title;
  bar.classList.remove('rona-owner-original-hidden','rona-claims-r2-hidden','rona-owner-hide');
  bar.style.setProperty('--rona-sticky-title-top',topOffset(page)+'px');
  var target=norm(title);
  qa('.rona-visual-hero',page).forEach(function(hero){
    if(hero===bar||hero.closest('.rona-global-sticky-title'))return;
    var t=q('.rona-visual-title',hero);if(t&&norm(t.textContent)===target)hero.classList.add('rona-global-title-duplicate');
  });
  qa('h1,h2',page).forEach(function(h){
    if(h.closest('.rona-global-sticky-title'))return;
    if(norm(h.textContent)===target)h.classList.add('rona-global-title-duplicate-heading');
  });
}
function visibleButtons(){
  var nav=q('#nav');if(!nav)return[];
  return qa('button[data-page]',nav).filter(function(b){
    if(b.getAttribute('aria-hidden')==='true'||b.classList.contains('rona-owner-nav-hide'))return false;
    var cs=getComputedStyle(b);return cs.display!=='none'&&cs.visibility!=='hidden'&&cs.opacity!=='0';
  });
}
function applyAll(){
  ensureStyle();
  visibleButtons().forEach(function(b){var id=String(b.dataset.page||''),title=buttonLabel(b);if(id&&title)ensureTitle(id,title)});
}
var queued=false;
function applySoon(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;applyAll()})}
function schedule(){applySoon();setTimeout(applyAll,120);setTimeout(applyAll,700)}
function bind(){
  applyAll();
  if(document.__ronaStickyTitlesBound)return;document.__ronaStickyTitlesBound=true;
  document.addEventListener('click',function(ev){var t=ev.target;if(!t||!t.closest)return;if(t.closest('#nav button[data-page]')||t.closest('[id^="page-"]'))schedule()},true);
  document.addEventListener('change',function(ev){var t=ev.target;if(t&&t.closest&&t.closest('[id^="page-"]'))schedule()},true);
  window.addEventListener('rona:finance-sync',schedule);
  window.addEventListener('resize',applySoon,{passive:true});
}
var tries=0;(function wait(){if(window.__RONA_OWNER_ADMIN_READY__===true){bind();return}tries++;if(tries<1200)setTimeout(wait,100)})();
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-sticky-titles':'v2-analytics-hero-exempt'}})}