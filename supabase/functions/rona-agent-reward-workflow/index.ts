// RONA Trade agent-company signed agreement archive.
// Administrative document evidence only: never mutates deal terms, payables,
// representative identities, or a signed agreement's legal approval state.
import {adminActAction,actFiles,reviewState,agentInbox,agentDownload,approvedActIssue} from "./acts.ts";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const DB=Deno.env.get("SUPABASE_DB_URL");
const SUPA_URL=Deno.env.get("SUPABASE_URL");
if(!DB||!SUPA_URL)throw new Error("RONA_AGENT_REWARD_WORKFLOW_RUNTIME_MISSING");
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
function route(req:Request){const path=new URL(req.url).pathname;const marker="/rona-agent-reward-workflow";
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
async function agentContext(req:Request){
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
  if(!(rows[0].roles||[]).map(String).includes("AGENT"))throw deny("ROLE_MISMATCH",403);
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

const DEAL_ID=/^DEAL-20[0-9]{2}-[0-9]{3,}$/;
const DOC_ID=/^AGENCY-S-[0-9]{3,}-[A-Z0-9]{8}$/;
async function scope(dealId:string,assignmentId:string){
 if(!DEAL_ID.test(dealId)||!UUID_RE.test(assignmentId))throw deny("DEAL_ASSIGNMENT_INVALID",400);
 const rows=await sql`select d.id as deal_key,d.deal_id,d.business_status,
 a.id as assignment_id,a.agent_legal_entity_key,a.agent_person_key,
 a.status::text as assignment_status,l.agent_legal_entity_id,l.legal_name,
 p.agent_person_id,coalesce(p.display_alias,p.full_name,p.agent_person_id) as agent_name
 from portal_private.deals d
 join portal_private.agent_client_assignments a on a.client_key=d.client_key and a.id=${assignmentId}::uuid
 join portal_private.agent_legal_entities l on l.id=a.agent_legal_entity_key
 join portal_private.agent_persons p on p.id=a.agent_person_key
 where d.deal_id=${dealId} and d.lifecycle_state::text not in ('ARCHIVED','SUPERSEDED')
 and (
   (a.status::text='ACTIVE' and a.lifecycle_state::text='ACTIVE'
     and a.authority_state::text in ('CONFIRMED','VERIFIED','AUTHORITATIVE'))
   or exists(select 1 from portal_private.agent_deal_terms t
     where t.deal_key=d.id and t.assignment_id=a.id)
 )
 limit 2`;
 if(rows.length!==1)throw deny("DEAL_AGENT_SOURCE_MISSING",404);
 return rows[0]
}
async function termFor(s:any){
 const rows=await sql`select id,commission_mode,commission_rate,commission_fixed_amount,
 btrim(currency::text) as currency,term_reference,status::text as status,
 authority_state::text as authority_state
 from portal_private.agent_deal_terms
 where deal_key=${s.deal_key}::uuid and assignment_id=${s.assignment_id}::uuid
 and status::text='ACTIVE' and lifecycle_state::text='ACTIVE'
 and authority_state::text in ('CONFIRMED','VERIFIED','AUTHORITATIVE')
 and valid_from<=now() and (valid_to is null or valid_to>now())
 order by updated_at desc limit 3`;
 return rows.length===1?rows[0]:null
}
async function selected(s:any){
 const rows=await sql`select b.id,b.evidence_status,b.document_reference,b.linked_at,
 a.document_id,a.authoritative_filename as filename,a.contract_reference,a.sha256
 from portal_private.agent_reward_deal_addenda_v1 b
 join portal_private.agent_agency_contract_documents a on a.id=b.agency_document_key
 join portal_private.storage_objects o on o.id=a.storage_object_key and o.storage_state='VERIFIED'
 where b.deal_key=${s.deal_key}::uuid and b.assignment_id=${s.assignment_id}::uuid
 and b.agent_legal_entity_key=${s.agent_legal_entity_key}::uuid and b.is_current=true
 and a.document_kind='AGENCY_ADDENDUM' and a.lifecycle_state::text='ACTIVE' limit 2`;
 return rows.length===1?rows[0]:null
}
async function latestCorrection(s:any){
 const rows=await sql`select id,correction_version,created_at
 from portal_private.agent_reward_owner_corrections_v1
 where deal_key=${s.deal_key}::uuid and assignment_id=${s.assignment_id}::uuid
 order by correction_version desc limit 1`;
 return rows[0]||null
}
async function list(s:any){
 const [term,addendum,correction]=await Promise.all([termFor(s),selected(s),latestCorrection(s)]);
 const acts=await sql`select r.id,r.request_status,r.correction_version,r.owner_correction_key,
 r.addendum_key,r.requested_at,r.dispatched_at,r.completed_at
 from portal_private.agent_reward_act_requests_v1 r
 where r.deal_key=${s.deal_key}::uuid and r.assignment_id=${s.assignment_id}::uuid
 order by r.requested_at desc limit 30`;
 const enriched=[];
 for(const a of acts){
   const review=await reviewState(sql,String(a.id)),files=await actFiles(sql,String(a.id));
   enriched.push({...a,review,documents:files});
 }
 return{dealId:s.deal_id,assignmentId:s.assignment_id,agentCompanyId:s.agent_legal_entity_id,
   agentLegalName:s.legal_name,agentName:s.agent_name,assignmentStatus:s.assignment_status,
   term:term?{termId:term.id,mode:term.commission_mode,rate:term.commission_rate,
     fixedAmount:term.commission_fixed_amount,currency:term.currency,
     reference:term.term_reference,authority:term.authority_state}:null,
   currentAddendum:addendum?{bindingId:addendum.id,documentId:addendum.document_id,
     filename:addendum.filename,reference:addendum.document_reference,
     evidenceStatus:addendum.evidence_status}:null,
   ownerCorrection:correction?{sourceId:correction.id,version:correction.correction_version,
     savedAt:correction.created_at}:null,acts:enriched}
}
async function bind(actor:{userId:string},req:Request,s:any,body:any){
 const docId=String(body?.documentId||"");
 if(!DOC_ID.test(docId))throw deny("SIGNED_ADDENDUM_DOCUMENT_ID_INVALID",400);
 const rows=await sql`select a.id,a.document_id,a.contract_reference from portal_private.agent_agency_contract_documents a
 join portal_private.storage_objects o on o.id=a.storage_object_key and o.storage_state='VERIFIED'
 where a.document_id=${docId} and a.agent_legal_entity_key=${s.agent_legal_entity_key}::uuid
 and a.document_kind='AGENCY_ADDENDUM' and a.lifecycle_state::text='ACTIVE' limit 2`;
 if(rows.length!==1)throw deny("SIGNED_ADDENDUM_WRONG_AGENT",404);
 const doc=rows[0],reference=String(doc.contract_reference||"").trim();
 if(reference.length<3)throw deny("ADDENDUM_REFERENCE_REQUIRED",409);
 const term=await termFor(s),old=await selected(s);
 if(old?.document_id===docId)return{bindingId:old.id,status:"ALREADY_LINKED"};
 if(old)throw deny("DEAL_SIGNED_ADDENDUM_ALREADY_LINKED",409);
 let bindingId="";
 await sql.begin(async tx=>{
   await tx`select pg_advisory_xact_lock(hashtext(${s.deal_id}))`;
   // Lock the canonical deal row as well: repeated submissions are serialized across assignments.
   await tx`select id from portal_private.deals where id=${s.deal_key}::uuid for update`;
   const currentDeal=await tx`select b.id,a.document_id from portal_private.agent_reward_deal_addenda_v1 b
     join portal_private.agent_agency_contract_documents a on a.id=b.agency_document_key
     where b.deal_key=${s.deal_key}::uuid and b.is_current=true limit 2`;
   if(currentDeal.length)throw deny("DEAL_SIGNED_ADDENDUM_ALREADY_LINKED",409);
   const b=await tx`insert into portal_private.agent_reward_deal_addenda_v1(
       deal_key,assignment_id,agent_legal_entity_key,agency_document_key,term_key,document_reference,linked_by)
     values(${s.deal_key}::uuid,${s.assignment_id}::uuid,${s.agent_legal_entity_key}::uuid,
       ${doc.id}::uuid,${term?.id||null}::uuid,${reference},${actor.userId}::uuid)
     on conflict(deal_key,assignment_id,agency_document_key)
     do nothing returning id`;
   if(b.length!==1)throw deny("DEAL_SIGNED_ADDENDUM_ALREADY_LINKED",409);
   bindingId=String(b[0].id);
   await audit(tx,actor,req,"AGENT_SIGNED_ADDENDUM_LINKED_TO_DEAL",s.deal_id,{
     bindingId,documentId:docId,assignmentId:s.assignment_id,
     noAutomaticLegalApproval:true,noAutomaticPayable:true});
 });
 return{bindingId,documentId:docId,status:"RECEIVED_NOT_LEGALLY_VERIFIED"}
}
async function requestAct(actor:{userId:string},req:Request,s:any){
 const [correction,addendum,term]=await Promise.all([latestCorrection(s),selected(s),termFor(s)]);
 if(!correction)throw deny("SAVE_OWNER_CORRECTION_FIRST",409);
 if(!addendum)throw deny("LINK_SIGNED_DEAL_ADDENDUM_FIRST",409);
 const snapshot={dealId:s.deal_id,assignmentId:s.assignment_id,agentCompanyId:s.agent_legal_entity_id,
   correctionId:correction.id,correctionVersion:correction.correction_version,
   addendumId:addendum.document_id,addendumReference:addendum.document_reference,
   activeTermKey:term?.id||null,activeTermReference:term?.term_reference||null,
   calculationStatus:"FINANCE_REVIEW_REQUIRED",legalStatus:"LEGAL_REVIEW_REQUIRED",
   createsExternalPayable:false};
 const rows=await sql`insert into portal_private.agent_reward_act_requests_v1(
   deal_key,assignment_id,addendum_key,owner_correction_key,correction_version,
   term_key,source_snapshot,requested_by)
   values(${s.deal_key}::uuid,${s.assignment_id}::uuid,${addendum.id}::uuid,
     ${correction.id}::uuid,${correction.correction_version},${term?.id||null}::uuid,
     ${sql.json(snapshot as any)},${actor.userId}::uuid)
   on conflict (deal_key,assignment_id,addendum_key,owner_correction_key)
   do update set requested_at=portal_private.agent_reward_act_requests_v1.requested_at
   returning id,request_status`;
 await sql.begin(async tx=>audit(tx,actor,req,"AGENT_SERVICES_ACT_REVIEW_REQUESTED",s.deal_id,{
   requestId:rows[0].id,correctionVersion:correction.correction_version,
   addendumId:addendum.document_id,financeAndLegalPending:true,noAutomaticPayable:true}));
 return{requestId:rows[0].id,status:rows[0].request_status,source:snapshot}
}
Deno.serve(async req=>{
 try{
   if(!["GET","POST"].includes(req.method))return send(405,{ok:false,code:"METHOD_NOT_ALLOWED"});
   const path=route(req);
   if(path==='/agent/acts'&&req.method==='GET'){
     const agent=await agentContext(req);
     return send(200,{ok:true,data:await agentInbox(sql,agent)})
   }
   const agentFile=path.match(/^\/agent\/acts\/([0-9a-f-]{36})\/documents\/([0-9a-f-]{36})\/download$/i);
   if(agentFile&&req.method==='GET'){
     const agent=await agentContext(req);
     return send(200,{ok:true,data:await agentDownload(req,sql,service,agent,agentFile[1],agentFile[2])})
   }
   const ctx=await context(req);
   if(path==='/admin/assets/canonical-letterhead'&&req.method==='GET'){
     // The image is taken verbatim from Owner-approved RONA-DOC-STANDARD v2 assets.
     // Never redraw the corporate letterhead or substitute another graphic.
     const assets=await sql`select a.content,a.mime_type,a.sha256
       from portal_private.owner_canonical_document_assets a
       join portal_private.owner_canonical_document_standards st
         on st.standard_key='RONA-DOC-STANDARD' and st.version=2 and st.status='ACTIVE'
       where a.asset_key='RONA-CANONICAL-LETTERHEAD' and a.status='ACTIVE'
         and a.owner_approved_at is not null
         and a.sha256=(st.rules->'letterhead'->>'sha256')
       order by a.version desc limit 2`;
     if(assets.length!==1||assets[0].mime_type!=='image/png')
       throw deny('CANONICAL_LETTERHEAD_UNAVAILABLE',409);
     const content=new Uint8Array(assets[0].content);
     const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',content)))
       .map(x=>x.toString(16).padStart(2,'0')).join('');
     if(hash!==assets[0].sha256)throw deny('CANONICAL_LETTERHEAD_HASH_MISMATCH',409);
     return new Response(content,{status:200,headers:{
       'content-type':'image/png','cache-control':'private, no-store',
       'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
   }
   // Canonical signature and seal cannot be fetched for a pending/unapproved act.
   const finalAsset=path.match(/^\/admin\/acts\/([0-9a-f-]{36})\/assets\/(signature|seal)$/i);
   if(finalAsset&&req.method==='GET'){
     const act=await approvedActIssue(sql,ctx,finalAsset[1]);
     const proofs=await sql`select id from portal_private.audit_events
       where actor_user_id=${ctx.userId}::uuid
         and action='AGENT_ACT_CANONICAL_FACSIMILE_RENDER_AUTHORIZED'
         and entity_type='DEAL' and entity_id=${act.dealId}
         and metadata->>'documentNumber'=${act.documentNumber}
       order by created_at desc limit 1`;
     if(proofs.length!==1)throw deny('ACT_OWNER_SIGNING_ATTESTATION_REQUIRED',403);
     const kind=finalAsset[2].toLowerCase();
     const key=kind==='signature'?'RONA-CANONICAL-SIGNATURE':'RONA-CANONICAL-SEAL';
     const expected=kind==='signature'?'image/png':'image/jpeg';
     const assets=await sql`select a.content,a.mime_type,a.sha256
       from portal_private.owner_canonical_document_assets a
       join portal_private.owner_canonical_document_standards st
         on st.standard_key='RONA-DOC-STANDARD' and st.version=2 and st.status='ACTIVE'
       where a.asset_key=${key} and a.status='ACTIVE'
         and a.owner_approved_at is not null and a.mime_type=${expected}
         and a.sha256=(st.rules -> ${kind}::text ->> 'sha256')
       order by a.version desc limit 2`;
     if(assets.length!==1)throw deny('CANONICAL_SIGNING_ASSET_UNAVAILABLE',409);
     const raw=new Uint8Array(assets[0].content);
     const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)))
       .map(x=>x.toString(16).padStart(2,'0')).join('');
     if(sha!==assets[0].sha256)throw deny('CANONICAL_SIGNING_ASSET_HASH_MISMATCH',409);
     return new Response(raw,{status:200,headers:{
       'content-type':expected,'cache-control':'private, no-store',
       'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
   }
   const matched=path.match(/^\/admin\/deals\/(DEAL-20[0-9]{2}-[0-9]{3,})\/assignments\/([0-9a-f-]{36})(?:\/(addendum|acts|acts\/[0-9a-f-]{36}\/(?:upload|dispatch|finalize|documents\/[0-9a-f-]{36}\/download)))?$/i);
   if(!matched)return send(404,{ok:false,code:"ROUTE_NOT_FOUND"});
   const s=await scope(matched[1],matched[2]),action=matched[3]||"";
   if(req.method==="GET"&&!action)return send(200,{ok:true,data:await list(s)});
   if(req.method==="POST"&&action==="addendum")
     return send(200,{ok:true,data:await bind(ctx,req,s,await req.json().catch(()=>({})))});
   if(req.method==="POST"&&action==="acts")
     return send(201,{ok:true,data:await requestAct(ctx,req,s)});
    if(action.startsWith('acts/')){
      const payload=await adminActAction(req,sql,service,ctx,s,action,new URL(req.url).searchParams.get('stage')||'');
      return send(req.method==='POST'?201:200,{ok:true,data:payload})
    }
   return send(404,{ok:false,code:"ROUTE_NOT_FOUND"})
 }catch(error){
   const status=Number((error as any)?.status)||500;
   if(status>=500)console.error("AGENT_REWARD_WORKFLOW_ERROR",(error as any)?.message||"UNKNOWN");
   return send(status,{ok:false,code:status>=500?"AGENT_REWARD_WORKFLOW_FAILED":String((error as any)?.message||"DENIED")})
 }
});
