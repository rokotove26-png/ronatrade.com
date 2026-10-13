const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_APPLICATIONS_TOTAL_KPI__)return;
window.__RONA_APPLICATIONS_TOTAL_KPI__='20261013-admin-applications-context-color-v1';
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
const upper=v=>String(v||'').trim().toUpperCase();
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const fmt=(v,digits=2)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(Number(v));
function ensureStyle(){
 if(q('#ronaApplicationsTotalKpiStyle'))return;
 const s=document.createElement('style');s.id='ronaApplicationsTotalKpiStyle';
 s.textContent=[
 '#page-applications .rona-app-kpi-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:13px!important;align-items:stretch!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card{position:relative!important;overflow:hidden!important;min-height:128px!important;padding:18px 18px 16px 20px!important;border:1px solid rgba(108,177,215,.38)!important;border-radius:16px!important;background:linear-gradient(148deg,rgba(14,38,66,.97),rgba(4,17,34,.97))!important;box-shadow:0 13px 30px rgba(0,0,0,.29),inset 0 1px 0 rgba(255,255,255,.09)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card:before{width:4px!important;left:0!important;top:0!important;bottom:0!important;border-radius:4px!important;opacity:1!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card>h2{color:#c5dfee!important;font-size:13px!important;font-weight:780!important;line-height:1.36!important;letter-spacing:.015em!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card .rona-owner-kpi{font-size:clamp(30px,2.25vw,41px)!important;color:#f7fcff!important;font-variant-numeric:tabular-nums!important;text-shadow:0 0 16px rgba(77,165,245,.17)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card .rona-owner-muted{font-size:12px!important;line-height:1.45!important;color:#a9c6da!important;opacity:1!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-total-kpi--selected-count{border-color:var(--rona-app-current-accent,#3fa9ff)!important;background:linear-gradient(135deg,rgba(19,58,103,.9),rgba(5,20,39,.98))!important;box-shadow:0 13px 30px rgba(0,0,0,.3),0 0 19px rgba(47,152,235,.16),inset 0 1px 0 rgba(255,255,255,.12)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-total-kpi--selected-count:before{background:var(--rona-app-current-accent,#3fa9ff)!important;box-shadow:0 0 20px var(--rona-app-current-accent,#3fa9ff)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-total-kpi--selected-count .rona-owner-kpi{color:#fff!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-total-kpi--selected-tonnage{border-color:rgba(157,119,255,.65)!important;background:linear-gradient(135deg,rgba(49,32,89,.81),rgba(6,18,38,.98))!important;box-shadow:0 13px 30px rgba(0,0,0,.28),0 0 19px rgba(157,119,255,.11)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-total-kpi--selected-tonnage:before{background:#ad85ff!important;box-shadow:0 0 20px rgba(173,133,255,.58)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-total-kpi--selected-tonnage .rona-owner-kpi{color:#dfcfff!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--new{border-color:rgba(54,147,255,.58)!important;background:linear-gradient(145deg,rgba(12,48,93,.93),rgba(5,20,40,.96))!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--new:before{background:#3fa9ff!important;box-shadow:0 0 18px rgba(63,169,255,.6)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--new .rona-owner-kpi{color:#a8d6ff!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--work{border-color:rgba(20,201,225,.55)!important;background:linear-gradient(145deg,rgba(7,64,78,.91),rgba(5,25,36,.96))!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--work:before{background:#16d9e9!important;box-shadow:0 0 18px rgba(22,217,233,.58)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--work .rona-owner-kpi{color:#a0f7f5!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--decision{border-color:rgba(255,184,73,.6)!important;background:linear-gradient(145deg,rgba(78,49,21,.84),rgba(33,25,25,.94))!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--decision:before{background:#ffb649!important;box-shadow:0 0 18px rgba(255,182,73,.58)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--decision .rona-owner-kpi{color:#ffe1a3!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--deal{border-color:rgba(32,219,137,.58)!important;background:linear-gradient(145deg,rgba(11,72,55,.86),rgba(5,30,32,.96))!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--deal:before{background:#26de96!important;box-shadow:0 0 18px rgba(38,222,150,.55)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-owner-card.rona-app-kpi--deal .rona-owner-kpi{color:#a8ffd6!important}',
 '#page-applications .rona-app-registry-note{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-4px 0 15px;padding:9px 13px;border:1px solid rgba(122,174,216,.26);border-radius:10px;background:rgba(6,25,43,.83);color:#aac5d7;font-size:12px;line-height:1.45}',
 '#page-applications .rona-app-registry-note:before{content:"i";display:inline-grid;place-items:center;width:18px;height:18px;border:1px solid rgba(125,196,244,.66);border-radius:50%;color:#97d8ff;font-size:11px;font-weight:900;flex:0 0 auto}',
 '#page-applications .rona-app-flow{border-color:rgba(111,177,213,.34)!important;background:rgba(5,20,38,.94)!important}',
 '#page-applications .rona-app-flow-step{min-height:56px!important;color:#d5e8f5!important;font-weight:800!important;text-shadow:0 0 12px rgba(39,135,209,.14)!important}',
 '#page-applications .rona-app-flow-step:nth-child(1){color:#83c9ff!important;background:rgba(21,105,202,.12)!important}',
 '#page-applications .rona-app-flow-step:nth-child(2){color:#86f0ed!important;background:rgba(5,146,155,.12)!important}',
 '#page-applications .rona-app-flow-step:nth-child(3){color:#ffcf82!important;background:rgba(191,115,18,.12)!important}',
 '#page-applications .rona-app-flow-step:nth-child(4){color:#90f2bb!important;background:rgba(14,145,91,.12)!important}',
 '#page-applications .rona-app-flow-step:nth-child(1):before{background:#3fa9ff!important;height:3px!important;opacity:1!important}',
 '#page-applications .rona-app-flow-step:nth-child(2):before{background:#16d9e9!important;height:3px!important;opacity:1!important}',
 '#page-applications .rona-app-flow-step:nth-child(3):before{background:#ffb649!important;height:3px!important;opacity:1!important}',
 '#page-applications .rona-app-flow-step:nth-child(4):before{background:#26de96!important;height:3px!important;opacity:1!important}',
 '#page-applications .rona-app-filter{gap:10px!important;margin-bottom:15px!important}',
 '#page-applications .rona-app-filter button{min-height:41px!important;padding:0 18px!important;border-radius:10px!important;font-weight:820!important;font-size:13px!important;letter-spacing:.01em!important;cursor:pointer!important;transition:transform .14s ease,box-shadow .14s ease,border-color .14s ease,background .14s ease!important}',
 '#page-applications .rona-app-filter button.is-new{background:linear-gradient(155deg,rgba(16,74,144,.8),rgba(7,37,77,.9))!important;border:1px solid rgba(63,169,255,.6)!important;color:#c8e8ff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important}',
 '#page-applications .rona-app-filter button.is-work{background:linear-gradient(155deg,rgba(5,101,116,.75),rgba(4,49,64,.92))!important;border:1px solid rgba(22,217,233,.6)!important;color:#b3f7f5!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important}',
 '#page-applications .rona-app-filter button.is-decision{background:linear-gradient(155deg,rgba(133,78,18,.7),rgba(68,39,14,.9))!important;border:1px solid rgba(255,182,73,.64)!important;color:#ffe0a0!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important}',
 '#page-applications .rona-app-filter button.is-completed{background:linear-gradient(155deg,rgba(9,119,75,.68),rgba(5,62,48,.94))!important;border:1px solid rgba(38,222,150,.62)!important;color:#b2ffdb!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)!important}',
 '#page-applications .rona-app-filter button[aria-pressed="true"]{color:#fff!important;transform:translateY(-1px)!important;box-shadow:0 5px 19px rgba(0,0,0,.26),0 0 0 2px rgba(225,247,255,.24),inset 0 1px 0 rgba(255,255,255,.15)!important}',
 '#page-applications .rona-app-filter button.is-new[aria-pressed="true"]{background:linear-gradient(145deg,#156ada,#10488f)!important;box-shadow:0 0 0 2px rgba(67,170,255,.5),0 0 20px rgba(49,146,255,.3)!important}',
 '#page-applications .rona-app-filter button.is-work[aria-pressed="true"]{background:linear-gradient(145deg,#087d96,#085268)!important;box-shadow:0 0 0 2px rgba(22,217,233,.43),0 0 20px rgba(22,217,233,.25)!important}',
 '#page-applications .rona-app-filter button.is-decision[aria-pressed="true"]{background:linear-gradient(145deg,#ab6716,#784310)!important;box-shadow:0 0 0 2px rgba(255,182,73,.45),0 0 20px rgba(255,182,73,.24)!important}',
 '#page-applications .rona-app-filter button.is-completed[aria-pressed="true"]{background:linear-gradient(145deg,#09845a,#086244)!important;box-shadow:0 0 0 2px rgba(38,222,150,.43),0 0 20px rgba(38,222,150,.24)!important}',
 '#page-applications .rona-app-filter button:hover,#page-applications .rona-app-table button:hover{filter:brightness(1.19)!important;transform:translateY(-1px)!important}',
 '#page-applications .rona-app-filter button:focus-visible,#page-applications .rona-app-table button:focus-visible{outline:2px solid #fff!important;outline-offset:3px!important}',
 '#page-applications .rona-app-table{border-color:rgba(92,179,234,.37)!important;background:linear-gradient(170deg,rgba(8,30,54,.95),rgba(4,17,33,.94))!important;box-shadow:0 14px 38px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.045)!important}',
 '#page-applications .rona-app-table>.rona-app-queue-context{margin:0 0 12px;padding:8px 12px;border:1px solid rgba(68,152,214,.35);border-left:3px solid var(--rona-app-current-accent,#3fa9ff);border-radius:9px;color:#e2f4ff;background:rgba(9,40,71,.65);font-size:13px;font-weight:750}',
 '#page-applications .rona-app-table .rona-owner-table th{color:#c1e3fa!important;font-weight:800!important;background:rgba(13,52,84,.62)!important;border-bottom:1px solid rgba(89,177,232,.35)!important}',
 '#page-applications .rona-app-table .rona-owner-table td{color:#edf7fe!important;border-bottom:1px solid rgba(100,162,205,.18)!important}',
 '#page-applications .rona-app-table .rona-owner-table tr:hover td{background:rgba(24,76,112,.22)!important}',
 '#page-applications .rona-app-table .rona-fin-pill{border-radius:9px!important;font-weight:800!important;padding:5px 10px!important;border:1px solid rgba(128,177,211,.45)!important;white-space:normal!important}',
 '#page-applications .rona-app-table .rona-fin-pill--info{color:#aff3ff!important;background:rgba(8,112,140,.3)!important;border-color:rgba(22,217,233,.58)!important}',
 '#page-applications .rona-app-table .rona-fin-pill--warn{color:#ffe0a0!important;background:rgba(144,84,18,.28)!important;border-color:rgba(255,182,73,.6)!important}',
 '#page-applications .rona-app-table .rona-fin-pill--success{color:#b3ffd9!important;background:rgba(7,116,73,.28)!important;border-color:rgba(38,222,150,.58)!important}',
 '#page-applications .rona-app-table .rona-fin-pill--danger{color:#ffbdc6!important;background:rgba(149,25,49,.25)!important;border-color:rgba(251,84,102,.58)!important}',
 '#page-applications .rona-app-table .rona-fin-pill--neutral{color:#d1e0ea!important;background:rgba(54,77,100,.35)!important;border-color:rgba(144,175,207,.36)!important}',
 '#page-applications .rona-app-table .rona-owner-actions button{min-height:34px!important;border-radius:9px!important;padding:7px 11px!important;background:linear-gradient(145deg,#0e559f,#07366d)!important;color:#f2fbff!important;border:1px solid rgba(70,165,255,.75)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.13),0 3px 10px rgba(0,0,0,.23)!important;font-weight:780!important;cursor:pointer!important}',
 '#page-applications .rona-app-table button.rona-app-action--approve{background:linear-gradient(145deg,#087a51,#07503d)!important;border-color:rgba(38,222,150,.76)!important;color:#f1fff8!important}',
 '#page-applications .rona-app-table button.rona-app-action--reject{background:linear-gradient(145deg,#8d2639,#601d2e)!important;border-color:rgba(251,102,121,.68)!important;color:#fff1f3!important}',
 '#page-applications .rona-app-table button.rona-app-action--offer{background:linear-gradient(145deg,#8f601d,#694214)!important;border-color:rgba(255,189,88,.7)!important;color:#fff2dc!important}',
 '#page-applications .rona-app-table input,#page-applications .rona-app-table select{min-height:34px!important;border:1px solid rgba(100,171,221,.5)!important;border-radius:8px!important;background:rgba(6,29,51,.98)!important;color:#e8f5ff!important}',
 '#page-applications .rona-app-table>.rona-owner-muted{color:#b6d7eb!important;font-size:13px!important;line-height:1.55!important;padding:18px 4px!important}',
 '@media(max-width:1180px){#page-applications .rona-app-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
 '@media(max-width:760px){#page-applications .rona-app-flow{grid-template-columns:repeat(2,minmax(0,1fr))!important}#page-applications .rona-app-filter button{flex:1 1 160px!important}}',
 '@media(max-width:620px){#page-applications .rona-app-kpi-grid{grid-template-columns:1fr!important}#page-applications .rona-app-registry-note{align-items:flex-start}#page-applications .rona-app-table{padding:14px 11px!important}}',
 '#page-applications .rona-app-kpi-grid{grid-template-columns:repeat(12,minmax(0,1fr))!important;gap:13px!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-total-kpi{grid-column:span 4!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-kpi:not(.rona-app-total-kpi){grid-column:span 3!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-total-kpi--selected-amount{border:1px solid rgba(255,193,88,.82)!important;background:linear-gradient(135deg,rgba(91,53,16,.94),rgba(22,28,46,.96))!important;box-shadow:0 12px 27px rgba(0,0,0,.25),0 0 25px rgba(255,173,46,.14),inset 0 1px 0 rgba(255,244,220,.14)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-total-kpi--selected-amount:before{background:#ffbd56!important;box-shadow:0 0 19px rgba(255,189,86,.6)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-total-kpi--selected-amount .rona-owner-kpi{font-size:clamp(23px,2vw,35px)!important;color:#ffe6b2!important;line-height:1.16!important;letter-spacing:-.025em!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-total-kpi--selected-amount.rona-app-amount--agreed{border-color:rgba(46,220,149,.7)!important;background:linear-gradient(135deg,rgba(11,79,60,.90),rgba(5,27,39,.97))!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-total-kpi--selected-amount.rona-app-amount--agreed:before{background:#25e29b!important;box-shadow:0 0 18px rgba(37,226,155,.48)!important}',
 '#page-applications .rona-app-kpi-grid>.rona-app-total-kpi--selected-amount.rona-app-amount--unavailable{border-color:rgba(136,161,189,.53)!important;background:linear-gradient(145deg,rgba(31,45,65,.9),rgba(11,25,41,.94))!important}',
 '#page-applications .rona-app-money-values{display:grid!important;gap:4px!important;white-space:normal!important;word-break:normal!important}',
 '#page-applications .rona-app-money-line{display:block!important;font-size:clamp(21px,1.9vw,32px)!important;font-weight:850!important;font-variant-numeric:tabular-nums!important;white-space:nowrap!important}',
 '#page-applications .rona-app-filter{gap:12px!important;margin:12px 0 19px!important}',
 '#page-applications .rona-app-filter button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:9px!important;min-height:46px!important;padding:10px 17px!important;border-width:2px!important;border-style:solid!important;border-radius:11px!important;color:#fff!important;font-size:14px!important;letter-spacing:.01em!important;font-weight:850!important;text-shadow:0 1px 2px rgba(0,0,0,.38)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 4px 12px rgba(0,0,0,.32)!important;cursor:pointer!important}',
 '#page-applications .rona-app-filter button.is-new{background:linear-gradient(170deg,#1779e9,#0b4f9f)!important;border-color:#50b5ff!important}',
 '#page-applications .rona-app-filter button.is-work{background:linear-gradient(170deg,#088fa6,#066478)!important;border-color:#4ee9f5!important}',
 '#page-applications .rona-app-filter button.is-decision{background:linear-gradient(170deg,#b4751d,#865012)!important;border-color:#ffd078!important}',
 '#page-applications .rona-app-filter button.is-completed{background:linear-gradient(170deg,#0d9c67,#086d49)!important;border-color:#5ef1b2!important}',
 '#page-applications .rona-app-filter button::before{content:"";width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:currentColor;box-shadow:0 0 9px currentColor}',
 '#page-applications .rona-app-filter button[aria-pressed="true"]{outline:2px solid rgba(239,252,255,.78)!important;outline-offset:2px!important;box-shadow:0 8px 19px rgba(0,0,0,.38),0 0 22px rgba(109,197,255,.27),inset 0 1px 0 rgba(255,255,255,.29)!important;transform:translateY(-2px)!important}',
 '#page-applications .rona-app-filter button:hover:not(:disabled){filter:brightness(1.25)!important;transform:translateY(-2px)!important;box-shadow:0 10px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.24)!important}',
 '#page-applications .rona-app-filter button:active:not(:disabled){transform:translateY(1px)!important;filter:brightness(.98)!important}',
 '#page-applications .rona-app-filter button:disabled{opacity:.55!important;cursor:not-allowed!important;filter:grayscale(.48)!important}',
 '#page-applications .rona-app-table .rona-owner-actions{display:flex!important;align-items:stretch!important;justify-content:center!important;gap:8px!important;flex-wrap:wrap!important}',
 '#page-applications .rona-app-table .rona-owner-actions.rona-app-actions{display:grid!important;grid-template-columns:repeat(2,minmax(113px,1fr))!important;gap:7px!important;min-width:246px!important;align-content:center!important}',
 '#page-applications .rona-app-table .rona-owner-actions.rona-app-actions button:last-child:nth-child(odd){grid-column:1/-1!important}',
 '#page-applications .rona-app-table .rona-owner-actions button,#page-applications .rona-app-table button[data-rona-app-passport-open]{min-height:41px!important;min-width:109px!important;padding:9px 12px!important;border-radius:10px!important;border:2px solid #69bdfc!important;background:linear-gradient(160deg,#176bc0,#0b468c)!important;color:#fff!important;font:inherit!important;font-size:12.5px!important;line-height:1.25!important;font-weight:850!important;letter-spacing:.005em!important;text-align:center!important;text-shadow:0 1px 2px rgba(0,0,0,.36)!important;white-space:normal!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 4px 13px rgba(0,0,0,.25)!important;cursor:pointer!important;transition:transform .14s ease,filter .14s ease,box-shadow .14s ease!important}',
 '#page-applications .rona-app-table .rona-owner-actions button.rona-app-action--approve{background:linear-gradient(160deg,#149d68,#086a49)!important;border-color:#57eeb3!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 4px 13px rgba(3,101,66,.38)!important}',
 '#page-applications .rona-app-table .rona-owner-actions button.rona-app-action--reject{background:linear-gradient(160deg,#b52b49,#812039)!important;border-color:#ff8ca1!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 4px 13px rgba(144,20,49,.34)!important}',
 '#page-applications .rona-app-table .rona-owner-actions button.rona-app-action--offer{background:linear-gradient(160deg,#bd831d,#815211)!important;border-color:#ffd181!important;color:#fff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 4px 13px rgba(121,77,16,.38)!important}',
 '#page-applications .rona-app-table .rona-owner-actions button.rona-app-action--open{background:linear-gradient(160deg,#1976cf,#0d519e)!important;border-color:#7ac6ff!important}',
 '#page-applications .rona-app-table .rona-owner-actions button:hover:not(:disabled),#page-applications .rona-app-table button[data-rona-app-passport-open]:hover:not(:disabled){filter:brightness(1.26)!important;transform:translateY(-2px)!important;box-shadow:0 7px 18px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.26)!important}',
 '#page-applications .rona-app-table .rona-owner-actions button:active:not(:disabled),#page-applications .rona-app-table button[data-rona-app-passport-open]:active:not(:disabled){filter:brightness(.9)!important;transform:translateY(1px)!important}',
 '#page-applications .rona-app-table .rona-owner-actions button:disabled,#page-applications .rona-app-table button[data-rona-app-passport-open]:disabled{opacity:.52!important;filter:saturate(.55)!important;cursor:not-allowed!important}',
 '#page-applications .rona-app-table .rona-owner-actions button:focus-visible,#page-applications .rona-app-table button[data-rona-app-passport-open]:focus-visible{outline:3px solid #fff!important;outline-offset:3px!important}',
 '#page-applications .rona-app-table .rona-fin-pill{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:28px!important;padding:5px 10px!important;border-width:1.5px!important;font-size:12px!important;letter-spacing:.005em!important;line-height:1.32!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 10px rgba(0,0,0,.08)!important}',
 '#page-applications .rona-app-table .rona-fin-pill--warn{background:#5b3b0f!important;border-color:#f3b44e!important;color:#ffdb91!important}',
 '#page-applications .rona-app-table .rona-fin-pill--success{background:#084c37!important;border-color:#44dda0!important;color:#a9ffda!important}',
 '#page-applications .rona-app-table .rona-fin-pill--danger{background:#582032!important;border-color:#ff8299!important;color:#ffd1da!important}',
 '#page-applications .rona-app-table .rona-fin-pill--info{background:#064a67!important;border-color:#45d5ee!important;color:#a9edff!important}',
 '#page-applications .rona-app-table .rona-owner-table td:first-child{color:#a3d9ff!important;font-weight:780!important}',
 '#page-applications .rona-app-table .rona-owner-table td:nth-child(4){color:#d7c7ff!important;font-weight:820!important;font-variant-numeric:tabular-nums!important}',
 '#page-applications .rona-app-table .rona-app-price>div:first-child{color:#ffe099!important;font-weight:830!important}',
 '#page-applications .rona-app-table .rona-app-deal{color:#93ffc8!important}',
 '@media(max-width:1120px){#page-applications .rona-app-kpi-grid>.rona-app-kpi:not(.rona-app-total-kpi){grid-column:span 6!important}}',
 '@media(max-width:740px){#page-applications .rona-app-kpi-grid>.rona-app-total-kpi{grid-column:span 6!important}#page-applications .rona-app-kpi-grid>.rona-app-total-kpi--selected-amount{grid-column:span 12!important}}',
 '@media(max-width:570px){#page-applications .rona-app-kpi-grid>.rona-app-total-kpi,#page-applications .rona-app-kpi-grid>.rona-app-kpi:not(.rona-app-total-kpi){grid-column:span 12!important}}',
 '#page-applications .rona-app-flow{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:14px!important;padding:10px!important;border:1px solid rgba(74,158,229,.35)!important;border-radius:15px!important;background:linear-gradient(155deg,rgba(5,22,41,.93),rgba(11,36,62,.88))!important;margin:5px 0 17px!important}',
 '#page-applications .rona-app-flow-step{position:relative!important;min-height:68px!important;padding:12px 15px!important;display:flex!important;align-items:center!important;justify-content:center!important;border-radius:12px!important;font-size:14px!important;font-weight:870!important;letter-spacing:.015em!important;background:linear-gradient(160deg,rgba(18,49,81,.94),rgba(6,24,45,.96))!important;border:2px solid rgba(89,169,220,.56)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 6px 17px rgba(0,0,0,.27)!important;text-align:center!important}',
 '#page-applications .rona-app-flow-step:nth-child(1){border-color:#3d9ef0!important;background:linear-gradient(160deg,rgba(23,87,163,.8),rgba(8,38,75,.98))!important;color:#e1f1ff!important}',
 '#page-applications .rona-app-flow-step:nth-child(2){border-color:#20d3da!important;background:linear-gradient(160deg,rgba(6,100,116,.8),rgba(5,44,61,.98))!important;color:#d6ffff!important}',
 '#page-applications .rona-app-flow-step:nth-child(3){border-color:#ffbc58!important;background:linear-gradient(160deg,rgba(139,83,19,.85),rgba(68,41,17,.98))!important;color:#fff1cf!important}',
 '#page-applications .rona-app-flow-step:nth-child(4){border-color:#30e3a1!important;background:linear-gradient(160deg,rgba(9,115,77,.81),rgba(5,58,50,.98))!important;color:#deffef!important}',
 '#page-applications .rona-app-flow-step:before{opacity:1!important;height:5px!important;left:12px!important;right:12px!important;bottom:0!important;top:auto!important;box-shadow:0 0 14px currentColor!important}',
 '#page-applications .rona-app-filter{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;padding:13px!important;border:1px solid rgba(100,175,224,.4)!important;border-radius:15px!important;background:linear-gradient(150deg,rgba(7,29,51,.94),rgba(4,19,36,.97))!important;margin:2px 0 17px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 24px rgba(0,0,0,.19)!important}',
 '#page-applications .rona-app-filter button{min-width:0!important;min-height:53px!important;padding:12px 10px!important;border-width:2px!important;border-radius:12px!important;font-size:14px!important;font-weight:880!important;line-height:1.25!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.21),0 6px 15px rgba(0,0,0,.34)!important;letter-spacing:.025em!important}',
 '#page-applications .rona-app-filter button[aria-pressed=true]{outline:3px solid rgba(255,255,255,.95)!important;outline-offset:2px!important;box-shadow:0 0 0 2px rgba(255,255,255,.23),0 9px 26px rgba(0,0,0,.4),0 0 24px currentColor!important;transform:translateY(-2px)!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button,#page-applications .rona-app-table .rona-owner-actions button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:43px!important;min-width:100px!important;padding:10px 14px!important;background:linear-gradient(155deg,#1777d1,#0b4b95)!important;color:#fff!important;font-weight:850!important;border:2px solid #79c9ff!important;border-radius:10px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 6px 16px rgba(0,0,0,.28)!important;white-space:normal!important;cursor:pointer!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button.rona-app-action--approve,#page-applications .rona-app-table .rona-owner-actions button.rona-app-action--approve{background:linear-gradient(155deg,#119a65,#07754e)!important;border-color:#68ffc4!important;color:#fff!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button.rona-app-action--reject,#page-applications .rona-app-table .rona-owner-actions button.rona-app-action--reject{background:linear-gradient(155deg,#c33552,#8e1f3c)!important;border-color:#ff9bad!important;color:#fff!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button.rona-app-action--offer,#page-applications .rona-app-table .rona-owner-actions button.rona-app-action--offer{background:linear-gradient(155deg,#c08722,#875313)!important;border-color:#ffda8b!important;color:#fff!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button:hover:not(:disabled){filter:brightness(1.23)!important;transform:translateY(-2px)!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button:focus-visible{outline:3px solid #fff!important;outline-offset:2px!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button:disabled{opacity:.5!important;cursor:not-allowed!important}',
 '@media(max-width:1060px){#page-applications .rona-app-flow,#page-applications .rona-app-filter{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
 '@media(max-width:600px){#page-applications .rona-app-flow,#page-applications .rona-app-filter{grid-template-columns:1fr!important}}',
 '#page-applications .rona-app-table{overflow-x:auto!important;overscroll-behavior-x:contain!important}',
 '#page-applications .rona-app-table .rona-owner-table{table-layout:auto!important;width:max-content!important;min-width:100%!important;max-width:none!important;border-collapse:separate!important;border-spacing:0 3px!important}',
 '#page-applications .rona-app-table .rona-owner-table th,#page-applications .rona-app-table .rona-owner-table td{white-space:nowrap!important;vertical-align:middle!important;padding:7px 8px!important}',
 '#page-applications .rona-app-table .rona-owner-table td:not(:nth-child(2)) *,#page-applications .rona-app-table .rona-owner-table th *{white-space:nowrap!important;max-width:none!important}',
 '#page-applications .rona-app-table .rona-owner-table td:nth-child(2),#page-applications .rona-app-table .rona-owner-table td:nth-child(2) *{white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}',
 '#page-applications .rona-app-table .rona-owner-table td:nth-child(2){min-width:158px!important;max-width:255px!important;width:24%!important;line-height:1.28!important}',
 '#page-applications .rona-app-table .rona-app-price{display:inline-flex!important;align-items:center!important;gap:8px!important;white-space:nowrap!important}',
 '#page-applications .rona-app-table .rona-app-price>div{display:inline-block!important;white-space:nowrap!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child{text-align:center!important;white-space:nowrap!important;min-width:0!important;width:1%!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button[data-rona-app-passport-open],#page-applications .rona-app-table .rona-owner-table td:last-child button.rona-app-action--open{display:inline-flex!important;width:83px!important;min-width:83px!important;max-width:83px!important;min-height:34px!important;height:34px!important;padding:5px 9px!important;line-height:1.1!important;font-size:12px!important;flex:0 0 83px!important;justify-self:center!important;box-sizing:border-box!important;white-space:nowrap!important}',
 '#page-applications .rona-app-table .rona-owner-table td:last-child button[data-rona-app-passport-open]:hover:not(:disabled){filter:brightness(1.18)!important}',
 '@media(max-width:800px){#page-applications .rona-app-table .rona-owner-table{min-width:960px!important}#page-applications .rona-app-table .rona-owner-table td:nth-child(2){max-width:210px!important}}',
 '@media(prefers-reduced-motion:reduce){#page-applications .rona-app-filter button,#page-applications .rona-app-table .rona-owner-table td:last-child button{transition:none!important;transform:none!important}}',
 '@media(prefers-reduced-motion:reduce){#page-applications .rona-app-filter button,#page-applications .rona-app-table .rona-owner-actions button{transition:none!important;transform:none!important}}',
 '@media(prefers-reduced-motion:reduce){#page-applications .rona-app-filter button,#page-applications .rona-app-kpi-grid>.rona-owner-card{transition:none!important;transform:none!important}}'
 ].join('');
 document.head.appendChild(s)
}
const FILTERS=Object.freeze({
 NEW:{label:'Новые',tone:'#3fa9ff'},
 WORK:{label:'В работе',tone:'#16d9e9'},
 DECISION:{label:'Требуют решения',tone:'#ffb649'},
 COMPLETED:{label:'Завершённые',tone:'#26de96'}
});
function currentBucket(){
 const pressed=q('#page-applications .rona-app-filter button[aria-pressed="true"]');
 if(!pressed)return null;
 if(pressed.classList.contains('is-new'))return'NEW';
 if(pressed.classList.contains('is-work'))return'WORK';
 if(pressed.classList.contains('is-decision'))return'DECISION';
 if(pressed.classList.contains('is-completed'))return'COMPLETED';
 return null
}
// Exact bucket predicate used by the deployed /portal/main-ui application2BBucket patch.
function applicationBucket(a){
 const owner=upper(a?.owner_status),app=upper(a?.status),deal=upper(a?.deal_status);
 if(owner==='REJECTED'||owner==='CANCELLED'||owner==='SUPPLIER_APPROVED'||owner==='DEAL'||app==='CANCELLED'||(app==='DEAL_REGISTERED'&&deal!=='SUPPLIER_PENDING'))return'COMPLETED';
 if(owner==='COUNTER_OFFERED'||owner==='SUPPLIER_PENDING'||deal==='SUPPLIER_PENDING')return'DECISION';
 if(owner==='NEW'||!owner)return'NEW';
 return'WORK'
}
function card(title,kind,value,caption){
 const c=document.createElement('section');
 c.className='rona-owner-card rona-app-kpi rona-app-total-kpi '+kind;
 c.dataset.ronaAppTotal='1';
 const h=document.createElement('h2');h.textContent=title;
 const n=document.createElement('div');n.className='rona-owner-kpi';n.textContent=value;
 const sub=document.createElement('div');sub.className='rona-owner-muted';sub.textContent=caption;
 c.append(h,n,sub);return c
}
function makeRegistryNote(snapshot){
 const note=document.createElement('div');note.className='rona-app-registry-note';
 note.dataset.ronaAppRegistryNote='1';
 const kpi=snapshot?.application_kpi;
 const valid=snapshot?.application_business_contract==='RONA_APPLICATION_BUSINESS_V2'&&kpi?.source==='RONA_APPLICATION_BUSINESS_V2';
 if(!valid){note.textContent='Весь реестр · подтверждённые итоги ещё не сформированы';return note}
 const totals=[];
 if(finite(kpi.tonnage))totals.push('тоннаж '+fmt(kpi.tonnage,3)+' т');
 if(kpi.state==='READY'&&Array.isArray(kpi.amounts)){
   const amounts=kpi.amounts.filter(a=>finite(a?.amount)&&/^[A-Z]{3}$/.test(upper(a?.currency)));
   if(amounts.length===kpi.amounts.length)for(const item of amounts)totals.push('сумма '+fmt(item.amount,2)+' '+upper(item.currency))
 }
 if(!totals.length)totals.push('итоги требуют проверки');
 note.textContent='Весь реестр (без учёта фильтра) · '+totals.join(' · ');
 return note
}
function enhanceActions(page){
 qa('.rona-app-table button',page).forEach(b=>{
   const label=String(b.textContent||'').trim();
   const tone=['Принять','Ресурс одобрен','Ресурс подтвержден','Отправить в сделки'].includes(label)?'approve':
     ['Отклонить','В ресурсе отказано'].includes(label)?'reject':
     label==='Предложить другую цену'?'offer':'open';
   b.classList.add('rona-app-action--'+tone)
 })
}
function appCountLabel(n){const two=Math.abs(n)%100,one=two%10;return String(n)+' '+(two>=11&&two<=14?'заявок':one===1?'заявка':one>=2&&one<=4?'заявки':'заявок')}
// Same unit-price × quantity formula as application_business_projection_v2, limited to the live selected UI bucket.
// application_price is the canonical effective price. It may be unagreed; NEVER present it as a booked/signed amount.
const moneyFmt=v=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
function selectedAmount(rows,sourceValid){
 if(!sourceValid)return{state:'UNAVAILABLE',lines:[],caption:'Ожидается подтверждённая запись заявки для расчёта суммы'};
 if(rows.length===0)return{state:'EMPTY',lines:[],caption:'В выбранной категории заявок нет'};
 const sums=new Map();let estimated=0,missing=0,blocked=0;
 for(const a of rows){
   if(a?.business_contract!=='RONA_APPLICATION_BUSINESS_V2'||a?.record_kind!=='CLIENT_APPLICATION'||upper(a?.retention_decision)!=='KEEP'){blocked++;continue}
   const qty=Number(a?.quantity_tonnes),price=Number(a?.application_price),currency=upper(a?.application_currency);
   if(!finite(a?.quantity_tonnes)||qty<=0||!finite(a?.application_price)||price<=0||!/^[A-Z]{3}$/.test(currency)){missing++;continue}
   const line=qty*price;if(!Number.isFinite(line)||line<0){missing++;continue}
   sums.set(currency,(sums.get(currency)||0)+line);
   if(a?.price_is_agreed!==true)estimated++
 }
 if(blocked)return{state:'UNAVAILABLE',lines:[],caption:'Проверка записей реестра не завершена'};
 if(missing)return{state:'UNAVAILABLE',lines:[],caption:'Нельзя вывести общий итог: у '+appCountLabel(missing)+' отсутствует подтверждённая цена или объём'};
 const lines=Array.from(sums,([currency,amount])=>({currency,amount})).sort((a,b)=>a.currency.localeCompare(b.currency));
 if(!lines.length)return{state:'UNAVAILABLE',lines:[],caption:'Данные для расчёта отсутствуют'};
 return{state:estimated?'ESTIMATED':'AGREED',lines,
   caption:estimated?'Расчёт по действующей цене заявки · '+appCountLabel(estimated)+' с несогласованной ценой':'По согласованным ценам заявок · объём × цена за тонну'}
}
function moneyCard(title,result){
 const type=result.state==='AGREED'?'agreed':result.state==='ESTIMATED'?'estimated':'unavailable';
 const value=result.state==='EMPTY'?'0':result.state==='PENDING'?'…':result.lines.length?'':'—';
 const c=card(title,'rona-app-total-kpi--selected-amount rona-app-amount--'+type,value,result.caption);
 if(result.lines.length){
   const host=c.children[1];host.classList.add('rona-app-money-values');host.textContent='';
   for(const item of result.lines){
     const line=document.createElement('span');line.className='rona-app-money-line';
     line.textContent=moneyFmt(item.amount)+' '+item.currency;host.append(line)
   }
 }
 return c
}
// Authoritative, read-only fallback for a temporarily incomplete Admin bootstrap.
// Uses the exact same authenticated same-origin route as the existing Admin shell.
let resolvedKpiSource=null,resolvedKpiPayload=null,resolvingKpiSource=null,kpiHydrationFailed=false;
function canonicalShape(value){
 const rows=value?.applications;
 return Array.isArray(rows)&&(rows.length>0?
   rows.every(a=>a?.business_contract==='RONA_APPLICATION_BUSINESS_V2'&&a?.record_kind==='CLIENT_APPLICATION'):
   value?.application_business_contract==='RONA_APPLICATION_BUSINESS_V2'&&value?.application_kpi?.source==='RONA_APPLICATION_BUSINESS_V2');
}
function sameRegistryAndBucket(current,verified,bucket){
 const left=current?.applications,right=verified?.applications;
 if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length)return false;
 const identity=a=>String(a?.application_id||'');
 const sorted=items=>items.map(identity).sort().join('\u001f');
 if(left.some(a=>!identity(a))||right.some(a=>!identity(a))||sorted(left)!==sorted(right))return false;
 return sorted(left.filter(a=>applicationBucket(a)===bucket))===sorted(right.filter(a=>applicationBucket(a)===bucket));
}
function requestCanonicalKpi(source){
 if(resolvedKpiSource===source||resolvingKpiSource===source)return;
 if(typeof location==='undefined'||location.pathname!=='/portal/admin'||document.visibilityState==='hidden')return;
 if(!Array.isArray(source?.applications)||!source.applications.length)return;
 if(typeof fetch!=='function')return;
 resolvingKpiSource=source;kpiHydrationFailed=false;
 // No speculative arithmetic from old bootstrap; use validated canonical projection only.
 fetch('/portal/admin-completed-bootstrap',{
   method:'GET',credentials:'same-origin',cache:'no-store',
   headers:{accept:'application/json','x-rona-client-source':'ADMIN_APPLICATIONS_KPI_READ_ONLY','x-rona-client-refresh-reason':'CANONICAL_APPLICATIONS_PENDING'}
 }).then(async response=>{
   if(!response.ok||response.headers.get('x-rona-application-business')!=='RONA_APPLICATION_BUSINESS_V2')return null;
   const payload=await response.json();
   return payload?.ok===true&&canonicalShape(payload?.data)?payload.data:null
 }).then(data=>{
   if(window.__RONA_OWNER_ADMIN_SNAPSHOT__!==source)return;
   resolvedKpiSource=source;resolvedKpiPayload=data;
   kpiHydrationFailed=!data;
   schedule()
 }).catch(()=>{
   if(window.__RONA_OWNER_ADMIN_SNAPSHOT__!==source)return;
   resolvedKpiSource=source;resolvedKpiPayload=null;kpiHydrationFailed=true;
   schedule()
 }).finally(()=>{if(resolvingKpiSource===source)resolvingKpiSource=null})
}
function apply(){
 const page=q('#page-applications'),grid=q('#page-applications .rona-app-kpi-grid');
 if(!page||!grid)return;
 const bucket=currentBucket();if(!bucket||!FILTERS[bucket])return;
 ensureStyle();
 const filter=FILTERS[bucket],liveSnapshot=window.__RONA_OWNER_ADMIN_SNAPSHOT__;
 const usesFallback=!canonicalShape(liveSnapshot)&&resolvedKpiSource===liveSnapshot&&
   canonicalShape(resolvedKpiPayload)&&sameRegistryAndBucket(liveSnapshot,resolvedKpiPayload,bucket);
 const snapshot=usesFallback?resolvedKpiPayload:liveSnapshot;
 const hasRows=Array.isArray(snapshot?.applications),rows=hasRows?snapshot.applications:[];
 const canonical=canonicalShape(snapshot);
 const registryComplete=canonical&&snapshot?.application_kpi?.source==='RONA_APPLICATION_BUSINESS_V2';
 if(!canonical&&Array.isArray(liveSnapshot?.applications)&&liveSnapshot.applications.length)requestCanonicalKpi(liveSnapshot);
 const visible=rows.filter(a=>applicationBucket(a)===bucket);
 const quantities=visible.map(a=>a?.quantity_tonnes);
 const complete=quantities.every(v=>finite(v)&&Number(v)>=0);
 const tonnage=complete?fmt(quantities.reduce((sum,v)=>sum+Number(v),0),3)+' т':'—';
 const count=card('Заявок · '+filter.label,'rona-app-total-kpi--selected-count',
   hasRows?String(visible.length):'—',hasRows?'По выбранному статусу · серверный реестр':'Данные пока не загружены');
 const ton=card('Тоннаж · '+filter.label,'rona-app-total-kpi--selected-tonnage',
   hasRows?tonnage:'—',!hasRows?'Данные пока не загружены':complete?'По заявкам выбранного статуса':'Часть значений тоннажа не подтверждена');
 const amount=selectedAmount(visible,canonical);
 if(!canonical&&Array.isArray(liveSnapshot?.applications)&&liveSnapshot.applications.length&&resolvingKpiSource===liveSnapshot)
   {amount.state='PENDING';amount.caption='Получаем подтверждённую сумму выбранной категории…'}
 const sum=moneyCard('Сумма · '+filter.label,amount);
 qa('[data-rona-app-total]',grid).forEach(n=>n.remove());
 grid.dataset.ronaAppFilter=bucket;
 grid.style.setProperty('--rona-app-current-accent',filter.tone);
 grid.prepend(count,ton,sum);
 const old=q('[data-rona-app-registry-note]',page);if(old)old.remove();
 grid.insertAdjacentElement('afterend',makeRegistryNote(registryComplete?snapshot:{...snapshot,application_business_contract:null}));
 const queue=q('.rona-app-table',page);
 if(queue){
   queue.style.setProperty('--rona-app-current-accent',filter.tone);
   const oldContext=q('[data-rona-app-queue-context]',queue);if(oldContext)oldContext.remove();
   const context=document.createElement('div');context.className='rona-app-queue-context';
   context.dataset.ronaAppQueueContext='1';context.setAttribute('role','status');
   context.textContent='Открыт статус: '+filter.label+' · '+(hasRows?appCountLabel(visible.length):'данные загружаются');
   const title=q('h2',queue);if(title)title.insertAdjacentElement('afterend',context);else queue.prepend(context);
   const empty=q(':scope > .rona-owner-muted',queue);
   if(empty&&String(empty.textContent||'').includes('По выбранному фильтру заявок нет.'))
     empty.textContent='В категории «'+filter.label+'» заявок нет. Выберите другой статус, чтобы посмотреть реестр.';
 }
 enhanceActions(page)
}
let applyQueued=false;function schedule(){if(!applyQueued){applyQueued=true;queueMicrotask(()=>{const run=()=>{applyQueued=false;apply()};if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else setTimeout(run,0)})}setTimeout(apply,180);setTimeout(apply,900);setTimeout(apply,3000)}
function hookSnapshotLifecycle(){const key='__RONA_OWNER_ADMIN_SNAPSHOT__',d=Object.getOwnPropertyDescriptor(window,key);if(d&&!d.configurable)return false;if(d&&(d.get||d.set))return false;let current=window[key];Object.defineProperty(window,key,{configurable:true,enumerable:d?d.enumerable:true,get(){return current},set(value){current=value;schedule()}});return true}
function bind(){hookSnapshotLifecycle();apply();if(document.__ronaApplicationsTotalBound)return;document.__ronaApplicationsTotalBound=true;window.addEventListener('rona:owner-snapshot',schedule);window.addEventListener('rona:owner-admin-snapshot-updated',schedule);document.addEventListener('click',ev=>{const t=ev.target;if(!t||!t.closest)return;if(t.closest('#nav button[data-page="applications"]')||t.closest('#page-applications'))schedule()},true);document.addEventListener('change',ev=>{const t=ev.target;if(t&&t.closest&&t.closest('#page-applications'))schedule()},true)}
let tries=0;(function wait(){if(window.__RONA_OWNER_ADMIN_READY__===true&&window.__RONA_OWNER_ADMIN_SNAPSHOT__){bind();return}tries++;if(tries<1200)setTimeout(wait,100)})();
})();`;
export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','expires':'0','x-content-type-options':'nosniff','x-rona-applications-total-kpi':'context-color-v1'}})}
