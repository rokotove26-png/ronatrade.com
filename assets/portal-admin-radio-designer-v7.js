(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_DESIGNER_V7__)return;
window.__RONA_ADMIN_RADIO_DESIGNER_V7__=true;

const d=document;
const PAGE_ID='page-messages';
const STYLE_ID='rona-admin-radio-designer-v7-style';
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const text=el=>clean(el?.textContent);
const LABELS={
  title:'Радиорубка',
  total:'Всего активно',
  messages:'Сообщения',
  notices:'Уведомления',
  bulletins:'Объявления',
  composer:'Новое сообщение',
  traffic:'Активные сообщения'
};

const CSS=`
#${PAGE_ID}.rona-radio-designer-v7{
  --r7-bg:#030a12;
  --r7-bg2:#06131f;
  --r7-panel:#081827;
  --r7-panel2:#0a1d2c;
  --r7-line:rgba(93,176,217,.20);
  --r7-line-strong:rgba(82,204,244,.32);
  --r7-text:#edf6fa;
  --r7-muted:#8098a7;
  --r7-cyan:#4fd3f6;
  --r7-blue:#5c9df4;
  --r7-violet:#9784f0;
  --r7-amber:#edae5f;
  position:relative;
}
#${PAGE_ID}.rona-radio-designer-v7 .rona-rs-root[data-kind="radio"]{
  box-sizing:border-box!important;
  position:relative!important;
  isolation:isolate!important;
  width:min(100%,1180px)!important;
  max-width:1180px!important;
  margin:12px auto 24px!important;
  padding:14px!important;
  border:1px solid rgba(82,174,214,.16)!important;
  border-radius:18px!important;
  background:
    radial-gradient(700px 320px at 86% -10%,rgba(35,140,194,.10),transparent 68%),
    radial-gradient(560px 260px at 8% 110%,rgba(89,91,179,.055),transparent 72%),
    linear-gradient(145deg,var(--r7-bg),var(--r7-bg2) 58%,#040e18)!important;
  box-shadow:0 24px 64px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.02)!important;
  overflow:hidden!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .rona-rs-root[data-kind="radio"]::before{
  content:''!important;
  position:absolute!important;
  inset:0!important;
  pointer-events:none!important;
  z-index:-1!important;
  opacity:.22!important;
  background-image:
    linear-gradient(rgba(102,193,228,.035) 1px,transparent 1px),
    linear-gradient(90deg,rgba(102,193,228,.035) 1px,transparent 1px)!important;
  background-size:32px 32px!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .rona-rs-root[data-kind="radio"]::after{display:none!important;content:none!important}

#${PAGE_ID}.rona-radio-designer-v7 .radio-title-shell-v7,
#${PAGE_ID}.rona-radio-designer-v7 .radio-stats-grid-v7,
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7,
#${PAGE_ID}.rona-radio-designer-v7 .radio-traffic-v7{
  position:relative!important;
  z-index:1!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-title-shell-v7{
  box-sizing:border-box!important;
  min-height:0!important;
  height:auto!important;
  margin:0 0 10px!important;
  padding:15px 17px!important;
  border:1px solid rgba(91,178,218,.18)!important;
  border-radius:13px!important;
  background:linear-gradient(135deg,rgba(8,25,39,.94),rgba(5,16,27,.94))!important;
  box-shadow:inset 0 1px rgba(255,255,255,.02)!important;
  overflow:hidden!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-title-v7{
  margin:0!important;
  padding:0!important;
  font-size:clamp(25px,2vw,33px)!important;
  line-height:1.05!important;
  letter-spacing:-.035em!important;
  color:#f3f8fb!important;
  text-shadow:0 2px 20px rgba(91,196,239,.07)!important;
}

#${PAGE_ID}.rona-radio-designer-v7 .radio-stats-grid-v7{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:9px!important;
  align-items:stretch!important;
  margin:0 0 10px!important;
  padding:0!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-v7{
  box-sizing:border-box!important;
  width:auto!important;
  min-width:0!important;
  min-height:82px!important;
  height:auto!important;
  margin:0!important;
  padding:11px 12px!important;
  border:1px solid var(--r7-line)!important;
  border-radius:12px!important;
  background:linear-gradient(145deg,rgba(9,27,42,.95),rgba(4,15,27,.95))!important;
  box-shadow:0 10px 24px rgba(0,0,0,.15),inset 0 1px rgba(255,255,255,.02)!important;
  overflow:hidden!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-total-v7{
  border-color:rgba(79,211,246,.28)!important;
  background:radial-gradient(230px 90px at 100% 0,rgba(79,211,246,.095),transparent 74%),linear-gradient(145deg,rgba(7,31,46,.96),rgba(4,15,27,.95))!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-message-v7{
  border-color:rgba(92,157,244,.28)!important;
  background:radial-gradient(230px 90px at 100% 0,rgba(92,157,244,.10),transparent 74%),linear-gradient(145deg,rgba(8,27,48,.96),rgba(4,14,27,.95))!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-notice-v7{
  border-color:rgba(151,132,240,.27)!important;
  background:radial-gradient(230px 90px at 100% 0,rgba(151,132,240,.10),transparent 74%),linear-gradient(145deg,rgba(22,23,51,.96),rgba(5,14,27,.95))!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-bulletin-v7{
  border-color:rgba(237,174,95,.25)!important;
  background:radial-gradient(230px 90px at 100% 0,rgba(237,174,95,.10),transparent 74%),linear-gradient(145deg,rgba(41,27,18,.96),rgba(6,14,26,.95))!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-v7 strong,
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-v7 [class*="value"],
#${PAGE_ID}.rona-radio-designer-v7 .radio-stat-v7 [class*="count"]{
  color:#f5fbff!important;
  font-variant-numeric:tabular-nums!important;
}

#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7,
#${PAGE_ID}.rona-radio-designer-v7 .radio-traffic-v7{
  box-sizing:border-box!important;
  width:100%!important;
  min-width:0!important;
  height:auto!important;
  margin:0 0 10px!important;
  padding:13px!important;
  border:1px solid var(--r7-line)!important;
  border-radius:13px!important;
  background:linear-gradient(145deg,rgba(8,25,39,.96),rgba(4,14,25,.96))!important;
  box-shadow:0 12px 28px rgba(0,0,0,.16),inset 0 1px rgba(255,255,255,.02)!important;
  overflow:visible!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7{border-color:rgba(79,211,246,.24)!important}
#${PAGE_ID}.rona-radio-designer-v7 .radio-traffic-v7{
  min-height:118px!important;
  margin-bottom:0!important;
  border-color:rgba(92,157,244,.22)!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 textarea{
  box-sizing:border-box!important;
  min-height:76px!important;
  max-height:132px!important;
  resize:vertical!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 input,
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 select,
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 textarea{
  border-color:rgba(107,180,214,.18)!important;
  background:rgba(3,12,21,.72)!important;
  color:var(--r7-text)!important;
  box-shadow:none!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 input:focus,
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 select:focus,
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 textarea:focus{
  border-color:rgba(79,211,246,.44)!important;
  box-shadow:0 0 0 2px rgba(79,211,246,.07)!important;
  outline:none!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7 button{
  min-height:32px!important;
  box-shadow:none!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-traffic-v7 table{
  width:100%!important;
  border-collapse:separate!important;
  border-spacing:0!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-traffic-v7 th{
  color:#91aab8!important;
  border-color:rgba(103,170,202,.14)!important;
}
#${PAGE_ID}.rona-radio-designer-v7 .radio-traffic-v7 td{
  color:#dbe9f0!important;
  border-color:rgba(103,170,202,.10)!important;
}

#${PAGE_ID}.rona-radio-designer-v7 .radio-bg-neutralized-v7{
  background-image:none!important;
}
#${PAGE_ID}.rona-radio-designer-v7 img.radio-decorative-art-v7,
#${PAGE_ID}.rona-radio-designer-v7 picture.radio-decorative-art-v7,
#${PAGE_ID}.rona-radio-designer-v7 video.radio-decorative-art-v7{
  display:none!important;
}
#${PAGE_ID}.rona-radio-designer-v7 [class*="world"].radio-bg-neutralized-v7,
#${PAGE_ID}.rona-radio-designer-v7 [class*="map"].radio-bg-neutralized-v7,
#${PAGE_ID}.rona-radio-designer-v7 [class*="hero"].radio-bg-neutralized-v7,
#${PAGE_ID}.rona-radio-designer-v7 [class*="visual"].radio-bg-neutralized-v7{
  min-height:0!important;
  height:auto!important;
}

@media(max-width:900px){
  #${PAGE_ID}.rona-radio-designer-v7 .rona-rs-root[data-kind="radio"]{margin:8px auto 18px!important;padding:11px!important;border-radius:15px!important}
  #${PAGE_ID}.rona-radio-designer-v7 .radio-stats-grid-v7{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  #${PAGE_ID}.rona-radio-designer-v7 .radio-title-shell-v7{padding:13px 14px!important}
}
@media(max-width:560px){
  #${PAGE_ID}.rona-radio-designer-v7 .radio-stats-grid-v7{grid-template-columns:1fr!important}
  #${PAGE_ID}.rona-radio-designer-v7 .radio-stat-v7{min-height:70px!important}
  #${PAGE_ID}.rona-radio-designer-v7 .radio-composer-v7,
  #${PAGE_ID}.rona-radio-designer-v7 .radio-traffic-v7{padding:11px!important}
}
`;

function installStyle(){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=CSS;
  (d.head||d.documentElement).appendChild(s);
}

function exact(page,label){
  return Array.from(page.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,label')).find(el=>text(el)===label)||null;
}

function panelFrom(el,page,mode){
  if(!el||!page)return null;
  const pr=page.getBoundingClientRect();
  let node=el;
  while(node&&node.parentElement&&node.parentElement!==page){
    node=node.parentElement;
    const r=node.getBoundingClientRect();
    const t=text(node);
    const controls=node.querySelectorAll('input,select,textarea,button').length;
    const sized=r.width>0||r.height>0;
    if(mode==='stat'){
      const dimensions=!sized||(r.height>=44&&r.height<=230&&r.width>100&&(!pr.width||r.width<pr.width*.58));
      if(dimensions&&controls===0&&t.length<280)return node;
    }
    if(mode==='composer'){
      const dimensions=!sized||r.height>=60;
      if(dimensions&&t.includes(LABELS.composer)&&controls>=3&&(!pr.width||!r.width||r.width<=pr.width*.995))return node;
    }
    if(mode==='traffic'){
      const dimensions=!sized||r.height>=55;
      if(dimensions&&t.includes(LABELS.traffic)&&(node.querySelector('table')||node.querySelector('[role="table"]')||t.length<1800)&&(!pr.width||!r.width||r.width<=pr.width*.995))return node;
    }
  }
  return null;
}

function titleShell(title,root){
  if(!title||!root)return null;
  let node=title.parentElement;
  let candidate=node;
  while(node&&node!==root&&node.parentElement){
    const r=node.getBoundingClientRect();
    const t=text(node);
    const controls=node.querySelectorAll('input,select,textarea,button').length;
    if(controls===0&&t.length<420&&(!r.height||r.height<190)){
      candidate=node;
      if(node.parentElement===root)break;
      node=node.parentElement;
      continue;
    }
    break;
  }
  return candidate;
}

function unwrap(el){
  const p=el?.parentNode;
  if(!p)return;
  while(el.firstChild)p.insertBefore(el.firstChild,el);
  el.remove();
}

function cleanupLegacy(page){
  ['rona-admin-radio-mission-control-v3-style','rona-admin-radio-designer-v5-style','rona-admin-radio-designer-v6-style'].forEach(id=>d.getElementById(id)?.remove());
  page.querySelectorAll('.radio-panel-head,.icc-mission-bar,.icc-card-signal,.icc-composer-hud,.icc-traffic-viz,.icc-panel-code,.radio-network-console').forEach(el=>el.remove());
  for(let pass=0;pass<16;pass++){
    const bodies=Array.from(page.querySelectorAll('.radio-panel-body'));
    if(!bodies.length)break;
    bodies.reverse().forEach(unwrap);
  }
  Array.from(page.querySelectorAll('.radio-workspace-v5')).reverse().forEach(unwrap);
  page.classList.remove('rona-radio-mission-v3','rona-radio-designer-v5','rona-radio-designer-v6');
  page.querySelectorAll('.icc-stat,.icc-composer,.icc-traffic').forEach(el=>{
    el.classList.remove('icc-stat','icc-composer','icc-traffic','icc-stat-total','icc-stat-msg','icc-stat-note','icc-stat-bulletin');
  });
  page.querySelectorAll('.radio-title-v6,.radio-stat-v6,.radio-stat-total-v6,.radio-stat-message-v6,.radio-stat-notice-v6,.radio-stat-bulletin-v6,.radio-composer-v6,.radio-traffic-v6').forEach(el=>{
    el.classList.remove('radio-title-v6','radio-stat-v6','radio-stat-total-v6','radio-stat-message-v6','radio-stat-notice-v6','radio-stat-bulletin-v6','radio-composer-v6','radio-traffic-v6');
  });
}

function markStat(page,label,cls){
  const card=panelFrom(exact(page,label),page,'stat');
  if(!card)return null;
  card.classList.add('radio-stat-v7',cls);
  return card;
}

function markStatsGrid(cards){
  const valid=cards.filter(Boolean);
  if(valid.length!==4)return;
  const parent=valid[0].parentElement;
  if(parent&&valid.every(card=>card.parentElement===parent))parent.classList.add('radio-stats-grid-v7');
}

function neutralizeDecorativeArt(root){
  if(!root)return;
  const rootRect=root.getBoundingClientRect();
  Array.from(root.querySelectorAll('*')).forEach(el=>{
    if(el===root||el.closest('button,a,input,select,textarea,table,[role="table"]'))return;
    if(el.classList.contains('radio-title-shell-v7')||el.classList.contains('radio-stat-v7')||el.classList.contains('radio-composer-v7')||el.classList.contains('radio-traffic-v7'))return;
    const r=el.getBoundingClientRect();
    if((r.width||0)<Math.min(420,(rootRect.width||900)*.45)||(r.height||0)<130)return;
    const cs=getComputedStyle(el);
    const bg=String(cs.backgroundImage||'');
    const controls=el.querySelectorAll('input,select,textarea,button,a,table,[role="table"]').length;
    const t=text(el);
    if(bg.includes('url(')&&controls===0&&t.length<240)el.classList.add('radio-bg-neutralized-v7');
  });
  root.querySelectorAll('img,picture,video').forEach(el=>{
    if(el.closest('a,button'))return;
    const r=el.getBoundingClientRect();
    if((r.width||0)>=Math.min(420,(rootRect.width||900)*.45)&&(r.height||0)>=130)el.classList.add('radio-decorative-art-v7');
  });
}

function apply(){
  const page=d.getElementById(PAGE_ID);
  if(!page)return false;
  const root=page.querySelector('.rona-rs-root[data-kind="radio"]');
  if(!root)return false;

  installStyle();
  cleanupLegacy(page);
  page.classList.add('rona-radio-designer-v7');

  const title=exact(page,LABELS.title);
  if(title){
    title.classList.add('radio-title-v7');
    const shell=titleShell(title,root);
    if(shell&&shell!==root)shell.classList.add('radio-title-shell-v7');
  }

  const stats=[
    markStat(page,LABELS.total,'radio-stat-total-v7'),
    markStat(page,LABELS.messages,'radio-stat-message-v7'),
    markStat(page,LABELS.notices,'radio-stat-notice-v7'),
    markStat(page,LABELS.bulletins,'radio-stat-bulletin-v7')
  ];
  markStatsGrid(stats);

  const composer=panelFrom(exact(page,LABELS.composer),page,'composer');
  if(composer)composer.classList.add('radio-composer-v7');

  const traffic=panelFrom(exact(page,LABELS.traffic),page,'traffic');
  if(traffic)traffic.classList.add('radio-traffic-v7');

  neutralizeDecorativeArt(root);
  return true;
}

let timer=null;
let pageObserver=null;
let rootObserver=null;
function schedule(){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    const ready=apply();
    if(!ready)return;
    const page=d.getElementById(PAGE_ID);
    if(page&&!pageObserver){
      pageObserver=new MutationObserver(schedule);
      pageObserver.observe(page,{childList:true,subtree:true});
    }
    if(rootObserver){rootObserver.disconnect();rootObserver=null;}
  },50);
}

if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
setTimeout(schedule,220);
setTimeout(schedule,800);

if(!d.getElementById(PAGE_ID)){
  rootObserver=new MutationObserver(schedule);
  rootObserver.observe(d.documentElement,{childList:true,subtree:true});
}
})();
