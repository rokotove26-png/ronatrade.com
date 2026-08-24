const SCRIPT=String.raw`(function(){
'use strict';
if(window.__RONA_OWNER_LAYOUT_POLISH__)return;
window.__RONA_OWNER_LAYOUT_POLISH__='20260824-1346-rail-claims-v1';
var s=document.createElement('style');
s.id='ronaOwnerLayoutPolishStyle';
s.textContent=[
'#page-monitoring .rona-rail-v4-work{align-items:stretch!important}',
'#page-monitoring .rona-rail-v4-left{height:100%!important;align-self:stretch!important;grid-template-rows:auto minmax(0,1fr)!important}',
'#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child{height:100%!important;min-height:0!important;display:flex!important;flex-direction:column!important}',
'#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child>.rona-rail-v4-table-wrap{flex:1 1 auto!important;min-height:0!important}',
'html body #page-claims>.rona-claims-r2-root{width:min(1480px,calc(100% - 36px))!important;max-width:1480px!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box!important}',
'@media(max-width:1040px){#page-monitoring .rona-rail-v4-work{align-items:start!important}#page-monitoring .rona-rail-v4-left{height:auto!important;grid-template-rows:auto auto!important}#page-monitoring .rona-rail-v4-left>.rona-rail-v4-card:last-child{height:auto!important}}',
'@media(max-width:980px){html body #page-claims>.rona-claims-r2-root{width:calc(100% - 24px)!important}}'
].join('');
document.head.appendChild(s);
})();`;

export async function onRequest(){
  return new Response(SCRIPT,{status:200,headers:{
    'content-type':'application/javascript; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'expires':'0',
    'x-content-type-options':'nosniff',
    'x-rona-owner-layout-polish':'rail-claims-v1'
  }});
}
