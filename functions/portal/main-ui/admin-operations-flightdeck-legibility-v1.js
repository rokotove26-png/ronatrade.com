const css=String.raw`
#page-home .rona-flightdeck-v5{gap:14px;font-size:13px}
#page-home .rona-fd-v5__overline,
#page-home .rona-fd-v5__subtitle{font-size:12px;line-height:1.35}
#page-home .rona-fd-v5__annunciator{min-width:236px;min-height:70px;padding:12px 15px}
#page-home .rona-fd-v5__ann-label{font-size:11px;line-height:1.25}
#page-home .rona-fd-v5__ann-value{font-size:14px;line-height:1.3}
#page-home .rona-fd-v5__refresh{min-width:104px;font-size:12px}
#page-home .rona-fd-v5__instruments{gap:10px}
#page-home .rona-fd-v5-gauge{min-height:148px;padding:14px 15px 13px}
#page-home .rona-fd-v5-gauge__code{font-size:10px;line-height:1.25}
#page-home .rona-fd-v5-gauge__label{font-size:11px;line-height:1.3;white-space:normal}
#page-home .rona-fd-v5-gauge__value{font-size:42px;line-height:.98}
#page-home .rona-fd-v5-gauge__foot{font-size:11px;line-height:1.3;white-space:normal}
#page-home .rona-fd-v5__workspace{gap:11px}
#page-home .rona-fd-v5-screen,
#page-home .rona-fd-v5__mission,
#page-home .rona-fd-v5__master{min-height:480px}
#page-home .rona-fd-v5-screen__head{min-height:68px;padding:13px 15px 12px}
#page-home .rona-fd-v5-screen__code{font-size:10px;line-height:1.3}
#page-home .rona-fd-v5-screen__title{font-size:17px;line-height:1.25}
#page-home .rona-fd-v5-screen__meta{font-size:11px;line-height:1.3}
#page-home .rona-fd-v5-screen__count{min-width:38px;height:34px;font-size:14px}
#page-home .rona-fd-v5-list-head{font-size:9.5px;line-height:1.3;padding:7px 10px 9px}
#page-home .rona-fd-v5-list{max-height:405px}
#page-home .rona-fd-v5-strip{min-height:78px;padding:10px 11px;gap:10px}
#page-home .rona-fd-v5-strip__id{font-size:12px;line-height:1.3}
#page-home .rona-fd-v5-strip__client{font-size:11px;line-height:1.35}
#page-home .rona-fd-v5-strip__state{font-size:10px;line-height:1.3;gap:7px}
#page-home .rona-fd-v5-strip__next{font-size:9.5px;line-height:1.35}
#page-home .rona-fd-v5-strip__chip{min-width:50px;padding:5px 7px;font-size:9px;line-height:1.2}
#page-home .rona-fd-v5__mission-head{padding:15px 16px 13px}
#page-home .rona-fd-v5__mission-kicker{font-size:10px;line-height:1.3}
#page-home .rona-fd-v5__mission-id{font-size:22px;line-height:1.2}
#page-home .rona-fd-v5__mission-client{font-size:12px;line-height:1.35}
#page-home .rona-fd-v5__mission-open{font-size:11px;min-height:36px;padding:0 12px}
#page-home .rona-fd-v5__status-label{font-size:9.5px;line-height:1.3}
#page-home .rona-fd-v5__status-value{font-size:13px;line-height:1.35}
#page-home .rona-fd-v5-stage{min-height:124px;padding:13px 9px 11px}
#page-home .rona-fd-v5-stage__label{font-size:9px;line-height:1.3}
#page-home .rona-fd-v5-stage__value{font-size:11px;line-height:1.4}
#page-home .rona-fd-v5__next-action{padding:11px 12px}
#page-home .rona-fd-v5__next-label{font-size:9px}
#page-home .rona-fd-v5__next-value{font-size:12px;line-height:1.35;white-space:normal}
#page-home .rona-fd-v5__master-banner{padding:12px}
#page-home .rona-fd-v5__master-code{font-size:9px;line-height:1.3}
#page-home .rona-fd-v5__master-text{font-size:13px;line-height:1.35}
#page-home .rona-fd-v5-queue{max-height:352px}
#page-home .rona-fd-v5-event{min-height:68px;padding:10px}
#page-home .rona-fd-v5-event__name{font-size:11px;line-height:1.3}
#page-home .rona-fd-v5-event__meta{font-size:9.5px;line-height:1.4;white-space:normal}
#page-home .rona-fd-v5-event__open{width:32px;height:32px;font-size:13px}
#page-home .rona-fd-v5-empty__title{font-size:13px;line-height:1.3}
#page-home .rona-fd-v5-empty__meta{font-size:11px;line-height:1.5}
#page-home .rona-fd-v5__systems{gap:10px}
#page-home .rona-fd-v5-system{min-height:132px;padding:16px}
#page-home .rona-fd-v5-system__code{font-size:10px;line-height:1.3}
#page-home .rona-fd-v5-system__title{font-size:16px;line-height:1.3}
#page-home .rona-fd-v5-system__meta{font-size:10.5px;line-height:1.45}
#page-home .rona-fd-v5-system__value{font-size:40px}
#page-home .rona-fd-v5__footer{min-height:42px;padding:9px 11px;font-size:9px;line-height:1.4}
@media(max-width:1450px){
  #page-home .rona-fd-v5-gauge__label{font-size:12px}
  #page-home .rona-fd-v5-gauge__foot{font-size:11.5px}
  #page-home .rona-fd-v5-screen__title{font-size:18px}
}
@media(max-width:1080px){
  #page-home .rona-fd-v5-screen,
  #page-home .rona-fd-v5__mission,
  #page-home .rona-fd-v5__master{min-height:0}
}
@media(max-width:720px){
  #page-home .rona-fd-v5-gauge{min-height:136px}
  #page-home .rona-fd-v5-gauge__value{font-size:36px}
  #page-home .rona-fd-v5__overline,
  #page-home .rona-fd-v5__subtitle{font-size:10px}
}
`;

export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_LEGIBILITY_V1__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_LEGIBILITY_V1__='20260915-readable-desktop-v1';
  const id='ronaAdminOperationsFlightdeckLegibilityV1Style';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=${JSON.stringify(css)};
  document.head.appendChild(s);
})();
`;
