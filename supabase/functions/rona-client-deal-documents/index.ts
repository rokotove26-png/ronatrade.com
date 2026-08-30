import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB=Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL=Deno.env.get("SUPABASE_URL");
if(!DB||!SUPA_URL)throw new Error("runtime vars missing");
const sql=postgres(DB,{prepare:false,max:1});
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET="rona-portal-private";
const MAX_PDF_BYTES=20*1024*1024;
const SOURCE_VERSION="SIGNED_ADDENDUM_UPLOAD_V2";
const REALIZATION_SOURCE="SERVER_AUTHORITATIVE_REALIZATION_V1";

type Ctx={auth:string;user:string;roles:string[];sid:string};
type RealizationState="DONE"|"CURRENT"|"PENDING"|"BLOCKED";
type RealizationStage={key:string;state:RealizationState;detail:string};

function runtimeKey(kind:"pub"|"secret"){
  const legacy=kind==="pub"?Deno.env.get("SUPABASE_ANON_KEY"):Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy)return legacy;
  const raw=Deno.env.get(kind==="pub"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS");
  if(raw){const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}
  throw new Error("key missing");
}
function claims(token:string){
  try{const p=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");return JSON.parse(atob(p+"=".repeat((4-p.length%4)%4)))}catch{return{}}
}
async function authenticate(req:Request):Promise<Ctx|null>{
  const authorization=req.headers.get("authorization");
  if(!authorization?.startsWith("Bearer "))return null;
  const token=authorization.slice(7);
  const client=createClient(SUPA_URL!,runtimeKey("pub"),{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:authorization}}});
  const {data,error}=await client.auth.getUser(token);
  if(error||!data.user)return null;
  const sid=claims(token).session_id;
  if(typeof sid!=="string"||!UUID_RE.test(sid))return null;
  const rows=await sql`select a.portal_user_id,a.roles from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) a join auth.sessions s on s.id=${sid}::uuid and s.user_id=${data.user.id}::uuid where a.session_allowed and (s.not_after is null or s.not_after>now())`;
  if(rows.length!==1)return null;
  return{auth:data.user.id,user:String(rows[0].portal_user_id),roles:(rows[0].roles||[]).map(String),sid};
}
function route(req:Request){
  const pathname=new URL(req.url).pathname;
  const i=pathname.indexOf("/v1/client/");
  return i>=0?pathname.slice(i):pathname;
}
function json(status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}
function safeName(v:string){
  const base=String(v||"signed-addendum.pdf").split(/[\\/]/).pop()||"signed-addendum.pdf";
  const name=base.replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,240);
  return name||"signed-addendum.pdf";
}
async function sha256Hex(bytes:Uint8Array){const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function rawStorageObjectId(objectName:string){const rows=await sql`select id from storage.objects where bucket_id=${BUCKET} and name=${objectName} limit 1`;return rows[0]?.id?String(rows[0].id):null}
function finite(value:unknown):number|null{const n=Number(value);return Number.isFinite(n)?n:null}
function paymentStage(row:any):RealizationStage{
  const obligation=finite(row.obligation_amount),received=finite(row.received_amount);
  if(obligation!==null&&obligation>0&&received!==null){
    const pct=Math.max(0,Math.min(100,Math.round(received/obligation*100)));
    if(received>=obligation)return{key:"payment",state:"DONE",detail:"Оплачено 100%"};
    if(received>0)return{key:"payment",state:"CURRENT",detail:`Оплачено ${pct}% · осталось ${100-pct}%`};
  }
  const finance=String(row.finance_summary_status||row.deal_finance_status||"").toUpperCase();
  if(finance==="OVERDUE")return{key:"payment",state:"CURRENT",detail:"Оплата просрочена"};
  if(["DUE","PAYMENT_DUE","AWAITING_PAYMENT"].includes(finance))return{key:"payment",state:"CURRENT",detail:"Ожидается оплата"};
  if(finance==="PAID")return{key:"payment",state:"DONE",detail:"Оплата подтверждена"};
  if(finance==="NOT_DUE")return{key:"payment",state:"PENDING",detail:"Срок оплаты ещё не наступил"};
  return{key:"payment",state:"PENDING",detail:"Оплата ещё не подтверждена"};
}
function resourceStage(row:any):RealizationStage{
  const state=String(row.resource_decision_state||"").toUpperCase();
  if(state==="RESOURCE_CONFIRMED")return{key:"resource",state:"DONE",detail:"Ресурс подтверждён"};
  if(state==="RESOURCE_DENIED")return{key:"resource",state:"BLOCKED",detail:"Ресурс не подтверждён"};
  if(state)return{key:"resource",state:"CURRENT",detail:"Решение по ресурсу обрабатывается"};
  return{key:"resource",state:"PENDING",detail:"Ресурс пока не подтверждён"};
}
function shipmentStage(row:any):RealizationStage{
  const state=String(row.shipment_status||"").toUpperCase();
  if(!state)return{key:"logistics",state:"PENDING",detail:"Отгрузка ещё не начата"};
  if(state==="PLANNED")return{key:"logistics",state:"PENDING",detail:"Отгрузка запланирована"};
  if(state==="OPEN")return{key:"logistics",state:"CURRENT",detail:"Отгрузка открыта"};
  if(state==="IN_TRANSIT")return{key:"logistics",state:"CURRENT",detail:"Груз в пути"};
  if(state==="ARRIVED")return{key:"logistics",state:"CURRENT",detail:"Груз прибыл, ожидается завершение поставки"};
  if(state==="UNLOADED")return{key:"logistics",state:"DONE",detail:"Груз выгружен"};
  if(state==="CLOSED")return{key:"logistics",state:"DONE",detail:"Поставка завершена"};
  if(state==="CANCELLED")return{key:"logistics",state:"BLOCKED",detail:"Отгрузка отменена"};
  return{key:"logistics",state:"CURRENT",detail:"Отгрузка выполняется"};
}
function closureStage(row:any):RealizationStage{
  const state=String(row.accounting_closure_status||"").toUpperCase();
  if(state==="CLOSED"||row.closed_at)return{key:"close",state:"DONE",detail:"Сделка закрыта"};
  if(state==="PENDING_RECONCILIATION")return{key:"close",state:"CURRENT",detail:"Идёт сверка и закрытие сделки"};
  return{key:"close",state:"PENDING",detail:"Закрытие сделки ещё предстоит"};
}
function realizationStatus(row:any){
  const signed=Boolean(row.signed_supplement_document_key&&row.signed_addendum_document_id&&String(row.signed_lifecycle_state||"").toUpperCase()==="ACTIVE"&&["CONFIRMED","VERIFIED"].includes(String(row.signed_authority_state||"").toUpperCase()));
  const stages:RealizationStage[]=[
    {key:"contract",state:"DONE",detail:"Сделка зарегистрирована и доступна в кабинете"},
    {key:"documents",state:signed?"DONE":"PENDING",detail:signed?"Документы подписаны":"Ожидается подписание документов"},
    paymentStage(row),
    resourceStage(row),
    shipmentStage(row),
    closureStage(row),
  ];
  if(!stages.some(s=>s.state==="CURRENT"||s.state==="BLOCKED")){
    const next=stages.find(s=>s.state==="PENDING");
    if(next)next.state="CURRENT";
  }
  return{source:REALIZATION_SOURCE,completed_count:stages.filter(s=>s.state==="DONE").length,total_count:stages.length,current_stage_key:stages.find(s=>s.state==="CURRENT")?.key||null,has_blocker:stages.some(s=>s.state==="BLOCKED"),stages};
}
async function workflowState(c:Ctx,clientId:string,contractId:string){
  const rows=await sql`
    select d.deal_id,d.business_status,d.finance_status::text as deal_finance_status,d.accounting_closure_status::text as accounting_closure_status,d.opened_at,d.closed_at,d.updated_at as deal_updated_at,
      coalesce(w.payment_handoff_state,'NOT_SENT') as payment_handoff_state,coalesce(w.payment_expectation_state,'NOT_CREATED') as payment_expectation_state,w.client_addendum_downloaded_at,w.client_invoice_downloaded_at,w.signed_supplement_document_key,w.updated_at as workflow_updated_at,
      sd.document_id as signed_addendum_document_id,sd.authority_state::text as signed_authority_state,sd.lifecycle_state::text as signed_lifecycle_state,
      fs.obligation_amount,fs.received_amount,fs.client_remaining_amount,fs.currency as finance_currency,fs.finance_status as finance_summary_status,fs.updated_at as finance_updated_at,
      rd.decision_state as resource_decision_state,rd.decided_at as resource_decided_at,
      sh.shipment_status::text as shipment_status,sh.actual_departure_at,sh.actual_arrival_at,sh.closed_at as shipment_closed_at,sh.updated_at as shipment_updated_at,
      case when sd.id is not null and sd.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum then 'DOCUMENTS_SIGNED' when coalesce(w.payment_handoff_state,'NOT_SENT')='SENT' then 'PAYMENTS' else 'DEAL_DOCUMENTS' end as client_stage
    from portal_private.deals d
    join portal_private.clients cl on cl.id=d.client_key
    join portal_private.contracts ct on ct.id=d.contract_key
    left join portal_private.owner_deal_workflow w on w.deal_key=d.id
    left join portal_private.documents sd on sd.id=w.signed_supplement_document_key
    left join lateral (
      select f.obligation_amount,f.received_amount,f.client_remaining_amount,f.currency,f.finance_status,f.updated_at
      from portal_private.owner_deal_finance_summary f
      where f.deal_id=d.deal_id and f.authority_state in ('CONFIRMED','VERIFIED') and f.lifecycle_state='ACTIVE'
      order by f.updated_at desc limit 1
    ) fs on true
    left join lateral (
      select r.decision_state,r.decided_at
      from portal_private.resource_decisions r
      where r.deal_key=d.id
      order by r.decided_at desc nulls last,r.created_at desc limit 1
    ) rd on true
    left join lateral (
      select s.shipment_status,s.actual_departure_at,s.actual_arrival_at,s.closed_at,s.updated_at
      from portal_private.shipments s
      where s.deal_key=d.id and s.authority_state in ('CONFIRMED'::portal_private.authority_state_enum,'VERIFIED'::portal_private.authority_state_enum) and s.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      order by s.updated_at desc limit 1
    ) sh on true
    where cl.client_id=${clientId} and ct.contract_id=${contractId} and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now())
    order by d.created_at desc`;
  return rows.map((row:any)=>({...row,realization_status:realizationStatus(row)}));
}
async function markDownloaded(c:Ctx,dealId:string,documentId:string){
  const rows=await sql`select d.id as deal_key,odd.document_kind from portal_private.deals d join portal_private.owner_deal_documents odd on odd.deal_key=d.id join portal_private.documents doc on doc.id=odd.document_key join portal_private.document_versions dv on dv.id=doc.current_version_id join portal_private.storage_objects so on so.document_version_key=dv.id and so.storage_state='VERIFIED' where d.deal_id=${dealId} and doc.document_id=${documentId} and odd.document_kind in ('ADDENDUM','INVOICE') and doc.authority_state='CONFIRMED'::portal_private.authority_state_enum and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and dv.is_current and dv.is_effective and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now()) limit 1`;
  if(rows.length!==1)return null;
  const row=rows[0];
  await sql`insert into portal_private.owner_deal_workflow(deal_key) values(${row.deal_key}::uuid) on conflict(deal_key) do nothing`;
  if(String(row.document_kind)==="ADDENDUM")await sql`update portal_private.owner_deal_workflow set client_addendum_downloaded_at=coalesce(client_addendum_downloaded_at,now()),updated_at=now() where deal_key=${row.deal_key}::uuid`;
  else await sql`update portal_private.owner_deal_workflow set client_invoice_downloaded_at=coalesce(client_invoice_downloaded_at,now()),updated_at=now() where deal_key=${row.deal_key}::uuid`;
  try{await sql`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(${c.user}::uuid,'CLIENT','CLIENT_DEAL_DOCUMENT_DOWNLOADED','DEAL',${dealId},${sql.json({document_id:documentId,document_kind:String(row.document_kind)})})`}catch(error){console.error("deal document download audit failed",error)}
  const state=await sql`select client_addendum_downloaded_at,client_invoice_downloaded_at,payment_handoff_state,payment_expectation_state from portal_private.owner_deal_workflow where deal_key=${row.deal_key}::uuid`;
  return state[0]||null;
}
async function uploadSignedAddendum(c:Ctx,req:Request,dealId:string){
  const contentType=String(req.headers.get("content-type")||"").toLowerCase();
  if(!contentType.includes("multipart/form-data"))return json(415,{ok:false,code:"MULTIPART_REQUIRED"});
  let form:FormData;
  try{form=await req.formData()}catch{return json(400,{ok:false,code:"INVALID_MULTIPART"})}
  const file=form.get("file");
  const sourceUnsignedDocumentId=String(form.get("sourceUnsignedDocumentId")||"").trim();
  if(!(file instanceof File))return json(400,{ok:false,code:"PDF_REQUIRED"});
  if(!sourceUnsignedDocumentId)return json(400,{ok:false,code:"SOURCE_ADDENDUM_REQUIRED"});
  const filename=safeName(file.name);
  if(file.size<1||file.size>MAX_PDF_BYTES)return json(413,{ok:false,code:"PDF_SIZE_INVALID",max_bytes:MAX_PDF_BYTES});
  if(!filename.toLowerCase().endsWith(".pdf")||(file.type&&String(file.type).toLowerCase()!=="application/pdf"))return json(415,{ok:false,code:"PDF_REQUIRED"});
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")return json(415,{ok:false,code:"PDF_SIGNATURE_INVALID"});

  const scope=await sql`select d.id as deal_key,d.client_key,d.contract_key,cl.client_id,ct.contract_id,w.client_addendum_downloaded_at from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key left join portal_private.owner_deal_workflow w on w.deal_key=d.id where d.deal_id=${dealId} and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now()) limit 1`;
  if(scope.length!==1)return json(404,{ok:false,code:"DEAL_NOT_FOUND"});
  const deal=scope[0];
  if(!deal.client_addendum_downloaded_at)return json(409,{ok:false,code:"ADDENDUM_DOWNLOAD_REQUIRED"});
  const sourceDs=await sql`select doc.id,doc.document_id,doc.current_version_id,dv.id as version_id from portal_private.owner_deal_documents odd join portal_private.documents doc on doc.id=odd.document_key join portal_private.document_versions dv on dv.id=doc.current_version_id join portal_private.storage_objects so on so.document_version_key=dv.id and so.storage_state='VERIFIED' where odd.deal_key=${deal.deal_key}::uuid and odd.document_kind='ADDENDUM' and doc.authority_state='CONFIRMED'::portal_private.authority_state_enum and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and dv.is_current and dv.is_effective and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by doc.updated_at desc limit 1`;
  if(sourceDs.length!==1)return json(409,{ok:false,code:"CURRENT_ADDENDUM_REQUIRED"});
  if(String(sourceDs[0].document_id)!==sourceUnsignedDocumentId)return json(409,{ok:false,code:"ADDENDUM_SOURCE_CHANGED",current_document_id:String(sourceDs[0].document_id)});
  const existingSigned=await sql`select doc.document_id from portal_private.owner_deal_documents odd join portal_private.documents doc on doc.id=odd.document_key join portal_private.document_versions dv on dv.id=doc.current_version_id where odd.deal_key=${deal.deal_key}::uuid and odd.document_kind='SIGNED_ADDENDUM' and doc.authority_state='CONFIRMED'::portal_private.authority_state_enum and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and dv.is_current and dv.is_effective and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum order by doc.updated_at desc limit 1`;
  if(existingSigned.length)return json(409,{ok:false,code:"SIGNED_ADDENDUM_ALREADY_CURRENT",document_id:String(existingSigned[0].document_id)});

  const sha=await sha256Hex(bytes);
  const objectName=`deals/${String(deal.client_id)}/${dealId}/signed-addendum/${crypto.randomUUID()}.pdf`;
  const storage=createClient(SUPA_URL!,runtimeKey("secret"),{auth:{persistSession:false,autoRefreshToken:false}});
  const uploaded=await storage.storage.from(BUCKET).upload(objectName,bytes,{contentType:"application/pdf",upsert:false,cacheControl:"0"});
  if(uploaded.error)return json(502,{ok:false,code:"STORAGE_UPLOAD_FAILED"});
  const rawStorageId=await rawStorageObjectId(objectName);
  if(!rawStorageId){await storage.storage.from(BUCKET).remove([objectName]).catch(()=>null);return json(502,{ok:false,code:"STORAGE_OBJECT_ID_MISSING"})}

  const documentKey=crypto.randomUUID();
  const versionKey=crypto.randomUUID();
  const storageKey=crypto.randomUUID();
  const documentId=`${dealId}-SIGNED-ADDENDUM-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  try{
    await sql.begin(async(tx:any)=>{
      const lockedSource=await tx`select doc.id,doc.document_id,doc.current_version_id,dv.id as version_id from portal_private.owner_deal_documents odd join portal_private.documents doc on doc.id=odd.document_key join portal_private.document_versions dv on dv.id=doc.current_version_id where odd.deal_key=${deal.deal_key}::uuid and odd.document_kind='ADDENDUM' and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and doc.authority_state='CONFIRMED'::portal_private.authority_state_enum and dv.is_current and dv.is_effective and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and doc.document_id=${sourceUnsignedDocumentId} for update of doc,dv`;
      if(lockedSource.length!==1)throw new Error("ADDENDUM_SOURCE_CHANGED");
      const lockedSigned=await tx`select doc.id from portal_private.owner_deal_documents odd join portal_private.documents doc on doc.id=odd.document_key join portal_private.document_versions dv on dv.id=doc.current_version_id where odd.deal_key=${deal.deal_key}::uuid and odd.document_kind='SIGNED_ADDENDUM' and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and doc.authority_state='CONFIRMED'::portal_private.authority_state_enum and dv.is_current and dv.is_effective and dv.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum for update of doc,dv`;
      if(lockedSigned.length)throw new Error("SIGNED_ADDENDUM_ALREADY_CURRENT");

      await tx`insert into portal_private.documents(id,document_id,document_type,client_key,contract_key,deal_key,authoritative_filename,source_system,source_version,source_timestamp,authority_state,lifecycle_state) values(${documentKey}::uuid,${documentId},'SIGNED_ADDENDUM',${deal.client_key}::uuid,${deal.contract_key}::uuid,${deal.deal_key}::uuid,${filename},'CLIENT_PORTAL',${SOURCE_VERSION},now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
      await tx`insert into portal_private.document_versions(id,document_key,version_number,authoritative_filename,sha256,storage_path,uploaded_by,is_current,is_effective,source_system,source_version,source_timestamp,authority_state,lifecycle_state) values(${versionKey}::uuid,${documentKey}::uuid,1,${filename},${sha},${objectName},${c.user}::uuid,true,true,'CLIENT_PORTAL',${SOURCE_VERSION},now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
      await tx`update portal_private.documents set current_version_id=${versionKey}::uuid,updated_at=now() where id=${documentKey}::uuid`;
      await tx`insert into portal_private.storage_objects(id,bucket_id,object_name,storage_object_id,object_kind,client_key,contract_key,deal_key,document_version_key,content_type,byte_size,sha256,storage_state,created_by,verified_by,verified_at) values(${storageKey}::uuid,${BUCKET},${objectName},${rawStorageId}::uuid,'DOCUMENT',${deal.client_key}::uuid,${deal.contract_key}::uuid,${deal.deal_key}::uuid,${versionKey}::uuid,'application/pdf',${file.size},${sha},'VERIFIED',${c.user}::uuid,${c.user}::uuid,now())`;
      await tx`insert into portal_private.owner_deal_documents(deal_key,document_key,document_kind) values(${deal.deal_key}::uuid,${documentKey}::uuid,'SIGNED_ADDENDUM')`;

      await tx`update portal_private.document_versions set is_current=false,is_effective=false,superseded_by=${versionKey}::uuid,lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum where id=${lockedSource[0].version_id}::uuid`;
      await tx`update portal_private.documents set lifecycle_state='SUPERSEDED'::portal_private.lifecycle_state_enum,updated_at=now() where id=${lockedSource[0].id}::uuid`;
      await tx`insert into portal_private.owner_deal_workflow(deal_key,payment_handoff_state,signed_supplement_document_key,updated_at) values(${deal.deal_key}::uuid,'READY',${documentKey}::uuid,now()) on conflict(deal_key) do update set payment_handoff_state='READY',signed_supplement_document_key=${documentKey}::uuid,updated_at=now()`;
      await tx`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(${c.user}::uuid,'CLIENT','CLIENT_SIGNED_ADDENDUM_UPLOADED_AUTHORITATIVE','DEAL',${dealId},${sql.json({signed_document_id:documentId,signed_document_key:documentKey,signed_version_key:versionKey,source_addendum_document_id:String(lockedSource[0].document_id),source_addendum_document_key:String(lockedSource[0].id),source_addendum_version_key:String(lockedSource[0].version_id),sha256:sha,storage_object_id:storageKey,source_version:SOURCE_VERSION})})`;
    });
  }catch(error){
    console.error("signed addendum metadata failed",error);
    await storage.storage.from(BUCKET).remove([objectName]).catch(()=>null);
    const code=String((error as Error)?.message||"");
    if(code.includes("ADDENDUM_SOURCE_CHANGED"))return json(409,{ok:false,code:"ADDENDUM_SOURCE_CHANGED"});
    if(code.includes("SIGNED_ADDENDUM_ALREADY_CURRENT"))return json(409,{ok:false,code:"SIGNED_ADDENDUM_ALREADY_CURRENT"});
    return json(500,{ok:false,code:"SIGNED_ADDENDUM_REGISTER_FAILED"});
  }
  const signedDocument={document_id:documentId,document_type:"SIGNED_ADDENDUM",authoritative_filename:filename,deal_id:dealId,storage_object_id:storageKey,sha256:sha};
  return json(201,{ok:true,signed_document:signedDocument,document:signedDocument,supersedes_document_id:sourceUnsignedDocumentId,workflow:{client_stage:"DOCUMENTS_SIGNED",document_status:"SIGNED",payment_handoff_state:"READY"}});
}

Deno.serve(async(req:Request)=>{
  if(!["GET","POST","OPTIONS"].includes(req.method))return json(405,{ok:false,code:"METHOD_NOT_ALLOWED"});
  if(req.method==="OPTIONS")return new Response(null,{status:204});
  const c=await authenticate(req);
  if(!c||!c.roles.includes("CLIENT"))return json(401,{ok:false,code:"PORTAL_ACCESS_DENIED"});
  const url=new URL(req.url),path=route(req);
  try{
    if(path==="/v1/client/deal-documents/state"&&req.method==="GET"){
      const clientId=url.searchParams.get("clientId"),contractId=url.searchParams.get("contractId");
      if(!clientId||!contractId)return json(400,{ok:false,code:"CLIENT_CONTRACT_CONTEXT_REQUIRED"});
      return json(200,{ok:true,deals:await workflowState(c,clientId,contractId)});
    }
    const mark=path.match(/^\/v1\/client\/deals\/(DEAL-\d{4}-\d{3,})\/documents\/([^/]+)\/downloaded$/);
    if(mark&&req.method==="POST"){
      const documentId=decodeURIComponent(mark[2]);
      const state=await markDownloaded(c,mark[1],documentId);
      return state?json(200,{ok:true,workflow:state}):json(404,{ok:false,code:"DEAL_DOCUMENT_NOT_FOUND"});
    }
    const upload=path.match(/^\/v1\/client\/deals\/(DEAL-\d{4}-\d{3,})\/signed-addendum$/);
    if(upload&&req.method==="POST")return await uploadSignedAddendum(c,req,upload[1]);
    return json(404,{ok:false,code:"ROUTE_NOT_FOUND"});
  }catch(error){console.error("client deal documents",error);return json(500,{ok:false,code:"SERVER_ERROR"})}
});