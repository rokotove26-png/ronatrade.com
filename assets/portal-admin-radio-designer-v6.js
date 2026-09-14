(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_DESIGNER_V6__)return;
window.__RONA_ADMIN_RADIO_DESIGNER_V6__=true;

const d=document;
const PAGE_ID='page-messages';
const STYLE_ID='rona-admin-radio-designer-v6-style';
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
#${PAGE_ID}.rona-radio-designer-v6{
  --r6-bg:#030b14;
  --r6-bg2:#061421;
  --r6-panel:#081827;
  --r6-panel2:#0a1d2d;
  --r6-line:rgba(92,190,233,.22);
  --r6-line-strong:rgba(92,214,255,.34);
  --r6-text:#eef7fb;
  --r6-muted:#7f9bab;
  --r6-cyan:#55d9ff;
  --r6-blue:#5a9dff;
  --r6-violet:#9a83ff;
  --r6-amber:#ffb45c;
  position:relative;
}
#${PAGE_ID}.rona-radio-designer-v6 .rona-rs-root[data-kind="radio"]{
  background:
    radial-gradient(900px 430px at 84% -4%,rgba(24,141,205,.13),transparent 68%),
    radial-gradient(720px 380px at 8% 96%,rgba(85,102,205,.07),transparent 72%),
    linear-gradient(145deg,var(--r6-bg),var(--r6-bg2) 58%,#04101b)!important;
  color:var(--r6-text)!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-title-v6{
  color:#f4f8fb!important;
  letter-spacing:-.035em!important;
  text-shadow:0 2px 22px rgba(111,205,255,.08)!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-v6,
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6,
#${PAGE_ID}.rona-radio-designer-v6 .radio-traffic-v6{
  border:1px solid var(--r6-line)!important;
  border-radius:13px!important;
  background:linear-gradient(145deg,rgba(10,29,45,.96),rgba(4,15,27,.96))!important;
  box-shadow:0 14px 34px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.025)!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-v6{
  min-height:74px!important;
  padding:11px 13px!important;
  overflow:hidden!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-total-v6{
  border-color:rgba(85,217,255,.31)!important;
  background:radial-gradient(260px 110px at 100% 0,rgba(85,217,255,.11),transparent 74%),linear-gradient(145deg,rgba(8,32,48,.96),rgba(4,15,27,.96))!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-message-v6{
  border-color:rgba(90,157,255,.31)!important;
  background:radial-gradient(260px 110px at 100% 0,rgba(90,157,255,.12),transparent 74%),linear-gradient(145deg,rgba(8,27,49,.96),rgba(4,14,28,.96))!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-notice-v6{
  border-color:rgba(154,131,255,.30)!important;
  background:radial-gradient(260px 110px at 100% 0,rgba(154,131,255,.12),transparent 74%),linear-gradient(145deg,rgba(23,24,54,.96),rgba(5,14,28,.96))!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-bulletin-v6{
  border-color:rgba(255,180,92,.28)!important;
  background:radial-gradient(260px 110px at 100% 0,rgba(255,180,92,.12),transparent 74%),linear-gradient(145deg,rgba(43,27,18,.96),rgba(6,14,26,.96))!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-v6 strong,
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-v6 [class*="value"],
#${PAGE_ID}.rona-radio-designer-v6 .radio-stat-v6 [class*="count"]{
  color:#f5fbff!important;
  font-variant-numeric:tabular-nums;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6,
#${PAGE_ID}.rona-radio-designer-v6 .radio-traffic-v6{
  padding:14px!important;
  min-height:0!important;
  overflow:visible!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6{
  border-color:rgba(85,217,255,.28)!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-traffic-v6{
  border-color:rgba(90,157,255,.25)!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6 input,
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6 select,
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6 textarea{
  border-color:rgba(112,188,224,.20)!important;
  background:rgba(3,13,23,.66)!important;
  color:var(--r6-text)!important;
  box-shadow:none!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6 input:focus,
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6 select:focus,
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6 textarea:focus{
  border-color:rgba(85,217,255,.48)!important;
  box-shadow:0 0 0 2px rgba(85,217,255,.08)!important;
  outline:none!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-traffic-v6 table{
  width:100%!important;
  border-collapse:separate!important;
  border-spacing:0!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-traffic-v6 th{
  color:#91abba!important;
  border-color:rgba(103,170,202,.15)!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-traffic-v6 td{
  color:#dbeaf1!important;
  border-color:rgba(103,170,202,.11)!important;
}
#${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6 button{
  box-shadow:none!important;
}
@media(max-width:900px){
  #${PAGE_ID}.rona-radio-designer-v6 .radio-stat-v6{min-height:68px!important;padding:10px!important}
  #${PAGE_ID}.rona-radio-designer-v6 .radio-composer-v6,
  #${PAGE_ID}.rona-radio-designer-v6 .radio-traffic-v6{padding:11px!important}
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
      const dimensions=!sized||(r.height>=48&&r.height<=220&&r.width>110&&(!pr.width||r.width<pr.width*.55));
      if(dimensions&&controls===0&&t.length<260)return node;
    }
    if(mode==='composer'){
      const dimensions=!sized||r.height>=70;
      if(dimensions&&t.includes(LABELS.composer)&&controls>=3&&(!pr.width||!r.width||r.width<=pr.width*.995))return node;
    }
    if(mode==='traffic'){
      const dimensions=!sized||r.height>=70;
      if(dimensions&&t.includes(LABELS.traffic)&&(node.querySelector('table')||node.querySelector('[role="table"]')||t.length<1600)&&(!pr.width||!r.width||r.width<=pr.width*.995))return node;
    }
  }
  return null;
}

function unwrap(el){
  const p=el?.parentNode;
  if(!p)return;
  while(el.firstChild)p.insertBefore(el.firstChild,el);
  el.remove();
}

function cleanupLegacy(page){
  d.getElementById('rona-admin-radio-mission-control-v3-style')?.remove();
  d.getElementById('rona-admin-radio-designer-v5-style')?.remove();

  page.querySelectorAll('.radio-panel-head,.icc-mission-bar,.icc-card-signal,.icc-composer-hud,.icc-traffic-viz,.icc-panel-code,.radio-network-console').forEach(el=>el.remove());

  for(let pass=0;pass<16;pass++){
    const bodies=Array.from(page.querySelectorAll('.radio-panel-body'));
    if(!bodies.length)break;
    bodies.reverse().forEach(unwrap);
  }
  Array.from(page.querySelectorAll('.radio-workspace-v5')).reverse().forEach(unwrap);

  page.classList.remove('rona-radio-mission-v3','rona-radio-designer-v5');
  page.querySelectorAll('.icc-stat,.icc-composer,.icc-traffic').forEach(el=>{
    el.classList.remove('icc-stat','icc-composer','icc-traffic','icc-stat-total','icc-stat-msg','icc-stat-note','icc-stat-bulletin');
  });
}

function markStat(page,label,cls){
  const card=panelFrom(exact(page,label),page,'stat');
  if(!card)return null;
  card.classList.add('radio-stat-v6',cls);
  return card;
}

function apply(){
  const page=d.getElementById(PAGE_ID);
  if(!page)return false;
  const root=page.querySelector('.rona-rs-root[data-kind="radio"]');
  if(!root)return false;

  installStyle();
  cleanupLegacy(page);
  page.classList.add('rona-radio-designer-v6');

  const title=exact(page,LABELS.title);
  if(title)title.classList.add('radio-title-v6');

  markStat(page,LABELS.total,'radio-stat-total-v6');
  markStat(page,LABELS.messages,'radio-stat-message-v6');
  markStat(page,LABELS.notices,'radio-stat-notice-v6');
  markStat(page,LABELS.bulletins,'radio-stat-bulletin-v6');

  const composer=panelFrom(exact(page,LABELS.composer),page,'composer');
  if(composer)composer.classList.add('radio-composer-v6');

  const traffic=panelFrom(exact(page,LABELS.traffic),page,'traffic');
  if(traffic)traffic.classList.add('radio-traffic-v6');

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
  },60);
}

if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
setTimeout(schedule,250);
setTimeout(schedule,900);

if(!d.getElementById(PAGE_ID)){
  rootObserver=new MutationObserver(schedule);
  rootObserver.observe(d.documentElement,{childList:true,subtree:true});
}
})();
