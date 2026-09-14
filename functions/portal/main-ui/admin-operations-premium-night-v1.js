const css=String.raw`
#page-home .rona-ops-v4{
  --ops-night-cyan:#62ddff;
  --ops-night-ice:#dff8ff;
  --ops-night-blue:#6fa8ff;
  --ops-night-violet:#9b8cff;
  --ops-night-mint:#58e3bc;
  --ops-night-amber:#ffc766;
  --ops-night-red:#ff7286;
  --ops-night-line:rgba(104,207,255,.24);
  --ops-night-line-soft:rgba(128,191,222,.13);
  --ops-night-panel:rgba(4,15,27,.91);
  --ops-night-panel-2:rgba(7,22,38,.92);
  gap:14px;
  filter:saturate(1.04);
}
#page-home .rona-ops-v4__commandbar{
  border-color:rgba(100,211,255,.28);
  background:
    radial-gradient(520px 150px at 91% 0%,rgba(76,172,255,.16),transparent 68%),
    radial-gradient(360px 150px at 0% 100%,rgba(77,224,190,.055),transparent 72%),
    linear-gradient(112deg,rgba(4,16,29,.985),rgba(6,22,38,.985) 54%,rgba(5,18,33,.985));
  box-shadow:
    0 22px 60px rgba(0,5,15,.34),
    inset 0 1px 0 rgba(220,248,255,.075),
    inset 0 -1px 0 rgba(84,198,255,.06),
    inset 0 0 46px rgba(61,149,215,.035);
}
#page-home .rona-ops-v4__commandbar:before{
  background:
    linear-gradient(90deg,rgba(98,221,255,.075),transparent 20%,transparent 77%,rgba(111,168,255,.065)),
    repeating-linear-gradient(90deg,transparent 0,transparent 47px,rgba(98,221,255,.023) 48px),
    repeating-linear-gradient(0deg,transparent 0,transparent 23px,rgba(98,221,255,.012) 24px);
  opacity:.95;
}
#page-home .rona-ops-v4__commandbar:after{
  content:'';
  position:absolute;
  left:22px;
  right:22px;
  bottom:0;
  height:1px;
  pointer-events:none;
  background:linear-gradient(90deg,transparent 0,rgba(98,221,255,.85) 15%,rgba(111,168,255,.28) 48%,rgba(88,227,188,.5) 78%,transparent 100%);
  box-shadow:0 0 14px rgba(98,221,255,.2);
  animation:ronaOpsNightRail 7s ease-in-out infinite alternate;
}
#page-home .rona-ops-v4__brand{
  color:rgba(154,224,250,.78);
  text-shadow:0 0 18px rgba(98,221,255,.12);
}
#page-home .rona-ops-v4__brand:before{
  width:36px;
  background:linear-gradient(90deg,var(--ops-night-cyan),var(--ops-night-blue));
  box-shadow:0 0 12px rgba(98,221,255,.36);
}
#page-home .rona-ops-v4__sub{
  color:rgba(190,221,238,.62);
  letter-spacing:.055em;
}
#page-home .rona-ops-v4__controls{gap:10px}
#page-home .rona-ops-v4__state{
  min-height:42px;
  padding:0 15px;
  border-color:rgba(88,227,188,.31);
  border-radius:12px;
  background:linear-gradient(180deg,rgba(24,85,72,.16),rgba(9,41,37,.12));
  color:#d9fff1;
  box-shadow:inset 0 1px 0 rgba(224,255,247,.055),0 8px 22px rgba(0,0,0,.16);
}
#page-home .rona-ops-v4__state.is-amber{
  border-color:rgba(255,199,102,.34);
  background:linear-gradient(180deg,rgba(110,72,19,.17),rgba(55,36,10,.12));
  color:#ffe8b0;
}
#page-home .rona-ops-v4__state.is-red{
  border-color:rgba(255,114,134,.36);
  background:linear-gradient(180deg,rgba(108,30,47,.18),rgba(54,15,27,.13));
  color:#ffd8df;
}
#page-home .rona-ops-v4__dot{
  width:8px;
  height:8px;
  background:var(--ops-night-mint);
  box-shadow:0 0 0 4px rgba(88,227,188,.07),0 0 15px rgba(88,227,188,.48);
  animation:ronaOpsNightPulse 2.6s ease-in-out infinite;
}
#page-home .rona-ops-v4__state.is-amber .rona-ops-v4__dot{
  background:var(--ops-night-amber);
  box-shadow:0 0 0 4px rgba(255,199,102,.07),0 0 15px rgba(255,199,102,.45);
}
#page-home .rona-ops-v4__state.is-red .rona-ops-v4__dot{
  background:var(--ops-night-red);
  box-shadow:0 0 0 4px rgba(255,114,134,.075),0 0 16px rgba(255,114,134,.48);
}
#page-home .rona-ops-v4__refresh{
  min-height:42px;
  padding:0 15px;
  border-color:rgba(98,221,255,.32);
  border-radius:12px;
  background:linear-gradient(180deg,rgba(48,144,188,.13),rgba(14,64,91,.09));
  color:#eaffff;
  box-shadow:inset 0 1px 0 rgba(230,250,255,.06),0 8px 22px rgba(0,0,0,.15);
}
#page-home .rona-ops-v4__refresh:hover{
  border-color:rgba(98,221,255,.58);
  background:linear-gradient(180deg,rgba(54,168,216,.2),rgba(15,75,106,.13));
  box-shadow:0 0 22px rgba(59,185,232,.09),inset 0 1px 0 rgba(230,250,255,.08);
}
#page-home .rona-ops-v4__metrics{gap:10px}
#page-home .rona-ops-v4-metric{
  min-height:112px;
  padding:15px 15px 14px;
  border-color:rgba(106,198,237,.18);
  border-radius:16px;
  background:
    radial-gradient(180px 100px at 100% 0%,rgba(98,221,255,.075),transparent 70%),
    linear-gradient(154deg,rgba(8,28,48,.95),rgba(4,17,30,.94));
  box-shadow:inset 0 1px 0 rgba(224,247,255,.045),inset 0 -18px 34px rgba(0,0,0,.09),0 10px 28px rgba(0,5,14,.16);
}
#page-home .rona-ops-v4-metric:before{
  top:14px;
  bottom:14px;
  width:2px;
  background:linear-gradient(180deg,rgba(98,221,255,.25),var(--ops-night-cyan),rgba(98,221,255,.2));
  box-shadow:0 0 10px rgba(98,221,255,.28);
  opacity:.95;
}
#page-home .rona-ops-v4-metric:after{
  content:'';
  position:absolute;
  left:14px;
  right:14px;
  top:0;
  height:1px;
  background:linear-gradient(90deg,transparent,rgba(98,221,255,.42),transparent);
  opacity:.7;
}
#page-home .rona-ops-v4-metric.is-green:before{background:linear-gradient(180deg,rgba(88,227,188,.2),var(--ops-night-mint),rgba(88,227,188,.18));box-shadow:0 0 10px rgba(88,227,188,.26)}
#page-home .rona-ops-v4-metric.is-amber:before{background:linear-gradient(180deg,rgba(255,199,102,.2),var(--ops-night-amber),rgba(255,199,102,.18));box-shadow:0 0 10px rgba(255,199,102,.27)}
#page-home .rona-ops-v4-metric.is-red:before{background:linear-gradient(180deg,rgba(255,114,134,.2),var(--ops-night-red),rgba(255,114,134,.18));box-shadow:0 0 11px rgba(255,114,134,.29)}
#page-home .rona-ops-v4-metric:hover{
  transform:translateY(-2px);
  border-color:rgba(98,221,255,.35);
  background:
    radial-gradient(190px 105px at 100% 0%,rgba(98,221,255,.12),transparent 70%),
    linear-gradient(154deg,rgba(10,35,59,.97),rgba(5,21,36,.96));
  box-shadow:0 15px 38px rgba(0,7,18,.26),inset 0 1px 0 rgba(229,249,255,.065);
}
#page-home .rona-ops-v4-metric__label{
  font-size:9.5px;
  color:rgba(181,222,242,.68);
  letter-spacing:.1em;
}
#page-home .rona-ops-v4-metric__value{
  margin-top:12px;
  font-size:34px;
  color:#f7fcff;
  text-shadow:0 0 18px rgba(98,221,255,.08);
}
#page-home .rona-ops-v4-metric.is-green .rona-ops-v4-metric__value{color:#caffea}
#page-home .rona-ops-v4-metric.is-amber .rona-ops-v4-metric__value{color:#ffe7ae}
#page-home .rona-ops-v4-metric.is-red .rona-ops-v4-metric__value{color:#ffd1da}
#page-home .rona-ops-v4-metric__foot{
  margin-top:9px;
  font-size:9.2px;
  color:rgba(184,216,234,.47);
}
#page-home .rona-ops-v4__main{gap:12px}
#page-home .rona-ops-v4-panel{
  position:relative;
  border-color:rgba(102,196,236,.19);
  border-radius:18px;
  background:
    linear-gradient(90deg,rgba(98,221,255,.018) 1px,transparent 1px),
    linear-gradient(rgba(98,221,255,.012) 1px,transparent 1px),
    radial-gradient(520px 220px at 14% 0%,rgba(65,151,214,.075),transparent 68%),
    linear-gradient(158deg,rgba(6,22,39,.97),rgba(4,15,28,.97));
  background-size:46px 46px,46px 46px,auto,auto;
  box-shadow:inset 0 1px 0 rgba(230,249,255,.045),inset 0 0 0 1px rgba(73,162,205,.025),0 15px 38px rgba(0,5,14,.18);
}
#page-home .rona-ops-v4-panel:before,
#page-home .rona-ops-v4-module:before{
  content:'';
  position:absolute;
  pointer-events:none;
  inset:0;
  border-radius:inherit;
  background:
    linear-gradient(var(--ops-night-cyan),var(--ops-night-cyan)) left top/18px 1px no-repeat,
    linear-gradient(var(--ops-night-cyan),var(--ops-night-cyan)) left top/1px 18px no-repeat,
    linear-gradient(rgba(111,168,255,.75),rgba(111,168,255,.75)) right bottom/18px 1px no-repeat,
    linear-gradient(rgba(111,168,255,.75),rgba(111,168,255,.75)) right bottom/1px 18px no-repeat;
  opacity:.42;
}
#page-home .rona-ops-v4-panel__head{
  min-height:58px;
  padding:13px 16px;
  border-bottom-color:rgba(101,194,235,.14);
  background:linear-gradient(90deg,rgba(98,221,255,.055),rgba(111,168,255,.022) 45%,transparent 80%);
  box-shadow:inset 0 -1px 0 rgba(0,0,0,.15);
}
#page-home .rona-ops-v4-panel__kicker{
  font-size:8.5px;
  color:rgba(98,221,255,.7);
  letter-spacing:.18em;
}
#page-home .rona-ops-v4-panel__title{
  margin-top:5px;
  font-size:14.5px;
  color:#f6fcff;
  letter-spacing:-.01em;
}
#page-home .rona-ops-v4-panel__count{
  min-width:31px;
  height:31px;
  border-color:rgba(98,221,255,.19);
  background:linear-gradient(180deg,rgba(51,124,159,.11),rgba(8,33,49,.1));
  color:#dff7ff;
  box-shadow:inset 0 1px 0 rgba(235,251,255,.045);
}
#page-home .rona-ops-v4-panel__body{padding:9px}
#page-home .rona-ops-v4-deal-head{
  padding:8px 11px 9px;
  font-size:8.5px;
  color:rgba(157,204,229,.5);
  letter-spacing:.095em;
}
#page-home .rona-ops-v4-deal{
  min-height:58px;
  padding:10px 11px;
  border-color:rgba(105,189,225,.04);
  border-radius:12px;
  background:linear-gradient(90deg,rgba(255,255,255,.018),rgba(95,202,246,.008));
}
#page-home .rona-ops-v4-deal+.rona-ops-v4-deal{margin-top:4px}
#page-home .rona-ops-v4-deal:hover{
  transform:translateX(2px);
  border-color:rgba(98,221,255,.21);
  background:linear-gradient(90deg,rgba(49,166,215,.07),rgba(111,140,255,.025));
}
#page-home .rona-ops-v4-deal.is-selected{
  border-color:rgba(98,221,255,.29);
  background:linear-gradient(90deg,rgba(39,151,201,.105),rgba(54,83,164,.035));
  box-shadow:inset 0 1px 0 rgba(222,248,255,.035),0 7px 18px rgba(0,4,12,.1);
}
#page-home .rona-ops-v4-deal.is-selected:before{
  top:9px;
  bottom:9px;
  width:3px;
  background:linear-gradient(180deg,var(--ops-night-cyan),var(--ops-night-blue));
  box-shadow:0 0 13px rgba(98,221,255,.34);
}
#page-home .rona-ops-v4-deal__id{font-size:11px;color:#dff8ff;text-shadow:0 0 12px rgba(98,221,255,.08)}
#page-home .rona-ops-v4-deal__client{font-size:10.5px;color:#d9dcff}
#page-home .rona-ops-v4-deal__stage{font-size:9.5px;color:#b9cbff}
#page-home .rona-ops-v4-deal__payment{font-size:9.5px;color:#ffe0a0}
#page-home .rona-ops-v4-deal__rail{font-size:9.5px;color:#b8edff}
#page-home .rona-ops-v4-deal__docs{font-size:9.5px;color:#b8f4dd}
#page-home .rona-ops-v4-deal__next{font-size:10.5px;color:rgba(231,244,251,.8)}
#page-home .rona-ops-v4-deal__open,
#page-home .rona-ops-v4-event__open{
  border-color:rgba(98,221,255,.19);
  background:linear-gradient(180deg,rgba(52,143,184,.11),rgba(13,52,76,.08));
  color:#d9f6ff;
  box-shadow:inset 0 1px 0 rgba(235,251,255,.045);
}
#page-home .rona-ops-v4-deal__open:hover,
#page-home .rona-ops-v4-event__open:hover{
  border-color:rgba(98,221,255,.48);
  background:rgba(59,174,219,.13);
  box-shadow:0 0 18px rgba(98,221,255,.08);
}
#page-home .rona-ops-v4-queue{gap:5px}
#page-home .rona-ops-v4-event{
  min-height:56px;
  padding:10px 10px;
  border:1px solid rgba(111,181,215,.075);
  border-radius:12px;
  background:linear-gradient(90deg,rgba(255,199,102,.025),rgba(255,255,255,.012));
}
#page-home .rona-ops-v4-event__signal{
  width:8px;
  height:8px;
  background:var(--ops-night-amber);
  box-shadow:0 0 0 4px rgba(255,199,102,.055),0 0 13px rgba(255,199,102,.32);
  animation:ronaOpsNightPulse 2.8s ease-in-out infinite;
}
#page-home .rona-ops-v4-event__signal.is-red{background:var(--ops-night-red);box-shadow:0 0 0 4px rgba(255,114,134,.06),0 0 14px rgba(255,114,134,.35)}
#page-home .rona-ops-v4-event__signal.is-cyan{background:var(--ops-night-cyan);box-shadow:0 0 0 4px rgba(98,221,255,.055),0 0 14px rgba(98,221,255,.3)}
#page-home .rona-ops-v4-event__name{font-size:10.5px;color:#f2fbff}
#page-home .rona-ops-v4-event__meta{font-size:9px;color:rgba(188,220,238,.53)}
#page-home .rona-ops-v4-empty__mark{
  border-color:rgba(88,227,188,.24);
  background:linear-gradient(145deg,rgba(31,116,91,.1),rgba(8,54,45,.07));
  color:#c8ffe9;
  box-shadow:inset 0 1px 0 rgba(225,255,247,.04),0 0 24px rgba(88,227,188,.035);
}
#page-home .rona-ops-v4-empty__title{font-size:11.5px}
#page-home .rona-ops-v4-empty__meta{font-size:9.5px;color:rgba(188,221,239,.51)}
#page-home .rona-ops-v4__selected{
  padding:14px 16px;
  border-bottom-color:rgba(98,221,255,.13);
  background:linear-gradient(90deg,rgba(98,221,255,.035),transparent 50%);
}
#page-home .rona-ops-v4__selected-id{font-size:12.5px;color:#e7faff}
#page-home .rona-ops-v4__selected-client{font-size:9.5px;color:rgba(201,228,243,.59)}
#page-home .rona-ops-v4__selected-open{
  min-height:33px;
  padding:0 12px;
  border-color:rgba(98,221,255,.27);
  border-radius:10px;
  background:linear-gradient(180deg,rgba(52,143,184,.11),rgba(13,52,76,.08));
  color:#e3f9ff;
}
#page-home .rona-ops-v4-steps{gap:5px;padding:11px}
#page-home .rona-ops-v4-step{
  min-height:88px;
  padding:12px 11px;
  border:1px solid rgba(112,186,221,.09)!important;
  border-radius:10px!important;
  background:linear-gradient(160deg,rgba(10,28,47,.76),rgba(5,18,32,.72));
  box-shadow:inset 0 1px 0 rgba(235,250,255,.025);
}
#page-home .rona-ops-v4-step:before{
  content:'';
  position:absolute;
  left:10px;
  right:10px;
  top:-1px;
  height:1px;
  background:rgba(98,221,255,.62);
  box-shadow:0 0 8px rgba(98,221,255,.17);
}
#page-home .rona-ops-v4-step[data-tone=green]:before{background:rgba(88,227,188,.75);box-shadow:0 0 8px rgba(88,227,188,.16)}
#page-home .rona-ops-v4-step[data-tone=amber]:before{background:rgba(255,199,102,.78);box-shadow:0 0 8px rgba(255,199,102,.17)}
#page-home .rona-ops-v4-step[data-tone=red]:before{background:rgba(255,114,134,.78);box-shadow:0 0 8px rgba(255,114,134,.18)}
#page-home .rona-ops-v4-step__label{font-size:8.5px;color:rgba(171,215,237,.55)}
#page-home .rona-ops-v4-step__value{margin-top:10px;font-size:10.5px;color:rgba(230,245,252,.84)}
#page-home .rona-ops-v4-step[data-tone=green] .rona-ops-v4-step__value{color:#c8fbe0}
#page-home .rona-ops-v4-step[data-tone=amber] .rona-ops-v4-step__value{color:#ffe6ac}
#page-home .rona-ops-v4-step[data-tone=red] .rona-ops-v4-step__value{color:#ffd0d9}
#page-home .rona-ops-v4__modules{gap:11px}
#page-home .rona-ops-v4-module{
  position:relative;
  overflow:hidden;
  min-height:126px;
  padding:17px 17px;
  border-color:rgba(102,196,236,.18);
  border-radius:17px;
  background:
    radial-gradient(230px 120px at 100% 0%,rgba(98,221,255,.07),transparent 68%),
    linear-gradient(150deg,rgba(7,27,47,.95),rgba(4,17,31,.94));
  box-shadow:inset 0 1px 0 rgba(229,249,255,.04),0 12px 30px rgba(0,6,16,.16);
}
#page-home .rona-ops-v4-module:nth-child(2){
  background:radial-gradient(230px 120px at 100% 0%,rgba(255,199,102,.065),transparent 68%),linear-gradient(150deg,rgba(27,25,35,.95),rgba(8,18,31,.94));
}
#page-home .rona-ops-v4-module:nth-child(3){
  background:radial-gradient(230px 120px at 100% 0%,rgba(88,227,188,.065),transparent 68%),linear-gradient(150deg,rgba(7,31,40,.95),rgba(4,18,31,.94));
}
#page-home .rona-ops-v4-module:hover{
  transform:translateY(-2px);
  border-color:rgba(98,221,255,.36);
  box-shadow:0 16px 38px rgba(0,6,16,.25),inset 0 1px 0 rgba(232,250,255,.06);
}
#page-home .rona-ops-v4-module__code{font-size:8.5px;color:rgba(98,221,255,.72)}
#page-home .rona-ops-v4-module:nth-child(2) .rona-ops-v4-module__code{color:rgba(255,199,102,.74)}
#page-home .rona-ops-v4-module:nth-child(3) .rona-ops-v4-module__code{color:rgba(88,227,188,.72)}
#page-home .rona-ops-v4-module__title{font-size:13.5px;color:#f5fcff}
#page-home .rona-ops-v4-module__meta{font-size:9.5px;color:rgba(192,223,240,.53)}
#page-home .rona-ops-v4-module__value{font-size:32px;color:#f8fdff;text-shadow:0 0 18px rgba(98,221,255,.075)}
#page-home .rona-ops-v4-module:nth-child(2) .rona-ops-v4-module__value{color:#ffe8b8;text-shadow:0 0 18px rgba(255,199,102,.065)}
#page-home .rona-ops-v4-module:nth-child(3) .rona-ops-v4-module__value{color:#d2ffed;text-shadow:0 0 18px rgba(88,227,188,.065)}
#page-home .rona-ops-v4__foot{
  padding:4px 4px 0;
  color:rgba(174,211,231,.42);
  letter-spacing:.025em;
}
#page-home .rona-ops-v4__foot strong{color:rgba(213,239,250,.66)}
@keyframes ronaOpsNightPulse{0%,100%{opacity:.72;transform:scale(.92)}50%{opacity:1;transform:scale(1)}}
@keyframes ronaOpsNightRail{0%{opacity:.48;filter:brightness(.86)}100%{opacity:1;filter:brightness(1.15)}}
@media(max-width:1380px){
  #page-home .rona-ops-v4-metric__value{font-size:32px}
}
@media(max-width:1080px){
  #page-home .rona-ops-v4-panel{box-shadow:inset 0 1px 0 rgba(230,249,255,.04),0 12px 30px rgba(0,5,14,.15)}
}
@media(max-width:820px){
  #page-home .rona-ops-v4-metric{min-height:106px}
  #page-home .rona-ops-v4-panel__head{min-height:54px}
}
@media(max-width:520px){
  #page-home .rona-ops-v4-metric__value{font-size:29px}
  #page-home .rona-ops-v4-module{min-height:116px}
}
@media(prefers-reduced-motion:reduce){
  #page-home .rona-ops-v4__dot,
  #page-home .rona-ops-v4-event__signal,
  #page-home .rona-ops-v4__commandbar:after{animation:none!important}
}
`;

export default `(()=>{'use strict';
if(window.__RONA_ADMIN_OPERATIONS_PREMIUM_NIGHT_V1__)return;
window.__RONA_ADMIN_OPERATIONS_PREMIUM_NIGHT_V1__='20260914-cockpit-visual-v1';
if(location.pathname!=='/portal/admin')return;
if(document.getElementById('ronaAdminOperationsPremiumNightV1Style'))return;
const s=document.createElement('style');
s.id='ronaAdminOperationsPremiumNightV1Style';
s.textContent=${JSON.stringify(css)};
document.head.appendChild(s);
})();`;
