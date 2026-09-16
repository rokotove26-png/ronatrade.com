export const APPLICATION_BUSINESS_CONTRACT='RONA_APPLICATION_BUSINESS_V2';
const businessId=/^.+-IN-[0-9]{4}-[0-9]{3,}$/;
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
export function validateApplicationProjection(projection,scope=null){
  if(projection?.contract!==APPLICATION_BUSINESS_CONTRACT||!Array.isArray(projection.applications))throw new Error('APPLICATION_CANONICAL_PROJECTION_REQUIRED');
  const seen=new Set();
  for(const row of projection.applications){
    if(row?.business_contract!==APPLICATION_BUSINESS_CONTRACT||row?.record_kind!=='CLIENT_APPLICATION'
      ||typeof row.application_id!=='string'||!businessId.test(row.application_id)||seen.has(row.application_id))throw new Error('APPLICATION_CANONICAL_ID_INVALID');
    seen.add(row.application_id);
    for(const key of ['client_id','client_name','contract_id','product','status','lifecycle_state','business_bucket']){
      if(typeof row[key]!=='string'||!row[key].trim())throw new Error('APPLICATION_REQUIRED_FIELD_MISSING:'+key);
    }
    if(scope&&(row.client_id!==scope.clientId||row.contract_id!==scope.contractId))throw new Error('APPLICATION_SCOPE_CONFLICT');
    if(row.quantity_tonnes===null||row.quantity_tonnes===''||!Number.isFinite(Number(row.quantity_tonnes))||Number(row.quantity_tonnes)<=0)throw new Error('APPLICATION_QUANTITY_INVALID');
    if(!['NEW','WORK','DECISION','COMPLETED'].includes(row.business_bucket))throw new Error('APPLICATION_LIFECYCLE_INVALID');
    if(!own(row,'application_price')||!own(row,'application_currency')||!own(row,'deal_id'))throw new Error('APPLICATION_PROJECTION_INCOMPLETE');
    if(row.application_price!==null&&(!Number.isFinite(Number(row.application_price))||Number(row.application_price)<=0||! /^[A-Z]{3}$/.test(row.application_currency||'')))throw new Error('APPLICATION_PRICE_AUTHORITY_INVALID');
    if(row.price_is_owner_agreed===true&&(row.price_is_agreed!==true||row.application_price===null))throw new Error('APPLICATION_AGREEMENT_AUTHORITY_MISSING');
  }
  const kpi=projection.application_kpi;
  if(kpi?.source!==APPLICATION_BUSINESS_CONTRACT||Number(kpi.total)!==seen.size)throw new Error('APPLICATION_KPI_PROJECTION_CONFLICT');
  for(const key of ['total','active','new','in_work','decision','completed','deal_registered']){
    if(!Number.isSafeInteger(kpi[key])||kpi[key]<0)throw new Error('APPLICATION_KPI_FIELD_INVALID:'+key);
  }
  if(kpi.tonnage===null||kpi.tonnage===''||!Number.isFinite(Number(kpi.tonnage))||Number(kpi.tonnage)<0)throw new Error('APPLICATION_KPI_TONNAGE_INVALID');
  if(kpi.amounts!==null&&(!Array.isArray(kpi.amounts)||kpi.amounts.some(x=>!Number.isFinite(Number(x.amount))||! /^[A-Z]{3}$/.test(x.currency||''))))throw new Error('APPLICATION_KPI_AMOUNTS_INVALID');
  return projection;
}
export function applyCanonicalApplications(base,projection,scope=null){
  validateApplicationProjection(projection,scope);
  if(!base||typeof base!=='object'||Array.isArray(base))throw new Error('APPLICATION_BOOTSTRAP_INVALID');
  // Replace only this business collection. Do not merge technical events or synthesize archived rows.
  return {...base,applications:projection.applications,application_kpi:projection.application_kpi,
    application_business_contract:APPLICATION_BUSINESS_CONTRACT};
}
export function projectionFromData(data){
  return {contract:data?.application_business_contract,applications:data?.applications,application_kpi:data?.application_kpi};
}
