export const CLIENT_RAIL_CANONICAL_CONTRACT="RONA_CLIENT_RAIL_ADMIN_PARITY_V1";
export const CLIENT_RAIL_OVERLAY_MODE="DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1";

function text(value){return value===null||value===undefined?"":String(value).trim()}
function array(value){return Array.isArray(value)?value:[]}
function object(value){return value&&typeof value==="object"&&!Array.isArray(value)?value:null}

function sameDeal(value,scope){
  const dealId=text(value?.dealId||value?.deal_id);
  const dealKey=text(value?.dealKey||value?.deal_key);
  return (dealId&&dealId===text(scope.deal_id))||(dealKey&&dealKey===text(scope.deal_key));
}

function normalizeRoute(route,fallbackStatus){
  const source=object(route);
  if(!source)return {status:fallbackStatus,points:[],geometry:null,provenance:null};
  return {
    status:text(source.status)||fallbackStatus,
    points:array(source.points),
    geometry:source.geometry??null,
    provenance:source.provenance??null,
  };
}

function positionForUi(position){
  const p=object(position)||{};
  const eventTimestamp=p.eventTimestamp??p.event_timestamp??null;
  const eventAtLocal=p.eventAtLocal??p.event_at_local??null;
  const displayTimestamp=eventTimestamp??eventAtLocal??null;
  return {
    wagonNumber:text(p.wagonNumber||p.wagon_number)||null,
    station:p.station??p.currentStation??p.current_station_name??null,
    stationCode:p.stationCode??p.currentStationCode??p.current_station_code??null,
    operation:p.operation??p.currentOperation??p.current_operation??null,
    operationAt:displayTimestamp,
    lastPositionAt:displayTimestamp,
    status:p.positionStatus??p.position_status??p.effectiveResolutionStatus??p.effective_resolution_status??null,
    positionStatus:p.positionStatus??p.position_status??null,
    effectiveResolutionStatus:p.effectiveResolutionStatus??p.effective_resolution_status??null,
    eventAtLocal,
    sourceTimezoneStatus:p.sourceTimezoneStatus??p.source_timezone_status??null,
    trustedCoordinates:p.trustedCoordinates??p.trusted_coordinates??null,
    provenance:p.provenance??null,
  };
}

function railDocumentsForUi(deal,scope){
  const documents=array(deal?.railDocuments);
  const positions=array(deal?.wagonPositions);
  return documents.map(doc=>{
    const documentKey=text(doc?.railDocumentKey||doc?.rail_document_key);
    const documentId=text(doc?.railDocumentId||doc?.rail_document_id);
    const wagons=positions
      .filter(p=>{
        const pKey=text(p?.railDocumentKey||p?.rail_document_key);
        const pId=text(p?.railDocumentId||p?.rail_document_id);
        return (documentKey&&pKey===documentKey)||(documentId&&pId===documentId);
      })
      .map(positionForUi)
      .filter(w=>w.wagonNumber);
    return {
      rail_document_key:documentKey||null,
      rail_document_id:documentId||null,
      gu12_number:doc?.gu12Number??doc?.gu12_number??null,
      document_number:doc?.documentNumber??doc?.document_number??null,
      document_date:doc?.documentDate??doc?.document_date??null,
      route_text:doc?.routeText??doc?.route_text??null,
      deal_key:text(scope.deal_key)||null,
      deal_id:text(scope.deal_id)||null,
      wagons,
    };
  });
}

function publishByDeal(target,scope,value){
  if(!value)return;
  const key=text(scope.deal_key),id=text(scope.deal_id);
  if(key)target[key]=value;
  if(id)target[id]=value;
}

function dealReadModel(readModel,scope){
  const deals=array(readModel?.deals).filter(d=>sameDeal(d,scope));
  if(deals.length!==1){
    const error=new Error(deals.length?"CLIENT_RAIL_CANONICAL_SCOPE_AMBIGUOUS":"CLIENT_RAIL_CANONICAL_DEAL_MISSING");
    error.code=deals.length?"CLIENT_RAIL_CANONICAL_SCOPE_AMBIGUOUS":"CLIENT_RAIL_CANONICAL_DEAL_MISSING";
    throw error;
  }
  return deals[0];
}

export function projectClientRailCanonical({context,deals,readModels}){
  if(!context||!text(context.client_id)||!text(context.contract_id))throw new Error("CLIENT_RAIL_CONTEXT_REQUIRED");
  const scopes=array(deals);
  const models=array(readModels);
  if(models.length!==scopes.length)throw new Error("CLIENT_RAIL_CANONICAL_MODEL_COUNT_MISMATCH");

  const rail=[];
  const projectedDeals=[];
  const plannedRouteByDeal={};
  const actualRouteByDeal={};
  const remainingRouteByDeal={};
  const routeProgressByDeal={};
  const routeStationsByDeal={};
  const routeAssignmentByDeal={};
  const exchangeByDeal={};
  let activeTargets=0;
  let conflicts=0;
  let modelVersion=null;
  let sourcePolicy=null;
  let generatedAt=null;

  scopes.forEach((scope,index)=>{
    const model=models[index];
    if(!object(model)||!text(model.modelVersion)||!text(model.sourcePolicy)){
      throw new Error("CLIENT_RAIL_CANONICAL_READ_MODEL_DEGRADED");
    }
    if(modelVersion&&modelVersion!==text(model.modelVersion))throw new Error("CLIENT_RAIL_CANONICAL_MODEL_VERSION_CONFLICT");
    if(sourcePolicy&&sourcePolicy!==text(model.sourcePolicy))throw new Error("CLIENT_RAIL_CANONICAL_SOURCE_POLICY_CONFLICT");
    modelVersion=text(model.modelVersion);
    sourcePolicy=text(model.sourcePolicy);
    generatedAt=model.generatedAt??model.generated_at??generatedAt;

    const deal=dealReadModel(model,scope);
    const positions=array(deal.wagonPositions);
    const trusted=positions.filter(p=>text(p?.positionStatus||p?.position_status).toUpperCase()==="TRUSTED").length;
    const unresolved=Number(deal.unresolvedOrConflictCount??deal.unresolved_or_conflict_count??0)||0;
    if(trusted>0)activeTargets+=1;
    conflicts+=unresolved;

    projectedDeals.push({
      deal_key:text(scope.deal_key),
      deal_id:text(scope.deal_id),
      business_status:scope.business_status??null,
      lifecycle_state:scope.lifecycle_state??"ACTIVE",
      client_id:text(context.client_id),
      contract_id:text(context.contract_id),
    });

    rail.push(...railDocumentsForUi(deal,scope));

    const planned=array(deal.plannedRoute);
    publishByDeal(plannedRouteByDeal,scope,normalizeRoute(planned[0]||null,"SOURCE_NOT_AVAILABLE"));
    publishByDeal(actualRouteByDeal,scope,normalizeRoute(deal.actualRoute,"NO_OBSERVED_HISTORY"));
    publishByDeal(remainingRouteByDeal,scope,normalizeRoute(deal.remainingRoute,"ROUTE_REMAINDER_UNAVAILABLE"));
    publishByDeal(routeProgressByDeal,scope,object(deal.routeProgress));
    publishByDeal(routeStationsByDeal,scope,array(deal.routeStations));
    publishByDeal(routeAssignmentByDeal,scope,object(deal.routeAssignment));
    exchangeByDeal[text(scope.deal_key)]={
      active_targets:trusted>0?1:0,
      conflicts:unresolved,
      trusted_positions:trusted,
    };
  });

  return {
    contract:CLIENT_RAIL_CANONICAL_CONTRACT,
    generatedAt:generatedAt??new Date(0).toISOString(),
    deals:projectedDeals,
    rail,
    exchange:{
      active_targets:activeTargets,
      conflicts,
      by_deal:exchangeByDeal,
    },
    plannedRouteByDeal,
    actualRouteByDeal,
    remainingRouteByDeal,
    routeProgressByDeal,
    routeStationsByDeal,
    routeAssignmentByDeal,
    railReadModel:{
      modelVersion,
      sourcePolicy,
      generatedAt,
      overlayMode:CLIENT_RAIL_OVERLAY_MODE,
      authorityScope:"AUTHENTICATED_CLIENT_CONTRACT",
      clientId:text(context.client_id),
      contractId:text(context.contract_id),
    },
    clientRailAuthority:{
      contract:CLIENT_RAIL_CANONICAL_CONTRACT,
      scope:"AUTHENTICATED_CLIENT_CONTRACT",
      clientId:text(context.client_id),
      contractId:text(context.contract_id),
      dealCount:projectedDeals.length,
      dealIds:projectedDeals.map(d=>d.deal_id),
      serverDerived:true,
      queryValuesUsedAsAuthorization:false,
    },
  };
}
