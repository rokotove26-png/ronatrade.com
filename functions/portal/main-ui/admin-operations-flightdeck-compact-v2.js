const css=String.raw`
/* VISUAL_ONLY — Operations Flightdeck compact vertical rhythm.
   Main canonical page heading keeps its design; only its outer width follows the flightdeck width. */

/* Align the existing canonical page-heading frame with the 120% flightdeck without changing its visual design. */
#page-home:has(> .rona-flightdeck-v5) > :has(h1):not(.rona-flightdeck-v5):not(:has(.rona-flightdeck-v5)){
  width:120%!important;
  max-width:2280px!important;
  margin-left:-10%!important;
  margin-right:-10%!important;
  box-sizing:border-box!important;
}

/* Keep the dashboard wide, but remove vertical inflation introduced by the earlier scale layer. */
#page-home .rona-flightdeck-v5{
  gap:12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__overhead{
  min-height:0!important;
  height:auto!important;
  padding:12px 16px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__annunciator{
  min-height:54px!important;
  padding:9px 12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__refresh{
  min-height:42px!important;
  padding:0 13px!important;
}

#page-home .rona-flightdeck-v5 .rona-fd-v5__instruments{
  gap:10px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-gauge{
  min-height:118px!important;
  height:auto!important;
  padding:12px 14px!important;
}

/* Primary workspace: content-sized rows instead of vertically stretched frames. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
  grid-template-columns:minmax(0,1fr) minmax(500px,560px)!important;
  grid-template-rows:auto auto!important;
  gap:12px!important;
  align-items:start!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-screen{
  min-height:0!important;
  height:auto!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-screen__head{
  min-height:62px!important;
  padding:12px 16px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-screen__body{
  padding:10px 12px 12px!important;
}

/* Active deals: enough room for content, then scroll; no fixed 624px shell. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals{
  min-height:0!important;
  height:auto!important;
  align-self:start!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__head{
  min-height:62px!important;
  padding:12px 16px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-screen__body{
  padding:10px 12px 12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list-head{
  padding:8px 12px 9px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list{
  max-height:390px!important;
  padding-right:3px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip{
  min-height:78px!important;
  padding:10px 13px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-strip+.rona-fd-v5-strip{
  margin-top:6px!important;
}

/* Execution vector: rows size to their contents instead of forcing a 792px column. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission{
  min-height:0!important;
  height:auto!important;
  align-self:start!important;
  grid-template-rows:auto auto auto auto!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-head{
  padding:13px 15px 12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__mission-open{
  min-height:40px!important;
  padding:0 13px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__status-cell{
  min-height:44px!important;
  padding:8px 12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__vector{
  height:auto!important;
  min-height:0!important;
  grid-template-rows:repeat(7,auto)!important;
  gap:5px!important;
  padding:10px 12px!important;
  align-content:start!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-stage{
  min-height:52px!important;
  grid-template-columns:17px 96px minmax(0,1fr)!important;
  gap:10px!important;
  padding:8px 10px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__next-action{
  margin:0 12px 12px!important;
  padding:10px 12px!important;
  gap:12px!important;
}

/* Exception panel: compact around actual alerts instead of filling the neighboring mission height. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__master{
  min-height:0!important;
  height:auto!important;
  align-self:start!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__head{
  min-height:56px!important;
  padding:10px 14px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__body{
  grid-template-columns:minmax(250px,.68fr) minmax(0,1.32fr)!important;
  gap:10px!important;
  padding:10px 12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__master-banner{
  min-height:0!important;
  padding:10px 12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-queue{
  gap:6px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-event{
  min-height:54px!important;
  padding:9px 10px!important;
}

/* Lower systems and footer: preserve content and controls, remove excess air. */
#page-home .rona-flightdeck-v5 .rona-fd-v5__systems{
  gap:12px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5-system{
  min-height:108px!important;
  height:auto!important;
  padding:14px 16px!important;
}
#page-home .rona-flightdeck-v5 .rona-fd-v5__footer{
  min-height:38px!important;
  padding:8px 12px!important;
}

@media(max-width:1400px){
  #page-home:has(> .rona-flightdeck-v5) > :has(h1):not(.rona-flightdeck-v5):not(:has(.rona-flightdeck-v5)){
    width:110%!important;
    max-width:none!important;
    margin-left:-5%!important;
    margin-right:-5%!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
    grid-template-columns:minmax(0,1fr) minmax(460px,520px)!important;
  }
}
@media(max-width:1100px){
  #page-home:has(> .rona-flightdeck-v5) > :has(h1):not(.rona-flightdeck-v5):not(:has(.rona-flightdeck-v5)){
    width:100%!important;
    margin-left:0!important;
    margin-right:0!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__workspace{
    grid-template-columns:1fr!important;
    grid-template-areas:"deals" "mission" "master"!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__mission{
    height:auto!important;
    min-height:0!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__vector{
    grid-template-rows:none!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__master .rona-fd-v5-screen__body{
    grid-template-columns:1fr!important;
  }
}
@media(max-width:720px){
  #page-home .rona-flightdeck-v5 .rona-fd-v5-gauge{
    min-height:106px!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5__deals .rona-fd-v5-list{
    max-height:460px!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5-stage{
    min-height:48px!important;
    grid-template-columns:17px 88px minmax(0,1fr)!important;
  }
  #page-home .rona-flightdeck-v5 .rona-fd-v5-system{
    min-height:96px!important;
  }
}
`;

export default String.raw`
(()=>{
  if(window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_COMPACT_V2__)return;
  window.__RONA_ADMIN_OPERATIONS_FLIGHTDECK_COMPACT_V2__='20260915-content-fit-heading-width-v2';
  const id='ronaAdminOperationsFlightdeckCompactV2Style';
  if(document.getElementById(id))return;
  const s=document.createElement('style');
  s.id=id;
  s.textContent=${JSON.stringify(css)};
  document.head.appendChild(s);
})();
`;
