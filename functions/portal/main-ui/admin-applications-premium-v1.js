const ADMIN_APPLICATIONS_PREMIUM_V1 = String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_PREMIUM_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_APPLICATIONS_PREMIUM_V1__='20260914-v2';
document.documentElement.classList.add('rona-applications-premium-v1','rona-applications-premium-pass2');
const STYLE_ID='ronaAdminApplicationsPremiumV1Style';
const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function installStyle(){
  let s=document.getElementById(STYLE_ID);
  if(!s){s=document.createElement('style');s.id=STYLE_ID;document.head.appendChild(s)}
  s.textContent=[
    'html.rona-applications-premium-pass2 #page-applications{--app-cyan:#63dcff;--app-cyan2:#2ba7df;--app-green:#58e3bc;--app-amber:#ffc86f;--app-red:#ff7180;--app-brand:#e51f2c;--app-text:#f7fbfd;--app-muted:#8ba4b6;--app-line:rgba(139,216,250,.22);color:var(--app-text)}',
    'html.rona-applications-premium-pass2 #page-applications>.rona-owner-page-content{display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:12px!important;width:min(100%,1760px)!important;max-width:1760px!important;margin:0 auto!important;padding:18px 26px 34px!important;box-sizing:border-box!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-applications-hero-v2{position:relative;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:18px;min-height:92px;padding:18px 24px 16px;border:1px solid rgba(118,211,250,.22);border-radius:20px;background:radial-gradient(620px 180px at 93% -30%,rgba(51,178,232,.17),transparent 68%),radial-gradient(420px 210px at -6% -30%,rgba(229,31,44,.11),transparent 70%),linear-gradient(145deg,rgba(10,26,42,.96),rgba(5,15,25,.93));box-shadow:0 20px 58px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.05);backdrop-filter:blur(18px) saturate(130%);-webkit-backdrop-filter:blur(18px) saturate(130%)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-applications-hero-v2::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#f23b49,#b11622 65%,transparent);box-shadow:0 0 22px rgba(229,31,44,.28)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-applications-hero-v2::after{content:"";position:absolute;width:260px;height:260px;right:-95px;top:-185px;border:1px solid rgba(99,220,255,.16);border-radius:50%;box-shadow:0 0 0 30px rgba(99,220,255,.025),0 0 0 62px rgba(99,220,255,.012);pointer-events:none}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-hero-eyebrow{margin-bottom:5px;color:#75cfee;font-size:9px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-hero-title{margin:0;color:#fff;font-size:clamp(30px,3vw,42px);line-height:1;font-weight:950;letter-spacing:-.045em;text-shadow:0 10px 32px rgba(0,0,0,.35)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-hero-subtitle{max-width:780px;margin:8px 0 0;color:#91a9ba;font-size:11px;line-height:1.45;font-weight:650}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-hero-side{align-self:center;justify-self:end;display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid rgba(99,220,255,.18);border-radius:999px;background:rgba(4,15,24,.62);color:#b9d7e7;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;white-space:nowrap}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-hero-side::before{content:"";width:7px;height:7px;border-radius:50%;background:#58e3bc;box-shadow:0 0 12px rgba(88,227,188,.75)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:9px!important;margin:0!important;align-items:stretch!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*{position:relative!important;overflow:hidden!important;min-height:92px!important;margin:0!important;padding:13px 15px 12px!important;border:1px solid rgba(118,188,224,.17)!important;border-radius:14px!important;background:linear-gradient(155deg,rgba(8,23,37,.96),rgba(4,14,24,.94))!important;box-shadow:0 12px 30px rgba(0,0,0,.20),inset 0 1px 0 rgba(255,255,255,.025)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:rgba(99,220,255,.24)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*[data-app-kpi-role="primary"]{border-color:rgba(99,220,255,.24)!important;background:radial-gradient(200px 95px at 100% 0,rgba(45,163,215,.10),transparent 70%),linear-gradient(155deg,rgba(9,27,43,.98),rgba(5,16,27,.96))!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*[data-app-kpi-role="primary"]::before{background:linear-gradient(90deg,#42c6f7,rgba(66,198,247,.08));box-shadow:0 0 14px rgba(66,198,247,.2)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*[data-app-kpi-tone="attention"]::before{background:linear-gradient(90deg,#ffc86f,rgba(255,200,111,.08));box-shadow:0 0 14px rgba(255,200,111,.18)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*[data-app-kpi-tone="success"]::before{background:linear-gradient(90deg,#58e3bc,rgba(88,227,188,.08));box-shadow:0 0 14px rgba(88,227,188,.18)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*[data-app-kpi-role="secondary"]{opacity:.86;border-color:rgba(118,188,224,.13)!important;background:linear-gradient(155deg,rgba(7,20,32,.90),rgba(4,12,21,.90))!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2 h2,html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2 h3{margin:0 0 9px!important;padding:0!important;border:0!important;color:#b9cad6!important;font-size:11px!important;line-height:1.22!important;font-weight:900!important;letter-spacing:-.01em!important;text-shadow:none!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2 strong,html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2 [class*="value"]{font-size:24px!important;line-height:1!important;font-weight:950!important;letter-spacing:-.035em!important;color:#fff!important;font-variant-numeric:tabular-nums!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2 .rona-owner-muted{margin-top:6px!important;color:#6f899d!important;font-size:8px!important;line-height:1.25!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-lifecycle-v2{position:relative!important;display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;margin:1px 0 0!important;padding:5px!important;border:1px solid rgba(116,189,224,.16)!important;border-radius:14px!important;background:rgba(4,14,23,.72)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-lifecycle-v2>*{position:relative!important;min-height:38px!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:7px 12px!important;border:1px solid rgba(115,184,219,.10)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(13,32,49,.70),rgba(7,20,32,.72))!important;color:#8fa9ba!important;font-size:9px!important;line-height:1.2!important;font-weight:900!important;letter-spacing:.035em!important;text-align:center!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-lifecycle-v2>*::after{content:"";position:absolute;right:-9px;top:50%;width:9px;height:1px;background:linear-gradient(90deg,rgba(99,220,255,.34),rgba(99,220,255,.05))}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-lifecycle-v2>*:last-child::after{display:none}',
    'html.rona-applications-premium-pass2 #page-applications>.rona-owner-page-content>.rona-owner-card{position:relative;isolation:isolate;overflow:hidden;margin:0!important;padding:0!important;border:1px solid rgba(124,214,255,.20)!important;border-radius:18px!important;background:linear-gradient(145deg,rgba(8,24,39,.97),rgba(4,14,24,.96))!important;box-shadow:0 22px 60px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.04)!important;backdrop-filter:blur(18px) saturate(128%);-webkit-backdrop-filter:blur(18px) saturate(128%)}',
    'html.rona-applications-premium-pass2 #page-applications>.rona-owner-page-content>.rona-owner-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,rgba(229,31,44,.85),rgba(229,31,44,.22) 42%,transparent 82%);pointer-events:none}',
    'html.rona-applications-premium-pass2 #page-applications .rona-queue-card-v2{background:linear-gradient(155deg,rgba(4,15,25,.985),rgba(3,11,19,.98))!important;border-color:rgba(110,198,237,.22)!important;box-shadow:0 28px 70px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.035)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-card>h2{position:relative;margin:0!important;padding:19px 22px 15px!important;border-bottom:1px solid rgba(139,216,250,.11)!important;color:#fff!important;font-size:26px!important;line-height:1.08!important;font-weight:950!important;letter-spacing:-.035em!important;text-shadow:0 8px 26px rgba(0,0,0,.28)}',
    'html.rona-applications-premium-pass2 #page-applications .rona-queue-card-v2>h2{padding:18px 22px 14px!important;font-size:25px!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-muted{color:var(--app-muted)!important;opacity:1!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-filter{display:flex!important;align-items:center!important;gap:7px!important;width:max-content!important;max-width:calc(100% - 44px)!important;margin:12px 22px 5px!important;padding:5px!important;overflow:auto!important;border:1px solid rgba(139,216,250,.18)!important;border-radius:12px!important;background:rgba(3,12,20,.86)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 22px rgba(0,0,0,.15)!important;scrollbar-color:rgba(99,220,255,.24) transparent}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-filter button{min-height:34px!important;padding:0 14px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:#8ea7b8!important;font-size:10px!important;font-weight:900!important;letter-spacing:.018em!important;white-space:nowrap!important;box-shadow:none!important;transition:background .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-filter button:hover{color:#f5fbff!important;background:rgba(99,220,255,.07)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-filter button.active,html.rona-applications-premium-pass2 #page-applications .rona-app-filter button[aria-pressed="true"]{color:#fff!important;background:linear-gradient(180deg,rgba(54,169,220,.24),rgba(28,110,158,.16))!important;box-shadow:inset 0 0 0 1px rgba(99,220,255,.32),0 7px 20px rgba(0,0,0,.16)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table-wrap{width:100%!important;padding:8px 14px 18px!important;overflow:auto!important;box-sizing:border-box!important;scrollbar-color:rgba(99,220,255,.25) transparent}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table{width:100%!important;min-width:1080px!important;border-collapse:separate!important;border-spacing:0 7px!important;font-size:12.5px!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table thead th{padding:8px 10px!important;border:0!important;background:transparent!important;color:#6e8ca2!important;font-size:8.5px!important;line-height:1.2!important;font-weight:950!important;letter-spacing:.10em!important;text-transform:uppercase!important;white-space:nowrap!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody tr{position:relative!important;transition:transform .15s ease,filter .15s ease!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody tr:hover{transform:translateY(-1px)!important;filter:brightness(1.07)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody td{padding:13px 10px!important;border-top:1px solid rgba(116,188,224,.15)!important;border-bottom:1px solid rgba(116,188,224,.15)!important;background:linear-gradient(180deg,rgba(9,27,43,.97),rgba(6,20,33,.97))!important;color:#dfeaf1!important;font-size:12.5px!important;line-height:1.42!important;vertical-align:middle!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody td:first-child{border-left:1px solid rgba(122,190,224,.16)!important;border-radius:11px 0 0 11px!important;box-shadow:inset 3px 0 0 rgba(99,220,255,.54),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody tr[data-app-row-tone="attention"] td:first-child{box-shadow:inset 3px 0 0 rgba(255,193,105,.78),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody tr[data-app-row-tone="success"] td:first-child{box-shadow:inset 3px 0 0 rgba(88,227,188,.76),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody tr[data-app-row-tone="danger"] td:first-child{box-shadow:inset 3px 0 0 rgba(255,113,128,.82),inset 0 1px 0 rgba(255,255,255,.018)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody td:last-child{border-right:1px solid rgba(122,190,224,.16)!important;border-radius:0 11px 11px 0!important}',
    'html.rona-applications-premium-pass2 #page-applications td[data-app-col="application-id"]{font-weight:950!important;color:#fff!important;font-size:11px!important;letter-spacing:.02em!important;white-space:nowrap!important}',
    'html.rona-applications-premium-pass2 #page-applications td[data-app-col="client"]{font-weight:850!important;color:#f4f8fb!important;font-size:12.5px!important}',
    'html.rona-applications-premium-pass2 #page-applications td[data-app-col="product"]{font-weight:760!important;color:#dcebf3!important;font-size:12px!important}',
    'html.rona-applications-premium-pass2 #page-applications td[data-app-col="quantity"],html.rona-applications-premium-pass2 #page-applications td[data-app-col="value"]{font-variant-numeric:tabular-nums!important;font-weight:950!important;color:#fff!important;font-size:13px!important;white-space:nowrap!important}',
    'html.rona-applications-premium-pass2 #page-applications td[data-app-col="status"] .rona-app-status-chip{display:inline-flex;align-items:center;min-height:27px;max-width:220px;padding:5px 9px;border:1px solid rgba(148,163,184,.25);border-radius:999px;background:rgba(148,163,184,.07);color:#d9e4eb;font-size:8.5px;font-weight:950;line-height:1.2;letter-spacing:.05em;white-space:normal}',
    'html.rona-applications-premium-pass2 #page-applications td[data-app-col="status"] .rona-app-status-chip::before{content:"";width:6px;height:6px;flex:0 0 6px;margin-right:7px;border-radius:50%;background:currentColor;box-shadow:0 0 10px currentColor;opacity:.9}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-status-chip[data-tone="progress"]{border-color:rgba(99,220,255,.34);background:rgba(43,161,215,.09);color:#c4f0ff}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-status-chip[data-tone="attention"]{border-color:rgba(255,193,105,.36);background:rgba(207,127,20,.10);color:#ffd493}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-status-chip[data-tone="success"]{border-color:rgba(88,227,188,.35);background:rgba(28,163,111,.09);color:#c2f5e4}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-status-chip[data-tone="danger"]{border-color:rgba(255,113,128,.38);background:rgba(207,45,80,.10);color:#ffc7cf}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-actions,html.rona-applications-premium-pass2 #page-applications .rona-app-actions{display:flex!important;align-items:center!important;gap:7px!important;flex-wrap:wrap!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-actions button,html.rona-applications-premium-pass2 #page-applications button[data-rona-app-passport-open]{min-height:32px!important;padding:0 11px!important;border:1px solid rgba(139,216,250,.22)!important;border-radius:8px!important;background:rgba(255,255,255,.028)!important;color:#eaf6fc!important;font-size:9.5px!important;font-weight:950!important;letter-spacing:.014em!important;white-space:nowrap!important;cursor:pointer!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;transition:transform .14s ease,border-color .14s ease,background .14s ease,box-shadow .14s ease!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-actions button:hover,html.rona-applications-premium-pass2 #page-applications button[data-rona-app-passport-open]:hover{transform:translateY(-1px)!important;border-color:rgba(99,220,255,.52)!important;background:rgba(99,220,255,.09)!important;box-shadow:0 8px 22px rgba(0,0,0,.18),0 0 16px rgba(99,220,255,.07)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-action--primary,html.rona-applications-premium-pass2 #page-applications button[data-rona-app-passport-open]{min-width:72px!important;border-color:rgba(99,220,255,.52)!important;background:linear-gradient(180deg,rgba(47,171,226,.28),rgba(26,104,151,.20))!important;color:#f0fbff!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 0 18px rgba(52,177,231,.08)!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-action--success{border-color:rgba(88,227,188,.40)!important;background:rgba(40,175,126,.11)!important;color:#d8faef!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-app-action--danger{border-color:rgba(255,113,128,.42)!important;background:rgba(202,47,78,.11)!important;color:#ffd5db!important}',
    'html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody tr:focus-within td{border-top-color:rgba(99,220,255,.34)!important;border-bottom-color:rgba(99,220,255,.34)!important}',
    'html.rona-applications-premium-pass2 #page-applications button:focus-visible{outline:2px solid rgba(99,220,255,.82)!important;outline-offset:2px!important}',
    'html.rona-applications-premium-pass2 #page-applications .current-loading-card{border:1px solid rgba(139,216,250,.21)!important;border-radius:16px!important;background:linear-gradient(155deg,rgba(10,27,43,.98),rgba(4,14,24,.97))!important;box-shadow:0 18px 46px rgba(0,0,0,.28)!important}',
    '@media(max-width:1480px){html.rona-applications-premium-pass2 #page-applications>.rona-owner-page-content{padding:16px 18px 30px!important}html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2{grid-template-columns:repeat(3,minmax(0,1fr))!important}html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*{min-height:84px!important}html.rona-applications-premium-pass2 #page-applications .rona-applications-hero-v2{min-height:84px}}',
    '@media(max-width:980px){html.rona-applications-premium-pass2 #page-applications>.rona-owner-page-content{padding:14px 10px 26px!important}html.rona-applications-premium-pass2 #page-applications .rona-applications-hero-v2{grid-template-columns:1fr;min-height:0;padding:16px 17px}html.rona-applications-premium-pass2 #page-applications .rona-app-hero-side{display:none}html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2{grid-template-columns:repeat(2,minmax(0,1fr))!important}html.rona-applications-premium-pass2 #page-applications .rona-app-lifecycle-v2{grid-template-columns:repeat(2,minmax(0,1fr))!important}html.rona-applications-premium-pass2 #page-applications .rona-app-filter{max-width:calc(100% - 28px)!important;margin:10px 14px 4px!important}html.rona-applications-premium-pass2 #page-applications .rona-owner-table-wrap{padding-inline:8px!important}}',
    '@media(max-width:620px){html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2{grid-template-columns:1fr 1fr!important}html.rona-applications-premium-pass2 #page-applications .rona-app-kpi-grid-v2>*{min-height:80px!important;padding:11px!important}html.rona-applications-premium-pass2 #page-applications .rona-app-hero-title{font-size:30px}html.rona-applications-premium-pass2 #page-applications .rona-app-lifecycle-v2{grid-template-columns:1fr!important}}',
    '@media(prefers-reduced-motion:reduce){html.rona-applications-premium-pass2 #page-applications .rona-owner-table tbody tr,html.rona-applications-premium-pass2 #page-applications button{transition:none!important}}'
  ].join('');
}
function columnKey(label){
  const t=norm(label);
  if(t==='заявка'||t.includes('id заявки')||t.includes('номер заявки'))return'application-id';
  if(t.includes('контрагент')||t.includes('клиент'))return'client';
  if(t.includes('продукт')||t.includes('товар'))return'product';
  if(t.includes('объём')||t.includes('объем'))return'quantity';
  if(t.includes('период'))return'period';
  if(t.includes('статус')||t.includes('состояние')||t.includes('этап'))return'status';
  if(t.includes('ресурс'))return'resource';
  if(t.includes('цена')||t.includes('стоимость')||t.includes('сумма'))return'value';
  if(t.includes('действ'))return'actions';
  return'';
}
function toneFor(text){
  const t=norm(text);
  if(!t||t==='—')return'neutral';
  if(/отказ|отклон|отмен|ошиб|просроч|rejected|cancel/.test(t))return'danger';
  if(/ожида|решени|pending|согласован|требует|counter/.test(t))return'attention';
  if(/заверш|одобрен|подтверж|сделк|готов|approved|complete|deal/.test(t))return'success';
  if(/нов|работ|обработ|принят|registered|work/.test(t))return'progress';
  return'neutral';
}
function decorateAction(button){
  if(!button)return;
  const t=norm(button.textContent);
  button.classList.remove('rona-app-action--primary','rona-app-action--success','rona-app-action--danger');
  if(button.hasAttribute('data-rona-app-passport-open')||t==='открыть'||/отправить в сделки/.test(t))button.classList.add('rona-app-action--primary');
  else if(/ресурс одобрен|ресурс подтвержден|сохранить|прикрепить/.test(t))button.classList.add('rona-app-action--success');
  else if(/в ресурсе отказано|отказать|отклонить|отмен/.test(t))button.classList.add('rona-app-action--danger');
  button.dataset.ronaAppPremiumAction='2';
}
function decorateStatus(cell,text){
  if(!cell)return;
  if(cell.querySelector('button,input,select,textarea,a'))return;
  const value=String(text||'').replace(/\s+/g,' ').trim();
  if(!value||value==='—')return;
  const tone=toneFor(value);
  let chip=cell.querySelector(':scope>.rona-app-status-chip');
  if(chip&&chip.textContent===value&&chip.dataset.tone===tone){cell.dataset.ronaAppPremiumStatus='2';return}
  if(!chip){chip=document.createElement('span');chip.className='rona-app-status-chip';cell.replaceChildren(chip)}
  chip.dataset.tone=tone;
  if(chip.textContent!==value)chip.textContent=value;
  cell.dataset.ronaAppPremiumStatus='2';
}
function ensureHero(root){
  const host=root.querySelector(':scope>.rona-owner-page-content')||root.querySelector('.rona-owner-page-content');
  if(!host||host.querySelector(':scope>.rona-applications-hero-v2'))return;
  const hero=document.createElement('section');
  hero.className='rona-applications-hero-v2';
  const main=document.createElement('div');
  main.innerHTML='<div class="rona-app-hero-eyebrow">RONA TRADE · OPERATIONS</div><h1 class="rona-app-hero-title">Заявки</h1><p class="rona-app-hero-subtitle">Операционный контур заявок: приоритеты, решения по ресурсу и передача в сделку.</p>';
  const side=document.createElement('div');
  side.className='rona-app-hero-side';
  side.textContent='Текущий рабочий контур';
  hero.append(main,side);
  host.prepend(hero);
}
function decorateKpis(root){
  const candidates=Array.from(root.querySelectorAll('.rona-owner-grid,[class*="kpi-grid"],[class*="metric-grid"]'));
  for(const grid of candidates){
    const text=norm(grid.textContent);
    if(!(text.includes('тоннаж общий')&&text.includes('сумма общая')&&text.includes('новые')))continue;
    grid.classList.add('rona-app-kpi-grid-v2');
    for(const child of Array.from(grid.children)){
      const t=norm(child.textContent);
      const primary=/новые|в работе|требует подтверждения|перешли в сделку/.test(t);
      child.dataset.appKpiRole=primary?'primary':'secondary';
      if(/требует подтверждения/.test(t))child.dataset.appKpiTone='attention';
      else if(/перешли в сделку/.test(t))child.dataset.appKpiTone='success';
      else child.dataset.appKpiTone=primary?'progress':'secondary';
    }
  }
}
function decorateLifecycle(root){
  for(const el of Array.from(root.querySelectorAll('div,section,nav'))){
    if(el.classList.contains('rona-app-lifecycle-v2'))continue;
    const t=norm(el.textContent);
    if(!t.includes('1. заявка')||!t.includes('2. согласование')||!t.includes('4. сделка'))continue;
    const children=Array.from(el.children);
    if(children.length>=4&&children.length<=6){el.classList.add('rona-app-lifecycle-v2');break}
  }
}
function decorateQueue(root){
  for(const card of root.querySelectorAll('.rona-owner-card')){
    const h=card.querySelector(':scope>h2');
    if(h&&norm(h.textContent).includes('рабочая очередь заявок'))card.classList.add('rona-queue-card-v2');
  }
}
function decorateTable(root){
  for(const table of root.querySelectorAll('.rona-owner-table')){
    table.dataset.ronaApplicationsPremium='2';
    const headers=Array.from(table.querySelectorAll('thead th'));
    const keys=headers.map(h=>columnKey(h.textContent));
    headers.forEach((h,i)=>{if(keys[i])h.dataset.appCol=keys[i]});
    for(const row of table.querySelectorAll('tbody tr')){
      const cells=Array.from(row.children);
      let rowTone='neutral';
      cells.forEach((cell,i)=>{
        const key=keys[i]||'';
        if(key)cell.dataset.appCol=key;
        if(key==='status'){
          const text=cell.querySelector('.rona-app-status-chip')?.textContent||cell.textContent;
          rowTone=toneFor(text);
          decorateStatus(cell,text);
        }
      });
      row.dataset.appRowTone=rowTone;
      for(const button of row.querySelectorAll('button'))decorateAction(button);
    }
  }
}
let queued=false;
function apply(){
  queued=false;
  installStyle();
  const root=document.getElementById('page-applications');
  if(!root)return;
  root.dataset.ronaApplicationsPremium='pass2';
  ensureHero(root);
  decorateKpis(root);
  decorateLifecycle(root);
  decorateQueue(root);
  decorateTable(root);
  for(const button of root.querySelectorAll('button'))decorateAction(button);
}
function schedule(){if(queued)return;queued=true;queueMicrotask(apply)}
installStyle();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
const root=document.getElementById('page-applications');
if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
})();
`;

export default ADMIN_APPLICATIONS_PREMIUM_V1;
