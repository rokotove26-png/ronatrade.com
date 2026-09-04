(()=>{'use strict';
const MARK='20260904-portal-client-applications-canonical-v2-deal-visual-parity';
if(window.__RONA_PORTAL_CLIENT_APPLICATIONS_CANONICAL__===MARK)return;
window.__RONA_PORTAL_CLIENT_APPLICATIONS_CANONICAL__=MARK;
if(!/^\/portal\/client\/?$/.test(location.pathname))return;

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
const state={apps:[],contextKey:'',loading:false,lastLoad:0,timer:0,raf:0,unsubscribe:null,resizeObserver:null,mutationObserver:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const fmtNumber=v=>{const n=num(v);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n)};
const fmtDate=v=>{const s=String(v||'');const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:s||'—'};
const fmtDateTime=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)};
const statusCode=a=>norm(a?.status).toUpperCase();
const statusLabel=a=>STATUS_LABELS[statusCode(a)]||norm(a?.status)||'Статус уточняется';
const resourceCode=a=>norm(a?.resource_status).toUpperCase()==='RESOURCE_CONFIRMED'?'RESOURCE_CONFIRMED':'RESOURCE_NOT_CONFIRMED';
const resourceLabel=a=>resourceCode(a)==='RESOURCE_CONFIRMED'?'Ресурс подтвержден':'Ресурс не подтвержден';
const isActive=a=>!TERMINAL.has(statusCode(a))&&!norm(a?.deal_id);
const contextKey=ctx=>`${norm(ctx?.client_id)}|${norm(ctx?.contract_id)}`;
const priceText=a=>{const p=a?.application_price,c=norm(a?.application_currency||'USD');return p==null?'—':`${fmtNumber(p)} ${c}/т`};
function authority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const a=authority();if(!a)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');return a.getCurrentContext?.()||await a.whenReady?.()}
async function request(path){const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});const j=await r.json().catch(()=>null);if(!r.ok||j?.ok===false)throw new Error(String(j?.code||j?.error?.code||('HTTP_'+r.status)));return j}
function root(){return document.getElementById('page-applications')||document.getElementById('applicationsPage')||document.querySelector('[data-page-panel="applications"],[data-page-id="applications"]')}
function searchInput(r){return [...r.querySelectorAll('input')].find(el=>/ид заявки|товар|ид сделки/i.test(String(el.placeholder||'')))||null}
function statusSelect(r){return [...r.querySelectorAll('select')].find(el=>/все статусы/i.test(norm(el.textContent)))||null}
function resetButton(r){return [...r.querySelectorAll('button')].find(el=>/^сбросить$/iu.test(norm(el.textContent)))||null}
function rect(el){if(!el||!el.isConnected)return null;const b=el.getBoundingClientRect(),s=getComputedStyle(el);return b.width>0&&b.height>0&&s.display!=='none'&&s.visibility!=='hidden'?b:null}
function frameRect(r){
  const rr=rect(r);if(!rr)return null;
  const controls=[searchInput(r),statusSelect(r),resetButton(r)].map(rect).filter(Boolean);
  if(controls.length>=2){
    const left=Math.min(...controls.map(b=>b.left)),right=Math.max(...controls.map(b=>b.right)),width=right-left;
    if(width>=420)return{left,right,width};
  }
  const input=searchInput(r);let node=input?.parentElement||null,best=null;
  for(let i=0;node&&node!==r&&i<8;i++,node=node.parentElement){
    const b=rect(node);if(!b)continue;
    if(b.width>=420&&b.left>=rr.left+20&&b.right<=rr.right+6){best=b;if(statusSelect(r)&&node.contains(statusSelect(r)))return b}
  }
  if(best)return best;
  const h=[...r.querySelectorAll('h1,h2,h3,[role="heading"]')].find(el=>norm(el.textContent)==='Заявки');
  node=h?.parentElement||null;
  for(let i=0;node&&node!==r&&i<10;i++,node=node.parentElement){
    const b=rect(node);if(!b)continue;
    const cs=getComputedStyle(node),radius=parseFloat(cs.borderTopLeftRadius)||0;
    if(b.width>=420&&b.height>=62&&b.height<=190&&b.left>=rr.left+20&&b.right<=rr.right+6&&radius>=8)return b;
  }
  return null;
}
function alignList(){
  const r=root(),list=r?.querySelector('[data-rona-live-applications="canonical-v1"]');if(!r||!list)return false;
  const rr=rect(r),target=frameRect(r);if(!rr||!target)return false;
  const offset=Math.max(0,Math.round(target.left-rr.left)),width=Math.max(420,Math.round(target.width));
  list.style.boxSizing='border-box';
  list.style.marginLeft=`${offset}px`;
  list.style.marginRight='0';
  list.style.width=`${width}px`;
  list.style.minWidth='0';
  list.style.maxWidth=`calc(100% - ${offset}px)`;
  list.dataset.ronaCanonicalFrame='applications-filter-frame';
  return true;
}
function scheduleAlign(){cancelAnimationFrame(state.raf);state.raf=requestAnimationFrame(()=>{alignList();setTimeout(alignList,60)})}
function ensureStyle(){if(document.getElementById('rona-portal-client-applications-canonical-v2-style'))return;document.getElementById('rona-portal-client-applications-canonical-v1-style')?.remove();const s=document.createElement('style');s.id='rona-portal-client-applications-canonical-v2-style';s.textContent=`
#page-applications [data-rona-live-applications="canonical-v1"]{position:relative;z-index:2;display:grid;gap:10px;margin:10px 0 26px;padding:0;box-sizing:border-box}
#page-applications [data-rona-live-applications="canonical-v1"] *{box-sizing:border-box}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-row{width:100%;max-width:100%;min-width:0;padding:14px 16px 11px;margin:0;border:1px solid rgba(79,139,182,.25);border-radius:12px;background:linear-gradient(180deg,rgba(7,27,46,.80),rgba(5,20,34,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 24px rgba(0,7,14,.10);overflow:visible}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-summary{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-rows:auto auto auto;align-items:center;column-gap:12px;row-gap:8px;width:100%;min-width:0}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-summary-main{grid-column:1;grid-row:1;min-width:0}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-headline{display:flex;align-items:baseline;gap:12px;min-width:0}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-id{flex:0 0 auto;font-size:14px;font-weight:820;line-height:1.25;letter-spacing:.018em;color:rgba(247,250,255,.98);white-space:nowrap}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-product{min-width:0;font-size:13.5px;font-weight:680;line-height:1.3;color:rgba(229,238,246,.93);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-price{grid-column:2;grid-row:1;display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:0 11px;border:1px solid rgba(83,178,220,.22);border-radius:9px;background:rgba(8,31,48,.66);color:rgba(225,248,238,.96);font-size:13.4px;font-weight:810;line-height:1;white-space:nowrap;box-shadow:inset 0 1px 0 rgba(255,255,255,.02)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-open{grid-column:3;grid-row:1;min-height:30px;height:30px;padding:0 12px;border:1px solid rgba(93,180,226,.34);border-radius:8px;background:linear-gradient(180deg,rgba(16,58,86,.86),rgba(7,34,54,.90));box-shadow:0 3px 10px rgba(1,8,16,.14),inset 0 1px 0 rgba(255,255,255,.05);color:rgba(241,248,252,.94);font:760 11.8px/1 Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap;transition:transform .14s ease,border-color .14s ease,box-shadow .14s ease,filter .14s ease}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-open:hover{transform:translateY(-1px);border-color:rgba(112,205,241,.50);box-shadow:0 6px 16px rgba(1,8,16,.20),inset 0 1px 0 rgba(255,255,255,.07)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-open:focus-visible{outline:2px solid rgba(101,217,255,.72);outline-offset:2px}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-terms{grid-column:1/-1;grid-row:2;min-width:0;font-size:13.4px;font-weight:650;line-height:1.35;color:rgba(210,224,235,.88);white-space:normal;overflow-wrap:anywhere}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-state-strip{grid-column:1/-1;grid-row:3;justify-self:start;display:inline-flex;align-items:center;gap:8px;flex-wrap:nowrap;width:max-content;max-width:100%;margin:0;padding:0;white-space:nowrap}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-status,#page-applications [data-rona-live-applications="canonical-v1"] .rona-resource-status{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:30px;padding:0 12px;border-radius:8px;font:740 12.2px/1 Inter,system-ui,sans-serif;white-space:nowrap}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-status:before,#page-applications [data-rona-live-applications="canonical-v1"] .rona-resource-status:before{content:"";width:7px;height:7px;flex:0 0 7px;border-radius:50%}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-status{border:1px solid rgba(90,187,161,.22);background:rgba(29,93,77,.18);color:rgba(206,239,229,.95)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-status:before{background:#59c09a;box-shadow:0 0 0 3px rgba(89,192,154,.10)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-resource-status{border:1px solid rgba(218,174,89,.24);background:rgba(125,86,24,.14);color:#e4ca98}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-resource-status:before{background:#d0a453;box-shadow:0 0 0 3px rgba(208,164,83,.09)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-resource-status[data-resource="RESOURCE_CONFIRMED"]{border-color:rgba(90,187,161,.22);background:rgba(29,93,77,.18);color:rgba(206,239,229,.95)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-resource-status[data-resource="RESOURCE_CONFIRMED"]:before{background:#59c09a;box-shadow:0 0 0 3px rgba(89,192,154,.10)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0 0;padding:10px 0 1px;border-top:1px solid rgba(113,154,184,.12)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-details[hidden]{display:none!important}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-detail{padding:10px 11px;border:1px solid rgba(93,170,211,.10);border-radius:8px;background:rgba(8,26,40,.45)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-detail span{display:block;margin-bottom:4px;color:rgba(203,213,225,.56);font:760 10.5px/1 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.045em}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-detail strong{display:block;color:rgba(229,238,246,.93);font:700 12.8px/1.4 Inter,system-ui,sans-serif;overflow-wrap:anywhere}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-empty{padding:32px 18px;text-align:center;border:1px dashed rgba(79,139,182,.25);border-radius:12px;background:rgba(5,20,34,.58);color:rgba(203,213,225,.70);font:680 13px/1.45 Inter,system-ui,sans-serif}
@media(max-width:900px){#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-summary{grid-template-columns:minmax(0,1fr) auto}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-price{grid-column:2;grid-row:1}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-open{grid-column:2;grid-row:3}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-state-strip{grid-column:1;grid-row:3}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-details{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:650px){#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-row{padding:13px 14px 11px}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-summary{grid-template-columns:1fr;grid-template-rows:auto auto auto auto}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-headline{display:block}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-product{margin-top:5px;white-space:normal}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-price{grid-column:1;grid-row:2;justify-self:start;margin-top:2px}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-terms{grid-column:1;grid-row:3}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-state-strip{grid-column:1;grid-row:4;flex-wrap:wrap;white-space:normal}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-open{grid-column:1;grid-row:5;justify-self:start;margin-top:2px}#page-applications [data-rona-live-applications="canonical-v1"] .rona-live-app-details{grid-template-columns:1fr}}
`;document.head.appendChild(s)}
function ensureList(r){let list=r.querySelector('[data-rona-live-applications="canonical-v1"]');if(list)return list;for(const old of r.querySelectorAll('[data-rona-live-applications]'))old.remove();list=document.createElement('section');list.setAttribute('data-rona-live-applications','canonical-v1');list.setAttribute('aria-live','polite');const input=searchInput(r);let anchor=input;while(anchor&&anchor.parentElement&&anchor.parentElement!==r)anchor=anchor.parentElement;if(anchor?.nextSibling)r.insertBefore(list,anchor.nextSibling);else r.appendChild(list);return list}
function updateCounter(r,count){for(const el of r.querySelectorAll('*')){if(el.closest('[data-rona-live-applications]'))continue;if(el.childElementCount===0&&/^\d+\s+зарегистрировано$/iu.test(norm(el.textContent)))el.textContent=`${count} зарегистрировано`}}
function currentFilter(r){const q=norm(searchInput(r)?.value).toLocaleLowerCase('ru-RU');const sel=statusSelect(r),raw=norm(sel?.value||sel?.selectedOptions?.[0]?.textContent||'');return{q,status:/все статусы/i.test(raw)?'':raw.toLocaleLowerCase('ru-RU')}}
function matches(app,f){if(f.q){const hay=[app.application_id,app.product,app.destination,app.deal_id,statusLabel(app),resourceLabel(app),priceText(app)].map(norm).join(' ').toLocaleLowerCase('ru-RU');if(!hay.includes(f.q))return false}if(f.status){const code=statusCode(app).toLocaleLowerCase('ru-RU'),label=statusLabel(app).toLocaleLowerCase('ru-RU');if(!code.includes(f.status)&&!label.includes(f.status)&&!f.status.includes(code)&&!f.status.includes(label))return false}return true}
function rowHtml(app){
  const id=norm(app.application_id),product=norm(app.product)||'Заявка',qty=`${fmtNumber(app.quantity_tonnes)} т`,period=[fmtDate(app.delivery_period_from),fmtDate(app.delivery_period_to)].filter(x=>x&&x!=='—').join(' — ')||'—',destination=norm(app.destination)||'—',basis=norm(app.delivery_basis)||'—',payment=norm(app.payment_terms)||'—',submitted=fmtDateTime(app.submitted_at),resource=resourceCode(app);
  const terms=[qty,period,destination].filter(x=>x&&x!=='—').join(' · ');
  return `<article class="rona-live-app-row" data-rona-live-application-id="${esc(id)}" data-status="${esc(statusCode(app))}" data-resource-status="${esc(resource)}"><div class="rona-live-app-summary"><div class="rona-live-app-summary-main"><div class="rona-live-app-headline"><div class="rona-live-app-id">${esc(id)}</div><div class="rona-live-app-product">${esc(product)}</div></div></div><div class="rona-live-app-price">${esc(priceText(app))}</div><button type="button" class="rona-live-app-open" data-rona-open-application="${esc(id)}" aria-expanded="false">Открыть</button><div class="rona-live-app-terms">${esc(terms)}</div><div class="rona-live-app-state-strip"><span class="rona-live-app-status">${esc(statusLabel(app))}</span><span class="rona-resource-status" data-resource="${esc(resource)}">${esc(resourceLabel(app))}</span></div></div><div class="rona-live-app-details" data-rona-application-details="${esc(id)}" hidden><div class="rona-live-app-detail"><span>Базис поставки</span><strong>${esc(basis)}</strong></div><div class="rona-live-app-detail"><span>Условия оплаты</span><strong>${esc(payment)}</strong></div><div class="rona-live-app-detail"><span>Цена заявки</span><strong>${esc(priceText(app))}</strong></div><div class="rona-live-app-detail"><span>Подтверждение ресурса</span><strong>${esc(resourceLabel(app))}</strong></div><div class="rona-live-app-detail"><span>Подана</span><strong>${esc(submitted)}</strong></div><div class="rona-live-app-detail"><span>ИД сделки</span><strong>${esc(norm(app.deal_id)||'Не зарегистрирована')}</strong></div></div></article>`;
}
function render(){const r=root();if(!r)return false;ensureStyle();const active=state.apps.filter(isActive),f=currentFilter(r),rows=active.filter(a=>matches(a,f)),list=ensureList(r);list.innerHTML=rows.length?rows.map(rowHtml).join(''):`<div class="rona-live-app-empty">${active.length?'По текущему фильтру заявок нет.':'Активных заявок в выбранном контексте нет.'}</div>`;updateCounter(r,active.length);r.dataset.ronaApplicationsLiveRender='ready';scheduleAlign();window.dispatchEvent(new CustomEvent('rona:client-applications-rendered'));return true}
async function load(force=false){if(state.loading)return;const ctx=await currentContext().catch(()=>null);if(!ctx)return;const key=contextKey(ctx);if(!key||key==='|')return;if(!force&&state.contextKey===key&&Date.now()-state.lastLoad<REFRESH_MS){render();return}state.loading=true;try{const detail=await request('/v1/client/applications-projection?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));if(contextKey(authority()?.getCurrentContext?.())!==key)return;state.apps=Array.isArray(detail?.applications)?detail.applications:[];state.contextKey=key;state.lastLoad=Date.now();render()}catch(error){console.error('RONA client applications canonical projection',error);const r=root();if(r)r.dataset.ronaApplicationsLiveRender='error'}finally{state.loading=false}}
function observeLayout(){const r=root();if(!r)return;state.resizeObserver?.disconnect?.();if('ResizeObserver'in window){state.resizeObserver=new ResizeObserver(scheduleAlign);state.resizeObserver.observe(r);const input=searchInput(r);if(input?.parentElement)state.resizeObserver.observe(input.parentElement)}state.mutationObserver?.disconnect?.();state.mutationObserver=new MutationObserver(scheduleAlign);state.mutationObserver.observe(r,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']})}
function start(){ensureStyle();load(true);observeLayout();const a=authority();if(a?.subscribe)state.unsubscribe=a.subscribe(()=>{state.apps=[];state.contextKey='';state.lastLoad=0;load(true);setTimeout(observeLayout,0)});state.timer=setInterval(()=>load(false),REFRESH_MS);document.addEventListener('input',e=>{const r=root();if(r&&r.contains(e.target)&&e.target===searchInput(r))render()},true);document.addEventListener('change',e=>{const r=root();if(r&&r.contains(e.target)&&(e.target===searchInput(r)||e.target===statusSelect(r)))render()},true);document.addEventListener('click',e=>{const button=e.target?.closest?.('[data-rona-open-application]');if(!button)return;const id=button.getAttribute('data-rona-open-application'),r=root(),detail=r?.querySelector(`[data-rona-application-details="${CSS.escape(id)}"]`);if(!detail)return;const open=detail.hidden;detail.hidden=!open;button.setAttribute('aria-expanded',String(open));button.textContent=open?'Скрыть':'Открыть';scheduleAlign()},true);window.addEventListener('resize',scheduleAlign,{passive:true});window.addEventListener('rona:client-application-submitted',()=>{setTimeout(()=>load(true),120);setTimeout(()=>load(true),900)});window.addEventListener('pageshow',()=>{load(true);scheduleAlign();setTimeout(observeLayout,0)},{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
