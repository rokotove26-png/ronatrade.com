// @ts-nocheck
const SUPA_URL = Deno.env.get("SUPABASE_URL");
if (!SUPA_URL) throw new Error("SUPABASE_URL missing");
const TARGET = `${SUPA_URL}/functions/v1/rona-admin-client-authority`;
const SOURCE_MARKER = "/rona-admin-contract-activation";
function send(status, body) { return new Response(JSON.stringify(body), { status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" } }); }
function forwardedHeaders(req) { const h=new Headers(); for (const n of ["authorization","content-type","accept","x-request-id","x-correlation-id","x-idempotency-key"]) { const v=req.headers.get(n); if(v) h.set(n,v); } return h; }
Deno.serve(async (req)=>{
 if(req.method!=="POST") return send(405,{ok:false,code:"METHOD_NOT_ALLOWED"});
 const url=new URL(req.url), i=url.pathname.indexOf(SOURCE_MARKER);
 if(i<0) return send(404,{ok:false,code:"ROUTE_NOT_FOUND"});
 const suffix=url.pathname.slice(i+SOURCE_MARKER.length)||"/";
 if(!/^\/contracts\/[^/]+\/signed-document\/attach$/.test(suffix)) return send(404,{ok:false,code:"ROUTE_NOT_FOUND"});
 try { const r=await fetch(`${TARGET}${suffix}${url.search}`,{method:"POST",headers:forwardedHeaders(req),body:await req.arrayBuffer()}); return new Response(r.body,{status:r.status,headers:r.headers}); }
 catch(e){ console.error(e); return send(502,{ok:false,code:"CONTRACT_ACTIVATION_UPSTREAM_ERROR"}); }
});