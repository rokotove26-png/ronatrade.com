const PUBLIC='https://ronaoil.com';
const SEGMENTS=new Set(['operations','finance','legal','market-analyst','rail-logistics','system-admin']);
const ALLOWED_ORIGINS=new Set(['https://chatgpt.com','https://chat.openai.com','https://openai.com','https://platform.openai.com','https://ronaoil.com','https://www.ronaoil.com']);
function cors(req){const o=req.headers.get('origin');return o&&ALLOWED_ORIGINS.has(o)?{'access-control-allow-origin':o,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'authorization, content-type, accept, mcp-protocol-version, x-request-id, x-correlation-id','access-control-max-age':'600','vary':'Origin'}:{};}
function json(body,status,req){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate','pragma':'no-cache','referrer-policy':'no-referrer','x-content-type-options':'nosniff',...cors(req)}});}
function base(seg){return `${PUBLIC}/${seg}`;}
function resource(seg){return `${base(seg)}/mcp`;}
function protectedMeta(seg){return{resource:resource(seg),authorization_servers:[base(seg)],scopes_supported:['mcp:read','mcp:coordinate','offline_access'],bearer_methods_supported:['header'],resource_documentation:'https://ronaoil.com'};}
function authMeta(seg){const issuer=base(seg);return{issuer,authorization_endpoint:`${issuer}/authorize`,token_endpoint:`${issuer}/token`,registration_endpoint:`${issuer}/register`,revocation_endpoint:`${issuer}/revoke`,response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:['mcp:read','mcp:coordinate','offline_access'],service_documentation:'https://ronaoil.com'};}
export async function onRequest(context){
 const req=context.request;
 if(req.method==='OPTIONS'){const o=req.headers.get('origin');if(o&&!ALLOWED_ORIGINS.has(o))return json({error:'ORIGIN_DENIED'},403,req);return new Response(null,{status:204,headers:{'cache-control':'no-store',...cors(req)}});}
 if(req.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405,req);
 const p=new URL(req.url).pathname;
 let m=p.match(/^\/\.well-known\/oauth-protected-resource\/(operations|finance|legal|market-analyst|rail-logistics|system-admin)\/mcp\/?$/);
 if(m&&SEGMENTS.has(m[1]))return json(protectedMeta(m[1]),200,req);
 m=p.match(/^\/\.well-known\/oauth-authorization-server\/(operations|finance|legal|market-analyst|rail-logistics|system-admin)\/?$/);
 if(m&&SEGMENTS.has(m[1]))return json(authMeta(m[1]),200,req);
 return json({error:'NOT_FOUND'},404,req);
}
