import postgres from "npm:postgres@3.4.7";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";

const DB=Deno.env.get('SUPABASE_DB_URL');
if(!DB) throw new Error('PUBLIC_MARKET_INGEST_DB_MISSING');
const sql=postgres(DB,{prepare:false,max:2});

const VERSION='1.0.0';
const GH_ISSUER='https://token.actions.githubusercontent.com';
const GH_AUDIENCE='rona-public-market-ingest';
const GH_REPOSITORY='rokotove26-png/ronatrade.com';
const GH_WORKFLOW_REF=`${GH_REPOSITORY}/.github/workflows/public-market-news-ingest.yml@refs/heads/main`;
const GH_JWKS=createRemoteJWKSet(new URL(`${GH_ISSUER}/.well-known/jwks`));
const encoder=new TextEncoder();
const SIGNIFICANCE=new Set(['СРЕДНЯЯ','ВЫСОКАЯ','КРИТИЧЕСКАЯ']);
const RUN_STATUS=new Set(['STARTED','SUCCESS','PARTIAL','FAILED','BLOCKED']);

function json(body,status=200,extra={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate',pragma:'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...extra}})}
function bearer(req){const h=req.headers.get('authorization')||'';return h.startsWith('Bearer ')?h.slice(7).trim():''}
async function readJson(req,max=300_000){const cl=req.headers.get('content-length');if(cl&&Number(cl)>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});const text=await req.text();if(encoder.encode(text).length>max)throw Object.assign(new Error('REQUEST_TOO_LARGE'),{status:413});try{return JSON.parse(text||'{}')}catch{throw Object.assign(new Error('INVALID_JSON'),{status:400})}}
function cleanText(v,max,required=false){const x=v===null||v===undefined?'':String(v).trim();if(required&&!x)throw Object.assign(new Error('REQUIRED_TEXT_MISSING'),{status:400});if(x.length>max)throw Object.assign(new Error('TEXT_TOO_LARGE'),{status:413});return x||null}
function cleanUrl(v){const x=cleanText(v,2000,true);let u;try{u=new URL(x)}catch{throw Object.assign(new Error('SOURCE_URL_INVALID'),{status:400})}if(u.protocol!=='https:')throw Object.assign(new Error('SOURCE_URL_INVALID'),{status:400});u.hash='';return u.toString()}
function cleanTs(v){if(v===null||v===undefined||String(v).trim()==='')return null;const d=new Date(v);if(!Number.isFinite(d.getTime()))throw Object.assign(new Error('SOURCE_TIMESTAMP_INVALID'),{status:400});const now=Date.now();if(d.getTime()>now+6*60*60*1000)throw Object.assign(new Error('SOURCE_TIMESTAMP_FUTURE'),{status:400});return d.toISOString()}
function cleanCount(v){const n=Number(v??0);if(!Number.isInteger(n)||n<0||n>1_000_000)throw Object.assign(new Error('RUN_COUNT_INVALID'),{status:400});return n}
function newsId(){const d=new Date();const y=d.getUTCFullYear(),m=String(d.getUTCMonth()+1).padStart(2,'0'),day=String(d.getUTCDate()).padStart(2,'0');return `NEWS-AUTO-${y}${m}${day}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`}

async function githubOidc(req){
  const token=bearer(req);if(!token)throw Object.assign(new Error('GITHUB_OIDC_REQUIRED'),{status:401});
  try{
    const {payload}=await jwtVerify(token,GH_JWKS,{issuer:GH_ISSUER,audience:GH_AUDIENCE,clockTolerance:5});
    if(payload.repository!==GH_REPOSITORY)throw new Error('repository');
    if(payload.ref!=='refs/heads/main')throw new Error('ref');
    if(payload.workflow_ref!==GH_WORKFLOW_REF)throw new Error('workflow_ref');
    if(!['schedule','workflow_dispatch'].includes(String(payload.event_name||'')))throw new Error('event_name');
    return{actor:String(payload.actor||''),runId:String(payload.run_id||''),runNumber:String(payload.run_number||''),eventName:String(payload.event_name||'')};
  }catch(e){console.error('public market ingest oidc denied',String(e?.message||e));throw Object.assign(new Error('GITHUB_OIDC_DENIED'),{status:403})}
}

async function health(){
  try{
    const r=await sql`select to_regclass('public.rona_market_news')::text as news,to_regclass('portal_private.public_market_news_ingest_runs')::text as runs`;
    const ok=Boolean(r[0]?.news&&r[0]?.runs);
    return json({ok,service:'rona-ai-read-extras/public-market-ingest',version:VERSION,mode:ok?'READY':'INCOMPLETE'},ok?200:503);
  }catch{return json({ok:false,service:'rona-ai-read-extras/public-market-ingest',version:VERSION,mode:'INCOMPLETE'},503)}
}

async function ingestItem(body,auth){
  const sourceUrl=cleanUrl(body.source_url);
  const headline=cleanText(body.headline,1200,true);
  const summary=cleanText(body.summary,8000,false);
  const sourceName=cleanText(body.source_name,500,true);
  const countryRegion=cleanText(body.country_region,500,false);
  const product=cleanText(body.product,500,false);
  const category=cleanText(body.category,500,false);
  const significance=cleanText(body.significance,100,true);
  if(!SIGNIFICANCE.has(significance))throw Object.assign(new Error('SIGNIFICANCE_INVALID'),{status:400});
  const impactDirection=cleanText(body.impact_direction,500,true);
  const relatedProducts=cleanText(body.related_products,1500,false);
  const relatedRoutes=cleanText(body.related_routes,2000,false);
  const analystCommentary=cleanText(body.analyst_commentary,12000,true);
  const duplicateGroup=cleanText(body.duplicate_group,500,true);
  const sourcePublishedAt=cleanTs(body.source_published_at);
  const runKey=cleanText(body.run_key,200,true);

  const byUrl=await sql`select news_id from public.rona_market_news where source_url=${sourceUrl} limit 1`;
  if(byUrl.length)return{ok:true,state:'DUPLICATE',duplicate_reason:'SOURCE_URL',news_id:String(byUrl[0].news_id||'')};
  const byGroup=await sql`select news_id,headline,source_published_at from public.rona_market_news where duplicate_group=${duplicateGroup} and lower(headline)=lower(${headline}) order by updated_at desc limit 1`;
  if(byGroup.length)return{ok:true,state:'DUPLICATE',duplicate_reason:'GROUP_HEADLINE',news_id:String(byGroup[0].news_id||'')};

  const id=newsId();
  const taskRunId=`PUBLIC-WEB-${runKey}`;
  const rows=await sql`
    insert into public.rona_market_news(
      news_id,discovered_at,source_published_at,country_region,product,category,headline,summary,source_name,source_url,
      significance,impact_direction,related_products,related_routes,analyst_commentary,duplicate_group,
      publication_status,approved_by,approved_at,task_run_id,exported_to_canonical,created_at,updated_at
    ) values(
      ${id},now(),${sourcePublishedAt}::timestamptz,${countryRegion},${product},${category},${headline},${summary},${sourceName},${sourceUrl},
      ${significance},${impactDirection},${relatedProducts},${relatedRoutes},${analystCommentary},${duplicateGroup},
      'ВНУТРЕННЕЕ',null,null,${taskRunId},false,now(),now()
    )
    on conflict(source_url) do nothing
    returning news_id,discovered_at`;
  if(rows.length!==1){const dupe=await sql`select news_id from public.rona_market_news where source_url=${sourceUrl} limit 1`;return{ok:true,state:'DUPLICATE',duplicate_reason:'SOURCE_URL_RACE',news_id:String(dupe[0]?.news_id||'')}}
  console.log(JSON.stringify({event:'PUBLIC_MARKET_NEWS_ACCEPTED',news_id:id,source_url:sourceUrl,run_id:auth.runId,run_key:runKey}));
  return{ok:true,state:'ACCEPTED',news_id:id,discovered_at:rows[0].discovered_at,publication_status:'ВНУТРЕННЕЕ',exported_to_canonical:false,client_distribution_allowed:false};
}

async function runStatus(body,auth){
  const runKey=cleanText(body.run_key,200,true);
  if(!/^[A-Za-z0-9._:-]{8,200}$/.test(runKey))throw Object.assign(new Error('RUN_KEY_INVALID'),{status:400});
  const status=cleanText(body.status,30,true);
  if(!RUN_STATUS.has(status))throw Object.assign(new Error('RUN_STATUS_INVALID'),{status:400});
  const scanned=cleanCount(body.scanned_items),accepted=cleanCount(body.accepted_items),duplicates=cleanCount(body.duplicate_items),filtered=cleanCount(body.filtered_items),failed=cleanCount(body.failed_items);
  const errorCode=cleanText(body.error_code,300,false);
  await sql`
    insert into portal_private.public_market_news_ingest_runs(run_key,status,scanned_items,accepted_items,duplicate_items,filtered_items,failed_items,error_code,started_at,finished_at,updated_at)
    values(${runKey},${status},${scanned},${accepted},${duplicates},${filtered},${failed},${errorCode},now(),case when ${status}='STARTED' then null else now() end,now())
    on conflict(run_key) do update set
      status=excluded.status,scanned_items=excluded.scanned_items,accepted_items=excluded.accepted_items,duplicate_items=excluded.duplicate_items,
      filtered_items=excluded.filtered_items,failed_items=excluded.failed_items,error_code=excluded.error_code,
      finished_at=case when excluded.status='STARTED' then portal_private.public_market_news_ingest_runs.finished_at else now() end,updated_at=now()`;
  console.log(JSON.stringify({event:'PUBLIC_MARKET_INGEST_RUN_STATUS',run_key:runKey,status,run_id:auth.runId}));
  return{ok:true,run_key:runKey,status};
}

export async function handlePublicMarketIngest(req,path){
  if(path==='/public-market-ingest/health'&&req.method==='GET')return await health();
  if(!path.startsWith('/public-market-ingest/'))return null;
  if(req.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405,{allow:'GET, POST'});
  let auth;try{auth=await githubOidc(req)}catch(e){return json({ok:false,code:String(e?.message||'AUTH_DENIED')},Number(e?.status||403))}
  try{
    const body=await readJson(req);
    if(path==='/public-market-ingest/item')return json(await ingestItem(body,auth));
    if(path==='/public-market-ingest/run-status')return json(await runStatus(body,auth));
    return json({ok:false,code:'ROUTE_NOT_FOUND'},404);
  }catch(e){const status=Number(e?.status||500),code=String(e?.message||'PUBLIC_MARKET_INGEST_ERROR');console.error(JSON.stringify({event:'PUBLIC_MARKET_INGEST_ERROR',code,status,run_id:auth?.runId||''}));return json({ok:false,code},status)}
}
