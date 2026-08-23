import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import { handleTelegramIngest } from "./telegram_ingest.js";

const DB=Deno.env.get('SUPABASE_DB_URL');
const SUPA_URL=Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!DB) throw new Error('SUPABASE_DB_URL missing');
const sql=postgres(DB,{prepare:false,max:2});
const vaultSigning=await sql`select decrypted_secret from vault.decrypted_secrets where name='rona_ai_token_signing_key_v1' limit 1`;
const SIGNING_KEY=Deno.env.get('RONA_AI_TOKEN_SIGNING_KEY')||String(vaultSigning[0]?.decrypted_secret||'');
const encoder=new TextEncoder(),decoder=new TextDecoder();
const AI_ROLES=new Set(['OPERATIONS_DIRECTOR','FINANCE','LEGAL','MARKET_ANALYST','RAIL_LOGISTICS','SYSTEM_ADMIN']);
const FIN_DOC_TYPES=new Set(['ИНВОЙС','КЛИЕНТСКИЙ ПАСПОРТ СДЕЛКИ','КОНТРАКТ','ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ']);
const RAIL_DOC_TYPES=new Set(['ЗАЯВКА НА ПОСТАВКУ','КЛИЕНТСКИЙ ПАСПОРТ СДЕЛКИ']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body,status=200,extra={}){return new Response(JSON.stringify(body,(_k,v)=>typeof v==='bigint'?v.toString():v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate',pragma:'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...extra}})}
function functionPath(req){const p=new URL(req.url).pathname,marker='/rona-ai-read-extras';const i=p.indexOf(marker);return i>=0?(p.slice(i+marker.length)||'/'):p}
function ids(req){const r=req.headers.get('x-request-id')||'',c=req.headers.get('x-correlation-id')||'';return{requestId:UUID.test(r)?r:crypto.randomUUID(),correlationId:UUID.test(c)?c:null}}
function bearer(req){const h=req.headers.get('authorization')||'';return h.startsWith('Bearer ')?h.slice(7).trim():''}
function b64urlDecodeBytes(v){const b=v.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-v.length%4)%4);const raw=atob(b);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
function b64urlDecodeJson(v){return JSON.parse(decoder.decode(b64urlDecodeBytes(v)))}
function safeBytes(a,b){if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array)||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}
async function hmac(keyText,input){const key=await crypto.subtle.importKey('raw',encoder.encode(String(keyText)),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(input)))}
async function verifyToken(token){
  try{
    if(!SIGNING_KEY||String(SIGNING_KEY).length<32)return{ok:false,code:'AI_IDENTITY_RUNTIME_NOT_CONFIGURED',status:503};
    const p=String(token||'').split('.');if(p.length!==3)return{ok:false,code:'AI_TOKEN_INVALID',status:401};
    const expected=await hmac(SIGNING_KEY,`${p[0]}.${p[1]}`),actual=b64urlDecodeBytes(p[2]);if(!safeBytes(expected,actual))return{ok:false,code:'AI_TOKEN_SIGNATURE_INVALID',status:401};
    const header=b64urlDecodeJson(p[0]),x=b64urlDecodeJson(p[1]),now=Math.floor(Date.now()/1000);
    if(header?.alg!=='HS256'||header?.typ!=='JWT')return{ok:false,code:'AI_TOKEN_HEADER_INVALID',status:401};
    if(x?.iss!=='rona-ai-identity-broker'||x?.aud!=='rona-ai-read-only'||x?.actor_type!=='AI'||x?.scope!=='READ_ONLY')return{ok:false,code:'AI_TOKEN_SCOPE_INVALID',status:401};
    if(!AI_ROLES.has(x?.role)||x?.role==='OWNER_ADMIN')return{ok:false,code:'AI_TOKEN_ROLE_INVALID',status:403};
    if(!/^AI-[A-Z0-9_-]{3,80}$/.test(String(x?.sub||''))||!Number.isInteger(x?.ver)||x.ver<1||!UUID.test(String(x?.jti||'')))return{ok:false,code:'AI_TOKEN_CLAIMS_INVALID',status:401};
    if(!Number.isFinite(x?.exp)||!Number.isFinite(x?.nbf)||now>=x.exp)return{ok:false,code:'AI_TOKEN_EXPIRED',status:401};if(now<x.nbf)return{ok:false,code:'AI_TOKEN_NOT_YET_VALID',status:401};
    return{ok:true,payload:x};
  }catch{return{ok:false,code:'AI_TOKEN_INVALID',status:401}}
}
async function identityFor(payload){
  const r=await sql`select id,identity_id,business_role::text,status::text,credential_version,revoked_at from portal_private.ai_service_identities where identity_id=${payload.sub} limit 1`;
  const x=r[0];if(!x||x.status!=='ACTIVE'||x.revoked_at)return null;if(x.business_role!==payload.role||Number(x.credential_version)!==Number(payload.ver))return null;return x;
}
async function audit({identity=null,role=null,req,requestIds,domain,result,httpStatus,jti=null,metadata={}}){try{await sql`insert into portal_private.ai_read_access_events(ai_identity_key,ai_identity_id,functional_role,domain,request_path,request_id,correlation_id,token_jti,result,http_status,metadata) values(${identity?.id??null}::uuid,${identity?.identity_id??'UNKNOWN'},${role??null}::portal_private.ai_business_role_enum,${domain},${new URL(req.url).pathname},${requestIds.requestId}::uuid,${requestIds.correlationId}::uuid,${jti}::uuid,${result},${httpStatus},${sql.json(metadata)}::jsonb)`}catch(e){console.error('ai extras audit write failed',String(e?.message||e))}}
async function authenticate(req){const requestIds=ids(req),v=await verifyToken(bearer(req));if(!v.ok)return{ok:false,...v,requestIds};const identity=await identityFor(v.payload);if(!identity)return{ok:false,status:403,code:'AI_IDENTITY_DISABLED_OR_REVOKED',requestIds,role:v.payload.role,jti:v.payload.jti};return{ok:true,requestIds,identity,role:v.payload.role,jti:v.payload.jti}}

function documentAllowed(role,row){if(role==='OPERATIONS_DIRECTOR'||role==='LEGAL')return true;if(role==='FINANCE')return FIN_DOC_TYPES.has(String(row.document_type||''));if(role==='RAIL_LOGISTICS')return Boolean(row.deal_id)&&RAIL_DOC_TYPES.has(String(row.document_type||''));return false}
async function documentSignedUrl(auth,documentId,req){
  if(!SUPA_URL||!SERVICE_ROLE)throw Object.assign(new Error('AI_DOCUMENT_STORAGE_NOT_CONFIGURED'),{status:503});
  const rows=await sql`select d.document_id,d.document_type,cl.client_id,ct.contract_id,x.deal_id,d.authoritative_filename,d.authority_state::text,d.lifecycle_state::text,dv.sha256,dv.version_number,so.id storage_object_id,so.bucket_id,so.object_name,so.content_type from portal_private.documents d join portal_private.clients cl on cl.id=d.client_key join portal_private.contracts ct on ct.id=d.contract_key left join portal_private.deals x on x.id=d.deal_key join portal_private.document_versions dv on dv.id=d.current_version_id join portal_private.storage_objects so on so.document_version_key=dv.id where d.document_id=${documentId} and d.lifecycle_state='ACTIVE' and d.authority_state not in ('SUPERSEDED','REJECTED') and dv.is_current and dv.lifecycle_state='ACTIVE' and dv.authority_state not in ('SUPERSEDED','REJECTED') and so.storage_state='VERIFIED' limit 2`;
  if(rows.length!==1)throw Object.assign(new Error('AI_DOCUMENT_NOT_FOUND'),{status:404});const row=rows[0];if(!documentAllowed(auth.role,row))throw Object.assign(new Error('AI_DOCUMENT_SCOPE_DENIED'),{status:403});
  const store=createClient(SUPA_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}}),expiresIn=120;const {data,error}=await store.storage.from(String(row.bucket_id)).createSignedUrl(String(row.object_name),expiresIn);if(error||!data?.signedUrl)throw Object.assign(new Error('AI_DOCUMENT_SIGNED_URL_FAILED'),{status:502});
  await audit({identity:auth.identity,role:auth.role,req,requestIds:auth.requestIds,domain:'DOCUMENT_CONTENT',result:'SUCCESS',httpStatus:200,jti:auth.jti,metadata:{document_id:String(row.document_id),document_type:String(row.document_type),client_id:String(row.client_id),contract_id:String(row.contract_id),deal_id:row.deal_id?String(row.deal_id):null,storage_object_id:String(row.storage_object_id),expires_in:expiresIn}});
  return{documentId:String(row.document_id),documentType:String(row.document_type),clientId:String(row.client_id),contractId:String(row.contract_id),dealId:row.deal_id?String(row.deal_id):null,filename:String(row.authoritative_filename),authorityState:String(row.authority_state),lifecycleState:String(row.lifecycle_state),sha256:String(row.sha256),versionNumber:Number(row.version_number),content_type:row.content_type?String(row.content_type):null,signed_url:data.signedUrl,expires_in:expiresIn};
}

async function telegramMarketSources(){
  const rows=await sql`
    select * from (
      select distinct on (d.sha256)
        d.id::text as document_id,d.channel_username,c.channel_role,c.priority as channel_priority,
        d.message_id,d.message_timestamp,d.source_url,d.telegram_caption,d.file_name,d.file_size,d.mime_type,d.sha256,
        d.storage_bucket,d.storage_path,d.extraction_state,left(coalesce(d.extracted_text,''),30000) as extracted_text_preview,
        jsonb_array_length(d.extracted_tables) as table_count,
        jsonb_build_array(d.extracted_tables->0,d.extracted_tables->1,d.extracted_tables->2) as extracted_tables_preview,
        d.extraction_note,d.ingest_source,d.ingested_at,d.last_seen_at
      from portal_private.telegram_market_documents d
      join portal_private.telegram_market_channels c on c.channel_username=d.channel_username
      where c.enabled=true and d.ingest_source='TELEGRAM_MTPROTO'
      order by d.sha256,c.priority asc,d.message_timestamp desc,d.ingested_at desc
    ) q
    order by message_timestamp desc,channel_priority asc
    limit 12`;
  if(!SUPA_URL||!SERVICE_ROLE)return rows.map(r=>({...r,signed_url:null,expires_in:0,storage_access:'BLOCKED'}));
  const store=createClient(SUPA_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}}),expiresIn=120;
  return await Promise.all(rows.map(async r=>{
    const {data,error}=await store.storage.from(String(r.storage_bucket)).createSignedUrl(String(r.storage_path),expiresIn,{download:String(r.file_name)});
    return {...r,signed_url:error||!data?.signedUrl?null:data.signedUrl,expires_in:error?0:expiresIn,storage_access:error?'SIGNED_URL_FAILED':'AUTHORIZED_120S'};
  }));
}

async function marketData(auth,req){
  if(auth.role!=='MARKET_ANALYST')throw Object.assign(new Error('AI_MARKET_SCOPE_DENIED'),{status:403});
  const rows=await sql`select distinct on (source_object_type,source_object_id) source_object_type,source_object_id,source_system,source_version,source_timestamp,checksum_sha256,raw_snapshot,created_at from portal_private.source_objects where source_object_type in ('MARKET_FACT','MARKET_FORECAST','MARKET_CALCULATION') and coalesce(lower(source_system),'') !~ '(^|[_/\\-])(qa|test|debug|temp)($|[_/\\-])' order by source_object_type,source_object_id,source_timestamp desc nulls last,created_at desc`;
  let telegram=[];try{telegram=await telegramMarketSources();}catch(e){console.error('telegram market sources unavailable',String(e?.message||e));}
  await audit({identity:auth.identity,role:auth.role,req,requestIds:auth.requestIds,domain:'MARKET',result:'SUCCESS',httpStatus:200,jti:auth.jti,metadata:{records:rows.length,telegram_records:telegram.length,current_only:true,deduplication:'LATEST_PER_TYPE_AND_SOURCE_OBJECT_ID+TELEGRAM_SHA256_PRIMARY_PRIORITY'}});
  return{
    data_contract:'AI_MARKET_READ_V2',
    current_only:true,
    history_included:false,
    qa_test_debug_temp_excluded:true,
    deduplication:'LATEST_PER_TYPE_AND_SOURCE_OBJECT_ID',
    records:rows,
    telegram:{source_class:'TELEGRAM_MTPROTO',access:'MARKET_ANALYST_READ_ONLY',client_distribution_allowed:false,original_binary:'PRIVATE_SIGNED_URL_120S',extracted_text_preview_chars:30000,extracted_tables_preview_max:3,deduplication:'SHA256_WITH_PRIMARY_CHANNEL_PRIORITY',documents:telegram},
  };
}

Deno.serve(async req=>{
  const path=functionPath(req);
  const telegramResponse=await handleTelegramIngest(req,path);if(telegramResponse)return telegramResponse;
  if(req.method!=='GET')return json({ok:false,code:'AI_READ_ONLY_METHOD_DENIED'},405,{allow:'GET'});
  const auth=await authenticate(req);if(!auth.ok){await audit({req,requestIds:auth.requestIds,domain:'AUTH',result:'DENIED',httpStatus:auth.status,jti:auth.jti??null,role:auth.role??null});return json({ok:false,code:auth.code,request_id:auth.requestIds.requestId},auth.status)}
  try{
    if(path==='/market-data'){const data=await marketData(auth,req);return json({ok:true,ai_identity_id:auth.identity.identity_id,functional_role:auth.role,request_id:auth.requestIds.requestId,correlation_id:auth.requestIds.correlationId,data})}
    const m=path.match(/^\/documents\/([^/]+)\/signed-url$/);if(m){let id;try{id=decodeURIComponent(m[1])}catch{throw Object.assign(new Error('AI_DOCUMENT_NOT_FOUND'),{status:404})}const data=await documentSignedUrl(auth,id,req);return json({ok:true,ai_identity_id:auth.identity.identity_id,functional_role:auth.role,request_id:auth.requestIds.requestId,correlation_id:auth.requestIds.correlationId,data})}
    return json({ok:false,code:'AI_ROUTE_NOT_FOUND'},404);
  }catch(e){const status=Number(e?.status||500),code=String(e?.message||'AI_READ_ERROR');await audit({identity:auth.identity,role:auth.role,req,requestIds:auth.requestIds,domain:path,result:status<500?'DENIED':'ERROR',httpStatus:status,jti:auth.jti});return json({ok:false,code,request_id:auth.requestIds.requestId},status)}
});
