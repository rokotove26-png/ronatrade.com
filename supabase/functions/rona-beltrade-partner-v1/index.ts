// @ts-nocheck
import postgres from "npm:postgres@3.4.7";
import { OPENAPI_SPEC } from "./openapi.mjs";
import { READ_SQL, RESOURCE_TYPES, DOCUMENT_DOWNLOAD_SQL } from "./read-sql.mjs";
const DB = Deno.env.get("SUPABASE_DB_URL");
if (!DB) throw Error("PARTNER_DATABASE_NOT_CONFIGURED");
const sql = postgres(DB, { prepare:false, max:1, idle_timeout:5, connect_timeout:5 });
const BASE = "/rona-beltrade-partner-v1", TYPES = RESOURCE_TYPES;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_PATTERN = /^rona_beltrade_live_[A-Za-z0-9_-]{40,80}$/;
const HEAD = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
function response(status: number, data: Record<string,unknown>, requestId?: string) {
  return new Response(JSON.stringify({...data,...(requestId?{request_id:requestId}:{})}),{status,headers:HEAD});
}
async function hashKey(secret: string): Promise<string> {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
}
async function authenticatedPartner(req: Request) {
  const auth=req.headers.get("authorization")||"";
  if(!auth.startsWith("Bearer "))return null;
  const key=auth.slice(7);
  if(!KEY_PATTERN.test(key))return null;
  const rows=await sql.unsafe("SELECT p.id::text AS partner_id,p.partner_code FROM portal_private.partner_api_keys k JOIN portal_private.partner_api_integrations p ON p.id=k.partner_id WHERE k.key_sha256=$1 AND k.active=true AND k.revoked_at IS NULL AND k.expires_at>now() AND p.enabled=true LIMIT 1",[await hashKey(key)]);
  return rows[0]?.partner_code==="BELTRADE_DESK" ? rows[0] : null;
}
async function rateAllowed(partnerId: string): Promise<boolean> {
  const rows=await sql.unsafe("INSERT INTO portal_private.partner_api_rate_limits(partner_id,minute_bucket,request_count) VALUES($1::uuid,date_trunc('minute',now()),1) ON CONFLICT(partner_id,minute_bucket) DO UPDATE SET request_count=portal_private.partner_api_rate_limits.request_count+1 WHERE portal_private.partner_api_rate_limits.request_count<60 RETURNING request_count",[partnerId]);
  return rows.length>0;
}
async function audited(partnerId: string,requestId: string,method: string,route: string,status: number,eventCode: string,data: Record<string,unknown>) {
  try {
    await sql.unsafe("INSERT INTO portal_private.partner_api_request_audit(partner_id,request_id,request_method,route,http_status,event_code) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6)",[partnerId,requestId,method,route,status,eventCode]);
  } catch {
    return response(503,{ok:false,code:"AUDIT_BACKEND_UNAVAILABLE"},requestId);
  }
  return response(status,data,requestId);
}
async function canRead(partnerId:string,resource:string){
  const rows=await sql.unsafe("SELECT can_read FROM portal_private.partner_api_resource_permissions WHERE partner_id=$1::uuid AND resource=$2 LIMIT 1",[partnerId,resource]);
  return rows[0]?.can_read===true;
}
function sinceDate(value:string|null){
  if(value===null)return null;
  if(value.length>45||!(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(value)))return undefined;
  const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():undefined;
}
function formatResource(resource:string,record:any){
  if(resource==="documents")return {...record,download_url:record.download_available?"/v1/documents/"+record.id+"/download":null};
  if(resource==="applications"||resource==="deals")return {...record,price_authority:"APPLICATION_PROPOSAL_NOT_SIGNED_TRADE_PRICE",origin_station_code:null,destination_station_code:null};
  if(resource==="payments")return {...record,amount_authority:"VERIFIED_ALLOCATION_IN_AGENCY_SCOPE_ONLY"};
  return record;
}
async function listRead(partnerId:string,resource:string,item:string|null,limit:number,offset:number,since:string|null){
  const rows=await sql.unsafe(READ_SQL[resource],[partnerId,item,limit,offset,since]);
  return rows.map((r:any)=>formatResource(resource,r));
}
function serviceKey(){
  const legacy=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(legacy)return legacy;
  try{const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");return typeof keys?.default==="string"?keys.default:""}catch{return ""}
}
async function protectedDocument(req:Request,p:any,requestId:string,path:string,entityId:string){
  const partnerId=p.partner_id;
  if(!await canRead(partnerId,"documents"))return audited(partnerId,requestId,req.method,path,403,"READ_SCOPE_DISABLED",{ok:false,code:"READ_SCOPE_DISABLED"});
  const rows=await sql.unsafe(DOCUMENT_DOWNLOAD_SQL,[partnerId,entityId]);
  if(!rows.length)return audited(partnerId,requestId,req.method,path,404,"DOCUMENT_CONTENT_NOT_GRANTED",{ok:false,code:"OBJECT_NOT_FOUND"});
  const doc=rows[0],key=serviceKey(),base=Deno.env.get("SUPABASE_URL")||"";
  if(!key||!base)return audited(partnerId,requestId,req.method,path,503,"DOCUMENT_STORAGE_UNCONFIGURED",{ok:false,code:"DOCUMENT_STORAGE_UNAVAILABLE"});
  if(Number(doc.byte_size)>30000000||Number(doc.byte_size)<0)return audited(partnerId,requestId,req.method,path,413,"DOCUMENT_SIZE_LIMIT",{ok:false,code:"DOCUMENT_SIZE_LIMIT"});
  const obj=String(doc.object_name||"");
  if(!obj||obj.startsWith("/")||obj.split("/").some((p:string)=>!p||p==="."||p===".."))
    return audited(partnerId,requestId,req.method,path,503,"DOCUMENT_STORAGE_PATH_INVALID",{ok:false,code:"DOCUMENT_STORAGE_UNAVAILABLE"});
  const target=base.replace(/\/+$/,"")+"/storage/v1/object/authenticated/"+encodeURIComponent(String(doc.bucket_id))+"/"+obj.split("/").map(encodeURIComponent).join("/");
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
  let upstream:Response;
  try{upstream=await fetch(target,{method:"GET",redirect:"error",signal:ctrl.signal,headers:{"authorization":"Bearer "+key,"apikey":key}});}
  catch{return audited(partnerId,requestId,req.method,path,503,"DOCUMENT_STORAGE_FETCH_FAILED",{ok:false,code:"DOCUMENT_STORAGE_UNAVAILABLE"});}
  finally{clearTimeout(timer)}
  if(!upstream.ok||!upstream.body)return audited(partnerId,requestId,req.method,path,503,"DOCUMENT_STORAGE_FETCH_FAILED",{ok:false,code:"DOCUMENT_STORAGE_UNAVAILABLE"});
  const recorded=await audited(partnerId,requestId,req.method,path,200,"DOCUMENT_BINARY_READ",{ok:true,version_number:doc.version_number});
  if(recorded.status!==200){try{await upstream.body.cancel()}catch{}return recorded;}
  const raw=String(doc.filename||"document"),filename=raw.replace(/[\r\n]/g,"").slice(0,160);
  const declared=String(doc.content_type||"").toLowerCase();
  const contentType=(declared==="application/pdf"||declared==="image/jpeg"||declared==="image/png"||declared==="application/octet-stream"||declared==="application/vnd.openxmlformats-officedocument.wordprocessingml.document")?declared:"application/octet-stream";
  return new Response(upstream.body,{status:200,headers:{"Content-Type":contentType,"Content-Disposition":"attachment; filename=\"document\"; filename*=UTF-8''"+encodeURIComponent(filename),"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY","Content-Security-Policy":"default-src 'none'","Referrer-Policy":"no-referrer","X-RONA-Document-Version":String(doc.version_number)}});
}
async function allowedResourceManifest(partnerId:string){
  const items:Record<string,string[]>={};
  for(const resource of TYPES){
    if(!await canRead(partnerId,resource)){items[resource]=[];continue;}
    const rows=await listRead(partnerId,resource,null,1001,0,null);
    if(rows.length>1000)throw new Error("SCOPE_MANIFEST_TOO_LARGE");
    items[resource]=rows.map((r:any)=>String(r.id)).sort();
  }
  const revision=await hashKey(JSON.stringify(items));
  return {resources:items,revision};
}
Deno.serve(async req=>{
  const requestId=crypto.randomUUID(),url=new URL(req.url);
  const idx=url.pathname.indexOf(BASE);
  if(idx<0)return response(404,{ok:false,code:"ROUTE_NOT_FOUND"},requestId);
  const path=url.pathname.slice(idx+BASE.length).replace(/\/+$/,"")||"/";
  if(req.method!=="GET")return response(405,{ok:false,code:"READ_ONLY_METHODS"},requestId);
  if(path==="/health")return response(200,{ok:true,service:"RONA_BELTRADE_PARTNER_V1",status:"UP",contract_version:"1.1.0"},requestId);
  if(path==="/openapi.json")return response(200,OPENAPI_SPEC);
  try{
    const p=await authenticatedPartner(req);
    if(!p)return response(401,{ok:false,code:"PARTNER_ACCESS_DENIED"},requestId);
    if(!await rateAllowed(p.partner_id))return audited(p.partner_id,requestId,req.method,path,429,"RATE_LIMITED",{ok:false,code:"RATE_LIMITED"});
    if(path==="/v1/catalog"){
      const rights=await sql.unsafe("SELECT resource,can_read AS read,can_create AS create,can_update AS update FROM portal_private.partner_api_resource_permissions WHERE partner_id=$1::uuid ORDER BY resource",[p.partner_id]);
      return audited(p.partner_id,requestId,req.method,path,200,"CATALOG_READ",{ok:true,partner:p.partner_code,contract_version:"1.1.0",agency_scope:"INKOM_351C2026",resources:rights,notes:"Exact deal grant plus current InCom agency addendum required for every row. Partner writes are disabled; existing key unchanged."});
    }
    if(path==="/v1/scope"){
      if([...url.searchParams.keys()].length)return audited(p.partner_id,requestId,req.method,path,400,"INVALID_QUERY",{ok:false,code:"INVALID_QUERY"});
      const manifest=await allowedResourceManifest(p.partner_id);
      return audited(p.partner_id,requestId,req.method,path,200,"AGENCY_SCOPE_MANIFEST",{ok:true,contract_version:"1.1.0",agency_scope:"INKOM_351C2026",...manifest,cache_rule:"Remove previously cached record IDs absent from this complete manifest. A revoked key cannot obtain any future manifest."});
    }
    if(path==="/v1/changes"){
      if([...url.searchParams.keys()].some((k:string)=>k!=="since"))return audited(p.partner_id,requestId,req.method,path,400,"INVALID_QUERY",{ok:false,code:"INVALID_QUERY"});
      const since=sinceDate(url.searchParams.get("since"));
      if(since===undefined||since===null)return audited(p.partner_id,requestId,req.method,path,400,"SINCE_REQUIRED",{ok:false,code:"INVALID_SINCE"});
      const changes:Record<string,unknown[]>={};
      for(const resource of TYPES){
        if(!await canRead(p.partner_id,resource)){changes[resource]=[];continue;}
        const rows=await listRead(p.partner_id,resource,null,101,0,since);
        if(rows.length>100)return audited(p.partner_id,requestId,req.method,path,409,"RESOURCE_PAGE_REQUIRED",{ok:false,code:"RESOURCE_PAGE_REQUIRED",resource,advice:"Use /v1/"+resource+"?updated_since=...&limit=100&offset=..."});
        changes[resource]=rows;
      }
      return audited(p.partner_id,requestId,req.method,path,200,"SCOPED_CHANGES_READ",{ok:true,contract_version:"1.1.0",since,snapshot_at:new Date().toISOString(),changes,cache_rule:"Compare with GET /v1/scope for revocation and deleted grants. Data is not authoritative without matching scope."});
    }
    const parts=path.split("/").filter(Boolean);
    if(parts.length===4&&parts[0]==="v1"&&parts[1]==="documents"&&parts[3]==="download"){
      if(!UUID.test(parts[2])||[...url.searchParams.keys()].length)return audited(p.partner_id,requestId,req.method,path,400,"INVALID_DOCUMENT_REQUEST",{ok:false,code:"INVALID_DOCUMENT_REQUEST"});
      return protectedDocument(req,p,requestId,path,parts[2]);
    }
    if(!(parts.length===2||parts.length===3)||parts[0]!=="v1"||!TYPES.includes(parts[1]))
      return audited(p.partner_id,requestId,req.method,path,404,"ROUTE_NOT_FOUND",{ok:false,code:"ROUTE_NOT_FOUND"});
    const resource=parts[1],item=parts.length===3?parts[2]:null;
    if(item!==null&&!UUID.test(item))return audited(p.partner_id,requestId,req.method,path,400,"INVALID_ENTITY_ID",{ok:false,code:"INVALID_ENTITY_ID"});
    const keys=[...url.searchParams.keys()];
    if(keys.some((k:string)=>k!=="limit"&&k!=="offset"&&k!=="updated_since")||(item!==null&&keys.length))
      return audited(p.partner_id,requestId,req.method,path,400,"INVALID_QUERY",{ok:false,code:"INVALID_QUERY"});
    const limit=Number(url.searchParams.get("limit")??25),offset=Number(url.searchParams.get("offset")??0),since=sinceDate(url.searchParams.get("updated_since"));
    if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>10000||since===undefined)
      return audited(p.partner_id,requestId,req.method,path,400,"INVALID_PAGINATION_OR_DATE",{ok:false,code:"INVALID_PAGINATION_OR_DATE"});
    if(!await canRead(p.partner_id,resource))
      return audited(p.partner_id,requestId,req.method,path,403,"READ_SCOPE_DISABLED",{ok:false,code:"READ_SCOPE_DISABLED",resource});
    const rows=await listRead(p.partner_id,resource,item,item?1:limit+1,item?0:offset,since);
    if(item){
      if(!rows.length)return audited(p.partner_id,requestId,req.method,path,404,"OBJECT_NOT_GRANTED",{ok:false,code:"OBJECT_NOT_FOUND"});
      return audited(p.partner_id,requestId,req.method,path,200,"OBJECT_READ",{ok:true,resource,contract_version:"1.1.0",data:rows[0]});
    }
    return audited(p.partner_id,requestId,req.method,path,200,"OBJECT_LIST_READ",{ok:true,resource,contract_version:"1.1.0",data:rows.slice(0,limit),pagination:{limit,offset,has_more:rows.length>limit},scope:"INKOM_351C2026"});
  }catch{
    return response(503,{ok:false,code:"PARTNER_RUNTIME_UNAVAILABLE"},requestId);
  }
});

