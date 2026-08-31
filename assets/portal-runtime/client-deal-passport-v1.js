(()=>{
'use strict';
const MARK='20260831-client-deal-passport-v2-centered-status';
if(window.__RONA_CLIENT_DEAL_PASSPORT__===MARK)return;
window.__RONA_CLIENT_DEAL_PASSPORT__=MARK;
if(location.pathname!=='/portal/client')return;
const STYLE_ID='rona-client-deal-passport-v2-style';
const ROOT_CLASS='rona-deal-command-center-v3';
function installStyle(){
 if(document.getElementById(STYLE_ID))return;
 const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.${ROOT_CLASS} [data-rona-command-field="stage"],.${ROOT_CLASS} [data-rona-command-field="resource"]{display:flex!important;flex-direction:column!important;justify-content:center!important}
.${ROOT_CLASS} [data-rona-command-field="stage"] [data-rona-command-field-value],.${ROOT_CLASS} [data-rona-command-field="resource"] [data-rona-command-field-value]{display:flex!important;align-items:center!important;min-height:28px!important}
`;
 document.head.append(s);
}
function run(){installStyle();}
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
run();
})();
