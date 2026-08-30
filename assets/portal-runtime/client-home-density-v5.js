(()=>{'use strict';
const MARK='20260830-client-home-density-v5';
if(window.__RONA_CLIENT_HOME_DENSITY_RUNTIME__===MARK)return;
window.__RONA_CLIENT_HOME_DENSITY_RUNTIME__=MARK;
if(location.pathname!=='/portal/client')return;

const OWNER='[data-rona-client-home-owner="command-center-v2"]';
const STYLE_ID='rona-client-home-density-v5-style';
if(document.getElementById(STYLE_ID))return;
const style=document.createElement('style');
style.id=STYLE_ID;
style.textContent=`
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-auto-rows:auto!important;gap:10px!important;align-items:start!important}
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi{min-height:0!important;height:auto!important;align-self:start!important;padding:12px 14px!important;border-radius:13px!important}
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="hero"]{grid-row:auto!important;grid-column:auto!important;min-height:0!important;padding:12px 14px!important}
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="wide"]{grid-column:auto!important;min-height:0!important}
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-value,${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="hero"] .rona-cc-kpi-value{margin-top:9px!important;font-size:31px!important;line-height:1.02!important}
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-value[data-size="compact"]{font-size:22px!important;line-height:1.08!important}
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-note{margin-top:7px!important;font-size:10.5px!important;line-height:1.32!important}
  ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi-progress{height:6px!important;margin-top:8px!important}
  @media(max-width:1180px){
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}
    ${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="hero"],${OWNER}[data-rona-home-night="v4"] .rona-cc-kpi[data-visual-rank="wide"]{grid-row:auto!important;grid-column:auto!important}
  }
  @media(max-width:720px){${OWNER}[data-rona-home-night="v4"] .rona-cc-kpis{grid-template-columns:1fr!important}}
`;
document.head.appendChild(style);
})();
