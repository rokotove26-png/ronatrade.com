import { sql, uuid, isAdminEntityAgent, type Ctx } from "./shared.ts";

export type AgentDocumentView = {
  documentId:string;
  documentType:string;
  clientId:string;
  contractId:string;
  dealId:string;
  authoritativeFilename:string;
  authorityState:string;
  lifecycleState:string;
  updatedAt:unknown;
};

function mapAgentDocument(row:any):AgentDocumentView{
  return{
    documentId:String(row.document_id),
    documentType:String(row.document_type),
    clientId:String(row.client_id),
    contractId:String(row.contract_id),
    dealId:String(row.deal_id),
    authoritativeFilename:String(row.authoritative_filename),
    authorityState:String(row.authority_state),
    lifecycleState:String(row.lifecycle_state),
    updatedAt:row.updated_at
  };
}

async function agentDocumentRows(c:Ctx,documentId:string|null=null){
  const bound=c.impersonation?.effectiveRole==="AGENT"?c.impersonation.targetAgentPersonKey:null;
  if(isAdminEntityAgent(c))return await sql`
    select
      d.document_id,
      d.document_type,
      cl.client_id,
      ct.contract_id,
      x.deal_id,
      d.authoritative_filename,
      d.authority_state::text,
      d.lifecycle_state::text,
      d.updated_at
    from portal_private.documents d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    join portal_private.deals x on x.id=d.deal_key
    where (${documentId}::text is null or d.document_id=${documentId}::text)
      and d.deal_key is not null
      and exists(
        select 1
        from portal_private.agent_deal_terms t
        join portal_private.agent_client_assignments a on a.id=t.assignment_id
        where a.agent_person_key=${bound}::uuid
          and t.deal_key=d.deal_key
          and a.status='ACTIVE'::portal_private.binding_status_enum
          and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and t.status='ACTIVE'::portal_private.binding_status_enum
          and t.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      )
      and d.authority_state in (
        'VERIFIED'::portal_private.authority_state_enum,
        'CONFIRMED'::portal_private.authority_state_enum
      )
      and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by d.updated_at desc
  `;
  return await sql`
    select
      d.document_id,
      d.document_type,
      cl.client_id,
      ct.contract_id,
      x.deal_id,
      d.authoritative_filename,
      d.authority_state::text,
      d.lifecycle_state::text,
      d.updated_at
    from portal_private.documents d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    join portal_private.deals x on x.id=d.deal_key
    where (${documentId}::text is null or d.document_id=${documentId}::text)
      and d.deal_key is not null
      and portal_private.agent_user_has_deal_view_access(${c.user}::uuid,d.deal_key,now())
      and d.authority_state in (
        'VERIFIED'::portal_private.authority_state_enum,
        'CONFIRMED'::portal_private.authority_state_enum
      )
      and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by d.updated_at desc
  `;
}

export async function agentDocuments(c:Ctx):Promise<AgentDocumentView[]>{
  return (await agentDocumentRows(c)).map(mapAgentDocument);
}

export async function agentDocument(c:Ctx,documentId:string):Promise<AgentDocumentView|null>{
  const rows=await agentDocumentRows(c,documentId);
  return rows.length===1?mapAgentDocument(rows[0]):null;
}

export async function agentPayment(c:Ctx,paymentId:string){
  const bound=c.impersonation?.effectiveRole==="AGENT"?c.impersonation.targetAgentPersonKey:null;
  const rows=isAdminEntityAgent(c)?await sql`
    select
      p.payment_id,
      cl.client_id,
      d.deal_id,
      p.finance_status::text,
      p.accounting_closure_status::text,
      pa.allocation_status::text
    from portal_private.payments p
    join portal_private.payment_allocations pa on pa.payment_key=p.id
    join portal_private.clients cl on cl.id=pa.client_key
    join portal_private.deals d on d.id=pa.deal_key
    where p.payment_id=${paymentId}
      and pa.deal_key is not null
      and exists(
        select 1
        from portal_private.agent_deal_terms t
        join portal_private.agent_client_assignments a on a.id=t.assignment_id
        where a.agent_person_key=${bound}::uuid
          and t.deal_key=pa.deal_key
          and a.status='ACTIVE'::portal_private.binding_status_enum
          and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and t.status='ACTIVE'::portal_private.binding_status_enum
          and t.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      )
    order by pa.allocated_at desc nulls last,pa.created_at desc
    limit 1
  `:await sql`
    select
      p.payment_id,
      cl.client_id,
      d.deal_id,
      p.finance_status::text,
      p.accounting_closure_status::text,
      pa.allocation_status::text
    from portal_private.payments p
    join portal_private.payment_allocations pa on pa.payment_key=p.id
    join portal_private.clients cl on cl.id=pa.client_key
    join portal_private.deals d on d.id=pa.deal_key
    where p.payment_id=${paymentId}
      and pa.deal_key is not null
      and portal_private.agent_user_has_deal_view_access(${c.user}::uuid,pa.deal_key,now())
    order by pa.allocated_at desc nulls last,pa.created_at desc
    limit 1
  `;
  if(rows.length!==1)return null;
  const row=rows[0];
  return{
    paymentId:String(row.payment_id),
    clientId:String(row.client_id),
    dealId:String(row.deal_id),
    financeStatus:String(row.finance_status),
    accountingClosureStatus:String(row.accounting_closure_status),
    allocationStatus:String(row.allocation_status)
  };
}

async function agentPricePublication(c:Ctx){
  const bound=c.impersonation?.effectiveRole==="AGENT"?c.impersonation.targetAgentPersonKey:null;
  const adminEntity=isAdminEntityAgent(c);
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
      and p.authority_state in (
        'CONFIRMED'::portal_private.authority_state_enum,
        'VERIFIED'::portal_private.authority_state_enum
      )
      and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and pi.item_type='PRICE'::portal_private.publication_item_type_enum
      and pi.distribution_allowed=true
      and pi.authority_state in (
        'CONFIRMED'::portal_private.authority_state_enum,
        'VERIFIED'::portal_private.authority_state_enum
      )
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
          left join portal_private.agent_user_bindings aub
            on aub.agent_person_key=aca.agent_person_key
           and (
             aub.agent_legal_entity_key is null
             or aca.agent_legal_entity_key is not distinct from aub.agent_legal_entity_key
           )
          where (
              (${adminEntity}::boolean and aca.agent_person_key=${bound}::uuid)
              or (
                not ${adminEntity}::boolean
                and aub.user_id=${c.user}::uuid
                and (${bound}::uuid is null or aub.agent_person_key=${bound}::uuid)
                and aub.status='ACTIVE'::portal_private.binding_status_enum
                and aub.revoked_at is null
                and aub.valid_from<=now()
                and (aub.valid_to is null or aub.valid_to>now())
              )
            )
            and aca.status='ACTIVE'::portal_private.binding_status_enum
            and aca.authority_state='CONFIRMED'::portal_private.authority_state_enum
            and aca.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
            and aca.valid_from<=now()
            and (aca.valid_to is null or aca.valid_to>now())
            and pct.publication_key=p.id
            and (
              pct.target_scope='PUBLICATION'
              or (pct.target_scope='ITEM' and pct.publication_item_key=pi.id)
            )
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
      authority:{
        publication:String(row.publication_authority_state),
        item:String(row.item_authority_state)
      },
      updatedAt:row.updated_at
    }))
  };
}

function agentMessageText(value:unknown,max:number):string|null{
  if(value===null||value===undefined||typeof value!=="string")return null;
  const out=value.trim();
  return out&&out.length<=max?out:null;
}

async function agentMessageIdentity(c:Ctx){
  const bound=c.impersonation?.effectiveRole==="AGENT"?c.impersonation.targetAgentPersonKey:null;
  const rows=isAdminEntityAgent(c)?await sql`
    select ap.id as agent_person_key,ap.agent_person_id
    from portal_private.agent_persons ap
    where ap.id=${bound}::uuid
      and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ap.authority_state in (
        'SOURCE_RECEIVED'::portal_private.authority_state_enum,
        'VERIFIED'::portal_private.authority_state_enum,
        'CONFIRMED'::portal_private.authority_state_enum
      )
    limit 1
  `:await sql`
    select distinct ap.id as agent_person_key,ap.agent_person_id
    from portal_private.agent_user_bindings ub
    join portal_private.agent_persons ap on ap.id=ub.agent_person_key
    join portal_private.portal_user_roles pr on pr.user_id=ub.user_id
    where ub.user_id=${c.user}::uuid
      and (${bound}::uuid is null or ub.agent_person_key=${bound}::uuid)
      and ub.status='ACTIVE'::portal_private.binding_status_enum
      and ub.revoked_at is null
      and ub.valid_from<=now()
      and (ub.valid_to is null or ub.valid_to>now())
      and ub.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ub.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum)
      and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ap.authority_state in (
        'SOURCE_RECEIVED'::portal_private.authority_state_enum,
        'VERIFIED'::portal_private.authority_state_enum,
        'CONFIRMED'::portal_private.authority_state_enum
      )
      and pr.role='AGENT'::portal_private.portal_role_enum
      and pr.status='ACTIVE'::portal_private.binding_status_enum
      and pr.revoked_at is null
    limit 2
  `;
  return rows.length===1?rows[0]:null;
}

export async function agentMessages(c:Ctx){
  const identity=await agentMessageIdentity(c);
  if(!identity)return null;
  const rows=await sql`
    select e.event_id,e.event_type,e.actor_role::text as actor_role,
           case when e.actor_role='ADMIN'::portal_private.portal_role_enum then 'ADMIN_TO_AGENT' else 'AGENT_TO_ADMIN' end as direction,
           e.payload,e.processing_state,e.acknowledgement_state,e.created_at,e.updated_at
    from portal_private.portal_reverse_events e
    where e.agent_person_key=${identity.agent_person_key}::uuid
      and e.client_key is null
      and e.contract_key is null
      and e.deal_key is null
      and e.authority_domain='AGENT_COMMUNICATION'
      and e.authority_target_type='MESSAGE'
      and e.event_type in ('AGENT_MESSAGE_SUBMIT','ADMIN_AGENT_MESSAGE_SUBMIT')
      and e.actor_role in ('AGENT'::portal_private.portal_role_enum,'ADMIN'::portal_private.portal_role_enum)
      and e.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by e.created_at desc
  `;
  return rows.map((row:any)=>({
    eventId:String(row.event_id),
    agentPersonId:String(identity.agent_person_id),
    subject:String(row.payload?.subject||"").trim()||"Сообщение",
    text:String(row.payload?.message||"").trim(),
    relatedObject:String(row.payload?.related_object||"").trim()||null,
    direction:String(row.direction),
    processingState:String(row.processing_state),
    acknowledgementState:String(row.acknowledgement_state),
    createdAt:row.created_at,
    updatedAt:row.updated_at
  }));
}

export async function submitAgentMessage(c:Ctx,req:Request){
  if(c.impersonation)return[403,{ok:false,code:"ADMIN_ENTITY_PREVIEW_READ_ONLY"}] as const;
  let body:any;
  try{body=await req.json()}catch{return[400,{ok:false,code:"INVALID_JSON"}] as const}
  const message=agentMessageText(body?.message,8000);
  const subject=agentMessageText(body?.subject,240);
  const relatedObject=agentMessageText(body?.relatedObject??body?.related_object,160);
  const idempotencyKey=agentMessageText(req.headers.get("x-idempotency-key")??body?.idempotencyKey??body?.idempotency_key,160);
  if(!message)return[400,{ok:false,code:"MESSAGE_REQUIRED"}] as const;
  if(!idempotencyKey)return[400,{ok:false,code:"IDEMPOTENCY_REQUIRED"}] as const;
  const identity=await agentMessageIdentity(c);
  if(!identity)return[403,{ok:false,code:"AGENT_MESSAGE_SCOPE_DENIED"}] as const;
  if(relatedObject){
    const deal=await sql`
      select d.id
      from portal_private.deals d
      where d.deal_id=${relatedObject}
        and portal_private.agent_user_has_deal_view_access(${c.user}::uuid,d.id,now())
      limit 1
    `;
    if(deal.length!==1)return[403,{ok:false,code:"AGENT_RELATED_OBJECT_DENIED"}] as const;
  }
  const requestHeader=req.headers.get("x-request-id"),correlationHeader=req.headers.get("x-correlation-id");
  const requestId=requestHeader&&uuid.test(requestHeader)?requestHeader:crypto.randomUUID();
  const correlationId=correlationHeader&&uuid.test(correlationHeader)?correlationHeader:null;
  try{
    const rows=await sql`select * from portal_private.server_agent_submit_radio_message_v1(
      ${c.user}::uuid,${subject},${message},${relatedObject},${idempotencyKey},
      ${requestId}::uuid,${correlationId}::uuid
    )`;
    if(rows.length!==1)return[500,{ok:false,code:"AGENT_MESSAGE_NOT_CREATED",request_id:requestId}] as const;
    const row=rows[0];
    return[row.reused?200:201,{ok:true,created:!Boolean(row.reused),reused:Boolean(row.reused),message:{event_id:String(row.event_id),created_at:row.created_at},request_id:requestId}] as const;
  }catch(error){
    const raw=String((error as any)?.message||error||"");
    const denied=/agent role|binding|scope|related|idempotency|required|not current/i.test(raw);
    return[denied?403:500,{ok:false,code:denied?"AGENT_MESSAGE_SCOPE_DENIED":"AGENT_MESSAGE_SERVER_ERROR",request_id:requestId}] as const;
  }
}

export async function agentBootstrap(c:Ctx){
  const bound=c.impersonation?.effectiveRole==="AGENT"?c.impersonation.targetAgentPersonKey:null;
  const bindings=isAdminEntityAgent(c)?await sql`
    select
      ap.id as agent_person_key,
      null::uuid as agent_legal_entity_key,
      ap.agent_person_id,
      coalesce(ap.display_alias,ap.full_name,ap.agent_person_id) as display_alias,
      null::text as agent_legal_entity_id,
      null::text as legal_name
    from portal_private.agent_persons ap
    where ap.id=${bound}::uuid
      and ap.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and ap.authority_state not in (
        'REJECTED'::portal_private.authority_state_enum,
        'SUPERSEDED'::portal_private.authority_state_enum
      )
  `:await sql`
    select
      ub.agent_person_key,
      ub.agent_legal_entity_key,
      ap.agent_person_id,
      coalesce(ap.display_alias,ap.full_name,ap.agent_person_id) as display_alias,
      ale.agent_legal_entity_id,
      ale.legal_name
    from portal_private.agent_user_bindings ub
    join portal_private.agent_persons ap on ap.id=ub.agent_person_key
    left join portal_private.agent_legal_entities ale on ale.id=ub.agent_legal_entity_key
    where ub.user_id=${c.user}::uuid
      and (${bound}::uuid is null or ub.agent_person_key=${bound}::uuid)
      and ub.status='ACTIVE'::portal_private.binding_status_enum
      and ub.revoked_at is null
      and ub.valid_from<=now()
      and (ub.valid_to is null or ub.valid_to>now())
  `;
  if(bindings.length!==1)return null;
  const identity=bindings[0];

  const assignedClients=await sql`
    select distinct a.id,cl.client_id,cl.legal_name
    from portal_private.agent_client_assignments a
    join portal_private.clients cl on cl.id=a.client_key
    where a.agent_person_key=${identity.agent_person_key}::uuid
      and (
        ${identity.agent_legal_entity_key}::uuid is null
        or a.agent_legal_entity_key is not distinct from ${identity.agent_legal_entity_key}::uuid
      )
      and a.status='ACTIVE'::portal_private.binding_status_enum
      and a.valid_from<=now()
      and (a.valid_to is null or a.valid_to>now())
      and a.authority_state='CONFIRMED'::portal_private.authority_state_enum
      and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by cl.client_id
  `;

  const viewDeals=isAdminEntityAgent(c)?await sql`
    select
      d.id as deal_key,
      d.deal_id,
      cl.client_id,
      ct.contract_id,
      d.business_status,
      d.finance_status::text,
      d.accounting_closure_status::text,
      d.opened_at,
      d.closed_at
    from portal_private.deals d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    where exists(
      select 1
      from portal_private.agent_deal_terms t
      join portal_private.agent_client_assignments aa on aa.id=t.assignment_id
      where t.deal_key=d.id
        and aa.agent_person_key=${bound}::uuid
        and aa.status='ACTIVE'::portal_private.binding_status_enum
        and aa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and t.status='ACTIVE'::portal_private.binding_status_enum
        and t.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    )
    order by d.created_at desc
  `:await sql`
    select
      d.id as deal_key,
      d.deal_id,
      cl.client_id,
      ct.contract_id,
      d.business_status,
      d.finance_status::text,
      d.accounting_closure_status::text,
      d.opened_at,
      d.closed_at
    from portal_private.deals d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    where portal_private.agent_user_has_deal_view_access(${c.user}::uuid,d.id,now())
    order by d.created_at desc
  `;

  const applications=isAdminEntityAgent(c)?await sql`
    select
      a.application_id,
      a.product,
      a.quantity_tonnes,
      a.status::text,
      d.deal_id,
      cl.client_id
    from portal_private.client_applications a
    join portal_private.deals d on d.id=a.linked_deal_key
    join portal_private.clients cl on cl.id=a.client_key
    where a.linked_deal_key is not null
      and exists(
        select 1
        from portal_private.agent_deal_terms t
        join portal_private.agent_client_assignments aa on aa.id=t.assignment_id
        where t.deal_key=d.id
          and aa.agent_person_key=${bound}::uuid
          and aa.status='ACTIVE'::portal_private.binding_status_enum
          and aa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
          and t.status='ACTIVE'::portal_private.binding_status_enum
          and t.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      )
    order by a.created_at desc
  `:await sql`
    select
      a.application_id,
      a.product,
      a.quantity_tonnes,
      a.status::text,
      d.deal_id,
      cl.client_id
    from portal_private.client_applications a
    join portal_private.deals d on d.id=a.linked_deal_key
    join portal_private.clients cl on cl.id=a.client_key
    where a.linked_deal_key is not null
      and portal_private.agent_user_has_deal_view_access(${c.user}::uuid,a.linked_deal_key,now())
    order by a.created_at desc
  `;

  const settlements=isAdminEntityAgent(c)?await sql`
    select
      s.settlement_id,
      s.settlement_state::text,
      s.amount,
      s.currency,
      s.calculation_basis,
      d.deal_id,
      cl.client_id,
      s.payable_confirmed_at,
      s.paid_at
    from portal_private.agent_settlements s
    join portal_private.deals d on d.id=s.deal_key
    join portal_private.clients cl on cl.id=d.client_key
    where exists(
      select 1
      from portal_private.agent_deal_terms t
      join portal_private.agent_client_assignments aa on aa.id=t.assignment_id
      where t.deal_key=d.id
        and aa.agent_person_key=${bound}::uuid
        and aa.status='ACTIVE'::portal_private.binding_status_enum
        and aa.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
        and t.status='ACTIVE'::portal_private.binding_status_enum
        and t.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    )
    order by s.created_at desc
  `:await sql`
    select
      s.settlement_id,
      s.settlement_state::text,
      s.amount,
      s.currency,
      s.calculation_basis,
      d.deal_id,
      cl.client_id,
      s.payable_confirmed_at,
      s.paid_at
    from portal_private.agent_settlements s
    join portal_private.deals d on d.id=s.deal_key
    join portal_private.clients cl on cl.id=d.client_key
    where portal_private.agent_user_has_deal_access(${c.user}::uuid,s.deal_key,now())
    order by s.created_at desc
  `;

  const documents=await agentDocuments(c);
  const messages=await agentMessages(c);
  if(messages===null)return null;
  const pricePublication=await agentPricePublication(c);
  const dealsByClient=new Map<string,string[]>();
  for(const row of assignedClients)dealsByClient.set(String(row.client_id),[]);
  for(const row of viewDeals)dealsByClient.get(String(row.client_id))?.push(String(row.deal_id));

  return{
    userId:c.user,
    agentPersonId:String(identity.agent_person_id),
    displayAlias:String(identity.display_alias),
    legalEntity:identity.agent_legal_entity_id?{
      id:String(identity.agent_legal_entity_id),
      name:String(identity.legal_name||"")
    }:null,
    dataUpdatedAt:new Date().toISOString(),
    clients:assignedClients.map((row:any)=>({
      clientId:String(row.client_id),
      name:String(row.legal_name),
      deals:dealsByClient.get(String(row.client_id))||[]
    })),
    deals:viewDeals.map((row:any)=>({
      dealId:String(row.deal_id),
      clientId:String(row.client_id),
      contractId:String(row.contract_id),
      status:String(row.business_status),
      financeStatus:String(row.finance_status),
      accountingClosureStatus:String(row.accounting_closure_status),
      openedAt:row.opened_at,
      closedAt:row.closed_at,
      agentPersonId:String(identity.agent_person_id)
    })),
    applications:applications.map((row:any)=>({
      applicationId:String(row.application_id),
      dealId:String(row.deal_id),
      clientId:String(row.client_id),
      product:String(row.product),
      qty:String(row.quantity_tonnes),
      status:String(row.status),
      agentPersonId:String(identity.agent_person_id)
    })),
    settlements:settlements.map((row:any)=>({
      dealId:String(row.deal_id),
      clientId:String(row.client_id),
      stage:String(row.settlement_state),
      amount:row.amount,
      currency:row.currency,
      publicModel:String(row.calculation_basis||""),
      calculationVisible:row.amount!=null,
      paymentObligationConfirmed:row.payable_confirmed_at!=null,
      paymentFactConfirmed:row.paid_at!=null,
      agentPersonId:String(identity.agent_person_id)
    })),
    economics:[],
    documents,
    messages,
    pricePublication
  };
}
