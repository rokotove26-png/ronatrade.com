(()=>{
'use strict';
const MARK='20260830-client-deal-canonical-visual-v2-v6-composed';
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
.${HOST}{width:100%!important;max-width:100%!important;min-width:0!important;min-height:0!important;box-sizing:border-box!important;padding:13px 15px 10px!important;margin:8px 0!important;border:1px solid rgba(79,139,182,.25)!important;border-radius:12px!important;background:linear-gradient(180deg,rgba(7,27,46,.80),rgba(5,20,34,.72))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 24px rgba(0,7,14,.10)!important;overflow:visible!important;display:block!important}
.${HOST} *{box-sizing:border-box}
.${HOST}__summary{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:14px 18px!important;width:100%!important;min-width:0!important;padding:0!important;margin:0!important}
.${HOST}__summary-main{min-width:0!important;display:grid!important;gap:5px!important;align-content:center!important}
.${HOST}__dealid{font-size:13.6px!important;font-weight:820!important;line-height:1.2!important;letter-spacing:.018em!important;color:rgba(247,250,255,.98)!important;white-space:nowrap!important}
.${HOST}__detail{font-size:11.3px!important;font-weight:540!important;line-height:1.42!important;color:rgba(200,214,225,.78)!important;white-space:normal!important;overflow:visible!important;max-width:900px!important}
.${HOST}__summary-side{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:9px!important;min-width:0!important;flex-wrap:nowrap!important}
.${HOST}__amount{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:28px!important;padding:0 10px!important;border:1px solid rgba(83,178,220,.22)!important;border-radius:9px!important;background:rgba(8,31,48,.66)!important;color:rgba(225,248,238,.96)!important;font-size:12.3px!important;font-weight:810!important;line-height:1!important;white-space:nowrap!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}
.${HOST}__open{min-height:28px!important;height:28px!important;padding:0 11px!important;border-radius:8px!important;font-size:10.5px!important;font-weight:750!important;line-height:1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;flex:0 0 auto!important}
.${HOST} [data-rona-deal-original-hidden="true"]{display:none!important}
.${HOST}__status{display:none!important}
.${PANEL}{width:100%!important;min-width:0!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;gap:9px!important;margin:10px 0 0!important;padding:9px 0 1px!important;border-top:1px solid rgba(113,154,184,.12)!important;font-family:inherit!important;color:inherit!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
.${PANEL}::-webkit-scrollbar{display:none}
.${PANEL}__label{flex:0 0 auto;font-size:10.5px!important;font-weight:760!important;line-height:1!important;color:rgba(203,213,225,.56)!important;white-space:nowrap!important}
.${PANEL}__actions{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:0!important}
.${PANEL}__action{position:relative;appearance:none;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;flex:0 0 auto!important;min-height:31px!important;height:31px!important;padding:0 10px!important;border:1px solid rgba(93,180,226,.34)!important;border-radius:8px!important;background:linear-gradient(180deg,rgba(16,58,86,.86),rgba(7,34,54,.90))!important;box-shadow:0 3px 10px rgba(1,8,16,.14),inset 0 1px 0 rgba(255,255,255,.05)!important;color:rgba(241,248,252,.94)!important;font:740 10.8px/1 inherit!important;letter-spacing:.003em!important;cursor:pointer!important;white-space:nowrap!important;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease,filter .14s ease!important}
.${PANEL}__action::before{display:grid;place-items:center;width:16px;height:16px;flex:0 0 16px;border-radius:5px;background:rgba(125,211,252,.08);border:1px solid rgba(125,211,252,.14);font-size:10px;font-weight:800;line-height:1;color:rgba(186,230,253,.92)}
.${PANEL}__action--download::before{content:'↓'}
.${PANEL}__action--signed::before{content:'✓';background:rgba(74,222,128,.07);border-color:rgba(74,222,128,.15);color:rgba(187,247,208,.94)}
.${PANEL}__action:hover{transform:translateY(-1px)!important;border-color:rgba(125,211,252,.58)!important;box-shadow:0 6px 15px rgba(1,8,16,.22),inset 0 1px 0 rgba(255,255,255,.08)!important;filter:brightness(1.06)!important}
.${PANEL}__action:active{transform:translateY(0)!important}
.${PANEL}__action:disabled{opacity:.56!important;cursor:wait!important;transform:none!important;filter:none!important}
.${PANEL}__action--upload{overflow:hidden!important;border-color:rgba(248,113,113,.58)!important;background:linear-gradient(105deg,#74202b,#a52b37,#74202b)!important;background-size:220% 100%!important;box-shadow:0 5px 15px rgba(127,29,29,.22),inset 0 1px 0 rgba(255,255,255,.08)!important;animation:ronaSignedDsCanonicalV2Flow 4s linear infinite!important;color:#fff5f5!important}
.${PANEL}__action--upload::before{content:'↑';background:rgba(255,255,255,.09);border-color:rgba(254,202,202,.26);color:#fff1f2}
.${PANEL}__stage{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;height:26px;box-sizing:border-box;padding:0 9px;border-radius:8px;border:1px solid rgba(96,165,250,.20);background:rgba(59,130,246,.055);color:rgba(191,219,254,.84);font-size:10.4px;font-weight:730;line-height:1;white-space:nowrap;flex:0 0 auto}
.${PANEL}__empty{font-size:10.6px;line-height:1.3;color:rgba(203,213,225,.45);white-space:nowrap}
.${PANEL}__error{font-size:10.6px;line-height:1.25;color:#fca5a5;white-space:nowrap}
@keyframes ronaSignedDsCanonicalV2Flow{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media(max-width:1100px){.${HOST}__summary{grid-template-columns:1fr!important}.${HOST}__summary-side{justify-content:flex-start!important;flex-wrap:wrap!important}}
@media(max-width:760px){.${HOST}{padding:12px!important}.${HOST}__summary-side{gap:7px!important}.${PANEL}{align-items:flex-start!important;flex-wrap:wrap!important;overflow:visible!important}.${PANEL}__actions{flex-wrap:wrap!important}.${PANEL}__stage{margin-left:0!important}}
@media(prefers-reduced-motion:reduce){.${PANEL}__action--upload{animation:none!important}}
`;
  document.head.appendChild(s);
  document.documentElement.dataset.ronaDealVisual='canonical-composed-v2';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
window.addEventListener('pageshow',()=>{if(document.getElementById(`${PANEL}-style`)||!document.getElementById(STYLE_ID))apply()},{passive:true});
})();