export const REALIZATION_SOURCE='SERVER_AUTHORITATIVE_REALIZATION_V2_CURRENT_PROJECTION';
const upper=value=>String(value??'').trim().toUpperCase();
const resourceLabel=status=>status==='RESOURCE_CONFIRMED'?'Ресурс подтверждён':status==='RESOURCE_DENIED'?'Ресурс не подтверждён':'Ресурс ожидает подтверждения';
const stage=(key,state,detail)=>({key,state,detail});
export function projectAuthoritativeOperationalState(deal,row={}){
  const business=upper(row.deal_business_status||deal?.business_status);
  const closed=['CLOSED','COMPLETED','DONE'].includes(business);
  const resource=upper(row.resource_status)||'RESOURCE_PENDING';
  const documentsDone=Boolean(row.signed_supplement_document_key&&row.signed_supplement_checked_at);
  const resourceDone=resource==='RESOURCE_CONFIRMED';
  const resourceDenied=resource==='RESOURCE_DENIED';
  const payment=upper(deal?.payment_status);
  const paymentDone=['PAID','PAYMENT_CONFIRMED'].includes(payment);
  const paymentBlocked=payment==='OVERDUE';
  const executing=business==='EXECUTING';
  const stages=[
    stage('contract','DONE','Сделка зарегистрирована'),
    stage('documents',closed||documentsDone?'DONE':'CURRENT',closed||documentsDone?'Подписанные документы подтверждены системой':'Ожидается подтверждение подписанных документов'),
    stage('resource',closed||resourceDone?'DONE':resourceDenied?'BLOCKED':documentsDone?'CURRENT':'PENDING',closed||resourceDone?'Ресурс подтверждён':resourceDenied?'Ресурс не подтверждён':'Ожидается подтверждение ресурса'),
    stage('payment',closed||paymentDone?'DONE':paymentBlocked?'BLOCKED':resourceDone?'CURRENT':'PENDING',closed||paymentDone?'Оплата подтверждена':paymentBlocked?'Оплата просрочена':'Ожидается подтверждение оплаты'),
    stage('logistics',closed?'DONE':executing?'CURRENT':'PENDING',closed?'Отгрузка и поставка завершены':executing?'Сделка находится в исполнении':'Отгрузка ещё не подтверждена'),
    stage('close',closed?'DONE':'PENDING',closed?'Сделка завершена':'Завершение сделки ещё не подтверждено')
  ];
  return{
    resource_status:resource,
    resource_label:resourceLabel(resource),
    resource_source:String(row.resource_source||'NO_AUTHORITATIVE_RESOURCE_FACT'),
    resource_confirmed_at:row.resource_confirmed_at||null,
    resource_confirmed:resourceDone,
    realization_status:{source:REALIZATION_SOURCE,stages}
  };
}
export function applyAuthoritativeOperationalState(deal,row={}){
  Object.assign(deal,projectAuthoritativeOperationalState(deal,row));
  return deal;
}
