import {
  buildConfirmedFundingAggregate,
  buildPaymentsCurrencyAggregates,
} from '../_shared/admin-payments-v7/confirmed-funding-aggregate.mjs';

export const ADMIN_PAYMENTS_EXECUTION_ACTIVE_ONLY_V1='ADMIN_PAYMENTS_EXECUTION_ACTIVE_ONLY_V1';

function upper(value){return String(value??'').trim().toUpperCase()}
function amount(value){
  if(!value||typeof value!=='object'||value.amount===null||value.amount===undefined)return null;
  const n=Number(value.amount);
  return Number.isFinite(n)?n:null;
}
function authoritativeMoney(value){
  return Boolean(value&&typeof value==='object'&&upper(value.status)==='AUTHORITATIVE'&&amount(value)!==null);
}

export function dealExitedExecutionMonitoring(deal,candidateDealKeys=[]){
  const key=String(deal?.deal_key||'').trim();
  if(!key)return false;
  const candidates=candidateDealKeys instanceof Set?candidateDealKeys:new Set((candidateDealKeys||[]).map(String));
  if(!candidates.has(key))return false;
  if(upper(deal?.financial_status)!=='PAID')return false;

  const total=deal?.total_to_receive;
  const received=deal?.verified_received;
  const remaining=deal?.remaining_to_receive;
  if(!authoritativeMoney(total)||!authoritativeMoney(received)||!authoritativeMoney(remaining))return false;
  if(upper(total.currency)!==upper(received.currency)||upper(total.currency)!==upper(remaining.currency))return false;

  const totalAmount=amount(total);
  const receivedAmount=amount(received);
  const remainingAmount=amount(remaining);
  return totalAmount>0
    && Math.abs(remainingAmount)<=0.01
    && receivedAmount+0.01>=totalAmount;
}

export function applyAdminPaymentsExecutionMonitoringScope(projection,candidateDealKeys=[]){
  if(!projection||projection.contract!=='ADMIN_PAYMENTS_V7')throw new Error('ADMIN_PAYMENTS_V7_PROJECTION_REQUIRED');
  const candidates=candidateDealKeys instanceof Set?candidateDealKeys:new Set((candidateDealKeys||[]).map(String));
  const excluded=[];
  const deals=(projection.deals||[]).filter((deal)=>{
    if(!dealExitedExecutionMonitoring(deal,candidates))return true;
    excluded.push(String(deal?.deal_id||deal?.deal_key||'').trim());
    return false;
  });
  return {
    ...projection,
    deals,
    payment_passports:deals.map((deal)=>deal?.payment_passport).filter(Boolean),
    funding_aggregate:buildConfirmedFundingAggregate(deals),
    currency_aggregates:buildPaymentsCurrencyAggregates(deals),
    execution_monitoring_scope:ADMIN_PAYMENTS_EXECUTION_ACTIVE_ONLY_V1,
    execution_monitoring_excluded_deal_ids:excluded.filter(Boolean).sort(),
    execution_monitoring_excluded_count:excluded.length,
  };
}
