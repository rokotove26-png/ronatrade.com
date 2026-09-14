export function mergeAdminCompletedApplications(baseData,workflowData){
  const asArray=value=>Array.isArray(value)?value:[];
  const text=value=>String(value??'').trim();
  const upper=value=>text(value).toUpperCase();
  const current=asArray(baseData?.applications);
  const existing=new Set(current.map(row=>text(row?.application_id)).filter(Boolean));
  const workflowApps=asArray(workflowData?.applications);
  const workflowByApplication=new Map(workflowApps.map(row=>[text(row?.application_id),row]).filter(([id])=>id));
  const baseDeals=asArray(baseData?.deals);
  const workflowDeals=asArray(workflowData?.deals);
  const dealByApplication=new Map();

  // The registered deal is itself durable evidence that a source application crossed
  // into the deal lifecycle. Prefer workflow deal fields, but retain the base Admin
  // deal as a fallback when one workflow projection is transiently incomplete.
  for(const deal of [...baseDeals,...workflowDeals]){
    const applicationId=text(deal?.application_id);
    const dealId=text(deal?.deal_id);
    if(!applicationId||!dealId)continue;
    dealByApplication.set(applicationId,deal);
  }

  const additions=[];
  for(const [applicationId,deal] of dealByApplication){
    if(existing.has(applicationId))continue;
    const dealId=text(deal?.deal_id);
    if(!dealId)continue;

    const workflow=workflowByApplication.get(applicationId)||null;
    if(workflow){
      // When the workflow application row is present it remains authoritative.
      if(upper(workflow?.owner_status)!=='DEAL')continue;
      const workflowDealId=text(workflow?.deal_id);
      if(workflowDealId&&workflowDealId!==dealId)continue;
    }else{
      // Fallback is only for a registered, non-pending deal. This closes the
      // read-projection gap without promoting applications still awaiting resource.
      const dealStatus=upper(deal?.business_status??deal?.status);
      if(dealStatus==='SUPPLIER_PENDING')continue;
    }

    additions.push({
      application_id:applicationId,
      client_id:deal?.client_id??null,
      legal_name:deal?.legal_name??deal?.client_name??null,
      contract_id:deal?.contract_id??null,
      deal_id:dealId,
      deal_status:deal?.business_status??deal?.status??null,
      product:deal?.source_product??deal?.product??null,
      quantity_tonnes:deal?.source_quantity_tonnes??deal?.quantity_tonnes??null,
      delivery_period_from:deal?.source_delivery_period_from??deal?.delivery_period_from??null,
      delivery_period_to:deal?.source_delivery_period_to??deal?.delivery_period_to??null,
      delivery_basis:deal?.source_delivery_basis??deal?.delivery_basis??null,
      destination:deal?.source_destination??deal?.destination??null,
      delivery_method:deal?.source_delivery_method??deal?.delivery_method??null,
      payment_terms:deal?.source_payment_terms??deal?.payment_terms??null,
      price_mode:deal?.source_price_mode??deal?.price_mode??null,
      proposed_price:deal?.source_proposed_price??deal?.proposed_price??null,
      proposed_currency:deal?.source_proposed_currency??deal?.proposed_currency??null,
      status:'DEAL_REGISTERED',
      owner_status:'DEAL',
      lifecycle_state:'ARCHIVED'
    });
    existing.add(applicationId);
  }

  if(!additions.length)return baseData;
  return {...baseData,applications:[...current,...additions]};
}
