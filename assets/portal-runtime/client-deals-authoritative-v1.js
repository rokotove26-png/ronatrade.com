(()=>{
'use strict';
if(location.pathname!=='/portal/client')return;
const MARK='20260904-client-deals-authoritative-live-render-v1';
if(window.__RONA_CLIENT_DEALS_AUTHORITATIVE__===MARK)return;
window.__RONA_CLIENT_DEALS_AUTHORITATIVE__=MARK;

const API='/portal/api';
const ROOT_SELECTORS=['#page-deals','#dealsPage','[data-page-panel="deals"]','[data-page-id="deals"]'];
const LIST_ATTR='data-rona-deals-authoritative-list';
const CARD_ATTR='data-rona-deals-authoritative-rendered';
const DEAL_RE=/^DEAL-\d{4}-\d{3,}$/i;
const TERMINAL=new Set(['CLOSED','COMPLETED','DONE','CANCELLED','RESOURCE_DENIED']);
const state={busy:false,key:'',signature:'',payload:null,unsubscribe:null,observer:null,filterTimer:0,refreshTimer:0};
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const upper=v=>norm(v).toUpperCase();
const money=n=>{const v=Number(n);if(!Number.isFinite(v))return'';return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(v)};
const qty=n=>{const v=Number(n);if(!Number.isFinite(v))return'';return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(v)};
function root(){for(const s of ROOT_SELECTORS){const n=document.querySelector(s);if(n)return n}return null}
function authority(){return window.RONA_CLIENT_CONTEXT||null}
async function currentContext(){const a=authority();if(!a)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');return a.getCurrentContext()||await a.whenReady()}
function contextKey(c){return `${norm(c?.client_id)}|${norm(c?.contract_id)}`}
async function getJson(path){const r=await fetch(API+path,{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-deals-render':'authoritative-v1'}});const body=await r.json().catch(()=>null);if(!r.ok||body?.ok===false)throw new Error(body?.code||`HTTP_${r.status}`);return body}
function activeDeals(data){return (Array.isArray(data?.deals)?data.deals:[]).filter(d=>DEAL_RE.test(norm(d?.deal_id))&&!d?.closed_at&&!TERMINAL.has(upper(d?.current_status||d?.business_status)))}
function appMap(data){const m=new Map();for(const a of Array.isArray(data?.applications)?data.applications:[]){const id=norm(a?.deal_id);if(DEAL_RE.test(id)&&!m.has(id))m.set(id,a)}return m}
function detailText(a){if(!a)return'';const parts=[];const product=norm(a.product);if(product)parts.push(product);const q=qty(a.quantity_tonnes);if(q)parts.push(`${q} т`);const p=money(a.proposed_price),cur=upper(a.proposed_currency);if(p&&cur)parts.push(`${p} ${cur}/т`);const basis=norm(a.delivery_basis);if(basis)parts.push(basis);const dest=norm(a.destination);if(dest&&!parts.some(x=>x.toLocaleLowerCase('ru-RU').includes(dest.toLocaleLowerCase('ru-RU'))))parts.push(dest);return parts.join(' · ')}
function amountText(a){const q=Number(a?.quantity_tonnes),p=Number(a?.proposed_price),cur=upper(a?.proposed_currency);if(!Number.isFinite(q)||!Number.isFinite(p)||!cur)return'';return `${money(q*p)} ${cur}`}
function leaf(tag,text){const n=document.createElement(tag);n.textContent=text;return n}
function stateStrip(d){const strip=document.createElement('div');strip.setAttribute('data-rona-deal-state-strip','authoritative-v8');const values=[norm(d?.current_status_label),norm(d?.resource_label),norm(d?.payment_label)].filter(Boolean);for(const value of values){const chip=leaf('span',value);chip.setAttribute('data-rona-state-chip','true');strip.append(chip)}return strip}
function card(d,a){const id=norm(d.deal_id),host=document.createElement('article');host.className='rona-deal-card-v5';host.setAttribute(CARD_ATTR,'v1');host.dataset.ronaCanonicalDealId=id;host.dataset.ronaDealProjection='ADMIN_CLIENT_SERVER_V1';host.append(leaf('div',id));const detail=detailText(a);if(detail)host.append(leaf('div',detail));const amount=amountText(a);if(amount)host.append(leaf('div',amount));for(const value of [norm(d?.current_status_label),norm(d?.resource_label),norm(d?.payment_label)].filter(Boolean))host.append(leaf('div',value));const open=document.createElement('button');open.type='button';open.textContent='Открыть';open.setAttribute('data-open-deal',id);host.append(open,stateStrip(d));return host}
function existingCanonical(id){return [...document.querySelectorAll('[data-rona-canonical-deal-id]')].find(n=>norm(n.getAttribute('data-rona-canonical-deal-id'))===id&&!n.hasAttribute(CARD_ATTR))||null}
function ensureList(r){let list=r.querySelector(`[${LIST_ATTR}]`);if(!list){list=document.createElement('div');list.setAttribute(LIST_ATTR,'v1');r.append(list)}return list}
function applyFilters(){const r=root(),list=r?.querySelector?.(`[${LIST_ATTR}]`);if(!r||!list)return;const search=[...r.querySelectorAll('input')].find(n=>/ИД\s+сделки|товар|станц/iu.test(norm(n.placeholder)))||null;const stage=[...r.querySelectorAll('select')][0]||null;const q=norm(search?.value).toLocaleLowerCase('ru-RU'),stageValue=norm(stage?.value||stage?.selectedOptions?.[0]?.textContent);for(const c of list.querySelectorAll(`[${CARD_ATTR}]`)){const text=norm(c.textContent).toLocaleLowerCase('ru-RU');const searchOk=!q||text.includes(q);const stageOk=!stageValue||/^все\s+этап/iu.test(stageValue)||text.includes(stageValue.toLocaleLowerCase('ru-RU'));c.hidden=!(searchOk&&stageOk)}}
function scheduleFilters(){clearTimeout(state.filterTimer);state.filterTimer=setTimeout(applyFilters,40)}
function render(data){const r=root();if(!r)return;const list=ensureList(r),apps=appMap(data),deals=activeDeals(data);const sig=JSON.stringify(deals.map(d=>[d.deal_id,d.current_status,d.resource_status,d.payment_status,d.updated_at,apps.get(norm(d.deal_id))?.updated_at]));if(sig===state.signature&&list.children.length)return applyFilters();state.signature=sig;list.replaceChildren();for(const d of deals){const id=norm(d.deal_id);if(existingCanonical(id))continue;list.append(card(d,apps.get(id)))}list.dataset.ronaDealsCount=String(deals.length);document.documentElement.dataset.ronaClientDealsLiveRender='ready';window.dispatchEvent(new CustomEvent('rona:client:deals-rendered',{detail:{version:MARK,count:deals.length,context:state.key}}));applyFilters()}
async function refresh(reason='manual'){
  if(state.busy)return;state.busy=true;
  try{const ctx=await currentContext();if(!ctx){state.key='';state.payload={deals:[],applications:[]};render(state.payload);return}const key=contextKey(ctx);const path=`/v1/client/context?clientId=${encodeURIComponent(norm(ctx.client_id))}&contractId=${encodeURIComponent(norm(ctx.contract_id))}`;const payload=await getJson(path);if(contextKey(authority()?.getCurrentContext())!==key)return;state.key=key;state.payload=payload?.data||{};render(state.payload)}catch(error){console.error('RONA Client Deals authoritative render failed',reason,error);document.documentElement.dataset.ronaClientDealsLiveRender='error'}finally{state.busy=false}}
function onUiEvent(event){const r=root();if(!r||!r.contains(event.target))return;const reset=event.target?.closest?.('button');if(reset&&/^сбросить$/iu.test(norm(reset.textContent)))setTimeout(scheduleFilters,0);else scheduleFilters()}
function start(){const a=authority();if(a)state.unsubscribe=a.subscribe(ctx=>{const key=contextKey(ctx);if(key!==state.key){state.key=key;state.signature='';state.payload=null;const list=root()?.querySelector?.(`[${LIST_ATTR}]`);if(list)list.replaceChildren()}refresh('context-change')});else console.error('RONA Client Deals authoritative render: context authority unavailable');document.addEventListener('input',onUiEvent,true);document.addEventListener('change',onUiEvent,true);document.addEventListener('click',onUiEvent,true);state.observer=new MutationObserver(()=>{if(state.payload)render(state.payload)});state.observer.observe(document.documentElement,{childList:true,subtree:true});refresh('open');state.refreshTimer=window.setInterval(()=>refresh('interval'),30000);window.addEventListener('focus',()=>refresh('focus'),{passive:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh('visible')})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
