// ISOLATED integration server: no production connections, no production auth/session reuse.
// JWT issuer and old unrelated bootstrap are explicitly test doubles. Actual Pages proxies,
// application handler, emitted Client/Admin JS and all application SQL run unchanged.
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {sql,rows,literal,verifyDisposableDatabase,fixture,execute} from './database.mjs';
import {createApplicationBusinessHandler} from '../../../supabase/functions/_shared/client-application-business-v2/handler.mjs';
import {onRequest as clientProxy} from '../../../functions/portal/api/[[path]].js';
import {onRequest as adminProxy} from '../../../functions/portal/admin-completed-bootstrap.js';
import {onRequest as adminScript} from '../../../functions/portal/main-ui/index.js';
await verifyDisposableDatabase();
const f=await fixture(),secret=randomBytes(32),port=Number(process.env.APPLICATION_TEST_PORT||8768);
const apiRoute=u=>u.pathname.includes('/rona-portal-api')?u.pathname.split('/rona-portal-api')[1]:u.pathname;
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function token(n){const unsigned=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:f['auth'+n],session_id:f['session'+n],exp:Math.floor(Date.now()/1000)+3600});return unsigned+'.'+createHmac('sha256',secret).update(unsigned).digest('base64url')}
function verifiedToken(raw){try{const [h,p,s]=String(raw||'').split('.'),actual=Buffer.from(s,'base64url'),expected=createHmac('sha256',secret).update(h+'.'+p).digest();if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const c=JSON.parse(Buffer.from(p,'base64url'));return c.exp>Date.now()/1000?c:null}catch{return null}}
async function authenticate(request){
 const claims=verifiedToken(request.headers.get('authorization')?.replace(/^Bearer /,''));if(!claims)return null;
 const r=await sql`select a.* from portal_private.resolve_portal_auth(${claims.sub}::uuid,${claims.session_id}::uuid) a where a.session_allowed`;
 return r.length===1?{auth:claims.sub,sid:claims.session_id,user:r[0].portal_user_id,roles:r[0].roles}:null;
}
const emptyBase=()=>({applications:[],deals:[],payments:[],documents:[],prices:[],rail:[],tasks:[],clients:[],contracts:[],publications:[],agents:[],staff:[],users:[],counts:{}});
async function legacyDelegate(request){
 const ctx=await authenticate(request);if(!ctx)return Response.json({ok:false,code:'APPLICATION_SESSION_DENIED'},{status:401});
 const u=new URL(request.url),data=emptyBase();
 if(apiRoute(u)==='/v1/client/context'){
  const row=await sql`select c.client_id,c.legal_name,t.contract_id from portal_private.clients c join portal_private.contracts t on t.client_key=c.id where c.client_id=${u.searchParams.get('clientId')} and t.contract_id=${u.searchParams.get('contractId')}`;
  data.contract=row[0]||null;
 }
 return Response.json({ok:true,data});
}
const handler=createApplicationBusinessHandler(legacyDelegate,{sql,authenticate,apiRoute});
// Outbound test transport remains in-process. Unknown URLs throw instead of reaching production.
globalThis.fetch=async(input,init)=>{
 const request=new Request(input,init),u=new URL(request.url);
 if(u.hostname!=='sxawrwzeobaqwwmlkzws.supabase.co')throw new Error('UNEXPECTED_EXTERNAL_TEST_REQUEST');
 if(u.pathname.includes('/functions/v1/rona-portal-api'))return handler(request);
 if(u.pathname.endsWith('/rona-owner-acceptance/admin/bootstrap')){
  const ctx=await authenticate(request);return ctx?.roles.includes('ADMIN')?Response.json({ok:true,data:emptyBase()}):Response.json({ok:false,code:'ADMIN_DENIED'},{status:403});
 }
 throw new Error('UNIMPLEMENTED_ISOLATED_TRANSPORT:'+u.pathname);
};
const emitted=await (await adminScript({request:new Request('https://ronaoil.com/portal/main-ui')})).text();
const csrf=randomBytes(20).toString('hex'); // test-only control-plane secret; never part of production sources
function cookieUser(req){return verifiedToken(String(req.headers.cookie||'').match(/(?:^|;\s*)rona_portal_at=([^;]+)/)?.[1])}
function clientBoot(n){const ctx={client_id:f['client_id'+n],contract_id:f['contract_id'+n],legal_name:'Isolated client '+n};return `
const ctx=${JSON.stringify(ctx)};let current=ctx;
window.RONA_CLIENT_CONTEXT={getCurrentContext:()=>current,whenReady:async()=>current,invalidateCurrentProjection(){},whenCurrentProjection:async()=>{const r=await fetch('/portal/api/v1/client/context?clientId='+encodeURIComponent(current.client_id)+'&contractId='+encodeURIComponent(current.contract_id));const j=await r.json();if(!r.ok)throw new Error(j.code);return j.data}};
window.__RONA_CLIENT_PRICE_SYNC_STATE__={context:ctx,prices:[{publication_item_id:${JSON.stringify(f.publication_item)},product:'ISOLATED-LPG',producer:'ISOLATED',price:628.17,currency:'USD',basis:'CPT TEST',payment_terms:'TEST_TERMS',delivery_period_from:null,delivery_period_to:null}]};
window.__RONA_CIS_RAIL_REFERENCE__={as_of:'ISOLATED',station_count:10001,stations:Array.from({length:10001},(_,i)=>['TEST STATION '+i,String(i).padStart(6,'0'),'TEST ROAD',String.fromCharCode(1059,1079,1073,1077,1082,1080,1089,1090,1072,1085)]),borders:[['TEST BORDER','123456','TEST ROAD',String.fromCharCode(1050,1072,1079,1072,1093,1089,1090,1072,1085)]]};
`}
const html=(content,scripts='')=>'<!doctype html><html><head><meta charset="utf-8"><title>ISOLATED PR548 E2E</title><style>body{font:14px Arial;background:#fff;color:#111;margin:24px}button{cursor:pointer}#page-applications{width:1100px}</style></head><body><p>ISOLATED AUTH PROVIDER / DISPOSABLE DATABASE</p>'+content+scripts+'</body></html>';
const app=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1:'+port);let response;
  if(u.pathname==='/health')response=Response.json({ok:true,auth_boundary:'ISOLATED_SIGNED_JWT_PROVIDER',database_boundary:'DISPOSABLE_POSTGRESQL_17'});
  else if(u.pathname==='/test/login'){
   const n=Number(u.searchParams.get('user'));if(![1,2,3].includes(n))throw new Error('INVALID_TEST_USER');
   response=Response.json({ok:true},{headers:{'set-cookie':'rona_portal_at='+token(n)+'; Path=/portal; HttpOnly; SameSite=Lax'}});
  }else if(u.pathname==='/test/token'){
   // Used solely by the Deno integration test of the actual production authenticate().
   if(req.headers['x-isolated-control']!==csrf)throw new Error('TEST_CONTROL_DENIED');
   const n=Number(u.searchParams.get('user'));if(![1,2,3].includes(n))throw new Error('INVALID_TEST_USER');response=Response.json({token:token(n)});
  }else if(u.pathname==='/auth/v1/user'){
   const claims=verifiedToken(req.headers.authorization?.replace(/^Bearer /,''));response=claims?Response.json({id:claims.sub,aud:'authenticated',role:'authenticated'}):Response.json({message:'invalid jwt'},{status:401});
  }else if(u.pathname==='/test/logout')response=Response.json({ok:true},{headers:{'set-cookie':'rona_portal_at=; Max-Age=0; Path=/portal; HttpOnly; SameSite=Lax'}});
  else if(u.pathname==='/test/fixtures')response=Response.json(Object.fromEntries(Object.entries(f).filter(([k])=>!/^auth|^session|^user/.test(k))));
  else if(u.pathname==='/portal/client'){
   const claims=cookieUser(req),n=claims?.sub===f.auth1?1:claims?.sub===f.auth2?2:0;
   if(!n)response=new Response('TEST LOGIN REQUIRED',{status:401});
   else response=new Response(html('<button data-rona-price-item="'+f.publication_item+'">Open submission</button><section id="page-applications"></section>',
    '<script>'+clientBoot(n)+'</script><script src="/assets/portal-runtime/client-application-form-v3.js"></script><script src="/assets/portal-runtime/portal-client-applications-canonical-v1.js"></script>'),{headers:{'content-type':'text/html; charset=utf-8'}});
  }else if(u.pathname==='/portal/admin')response=new Response(html('<nav id="nav"><button data-page="applications">Applications</button></nav><section id="page-applications"></section>',
   '<script>window.__RONA_ADMIN_BOOT_STATE__={ready:true};window.__RONA_ADMIN_LIVE_READY__=true;</script><script src="/test/admin.js"></script><script src="/test/kpi.js"></script>'),{headers:{'content-type':'text/html; charset=utf-8'}});
  else if(u.pathname==='/test/admin.js')response=new Response(emitted,{headers:{'content-type':'text/javascript'}});
  else if(u.pathname==='/test/kpi.js'){const module=await import('../../../functions/portal/applications-total-kpi-ui.js');response=await module.onRequest({request:new Request(u)})}
  else if(u.pathname.startsWith('/assets/portal-runtime/')&&!u.pathname.includes('..'))response=new Response(await readFile('dist'+u.pathname),{headers:{'content-type':'text/javascript'}});
  else if(u.pathname==='/portal/admin-completed-bootstrap')response=await adminProxy({request:new Request(u,{headers:req.headers})});
  else if(u.pathname.startsWith('/portal/api/')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const request=new Request(u,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
   response=await clientProxy({request,env:{}});
  }else response=Response.json({ok:false,code:'ISOLATED_ROUTE_NOT_AVAILABLE'},{status:404});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,code:String(error?.message||error)}))}
});
app.listen(port,'127.0.0.1',async()=>{
 if(process.env.ISOLATED_CONTROL_FILE)await writeFile(process.env.ISOLATED_CONTROL_FILE,csrf,{mode:0o600});
 console.log('ISOLATED_APPLICATION_HTTP_READY:'+port);
});
process.on('SIGTERM',()=>app.close());
