const CSS=String.raw`
html.rona-visual-v2 body #page-claims>.rona-claims-r2-root{
  width:min(calc(100% - 36px),1360px)!important;
  max-width:1360px!important;
  margin:0 auto 34px!important;
  display:grid!important;
  gap:14px!important;
  container-type:inline-size;
}
html.rona-visual-v2 body #page-claims .rona-claims-r2-root .rona-owner-card{
  box-sizing:border-box!important;
  border:1px solid rgba(105,197,235,.16)!important;
  background:linear-gradient(155deg,rgba(8,24,39,.97),rgba(4,13,23,.985))!important;
  box-shadow:0 18px 44px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.025)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-kpis{
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:11px!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-kpi{
  --claim-accent:#59d8ff;
  --claim-glow:rgba(89,216,255,.24);
  position:relative!important;
  overflow:hidden!important;
  min-height:112px!important;
  padding:16px 17px 15px!important;
  border-radius:18px!important;
  display:flex!important;
  flex-direction:column!important;
  justify-content:space-between!important;
  background:radial-gradient(180px 100px at 100% 0,var(--claim-glow),transparent 72%),linear-gradient(150deg,rgba(7,27,43,.98),rgba(4,13,23,.98))!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-kpi:before{
  content:"";
  position:absolute;
  left:0;top:16px;bottom:16px;
  width:3px;border-radius:3px;
  background:var(--claim-accent);
  box-shadow:0 0 18px var(--claim-accent);
  opacity:.9;
}
html.rona-visual-v2 body #page-claims .rona-claims-kpi:nth-child(2){--claim-accent:#70a5ff;--claim-glow:rgba(112,165,255,.20)}
html.rona-visual-v2 body #page-claims .rona-claims-kpi:nth-child(3){--claim-accent:#ffd16a;--claim-glow:rgba(255,209,106,.17)}
html.rona-visual-v2 body #page-claims .rona-claims-kpi:nth-child(4){--claim-accent:#67f0b5;--claim-glow:rgba(103,240,181,.17)}
html.rona-visual-v2 body #page-claims .rona-claims-kpi:nth-child(5){--claim-accent:#ff6f86;--claim-glow:rgba(255,111,134,.16)}
html.rona-visual-v2 body #page-claims .rona-claims-kpi>h2{
  margin:0!important;
  padding-left:3px!important;
  font-size:13px!important;
  line-height:1.32!important;
  font-weight:800!important;
  color:rgba(203,225,237,.72)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-kpi .rona-owner-kpi{
  padding-left:3px!important;
  font-size:34px!important;
  line-height:.96!important;
  font-weight:900!important;
  letter-spacing:-.04em!important;
  color:#f7fcff!important;
  font-variant-numeric:tabular-nums!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-toolbar{
  display:grid!important;
  grid-template-columns:minmax(320px,1.75fr) repeat(3,minmax(145px,.72fr)) auto auto!important;
  gap:9px!important;
  align-items:center!important;
  padding:11px!important;
  border-radius:17px!important;
  border:1px solid rgba(98,188,227,.16)!important;
  background:linear-gradient(145deg,rgba(7,22,36,.97),rgba(4,13,23,.98))!important;
  box-shadow:0 15px 38px rgba(0,0,0,.16),inset 0 1px rgba(255,255,255,.025)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-toolbar input,
html.rona-visual-v2 body #page-claims .rona-claims-toolbar select,
html.rona-visual-v2 body #page-claims .rona-claims-toolbar button{
  min-width:0!important;
  min-height:44px!important;
  height:44px!important;
  border-radius:11px!important;
  font-size:13px!important;
  line-height:1.2!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-toolbar input,
html.rona-visual-v2 body #page-claims .rona-claims-toolbar select{
  padding:0 12px!important;
  border:1px solid rgba(108,188,221,.16)!important;
  background:rgba(2,11,19,.76)!important;
  color:#e8f3f8!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-toolbar input:focus,
html.rona-visual-v2 body #page-claims .rona-claims-toolbar select:focus{
  border-color:rgba(89,216,255,.48)!important;
  box-shadow:0 0 0 3px rgba(89,216,255,.06)!important;
  outline:none!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-toolbar button{
  padding:0 14px!important;
  white-space:nowrap!important;
  font-weight:800!important;
  border:1px solid rgba(106,186,221,.17)!important;
  background:rgba(14,42,60,.74)!important;
  color:#dbeaf1!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-toolbar .rona-claims-primary{
  padding:0 18px!important;
  border-color:rgba(89,216,255,.42)!important;
  background:linear-gradient(115deg,#1e79b8,#2f9bd5)!important;
  color:white!important;
  box-shadow:0 10px 24px rgba(31,133,191,.18)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-toolbar button:hover{filter:brightness(1.08)!important}
html.rona-visual-v2 body #page-claims .rona-claims-work{
  display:grid!important;
  grid-template-columns:minmax(0,2.08fr) minmax(340px,.82fr)!important;
  gap:16px!important;
  align-items:start!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-registry{
  min-width:0!important;
  min-height:0!important;
  padding:18px!important;
  border-radius:20px!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-registry>h2,
html.rona-visual-v2 body #page-claims .rona-claims-side>.rona-owner-card>h2{
  margin:0 0 15px!important;
  font-size:17px!important;
  line-height:1.25!important;
  font-weight:900!important;
  letter-spacing:-.015em!important;
  color:#f0f8fc!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-registry>h2:after,
html.rona-visual-v2 body #page-claims .rona-claims-side>.rona-owner-card>h2:after{
  content:"";
  display:block;
  width:42px;height:2px;
  margin-top:9px;
  border-radius:2px;
  background:linear-gradient(90deg,#59d8ff,rgba(89,216,255,0));
}
html.rona-visual-v2 body #page-claims .rona-claims-table{
  margin:0!important;
  overflow:auto!important;
  border:1px solid rgba(101,181,215,.10)!important;
  border-radius:14px!important;
  background:rgba(2,10,18,.34)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-table table{
  min-width:900px!important;
  width:100%!important;
  border-collapse:separate!important;
  border-spacing:0!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-table th{
  padding:11px 10px!important;
  position:sticky!important;
  top:0!important;
  z-index:2!important;
  background:rgba(5,18,30,.98)!important;
  border-bottom:1px solid rgba(103,190,226,.12)!important;
  font-size:10px!important;
  line-height:1.25!important;
  font-weight:850!important;
  letter-spacing:.06em!important;
  text-transform:uppercase!important;
  color:rgba(143,184,205,.66)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-table td{
  padding:12px 10px!important;
  border-bottom:1px solid rgba(103,180,214,.07)!important;
  font-size:12.5px!important;
  line-height:1.42!important;
  color:#d9e8ef!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-table tbody tr[data-claim-id]{transition:background .14s ease,box-shadow .14s ease!important}
html.rona-visual-v2 body #page-claims .rona-claims-table tbody tr[data-claim-id]:hover{background:rgba(89,216,255,.035)!important}
html.rona-visual-v2 body #page-claims .rona-claims-table tbody tr[data-selected="true"]{
  background:linear-gradient(90deg,rgba(89,216,255,.10),rgba(89,216,255,.025))!important;
  box-shadow:inset 3px 0 0 #59d8ff!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-mainline{font-size:13px!important;font-weight:850!important;color:#eff8fc!important}
html.rona-visual-v2 body #page-claims .rona-claims-subline{margin-top:4px!important;font-size:11.5px!important;line-height:1.35!important;color:rgba(154,188,206,.64)!important}
html.rona-visual-v2 body #page-claims .rona-claims-side{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:12px!important;
  min-width:0!important;
  align-content:start!important;
  position:sticky!important;
  top:14px!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-side>.rona-owner-card{
  width:100%!important;
  max-width:none!important;
  min-height:0!important;
  padding:17px!important;
  border-radius:18px!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-meta{gap:9px!important}
html.rona-visual-v2 body #page-claims .rona-claims-meta-row{
  grid-template-columns:120px minmax(0,1fr)!important;
  gap:11px!important;
  padding:7px 0!important;
  border-bottom:1px solid rgba(100,177,211,.07)!important;
  font-size:12.5px!important;
  line-height:1.42!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-meta-row>span:first-child{color:rgba(145,180,199,.62)!important}
html.rona-visual-v2 body #page-claims .rona-claims-docs{gap:7px!important;margin-top:12px!important}
html.rona-visual-v2 body #page-claims .rona-claims-docs button,
html.rona-visual-v2 body #page-claims .rona-claims-detail button,
html.rona-visual-v2 body #page-claims .rona-claims-flow button{
  min-height:38px!important;
  padding:8px 11px!important;
  border-radius:10px!important;
  border:1px solid rgba(97,185,222,.15)!important;
  background:rgba(9,31,46,.72)!important;
  color:#dcebf2!important;
  font-size:12px!important;
  font-weight:750!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-detail{gap:11px!important}
html.rona-visual-v2 body #page-claims .rona-claims-detail label{gap:6px!important;font-size:12.5px!important;color:#dfeef4!important}
html.rona-visual-v2 body #page-claims .rona-claims-detail small{font-size:11.5px!important;line-height:1.45!important;color:rgba(149,184,203,.66)!important}
html.rona-visual-v2 body #page-claims .rona-claims-legal-head,
html.rona-visual-v2 body #page-claims .rona-claims-response-head{
  padding-bottom:10px!important;
  border-bottom:1px solid rgba(98,181,217,.10)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-legal-copy{gap:10px!important;font-size:12.5px!important;line-height:1.52!important}
html.rona-visual-v2 body #page-claims .rona-claims-flow{
  gap:12px!important;
  font-size:12.5px!important;
  line-height:1.5!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-flow ol{
  list-style:none!important;
  counter-reset:claim-step!important;
  display:grid!important;
  gap:0!important;
  margin:2px 0 4px!important;
  padding:0!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-flow ol>li{
  counter-increment:claim-step!important;
  position:relative!important;
  min-height:42px!important;
  padding:4px 0 12px 38px!important;
  color:#d8e7ee!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-flow ol>li:before{
  content:counter(claim-step)!important;
  position:absolute!important;
  left:0;top:0!important;
  width:25px;height:25px!important;
  display:grid!important;
  place-items:center!important;
  border-radius:8px!important;
  border:1px solid rgba(89,216,255,.26)!important;
  background:rgba(89,216,255,.07)!important;
  color:#91e9ff!important;
  font-size:11px!important;
  font-weight:900!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-flow ol>li:not(:last-child):after{
  content:""!important;
  position:absolute!important;
  left:12px;top:27px;bottom:0!important;
  width:1px!important;
  background:linear-gradient(#59d8ff,rgba(89,216,255,.05))!important;
  opacity:.35!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-flow-note{
  padding:11px 12px!important;
  border-radius:11px!important;
  border:1px solid rgba(255,209,106,.16)!important;
  background:rgba(255,209,106,.035)!important;
  color:rgba(212,224,229,.75)!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-empty{
  min-height:180px!important;
  padding:28px 20px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  border:1px dashed rgba(94,188,225,.14)!important;
  border-radius:14px!important;
  background:radial-gradient(320px 120px at 50% 100%,rgba(89,216,255,.05),transparent 72%)!important;
  color:rgba(145,180,199,.66)!important;
  font-size:12.5px!important;
  line-height:1.5!important;
}
html.rona-visual-v2 body #page-claims .rona-claims-side .rona-claims-empty{min-height:104px!important;padding:18px 14px!important}
html.rona-visual-v2 body #page-claims .rona-claims-action-row{grid-template-columns:1fr 1fr!important;gap:8px!important}
html.rona-visual-v2 body #page-claims .rona-claims-divider{margin:5px 0!important;background:rgba(98,181,217,.10)!important}
.rona-claims-modal-backdrop{
  padding:22px!important;
  background:rgba(0,4,9,.72)!important;
  backdrop-filter:blur(7px)!important;
}
.rona-claims-modal{
  width:min(900px,calc(100vw - 44px))!important;
  max-height:calc(100vh - 44px)!important;
  padding:0!important;
  gap:0!important;
  border:1px solid rgba(101,190,228,.20)!important;
  border-radius:22px!important;
  overflow:auto!important;
  background:linear-gradient(155deg,rgba(7,22,36,.995),rgba(3,12,21,.995))!important;
  box-shadow:0 34px 100px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.025)!important;
}
.rona-claims-modal-head{padding:20px 22px 17px!important;border-bottom:1px solid rgba(99,185,221,.11)!important}
.rona-claims-modal-head h2{font-size:21px!important;letter-spacing:-.02em!important}
.rona-claims-modal-note{margin:16px 22px 0!important;padding:11px 13px!important;border-radius:11px!important;background:rgba(89,216,255,.035)!important}
.rona-claims-form-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:13px 15px!important;padding:17px 22px 0!important}
.rona-claims-form-grid .full{grid-column:1/-1!important}
.rona-claims-form-grid label{font-size:12.5px!important;gap:7px!important}
.rona-claims-form-grid input,.rona-claims-form-grid select,.rona-claims-form-grid textarea{border-radius:11px!important;background:rgba(2,10,18,.78)!important;border-color:rgba(103,183,218,.16)!important}
.rona-claims-modal-actions{padding:18px 22px 22px!important;margin-top:16px!important;border-top:1px solid rgba(99,185,221,.10)!important}
@container(max-width:1080px){
  html.rona-visual-v2 body #page-claims .rona-claims-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  html.rona-visual-v2 body #page-claims .rona-claims-toolbar{grid-template-columns:1.5fr repeat(2,1fr)!important}
  html.rona-visual-v2 body #page-claims .rona-claims-toolbar>input{grid-column:1/-1!important}
  html.rona-visual-v2 body #page-claims .rona-claims-work{grid-template-columns:1fr!important}
  html.rona-visual-v2 body #page-claims .rona-claims-side{position:static!important;grid-template-columns:repeat(2,minmax(0,1fr))!important}
  html.rona-visual-v2 body #page-claims .rona-claims-side>.rona-claims-detail-card{grid-column:1/-1!important}
}
@container(max-width:700px){
  html.rona-visual-v2 body #page-claims>.rona-claims-r2-root{width:calc(100% - 16px)!important}
  html.rona-visual-v2 body #page-claims .rona-claims-kpis{grid-template-columns:1fr!important}
  html.rona-visual-v2 body #page-claims .rona-claims-toolbar{grid-template-columns:1fr!important}
  html.rona-visual-v2 body #page-claims .rona-claims-toolbar>*{width:100%!important;grid-column:auto!important}
  html.rona-visual-v2 body #page-claims .rona-claims-side{grid-template-columns:1fr!important}
  html.rona-visual-v2 body #page-claims .rona-claims-action-row,.rona-claims-form-grid{grid-template-columns:1fr!important}
  .rona-claims-form-grid .full{grid-column:auto!important}
}
`;

const SCRIPT=String.raw`(()=>{'use strict';
if(window.__RONA_CLAIMS_VISUAL_V500__)return;
window.__RONA_CLAIMS_VISUAL_V500__='20260915-executive-workflow-v1';
const q=(s,r=document)=>r.querySelector(s);
function apply(){
  q('#ronaClaimsV455Style')?.remove();
  let s=q('#ronaClaimsApprovedV500Style');
  if(!s){s=document.createElement('style');s.id='ronaClaimsApprovedV500Style'}
  s.textContent=${JSON.stringify(CSS)};
  document.head.append(s);
  const root=q('#page-claims>.rona-claims-r2-root');
  if(root)root.dataset.claimsVisual='executive-workflow-v1';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
window.addEventListener('rona:admin-pagechange',e=>{if(e.detail?.page==='claims')setTimeout(apply,50)});
setTimeout(apply,900);
})();`;

export async function onRequest(){return new Response(SCRIPT,{status:200,headers:{
  'content-type':'application/javascript; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'x-rona-claims-visual':'approved-v5.0.0'
}})}
