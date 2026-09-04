(()=>{'use strict';
const MARK='20260904-portal-client-applications-uat-v3-deterministic';
if(window.__RONA_PORTAL_CLIENT_APPLICATIONS_UAT_V3__===MARK)return;
window.__RONA_PORTAL_CLIENT_APPLICATIONS_UAT_V3__=MARK;
if(!/^\/portal\/client\/?$/.test(location.pathname))return;

const API='/portal/api';
const FAST_RETRY_MS=500;
const FAST_RETRY_COUNT=24;
const REFRESH_MS=30000;
const state={apps:new Map(),loading:false,raf:0,fastTimer:0,refreshTimer:0,fastAttempts:0,observer:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmt=v=>{const n=num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n)};

function root(){return document.getElementById('page-applications')||document.getElementById('applicationsPage')||document.querySelector('[data-page-panel="applications"],[data-page-id="applications"]')}
function authority(){return window.RONA_CLIENT_CONTEXT||null}
function currentContext(){const a=authority();return a?.getCurrentContext?.()||null}
async function request(path){const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const j=await r.json().catch(()=>null);if(!r.ok||j?.ok===false)throw new Error(String(j?.code||j?.error?.code||('HTTP_'+r.status)));return j}
function box(el){if(!el||!el.isConnected)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'?b:null}
function searchInput(r){return [...r.querySelectorAll('input')].find(el=>/ид заявки|товар|ид сделки/i.test(String(el.placeholder||'')))||null}
function statusSelect(r){return [...r.querySelectorAll('select')].find(el=>/все статусы/i.test(norm(el.textContent)))||null}
function resetButton(r){return [...r.querySelectorAll('button')].find(el=>/^сбросить$/iu.test(norm(el.textContent)))||null}
function combinedBox(rects){const list=rects.filter(Boolean);if(!list.length)return null;const left=Math.min(...list.map(x=>x.left)),right=Math.max(...list.map(x=>x.right)),top=Math.min(...list.map(x=>x.top)),bottom=Math.max(...list.map(x=>x.bottom));return{left,right,top,bottom,width:right-left,height:bottom-top}}
function frameBox(r){
  const rb=box(r);if(!rb)return null;
  const controlBox=combinedBox([box(searchInput(r)),box(statusSelect(r)),box(resetButton(r))]);
  const heading=[...r.querySelectorAll('h1,h2,h3,[role="heading"]')].find(el=>norm(el.textContent)==='Заявки');
  const candidates=[];let node=heading?.parentElement||null;
  for(let i=0;node&&node!==r&&i<7;i++,node=node.parentElement){const b=box(node);if(b&&b.width>=480&&b.left>=rb.left-2&&b.right<=rb.right+2)candidates.push(b)}
  if(controlBox&&candidates.length){
    candidates.sort((a,b)=>(Math.abs(a.left-controlBox.left)+Math.abs(a.right-controlBox.right))-(Math.abs(b.left-controlBox.left)+Math.abs(b.right-controlBox.right)));
    const best=candidates[0];
    if(Math.abs(best.left-controlBox.left)<=36&&Math.abs(best.right-controlBox.right)<=36)return best;
  }
  return controlBox||candidates[0]||null;
}
function align(){
  const r=root(),list=r?.querySelector('[data-rona-live-applications="v1"]');if(!r||!list)return false;
  const rb=box(r),target=frameBox(r);if(!rb||!target)return false;
  const left=Math.max(0,Math.round(target.left-rb.left)),width=Math.max(260,Math.round(target.width));
  list.style.boxSizing='border-box';list.style.marginLeft=`${left}px`;list.style.marginRight='0';list.style.width=`${width}px`;list.style.maxWidth=`calc(100% - ${left}px)`;
  list.setAttribute('data-rona-canonical-frame','applications-title-frame-v3');
  return true;
}
function priceText(app){const p=num(app?.application_price),c=norm(app?.application_currency);return p===null?'—':`${fmt(p)}${c?' '+c:''}/т`}
function resourceCode(app){return norm(app?.resource_status).toUpperCase()==='RESOURCE_CONFIRMED'?'RESOURCE_CONFIRMED':'RESOURCE_NOT_CONFIRMED'}
function resourceLabel(app){return resourceCode(app)==='RESOURCE_CONFIRMED'?'Ресурс подтвержден':'Ресурс не подтвержден'}
function detailByLabel(row,label){return [...row.querySelectorAll('.rona-live-app-detail')].find(el=>norm(el.querySelector('span')?.textContent).toLocaleLowerCase('ru-RU')===label.toLocaleLowerCase('ru-RU'))||null}
function patchRow(row,app){
  const main=row.querySelector('.rona-live-app-main');if(!main)return;
  let priceCell=main.querySelector('.rona-uat-v3-price');
  if(!priceCell){priceCell=document.createElement('div');priceCell.className='rona-live-app-cell rona-uat-v3-price';const qty=main.querySelector('.rona-live-app-qty');qty?.after(priceCell)}
  priceCell.innerHTML=`<span>Цена</span><strong>${priceText(app)}</strong>`;
  const open=main.querySelector('.rona-live-app-open'),actions=open?.parentElement;
  if(actions){actions.classList.add('rona-uat-v3-actions');let res=actions.querySelector('.rona-uat-v3-resource');if(!res){res=document.createElement('span');res.className='rona-uat-v3-resource';open.before(res)}const code=resourceCode(app);res.dataset.resource=code;res.textContent=resourceLabel(app)}
  const mode=detailByLabel(row,'Режим цены')||detailByLabel(row,'Цена');
  if(mode){const label=mode.querySelector('span'),strong=mode.querySelector('strong');if(label)label.textContent='Цена заявки';if(strong)strong.textContent=priceText(app)}
  const proposed=detailByLabel(row,'Предложенная цена')||detailByLabel(row,'Подтверждение ресурса');
  if(proposed){const label=proposed.querySelector('span'),strong=proposed.querySelector('strong');if(label)label.textContent='Подтверждение ресурса';if(strong)strong.textContent=resourceLabel(app)}
  for(const el of row.querySelectorAll('strong,span'))if(norm(el.textContent)==='ACCEPT_PUBLISHED_PRICE')el.textContent=priceText(app);
  row.dataset.resourceStatus=resourceCode(app);
}
function patchRows(){const r=root();if(!r)return false;for(const row of r.querySelectorAll('[data-rona-live-application-id]')){const id=norm(row.getAttribute('data-rona-live-application-id')),app=state.apps.get(id);if(app)patchRow(row,app)}align();return true}
function ensureStyle(){
  if(document.getElementById('rona-portal-client-applications-uat-v3-style'))return;
  const s=document.createElement('style');s.id='rona-portal-client-applications-uat-v3-style';s.textContent=`
#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(0,1.22fr) minmax(72px,.42fr) minmax(96px,.52fr) minmax(116px,.68fr) minmax(116px,.70fr) minmax(144px,.82fr)!important;gap:12px!important}
#page-applications .rona-uat-v3-price strong{white-space:nowrap}
#page-applications .rona-uat-v3-actions{display:grid!important;grid-template-columns:1fr!important;gap:5px!important;justify-items:stretch!important;align-items:center!important;min-width:144px}
#page-applications .rona-uat-v3-resource{display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:0 9px;border-radius:999px;white-space:nowrap;font:800 9.5px/1 Inter,system-ui,sans-serif;letter-spacing:.01em}
#page-applications .rona-uat-v3-resource[data-resource="RESOURCE_CONFIRMED"]{border:1px solid rgba(89,219,160,.34);background:rgba(28,119,82,.20);color:#c8f4dd}
#page-applications .rona-uat-v3-resource[data-resource="RESOURCE_NOT_CONFIRMED"]{border:1px solid rgba(246,190,86,.32);background:rgba(128,83,18,.20);color:#f5dba4}
#page-applications .rona-uat-v3-actions .rona-live-app-open{width:100%}
@media(max-width:1280px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(0,1.22fr) minmax(72px,.44fr) minmax(96px,.54fr) minmax(116px,.68fr) minmax(144px,.82fr)!important}.rona-live-app-destination{display:none!important}}
@media(max-width:900px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(0,1fr) minmax(82px,.46fr) minmax(98px,.56fr) minmax(144px,.82fr)!important}.rona-live-app-period{display:none!important}}
@media(max-width:700px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:1fr auto!important}.rona-live-app-qty,.rona-uat-v3-price{display:none!important}}
`;
  document.head.appendChild(s);
}
function schedule(){cancelAnimationFrame(state.raf);state.raf=requestAnimationFrame(()=>{ensureStyle();patchRows()})}
async function refresh(){
  if(state.loading)return false;const ctx=currentContext();if(!ctx?.client_id||!ctx?.contract_id)return false;
  state.loading=true;
  try{const j=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));state.apps=new Map((Array.isArray(j?.data?.applications)?j.data.applications:[]).map(a=>[norm(a.application_id),a]));schedule();return true}catch(e){console.error('RONA applications UAT v3',e);return false}finally{state.loading=false}
}
function start(){
  ensureStyle();schedule();refresh();
  state.observer=new MutationObserver(schedule);state.observer.observe(document.documentElement,{childList:true,subtree:true});
  state.fastTimer=setInterval(async()=>{state.fastAttempts++;const ok=await refresh();schedule();if(ok||state.fastAttempts>=FAST_RETRY_COUNT){clearInterval(state.fastTimer);state.fastTimer=0}},FAST_RETRY_MS);
  state.refreshTimer=setInterval(refresh,REFRESH_MS);
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('pageshow',()=>{refresh();schedule()},{passive:true});
  window.addEventListener('rona:client-application-submitted',()=>{setTimeout(refresh,80);setTimeout(refresh,700)});
  document.addEventListener('click',()=>setTimeout(schedule,0),true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
