(()=>{'use strict';
const MARK='20260830-portal-canonical-button-hover-v1';
if(window.__RONA_CANONICAL_BUTTON_HOVER__===MARK)return;
window.__RONA_CANONICAL_BUTTON_HOVER__=MARK;
const STYLE_ID='rona-canonical-button-hover-v1-style';
if(document.getElementById(STYLE_ID))return;
const style=document.createElement('style');
style.id=STYLE_ID;
style.textContent=`
html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]){
  transition:filter .16s ease!important;
}
html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]):hover{
  filter:brightness(1.11) saturate(1.06) drop-shadow(0 0 5px rgba(213,241,255,.18))!important;
}
html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]):active{
  filter:brightness(1.03) saturate(1.03)!important;
}

#page-deals [data-rona-deal-stage-tabs]{
  width:80%!important;
  max-width:80%!important;
  margin:18px 0 20px auto!important;
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:12px!important;
}
#page-deals [data-rona-deal-stage-tab]{
  min-height:54px!important;
  padding:0 18px!important;
  border:1px solid rgba(96,187,226,.42)!important;
  border-radius:12px!important;
  background:linear-gradient(180deg,rgba(18,48,68,.98),rgba(6,25,41,.98))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),inset 0 -1px 0 rgba(0,0,0,.28),0 7px 18px rgba(0,7,13,.24)!important;
  color:rgba(222,235,243,.92)!important;
  font-weight:820!important;
}
#page-deals [data-rona-deal-stage-tab][aria-selected="true"]{
  border-color:rgba(91,220,255,.92)!important;
  background:radial-gradient(180px 62px at 50% 0,rgba(78,211,255,.24),transparent 72%),linear-gradient(180deg,rgba(23,91,128,.98),rgba(8,43,70,.98))!important;
  color:#fff!important;
}
#page-deals [data-rona-deal-stage-tab]:focus-visible{
  outline:2px solid rgba(116,226,255,.96)!important;
  outline-offset:2px!important;
}
@container rona-client-deals (max-width:760px){
  #page-deals [data-rona-deal-stage-tabs]{width:100%!important;max-width:100%!important;margin-left:0!important;margin-right:0!important;grid-template-columns:1fr!important}
}
@media (prefers-reduced-motion:reduce){
  html body :is(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]){transition:none!important}
}
`;
document.head.appendChild(style);
})();
