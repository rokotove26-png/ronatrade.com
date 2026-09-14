const css=String.raw`
/* VISUAL_ONLY — pack the Operations Flightdeck into one continuous dashboard grid. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
  display:grid!important;
  grid-template-columns:minmax(0,1fr) minmax(440px,500px)!important;
  grid-template-areas:
    "deals mission"
    "master mission"!important;
  grid-template-rows:auto auto!important;
  gap:14px!important;
  width:100%!important;
  align-items:stretch!important;
}

/* Left command stack: every frame fills its cell edge-to-edge. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals{
  grid-area:deals!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  justify-self:stretch!important;
  align-self:stretch!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master{
  grid-area:master!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  height:auto!important;
  min-height:0!important;
  justify-self:stretch!important;
  align-self:stretch!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__body{
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  display:grid!important;
  grid-template-columns:minmax(280px,.72fr) minmax(0,1.28fr)!important;
  align-items:start!important;
  gap:12px!important;
  padding:12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-banner{
  width:100%!important;
  max-width:none!important;
  margin:0!important;
  min-height:76px!important;
  padding:14px 15px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-queue{
  width:100%!important;
  max-width:none!important;
  max-height:none!important;
  padding:0!important;
  display:grid!important;
  grid-template-columns:repeat(auto-fit,minmax(300px,1fr))!important;
  gap:8px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event{
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  min-height:76px!important;
  margin:0!important;
}

/* Right execution column: one continuous vertical dashboard from top to bottom. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission{
  grid-area:mission!important;
  width:100%!important;
  min-width:0!important;
  max-width:none!important;
  min-height:0!important;
  height:100%!important;
  align-self:stretch!important;
  justify-self:stretch!important;
  display:grid!important;
  grid-template-rows:auto auto minmax(0,1fr) auto!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__vector{
  min-height:0!important;
  height:100%!important;
  align-content:stretch!important;
  grid-template-rows:repeat(7,minmax(62px,1fr))!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage{
  min-height:62px!important;
}

/* Keep the lower systems visually locked to the same dashboard width. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__systems{
  width:100%!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-system{
  width:100%!important;
  min-width:0!important;
  justify-self:stretch!important;
}

/* Remove visual "holes": neighboring frames share one packed rhythm. */
#page-home .rona-flightdeck-v5 .rona-fd-v5-screen,
#page-home .rona-flightdeck-v5 .rona-fd-v5-system{
  margin:0!important;
}

@media(max-width:1220px){
  #page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
    grid-template-columns:minmax(0,1fr) minmax(390px,440px)!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__body{
    grid-template-columns:1fr!important;
  }
}
@media(max-width:980px){
  #page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
    grid-template-columns:1fr!important;
    grid-template-areas:
      "deals"
      "mission"
      "master"!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__mission{height:auto!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__vector{grid-template-rows:none!important}
  #page-home .rona-flightdeck-v5 .rona-fd-v5__systems{grid-template-columns:1fr!important}
}
`;

export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_PACKED_V1__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_PACKED_V1__='20260914-no-gaps-packed-dashboard-v1';
  const id='ronaAdminOperationsFlightdeckPackedV1Style';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=${JSON.stringify(css)};
  document.head.appendChild(s);
})();
`;
