import {proxyBoundRoleRequest} from '../_mcp_role_entry.js';

function consentScript(nonce){return `<script nonce="${nonce}">(()=>{const form=document.querySelector('form[action="https://ronaoil.com/system-admin/authorize"]');if(!form||!globalThis.crypto?.getRandomValues)return;const button=form.querySelector('button[type="submit"]');let busy=false;const encode=b=>{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')};form.addEventListener('submit',async event=>{event.preventDefault();if(busy)return;busy=true;if(button)button.disabled=true;const bytes=crypto.getRandomValues(new Uint8Array(32)),continuation=encode(bytes),data=new URLSearchParams(new FormData(form));data.set('continuation_nonce',continuation);try{await fetch('https://ronaoil.com/system-admin/authorize/prepare',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:data.toString(),mode:'no-cors',credentials:'omit',cache:'no-store'});}catch(_e){}location.replace('https://ronaoil.com/system-admin/authorize/complete?nonce='+encodeURIComponent(continuation));});})();</script>`;}

async function enhanceConsent(response){
  const type=String(response.headers.get('content-type')||'');
  if(response.status!==200||!type.toLowerCase().includes('text/html'))return response;
  const html=await response.text();
  if(!html.includes('name="request_id"')||!html.includes('type="submit"'))return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  const nonce=crypto.randomUUID(),script=consentScript(nonce),out=html.includes('</body>')?html.replace('</body>',`${script}</body>`):html+script;
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.set('content-security-policy',`default-src 'none'; script-src 'nonce-${nonce}'; connect-src https://ronaoil.com; form-action https://ronaoil.com; base-uri 'none'; frame-ancestors 'none'`);
  headers.set('x-rona-oauth-consent-policy','single-click-continuation-v1');
  return new Response(out,{status:200,statusText:'OK',headers});
}

export async function onRequest(context){
  const response=await proxyBoundRoleRequest(context,'system-admin');
  const path=new URL(context.request.url).pathname;
  if(context.request.method==='GET'&&path==='/system-admin/authorize')return enhanceConsent(response);
  return response;
}
