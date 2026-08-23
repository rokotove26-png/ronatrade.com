const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_STICKY_SECTION_TITLES_V2__)return;
window.__RONA_STICKY_SECTION_TITLES_V2__='20260823-2305';
function q(s,r){return(r||document).querySelector(s)}
function qa(s,r){return Array.from((r||document).querySelectorAll(s))}
function norm(v){return String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU')}
function ensureStyle(){
  if(q('#ronaStickySectionTitlesStyleV2'))return;
  var s=document.createElement('style');
  s.id='ronaStickySectionTitlesStyleV2';
  s.textContent='.rona-global-sticky-slot{display:block!important;width:100%!important;box-sizing:border-box!important;margin:0 0 14px!important}.rona-global-sticky-title{position:relative!important;z-index:2147481200!important;display:flex!important;align-items:center!important;width:100%!important;min-height:48px!important;box-sizing:border-box!important;margin:0!important;padding:10px 14px!important;border:1px solid var(--line-soft,rgba(255,255,255,.14))!important;border-radius:12px!important;background:rgba(6,18,31,.96)!important;-webkit-backdrop-filter:blur(12px) saturate(120%);backdrop-filter:blur(12px) saturate(120%);box-shadow:0 8px 24px rgba(0,0,0,.16)!important}.rona-global-sticky-title.is-fixed{position:fixed!important;margin:0!important}.rona-global-sticky-title .rona-global-sticky-title-text{font-size:22px!important;font-weight:850!important;line-height:1.2!important;letter-spacing:.01em!important;color:inherit!important}.rona-global-sticky-slot.rona-owner-original-hidden,.rona-global-sticky-slot.rona-claims-r2-hidden,.rona-global-sticky-slot.rona-owner-hide,.rona-global-sticky-title.rona-owner-original-hidden,.rona-global-sticky-title.rona-claims-r2-hidden,.rona-global-sticky-title.rona-owner-hide{display:block!important;visibility:visible!important;opacity:1!important}.rona-global-sticky-title{display:flex!important}.rona-global-title-duplicate,.rona-global-title-duplicate-heading{display:none!important}@media(max-width:720px){.rona-global-sticky-slot{margin-bottom:10px!important}.rona-global-sticky-title{min-height:44px!important;padding:9px 12px!important}.rona-global-sticky-title .rona-global-sticky-title-text{font-size:19px!important}}';
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
    var cs=getComputedStyle(p),oy=String(cs.overflowY||''),o=String(cs.overflow||'');
    if(/auto|scroll|overlay/.test(oy)||/auto|scroll|overlay/.test(o))return p;
    p=p.parentElement;
  }
  return document.scrollingElement||document.documentElement;
}
function headerBottom(){
  var best=0;
  qa('header,[role="banner"],.topbar,.toolbar,.app-header,.header,#topbar,#header').forEach(function(n){
    var cs=getComputedStyle(n),r=n.getBoundingClientRect(),pos=String(cs.position||'');
    if((pos!=='fixed'&&pos!=='sticky')||r.width<window.innerWidth*.45||r.height<=0||r.height>160||r.top>6||r.bottom<=0)return;
    if(r.bottom>best)best=r.bottom;
  });
  return Math.max(0,Math.round(best));
}
function viewportFor(page){
  var sp=scrollParent(page),doc=sp===document.scrollingElement||sp===document.documentElement||sp===document.body;
  if(doc)return{sp:sp,top:headerBottom(),left:0,right:window.innerWidth,bottom:window.innerHeight};
  var r=sp.getBoundingClientRect();
  return{sp:sp,top:Math.max(0,Math.round(r.top)),left:Math.max(0,r.left),right:Math.min(window.innerWidth,r.right),bottom:Math.min(window.innerHeight,r.bottom)};
}
function isPageVisible(page){
  if(!page)return false;
  var cs=getComputedStyle(page),r=page.getBoundingClientRect();
  return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>2&&r.height>2&&r.bottom>0&&r.top<window.innerHeight;
}
function resetFixed(bar,slot){
  if(!bar)return;
  bar.classList.remove('is-fixed');
  bar.style.removeProperty('top');bar.style.removeProperty('left');bar.style.removeProperty('width');
  if(slot)slot.style.removeProperty('height');
}
function positionTitle(page){
  if(!page)return;
  var slot=q(':scope > .rona-global-sticky-slot',page),bar=slot&&q(':scope > .rona-global-sticky-title',slot);
  if(!slot||!bar||!isPageVisible(page)){resetFixed(bar,slot);return}
  var vp=viewportFor(page),sr=slot.getBoundingClientRect(),pr=page.getBoundingClientRect(),h=Math.max(44,bar.offsetHeight||48);
  var left=Math.max(pr.left,vp.left),right=Math.min(pr.right,vp.right),width=Math.max(0,right-left);
  var shouldFix=sr.top<=vp.top&&pr.bottom>vp.top+h+4&&vp.bottom>vp.top+h+4&&width>80;
  if(!shouldFix){resetFixed(bar,slot);return}
  if(!slot.style.height)slot.style.height=h+'px';
  bar.classList.add('is-fixed');
  bar.style.top=vp.top+'px';bar.style.left=Math.round(left)+'px';bar.style.width=Math.round(width)+'px';
}
function ensureTitle(pageId,title){
  var page=q('#page-'+pageId);if(!page||!title)return;
  var slot=q(':scope > .rona-global-sticky-slot',page),bar=slot&&q(':scope > .rona-global-sticky-title',slot);
  if(!slot){
    slot=document.createElement('div');slot.className='rona-global-sticky-slot';slot.dataset.page=pageId;
    bar=document.createElement('div');bar.className='rona-global-sticky-title';bar.dataset.page=pageId;
    var text=document.createElement('div');text.className='rona-global-sticky-title-text';bar.appendChild(text);slot.appendChild(bar);
    var host=q(':scope > .rona-owner-page-content',page),root=q(':scope > .rona-claims-r2-root',page),before=host||root||page.firstElementChild;
    if(before)page.insertBefore(slot,before);else page.appendChild(slot);
  }
  var text=q('.rona-global-sticky-title-text',bar);if(text&&text.textContent!==title)text.textContent=title;
  slot.classList.remove('rona-owner-original-hidden','rona-claims-r2-hidden','rona-owner-hide');
  bar.classList.remove('rona-owner-original-hidden','rona-claims-r2-hidden','rona-owner-hide');
  var target=norm(title);
  qa('.rona-visual-hero',page).forEach(function(hero){
    if(hero.closest('.rona-global-sticky-slot'))return;
    var t=q('.rona-visual-title',hero);if(t&&norm(t.textContent)===target)hero.classList.add('rona-global-title-duplicate');
  });
  qa('h1,h2',page).forEach(function(h){
    if(h.closest('.rona-global-sticky-slot'))return;
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
  qa('[id^="page-"]').forEach(positionTitle);
}
var queued=false;
function applySoon(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;applyAll()})}
function schedule(){applySoon();setTimeout(applyAll,80);setTimeout(applyAll,350)}
function bind(){
  applyAll();
  if(document.__ronaStickyTitlesV2Bound)return;document.__ronaStickyTitlesV2Bound=true;
  document.addEventListener('scroll',applySoon,true);
  window.addEventListener('scroll',applySoon,{passive:true});
  window.addEventListener('resize',applySoon,{passive:true});
  document.addEventListener('click',function(ev){var t=ev.target;if(!t||!t.closest)return;if(t.closest('#nav button[data-page]')||t.closest('[id^="page-"]'))schedule()},true);
  document.addEventListener('change',function(ev){var t=ev.target;if(t&&t.closest&&t.closest('[id^="page-"]'))schedule()},true);
  window.addEventListener('rona:finance-sync',schedule);
}
var tries=0;(function wait(){if(window.__RONA_OWNER_ADMIN_READY__===true){bind();return}tries++;if(tries<1200)setTimeout(wait,100)})();
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-sticky-titles':'v2-fixed-scroll'}})}
