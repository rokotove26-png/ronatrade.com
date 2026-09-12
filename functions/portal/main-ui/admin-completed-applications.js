export function mergeAdminCompletedApplications(baseData,workflowData){
  const asArray=value=>Array.isArray(value)?value:[];
  const text=value=>String(value??'').trim();
  const current=asArray(baseData?.applications);
  const existing=new Set(current.map(row=>text(row?.application_id)).filter(Boolean));
  const workflowApps=asArray(workflowData?.applications);
  const deals=asArray(workflowData?.deals);
  const dealByApplication=new Map(deals.map(row=>[text(row?.application_id),row]).filter(([id,row])=>id&&text(row?.deal_id)));
  const additions=[];

  for(const workflow of workflowApps){
    const applicationId=text(workflow?.application_id);
    if(!applicationId||existing.has(applicationId))continue;
    if(text(workflow?.owner_status).toUpperCase()!=='DEAL')continue;
    const deal=dealByApplication.get(applicationId);
    if(!deal)continue;
    const dealId=text(deal?.deal_id);
    if(!dealId||text(workflow?.deal_id)!==dealId)continue;
    additions.push({
      application_id:applicationId,
      client_id:deal?.client_id??null,
      legal_name:deal?.legal_name??null,
      contract_id:deal?.contract_id??null,
      deal_id:dealId,
      deal_status:deal?.business_status??null,
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
