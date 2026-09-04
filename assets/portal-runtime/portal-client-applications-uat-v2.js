(()=>{'use strict';
const MARK='20260904-portal-client-applications-uat-v2';
if(window.__RONA_PORTAL_CLIENT_APPLICATIONS_UAT_V2__===MARK)return;
window.__RONA_PORTAL_CLIENT_APPLICATIONS_UAT_V2__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api';
const REFRESH_MS=30000;
const state={apps:new Map(),loading:false,lastLoad:0,raf:0,timer:0,observer:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmt=v=>{const n=num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)};
function root(){return document.getElementById('page-applications')||document.getElementById('applicationsPage')||document.querySelector('[data-page-panel="applications"],[data-page-id="applications"]')}
function authority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const a=authority();if(!a)return null;return a.getCurrentContext?.()||await a.whenReady?.()||null}
async function request(path){const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const j=await r.json().catch(()=>null);if(!r.ok||j?.ok===false)throw new Error(String(j?.code||j?.error?.code||('HTTP_'+r.status)));return j}
function box(el){if(!el||!el.isConnected)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'?b:null}
function searchInput(r){return [...r.querySelectorAll('input')].find(el=>/ид заявки|товар|ид сделки/i.test(String(el.placeholder||'')))||null}
function statusSelect(r){return [...r.querySelectorAll('select')].find(el=>/все статусы/i.test(norm(el.textContent)))||null}
function resetButton(r){return [...r.querySelectorAll('button')].find(el=>/^сбросить$/iu.test(norm(el.textContent)))||null}
function titleFrameBox(r){
  const rr=box(r);if(!rr)return null;
  const heading=[...r.querySelectorAll('h1,h2,h3,[role="heading"]')].find(el=>norm(el.textContent)==='Заявки');
  const candidates=[];let n=heading?.parentElement||null;
  while(n&&n!==r){const b=box(n);if(b&&b.width>=480&&b.left>=rr.left+30&&b.right<=rr.right+4)candidates.push(b);n=n.parentElement}
  if(candidates.length)return candidates.sort((a,b)=>b.width-a.width)[0];
  const controls=[searchInput(r),statusSelect(r),resetButton(r)].map(box).filter(Boolean);
  if(!controls.length)return null;
  const left=Math.min(...controls.map(x=>x.left)),right=Math.max(...controls.map(x=>x.right)),top=Math.min(...controls.map(x=>x.top)),bottom=Math.max(...controls.map(x=>x.bottom));
  return{left,right,top,bottom,width:right-left,height:bottom-top,x:left,y:top,toJSON(){return{}}};
}
function align(){
  const r=root(),list=r?.querySelector('[data-rona-live-applications="v1"]');if(!r||!list)return false;
  const target=titleFrameBox(r),lb=box(list);if(!target||!lb)return false;
  const ml=parseFloat(getComputedStyle(list).marginLeft)||0,baseLeft=lb.left-ml,desired=Math.max(0,Math.round(target.left-baseLeft));
  list.style.boxSizing='border-box';
  list.style.marginLeft=`${desired}px`;
  list.style.marginRight='0';
  list.style.width=`${Math.round(target.width)}px`;
  list.style.maxWidth=`${Math.round(target.width)}px`;
  list.setAttribute('data-rona-canonical-frame','applications-title-frame');
  return true;
}
function ensureStyle(){
  if(document.getElementById('rona-portal-client-applications-uat-v2-style'))return;
  const s=document.createElement('style');s.id='rona-portal-client-applications-uat-v2-style';
  s.textContent=`
#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(0,1.25fr) minmax(70px,.42fr) minmax(90px,.52fr) minmax(120px,.70fr) minmax(105px,.68fr) minmax(128px,.78fr)!important;gap:12px!important}
#page-applications .rona-uat-app-price strong{white-space:nowrap}
#page-applications .rona-uat-app-actions{display:grid!important;grid-template-columns:1fr!important;gap:5px!important;justify-items:end!important;align-items:center!important}
#page-applications .rona-uat-resource-status{display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:0 9px;border-radius:999px;white-space:nowrap;font:800 9.5px/1 Inter,system-ui,sans-serif;letter-spacing:.01em}
#page-applications .rona-uat-resource-status[data-resource="RESOURCE_CONFIRMED"]{border:1px solid rgba(89,219,160,.32);background:rgba(28,119,82,.18);color:#c8f4dd}
#page-applications .rona-uat-resource-status[data-resource="RESOURCE_NOT_CONFIRMED"]{border:1px solid rgba(246,190,86,.30);background:rgba(128,83,18,.18);color:#f5dba4}
#page-applications .rona-uat-app-actions .rona-live-app-open{min-width:100%}
@media(max-width:1280px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(0,1.25fr) minmax(70px,.45fr) minmax(90px,.55fr) minmax(110px,.68fr) minmax(128px,.78fr)!important}.rona-live-app-destination{display:none!important}}
@media(max-width:900px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(0,1fr) minmax(80px,.45fr) minmax(95px,.55fr) minmax(128px,.78fr)!important}.rona-live-app-period{display:none!important}}
@media(max-width:700px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:1fr auto!important}.rona-live-app-qty,.rona-uat-app-price{display:none!important}}
`;
  document.head.appendChild(s);
}
function priceText(app){const p=app?.application_price,c=norm(app?.application_currency);return p==null?'—':`${fmt(p)}${c?' '+c:''}/т`}
function resourceStatus(app){return norm(app?.resource_status)==='RESOURCE_CONFIRMED'?'RESOURCE_CONFIRMED':'RESOURCE_NOT_CONFIRMED'}
function resourceLabel(app){return resourceStatus(app)==='RESOURCE_CONFIRMED'?'Ресурс подтвержден':'Ресурс не подтвержден'}
function detailByLabel(row,label){return [...row.querySelectorAll('.rona-live-app-detail')].find(el=>norm(el.querySelector('span')?.textContent).toLocaleLowerCase('ru-RU')===label.toLocaleLowerCase('ru-RU'))||null}
function patchRow(row,app){
  const main=row.querySelector('.rona-live-app-main');if(!main)return;
  let priceCell=main.querySelector('.rona-uat-app-price');
  if(!priceCell){priceCell=document.createElement('div');priceCell.className='rona-live-app-cell rona-uat-app-price';const qty=main.querySelector('.rona-live-app-qty');qty?.after(priceCell)}
  priceCell.innerHTML=`<span>Цена</span><strong>${priceText(app)}</strong>`;
  const open=main.querySelector('.rona-live-app-open'),actions=open?.parentElement;
  if(actions){actions.classList.add('rona-uat-app-actions');let res=actions.querySelector('.rona-uat-resource-status');if(!res){res=document.createElement('span');res.className='rona-uat-resource-status';open.before(res)}const code=resourceStatus(app);res.setAttribute('data-resource',code);res.textContent=resourceLabel(app)}
  const mode=detailByLabel(row,'Режим цены');if(mode){const label=mode.querySelector('span'),strong=mode.querySelector('strong');if(label)label.textContent='Цена';if(strong)strong.textContent=priceText(app)}
  const proposed=detailByLabel(row,'Предложенная цена');if(proposed){const label=proposed.querySelector('span'),strong=proposed.querySelector('strong');if(label)label.textContent='Подтверждение ресурса';if(strong)strong.textContent=resourceLabel(app)}
  row.setAttribute('data-resource-status',resourceStatus(app));
}
function patchRows(){const r=root();if(!r)return;for(const row of r.querySelectorAll('[data-rona-live-application-id]')){const app=state.apps.get(norm(row.getAttribute('data-rona-live-application-id')));if(app)patchRow(row,app)}}
function apply(){ensureStyle();align();patchRows()}
function schedule(){cancelAnimationFrame(state.raf);state.raf=requestAnimationFrame(apply)}
async function load(force=false){
  if(state.loading)return;const now=Date.now();if(!force&&now-state.lastLoad<REFRESH_MS-500){schedule();return}
  const ctx=await currentContext().catch(()=>null);if(!ctx?.client_id||!ctx?.contract_id)return;
  state.loading=true;
  try{const j=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));state.apps=new Map((Array.isArray(j?.data?.applications)?j.data.applications:[]).map(a=>[norm(a.application_id),a]));state.lastLoad=Date.now();schedule()}catch(e){console.error('RONA applications UAT v2',e)}finally{state.loading=false}
}
function start(){
  ensureStyle();load(true);schedule();
  state.observer=new MutationObserver(()=>schedule());state.observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('resize',schedule,{passive:true});window.addEventListener('pageshow',()=>{load(true);schedule()},{passive:true});
  window.addEventListener('rona:client-application-submitted',()=>setTimeout(()=>load(true),80));
  const a=authority();if(a?.subscribe)a.subscribe(()=>{state.apps.clear();state.lastLoad=0;load(true)});
  state.timer=setInterval(()=>load(true),REFRESH_MS);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
