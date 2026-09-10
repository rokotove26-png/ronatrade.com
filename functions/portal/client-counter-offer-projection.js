const asArray=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'').trim();
const finite=value=>{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)?n:null};

export function mergeClientCounterOffers(currentApplications,workflowApplications){
  const byId=new Map(asArray(workflowApplications).map(row=>[text(row?.application_id),row]).filter(([id])=>id));
  return asArray(currentApplications).map(app=>{
    const id=text(app?.application_id),source=byId.get(id);
    if(!source)return app;
    const price=finite(source?.counter_price),currency=text(source?.counter_currency).toUpperCase(),response=text(source?.client_counter_response).toUpperCase();
    if(price===null&&!currency&&!response)return app;
    const status=text(app?.status).toUpperCase();
    return{
      ...app,
      counter_price:price,
      counter_currency:currency||null,
      client_counter_response:response||null,
      counter_offer_active:status==='UNDER_REVIEW'&&price!==null&&Boolean(currency)&&!response
    };
  });
}
