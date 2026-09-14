const css=String.raw`
/* VISUAL_ONLY — Owner-approved 120% frame expansion and working typography scale.
   Canonical Operations title and six general KPI information gauges are intentionally excluded from font scaling. */
#page-home .rona-flightdeck-v5{
  width:120%!important;
  max-width:2280px!important;
  margin-left:-10%!important;
  margin-right:-10%!important;
  gap:17px!important;
}

/* Expand every primary frame by ~20% while preserving the existing Flightdeck composition. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead{
  min-height:106px!important;
  padding:19px 24px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__annunciator{
  min-width:300px!important;
  min-height:84px!important;
  padding:14px 18px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__refresh{
  min-width:130px!important;
  min-height:58px!important;
  padding:0 17px!important;
}

/* General KPI blocks: frame expansion only; typography remains unchanged by Owner request. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__instruments{
  gap:12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-gauge{
  min-height:180px!important;
  padding:17px 18px 16px!important;
  border-radius:8px!important;
}

#page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
  grid-template-columns:minmax(0,1fr) minmax(528px,600px)!important;
  gap:17px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-screen{
  border-radius:12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-screen__head{
  min-height:91px!important;
  padding:18px 22px 17px!important;
  gap:14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-screen__body{
  padding:14px 17px 17px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals{
  min-height:624px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list-head{
  grid-template-columns:minmax(300px,1.2fr) minmax(468px,1.7fr) minmax(204px,.55fr)!important;
  gap:19px!important;
  padding:11px 17px 13px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list{
  max-height:624px!important;
  padding-right:4px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip{
  grid-template-columns:minmax(300px,1.2fr) minmax(468px,1.7fr) minmax(204px,.55fr)!important;
  gap:19px!important;
  min-height:115px!important;
  padding:16px 17px!important;
  border-radius:11px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip+.rona-fd-v5-strip{
  margin-top:8px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__states{
  gap:10px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__telemetry{
  gap:9px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__chip{
  min-width:82px!important;
  padding:7px 10px!important;
}

/* Working-panel typography: exact 120% target from the current accepted layer. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__code{font-size:13.8px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__title{font-size:24px!important;line-height:1.18!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__count{font-size:16.8px!important;min-width:50px!important;height:46px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list-head{font-size:13.2px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__id{font-size:16.8px!important;line-height:1.25!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__client{font-size:15.6px!important;line-height:1.42!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__state{font-size:14.4px!important;line-height:1.3!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__next{font-size:13.8px!important;line-height:1.4!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__chip{font-size:13.2px!important}

/* Execution Vector: 20% larger frame geometry + 20% working typography. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission{
  min-height:792px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-head{
  padding:18px 19px 16px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-kicker{font-size:12.6px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-id{font-size:22.8px!important;line-height:1.15!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-client{font-size:15px!important;line-height:1.4!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-open{min-height:48px!important;padding:0 16px!important;font-size:12.6px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-cell{
  grid-template-columns:142px minmax(0,1fr)!important;
  gap:12px!important;
  min-height:58px!important;
  padding:11px 16px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-label{font-size:11.4px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-value{font-size:15px!important;line-height:1.3!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__vector{
  grid-template-rows:repeat(7,minmax(74px,1fr))!important;
  gap:6px!important;
  padding:14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage{
  grid-template-columns:19px 110px minmax(0,1fr)!important;
  gap:12px!important;
  min-height:74px!important;
  padding:12px 14px!important;
  border-radius:8px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage__lamp{width:11px!important;height:11px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage__label{font-size:12px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage__value{font-size:15px!important;line-height:1.35!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__next-action{margin:0 14px 14px!important;padding:13px 14px!important;gap:14px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__next-label{font-size:12px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__next-value{font-size:14.4px!important;line-height:1.4!important}

/* Master caution / warning: larger frame, readable typography, no functional change. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__head{
  min-height:70px!important;
  padding:14px 17px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__code{font-size:12px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__title{font-size:18px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__body{
  grid-template-columns:minmax(336px,.72fr) minmax(0,1.28fr)!important;
  gap:14px!important;
  padding:14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-banner{
  min-height:91px!important;
  padding:17px 18px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-code{font-size:12px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-text{font-size:15.6px!important;line-height:1.3!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-queue{
  grid-template-columns:repeat(auto-fit,minmax(360px,1fr))!important;
  gap:10px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event{
  min-height:91px!important;
  padding:12px 13px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event__name{font-size:14.4px!important;line-height:1.3!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event__meta{font-size:12.6px!important;line-height:1.4!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event__open{width:41px!important;height:41px!important;font-size:19.2px!important}

/* Lower system frames: expand geometry and working typography by 20%. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__systems{gap:17px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-system{
  min-height:170px!important;
  padding:20px 22px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-system__code{font-size:12px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-system__title{font-size:18px!important;line-height:1.25!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-system__meta{font-size:13.8px!important;line-height:1.5!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5-system__value{font-size:50.4px!important}
#page-home .rona-flightdeck-v5 .rona-fd-v5__footer{min-height:55px!important;padding:12px 14px!important;font-size:12px!important;line-height:1.4!important}

/* Canonical title and general KPI typography are explicitly frozen. */
#page-home .rona-flightdeck-v5 .rona-ops-v4__title{font-size:clamp(28px,3vw,46px)!important;line-height:1!important}

@media(max-width:1400px){
  #page-home .rona-flightdeck-v5{
    width:110%!important;
    margin-left:-5%!important;
    margin-right:-5%!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
    grid-template-columns:minmax(0,1fr) minmax(470px,540px)!important;
  }
}
@media(max-width:1100px){
  #page-home .rona-flightdeck-v5{
    width:100%!important;
    margin-left:0!important;
    margin-right:0!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
    grid-template-columns:1fr!important;
    grid-template-areas:"deals" "mission" "master"!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__mission{min-height:0!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__vector{grid-template-rows:none!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__body{grid-template-columns:1fr!important}
}
@media(max-width:720px){
  #page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list-head{display:none!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip{grid-template-columns:1fr!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip__telemetry{justify-items:start!important;grid-template-columns:repeat(2,auto)!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__status-cell{grid-template-columns:1fr!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__status-value{text-align:left!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5-stage{grid-template-columns:19px 96px minmax(0,1fr)!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__systems{grid-template-columns:1fr!important}
}
`;

export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_SCALE_120_V1__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_SCALE_120_V1__='20260914-frames-fonts-120-v1';
  const id='ronaAdminOperationsFlightdeckScale120V1Style';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=${JSON.stringify(css)};
  document.head.appendChild(s);
})();
`;
