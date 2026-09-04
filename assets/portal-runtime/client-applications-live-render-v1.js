(()=>{'use strict';
const MARK='20260904-client-applications-live-render-v1';
if(window.__RONA_CLIENT_APPLICATIONS_LIVE_RENDER__===MARK)return;
window.__RONA_CLIENT_APPLICATIONS_LIVE_RENDER__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api';
const REFRESH_MS=30000;
const TERMINAL=new Set(['DEAL_REGISTERED','ARCHIVED','CANCELLED','REJECTED','CLOSED']);
const STATUS_LABELS=Object.freeze({
  DRAFT:'Черновик',
  SUBMITTED:'Подана',
  UNDER_REVIEW:'На рассмотрении',
  ACCEPTED_AWAITING_DEAL_REGISTRATION:'Принята',
  DEAL_REGISTERED:'Сделка зарегистрирована',
  REJECTED:'Отклонена',
  CANCELLED:'Отменена',
  CLOSED:'Закрыта'
});
const state={apps:[],contextKey:'',loading:false,lastLoad:0,timer:0,unsubscribe:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmtNumber=v=>{const n=num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n)};
const fmtDate=v=>{const s=String(v||'');const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:s||'—'};
const fmtDateTime=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)};
const statusCode=a=>norm(a?.status).toUpperCase();
const statusLabel=a=>STATUS_LABELS[statusCode(a)]||norm(a?.status)||'Статус уточняется';
const resourceCode=a=>norm(a?.resource_status).toUpperCase()==='RESOURCE_CONFIRMED'||['ACCEPTED_AWAITING_DEAL_REGISTRATION','DEAL_REGISTERED'].includes(statusCode(a))?'RESOURCE_CONFIRMED':'RESOURCE_NOT_CONFIRMED';
const resourceLabel=a=>resourceCode(a)==='RESOURCE_CONFIRMED'?'Ресурс подтвержден':'Ресурс не подтвержден';
const priceText=a=>{const p=a?.application_price??a?.proposed_price;const c=norm(a?.application_currency||a?.proposed_currency||'USD');return p==null?'—':`${fmtNumber(p)} ${c}/т`};
const isActive=a=>!TERMINAL.has(statusCode(a))&&!norm(a?.deal_id);
const contextKey=ctx=>`${norm(ctx?.client_id)}|${norm(ctx?.contract_id)}`;
function authority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const a=authority();if(!a)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');return a.getCurrentContext?.()||await a.whenReady?.()}
async function request(path){const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const j=await r.json().catch(()=>null);if(!r.ok||j?.ok===false)throw new Error(String(j?.code||j?.error?.code||('HTTP_'+r.status)));return j}

function root(){
  return document.getElementById('page-applications')||
    document.getElementById('applicationsPage')||
    document.querySelector('[data-page-panel="applications"],[data-page-id="applications"]');
}
function searchInput(r){return [...r.querySelectorAll('input')].find(el=>/ид заявки|товар|ид сделки/i.test(String(el.placeholder||'')))||null}
function statusSelect(r){return [...r.querySelectorAll('select')].find(el=>/все статусы/i.test(norm(el.textContent)))||null}
function directChildContaining(r,el){
  if(!el)return null;let node=el;
  while(node&&node.parentElement&&node.parentElement!==r)node=node.parentElement;
  return node&&node.parentElement===r?node:null;
}
function ensureStyle(){
  if(document.getElementById('rona-client-applications-live-render-v1-style'))return;
  const s=document.createElement('style');s.id='rona-client-applications-live-render-v1-style';
  s.textContent=`
#page-applications [data-rona-live-applications="v1"]{position:relative;z-index:2;display:grid;gap:12px;margin:18px 0 30px;padding:0;max-width:none;box-sizing:border-box}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-row{border:1px solid rgba(93,170,211,.20);border-radius:10px;background:linear-gradient(145deg,rgba(7,25,39,.92),rgba(5,17,29,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 28px rgba(0,0,0,.14);overflow:hidden}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{display:grid;grid-template-columns:minmax(105px,1.20fr) 46px 66px 88px minmax(80px,.85fr) minmax(310px,1.90fr);align-items:center;gap:7px;min-height:72px;padding:13px 10px;box-sizing:border-box}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-id{font:800 12.5px/1.2 Inter,system-ui,sans-serif;letter-spacing:.025em;color:#7fdcff;margin-bottom:6px;white-space:nowrap}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-product{font:760 14px/1.3 Inter,system-ui,sans-serif;color:#f2f7fa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-cell{min-width:0}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-cell span{display:block;margin-bottom:5px;color:#7592a2;font:700 10.5px/1.1 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.055em}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-cell strong{display:block;min-width:0;color:#dce9ef;font:750 13px/1.3 Inter,system-ui,sans-serif}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-period strong,#page-applications [data-rona-live-applications="v1"] .rona-live-app-destination strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;min-width:0;white-space:nowrap}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-state{display:flex;align-items:center;justify-content:flex-end;gap:9px;min-width:0;white-space:nowrap}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-status,#page-applications [data-rona-live-applications="v1"] .rona-resource-status{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:27px;padding:0 9px;border-radius:999px;font:800 11.5px/1 Inter,system-ui,sans-serif;white-space:nowrap}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-status{border:1px solid rgba(102,219,177,.25);background:rgba(37,119,91,.14);color:#c2efd9}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-status:before,#page-applications [data-rona-live-applications="v1"] .rona-resource-status:before{content:'';width:6px;height:6px;flex:0 0 6px;border-radius:50%}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-status:before{background:#65c99c;box-shadow:0 0 0 3px rgba(101,201,156,.10)}
#page-applications [data-rona-live-applications="v1"] .rona-resource-status{border:1px solid rgba(218,174,89,.24);background:rgba(125,86,24,.12);color:#e4ca98}
#page-applications [data-rona-live-applications="v1"] .rona-resource-status:before{background:#d0a453;box-shadow:0 0 0 3px rgba(208,164,83,.09)}
#page-applications [data-rona-live-applications="v1"] .rona-resource-status[data-resource="RESOURCE_CONFIRMED"]{border-color:rgba(102,219,177,.25);background:rgba(37,119,91,.14);color:#c2efd9}
#page-applications [data-rona-live-applications="v1"] .rona-resource-status[data-resource="RESOURCE_CONFIRMED"]:before{background:#65c99c;box-shadow:0 0 0 3px rgba(101,201,156,.10)}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-open{min-height:34px;padding:0 12px;border:1px solid rgba(101,217,255,.30);border-radius:8px;background:rgba(29,91,116,.28);color:#eaf8fc;font:800 11.5px/1 Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-open:hover{background:rgba(42,123,155,.36);border-color:rgba(101,217,255,.48)}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-open:focus-visible{outline:2px solid rgba(101,217,255,.72);outline-offset:2px}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:14px 16px 16px;border-top:1px solid rgba(93,170,211,.13);background:rgba(3,13,22,.34)}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-details[hidden]{display:none!important}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-detail{padding:10px 11px;border:1px solid rgba(93,170,211,.10);border-radius:8px;background:rgba(8,26,40,.45)}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-detail span{display:block;margin-bottom:4px;color:#6f8d9d;font:700 10.5px/1.1 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.05em}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-detail strong{display:block;color:#d9e8ef;font:700 13px/1.4 Inter,system-ui,sans-serif;overflow-wrap:anywhere}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-empty{padding:36px 18px;text-align:center;border:1px dashed rgba(93,170,211,.22);border-radius:10px;color:#8ba4b1;background:rgba(5,18,30,.45);font:700 13px/1.5 Inter,system-ui,sans-serif}
@media(max-width:1280px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(120px,1.1fr) 52px 72px 96px minmax(270px,1.7fr)}#page-applications [data-rona-live-applications="v1"] .rona-live-app-destination{display:none}}
@media(max-width:980px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(130px,1fr) 60px 82px minmax(260px,1.5fr)}#page-applications [data-rona-live-applications="v1"] .rona-live-app-period{display:none}}
@media(max-width:760px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:1fr;gap:11px;padding:14px}#page-applications [data-rona-live-applications="v1"] .rona-live-app-qty,#page-applications [data-rona-live-applications="v1"] .rona-live-app-price{display:none}#page-applications [data-rona-live-applications="v1"] .rona-live-app-actions{justify-content:flex-start;flex-wrap:wrap}#page-applications [data-rona-live-applications="v1"] .rona-live-app-state{justify-content:flex-start;flex-wrap:wrap}#page-applications [data-rona-live-applications="v1"] .rona-live-app-details{grid-template-columns:1fr}}
`;
  document.head.appendChild(s);
}
function ensureList(r){
  let list=r.querySelector('[data-rona-live-applications="v1"]');
  if(list)return list;
  list=document.createElement('section');list.setAttribute('data-rona-live-applications','v1');list.setAttribute('aria-live','polite');
  const anchor=directChildContaining(r,searchInput(r));
  if(anchor?.nextSibling)r.insertBefore(list,anchor.nextSibling);else if(anchor)r.appendChild(list);else r.appendChild(list);
  return list;
}
function updateCounter(r,count){
  for(const el of r.querySelectorAll('*')){
    if(el.closest('[data-rona-live-applications="v1"]'))continue;
    if(el.childElementCount===0&&/^\d+\s+зарегистрировано$/iu.test(norm(el.textContent)))el.textContent=`${count} зарегистрировано`;
  }
}
function currentFilter(r){
  const q=norm(searchInput(r)?.value).toLocaleLowerCase('ru-RU');
  const sel=statusSelect(r),raw=norm(sel?.value||sel?.selectedOptions?.[0]?.textContent||'');
  const status=/все статусы/i.test(raw)?'':raw.toLocaleLowerCase('ru-RU');
  return{q,status};
}
function matches(app,filter){
  if(filter.q){
    const hay=[app.application_id,app.product,app.destination,app.deal_id,statusLabel(app),resourceLabel(app),priceText(app)].map(norm).join(' ').toLocaleLowerCase('ru-RU');
    if(!hay.includes(filter.q))return false;
  }
  if(filter.status){
    const code=statusCode(app).toLocaleLowerCase('ru-RU'),label=statusLabel(app).toLocaleLowerCase('ru-RU');
    if(!code.includes(filter.status)&&!label.includes(filter.status)&&!filter.status.includes(code)&&!filter.status.includes(label))return false;
  }
  return true;
}
function rowHtml(app){
  const id=norm(app.application_id),product=norm(app.product)||'Заявка';
  const qty=`${fmtNumber(app.quantity_tonnes)} т`;
  const period=[fmtDate(app.delivery_period_from),fmtDate(app.delivery_period_to)].filter(x=>x&&x!=='—').join(' — ')||'—';
  const destination=norm(app.destination)||'—';
  const basis=norm(app.delivery_basis)||'—';
  const payment=norm(app.payment_terms)||'—';
  const submitted=fmtDateTime(app.submitted_at);
  const resource=resourceCode(app);
  return `<article class="rona-live-app-row" data-rona-live-application-id="${esc(id)}" data-status="${esc(statusCode(app))}" data-resource-status="${esc(resource)}">
    <div class="rona-live-app-main">
      <div class="rona-live-app-cell"><div class="rona-live-app-id">${esc(id)}</div><div class="rona-live-app-product">${esc(product)}</div></div>
      <div class="rona-live-app-cell rona-live-app-qty"><span>Объём</span><strong>${esc(qty)}</strong></div>
      <div class="rona-live-app-cell rona-live-app-price"><span>Цена</span><strong>${esc(priceText(app))}</strong></div>
      <div class="rona-live-app-cell rona-live-app-period"><span>Период</span><strong>${esc(period)}</strong></div>
      <div class="rona-live-app-cell rona-live-app-destination"><span>Назначение</span><strong title="${esc(destination)}">${esc(destination)}</strong></div>
      <div class="rona-live-app-actions"><div class="rona-live-app-state"><span class="rona-live-app-status">${esc(statusLabel(app))}</span><span class="rona-resource-status" data-resource="${esc(resource)}">${esc(resourceLabel(app))}</span></div><button type="button" class="rona-live-app-open" data-rona-open-application="${esc(id)}" aria-expanded="false">Открыть</button></div>
    </div>
    <div class="rona-live-app-details" data-rona-application-details="${esc(id)}" hidden>
      <div class="rona-live-app-detail"><span>Базис поставки</span><strong>${esc(basis)}</strong></div>
      <div class="rona-live-app-detail"><span>Условия оплаты</span><strong>${esc(payment)}</strong></div>
      <div class="rona-live-app-detail"><span>Цена заявки</span><strong>${esc(priceText(app))}</strong></div>
      <div class="rona-live-app-detail"><span>Подтверждение ресурса</span><strong>${esc(resourceLabel(app))}</strong></div>
      <div class="rona-live-app-detail"><span>Подана</span><strong>${esc(submitted)}</strong></div>
      <div class="rona-live-app-detail"><span>ИД сделки</span><strong>${esc(norm(app.deal_id)||'Не зарегистрирована')}</strong></div>
    </div>
  </article>`;
}
function render(){
  const r=root();if(!r)return false;ensureStyle();
  const active=state.apps.filter(isActive),filter=currentFilter(r),rows=active.filter(app=>matches(app,filter));
  const list=ensureList(r);
  list.innerHTML=rows.length?rows.map(rowHtml).join(''):`<div class="rona-live-app-empty">${active.length?'По текущему фильтру заявок нет.':'Активных заявок в выбранном контексте нет.'}</div>`;
  updateCounter(r,active.length);
  r.setAttribute('data-rona-applications-live-render','ready');
  window.dispatchEvent(new CustomEvent('rona:client-applications-rendered'));
  return true;
}
async function load(force=false){
  if(state.loading)return;
  const ctx=await currentContext().catch(()=>null);if(!ctx)return;
  const key=contextKey(ctx);if(!key||key==='|')return;
  if(!force&&state.contextKey===key&&Date.now()-state.lastLoad<REFRESH_MS){render();return}
  state.loading=true;
  try{
    const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));
    if(contextKey(authority()?.getCurrentContext?.())!==key)return;
    state.apps=Array.isArray(detail?.data?.applications)?detail.data.applications:[];
    state.contextKey=key;state.lastLoad=Date.now();
    render();
  }catch(error){console.error('RONA client live applications render',error);const r=root();if(r)r.setAttribute('data-rona-applications-live-render','error')}
  finally{state.loading=false}
}
function start(){
  ensureStyle();load(true);
  const a=authority();
  if(a?.subscribe)state.unsubscribe=a.subscribe(()=>{state.apps=[];state.contextKey='';state.lastLoad=0;load(true)});
  state.timer=setInterval(()=>load(false),REFRESH_MS);
  document.addEventListener('input',e=>{const r=root();if(r&&r.contains(e.target)&&e.target===searchInput(r))render()},true);
  document.addEventListener('change',e=>{const r=root();if(r&&r.contains(e.target)&&(e.target===searchInput(r)||e.target===statusSelect(r)))render()},true);
  document.addEventListener('click',e=>{
    const button=e.target?.closest?.('[data-rona-open-application]');if(!button)return;
    const id=button.getAttribute('data-rona-open-application'),r=root(),detail=r?.querySelector(`[data-rona-application-details="${CSS.escape(id)}"]`);if(!detail)return;
    const open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));button.textContent=open?'Скрыть':'Открыть';
    window.dispatchEvent(new CustomEvent('rona:client-applications-rendered'));
  },true);
  window.addEventListener('rona:client-application-submitted',()=>{setTimeout(()=>load(true),120);setTimeout(()=>load(true),900)});
  window.addEventListener('pageshow',()=>load(true),{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();