import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB=Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL=Deno.env.get("SUPABASE_URL");
if(!DB||!SUPA_URL)throw new Error("runtime vars missing");
const sql=postgres(DB,{prepare:false,max:1});
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUCKET="rona-portal-private";
const MAX_PDF_BYTES=20*1024*1024;

type Ctx={auth:string;user:string;roles:string[];sid:string};

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
  const marker="/rona-client-deal-documents";
  const i=pathname.indexOf(marker);
  return i>=0?(pathname.slice(i+marker.length)||"/"):pathname;
}
function json(status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function safeName(v:string){const name=String(v||"").replace(/[\u0000-\u001f\u007f]/g,"").trim();return name.slice(0,240)||"signed-addendum.pdf"}
async function sha256Hex(bytes:Uint8Array){const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("")}
async function workflowState(c:Ctx,clientId:string,contractId:string){
  return await sql`select d.deal_id,coalesce(w.payment_handoff_state,'NOT_SENT') as payment_handoff_state,coalesce(w.payment_expectation_state,'NOT_CREATED') as payment_expectation_state,w.client_addendum_downloaded_at,w.client_invoice_downloaded_at,w.signed_supplement_document_key,sd.document_id as signed_addendum_document_id,case when coalesce(w.payment_handoff_state,'NOT_SENT') in ('READY','SENT') then 'PAYMENTS' else 'DEAL_DOCUMENTS' end as client_stage from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key left join portal_private.owner_deal_workflow w on w.deal_key=d.id left join portal_private.documents sd on sd.id=w.signed_supplement_document_key where cl.client_id=${clientId} and ct.contract_id=${contractId} and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now()) order by d.created_at desc`;
}
async function markDownloaded(c:Ctx,dealId:string,documentId:string){
  const rows=await sql`select d.id as deal_key,odd.document_kind from portal_private.deals d join portal_private.owner_deal_documents odd on odd.deal_key=d.id join portal_private.documents doc on doc.id=odd.document_key where d.deal_id=${dealId} and doc.document_id=${documentId} and odd.document_kind in ('ADDENDUM','INVOICE') and doc.authority_state='CONFIRMED'::portal_private.authority_state_enum and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now()) limit 1`;
  if(rows.length!==1)return null;
  const row=rows[0];
  await sql`insert into portal_private.owner_deal_workflow(deal_key) values(${row.deal_key}::uuid) on conflict(deal_key) do nothing`;
  if(String(row.document_kind)==="ADDENDUM")await sql`update portal_private.owner_deal_workflow set client_addendum_downloaded_at=coalesce(client_addendum_downloaded_at,now()),updated_at=now() where deal_key=${row.deal_key}::uuid`;
  else await sql`update portal_private.owner_deal_workflow set client_invoice_downloaded_at=coalesce(client_invoice_downloaded_at,now()),updated_at=now() where deal_key=${row.deal_key}::uuid`;
  const state=await sql`select client_addendum_downloaded_at,client_invoice_downloaded_at,payment_handoff_state,payment_expectation_state from portal_private.owner_deal_workflow where deal_key=${row.deal_key}::uuid`;
  return state[0]||null;
}
async function uploadSignedAddendum(c:Ctx,req:Request,dealId:string){
  const contentType=String(req.headers.get("content-type")||"").toLowerCase();
  if(!contentType.includes("multipart/form-data"))return json(415,{ok:false,code:"MULTIPART_REQUIRED"});
  let form:FormData;
  try{form=await req.formData()}catch{return json(400,{ok:false,code:"INVALID_MULTIPART"})}
  const file=form.get("file");
  if(!(file instanceof File))return json(400,{ok:false,code:"PDF_REQUIRED"});
  const filename=safeName(file.name);
  if(file.size<1||file.size>MAX_PDF_BYTES)return json(413,{ok:false,code:"PDF_SIZE_INVALID",max_bytes:MAX_PDF_BYTES});
  if(!filename.toLowerCase().endsWith(".pdf")&&String(file.type||"").toLowerCase()!=="application/pdf")return json(415,{ok:false,code:"PDF_REQUIRED"});

  const scope=await sql`select d.id as deal_key,d.client_key,d.contract_key,cl.client_id,ct.contract_id,w.client_addendum_downloaded_at from portal_private.deals d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key left join portal_private.owner_deal_workflow w on w.deal_key=d.id where d.deal_id=${dealId} and d.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and portal_private.client_user_has_deal_access(${c.user}::uuid,d.id,now()) limit 1`;
  if(scope.length!==1)return json(404,{ok:false,code:"DEAL_NOT_FOUND"});
  const deal=scope[0];
  if(!deal.client_addendum_downloaded_at)return json(409,{ok:false,code:"ADDENDUM_DOWNLOAD_REQUIRED"});
  const sourceDs=await sql`select doc.id,doc.document_id from portal_private.owner_deal_documents odd join portal_private.documents doc on doc.id=odd.document_key join portal_private.document_versions dv on dv.id=doc.current_version_id join portal_private.storage_objects so on so.document_version_key=dv.id and so.storage_state='VERIFIED' where odd.deal_key=${deal.deal_key}::uuid and odd.document_kind='ADDENDUM' and doc.authority_state='CONFIRMED'::portal_private.authority_state_enum and doc.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and dv.is_current and dv.is_effective order by doc.updated_at desc limit 1`;
  if(sourceDs.length!==1)return json(409,{ok:false,code:"CURRENT_ADDENDUM_REQUIRED"});

  const bytes=new Uint8Array(await file.arrayBuffer());
  const sha=await sha256Hex(bytes);
  const objectToken=crypto.randomUUID();
  const objectName=`deals/${String(deal.client_id)}/${dealId}/signed-addendum/${objectToken}.pdf`;
  const storage=createClient(SUPA_URL!,runtimeKey("secret"),{auth:{persistSession:false,autoRefreshToken:false}});
  const uploaded=await storage.storage.from(BUCKET).upload(objectName,bytes,{contentType:"application/pdf",upsert:false,cacheControl:"0"});
  if(uploaded.error)return json(502,{ok:false,code:"STORAGE_UPLOAD_FAILED"});

  const documentKey=crypto.randomUUID();
  const versionKey=crypto.randomUUID();
  const storageKey=crypto.randomUUID();
  const documentId=`${dealId}-SIGNED-ADDENDUM-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  try{
    await sql.begin(async(tx:any)=>{
      await tx`insert into portal_private.documents(id,document_id,document_type,client_key,contract_key,deal_key,authoritative_filename,source_system,source_version,source_timestamp,authority_state,lifecycle_state) values(${documentKey}::uuid,${documentId},'SIGNED_ADDENDUM',${deal.client_key}::uuid,${deal.contract_key}::uuid,${deal.deal_key}::uuid,${filename},'CLIENT_PORTAL','SIGNED_ADDENDUM_UPLOAD_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
      await tx`insert into portal_private.document_versions(id,document_key,version_number,authoritative_filename,sha256,storage_path,uploaded_by,is_current,is_effective,source_system,source_version,source_timestamp,authority_state,lifecycle_state) values(${versionKey}::uuid,${documentKey}::uuid,1,${filename},${sha},${objectName},${c.user}::uuid,true,true,'CLIENT_PORTAL','SIGNED_ADDENDUM_UPLOAD_V1',now(),'CONFIRMED'::portal_private.authority_state_enum,'ACTIVE'::portal_private.lifecycle_state_enum)`;
      await tx`update portal_private.documents set current_version_id=${versionKey}::uuid where id=${documentKey}::uuid`;
      await tx`insert into portal_private.storage_objects(id,bucket_id,object_name,object_kind,client_key,contract_key,deal_key,document_version_key,content_type,byte_size,sha256,storage_state,created_by,verified_by,verified_at) values(${storageKey}::uuid,${BUCKET},${objectName},'DOCUMENT',${deal.client_key}::uuid,${deal.contract_key}::uuid,${deal.deal_key}::uuid,${versionKey}::uuid,'application/pdf',${file.size},${sha},'VERIFIED',${c.user}::uuid,${c.user}::uuid,now())`;
      await tx`insert into portal_private.owner_deal_documents(deal_key,document_key,document_kind) values(${deal.deal_key}::uuid,${documentKey}::uuid,'SIGNED_ADDENDUM')`;
      await tx`update portal_private.owner_deal_workflow set payment_handoff_state='READY',payment_handoff_at=coalesce(payment_handoff_at,now()),payment_handoff_by=coalesce(payment_handoff_by,${c.user}::uuid),updated_at=now() where deal_key=${deal.deal_key}::uuid`;
    });
  }catch(error){
    console.error("signed addendum metadata failed",error);
    await storage.storage.from(BUCKET).remove([objectName]).catch(()=>null);
    return json(500,{ok:false,code:"SIGNED_ADDENDUM_REGISTER_FAILED"});
  }
  try{await sql`insert into portal_private.audit_events(actor_user_id,actor_role,action,entity_type,entity_id,metadata) values(${c.user}::uuid,'CLIENT','CLIENT_SIGNED_ADDENDUM_UPLOADED','DEAL',${dealId},${sql.json({document_id:documentId,source_addendum_document_id:String(sourceDs[0].document_id),sha256:sha,storage_object_id:storageKey})})`}catch(error){console.error("signed addendum audit failed",error)}
  return json(201,{ok:true,document:{document_id:documentId,document_type:"SIGNED_ADDENDUM",authoritative_filename:filename,deal_id:dealId,storage_object_id:storageKey,sha256:sha},workflow:{client_stage:"PAYMENTS",payment_handoff_state:"READY"}});
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
