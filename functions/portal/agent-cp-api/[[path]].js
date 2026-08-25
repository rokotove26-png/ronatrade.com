const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const RPC=`${SUPABASE_URL}/rest/v1/rpc`;
const STORAGE=`${SUPABASE_URL}/storage/v1`;
const BUCKET='rona-portal-private';
const ACCESS_COOKIE='rona_portal_at';
const REFRESH_COOKIE='rona_portal_rt';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEC={'cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin'};
function cookies(v){const o={};for(const x of String(v||'').split(';')){const i=x.indexOf('=');if(i>0)o[x.slice(0,i).trim()]=x.slice(i+1).trim()}return o}
function accessCookie(token,maxAge=3600){return `${ACCESS_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function refreshCookie(token,maxAge=604800){return `${REFRESH_COOKIE}=${token}; Max-Age=${Math.max(0,Number(maxAge)||0)}; Path=/portal; Secure; HttpOnly; SameSite=Lax`}
function clearCookies(){return[`${ACCESS_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`,`${REFRESH_COOKIE}=; Max-Age=0; Path=/portal; Secure; HttpOnly; SameSite=Lax`]}
function secureHeaders(base=new Headers()){const h=new Headers(base);for(const[k,v]of Object.entries(SEC))h.set(k,v);h.delete('content-length');h.delete('etag');h.delete('access-control-allow-origin');h.delete('access-control-allow-credentials');return h}
function response(body,status=200,setCookies=[],headers={}){const h=secureHeaders(new Headers(headers));for(const c of setCookies)h.append('set-cookie',c);return new Response(body,{status,headers:h})}
function json(body,status=200,setCookies=[]){return response(JSON.stringify(body),status,setCookies,{'content-type':'application/json; charset=utf-8'})}
function sameOrigin(req){const u=new URL(req.url),o=req.headers.get('origin');if(o)return o===u.origin;const r=req.headers.get('referer');if(!r)return false;try{return new URL(r).origin===u.origin}catch{return false}}
function encodedPath(v){return String(v||'').split('/').map(encodeURIComponent).join('/')}
async function renew(token){const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'content-type':'application/json'},body:JSON.stringify({refresh_token:token})});return{ok:r.ok,data:await r.json().catch(()=>({}))}}
async function session(req){const c=cookies(req.headers.get('cookie'));let access=c[ACCESS_COOKIE]||'',refresh=c[REFRESH_COOKIE]||'',set=[];if(!access&&refresh){const n=await renew(refresh);if(n.ok&&n.data?.access_token){access=n.data.access_token;refresh=n.data.refresh_token||refresh;set=[accessCookie(access,n.data.expires_in),refreshCookie(refresh)]}}return{access,refresh,set}}
async function authed(sess,fn){if(!sess.access)return null;let r=await fn(sess.access);if(r.status===401&&sess.refresh){const n=await renew(sess.refresh);if(n.ok&&n.data?.access_token){sess.access=n.data.access_token;sess.refresh=n.data.refresh_token||sess.refresh;sess.set=[accessCookie(sess.access,n.data.expires_in),refreshCookie(sess.refresh)];r=await fn(sess.access)}}return r}
async function rpc(sess,name,args={}){const r=await authed(sess,token=>fetch(`${RPC}/${encodeURIComponent(name)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(args)}));if(!r)throw Object.assign(new Error('PORTAL_ACCESS_DENIED'),{status:401});const data=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(String(data?.message||data?.code||`HTTP_${r.status}`)),{status:r.status===400?409:r.status});return data}
async function storageUpload(sess,objectName,bytes){const r=await authed(sess,token=>fetch(`${STORAGE}/object/${BUCKET}/${encodedPath(objectName)}`,{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/pdf','cache-control':'no-store','x-upsert':'true'},body:bytes}));if(!r)throw Object.assign(new Error('PORTAL_ACCESS_DENIED'),{status:401});if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(new Error(String(d?.message||d?.error||'AGENT_CP_STORAGE_UPLOAD_FAILED')),{status:r.status})}}
async function storageRead(sess,objectName){const r=await authed(sess,token=>fetch(`${STORAGE}/object/authenticated/${BUCKET}/${encodedPath(objectName)}`,{method:'GET',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,accept:'application/pdf'}}));if(!r)throw Object.assign(new Error('PORTAL_ACCESS_DENIED'),{status:401});if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(new Error(String(d?.message||d?.error||'AGENT_CP_STORAGE_READ_FAILED')),{status:r.status})}return r}
function decodeBase64(v){let s=String(v||'').replace(/\s+/g,'').replace(/=+$/,'');if(!s||s.length%4===1)throw Object.assign(new Error('CP_PDF_BASE64_INVALID'),{status:409});s+='='.repeat((4-s.length%4)%4);let raw;try{raw=atob(s)}catch{throw Object.assign(new Error('CP_PDF_BASE64_INVALID'),{status:409})}const b=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)b[i]=raw.charCodeAt(i);if(b.length<5||String.fromCharCode(...b.slice(0,5))!=='%PDF-')throw Object.assign(new Error('CP_PDF_INVALID'),{status:409});return b}
function relativePath(url){const p=url.pathname,prefix='/portal/agent-cp-api';return p.startsWith(prefix)?(p.slice(prefix.length)||'/'):'/'}
function proposalId(path){const m=path.match(/^\/admin\/proposals\/([0-9a-f-]+)\/(preview\.pdf|publish|return)$/i);return m&&UUID_RE.test(m[1])?m:null}
async function readJson(req){try{const x=await req.json();return x&&typeof x==='object'&&!Array.isArray(x)?x:{}}catch{return{}}}
export async function onRequest({request}){
  if(!['GET','POST'].includes(request.method))return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
  if(request.method==='POST'&&!sameOrigin(request))return json({ok:false,code:'ORIGIN_DENIED'},403);
  const sess=await session(request);if(!sess.access)return json({ok:false,code:'PORTAL_ACCESS_DENIED'},401,clearCookies());
  const path=relativePath(new URL(request.url));
  try{
    if(request.method==='GET'&&path==='/admin/bootstrap'){
      const data=await rpc(sess,'owner_agent_cp_owner_gate_bootstrap',{});return json({ok:true,data},200,sess.set)
    }
    const pm=proposalId(path);
    if(pm&&request.method==='GET'&&pm[2].toLowerCase()==='preview.pdf'){
      const material=await rpc(sess,'owner_agent_cp_owner_gate_material',{p_coordination_record_id:pm[1]});
      const pdf=decodeBase64(material?.pdfBase64);const name=String(material?.filename||'RONA-AGENT-CP-2026-001.pdf').replace(/["\\\r\n]/g,'_');
      return response(pdf,200,sess.set,{'content-type':'application/pdf','content-disposition':`inline; filename="${name}"`,'x-rona-agent-cp-master':String(material?.canonicalMasterId||''),'x-rona-agent-cp-sha256':String(material?.sha256||'')})
    }
    if(pm&&request.method==='POST'&&pm[2]==='publish'){
      const material=await rpc(sess,'owner_agent_cp_owner_gate_material',{p_coordination_record_id:pm[1]});
      const pdf=decodeBase64(material?.pdfBase64),publicationId=String(material?.publicationId||''),items=Array.isArray(material?.items)?material.items:[];
      if(!publicationId||!items.length)throw Object.assign(new Error('AGENT_CP_DELIVERY_PLAN_EMPTY'),{status:409});
      const objects=[];
      for(const item of items){const cpId=String(item?.cp_id||''),agentId=String(item?.agent_legal_entity_id||'');if(!cpId||!agentId)throw Object.assign(new Error('AGENT_CP_DELIVERY_PLAN_INVALID'),{status:409});const objectName=`agent-commercial-proposals/${publicationId}/${agentId}/current.pdf`;await storageUpload(sess,objectName,pdf);objects.push({cp_id:cpId,agent_legal_entity_id:agentId,object_name:objectName})}
      const refs=Array.from(new Set([...(Array.isArray(material?.sourceRefs)?material.sourceRefs.map(String):[]),`COORDINATION_RECORD:${pm[1]}`,`CANONICAL_MASTER:${String(material?.canonicalMasterId||'RONA-AGENT-CP-2026-001')}`,publicationId]));
      const result=await rpc(sess,'owner_agent_cp_materialize_and_send',{p_publication_id:publicationId,p_pdf_sha256:String(material?.sha256||''),p_pdf_byte_size:Number(material?.byteSize||pdf.length),p_filename:String(material?.filename||'RONA-AGENT-CP-2026-001.pdf'),p_objects:objects,p_owner_command_id:`CP-GATE:${pm[1]}`,p_source_refs:refs});
      return json({ok:true,data:{coordinationRecordId:pm[1],publicationId,canonicalMasterId:material?.canonicalMasterId,sha256:material?.sha256,result}},200,sess.set)
    }
    if(pm&&request.method==='POST'&&pm[2]==='return'){
      const b=await readJson(request),data=await rpc(sess,'owner_agent_cp_return_for_revision',{p_coordination_record_id:pm[1],p_reason:String(b?.reason||'').trim()||null});return json({ok:true,data},200,sess.set)
    }
    if(request.method==='GET'&&path==='/agent/bootstrap'){
      const data=await rpc(sess,'agent_current_commercial_proposals',{});return json({ok:true,data},200,sess.set)
    }
    const dm=path.match(/^\/agent\/commercial-proposals\/([^/]+)\/download$/);
    if(request.method==='GET'&&dm){
      const cpId=decodeURIComponent(dm[1]),plan=await rpc(sess,'agent_cp_download_plan',{p_cp_id:cpId}),r=await storageRead(sess,String(plan?.objectName||''));
      const h=secureHeaders(r.headers);h.set('content-type','application/pdf');h.set('content-disposition','inline');for(const c of sess.set)h.append('set-cookie',c);return new Response(r.body,{status:200,headers:h})
    }
    return json({ok:false,code:'ROUTE_NOT_ALLOWED'},404,sess.set)
  }catch(err){return json({ok:false,code:String(err?.message||'AGENT_CP_OWNER_GATE_FAILED')},Number(err?.status||500),sess.set)}
}
