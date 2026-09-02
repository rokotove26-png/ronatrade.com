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
