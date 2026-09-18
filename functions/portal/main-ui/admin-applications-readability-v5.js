const ADMIN_APPLICATIONS_READABILITY_V5=String.raw`
(()=>{'use strict';
if(window.__RONA_ADMIN_APPLICATIONS_READABILITY_V5__)return;
if(location.pathname!=='/portal/admin')return;
window.__RONA_ADMIN_APPLICATIONS_READABILITY_V5__='20260918-v9-airy-operational';
const STYLE_ID='ronaAdminApplicationsReadabilityV5Style';
function install(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=[
    /* Clean integrated hero: remove the card-inside-card effect visible in production. */
    'html.rona-applications-premium-pass3 #page-applications .rona-app-existing-hero-v3{width:100%!important;min-height:0!important;margin:0!important;padding:2px 0 2px 20px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;overflow:visible!important;box-sizing:border-box!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-existing-hero-v3::before{left:0!important;top:3px!important;bottom:3px!important;width:3px!important;border-radius:999px!important;background:linear-gradient(180deg,#f04552,#cf1e2d 70%,rgba(229,31,44,.16))!important;box-shadow:0 0 18px rgba(229,31,44,.24)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-title-v3{margin:1px 0 5px!important;color:#fff!important;font-size:60px!important;line-height:1!important;font-weight:920!important;letter-spacing:-.035em!important;text-shadow:none!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-existing-hero-v3 p{max-width:760px!important;margin:0!important;color:#91a8b8!important;font-size:12px!important;line-height:1.35!important;font-weight:560!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-existing-hero-v3 [class*="eyebrow"],html.rona-applications-premium-pass3 #page-applications .rona-app-existing-hero-v3 [class*="kicker"]{color:#63dcff!important;font-size:9.5px!important;line-height:1!important;font-weight:900!important;letter-spacing:.16em!important;text-transform:uppercase!important}',
    /* Applications visual hierarchy v9: airy KPI composition, restrained state color, clearer queue. */
    'html.rona-applications-premium-pass3 #page-applications>.rona-owner-page-content{gap:16px!important;padding-bottom:44px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:14px!important;margin:4px 0 2px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3{min-height:122px!important;padding:17px 18px 15px 20px!important;border-radius:17px!important;box-shadow:0 15px 38px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.035)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3[data-app-kpi-role="secondary"]{min-height:122px!important;opacity:1!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi-card-v3>h2{margin:0 0 12px!important;color:#a7bdca!important;font-size:13.5px!important;line-height:1.22!important;font-weight:820!important;letter-spacing:.01em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3 .rona-owner-kpi{margin:0 0 8px!important;color:#f5fbff!important;font-size:34px!important;line-height:1!important;font-weight:900!important;letter-spacing:-.035em!important;font-variant-numeric:tabular-nums!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3 .rona-owner-muted{color:#829aaa!important;font-size:11.5px!important;line-height:1.42!important;opacity:1!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3 .rona-app-total-lines{gap:4px!important}.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3 .rona-app-total-line{font-size:24px!important;line-height:1.1!important;font-weight:900!important;letter-spacing:-.025em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-total-kpi--tonnage{border-color:rgba(99,220,255,.28)!important;background:radial-gradient(320px 120px at 0% 0%,rgba(99,220,255,.10),transparent 70%),linear-gradient(155deg,rgba(8,23,37,.97),rgba(4,14,24,.96))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-total-kpi--tonnage::before{background:#63dcff!important;box-shadow:0 0 18px rgba(99,220,255,.30)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-total-kpi--amount-ok{border-color:rgba(88,227,188,.28)!important;background:radial-gradient(320px 120px at 0% 0%,rgba(88,227,188,.09),transparent 70%),linear-gradient(155deg,rgba(8,23,37,.97),rgba(4,14,24,.96))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-total-kpi--amount-ok::before{background:#58e3bc!important;box-shadow:0 0 18px rgba(88,227,188,.28)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-total-kpi--amount-warn{border-color:rgba(255,200,111,.30)!important;background:radial-gradient(320px 120px at 0% 0%,rgba(255,200,111,.09),transparent 70%),linear-gradient(155deg,rgba(18,21,26,.97),rgba(7,15,21,.96))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-total-kpi--amount-warn::before{background:#ffc86f!important;box-shadow:0 0 18px rgba(255,200,111,.28)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--new{border-color:rgba(99,220,255,.25)!important;background:radial-gradient(300px 110px at 0% 0%,rgba(99,220,255,.08),transparent 70%),linear-gradient(155deg,rgba(8,23,37,.97),rgba(4,14,24,.96))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--new::before{background:#63dcff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--work{border-color:rgba(94,231,213,.25)!important;background:radial-gradient(300px 110px at 0% 0%,rgba(94,231,213,.08),transparent 70%),linear-gradient(155deg,rgba(8,23,37,.97),rgba(4,14,24,.96))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--work::before{background:#5ee7d5!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--decision{border-color:rgba(255,200,111,.30)!important;background:radial-gradient(300px 110px at 0% 0%,rgba(255,200,111,.09),transparent 70%),linear-gradient(155deg,rgba(28,23,17,.96),rgba(8,15,21,.96))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--decision::before{background:#ffc86f!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--deal{border-color:rgba(88,227,188,.28)!important;background:radial-gradient(300px 110px at 0% 0%,rgba(88,227,188,.08),transparent 70%),linear-gradient(155deg,rgba(8,27,29,.96),rgba(5,16,24,.96))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3>.rona-app-kpi--deal::before{background:#58e3bc!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3{gap:0!important;padding:0!important;margin:2px 0 0!important;border-radius:15px!important;overflow:hidden!important;background:linear-gradient(180deg,rgba(5,17,28,.91),rgba(3,12,21,.88))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*{height:52px!important;min-height:52px!important;padding:0 16px!important;border:0!important;border-right:1px solid rgba(118,188,224,.12)!important;border-radius:0!important;background:transparent!important;font-size:13.5px!important;line-height:1.15!important;font-weight:820!important;letter-spacing:.008em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:last-child{border-right:0!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:not(:last-child)::after{right:-5px!important;color:rgba(137,205,232,.50)!important;font-size:17px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(1){color:#bfeeff!important;background:linear-gradient(180deg,rgba(28,111,148,.13),rgba(5,19,31,.25))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(2){color:#b8f1e7!important;border-color:rgba(94,231,213,.18)!important;background:linear-gradient(180deg,rgba(30,119,108,.12),rgba(5,20,29,.24))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(3){color:#ffe0a4!important;background:linear-gradient(180deg,rgba(150,98,25,.13),rgba(24,19,15,.25))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(4){color:#bdf2df!important;background:linear-gradient(180deg,rgba(31,122,90,.13),rgba(6,23,25,.25))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter{gap:8px!important;width:auto!important;margin:0 0 2px!important;padding:6px!important;border-radius:14px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button{height:38px!important;min-height:38px!important;padding:0 15px!important;border:1px solid transparent!important;border-radius:10px!important;font-size:12.5px!important;font-weight:820!important;letter-spacing:.005em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1){color:#bfeeff!important;background:rgba(46,165,218,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2){color:#b8f1e7!important;background:rgba(50,174,156,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3){color:#ffd99a!important;background:rgba(199,128,31,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4){color:#bdf2df!important;background:rgba(38,160,114,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1)[aria-pressed="true"]{border-color:rgba(99,220,255,.30)!important;background:linear-gradient(180deg,rgba(49,168,222,.23),rgba(25,106,149,.16))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2)[aria-pressed="true"]{border-color:rgba(94,231,213,.30)!important;background:linear-gradient(180deg,rgba(52,168,150,.22),rgba(24,102,91,.16))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3)[aria-pressed="true"]{border-color:rgba(255,200,111,.34)!important;background:linear-gradient(180deg,rgba(199,128,31,.24),rgba(113,70,22,.17))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4)[aria-pressed="true"]{border-color:rgba(88,227,188,.30)!important;background:linear-gradient(180deg,rgba(40,171,123,.23),rgba(24,102,80,.16))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3{min-height:270px!important;border-radius:18px!important;border-color:rgba(112,196,235,.20)!important;background:linear-gradient(160deg,rgba(6,20,32,.96),rgba(3,12,21,.95))!important;box-shadow:0 18px 48px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.03)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3>h2{padding:18px 20px 15px!important;color:#edf8fd!important;font-size:20px!important;line-height:1.15!important;font-weight:860!important;letter-spacing:-.018em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table-wrap{padding:8px 16px 18px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table{font-size:13.5px!important;border-spacing:0 8px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table thead th{font-size:10.5px!important;padding:8px 11px!important;letter-spacing:.05em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table tbody td{font-size:13.5px!important;line-height:1.32!important;padding:11px 11px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3:not(:has(tbody tr)) .rona-owner-table-wrap{display:none!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3:not(:has(tbody tr))>.rona-owner-muted{display:flex!important;align-items:center!important;justify-content:center!important;min-height:174px!important;margin:0 16px 18px!important;padding:28px!important;border:1px dashed rgba(112,196,235,.18)!important;border-radius:14px!important;background:radial-gradient(420px 130px at 50% 0%,rgba(99,220,255,.055),transparent 72%),rgba(4,14,24,.28)!important;color:#9bb2c1!important;font-size:13px!important;line-height:1.5!important;text-align:center!important}',
    '@media(max-width:1180px){html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
    '@media(max-width:760px){html.rona-applications-premium-pass3 #page-applications .rona-app-kpi-grid-v3{grid-template-columns:1fr!important}html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3{grid-template-columns:repeat(2,minmax(0,1fr))!important}html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(2){border-right:0!important}html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(-n+2){border-bottom:1px solid rgba(118,188,224,.12)!important}}',
    /* Balanced operational typography. Outer frame geometry stays owned by the premium runtime. */
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*{font-size:13px!important;line-height:1.12!important;height:42px!important;min-height:42px!important;padding:0 10px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(1){color:#c8f4ff!important;border-color:rgba(99,220,255,.28)!important;background:linear-gradient(180deg,rgba(31,118,157,.18),rgba(7,24,37,.82))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(2){color:#ddd4ff!important;border-color:rgba(174,147,255,.26)!important;background:linear-gradient(180deg,rgba(106,78,190,.16),rgba(13,21,38,.82))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(3){color:#ffe0a6!important;border-color:rgba(255,200,111,.27)!important;background:linear-gradient(180deg,rgba(174,116,33,.15),rgba(28,22,18,.82))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(4){color:#c7f6e6!important;border-color:rgba(88,227,188,.27)!important;background:linear-gradient(180deg,rgba(36,143,110,.16),rgba(8,28,29,.82))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button{font-size:12.5px!important;line-height:1!important;height:36px!important;min-height:36px!important;padding:0 13px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1){color:#bfeeff!important;background:rgba(46,165,218,.06)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2){color:#d5cbff!important;background:rgba(120,91,211,.06)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3){color:#ffd89b!important;background:rgba(199,128,31,.06)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4){color:#bdf2df!important;background:rgba(38,160,114,.06)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1)[aria-pressed="true"]{background:linear-gradient(180deg,rgba(49,168,222,.27),rgba(25,106,149,.18))!important;box-shadow:inset 0 0 0 1px rgba(99,220,255,.36),0 7px 18px rgba(0,0,0,.14)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2)[aria-pressed="true"]{background:linear-gradient(180deg,rgba(123,92,214,.25),rgba(64,49,130,.17))!important;box-shadow:inset 0 0 0 1px rgba(181,154,255,.34),0 7px 18px rgba(0,0,0,.14)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3)[aria-pressed="true"]{background:linear-gradient(180deg,rgba(199,128,31,.27),rgba(113,70,22,.18))!important;box-shadow:inset 0 0 0 1px rgba(255,200,111,.36),0 7px 18px rgba(0,0,0,.14)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4)[aria-pressed="true"]{background:linear-gradient(180deg,rgba(40,171,123,.26),rgba(24,102,80,.18))!important;box-shadow:inset 0 0 0 1px rgba(88,227,188,.36),0 7px 18px rgba(0,0,0,.14)!important}',
    /* Queue typography is deliberately between the original compact pass and the rejected 2x pass. */
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table{font-size:13.5px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table thead th{font-size:10.5px!important;line-height:1.15!important;padding:7px 10px!important;letter-spacing:.055em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table tbody td{font-size:13.5px!important;line-height:1.22!important;padding:7px 10px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-app-status-chip{font-size:10.5px!important;line-height:1.1!important;min-height:27px!important;padding:4px 8px!important;letter-spacing:.025em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-actions button,html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 button[data-rona-app-passport-open]{font-size:11.5px!important;line-height:1!important;min-height:34px!important;padding:0 12px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-app-price .rona-owner-muted{font-size:11.5px!important;line-height:1.15!important}',
    /* Column color hierarchy: restrained accents, not rainbow fills. */
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(1){color:#78ddff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(2){color:#c9c2ff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(3){color:#9ddcff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(4){color:#ffd58b!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(5){color:#ffbd79!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(6){color:#9fdfff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(7){color:#8fe8c9!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(8){color:#bdaeff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table thead th:nth-child(9){color:#83e5ff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:nth-child(1){color:#e6f9ff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:nth-child(2){color:#eeeaff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:nth-child(3){color:#d9f2ff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:nth-child(4){color:#ffe1a6!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:nth-child(5){color:#ffc985!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:nth-child(6){color:#d1edff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody td:nth-child(8){color:#d8d0ff!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-owner-table tbody tr:hover td{background:linear-gradient(180deg,rgba(13,35,53,.99),rgba(7,23,36,.99))!important}',
    /* Company names stay readable in two lines instead of a single long ribbon. */
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 td[data-app-col="client"]{white-space:normal!important;max-width:360px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-client-wrap-v5{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;overflow:hidden!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;line-height:1.22!important;max-width:360px!important}',
    '@media(max-width:900px){html.rona-applications-premium-pass3 #page-applications .rona-app-title-v3{font-size:52px!important}html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*{font-size:12px!important}html.rona-applications-premium-pass3 #page-applications .rona-app-filter button{font-size:11.5px!important}html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table{font-size:12.5px!important}html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3 .rona-owner-table tbody td{font-size:12.5px!important}}',
    /* v9 final cascade: these rules intentionally come last. */
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3{gap:0!important;padding:0!important;margin:2px 0 0!important;border-radius:15px!important;overflow:hidden!important;background:linear-gradient(180deg,rgba(5,17,28,.91),rgba(3,12,21,.88))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*{height:52px!important;min-height:52px!important;padding:0 16px!important;border:0!important;border-right:1px solid rgba(118,188,224,.12)!important;border-radius:0!important;background:transparent!important;font-size:13.5px!important;line-height:1.15!important;font-weight:820!important;letter-spacing:.008em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:last-child{border-right:0!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(1){color:#bfeeff!important;background:linear-gradient(180deg,rgba(28,111,148,.13),rgba(5,19,31,.25))!important;border-color:rgba(99,220,255,.18)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(2){color:#b8f1e7!important;background:linear-gradient(180deg,rgba(30,119,108,.12),rgba(5,20,29,.24))!important;border-color:rgba(94,231,213,.18)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(3){color:#ffe0a4!important;background:linear-gradient(180deg,rgba(150,98,25,.13),rgba(24,19,15,.25))!important;border-color:rgba(255,200,111,.18)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-lifecycle-v3>*:nth-child(4){color:#bdf2df!important;background:linear-gradient(180deg,rgba(31,122,90,.13),rgba(6,23,25,.25))!important;border-color:rgba(88,227,188,.18)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter{gap:8px!important;width:auto!important;margin:0 0 2px!important;padding:6px!important;border-radius:14px!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button{height:38px!important;min-height:38px!important;padding:0 15px!important;border:1px solid transparent!important;border-radius:10px!important;font-size:12.5px!important;font-weight:820!important;letter-spacing:.005em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1){color:#bfeeff!important;background:rgba(46,165,218,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2){color:#b8f1e7!important;background:rgba(50,174,156,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3){color:#ffd99a!important;background:rgba(199,128,31,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4){color:#bdf2df!important;background:rgba(38,160,114,.055)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(1)[aria-pressed="true"]{border-color:rgba(99,220,255,.30)!important;background:linear-gradient(180deg,rgba(49,168,222,.23),rgba(25,106,149,.16))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(2)[aria-pressed="true"]{border-color:rgba(94,231,213,.30)!important;background:linear-gradient(180deg,rgba(52,168,150,.22),rgba(24,102,91,.16))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(3)[aria-pressed="true"]{border-color:rgba(255,200,111,.34)!important;background:linear-gradient(180deg,rgba(199,128,31,.24),rgba(113,70,22,.17))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4).active,html.rona-applications-premium-pass3 #page-applications .rona-app-filter button:nth-child(4)[aria-pressed="true"]{border-color:rgba(88,227,188,.30)!important;background:linear-gradient(180deg,rgba(40,171,123,.23),rgba(24,102,80,.16))!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3{min-height:270px!important;border-radius:18px!important;border-color:rgba(112,196,235,.20)!important;background:linear-gradient(160deg,rgba(6,20,32,.96),rgba(3,12,21,.95))!important;box-shadow:0 18px 48px rgba(0,0,0,.26),inset 0 1px 0 rgba(255,255,255,.03)!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3>h2{padding:18px 20px 15px!important;color:#edf8fd!important;font-size:20px!important;line-height:1.15!important;font-weight:860!important;letter-spacing:-.018em!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3:not(:has(tbody tr)) .rona-owner-table-wrap{display:none!important}',
    'html.rona-applications-premium-pass3 #page-applications .rona-queue-card-v3:not(:has(tbody tr))>.rona-owner-muted{display:flex!important;align-items:center!important;justify-content:center!important;min-height:174px!important;margin:0 16px 18px!important;padding:28px!important;border:1px dashed rgba(112,196,235,.18)!important;border-radius:14px!important;background:radial-gradient(420px 130px at 50% 0%,rgba(99,220,255,.055),transparent 72%),rgba(4,14,24,.28)!important;color:#9bb2c1!important;font-size:13px!important;line-height:1.5!important;text-align:center!important}',
  ].join('');
  document.head.appendChild(s);
}
let queued=false,wrapping=false;
function wrapClients(){
  queued=false;
  const root=document.getElementById('page-applications');
  if(!root)return;
  wrapping=true;
  try{
    for(const cell of root.querySelectorAll('td[data-app-col="client"]')){
      if(cell.querySelector(':scope>.rona-app-client-wrap-v5'))continue;
      const wrap=document.createElement('span');
      wrap.className='rona-app-client-wrap-v5';
      while(cell.firstChild)wrap.appendChild(cell.firstChild);
      cell.appendChild(wrap);
    }
  }finally{wrapping=false}
}
function schedule(){if(queued)return;queued=true;queueMicrotask(wrapClients)}
install();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('rona:admin-pagechange',schedule);
const root=document.getElementById('page-applications');
if(root)new MutationObserver(mutations=>{
  if(wrapping)return;
  if(mutations.some(m=>m.type==='childList'||(m.type==='attributes'&&m.attributeName==='data-app-col')))schedule();
}).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-app-col']});
})();
`;
export default ADMIN_APPLICATIONS_READABILITY_V5;