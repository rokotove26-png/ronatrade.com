import { readFile } from 'node:fs/promises';

const html=await readFile('dist/portal/client.html','utf8');
const base='https://ronaoil.com';
const tags=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(m=>m[1]);
const targets=tags.filter(x=>x.includes('/assets/portal-runtime/client-context-selection-authority-v1.js')||x.includes('/assets/portal-runtime/client-home-command-center-v2.js')||x.includes('/assets/portal-runtime/client-home-current-only-v1.js'));
if(targets.length<3)throw new Error('EXPECTED_CLIENT_RUNTIME_TAGS_MISSING '+JSON.stringify(targets));
for(const src of targets){
  const url=base+src+(src.includes('?')?'&':'?')+'_diag='+Date.now();
  const r=await fetch(url,{headers:{'cache-control':'no-cache'},redirect:'manual'});
  const text=await r.text();
  const row={src,status:r.status,contentType:r.headers.get('content-type')||'',bytes:text.length,impBinding:text.includes('RONA_CLIENT_IMPERSONATION_TAB_BINDING_V1'),contextMarker:text.includes('20260903-client-context-selection-authority-v5-generic-header-no-contract-download'),homeRuntime:text.includes('20260902-client-home-command-center-v3-current-context'),currentOnly:text.includes('20260905-client-home-current-only-v1-fail-closed-generation-v8-startup-ready-preserve')};
  console.log('LIVE_CLIENT_RUNTIME '+JSON.stringify(row));
  if(r.status!==200)throw new Error('LIVE_CLIENT_RUNTIME_HTTP_'+r.status+' '+src);
  if(!/javascript|text\/plain/i.test(row.contentType))throw new Error('LIVE_CLIENT_RUNTIME_CONTENT_TYPE '+row.contentType+' '+src);
  if(src.includes('client-context-selection-authority-v1.js')&&!row.impBinding)throw new Error('LIVE_CONTEXT_RUNTIME_IMPERSONATION_BINDING_MISSING');
}
console.log('LIVE_CLIENT_PUBLIC_ASSETS=PASS');