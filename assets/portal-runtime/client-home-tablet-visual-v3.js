(()=>{'use strict';
const MARK='20260830-client-home-tablet-visual-v3';
if(window.__RONA_CLIENT_HOME_VISUAL_RUNTIME__===MARK)return;
window.__RONA_CLIENT_HOME_VISUAL_RUNTIME__=MARK;
if(location.pathname!=='/portal/client')return;

const OWNER='[data-rona-client-home-owner="command-center-v2"]';
const STYLE_ID='rona-client-home-tablet-visual-v3-style';
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    ${OWNER}[data-rona-home-visual="tablet-v3"]{gap:16px!important;padding-bottom:30px!important;color:#e3f2f8!important;font-size:12px!important;line-height:1.42!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-livebar{min-height:56px!important;padding:13px 17px!important;border-radius:15px!important;border-color:rgba(71,183,226,.30)!important;background:linear-gradient(105deg,rgba(5,34,53,.98),rgba(7,26,42,.92) 58%,rgba(7,43,57,.82))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 14px 34px rgba(0,0,0,.16)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-live-dot{width:9px!important;height:9px!important;box-shadow:0 0 0 5px rgba(84,219,162,.10),0 0 20px rgba(84,219,162,.52)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-live-title{font-size:13px!important;letter-spacing:.055em!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-live-note{font-size:11px!important;color:#94b8c7!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpis{display:grid!important;grid-template-columns:1.18fr 1fr 1fr!important;grid-auto-rows:minmax(88px,auto)!important;gap:14px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi{min-height:108px!important;padding:17px 18px!important;border-radius:16px!important;border-color:rgba(83,167,205,.26)!important;background:linear-gradient(150deg,rgba(8,34,53,.98),rgba(5,22,37,.91))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 16px 38px rgba(0,0,0,.13)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi[data-visual-rank="hero"]{grid-row:span 2!important;min-height:214px!important;padding:22px!important;border-color:rgba(73,192,234,.34)!important;background:linear-gradient(145deg,rgba(8,43,64,.98),rgba(5,24,39,.94) 58%,rgba(6,38,49,.90))!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi[data-visual-rank="finance"]{background:linear-gradient(145deg,rgba(9,37,49,.98),rgba(5,27,35,.94))!important;border-color:rgba(73,205,169,.28)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi[data-visual-rank="resource"]{background:linear-gradient(145deg,rgba(10,31,51,.98),rgba(7,24,39,.94))!important;border-color:rgba(95,163,231,.28)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi[data-visual-rank="wide"]{grid-column:span 2!important;min-height:108px!important;background:linear-gradient(110deg,rgba(12,31,48,.98),rgba(12,27,43,.92),rgba(22,45,45,.80))!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi::after{width:150px!important;height:150px!important;right:-54px!important;top:-76px!important;border-color:rgba(79,193,234,.09)!important;box-shadow:0 0 0 26px rgba(79,193,234,.018),0 0 0 52px rgba(79,193,234,.010)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi-label{font-size:11px!important;letter-spacing:.105em!important;color:#87adbd!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi-value{margin-top:13px!important;font-size:34px!important;line-height:1.02!important;letter-spacing:-.035em!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi[data-visual-rank="hero"] .rona-cc-kpi-value{margin-top:20px!important;font-size:48px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi-value[data-size="compact"]{font-size:24px!important;line-height:1.1!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi-note{margin-top:10px!important;font-size:11.5px!important;line-height:1.42!important;color:#94b5c2!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi-progress{height:7px!important;margin-top:14px!important;background:rgba(104,156,179,.16)!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-main{grid-template-columns:minmax(0,1.82fr) minmax(300px,.82fr)!important;gap:16px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-stack{gap:16px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel{border-radius:16px!important;border-color:rgba(81,163,199,.24)!important;background:linear-gradient(180deg,rgba(6,29,46,.96),rgba(4,20,34,.91))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 16px 40px rgba(0,0,0,.13)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="attention"]{border-color:rgba(215,178,83,.25)!important;background:linear-gradient(160deg,rgba(38,34,22,.67),rgba(7,26,40,.96) 62%)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="actions"]{border-color:rgba(78,184,224,.28)!important;background:linear-gradient(150deg,rgba(6,37,55,.97),rgba(7,25,40,.94))!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="finance"]{border-color:rgba(72,205,168,.24)!important;background:linear-gradient(120deg,rgba(6,33,43,.97),rgba(5,23,37,.94) 70%)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="control"]{background:linear-gradient(145deg,rgba(11,28,43,.94),rgba(8,23,36,.90))!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel-head{padding:17px 18px!important;min-height:67px!important;border-bottom-color:rgba(92,166,196,.16)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel-title{font-size:16px!important;line-height:1.2!important;letter-spacing:.018em!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel-sub{margin-top:5px!important;font-size:11px!important;line-height:1.35!important;color:#7fa5b5!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel-meta{font-size:10.5px!important;color:#7fa5b5!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal{grid-template-columns:minmax(215px,1.4fr) minmax(135px,.82fr) minmax(145px,.92fr) minmax(145px,.92fr) auto!important;gap:14px!important;min-height:96px!important;padding:16px 17px!important;border-bottom-color:rgba(86,151,178,.14)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal:hover{background:rgba(27,82,108,.13)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal-id{font-size:14.5px!important;letter-spacing:.012em!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal-product{margin-top:6px!important;font-size:12px!important;line-height:1.4!important;color:#dceef5!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal-route{margin-top:5px!important;font-size:10.5px!important;line-height:1.35!important;color:#80a3b2!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-label{margin-bottom:7px!important;font-size:9.5px!important;letter-spacing:.09em!important;color:#729aaa!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-pill{min-height:31px!important;padding:5px 10px!important;font-size:11px!important;line-height:1.25!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-open{min-height:42px!important;padding:0 15px!important;border-radius:10px!important;font-size:12px!important;letter-spacing:.01em!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-empty{padding:34px 20px!important;font-size:12px!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-attention{gap:10px!important;padding:13px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-alert{padding:13px 13px 13px 17px!important;border-radius:11px!important;background:rgba(8,33,48,.58)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-alert::before{top:11px!important;bottom:11px!important;width:3px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-alert strong{font-size:12px!important;line-height:1.35!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-alert span{margin-top:6px!important;font-size:10.5px!important;line-height:1.45!important;color:#88aab8!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-bottom{grid-template-columns:minmax(0,1.55fr) minmax(315px,.72fr)!important;gap:16px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance{gap:14px!important;padding:16px 18px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance-row{grid-template-columns:92px 1fr auto!important;gap:14px!important;min-height:42px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance-code{font-size:12.5px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance-track{height:10px!important;background:rgba(103,157,178,.16)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance-values{font-size:11px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance-foot{font-size:10.5px!important;color:#86a8b7!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-actions{grid-template-columns:1fr 1fr!important;gap:10px!important;padding:13px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-action{position:relative;min-height:68px!important;padding:13px 34px 12px 13px!important;border-radius:12px!important;border-color:rgba(86,171,207,.23)!important;background:linear-gradient(145deg,rgba(10,45,64,.72),rgba(7,32,48,.64))!important;font-size:13px!important;line-height:1.25!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-action::after{content:"→";position:absolute;right:13px;top:50%;transform:translateY(-50%);color:#62c5e9;font-size:18px;font-weight:400;opacity:.78}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-action:hover{transform:translateY(-1px);border-color:rgba(95,201,238,.42)!important;background:linear-gradient(145deg,rgba(12,57,79,.80),rgba(8,38,55,.74))!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-action span{margin-top:6px!important;font-size:10.5px!important;line-height:1.3!important;color:#7ea5b5!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-attention{grid-template-columns:1fr 1fr 1fr!important;gap:9px!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-alert{min-height:88px!important;padding:13px!important;border-color:rgba(91,157,187,.16)!important;background:rgba(9,34,49,.52)!important}
    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-alert::before{display:none!important}

    ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-context-required{padding:26px!important;border-radius:15px!important;font-size:13px!important}

    @media(max-width:1220px){
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpis{grid-template-columns:1fr 1fr!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi[data-visual-rank="hero"]{grid-row:auto!important;min-height:132px!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpi[data-visual-rank="wide"]{grid-column:span 1!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-main,${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-bottom{grid-template-columns:1fr!important}
    }
    @media(max-width:900px){
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal{grid-template-columns:1fr 1fr!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal>div:first-child{grid-column:1/-1!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-panel[data-visual-panel="control"] .rona-cc-attention{grid-template-columns:1fr!important}
    }
    @media(max-width:680px){
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-kpis,${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-actions{grid-template-columns:1fr!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-deal{grid-template-columns:1fr!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance-row{grid-template-columns:72px 1fr!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-finance-values{grid-column:1/-1!important;text-align:left!important}
      ${OWNER}[data-rona-home-visual="tablet-v3"] .rona-cc-livebar{align-items:flex-start!important;flex-direction:column!important}
    }
  `;
  document.head.appendChild(style);
}

function classify(owner){
  if(!owner)return;
  owner.setAttribute('data-rona-home-visual','tablet-v3');
  const kpis=[...owner.querySelectorAll('.rona-cc-kpi')];
  const ranks=['hero','finance','resource','wide'];
  kpis.forEach((el,i)=>el.setAttribute('data-visual-rank',ranks[i]||'standard'));
  for(const panel of owner.querySelectorAll('.rona-cc-panel')){
    const title=norm(panel.querySelector('.rona-cc-panel-title')?.textContent).toLowerCase();
    let kind='standard';
    if(title.includes('требует внимания'))kind='attention';
    else if(title.includes('быстрые действия'))kind='actions';
    else if(title.includes('финансов'))kind='finance';
    else if(title.includes('контур управления'))kind='control';
    else if(title.includes('сделки'))kind='deals';
    panel.setAttribute('data-visual-panel',kind);
  }
}

let scheduled=false;
function schedule(){
  if(scheduled)return;scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;installStyle();classify(document.querySelector(OWNER))});
}
function start(){
  installStyle();schedule();
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();