const PROJECT_ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/auth/v1';
const PROJECT_JWKS=PROJECT_ISSUER+'/.well-known/jwks.json';
const OWNER_AUTH_USER_ID='c4a167ae-cd4f-4296-8f13-ef09ced41968';
const OWNER_EMAIL='office_kg@ronaoil.com';
const OWNER_IDENTITY='OWNER_ADMIN';
const JWKS_TTL_MS=5*60*1000;
let jwksCache={expiresAt:0,keys:[]};

function b64urlBytes(value){
  const s=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
  const padded=s.padEnd(Math.ceil(s.length/4)*4,'=');
  const raw=atob(padded),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
function b64urlJson(value){
  try{return JSON.parse(new TextDecoder().decode(b64urlBytes(value)))}catch{return null}
}
async function fetchJwks(){
  const now=Date.now();
  if(jwksCache.expiresAt>now&&Array.isArray(jwksCache.keys)&&jwksCache.keys.length)return jwksCache.keys;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort('RONA_OWNER_JWKS_TIMEOUT'),2500);
  try{
    const r=await fetch(PROJECT_JWKS,{headers:{accept:'application/json'},cache:'no-store',signal:controller.signal});
    if(!r.ok)return[];
    const j=await r.json().catch(()=>null),keys=Array.isArray(j?.keys)?j.keys.filter(Boolean):[];
    if(keys.length)jwksCache={expiresAt:now+JWKS_TTL_MS,keys};
    return keys;
  }catch{return[]}
  finally{clearTimeout(timer)}
}
async function verifyWithJwk(alg,jwk,data,signature){
  try{
    if(alg==='ES256'&&jwk?.kty==='EC'){
      const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:jwk.crv||'P-256'},false,['verify']);
      return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,data);
    }
    if(alg==='RS256'&&jwk?.kty==='RSA'){
      const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
      return await crypto.subtle.verify({name:'RSASSA-PKCS1-v1_5'},key,signature,data);
    }
    if(alg==='EdDSA'&&jwk?.kty==='OKP'&&jwk?.crv==='Ed25519'){
      const key=await crypto.subtle.importKey('jwk',jwk,{name:'Ed25519'},false,['verify']);
      return await crypto.subtle.verify({name:'Ed25519'},key,signature,data);
    }
  }catch{}
  return false;
}
function ownerClaimsValid(payload){
  const now=Math.floor(Date.now()/1000);
  const aud=payload?.aud;
  const audience=Array.isArray(aud)?aud.includes('authenticated'):aud==='authenticated';
  return payload?.iss===PROJECT_ISSUER
    && payload?.sub===OWNER_AUTH_USER_ID
    && String(payload?.email||'').toLowerCase()===OWNER_EMAIL
    && String(payload?.role||'')==='authenticated'
    && audience
    && Number.isFinite(Number(payload?.exp))&&Number(payload.exp)>now
    && (!payload?.nbf||Number(payload.nbf)<=now)
    && typeof payload?.session_id==='string'&&payload.session_id.length>0
    && String(payload?.app_metadata?.portal_identity||'')===OWNER_IDENTITY;
}
export async function verifyOwnerAdminAccessToken(token){
  const parts=String(token||'').split('.');
  if(parts.length!==3)return{ok:false,reason:'JWT_FORMAT'};
  const header=b64urlJson(parts[0]),payload=b64urlJson(parts[1]);
  const alg=String(header?.alg||''),kid=String(header?.kid||'');
  if(!header||!payload||!kid||!['ES256','RS256','EdDSA'].includes(alg))return{ok:false,reason:'JWT_UNSUPPORTED'};
  const keys=await fetchJwks();
  const jwk=keys.find(k=>String(k?.kid||'')===kid&&(!k?.alg||String(k.alg)===alg));
  if(!jwk)return{ok:false,reason:'JWK_NOT_FOUND'};
  const data=new TextEncoder().encode(parts[0]+'.'+parts[1]);
  const signature=b64urlBytes(parts[2]);
  if(!await verifyWithJwk(alg,jwk,data,signature))return{ok:false,reason:'JWT_SIGNATURE_INVALID'};
  if(!ownerClaimsValid(payload))return{ok:false,reason:'OWNER_CLAIMS_INVALID'};
  return{ok:true,claims:payload,authority:'SUPABASE_SIGNED_OWNER_JWT'};
}
