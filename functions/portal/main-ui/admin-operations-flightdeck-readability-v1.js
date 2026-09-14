const css=String.raw`
#page-home .rona-flightdeck-v5{
  max-width:1900px!important;
  gap:14px!important;
}
#page-home .rona-fd-v5__overhead{
  min-height:88px!important;
  padding:16px 20px!important;
}
#page-home .rona-fd-v5__overline{font-size:11.5px!important;letter-spacing:.17em!important}
#page-home .rona-fd-v5__subtitle{font-size:11px!important;letter-spacing:.09em!important;gap:10px!important}
#page-home .rona-fd-v5__annunciator{min-width:250px!important;min-height:70px!important;padding:12px 15px!important}
#page-home .rona-fd-v5__ann-label{font-size:10.5px!important;letter-spacing:.13em!important}
#page-home .rona-fd-v5__ann-value{font-size:14px!important;line-height:1.25!important}
#page-home .rona-fd-v5__refresh{min-width:108px!important;min-height:48px!important;font-size:11.5px!important;padding:0 14px!important}

#page-home .rona-fd-v5__instruments{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
#page-home .rona-fd-v5-gauge{min-height:150px!important;padding:14px 15px 13px!important}
#page-home .rona-fd-v5-gauge__code{font-size:10.5px!important;letter-spacing:.11em!important}
#page-home .rona-fd-v5-gauge__lamp{width:9px!important;height:9px!important}
#page-home .rona-fd-v5-gauge__label{margin-top:11px!important;font-size:12px!important;letter-spacing:.08em!important;white-space:normal!important;line-height:1.25!important}
#page-home .rona-fd-v5-gauge__value{margin-top:10px!important;font-size:40px!important;line-height:.95!important}
#page-home .rona-fd-v5-gauge__foot{margin-top:10px!important;font-size:11.5px!important;line-height:1.35!important;white-space:normal!important}
#page-home .rona-fd-v5-gauge__rail{margin-top:10px!important}
#page-home .rona-fd-v5-gauge__rail span{height:3px!important}

#page-home .rona-fd-v5__workspace{grid-template-columns:minmax(360px,.82fr) minmax(560px,1.38fr)!important;gap:12px!important}
#page-home .rona-fd-v5__master{grid-column:1/-1!important;min-height:300px!important}
#page-home .rona-fd-v5-screen{min-height:520px!important;border-radius:10px!important}
#page-home .rona-fd-v5-screen__head{min-height:70px!important;padding:14px 16px 13px!important}
#page-home .rona-fd-v5-screen__code{font-size:10.5px!important;letter-spacing:.14em!important}
#page-home .rona-fd-v5-screen__title{margin-top:6px!important;font-size:16.5px!important;line-height:1.25!important}
#page-home .rona-fd-v5-screen__meta{font-size:11px!important}
#page-home .rona-fd-v5-screen__count{min-width:38px!important;height:34px!important;font-size:13px!important}
#page-home .rona-fd-v5-screen__body{padding:11px!important}

#page-home .rona-fd-v5-list-head{grid-template-columns:minmax(118px,.78fr) minmax(0,1.35fr) auto!important;gap:10px!important;padding:8px 10px 10px!important;font-size:10px!important;letter-spacing:.09em!important}
#page-home .rona-fd-v5-list{max-height:430px!important}
#page-home .rona-fd-v5-strip{grid-template-columns:minmax(126px,.82fr) minmax(0,1.4fr) auto!important;gap:11px!important;min-height:84px!important;padding:11px 12px!important;border-radius:7px!important}
#page-home .rona-fd-v5-strip+.rona-fd-v5-strip{margin-top:6px!important}
#page-home .rona-fd-v5-strip__id{font-size:12.5px!important;line-height:1.25!important}
#page-home .rona-fd-v5-strip__client{margin-top:6px!important;font-size:11.5px!important;line-height:1.4!important;white-space:normal!important}
#page-home .rona-fd-v5-strip__states{gap:6px!important}
#page-home .rona-fd-v5-strip__state{gap:7px!important;font-size:10.5px!important;line-height:1.25!important}
#page-home .rona-fd-v5-strip__signal{width:7px!important;height:7px!important}
#page-home .rona-fd-v5-strip__telemetry{gap:6px!important}
#page-home .rona-fd-v5-strip__chip{min-width:56px!important;padding:5px 7px!important;font-size:10px!important}
#page-home .rona-fd-v5-strip__next{margin-top:4px!important;font-size:10px!important;line-height:1.3!important;white-space:normal!important}

#page-home .rona-fd-v5__mission{min-height:520px!important}
#page-home .rona-fd-v5__mission-head{padding:16px 17px 14px!important}
#page-home .rona-fd-v5__mission-kicker{font-size:10.5px!important;letter-spacing:.14em!important}
#page-home .rona-fd-v5__mission-id{margin-top:7px!important;font-size:18px!important}
#page-home .rona-fd-v5__mission-client{margin-top:6px!important;font-size:12px!important;line-height:1.35!important;white-space:normal!important}
#page-home .rona-fd-v5__mission-open{min-height:40px!important;padding:0 14px!important;font-size:10.5px!important}
#page-home .rona-fd-v5__mission-status{gap:7px!important;padding:10px 12px!important}
#page-home .rona-fd-v5__status-cell{padding:10px!important}
#page-home .rona-fd-v5__status-label{font-size:9.5px!important;letter-spacing:.09em!important}
#page-home .rona-fd-v5__status-value{margin-top:7px!important;font-size:12px!important;line-height:1.3!important}
#page-home .rona-fd-v5__vector{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:7px!important;padding:16px 12px!important}
#page-home .rona-fd-v5-stage{min-height:138px!important;padding:14px 10px 12px!important}
#page-home .rona-fd-v5-stage:not(:last-child):after{display:none!important}
#page-home .rona-fd-v5-stage__lamp{width:10px!important;height:10px!important;margin-bottom:12px!important}
#page-home .rona-fd-v5-stage__label{font-size:9.5px!important;letter-spacing:.09em!important}
#page-home .rona-fd-v5-stage__value{margin-top:10px!important;font-size:12px!important;line-height:1.45!important}
#page-home .rona-fd-v5__next-action{gap:14px!important;margin:0 12px 12px!important;padding:12px!important}
#page-home .rona-fd-v5__next-label{font-size:10px!important;letter-spacing:.11em!important}
#page-home .rona-fd-v5__next-value{font-size:12px!important;line-height:1.35!important;white-space:normal!important}

#page-home .rona-fd-v5__master-banner{gap:12px!important;margin:11px!important;padding:13px!important}
#page-home .rona-fd-v5__master-lamp{width:14px!important;height:14px!important}
#page-home .rona-fd-v5__master-code{font-size:10px!important;letter-spacing:.12em!important}
#page-home .rona-fd-v5__master-text{margin-top:5px!important;font-size:14px!important;line-height:1.3!important}
#page-home .rona-fd-v5-queue{max-height:360px!important;padding:0 11px 11px!important}
#page-home .rona-fd-v5-event{gap:10px!important;min-height:70px!important;padding:11px!important}
#page-home .rona-fd-v5-event+.rona-fd-v5-event{margin-top:6px!important}
#page-home .rona-fd-v5-event__signal{width:9px!important;height:9px!important}
#page-home .rona-fd-v5-event__name{font-size:12.5px!important;line-height:1.3!important}
#page-home .rona-fd-v5-event__meta{margin-top:5px!important;font-size:10.5px!important;line-height:1.4!important;white-space:normal!important}
#page-home .rona-fd-v5-event__open{width:34px!important;height:34px!important;font-size:16px!important}
#page-home .rona-fd-v5-empty__title{font-size:13px!important}
#page-home .rona-fd-v5-empty__meta{font-size:11px!important;line-height:1.55!important}

#page-home .rona-fd-v5__systems{gap:10px!important}
#page-home .rona-fd-v5-system{min-height:142px!important;padding:17px 18px!important}
#page-home .rona-fd-v5-system__head{gap:9px!important}
#page-home .rona-fd-v5-system__lamp{width:9px!important;height:9px!important}
#page-home .rona-fd-v5-system__code{font-size:10px!important;letter-spacing:.14em!important}
#page-home .rona-fd-v5-system__title{margin-top:10px!important;font-size:15px!important;line-height:1.25!important}
#page-home .rona-fd-v5-system__meta{margin-top:7px!important;font-size:11.5px!important;line-height:1.5!important}
#page-home .rona-fd-v5-system__value{font-size:42px!important}
#page-home .rona-fd-v5__footer{min-height:46px!important;padding:10px 12px!important;font-size:10px!important;line-height:1.4!important}

@media(max-width:1500px){
  #page-home .rona-fd-v5__workspace{grid-template-columns:1fr!important}
  #page-home .rona-fd-v5__master{grid-column:auto!important}
  #page-home .rona-fd-v5-screen,#page-home .rona-fd-v5__mission,#page-home .rona-fd-v5__master{min-height:0!important}
  #page-home .rona-fd-v5__systems{grid-template-columns:1fr!important}
}
@media(max-width:980px){
  #page-home .rona-fd-v5__instruments{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  #page-home .rona-fd-v5__vector{grid-template-columns:repeat(2,minmax(0,1fr))!important}
}
@media(max-width:640px){
  #page-home .rona-fd-v5__instruments{grid-template-columns:1fr!important}
  #page-home .rona-fd-v5-strip{grid-template-columns:1fr!important}
  #page-home .rona-fd-v5-strip__telemetry{justify-items:start!important;grid-template-columns:repeat(2,auto)!important}
  #page-home .rona-fd-v5__mission-status{grid-template-columns:1fr!important}
  #page-home .rona-fd-v5__vector{grid-template-columns:1fr!important}
}
`;

export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_READABILITY_V1__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_READABILITY_V1__='20260914-readable-flightdeck-v1';
  const id='ronaAdminOperationsFlightdeckReadabilityV1Style';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=${JSON.stringify(css)};
  document.head.appendChild(s);
})();
`;
