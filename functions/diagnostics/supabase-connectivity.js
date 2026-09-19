const SUPABASE_URL='https://sxawrwzeobaqwwmlkzws.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_W2MxTx00ILiugSyZKp8uyQ_zBzcyorL';

async function probe(name,path,headers={}){
  const started=Date.now();
  try{
    const response=await fetch(SUPABASE_URL+path,{
      method:'GET',
      redirect:'manual',
      cache:'no-store',
      headers,
      signal:AbortSignal.timeout(4000)
    });
    const body=await response.text().catch(()=> '');
    return {name,status:response.status,ms:Date.now()-started,body:body.slice(0,160)};
  }catch(error){
    return {name,error:String(error?.name||'Error'),message:String(error?.message||error),ms:Date.now()-started};
  }
}

export async function onRequestGet({request}){
  const target=new URL(request.url).searchParams.get('target')||'all';
  const specs={
    auth:()=>probe('auth-health','/auth/v1/health'),
    rest:()=>probe('rest-root','/rest/v1/',{apikey:SUPABASE_PUBLISHABLE_KEY,accept:'application/json'}),
    edge:()=>probe('portal-session-me','/functions/v1/rona-portal-api/session/me',{
      apikey:SUPABASE_PUBLISHABLE_KEY,
      authorization:'Bearer invalid.qa.token',
      accept:'application/json'
    })
  };
  let probes;
  if(specs[target]) probes=[await specs[target]()];
  else probes=await Promise.all([specs.auth(),specs.rest(),specs.edge()]);
  return new Response(JSON.stringify({ok:true,source:'CLOUDFLARE_PAGES_PREVIEW_DIAGNOSTIC',target,probes}),{
    status:200,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
  });
}
