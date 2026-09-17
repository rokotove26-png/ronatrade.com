export default `(()=>{'use strict';
if(window.__RONA_VISUAL_V2_ORIGINAL_BACKGROUND__)return;
window.__RONA_VISUAL_V2_ORIGINAL_BACKGROUND__=true;
function restoreOriginalBackground(){
  const style=document.getElementById('ronaVisualV2Style'),sheet=style?.sheet;
  if(!sheet)return false;
  let bodyRuleFound=false,overlayRuleRemoved=false;
  const rules=sheet.cssRules||[];
  for(let i=rules.length-1;i>=0;i--){
    const rule=rules[i],selector=String(rule?.selectorText||'');
    if(selector==='.rona-visual-v2 body'){rule.style.removeProperty('background');bodyRuleFound=true;continue}
    if(selector==='.rona-visual-v2 body::before'){sheet.deleteRule(i);overlayRuleRemoved=true}
  }
  window.__RONA_VISUAL_V2_ORIGINAL_BACKGROUND_READY__=bodyRuleFound&&overlayRuleRemoved;
  return window.__RONA_VISUAL_V2_ORIGINAL_BACKGROUND_READY__;
}
if(!restoreOriginalBackground()){
  const retry=()=>restoreOriginalBackground();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',retry,{once:true});
  queueMicrotask(retry);
  setTimeout(retry,0);
}

function ensureAccessPremiumStyle(){
  if(document.getElementById('ronaAccessPremiumStyle'))return;
  const s=document.createElement('style');
  s.id='ronaAccessPremiumStyle';
  s.textContent=`
#page-access.rona-access-premium{
  --acc-cyan:#68dcff;
  --acc-aqua:#59e3d2;
  --acc-green:#64dfa5;
  --acc-amber:#ffc96b;
  --acc-red:#ff7180;
  --acc-text:#eef7fc;
  --acc-muted:#8ca8ba;
  --acc-line:rgba(113,190,224,.16);
  --acc-line-strong:rgba(104,220,255,.34);
  --acc-panel:linear-gradient(155deg,rgba(8,23,37,.95),rgba(5,16,28,.91));
  --acc-panel-soft:linear-gradient(155deg,rgba(10,27,43,.84),rgba(6,18,31,.78));
  font-family:"Segoe UI Variable Text","Segoe UI",Inter,Arial,sans-serif!important;
  font-feature-settings:"tnum" 1;
  font-variant-numeric:tabular-nums;
}
#page-access.rona-access-premium .rona-owner-page-content{
  width:min(100%,1480px)!important;
  max-width:1480px!important;
  margin-left:auto!important;
  margin-right:auto!important;
  padding-bottom:34px!important;
}
#page-access.rona-access-premium .rona-access-metrics{
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:12px!important;
  margin:14px 0 12px!important;
}
#page-access.rona-access-premium .rona-access-metric{
  --acc-tone:var(--acc-cyan);
  position:relative!important;
  overflow:hidden!important;
  min-height:112px!important;
  padding:17px 18px 15px 20px!important;
  border:1px solid var(--acc-line)!important;
  border-radius:16px!important;
  background:var(--acc-panel)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 12px 30px rgba(0,0,0,.16)!important;
  transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease!important;
}
#page-access.rona-access-premium .rona-access-metric::before{
  content:""!important;
  position:absolute!important;
  left:0!important;
  top:13px!important;
  bottom:13px!important;
  width:3px!important;
  border-radius:0 4px 4px 0!important;
  background:var(--acc-tone)!important;
  box-shadow:0 0 18px var(--acc-tone)!important;
  opacity:.9!important;
}
#page-access.rona-access-premium .rona-access-metric::after{
  content:""!important;
  position:absolute!important;
  left:18px!important;
  right:18px!important;
  top:0!important;
  height:1px!important;
  background:linear-gradient(90deg,var(--acc-tone),transparent 72%)!important;
  opacity:.38!important;
}
#page-access.rona-access-premium .rona-access-metric[data-access-tone="companies"]{--acc-tone:var(--acc-cyan)}
#page-access.rona-access-premium .rona-access-metric[data-access-tone="agents"]{--acc-tone:var(--acc-aqua)}
#page-access.rona-access-premium .rona-access-metric[data-access-tone="linked"]{--acc-tone:var(--acc-green)}
#page-access.rona-access-premium .rona-access-metric[data-access-tone="active"]{--acc-tone:var(--acc-amber)}
#page-access.rona-access-premium .rona-access-metric:hover{
  transform:translateY(-2px)!important;
  border-color:color-mix(in srgb,var(--acc-tone) 45%,transparent)!important;
  background:linear-gradient(155deg,rgba(12,33,51,.97),rgba(6,19,32,.94))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 16px 36px rgba(0,0,0,.22),0 0 0 1px color-mix(in srgb,var(--acc-tone) 10%,transparent)!important;
}
#page-access.rona-access-premium .rona-access-metric>h2,
#page-access.rona-access-premium .rona-access-metric>h3{
  margin:0 0 12px!important;
  color:#9bb3c3!important;
  font-size:11px!important;
  line-height:1.2!important;
  font-weight:800!important;
  letter-spacing:.075em!important;
  text-transform:uppercase!important;
}
#page-access.rona-access-premium .rona-access-metric .rona-owner-kpi{
  margin:0 0 7px!important;
  color:var(--acc-text)!important;
  font-size:clamp(25px,2vw,34px)!important;
  line-height:1!important;
  font-weight:850!important;
  letter-spacing:-.035em!important;
}
#page-access.rona-access-premium .rona-access-metric .rona-owner-muted{
  color:#7690a2!important;
  font-size:10px!important;
  line-height:1.35!important;
}
#page-access.rona-access-premium .rona-access-controlbar{
  display:grid!important;
  grid-template-columns:minmax(280px,1fr) auto!important;
  align-items:center!important;
  gap:10px!important;
  margin:10px 0 12px!important;
  padding:8px!important;
  border:1px solid var(--acc-line)!important;
  border-radius:15px!important;
  background:linear-gradient(180deg,rgba(7,21,35,.93),rgba(5,16,28,.88))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 24px rgba(0,0,0,.11)!important;
}
#page-access.rona-access-premium .rona-access-controlbar input[type="search"],
#page-access.rona-access-premium .rona-access-controlbar input[type="text"]{
  width:100%!important;
  min-width:0!important;
  height:38px!important;
  margin:0!important;
  padding:0 13px!important;
  border:1px solid rgba(113,190,224,.13)!important;
  border-radius:10px!important;
  outline:none!important;
  background:rgba(4,14,25,.76)!important;
  color:#eaf5fb!important;
  font:inherit!important;
  font-size:11px!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.018)!important;
  transition:border-color .15s ease,box-shadow .15s ease,background .15s ease!important;
}
#page-access.rona-access-premium .rona-access-controlbar input:focus{
  border-color:rgba(104,220,255,.42)!important;
  background:rgba(6,19,32,.92)!important;
  box-shadow:0 0 0 3px rgba(104,220,255,.07)!important;
}
#page-access.rona-access-premium .rona-access-tabs{
  display:flex!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:5px!important;
  flex-wrap:wrap!important;
}
#page-access.rona-access-premium .rona-access-tab{
  min-height:34px!important;
  padding:0 11px!important;
  border:1px solid transparent!important;
  border-radius:9px!important;
  background:transparent!important;
  color:#91abba!important;
  font-size:10px!important;
  line-height:1!important;
  font-weight:780!important;
  box-shadow:none!important;
  transition:color .15s ease,border-color .15s ease,background .15s ease!important;
}
#page-access.rona-access-premium .rona-access-tab:hover{
  color:#eaf8ff!important;
  border-color:rgba(104,220,255,.18)!important;
  background:rgba(104,220,255,.055)!important;
}
#page-access.rona-access-premium .rona-access-tab.active,
#page-access.rona-access-premium .rona-access-tab[aria-pressed="true"],
#page-access.rona-access-premium .rona-access-tab[aria-current="page"]{
  color:#dff9ff!important;
  border-color:rgba(104,220,255,.32)!important;
  background:linear-gradient(180deg,rgba(44,133,177,.20),rgba(20,69,99,.16))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 18px rgba(104,220,255,.055)!important;
}
#page-access.rona-access-premium .rona-access-refresh{
  color:#b6cad7!important;
  border-color:rgba(113,190,224,.16)!important;
  background:rgba(14,34,51,.52)!important;
}
#page-access.rona-access-premium .rona-access-primary{
  min-height:36px!important;
  padding:0 14px!important;
  border:1px solid rgba(104,220,255,.28)!important;
  border-radius:10px!important;
  background:linear-gradient(145deg,rgba(23,91,128,.88),rgba(13,53,80,.90))!important;
  color:#f2fbff!important;
  font-size:10.5px!important;
  font-weight:820!important;
  letter-spacing:.015em!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 8px 20px rgba(0,0,0,.15)!important;
}
#page-access.rona-access-premium .rona-access-primary:hover{
  border-color:rgba(104,220,255,.50)!important;
  background:linear-gradient(145deg,rgba(29,112,154,.94),rgba(15,64,95,.94))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 10px 24px rgba(0,0,0,.20),0 0 20px rgba(104,220,255,.07)!important;
}
#page-access.rona-access-premium .rona-access-users-card,
#page-access.rona-access-premium .rona-access-agent-card{
  position:relative!important;
  overflow:hidden!important;
  margin-top:12px!important;
  padding:20px 20px 18px!important;
  border:1px solid rgba(113,190,224,.15)!important;
  border-radius:18px!important;
  background:var(--acc-panel)!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.028),0 16px 42px rgba(0,0,0,.18)!important;
}
#page-access.rona-access-premium .rona-access-users-card::before,
#page-access.rona-access-premium .rona-access-agent-card::before{
  content:""!important;
  position:absolute!important;
  left:20px!important;
  right:20px!important;
  top:0!important;
  height:1px!important;
  background:linear-gradient(90deg,var(--acc-cyan),rgba(89,227,210,.55),transparent 74%)!important;
  opacity:.42!important;
}
#page-access.rona-access-premium .rona-access-users-card>h2,
#page-access.rona-access-premium .rona-access-agent-card>h2{
  margin:0 0 17px!important;
  padding-right:180px!important;
  color:#f2f8fc!important;
  font-size:18px!important;
  line-height:1.2!important;
  font-weight:850!important;
  letter-spacing:-.02em!important;
}
#page-access.rona-access-premium .rona-access-users-card>.rona-access-primary{
  position:absolute!important;
  top:16px!important;
  right:20px!important;
}
#page-access.rona-access-premium .rona-owner-table-wrap{
  width:100%!important;
  overflow:auto!important;
  border:0!important;
  border-radius:14px!important;
  scrollbar-width:thin!important;
  scrollbar-color:rgba(104,220,255,.28) transparent!important;
}
#page-access.rona-access-premium .rona-owner-table{
  width:100%!important;
  min-width:1080px!important;
  border-collapse:separate!important;
  border-spacing:0 7px!important;
  table-layout:auto!important;
}
#page-access.rona-access-premium .rona-owner-table thead th{
  padding:0 12px 7px!important;
  border:0!important;
  background:transparent!important;
  color:#6f8da1!important;
  font-size:8.8px!important;
  line-height:1.2!important;
  font-weight:820!important;
  letter-spacing:.085em!important;
  text-transform:uppercase!important;
  white-space:nowrap!important;
}
#page-access.rona-access-premium .rona-owner-table tbody td{
  padding:11px 12px!important;
  border-top:1px solid rgba(113,190,224,.09)!important;
  border-bottom:1px solid rgba(113,190,224,.09)!important;
  background:linear-gradient(180deg,rgba(8,23,37,.76),rgba(6,18,31,.70))!important;
  color:#dceaf2!important;
  font-size:10.5px!important;
  line-height:1.35!important;
  vertical-align:middle!important;
  transition:background .14s ease,border-color .14s ease!important;
}
#page-access.rona-access-premium .rona-owner-table tbody td:first-child{
  border-left:1px solid rgba(113,190,224,.09)!important;
  border-radius:11px 0 0 11px!important;
  font-weight:790!important;
  color:#f0f7fb!important;
}
#page-access.rona-access-premium .rona-owner-table tbody td:last-child{
  border-right:1px solid rgba(113,190,224,.09)!important;
  border-radius:0 11px 11px 0!important;
}
#page-access.rona-access-premium .rona-owner-table tbody tr:hover td{
  border-color:rgba(104,220,255,.20)!important;
  background:linear-gradient(180deg,rgba(12,34,52,.88),rgba(8,24,39,.82))!important;
}
#page-access.rona-access-premium .rona-owner-table td .rona-owner-muted{
  margin-top:3px!important;
  color:#7893a6!important;
  font-size:9px!important;
  line-height:1.35!important;
}
#page-access.rona-access-premium .rona-owner-table td .badge,
#page-access.rona-access-premium .rona-owner-table td .pill,
#page-access.rona-access-premium .rona-owner-table td .rona-fin-pill{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  min-height:24px!important;
  padding:0 8px!important;
  border-radius:999px!important;
  font-size:8.8px!important;
  line-height:1!important;
  font-weight:820!important;
  letter-spacing:.035em!important;
}
#page-access.rona-access-premium .rona-owner-table td>.rona-owner-actions,
#page-access.rona-access-premium .rona-owner-table td .rona-owner-actions{
  display:flex!important;
  align-items:center!important;
  justify-content:flex-end!important;
  gap:6px!important;
  flex-wrap:wrap!important;
  min-width:220px!important;
}
#page-access.rona-access-premium .rona-owner-table button,
#page-access.rona-access-premium .rona-access-agent-card button{
  min-height:29px!important;
  padding:0 9px!important;
  border:1px solid rgba(113,190,224,.16)!important;
  border-radius:8px!important;
  background:rgba(11,31,48,.66)!important;
  color:#d8e7ef!important;
  font-size:9px!important;
  line-height:1!important;
  font-weight:760!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.025)!important;
  transition:border-color .14s ease,background .14s ease,color .14s ease!important;
}
#page-access.rona-access-premium .rona-owner-table button:hover,
#page-access.rona-access-premium .rona-access-agent-card button:hover{
  border-color:rgba(104,220,255,.32)!important;
  background:rgba(17,50,73,.78)!important;
  color:#f5fbff!important;
}
#page-access.rona-access-premium .rona-access-danger{
  border-color:rgba(255,113,128,.25)!important;
  background:rgba(105,24,35,.20)!important;
  color:#ffb4bd!important;
}
#page-access.rona-access-premium .rona-access-danger:hover{
  border-color:rgba(255,113,128,.46)!important;
  background:rgba(122,28,41,.30)!important;
  color:#ffd9de!important;
}
#page-access.rona-access-premium .rona-access-agent-card select{
  min-height:34px!important;
  padding:0 10px!important;
  border:1px solid rgba(113,190,224,.16)!important;
  border-radius:9px!important;
  background:rgba(6,18,31,.88)!important;
  color:#e7f1f7!important;
  font-size:10px!important;
}
#page-access.rona-access-premium .rona-access-agent-card select option{color:#111827!important;background:#fff!important}
@media(max-width:1180px){
  #page-access.rona-access-premium .rona-access-metrics{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  #page-access.rona-access-premium .rona-access-controlbar{grid-template-columns:1fr!important}
  #page-access.rona-access-premium .rona-access-tabs{justify-content:flex-start!important}
}
@media(max-width:680px){
  #page-access.rona-access-premium .rona-access-metrics{grid-template-columns:1fr!important}
  #page-access.rona-access-premium .rona-access-users-card,#page-access.rona-access-premium .rona-access-agent-card{padding:16px!important;border-radius:15px!important}
  #page-access.rona-access-premium .rona-access-users-card>h2,#page-access.rona-access-premium .rona-access-agent-card>h2{padding-right:0!important;margin-bottom:12px!important}
  #page-access.rona-access-premium .rona-access-users-card>.rona-access-primary{position:static!important;margin:0 0 12px!important}
}
@media(prefers-reduced-motion:reduce){
  #page-access.rona-access-premium .rona-access-metric,#page-access.rona-access-premium .rona-access-tab{transition:none!important}
  #page-access.rona-access-premium .rona-access-metric:hover{transform:none!important}
}`;
  document.head.appendChild(s);
}

const accessNorm=v=>String(v||'').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function decorateAccessPremium(){
  const page=document.getElementById('page-access');
  if(!page)return false;
  ensureAccessPremiumStyle();
  page.classList.add('rona-access-premium');
  const cards=Array.from(page.querySelectorAll('.rona-owner-card'));
  let metricParent=null;
  for(const card of cards){
    const heading=accessNorm(card.querySelector(':scope > h1,:scope > h2,:scope > h3')?.textContent);
    let tone='';
    if(heading==='компаний')tone='companies';
    else if(heading==='агентов')tone='agents';
    else if(heading==='с агентом')tone='linked';
    else if(heading==='активных доступов')tone='active';
    if(tone){card.classList.add('rona-access-metric');card.dataset.accessTone=tone;metricParent=card.parentElement}
    if(heading==='пользователи и доступы')card.classList.add('rona-access-users-card');
    if(heading==='закрепленный агент'||heading==='закреплённый агент')card.classList.add('rona-access-agent-card');
  }
  if(metricParent)metricParent.classList.add('rona-access-metrics');
  const buttons=Array.from(page.querySelectorAll('button'));
  const tabLabels=new Set(['компании','агенты','пользователи и доступы','история и права']);
  const tabs=[];
  for(const button of buttons){
    const label=accessNorm(button.textContent);
    if(tabLabels.has(label)){button.classList.add('rona-access-tab');tabs.push(button)}
    if(label==='обновить')button.classList.add('rona-access-tab','rona-access-refresh');
    if(label==='создать пользователя')button.classList.add('rona-access-primary');
    if(label==='заблокировать'||label==='отозвать')button.classList.add('rona-access-danger');
  }
  if(tabs.length){
    const tabParent=tabs[0].parentElement;
    if(tabParent)tabParent.classList.add('rona-access-tabs');
    let bar=tabParent;
    while(bar&&bar!==page&&!bar.querySelector('input'))bar=bar.parentElement;
    if(bar&&bar!==page)bar.classList.add('rona-access-controlbar');
  }
  window.__RONA_ACCESS_PREMIUM_PRESENTATION__='v1';
  return true;
}
let accessQueued=false;
function scheduleAccessPremium(){
  if(accessQueued)return;
  accessQueued=true;
  requestAnimationFrame(()=>{accessQueued=false;decorateAccessPremium()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleAccessPremium,{once:true});else scheduleAccessPremium();
window.addEventListener('rona:admin-pagechange',event=>{if(String(event?.detail?.page||'')==='access')scheduleAccessPremium()});
new MutationObserver(records=>{for(const record of records){if(record.addedNodes?.length){scheduleAccessPremium();break}}}).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(scheduleAccessPremium,350);
setTimeout(scheduleAccessPremium,1200);
})();`;
