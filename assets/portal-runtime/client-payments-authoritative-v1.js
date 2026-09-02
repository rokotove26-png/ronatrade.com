(()=>{'use strict';
const MARK='20260902-client-payments-authoritative-v2-current-context';
if(window.__RONA_CLIENT_PAYMENTS_RUNTIME__===MARK)return;
window.__RONA_CLIENT_PAYMENTS_RUNTIME__=MARK;
if(location.pathname!=='/portal/client')return;

const API='/portal/api',REFRESH_MS=30000;
const state={activeKey:'',detail:null,ctx:null,loading:false,lastLoad:0,timer:0,observer:null,scheduled:false,unsubscribe:null};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const upper=v=>norm(v).toUpperCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const esc=v=>norm(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function installStyle(){
  if(document.getElementById('rona-client-payments-authoritative-v1-style'))return;
  const style=document.createElement('style');
  style.id='rona-client-payments-authoritative-v1-style';
  style.textContent=`
  #page-payments [data-rona-client-payments-owner="finance-authoritative-v1"]{display:grid;gap:12px;width:100%;margin-top:12px;color:#d9edf7;font-family:inherit}
  #page-payments [data-rona-payments-card]{border:1px solid rgba(92,159,194,.22);border-radius:12px;background:linear-gradient(180deg,rgba(7,27,42,.92),rgba(5,20,34,.88));box-shadow:inset 0 1px 0 rgba(255,255,255,.025);overflow:hidden}
  #page-payments .rona-payments-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 16px;border-bottom:1px solid rgba(92,159,194,.15)}
  #page-payments .rona-payments-head strong{font-size:13px;color:#dff4fb}#page-payments .rona-payments-source{font-size:10px;color:#82aabd;text-align:right}
  #page-payments .rona-payments-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px}
  #page-payments .rona-payments-kpi{min-height:72px;padding:10px 12px;border:1px solid rgba(92,159,194,.16);border-radius:10px;background:rgba(8,31,48,.54)}
  #page-payments .rona-payments-kpi span{display:block;font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:#7fa8bb;margin-bottom:7px}
  #page-payments .rona-payments-kpi b{font-size:15px;color:#edfaff;font-weight:760}#page-payments .rona-payments-kpi small{display:block;margin-top:4px;color:#8eb3c3;font-size:9px}
  #page-payments .rona-payments-deals{display:grid;gap:8px;padding:0 12px 12px}
  #page-payments .rona-payments-deal{display:grid;grid-template-columns:minmax(170px,1.1fr) minmax(150px,1fr) minmax(220px,2fr);gap:12px;align-items:center;padding:11px 12px;border:1px solid rgba(92,159,194,.15);border-radius:10px;background:rgba(4,20,33,.55)}
  #page-payments .rona-payments-deal-id{font-weight:750;color:#bfeafa;font-size:12px}#page-payments .rona-payments-deal-state{font-size:10px;margin-top:3px;color:#8fb6c7}
  #page-payments .rona-payments-amount{font-size:11px;color:#dceff6}#page-payments .rona-payments-amount b{color:#f0fbff}
  #page-payments .rona-payments-progress{height:6px;border-radius:999px;background:rgba(98,150,176,.18);overflow:hidden;margin-top:7px}#page-payments .rona-payments-progress>i{display:block;height:100%;background:linear-gradient(90deg,#2f8ca4,#55d79d);border-radius:inherit}
  #page-payments .rona-payments-pill{display:inline-flex;align-items:center;min-height:23px;padding:0 8px;border-radius:999px;border:1px solid rgba(85,211,157,.25);background:rgba(22,102,77,.16);color:#9ee8c5;font-size:9px;font-weight:700}#page-payments .rona-payments-pill[data-tone="waiting"]{border-color:rgba(228,186,82,.25);background:rgba(129,91,19,.15);color:#f0d184}#page-payments .rona-payments-pill[data-tone="check"]{border-color:rgba(227,112,112,.26);background:rgba(130,41,41,.15);color:#f4b0b0}
  #page-payments .rona-payments-events{display:grid;gap:7px;padding:12px}#page-payments .rona-payments-event{display:grid;grid-template-columns:minmax(130px,1fr) minmax(130px,1fr) auto;gap:12px;align-items:center;padding:9px 11px;border:1px solid rgba(92,159,194,.13);border-radius:9px;background:rgba(7,26,41,.48);font-size:10px}#page-payments .rona-payments-event b{color:#e8f8ff}#page-payments .rona-payments-event time{color:#8fb2c1}#page-payments .rona-payments-empty{padding:18px;color:#8fb2c1;font-size:11px;text-align:center}
  #page-payments [data-rona-payments-legacy-hidden="true"]{display:none!important}
  #page-payments [data-rona-client-payments-owner="finance-authoritative-v1"]{display:grid!important}
  @media(max-width:900px){#page-payments .rona-payments-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#page-payments .rona-payments-deal{grid-template-columns:1fr}#page-payments .rona-payments-event{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}
async function request(path){
  const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});
  const b=await r.json().catch(()=>null);
  if(!r.ok||b?.ok===false)throw new Error(String(b?.code||b?.error?.code||('HTTP_'+r.status)));
  return b;
}
function paymentsRoot(){
  for(const selector of ['#page-payments','#paymentsPage','[data-page-panel="payments"]','[data-page-id="payments"]']){const el=document.querySelector(selector);if(el)return el}
  let best=null;
  for(const el of document.querySelectorAll('main section,main div,section')){
    const t=norm(el.textContent);if(!t.includes('Платежи и взаиморасчёты'))continue;
    if(!best||t.length<norm(best.textContent).length)best=el;
  }
  return best;
}
function contextKey(c){return norm(c?.client_id)+'|'+norm(c?.contract_id)}
function contextAuthority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const authority=contextAuthority();if(!authority)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');return authority.getCurrentContext()||await authority.whenReady()}
function markLegacy(root){
  const exact=/^(?:Платёжный статус|Платежный статус|Платёжных данных пока нет\.?|Платежных данных пока нет\.?)$/iu;
  for(const leaf of root.querySelectorAll('*')){
    if(leaf.closest('[data-rona-client-payments-owner="finance-authoritative-v1"]'))continue;
    if(leaf.childElementCount!==0||!exact.test(norm(leaf.textContent)))continue;
    let chosen=leaf,node=leaf;
    while(node.parentElement&&node.parentElement!==root){
      const p=node.parentElement,t=norm(p.textContent);
      if(t.includes('Платежи и взаиморасчёты')||t.includes('Выбрана компания')||t.includes('КОМПАНИЯ / КОНТРАКТ')||t.length>1800)break;
      chosen=p;node=p;
    }
    chosen.setAttribute('data-rona-payments-legacy-hidden','true');
  }
}
function money(v,c){const n=num(v);if(n===null)return'—';return n.toLocaleString('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2})+(c?' '+c:'')}
function percentOf(deal){
  const p=num(deal?.payment_percent);if(p!==null)return Math.max(0,Math.min(100,p));
  const r=num(deal?.payment_received_amount),o=num(deal?.payment_obligation_amount);return r!==null&&o!==null&&o>0?Math.max(0,Math.min(100,r/o*100)):0;
}
function resourceConfirmed(deal){return upper(deal?.resource_status).includes('CONFIRMED')}
function paymentTone(deal){const code=upper(deal?.payment_status);if(!resourceConfirmed(deal))return'waiting';if(code.includes('VERIFY')||code.includes('CHECK')||code.includes('ERROR'))return'check';return code.includes('PAID')||code.includes('PART')||percentOf(deal)>0?'ok':'waiting'}
function paymentLabel(deal){
  if(!resourceConfirmed(deal))return'Ожидается подтверждение ресурса';
  return norm(deal?.payment_label)||norm(deal?.payment_status)||'Статус оплаты уточняется';
}
function aggregate(deals){
  const by=new Map();
  for(const d of deals){
    const c=norm(d?.payment_currency)||'—',o=num(d?.payment_obligation_amount)||0,r=num(d?.payment_received_amount)||0;
    if(!by.has(c))by.set(c,{currency:c,obligation:0,received:0});const a=by.get(c);a.obligation+=o;a.received+=r;
  }
  return [...by.values()].map(a=>({...a,remaining:Math.max(0,a.obligation-a.received),percent:a.obligation>0?Math.max(0,Math.min(100,a.received/a.obligation*100)):0}));
}
function formatDate(v){if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('ru-RU')}
function confirmedPayment(p){return ['BANK_CONFIRMED','CONFIRMED','VERIFIED','PAID'].some(x=>upper(p?.bank_fact_status).includes(x))}
function render(detail,ctx){
  const root=paymentsRoot();if(!root)return false;
  installStyle();markLegacy(root);
  let host=root.querySelector('[data-rona-client-payments-owner="finance-authoritative-v1"]');
  if(!host){host=document.createElement('section');host.setAttribute('data-rona-client-payments-owner','finance-authoritative-v1');root.appendChild(host)}
  host.removeAttribute('data-rona-payments-legacy-hidden');
  const deals=Array.isArray(detail?.deals)?detail.deals:[];
  const payments=(Array.isArray(detail?.payments)?detail.payments:[]).filter(confirmedPayment);
  const totals=aggregate(deals);
  const totalBlock=totals.length?totals.map(a=>`<div class="rona-payments-kpi"><span>К оплате</span><b>${esc(money(a.obligation,a.currency==='—'?'':a.currency))}</b><small>По сделкам выбранного договора</small></div><div class="rona-payments-kpi"><span>Получено</span><b>${esc(money(a.received,a.currency==='—'?'':a.currency))}</b><small>Подтверждённые поступления</small></div><div class="rona-payments-kpi"><span>Остаток</span><b>${esc(money(a.remaining,a.currency==='—'?'':a.currency))}</b><small>До полного исполнения</small></div><div class="rona-payments-kpi"><span>Прогресс</span><b>${Math.round(a.percent)}%</b><small>${esc(a.currency==='—'?'':a.currency)}</small></div>`).join(''):`<div class="rona-payments-empty">По выбранному договору нет сделок с платёжными обязательствами.</div>`;
  const dealRows=deals.length?deals.map(d=>{
    const c=norm(d?.payment_currency),o=num(d?.payment_obligation_amount),r=num(d?.payment_received_amount),remaining=o!==null?Math.max(0,o-(r||0)):null,p=percentOf(d),tone=paymentTone(d);
    return `<article class="rona-payments-deal" data-deal-id="${esc(d?.deal_id)}"><div><div class="rona-payments-deal-id">${esc(d?.deal_id||'Сделка')}</div><div class="rona-payments-deal-state">${esc(resourceConfirmed(d)?'Ресурс подтверждён':'Ресурс не подтверждён')}</div></div><div><span class="rona-payments-pill" data-tone="${tone}">${esc(paymentLabel(d))}</span></div><div class="rona-payments-amount">Получено <b>${esc(money(r,c))}</b> из ${esc(money(o,c))} · остаток ${esc(money(remaining,c))}<div class="rona-payments-progress" aria-label="Оплачено ${Math.round(p)}%"><i style="width:${p.toFixed(2)}%"></i></div></div></article>`;
  }).join(''):`<div class="rona-payments-empty">Активных сделок по выбранному договору нет.</div>`;
  const events=payments.length?payments.sort((a,b)=>new Date(b?.received_at||b?.payment_at||0)-new Date(a?.received_at||a?.payment_at||0)).map(p=>`<div class="rona-payments-event"><div><b>${esc(p?.deal_id||'Платёж')}</b><div>${esc(p?.payment_id||'')}</div></div><time>${esc(formatDate(p?.received_at||p?.payment_at||p?.bank_confirmed_at))}</time><b>${esc(money(p?.amount,p?.currency))}</b></div>`).join(''):`<div class="rona-payments-empty">Подтверждённых банковских поступлений по выбранному договору пока нет.</div>`;
  host.innerHTML=`<section data-rona-payments-card><div class="rona-payments-head"><strong>Платёжный статус</strong><span class="rona-payments-source">Finance · подтверждённые поступления · автообновление</span></div><div class="rona-payments-kpis">${totalBlock}</div><div class="rona-payments-deals">${dealRows}</div></section><section data-rona-payments-card><div class="rona-payments-head"><strong>Подтверждённые поступления</strong><span class="rona-payments-source">${esc(norm(ctx?.current_external_contract_number)||norm(ctx?.contract_id))}</span></div><div class="rona-payments-events">${events}</div></section>`;
  root.setAttribute('data-rona-payments-runtime','finance-authoritative-v1');
  return true;
}
function renderLoadingError(message){
  const root=paymentsRoot();if(!root)return;
  installStyle();markLegacy(root);
  let host=root.querySelector('[data-rona-client-payments-owner="finance-authoritative-v1"]');if(!host){host=document.createElement('section');host.setAttribute('data-rona-client-payments-owner','finance-authoritative-v1');root.appendChild(host)}
  host.removeAttribute('data-rona-payments-legacy-hidden');
  host.innerHTML=`<section data-rona-payments-card><div class="rona-payments-empty">${esc(message)}</div></section>`;
}
function ready(ok){document.documentElement.dataset.ronaClientPaymentsState=ok?'ready':'error';if(ok)document.documentElement.setAttribute('data-rona-client-payments-ready','true');else document.documentElement.removeAttribute('data-rona-client-payments-ready')}
function clearForContext(ctx){state.activeKey=ctx?contextKey(ctx):'';state.detail=null;state.ctx=ctx||null;state.lastLoad=0}
async function load(force=false){
  if(state.loading)return;
  const root=paymentsRoot();if(!root)return;
  let ctx=null;
  try{ctx=await currentContext()}catch(error){console.error('RONA client payments context authority',error);renderLoadingError('Контекст клиента временно недоступен.');ready(false);return}
  if(!ctx){clearForContext(null);renderLoadingError('Выберите компанию и договор для отображения платежей.');ready(true);return}
  const key=contextKey(ctx);
  if(state.activeKey&&state.activeKey!==key)clearForContext(ctx);else state.ctx=ctx;
  if(!force&&state.detail&&Date.now()-state.lastLoad<REFRESH_MS){render(state.detail,ctx);ready(true);return}
  state.loading=true;
  try{
    const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));
    if(contextKey(contextAuthority()?.getCurrentContext())!==key)return;
    state.activeKey=key;state.detail=detail?.data||{};state.ctx=ctx;state.lastLoad=Date.now();
    window.__RONA_CLIENT_PAYMENTS_STATE__={version:MARK,source:'CURRENT_CONTEXT_FINANCE_PROJECTION',client_id:norm(ctx.client_id),contract_id:norm(ctx.contract_id),deals:Array.isArray(state.detail.deals)?state.detail.deals:[],payments:Array.isArray(state.detail.payments)?state.detail.payments:[],loaded_at:new Date().toISOString()};
    render(state.detail,ctx);ready(true);
  }catch(error){console.error('RONA client payments projection',error);renderLoadingError('Актуальные платежные данные временно недоступны.');ready(false)}finally{state.loading=false}
}
function schedule(force=false){if(state.scheduled)return;state.scheduled=true;setTimeout(()=>{state.scheduled=false;load(force)},120)}
function start(){
  installStyle();
  const authority=contextAuthority();
  if(!authority){renderLoadingError('Контекст клиента временно недоступен.');ready(false);return}
  state.unsubscribe=authority.subscribe(ctx=>{const key=ctx?contextKey(ctx):'';const changed=key!==state.activeKey;if(changed)clearForContext(ctx);schedule(true)});
  schedule(true);
  state.timer=window.setInterval(()=>load(true),REFRESH_MS);
  if(!state.observer){state.observer=new MutationObserver(()=>schedule(false));state.observer.observe(document.body,{childList:true,subtree:true,characterData:true})}
  window.addEventListener('pageshow',()=>load(true),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load(true)});
  document.addEventListener('click',e=>{const t=norm(e.target?.textContent);if(t.includes('Платежи'))setTimeout(()=>load(true),120)},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
