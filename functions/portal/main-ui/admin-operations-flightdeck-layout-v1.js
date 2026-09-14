export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_LAYOUT_V1__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_LAYOUT_V1__='20260914-active-fullwidth-vector-right-v1';
  const id='ronaAdminOperationsFlightdeckLayoutV1Style';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=String.raw`
/* VISUAL_ONLY — Flightdeck layout refinement. No data, handlers or lifecycle ownership. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(400px,470px)!important;
  grid-template-areas:
    "deals deals"
    "master mission"!important;
  gap:14px!important;
  align-items:start!important;
}

/* Active deal contour: full-width command surface under the title/instruments. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals{
  grid-area:deals!important;
  width:100%!important;
  min-height:0!important;
  overflow:hidden!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__head{
  min-height:76px!important;
  padding:15px 18px 14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__code{
  font-size:11.5px!important;
  letter-spacing:.15em!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__title{
  margin-top:6px!important;
  font-size:20px!important;
  line-height:1.18!important;
  letter-spacing:-.015em!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__count{
  min-width:42px!important;
  height:38px!important;
  font-size:14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__body{
  padding:12px 14px 14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list-head{
  grid-template-columns:minmax(250px,1.2fr) minmax(390px,1.7fr) minmax(170px,.55fr)!important;
  gap:16px!important;
  padding:9px 14px 11px!important;
  font-size:11px!important;
  letter-spacing:.09em!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list{
  max-height:520px!important;
  padding-right:3px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip{
  grid-template-columns:minmax(250px,1.2fr) minmax(390px,1.7fr) minmax(170px,.55fr)!important;
  gap:16px!important;
  min-height:96px!important;
  padding:13px 14px!important;
  border-radius:9px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip+.rona-fd-v5-strip{margin-top:7px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__id{
  font-size:14px!important;
  line-height:1.25!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__client{
  margin-top:7px!important;
  font-size:13px!important;
  line-height:1.42!important;
  white-space:normal!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__states{gap:8px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__state{
  gap:8px!important;
  font-size:12px!important;
  line-height:1.3!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__signal{
  width:8px!important;
  height:8px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__next{
  margin-top:6px!important;
  font-size:11.5px!important;
  line-height:1.4!important;
  white-space:normal!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__telemetry{gap:7px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__chip{
  min-width:68px!important;
  padding:6px 8px!important;
  font-size:11px!important;
}

/* Execution Vector: compact, tall right-side avionics dashboard. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission{
  grid-area:mission!important;
  width:100%!important;
  min-width:0!important;
  min-height:660px!important;
  align-self:stretch!important;
  display:grid!important;
  grid-template-rows:auto auto minmax(0,1fr) auto!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-head{
  padding:15px 16px 13px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-kicker{
  font-size:10.5px!important;
  letter-spacing:.13em!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-id{
  margin-top:7px!important;
  font-size:19px!important;
  line-height:1.15!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-client{
  margin-top:6px!important;
  font-size:12.5px!important;
  line-height:1.4!important;
  white-space:normal!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-open{
  min-height:40px!important;
  padding:0 13px!important;
  font-size:10.5px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-status{
  grid-template-columns:1fr!important;
  gap:0!important;
  padding:0!important;
  border-bottom:1px solid rgba(117,203,237,.12)!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-cell{
  display:grid!important;
  grid-template-columns:118px minmax(0,1fr)!important;
  align-items:center!important;
  gap:10px!important;
  min-height:48px!important;
  padding:9px 13px!important;
  border-right:0!important;
  border-bottom:1px solid rgba(117,203,237,.08)!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-cell:last-child{border-bottom:0!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-label{
  font-size:9.5px!important;
  letter-spacing:.09em!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-value{
  margin-top:0!important;
  font-size:12.5px!important;
  line-height:1.3!important;
  text-align:right!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__vector{
  position:relative!important;
  display:grid!important;
  grid-template-columns:1fr!important;
  grid-template-rows:repeat(7,minmax(62px,1fr))!important;
  gap:5px!important;
  min-height:0!important;
  padding:12px!important;
  align-content:stretch!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage{
  position:relative!important;
  min-height:0!important;
  display:grid!important;
  grid-template-columns:16px 92px minmax(0,1fr)!important;
  align-items:center!important;
  gap:10px!important;
  padding:10px 12px!important;
  border:1px solid rgba(110,231,255,.09)!important;
  border-radius:7px!important;
  background:linear-gradient(90deg,rgba(110,231,255,.035),rgba(5,16,26,.28))!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage__lamp{
  width:9px!important;
  height:9px!important;
  margin:0!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage__label{
  font-size:10px!important;
  letter-spacing:.08em!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage__value{
  margin-top:0!important;
  font-size:12.5px!important;
  line-height:1.35!important;
  text-align:right!important;
  overflow-wrap:anywhere!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage:not(:last-child):after{
  display:block!important;
  content:''!important;
  position:absolute!important;
  left:19px!important;
  top:calc(50% + 7px)!important;
  width:1px!important;
  height:calc(50% + 12px)!important;
  background:linear-gradient(180deg,rgba(110,231,255,.38),rgba(110,231,255,.06))!important;
  opacity:.8!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__next-action{
  margin:0 12px 12px!important;
  padding:11px 12px!important;
  gap:12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__next-label{font-size:10px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__next-value{
  font-size:12px!important;
  line-height:1.4!important;
  white-space:normal!important;
  text-align:right!important;
}

/* Master caution/warning: content-sized, not a full-width empty frame. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__master{
  grid-area:master!important;
  grid-column:auto!important;
  width:max-content!important;
  min-width:360px!important;
  max-width:min(100%,720px)!important;
  min-height:0!important;
  height:auto!important;
  justify-self:start!important;
  align-self:start!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__head{
  min-height:58px!important;
  padding:12px 14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__code{font-size:10px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__title{font-size:15px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__body{
  width:max-content!important;
  max-width:100%!important;
  padding:0 0 8px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-banner{
  width:max-content!important;
  max-width:calc(100% - 20px)!important;
  margin:10px!important;
  padding:11px 13px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-code{font-size:10px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-text{font-size:13px!important;line-height:1.3!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-queue{
  width:max-content!important;
  max-width:100%!important;
  max-height:none!important;
  padding:0 10px 2px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event{
  width:max-content!important;
  min-width:330px!important;
  max-width:680px!important;
  min-height:62px!important;
  padding:10px 11px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event__name{font-size:12px!important;line-height:1.3!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event__meta{font-size:10.5px!important;line-height:1.4!important;white-space:normal!important}

@media(max-width:1050px){
  #page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
    grid-template-columns:1fr!important;
    grid-template-areas:"deals" "mission" "master"!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__mission{min-height:0!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__vector{grid-template-rows:none!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__master{max-width:100%!important}
}
@media(max-width:720px){
  #page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list-head{display:none!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip{grid-template-columns:1fr!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__telemetry{justify-items:start!important;grid-template-columns:repeat(2,auto)!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__status-cell{grid-template-columns:1fr!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__status-value{text-align:left!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5-stage{grid-template-columns:16px 80px minmax(0,1fr)!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__master{width:100%!important;min-width:0!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5-event{width:100%!important;min-width:0!important}
}
`;
  document.head.appendChild(s);
})();
`;