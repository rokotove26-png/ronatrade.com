const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const RPC=`${SUPABASE_URL}/rest/v1/rpc`;
const STORAGE=`${SUPABASE_URL}/storage/v1`;
const STORAGE_BUCKET='rona-portal-private';
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const SEC={'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'};
function cookies(v){const o={};for(const x of String(v||'').split(';')){const i=x.indexOf('=');if(i>0)o[x.slice(0,i).trim()]=x.slice(i+1).trim()}return o}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clear(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function headers(base={}){const h=new Headers({...SEC,...base});return h}
function out(body,status=200,set=[]){const h=headers({'content-type':'application/json; charset=utf-8'});for(const c of set)h.append('set-cookie',c);return new Response(JSON.stringify(body),{status,headers:h})}
function raw(body,status=200,set=[],extra={}){const h=headers(extra);for(const c of set)h.append('set-cookie',c);return new Response(body,{status,headers:h})}
function sameOrigin(req){const u=new URL(req.url),o=req.headers.get('origin');if(o)return o===u.origin;const r=req.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}}
function uuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
function cpId(v){return /^[A-Za-z0-9._:-]{1,160}$/.test(String(v||''))}
function encPath(v){return String(v||'').split('/').map(encodeURIComponent).join('/')}
function decodePdf(v){let s=String(v||'').replace(/\s+/g,'').replace(/=+$/,'');if(!s||s.length%4===1)throw Object.assign(new Error('CP_PDF_BASE64_INVALID'),{status:409});s+='='.repeat((4-s.length%4)%4);let r;try{r=atob(s)}catch{throw Object.assign(new Error('CP_PDF_BASE64_INVALID'),{status:409})}const b=new Uint8Array(r.length);for(let i=0;i<r.length;i++)b[i]=r.charCodeAt(i);if(b.length<5||b.length>524288||String.fromCharCode(...b.slice(0,5))!=='%PDF-')throw Object.assign(new Error('CP_PDF_INVALID'),{status:409});return b}
async function renew(token){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:token})});return{ok:r.ok,data:await r.json().catch(()=>({}))}}
async function rpc(token,name,args={}){return fetch(`${RPC}/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args)})}
async function session(req){const c=cookies(req.headers.get('cookie'));let access=c[ACCESS_COOKIE]||'',refresh=c[REFRESH_COOKIE]||'',set=[];if(!access&&refresh){const n=await renew(refresh);if(n.ok&&n.data?.access_token){access=n.data.access_token;refresh=n.data.refresh_token||refresh;set=[accessCookie(access,n.data.expires_in),refreshCookie(refresh)]}}return{access,refresh,set}}
async function authed(sess,fn){if(!sess.access)return null;let r=await fn(sess.access);if(r.status===401&&sess.refresh){const n=await renew(sess.refresh);if(n.ok&&n.data?.access_token){sess.access=n.data.access_token;sess.refresh=n.data.refresh_token||sess.refresh;sess.set=[accessCookie(sess.access,n.data.expires_in),refreshCookie(sess.refresh)];r=await fn(sess.access)}}return r}
async function rpcData(sess,name,args={}){const r=await authed(sess,t=>rpc(t,name,args));if(!r)throw Object.assign(new Error('PORTAL_ACCESS_DENIED'),{status:401});const data=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(String(data?.message||data?.code||`HTTP_${r.status}`)),{status:r.status===400?409:r.status});return data}
async function invoke(req,name,args){const sess=await session(req);if(!sess.access)return out({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clear());try{return out({ok:true,data:await rpcData(sess,name,args)},200,sess.set)}catch(err){return out({ok:false,code:String(err?.message||'REQUEST_FAILED')},Number(err?.status||500),sess.set)}}
async function storageUpload(sess,objectName,bytes){const r=await authed(sess,t=>fetch(`${STORAGE}/object/${STORAGE_BUCKET}/${encPath(objectName)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${t}`,'content-type':'application/pdf','cache-control':'no-store','x-upsert':'true'},body:bytes}));if(!r)throw Object.assign(new Error('PORTAL_ACCESS_DENIED'),{status:401});if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(new Error(String(d?.message||d?.error||'AGENT_CP_STORAGE_UPLOAD_FAILED')),{status:r.status})}}
async function storageRead(sess,objectName){const r=await authed(sess,t=>fetch(`${STORAGE}/object/authenticated/${STORAGE_BUCKET}/${encPath(objectName)}`,{method:'GET',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${t}`,accept:'application/pdf'}}));if(!r)throw Object.assign(new Error('PORTAL_ACCESS_DENIED'),{status:401});if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(new Error(String(d?.message||d?.error||'AGENT_CP_STORAGE_READ_FAILED')),{status:r.status})}return r}
async function body(req){try{return await req.json()}catch{return{}}}
async function cpPreview(request,id){const sess=await session(request);if(!sess.access)return out({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clear());try{const m=await rpcData(sess,'owner_agent_cp_owner_gate_material',{p_coordination_record_id:id}),pdf=decodePdf(m?.pdfBase64),name=String(m?.filename||'RONA-AGENT-CP-2026-001.pdf').replace(/["\\\r\n]/g,'_');return raw(pdf,200,sess.set,{'content-type':'application/pdf','content-disposition':`inline; filename="${name}"`,'x-rona-agent-cp-master':String(m?.canonicalMasterId||''),'x-rona-agent-cp-sha256':String(m?.sha256||'')})}catch(err){return out({ok:false,code:String(err?.message||'AGENT_CP_PREVIEW_FAILED')},Number(err?.status||500),sess.set)}}
async function cpPublish(request,id){const sess=await session(request);if(!sess.access)return out({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clear());try{const m=await rpcData(sess,'owner_agent_cp_owner_gate_material',{p_coordination_record_id:id}),pdf=decodePdf(m?.pdfBase64),publicationId=String(m?.publicationId||''),items=Array.isArray(m?.items)?m.items:[];if(!publicationId||!items.length)throw Object.assign(new Error('AGENT_CP_DELIVERY_PLAN_EMPTY'),{status:409});const objects=[];for(const item of items){const rowId=String(item?.cp_id||''),agentId=String(item?.agent_legal_entity_id||'');if(!rowId||!agentId)throw Object.assign(new Error('AGENT_CP_DELIVERY_PLAN_INVALID'),{status:409});const objectName=`agent-commercial-proposals/${publicationId}/${agentId}/current.pdf`;await storageUpload(sess,objectName,pdf);objects.push({cp_id:rowId,agent_legal_entity_id:agentId,object_name:objectName})}const refs=Array.from(new Set([...(Array.isArray(m?.sourceRefs)?m.sourceRefs.map(String):[]),`COORDINATION_RECORD:${id}`,`CANONICAL_MASTER:${String(m?.canonicalMasterId||'RONA-AGENT-CP-2026-001')}`,publicationId]));const result=await rpcData(sess,'owner_agent_cp_materialize_and_send',{p_publication_id:publicationId,p_pdf_sha256:String(m?.sha256||''),p_pdf_byte_size:Number(m?.byteSize||pdf.length),p_filename:String(m?.filename||'RONA-AGENT-CP-2026-001.pdf'),p_objects:objects,p_owner_command_id:`CP-GATE:${id}`,p_source_refs:refs});return out({ok:true,data:{coordinationRecordId:id,publicationId,canonicalMasterId:m?.canonicalMasterId,sha256:m?.sha256,result}},200,sess.set)}catch(err){return out({ok:false,code:String(err?.message||'AGENT_CP_PUBLICATION_FAILED')},Number(err?.status||500),sess.set)}}
async function agentCpDownload(request,id){const sess=await session(request);if(!sess.access)return out({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clear());try{const plan=await rpcData(sess,'agent_cp_download_plan',{p_cp_id:id}),r=await storageRead(sess,String(plan?.objectName||'')),h={};for(const[k,v]of r.headers.entries())if(['content-type','content-disposition','last-modified'].includes(k.toLowerCase()))h[k]=v;h['content-type']='application/pdf';h['content-disposition']='inline';return raw(r.body,200,sess.set,h)}catch(err){return out({ok:false,code:String(err?.message||'AGENT_CP_DOWNLOAD_FAILED')},Number(err?.status||500),sess.set)}}
export async function onRequest({request}){
  if(!['GET','POST'].includes(request.method))return out({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(request.method==='POST'&&!sameOrigin(request))return out({ok:false,code:'ORIGIN_DENIED'},403);
  const u=new URL(request.url),op=String(u.searchParams.get('op')||''),id=String(u.searchParams.get('id')||'');
  if(op==='bootstrap'&&request.method==='GET')return invoke(request,'owner_price_updates_bootstrap',{});
  if(op==='cp-bootstrap'&&request.method==='GET')return invoke(request,'owner_agent_cp_owner_gate_bootstrap',{});
  if(op==='cp-preview'&&request.method==='GET'){if(!uuid(id))return out({ok:false,code:'INVALID_PROPOSAL_ID'},400);return cpPreview(request,id)}
  if(op==='cp-publish'&&request.method==='POST'){if(!uuid(id))return out({ok:false,code:'INVALID_PROPOSAL_ID'},400);return cpPublish(request,id)}
  if(op==='cp-return'&&request.method==='POST'){if(!uuid(id))return out({ok:false,code:'INVALID_PROPOSAL_ID'},400);const b=await body(request);return invoke(request,'owner_agent_cp_return_for_revision',{p_coordination_record_id:id,p_reason:String(b?.reason||'').trim()||null})}
  if(op==='agent-cp-bootstrap'&&request.method==='GET')return invoke(request,'agent_current_commercial_proposals',{});
  if(op==='agent-cp-download'&&request.method==='GET'){if(!cpId(id))return out({ok:false,code:'INVALID_CP_ID'},400);return agentCpDownload(request,id)}
  if(op==='apply'&&request.method==='POST'){
    if(!uuid(id))return out({ok:false,code:'INVALID_PROPOSAL_ID'},400);
    return invoke(request,'owner_apply_price_change_proposal',{p_proposal_id:id});
  }
  if(op==='reject'&&request.method==='POST'){
    if(!uuid(id))return out({ok:false,code:'INVALID_PROPOSAL_ID'},400);
    const b=await body(request);return invoke(request,'owner_reject_price_change_proposal',{p_proposal_id:id,p_reason:String(b?.reason||'').trim()||null});
  }
  if(op==='audience'&&request.method==='POST'){
    const b=await body(request);if(typeof b?.client!=='boolean'||typeof b?.agent!=='boolean')return out({ok:false,code:'INVALID_AUDIENCE_STATE'},400);
    return invoke(request,'owner_set_price_publication_audience',{p_client:b.client,p_agent:b.agent});
  }
  return out({ok:false,code:'ROUTE_NOT_ALLOWED'},404);
}
