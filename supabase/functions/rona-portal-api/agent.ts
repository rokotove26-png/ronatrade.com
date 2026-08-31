import { sql, type Ctx } from "./shared.ts";
import {
  agentBootstrap as baseAgentBootstrap,
  agentDocument,
  agentDocuments,
  agentPayment
} from "https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/a02c7d23eb3f841bbce3e6c16fd0d89e33e96d76/supabase/functions/rona-portal-api/agent.ts";

export { agentDocument, agentDocuments, agentPayment };

async function agentPricePublication(c:Ctx){
  const rows=await sql`
    select distinct on (ops.source_publication_item_key)
      ops.source_publication_item_key as publication_item_id,
      p.publication_id,
      p.status::text as publication_status,
      p.published_at,
      p.authority_state::text as publication_authority_state,
      pi.authority_state::text as item_authority_state,
      pi.valid_from,
      pi.valid_to,
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
      ops.agent_published_at,
      ops.updated_at
    from portal_private.owner_price_snapshots ops
    join portal_private.publication_items pi on pi.id=ops.source_publication_item_key
    join portal_private.publications p on p.id=pi.publication_key
    where ops.source_publication_item_key is not null
      and ops.business_status='PUBLISHED'
      and ops.publish_agent=true
      and ops.agent_published_at is not null
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
          join portal_private.agent_client_assignments aca on aca.client_key=pct.client_key
          join portal_private.agent_user_bindings aub
            on aub.agent_person_key=aca.agent_person_key
           and aub.agent_legal_entity_key=aca.agent_legal_entity_key
          where aub.user_id=${c.user}::uuid
            and aub.status='ACTIVE'::portal_private.binding_status_enum
            and aub.revoked_at is null
            and aub.valid_from<=now()
            and (aub.valid_to is null or aub.valid_to>now())
            and aca.status='ACTIVE'::portal_private.binding_status_enum
            and aca.authority_state='CONFIRMED'::portal_private.authority_state_enum
            and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
            and aca.valid_from<=now()
            and (aca.valid_to is null or aca.valid_to>now())
            and pct.publication_key=p.id
            and (pct.target_scope='PUBLICATION' or (pct.target_scope='ITEM' and pct.publication_item_key=pi.id))
        )
      )
    order by ops.source_publication_item_key,ops.updated_at desc
  `;
  const publicationIds=[...new Set(rows.map((row:any)=>String(row.publication_id)))];
  const publishedAt=rows.reduce((latest:any,row:any)=>{
    const value=row.agent_published_at||row.published_at;
    if(!value)return latest;
    if(!latest)return value;
    return new Date(value).getTime()>new Date(latest).getTime()?value:latest;
  },null);
  return{
    dataContract:"AGENT_PRICE_PUBLICATION_V1",
    publicationStatus:rows.length?"PUBLISHED":"NOT_PUBLISHED",
    publicationId:publicationIds.length===1?publicationIds[0]:null,
    publicationIds,
    publishedAt,
    items:rows.map((row:any)=>({
      publicationItemId:String(row.publication_item_id),
      publicationId:String(row.publication_id),
      product:String(row.product||""),
      producer:String(row.producer||""),
      supplier:String(row.supplier||""),
      basis:String(row.snapshot_basis||""),
      finalStation:String(row.final_station||""),
      price:row.snapshot_price,
      currency:String(row.snapshot_currency||""),
      paymentTerms:String(row.payment_terms||""),
      commercialTerms:String(row.commercial_terms||""),
      businessStatus:String(row.business_status||""),
      validFrom:row.valid_from,
      validTo:row.valid_to,
      agentPublishedAt:row.agent_published_at,
      authority:{publication:String(row.publication_authority_state),item:String(row.item_authority_state)},
      updatedAt:row.updated_at
    }))
  };
}

export async function agentBootstrap(c:Ctx){
  const data:any=await baseAgentBootstrap(c);
  if(!data)return null;
  const pricePublication=await agentPricePublication(c);
  return{...data,pricePublication};
}
