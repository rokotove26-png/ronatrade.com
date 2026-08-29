(()=>{
'use strict';
const MARK='20260829-client-deal-canonical-visual-v2-v5-compact';
if(window.__RONA_CLIENT_DEAL_CANONICAL_VISUAL__===MARK)return;
window.__RONA_CLIENT_DEAL_CANONICAL_VISUAL__=MARK;
if(location.pathname!=='/portal/client')return;

const PANEL='rona-deal-documents-v5';
const HOST='rona-deal-card-v5';
const STYLE_ID='rona-client-deal-canonical-visual-v2-style';

function apply(){
  document.getElementById(`${PANEL}-style`)?.remove();
  document.getElementById('rona-client-deal-canonical-visual-v1-style')?.remove();
  document.getElementById(STYLE_ID)?.remove();
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
.${HOST}{min-width:0!important;min-height:72px!important;box-sizing:border-box!important;padding-top:10px!important;padding-bottom:10px!important;align-items:center!important;overflow:visible!important}
.${HOST} *{box-sizing:border-box}
.${HOST}__dealid{font-size:13.4px!important;font-weight:820!important;line-height:1.28!important;letter-spacing:.015em!important;color:rgba(244,249,255,.98)!important;white-space:nowrap!important}
.${HOST}__detail{font-size:11.45px!important;font-weight:540!important;line-height:1.45!important;color:rgba(203,213,225,.78)!important;white-space:normal!important;overflow:visible!important}
.${HOST}__sumlabel{font-size:10.5px!important;font-weight:690!important;line-height:1.25!important;color:rgba(148,163,184,.76)!important;white-space:nowrap!important}
.${HOST}__amount{font-size:13.1px!important;font-weight:810!important;line-height:1.25!important;color:rgba(226,252,239,.94)!important;white-space:nowrap!important}
.${HOST}__status{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:26px!important;height:26px!important;box-sizing:border-box!important;padding:0 11px!important;border-radius:999px!important;font-size:10.7px!important;font-weight:760!important;line-height:1!important;white-space:nowrap!important;vertical-align:middle!important;margin-top:0!important;margin-bottom:0!important;transform:none!important;align-self:center!important}
.${HOST}__resource-ok{gap:5px!important;border:1px solid rgba(74,222,128,.25)!important;background:rgba(34,197,94,.065)!important;color:rgba(187,247,208,.92)!important}
.${HOST}__resource-ok::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.9}
.${HOST}__resource-no{gap:5px!important;border:1px solid rgba(250,204,21,.30)!important;background:rgba(234,179,8,.07)!important;color:rgba(254,240,138,.92)!important}
.${HOST}__resource-no::before{content:'';display:block;width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.88}
.${HOST}__open{min-height:30px!important;height:30px!important;padding:0 12px!important;font-size:10.8px!important;font-weight:750!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
.${PANEL}{width:100%!important;min-width:0!important;box-sizing:border-box!important;grid-column:1/-1!important;flex:0 0 100%!important;display:flex!important;align-items:center!important;gap:10px!important;margin:0!important;padding:10px 2px 7px!important;border-top:1px solid rgba(113,154,184,.13)!important;font-family:inherit!important;color:inherit!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
.${PANEL}::-webkit-scrollbar{display:none}
.${PANEL}__label{flex:0 0 auto;font-size:10.8px!important;font-weight:780!important;line-height:1!important;color:rgba(203,213,225,.62)!important;white-space:nowrap!important;text-transform:none!important}
.${PANEL}__actions{display:flex!important;align-items:center!important;gap:9px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:0!important}
.${PANEL}__action{position:relative;appearance:none;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;flex:0 0 auto!important;min-height:34px!important;height:34px!important;padding:0 12px!important;border:1px solid rgba(93,180,226,.42)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(19,66,97,.92),rgba(8,39,62,.94))!important;box-shadow:0 4px 12px rgba(1,8,16,.19),inset 0 1px 0 rgba(255,255,255,.07)!important;color:rgba(244,250,255,.96)!important;font:760 11.2px/1 inherit!important;letter-spacing:.004em!important;cursor:pointer!important;white-space:nowrap!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,filter .16s ease!important}
.${PANEL}__action::before{display:grid;place-items:center;width:18px;height:18px;flex:0 0 18px;border-radius:6px;background:rgba(125,211,252,.10);border:1px solid rgba(125,211,252,.18);font-size:11px;font-weight:800;line-height:1;color:rgba(186,230,253,.96)}
.${PANEL}__action--download::before{content:'↓'}
.${PANEL}__action--signed::before{content:'✓';background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.18);color:rgba(187,247,208,.96)}
.${PANEL}__action:hover{transform:translateY(-1px)!important;border-color:rgba(125,211,252,.70)!important;box-shadow:0 7px 18px rgba(1,8,16,.27),0 0 0 1px rgba(56,189,248,.07),inset 0 1px 0 rgba(255,255,255,.10)!important;filter:brightness(1.08)!important}
.${PANEL}__action:active{transform:translateY(0)!important}
.${PANEL}__action:disabled{opacity:.56!important;cursor:wait!important;transform:none!important;filter:none!important}
.${PANEL}__action--upload{overflow:hidden!important;border-color:rgba(248,113,113,.70)!important;background:linear-gradient(105deg,#7d1c2a,#b82e3b,#7d1c2a)!important;background-size:220% 100%!important;box-shadow:0 6px 18px rgba(127,29,29,.28),0 0 0 1px rgba(239,68,68,.06),inset 0 1px 0 rgba(255,255,255,.10)!important;animation:ronaSignedDsCanonicalV2Pulse 2.4s ease-in-out infinite,ronaSignedDsCanonicalV2Flow 4s linear infinite!important;color:#fff5f5!important}
.${PANEL}__action--upload::before{content:'↑';background:rgba(255,255,255,.10);border-color:rgba(254,202,202,.32);color:#fff1f2}
.${PANEL}__action--upload::after{content:'';position:absolute;top:-35%;bottom:-35%;left:-48%;width:34%;transform:skewX(-18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent);animation:ronaSignedDsCanonicalV2Sweep 3.1s ease-in-out infinite;pointer-events:none}
.${PANEL}__stage{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;height:26px;box-sizing:border-box;padding:0 10px;border-radius:999px;border:1px solid rgba(96,165,250,.24);background:rgba(59,130,246,.07);color:rgba(191,219,254,.90);font-size:10.7px;font-weight:760;line-height:1;white-space:nowrap;flex:0 0 auto}
.${PANEL}__empty{font-size:10.8px;line-height:1.3;color:rgba(203,213,225,.48);white-space:nowrap}
.${PANEL}__error{font-size:10.8px;line-height:1.25;color:#fca5a5;white-space:nowrap}
@keyframes ronaSignedDsCanonicalV2Flow{0%{background-position:100% 0}100%{background-position:-100% 0}}
@keyframes ronaSignedDsCanonicalV2Pulse{0%,100%{box-shadow:0 6px 18px rgba(127,29,29,.22),0 0 0 1px rgba(239,68,68,.05)}50%{box-shadow:0 8px 24px rgba(127,29,29,.38),0 0 18px rgba(239,68,68,.22)}}
@keyframes ronaSignedDsCanonicalV2Sweep{0%,24%{left:-48%;opacity:0}40%{opacity:1}62%{left:116%;opacity:0}100%{left:116%;opacity:0}}
@media(max-width:760px){.${HOST}{min-height:76px!important}.${PANEL}{gap:8px!important}.${PANEL}__action{min-height:36px!important;height:36px!important}}
@media(prefers-reduced-motion:reduce){.${PANEL}__action--upload,.${PANEL}__action--upload::after{animation:none!important}}
`;
  document.head.appendChild(s);
  document.documentElement.dataset.ronaDealVisual='canonical-compact-v2';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
window.addEventListener('pageshow',()=>{if(document.getElementById(`${PANEL}-style`)||!document.getElementById(STYLE_ID))apply()},{passive:true});
})();
