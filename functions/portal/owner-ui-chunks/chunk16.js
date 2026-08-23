export default `(()=>{'use strict';
if(window.__RONA_AI_LK_SYNC_OVERLAY__)return;
window.__RONA_AI_LK_SYNC_OVERLAY__=true;
const API='/portal/owner-api';
let adminSync=null;
let agentSync=null;
function q(s){return document.querySelector(s)}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined&&text!==null)n.textContent=String(text);return n}
function fmt(v,d){if(v===null||v===undefined||v==='')return '—';return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d===undefined?2:d}).format(Number(v))}
function makeCard(id,title){const c=el('section','rona-owner-card');c.id=id;c.append(el('h2','',title));return c}
function makeTable(headers,rows){const wrap=el('div','rona-owner-table-wrap');const t=el('table','rona-owner-table');const thead=el('thead');const hr=el('tr');for(const h of headers)hr.append(el('th','',h));thead.append(hr);const tbody=el('tbody');for(const row of rows){const tr=el('tr');for(const value of row)tr.append(el('td','',value===null||value===undefined?'—':value));tbody.append(tr)}t.append(thead,tbody);wrap.append(t);return wrap}
async function load(path){const r=await fetch(API+'?path='+encodeURIComponent(path),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json'}});let j={};try{j=await r.json()}catch(_e){}if(!r.ok||j.ok===false)throw new Error(j.code||('HTTP_'+r.status));return j.data||{}}
function tariffStatusRu(v){const m={WORKING_CONFIRMED:'Подтверждено',ROUTE_SPECIFIC_CONFIRMED:'Подтверждено для маршрута',HISTORICAL:'Исторический',TO_VERIFY:'Требует проверки',FX_DEPENDENT:'Зависит от курса'};return m[String(v)]||String(v||'—')}
function renderAdminTariffs(){const mon=q('#page-monitoring .rona-owner-page-content')||q('#page-monitoring');if(!mon||q('#ronaRailTariffMatrixCard'))return;const c=makeCard('ronaRailTariffMatrixCard','Матрица ЖД-тарифов');const xs=Array.isArray(adminSync?.railTariffs)?adminSync.railTariffs:[];if(xs.length){const rows=[];for(const x of xs)rows.push([x.product_group==='LPG_SPBT'?'СУГ / СПБТ':'Светлые нефтепродукты',x.territory||'—',x.route_text||'—',fmt(x.tariff_usd_per_t,2),x.source_provider||'—',tariffStatusRu(x.status)]);c.append(makeTable(['Товарная группа','Территория','Маршрут','USD/т','Источник','Статус'],rows))}else c.append(el('div','rona-owner-muted','Подтвержденные тарифы отсутствуют.'));c.append(el('div','rona-owner-muted','Тарифы являются расчетными логистическими данными и не подтверждают факт отгрузки или движения вагонов.'));mon.append(c)}
function renderAdmin(){q('#ronaAiEmployeesCard')?.remove();q('#ronaAiConclusionsCard')?.remove();if(adminSync)renderAdminTariffs()}
function renderAgent(){if(!agentSync)return;const root=q('#ronaOwnerAgentSummary');if(!root||q('#ronaAgentSettlementCard'))return;const c=makeCard('ronaAgentSettlementCard','Расчёт агента');const p=agentSync.displayPolicy;if(p){const pc=el('div','rona-owner-card');pc.append(el('strong','', 'Правило курсового эффекта: '+fmt(Number(p.positiveActualFxVisibleShare||0)*100,0)+'%'));pc.append(el('div','rona-owner-muted',p.note||''));c.append(pc)}const xs=Array.isArray(agentSync.settlements)?agentSync.settlements:[];if(xs.length){const rows=[];for(const x of xs){let amount=fmt(x.amount,2);if(x.currency)amount+=' '+x.currency;rows.push([x.dealId||'—',x.clientId||'—',x.stage||'—',amount,x.paymentObligationConfirmed?'Подтверждено':'Не подтверждено',x.paymentFactConfirmed?'Оплачено':'Нет факта оплаты'])}c.append(makeTable(['Сделка','Клиент','Стадия','Сумма','Обязательство','Оплата'],rows))}else c.append(el('div','rona-owner-muted','Подтвержденный расчет к выплате пока не сформирован.'));c.append(el('div','rona-owner-muted','Неподтвержденные, прогнозные и внутренние Finance/Accounting значения в ЛК не публикуются.'));root.append(c)}
async function refreshAdmin(){try{adminSync=await load('/admin/ai-sync');window.__RONA_OWNER_AI_SYNC_SNAPSHOT__=adminSync;renderAdmin();window.dispatchEvent(new CustomEvent('rona:finance-sync',{detail:{generatedAt:adminSync?.generatedAt||null,sourceAsOf:adminSync?.financeFragment?.sourceAsOf||null}}))}catch(e){window.__RONA_OWNER_AI_SYNC_ERROR__=String(e&&e.message?e.message:e)}}
async function refreshAgent(){try{agentSync=await load('/agent/ai-sync');window.__RONA_OWNER_AGENT_AI_SYNC_SNAPSHOT__=agentSync;renderAgent()}catch(e){window.__RONA_OWNER_AGENT_AI_SYNC_ERROR__=String(e&&e.message?e.message:e)}}
function startAdmin(){renderAdmin();refreshAdmin();setInterval(refreshAdmin,60000);new MutationObserver(renderAdmin).observe(document.body,{childList:true,subtree:true})}
function startAgent(){refreshAgent();setInterval(refreshAgent,60000);new MutationObserver(renderAgent).observe(document.body,{childList:true,subtree:true})}
function afterReady(flag,start){let tries=0;function tick(){if(window[flag]===true){start();return}tries++;if(tries<600)setTimeout(tick,100)}tick()}
function bootAdminSync(){afterReady('__RONA_OWNER_ADMIN_READY__',startAdmin)}
function bootAgentSync(){afterReady('__RONA_OWNER_AGENT_READY__',startAgent)}
const path=location.pathname;
if(path==='/portal/admin'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootAdminSync,{once:true});else bootAdminSync()}
else if(path==='/portal/agent'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootAgentSync,{once:true});else bootAgentSync()}
})();`;
