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
#page-applications [data-rona-live-applications="v1"]{position:relative;z-index:2;display:grid;gap:10px;margin:14px 0 28px;padding:0;max-width:100%}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-row{border:1px solid rgba(93,170,211,.20);border-radius:12px;background:linear-gradient(145deg,rgba(7,25,39,.92),rgba(5,17,29,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 10px 28px rgba(0,0,0,.14);overflow:hidden}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(130px,.7fr) minmax(120px,.55fr) minmax(120px,.7fr) auto;align-items:center;gap:16px;padding:14px 16px}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-id{font:800 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:.035em;color:#7fdcff;margin-bottom:5px}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-product{font:760 14px/1.3 Inter,system-ui,sans-serif;color:#f2f7fa}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-cell{min-width:0}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-cell span{display:block;margin-bottom:4px;color:#7592a2;font:650 9px/1.1 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.07em}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-cell strong{display:block;overflow-wrap:anywhere;color:#dce9ef;font:700 12px/1.35 Inter,system-ui,sans-serif}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-status{display:inline-flex;align-items:center;justify-content:center;min-height:27px;padding:0 10px;border:1px solid rgba(102,219,177,.24);border-radius:999px;background:rgba(37,119,91,.14);color:#bff1d8;font:800 10.5px/1 Inter,system-ui,sans-serif;white-space:nowrap}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-open{min-height:34px;padding:0 13px;border:1px solid rgba(101,217,255,.30);border-radius:8px;background:rgba(29,91,116,.28);color:#eaf8fc;font:800 11px/1 Inter,system-ui,sans-serif;cursor:pointer}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-open:hover{background:rgba(42,123,155,.36);border-color:rgba(101,217,255,.48)}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-open:focus-visible{outline:2px solid rgba(101,217,255,.72);outline-offset:2px}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px 16px 15px;border-top:1px solid rgba(93,170,211,.13);background:rgba(3,13,22,.34)}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-details[hidden]{display:none!important}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-detail{padding:8px 10px;border:1px solid rgba(93,170,211,.10);border-radius:8px;background:rgba(8,26,40,.45)}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-detail span{display:block;margin-bottom:3px;color:#6f8d9d;font:650 9px/1.1 Inter,system-ui,sans-serif;text-transform:uppercase;letter-spacing:.06em}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-detail strong{display:block;color:#d9e8ef;font:650 11px/1.4 Inter,system-ui,sans-serif;overflow-wrap:anywhere}
#page-applications [data-rona-live-applications="v1"] .rona-live-app-empty{padding:34px 18px;text-align:center;border:1px dashed rgba(93,170,211,.22);border-radius:12px;color:#7995a4;background:rgba(5,18,30,.45);font:650 12px/1.5 Inter,system-ui,sans-serif}
@media(max-width:1100px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:minmax(0,1fr) minmax(120px,.55fr) minmax(120px,.65fr) auto}.rona-live-app-period{display:none}}
@media(max-width:760px){#page-applications [data-rona-live-applications="v1"] .rona-live-app-main{grid-template-columns:1fr auto;gap:10px 12px}.rona-live-app-destination,.rona-live-app-qty{display:none}#page-applications [data-rona-live-applications="v1"] .rona-live-app-details{grid-template-columns:1fr}}
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
    const hay=[app.application_id,app.product,app.destination,app.deal_id,statusLabel(app)].map(norm).join(' ').toLocaleLowerCase('ru-RU');
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
  const priceMode=norm(app.price_mode)||'—';
  const proposed=app.proposed_price!=null?`${fmtNumber(app.proposed_price)} ${norm(app.proposed_currency)||''}`.trim():'—';
  const submitted=fmtDateTime(app.submitted_at);
  return `<article class="rona-live-app-row" data-rona-live-application-id="${esc(id)}" data-status="${esc(statusCode(app))}">
    <div class="rona-live-app-main">
      <div class="rona-live-app-cell"><div class="rona-live-app-id">${esc(id)}</div><div class="rona-live-app-product">${esc(product)}</div></div>
      <div class="rona-live-app-cell rona-live-app-qty"><span>Объём</span><strong>${esc(qty)}</strong></div>
      <div class="rona-live-app-cell rona-live-app-period"><span>Период</span><strong>${esc(period)}</strong></div>
      <div class="rona-live-app-cell rona-live-app-destination"><span>Назначение</span><strong>${esc(destination)}</strong></div>
      <div style="display:flex;align-items:center;gap:9px;justify-content:flex-end"><span class="rona-live-app-status">${esc(statusLabel(app))}</span><button type="button" class="rona-live-app-open" data-rona-open-application="${esc(id)}" aria-expanded="false">Открыть</button></div>
    </div>
    <div class="rona-live-app-details" data-rona-application-details="${esc(id)}" hidden>
      <div class="rona-live-app-detail"><span>Базис поставки</span><strong>${esc(basis)}</strong></div>
      <div class="rona-live-app-detail"><span>Условия оплаты</span><strong>${esc(payment)}</strong></div>
      <div class="rona-live-app-detail"><span>Режим цены</span><strong>${esc(priceMode)}</strong></div>
      <div class="rona-live-app-detail"><span>Предложенная цена</span><strong>${esc(proposed)}</strong></div>
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
  },true);
  window.addEventListener('rona:client-application-submitted',()=>{setTimeout(()=>load(true),120);setTimeout(()=>load(true),900)});
  window.addEventListener('pageshow',()=>load(true),{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(()=>{'use strict';
const MARK='20260910-client-counter-offer-applications-v1';
if(window.__RONA_CLIENT_COUNTER_OFFER_APPLICATIONS__===MARK)return;
window.__RONA_CLIENT_COUNTER_OFFER_APPLICATIONS__=MARK;
if(!/^\/portal\/client\/?$/.test(location.pathname))return;
const norm=value=>String(value??'').trim();
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:null};
const fmt=value=>{const n=num(value);return n===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(n)};
const authority=()=>window.RONA_CLIENT_CONTEXT||null;
let decorateToken=0;
function ensureCounterStyle(){if(document.getElementById('rona-client-counter-offer-applications-style'))return;const style=document.createElement('style');style.id='rona-client-counter-offer-applications-style';style.textContent=`
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-panel{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 12px;border:1px solid rgba(93,180,226,.24);border-radius:9px;background:rgba(10,42,63,.54);color:rgba(232,243,250,.96)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-copy{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;min-width:0;font:680 12.4px/1.35 Inter,system-ui,sans-serif}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-price{color:rgba(225,248,238,.98);font-weight:820;font-size:13.6px;white-space:nowrap}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-state{color:rgba(205,222,234,.82);font-size:11.8px}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-action{min-height:30px;padding:0 12px;border:1px solid rgba(93,180,226,.34);border-radius:8px;background:linear-gradient(180deg,rgba(16,58,86,.86),rgba(7,34,54,.90));color:rgba(241,248,252,.96);font:760 11.8px/1 Inter,system-ui,sans-serif;cursor:pointer}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-action[data-decision="accept"]{border-color:rgba(90,187,161,.34);background:rgba(29,93,77,.34)}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-action:disabled{opacity:.55;cursor:wait}
#page-applications [data-rona-live-applications="canonical-v1"] .rona-counter-offer-error{width:100%;color:#f2b7b7;font:650 11.5px/1.35 Inter,system-ui,sans-serif}
`;document.head.appendChild(style)}
function offerPrice(app){const price=num(app?.counter_price),currency=norm(app?.counter_currency).toUpperCase();return price===null||!currency?'':`${fmt(price)} ${currency}/т`}
function responseLabel(app){const response=norm(app?.client_counter_response).toUpperCase();if(response==='ACCEPTED')return'Встречное предложение принято';if(response==='DECLINED')return'Встречное предложение отклонено';return''}
function makePanel(app){const price=offerPrice(app),active=app?.counter_offer_active===true,response=responseLabel(app);if(!price||(!active&&!response))return null;const panel=document.createElement('div');panel.className='rona-counter-offer-panel';panel.dataset.ronaCounterOfferPanel='v1';panel.dataset.ronaCounterOfferActive=String(active);const copy=document.createElement('div');copy.className='rona-counter-offer-copy';const label=document.createElement('span');label.textContent='Встречное предложение RONA Trade';const amount=document.createElement('strong');amount.className='rona-counter-offer-price';amount.textContent=price;copy.append(label,amount);if(response){const state=document.createElement('span');state.className='rona-counter-offer-state';state.textContent=response;copy.append(state)}panel.append(copy);if(active){const actions=document.createElement('div');actions.className='rona-counter-offer-actions';for(const [decision,title] of [['accept','Принять'],['decline','Отклонить']]){const button=document.createElement('button');button.type='button';button.className='rona-counter-offer-action';button.dataset.ronaCounterOfferDecision=decision;button.dataset.applicationId=norm(app?.application_id);button.dataset.decision=decision;button.textContent=title;actions.append(button)}panel.append(actions)}return panel}
async function decorate(){const token=++decorateToken,a=authority();if(!a?.whenCurrentProjection)return;let projection;try{projection=await a.whenCurrentProjection('client-counter-offer-applications')}catch{return}if(token!==decorateToken)return;const apps=Array.isArray(projection?.applications)?projection.applications:[],byId=new Map(apps.map(app=>[norm(app?.application_id),app]).filter(([id])=>id));const root=document.querySelector('#page-applications [data-rona-live-applications="canonical-v1"]');if(!root)return;ensureCounterStyle();for(const row of root.querySelectorAll('[data-rona-live-application-id]')){row.querySelector('[data-rona-counter-offer-panel]')?.remove();const app=byId.get(norm(row.getAttribute('data-rona-live-application-id')));if(!app)continue;const panel=makePanel(app);if(panel){const summary=row.querySelector('.rona-live-app-summary');(summary||row).append(panel)}}}
function queueDecorate(){setTimeout(()=>decorate(),0)}
async function decide(button){const id=norm(button?.dataset?.applicationId),decision=norm(button?.dataset?.ronaCounterOfferDecision);if(!id||!['accept','decline'].includes(decision))return;const panel=button.closest('[data-rona-counter-offer-panel]'),buttons=[...(panel?.querySelectorAll('button')||[])];buttons.forEach(x=>x.disabled=true);panel?.querySelector('.rona-counter-offer-error')?.remove();try{const backendPath=`/client/applications/${encodeURIComponent(id)}/counter-offer/${decision}`;const response=await fetch('/portal/owner-api?path='+encodeURIComponent(backendPath),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','content-type':'application/json'},body:'{}'});const payload=await response.json().catch(()=>null);if(!response.ok||payload?.ok===false)throw new Error(String(payload?.code||('HTTP_'+response.status)));authority()?.invalidateCurrentProjection?.();window.dispatchEvent(new CustomEvent('rona:client-application-submitted',{detail:{source:'COUNTER_OFFER_RESPONSE'}}));setTimeout(queueDecorate,180);setTimeout(queueDecorate,980)}catch(error){buttons.forEach(x=>x.disabled=false);if(panel){const message=document.createElement('div');message.className='rona-counter-offer-error';message.textContent='Не удалось сохранить ответ. Обновите данные и повторите действие.';panel.append(message)}console.error('RONA client counter-offer response',error)}}
document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-rona-counter-offer-decision]');if(button)decide(button)},true);
window.addEventListener('rona:client-applications-rendered',queueDecorate);
window.addEventListener('rona:client-application-submitted',queueDecorate);
window.addEventListener('pageshow',queueDecorate,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',queueDecorate,{once:true});else queueDecorate();
})();
