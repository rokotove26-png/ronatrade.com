import postgres from "npm:postgres@3.4.7";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

const DB=Deno.env.get('SUPABASE_DB_URL');
const SUPA_URL=Deno.env.get('SUPABASE_URL');
if(!DB||!SUPA_URL)throw new Error('MCP_CONSENT_RUNTIME_VARS_MISSING');
const sql=postgres(DB,{prepare:false,max:2});
const PUBLIC_ORIGIN='https://ronaoil.com';
const encoder=new TextEncoder();
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NONCE_RE=/^[A-Za-z0-9_-]{43,128}$/;
const HASH_RE=/^[0-9a-f]{64}$/;
const FORM_FIELDS=new Set(['request_id','email','password','confirm','continuation_nonce']);
const SEGMENT_ROLE=Object.freeze({
  'operations':'OPERATIONS_DIRECTOR',
  'operations-pilot':'OPERATIONS_DIRECTOR',
  'finance':'FINANCE',
  'finance-pilot':'FINANCE',
  'legal':'LEGAL',
  'legal-pilot':'LEGAL',
  'market-analyst':'COMMERCIAL_DIRECTOR',
  'market-analyst-pilot':'COMMERCIAL_DIRECTOR',
  'rail-logistics':'RAIL_LOGISTICS',
  'rail-logistics-pilot':'RAIL_LOGISTICS',
  'system-admin':'SYSTEM_ADMIN',
});

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});}
function publicSupabaseKey(){const legacy=Deno.env.get('SUPABASE_ANON_KEY');if(legacy)return legacy;const raw=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');if(raw){try{const p=JSON.parse(raw);if(p?.default)return p.default;}catch{}}throw new Error('SUPABASE_PUBLIC_KEY_MISSING');}
function route(req){const u=new URL(req.url),marker='/rona-mcp-consent-bridge/',i=u.pathname.indexOf(marker);if(i<0)return null;const rest=u.pathname.slice(i+marker.length).split('/').filter(Boolean);if(rest.length!==2||!SEGMENT_ROLE[rest[0]]||!['prepare','complete'].includes(rest[1]))return null;return{segment:rest[0],role:SEGMENT_ROLE[rest[0]],phase:rest[1],url:u};}
function publicResource(segment){return `${PUBLIC_ORIGIN}/${segment}/mcp`;}
function contentTypeIsForm(value){return String(value||'').toLowerCase().split(';',1)[0].trim()==='application/x-www-form-urlencoded';}
async function readTextLimited(req,max){const len=req.headers.get('content-length');if(len&&Number(len)>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});const text=await req.text();if(encoder.encode(text).length>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});return text;}
async function sha256Hex(value){const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(String(value))));return[...digest].map(x=>x.toString(16).padStart(2,'0')).join('');}
function safeHeader(req,name,max=180){const v=String(req.headers.get(name)||'').slice(0,max);return v||null;}
function traceMeta(req){return{
  origin:safeHeader(req,'x-rona-oauth-original-origin',80),
  secFetchSite:safeHeader(req,'x-rona-oauth-sec-fetch-site',40),
  secFetchMode:safeHeader(req,'x-rona-oauth-sec-fetch-mode',40),
  secFetchDest:safeHeader(req,'x-rona-oauth-sec-fetch-dest',40),
  refererHost:safeHeader(req,'x-rona-oauth-referer-host',120),
  refererPath:safeHeader(req,'x-rona-oauth-referer-path',240),
  userAgentFamily:safeHeader(req,'x-rona-oauth-user-agent-family',80),
};}
async function writeTrace(ctx,{phase,requestId=null,correlationHash=null,upstreamStatus=null,publicStatus=null,callbackHost=null,callbackPath=null,hasLocation=null,hasCode=null,stateMatch=null,result,metadata={}}){const m=traceMeta(ctx.req);try{await sql`insert into portal_private.mcp_oauth_authorize_trace(server_slug,functional_role,phase,request_id,correlation_hash,request_method,origin,sec_fetch_site,sec_fetch_mode,sec_fetch_dest,referer_host,referer_path,user_agent_family,upstream_status,returned_public_status,callback_host,callback_path,has_location,has_code,state_match,result,metadata) values(${`rona-mcp-${ctx.segment}`},${ctx.role}::portal_private.ai_business_role_enum,${phase},${requestId}::uuid,${correlationHash},${ctx.req.method},${m.origin},${m.secFetchSite},${m.secFetchMode},${m.secFetchDest},${m.refererHost},${m.refererPath},${m.userAgentFamily},${upstreamStatus},${publicStatus},${callbackHost},${callbackPath},${hasLocation},${hasCode},${stateMatch},${result},${sql.json(metadata)}::jsonb)`;}catch(e){console.error('mcp consent trace write failed',String(e?.message||e));}}
async function gatewayConfig(ctx){const rows=await sql`select server_slug,business_role::text from portal_private.mcp_gateway_config where server_slug=${`rona-mcp-${ctx.segment}`} and business_role=${ctx.role}::portal_private.ai_business_role_enum and enabled=true limit 1`;return rows.length===1?rows[0]:null;}
async function ownerPortalUser(authUserId){const rows=await sql`select a.portal_user_id from portal_private.mcp_gateway_owner_allowlist a join portal_private.portal_users u on u.id=a.portal_user_id where a.auth_user_id=${authUserId}::uuid and u.status='ACTIVE'::portal_private.portal_user_status_enum and u.authority_state='CONFIRMED'::portal_private.authority_state_enum and u.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and exists(select 1 from portal_private.portal_user_roles r where r.user_id=u.id and r.role='ADMIN'::portal_private.portal_role_enum and r.status='ACTIVE'::portal_private.binding_status_enum and r.revoked_at is null) limit 1`;return rows[0]?.portal_user_id||null;}

async function prepare(ctx){
  if(ctx.req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  if(!contentTypeIsForm(ctx.req.headers.get('content-type')))return json({error:'INVALID_CONTENT_TYPE'},415);
  let raw;try{raw=await readTextLimited(ctx.req,16384);}catch(e){return json({error:String(e?.message||'REQUEST_TOO_LARGE')},Number(e?.status||413));}
  const form=new URLSearchParams(raw);for(const key of form.keys())if(!FORM_FIELDS.has(key))return json({error:'INVALID_AUTHORIZE_FORM'},400);for(const key of FORM_FIELDS)if(form.getAll(key).length>1)return json({error:'INVALID_AUTHORIZE_FORM'},400);
  const requestId=form.get('request_id')||'',email=form.get('email')||'',password=form.get('password')||'',confirm=form.get('confirm')||'',nonce=form.get('continuation_nonce')||'';
  const correlationHash=NONCE_RE.test(nonce)?await sha256Hex(nonce):null;
  if(!UUID_RE.test(requestId)||!email||!password||confirm!=='yes'||!correlationHash){await writeTrace(ctx,{phase:'PREPARE_REJECTED_FORM',requestId:UUID_RE.test(requestId)?requestId:null,correlationHash,result:'REJECTED',publicStatus:400});return json({error:'INVALID_AUTHORIZE_FORM'},400);}
  const cfg=await gatewayConfig(ctx);if(!cfg){await writeTrace(ctx,{phase:'PREPARE_CONFIG_DENIED',requestId,correlationHash,result:'REJECTED',publicStatus:503});return json({error:'MCP_CONFIG_UNAVAILABLE'},503);}
  const rows=await sql`select request_id,client_id,redirect_uri,state,code_challenge,scope,resource,expires_at,used_at from portal_private.mcp_oauth_authorization_requests where request_id=${requestId}::uuid and server_slug=${cfg.server_slug} and functional_role=${ctx.role}::portal_private.ai_business_role_enum and used_at is null and expires_at>now() limit 1`;
  if(rows.length!==1){await writeTrace(ctx,{phase:'PREPARE_REQUEST_REJECTED',requestId,correlationHash,result:'REJECTED',publicStatus:400,metadata:{reason:'USED_OR_EXPIRED'}});return json({error:'invalid_request',error_description:'authorization request expired'},400);}
  if(String(rows[0].resource)!==publicResource(ctx.segment)){await writeTrace(ctx,{phase:'PREPARE_RESOURCE_REJECTED',requestId,correlationHash,result:'REJECTED',publicStatus:400});return json({error:'invalid_target'},400);}
  let authUser;try{const client=createClient(SUPA_URL,publicSupabaseKey(),{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data?.user)throw error||new Error('AUTH_FAILED');authUser=data.user;}catch{await writeTrace(ctx,{phase:'PREPARE_OWNER_AUTH_REJECTED',requestId,correlationHash,result:'REJECTED',publicStatus:403});return json({error:'access_denied'},403);}
  const ownerId=await ownerPortalUser(authUser.id);if(!ownerId){await writeTrace(ctx,{phase:'PREPARE_OWNER_ALLOWLIST_REJECTED',requestId,correlationHash,result:'REJECTED',publicStatus:403});return json({error:'access_denied'},403);}
  try{await sql.begin(async tx=>{const updated=await tx`update portal_private.mcp_oauth_authorization_requests set used_at=now(),owner_portal_user_id=${ownerId}::uuid,completion_nonce_hash=${correlationHash},completion_expires_at=now()+interval '2 minutes',completion_used_at=null,completion_code_hash=null where request_id=${requestId}::uuid and server_slug=${cfg.server_slug} and functional_role=${ctx.role}::portal_private.ai_business_role_enum and used_at is null and expires_at>now() returning request_id`;if(updated.length!==1)throw new Error('AUTH_REQUEST_REUSED');});}catch{await writeTrace(ctx,{phase:'PREPARE_RACE_REJECTED',requestId,correlationHash,result:'REJECTED',publicStatus:400,metadata:{reason:'ONE_TIME_REQUEST_REUSED'}});return json({error:'invalid_request',error_description:'authorization request expired'},400);}
  await writeTrace(ctx,{phase:'PREPARE_ACCEPTED',requestId,correlationHash,result:'SUCCESS',upstreamStatus:204,publicStatus:204,metadata:{request_used:true,code_issued:false}});
  return new Response(null,{status:204,headers:{'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
}

async function complete(ctx){
  if(ctx.req.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
  const nonce=ctx.url.searchParams.get('nonce')||'';if(!NONCE_RE.test(nonce))return json({error:'invalid_request'},400);
  const correlationHash=await sha256Hex(nonce),cfg=await gatewayConfig(ctx);if(!cfg)return json({error:'MCP_CONFIG_UNAVAILABLE'},503);
  const rows=await sql`select request_id,client_id,redirect_uri,state,code_challenge,scope,resource,owner_portal_user_id,completion_used_at,completion_code_hash from portal_private.mcp_oauth_authorization_requests where server_slug=${cfg.server_slug} and functional_role=${ctx.role}::portal_private.ai_business_role_enum and completion_nonce_hash=${correlationHash} and used_at is not null and completion_expires_at>now() and owner_portal_user_id is not null and (completion_used_at is null or completion_code_hash is not null) limit 1`;
  if(rows.length!==1){await writeTrace(ctx,{phase:'COMPLETE_REJECTED',correlationHash,result:'REJECTED',publicStatus:400,metadata:{reason:'INVALID_OR_EXPIRED_CONTINUATION'}});return json({error:'invalid_request',error_description:'authorization completion invalid'},400);}
  const row=rows[0];if(String(row.resource)!==publicResource(ctx.segment)){await writeTrace(ctx,{phase:'COMPLETE_RESOURCE_REJECTED',requestId:row.request_id,correlationHash,result:'REJECTED',publicStatus:400});return json({error:'invalid_target'},400);}
  const code=await sha256Hex(['RONA_MCP_AUTH_CODE_V2',nonce,row.request_id,cfg.server_slug,row.client_id].join('|'));
  const codeHash=await sha256Hex(code);
  if(row.completion_used_at&&(!HASH_RE.test(String(row.completion_code_hash||''))||String(row.completion_code_hash)!==codeHash)){await writeTrace(ctx,{phase:'COMPLETE_REJECTED',requestId:row.request_id,correlationHash,result:'REJECTED',publicStatus:400,metadata:{reason:'LEGACY_OR_MISMATCHED_COMPLETION'}});return json({error:'invalid_request',error_description:'authorization completion invalid'},400);}
  let replay=false;
  try{await sql.begin(async tx=>{
    const locked=await tx`select request_id,completion_used_at,completion_code_hash,completion_expires_at from portal_private.mcp_oauth_authorization_requests where request_id=${row.request_id}::uuid and server_slug=${cfg.server_slug} and functional_role=${ctx.role}::portal_private.ai_business_role_enum and completion_nonce_hash=${correlationHash} and used_at is not null and completion_expires_at>now() and owner_portal_user_id is not null for update`;
    if(locked.length!==1)throw new Error('COMPLETION_INVALID');
    const current=locked[0];
    if(current.completion_used_at){
      if(String(current.completion_code_hash||'')!==codeHash)throw new Error('COMPLETION_REUSED_LEGACY');
      replay=true;
    }else{
      const used=await tx`update portal_private.mcp_oauth_authorization_requests set completion_used_at=now(),completion_code_hash=${codeHash} where request_id=${row.request_id}::uuid and completion_nonce_hash=${correlationHash} and completion_used_at is null and completion_expires_at>now() returning request_id`;
      if(used.length!==1)throw new Error('COMPLETION_RACE');
      await tx`insert into portal_private.mcp_oauth_authorization_codes(code_hash,server_slug,functional_role,client_id,redirect_uri,code_challenge,scope,resource,owner_portal_user_id,expires_at) values(${codeHash},${cfg.server_slug},${ctx.role}::portal_private.ai_business_role_enum,${row.client_id},${row.redirect_uri},${row.code_challenge},${row.scope},${row.resource},${row.owner_portal_user_id}::uuid,now()+interval '5 minutes') on conflict(code_hash) do nothing`;
    }
    const issued=await tx`select code_hash,server_slug,functional_role::text,client_id,redirect_uri,code_challenge,scope,resource,owner_portal_user_id,expires_at from portal_private.mcp_oauth_authorization_codes where code_hash=${codeHash} limit 1`;
    if(issued.length!==1)throw new Error('AUTH_CODE_NOT_FOUND');
    const i=issued[0];
    if(String(i.server_slug)!==String(cfg.server_slug)||String(i.functional_role)!==String(ctx.role)||String(i.client_id)!==String(row.client_id)||String(i.redirect_uri)!==String(row.redirect_uri)||String(i.code_challenge)!==String(row.code_challenge)||String(i.scope)!==String(row.scope)||String(i.resource)!==String(row.resource)||String(i.owner_portal_user_id)!==String(row.owner_portal_user_id))throw new Error('AUTH_CODE_SCOPE_MISMATCH');
  });}catch(e){await writeTrace(ctx,{phase:'COMPLETE_RACE_REJECTED',requestId:row.request_id,correlationHash,result:'REJECTED',publicStatus:400,metadata:{reason:String(e?.message||'COMPLETION_FAILED').slice(0,120)}});return json({error:'invalid_request',error_description:'authorization completion invalid'},400);}
  const redir=new URL(String(row.redirect_uri));redir.searchParams.set('code',code);redir.searchParams.set('state',String(row.state));const host=redir.hostname,path=redir.pathname,stateMatch=redir.searchParams.get('state')===String(row.state);
  await writeTrace(ctx,{phase:replay?'COMPLETE_CALLBACK_REPLAYED':'COMPLETE_CALLBACK_ISSUED',requestId:row.request_id,correlationHash,result:'SUCCESS',upstreamStatus:302,publicStatus:303,callbackHost:host,callbackPath:path,hasLocation:true,hasCode:true,stateMatch,metadata:{request_used:true,completion_used:true,code_issued:!replay,idempotent_replay:replay}});
  return Response.redirect(redir.toString(),302);
}

Deno.serve(async req=>{const r=route(req);if(!r)return json({error:'NOT_FOUND'},404);const ctx={...r,req};try{return r.phase==='prepare'?await prepare(ctx):await complete(ctx);}catch(e){console.error('mcp consent bridge error',String(e?.message||e));return json({error:'MCP_CONSENT_BRIDGE_ERROR'},500);}});