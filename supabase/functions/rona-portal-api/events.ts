import { sql, type Ctx, uuid } from "./shared.ts";
const functionalRoles=new Set(["EXECUTIVE_DIRECTOR","OPERATIONS_DIRECTOR","LEGAL","FINANCE","ACCOUNTING","MARKET_ANALYST","COMMERCIAL_DIRECTOR","RAIL_LOGISTICS","SYSTEM_ADMIN"]);
const allowedByRole:Record<string,Set<string>>={CLIENT:new Set(["CLIENT_APPLICATION_SUBMIT","CLIENT_CLAIM_SUBMIT","CLIENT_PAYMENT_PROOF_SUBMIT","CLIENT_MESSAGE_SUBMIT","CLIENT_DOCUMENT_ACK"]),AGENT:new Set(["AGENT_MESSAGE_SUBMIT","AGENT_NOTE_SUBMIT"]),ADMIN:new Set(["ADMIN_PUBLICATION_REQUEST","ADMIN_UNPUBLISH_REQUEST","ADMIN_SOURCE_SYNC_REQUEST","ADMIN_PRICE_PUBLICATION_REQUEST","ADMIN_AUTHORITY_ACTION_REQUEST","ADMIN_CLIENT_INTAKE_ROUTE"])};
export async function reverseEvent(c:Ctx,req:Request){
  let body:any;
  try{body=await req.json()}catch{return[400,{ok:false,code:"INVALID_JSON"}] as const}
  const role=String(body.role||"").trim(),eventType=String(body.event_type||"").trim(),idempotencyKey=String(req.headers.get("x-idempotency-key")||body.idempotency_key||"").trim();
  if(!role||!c.roles.includes(role))return[403,{ok:false,code:"ROLE_MISMATCH"}] as const;
  if(!allowedByRole[role]?.has(eventType))return[403,{ok:false,code:"EVENT_TYPE_DENIED"}] as const;
  if(!idempotencyKey||idempotencyKey.length>160)return[400,{ok:false,code:"IDEMPOTENCY_REQUIRED"}] as const;
  const requestHeader=req.headers.get("x-request-id"),correlationHeader=req.headers.get("x-correlation-id"),requestId=requestHeader&&uuid.test(requestHeader)?requestHeader:crypto.randomUUID(),correlationId=correlationHeader&&uuid.test(correlationHeader)?correlationHeader:null;
  if(role==="ADMIN"&&eventType==="ADMIN_CLIENT_INTAKE_ROUTE"){
    const sourceEventId=String(body?.payload?.source_client_event_id||body?.payload?.sourceEventId||"").trim();
    const functionalRole=String(body?.payload?.functional_role||body?.payload?.functionalRole||"").trim().toUpperCase();
    if(!sourceEventId)return[400,{ok:false,code:"SOURCE_CLIENT_EVENT_REQUIRED",request_id:requestId}] as const;
    if(!functionalRoles.has(functionalRole))return[400,{ok:false,code:"INVALID_FUNCTIONAL_ROLE",request_id:requestId}] as const;
    try{
      const rows=await sql`select * from portal_private.server_admin_route_client_intake(${c.user}::uuid,${sourceEventId},${functionalRole}::portal_private.staff_functional_role_enum,${requestId}::uuid,${correlationId}::uuid)`;
      if(rows.length!==1)return[404,{ok:false,code:"CLIENT_INTAKE_NOT_FOUND",request_id:requestId}] as const;
      const row=rows[0];
      return[200,{ok:true,created:!Boolean(row.reused),reused:Boolean(row.reused),event:{event_id:String(row.event_id),processing_state:String(row.processing_state)},task:{task_id:String(row.task_id),assigned_functional_role:String(row.assigned_functional_role)},request_id:requestId}] as const;
    }catch(error){
      const message=String((error as any)?.message||error||"");
      const denied=/admin role required|not client intake|not found|already acknowledged|not routable|required/i.test(message);
      return[denied?403:500,{ok:false,code:denied?"ADMIN_CLIENT_INTAKE_ROUTE_DENIED":"EVENT_SERVER_ERROR",request_id:requestId}] as const;
    }
  }
  try{
    const rows=await sql`select * from portal_private.server_submit_reverse_event(${c.auth}::uuid,${c.sid},${eventType},${String(body.authority_domain||"PORTAL")},${String(body.authority_target_type||"REQUEST")},${body.authority_target_id||null},${body.client_id||null},${body.contract_id||null},${body.deal_id||null},${sql.json(body.payload||{})}::jsonb,${idempotencyKey},${requestId}::uuid,${correlationId}::uuid)`;
    if(rows.length!==1)return[500,{ok:false,code:"EVENT_NOT_CREATED"}] as const;
    const row=rows[0];
    return[row.reused?200:201,{ok:true,created:!row.reused,reused:Boolean(row.reused),event:{event_id:String(row.event_id),processing_state:String(row.processing_state),acknowledgement_state:String(row.acknowledgement_state),created_at:row.created_at},request_id:requestId}] as const;
  }catch(error){
    const message=String((error as any)?.message||error||""),denied=/denied|not found|required|unsupported|idempotency/i.test(message);
    return[denied?403:500,{ok:false,code:denied?"EVENT_SCOPE_DENIED":"EVENT_SERVER_ERROR",request_id:requestId}] as const;
  }
}
