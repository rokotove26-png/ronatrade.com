(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_COMPACT_V4__)return;window.__RONA_ADMIN_RADIO_COMPACT_V4__=true;
const d=document,PAGE_ID='page-messages',STYLE_ID='rona-admin-radio-compact-v4-style';
const css=`
#${PAGE_ID}{--rc-cyan:#61d8ff;--rc-blue:#4aa8ff;--rc-violet:#8d7dff;--rc-amber:#ffad54;--rc-text:#eef7fb;--rc-muted:#84a0b2;--rc-line:rgba(100,191,226,.18)}
#${PAGE_ID}.rona-radio-icc .icc-orbit-bar{min-height:34px!important;margin:0 10px 10px!important;padding:0 12px!important;border-radius:8px!important;font-size:8.5px!important;letter-spacing:.105em!important}
#${PAGE_ID}.rona-radio-icc .icc-stat{min-height:76px!important;border-radius:10px!important;padding:10px 12px!important}
#${PAGE_ID}.rona-radio-icc .icc-stat:hover{transform:none!important}
#${PAGE_ID}.rona-radio-icc .icc-stat::after{top:8px!important;right:10px!important;font-size:6.8px!important;letter-spacing:.11em!important}
#${PAGE_ID}.rona-radio-icc .icc-stat *{line-height:1.2!important}
#${PAGE_ID}.rona-radio-icc .icc-stat h1,#${PAGE_ID}.rona-radio-icc .icc-stat h2,#${PAGE_ID}.rona-radio-icc .icc-stat h3,#${PAGE_ID}.rona-radio-icc .icc-stat h4,#${PAGE_ID}.rona-radio-icc .icc-stat strong{font-size:13px!important;font-weight:800!important;letter-spacing:-.01em!important}
#${PAGE_ID}.rona-radio-icc .icc-stat [class*="value"],#${PAGE_ID}.rona-radio-icc .icc-stat [class*="count"]{font-size:24px!important;line-height:1!important;margin-top:6px!important}
#${PAGE_ID}.rona-radio-icc .icc-stat p,#${PAGE_ID}.rona-radio-icc .icc-stat small,#${PAGE_ID}.rona-radio-icc .icc-stat span{font-size:8px!important;color:var(--rc-muted)!important}
#${PAGE_ID}.rona-radio-icc .icc-composer,#${PAGE_ID}.rona-radio-icc .icc-traffic{border-radius:11px!important;box-shadow:0 10px 28px rgba(0,0,0,.18)!important}
#${PAGE_ID}.rona-radio-icc .icc-composer{padding:42px 12px 12px!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic{padding:42px 12px 12px!important;min-height:185px!important}
#${PAGE_ID}.rona-radio-icc .icc-composer::before,#${PAGE_ID}.rona-radio-icc .icc-traffic::before{height:30px!important}
#${PAGE_ID}.rona-radio-icc .icc-composer::after,#${PAGE_ID}.rona-radio-icc .icc-traffic::after{top:9px!important;left:12px!important;font-size:7.6px!important;letter-spacing:.12em!important}
#${PAGE_ID}.rona-radio-icc .icc-panel-code{top:9px!important;right:12px!important;font-size:6.7px!important;letter-spacing:.11em!important}
#${PAGE_ID}.rona-radio-icc .icc-composer h1,#${PAGE_ID}.rona-radio-icc .icc-composer h2,#${PAGE_ID}.rona-radio-icc .icc-composer h3,#${PAGE_ID}.rona-radio-icc .icc-composer h4{font-size:15px!important;line-height:1.2!important;margin:0 0 10px!important}
#${PAGE_ID}.rona-radio-icc .icc-composer select,#${PAGE_ID}.rona-radio-icc .icc-composer input{min-height:36px!important;height:36px!important;padding:0 10px!important;border-radius:8px!important;font-size:11.5px!important}
#${PAGE_ID}.rona-radio-icc .icc-composer textarea{min-height:96px!important;height:96px!important;margin-top:8px!important;padding:12px 14px!important;border-radius:9px!important;font-size:12.5px!important;line-height:1.42!important}
#${PAGE_ID}.rona-radio-icc .icc-transmit-button{min-height:34px!important;height:34px!important;padding:0 16px 0 34px!important;border-radius:8px!important;font-size:11px!important}
#${PAGE_ID}.rona-radio-icc .icc-transmit-button::before{left:13px!important;width:7px!important;height:7px!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic table{font-size:10.5px!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic th{padding:7px 8px!important;font-size:7.5px!important;letter-spacing:.10em!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic td{padding:8px!important;font-size:10.5px!important;line-height:1.3!important}
#${PAGE_ID}.rona-radio-icc .icc-empty-orbit{width:58px!important;height:58px!important;margin:12px auto 6px!important}
#${PAGE_ID}.rona-radio-icc .icc-empty-orbit::before{inset:10px!important}
#${PAGE_ID}.rona-radio-icc .icc-empty-orbit::after{width:6px!important;height:6px!important}
#${PAGE_ID}.rona-radio-icc .rona-radio-mission-grid{display:grid!important;grid-template-columns:minmax(0,1.7fr) minmax(280px,.85fr)!important;gap:10px!important;align-items:stretch!important;margin-top:10px!important}
#${PAGE_ID}.rona-radio-icc .rona-radio-mission-grid>.icc-composer,#${PAGE_ID}.rona-radio-icc .rona-radio-mission-grid>.icc-traffic{margin:0!important;min-width:0!important}
#${PAGE_ID}.rona-radio-icc .icc-composer{grid-column:1!important}.rona-radio-icc .icc-traffic{grid-column:2!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic img,#${PAGE_ID}.rona-radio-icc .icc-traffic picture,#${PAGE_ID}.rona-radio-icc .icc-traffic [style*="background-image"]{display:none!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic{background:linear-gradient(180deg,rgba(8,24,40,.96),rgba(3,12,22,.98))!important}
#${PAGE_ID}.rona-radio-icc .icc-traffic::marker{display:none!important}
#${PAGE_ID}.rona-radio-icc .rona-radio-mission-grid::after{content:'LIVE NETWORK MONITOR';position:absolute;pointer-events:none}
@media(max-width:1180px){#${PAGE_ID}.rona-radio-icc .rona-radio-mission-grid{grid-template-columns:1fr!important}.rona-radio-icc .icc-composer,.rona-radio-icc .icc-traffic{grid-column:1!important}}
@media(max-width:720px){#${PAGE_ID}.rona-radio-icc .icc-stat{min-height:70px!important}#${PAGE_ID}.rona-radio-icc .icc-composer textarea{min-height:110px!important;height:110px!important}}
`;
function install(){if(d.getElementById(STYLE_ID))return;const s=d.createElement('style');s.id=STYLE_ID;s.textContent=css;d.head.appendChild(s)}
function bind(){const p=d.getElementById(PAGE_ID);if(!p)return;install();p.classList.add('rona-radio-compact-v4');const composer=p.querySelector('.icc-composer'),traffic=p.querySelector('.icc-traffic');if(composer&&traffic){let grid=p.querySelector(':scope > .rona-radio-mission-grid');if(!grid){grid=d.createElement('div');grid.className='rona-radio-mission-grid';composer.parentNode.insertBefore(grid,composer);grid.append(composer,traffic)}}}
let t=0;const later=()=>{clearTimeout(t);t=setTimeout(bind,70)};if(document.readyState==='loading')d.addEventListener('DOMContentLoaded',bind,{once:true});else bind();new MutationObserver(later).observe(d.documentElement,{subtree:true,childList:true});window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')setTimeout(bind,60)});[300,900,1800].forEach(ms=>setTimeout(bind,ms));
})();