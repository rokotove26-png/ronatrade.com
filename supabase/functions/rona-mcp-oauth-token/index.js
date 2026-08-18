import postgres from "npm:postgres@3.4.7";

const DB=Deno.env.get('SUPABASE_DB_URL');
const SUPA_URL=Deno.env.get('SUPABASE_URL');
if(!DB||!SUPA_URL)throw new Error('MCP_RUNTIME_VARS_MISSING');
const sql=postgres(DB,{prepare:false,max:3});
const PUBLIC_ORIGIN='https://ronaoil.com';
const FUNCTION_SLUG='rona-mcp-oauth-token';
const encoder=new TextEncoder();
const CODE_VERIFIER_RE=/^[A-Za-z0-9\-._~]{43,128}$/;
const SEGMENT_TO_SLUG=Object.freeze({
  operations:'rona-mcp-operations',
  finance:'rona-mcp-finance',
  legal:'rona-mcp-legal',
  'market-analyst':'rona-mcp-market-analyst',
  'rail-logistics':'rona-mcp-rail-logistics',
  'system-admin':'rona-mcp-system-admin',
});
const ORIGIN_ALLOWLIST=new Set([
  'https://chatgpt.com','https://chat.openai.com','https://openai.com','https://platform.openai.com',
  'https://ronaoil.com','https://www.ronaoil.com'
]);
const TOKEN_FIELDS=new Set(['grant_type','client_id','code','redirect_uri','code_verifier','resource','scope','refresh_token']);
const REVOKE_FIELDS=new Set(['token','token_type_hint','client_id']);

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:{
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache',
    'referrer-policy':'no-referrer',
    'x-content-type-options':'nosniff',
    'access-control-allow-origin':'*',
  }});
}
function oauthError(error,description,status=400){return json({error,error_description:description},status);}
function validOrigin(req){const o=req.headers.get('origin');return !o||ORIGIN_ALLOWLIST.has(o);}
function contentTypeIsForm(value){return String(value||'').toLowerCase().split(';',1)[0].trim()==='application/x-www-form-urlencoded';}
async function readTextLimited(req,max){
  const len=req.headers.get('content-length');
  if(len&&Number(len)>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  const text=await req.text();
  if(encoder.encode(text).length>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  return text;
}
function randomToken(bytes=32){const b=crypto.getRandomValues(new Uint8Array(bytes));let s='';for(const x of b)s+=x.toString(16).padStart(2,'0');return s;}
async function sha256Hex(v){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(String(v))));return [...d].map(x=>x.toString(16).padStart(2,'0')).join('');}
function b64url(bytes){let raw='';for(const b of bytes)raw+=String.fromCharCode(b);return btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
async function pkceS256(verifier){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier)));return b64url(d);}
function exactScope(scope){
  const values=new Set(String(scope||'').trim().split(/\s+/).filter(Boolean));
  if(!values.has('mcp:read'))return null;
  for(const s of values)if(!['mcp:read','mcp:coordinate','offline_access'].includes(s))return null;
  return ['mcp:read','mcp:coordinate','offline_access'].filter(s=>values.has(s)).join(' ');
}
function segmentForSlug(slug){for(const [seg,s] of Object.entries(SEGMENT_TO_SLUG))if(s===slug)return seg;return null;}
function publicResource(slug){const segment=segmentForSlug(slug);return segment?`${PUBLIC_ORIGIN}/${segment}/mcp`:null;}
function internalResource(slug){const segment=segmentForSlug(slug);return segment?`${String(SUPA_URL).replace(/\/$/,'')}/functions/v1/rona-mcp-gateway/${segment}/mcp`:null;}
function normalizeResource(slug,value){const v=String(value||'');const p=publicResource(slug),i=internalResource(slug);return v===p||v===i?p:null;}
function routeContext(req){
  const p=new URL(req.url).pathname,marker=`/${FUNCTION_SLUG}/`,i=p.indexOf(marker);
  if(i<0)return null;
  const rest=p.slice(i+marker.length),parts=rest.split('/').filter(Boolean);
  if(parts.length!==2||!SEGMENT_TO_SLUG[parts[0]]||!['token','revoke'].includes(parts[1]))return null;
  return {segment:parts[0],slug:SEGMENT_TO_SLUG[parts[0]],path:`/${parts[1]}`};
}
function safeClientSuffix(id){const s=String(id||'');return s?s.slice(-12):'';}
function audit(event,segment,form,status,result,extra={}){
  console.log(JSON.stringify({
    event,segment,grant_type:String(form?.get('grant_type')||''),client_suffix:safeClientSuffix(form?.get('client_id')),
    resource_present:Boolean(form?.get('resource')),scope_present:Boolean(form?.get('scope')),status,result,...extra,
  }));
}
async function config(slug){
  const rows=await sql`select server_slug,business_role::text,identity_id,enabled from portal_private.mcp_gateway_config where server_slug=${slug} limit 1`;
  if(rows.length!==1||!rows[0].enabled)throw Object.assign(new Error('MCP_CONFIG_DISABLED'),{status:503});
  return rows[0];
}
async function getClient(cfg,clientId){
  const rows=await sql`select client_id,redirect_uris,grant_types,response_types,revoked_at from portal_private.mcp_oauth_clients where server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum and client_id=${clientId} limit 1`;
  return rows.length===1&&!rows[0].revoked_at?rows[0]:null;
}
function clientAllowsRefresh(client){return Array.isArray(client?.grant_types)&&client.grant_types.includes('refresh_token');}
function formFieldsValid(form,allowed){for(const key of form.keys())if(!allowed.has(key))return false;for(const key of allowed)if(form.getAll(key).length>1)return false;return true;}
async function makeTokenMaterial(withRefresh){
  const access=randomToken(32),refresh=withRefresh?randomToken(48):null;
  return {access,refresh,accessHash:await sha256Hex(access),refreshHash:refresh?await sha256Hex(refresh):null};
}

async function authorizationCodeGrant(form,cfg,client,segment){
  const code=form.get('code')||'',redirectUri=form.get('redirect_uri')||'',verifier=form.get('code_verifier')||'';
  if(!code||!redirectUri||!CODE_VERIFIER_RE.test(verifier))return oauthError('invalid_grant','invalid authorization code');
  const codeHash=await sha256Hex(code);
  const rows=await sql`select * from portal_private.mcp_oauth_authorization_codes where code_hash=${codeHash} and server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum and client_id=${client.client_id} and redirect_uri=${redirectUri} and used_at is null and expires_at>now() limit 1`;
  if(rows.length!==1)return oauthError('invalid_grant','authorization code expired or invalid');
  const row=rows[0],boundResource=normalizeResource(cfg.server_slug,row.resource),supplied=form.get('resource'),requestedResource=supplied?normalizeResource(cfg.server_slug,supplied):boundResource;
  if(!boundResource||!requestedResource||requestedResource!==boundResource)return oauthError('invalid_target','resource mismatch');
  const boundScope=exactScope(row.scope);
  if(!boundScope)return oauthError('invalid_scope','authorization scope invalid');
  if(form.get('scope')){const requestedScope=exactScope(form.get('scope'));if(!requestedScope||requestedScope!==boundScope)return oauthError('invalid_scope','scope elevation denied');}
  if(await pkceS256(verifier)!==row.code_challenge)return oauthError('invalid_grant','PKCE verification failed');
  const withRefresh=clientAllowsRefresh(client),material=await makeTokenMaterial(withRefresh),familyId=crypto.randomUUID();
  let tokenId;
  try{
    tokenId=await sql.begin(async tx=>{
      const used=await tx`update portal_private.mcp_oauth_authorization_codes set used_at=now() where code_hash=${codeHash} and server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum and client_id=${client.client_id} and used_at is null returning owner_portal_user_id`;
      if(used.length!==1)throw new Error('CODE_REUSED');
      await tx`update portal_private.ai_service_identities set status='ACTIVE'::portal_private.binding_status_enum,revoked_at=null,revoked_by=null,credential_version=credential_version+1,updated_at=now() where identity_id=${cfg.identity_id} and business_role=${cfg.business_role}::portal_private.ai_business_role_enum`;
      const inserted=await tx`insert into portal_private.mcp_oauth_tokens(server_slug,functional_role,identity_id,client_id,owner_portal_user_id,scope,resource,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,token_family_id) values(${cfg.server_slug},${cfg.business_role}::portal_private.ai_business_role_enum,${cfg.identity_id},${client.client_id},${row.owner_portal_user_id}::uuid,${boundScope},${boundResource},${material.accessHash},${material.refreshHash},now()+interval '15 minutes',case when ${withRefresh} then now()+interval '30 days' else null end,${familyId}::uuid) returning token_id`;
      return inserted[0].token_id;
    });
  }catch(e){if(String(e?.message||e).includes('CODE_REUSED'))return oauthError('invalid_grant','authorization code already used');throw e;}
  audit('RONA_OAUTH_TOKEN_V2_RESULT',segment,form,200,'ISSUED',{refresh_issued:Boolean(material.refresh),token_family_bound:Boolean(tokenId)});
  return json({access_token:material.access,token_type:'Bearer',expires_in:900,scope:boundScope,...(material.refresh?{refresh_token:material.refresh}:{})});
}

async function refreshGrant(form,cfg,client,segment){
  const raw=form.get('refresh_token')||'';
  if(!raw)return oauthError('invalid_grant','refresh token required');
  const hash=await sha256Hex(raw);
  const pre=await sql`select token_id,token_family_id,scope,resource,refresh_expires_at,revoked_at,revoked_reason,refresh_used_at,rotated_to_token_id from portal_private.mcp_oauth_tokens where refresh_token_hash=${hash} and server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum and client_id=${client.client_id} limit 1`;
  if(pre.length!==1)return oauthError('invalid_grant','refresh token expired or invalid');
  const p=pre[0],boundResource=normalizeResource(cfg.server_slug,p.resource),supplied=form.get('resource'),requestedResource=supplied?normalizeResource(cfg.server_slug,supplied):boundResource;
  if(!boundResource||!requestedResource||requestedResource!==boundResource)return oauthError('invalid_target','resource mismatch');
  const boundScope=exactScope(p.scope);
  if(!boundScope)return oauthError('invalid_scope','refresh scope invalid');
  if(form.get('scope')){const requestedScope=exactScope(form.get('scope'));if(!requestedScope||requestedScope!==boundScope)return oauthError('invalid_scope','scope elevation denied');}
  const ident=await sql`select status::text,revoked_at,business_role::text from portal_private.ai_service_identities where identity_id=${cfg.identity_id} limit 1`;
  if(ident.length!==1||ident[0].status!=='ACTIVE'||ident[0].revoked_at||ident[0].business_role!==cfg.business_role)return oauthError('invalid_grant','role identity disabled');
  const material=await makeTokenMaterial(true);
  const result=await sql.begin(async tx=>{
    const locked=await tx`select * from portal_private.mcp_oauth_tokens where refresh_token_hash=${hash} and server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum and client_id=${client.client_id} limit 1 for update`;
    if(locked.length!==1)return {kind:'invalid'};
    const row=locked[0];
    if(row.revoked_at||row.refresh_used_at){
      if(row.revoked_reason==='REFRESH_ROTATED'||row.refresh_used_at||row.rotated_to_token_id){
        await tx`update portal_private.mcp_oauth_tokens set revoked_at=coalesce(revoked_at,now()),revoked_reason='REFRESH_REUSE_DETECTED' where token_family_id=${row.token_family_id}::uuid and server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum`;
        return {kind:'replay'};
      }
      return {kind:'invalid'};
    }
    if(!row.refresh_expires_at||new Date(row.refresh_expires_at).getTime()<=Date.now()){
      await tx`update portal_private.mcp_oauth_tokens set revoked_at=coalesce(revoked_at,now()),revoked_reason=coalesce(revoked_reason,'REFRESH_EXPIRED') where token_id=${row.token_id}::uuid`;
      return {kind:'expired'};
    }
    const inserted=await tx`insert into portal_private.mcp_oauth_tokens(server_slug,functional_role,identity_id,client_id,owner_portal_user_id,scope,resource,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,token_family_id,parent_token_id) values(${cfg.server_slug},${cfg.business_role}::portal_private.ai_business_role_enum,${cfg.identity_id},${client.client_id},${row.owner_portal_user_id}::uuid,${row.scope},${boundResource},${material.accessHash},${material.refreshHash},now()+interval '15 minutes',${row.refresh_expires_at},${row.token_family_id}::uuid,${row.token_id}::uuid) returning token_id`;
    const nextId=inserted[0].token_id;
    await tx`update portal_private.mcp_oauth_tokens set refresh_used_at=now(),revoked_at=now(),revoked_reason='REFRESH_ROTATED',rotated_to_token_id=${nextId}::uuid where token_id=${row.token_id}::uuid and revoked_at is null`;
    return {kind:'ok',tokenId:nextId};
  });
  if(result.kind==='replay'){
    audit('RONA_OAUTH_REFRESH_REUSE_DETECTED',segment,form,400,'REPLAY_FAMILY_REVOKED');
    return oauthError('invalid_grant','refresh token reuse detected');
  }
  if(result.kind!=='ok')return oauthError('invalid_grant','refresh token expired or invalid');
  audit('RONA_OAUTH_TOKEN_V2_RESULT',segment,form,200,'REFRESHED',{refresh_issued:true,rotation:true});
  return json({access_token:material.access,token_type:'Bearer',expires_in:900,scope:boundScope,refresh_token:material.refresh});
}

async function tokenEndpoint(req,cfg,segment){
  if(!contentTypeIsForm(req.headers.get('content-type')))return oauthError('invalid_request','form content type required',415);
  let form;try{form=new URLSearchParams(await readTextLimited(req,32768));}catch(e){return oauthError('invalid_request','invalid token request',e?.status||400);}
  if(!formFieldsValid(form,TOKEN_FIELDS))return oauthError('invalid_request','invalid token fields');
  const grant=form.get('grant_type')||'',clientId=form.get('client_id')||'';
  audit('RONA_OAUTH_TOKEN_V2_RECEIVED',segment,form,null,'RECEIVED');
  const client=await getClient(cfg,clientId);
  if(!client){audit('RONA_OAUTH_TOKEN_V2_RESULT',segment,form,401,'INVALID_CLIENT');return oauthError('invalid_client','unknown client',401);}
  try{
    if(grant==='authorization_code')return await authorizationCodeGrant(form,cfg,client,segment);
    if(grant==='refresh_token')return await refreshGrant(form,cfg,client,segment);
    return oauthError('unsupported_grant_type','unsupported grant type');
  }catch(e){console.error(JSON.stringify({event:'RONA_OAUTH_TOKEN_V2_ERROR',segment,error:String(e?.message||e).slice(0,160)}));return oauthError('server_error','token service failure',500);}
}

async function revokeEndpoint(req,cfg,segment){
  if(!contentTypeIsForm(req.headers.get('content-type')))return json({});
  let form;try{form=new URLSearchParams(await readTextLimited(req,16384));}catch{return json({});}
  if(!formFieldsValid(form,REVOKE_FIELDS))return json({});
  const raw=form.get('token')||'';
  if(!raw)return json({});
  const hash=await sha256Hex(raw);
  const rows=await sql`select token_id,token_family_id from portal_private.mcp_oauth_tokens where server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum and (access_token_hash=${hash} or refresh_token_hash=${hash}) order by created_at desc limit 1`;
  if(rows.length){
    await sql`update portal_private.mcp_oauth_tokens set revoked_at=coalesce(revoked_at,now()),revoked_reason='OAUTH_REVOKE_FAMILY' where token_family_id=${rows[0].token_family_id}::uuid and server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum`;
    const active=await sql`select count(*)::int n from portal_private.mcp_oauth_tokens where server_slug=${cfg.server_slug} and functional_role=${cfg.business_role}::portal_private.ai_business_role_enum and revoked_at is null and access_expires_at>now()`;
    if(Number(active[0]?.n||0)===0)await sql`update portal_private.ai_service_identities set status='SUSPENDED'::portal_private.binding_status_enum,credential_version=credential_version+1,updated_at=now() where identity_id=${cfg.identity_id} and business_role=${cfg.business_role}::portal_private.ai_business_role_enum`;
  }
  audit('RONA_OAUTH_REVOKE_V2_RESULT',segment,form,200,rows.length?'FAMILY_REVOKED':'TOKEN_UNKNOWN');
  return json({});
}

Deno.serve(async req=>{
  const route=routeContext(req);
  if(!route)return json({error:'NOT_FOUND'},404);
  if(!validOrigin(req))return json({error:'ORIGIN_DENIED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, origin','cache-control':'no-store'}});
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  const cfg=await config(route.slug);
  if(route.path==='/token')return tokenEndpoint(req,cfg,route.segment);
  if(route.path==='/revoke')return revokeEndpoint(req,cfg,route.segment);
  return json({error:'NOT_FOUND'},404);
});
