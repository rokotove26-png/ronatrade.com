import { readFile } from 'node:fs/promises';
import { resolve4, resolve6 } from 'node:dns/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';


const SUPABASE_HOST='sxawrwzeobaqwwmlkzws.supabase.co';
try{console.log('SUPABASE_DNS_A='+JSON.stringify(await resolve4(SUPABASE_HOST)))}catch(e){console.log('SUPABASE_DNS_A_ERROR='+String(e?.message||e))}
try{console.log('SUPABASE_DNS_AAAA='+JSON.stringify(await resolve6(SUPABASE_HOST)))}catch(e){console.log('SUPABASE_DNS_AAAA_ERROR='+String(e?.message||e))}
for(const family of ['-4','-6']){
  try{
    const out=execFileSync('curl',[family,'-sS','-o','/dev/null','-w','%{http_code} %{time_total} %{remote_ip}','--max-time','10','https://'+SUPABASE_HOST+'/auth/v1/health'],{encoding:'utf8'});
    console.log('SUPABASE_CURL_'+family.slice(1)+'='+out.trim());
  }catch(e){
    console.log('SUPABASE_CURL_'+family.slice(1)+'_ERROR='+String(e?.stderr||e?.message||e).trim().slice(0,500));
  }
}

for(const ip of ['104.18.38.10','172.64.149.246']){
  try{
    const out=execFileSync('curl',['-4','-sS','-o','/dev/null','-w','%{http_code} %{time_total} %{remote_ip}','--max-time','10','--resolve',SUPABASE_HOST+':443:'+ip,'https://'+SUPABASE_HOST+'/auth/v1/health'],{encoding:'utf8'});
    console.log('SUPABASE_CURL_RESOLVE_'+ip+'='+out.trim());
  }catch(e){
    console.log('SUPABASE_CURL_RESOLVE_'+ip+'_ERROR='+String(e?.stderr||e?.message||e).trim().slice(0,500));
  }
}

const ORIGIN='https://ronaoil.com';
const HOME='/pages/home_large?layout=large';
const LOGIN='/portal/auth/login';
const TIMEOUT_MS=15000;
const invalid={identifier:'qa-inline-prod@example.invalid',password:'wrong-password'};
const assert=(v,m)=>{if(!v)throw new Error(m)};
const timed=(url,init={})=>fetch(url,{...init,signal:AbortSignal.timeout(TIMEOUT_MS)});

let home;
try{
  home=await timed(ORIGIN+HOME,{cache:'no-store',redirect:'manual'});
}catch(e){
  console.error('PROD_HOME_FETCH_FAIL',e?.name,e?.message);
  process.exit(1);
}
const homeText=await home.text();
console.log('PROD_HOME_STATUS='+home.status);
console.log('PROD_HOME_INLINE_HEADER='+(home.headers.get('x-rona-inline-auth-entry')||''));
console.log('PROD_HOME_INLINE_SCRIPT='+String(homeText.includes('/assets/g82/portal-home-inline-auth-v2.js')));
console.log('PROD_HOME_REAL_ENTRY_SCRIPT='+String(homeText.includes('/assets/g82/portal-real-auth-entry-v1.js')));

let portalResult=null;
const started=Date.now();
try{
  const r=await timed(ORIGIN+LOGIN,{
    method:'POST',
    redirect:'manual',
    cache:'no-store',
    headers:{
      origin:ORIGIN,
      referer:ORIGIN+HOME,
      'content-type':'application/json',
      accept:'application/json'
    },
    body:JSON.stringify(invalid)
  });
  const text=await r.text();
  portalResult={status:r.status,ms:Date.now()-started,contentType:r.headers.get('content-type')||'',body:text.slice(0,500)};
  console.log('PROD_LOGIN_RESPONSE='+JSON.stringify(portalResult));
}catch(e){
  portalResult={error:String(e?.name||'Error'),message:String(e?.message||e),ms:Date.now()-started};
  console.log('PROD_LOGIN_RESPONSE='+JSON.stringify(portalResult));
}

let directResult=null;
try{
  const source=await readFile('functions/portal/auth/login.js','utf8');
  const key=source.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*'([^']+)'/)?.[1]||'';
  const url=source.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1]||'';
  assert(key&&url,'SUPABASE_PUBLIC_AUTH_CONFIG_MISSING');
  const t=Date.now();
  const r=await timed(url+'/auth/v1/token?grant_type=password',{
    method:'POST',
    headers:{apikey:key,'content-type':'application/json'},
    body:JSON.stringify({email:invalid.identifier,password:invalid.password})
  });
  const text=await r.text();
  directResult={status:r.status,ms:Date.now()-t,contentType:r.headers.get('content-type')||'',body:text.slice(0,500)};
  console.log('DIRECT_SUPABASE_AUTH_RESPONSE='+JSON.stringify(directResult));
}catch(e){
  directResult={error:String(e?.name||'Error'),message:String(e?.message||e)};
  console.log('DIRECT_SUPABASE_AUTH_RESPONSE='+JSON.stringify(directResult));
}

const source=await readFile('functions/portal/auth/login.js','utf8');
const key=source.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*'([^']+)'/)?.[1]||'';
const supabase=source.match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1]||'';
for(const [label,path,headers] of [
  ['DIRECT_SUPABASE_REST','/rest/v1/',{apikey:key,accept:'application/json'}],
  ['DIRECT_SUPABASE_EDGE','/functions/v1/rona-portal-api/session/me',{apikey:key,authorization:'Bearer invalid.qa.token',accept:'application/json'}]
]){
  const t=Date.now();
  try{
    const r=await timed(supabase+path,{headers,redirect:'manual',cache:'no-store'});
    console.log(label+'_RESPONSE='+JSON.stringify({status:r.status,ms:Date.now()-t,body:(await r.text()).slice(0,300)}));
  }catch(e){
    console.log(label+'_RESPONSE='+JSON.stringify({error:String(e?.name||'Error'),message:String(e?.message||e),ms:Date.now()-t}));
  }
}

let browserResult=null;
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await context.newPage();
  await page.goto(ORIGIN+HOME,{waitUntil:'domcontentloaded',timeout:30000});
  browserResult=await page.evaluate(async({supabase,key})=>{
    const started=Date.now();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const r=await fetch(supabase+'/auth/v1/token?grant_type=password',{
        method:'POST',
        headers:{apikey:key,'content-type':'application/json'},
        body:JSON.stringify({email:'qa-browser-direct@example.invalid',password:'wrong-password'}),
        signal:controller.signal
      });
      const text=await r.text();
      return {status:r.status,ms:Date.now()-started,body:text.slice(0,500)};
    }catch(e){
      return {error:String(e?.name||'Error'),message:String(e?.message||e),ms:Date.now()-started};
    }finally{clearTimeout(timer)}
  },{supabase:'https://sxawrwzeobaqwwmlkzws.supabase.co',key:(await readFile('functions/portal/auth/login.js','utf8')).match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*'([^']+)'/)?.[1]||''});
  console.log('BROWSER_DIRECT_SUPABASE_AUTH='+JSON.stringify(browserResult));
  await context.close();
}catch(e){
  console.log('BROWSER_DIRECT_SUPABASE_AUTH='+JSON.stringify({error:String(e?.name||'Error'),message:String(e?.message||e)}));
}finally{if(browser)await browser.close().catch(()=>{})}

assert(home.status===200,'PROD_HOME_HTTP_'+home.status);
assert(home.headers.get('x-rona-inline-auth-entry')==='g8.2-inline-auth-v2','PROD_HOME_INLINE_HEADER_MISSING');
assert(homeText.includes('/assets/g82/portal-home-inline-auth-v2.js'),'PROD_HOME_INLINE_SCRIPT_MISSING');
assert(!directResult?.error,'DIRECT_SUPABASE_AUTH_NETWORK_FAIL '+JSON.stringify(directResult));
assert([400,401].includes(directResult.status),'DIRECT_SUPABASE_AUTH_UNEXPECTED_'+directResult.status);
assert(!browserResult?.error,'BROWSER_DIRECT_SUPABASE_AUTH_FAIL '+JSON.stringify(browserResult));
assert([400,401].includes(browserResult.status),'BROWSER_DIRECT_SUPABASE_AUTH_UNEXPECTED_'+JSON.stringify(browserResult));
assert(!portalResult?.error,'PROD_LOGIN_ENDPOINT_TIMEOUT_OR_NETWORK_FAIL '+JSON.stringify(portalResult));
assert(portalResult.status===401,'PROD_LOGIN_EXPECTED_401_GOT_'+portalResult.status+' BODY '+portalResult.body);
assert(/application\/json/i.test(portalResult.contentType),'PROD_LOGIN_NOT_JSON '+portalResult.contentType);
let body={};
try{body=JSON.parse(portalResult.body)}catch{}
assert(body.code==='LOGIN_DENIED','PROD_LOGIN_WRONG_CONTRACT '+portalResult.body);

console.log('PRODUCTION_HOME_AUTH_ENDPOINT_QA=PASS');
