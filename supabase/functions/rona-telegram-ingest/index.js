import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const DB=Deno.env.get('SUPABASE_DB_URL');
const SUPA_URL=Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!DB||!SUPA_URL||!SERVICE_ROLE) throw new Error('TELEGRAM_INGEST_RUNTIME_VARS_MISSING');

const sql=postgres(DB,{prepare:false,max:2});
const storage=createClient(SUPA_URL,SERVICE_ROLE,{auth:{persistSession:false,autoRefreshToken:false}});
const BUCKET='market-source-private';
const VERSION='1.0.0';
const GH_ISSUER='https://token.actions.githubusercontent.com';
const GH_AUDIENCE='rona-telegram-ingest';
const GH_REPOSITORY='rokotove26-png/ronatrade.com';
const GH_WORKFLOW_REF=`${GH_REPOSITORY}/.github/workflows/telegram-market-ingest.yml@refs/heads/main`;
const GH_JWKS=createRemoteJWKSet(new URL(`${GH_ISSUER}/.well-known/jwks`));
const SHA_RE=/^[0-9a-f]{64}$/;
const CHANNEL_RE=/^[A-Za-z0-9_]{5,64}$/;
const MIME_ALLOW=new Set(['application/pdf','image/jpeg','image/png','image/webp']);
const MAX_FILE_BYTES=64*1024*1024;
const MAX_TEXT_CHARS=1_000_000;
const MAX_TABLE_JSON_CHARS=350_000;
const encoder=new TextEncoder();

function json(body,status=200,extra={}){
  return new Response(JSON.stringify(body,(_k,v)=>typeof v==='bigint'?v.toString():v),{
    status,
    headers:{
      'content-type':'application/json; charset=utf-8',
      'cache-control':'no-store, no-cache, must-revalidate',
      pragma:'no-cache',
      'referrer-policy':'no-referrer',
      'x-content-type-options':'nosniff',
      ...extra,
    },
  });
}
function functionPath(req){
  const p=new URL(req.url).pathname,marker='/rona-telegram-ingest',i=p.indexOf(marker);
  return i>=0?(p.slice(i+marker.length)||'/'):p;
}
function bearer(req){const h=req.headers.get('authorization')||'';return h.startsWith('Bearer ')?h.slice(7).trim():'';}
async function readJson(req,max=1_500_000){
  const cl=req.headers.get('content-length');if(cl&&Number(cl)>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  const text=await req.text();if(encoder.encode(text).length>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});
  try{return JSON.parse(text||'{}');}catch{throw Object.assign(new Error('INVALID_JSON'),{status:400});}
}
async function githubOidc(req){
  const token=bearer(req);if(!token)throw Object.assign(new Error('GITHUB_OIDC_REQUIRED'),{status:401});
  try{
    const {payload}=await jwtVerify(token,GH_JWKS,{issuer:GH_ISSUER,audience:GH_AUDIENCE,clockTolerance:5});
    if(payload.repository!==GH_REPOSITORY)throw new Error('repository');
    if(payload.ref!=='refs/heads/main')throw new Error('ref');
    if(payload.workflow_ref!==GH_WORKFLOW_REF)throw new Error('workflow_ref');
    if(!['schedule','workflow_dispatch'].includes(String(payload.event_name||'')))throw new Error('event_name');
    return {actor:String(payload.actor||''),runId:String(payload.run_id||''),runNumber:String(payload.run_number||''),eventName:String(payload.event_name||'')};
  }catch(e){
    console.error('telegram ingest oidc denied',String(e?.message||e));
    throw Object.assign(new Error('GITHUB_OIDC_DENIED'),{status:403});
  }
}
function cleanChannel(v){const x=String(v||'').trim().replace(/^@/,'');if(!CHANNEL_RE.test(x))throw Object.assign(new Error('CHANNEL_INVALID'),{status:400});return x;}
function cleanText(v,max){if(v===null||v===undefined)return null;const x=String(v).trim();if(!x)return null;if(x.length>max)throw Object.assign(new Error('TEXT_TOO_LARGE'),{status:413});return x;}
function fileExt(fileName,mime){
  const m=String(fileName||'').toLowerCase().match(/\.(pdf|jpg|jpeg|png|webp)$/);if(m)return m[1]==='jpeg'?'jpg':m[1];
  return mime==='application/pdf'?'pdf':mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
}
function metadataFrom(body){
  const channel=cleanChannel(body.channel);
  const messageId=Number(body.message_id);if(!Number.isSafeInteger(messageId)||messageId<=0)throw Object.assign(new Error('MESSAGE_ID_INVALID'),{status:400});
  const ts=new Date(body.message_timestamp);if(!Number.isFinite(ts.getTime()))throw Object.assign(new Error('MESSAGE_TIMESTAMP_INVALID'),{status:400});
  const sourceUrl=String(body.source_url||'').trim();
  let u;try{u=new URL(sourceUrl);}catch{throw Object.assign(new Error('SOURCE_URL_INVALID'),{status:400});}
  if(u.protocol!=='https:'||!['t.me','telegram.me'].includes(u.hostname.toLowerCase()))throw Object.assign(new Error('SOURCE_URL_INVALID'),{status:400});
  const fileName=String(body.file_name||'').trim();if(!fileName||fileName.length>300)throw Object.assign(new Error('FILE_NAME_INVALID'),{status:400});
  const fileSize=Number(body.file_size);if(!Number.isSafeInteger(fileSize)||fileSize<=0||fileSize>MAX_FILE_BYTES)throw Object.assign(new Error('FILE_SIZE_INVALID'),{status:400});
  const mime=String(body.mime_type||'').toLowerCase().trim();if(!MIME_ALLOW.has(mime))throw Object.assign(new Error('MIME_NOT_ALLOWED'),{status:415});
  const sha=String(body.sha256||'').toLowerCase().trim();if(!SHA_RE.test(sha))throw Object.assign(new Error('SHA256_INVALID'),{status:400});
  const caption=cleanText(body.telegram_caption,20_000);
  return {channel,messageId,messageTimestamp:ts.toISOString(),sourceUrl,fileName,fileSize,mime,sha,caption};
}
async function channelConfig(channel){
  const r=await sql`select channel_username,channel_role,priority,enabled,allow_pdf,allow_images from portal_private.telegram_market_channels where lower(channel_username)=lower(${channel}) limit 1`;
  if(r.length!==1||!r[0].enabled)throw Object.assign(new Error('CHANNEL_NOT_ALLOWED'),{status:403});
  if(channel!==r[0].channel_username)channel=r[0].channel_username;
  return {...r[0],channel_username:channel};
}
async function sha256Blob(blob){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));return[...d].map(x=>x.toString(16).padStart(2,'0')).join('');}
function storagePath(meta){
  const d=new Date(meta.messageTimestamp),yyyy=String(d.getUTCFullYear()),mm=String(d.getUTCMonth()+1).padStart(2,'0'),ext=fileExt(meta.fileName,meta.mime);
  return `${meta.channel}/${yyyy}/${mm}/${meta.messageId}-${meta.sha}.${ext}`;
}
async function health(){
  try{
    const r=await sql`select to_regclass('portal_private.telegram_market_documents')::text as docs,to_regclass('portal_private.telegram_market_channels')::text as channels,(select count(*)::int from storage.buckets where id=${BUCKET} and public=false) as private_bucket`;
    const ok=Boolean(r[0]?.docs&&r[0]?.channels&&Number(r[0]?.private_bucket||0)===1);
    return json({ok,service:'rona-telegram-ingest',version:VERSION,mode:ok?'FOUNDATION_READY':'FOUNDATION_INCOMPLETE'},ok?200:503);
  }catch{return json({ok:false,service:'rona-telegram-ingest',version:VERSION,mode:'FOUNDATION_INCOMPLETE'},503);}
}
async function prepare(body,auth){
  const meta0=metadataFrom(body),cfg=await channelConfig(meta0.channel),meta={...meta0,channel:cfg.channel_username};
  if(meta.mime==='application/pdf'&&!cfg.allow_pdf)throw Object.assign(new Error('PDF_NOT_ALLOWED'),{status:403});
  if(meta.mime!=='application/pdf'&&!cfg.allow_images)throw Object.assign(new Error('IMAGE_NOT_ALLOWED'),{status:403});
  const existing=await sql`select id,storage_bucket,storage_path from portal_private.telegram_market_documents where sha256=${meta.sha} order by channel_priority asc,ingested_at desc limit 1`;
  if(existing.length){
    return {ok:true,upload_required:false,reuse:true,storage_bucket:String(existing[0].storage_bucket),storage_path:String(existing[0].storage_path),sha256:meta.sha,expires_in:0};
  }
  const path=storagePath(meta);
  const {data,error}=await storage.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
  if(error||!data?.signedUrl||!data?.token)throw Object.assign(new Error('SIGNED_UPLOAD_URL_FAILED'),{status:502});
  console.log(JSON.stringify({event:'TELEGRAM_INGEST_PREPARE',channel:meta.channel,message_id:meta.messageId,sha256:meta.sha,run_id:auth.runId}));
  return {ok:true,upload_required:true,reuse:false,storage_bucket:BUCKET,storage_path:path,signed_upload_url:data.signedUrl,upload_token:data.token,sha256:meta.sha,expires_in:7200};
}
async function finalize(body,auth){
  const meta0=metadataFrom(body),cfg=await channelConfig(meta0.channel),meta={...meta0,channel:cfg.channel_username};
  const path=String(body.storage_path||'').trim();if(!path||path.length>900)throw Object.assign(new Error('STORAGE_PATH_INVALID'),{status:400});
  const known=await sql`select storage_path from portal_private.telegram_market_documents where sha256=${meta.sha} and storage_path=${path} limit 1`;
  if(path!==storagePath(meta)&&known.length!==1)throw Object.assign(new Error('STORAGE_PATH_MISMATCH'),{status:400});
  const {data:blob,error}=await storage.storage.from(BUCKET).download(path);
  if(error||!blob)throw Object.assign(new Error('STORAGE_OBJECT_NOT_FOUND'),{status:409});
  if(blob.size!==meta.fileSize)throw Object.assign(new Error('STORAGE_SIZE_MISMATCH'),{status:409});
  const actual=await sha256Blob(blob);if(actual!==meta.sha)throw Object.assign(new Error('STORAGE_SHA256_MISMATCH'),{status:409});
  const extractedText=cleanText(body.extracted_text,MAX_TEXT_CHARS);
  let tables=body.extracted_tables??[];if(!Array.isArray(tables))throw Object.assign(new Error('EXTRACTED_TABLES_INVALID'),{status:400});
  const tableJson=JSON.stringify(tables);if(tableJson.length>MAX_TABLE_JSON_CHARS)throw Object.assign(new Error('EXTRACTED_TABLES_TOO_LARGE'),{status:413});
  const extractionState=String(body.extraction_state||'').trim();
  if(!['TEXT_EXTRACTED','TEXT_AND_TABLES_EXTRACTED','BINARY_ONLY','FAILED'].includes(extractionState))throw Object.assign(new Error('EXTRACTION_STATE_INVALID'),{status:400});
  const extractionNote=cleanText(body.extraction_note,4000);
  const rows=await sql`
    insert into portal_private.telegram_market_documents(
      channel_username,channel_priority,message_id,message_timestamp,source_url,telegram_caption,file_name,file_size,mime_type,sha256,
      storage_bucket,storage_path,extraction_state,extracted_text,extracted_tables,extraction_note,ingest_source,ingested_at,last_seen_at,updated_at
    ) values(
      ${meta.channel},${Number(cfg.priority)},${meta.messageId},${meta.messageTimestamp}::timestamptz,${meta.sourceUrl},${meta.caption},${meta.fileName},${meta.fileSize},${meta.mime},${meta.sha},
      ${BUCKET},${path},${extractionState},${extractedText},${sql.json(tables)}::jsonb,${extractionNote},'TELEGRAM_MTPROTO',now(),now(),now()
    )
    on conflict(channel_username,message_id,sha256) do update set
      source_url=excluded.source_url,
      telegram_caption=excluded.telegram_caption,
      file_name=excluded.file_name,
      file_size=excluded.file_size,
      mime_type=excluded.mime_type,
      storage_bucket=excluded.storage_bucket,
      storage_path=excluded.storage_path,
      extraction_state=excluded.extraction_state,
      extracted_text=excluded.extracted_text,
      extracted_tables=excluded.extracted_tables,
      extraction_note=excluded.extraction_note,
      last_seen_at=now(),updated_at=now()
    returning id,ingested_at`;
  await sql`update portal_private.telegram_market_channels set last_message_id=greatest(coalesce(last_message_id,0),${meta.messageId}),last_successful_ingest_at=now(),last_attempt_at=now(),last_error_code=null,updated_at=now() where channel_username=${meta.channel}`;
  console.log(JSON.stringify({event:'TELEGRAM_INGEST_FINALIZE',channel:meta.channel,message_id:meta.messageId,sha256:meta.sha,document_id:String(rows[0].id),run_id:auth.runId}));
  return {ok:true,document_id:String(rows[0].id),channel:meta.channel,message_id:meta.messageId,sha256:meta.sha,extraction_state:extractionState,ingested_at:rows[0].ingested_at};
}
async function runStatus(body,auth){
  const runKey=String(body.run_key||'').trim();if(!/^[A-Za-z0-9._:-]{8,160}$/.test(runKey))throw Object.assign(new Error('RUN_KEY_INVALID'),{status:400});
  const status=String(body.status||'').trim();if(!['STARTED','SUCCESS','PARTIAL','FAILED','BLOCKED'].includes(status))throw Object.assign(new Error('RUN_STATUS_INVALID'),{status:400});
  const channels=Array.isArray(body.channels)?body.channels.map(cleanChannel):[];if(channels.length>10)throw Object.assign(new Error('CHANNEL_LIST_INVALID'),{status:400});
  const n=k=>{const v=Number(body[k]||0);if(!Number.isInteger(v)||v<0||v>100000)throw Object.assign(new Error('RUN_COUNT_INVALID'),{status:400});return v;};
  const errorCode=cleanText(body.error_code,200);
  const scanned=n('scanned_messages'),accepted=n('accepted_files'),duplicates=n('duplicate_files'),failed=n('failed_files');
  await sql`
    insert into portal_private.telegram_market_ingest_runs(run_key,status,channels,scanned_messages,accepted_files,duplicate_files,failed_files,error_code,started_at,finished_at,updated_at)
    values(${runKey},${status},${sql.json(channels)}::jsonb,${scanned},${accepted},${duplicates},${failed},${errorCode},now(),case when ${status}='STARTED' then null else now() end,now())
    on conflict(run_key) do update set status=excluded.status,channels=excluded.channels,scanned_messages=excluded.scanned_messages,accepted_files=excluded.accepted_files,duplicate_files=excluded.duplicate_files,failed_files=excluded.failed_files,error_code=excluded.error_code,finished_at=case when excluded.status='STARTED' then portal_private.telegram_market_ingest_runs.finished_at else now() end,updated_at=now()`;
  console.log(JSON.stringify({event:'TELEGRAM_INGEST_RUN_STATUS',status,run_key:runKey,run_id:auth.runId}));
  return {ok:true,run_key:runKey,status};
}

Deno.serve(async req=>{
  const path=functionPath(req);
  if(path==='/health'&&req.method==='GET')return await health();
  if(req.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405,{allow:'GET, POST'});
  let auth;try{auth=await githubOidc(req);}catch(e){return json({ok:false,code:String(e?.message||'AUTH_DENIED')},Number(e?.status||403));}
  try{
    const body=await readJson(req);
    if(path==='/prepare')return json(await prepare(body,auth));
    if(path==='/finalize')return json(await finalize(body,auth));
    if(path==='/run-status')return json(await runStatus(body,auth));
    return json({ok:false,code:'ROUTE_NOT_FOUND'},404);
  }catch(e){
    const status=Number(e?.status||500),code=String(e?.message||'TELEGRAM_INGEST_ERROR');
    console.error(JSON.stringify({event:'TELEGRAM_INGEST_ERROR',code,status,run_id:auth?.runId||''}));
    return json({ok:false,code},status);
  }
});
