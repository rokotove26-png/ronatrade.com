(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_ICC_V2__)return;
window.__RONA_ADMIN_RADIO_ICC_V2__=true;

const d=document;
const PAGE_ID='page-messages';
const STYLE_ID='rona-admin-radio-icc-v2-style';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
const txt=el=>norm(el?.textContent);
const labels={total:'Всего активно',messages:'Сообщения',notices:'Уведомления',bulletins:'Объявления',composer:'Новое сообщение',traffic:'Активные сообщения'};

function installStyle(){
  if(d.getElementById(STYLE_ID))return;
  const s=d.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
#${PAGE_ID}.rona-radio-icc{
  --space:#020711;--deep:#06111f;--deep2:#081a2d;--panel:rgba(5,18,32,.92);
  --cyan:#5fe5ff;--blue:#4aa8ff;--violet:#8d7dff;--magenta:#dc67ff;--amber:#ffad54;--red:#ff5266;
  --text:#eef8fd;--muted:#7fa2b6;--line:rgba(113,210,247,.21);
  position:relative;isolation:isolate;overflow:hidden;
}
#${PAGE_ID}.rona-radio-icc::before{
  content:'';position:absolute;inset:0;z-index:-2;pointer-events:none;
  background:
    radial-gradient(900px 430px at 76% 3%,rgba(0,176,255,.17),transparent 68%),
    radial-gradient(720px 390px at 12% 72%,rgba(141,125,255,.09),transparent 72%),
    radial-gradient(520px 300px at 96% 79%,rgba(255,82,102,.06),transparent 74%);
}
#${PAGE_ID}.rona-radio-icc::after{
  content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.62;
  background-image:linear-gradient(rgba(95,229,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(95,229,255,.025) 1px,transparent 1px);
  background-size:30px 30px;mask-image:linear-gradient(to bottom,transparent 2%,#000 15%,#000 100%);
}

#${PAGE_ID}.rona-radio-icc .icc-orbit-bar{
  min-height:42px;margin:0 8px 14px;padding:0 15px;display:flex;align-items:center;gap:11px;
  border:1px solid rgba(95,229,255,.24);border-left:3px solid var(--cyan);border-radius:11px;
  background:linear-gradient(90deg,rgba(8,39,59,.94),rgba(6,18,33,.83) 56%,rgba(14,28,48,.9));
  box-shadow:0 12px 35px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.03);
  color:#93b8ca;font-size:9.5px;font-weight:900;letter-spacing:.145em;text-transform:uppercase;
}
#${PAGE_ID}.rona-radio-icc .icc-live-dot{width:8px;height:8px;min-width:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 16px var(--cyan)}
#${PAGE_ID}.rona-radio-icc .icc-sep{width:1px;height:15px;background:rgba(125,193,222,.24)}
#${PAGE_ID}.rona-radio-icc .icc-clock{margin-left:auto;color:#d3f7ff;font-variant-numeric:tabular-nums;letter-spacing:.13em}
#${PAGE_ID}.rona-radio-icc .icc-link-state{display:flex;align-items:center;gap:6px;color:#a7d8e9}
#${PAGE_ID}.rona-radio-icc .icc-link-state::before{content:'●';color:#62f2bf;font-size:8px;text-shadow:0 0 10px #62f2bf}

#${PAGE_ID}.rona-radio-icc .icc-stat,
#${PAGE_ID}.rona-radio-icc .icc-composer,
#${PAGE_ID}.rona-radio-icc .icc-traffic{
  position:relative!important;overflow:hidden!important;border-radius:15px!important;
  border:1px solid var(--line)!important;box-shadow:0 16px 42px rgba(0,0,0,.21),inset 0 1px rgba(255,255,255,.028)!important;
}
#${PAGE_ID}.rona-radio-icc .icc-stat{min-height:105px!important;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
#${PAGE_ID}.rona-radio-icc .icc-stat:hover{transform:translateY(-2px);box-shadow:0 20px 48px rgba(0,0,0,.25),0 0 26px rgba(95,229,255,.055)!important}
#${PAGE_ID}.rona-radio-icc .icc-stat::before{content:'';position:absolute;left:0;top:0;right:0;height:2px;opacity:.92}
#${PAGE_ID}.rona-radio-icc .icc-stat::after{position:absolute;right:12px;top:11px;font-size:7.5px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;opacity:.82}
#${PAGE_ID}.rona-radio-icc .icc-stat-total{background:radial-gradient(260px 110px at 100% 0,rgba(95,229,255,.12),transparent 74%),linear-gradient(145deg,rgba(8,35,53,.96),rgba(4,15,27,.94))!important;border-color:rgba(95,229,255,.27)!important}
#${PAGE_ID}.rona-radio-icc .icc-stat-total::before{background:linear-gradient(90deg,var(--cyan),transparent 74%)}
#${PAGE_ID}.rona-radio-icc .icc-stat-total::after{content:'NETWORK / 00';color:#6bc9e6}
#${PAGE_ID}.rona-radio-icc .icc-stat-msg{background:radial-gradient(260px 110px at 100% 0,rgba(74,168,255,.16),transparent 74%),linear-gradient(145deg,rgba(8,30,54,.96),rgba(4,14,28,.94))!important;border-color:rgba(74,168,255,.29)!important}
#${PAGE_ID}.rona-radio-icc .icc-stat-msg::before{background:linear-gradient(90deg,var(--blue),transparent 74%)}
#${PAGE_ID}.rona-radio-icc .icc-stat-msg::after{content:'TRAFFIC / MSG';color:#6caeff}
#${PAGE_ID}.rona-radio-icc .icc-stat-note{background:radial-gradient(260px 110px at 100% 0,rgba(141,125,255,.15),transparent 74%),linear-gradient(145deg,rgba(20,25,57,.96),rgba(5,14,29,.94))!important;border-color:rgba(141,125,255,.29)!important}
#${PAGE_ID}.rona-radio-icc .icc-stat-note::before{background:linear-gradient(90deg,var(--violet),transparent 74%)}
#${PAGE_ID}.rona-radio-icc .icc-stat-note::after{content:'TRAFFIC / NTF';color:#9b91ff}
#${PAGE_ID}.rona-radio-icc .icc-stat-bulletin{background:radial-gradient(260px 110px at 100% 0,rgba(255,173,84,.17),transparent 74%),linear-gradient(145deg,rgba(48,29,19,.96),rgba(7,14,26,.94))!important;border-color:rgba(255,173,84,.32)!important}
#${PAGE_ID}.rona-radio-icc .icc-stat-bulletin::before{background:linear-gradient(90deg,var(--amber),var(--red),transparent 78%)}
#${PAGE_ID}.rona-radio-icc .icc-stat-bulletin::after{content:'TRAFFIC / BLT';color:#ffb06a}
#${PAGE_ID}.rona-radio-icc .icc-stat [class*="value"],#${PAGE_ID}.rona-radio-icc .icc-stat [class*="count"],#${PAGE_ID}.rona-radio-icc .icc-stat strong{font-variant-numeric:tabular-nums;letter-spacing:-.04em;text-shadow:0 0 18px rgba(145,220,255,.09)}

#${PAGE_ID}.rona-radio-icc .icc-composer{background:radial-gradient(620px 200px at 80% 0,rgba(0,170,255,.105),transparent 72%),linear-gradient(145deg,rgba(8,27,44,.97),rgba(3,13,24,.95))!important;border-color:rgba(95,229,255,.27)!important;padding-top:max(48px,var(--icc-original-pad,0px))!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic{background:radial-gradient(720px 280px at 70% 12%,rgba(74,168,255,.08),transparent 70%),linear-gradient(145deg,rgba(7,24,40,.97),rgba(3,12,23,.96))!important;border-color:rgba(100,185,230,.24)!important;padding-top:max(48px,var(--icc-original-pad,0px))!important;min-height:300px!important}
#${PAGE_ID}.rona-radio-icc .icc-composer::before,#${PAGE_ID}.rona-radio-icc .icc-traffic::before{content:'';position:absolute;left:0;right:0;top:0;height:34px;border-bottom:1px solid rgba(95,229,255,.13);background:linear-gradient(90deg,rgba(23,87,120,.18),rgba(10,24,40,.1))}
#${PAGE_ID}.rona-radio-icc .icc-composer::after,#${PAGE_ID}.rona-radio-icc .icc-traffic::after{position:absolute;left:14px;top:11px;z-index:2;font-size:8.5px;font-weight:900;letter-spacing:.17em;text-transform:uppercase;color:#77a6ba;pointer-events:none}
#${PAGE_ID}.rona-radio-icc .icc-composer::after{content:'SECURE TRANSMISSION MODULE  /  GLOBAL ROUTING'}
#${PAGE_ID}.rona-radio-icc .icc-traffic::after{content:'GLOBAL MESSAGE TRAFFIC MONITOR  /  LIVE CHANNELS'}
#${PAGE_ID}.rona-radio-icc .icc-panel-code{position:absolute;right:14px;top:11px;z-index:3;color:#41677b;font-size:7.5px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;pointer-events:none}

#${PAGE_ID}.rona-radio-icc .icc-composer select,#${PAGE_ID}.rona-radio-icc .icc-composer input,#${PAGE_ID}.rona-radio-icc .icc-composer textarea{
  border:1px solid rgba(104,178,211,.27)!important;border-radius:10px!important;
  background:linear-gradient(180deg,rgba(2,11,20,.92),rgba(5,17,29,.9))!important;color:var(--text)!important;
  box-shadow:inset 0 1px rgba(255,255,255,.022)!important;outline:none!important;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease;
}
#${PAGE_ID}.rona-radio-icc .icc-composer select,#${PAGE_ID}.rona-radio-icc .icc-composer input{min-height:42px!important}
#${PAGE_ID}.rona-radio-icc .icc-composer textarea{display:block!important;width:100%!important;min-width:100%!important;max-width:100%!important;min-height:136px!important;height:136px!important;margin-top:10px!important;padding:14px 16px!important;line-height:1.48!important;resize:vertical!important;font-size:13px!important;background:radial-gradient(600px 130px at 100% 0,rgba(74,168,255,.055),transparent 72%),linear-gradient(180deg,rgba(2,11,20,.96),rgba(4,16,28,.95))!important}
#${PAGE_ID}.rona-radio-icc .icc-editor-host{display:block!important;width:100%!important;min-width:100%!important;max-width:100%!important;flex:1 1 100%!important;grid-column:1/-1!important}
#${PAGE_ID}.rona-radio-icc .icc-composer input::placeholder,#${PAGE_ID}.rona-radio-icc .icc-composer textarea::placeholder{color:#55798e!important}
#${PAGE_ID}.rona-radio-icc .icc-composer select:focus,#${PAGE_ID}.rona-radio-icc .icc-composer input:focus,#${PAGE_ID}.rona-radio-icc .icc-composer textarea:focus{border-color:rgba(95,229,255,.7)!important;box-shadow:0 0 0 3px rgba(95,229,255,.075),0 0 24px rgba(95,229,255,.045)!important}
#${PAGE_ID}.rona-radio-icc .icc-transmit-button{position:relative!important;min-height:39px!important;padding:0 20px 0 38px!important;border:1px solid rgba(95,229,255,.46)!important;border-radius:10px!important;background:linear-gradient(90deg,#117ea8,#10b8dc)!important;color:#eaffff!important;font-weight:900!important;letter-spacing:.025em!important;box-shadow:0 10px 26px rgba(0,154,207,.18),inset 0 1px rgba(255,255,255,.12)!important}
#${PAGE_ID}.rona-radio-icc .icc-transmit-button::before{content:'';position:absolute;left:16px;top:50%;width:8px;height:8px;border-radius:50%;transform:translateY(-50%);background:#82f6ff;box-shadow:0 0 14px #5fe5ff}
#${PAGE_ID}.rona-radio-icc .icc-transmit-button:hover{filter:brightness(1.08);box-shadow:0 12px 30px rgba(0,178,225,.25),0 0 24px rgba(95,229,255,.08)!important}

#${PAGE_ID}.rona-radio-icc .icc-traffic table{width:100%!important;border-collapse:separate!important;border-spacing:0!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic th{padding:10px!important;background:rgba(8,29,47,.88)!important;border-bottom:1px solid rgba(95,229,255,.16)!important;color:#7194a8!important;font-size:8.5px!important;font-weight:900!important;letter-spacing:.13em!important;text-transform:uppercase!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic td{border-bottom-color:rgba(95,229,255,.075)!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic tr:hover td{background:rgba(95,229,255,.033)!important}
#${PAGE_ID}.rona-radio-icc .icc-empty-orbit{margin:20px auto 8px;width:84px;height:84px;border:1px solid rgba(95,229,255,.27);border-radius:50%;position:relative;box-shadow:0 0 32px rgba(95,229,255,.07);pointer-events:none}
#${PAGE_ID}.rona-radio-icc .icc-empty-orbit::before{content:'';position:absolute;inset:14px;border:1px solid rgba(141,125,255,.26);border-radius:50%}
#${PAGE_ID}.rona-radio-icc .icc-empty-orbit::after{content:'';position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%);background:var(--cyan);box-shadow:0 0 16px var(--cyan)}

@media(max-width:900px){
 #${PAGE_ID}.rona-radio-icc .icc-orbit-bar{margin-inline:4px;gap:8px;overflow:hidden;white-space:nowrap}
 #${PAGE_ID}.rona-radio-icc .icc-hide-narrow{display:none}
 #${PAGE_ID}.rona-radio-icc .icc-stat{min-height:96px!important}
 #${PAGE_ID}.rona-radio-icc .icc-composer textarea{min-height:120px!important;height:120px!important}
}
@media(max-width:620px){
 #${PAGE_ID}.rona-radio-icc .icc-orbit-bar{font-size:8px;letter-spacing:.10em}
 #${PAGE_ID}.rona-radio-icc .icc-clock{display:none}
 #${PAGE_ID}.rona-radio-icc .icc-composer::after,#${PAGE_ID}.rona-radio-icc .icc-traffic::after{font-size:7px;letter-spacing:.1em;max-width:72%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
}
`;
  d.head.appendChild(s);
}

function exact(page,label){return Array.from(page.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span,p,label')).find(el=>txt(el)===label)}
function panelFrom(el,page,mode){
  if(!el)return null;const pr=page.getBoundingClientRect();let node=el,fallback=el.parentElement;
  while(node&&node.parentElement&&node.parentElement!==page){
    node=node.parentElement;const r=node.getBoundingClientRect(),t=txt(node),controls=node.querySelectorAll('input,select,textarea,button').length;
    if(mode==='stat'&&r.height>=58&&r.height<=200&&r.width>120&&(!pr.width||r.width<pr.width*.48)&&t.length<200)return node;
    if(mode==='composer'&&t.includes(labels.composer)&&controls>=3&&r.height>=70&&(!pr.width||r.width<=pr.width*.99))return node;
    if(mode==='traffic'&&t.includes(labels.traffic)&&r.height>=90&&(!pr.width||r.width<=pr.width*.99))return node;
    fallback=node;
  }
  return fallback&&fallback!==page?fallback:null;
}
function markStat(page,label,cls){const el=exact(page,label),box=panelFrom(el,page,'stat');if(box)box.classList.add('icc-stat',cls)}
function addCode(panel,code){if(!panel||panel.querySelector(':scope > .icc-panel-code'))return;const n=d.createElement('span');n.className='icc-panel-code';n.setAttribute('aria-hidden','true');n.textContent=code;panel.appendChild(n)}

function ensureOrbitBar(page){
  let bar=page.querySelector(':scope > .icc-orbit-bar');if(bar)return bar;
  bar=d.createElement('div');bar.className='icc-orbit-bar';bar.setAttribute('aria-hidden','true');
  bar.innerHTML='<span class="icc-live-dot"></span><span>SPACE COMMUNICATION NETWORK</span><span class="icc-sep"></span><span class="icc-hide-narrow">GLOBAL DISPATCH CONTROL</span><span class="icc-sep icc-hide-narrow"></span><span class="icc-link-state icc-hide-narrow">LIVE CHANNEL MONITORING</span><span class="icc-clock">UTC --:--:--</span>';
  const root=page.querySelector(':scope > .rona-rs-root[data-kind="radio"]');
  if(root){const first=root.firstElementChild;if(first)first.insertAdjacentElement('afterend',bar);else root.prepend(bar)}else page.prepend(bar);
  return bar;
}
function updateClock(page){const c=page.querySelector('.icc-clock');if(!c)return;const p=n=>String(n).padStart(2,'0'),now=new Date();c.textContent='UTC '+p(now.getUTCHours())+':'+p(now.getUTCMinutes())+':'+p(now.getUTCSeconds())}
function enhanceEditor(composer){
  if(!composer)return;
  const ta=composer.querySelector('textarea');
  if(ta){ta.classList.add('icc-message-editor');const host=ta.parentElement;if(host&&host!==composer)host.classList.add('icc-editor-host')}
  Array.from(composer.querySelectorAll('button')).filter(b=>txt(b)==='Отправить').forEach(b=>b.classList.add('icc-transmit-button'));
}
function enhanceTraffic(traffic){
  if(!traffic)return;
  const t=txt(traffic).toLowerCase();
  if((t.includes('нет')||t.includes('0'))&&!traffic.querySelector('.icc-empty-orbit')){
    const orbit=d.createElement('div');orbit.className='icc-empty-orbit';orbit.setAttribute('aria-hidden','true');
    const candidate=Array.from(traffic.querySelectorAll('div,p,span')).find(el=>/активн.*сообщ.*нет|нет активн.*сообщ/i.test(txt(el)));
    if(candidate)candidate.insertAdjacentElement('beforebegin',orbit);
  }
}
function apply(){
  const page=d.getElementById(PAGE_ID);if(!page)return;installStyle();page.classList.add('rona-radio-icc');ensureOrbitBar(page);
  markStat(page,labels.total,'icc-stat-total');markStat(page,labels.messages,'icc-stat-msg');markStat(page,labels.notices,'icc-stat-note');markStat(page,labels.bulletins,'icc-stat-bulletin');
  const composer=panelFrom(exact(page,labels.composer),page,'composer');if(composer){composer.classList.add('icc-composer');addCode(composer,'TX / INTL-COMMS');enhanceEditor(composer)}
  const traffic=panelFrom(exact(page,labels.traffic),page,'traffic');if(traffic){traffic.classList.add('icc-traffic');addCode(traffic,'DISPATCH / LIVE');enhanceTraffic(traffic)}
  updateClock(page);
}

installStyle();let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(apply,55)};
function observe(){const page=d.getElementById(PAGE_ID);if(!page)return false;new MutationObserver(schedule).observe(page,{subtree:true,childList:true});apply();return true}
if(!observe()){const ob=new MutationObserver(()=>{if(observe())ob.disconnect()});ob.observe(d.documentElement,{subtree:true,childList:true})}
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')setTimeout(apply,40)});
setInterval(()=>{const page=d.getElementById(PAGE_ID);if(page?.classList.contains('rona-radio-icc'))updateClock(page)},1000);
setTimeout(apply,350);setTimeout(apply,1200);
})();