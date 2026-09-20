const IMPERSONATION_COOKIE='rona_admin_imp';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCookies(header){
  const out={};
  for(const item of String(header||'').split(';')){
    const i=item.indexOf('=');
    if(i<1)continue;
    const k=item.slice(0,i).trim(),v=item.slice(i+1).trim();
    if(k)out[k]=v;
  }
  return out;
}

export function readBrowserImpersonation(request,{enabled=true}={}){
  if(!enabled)return{active:false,valid:true,token:'',tab:''};
  const cookies=parseCookies(request.headers.get('cookie'));
  const token=String(cookies[IMPERSONATION_COOKIE]||'').trim();
  if(!token)return{active:false,valid:true,token:'',tab:''};
  const tab=String(request.headers.get('x-rona-impersonation-tab')||'').trim();
  if(!UUID_RE.test(tab))return{active:true,valid:false,token,tab:''};
  return{active:true,valid:true,token,tab};
}

export function applyBrowserImpersonation(headers,state){
  if(!state?.active||!state?.valid)return headers;
  headers.set('x-rona-admin-impersonation-token',state.token);
  headers.set('x-rona-impersonation-tab',state.tab);
  if(!headers.has('x-request-id'))headers.set('x-request-id',crypto.randomUUID());
  if(!headers.has('x-correlation-id'))headers.set('x-correlation-id',crypto.randomUUID());
  return headers;
}

export function browserImpersonationInvalid(state){
  return Boolean(state?.active&&!state?.valid);
}
