(()=>{'use strict';
const MARK='20260905-client-native-deal-context-bridge-v1';
if(window.__RONA_CLIENT_NATIVE_DEAL_CONTEXT_BRIDGE__===MARK)return;
window.__RONA_CLIENT_NATIVE_DEAL_CONTEXT_BRIDGE__=MARK;
if(location.pathname!=='/portal/client')return;
const norm=v=>String(v??'').replace(/\s+/g,' ').trim();
const upper=v=>norm(v).toUpperCase();
const TERMINAL=new Set(['CLOSED','COMPLETED','DONE','CANCELLED','RESOURCE_DENIED']);
const key=c=>`${norm(c?.client_id)}|${norm(c?.contract_id)}`;
const numberText=(n,max=3)=>{const v=Number(n);return Number.isFinite(v)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:max}).format(v):''};
function authority(){return window.RONA_CLIENT_CONTEXT||null}
function projectionPair(data){const contract=data?.contract||{},context=data?.context||{},client=data?.client||{};return{clients:[...new Set([data?.client_id,context.client_id,client.client_id,contract.client_id].map(norm).filter(Boolean))],contracts:[...new Set([data?.contract_id,context.contract_id,contract.contract_id].map(norm).filter(Boolean))]}}
function scoped(data,ctx){if(!data||!ctx)return false;const p=projectionPair(data);return p.clients.length>0&&p.contracts.length>0&&p.clients.every(v=>v===norm(ctx.client_id))&&p.contracts.every(v=>v===norm(ctx.contract_id))}
function legacyRecord(){try{return typeof activeClientContext==='function'?activeClientContext():null}catch{return null}}
function dealId(v){return norm(v?.deal_id||v?.id)}
function mapDeal(deal,app){const id=dealId(deal),currency=upper(app?.proposed_currency),price=numberText(app?.proposed_price,2),amountCurrency=upper(deal?.payment_currency),amount=numberText(deal?.payment_obligation_amount,2),qty=numberText(app?.quantity_tonnes,3),status=norm(deal?.current_status_label||deal?.current_status||deal?.business_status),resource=norm(deal?.resource_status_label||deal?.resource_label||deal?.resource_status);return{id,product:norm(app?.product),qty:qty?`${qty} т`:'',price:price&&currency?`${price} ${currency}/т`:'',amount:amount&&amountCurrency?`${amount} ${amountCurrency}`:'',basis:norm(app?.delivery_basis),station:norm(app?.destination),resource,next:norm(deal?.next_action||deal?.next_step),stage:status,status}}
function adopt(reason='projection'){
  const a=authority(),ctx=a?.getCurrentContext?.(),projection=a?.getCurrentProjection?.(),record=legacyRecord();
  if(!ctx||!record)return false;
  if(!projection||!scoped(projection,ctx)){record.deals=[];document.documentElement.dataset.ronaNativeDealBridge='pending';return false}
  const apps=new Map((Array.isArray(projection.applications)?projection.applications:[]).map(app=>[dealId(app),app]));
  const deals=(Array.isArray(projection.deals)?projection.deals:[]).filter(d=>{const id=dealId(d),status=upper(d?.current_status||d?.business_status);return /^DEAL-\d{4}-\d{3,}$/i.test(id)&&!d?.closed_at&&!TERMINAL.has(status)}).map(d=>mapDeal(d,apps.get(dealId(d))));
  record.deals=deals;
  document.documentElement.dataset.ronaNativeDealBridge='ready';
  document.documentElement.dataset.ronaNativeDealBridgeContext=key(ctx);
  window.dispatchEvent(new CustomEvent('rona:client-native-deal-context-bridge',{detail:{version:MARK,reason,client_id:norm(ctx.client_id),contract_id:norm(ctx.contract_id),deal_count:deals.length}}));
  return true;
}
window.addEventListener('rona:client-current-projection',()=>adopt('current-projection'));
window.addEventListener('rona:client-context-changed',()=>queueMicrotask(()=>adopt('context-change')));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>adopt('dom-ready'),{once:true});else queueMicrotask(()=>adopt('startup'));
})();
