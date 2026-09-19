import "./client-deal-economics-projection.ts";
import "./client-payments-v7-projection.ts";
import { sql, type Ctx } from "./shared.ts";
export async function clientBootstrap(c:Ctx){
  const contexts=await sql`select distinct cl.client_id,cl.legal_name,cl.registration_country,cl.registered_address,bp.contact_phone,ct.contract_id,ct.current_external_contract_number,ct.contract_status,ct.effective_from,ct.effective_to,ct.signed_contract_confirmed_at,ct.updated_at from portal_private.client_user_bindings b join portal_private.clients cl on cl.id=b.client_key join portal_private.contracts ct on ct.id=b.contract_key left join portal_private.client_user_binding_profiles bp on bp.binding_id=b.id where b.user_id=${c.user}::uuid and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now()) order by cl.legal_name,ct.contract_id`;
  const priceAuthority=await sql`
    select distinct on (ops.source_publication_item_key)
      ops.source_publication_item_key as publication_item_id,
      p.publication_id,
      p.status::text as publication_status,
      p.authority_state::text as publication_authority_state,
      p.lifecycle_state::text as publication_lifecycle_state,
      pi.authority_state::text as item_authority_state,
      pi.lifecycle_state::text as item_lifecycle_state,
      ops.product,
      ops.producer,
      ops.supplier,
      ops.basis as snapshot_basis,
      ops.final_station,
      ops.sale_price as snapshot_price,
      ops.currency as snapshot_currency,
      ops.payment_terms,
      ops.commercial_terms,
      ops.business_status,
      ops.publish_client,
      ops.client_published_at,
      ops.updated_at
    from portal_private.owner_price_snapshots ops
    join portal_private.publication_items pi on pi.id=ops.source_publication_item_key
    join portal_private.publications p on p.id=pi.publication_key
    where ops.source_publication_item_key is not null
      and ops.business_status='PUBLISHED'
      and ops.publish_client=true
      and p.status='PUBLISHED'::portal_private.publication_status_enum
      and p.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pi.item_type='PRICE'::portal_private.publication_item_type_enum
      and pi.distribution_allowed=true
      and pi.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      and pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and p.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
      and pi.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC')
      and (pi.valid_from is null or pi.valid_from<=now())
      and (pi.valid_to is null or pi.valid_to>=now())
      and (
        (p.audience<>'SELECTED_CLIENTS' and pi.audience<>'SELECTED_CLIENTS')
        or exists(
          select 1
          from portal_private.publication_client_targets pct
          join portal_private.client_user_bindings b on b.client_key=pct.client_key
          where b.user_id=${c.user}::uuid
            and b.status='ACTIVE'::portal_private.binding_status_enum
            and b.revoked_at is null
            and portal_private.client_user_has_contract_access(${c.user}::uuid,b.contract_key,now())
            and pct.publication_key=p.id
            and (pct.target_scope='PUBLICATION' or (pct.target_scope='ITEM' and pct.publication_item_key=pi.id))
        )
      )
    order by ops.source_publication_item_key,ops.updated_at desc
  `;
  return{generated_at:new Date().toISOString(),data_contract:"1.4",requires_context_selection:contexts.length>1,contexts,price_authority:priceAuthority,selected_context:null,applications:[] as unknown[],deals:[] as unknown[],documents:[] as unknown[],payments:[] as unknown[],shipments:[] as unknown[],rail_documents:[] as unknown[],market:[] as unknown[],notifications:[] as unknown[]}
}
export async function clientShipments(c:Ctx,clientId:string,contractId:string){
  const context=await sql`select ct.id as contract_key,cl.id as client_key from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id where cl.client_id=${clientId} and ct.contract_id=${contractId} and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now()) limit 1`;
  if(context.length!==1)return null;
  return await sql`select s.id as shipment_key,s.shipment_id,d.deal_id,s.shipment_status::text,s.origin_location,s.destination_location,s.planned_departure_at,s.actual_departure_at,s.planned_arrival_at,s.actual_arrival_at,s.closed_at from portal_private.shipments s join portal_private.deals d on d.id=s.deal_key join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key where cl.client_id=${clientId} and ct.contract_id=${contractId} and s.client_key=cl.id and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now()) and portal_private.client_user_has_shipment_access(${c.user}::uuid,s.id,now()) order by s.created_at desc`;
}

export async function clientRailReadModel(c:Ctx,clientId:string,contractId:string){
  const context=await sql\`select ct.id as contract_key,cl.id as client_key
    from portal_private.clients cl
    join portal_private.contracts ct on ct.client_key=cl.id
    where cl.client_id=\${clientId}
      and ct.contract_id=\${contractId}
      and portal_private.client_user_has_contract_access(\${c.user}::uuid,ct.id,now())
    limit 1\`;
  if(context.length!==1)return null;

  const deals=await sql\`select d.id::text as deal_key,d.deal_id,d.business_status::text,d.lifecycle_state::text,d.opened_at,d.updated_at
    from portal_private.deals d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    where cl.client_id=\${clientId}
      and ct.contract_id=\${contractId}
      and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and portal_private.client_user_has_deal_access(\${c.user}::uuid,d.id,now())
    order by d.deal_id\`;
  const dealKeys=deals.map((row:any)=>String(row.deal_key||"")).filter(Boolean);
  const generatedAt=new Date().toISOString();

  if(!dealKeys.length){
    return{
      projection_contract:"CLIENT_RAIL_ADMIN_PARITY_V1",
      generated_at:generatedAt,
      deals:[],
      rail:[],
      exchange:{active_targets:0,conflicts:0,by_deal:{}},
      plannedRouteByDeal:{},
      actualRouteByDeal:{},
      remainingRouteByDeal:{},
      routeProgressByDeal:{},
      routeStationsByDeal:{},
      routeAssignmentByDeal:{},
      railReadModel:{
        modelVersion:"RONA_CLIENT_RAIL_DEAL_MAP_READ_MODEL_V1",
        sourcePolicy:"AUTHORIZED_CLIENT_DEALS_PLUS_TRUSTED_RAIL_EVIDENCE_V1",
        generatedAt,
        overlayMode:"DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1"
      },
      clientRailScope:{clientId,contractId,dealCount:0}
    };
  }

  const docs=await sql\`select rd.id::text as rail_document_key,rd.rail_document_id,rd.gu12_number,rd.document_number,rd.document_date,rd.route_text,
      d.id::text as deal_key,d.deal_id
    from portal_private.rail_documents rd
    join portal_private.deals d on d.id=rd.deal_key
    where d.id in (select value::uuid from jsonb_array_elements_text(\${sql.json(dealKeys)}::jsonb))
      and rd.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and portal_private.client_user_has_deal_access(\${c.user}::uuid,d.id,now())
    order by d.deal_id,rd.document_date nulls last,rd.rail_document_id\`;

  const positions=await sql\`select cp.effective_deal_key::text as deal_key,cp.wagon_number,
      cp.current_rail_document_key::text as current_rail_document_key,
      rd.rail_document_id,rd.gu12_number,
      cp.current_station_name,cp.current_station_code,cp.current_operation,
      cp.current_event_at,cp.current_event_at_local,cp.current_raw_timestamp,
      cp.position_status,cp.effective_resolution_status,
      cp.comparison_domain_count,cp.candidate_observation_count,
      g.latitude,g.longitude,g.canonical_station_name
    from portal_private.rail_xlsx_dislocation_current_position_v1 cp
    join portal_private.deals d on d.id=cp.effective_deal_key
    left join portal_private.rail_documents rd on rd.id=cp.current_rail_document_key
    left join portal_private.rail_station_geo_directory_v1 g
      on g.esr_code=cp.current_station_code and g.authority_state='CONFIRMED'
    where d.id in (select value::uuid from jsonb_array_elements_text(\${sql.json(dealKeys)}::jsonb))
      and portal_private.client_user_has_deal_access(\${c.user}::uuid,d.id,now())
    order by d.deal_id,cp.wagon_number\`;

  const assignments=await sql\`select a.deal_key::text as deal_key,a.resolution_state,a.origin_esr_code,a.destination_esr_code,
      a.origin_authority,a.destination_authority,a.route_hop_count,a.route_nodes,a.route_source_refs,a.resolved_at,a.refreshed_at,
      portal_private.rail_deal_route_progress_v1(a.deal_key) as progress
    from portal_private.rail_deal_route_assignments_v1 a
    join portal_private.deals d on d.id=a.deal_key
    where d.id in (select value::uuid from jsonb_array_elements_text(\${sql.json(dealKeys)}::jsonb))
      and portal_private.client_user_has_deal_access(\${c.user}::uuid,d.id,now())\`;

  const docsByDeal=new Map<string,any[]>();
  for(const doc of docs){const key=String(doc.deal_key||"");if(!docsByDeal.has(key))docsByDeal.set(key,[]);docsByDeal.get(key)!.push(doc)}
  const positionsByDeal=new Map<string,any[]>();
  for(const row of positions){const key=String(row.deal_key||"");if(!positionsByDeal.has(key))positionsByDeal.set(key,[]);positionsByDeal.get(key)!.push(row)}
  const assignmentByDeal=new Map(assignments.map((row:any)=>[String(row.deal_key||""),row]));

  const plannedRouteByDeal:any={},actualRouteByDeal:any={},remainingRouteByDeal:any={},routeProgressByDeal:any={},routeStationsByDeal:any={},routeAssignmentByDeal:any={};
  const publish=(target:any,deal:any,value:any)=>{if(value===null||value===undefined)return;const key=String(deal.deal_key||""),id=String(deal.deal_id||"");if(key)target[key]=value;if(id)target[id]=value};

  const railReadDeals=deals.map((deal:any)=>{
    const key=String(deal.deal_key),dealDocs=docsByDeal.get(key)||[],dealPositions=positionsByDeal.get(key)||[],assignment=assignmentByDeal.get(key);
    const wagonPositions=dealPositions.map((p:any)=>({
      wagonNumber:p.wagon_number,
      railDocumentKey:p.current_rail_document_key||null,
      railDocumentId:p.rail_document_id||null,
      gu12Number:p.gu12_number||null,
      station:p.current_station_name||null,
      stationCode:p.current_station_code||null,
      operation:p.current_operation||null,
      eventTimestamp:p.current_event_at||null,
      eventAtLocal:p.current_event_at_local||null,
      rawTimestamp:p.current_raw_timestamp||null,
      positionStatus:p.position_status||null,
      effectiveResolutionStatus:p.effective_resolution_status||null,
      comparisonDomainCount:Number(p.comparison_domain_count||0),
      candidateObservationCount:Number(p.candidate_observation_count||0),
      trustedCoordinates:p.position_status==='TRUSTED'&&p.latitude!==null&&p.latitude!==undefined&&p.longitude!==null&&p.longitude!==undefined?{
        lat:Number(p.latitude),lng:Number(p.longitude),trusted:true,trust:"CONFIRMED",
        stationCode:p.current_station_code||null,canonicalStationName:p.canonical_station_name||p.current_station_name||null,
        provenance:{directory:"RAIL_STATION_GEO_DIRECTORY_V1",identityBasis:"ESR_CODE"}
      }:null
    }));

    const groups=new Map<string,any>();
    for(const p of wagonPositions){
      if(p.positionStatus!=='TRUSTED'||!p.station)continue;
      const clusterKey=p.stationCode?'ESR:'+String(p.stationCode).trim().toUpperCase():'STATION:'+String(p.station).trim().toLowerCase();
      const current=groups.get(clusterKey)||{clusterKey,station:p.station,stationCode:p.stationCode||null,wagonCount:0,wagonNumbers:[],eventTimestamp:null,eventAtLocal:null,trustedCoordinates:p.trustedCoordinates||null};
      current.wagonCount++;current.wagonNumbers.push(p.wagonNumber);
      current.eventTimestamp=p.eventTimestamp||current.eventTimestamp;current.eventAtLocal=p.eventAtLocal||current.eventAtLocal;
      if(!current.trustedCoordinates&&p.trustedCoordinates)current.trustedCoordinates=p.trustedCoordinates;
      groups.set(clusterKey,current);
    }

    let plannedRoute:any[]=[];
    let actualRoute:any=null,remainingRoute:any=null,routeProgress:any=null,routeStations:any[]=[];
    let routeAssignment:any=null;
    if(assignment){
      routeAssignment={
        resolutionState:assignment.resolution_state,
        originEsr:assignment.origin_esr_code,
        destinationEsr:assignment.destination_esr_code,
        originAuthority:assignment.origin_authority,
        destinationAuthority:assignment.destination_authority,
        routeHopCount:assignment.route_hop_count,
        resolvedAt:assignment.resolved_at,
        refreshedAt:assignment.refreshed_at
      };
      publish(routeAssignmentByDeal,deal,routeAssignment);
      if(String(assignment.resolution_state)==='RESOLVED'){
        const nodes=Array.isArray(assignment.route_nodes)?assignment.route_nodes:[];
        const points=nodes.filter((p:any)=>p&&p.lat!==null&&p.lat!==undefined&&p.lng!==null&&p.lng!==undefined);
        plannedRoute=[{
          railDocumentKey:null,railDocumentId:null,gu12Number:null,
          routeMode:"PUBLIC_SOURCE_RESOLVED",points,geometry:null,status:"PUBLIC_SOURCE_ROUTE_RESOLVED",
          provenance:{routeSource:"PUBLIC_SOURCE_GRAPH_V1",geometryPolicy:"STATION_SEQUENCE_POLYLINE",sourceRefs:assignment.route_source_refs||[]}
        }];
        routeProgress=assignment.progress&&typeof assignment.progress==='object'?assignment.progress:null;
        actualRoute={status:"OBSERVED_HISTORY",points:Array.isArray(routeProgress?.actualPoints)?routeProgress.actualPoints:[]};
        remainingRoute={status:"ROUTE_REMAINDER",points:Array.isArray(routeProgress?.remainingPoints)?routeProgress.remainingPoints:[]};
        routeStations=nodes;
        publish(plannedRouteByDeal,deal,{status:"PUBLIC_SOURCE_ROUTE_RESOLVED",points,geometry:null,provenance:plannedRoute[0].provenance});
        publish(actualRouteByDeal,deal,actualRoute);
        publish(remainingRouteByDeal,deal,remainingRoute);
        publish(routeProgressByDeal,deal,routeProgress);
        publish(routeStationsByDeal,deal,routeStations);
      }
    }
    return{
      dealKey:key,dealId:String(deal.deal_id),
      railDocuments:dealDocs.map((d:any)=>({railDocumentKey:d.rail_document_key,railDocumentId:d.rail_document_id,gu12Number:d.gu12_number,documentNumber:d.document_number,documentDate:d.document_date,routeText:d.route_text})),
      plannedRoute,wagonPositions,positionGroups:[...groups.values()],
      unresolvedOrConflictCount:wagonPositions.filter((p:any)=>p.positionStatus!=='TRUSTED').length,
      actualRoute,remainingRoute,routeProgress,routeStations,routeAssignment
    };
  });

  const rail=docs.map((doc:any)=>{
    const docPositions=(positionsByDeal.get(String(doc.deal_key))||[]).filter((p:any)=>String(p.current_rail_document_key||"")===String(doc.rail_document_key||""));
    return{
      rail_document_key:doc.rail_document_key,rail_document_id:doc.rail_document_id,gu12_number:doc.gu12_number,
      document_number:doc.document_number,document_date:doc.document_date,route_text:doc.route_text,
      deal_key:doc.deal_key,deal_id:doc.deal_id,
      wagons:docPositions.map((p:any)=>({
        wagonNumber:p.wagon_number,station:p.current_station_name||null,stationCode:p.current_station_code||null,
        operation:p.current_operation||null,lastPositionAt:p.current_event_at||p.current_event_at_local||null,
        eventAtLocal:p.current_event_at_local||null,status:p.position_status||null,positionStatus:p.position_status||null,
        effectiveResolutionStatus:p.effective_resolution_status||null,
        trustedCoordinates:p.position_status==='TRUSTED'&&p.latitude!==null&&p.latitude!==undefined&&p.longitude!==null&&p.longitude!==undefined?{
          lat:Number(p.latitude),lng:Number(p.longitude),trusted:true,trust:"CONFIRMED",stationCode:p.current_station_code||null,
          canonicalStationName:p.canonical_station_name||p.current_station_name||null
        }:null
      }))
    };
  });

  const byDeal:any={};let activeTargets=0,conflicts=0;
  for(const deal of deals){
    const rows=positionsByDeal.get(String(deal.deal_key))||[];
    const trusted=rows.filter((p:any)=>p.position_status==='TRUSTED').length;
    const unresolved=rows.length-trusted;
    byDeal[String(deal.deal_key)]={active_targets:trusted>0?1:0,conflicts:unresolved};
    byDeal[String(deal.deal_id)]={active_targets:trusted>0?1:0,conflicts:unresolved};
    if(trusted>0)activeTargets++;conflicts+=unresolved;
  }

  return{
    projection_contract:"CLIENT_RAIL_ADMIN_PARITY_V1",
    generated_at:generatedAt,
    deals:deals.map((d:any)=>({deal_key:d.deal_key,deal_id:d.deal_id,business_status:d.business_status,lifecycle_state:d.lifecycle_state,opened_at:d.opened_at,updated_at:d.updated_at})),
    rail,
    exchange:{active_targets:activeTargets,conflicts,by_deal:byDeal},
    plannedRouteByDeal,actualRouteByDeal,remainingRouteByDeal,routeProgressByDeal,routeStationsByDeal,routeAssignmentByDeal,
    railReadModel:{
      modelVersion:"RONA_CLIENT_RAIL_DEAL_MAP_READ_MODEL_V1",
      sourcePolicy:"AUTHORIZED_CLIENT_DEALS_PLUS_TRUSTED_RAIL_EVIDENCE_V1",
      generatedAt,
      overlayMode:"DISPLAY_ROUTE_HISTORY_AND_CURRENT_POSITION_V1",
      deals:railReadDeals
    },
    clientRailScope:{clientId,contractId,dealCount:deals.length}
  };
}
