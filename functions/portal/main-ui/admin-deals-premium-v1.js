const ADMIN_DEALS_PREMIUM_V1=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_DEALS_PREMIUM_V1__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_DEALS_PREMIUM_V1__='20260920-executive-v3-compact-readable';
const STYLE_ID='ronaAdminDealsPremiumV1Style';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=[
    'html.rona-deals-premium-v1 #page-deals{--dx-cyan:#63dcff;--dx-blue:#65a9ff;--dx-violet:#b39cff;--dx-amber:#ffc86f;--dx-green:#58e3bc;--dx-red:#ff7180;--dx-text:#f7fbfd;--dx-muted:#8fa9ba;--dx-line:rgba(126,207,244,.20);color:var(--dx-text)}',
    'html.rona-deals-premium-v1 #page-deals>.rona-owner-page-content,html.rona-deals-premium-v1 #page-deals .rona-owner-page-content[data-owner-page="deals"]{position:relative;isolation:isolate;padding:22px 24px 42px!important}',
    'html.rona-deals-premium-v1 #page-deals>.rona-owner-page-content::before,html.rona-deals-premium-v1 #page-deals .rona-owner-page-content[data-owner-page="deals"]::before{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(760px 360px at 96% 5%,rgba(51,166,221,.15),transparent 68%),radial-gradient(620px 340px at 2% 18%,rgba(229,31,44,.07),transparent 72%),linear-gradient(180deg,rgba(2,10,18,.08),rgba(2,9,16,.34))}',
    'html.rona-deals-premium-v1 #page-deals .rona-visual-hero{position:relative;overflow:hidden;margin-bottom:16px!important;border:1px solid rgba(122,211,250,.25)!important;border-radius:20px!important;background:linear-gradient(90deg,rgba(229,31,44,.82) 0 3px,transparent 3px),radial-gradient(620px 230px at 100% 0,rgba(54,179,235,.18),transparent 65%),linear-gradient(138deg,rgba(13,31,48,.94),rgba(6,16,27,.82))!important;box-shadow:0 24px 64px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.06)!important;backdrop-filter:blur(18px) saturate(135%);-webkit-backdrop-filter:blur(18px) saturate(135%)}',
    'html.rona-deals-premium-v1 #page-deals .rona-visual-hero::after{content:"";position:absolute;width:250px;height:250px;right:-80px;top:-145px;border:1px solid rgba(99,220,255,.10);border-radius:50%;box-shadow:0 0 0 25px rgba(99,220,255,.023),0 0 0 52px rgba(99,220,255,.015);pointer-events:none}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:11px!important;margin-bottom:12px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>.rona-owner-card,html.rona-deals-premium-v1 #page-deals .rona-deal-kpi{--dx-accent:var(--dx-cyan);position:relative;overflow:hidden;min-height:92px!important;margin:0!important;padding:12px 16px!important;border:1px solid color-mix(in srgb,var(--dx-accent) 30%,transparent)!important;border-radius:16px!important;background:radial-gradient(250px 135px at 100% 0,color-mix(in srgb,var(--dx-accent) 13%,transparent),transparent 72%),linear-gradient(145deg,rgba(11,28,44,.96),rgba(5,16,27,.91))!important;box-shadow:0 18px 44px rgba(0,0,0,.28),inset 3px 0 0 color-mix(in srgb,var(--dx-accent) 70%,transparent),inset 0 1px 0 rgba(255,255,255,.055)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>.rona-owner-card::after,html.rona-deals-premium-v1 #page-deals .rona-deal-kpi::after{content:"";position:absolute;left:16px;right:16px;top:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dx-accent) 48%,transparent),transparent);pointer-events:none}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>.rona-owner-card:hover,html.rona-deals-premium-v1 #page-deals .rona-deal-kpi:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--dx-accent) 44%,transparent)!important;box-shadow:0 24px 52px rgba(0,0,0,.33),0 0 24px color-mix(in srgb,var(--dx-accent) 7%,transparent),inset 3px 0 0 color-mix(in srgb,var(--dx-accent) 80%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(1){--dx-accent:#63dcff}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(2){--dx-accent:#ffc86f;border-color:rgba(255,200,111,.38)!important;background:radial-gradient(260px 145px at 100% 0,rgba(255,200,111,.14),transparent 72%),linear-gradient(145deg,rgba(31,25,19,.96),rgba(9,16,24,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(3){--dx-accent:#65a9ff;border-color:rgba(101,169,255,.36)!important;background:radial-gradient(260px 145px at 100% 0,rgba(101,169,255,.14),transparent 72%),linear-gradient(145deg,rgba(18,28,42,.96),rgba(8,16,28,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(4){--dx-accent:#58e3bc}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(5){--dx-accent:#63dcff}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(6){--dx-accent:#58e3bc}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi h2,html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>.rona-owner-card>h2{margin:0 0 6px!important;color:#e6f0f5!important;font-size:13px!important;line-height:1.18!important;font-weight:880!important;letter-spacing:-.015em}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi .rona-owner-kpi,html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>.rona-owner-card .rona-owner-kpi{margin:0 0 5px!important;color:color-mix(in srgb,var(--dx-accent) 24%,#fff)!important;font-size:clamp(27px,1.85vw,31px)!important;line-height:1!important;font-weight:920!important;letter-spacing:-.045em!important;font-variant-numeric:tabular-nums;text-shadow:0 10px 26px rgba(0,0,0,.30)}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi .rona-owner-muted,html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>.rona-owner-card .rona-owner-muted{color:#93aaba!important;font-size:10.5px!important;line-height:1.34!important;font-weight:650}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(1) .rona-owner-kpi{color:#a9edff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(2) .rona-owner-kpi{color:#ffd992!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(3) .rona-owner-kpi{color:#a9cfff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(4) .rona-owner-kpi{color:#a7efcf!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(5) .rona-owner-kpi{color:#b9f1ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid>*:nth-child(6) .rona-owner-kpi{color:#a7efcf!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter{display:flex!important;gap:8px!important;align-items:center;flex-wrap:wrap;margin:0 0 12px!important;padding:7px 8px!important;border:1px solid rgba(126,204,241,.13)!important;border-radius:13px!important;background:linear-gradient(180deg,rgba(6,20,32,.72),rgba(3,13,22,.66))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 12px 28px rgba(0,0,0,.13)!important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button{min-height:34px!important;padding:0 14px!important;border:1px solid rgba(126,177,207,.20)!important;border-radius:9px!important;background:rgba(6,18,29,.68)!important;color:#9fb5c3!important;font-size:11.5px!important;line-height:1!important;font-weight:850!important;letter-spacing:.005em!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:transform .15s ease,border-color .15s ease,background .15s ease,color .15s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button:hover{transform:translateY(-1px);color:#fff!important;border-color:rgba(99,220,255,.32)!important;background:rgba(15,42,61,.78)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-active{color:#bff2ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-attention{color:#ffd28b!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-completed{color:#bdf3df!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button.is-annulled{color:#ff9ca6!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button[aria-pressed="true"].is-active{border-color:rgba(99,220,255,.43)!important;background:linear-gradient(180deg,rgba(53,165,214,.25),rgba(20,82,116,.18))!important;box-shadow:inset 0 0 0 1px currentColor,0 8px 20px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button[aria-pressed="true"].is-attention{border-color:rgba(255,200,111,.42)!important;background:linear-gradient(180deg,rgba(179,114,31,.23),rgba(92,58,20,.17))!important;box-shadow:inset 0 0 0 1px currentColor,0 8px 20px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button[aria-pressed="true"].is-completed{border-color:rgba(88,227,188,.40)!important;background:linear-gradient(180deg,rgba(39,153,115,.22),rgba(18,78,61,.17))!important;box-shadow:inset 0 0 0 1px currentColor,0 8px 20px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-filter button[aria-pressed="true"].is-annulled{border-color:rgba(255,113,128,.42)!important;background:linear-gradient(180deg,rgba(174,53,69,.22),rgba(83,31,40,.17))!important;box-shadow:inset 0 0 0 1px currentColor,0 8px 20px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table{position:relative;overflow:hidden;margin:0!important;padding:16px 18px 18px!important;border:1px solid rgba(129,211,248,.25)!important;border-radius:17px!important;background:radial-gradient(760px 220px at 48% 0,rgba(36,112,151,.08),transparent 72%),linear-gradient(145deg,rgba(4,17,28,.988),rgba(2,11,19,.98))!important;box-shadow:0 26px 68px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.045)!important;backdrop-filter:blur(22px) saturate(118%);-webkit-backdrop-filter:blur(22px) saturate(118%)}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table::before{content:"";position:absolute;left:18px;right:18px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(99,220,255,.33),rgba(179,156,255,.20),transparent);pointer-events:none}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table>h2{margin:0 0 15px!important;color:#f6fbff!important;font-size:20px!important;line-height:1.15!important;font-weight:900!important;letter-spacing:-.024em}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table-wrap{overflow:auto!important;border:1px solid rgba(130,207,243,.20)!important;border-radius:13px!important;background:rgba(1,8,14,.84)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 14px 36px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table{width:100%!important;min-width:1360px!important;border-collapse:separate!important;border-spacing:0!important;font-size:14px!important;font-variant-numeric:tabular-nums}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table thead th{position:sticky;top:0;z-index:2;padding:11px 11px!important;border-bottom:1px solid rgba(125,205,241,.20)!important;background:linear-gradient(180deg,rgba(14,35,52,.995),rgba(7,22,34,.995))!important;color:#89a6b8!important;font-size:11px!important;line-height:1.16!important;font-weight:900!important;letter-spacing:.055em!important;text-transform:uppercase;white-space:nowrap}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody td{padding:14px 11px!important;border-bottom:1px solid rgba(121,177,207,.105)!important;background:rgba(3,13,22,.91)!important;color:#e5eef3!important;font-size:14px!important;line-height:1.3!important;vertical-align:middle!important;transition:background .14s ease,color .14s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody tr:nth-child(even) td{background:rgba(5,17,27,.92)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody tr:last-child td{border-bottom:0!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table tbody tr:hover td{background:linear-gradient(180deg,rgba(15,42,61,.985),rgba(7,26,40,.985))!important;box-shadow:inset 0 1px 0 rgba(126,221,255,.035),inset 0 -1px 0 rgba(126,221,255,.025)}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(1),html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(1){color:#9feaff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(2){color:#c9c0ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(1){font-weight:920!important;letter-spacing:.008em!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(2){color:#f1eeff!important;white-space:normal!important;min-width:215px!important;max-width:255px!important;overflow-wrap:anywhere!important;font-weight:760!important;line-height:1.28!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(3){color:#9edfff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(3){min-width:170px!important;color:#d9f1fb!important;font-weight:760!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(4),html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(4){color:#ffd58b!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(4){min-width:86px!important;font-weight:900!important;text-align:center}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(5){color:#b7c8ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(5){min-width:170px!important;color:#d8e2ff!important;font-weight:780!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(6){color:#ffc57d!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(6){min-width:126px!important;font-weight:820!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(7){color:#89dcff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(8){color:#8fe8c9!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(9){color:#79caff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(10){color:#c3b2ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table th:nth-child(11){color:#86eaff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(7),html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(8),html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(9),html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(10){text-align:center}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-id{font-weight:920!important;letter-spacing:.008em!important;color:#9feaff!important;text-shadow:0 0 18px rgba(99,220,255,.10)}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill{min-height:29px!important;padding:5px 10px!important;border-radius:999px!important;font-size:10.5px!important;font-weight:850!important;letter-spacing:.02em!important;box-shadow:inset 0 0 16px rgba(255,255,255,.018)}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="success"],html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="ok"]{color:#75edc0!important;border-color:rgba(88,227,188,.34)!important;background:rgba(37,157,115,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="warn"]{color:#ffd184!important;border-color:rgba(255,200,111,.34)!important;background:rgba(179,111,27,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="danger"]{color:#ff8b98!important;border-color:rgba(255,113,128,.34)!important;background:rgba(177,49,65,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="info"]{color:#8ee2ff!important;border-color:rgba(99,220,255,.30)!important;background:rgba(38,141,190,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(3) .rona-fin-pill,html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(4) .rona-fin-pill,html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(5) .rona-fin-pill{border-color:rgba(132,187,216,.20)!important;background:rgba(76,106,125,.085)!important;color:#bdd0dc!important;box-shadow:none!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(7) .rona-fin-pill{border-color:rgba(117,166,198,.19)!important;background:rgba(57,84,104,.08)!important;color:#afc5d3!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(8) .rona-fin-pill{border-color:rgba(88,227,188,.25)!important;background:rgba(39,146,111,.08)!important;color:#8ee8c9!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(9) .rona-fin-pill{border-color:rgba(101,169,255,.22)!important;background:rgba(56,105,170,.08)!important;color:#91c4ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table td:nth-child(10) .rona-fin-pill{min-height:28px!important;padding:5px 10px!important;font-size:10.5px!important;font-weight:920!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-open,html.rona-deals-premium-v1 #page-deals .rona-deal-detail-btn{min-height:37px!important;padding:0 14px!important;border:1px solid rgba(99,220,255,.46)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(42,139,181,.46),rgba(17,75,105,.36))!important;color:#edfbff!important;font-size:12px!important;font-weight:920!important;box-shadow:0 8px 21px rgba(18,110,153,.14),inset 0 1px 0 rgba(255,255,255,.06)!important;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease,background .14s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-open:hover,html.rona-deals-premium-v1 #page-deals .rona-deal-detail-btn:hover{transform:translateY(-1px);border-color:rgba(137,236,255,.72)!important;background:linear-gradient(180deg,rgba(53,171,218,.55),rgba(20,93,127,.43))!important;box-shadow:0 10px 27px rgba(26,139,187,.22),0 0 18px rgba(99,220,255,.055),inset 0 1px 0 rgba(255,255,255,.075)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-open:focus-visible,html.rona-deals-premium-v1 #page-deals .rona-deal-filter button:focus-visible,html.rona-deals-premium-v1 #page-deals .rona-deal-actions button:focus-visible{outline:2px solid rgba(99,220,255,.72)!important;outline-offset:2px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-grid{gap:12px!important;margin-top:12px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-grid>.rona-owner-card{margin:0!important;border:1px solid rgba(124,202,238,.18)!important;border-radius:15px!important;background:radial-gradient(280px 140px at 100% 0,rgba(72,171,219,.08),transparent 72%),linear-gradient(145deg,rgba(10,26,40,.95),rgba(5,16,26,.90))!important;box-shadow:0 18px 42px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.035)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-grid>.rona-owner-card:nth-child(1){box-shadow:inset 3px 0 0 rgba(99,220,255,.56),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-grid>.rona-owner-card:nth-child(2){box-shadow:inset 3px 0 0 rgba(255,200,111,.50),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-grid>.rona-owner-card:nth-child(3){box-shadow:inset 3px 0 0 rgba(101,169,255,.52),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-grid>.rona-owner-card:nth-child(4){box-shadow:inset 3px 0 0 rgba(88,227,188,.50),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-row{padding:8px 0!important;border-bottom-color:rgba(127,184,214,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-detail-label{color:#7e9caf!important;font-size:9.5px!important;font-weight:850!important;letter-spacing:.04em!important;text-transform:uppercase}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-doc-item{border-color:rgba(123,191,225,.15)!important;background:rgba(5,17,28,.54)!important;border-radius:10px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-deal-actions button{border:1px solid rgba(99,220,255,.27)!important;border-radius:9px!important;background:rgba(10,31,47,.80)!important;color:#d9f5ff!important;font-weight:800!important}',
    '@media(max-width:1100px){html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}html.rona-deals-premium-v1 #page-deals .rona-deal-table .rona-owner-table{min-width:1320px!important}}',
    '@media(max-width:720px){html.rona-deals-premium-v1 #page-deals>.rona-owner-page-content,html.rona-deals-premium-v1 #page-deals .rona-owner-page-content[data-owner-page="deals"]{padding:14px 12px 28px!important}html.rona-deals-premium-v1 #page-deals .rona-deal-kpi-grid{grid-template-columns:1fr!important}html.rona-deals-premium-v1 #page-deals .rona-deal-table{padding:12px!important}html.rona-deals-premium-v1 #page-deals .rona-deal-filter{padding:7px!important}html.rona-deals-premium-v1 #page-deals .rona-deal-filter button{font-size:11px!important;padding:0 12px!important}}',
    '@media(prefers-reduced-motion:reduce){html.rona-deals-premium-v1 #page-deals *{transition:none!important}}'
  ].join('');
  document.head.appendChild(s);
}
function apply(){
  const root=document.getElementById('page-deals');
  if(!root)return;
  document.documentElement.classList.add('rona-deals-premium-v1');
  root.dataset.ronaDealsVisual='premium-executive-v2';
}
let queued=false;
function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;install();apply()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
window.addEventListener('rona:finance-sync',schedule);
const root=document.getElementById('page-deals');
if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
})();
`;
export default ADMIN_DEALS_PREMIUM_V1;