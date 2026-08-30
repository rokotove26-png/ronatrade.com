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
    ${OWNER}[data-rona-home-night="v4"]{gap:12px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-main{display:grid!important;grid-template-columns:minmax(0,1.82fr) minmax(300px,.82fr)!important;gap:14px!important;align-items:start!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-night-left,${OWNER}[data-rona-home-night="v4"] .rona-cc-stack{display:grid!important;gap:14px!important;align-content:start!important;min-width:0}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-bottom[data-rona-night-empty="true"]{display:none!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel{height:auto!important;min-height:0!important;align-self:start!important;overflow:hidden!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel-head{min-height:56px!important;padding:13px 16px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-deal{min-height:82px!important;padding:13px 15px!important;gap:12px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-attention{gap:8px!important;padding:10px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-alert{padding:11px 12px 11px 15px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-finance{gap:12px!important;padding:13px 16px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-finance-row{min-height:38px!important;gap:12px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-actions{gap:9px!important;padding:10px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-attention{gap:8px!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-alert{min-height:72px!important;padding:11px 12px!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-livebar{position:relative!important;border-color:rgba(83,207,247,.56)!important;box-shadow:inset 0 1px 0 rgba(230,250,255,.08),inset 0 0 28px rgba(32,150,205,.05),0 0 0 1px rgba(42,150,195,.20),0 0 24px rgba(25,176,226,.12),0 14px 32px rgba(0,0,0,.16)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-livebar::after{content:"";position:absolute;left:18px;right:18px;bottom:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(93,220,255,.88),rgba(82,221,181,.78),transparent);box-shadow:0 0 12px rgba(72,203,240,.48);pointer-events:none}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-live-title{color:#aeeaff!important;text-shadow:0 0 10px rgba(81,205,247,.24)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-live-note{color:#86bbcf!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel{position:relative!important;isolation:isolate;border-color:rgba(79,190,229,.46)!important;box-shadow:inset 0 1px 0 rgba(225,248,255,.06),inset 0 0 28px rgba(39,133,176,.04),0 0 0 1px rgba(44,143,184,.17),0 0 20px rgba(32,158,205,.08),0 14px 32px rgba(0,0,0,.13)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi::before,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel::before{content:"";position:absolute;z-index:3;left:16px;right:16px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,rgba(78,211,250,.86),transparent);box-shadow:0 0 10px rgba(61,188,232,.38);opacity:.92;pointer-events:none}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-label{color:#8fc9de!important;text-shadow:0 0 8px rgba(67,178,220,.14)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-value{color:#e6f9ff!important;text-shadow:0 0 13px rgba(93,214,248,.13)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-note{color:#8eb6c6!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="finance"],${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="finance"]{border-color:rgba(74,225,176,.52)!important;box-shadow:inset 0 1px 0 rgba(230,255,247,.07),inset 0 0 28px rgba(52,164,126,.045),0 0 0 1px rgba(46,164,126,.16),0 0 22px rgba(55,218,166,.10),0 14px 32px rgba(0,0,0,.13)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="finance"]::before,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="finance"]::before{background:linear-gradient(90deg,transparent,rgba(79,239,188,.88),transparent);box-shadow:0 0 11px rgba(77,220,176,.44)}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="finance"] .rona-cc-kpi-value,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="finance"] .rona-cc-panel-title,${OWNER}[data-rona-home-night="v4"] .rona-cc-finance-code,${OWNER}[data-rona-home-night="v4"] .rona-cc-finance-values b{color:#92e8bf!important;text-shadow:0 0 10px rgba(76,225,170,.18)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="resource"] .rona-cc-kpi-value{color:#a9d6ff!important;text-shadow:0 0 10px rgba(92,170,243,.18)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="wide"] .rona-cc-kpi-value{color:#c5f4f2!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="attention"]{border-color:rgba(232,190,78,.52)!important;box-shadow:inset 0 1px 0 rgba(255,246,216,.055),inset 0 0 26px rgba(171,127,32,.035),0 0 0 1px rgba(171,127,41,.15),0 0 20px rgba(222,172,55,.08),0 14px 32px rgba(0,0,0,.13)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="attention"]::before{background:linear-gradient(90deg,transparent,rgba(247,202,86,.84),transparent);box-shadow:0 0 10px rgba(231,183,69,.34)}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="attention"] .rona-cc-panel-title{color:#f0cd77!important;text-shadow:0 0 10px rgba(227,180,65,.16)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="actions"]{border-color:rgba(73,206,246,.50)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="actions"] .rona-cc-panel-title{color:#8de1ff!important;text-shadow:0 0 10px rgba(72,197,239,.18)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="control"]{border-color:rgba(96,171,240,.46)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-panel-title{color:#a6d2ff!important;text-shadow:0 0 10px rgba(91,164,235,.16)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel:not([data-visual-panel="attention"]):not([data-visual-panel="finance"]):not([data-visual-panel="actions"]):not([data-visual-panel="control"]) .rona-cc-panel-title{color:#b9ebfb!important;text-shadow:0 0 9px rgba(75,193,232,.15)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel-sub,${OWNER}[data-rona-home-night="v4"] .rona-cc-panel-meta{color:#7faabd!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-deal-id{color:#8edfff!important;text-shadow:0 0 9px rgba(69,192,236,.16)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-deal-product{color:#e7f7fc!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-deal-route,${OWNER}[data-rona-home-night="v4"] .rona-cc-label{color:#79a9ba!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-pill{border-color:rgba(82,188,228,.34)!important;color:#bde9f8!important;box-shadow:inset 0 0 10px rgba(68,176,219,.055),0 0 10px rgba(62,179,222,.05)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-pill[data-tone="ok"]{border-color:rgba(75,217,164,.42)!important;color:#99e8bd!important;box-shadow:inset 0 0 10px rgba(73,211,161,.07),0 0 12px rgba(68,210,159,.075)!important;text-shadow:0 0 8px rgba(65,210,158,.15)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-pill[data-tone="wait"]{border-color:rgba(229,187,74,.40)!important;color:#e9c875!important;box-shadow:inset 0 0 10px rgba(225,183,74,.055),0 0 11px rgba(222,178,66,.06)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-open{border-color:rgba(79,193,233,.36)!important;color:#aee7fa!important;box-shadow:inset 0 1px 0 rgba(222,247,255,.06),0 0 14px rgba(55,177,224,.07)!important;transition:border-color .15s ease,background .15s ease,box-shadow .15s ease,transform .15s ease!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-open:hover{border-color:rgba(97,217,255,.56)!important;color:#d8f6ff!important;box-shadow:inset 0 1px 0 rgba(230,250,255,.08),0 0 20px rgba(64,196,239,.16)!important;transform:translateY(-1px)}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-action{border-color:rgba(80,187,227,.34)!important;color:#aee7fa!important;box-shadow:inset 0 1px 0 rgba(225,248,255,.045),inset 0 0 18px rgba(39,140,183,.03),0 0 12px rgba(46,163,206,.05)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-action span{color:#78aabd!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-action:hover{border-color:rgba(96,215,252,.52)!important;color:#d9f7ff!important;box-shadow:inset 0 1px 0 rgba(235,252,255,.07),inset 0 0 20px rgba(45,162,207,.06),0 0 22px rgba(57,188,230,.14)!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-finance-track{position:relative;box-shadow:inset 0 0 8px rgba(27,93,116,.38),0 0 10px rgba(52,181,211,.05)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-finance-track>i,${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-progress>i{box-shadow:0 0 10px rgba(70,210,185,.30),0 0 18px rgba(55,176,224,.18)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-live-dot{box-shadow:0 0 0 5px rgba(84,219,162,.10),0 0 16px rgba(84,219,162,.62),0 0 30px rgba(84,219,162,.22)!important}

    ${OWNER}[data-rona-home-night="v4"] .rona-cc-alert{border-color:rgba(87,177,211,.22)!important;box-shadow:inset 0 1px 0 rgba(221,247,255,.025),inset 0 0 14px rgba(35,126,164,.022)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-alert strong{color:#c8edf8!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-alert[data-tone="wait"] strong{color:#edcb79!important;text-shadow:0 0 8px rgba(218,170,61,.13)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-alert[data-tone="ok"] strong{color:#96e4b9!important;text-shadow:0 0 8px rgba(64,201,143,.13)!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-alert{background:linear-gradient(155deg,rgba(10,39,56,.64),rgba(7,28,42,.52))!important}

    @media(max-width:1220px){
      ${OWNER}[data-rona-home-night="v4"] .rona-cc-main{grid-template-columns:1fr!important}
      ${OWNER}[data-rona-home-night="v4"] .rona-cc-panel-head{min-height:54px!important}
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
