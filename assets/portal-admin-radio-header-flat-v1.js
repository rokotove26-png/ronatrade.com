(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_HEADER_FLAT_V3__)return;
window.__RONA_ADMIN_RADIO_HEADER_FLAT_V3__=true;
const d=document,PAGE_ID='page-messages',STYLE_ID='rona-admin-radio-header-flat-v3-style';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();

function installStyle(){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
/* RADIO HEADER: deterministic flat treatment, no decorative sphere/glow */
#${PAGE_ID}.rona-radio-icc::before{
  content:none!important;
  display:none!important;
  background:none!important;
  background-image:none!important;
  box-shadow:none!important;
  filter:none!important;
}
#${PAGE_ID} > .rona-rs-root[data-kind="radio"]{
  background-image:none!important;
  filter:none!important;
}
#${PAGE_ID} > .rona-rs-root[data-kind="radio"]::before,
#${PAGE_ID} > .rona-rs-root[data-kind="radio"]::after{
  content:none!important;
  display:none!important;
  background:none!important;
  background-image:none!important;
  box-shadow:none!important;
  filter:none!important;
}
#${PAGE_ID} .icc-flat-radio-hero{
  position:relative!important;
  min-height:74px!important;
  padding:18px 22px!important;
  border:1px solid rgba(95,170,210,.16)!important;
  border-radius:18px!important;
  background:#07121e!important;
  background-color:#07121e!important;
  background-image:linear-gradient(180deg,rgba(7,18,30,.985),rgba(5,14,24,.985))!important;
  box-shadow:0 14px 34px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.02)!important;
  filter:none!important;
  backdrop-filter:none!important;
  overflow:hidden!important;
  isolation:isolate!important;
  clip-path:none!important;
  -webkit-mask:none!important;
  mask:none!important;
}
#${PAGE_ID} .icc-flat-radio-hero::before,
#${PAGE_ID} .icc-flat-radio-hero::after,
#${PAGE_ID} .icc-flat-radio-hero *::before,
#${PAGE_ID} .icc-flat-radio-hero *::after,
#${PAGE_ID} .icc-title-clean::before,
#${PAGE_ID} .icc-title-clean::after{
  content:none!important;
  display:none!important;
  background:none!important;
  background-image:none!important;
  box-shadow:none!important;
  filter:none!important;
  opacity:0!important;
}
/* No nested visual can paint a colored disc behind the title. */
#${PAGE_ID} .icc-flat-radio-hero *:not(.icc-flat-radio-title){
  background-image:none!important;
  box-shadow:none!important;
  filter:none!important;
  backdrop-filter:none!important;
  text-shadow:none!important;
  clip-path:none!important;
  -webkit-mask:none!important;
  mask:none!important;
}
#${PAGE_ID} .icc-flat-radio-hero svg,
#${PAGE_ID} .icc-flat-radio-hero canvas,
#${PAGE_ID} .icc-flat-radio-hero img,
#${PAGE_ID} .icc-flat-radio-hero [class*="orb" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="sphere" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="blob" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="glow" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="halo" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="planet" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="pulse" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="decor" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="flare" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="circle" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="spot" i],
#${PAGE_ID} .icc-header-decoration-off{
  display:none!important;
  visibility:hidden!important;
  opacity:0!important;
}
#${PAGE_ID} .icc-flat-radio-title{
  position:relative!important;
  z-index:20!important;
  margin:0!important;
  font-size:26px!important;
  line-height:1.06!important;
  font-weight:900!important;
  letter-spacing:-.04em!important;
  color:#f4f8fc!important;
  -webkit-text-fill-color:#f4f8fc!important;
  text-shadow:none!important;
  filter:none!important;
  background:none!important;
  background-image:none!important;
  box-shadow:none!important;
}
#${PAGE_ID} .icc-flat-radio-hero .rona-rs-sub,
#${PAGE_ID} .icc-flat-radio-hero [class*="sub" i]{
  position:relative!important;
  z-index:20!important;
  margin-top:6px!important;
  font-size:11px!important;
  line-height:1.45!important;
  color:#7e96a8!important;
  opacity:1!important;
  text-shadow:none!important;
  filter:none!important;
  background:transparent!important;
  background-image:none!important;
}
@media(max-width:620px){
  #${PAGE_ID} .icc-flat-radio-hero{min-height:66px!important;padding:15px 17px!important;border-radius:15px!important}
  #${PAGE_ID} .icc-flat-radio-title{font-size:23px!important}
}
`;
  d.head.appendChild(s);
}

function findTitle(page){
  const selectors='h1,h2,h3,h4,h5,h6,[class*="title"],[class*="Title"],div,span,p';
  return Array.from(page.querySelectorAll(selectors)).find(el=>norm(el.textContent)==='Радиорубка')||null;
}

function getRoot(page){
  return page.querySelector(':scope > .rona-rs-root[data-kind="radio"]')||page;
}

function chooseHero(title,root,page){
  if(!title)return null;
  const explicit=title.closest('.rf-hero,.rona-rs-head,.rona-rs-hero,[class*="hero" i],[class*="head" i]');
  if(explicit&&root.contains(explicit))return explicit;
  let node=title;
  while(node&&node.parentElement&&node.parentElement!==root)node=node.parentElement;
  if(node&&node.parentElement===root)return node;
  let n=title.parentElement,best=null;
  while(n&&n!==page&&n!==root){
    const r=n.getBoundingClientRect(),t=norm(n.textContent);
    if(r.height>=44&&r.height<=220&&t.includes('Радиорубка')&&t.length<600)best=n;
    n=n.parentElement;
  }
  return best||title.parentElement;
}

function cleanTitleChain(title,hero,root){
  let n=title.parentElement;
  while(n&&n!==root&&n!==hero){
    n.classList.add('icc-title-clean');
    n.style.setProperty('background','transparent','important');
    n.style.setProperty('background-image','none','important');
    n.style.setProperty('box-shadow','none','important');
    n.style.setProperty('filter','none','important');
    n.style.setProperty('backdrop-filter','none','important');
    n.style.setProperty('clip-path','none','important');
    n.style.setProperty('mask','none','important');
    n=n.parentElement;
  }
}

function overlaps(a,b,pad=52){
  return a.right>=b.left-pad&&a.left<=b.right+pad&&a.bottom>=b.top-pad&&a.top<=b.bottom+pad;
}

function killHeaderDecor(hero,title){
  if(!hero)return;
  const tr=title.getBoundingClientRect();
  const nameRe=/(orb|sphere|blob|glow|halo|planet|pulse|decor|flare|circle|spot|accent|aura)/i;
  for(const el of Array.from(hero.querySelectorAll('*'))){
    if(el===title||title.contains(el))continue;
    if(el.matches('input,select,textarea,button'))continue;
    const rect=el.getBoundingClientRect();
    if(!rect.width&&!rect.height)continue;
    const cs=getComputedStyle(el);
    const idClass=(el.id||'')+' '+(typeof el.className==='string'?el.className:'');
    const hasText=norm(el.textContent).length>0;
    const visualBg=String(cs.backgroundImage||'none')!=='none';
    const positioned=cs.position==='absolute'||cs.position==='fixed';
    const nearTitle=overlaps(rect,tr,60);
    const compactVisual=rect.width<=340&&rect.height<=240;
    const named=nameRe.test(idClass);
    if(named||(nearTitle&&compactVisual&&!hasText&&(visualBg||positioned||cs.filter!=='none'||cs.boxShadow!=='none'))){
      el.classList.add('icc-header-decoration-off');
      el.style.setProperty('display','none','important');
      continue;
    }
    if(nearTitle&&el.contains(title)){
      el.classList.add('icc-title-clean');
      el.style.setProperty('background-image','none','important');
      el.style.setProperty('box-shadow','none','important');
      el.style.setProperty('filter','none','important');
    }
  }
}

function apply(){
  const page=d.getElementById(PAGE_ID);if(!page)return;
  installStyle();
  const title=findTitle(page);if(!title)return;
  const root=getRoot(page);
  const hero=chooseHero(title,root,page);if(!hero||hero===page||hero===root)return;
  title.classList.add('icc-flat-radio-title');
  hero.classList.add('icc-flat-radio-hero');
  hero.dataset.ronaRadioHeader='cash-flat-v3';
  hero.style.setProperty('background','#07121e','important');
  hero.style.setProperty('background-image','linear-gradient(180deg,rgba(7,18,30,.985),rgba(5,14,24,.985))','important');
  hero.style.setProperty('box-shadow','0 14px 34px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.02)','important');
  hero.style.setProperty('filter','none','important');
  cleanTitleChain(title,hero,root);
  killHeaderDecor(hero,title);
}

installStyle();
let timer=0;
const schedule=()=>{clearTimeout(timer);timer=setTimeout(apply,25)};
function observe(){
  const page=d.getElementById(PAGE_ID);if(!page)return false;
  new MutationObserver(schedule).observe(page,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  apply();
  return true;
}
if(!observe()){
  const o=new MutationObserver(()=>{if(observe())o.disconnect()});
  o.observe(d.documentElement,{subtree:true,childList:true});
}
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')setTimeout(apply,20)});
[80,220,500,900,1500,2500].forEach(ms=>setTimeout(apply,ms));
})();