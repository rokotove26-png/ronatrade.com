(()=>{'use strict';
const MARK='20260830-client-home-night-panel-v4';
if(window.__RONA_CLIENT_HOME_NIGHT_RUNTIME__===MARK)return;
window.__RONA_CLIENT_HOME_NIGHT_RUNTIME__=MARK;
if(location.pathname!=='/portal/client')return;

const OWNER='[data-rona-client-home-owner="command-center-v2"]';
const STYLE_ID='rona-client-home-night-panel-v4-style';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim().toLowerCase();

function panelByTitle(root,needle){
  return [...root.querySelectorAll('.rona-cc-panel')].find(panel=>norm(panel.querySelector('.rona-cc-panel-title')?.textContent).includes(needle))||null;
}
function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    ${OWNER}[data-rona-home-night="v4"]{gap:14px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-main{display:grid!important;grid-template-columns:minmax(0,1.82fr) minmax(300px,.82fr)!important;gap:16px!important;align-items:start!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-night-left,${OWNER}[data-rona-home-night="v4"] .rona-cc-stack{display:grid!important;gap:16px!important;align-content:start!important;min-width:0}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-bottom[data-rona-night-empty="true"]{display:none!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-livebar{position:relative!important;border-color:rgba(83,207,247,.42)!important;box-shadow:inset 0 1px 0 rgba(230,250,255,.06),inset 0 0 28px rgba(32,150,205,.045),0 0 0 1px rgba(21,93,125,.18),0 0 26px rgba(25,154,210,.085),0 18px 42px rgba(0,0,0,.18)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-livebar::after{content:"";position:absolute;left:18px;right:18px;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(93,220,255,.82),rgba(82,221,181,.72),transparent);box-shadow:0 0 12px rgba(72,203,240,.42);pointer-events:none}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel{position:relative!important;isolation:isolate;border-color:rgba(79,177,218,.30)!important;box-shadow:inset 0 1px 0 rgba(225,248,255,.045),inset 0 0 34px rgba(39,133,176,.035),0 0 0 1px rgba(14,69,96,.14),0 0 24px rgba(32,143,190,.055),0 18px 42px rgba(0,0,0,.14)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi::before,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel::before{content:"";position:absolute;z-index:3;left:16px;right:16px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(78,203,246,.74),transparent);box-shadow:0 0 10px rgba(61,188,232,.30);opacity:.82;pointer-events:none}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="finance"],${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="finance"]{border-color:rgba(74,215,174,.34)!important;box-shadow:inset 0 1px 0 rgba(230,255,247,.045),inset 0 0 34px rgba(52,164,126,.035),0 0 0 1px rgba(25,88,71,.13),0 0 26px rgba(55,204,158,.065),0 18px 42px rgba(0,0,0,.14)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="finance"]::before,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="finance"]::before{background:linear-gradient(90deg,transparent,rgba(79,229,181,.78),transparent);box-shadow:0 0 11px rgba(77,220,176,.34)}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="attention"]{border-color:rgba(221,185,83,.31)!important;box-shadow:inset 0 1px 0 rgba(255,246,216,.035),inset 0 0 30px rgba(171,127,32,.028),0 0 0 1px rgba(100,75,24,.12),0 0 22px rgba(202,156,51,.045),0 18px 42px rgba(0,0,0,.14)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="attention"]::before{background:linear-gradient(90deg,transparent,rgba(239,194,79,.65),transparent);box-shadow:0 0 10px rgba(219,174,65,.25)}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-pill{box-shadow:inset 0 0 10px rgba(68,176,219,.045),0 0 10px rgba(62,179,222,.035)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-pill[data-tone="ok"]{box-shadow:inset 0 0 10px rgba(73,211,161,.055),0 0 12px rgba(68,210,159,.055)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-pill[data-tone="wait"]{box-shadow:inset 0 0 10px rgba(225,183,74,.045),0 0 11px rgba(222,178,66,.045)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-open{box-shadow:inset 0 1px 0 rgba(222,247,255,.05),0 0 14px rgba(55,177,224,.055)!important;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease,transform .15s ease!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-open:hover{box-shadow:inset 0 1px 0 rgba(230,250,255,.07),0 0 20px rgba(64,196,239,.14)!important;transform:translateY(-1px)}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-action{box-shadow:inset 0 1px 0 rgba(225,248,255,.035),inset 0 0 22px rgba(39,140,183,.025),0 0 12px rgba(46,163,206,.035)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-action:hover{box-shadow:inset 0 1px 0 rgba(235,252,255,.06),inset 0 0 24px rgba(45,162,207,.05),0 0 22px rgba(57,188,230,.12)!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-finance-track{position:relative;box-shadow:inset 0 0 8px rgba(27,93,116,.38),0 0 10px rgba(52,181,211,.035)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-finance-track>i,${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-progress>i{box-shadow:0 0 10px rgba(70,210,185,.26),0 0 18px rgba(55,176,224,.16)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-live-dot{box-shadow:0 0 0 5px rgba(84,219,162,.09),0 0 16px rgba(84,219,162,.58),0 0 30px rgba(84,219,162,.20)!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-alert{border-color:rgba(87,164,197,.16)!important;box-shadow:inset 0 1px 0 rgba(221,247,255,.018),inset 0 0 16px rgba(35,126,164,.018)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-alert{background:linear-gradient(155deg,rgba(10,39,56,.64),rgba(7,28,42,.52))!important}

    @media(max-width:1220px){
      ${OWNER}[data-rona-home-night="v4"] .rona-cc-main{grid-template-columns:1fr!important}
    }
  `;
  document.head.appendChild(style);
}
function reflow(owner){
  if(!owner)return;
  owner.setAttribute('data-rona-home-night','v4');
  const main=owner.querySelector('.rona-cc-main');
  const bottom=owner.querySelector('.rona-cc-bottom');
  if(!main||!bottom)return;
  const left=main.firstElementChild;
  const right=main.querySelector('.rona-cc-stack')||main.lastElementChild;
  if(!left||!right)return;
  left.classList.add('rona-night-left');
  const finance=bottom.querySelector('[data-visual-panel="finance"]')||panelByTitle(bottom,'финансов');
  const control=bottom.querySelector('[data-visual-panel="control"]')||panelByTitle(bottom,'контур управления');
  if(finance&&finance.parentElement!==left)left.appendChild(finance);
  if(control&&control.parentElement!==right)right.appendChild(control);
  bottom.setAttribute('data-rona-night-empty',bottom.children.length===0?'true':'false');
}
let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;installStyle();reflow(document.querySelector(OWNER));});
}
function start(){
  installStyle();schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
