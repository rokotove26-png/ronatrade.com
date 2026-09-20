const ADMIN_DEALS_PREMIUM_V1=String.raw`
(()=>{'use strict';
const VERSION='20260920-executive-v7-filter-row-balance';
if(window.__RONA_ADMIN_DEALS_PREMIUM_V1__===VERSION)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_DEALS_PREMIUM_V1__=VERSION;
const STYLE_ID='ronaAdminDealsPremiumV1Style';
function install(){
  const old=document.getElementById(STYLE_ID);if(old)old.remove();
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=[
    'html.rona-deals-premium-v1 #page-deals{--dx-cyan:#63dcff;--dx-blue:#65a9ff;--dx-violet:#b39cff;--dx-amber:#ffc86f;--dx-green:#58e3bc;--dx-red:#ff7180;--dx-text:#f7fbfd;--dx-muted:#8fa9ba;--dx-line:rgba(126,207,244,.20);color:var(--dx-text)}',
    'html.rona-deals-premium-v1 #page-deals>.rona-owner-page-content,html.rona-deals-premium-v1 #page-deals .rona-owner-page-content[data-owner-page="deals"]{position:relative;isolation:isolate;padding:22px 24px 42px!important}',
    'html.rona-deals-premium-v1 #page-deals>.rona-owner-page-content::before,html.rona-deals-premium-v1 #page-deals .rona-owner-page-content[data-owner-page="deals"]::before{content:"";position:absolute;inset:0;z-index:-2;pointer-events:none;background:radial-gradient(760px 360px at 96% 5%,rgba(51,166,221,.15),transparent 68%),radial-gradient(620px 340px at 2% 18%,rgba(229,31,44,.07),transparent 72%),linear-gradient(180deg,rgba(2,10,18,.08),rgba(2,9,16,.34))}',
    'html.rona-deals-premium-v1 #page-deals .rona-visual-hero{position:relative;overflow:hidden;margin-bottom:16px!important;border:1px solid rgba(122,211,250,.25)!important;border-radius:20px!important;background:linear-gradient(90deg,rgba(229,31,44,.82) 0 3px,transparent 3px),radial-gradient(620px 230px at 100% 0,rgba(54,179,235,.18),transparent 65%),linear-gradient(138deg,rgba(13,31,48,.94),rgba(6,16,27,.82))!important;box-shadow:0 24px 64px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.06)!important;backdrop-filter:blur(18px) saturate(135%);-webkit-backdrop-filter:blur(18px) saturate(135%)}',
    'html.rona-deals-premium-v1 #page-deals .rona-visual-hero::after{content:"";position:absolute;width:250px;height:250px;right:-80px;top:-145px;border:1px solid rgba(99,220,255,.10);border-radius:50%;box-shadow:0 0 0 25px rgba(99,220,255,.023),0 0 0 52px rgba(99,220,255,.015);pointer-events:none}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:8px!important;margin-bottom:6px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>.rona-owner-card,html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi{--dx-accent:var(--dx-cyan);position:relative;overflow:hidden;min-height:84px!important;margin:0!important;padding:10px 14px!important;border:1px solid color-mix(in srgb,var(--dx-accent) 30%,transparent)!important;border-radius:16px!important;background:linear-gradient(90deg,color-mix(in srgb,var(--dx-accent) 10%,rgba(7,19,31,.96)),rgba(5,16,27,.94) 62%,rgba(4,14,23,.92))!important;box-shadow:0 10px 24px rgba(0,0,0,.18),inset 4px 0 0 color-mix(in srgb,var(--dx-accent) 82%,transparent),inset 0 1px 0 rgba(255,255,255,.035)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>.rona-owner-card::after,html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi::after{content:"";position:absolute;left:14px;right:14px;bottom:0;top:auto;height:2px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dx-accent) 48%,transparent),transparent);pointer-events:none}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>.rona-owner-card:hover,html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--dx-accent) 44%,transparent)!important;box-shadow:0 24px 52px rgba(0,0,0,.33),0 0 24px color-mix(in srgb,var(--dx-accent) 7%,transparent),inset 3px 0 0 color-mix(in srgb,var(--dx-accent) 80%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(1){--dx-accent:#63dcff}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(2){--dx-accent:#ffc86f;border-color:rgba(255,200,111,.38)!important;background:radial-gradient(260px 145px at 100% 0,rgba(255,200,111,.14),transparent 72%),linear-gradient(145deg,rgba(31,25,19,.96),rgba(9,16,24,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(3){--dx-accent:#65a9ff;border-color:rgba(101,169,255,.36)!important;background:radial-gradient(260px 145px at 100% 0,rgba(101,169,255,.14),transparent 72%),linear-gradient(145deg,rgba(18,28,42,.96),rgba(8,16,28,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(4){--dx-accent:#58e3bc}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(5){--dx-accent:#63dcff}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(6){--dx-accent:#58e3bc}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi h2,html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>.rona-owner-card>h2{margin:0 0 4px!important;color:color-mix(in srgb,var(--dx-accent) 48%,#e8f2f6)!important;font-size:12.5px!important;line-height:1.2!important;font-weight:880!important;letter-spacing:-.015em}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi .rona-owner-kpi,html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>.rona-owner-card .rona-owner-kpi{margin:0 0 3px!important;color:color-mix(in srgb,var(--dx-accent) 28%,#fff)!important;font-size:clamp(26px,1.8vw,30px)!important;line-height:1!important;font-weight:920!important;letter-spacing:-.045em!important;font-variant-numeric:tabular-nums;text-shadow:0 0 14px color-mix(in srgb,var(--dx-accent) 11%,transparent),0 8px 22px rgba(0,0,0,.24)}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi .rona-owner-muted,html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>.rona-owner-card .rona-owner-muted{color:#93aaba!important;font-size:9.8px!important;line-height:1.28!important;font-weight:650}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(1) .rona-owner-kpi{color:#a9edff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(2) .rona-owner-kpi{color:#ffd992!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(3) .rona-owner-kpi{color:#a9cfff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(4) .rona-owner-kpi{color:#a7efcf!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(5) .rona-owner-kpi{color:#b9f1ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(6) .rona-owner-kpi{color:#a7efcf!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(1)>h2{color:#b8f1ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(2)>h2{color:#ffe0a4!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(3)>h2{color:#bfd6ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(4)>h2{color:#bcefd5!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(5)>h2{color:#b8f1ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(6)>h2{color:#bcefd5!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(1){background:linear-gradient(90deg,rgba(22,85,111,.38),rgba(5,16,27,.94) 58%,rgba(4,14,23,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(2){background:linear-gradient(90deg,rgba(107,74,24,.36),rgba(17,17,20,.95) 58%,rgba(6,14,22,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(3){background:linear-gradient(90deg,rgba(35,67,110,.34),rgba(6,17,29,.95) 58%,rgba(4,14,23,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(4){background:linear-gradient(90deg,rgba(24,86,70,.34),rgba(5,17,27,.95) 58%,rgba(4,14,23,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(5){background:linear-gradient(90deg,rgba(20,82,108,.32),rgba(5,17,28,.95) 58%,rgba(4,14,23,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid>*:nth-child(6){background:linear-gradient(90deg,rgba(24,88,71,.34),rgba(5,17,27,.95) 58%,rgba(4,14,23,.92))!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter{display:flex!important;gap:7px!important;align-items:center;flex-wrap:nowrap!important;margin:0!important;padding:6px 7px!important;border:1px solid rgba(126,204,241,.13)!important;border-bottom:0!important;border-radius:13px 13px 0 0!important;background:linear-gradient(180deg,rgba(6,20,32,.72),rgba(3,13,22,.66))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 12px 28px rgba(0,0,0,.13)!important;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button{flex:1 1 0!important;width:auto!important;min-width:0!important;min-height:34px!important;padding:0 12px!important;border:1px solid rgba(126,177,207,.15)!important;border-radius:9px!important;background:rgba(6,18,29,.56)!important;color:#9fb5c3!important;font-size:11.5px!important;line-height:1!important;text-align:center!important;font-weight:850!important;letter-spacing:.005em!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025);transition:transform .15s ease,border-color .15s ease,background .15s ease,color .15s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button:hover{transform:translateY(-1px);color:#fff!important;border-color:rgba(99,220,255,.32)!important;background:rgba(15,42,61,.78)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button.is-active{color:#bff2ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button.is-attention{color:#ffd28b!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button.is-completed{color:#bdf3df!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button.is-annulled{color:#ff9ca6!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter>button{display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button[aria-pressed="true"].is-active{border-color:rgba(99,220,255,.43)!important;background:linear-gradient(180deg,rgba(53,165,214,.25),rgba(20,82,116,.18))!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 34%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button[aria-pressed="true"].is-attention{border-color:rgba(255,200,111,.42)!important;background:linear-gradient(180deg,rgba(179,114,31,.23),rgba(92,58,20,.17))!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 30%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button[aria-pressed="true"].is-completed{border-color:rgba(88,227,188,.40)!important;background:linear-gradient(180deg,rgba(39,153,115,.22),rgba(18,78,61,.17))!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 30%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button[aria-pressed="true"].is-annulled{border-color:rgba(255,113,128,.42)!important;background:linear-gradient(180deg,rgba(174,53,69,.22),rgba(83,31,40,.17))!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,currentColor 30%,transparent)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deals-owned{display:block!important;width:100%!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid{margin-top:0!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue{margin-top:0!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-table-wrap{margin:0!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue{position:relative;overflow:hidden;margin:0!important;padding:10px 18px 18px!important;border:1px solid rgba(129,211,248,.25)!important;border-radius:0 0 17px 17px!important;background:radial-gradient(760px 220px at 48% 0,rgba(36,112,151,.08),transparent 72%),linear-gradient(145deg,rgba(4,17,28,.988),rgba(2,11,19,.98))!important;box-shadow:0 26px 68px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.045)!important;backdrop-filter:blur(22px) saturate(118%);-webkit-backdrop-filter:blur(22px) saturate(118%)}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue::before{content:"";position:absolute;left:18px;right:18px;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(99,220,255,.33),rgba(179,156,255,.20),transparent);pointer-events:none}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue>h2{margin:0 0 10px!important;color:#f6fbff!important;font-size:20px!important;line-height:1.15!important;font-weight:900!important;letter-spacing:-.024em}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table-wrap{overflow:auto!important;border:1px solid rgba(130,207,243,.20)!important;border-radius:13px!important;background:rgba(1,8,14,.84)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 14px 36px rgba(0,0,0,.18)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table{width:100%!important;min-width:1360px!important;border-collapse:separate!important;border-spacing:0!important;font-size:14px!important;font-variant-numeric:tabular-nums}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table thead th{position:sticky;top:0;z-index:2;padding:11px 11px!important;border-bottom:1px solid rgba(125,205,241,.20)!important;background:linear-gradient(180deg,rgba(14,35,52,.995),rgba(7,22,34,.995))!important;color:#89a6b8!important;font-size:11px!important;line-height:1.16!important;font-weight:900!important;letter-spacing:.055em!important;text-transform:uppercase;white-space:nowrap}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table tbody td{padding:14px 11px!important;border-bottom:1px solid rgba(121,177,207,.105)!important;background:rgba(3,13,22,.91)!important;color:#e5eef3!important;font-size:14px!important;line-height:1.3!important;vertical-align:middle!important;transition:background .14s ease,color .14s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table tbody tr:nth-child(even) td{background:rgba(5,17,27,.92)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table tbody tr:last-child td{border-bottom:0!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table tbody tr:hover td{background:linear-gradient(180deg,rgba(15,42,61,.985),rgba(7,26,40,.985))!important;box-shadow:inset 0 1px 0 rgba(126,221,255,.035),inset 0 -1px 0 rgba(126,221,255,.025)}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(1),html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(1){color:#9feaff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(2){color:#c9c0ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(1){font-weight:920!important;letter-spacing:.008em!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(2){color:#f1eeff!important;white-space:normal!important;min-width:215px!important;max-width:255px!important;overflow-wrap:anywhere!important;font-weight:760!important;line-height:1.28!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(3){color:#9edfff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(3){min-width:170px!important;color:#d9f1fb!important;font-weight:760!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(4),html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(4){color:#ffd58b!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(4){min-width:86px!important;font-weight:900!important;text-align:center}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(5){color:#b7c8ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(5){min-width:170px!important;color:#d8e2ff!important;font-weight:780!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(6){color:#ffc57d!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(6){min-width:126px!important;font-weight:820!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(7){color:#89dcff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(8){color:#8fe8c9!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(9){color:#79caff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(10){color:#c3b2ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table th:nth-child(11){color:#86eaff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(7),html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(8),html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(9),html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(10){text-align:center}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-id{font-weight:920!important;letter-spacing:.008em!important;color:#9feaff!important;text-shadow:0 0 18px rgba(99,220,255,.10)}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill{min-height:29px!important;padding:5px 10px!important;border-radius:999px!important;font-size:10.5px!important;font-weight:850!important;letter-spacing:.02em!important;box-shadow:inset 0 0 16px rgba(255,255,255,.018)}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="success"],html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="ok"]{color:#75edc0!important;border-color:rgba(88,227,188,.34)!important;background:rgba(37,157,115,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="warn"]{color:#ffd184!important;border-color:rgba(255,200,111,.34)!important;background:rgba(179,111,27,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="danger"]{color:#ff8b98!important;border-color:rgba(255,113,128,.34)!important;background:rgba(177,49,65,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-fin-pill[class*="info"]{color:#8ee2ff!important;border-color:rgba(99,220,255,.30)!important;background:rgba(38,141,190,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(3) .rona-fin-pill,html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(4) .rona-fin-pill,html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(5) .rona-fin-pill{border-color:rgba(132,187,216,.20)!important;background:rgba(76,106,125,.085)!important;color:#bdd0dc!important;box-shadow:none!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(7) .rona-fin-pill{border-color:rgba(117,166,198,.19)!important;background:rgba(57,84,104,.08)!important;color:#afc5d3!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(8) .rona-fin-pill{border-color:rgba(88,227,188,.25)!important;background:rgba(39,146,111,.08)!important;color:#8ee8c9!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(9) .rona-fin-pill{border-color:rgba(101,169,255,.22)!important;background:rgba(56,105,170,.08)!important;color:#91c4ff!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table td:nth-child(10) .rona-fin-pill{min-height:28px!important;padding:5px 10px!important;font-size:10.5px!important;font-weight:920!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-open,html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-btn{min-height:37px!important;padding:0 14px!important;border:1px solid rgba(99,220,255,.46)!important;border-radius:9px!important;background:linear-gradient(180deg,rgba(42,139,181,.46),rgba(17,75,105,.36))!important;color:#edfbff!important;font-size:12px!important;font-weight:920!important;box-shadow:0 8px 21px rgba(18,110,153,.14),inset 0 1px 0 rgba(255,255,255,.06)!important;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease,background .14s ease}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-open:hover,html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-btn:hover{transform:translateY(-1px);border-color:rgba(137,236,255,.72)!important;background:linear-gradient(180deg,rgba(53,171,218,.55),rgba(20,93,127,.43))!important;box-shadow:0 10px 27px rgba(26,139,187,.22),0 0 18px rgba(99,220,255,.055),inset 0 1px 0 rgba(255,255,255,.075)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-open:focus-visible,html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button:focus-visible,html.rona-deals-premium-v1 #page-deals .rona-current-deal-actions button:focus-visible{outline:2px solid rgba(99,220,255,.72)!important;outline-offset:2px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-grid{gap:12px!important;margin-top:12px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-grid>.rona-owner-card{margin:0!important;border:1px solid rgba(124,202,238,.18)!important;border-radius:15px!important;background:radial-gradient(280px 140px at 100% 0,rgba(72,171,219,.08),transparent 72%),linear-gradient(145deg,rgba(10,26,40,.95),rgba(5,16,26,.90))!important;box-shadow:0 18px 42px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.035)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-grid>.rona-owner-card:nth-child(1){box-shadow:inset 3px 0 0 rgba(99,220,255,.56),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-grid>.rona-owner-card:nth-child(2){box-shadow:inset 3px 0 0 rgba(255,200,111,.50),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-grid>.rona-owner-card:nth-child(3){box-shadow:inset 3px 0 0 rgba(101,169,255,.52),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-grid>.rona-owner-card:nth-child(4){box-shadow:inset 3px 0 0 rgba(88,227,188,.50),0 18px 42px rgba(0,0,0,.24)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-row{padding:8px 0!important;border-bottom-color:rgba(127,184,214,.10)!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-detail-label{color:#7e9caf!important;font-size:9.5px!important;font-weight:850!important;letter-spacing:.04em!important;text-transform:uppercase}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-doc-item{border-color:rgba(123,191,225,.15)!important;background:rgba(5,17,28,.54)!important;border-radius:10px!important}',
    'html.rona-deals-premium-v1 #page-deals .rona-current-deal-actions button{border:1px solid rgba(99,220,255,.27)!important;border-radius:9px!important;background:rgba(10,31,47,.80)!important;color:#d9f5ff!important;font-weight:800!important}',
    '@media(max-width:1100px){html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue .rona-owner-table{min-width:1320px!important}}',
    '@media(max-width:720px){html.rona-deals-premium-v1 #page-deals>.rona-owner-page-content,html.rona-deals-premium-v1 #page-deals .rona-owner-page-content[data-owner-page="deals"]{padding:14px 12px 28px!important}html.rona-deals-premium-v1 #page-deals .rona-current-deal-kpi-grid{grid-template-columns:1fr!important}html.rona-deals-premium-v1 #page-deals .rona-current-deal-queue{padding:12px!important}html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter{padding:7px!important}html.rona-deals-premium-v1 #page-deals .rona-current-deal-filter button{font-size:11px!important;padding:0 12px!important}}',
    '@media(prefers-reduced-motion:reduce){html.rona-deals-premium-v1 #page-deals *{transition:none!important}}'
  ].join('');
  document.head.appendChild(s);
}
function apply(){
  const root=document.getElementById('page-deals');
  if(!root)return;
  document.documentElement.classList.add('rona-deals-premium-v1');
  root.dataset.ronaDealsVisual='premium-executive-v7-filter-row-balance';
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