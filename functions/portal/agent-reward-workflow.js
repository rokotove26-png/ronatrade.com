// Dedicated ADMIN-only Cloudflare proxy for signed agent-company agreements.
// Does not modify the existing owner/Finance API or business identity routes.
const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const PUBLIC_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';
const UPSTREAM=SUPABASE_URL+'/functions/v1/rona-agent-reward-workflow';
const RE=/^S-[0-9]{3,}$/,DOC=/^AGENCY-[A-Za-z0-9-]+$/;
function cookies(raw){const out={};for(const part of String(raw||'').split(';')){
  const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=part.slice(i+1).trim()}return out}
function safeHeaders(response=new Headers()){
  const h=new Headers({'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store, no-cache, must-revalidate',
    'pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
    'x-frame-options':'DENY','cross-origin-resource-policy':'same-origin'});
  if(response.has('content-type'))h.set('content-type',response.get('content-type'));
  return h
}
function reply(status,body){return new Response(JSON.stringify(body),{status,headers:safeHeaders()})}
function originAllowed(req){const u=new URL(req.url),origin=req.headers.get('origin');
  if(origin)return origin===u.origin;
  const ref=req.headers.get('referer');if(!ref)return false;
  try{return new URL(ref).origin===u.origin}catch{return false}}
async function refreshToken(token){try{
  const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{
    method:'POST',headers:{apikey:PUBLIC_KEY,'content-type':'application/json'},
    body:JSON.stringify({refresh_token:token})});
  const data=await r.json().catch(()=>({}));
  return r.ok&&data?.access_token&&data?.refresh_token?data:null
}catch{return null}}
function addSessionCookies(response,tokens){
  if(!tokens)return response;
  const h=new Headers(response.headers);
  h.append('set-cookie','rona_portal_at='+tokens.access_token+
    '; Max-Age='+Math.max(60,Math.min(Number(tokens.expires_in)||3600,7200))+
    '; Path=/portal; Secure; HttpOnly; SameSite=Lax');
  h.append('set-cookie','rona_portal_rt='+tokens.refresh_token+
    '; Max-Age=604800; Path=/portal; Secure; HttpOnly; SameSite=Lax');
  return new Response(response.body,{status:response.status,headers:h})
}
export async function onRequest({request}){
  if(!['GET','POST'].includes(request.method))return reply(405,{ok:false,code:'METHOD_NOT_ALLOWED'});
  if(request.method==='POST'&&!originAllowed(request))return reply(403,{ok:false,code:'ORIGIN_DENIED'});
  const url=new URL(request.url),action=url.searchParams.get('action')||'state',
    dealId=url.searchParams.get('dealId')||'',assignmentId=url.searchParams.get('assignmentId')||'',
    requestId=url.searchParams.get('requestId')||'',documentId=url.searchParams.get('documentId')||'',
    stage=url.searchParams.get('stage')||'';
  const uuid=/^[0-9a-f-]{36}$/i,deal=/^DEAL-20[0-9]{2}-[0-9]{3,}$/;
  let route='';
  if(['canonical-signature','canonical-seal'].includes(action)&&request.method==='GET'&&uuid.test(requestId)){
    route='/admin/acts/'+requestId+'/assets/'+(action==='canonical-signature'?'signature':'seal');
  }else if(action==='canonical-letterhead'&&request.method==='GET'){
    route='/admin/assets/canonical-letterhead';
  }else if(action==='agent-inbox'&&request.method==='GET'){
    route='/agent/acts';
  }else if(action==='agent-download-act'&&request.method==='GET'&&uuid.test(requestId)&&uuid.test(documentId)){
    route='/agent/acts/'+requestId+'/documents/'+documentId+'/download';
  }else{
    if(!deal.test(dealId)||!uuid.test(assignmentId))
      return reply(400,{ok:false,code:'DEAL_ASSIGNMENT_INVALID'});
    const root='/admin/deals/'+encodeURIComponent(dealId)+'/assignments/'+encodeURIComponent(assignmentId);
    if(action==='state'&&request.method==='GET')route=root;
    else if(action==='bind'&&request.method==='POST')route=root+'/addendum';
    else if(action==='request-act'&&request.method==='POST')route=root+'/acts';
    else if(action==='upload-act'&&request.method==='POST'&&uuid.test(requestId)
      &&['FINANCE_LEGAL_DRAFT','OWNER_SIGNED','BOTH_SIGNED'].includes(stage))
      route=root+'/acts/'+requestId+'/upload?stage='+encodeURIComponent(stage);
    else if(action==='final-act'&&request.method==='POST'&&uuid.test(requestId))
      route=root+'/acts/'+requestId+'/finalize';
    else if(action==='dispatch-act'&&request.method==='POST'&&uuid.test(requestId))
      route=root+'/acts/'+requestId+'/dispatch';
    else if(action==='download-act'&&request.method==='GET'&&uuid.test(requestId)&&uuid.test(documentId))
      route=root+'/acts/'+requestId+'/documents/'+documentId+'/download';
  }
  if(!route)return reply(404,{ok:false,code:'ACT_WORKFLOW_ROUTE_NOT_FOUND'});
  const jar=cookies(request.headers.get('cookie')),rt=jar.rona_portal_rt||'';
  let at=jar.rona_portal_at||'',tokens=null;
  if(!at&&rt){tokens=await refreshToken(rt);if(!tokens)return reply(401,{ok:false,code:'PORTAL_SESSION_EXPIRED'});at=tokens.access_token}
  if(!at)return reply(401,{ok:false,code:'PORTAL_ACCESS_DENIED'});
  const body=request.method==='POST'?await request.arrayBuffer():null;
  const forward=async token=>{
    const h=new Headers({authorization:'Bearer '+token,
      accept:'application/json',apikey:PUBLIC_KEY});
    const contentType=request.headers.get('content-type');
    if(contentType)h.set('content-type',contentType);
    const correlation=request.headers.get('x-request-id');
    if(correlation)h.set('x-request-id',correlation);
    return fetch(UPSTREAM+route,{method:request.method,headers:h,
      ...(body===null?{}:{body})})
  };
  let upstream=await forward(at);
  if(upstream.status===401&&rt){
    tokens=await refreshToken(rt);
    if(!tokens)return reply(401,{ok:false,code:'PORTAL_SESSION_EXPIRED'});
    upstream=await forward(tokens.access_token)
  }
  const h=safeHeaders(upstream.headers);
  return addSessionCookies(new Response(upstream.body,{status:upstream.status,headers:h}),tokens)
}
