// RONA Trade agent-company signed agreement archive.
// Administrative document evidence only: never mutates deal terms, payables,
// representative identities, or a signed agreement's legal approval state.
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB=Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL=Deno.env.get("SUPABASE_URL");
if(!DB||!SUPA_URL)throw new Error("RONA_AGENCY_ARCHIVE_RUNTIME_MISSING");
const sql=postgres(DB,{prepare:false,max:1,idle_timeout:1,connect_timeout:3,max_lifetime:15});
const BUCKET="rona-portal-private",MAX_PDF=20*1024*1024;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS=new Set(["AGENCY_CONTRACT","AGENCY_ADDENDUM"]);
function key(kind:"pub"|"secret"){
  const old=Deno.env.get(kind==="pub"?"SUPABASE_ANON_KEY":"SUPABASE_SERVICE_ROLE_KEY");
  if(old)return old;
  const raw=Deno.env.get(kind==="pub"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS");
  if(raw){const parsed=JSON.parse(raw);if(parsed.default)return parsed.default}
  throw new Error("RONA_AUTH_KEY_NOT_CONFIGURED");
}
const service=createClient(SUPA_URL,key("secret"),{auth:{persistSession:false,autoRefreshToken:false}});
function send(status:number,body:unknown){return new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",
  "x-content-type-options":"nosniff","referrer-policy":"no-referrer"}
})}
function deny(code:string,status:number){return Object.assign(new Error(code),{status})}
function route(req:Request){const path=new URL(req.url).pathname;const marker="/rona-agent-agreements";
  const i=path.indexOf(marker);return i>=0?path.slice(i+marker.length)||"/":path}
function jwtClaims(token:string){try{const x=token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
  return JSON.parse(atob(x+"=".repeat((4-x.length%4)%4)))}catch{return{}}}
async function context(req:Request){
  if(req.headers.has("x-rona-admin-impersonation-token"))throw deny("ADMIN_IMPERSONATION_DENIED",403);
  const authorization=req.headers.get("authorization");
  if(!authorization?.startsWith("Bearer "))throw deny("PORTAL_ACCESS_DENIED",401);
  const token=authorization.slice(7),sid=jwtClaims(token).session_id;
  if(typeof sid!=="string"||!UUID_RE.test(sid))throw deny("PORTAL_SESSION_INVALID",401);
  const c=createClient(SUPA_URL!,key("pub"),{auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:authorization}}});
  const {data,error}=await c.auth.getUser(token);
  if(error||!data?.user)throw deny("PORTAL_ACCESS_DENIED",401);
  const rows=await sql`
    select p.portal_user_id,p.roles
    from portal_private.resolve_portal_auth(${data.user.id}::uuid,${sid}) p
    join auth.sessions sess on sess.id=${sid}::uuid and sess.user_id=${data.user.id}::uuid
    where p.session_allowed and (sess.not_after is null or sess.not_after>now())
    limit 2`;
  if(rows.length!==1)throw deny("PORTAL_SESSION_INVALID",401);
  if(!(rows[0].roles||[]).map(String).includes("ADMIN"))throw deny("ROLE_MISMATCH",403);
  return{userId:String(rows[0].portal_user_id)};
}
async function audit(tx:any,ctx:{userId:string},req:Request,action:string,entityId:string,meta:Record<string,unknown>){
  const raw=req.headers.get("x-request-id"),requestId=raw&&UUID_RE.test(raw)?raw:crypto.randomUUID();
  await tx`insert into portal_private.audit_events(
    actor_user_id,actor_role,action,entity_type,entity_id,request_id,metadata
  ) values(
    ${ctx.userId}::uuid,'ADMIN',${action},'AGENT_LEGAL_ENTITY',${entityId},
    ${requestId}::uuid,${sql.json(meta as any)}
  )`
}
function nameOf(v:string){const name=String(v||"").normalize("NFC").split(/[\\/]/).pop()?.replace(/[\u0000-\u001f\u007f]/g,"").trim().slice(0,180)||"";
  if(!name||!name.toLowerCase().endsWith(".pdf"))throw deny("PDF_TYPE_INVALID",400);
  return name}
async function legalAgent(id:string){
  if(!/^S-[0-9]{3,}$/.test(id))throw deny("AGENT_COMPANY_ID_INVALID",400);
  const rows=await sql`select id,agent_legal_entity_id,legal_name from portal_private.agent_legal_entities
    where agent_legal_entity_id=${id}
      and lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and authority_state not in ('REJECTED'::portal_private.authority_state_enum,
                                  'SUPERSEDED'::portal_private.authority_state_enum) limit 1`;
  if(rows.length!==1)throw deny("AGENT_COMPANY_NOT_FOUND",404);
  return rows[0]
}
async function listAgents(){
  const agents=await sql`
    select le.id,le.agent_legal_entity_id,le.legal_name,
      count(distinct a.client_key) filter(where a.client_key is not null) as client_count,
      coalesce(array_agg(distinct cl.client_id) filter(where cl.client_id is not null),array[]::text[]) as client_ids,
      coalesce(jsonb_agg(distinct jsonb_build_object(
        'agent_person_id',ap.agent_person_id,'agent_name',coalesce(ap.display_alias,ap.full_name,ap.agent_person_id)))
        filter(where ap.agent_person_id is not null),'[]'::jsonb) as representatives
    from portal_private.agent_legal_entities le
    left join portal_private.agent_client_assignments a on a.agent_legal_entity_key=le.id
       and a.status='ACTIVE'::portal_private.binding_status_enum
       and a.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
       and a.valid_to is null
    left join portal_private.clients cl on cl.id=a.client_key
    left join portal_private.agent_persons ap on ap.id=a.agent_person_key
    where le.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
      and le.authority_state not in ('REJECTED'::portal_private.authority_state_enum,
                                    'SUPERSEDED'::portal_private.authority_state_enum)
    group by le.id order by le.legal_name`;
  const docs=await sql`
    select le.agent_legal_entity_id as agent_company_id,
      ad.document_id,ad.authoritative_filename as filename,
      ad.document_kind,ad.contract_reference,ad.uploaded_at,ad.uploaded_by,

      ad.authority_state::text as document_authority,
      ad.sha256,ad.byte_size
    from portal_private.agent_agency_contract_documents ad
    join portal_private.agent_legal_entities le on le.id=ad.agent_legal_entity_key
    join portal_private.storage_objects so on so.id=ad.storage_object_key
      and so.storage_state='VERIFIED'
    where ad.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    order by ad.uploaded_at desc`;
  const owners=await sql`select distinct owner_portal_user_id
    from portal_private.mcp_oauth_tokens where owner_portal_user_id is not null limit 2`;
  const ownerId=owners.length===1?String(owners[0].owner_portal_user_id):'';
  return{agents:agents.map(a=>({
    agentCompanyId:String(a.agent_legal_entity_id),
    legalName:String(a.legal_name),
    clientCount:Number(a.client_count)||0,
    clientIds:a.client_ids||[],
    representatives:a.representatives||[],
    documents:docs.filter(d=>d.agent_company_id===a.agent_legal_entity_id).map(d=>({
      documentId:String(d.document_id),filename:String(d.filename),
      kind:String(d.document_kind),reference:d.contract_reference||null,
      uploadedAt:d.uploaded_at,authority:String(d.document_authority),
      sha256:String(d.sha256),bytes:Number(d.byte_size),
      ownerApprovedByUpload:!!ownerId&&String(d.uploaded_by)===ownerId
    }))
  }))};
}
async function uploadedByCanonicalOwner(tx:any,userId:string){
 const owners=await tx`select distinct owner_portal_user_id
   from portal_private.mcp_oauth_tokens where owner_portal_user_id is not null limit 2`;
 return owners.length===1&&String(owners[0].owner_portal_user_id)===String(userId);
}
async function upload(ctx:{userId:string},req:Request,companyId:string){
  const agent=await legalAgent(companyId);
  let form:FormData;try{form=await req.formData()}catch{throw deny("INVALID_MULTIPART",400)}
  const file=form.get("file");
  if(!(file instanceof File))throw deny("PDF_REQUIRED",400);
  if(file.size<=0||file.size>MAX_PDF)throw deny("PDF_SIZE_INVALID",400);
  const filename=nameOf(file.name);
  if(file.type&&file.type!=="application/pdf")throw deny("PDF_TYPE_INVALID",400);
  if(String(form.get("attestedSigned"))!=="true")throw deny("SIGNED_DOCUMENT_ATTESTATION_REQUIRED",400);
  const kind=String(form.get("kind")||"").trim();
  if(!KINDS.has(kind))throw deny("AGENCY_DOCUMENT_KIND_INVALID",400);
  const reference=String(form.get("reference")||"").trim();
  if(reference.length>180)throw deny("AGENCY_REFERENCE_TOO_LONG",400);
  const bytes=await file.arrayBuffer();
  if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw deny("PDF_SIGNATURE_INVALID",400);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  const sha256=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,"0")).join("");
  const previous=await sql`
    select document_id from portal_private.agent_agency_contract_documents
    where agent_legal_entity_key=${agent.id}::uuid and sha256=${sha256}
    limit 1`;
  if(previous.length)throw deny("AGENCY_DOCUMENT_ALREADY_ARCHIVED",409);
  const objectName=`agent-companies/${companyId}/signed/${crypto.randomUUID()}.pdf`;
  const uploaded=await service.storage.from(BUCKET).upload(objectName,new Uint8Array(bytes),
    {contentType:"application/pdf",cacheControl:"0",upsert:false});
  if(uploaded.error)throw deny("STORAGE_UPLOAD_FAILED",502);
  try{
    const raw=await sql`select id from storage.objects where bucket_id=${BUCKET} and name=${objectName} limit 1`;
    if(raw.length!==1)throw deny("STORAGE_OBJECT_ID_MISSING",502);
    const documentId=`AGENCY-${companyId}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    await sql.begin(async tx=>{
      const objects=await tx`insert into portal_private.storage_objects(
        bucket_id,object_name,storage_object_id,object_kind,
        content_type,byte_size,sha256,storage_state,created_by,verified_by,verified_at)
      values(${BUCKET},${objectName},${raw[0].id}::uuid,'DOCUMENT',
        'application/pdf',${file.size},${sha256},'VERIFIED',
        ${ctx.userId}::uuid,${ctx.userId}::uuid,now())
      returning id`;
      if(objects.length!==1)throw deny("AGENCY_ARCHIVE_STORAGE_REGISTRATION_FAILED",500);
      await tx`insert into portal_private.agent_agency_contract_documents(
        document_id,agent_legal_entity_key,storage_object_key,
        document_kind,contract_reference,authoritative_filename,
        sha256,byte_size,uploaded_by)
      values(${documentId},${agent.id}::uuid,${objects[0].id}::uuid,
        ${kind},${reference||null},${filename},
        ${sha256},${file.size},${ctx.userId}::uuid)`;
      const ownerApproved=await uploadedByCanonicalOwner(tx,ctx.userId);
      if(ownerApproved)await audit(tx,ctx,req,"AGENCY_DOCUMENT_OWNER_APPROVED_ON_UPLOAD",companyId,{
        documentId,kind,sha256,reference:reference||null,
        authorityScope:"OWNER_APPROVAL_OF_EXACT_UPLOADED_BYTES",
        doesNotImpersonateFinanceLegal:true,doesNotCreatePayable:true
      });
      await audit(tx,ctx,req,"AGENCY_SIGNED_PDF_ARCHIVED",companyId,{
        documentId,kind,reference:reference||null,sha256,byteSize:file.size,
        signedAttestation:true,legalApprovalAutomatic:false,externalPayableCreated:false
      });
    });
    return{documentId,agentCompanyId:companyId,filename,kind,reference:reference||null,sha256};
  }catch(error){
    await service.storage.from(BUCKET).remove([objectName]).catch(()=>null);
    throw error;
  }
}
async function download(ctx:{userId:string},req:Request,companyId:string,documentId:string){
  const agent=await legalAgent(companyId);
  const rows=await sql`
    select ad.document_id,ad.authoritative_filename,so.object_name,so.bucket_id
    from portal_private.agent_agency_contract_documents ad
    join portal_private.storage_objects so on so.id=ad.storage_object_key
      and so.storage_state='VERIFIED'
    where ad.agent_legal_entity_key=${agent.id}::uuid
      and ad.document_id=${documentId}
      and ad.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum
    limit 1`;
  if(rows.length!==1)throw deny("AGENCY_DOCUMENT_NOT_FOUND",404);
  const row=rows[0];
  const {data,error}=await service.storage.from(String(row.bucket_id||BUCKET))
    .createSignedUrl(String(row.object_name),120,{download:String(row.authoritative_filename)});
  if(error||!data?.signedUrl)throw deny("SIGNED_URL_FAILED",502);
  await sql.begin(async tx=>audit(tx,ctx,req,"AGENCY_SIGNED_PDF_DOWNLOAD",companyId,
    {documentId:String(row.document_id),ttlSeconds:120}));
  return{documentId:String(row.document_id),filename:String(row.authoritative_filename),
    url:data.signedUrl,expiresIn:120};
}
Deno.serve(async req=>{
  try{
    if(!["GET","POST"].includes(req.method))return send(405,{ok:false,code:"METHOD_NOT_ALLOWED"});
    const ctx=await context(req),path=route(req);
    if(path==="/admin/agency-contracts"&&req.method==="GET")
      return send(200,{ok:true,data:await listAgents()});
    const add=path.match(/^\/admin\/agency-contracts\/(S-[0-9]{3,})\/documents$/);
    if(add&&req.method==="POST")
      return send(201,{ok:true,data:await upload(ctx,req,add[1])});
    const dl=path.match(/^\/admin\/agency-contracts\/(S-[0-9]{3,})\/documents\/(AGENCY-[A-Za-z0-9-]+)\/download$/);
    if(dl&&req.method==="GET")
      return send(200,{ok:true,data:await download(ctx,req,dl[1],dl[2])});
    return send(404,{ok:false,code:"ROUTE_NOT_FOUND"});
  }catch(error){
    const status=Number((error as any)?.status)||500;
    if(status>=500)console.error("AGENCY_ARCHIVE_INTERNAL_ERROR",(error as any)?.message||"UNKNOWN");
    return send(status,{ok:false,code:status>=500?"AGENCY_ARCHIVE_FAILED":String((error as any)?.message||"DENIED")});
  }
});
