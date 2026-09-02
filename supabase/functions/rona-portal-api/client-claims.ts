import { sql, type Ctx } from "./shared.ts";

export async function clientClaims(c:Ctx,clientId:string,contractId:string){
  const context=await sql`select cl.id as client_key,ct.id as contract_key from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id where cl.client_id=${clientId} and ct.contract_id=${contractId} and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now()) limit 1`;
  if(context.length!==1)return null;
  return await sql`
    select
      oc.claim_id,
      oc.category,
      oc.subject,
      oc.description,
      oc.status,
      d.deal_id,
      pd.document_id as primary_document_id,
      rd.document_id as response_document_id,
      oc.received_at,
      oc.decision_at,
      oc.response_sent_at,
      oc.lifecycle_state::text,
      oc.updated_at
    from portal_private.owner_claims oc
    join portal_private.clients cl on cl.id=oc.client_key
    join portal_private.contracts ct on ct.id=oc.contract_key
    left join portal_private.deals d on d.id=oc.deal_key
    left join portal_private.documents pd on pd.id=oc.primary_document_key and portal_private.client_user_has_document_access(${c.user}::uuid,pd.id,now())
    left join portal_private.documents rd on rd.id=oc.response_document_key and portal_private.client_user_has_document_access(${c.user}::uuid,rd.id,now())
    where cl.client_id=${clientId}
      and ct.contract_id=${contractId}
      and oc.client_key=cl.id
      and oc.contract_key=ct.id
      and oc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now())
      and (oc.deal_key is null or portal_private.client_user_has_deal_access(${c.user}::uuid,oc.deal_key,now()))
    order by oc.received_at desc,oc.updated_at desc
  `;
}
