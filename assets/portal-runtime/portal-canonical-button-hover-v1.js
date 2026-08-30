(()=>{'use strict';
const MARK='20260830-portal-canonical-button-hover-v1';
if(window.__RONA_CANONICAL_BUTTON_HOVER__===MARK)return;
window.__RONA_CANONICAL_BUTTON_HOVER__=MARK;
const STYLE_ID='rona-canonical-button-hover-v1-style';
if(document.getElementById(STYLE_ID))return;
const style=document.createElement('style');
style.id=STYLE_ID;
style.textContent=`
:where(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]){
  transition:filter .16s ease,transform .16s ease!important;
}
:where(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]):hover{
  filter:brightness(1.11) saturate(1.06) drop-shadow(0 0 5px rgba(116,220,255,.20))!important;
}
:where(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]):not(:disabled):not([aria-disabled="true"]):active{
  filter:brightness(1.03) saturate(1.03)!important;
}
@media (prefers-reduced-motion:reduce){
  :where(button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,.btn,[role="button"],[class~="button"],[class*="-btn"],[class*="_btn"]){transition:none!important}
}
`;
document.head.appendChild(style);
})();
