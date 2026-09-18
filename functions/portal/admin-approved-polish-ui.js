const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_ADMIN_APPROVED_POLISH__)return;
window.__RONA_ADMIN_APPROVED_POLISH__='20260918-access-applications-visual-v5';
if(location.pathname!=='/portal/admin')return;

const q=(s,r=document)=>r.querySelector(s);
const el=(t,c,x)=>{const n=document.createElement(t);if(c)n.className=c;if(x!==undefined&&x!==null)n.textContent=String(x);return n};

function ensureStyle(){
  if(q('#ronaApprovedAdminPolishStyle'))return;
  const s=el('style');s.id='ronaApprovedAdminPolishStyle';s.textContent=[
    '#page-claims>.rona-claims-r2-root,#page-claims>.rona-claims-section-title{width:min(100%,1480px)!important;max-width:1480px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}',
    '#page-claims .rona-claims-work{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:14px!important;width:100%!important;max-width:none!important}',
    '#page-claims .rona-claims-registry,#page-claims .rona-claims-side,#page-claims .rona-claims-side>.rona-owner-card{width:100%!important;max-width:none!important;min-width:0!important;box-sizing:border-box!important}',
    '#page-claims .rona-claims-side{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:14px!important}',
    '#page-claims .rona-claims-side>.rona-claims-detail-card{grid-column:auto!important}',
    '#page-messages.rona-radio-single-owner-ready>*:not(.rona-rs-root[data-kind="radio"]){display:none!important}',
    '#page-messages.rona-radio-single-owner-ready>.rona-rs-root[data-kind="radio"]{display:grid!important;visibility:visible!important;opacity:1!important}',

    '#page-access #rona-ca4{--ca-cyan:#63d8ff;--ca-aqua:#5ee7d5;--ca-green:#61dda0;--ca-amber:#ffc86a;--ca-text:#f2f8fc;--ca-muted:#8da7b9;--ca-line:rgba(105,183,219,.17);--ca-line-strong:rgba(99,216,255,.34);width:min(100%,1480px)!important;max-width:1480px!important;margin:0 auto!important;padding:24px 26px 48px!important;gap:16px!important;font-family:"Segoe UI Variable Text","Segoe UI",Inter,Arial,sans-serif!important;font-feature-settings:"tnum" 1;font-variant-numeric:tabular-nums}',
    '#page-access #rona-ca4 .ca-hero{position:relative!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:28px!important;min-height:132px!important;padding:24px 26px!important;margin:0!important;border:1px solid rgba(102,188,226,.20)!important;border-radius:20px!important;background:radial-gradient(620px 170px at 86% 0%,rgba(57,193,242,.13),transparent 60%),linear-gradient(145deg,rgba(8,24,39,.96),rgba(5,16,28,.91))!important;box-shadow:0 18px 46px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.035)!important}',
    '#page-access #rona-ca4 .ca-hero:before{content:""!important;position:absolute!important;left:0!important;top:18px!important;bottom:18px!important;width:3px!important;border-radius:0 5px 5px 0!important;background:linear-gradient(180deg,#63d8ff,#5ee7d5)!important;box-shadow:0 0 22px rgba(99,216,255,.52)!important}',
    '#page-access #rona-ca4 .ca-hero:after{content:""!important;position:absolute!important;left:25px!important;right:25px!important;top:0!important;height:1px!important;background:linear-gradient(90deg,rgba(99,216,255,.72),rgba(94,231,213,.22),transparent 76%)!important;opacity:.72!important}',
    '#page-access #rona-ca4 .rona-visual-kicker{margin-bottom:8px!important;color:#67d7fb!important;font-size:11px!important;line-height:1.2!important;font-weight:850!important;letter-spacing:.16em!important;text-transform:uppercase!important}',
    '#page-access #rona-ca4 .rona-visual-title{margin:0!important;color:#f6fbff!important;font-size:clamp(30px,2.7vw,42px)!important;line-height:1.04!important;font-weight:900!important;letter-spacing:-.035em!important}',
    '#page-access #rona-ca4 .rona-visual-sub{margin-top:9px!important;max-width:760px!important;color:#a9bdca!important;font-size:15px!important;line-height:1.5!important}',
    '#page-access #rona-ca4 .ca-hero-actions{position:relative!important;z-index:2!important;flex:0 0 auto!important}',
    '#page-access #rona-ca4 .ca-hero .ca-primary{min-height:44px!important;padding:0 17px!important;border:1px solid rgba(99,216,255,.38)!important;border-radius:12px!important;background:linear-gradient(145deg,rgba(22,96,137,.86),rgba(12,58,91,.91))!important;color:#f4fbff!important;font-size:14px!important;font-weight:850!important;letter-spacing:.015em!important;box-shadow:0 10px 26px rgba(0,86,132,.23),inset 0 1px 0 rgba(255,255,255,.06)!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease!important}',
    '#page-access #rona-ca4 .ca-hero .ca-primary:hover{transform:translateY(-1px)!important;border-color:rgba(114,226,255,.72)!important;background:linear-gradient(145deg,rgba(25,112,158,.94),rgba(13,70,108,.96))!important;box-shadow:0 14px 32px rgba(0,98,148,.30),0 0 0 1px rgba(99,216,255,.06)!important}',

    '#page-access #rona-ca4 .ca-kpis{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;margin:0!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card{position:relative!important;overflow:hidden!important;min-height:108px!important;margin:0!important;padding:16px 17px 14px 19px!important;border:1px solid var(--ca-line)!important;border-radius:15px!important;background:linear-gradient(155deg,rgba(9,26,42,.94),rgba(5,17,29,.89))!important;box-shadow:0 10px 28px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.028)!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card:before{content:""!important;position:absolute!important;left:0!important;top:12px!important;bottom:12px!important;width:3px!important;border-radius:0 5px 5px 0!important;background:#63d8ff!important;box-shadow:0 0 16px rgba(99,216,255,.40)!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(2):before{background:#5ee7d5!important;box-shadow:0 0 16px rgba(94,231,213,.36)!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(3):before{background:#61dda0!important;box-shadow:0 0 16px rgba(97,221,160,.36)!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(4):before{background:#ffc86a!important;box-shadow:0 0 16px rgba(255,200,106,.32)!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card:hover{transform:translateY(-2px)!important;border-color:rgba(99,216,255,.28)!important;box-shadow:0 14px 34px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.035)!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card>h2{margin:0 0 11px!important;color:#91aabc!important;font-size:10px!important;line-height:1.2!important;font-weight:820!important;letter-spacing:.075em!important;text-transform:uppercase!important}',
    '#page-access #rona-ca4 .ca-kpis .rona-owner-kpi{margin:0 0 7px!important;color:var(--ca-text)!important;font-size:clamp(25px,2vw,33px)!important;line-height:1!important;font-weight:880!important;letter-spacing:-.035em!important}',
    '#page-access #rona-ca4 .ca-kpis .rona-owner-muted{color:#718c9e!important;font-size:9.5px!important;line-height:1.35!important;opacity:1!important}',

    '#page-access #rona-ca4>#ca-current-body{min-width:0!important}',
    '#page-access #rona-ca4>.ca-card:has(.ca-toolbar){margin:0!important;padding:8px!important;border:1px solid var(--ca-line)!important;border-radius:15px!important;background:linear-gradient(180deg,rgba(7,21,35,.93),rgba(5,16,28,.88))!important;box-shadow:0 8px 24px rgba(0,0,0,.11),inset 0 1px 0 rgba(255,255,255,.025)!important}',
    '#page-access #rona-ca4 .ca-toolbar{display:grid!important;grid-template-columns:minmax(260px,1.15fr) auto auto!important;gap:8px!important;align-items:center!important;flex-wrap:nowrap!important}',
    '#page-access #rona-ca4 .ca-search{width:100%!important;min-width:0!important;height:40px!important;margin:0!important;padding:0 13px!important;border:1px solid rgba(107,186,221,.16)!important;border-radius:10px!important;background:rgba(4,14,24,.78)!important;color:#eaf5fb!important;outline:none!important;font-size:11.5px!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important}',
    '#page-access #rona-ca4 .ca-search:focus{border-color:rgba(99,216,255,.42)!important;box-shadow:0 0 0 3px rgba(99,216,255,.07)!important}',
    '#page-access #rona-ca4 .ca-tabs{display:flex!important;gap:4px!important;flex-wrap:nowrap!important;padding:3px!important;border:1px solid rgba(107,186,221,.12)!important;border-radius:11px!important;background:rgba(3,12,21,.58)!important}',
    '#page-access #rona-ca4 .ca-tabs button{height:32px!important;padding:0 10px!important;border:1px solid transparent!important;border-radius:8px!important;background:transparent!important;color:#93aabd!important;font-size:10.5px!important;font-weight:790!important;white-space:nowrap!important;transition:background .14s ease,border-color .14s ease,color .14s ease!important}',
    '#page-access #rona-ca4 .ca-tabs button:hover{color:#fff!important;background:rgba(99,216,255,.055)!important}',
    '#page-access #rona-ca4 .ca-tabs button[aria-pressed="true"]{border-color:rgba(99,216,255,.24)!important;background:linear-gradient(145deg,rgba(21,81,116,.72),rgba(12,50,80,.72))!important;color:#f4fbff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.035)!important}',
    '#page-access #rona-ca4 .ca-toolbar>.ca-btn{height:38px!important;margin:0!important;padding:0 12px!important;border:1px solid rgba(107,186,221,.18)!important;border-radius:10px!important;background:rgba(11,30,47,.72)!important;color:#cfdee8!important;font-size:10.5px!important;font-weight:800!important;white-space:nowrap!important}',
    '#page-access #rona-ca4 .ca-toolbar>.ca-btn:hover{border-color:rgba(99,216,255,.34)!important;background:rgba(16,42,63,.84)!important;color:#fff!important}',

    '#page-access #rona-ca4 .ca-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important}',
    '#page-access #rona-ca4 .ca-grid>.ca-card{position:relative!important;min-width:0!important;margin:0!important;padding:16px!important;border:1px solid rgba(104,184,220,.15)!important;border-radius:15px!important;background:linear-gradient(155deg,rgba(8,23,38,.94),rgba(5,16,28,.89))!important;box-shadow:0 9px 28px rgba(0,0,0,.13),inset 0 1px 0 rgba(255,255,255,.025)!important;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease!important}',
    '#page-access #rona-ca4 .ca-grid>.ca-card:hover{transform:translateY(-1px)!important;border-color:rgba(99,216,255,.27)!important;background:linear-gradient(155deg,rgba(11,31,49,.96),rgba(6,19,32,.92))!important;box-shadow:0 13px 32px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.035)!important}',
    '#page-access #rona-ca4 .ca-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:14px!important;margin-bottom:10px!important}',
    '#page-access #rona-ca4 .ca-name{color:#f1f7fb!important;font-size:14px!important;line-height:1.28!important;font-weight:860!important;letter-spacing:-.01em!important}',
    '#page-access #rona-ca4 .ca-id{margin-top:3px!important;color:#718b9e!important;font-size:9.5px!important;line-height:1.35!important}',
    '#page-access #rona-ca4 .ca-meta{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important;margin-top:0!important}',
    '#page-access #rona-ca4 .ca-cell{min-width:0!important;padding:9px 10px!important;border:1px solid rgba(107,184,219,.10)!important;border-radius:10px!important;background:rgba(4,14,24,.38)!important}',
    '#page-access #rona-ca4 .ca-cell span{display:block!important;color:#6f899a!important;font-size:9px!important;line-height:1.25!important;font-weight:720!important;letter-spacing:.035em!important;text-transform:uppercase!important}',
    '#page-access #rona-ca4 .ca-cell strong{display:block!important;margin-top:5px!important;color:#dce8ef!important;font-size:11.5px!important;line-height:1.35!important;font-weight:760!important;overflow-wrap:anywhere!important}',
    '#page-access #rona-ca4 .ca-actions{display:grid!important;grid-template-columns:minmax(180px,1fr) auto!important;gap:8px!important;align-items:center!important;margin-top:11px!important}',
    '#page-access #rona-ca4 .ca-actions select{width:100%!important;min-width:0!important;height:36px!important;padding:0 9px!important;border:1px solid rgba(107,184,219,.15)!important;border-radius:9px!important;background:rgba(4,14,24,.66)!important;color:#d7e5ee!important;font-size:10.5px!important}',
    '#page-access #rona-ca4 .ca-actions .ca-primary{height:36px!important;padding:0 11px!important;border:1px solid rgba(99,216,255,.28)!important;border-radius:9px!important;background:rgba(18,67,98,.62)!important;color:#edf8fd!important;font-size:10.5px!important;font-weight:820!important}',
    '#page-access #rona-ca4 .ca-actions .ca-primary:hover{border-color:rgba(99,216,255,.52)!important;background:rgba(21,82,119,.78)!important}',

    '#page-access #rona-ca4 #ca-current-body>.ca-card{margin:0!important;padding:16px!important;border:1px solid rgba(105,183,219,.15)!important;border-radius:16px!important;background:linear-gradient(180deg,rgba(7,21,35,.93),rgba(5,16,28,.88))!important;box-shadow:0 10px 30px rgba(0,0,0,.13),inset 0 1px 0 rgba(255,255,255,.022)!important}',
    '#page-access #rona-ca4 #ca-current-body>.ca-card>h2,#page-access #rona-ca4 .ca-history-grid>.ca-card>h2{margin:0 0 13px!important;color:#e9f3f8!important;font-size:13px!important;line-height:1.3!important;font-weight:850!important;letter-spacing:-.01em!important}',
    '#page-access #rona-ca4 .ca-users{overflow:auto!important;border:0!important;border-radius:12px!important}',
    '#page-access #rona-ca4 table{width:100%!important;min-width:960px!important;border-collapse:separate!important;border-spacing:0 6px!important}',
    '#page-access #rona-ca4 th{padding:6px 10px!important;border:0!important;color:#718c9e!important;font-size:8.8px!important;line-height:1.2!important;font-weight:820!important;letter-spacing:.065em!important;text-transform:uppercase!important}',
    '#page-access #rona-ca4 td{padding:11px 10px!important;border-top:1px solid rgba(105,183,219,.09)!important;border-bottom:1px solid rgba(105,183,219,.09)!important;background:rgba(5,17,29,.68)!important;color:#dce8ef!important;font-size:10.5px!important;line-height:1.4!important;vertical-align:middle!important}',
    '#page-access #rona-ca4 tbody tr td:first-child{border-left:1px solid rgba(105,183,219,.09)!important;border-radius:10px 0 0 10px!important}#page-access #rona-ca4 tbody tr td:last-child{border-right:1px solid rgba(105,183,219,.09)!important;border-radius:0 10px 10px 0!important}',
    '#page-access #rona-ca4 tbody tr:hover td{border-color:rgba(99,216,255,.18)!important;background:rgba(10,29,46,.86)!important}',
    '#page-access #rona-ca4 .ca-bindings{display:grid!important;gap:5px!important}#page-access #rona-ca4 .ca-binding{padding:6px 8px!important;border:1px solid rgba(105,183,219,.11)!important;border-radius:8px!important;background:rgba(4,14,24,.42)!important}',
    '#page-access #rona-ca4 .ca-history-grid{display:grid!important;grid-template-columns:1fr!important;gap:12px!important}#page-access #rona-ca4 .ca-history-grid>.ca-card{margin:0!important;padding:16px!important;border:1px solid rgba(105,183,219,.15)!important;border-radius:16px!important;background:linear-gradient(180deg,rgba(7,21,35,.93),rgba(5,16,28,.88))!important;box-shadow:0 10px 30px rgba(0,0,0,.13)!important}',
    '#page-access #rona-ca4 .ca-empty{padding:22px!important;border:1px dashed rgba(105,183,219,.18)!important;border-radius:13px!important;background:rgba(4,14,24,.34)!important;color:#7893a5!important;font-size:11px!important;line-height:1.5!important;text-align:center!important}',
    '#page-access #rona-ca4 .rona-fin-pill{min-height:24px!important;padding:3px 8px!important;border-radius:999px!important;font-size:9px!important;line-height:1.2!important;font-weight:820!important;white-space:nowrap!important}',
    '#page-access #rona-ca4 .rona-fin-pill--success{color:#bdf4d8!important;background:rgba(42,129,88,.17)!important;border-color:rgba(97,221,160,.27)!important}#page-access #rona-ca4 .rona-fin-pill--neutral{color:#a7bac7!important;background:rgba(113,142,160,.10)!important;border-color:rgba(139,170,189,.17)!important}',

    '#page-access #rona-ca4{gap:19px!important}',
    '#page-access #rona-ca4 .ca-kpis{gap:14px!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card>h2{font-size:12.8px!important;font-weight:760!important;letter-spacing:.055em!important;margin-bottom:10px!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(1)>h2{color:#8fe8ff!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(2)>h2{color:#8ef0df!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(3)>h2{color:#92eab9!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(4)>h2{color:#ffd78d!important}',
    '#page-access #rona-ca4 .ca-kpis .rona-owner-kpi{font-size:clamp(31px,2.25vw,41px)!important;font-weight:820!important;line-height:1!important}',
    '#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(1) .rona-owner-kpi{color:#7fe3ff!important;text-shadow:0 0 14px rgba(99,216,255,.13)!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(2) .rona-owner-kpi{color:#79eadb!important;text-shadow:0 0 14px rgba(94,231,213,.12)!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(3) .rona-owner-kpi{color:#80e4ad!important;text-shadow:0 0 14px rgba(97,221,160,.12)!important}#page-access #rona-ca4 .ca-kpis>.ca-card:nth-child(4) .rona-owner-kpi{color:#ffd078!important;text-shadow:0 0 14px rgba(255,200,106,.11)!important}',
    '#page-access #rona-ca4 .ca-kpis .rona-owner-muted{font-size:12px!important;line-height:1.4!important;color:#90a8b8!important}',
    '#page-access #rona-ca4>.ca-card:has(.ca-toolbar){padding:10px!important}',
    '#page-access #rona-ca4 .ca-toolbar{gap:10px!important}',
    '#page-access #rona-ca4 .ca-search{height:44px!important;font-size:15px!important;color:#eef8fd!important}#page-access #rona-ca4 .ca-search::placeholder{color:#86a5b7!important;opacity:1!important}',
    '#page-access #rona-ca4 .ca-tabs{gap:5px!important;padding:4px!important}',
    '#page-access #rona-ca4 .ca-tabs button{height:38px!important;padding:0 12px!important;font-size:14px!important;font-weight:720!important;color:#b2c6d2!important}',
    '#page-access #rona-ca4 .ca-tabs button:nth-child(1)[aria-pressed="true"]{color:#a4ecff!important;border-color:rgba(99,216,255,.34)!important}#page-access #rona-ca4 .ca-tabs button:nth-child(2)[aria-pressed="true"]{color:#9cf2e3!important;border-color:rgba(94,231,213,.34)!important;background:linear-gradient(145deg,rgba(18,88,93,.74),rgba(10,52,66,.74))!important}#page-access #rona-ca4 .ca-tabs button:nth-child(3)[aria-pressed="true"]{color:#a1ecc1!important;border-color:rgba(97,221,160,.30)!important;background:linear-gradient(145deg,rgba(24,88,63,.72),rgba(10,54,47,.72))!important}#page-access #rona-ca4 .ca-tabs button:nth-child(4)[aria-pressed="true"]{color:#ffe09b!important;border-color:rgba(255,200,106,.30)!important;background:linear-gradient(145deg,rgba(93,70,24,.72),rgba(58,45,17,.72))!important}',
    '#page-access #rona-ca4 .ca-toolbar>.ca-btn{height:42px!important;font-size:14px!important;font-weight:740!important;color:#ffd98d!important;border-color:rgba(255,200,106,.25)!important;background:rgba(72,52,17,.30)!important}#page-access #rona-ca4 .ca-toolbar>.ca-btn:hover{color:#fff1c8!important;border-color:rgba(255,200,106,.45)!important;background:rgba(92,66,20,.42)!important}',
    '#page-access #rona-ca4 .ca-grid{gap:18px!important}',
    '#page-access #rona-ca4 .ca-grid>.ca-card{padding:20px 21px!important;box-shadow:0 10px 30px rgba(0,0,0,.13),inset 2px 0 0 rgba(99,216,255,.18),inset 0 1px 0 rgba(255,255,255,.025)!important}#page-access #rona-ca4 .ca-grid>.ca-card:nth-child(even){box-shadow:0 10px 30px rgba(0,0,0,.13),inset 2px 0 0 rgba(94,231,213,.18),inset 0 1px 0 rgba(255,255,255,.025)!important}',
    '#page-access #rona-ca4 .ca-head{gap:16px!important;margin-bottom:14px!important}',
    '#page-access #rona-ca4 .ca-name{font-size:20px!important;line-height:1.32!important;font-weight:800!important;color:#f4f9fc!important}',
    '#page-access #rona-ca4 .ca-id{font-size:14px!important;line-height:1.48!important;color:#9cb2bf!important}',
    '#page-access #rona-ca4 .ca-copy{font-size:14.5px!important;line-height:1.55!important;color:#a9bdc9!important}',
    '#page-access #rona-ca4 .ca-chips{gap:8px!important;margin-top:12px!important}',
    '#page-access #rona-ca4 .ca-chip{padding:6px 10px!important;font-size:14px!important;line-height:1.35!important;color:#dbe8ef!important;border-color:rgba(105,183,219,.20)!important;background:rgba(7,22,35,.52)!important}',
    '#page-access #rona-ca4 .ca-meta{gap:10px!important}',
    '#page-access #rona-ca4 .ca-cell{padding:11px 12px!important}',
    '#page-access #rona-ca4 .ca-cell span{font-size:13px!important;font-weight:700!important;letter-spacing:.025em!important;color:#84c8dc!important}',
    '#page-access #rona-ca4 .ca-cell strong{font-size:15.5px!important;line-height:1.45!important;font-weight:700!important;color:#edf4f8!important}',
    '#page-access #rona-ca4 .ca-actions{gap:10px!important;margin-top:13px!important}',
    '#page-access #rona-ca4 .ca-actions select{height:42px!important;font-size:14px!important;color:#e2eef4!important;border-color:rgba(94,231,213,.19)!important}',
    '#page-access #rona-ca4 .ca-actions .ca-primary{height:42px!important;font-size:14px!important;font-weight:760!important;color:#bff6e7!important;border-color:rgba(94,231,213,.34)!important;background:linear-gradient(145deg,rgba(20,93,84,.64),rgba(13,63,69,.66))!important;box-shadow:0 7px 18px rgba(15,82,80,.12)!important}#page-access #rona-ca4 .ca-actions .ca-primary:hover{color:#ecfffa!important;border-color:rgba(94,231,213,.58)!important;background:linear-gradient(145deg,rgba(25,112,99,.76),rgba(16,76,82,.78))!important}',
    '#page-access #rona-ca4 #ca-current-body>.ca-card>h2,#page-access #rona-ca4 .ca-history-grid>.ca-card>h2{font-size:18px!important;line-height:1.35!important;font-weight:780!important;color:#aeeaff!important}',
    '#page-access #rona-ca4 th{font-size:12.5px!important;font-weight:740!important;color:#91c3d3!important}',
    '#page-access #rona-ca4 td{font-size:14.5px!important;line-height:1.5!important;color:#e6eff4!important}',
    '#page-access #rona-ca4 .ca-binding{padding:9px 10px!important;font-size:14px!important}',
    '#page-access #rona-ca4 .ca-empty{font-size:14.5px!important;color:#a3b8c5!important}',
    '#page-access #rona-ca4 .rona-fin-pill{display:inline-flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;vertical-align:middle!important;min-height:29px!important;padding:5px 10px!important;font-size:12.5px!important;font-weight:760!important;letter-spacing:.01em!important}',
    '#page-access #rona-ca4 .rona-fin-pill--success{color:#9df0c5!important;background:rgba(42,129,88,.20)!important;border-color:rgba(97,221,160,.38)!important;box-shadow:0 0 12px rgba(97,221,160,.07)!important}#page-access #rona-ca4 .rona-fin-pill--neutral{color:#a9e6f5!important;background:rgba(52,111,139,.14)!important;border-color:rgba(99,216,255,.24)!important}',

    '#page-applications .rona-app-kpi-grid{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))!important;gap:12px!important;margin:16px 0 18px!important;align-items:stretch!important}',
    '#page-applications .rona-app-kpi-grid>.rona-owner-card{position:relative!important;overflow:hidden!important;min-height:132px!important;margin:0!important;padding:18px 18px 16px 20px!important;border:1px solid rgba(104,183,219,.18)!important;border-radius:16px!important;background:linear-gradient(155deg,rgba(8,23,38,.96),rgba(5,16,28,.91))!important;box-shadow:0 12px 32px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.032)!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}',
    '#page-applications .rona-app-kpi-grid>.rona-owner-card:before{content:""!important;position:absolute!important;left:0!important;top:13px!important;bottom:13px!important;width:3px!important;border-radius:0 5px 5px 0!important;background:#6bdcff!important;box-shadow:0 0 18px rgba(107,220,255,.34)!important}',
    '#page-applications .rona-app-kpi-grid>.rona-owner-card:hover{transform:translateY(-2px)!important;border-color:rgba(107,220,255,.30)!important;box-shadow:0 16px 38px rgba(0,0,0,.23),0 0 0 1px rgba(107,220,255,.035)!important}',
    '#page-applications .rona-app-kpi-grid>.rona-owner-card>h2{margin:0 0 13px!important;color:#9fc2d3!important;font-size:13px!important;line-height:1.25!important;font-weight:780!important;letter-spacing:.012em!important}',
    '#page-applications .rona-app-kpi-grid .rona-owner-kpi{margin:0 0 8px!important;color:#f4fbff!important;font-size:clamp(30px,2.2vw,42px)!important;line-height:1!important;font-weight:860!important;letter-spacing:-.035em!important;font-variant-numeric:tabular-nums!important}',
    '#page-applications .rona-app-kpi-grid .rona-owner-muted{color:#89a4b4!important;font-size:11.5px!important;line-height:1.42!important;opacity:1!important}',
    '#page-applications .rona-app-kpi-grid>.rona-owner-card:nth-child(1):before,#page-applications .rona-app-kpi-grid>.rona-owner-card:nth-child(2):before{background:#67d7fb!important;box-shadow:0 0 18px rgba(103,215,251,.34)!important}',
    '#page-applications .rona-app-kpi-grid>.rona-owner-card:nth-child(1) .rona-owner-kpi,#page-applications .rona-app-kpi-grid>.rona-owner-card:nth-child(2) .rona-owner-kpi{color:#c8f3ff!important;text-shadow:0 0 14px rgba(103,215,251,.10)!important}',
    '#page-applications .rona-app-kpi--new{border-color:rgba(99,216,255,.25)!important;background:radial-gradient(280px 110px at 0% 0%,rgba(99,216,255,.09),transparent 70%),linear-gradient(155deg,rgba(8,23,38,.96),rgba(5,16,28,.91))!important}',
    '#page-applications .rona-app-kpi--new:before{background:#63d8ff!important;box-shadow:0 0 18px rgba(99,216,255,.38)!important}#page-applications .rona-app-kpi--new .rona-owner-kpi{color:#9eeaff!important}',
    '#page-applications .rona-app-kpi--work{border-color:rgba(94,231,213,.24)!important;background:radial-gradient(280px 110px at 0% 0%,rgba(94,231,213,.08),transparent 70%),linear-gradient(155deg,rgba(8,23,38,.96),rgba(5,16,28,.91))!important}',
    '#page-applications .rona-app-kpi--work:before{background:#5ee7d5!important;box-shadow:0 0 18px rgba(94,231,213,.36)!important}#page-applications .rona-app-kpi--work .rona-owner-kpi{color:#9bf0e4!important}',
    '#page-applications .rona-app-kpi--decision{border-color:rgba(255,200,106,.28)!important;background:radial-gradient(280px 110px at 0% 0%,rgba(255,200,106,.09),transparent 70%),linear-gradient(155deg,rgba(8,23,38,.96),rgba(5,16,28,.91))!important}',
    '#page-applications .rona-app-kpi--decision:before{background:#ffc86a!important;box-shadow:0 0 18px rgba(255,200,106,.32)!important}#page-applications .rona-app-kpi--decision .rona-owner-kpi{color:#ffd992!important}',
    '#page-applications .rona-app-kpi--deal{border-color:rgba(97,221,160,.25)!important;background:radial-gradient(280px 110px at 0% 0%,rgba(97,221,160,.08),transparent 70%),linear-gradient(155deg,rgba(8,23,38,.96),rgba(5,16,28,.91))!important}',
    '#page-applications .rona-app-kpi--deal:before{background:#61dda0!important;box-shadow:0 0 18px rgba(97,221,160,.34)!important}#page-applications .rona-app-kpi--deal .rona-owner-kpi{color:#9be8bf!important}',
    '#page-applications .rona-app-flow{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:0!important;margin:0 0 12px!important;padding:0!important;border:1px solid rgba(106,184,219,.18)!important;border-radius:14px!important;background:linear-gradient(180deg,rgba(7,21,35,.94),rgba(5,16,28,.90))!important;box-shadow:0 8px 24px rgba(0,0,0,.13),inset 0 1px 0 rgba(255,255,255,.025)!important;overflow:hidden!important}',
    '#page-applications .rona-app-flow-step{position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;min-height:48px!important;padding:0 14px!important;border:0!important;border-right:1px solid rgba(106,184,219,.12)!important;border-radius:0!important;background:transparent!important;color:#b5c8d3!important;font-size:13px!important;line-height:1.25!important;font-weight:760!important;letter-spacing:.01em!important;text-align:center!important}',
    '#page-applications .rona-app-flow-step:last-child{border-right:0!important}#page-applications .rona-app-flow-step:before{content:""!important;position:absolute!important;left:18%!important;right:18%!important;top:0!important;height:2px!important;border-radius:0 0 3px 3px!important;background:#63d8ff!important;opacity:.78!important}',
    '#page-applications .rona-app-flow-step:nth-child(2):before{background:#5ee7d5!important}#page-applications .rona-app-flow-step:nth-child(3):before{background:#ffc86a!important}#page-applications .rona-app-flow-step:nth-child(4):before{background:#61dda0!important}',
    '#page-applications .rona-app-flow-step:nth-child(1){color:#9eeaff!important}#page-applications .rona-app-flow-step:nth-child(2){color:#9bf0e4!important}#page-applications .rona-app-flow-step:nth-child(3){color:#ffd992!important}#page-applications .rona-app-flow-step:nth-child(4){color:#9be8bf!important}',
    '#page-applications .rona-app-filter{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:wrap!important;margin:0 0 18px!important;padding:0 2px!important}',
    '#page-applications .rona-app-filter button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:34px!important;padding:0 13px!important;border:1px solid rgba(112,184,218,.16)!important;border-radius:999px!important;background:rgba(5,17,29,.58)!important;color:#9db4c2!important;font-size:12.5px!important;line-height:1!important;font-weight:760!important;white-space:nowrap!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important;transition:transform .14s ease,border-color .14s ease,background .14s ease,color .14s ease!important}',
    '#page-applications .rona-app-filter button:hover{transform:translateY(-1px)!important;color:#eef8fd!important;border-color:rgba(99,216,255,.28)!important;background:rgba(10,30,47,.78)!important}',
    '#page-applications .rona-app-filter .is-new[aria-pressed="true"]{color:#b4efff!important;border-color:rgba(99,216,255,.42)!important;background:rgba(34,109,139,.22)!important;box-shadow:0 0 16px rgba(99,216,255,.07),inset 0 0 0 1px rgba(99,216,255,.08)!important}',
    '#page-applications .rona-app-filter .is-work[aria-pressed="true"]{color:#aef4e9!important;border-color:rgba(94,231,213,.40)!important;background:rgba(28,102,95,.23)!important;box-shadow:0 0 16px rgba(94,231,213,.06),inset 0 0 0 1px rgba(94,231,213,.07)!important}',
    '#page-applications .rona-app-filter .is-decision[aria-pressed="true"]{color:#ffe1a2!important;border-color:rgba(255,200,106,.42)!important;background:rgba(113,81,24,.24)!important;box-shadow:0 0 16px rgba(255,200,106,.06),inset 0 0 0 1px rgba(255,200,106,.07)!important}',
    '#page-applications .rona-app-filter .is-completed[aria-pressed="true"]{color:#b1efcb!important;border-color:rgba(97,221,160,.40)!important;background:rgba(31,104,70,.22)!important;box-shadow:0 0 16px rgba(97,221,160,.06),inset 0 0 0 1px rgba(97,221,160,.07)!important}',
    '#page-applications .rona-app-table{position:relative!important;min-height:236px!important;margin:0!important;padding:18px 18px 20px!important;border:1px solid rgba(106,184,219,.16)!important;border-radius:18px!important;background:linear-gradient(180deg,rgba(7,21,35,.94),rgba(5,16,28,.89))!important;box-shadow:0 14px 38px rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.028)!important;overflow:hidden!important}',
    '#page-applications .rona-app-table:before{content:""!important;position:absolute!important;left:0!important;top:18px!important;bottom:18px!important;width:2px!important;border-radius:0 4px 4px 0!important;background:linear-gradient(180deg,#63d8ff,#5ee7d5)!important;box-shadow:0 0 16px rgba(99,216,255,.26)!important}',
    '#page-applications .rona-app-table>h2{margin:0 0 16px!important;color:#eaf6fb!important;font-size:19px!important;line-height:1.25!important;font-weight:820!important;letter-spacing:-.015em!important}',
    '#page-applications .rona-app-table .rona-owner-table-wrap{overflow:auto!important;border:1px solid rgba(105,183,219,.09)!important;border-radius:12px!important;background:rgba(3,12,21,.28)!important}',
    '#page-applications .rona-app-table .rona-owner-table{width:100%!important;min-width:980px!important;border-collapse:separate!important;border-spacing:0 6px!important}',
    '#page-applications .rona-app-table .rona-owner-table th{padding:9px 11px!important;border:0!important;color:#81b8ca!important;font-size:10.5px!important;line-height:1.2!important;font-weight:790!important;letter-spacing:.055em!important;text-transform:uppercase!important;white-space:nowrap!important}',
    '#page-applications .rona-app-table .rona-owner-table td{padding:12px 11px!important;border-top:1px solid rgba(105,183,219,.08)!important;border-bottom:1px solid rgba(105,183,219,.08)!important;background:rgba(5,17,29,.62)!important;color:#dce9f0!important;font-size:12.5px!important;line-height:1.4!important;vertical-align:middle!important}',
    '#page-applications .rona-app-table .rona-owner-table tbody tr td:first-child{border-left:1px solid rgba(105,183,219,.08)!important;border-radius:10px 0 0 10px!important}#page-applications .rona-app-table .rona-owner-table tbody tr td:last-child{border-right:1px solid rgba(105,183,219,.08)!important;border-radius:0 10px 10px 0!important}',
    '#page-applications .rona-app-table .rona-owner-table tbody tr:hover td{background:rgba(10,30,47,.82)!important;border-color:rgba(99,216,255,.16)!important}',
    '#page-applications .rona-app-table .rona-fin-pill{display:inline-flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;min-height:28px!important;padding:4px 9px!important;border-radius:999px!important;font-size:11.5px!important;font-weight:760!important}',
    '#page-applications .rona-app-table .rona-owner-actions button{min-height:34px!important;padding:0 10px!important;border:1px solid rgba(105,183,219,.18)!important;border-radius:9px!important;background:rgba(8,25,40,.72)!important;color:#d8e8f0!important;font-size:11.5px!important;font-weight:760!important}',
    '#page-applications .rona-app-table .rona-owner-actions button:hover{border-color:rgba(99,216,255,.36)!important;background:rgba(14,43,65,.82)!important;color:#fff!important}',
    '#page-applications .rona-app-table:has(tbody:empty) .rona-owner-table-wrap{display:none!important}',
    '#page-applications .rona-app-table:has(tbody:empty)>.rona-owner-muted{display:flex!important;align-items:center!important;justify-content:center!important;min-height:150px!important;margin:0!important;padding:26px!important;border:1px dashed rgba(105,183,219,.18)!important;border-radius:13px!important;background:radial-gradient(380px 120px at 50% 0%,rgba(99,216,255,.055),transparent 72%),rgba(4,14,24,.30)!important;color:#9bb4c2!important;font-size:13px!important;line-height:1.5!important;text-align:center!important}',
    '@media(max-width:1180px){#page-applications .rona-app-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}}',
    '@media(max-width:900px){#page-applications .rona-app-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}#page-applications .rona-app-flow{grid-template-columns:repeat(2,minmax(0,1fr))!important}#page-applications .rona-app-flow-step:nth-child(2){border-right:0!important}#page-applications .rona-app-flow-step:nth-child(-n+2){border-bottom:1px solid rgba(106,184,219,.12)!important}}',
    '@media(max-width:620px){#page-applications .rona-app-kpi-grid,#page-applications .rona-app-flow{grid-template-columns:1fr!important}#page-applications .rona-app-flow-step{border-right:0!important;border-bottom:1px solid rgba(106,184,219,.12)!important}#page-applications .rona-app-flow-step:last-child{border-bottom:0!important}#page-applications .rona-app-filter{display:grid!important;grid-template-columns:1fr 1fr!important}#page-applications .rona-app-filter button{width:100%!important}}',
    '@media(prefers-reduced-motion:reduce){#page-applications .rona-app-kpi-grid>.rona-owner-card,#page-applications .rona-app-filter button{transition:none!important}#page-applications .rona-app-kpi-grid>.rona-owner-card:hover,#page-applications .rona-app-filter button:hover{transform:none!important}}',

    '.rona-admin-dialog-mask{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,8,14,.78);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px)}',
    '.rona-admin-dialog{width:min(500px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;border:1px solid rgba(222,236,248,.30);border-radius:18px;background:rgba(5,16,28,.99);color:#f7fbff;box-shadow:0 28px 90px rgba(0,0,0,.52)}',
    '.rona-admin-dialog-head{padding:20px 22px 12px}.rona-admin-dialog-head h2{margin:0;font-size:22px;line-height:1.2}.rona-admin-dialog-body{padding:4px 22px 20px;color:#b6c4d1;font-size:14px;line-height:1.55;white-space:pre-wrap}',
    '.rona-admin-dialog-fields{display:grid;gap:13px;padding:0 22px 4px}.rona-admin-dialog-field{display:grid;gap:7px}.rona-admin-dialog-field span{font-size:13px;color:#b6c4d1}.rona-admin-dialog-field input{width:100%;height:44px;border:1px solid rgba(222,236,248,.30);border-radius:12px;background:rgba(7,18,31,.82);color:#fff;padding:0 13px;outline:none}',
    '.rona-admin-dialog-hint{padding:8px 22px 0;color:#b6c4d1;font-size:12px;line-height:1.45}.rona-admin-dialog-error{padding:9px 22px 0;color:#ff9ca4;font-size:12px;line-height:1.4}',
    '.rona-admin-dialog-actions{display:flex;justify-content:flex-end;gap:10px;padding:20px 22px;border-top:1px solid rgba(222,236,248,.16)}.rona-admin-dialog-actions button{height:42px;padding:0 15px;border:1px solid rgba(222,236,248,.30);border-radius:11px;background:rgba(8,21,35,.82);color:#fff;font:inherit;font-size:14px;font-weight:800;cursor:pointer}.rona-admin-dialog-actions button[data-primary=true]{background:rgba(202,34,47,.90);border-color:rgba(255,130,138,.50)}',

    '@media(max-width:1180px){#page-access #rona-ca4 .ca-toolbar{grid-template-columns:1fr!important}#page-access #rona-ca4 .ca-tabs{justify-self:start!important}#page-access #rona-ca4 .ca-toolbar>.ca-btn{justify-self:start!important}}',
    '@media(max-width:980px){#page-access #rona-ca4{padding:20px 18px 40px!important}#page-access #rona-ca4 .ca-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}#page-access #rona-ca4 .ca-grid{grid-template-columns:1fr!important}}',
    '@media(max-width:680px){#page-access #rona-ca4{padding:14px 10px 32px!important;gap:12px!important}#page-access #rona-ca4 .ca-hero{align-items:flex-start!important;flex-direction:column!important;min-height:0!important;padding:20px!important}#page-access #rona-ca4 .ca-hero-actions,#page-access #rona-ca4 .ca-hero-actions .ca-primary{width:100%!important}#page-access #rona-ca4 .ca-kpis{grid-template-columns:1fr 1fr!important;gap:8px!important}#page-access #rona-ca4 .ca-kpis>.ca-card{min-height:96px!important;padding:14px!important}#page-access #rona-ca4 .ca-tabs{display:grid!important;grid-template-columns:1fr 1fr!important;width:100%!important}#page-access #rona-ca4 .ca-tabs button{width:100%!important}#page-access #rona-ca4 .ca-actions{grid-template-columns:1fr!important}#page-access #rona-ca4 .ca-meta{grid-template-columns:1fr!important}.rona-admin-dialog-mask{padding:16px}.rona-admin-dialog-actions{flex-direction:column-reverse}.rona-admin-dialog-actions button{width:100%}}',
    '@media(max-width:430px){#page-access #rona-ca4 .ca-kpis{grid-template-columns:1fr!important}#page-access #rona-ca4 .ca-tabs{grid-template-columns:1fr!important}}',
    '@media(prefers-reduced-motion:reduce){#page-access #rona-ca4 .ca-kpis>.ca-card,#page-access #rona-ca4 .ca-grid>.ca-card,#page-access #rona-ca4 .ca-hero .ca-primary{transition:none!important}#page-access #rona-ca4 .ca-kpis>.ca-card:hover,#page-access #rona-ca4 .ca-grid>.ca-card:hover,#page-access #rona-ca4 .ca-hero .ca-primary:hover{transform:none!important}}'
  ].join('');document.head.append(s)
}

function enforceRadioSingleOwner(){
  const page=q('#page-messages');if(!page)return false;
  const current=q(':scope>.rona-rs-root[data-kind="radio"]',page);
  if(!current){page.classList.remove('rona-radio-single-owner-ready');return false}
  page.classList.add('rona-radio-single-owner-ready');
  current.style.removeProperty('display');current.removeAttribute('aria-hidden');
  window.__RONA_RADIO_SINGLE_OWNER__='remaining-sections-r2';
  return true
}
function installRadioSingleOwner(){
  const page=q('#page-messages');if(!page||page.__ronaRadioSingleOwner)return;
  page.__ronaRadioSingleOwner=true;enforceRadioSingleOwner();
  new MutationObserver(()=>enforceRadioSingleOwner()).observe(page,{childList:true});
  window.addEventListener('rona:admin-pagechange',ev=>{if(String(ev?.detail?.page||'')!=='messages')return;queueMicrotask(enforceRadioSingleOwner);setTimeout(enforceRadioSingleOwner,80);setTimeout(enforceRadioSingleOwner,220)})
}

function installDialogs(){
  if(window.RONA_ADMIN_DIALOGS?.message&&window.RONA_ADMIN_DIALOGS?.confirm&&window.RONA_ADMIN_DIALOGS?.password)return;
  let queue=Promise.resolve();
  const dialogError=code=>{const e=new Error(code);e.code=code;return e};
  const enqueue=f=>{const run=queue.then(f,f);queue=run.catch(()=>{});return run};
  function frame(title,message){
    ensureStyle();const previous=document.activeElement,mask=el('div','rona-admin-dialog-mask'),card=el('section','rona-admin-dialog'),head=el('div','rona-admin-dialog-head'),h=el('h2','',title||'Уведомление');
    card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');head.append(h);card.append(head);if(message!==undefined&&message!==null)card.append(el('div','rona-admin-dialog-body',String(message)));mask.append(card);document.body.append(mask);
    let closed=false;const close=()=>{if(closed)return;closed=true;mask.remove();try{previous?.focus?.()}catch(_){}};return{mask,card,close}
  }
  function message(message,options={}){return enqueue(()=>new Promise(resolve=>{const f=frame(options.title||'Уведомление',message),a=el('div','rona-admin-dialog-actions'),ok=el('button','','OK');ok.type='button';ok.dataset.primary='true';ok.onclick=()=>{f.close();resolve(true)};a.append(ok);f.card.append(a);queueMicrotask(()=>ok.focus())}))}
  function confirm(message,options={}){return enqueue(()=>new Promise(resolve=>{const f=frame(options.title||'Подтверждение действия',message),a=el('div','rona-admin-dialog-actions'),cancel=el('button','',options.cancelLabel||'Отмена'),ok=el('button','',options.confirmLabel||'Подтвердить');cancel.type=ok.type='button';ok.dataset.primary='true';const done=v=>{f.close();resolve(v===true)};cancel.onclick=()=>done(false);ok.onclick=()=>done(true);f.mask.addEventListener('mousedown',ev=>{if(ev.target===f.mask)done(false)});a.append(cancel,ok);f.card.append(a);queueMicrotask(()=>ok.focus())}))}
  function password(label='Установите первоначальный пароль для учётной записи'){return enqueue(()=>new Promise((resolve,reject)=>{const f=frame('Установите пароль',label),fields=el('div','rona-admin-dialog-fields'),hint=el('div','rona-admin-dialog-hint','Не менее 10 символов: заглавная и строчная буквы, цифра и специальный символ.'),err=el('div','rona-admin-dialog-error'),a=el('div','rona-admin-dialog-actions'),cancel=el('button','','Отмена'),ok=el('button','','Подтвердить');
    const make=title=>{const l=el('label','rona-admin-dialog-field'),s=el('span','',title),i=el('input');i.type='password';i.autocomplete='new-password';l.append(s,i);fields.append(l);return i},p1=make('Пароль'),p2=make('Повторите пароль');
    cancel.type=ok.type='button';ok.dataset.primary='true';const fail=t=>{err.textContent=t;p1.focus()};const submit=()=>{const x=String(p1.value||''),y=String(p2.value||'');if(x!==y)return fail('Пароли не совпадают.');if(x.length<10||!/[A-ZА-ЯЁ]/.test(x)||!/[a-zа-яё]/.test(x)||!/[0-9]/.test(x)||!(/[^A-Za-zА-Яа-яЁё0-9]/.test(x)))return fail('Пароль не соответствует требованиям безопасности.');f.close();resolve(x)};cancel.onclick=()=>{f.close();reject(dialogError('ADMIN_PASSWORD_CANCELLED'))};ok.onclick=submit;for(const i of [p1,p2])i.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();submit()}});f.card.append(fields,hint,err,a);a.append(cancel,ok);queueMicrotask(()=>p1.focus())}))}
  window.RONA_ADMIN_DIALOGS=Object.freeze({message,notify:message,confirm,password});
  window.__RONA_ADMIN_DIALOGS_OWNER__='approved-polish-dialog-service-v1';
}

window.addEventListener('rona:admin-pagechange',ev=>{const page=String(ev?.detail?.page||'');if(page==='claims'||page==='access')ensureStyle();if(page==='messages')enforceRadioSingleOwner()});
ensureStyle();installDialogs();installRadioSingleOwner();
window.__RONA_ADMIN_APPROVED_POLISH_READY__=true;
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-admin-polish':'access-applications-visual-v5',
    'x-rona-access-create-owner':'none',
    'x-rona-dialog-layer':'above-access-v1',
    'x-rona-shell-mutation':'claims-layout-radio-dialog-service-access-visual-only'
  }});
}