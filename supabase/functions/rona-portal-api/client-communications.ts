import { sql, type Ctx, uuid } from "./shared.ts";

function textValue(value:unknown,max:number):string|null{
  if(value===null||value===undefined||typeof value!=="string")return null;
  const out=value.trim();
  return out&&out.length<=max?out:null;
}

async function currentContext(c:Ctx,clientId:string,contractId:string){
  const rows=await sql`
    select cl.id as client_key,ct.id as contract_key,b.id as binding_key,b.deal_scope_mode,
           ct.contract_status::text,ct.lifecycle_state::text,ct.effective_from,ct.effective_to
      from portal_private.client_user_bindings b
      join portal_private.clients cl on cl.id=b.client_key
      join portal_private.contracts ct on ct.id=b.contract_key and ct.client_key=cl.id
     where b.user_id=${c.user}::uuid
       and cl.client_id=${clientId}
       and ct.contract_id=${contractId}
       and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now())
     limit 1`;
  return rows.length===1?rows[0]:null;
}

export async function clientMessages(c:Ctx,clientId:string,contractId:string){
  const ctx=await currentContext(c,clientId,contractId);
  if(!ctx)return null;
  return await sql`
    select e.event_id,e.event_type,d.deal_id,e.payload,e.processing_state,e.acknowledgement_state,
           e.client_response_text,e.client_response_published_at,e.created_at,e.updated_at,e.lifecycle_state::text
      from portal_private.portal_reverse_events e
      left join portal_private.deals d on d.id=e.deal_key
     where e.client_key=${ctx.client_key}::uuid
       and e.contract_key=${ctx.contract_key}::uuid
       and e.actor_user_id=${c.user}::uuid
       and e.actor_role='CLIENT'::portal_private.portal_role_enum
       and e.event_type='CLIENT_MESSAGE_SUBMIT'
       and e.lifecycle_state in ('ACTIVE'::portal_private.lifecycle_state_enum,'CLOSED'::portal_private.lifecycle_state_enum)
       and (e.deal_key is null or portal_private.client_user_has_archive_deal_access(${c.user}::uuid,e.deal_key,now()))
     order by e.created_at desc`;
}

export async function submitClientMessage(c:Ctx,req:Request){
  let body:any;
  try{body=await req.json()}catch{return[400,{ok:false,code:"INVALID_JSON"}] as const}
  const clientId=textValue(body?.clientId??body?.client_id,80);
  const contractId=textValue(body?.contractId??body?.contract_id,120);
  const dealId=textValue(body?.dealId??body?.deal_id,80);
  const message=textValue(body?.message,8000);
  const subject=textValue(body?.subject,240);
  const idempotencyKey=textValue(req.headers.get("x-idempotency-key")??body?.idempotencyKey??body?.idempotency_key,160);
  if(!clientId||!contractId)return[400,{ok:false,code:"CLIENT_CONTRACT_CONTEXT_REQUIRED"}] as const;
  if(!message)return[400,{ok:false,code:"MESSAGE_REQUIRED"}] as const;
  if(!idempotencyKey)return[400,{ok:false,code:"IDEMPOTENCY_REQUIRED"}] as const;
  const ctx=await currentContext(c,clientId,contractId);
  if(!ctx)return[404,{ok:false,code:"CONTEXT_NOT_FOUND"}] as const;
  if(dealId){
    const deal=await sql`select d.id from portal_private.deals d where d.deal_id=${dealId} and d.client_key=${ctx.client_key}::uuid and d.contract_key=${ctx.contract_key}::uuid and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now()) limit 1`;
    if(deal.length!==1)return[404,{ok:false,code:"DEAL_NOT_FOUND"}] as const;
  }
  const requestHeader=req.headers.get("x-request-id"),correlationHeader=req.headers.get("x-correlation-id");
  const requestId=requestHeader&&uuid.test(requestHeader)?requestHeader:crypto.randomUUID();
  const correlationId=correlationHeader&&uuid.test(correlationHeader)?correlationHeader:null;
  try{
    const rows=await sql`select * from portal_private.server_submit_reverse_event(${c.auth}::uuid,${c.sid},'CLIENT_MESSAGE_SUBMIT','CLIENT_COMMUNICATION','MESSAGE',null,${clientId},${contractId},${dealId},${sql.json({message,subject})}::jsonb,${idempotencyKey},${requestId}::uuid,${correlationId}::uuid)`;
    if(rows.length!==1)return[500,{ok:false,code:"MESSAGE_NOT_CREATED",request_id:requestId}] as const;
    const row=rows[0];
    return[row.reused?200:201,{ok:true,created:!Boolean(row.reused),reused:Boolean(row.reused),message:{event_id:String(row.event_id),processing_state:String(row.processing_state),acknowledgement_state:String(row.acknowledgement_state),created_at:row.created_at},request_id:requestId}] as const;
  }catch(error){
    const raw=String((error as any)?.message||error||"");
    const denied=/denied|not found|required|unsupported|idempotency/i.test(raw);
    return[denied?403:500,{ok:false,code:denied?"MESSAGE_SCOPE_DENIED":"MESSAGE_SERVER_ERROR",request_id:requestId}] as const;
  }
}

export async function adminPublishClientResponse(c:Ctx,req:Request,eventId:string){
  let body:any;
  try{body=await req.json()}catch{return[400,{ok:false,code:"INVALID_JSON"}] as const}
  const response=textValue(body?.response??body?.message,8000);
  const sourceTaskId=textValue(body?.source_task_id??body?.sourceTaskId,160);
  if(!response)return[400,{ok:false,code:"RESPONSE_REQUIRED"}] as const;
  if(!sourceTaskId)return[400,{ok:false,code:"SOURCE_TASK_REQUIRED"}] as const;
  const requestHeader=req.headers.get("x-request-id"),correlationHeader=req.headers.get("x-correlation-id");
  const requestId=requestHeader&&uuid.test(requestHeader)?requestHeader:crypto.randomUUID();
  const correlationId=correlationHeader&&uuid.test(correlationHeader)?correlationHeader:null;
  try{
    const rows=await sql`select * from portal_private.server_admin_publish_client_response(${c.user}::uuid,${eventId},${response},${sourceTaskId},${requestId}::uuid,${correlationId}::uuid)`;
    if(rows.length!==1)return[404,{ok:false,code:"CLIENT_MESSAGE_NOT_FOUND",request_id:requestId}] as const;
    return[200,{ok:true,response:rows[0],request_id:requestId}] as const;
  }catch(error){
    const raw=String((error as any)?.message||error||"");
    const denied=/admin role|required|not client message|not found|staff response missing|already published|rejected/i.test(raw);
    return[denied?403:500,{ok:false,code:denied?"CLIENT_RESPONSE_PUBLISH_DENIED":"CLIENT_RESPONSE_SERVER_ERROR",request_id:requestId}] as const;
  }
}

export async function clientArchive(c:Ctx,clientId:string,contractId:string){
  const ctx=await currentContext(c,clientId,contractId);
  if(!ctx)return null;

  const contracts=await sql`
    select ct.contract_id,ct.current_external_contract_number,ct.contract_status::text,
           ct.effective_from,ct.effective_to,ct.lifecycle_state::text,ct.authority_state::text,ct.updated_at
      from portal_private.contracts ct
     where ct.client_key=${ctx.client_key}::uuid
       and ct.lifecycle_state='ARCHIVED'::portal_private.lifecycle_state_enum
       and portal_private.client_user_has_archive_contract_access(${c.user}::uuid,ct.id,now())
     order by coalesce(ct.effective_to,ct.effective_from) desc nulls last,ct.updated_at desc`;

  const deals=await sql`
    select d.deal_id,ct.contract_id,d.business_status,d.finance_status::text,d.accounting_closure_status::text,
           d.opened_at,d.closed_at,d.updated_at,d.lifecycle_state::text,d.authority_state::text
      from portal_private.deals d
      join portal_private.contracts ct on ct.id=d.contract_key
     where d.client_key=${ctx.client_key}::uuid
       and portal_private.client_user_has_archive_deal_access(${c.user}::uuid,d.id,now())
       and (d.lifecycle_state::text<>'ACTIVE' or d.business_status::text in ('CANCELLED','CLOSED','COMPLETED','DONE','RESOURCE_DENIED'))
     order by coalesce(d.closed_at,d.updated_at) desc`;

  const documents=await sql`
    select doc.document_id,doc.document_type,doc.authoritative_filename,ct.contract_id,d.deal_id,
           doc.updated_at,doc.lifecycle_state::text,doc.authority_state::text
      from portal_private.documents doc
      join portal_private.contracts ct on ct.id=doc.contract_key
      left join portal_private.deals d on d.id=doc.deal_key
     where doc.client_key=${ctx.client_key}::uuid
       and portal_private.client_user_has_archive_document_access(${c.user}::uuid,doc.id,now())
       and (doc.lifecycle_state::text<>'ACTIVE' or (d.id is not null and (d.lifecycle_state::text<>'ACTIVE' or d.business_status::text in ('CANCELLED','CLOSED','COMPLETED','DONE','RESOURCE_DENIED'))))
     order by doc.updated_at desc`;

  const payments=await sql`
    select distinct p.payment_id,p.payment_at,p.amount,p.currency,ct.contract_id,d.deal_id,
           p.finance_status::text,p.accounting_closure_status::text,p.updated_at
      from portal_private.payment_allocations pa
      join portal_private.payments p on p.id=pa.payment_key
      join portal_private.deals d on d.id=pa.deal_key
      join portal_private.contracts ct on ct.id=d.contract_key
     where d.client_key=${ctx.client_key}::uuid
       and portal_private.client_user_has_archive_deal_access(${c.user}::uuid,d.id,now())
       and p.bank_fact_status::text='BANK_CONFIRMED'
       and p.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
       and pa.allocation_status='VERIFIED'::portal_private.payment_allocation_state_enum
       and pa.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum)
       and (d.lifecycle_state::text<>'ACTIVE' or d.business_status::text in ('CANCELLED','CLOSED','COMPLETED','DONE','RESOURCE_DENIED'))
     order by p.updated_at desc`;

  const messages=await sql`
    select e.event_id,ct.contract_id,d.deal_id,e.payload,e.processing_state,e.acknowledgement_state,
           e.client_response_text,e.client_response_published_at,e.created_at,e.updated_at,e.lifecycle_state::text
      from portal_private.portal_reverse_events e
      join portal_private.contracts ct on ct.id=e.contract_key
      left join portal_private.deals d on d.id=e.deal_key
     where e.client_key=${ctx.client_key}::uuid
       and e.actor_user_id=${c.user}::uuid
       and e.actor_role='CLIENT'::portal_private.portal_role_enum
       and e.event_type='CLIENT_MESSAGE_SUBMIT'
       and portal_private.client_user_has_archive_contract_access(${c.user}::uuid,e.contract_key,now())
       and (e.deal_key is null or portal_private.client_user_has_archive_deal_access(${c.user}::uuid,e.deal_key,now()))
       and (e.lifecycle_state='CLOSED'::portal_private.lifecycle_state_enum or (d.id is not null and (d.lifecycle_state::text<>'ACTIVE' or d.business_status::text in ('CANCELLED','CLOSED','COMPLETED','DONE','RESOURCE_DENIED'))))
     order by e.updated_at desc`;

  return{projection_contract:'CLIENT_CONTEXT_ARCHIVE_V1',current_context:{client_id:clientId,contract_id:contractId},contracts,deals,documents,payments,messages};
}
