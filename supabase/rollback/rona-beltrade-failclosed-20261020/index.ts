// Emergency zero-data fallback for scoped BelTrade API: no auth or object operations.
// Use instead of restoring legacy v1, which could reveal non-agency grants.
const HEAD={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
Deno.serve((_req)=>new Response(JSON.stringify({ok:false,code:"BELTRADE_SCOPE_FAIL_CLOSED",message:"Agency-scoped partner API is temporarily unavailable. No business records are exposed."}),{status:503,headers:HEAD}));
