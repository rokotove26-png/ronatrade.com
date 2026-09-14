(()=>{'use strict';
if(window.__RONA_ADMIN_RADIO_WIDE_V10__)return;
window.__RONA_ADMIN_RADIO_WIDE_V10__='20260915-wide-command-center-v10';
const ID='rona-admin-radio-wide-v10-style';
const PAGE='#page-messages';
const css=`
${PAGE}>.rona-rs-root[data-kind="radio"]{
  width:min(calc(100% - 34px),1480px)!important;
  max-width:1480px!important;
  margin:18px auto 38px!important;
  gap:18px!important;
}
${PAGE}>.rona-rs-root[data-kind="radio"]:before{inset:-14px -18px!important}
${PAGE} .rf-hero{
  min-height:94px!important;
  padding:22px 28px!important;
  border-radius:20px!important;
}
${PAGE} .rf-hero .rona-visual-title{
  font-size:36px!important;
  line-height:1!important;
  letter-spacing:-.045em!important;
}
${PAGE} .rf-hero .rona-rs-sub{
  font-size:13px!important;
  line-height:1.5!important;
  max-width:840px!important;
  margin-top:9px!important;
}
${PAGE} .rf-kpis{gap:14px!important}
${PAGE} .rf-kpis>.rona-rs-kpi{
  min-height:112px!important;
  padding:16px 18px 15px 21px!important;
  border-radius:17px!important;
}
${PAGE} .rf-kpis h2{font-size:14px!important;line-height:1.25!important}
${PAGE} .rf-kpis .rona-owner-kpi{font-size:40px!important;line-height:.95!important}
${PAGE} .rf-kpis .rona-owner-muted{font-size:11.5px!important;line-height:1.35!important}
${PAGE} .rf-main{
  grid-template-columns:minmax(0,2.45fr) minmax(360px,.92fr)!important;
  gap:16px!important;
}
${PAGE} .rf-bottom{
  grid-template-columns:minmax(0,2.45fr) minmax(360px,.92fr)!important;
  gap:16px!important;
}
${PAGE} .rf-compose,
${PAGE} .rf-network,
${PAGE} .rf-feed,
${PAGE} .rf-routing{
  border-radius:20px!important;
  box-shadow:0 22px 54px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.03)!important;
}
${PAGE} .rf-compose{border-color:rgba(72,220,255,.28)!important}
${PAGE} .rf-network{border-color:rgba(93,231,192,.24)!important}
${PAGE} .rf-feed{border-color:rgba(95,159,255,.24)!important}
${PAGE} .rf-routing{border-color:rgba(255,179,93,.22)!important}
${PAGE} .rf-panel-head{
  min-height:58px!important;
  padding:16px 19px!important;
}
${PAGE} .rf-panel-title{font-size:17px!important;line-height:1.2!important}
${PAGE} .rf-ready{font-size:11.5px!important;gap:8px!important}
${PAGE} .rf-ready:before{width:8px!important;height:8px!important}
${PAGE} .rf-compose-body{padding:18px 19px 19px!important}
${PAGE} .rf-control-row{
  grid-template-columns:.9fr 1.08fr 1.45fr!important;
  gap:12px!important;
  margin-bottom:14px!important;
}
${PAGE} .rf-field{gap:7px!important}
${PAGE} .rf-field>span{
  font-size:11.5px!important;
  line-height:1.2!important;
  color:#8ca7b6!important;
}
${PAGE} .rf-field select{
  height:45px!important;
  padding:0 12px!important;
  font-size:13px!important;
  border-radius:11px!important;
}
${PAGE} .rf-field textarea{
  min-height:220px!important;
  max-height:380px!important;
  padding:15px 16px!important;
  font-size:14px!important;
  line-height:1.55!important;
  border-radius:13px!important;
}
${PAGE} .rf-editor-meta{
  margin-top:9px!important;
  font-size:11.5px!important;
}
${PAGE} .rf-editor-actions{
  margin-top:15px!important;
  padding-top:15px!important;
  gap:16px!important;
}
${PAGE} .rf-editor-actions button{
  min-width:178px!important;
  height:46px!important;
  border-radius:11px!important;
  font-size:13px!important;
  padding:0 22px!important;
}
${PAGE} .rf-secure{gap:9px!important}
${PAGE} .rf-secure span{
  font-size:11px!important;
  padding:7px 10px!important;
  border-radius:999px!important;
}
${PAGE} .rf-network-body{
  min-height:360px!important;
  padding:22px!important;
  gap:18px!important;
}
${PAGE} .rf-radar{
  width:188px!important;
  height:188px!important;
  background:radial-gradient(circle at center,rgba(76,217,251,.2) 0 3px,transparent 4px),repeating-radial-gradient(circle at center,rgba(91,201,237,.22) 0 1px,transparent 1px 38px)!important;
  box-shadow:0 0 64px rgba(61,190,229,.16),inset 0 0 52px rgba(49,157,203,.1)!important;
}
${PAGE} .rf-radar:after{inset:30px!important}
${PAGE} .rf-node{width:9px!important;height:9px!important}
${PAGE} .rf-node.n1{left:38px!important;top:58px!important}
${PAGE} .rf-node.n2{right:36px!important;top:82px!important}
${PAGE} .rf-node.n3{left:88px!important;bottom:32px!important}
${PAGE} .rf-network-copy strong{font-size:16px!important}
${PAGE} .rf-network-copy span{font-size:12px!important;line-height:1.45!important;margin-top:6px!important}
${PAGE} .rf-wave{height:42px!important;gap:4px!important}
${PAGE} .rf-feed-body{
  padding:15px 16px 16px!important;
  min-height:235px!important;
}
${PAGE} .rf-feed-body th{font-size:10.5px!important;padding:5px 9px!important}
${PAGE} .rf-feed-body td{font-size:12.5px!important;padding:11px 9px!important}
${PAGE} .rf-empty{
  min-height:205px!important;
  gap:19px!important;
  border-radius:16px!important;
}
${PAGE} .rf-empty-orbit{
  width:60px!important;
  height:60px!important;
  box-shadow:0 0 0 10px rgba(83,215,248,.028),0 0 0 20px rgba(83,215,248,.014)!important;
}
${PAGE} .rf-empty-copy strong{font-size:15px!important}
${PAGE} .rf-empty-copy span{font-size:11.5px!important;margin-top:6px!important}
${PAGE} .rf-routing-body{
  padding:16px 17px 18px!important;
  gap:11px!important;
}
${PAGE} .rf-route{
  grid-template-columns:12px minmax(0,1fr) auto!important;
  gap:11px!important;
  padding:13px 14px!important;
  border-radius:13px!important;
}
${PAGE} .rf-route i{width:9px!important;height:9px!important}
${PAGE} .rf-route b{font-size:13px!important}
${PAGE} .rf-route span{font-size:11px!important}
${PAGE} .rf-audience{
  padding:14px!important;
  border-radius:14px!important;
}
${PAGE} .rf-audience small{font-size:10.5px!important}
${PAGE} .rf-audience strong{font-size:13px!important;margin-top:4px!important}

@media(min-width:1700px){
  ${PAGE}>.rona-rs-root[data-kind="radio"]{max-width:1540px!important}
  ${PAGE} .rf-main,${PAGE} .rf-bottom{grid-template-columns:minmax(0,2.55fr) minmax(390px,.92fr)!important}
}
@media(max-width:1180px){
  ${PAGE}>.rona-rs-root[data-kind="radio"]{width:calc(100% - 24px)!important;max-width:none!important}
  ${PAGE} .rf-main,${PAGE} .rf-bottom{grid-template-columns:minmax(0,1fr) 320px!important;gap:12px!important}
  ${PAGE} .rf-radar{width:160px!important;height:160px!important}
  ${PAGE} .rf-network-body{min-height:325px!important}
}
@media(max-width:900px){
  ${PAGE} .rf-main,${PAGE} .rf-bottom{grid-template-columns:1fr!important}
  ${PAGE} .rf-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  ${PAGE} .rf-control-row{grid-template-columns:1fr!important}
  ${PAGE} .rf-network-body{min-height:280px!important}
}
`;
function install(){
  let s=document.getElementById(ID);
  if(!s){s=document.createElement('style');s.id=ID;s.textContent=css}
  if(document.head.lastElementChild!==s)document.head.appendChild(s);
  document.documentElement.dataset.ronaRadioVisual='wide-v10';
}
function refresh(){install();const legacy=document.getElementById('rona-admin-radio-final-v9-style');if(legacy&&document.head.lastElementChild!==document.getElementById(ID))install()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
[120,450,1200,2600].forEach(ms=>setTimeout(refresh,ms));
window.addEventListener('rona:admin-pagechange',e=>{if(String(e?.detail?.page||'')==='messages')[0,80,280,900].forEach(ms=>setTimeout(refresh,ms))},{passive:true});
const mo=new MutationObserver(()=>{if(document.getElementById('rona-admin-radio-final-v9-style'))refresh()});
mo.observe(document.head||document.documentElement,{childList:true});
})();
