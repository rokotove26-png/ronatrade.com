const UPSTREAM='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-mcp-gateway/assistant/authorize';

function forwardedHeaders(source){
  const headers=new Headers(source);
  for(const name of ['host','content-length','cf-connecting-ip','cf-ipcountry','cf-ray','cf-visitor']){
    headers.delete(name);
  }
  return headers;
}

function returnedHeaders(source,method,status){
  const headers=new Headers(source);
  headers.delete('content-length');
  headers.delete('content-encoding');
  if(method==='GET'&&status===200){
    headers.set('content-type','text/html; charset=utf-8');
    headers.delete('content-disposition');
  }
  return headers;
}

export async function onRequest({request}){
  const incoming=new URL(request.url);
  const target=new URL(UPSTREAM);
  target.search=incoming.search;

  const init={
    method:request.method,
    headers:forwardedHeaders(request.headers),
    redirect:'manual',
  };
  if(request.method!=='GET'&&request.method!=='HEAD'){
    init.body=await request.arrayBuffer();
  }

  const upstream=await fetch(target.toString(),init);
  const headers=returnedHeaders(upstream.headers,request.method,upstream.status);

  if(request.method==='GET'&&upstream.status===200){
    let html=await upstream.text();
    html=html.replace(
      '<form method="post" action="authorize">',
      '<form method="post" action="/assistant/authorize" novalidate>'
    );
    html=html.replaceAll(' required>','>');
    return new Response(html,{
      status:upstream.status,
      statusText:upstream.statusText,
      headers,
    });
  }

  return new Response(upstream.body,{
    status:upstream.status,
    statusText:upstream.statusText,
    headers,
  });
}
