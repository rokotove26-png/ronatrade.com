export function mergeAdminDurableIntakeApplications(baseData,intakeData){
  const asArray=value=>Array.isArray(value)?value:[];
  const text=value=>String(value??'').trim();
  const upper=value=>text(value).toUpperCase();
  const current=asArray(baseData?.applications).map(row=>({...row}));
  const byId=new Map(current.map(row=>[text(row?.application_id),row]).filter(([id])=>id));
  const clients=new Map(asArray(baseData?.clients).map(row=>[text(row?.client_id),row]).filter(([id])=>id));
  let restored=0,updated=0;

  const intakeFields=row=>({
    intake_id:row?.intake_id??null,
    durable_id:row?.durable_id??null,
    source_id:row?.source_id??null,
    actionable_type:row?.actionable_type??null,
    intake_status:row?.intake_status??row?.status??null,
    intake_submitted_at:row?.intake_submitted_at??row?.submitted_at??null,
    intake_routing_reason:row?.intake_routing_reason??null,
    intake_responsible_role:row?.intake_responsible_role??row?.responsible_role??null,
    intake_contract:row?.intake_contract??null,
    intake_task_status:row?.intake_task_status??null,
    intake_task_decision:row?.intake_task_decision??null,
    intake_task_decision_at:row?.intake_task_decision_at??null,
    effective_payload:row?.effective_payload??null,
    client_intakes:row?.client_intakes??null,
    application_details_intakes:row?.application_details_intakes??null,
  });

  for(const source of asArray(intakeData?.applications)){
    const applicationId=text(source?.application_id);
    if(!applicationId)continue;
    const durable=Boolean(text(source?.intake_id)&&text(source?.durable_id));
    if(!durable)continue;

    const existing=byId.get(applicationId);
    if(existing){
      const next=intakeFields(source);
      for(const [key,value] of Object.entries(next))if(value!==null&&value!==undefined)existing[key]=value;
      if(source?.quantity_tonnes!==null&&source?.quantity_tonnes!==undefined&&source?.quantity_tonnes!=='')existing.quantity_tonnes=source.quantity_tonnes;
      if(source?.record_kind)existing.record_kind=source.record_kind;
      if(source?.request_id)existing.request_id=source.request_id;
      updated+=1;
      continue;
    }

    const payload=source?.effective_payload&&typeof source.effective_payload==='object'?source.effective_payload:{};
    const commercial=payload?.commercial&&typeof payload.commercial==='object'?payload.commercial:{};
    const recordKind=upper(source?.record_kind);
    const sourceKind=upper(source?.source_kind);
    const actionableType=upper(source?.actionable_type);
    const linkedApplicationId=text(payload?.application_id||source?.linked_application_id);

    // APPLICATION_DETAILS_* is a technical/audit mirror of a canonical application.
    // It must never be rendered as an independent business row.
    if(actionableType.startsWith('APPLICATION_DETAILS_')&&linkedApplicationId)continue;

    const clientId=text(source?.client_id||payload?.client_id)||null;
    const contractId=text(source?.contract_id||payload?.contract_id)||null;
    const client=clientId?clients.get(clientId):null;
    const requestLike=recordKind==='CLIENT_REQUEST'||sourceKind==='PORTAL_REVERSE_EVENT';

    const row={
      application_id:applicationId,
      request_id:text(source?.request_id||source?.source_id)||applicationId,
      record_kind:requestLike?'CLIENT_REQUEST':recordKind||'CLIENT_APPLICATION',
      client_id:clientId,
      legal_name:source?.legal_name??client?.legal_name??null,
      contract_id:contractId,
      deal_id:source?.deal_id??null,
      deal_status:source?.deal_status??null,
      product:source?.product??payload?.product??null,
      quantity_tonnes:source?.quantity_tonnes??payload?.quantity_tonnes??null,
      delivery_period_from:source?.delivery_period_from??payload?.shipment?.period_from??null,
      delivery_period_to:source?.delivery_period_to??payload?.shipment?.period_to??null,
      delivery_basis:source?.delivery_basis??payload?.shipment?.source_basis??commercial?.published_basis_reference??null,
      destination:source?.destination??payload?.destination?.station??payload?.destination??null,
      delivery_method:source?.delivery_method??null,
      payment_terms:source?.payment_terms??commercial?.payment_terms??payload?.payment_terms??null,
      price_mode:source?.price_mode??commercial?.price_mode??null,
      proposed_price:source?.proposed_price??commercial?.proposed_price??null,
      proposed_currency:source?.proposed_currency??commercial?.currency??null,
      status:source?.status??'SUBMITTED',
      owner_status:source?.owner_status??'NEW',
      lifecycle_state:source?.lifecycle_state??'ACTIVE',
      submitted_at:source?.submitted_at??source?.intake_submitted_at??null,
      updated_at:source?.updated_at??source?.submitted_at??source?.intake_submitted_at??null,
      ...intakeFields(source),
    };
    current.push(row);byId.set(applicationId,row);restored+=1;
  }

  return {data:{...baseData,applications:current},restored,updated};
}
