export const CLIENT_DEAL_STATE_CONTRACT='RONA_CLIENT_DEAL_STATE_V1';
export const CLIENT_DEAL_LIFECYCLE_SOURCE='CLIENT_DEAL_STATE_V1';

const STAGE_ORDER=['contract','documents','resource','payment','logistics','close'];
const STAGE_NAMES={
  contract:'Оформление сделки',
  documents:'Подписание документов',
  resource:'Подтверждение ресурса',
  payment:'Оплата',
  logistics:'Отгрузка и поставка',
  close:'Закрывающие документы и завершение'
};

function text(v){return v===null||v===undefined?'':String(v).trim()}
function upper(v){return text(v).toUpperCase()}
function numberOrNull(v){if(v===null||v===undefined||v===''||v==='TO_VERIFY')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function positive(v){const n=numberOrNull(v);return n!==null&&n>0?n:null}
function array(v){return Array.isArray(v)?v:[]}
function object(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:null}
function stage(key,state,detail){return{key,name:STAGE_NAMES[key],state,detail:text(detail)}}

function paymentFacts(deal){
  const total=numberOrNull(deal?.payment_obligation_amount);
  const received=numberOrNull(deal?.payment_received_amount);
  const remaining=numberOrNull(deal?.payment_remaining_amount);
  const dueNow=numberOrNull(deal?.payment_due_now);
  const expectedNotDue=numberOrNull(deal?.payment_expected_not_due);
  const futureConditional=numberOrNull(deal?.payment_future_conditional);
  const percent=numberOrNull(deal?.payment_percent);
  const currency=upper(deal?.payment_currency)||upper(deal?.passport_currency)||null;
  const financeStatus=upper(deal?.payment_finance_status||deal?.finance_status);
  const authority=upper(deal?.payment_authority_state);
  let status='TO_VERIFY',label='Данные об оплате ещё не сформированы';

  if(authority==='AUTHORITATIVE'){
    if((total===0&&received===0)||(total!==null&&received!==null&&total>0&&received+0.01>=total)){
      status='PAID';label='Оплачено 100%';
    }else if(received!==null&&received>0){
      status='PARTIALLY_PAID';label=percent!==null?`Оплачено ${Math.max(0,Math.min(100,Math.round(percent)))}%`:'Оплата получена частично';
    }else if(financeStatus==='OVERDUE'){
      status='OVERDUE';label='Оплата просрочена';
    }else if(financeStatus==='NOT_DUE'||((dueNow===0||dueNow===null)&&((expectedNotDue||0)>0||(futureConditional||0)>0))){
      status='NOT_DUE';label='Срок оплаты ещё не наступил';
    }else if(financeStatus==='DUE'||financeStatus==='PAYMENT_DUE'||(dueNow!==null&&dueNow>0)){
      status='DUE';label='Ожидается оплата';
    }else if(financeStatus==='PAID'){
      status='PAID';label='Оплата подтверждена';
    }else{
      status='AWAITING_PAYMENT';label='Ожидается оплата';
    }
  }

  return{
    status,label,total,received,remaining,currency,percent,
    due_now:dueNow,expected_not_due:expectedNotDue,future_conditional:futureConditional,
    finance_status:financeStatus||null,
    documentary_status:upper(deal?.payment_documentary_status)||null,
    authority_state:authority||null,
    authority_id:text(deal?.payment_authority_id)||null,
    source:text(deal?.payment_source)||null,
    source_version:text(deal?.payment_source_version)||null,
    source_timestamp:deal?.payment_source_timestamp||null
  };
}

function latestPosition(positions){
  let best=null,bestTs=-Infinity;
  for(const row of positions){
    const raw=row?.eventTimestamp??row?.event_timestamp??row?.eventAtLocal??row?.event_at_local??row?.lastPositionAt??row?.last_position_at;
    const ts=raw?Date.parse(raw):NaN;
    const score=Number.isFinite(ts)?ts:0;
    if(!best||score>bestTs){best=row;bestTs=score}
  }
  if(!best)return null;
  return{
    wagon_number:text(best?.wagonNumber||best?.wagon_number)||null,
    station:best?.station??best?.currentStation??best?.current_station_name??null,
    station_code:best?.stationCode??best?.station_code??best?.currentStationCode??best?.current_station_code??null,
    operation:best?.operation??best?.currentOperation??best?.current_operation??null,
    event_at:best?.eventTimestamp??best?.event_timestamp??best?.eventAtLocal??best?.event_at_local??null,
    status:best?.positionStatus??best?.position_status??best?.effectiveResolutionStatus??best?.effective_resolution_status??null
  };
}

function railFacts(railModel,dealId){
  const model=object(railModel);
  const deals=array(model?.deals);
  const row=deals.find(d=>text(d?.dealId||d?.deal_id)===dealId)||null;
  if(!model||!row){
    return{
      available:false,operational_data_present:false,started:false,
      rail_document_count:0,wagon_count:0,actual_route_points:0,remaining_route_points:0,
      latest_position:null,route_resolution:null,generated_at:model?.generatedAt??model?.generated_at??null,
      model_version:text(model?.modelVersion||model?.model_version)||null,
      source_policy:text(model?.sourcePolicy||model?.source_policy)||null
    };
  }
  const railDocuments=array(row?.railDocuments||row?.rail_documents);
  const wagonPositions=array(row?.wagonPositions||row?.wagon_positions);
  const actualPoints=array(row?.actualRoute?.points||row?.actual_route?.points);
  const remainingPoints=array(row?.remainingRoute?.points||row?.remaining_route?.points);
  const started=railDocuments.length>0||wagonPositions.length>0||actualPoints.length>0;
  return{
    available:true,
    operational_data_present:started,
    started,
    rail_document_count:railDocuments.length,
    wagon_count:wagonPositions.length,
    actual_route_points:actualPoints.length,
    remaining_route_points:remainingPoints.length,
    latest_position:latestPosition(wagonPositions),
    route_resolution:text(row?.routeAssignment?.resolutionState||row?.route_assignment?.resolution_state)||null,
    generated_at:model?.generatedAt??model?.generated_at??null,
    model_version:text(model?.modelVersion||model?.model_version)||null,
    source_policy:text(model?.sourcePolicy||model?.source_policy)||null
  };
}

function resourceFacts(meta,deal){
  const status=upper(meta?.resource_status||deal?.resource_status);
  const source=text(meta?.resource_source||deal?.resource_source)||null;
  const confirmedAt=meta?.resource_confirmed_at||deal?.resource_confirmed_at||null;
  if(status==='RESOURCE_CONFIRMED')return{status,label:'Ресурс подтверждён',source,confirmed_at:confirmedAt};
  if(status==='RESOURCE_DENIED')return{status,label:'Ресурс не подтверждён',source,confirmed_at:confirmedAt};
  return{status:'RESOURCE_PENDING',label:'Ресурс ожидает подтверждения',source,confirmed_at:confirmedAt};
}

function primaryCurrentKey({closed,documentsSigned,resource,payment,rail}){
  if(closed)return null;
  if(rail.started)return'logistics';
  if(['PARTIALLY_PAID','DUE','OVERDUE','NOT_DUE','AWAITING_PAYMENT'].includes(payment.status))return'payment';
  if(resource.status==='RESOURCE_DENIED'||resource.status==='RESOURCE_PENDING')return'resource';
  if(!documentsSigned)return'documents';
  if(payment.status==='PAID')return'logistics';
  if(payment.status==='TO_VERIFY'&&resource.status==='RESOURCE_CONFIRMED')return'payment';
  return'logistics';
}

function nextStepFor(key,{payment,rail,resource,documentsSigned,closed}){
  if(closed)return'Сделка завершена';
  if(key==='documents')return documentsSigned?'Документы подтверждены':'Ожидается подписание документов';
  if(key==='resource')return resource.status==='RESOURCE_DENIED'?'Требуется решение по ресурсу':'Ожидается подтверждение ресурса';
  if(key==='payment'){
    if(payment.status==='PARTIALLY_PAID')return'Ожидается остаток оплаты';
    return payment.label;
  }
  if(key==='logistics'){
    if(!rail.available)return'Актуальные ЖД-данные временно недоступны';
    if(rail.started){
      const station=text(rail.latest_position?.station);
      return station?`Отгрузка выполняется · ${station}`:'Отгрузка выполняется';
    }
    return'Отгрузка ещё не начата';
  }
  if(key==='close')return'Ожидаются закрывающие документы';
  return'Актуальный следующий шаг ещё не сформирован';
}

export function projectClientCanonicalDealState({context,deal,application,meta,railModel,generatedAt}){
  const dealId=text(deal?.deal_id);
  if(!dealId)throw new Error('CLIENT_DEAL_STATE_DEAL_REQUIRED');
  const documentsSigned=meta?.signed_documents_confirmed===true;
  const businessStatus=upper(deal?.business_status||deal?.current_status);
  const accountingStatus=upper(deal?.accounting_closure_status);
  const closed=['CLOSED','COMPLETED','DONE'].includes(businessStatus)||['CLOSED','COMPLETED','DONE'].includes(accountingStatus)||Boolean(deal?.closed_at);
  const payment=paymentFacts(deal);
  const rail=railFacts(railModel,dealId);
  const resource=resourceFacts(meta,deal);
  const currentKey=primaryCurrentKey({closed,documentsSigned,resource,payment,rail});

  const contractStage=stage('contract','DONE','Сделка зарегистрирована');
  let documentsStage=stage('documents',documentsSigned?'DONE':'PENDING',documentsSigned?'Подписанные документы подтверждены':'Подписанные документы по сделке ещё не сформированы');
  let resourceStage=resource.status==='RESOURCE_CONFIRMED'
    ?stage('resource','DONE',resource.label)
    :resource.status==='RESOURCE_DENIED'
      ?stage('resource','BLOCKED',resource.label)
      :stage('resource','PENDING',resource.label);
  let paymentStage=payment.status==='PAID'
    ?stage('payment','DONE',payment.label)
    :stage('payment','PENDING',payment.label);
  let logisticsStage=closed
    ?stage('logistics','DONE','Поставка завершена')
    :!rail.available
      ?stage('logistics','PENDING','Актуальные ЖД-данные временно недоступны')
      :rail.started
        ?stage('logistics','CURRENT',nextStepFor('logistics',{payment,rail,resource,documentsSigned,closed}))
        :stage('logistics','PENDING','ЖД-данные появятся после начала отгрузки');
  const closeStage=closed
    ?stage('close','DONE','Сделка завершена')
    :stage('close','PENDING','Закрывающие документы ещё не сформированы');

  if(currentKey==='documents'&&documentsStage.state==='PENDING')documentsStage={...documentsStage,state:'CURRENT'};
  if(currentKey==='resource'&&resourceStage.state==='PENDING')resourceStage={...resourceStage,state:'CURRENT'};
  if(currentKey==='payment'&&paymentStage.state==='PENDING')paymentStage={...paymentStage,state:'CURRENT'};
  if(currentKey==='logistics'&&logisticsStage.state==='PENDING'){
    logisticsStage={...logisticsStage,state:'CURRENT',detail:rail.available?'Отгрузка ещё не начата':'Актуальные ЖД-данные временно недоступны'};
  }

  const stages=[contractStage,documentsStage,resourceStage,paymentStage,logisticsStage,closeStage];
  const nextStep=nextStepFor(currentKey,{payment,rail,resource,documentsSigned,closed});
  const app=application||{};
  const quantity=positive(deal?.confirmed_quantity_tonnes)??positive(app?.quantity_tonnes);
  const unitPrice=positive(deal?.passport_unit_price)??positive(app?.proposed_price);
  const currencyCode=upper(deal?.passport_currency||app?.proposed_currency)||null;
  const amount=positive(deal?.passport_amount);

  return{
    source:CLIENT_DEAL_STATE_CONTRACT,
    generated_at:generatedAt||new Date().toISOString(),
    context:{
      client_id:text(context?.client_id),
      contract_id:text(context?.contract_id),
      legal_name:text(context?.legal_name)||null,
      current_external_contract_number:text(context?.current_external_contract_number)||null
    },
    deal:{
      deal_id:dealId,
      business_status:businessStatus||null,
      product:text(app?.product)||null,
      quantity_tonnes:quantity,
      unit_price:unitPrice,
      amount,
      currency:currencyCode,
      delivery_basis:text(app?.delivery_basis)||null,
      destination:text(app?.destination)||null,
      application_id:text(deal?.passport_application_id||app?.application_id)||null,
      economics_source:text(deal?.passport_amount_source)||null,
      updated_at:deal?.updated_at||null
    },
    facts:{
      documents:{signed_confirmed:documentsSigned,source:text(meta?.documents_source)||'DEAL_DOCUMENTS_CURRENT'},
      resource,
      payment,
      rail
    },
    realization_status:{
      source:CLIENT_DEAL_LIFECYCLE_SOURCE,
      completed_count:stages.filter(s=>s.state==='DONE').length,
      total_count:stages.length,
      current_stage_key:currentKey,
      has_blocker:stages.some(s=>s.state==='BLOCKED'),
      stages
    },
    next_step:nextStep
  };
}
