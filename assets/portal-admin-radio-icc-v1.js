(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_ICC_V1__)return;
window.__RONA_ADMIN_RADIO_ICC_V1__=true;

const d=document;
const PAGE_ID='page-messages';
const STYLE_ID='rona-admin-radio-icc-v1-style';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
const text=el=>norm(el?.textContent);
const labels={
  total:'Всего активно',
  messages:'Сообщения',
  notices:'Уведомления',
  bulletins:'Объявления',
  composer:'Новое сообщение',
  traffic:'Активные сообщения'
};

function installStyle(){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#${PAGE_ID}.rona-radio-icc{
  --icc-bg:#06101a;
  --icc-bg-2:#081725;
  --icc-panel:rgba(5,17,29,.90);
  --icc-panel-2:rgba(8,23,38,.92);
  --icc-line:rgba(109,190,229,.24);
  --icc-line-strong:rgba(105,207,244,.48);
  --icc-text:#eef7fb;
  --icc-muted:#82a3b7;
  --icc-cyan:#67d7ff;
  --icc-cyan-soft:rgba(103,215,255,.10);
  --icc-red:#e3273a;
  --icc-red-soft:rgba(227,39,58,.14);
  position:relative;
  isolation:isolate;
  overflow:hidden;
}
#${PAGE_ID}.rona-radio-icc::before{
  content:'';
  position:absolute;
  inset:0;
  z-index:-1;
  pointer-events:none;
  background-image:
    linear-gradient(rgba(105,207,244,.028) 1px,transparent 1px),
    linear-gradient(90deg,rgba(105,207,244,.028) 1px,transparent 1px),
    radial-gradient(900px 420px at 72% 28%,rgba(25,104,148,.11),transparent 70%);
  background-size:32px 32px,32px 32px,auto;
  mask-image:linear-gradient(to bottom,transparent 0,#000 7%,#000 100%);
}
#${PAGE_ID}.rona-radio-icc .icc-status-bar{
  min-height:34px;
  margin:0 8px 12px;
  padding:0 12px;
  display:flex;
  align-items:center;
  gap:9px;
  border:1px solid rgba(103,215,255,.17);
  border-left:2px solid rgba(103,215,255,.64);
  background:linear-gradient(90deg,rgba(9,30,47,.88),rgba(5,18,31,.64));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 24px rgba(0,0,0,.14);
  color:#9cb9c9;
  font-size:9.5px;
  font-weight:800;
  letter-spacing:.16em;
  text-transform:uppercase;
  clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%);
}
#${PAGE_ID}.rona-radio-icc .icc-status-bar .icc-signal-dot{
  width:6px;height:6px;min-width:6px;border-radius:50%;
  background:var(--icc-cyan);
  box-shadow:0 0 12px rgba(103,215,255,.72);
}
#${PAGE_ID}.rona-radio-icc .icc-status-bar .icc-divider{width:1px;height:13px;background:rgba(137,194,220,.22)}
#${PAGE_ID}.rona-radio-icc .icc-status-bar .icc-clock{margin-left:auto;color:#cbefff;font-variant-numeric:tabular-nums;letter-spacing:.12em}

#${PAGE_ID}.rona-radio-icc .icc-stat,
#${PAGE_ID}.rona-radio-icc .icc-composer,
#${PAGE_ID}.rona-radio-icc .icc-traffic{
  position:relative!important;
  overflow:hidden!important;
  border-color:var(--icc-line)!important;
  background:linear-gradient(145deg,rgba(8,25,40,.95),rgba(4,15,26,.91))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 12px 34px rgba(0,0,0,.18)!important;
}
#${PAGE_ID}.rona-radio-icc .icc-stat::before,
#${PAGE_ID}.rona-radio-icc .icc-composer::before,
#${PAGE_ID}.rona-radio-icc .icc-traffic::before{
  content:'';
  position:absolute;
  left:0;top:0;right:0;height:1px;
  background:linear-gradient(90deg,var(--icc-cyan),rgba(103,215,255,.16) 30%,transparent 72%);
  opacity:.82;
  pointer-events:none;
}
#${PAGE_ID}.rona-radio-icc .icc-stat::after{
  position:absolute;
  top:9px;right:11px;
  color:#608397;
  font-size:8px;
  font-weight:900;
  letter-spacing:.14em;
  text-transform:uppercase;
  pointer-events:none;
}
#${PAGE_ID}.rona-radio-icc .icc-stat-total::after{content:'NETWORK / 00'}
#${PAGE_ID}.rona-radio-icc .icc-stat-msg::after{content:'TRAFFIC / MSG'}
#${PAGE_ID}.rona-radio-icc .icc-stat-note::after{content:'TRAFFIC / NTF'}
#${PAGE_ID}.rona-radio-icc .icc-stat-bulletin::after{content:'TRAFFIC / BLT';color:#915a66}
#${PAGE_ID}.rona-radio-icc .icc-stat-bulletin{box-shadow:inset 0 1px 0 rgba(255,255,255,.025),inset -2px 0 0 rgba(227,39,58,.42),0 12px 34px rgba(0,0,0,.18)!important}
#${PAGE_ID}.rona-radio-icc .icc-stat{
  min-height:92px!important;
  border-radius:8px!important;
  clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,8px 100%,0 calc(100% - 8px));
}
#${PAGE_ID}.rona-radio-icc .icc-stat *{position:relative;z-index:1}
#${PAGE_ID}.rona-radio-icc .icc-stat [class*="value"],
#${PAGE_ID}.rona-radio-icc .icc-stat [class*="count"],
#${PAGE_ID}.rona-radio-icc .icc-stat strong{
  font-variant-numeric:tabular-nums;
  letter-spacing:-.035em;
}

#${PAGE_ID}.rona-radio-icc .icc-composer,
#${PAGE_ID}.rona-radio-icc .icc-traffic{
  border-radius:9px!important;
}
#${PAGE_ID}.rona-radio-icc .icc-composer{padding-top:max(38px,var(--icc-original-pad,0px))!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic{padding-top:max(38px,var(--icc-original-pad,0px))!important}
#${PAGE_ID}.rona-radio-icc .icc-composer::after,
#${PAGE_ID}.rona-radio-icc .icc-traffic::after{
  position:absolute;
  left:14px;top:10px;
  z-index:2;
  font-size:8.5px;
  font-weight:900;
  letter-spacing:.17em;
  text-transform:uppercase;
  color:#7094a8;
  pointer-events:none;
}
#${PAGE_ID}.rona-radio-icc .icc-composer::after{content:'SECURE TRANSMISSION CONSOLE  /  GLOBAL ROUTING'}
#${PAGE_ID}.rona-radio-icc .icc-traffic::after{content:'GLOBAL DISPATCH BOARD  /  LIVE TRAFFIC'}

#${PAGE_ID}.rona-radio-icc input,
#${PAGE_ID}.rona-radio-icc select,
#${PAGE_ID}.rona-radio-icc textarea{
  border-color:rgba(111,177,209,.24)!important;
  background:linear-gradient(180deg,rgba(3,12,21,.88),rgba(5,17,28,.82))!important;
  color:var(--icc-text)!important;
  border-radius:6px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important;
  outline:none!important;
}
#${PAGE_ID}.rona-radio-icc input::placeholder,
#${PAGE_ID}.rona-radio-icc textarea::placeholder{color:#5f7b8c!important}
#${PAGE_ID}.rona-radio-icc input:focus,
#${PAGE_ID}.rona-radio-icc select:focus,
#${PAGE_ID}.rona-radio-icc textarea:focus{
  border-color:rgba(103,215,255,.62)!important;
  box-shadow:0 0 0 2px rgba(103,215,255,.07),inset 0 1px 0 rgba(255,255,255,.025)!important;
}
#${PAGE_ID}.rona-radio-icc button:not([data-page]):not([data-action="logout"]){
  border-radius:6px!important;
  border-color:rgba(103,215,255,.34)!important;
  background:linear-gradient(180deg,rgba(22,75,107,.88),rgba(10,46,70,.92))!important;
  color:#eefaff!important;
  font-weight:800!important;
  letter-spacing:.02em;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 7px 18px rgba(0,0,0,.17)!important;
}
#${PAGE_ID}.rona-radio-icc button:not([data-page]):not([data-action="logout"]):hover{
  border-color:rgba(103,215,255,.65)!important;
  background:linear-gradient(180deg,rgba(28,93,130,.92),rgba(12,56,82,.95))!important;
}
#${PAGE_ID}.rona-radio-icc .icc-transmit-button{
  position:relative!important;
  padding-left:34px!important;
}
#${PAGE_ID}.rona-radio-icc .icc-transmit-button::before{
  content:'';position:absolute;left:13px;top:50%;width:7px;height:7px;border-radius:50%;transform:translateY(-50%);
  background:var(--icc-cyan);box-shadow:0 0 11px rgba(103,215,255,.7);
}

#${PAGE_ID}.rona-radio-icc .icc-traffic{
  min-height:270px!important;
  background:
    linear-gradient(rgba(103,215,255,.025) 1px,transparent 1px),
    linear-gradient(145deg,rgba(7,23,37,.94),rgba(3,13,23,.88))!important;
  background-size:100% 32px,auto!important;
}
#${PAGE_ID}.rona-radio-icc .icc-traffic table{border-collapse:separate!important;border-spacing:0!important;width:100%!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic th{
  color:#6f91a4!important;font-size:9px!important;font-weight:900!important;letter-spacing:.12em!important;text-transform:uppercase!important;
  background:rgba(9,29,45,.78)!important;border-bottom:1px solid rgba(103,215,255,.19)!important;
}
#${PAGE_ID}.rona-radio-icc .icc-traffic td{border-bottom-color:rgba(103,215,255,.09)!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic tr:hover td{background:rgba(103,215,255,.035)!important}

#${PAGE_ID}.rona-radio-icc .icc-panel-code{
  position:absolute;right:12px;bottom:8px;z-index:0;
  color:rgba(112,157,181,.24);font-size:7.5px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;pointer-events:none;
}

@media(max-width:900px){
  #${PAGE_ID}.rona-radio-icc .icc-status-bar{margin-inline:4px;gap:7px;overflow:hidden;white-space:nowrap}
  #${PAGE_ID}.rona-radio-icc .icc-status-bar .icc-hide-narrow{display:none}
  #${PAGE_ID}.rona-radio-icc .icc-stat{min-height:84px!important}
}
@media(max-width:620px){
  #${PAGE_ID}.rona-radio-icc .icc-status-bar{font-size:8px;letter-spacing:.11em}
  #${PAGE_ID}.rona-radio-icc .icc-composer::after,
  #${PAGE_ID}.rona-radio-icc .icc-traffic::after{font-size:7px;letter-spacing:.11em;max-width:75%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
}
`;
  d.head.appendChild(s);
}

function exact(page,label){
  return Array.from(page.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,label')).find(el=>text(el)===label);
}

function panelFrom(el,page,mode){
  if(!el)return null;
  const pageRect=page.getBoundingClientRect();
  let node=el;
  let fallback=el.parentElement;
  while(node&&node.parentElement&&node.parentElement!==page){
    node=node.parentElement;
    const r=node.getBoundingClientRect();
    const t=text(node);
    const controls=node.querySelectorAll('input,select,textarea,button').length;
    if(mode==='stat'){
      if(r.height>=58&&r.height<=190&&r.width>120&&(!pageRect.width||r.width<pageRect.width*.48)&&t.length<180)return node;
    }else if(mode==='composer'){
      if(t.includes(labels.composer)&&controls>=3&&r.height>=70&&(!pageRect.width||r.width<=pageRect.width*.99))return node;
    }else if(mode==='traffic'){
      if(t.includes(labels.traffic)&&r.height>=90&&(!pageRect.width||r.width<=pageRect.width*.99))return node;
    }
    fallback=node;
  }
  return fallback&&fallback!==page?fallback:null;
}

function markStat(page,label,cls){
  const el=exact(page,label);
  const box=panelFrom(el,page,'stat');
  if(box)box.classList.add('icc-stat',cls);
}

function addPanelCode(panel,code){
  if(!panel||panel.querySelector(':scope > .icc-panel-code'))return;
  const tag=d.createElement('span');
  tag.className='icc-panel-code';
  tag.setAttribute('aria-hidden','true');
  tag.textContent=code;
  panel.appendChild(tag);
}

function ensureStatus(page){
  let bar=page.querySelector(':scope > .icc-status-bar');
  if(!bar){
    bar=d.createElement('div');
    bar.className='icc-status-bar';
    bar.setAttribute('aria-hidden','true');
    bar.innerHTML='<span class="icc-signal-dot"></span><span>COMMUNICATION CONTROL</span><span class="icc-divider"></span><span class="icc-hide-narrow">GLOBAL MESSAGE ROUTING</span><span class="icc-divider icc-hide-narrow"></span><span class="icc-hide-narrow">ADMIN NETWORK</span><span class="icc-clock">UTC --:--:--</span>';
    const title=exact(page,'Радиорубка');
    if(title){
      let anchor=title;
      while(anchor.parentElement&&anchor.parentElement!==page&&text(anchor.parentElement)===text(title))anchor=anchor.parentElement;
      if(anchor.parentElement===page)anchor.insertAdjacentElement('afterend',bar);else page.prepend(bar);
    }else page.prepend(bar);
  }
  return bar;
}

function updateClock(page){
  const clock=page.querySelector('.icc-clock');
  if(!clock)return;
  const p=n=>String(n).padStart(2,'0');
  const now=new Date();
  clock.textContent='UTC '+p(now.getUTCHours())+':'+p(now.getUTCMinutes())+':'+p(now.getUTCSeconds());
}

function apply(){
  const page=d.getElementById(PAGE_ID);
  if(!page)return;
  installStyle();
  page.classList.add('rona-radio-icc');
  ensureStatus(page);
  markStat(page,labels.total,'icc-stat-total');
  markStat(page,labels.messages,'icc-stat-msg');
  markStat(page,labels.notices,'icc-stat-note');
  markStat(page,labels.bulletins,'icc-stat-bulletin');

  const composer=panelFrom(exact(page,labels.composer),page,'composer');
  if(composer){
    composer.classList.add('icc-composer');
    addPanelCode(composer,'TX-CONSOLE / INTL-COMMS');
    Array.from(composer.querySelectorAll('button')).filter(b=>text(b)==='Отправить').forEach(b=>b.classList.add('icc-transmit-button'));
  }
  const traffic=panelFrom(exact(page,labels.traffic),page,'traffic');
  if(traffic){
    traffic.classList.add('icc-traffic');
    addPanelCode(traffic,'DISPATCH / MESSAGE-TRAFFIC');
  }
  updateClock(page);
}

installStyle();
let timer=0;
const schedule=()=>{clearTimeout(timer);timer=setTimeout(apply,45)};
const observe=()=>{
  const page=d.getElementById(PAGE_ID);
  if(!page)return false;
  const observer=new MutationObserver(schedule);
  observer.observe(page,{subtree:true,childList:true});
  apply();
  return true;
};
if(!observe()){
  const rootObserver=new MutationObserver(()=>{if(observe())rootObserver.disconnect()});
  rootObserver.observe(d.documentElement,{subtree:true,childList:true});
}
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')setTimeout(apply,40)});
setInterval(()=>{const page=d.getElementById(PAGE_ID);if(page?.classList.contains('rona-radio-icc'))updateClock(page)},1000);
setTimeout(apply,350);
setTimeout(apply,1200);
})();
