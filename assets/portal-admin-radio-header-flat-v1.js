(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_HEADER_FLAT_V2__)return;
window.__RONA_ADMIN_RADIO_HEADER_FLAT_V2__=true;
const d=document,PAGE_ID='page-messages',STYLE_ID='rona-admin-radio-header-flat-v2-style';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();

function installStyle(){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#${PAGE_ID} .icc-flat-radio-hero,
#${PAGE_ID} .rona-rs-root[data-kind="radio"] > .icc-flat-radio-hero,
#${PAGE_ID} .rf-hero{
  position:relative!important;
  min-height:74px!important;
  padding:18px 22px!important;
  border:1px solid rgba(95,170,210,.16)!important;
  border-radius:18px!important;
  background:#07121e!important;
  background-color:#07121e!important;
  background-image:linear-gradient(180deg,rgba(7,18,30,.98),rgba(5,14,24,.98))!important;
  box-shadow:0 14px 34px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.02)!important;
  filter:none!important;
  overflow:hidden!important;
  isolation:isolate!important;
}
#${PAGE_ID} .icc-flat-radio-hero::before,
#${PAGE_ID} .icc-flat-radio-hero::after,
#${PAGE_ID} .icc-flat-radio-hero *::before,
#${PAGE_ID} .icc-flat-radio-hero *::after,
#${PAGE_ID} .rf-hero::before,
#${PAGE_ID} .rf-hero::after,
#${PAGE_ID} .rf-hero *::before,
#${PAGE_ID} .rf-hero *::after{
  content:none!important;
  display:none!important;
  background:none!important;
  background-image:none!important;
  box-shadow:none!important;
  filter:none!important;
  opacity:0!important;
}
#${PAGE_ID} .icc-header-decorative-hidden{
  display:none!important;
  visibility:hidden!important;
  opacity:0!important;
  background:none!important;
  background-image:none!important;
  box-shadow:none!important;
  filter:none!important;
}
#${PAGE_ID} .icc-flat-radio-hero [style*="radial-gradient"],
#${PAGE_ID} .icc-flat-radio-hero [style*="blur("],
#${PAGE_ID} .icc-flat-radio-hero [class*="orb" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="sphere" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="blob" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="glow" i],
#${PAGE_ID} .icc-flat-radio-hero [class*="halo" i]{
  display:none!important;
}
#${PAGE_ID} .icc-flat-radio-title,
#${PAGE_ID} .icc-flat-radio-hero .rona-visual-title,
#${PAGE_ID} .rf-hero .rona-visual-title{
  position:relative!important;
  z-index:4!important;
  margin:0!important;
  font-size:26px!important;
  line-height:1.06!important;
  font-weight:900!important;
  letter-spacing:-.04em!important;
  color:#f4f8fc!important;
  text-shadow:none!important;
  filter:none!important;
  background:none!important;
  background-image:none!important;
  -webkit-text-fill-color:#f4f8fc!important;
}
#${PAGE_ID} .icc-flat-radio-hero .rona-rs-sub,
#${PAGE_ID} .icc-flat-radio-hero [class*="sub" i],
#${PAGE_ID} .rf-hero .rona-rs-sub{
  position:relative!important;
  z-index:4!important;
  margin-top:6px!important;
  font-size:11px!important;
  line-height:1.45!important;
  color:#7e96a8!important;
  opacity:1!important;
  text-shadow:none!important;
  filter:none!important;
  background:none!important;
}
@media(max-width:620px){
  #${PAGE_ID} .icc-flat-radio-hero,#${PAGE_ID} .rf-hero{min-height:66px!important;padding:15px 17px!important;border-radius:15px!important}
  #${PAGE_ID} .icc-flat-radio-title,#${PAGE_ID} .icc-flat-radio-hero .rona-visual-title,#${PAGE_ID} .rf-hero .rona-visual-title{font-size:23px!important}
}
`;
  d.head.appendChild(s);
}

function findTitle(page){
  return Array.from(page.querySelectorAll('h1,h2,h3,h4,h5,h6,[class*="title"],[class*="Title"]')).find(el=>norm(el.textContent)==='Радиорубка')||
    Array.from(page.querySelectorAll('div,span,p')).find(el=>norm(el.textContent)==='Радиорубка')||null;
}

function chooseHero(title,page){
  if(!title)return null;
  const root=page.querySelector(':scope > .rona-rs-root[data-kind="radio"]');
  if(root){
    let node=title;
    while(node&&node.parentElement&&node.parentElement!==root)node=node.parentElement;
    if(node&&node.parentElement===root)return node;
    const first=root.firstElementChild;
    if(first&&first.contains(title))return first;
  }
  const explicit=title.closest('.rf-hero,.rona-rs-head,.rona-rs-hero,[class*="hero"],[class*="Hero"],[class*="head"],[class*="Head"]');
  if(explicit&&page.contains(explicit))return explicit;
  let n=title.parentElement,best=null;
  while(n&&n!==page){
    const r=n.getBoundingClientRect(),t=norm(n.textContent);
    if(r.height>=48&&r.height<=200&&t.includes('Радиорубка')&&t.length<500)best=n;
    n=n.parentElement;
  }
  return best||title.parentElement;
}

function hideDecorative(hero,title){
  if(!hero)return;
  const nodes=Array.from(hero.querySelectorAll('*'));
  for(const el of nodes){
    if(el===title||el.contains(title)||title.contains(el))continue;
    const t=norm(el.textContent);
    if(t)continue;
    if(el.matches('input,select,textarea,button,img,svg,video,canvas'))continue;
    const cs=getComputedStyle(el);
    const rect=el.getBoundingClientRect();
    const bg=String(cs.backgroundImage||'');
    const radius=parseFloat(cs.borderTopLeftRadius)||0;
    const orbLike=bg.includes('radial-gradient')||cs.filter!=='none'||cs.backdropFilter!=='none'||
      ((cs.position==='absolute'||cs.position==='fixed')&&rect.width>34&&rect.height>34&&Math.abs(rect.width-rect.height)<26&&radius>=Math.min(rect.width,rect.height)*.28);
    if(orbLike)el.classList.add('icc-header-decorative-hidden');
  }
}

function apply(){
  const page=d.getElementById(PAGE_ID);if(!page)return;
  installStyle();
  const title=findTitle(page);if(!title)return;
  title.classList.add('icc-flat-radio-title');
  const hero=chooseHero(title,page);if(!hero||hero===page)return;
  hero.classList.add('icc-flat-radio-hero');
  hero.dataset.ronaRadioHeader='cash-flat-v2';
  hero.style.setProperty('background-image','linear-gradient(180deg,rgba(7,18,30,.98),rgba(5,14,24,.98))','important');
  hero.style.setProperty('filter','none','important');
  hideDecorative(hero,title);
}

installStyle();
let t=0;
const schedule=()=>{clearTimeout(t);t=setTimeout(apply,35)};
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
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')setTimeout(apply,30)});
setTimeout(apply,220);
setTimeout(apply,700);
setTimeout(apply,1400);
})();