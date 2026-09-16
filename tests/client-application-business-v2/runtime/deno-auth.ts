// Actual pinned production authenticate() + actual postgres driver. The HTTP identity
// provider is an explicitly isolated HMAC JWT test issuer, NOT production Supabase Auth.
const db = Deno.env.get('SUPABASE_DB_URL') || '';
const url = Deno.env.get('SUPABASE_URL') || '';
if (!/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:/.test(db) || !url.startsWith('http://127.0.0.1:')) throw new Error('ISOLATED_AUTH_DATABASE_REQUIRED');
const control = await Deno.readTextFile(Deno.env.get('ISOLATED_CONTROL_FILE')!);
const {sql,authenticate,apiRoute} = await import('https://raw.githubusercontent.com/rokotove26-png/ronatrade.com/77588541119bb1a96375beed3e853e067ab1422f/supabase/functions/rona-portal-api/shared.ts');
const {createApplicationBusinessHandler} = await import('../../../supabase/functions/_shared/client-application-business-v2/handler.mjs');
const response = await fetch(url+'/test/token?user=1',{headers:{'x-isolated-control':control}});
const {token} = await response.json();
const request = new Request(url+'/v1/client/applications',{headers:{authorization:'Bearer '+token}});
const ctx = await authenticate(request);
if (!ctx || !ctx.roles.includes('CLIENT')) throw new Error('ACTUAL_AUTHENTICATE_FAILED');
if (await authenticate(new Request(url+'/v1/client/context',{headers:{authorization:'Bearer '+token+'invalid'}}))) throw new Error('BAD_SIGNATURE_ACCEPTED');
const seed = await sql`select test_application_v2.bundle(1,${crypto.randomUUID()},23.471) as body`;
const body=seed[0].body;
const handler=createApplicationBusinessHandler(()=>new Response(null,{status:501}),{sql,authenticate,apiRoute});
const result=await handler(new Request(url+'/v1/client/applications',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json','x-idempotency-key':body.idempotencyKey},body:JSON.stringify(body)}));
if(result.status!==200)throw new Error('ACTUAL_DRIVER_BUNDLE_FAILED:'+await result.text());
const receipt=await result.json();
if(!receipt.application?.bundle_complete||!receipt.application?.application_id)throw new Error('ACTUAL_DRIVER_RECEIPT_MISSING');
const passport=await handler(new Request(url+'/v1/client/applications/'+receipt.application.application_id+'/passport?clientId='+body.clientId+'&contractId='+body.contractId,{headers:{authorization:'Bearer '+token}}));
if(passport.status!==200)throw new Error('ACTUAL_DRIVER_PASSPORT_FAILED');
console.log('DENO_PINNED_AUTH_DRIVER=PASS isolated_jwt_provider=true production_acceptance=false');
await sql.end();
