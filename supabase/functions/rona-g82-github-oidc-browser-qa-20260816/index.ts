// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const SUPA_URL=Deno.env.get("SUPABASE_URL");
const QA_DB_URL=Deno.env.get("SUPABASE_DB_URL");
if(!SUPA_URL) throw new Error("SUPABASE_URL missing");
const qaSql=QA_DB_URL?postgres(QA_DB_URL,{prepare:false,max:1,idle_timeout:1,connect_timeout:10,max_lifetime:30}):null;
function requireQaSql(){if(!qaSql)throw Object.assign(new Error("QA_DB_URL_MISSING"),{status:503});return qaSql}

function runtimeKey(kind){
  const legacy=kind==="pub"?Deno.env.get("SUPABASE_ANON_KEY"):Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(legacy) return legacy;
  const raw=Deno.env.get(kind==="pub"?"SUPABASE_PUBLISHABLE_KEYS":"SUPABASE_SECRET_KEYS");
  if(raw){ const parsed=JSON.parse(raw); if(parsed.default) return parsed.default; }
  throw new Error("Supabase runtime key missing");
}
const service=createClient(SUPA_URL,runtimeKey("secret"),{auth:{persistSession:false,autoRefreshToken:false}});
const publicClient=()=>createClient(SUPA_URL,runtimeKey("pub"),{auth:{persistSession:false,autoRefreshToken:false}});
const pvt=table=>service.schema("portal_private").from(table);

const REPO="rokotove26-png/ronatrade.com";
const LEGACY_REF="refs/heads/feat/admin-payments-final-owner-screen-passport-v1";
const LEGACY_AUD="rona-pr462-live-preview";
const LEGACY_SOURCE="QA_GITHUB_OIDC_PR462";
const ISSUE430_AUD="rona-issue430-owner-uat-browser-v2";
const ISSUE430_SOURCE="QA_GITHUB_OIDC_ISSUE430";
const ISSUE430_WORKFLOW="issue430 owner authorized browser QA";
const ISSUE430_WORKFLOW_PATH="/.github/workflows/issue430-owner-authorized-browser-qa.yml@";
const ISSUE430_ALLOWED_USERS=new Set([
  "724ff368-5ba3-449a-bd19-665ee487ee6f",
  "65d78d10-3722-4dba-9d77-8252e7c62527"
]);
const RADIO_STAGE2A_AUD="rona-radio-stage2a-production-v1";
const RADIO_STAGE2A_SOURCE="QA_GITHUB_OIDC_RADIO_STAGE2A";
const RADIO_STAGE2A_WORKFLOW="Admin Radio MESSAGE Stage 2A production QA";
const RADIO_STAGE2A_WORKFLOW_PATH="/.github/workflows/admin-radio-message-stage2a-production-qa.yml@";
const RADIO_STAGE2B_WORKFLOW="Admin Radio Notification Announcement Stage 2B production QA";
const RADIO_STAGE2B_WORKFLOW_PATH="/.github/workflows/admin-radio-stage2b-production-qa.yml@";
const RADIO_STAGE2A_REF="refs/heads/release/public-go-live-v1.1";
const RADIO_STAGE2A_ALLOWED_USERS=new Set([
  "a2a0b91e-4c2a-4d3e-8f11-2a2a00000001",
  "a2a0b91e-4c2a-4d3e-8f11-2a2a00000002",
  "a2a0b91e-4c2a-4d3e-8f11-2a2a00000003",
  "a2a0b91e-4c2a-4d3e-8f11-2a2a00000004",
  "a2a0b91e-4c2a-4d3e-8f11-2a2a00000005",
  "a2a0b91e-4c2a-4d3e-8f11-2a2a00000006"
]);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store, no-cache, must-revalidate",
  "pragma":"no-cache",
  "x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer"
}});
const b64=s=>{
  s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");
  return Uint8Array.from(atob(s+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
};
const bearer=req=>{
  const h=req.headers.get("authorization")||"";
  return h.startsWith("Bearer ")?h.slice(7):"";
};
const nowIso=()=>new Date().toISOString();

async function verifyGithubOidc(token){
  const parts=String(token||"").split(".");
  if(parts.length!==3) throw Object.assign(new Error("OIDC_FORMAT_INVALID"),{status:401});
  const header=JSON.parse(new TextDecoder().decode(b64(parts[0])));
  const claims=JSON.parse(new TextDecoder().decode(b64(parts[1])));
  if(header.alg!=="RS256"||!header.kid) throw Object.assign(new Error("OIDC_HEADER_INVALID"),{status:401});
  const jwksResp=await fetch("https://token.actions.githubusercontent.com/.well-known/jwks",{headers:{accept:"application/json"}});
  if(!jwksResp.ok) throw Object.assign(new Error("OIDC_JWKS_HTTP_"+jwksResp.status),{status:503});
  const jwks=await jwksResp.json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid);
  if(!jwk) throw Object.assign(new Error("OIDC_KID_UNKNOWN"),{status:401});
  const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
  const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,b64(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
  if(!valid) throw Object.assign(new Error("OIDC_SIGNATURE_INVALID"),{status:401});
  const now=Math.floor(Date.now()/1000);
  if(claims.iss!=="https://token.actions.githubusercontent.com"||
     claims.repository!==REPO||
     !claims.sha||!/^[0-9a-f]{40}$/i.test(String(claims.sha))||
     Number(claims.exp||0)<now-30||
     Number(claims.nbf||0)>now+30){
    throw Object.assign(new Error("OIDC_CLAIMS_DENIED"),{status:403});
  }

  if(claims.aud===LEGACY_AUD){
    const ev=String(claims.event_name||"");
    if(String(claims.ref||"")!==LEGACY_REF || (ev!=="push"&&ev!=="workflow_dispatch"))
      throw Object.assign(new Error("OIDC_CLAIMS_DENIED"),{status:403});
    return {profile:"LEGACY",claims};
  }

  if(claims.aud===ISSUE430_AUD){
    const ref=String(claims.ref||"");
    const wfRef=String(claims.workflow_ref||"");
    if(String(claims.event_name||"")!=="pull_request"||
       !/^refs\/pull\/\d+\/merge$/.test(ref)||
       String(claims.workflow||"")!==ISSUE430_WORKFLOW||
       !wfRef.includes(ISSUE430_WORKFLOW_PATH)){
      throw Object.assign(new Error("OIDC_CLAIMS_DENIED"),{status:403});
    }
    if(!/^\d{5,20}$/.test(String(claims.run_id||"")))
      throw Object.assign(new Error("OIDC_RUN_ID_INVALID"),{status:403});
    return {profile:"ISSUE430",claims};
  }

  if(claims.aud===RADIO_STAGE2A_AUD){
    const ref=String(claims.ref||"");
    const wfRef=String(claims.workflow_ref||"");
    const workflow=String(claims.workflow||"");
    const stage2aWorkflow=workflow===RADIO_STAGE2A_WORKFLOW&&wfRef.includes(RADIO_STAGE2A_WORKFLOW_PATH);
    const stage2bWorkflow=workflow===RADIO_STAGE2B_WORKFLOW&&wfRef.includes(RADIO_STAGE2B_WORKFLOW_PATH);
    if(String(claims.event_name||"")!=="push"||
       ref!==RADIO_STAGE2A_REF||
       !(stage2aWorkflow||stage2bWorkflow)){
      throw Object.assign(new Error("OIDC_CLAIMS_DENIED"),{status:403});
    }
    if(!/^\d{5,20}$/.test(String(claims.run_id||"")))
      throw Object.assign(new Error("OIDC_RUN_ID_INVALID"),{status:403});
    return {profile:"RADIO_STAGE2A",claims};
  }

  throw Object.assign(new Error("OIDC_AUDIENCE_DENIED"),{status:403});
}

async function deleteAuthUser(authId){
  if(!UUID_RE.test(String(authId||""))) return;
  const out=await service.auth.admin.deleteUser(String(authId),false);
  if(out.error) console.error("delete auth user",out.error);
}

async function retireUser(portalId,authId,sourceSystem,reason){
  if(!UUID_RE.test(String(portalId||""))) return;
  const ts=nowIso();
  await pvt("client_user_deal_grants").update({status:"REVOKED",revoked_at:ts,reason,updated_at:ts}).eq("user_id",portalId).eq("status","ACTIVE");
  await pvt("client_user_bindings").update({status:"REVOKED",revoked_at:ts,reason,updated_at:ts}).eq("user_id",portalId).eq("status","ACTIVE");
  await pvt("agent_user_bindings").update({status:"REVOKED",valid_to:ts,revoked_at:ts,reason,updated_at:ts}).eq("user_id",portalId).eq("status","ACTIVE");
  await pvt("portal_user_roles").update({status:"REVOKED",revoked_at:ts,reason,updated_at:ts}).eq("user_id",portalId).eq("status","ACTIVE");
  await pvt("staff_user_roles").update({status:"REVOKED",revoked_at:ts,reason,updated_at:ts}).eq("user_id",portalId).eq("status","ACTIVE");
  const update={status:"REVOKED",lifecycle_state:"ARCHIVED",revoked_at:ts,suspended_at:null,auth_user_id:null,updated_at:ts};
  let q=pvt("portal_users").update(update).eq("id",portalId);
  if(sourceSystem) q=q.eq("source_system",sourceSystem);
  const result=await q;
  if(result.error) console.error("retire portal user",result.error);
  await deleteAuthUser(authId);
}

async function cleanupByRun(sourceSystem,runId,sourcePortalId){
  let q=pvt("portal_users").select("id,auth_user_id,source_version").eq("source_system",sourceSystem).eq("status","ACTIVE");
  const prefix=sourcePortalId ? "RUN_"+runId+"_SRC_"+sourcePortalId+"%" : "RUN_"+runId+"%";
  q=q.like("source_version",prefix);
  const rows=await q;
  if(rows.error) throw rows.error;
  for(const row of rows.data||[]) await retireUser(String(row.id),String(row.auth_user_id||""),sourceSystem,"GitHub OIDC QA cleanup");
  return (rows.data||[]).length;
}

async function createAuth(login,email,displayName,metadata){
  const entropy=new Uint8Array(32); crypto.getRandomValues(entropy);
  const password="Aa1!"+Array.from(entropy).map(x=>x.toString(16).padStart(2,"0")).join("");
  const secretKey=runtimeKey("secret"),publicKey=runtimeKey("pub");
  let createdResp;
  try{
    createdResp=await fetch(SUPA_URL+"/auth/v1/admin/users",{
      method:"POST",
      headers:{authorization:"Bearer "+secretKey,apikey:secretKey,"content-type":"application/json"},
      body:JSON.stringify({email,password,email_confirm:true,user_metadata:Object.assign({
        rona_portal_login:login,
        rona_portal_display_name:displayName
      },metadata||{})}),
      signal:AbortSignal.timeout(30000)
    });
  }catch(error){
    throw Object.assign(new Error("QA_AUTH_USER_CREATE_TIMEOUT"),{status:503});
  }
  const created=await createdResp.json().catch(()=>null);
  const authId=String(created?.id||created?.user?.id||"");
  if(!createdResp.ok||!UUID_RE.test(authId)){
    console.error("qa auth create",createdResp.status,created?.code||created?.msg||created?.message||"UNKNOWN");
    throw Object.assign(new Error("QA_AUTH_USER_CREATE_FAILED"),{status:createdResp.status===429?429:503});
  }
  let signedResp;
  try{
    signedResp=await fetch(SUPA_URL+"/auth/v1/token?grant_type=password",{
      method:"POST",
      headers:{apikey:publicKey,"content-type":"application/json"},
      body:JSON.stringify({email,password}),
      signal:AbortSignal.timeout(30000)
    });
  }catch(error){
    await deleteAuthUser(authId).catch(()=>{});
    throw Object.assign(new Error("QA_SESSION_CREATE_TIMEOUT"),{status:503});
  }
  const session=await signedResp.json().catch(()=>null);
  if(!signedResp.ok||!session?.access_token){
    await deleteAuthUser(authId).catch(()=>{});
    throw Object.assign(new Error("QA_SESSION_CREATE_FAILED"),{status:signedResp.status===429?429:503});
  }
  return {authId,session};
}

async function radioStage2ASignIn(email,password,publicKey){
  let response;
  try{
    response=await fetch(SUPA_URL+"/auth/v1/token?grant_type=password",{
      method:"POST",
      headers:{apikey:publicKey,"content-type":"application/json"},
      body:JSON.stringify({email,password}),
      signal:AbortSignal.timeout(30000)
    });
  }catch(error){
    return {session:null,status:503,transient:true};
  }
  const session=await response.json().catch(()=>null);
  return {session:response.ok&&session?.access_token?session:null,status:response.status,transient:[429,500,502,503,504].includes(response.status)};
}

async function createRadioStage2AAuth(runId,identitySelector,login,displayName,metadata){
  const secretKey=runtimeKey("secret"),publicKey=runtimeKey("pub");
  const selectorKey=String(identitySelector).replaceAll("-","");
  const email="qa-radio-stage2a-"+runId+"-"+selectorKey+"@example.invalid";
  const hmacKey=await crypto.subtle.importKey("raw",new TextEncoder().encode(secretKey),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=new Uint8Array(await crypto.subtle.sign("HMAC",hmacKey,new TextEncoder().encode("RONA_RADIO_STAGE2A_AUTH_V1:"+runId+":"+identitySelector)));
  const password="Qa2!"+Array.from(digest).map(x=>x.toString(16).padStart(2,"0")).join("");

  const existing=await radioStage2ASignIn(email,password,publicKey);
  if(existing.session){
    const authId=String(existing.session?.user?.id||"");
    if(!UUID_RE.test(authId))throw Object.assign(new Error("QA_EXISTING_SESSION_USER_INVALID"),{status:503});
    return {authId,session:existing.session};
  }

  let createStatus=503,createdId="";
  try{
    const createdResp=await fetch(SUPA_URL+"/auth/v1/admin/users",{
      method:"POST",
      headers:{authorization:"Bearer "+secretKey,apikey:secretKey,"content-type":"application/json"},
      body:JSON.stringify({email,password,email_confirm:true,user_metadata:Object.assign({
        rona_portal_login:login,
        rona_portal_display_name:displayName
      },metadata||{})}),
      signal:AbortSignal.timeout(30000)
    });
    createStatus=createdResp.status;
    const created=await createdResp.json().catch(()=>null);
    createdId=String(created?.id||created?.user?.id||"");
    if(!createdResp.ok&&!([409,422,429,500,502,503,504].includes(createdResp.status))){
      throw Object.assign(new Error("QA_AUTH_USER_CREATE_FAILED_"+createdResp.status),{status:createdResp.status});
    }
  }catch(error){
    if(Number(error?.status)>=400&&Number(error?.status)<500)throw error;
  }

  let signed=await radioStage2ASignIn(email,password,publicKey);
  if(signed.session){
    const authId=String(signed.session?.user?.id||createdId||"");
    if(!UUID_RE.test(authId))throw Object.assign(new Error("QA_SESSION_USER_INVALID"),{status:503});
    return {authId,session:signed.session};
  }

  // Auth user creation may commit after the admin/users request times out under DB pressure.
  // Do not amplify that write with immediate outer retries. Recover the deterministic account
  // by polling password sign-in only; authorization is still provisioned separately by the
  // OIDC-validated portal RPC after a valid Auth session exists.
  for(let recoveryAttempt=0;recoveryAttempt<8;recoveryAttempt++){
    await new Promise(resolve=>setTimeout(resolve,Math.min(3000*(recoveryAttempt+1),12000)));
    signed=await radioStage2ASignIn(email,password,publicKey);
    if(signed.session){
      const authId=String(signed.session?.user?.id||createdId||"");
      if(!UUID_RE.test(authId))throw Object.assign(new Error("QA_SESSION_USER_INVALID"),{status:503});
      return {authId,session:signed.session};
    }
    if(!signed.transient&&![400,401,404].includes(Number(signed.status||0)))break;
  }

  throw Object.assign(new Error("QA_STAGE2A_AUTH_NOT_READY"),{status:signed.status===429||createStatus===429?429:503});
}

async function radioStage2ARetireDirect(portalId,authId,reason){
  if(!UUID_RE.test(String(portalId||"")))return;
  const db=requireQaSql(),ts=nowIso();
  await db.begin(async sql=>{
    await sql`update portal_private.client_user_deal_grants set status='REVOKED',revoked_at=${ts}::timestamptz,reason=${reason},updated_at=${ts}::timestamptz where user_id=${portalId}::uuid and status='ACTIVE'`;
    await sql`update portal_private.client_user_bindings set status='REVOKED',revoked_at=${ts}::timestamptz,reason=${reason},updated_at=${ts}::timestamptz where user_id=${portalId}::uuid and status='ACTIVE'`;
    await sql`update portal_private.agent_user_bindings set status='REVOKED',valid_to=${ts}::timestamptz,revoked_at=${ts}::timestamptz,reason=${reason},updated_at=${ts}::timestamptz where user_id=${portalId}::uuid and status='ACTIVE'`;
    await sql`update portal_private.portal_user_roles set status='REVOKED',revoked_at=${ts}::timestamptz,reason=${reason},updated_at=${ts}::timestamptz where user_id=${portalId}::uuid and status='ACTIVE'`;
    await sql`update portal_private.staff_user_roles set status='REVOKED',revoked_at=${ts}::timestamptz,reason=${reason},updated_at=${ts}::timestamptz where user_id=${portalId}::uuid and status='ACTIVE'`;
    await sql`update portal_private.portal_users set login_name=case when login_name like 'qa_radio_stage2a_%' and login_name not like '%__archived_%' then login_name||'__archived_'||left(replace(id::text,'-',''),12) else login_name end,status='REVOKED',lifecycle_state='ARCHIVED',revoked_at=${ts}::timestamptz,suspended_at=null,auth_user_id=null,updated_at=${ts}::timestamptz where id=${portalId}::uuid and source_system=${RADIO_STAGE2A_SOURCE} and status='ACTIVE'`;
  });
  await deleteAuthUser(authId);
}

async function issueLegacy(claims){
  const runId=String(claims.run_id||"");
  if(!/^\d{5,20}$/.test(runId)) throw Object.assign(new Error("OIDC_RUN_ID_INVALID"),{status:403});
  await cleanupByRun(LEGACY_SOURCE,runId,"");
  const nonce=crypto.randomUUID().replaceAll("-","").slice(0,12);
  const login="qa_pr462_"+runId+"_"+nonce;
  const email="qa-pr462-"+runId+"-"+nonce+"@example.invalid";
  const auth=await createAuth(login,email,"RONA PR462 GitHub OIDC QA Admin",{rona_qa_head:String(claims.sha)});
  const portalId=crypto.randomUUID();
  const ts=nowIso();
  try{
    const u=await pvt("portal_users").insert({
      id:portalId,auth_user_id:auth.authId,login_name:login,display_name:"RONA PR462 GitHub OIDC QA Admin",
      status:"ACTIVE",source_system:LEGACY_SOURCE,source_version:"RUN_"+runId,source_timestamp:ts,
      authority_state:"CONFIRMED",lifecycle_state:"ACTIVE",auth_linked_at:ts,activated_at:ts,
      last_auth_verified_at:ts,must_change_password:false,password_changed_at:ts
    });
    if(u.error) throw u.error;
    const r=await pvt("portal_user_roles").insert({
      user_id:portalId,role:"ADMIN",status:"ACTIVE",granted_by:null,reason:"Temporary PR462 GitHub OIDC QA",
      granted_at:ts,created_at:ts,updated_at:ts
    });
    if(r.error) throw r.error;
    return {portal_id:portalId,auth_user_id:auth.authId,session:auth.session};
  }catch(error){
    await retireUser(portalId,auth.authId,LEGACY_SOURCE,"PR462 failed issuance cleanup").catch(()=>{});
    throw error;
  }
}

async function issue430(claims,sourcePortalId){
  const runId=String(claims.run_id);
  if(!UUID_RE.test(sourcePortalId)||!ISSUE430_ALLOWED_USERS.has(sourcePortalId))
    throw Object.assign(new Error("PORTAL_USER_NOT_AUTHORIZED_FOR_QA"),{status:403});

  const source=await pvt("portal_users").select("id,display_name,status,authority_state,lifecycle_state").eq("id",sourcePortalId).maybeSingle();
  if(source.error) throw source.error;
  if(!source.data||source.data.status!=="ACTIVE"||source.data.authority_state!=="CONFIRMED"||source.data.lifecycle_state!=="ACTIVE")
    throw Object.assign(new Error("SOURCE_PORTAL_USER_NOT_ACTIVE"),{status:409});

  const role=await pvt("portal_user_roles").select("id").eq("user_id",sourcePortalId).eq("role","CLIENT").eq("status","ACTIVE").limit(1);
  if(role.error) throw role.error;
  if(!(role.data||[]).length) throw Object.assign(new Error("SOURCE_CLIENT_ROLE_MISSING"),{status:409});

  await cleanupByRun(ISSUE430_SOURCE,runId,sourcePortalId);

  const nonce=crypto.randomUUID().replaceAll("-","").slice(0,12);
  const login="qa_issue430_"+runId+"_"+nonce;
  const email="qa-issue430-"+runId+"-"+nonce+"@example.invalid";
  const auth=await createAuth(login,email,"RONA Issue430 GitHub OIDC QA Client",{
    rona_qa_head:String(claims.sha),
    rona_qa_source_portal_user:sourcePortalId
  });
  const portalId=crypto.randomUUID();
  const sourceVersion="RUN_"+runId+"_SRC_"+sourcePortalId;
  const ts=nowIso();

  try{
    const u=await pvt("portal_users").insert({
      id:portalId,auth_user_id:auth.authId,login_name:login,
      display_name:"RONA Issue430 QA · "+String(source.data.display_name||"Client"),
      status:"ACTIVE",source_system:ISSUE430_SOURCE,source_version:sourceVersion,source_timestamp:ts,
      authority_state:"CONFIRMED",lifecycle_state:"ACTIVE",auth_linked_at:ts,activated_at:ts,
      last_auth_verified_at:ts,must_change_password:false,password_changed_at:ts
    });
    if(u.error) throw u.error;

    const rr=await pvt("portal_user_roles").insert({
      user_id:portalId,role:"CLIENT",status:"ACTIVE",granted_by:null,reason:"Temporary Issue430 GitHub OIDC QA",
      granted_at:ts,created_at:ts,updated_at:ts
    });
    if(rr.error) throw rr.error;

    const bindings=await pvt("client_user_bindings").select("*").eq("user_id",sourcePortalId).eq("status","ACTIVE").eq("authority_state","CONFIRMED").eq("lifecycle_state","ACTIVE");
    if(bindings.error) throw bindings.error;
    const activeBindings=(bindings.data||[]).filter(row=>!row.valid_to || new Date(row.valid_to).getTime()>Date.now());
    if(!activeBindings.length) throw new Error("ISSUE430_SOURCE_BINDINGS_MISSING");

    for(const b of activeBindings){
      const newBindingId=crypto.randomUUID();
      const bi=await pvt("client_user_bindings").insert({
        id:newBindingId,user_id:portalId,client_key:b.client_key,contract_key:b.contract_key,status:"ACTIVE",
        valid_from:ts,valid_to:null,granted_by:null,granted_at:ts,revoked_at:null,revoked_by:null,
        reason:"Temporary Issue430 GitHub OIDC QA binding",created_at:ts,updated_at:ts,
        source_system:ISSUE430_SOURCE,source_version:sourceVersion,source_timestamp:ts,import_batch_id:null,
        authority_state:"CONFIRMED",lifecycle_state:"ACTIVE",deal_scope_mode:b.deal_scope_mode
      });
      if(bi.error) throw bi.error;

      const grants=await pvt("client_user_deal_grants").select("*").eq("binding_id",b.id).eq("user_id",sourcePortalId).eq("status","ACTIVE").eq("authority_state","CONFIRMED").eq("lifecycle_state","ACTIVE");
      if(grants.error) throw grants.error;
      for(const g of (grants.data||[]).filter(row=>!row.valid_to || new Date(row.valid_to).getTime()>Date.now())){
        const gi=await pvt("client_user_deal_grants").insert({
          id:crypto.randomUUID(),binding_id:newBindingId,user_id:portalId,client_key:g.client_key,
          contract_key:g.contract_key,deal_key:g.deal_key,status:"ACTIVE",valid_from:ts,valid_to:null,
          granted_by:null,granted_at:ts,revoked_at:null,revoked_by:null,
          reason:"Temporary Issue430 GitHub OIDC QA deal grant",created_at:ts,updated_at:ts,
          source_system:ISSUE430_SOURCE,source_version:sourceVersion,source_timestamp:ts,import_batch_id:null,
          authority_state:"CONFIRMED",lifecycle_state:"ACTIVE"
        });
        if(gi.error) throw gi.error;
      }
    }

    return {
      portal_id:portalId,
      auth_user_id:auth.authId,
      session_id:auth.authId,
      access_token:auth.session.access_token,
      refresh_token:auth.session.refresh_token||null
    };
  }catch(error){
    await retireUser(portalId,auth.authId,ISSUE430_SOURCE,"Issue430 failed issuance cleanup").catch(()=>{});
    throw error;
  }
}


async function issueRadioStage2A(claims,identitySelector){
  const runId=String(claims.run_id);
  if(!UUID_RE.test(identitySelector)||!RADIO_STAGE2A_ALLOWED_USERS.has(identitySelector))
    throw Object.assign(new Error("PORTAL_USER_NOT_AUTHORIZED_FOR_QA"),{status:403});

  const role=identitySelector==="a2a0b91e-4c2a-4d3e-8f11-2a2a00000001"?"ADMIN":
    (identitySelector==="a2a0b91e-4c2a-4d3e-8f11-2a2a00000005"||identitySelector==="a2a0b91e-4c2a-4d3e-8f11-2a2a00000006")?"AGENT":"CLIENT";
  const selectorKey=identitySelector.replaceAll("-","");
  const login="qa_radio_stage2a_"+runId+"_"+selectorKey;
  const auth=await createRadioStage2AAuth(runId,identitySelector,login,"RONA Radio Stage2A QA · "+role,{
    rona_qa_head:String(claims.sha),
    rona_qa_identity_selector:identitySelector,
    rona_qa_scope:"RADIO_STAGE2A"
  });
  const portalId=crypto.randomUUID();

  try{
    const db=requireQaSql();
    const provisionRows=await db`select portal_private.radio_stage2a_provision_identity_v1(${portalId}::uuid,${auth.authId}::uuid,${identitySelector}::uuid,${runId},${login}) as data`;
    const provision=provisionRows?.[0]?.data||null;
    if(!provision||String(provision.portal_id||"")!==portalId||String(provision.role||"")!==role)
      throw new Error("RADIO_STAGE2A_PROVISION_RESULT_INVALID");

    return {
      portal_id:portalId,
      auth_user_id:auth.authId,
      session_id:auth.authId,
      access_token:auth.session.access_token,
      refresh_token:auth.session.refresh_token||null,
      role
    };
  }catch(error){
    await radioStage2ARetireDirect(portalId,auth.authId,"Radio Stage2A failed issuance cleanup").catch(()=>{});
    throw error;
  }
}

async function cleanupRadioStage2AAll(){
  const db=requireQaSql();
  const rows=await db`select id::text,auth_user_id::text from portal_private.portal_users where source_system=${RADIO_STAGE2A_SOURCE} and status='ACTIVE'`;
  for(const row of rows||[])await radioStage2ARetireDirect(String(row.id),String(row.auth_user_id||""),"Radio Stage2A GitHub OIDC QA preflight cleanup");
  // Re-runs of the same GitHub run_id intentionally reuse the deterministic QA login.
  // Archived QA rows preserve audit history but must not keep that unique login reserved.
  await db`update portal_private.portal_users
    set login_name=login_name||'__archived_'||left(replace(id::text,'-',''),12),updated_at=clock_timestamp()
    where source_system=${RADIO_STAGE2A_SOURCE}
      and status='REVOKED'
      and lifecycle_state='ARCHIVED'
      and login_name like 'qa_radio_stage2a_%'
      and login_name not like '%__archived_%'`;
  return (rows||[]).length;
}

async function radioStage2AOperationalDirectory(){
  const db=requireQaSql();
  const rows=await db`select portal_private.radio_stage2a_operational_directory_v1() as data`;
  const data=rows?.[0]?.data||null;
  if(!data||typeof data!=="object") throw new Error("RADIO_STAGE2A_DIRECTORY_RPC_INVALID");
  return data;
}
async function revokeRadioStage2A(claims,body){
  const authId=String(body?.authUserId||"");
  if(!UUID_RE.test(authId)) throw Object.assign(new Error("AUTH_USER_ID_INVALID"),{status:400});
  const runId=String(claims.run_id),db=requireQaSql();
  const rows=await db`select id::text,auth_user_id::text,source_version from portal_private.portal_users where auth_user_id=${authId}::uuid and source_system=${RADIO_STAGE2A_SOURCE} and status='ACTIVE' and source_version like ${"RUN_"+runId+"%"} limit 1`;
  if((rows||[]).length)await radioStage2ARetireDirect(String(rows[0].id),authId,"Radio Stage2A GitHub OIDC QA revoke");
  let absent=false;
  for(let attempt=0;attempt<12;attempt++){
    const check=await service.auth.admin.getUserById(authId);
    if(check.error&&String(check.error?.status||"")!=="404"){
      await new Promise(r=>setTimeout(r,500));
      continue;
    }
    absent=Boolean(check.error)||!check.data?.user;
    if(absent)break;
    await new Promise(r=>setTimeout(r,500));
  }
  return {revoked:true,session_absent:absent};
}

async function revoke430(claims,body){
  const authId=String(body?.authUserId||"");
  if(!UUID_RE.test(authId)) throw Object.assign(new Error("AUTH_USER_ID_INVALID"),{status:400});
  const runId=String(claims.run_id);
  const rows=await pvt("portal_users").select("id,auth_user_id,source_version")
    .eq("auth_user_id",authId).eq("source_system",ISSUE430_SOURCE).eq("status","ACTIVE")
    .like("source_version","RUN_"+runId+"%").limit(1);
  if(rows.error) throw rows.error;
  if((rows.data||[]).length) await retireUser(String(rows.data[0].id),authId,ISSUE430_SOURCE,"Issue430 GitHub OIDC QA revoke");
  let absent=false;
  for(let attempt=0;attempt<12;attempt++){
    const check=await service.auth.admin.getUserById(authId);
    absent=Boolean(check.error)||!check.data?.user;
    if(absent)break;
    await new Promise(r=>setTimeout(r,100));
  }
  return {revoked:true,session_absent:absent};
}

Deno.serve(async req=>{
  if(req.method!=="POST") return json(405,{ok:false,code:"METHOD_NOT_ALLOWED"});
  try{
    const verified=await verifyGithubOidc(bearer(req));
    const claims=verified.claims;
    const path=new URL(req.url).pathname;
    const body=await req.json().catch(()=>({}));

    if(verified.profile==="LEGACY"){
      if(path.endsWith("/cleanup")){
        const retired=await cleanupByRun(LEGACY_SOURCE,String(claims.run_id||""),"");
        return json(200,{ok:true,mode:"GITHUB_OIDC_PR462",retired});
      }
      if(!path.endsWith("rona-g82-github-oidc-browser-qa-20260816")&&!path.endsWith("/"))
        return json(404,{ok:false,code:"NOT_FOUND"});
      if(body?.expectedHead&&String(body.expectedHead)!==String(claims.sha))
        return json(409,{ok:false,code:"EXACT_HEAD_MISMATCH"});
      const origin=String(body?.origin||"");
      if(origin&&!/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i.test(origin))
        return json(400,{ok:false,code:"IMMUTABLE_PREVIEW_ORIGIN_REQUIRED"});
      const issued=await issueLegacy(claims);
      return json(200,{ok:true,mode:"GITHUB_OIDC_PR462",...issued,head:String(claims.sha),run_id:String(claims.run_id||"")});
    }

    if(verified.profile==="ISSUE430"){
      if(path.endsWith("/issue")){
        const issued=await issue430(claims,String(body?.portalUserId||""));
        return json(200,{ok:true,mode:"GITHUB_OIDC_ISSUE430",...issued,head:String(claims.sha),run_id:String(claims.run_id)});
      }
      if(path.endsWith("/revoke")){
        const revoked=await revoke430(claims,body);
        return json(200,{ok:true,mode:"GITHUB_OIDC_ISSUE430",...revoked});
      }
      return json(404,{ok:false,code:"NOT_FOUND"});
    }

    if(verified.profile==="RADIO_STAGE2A"){
      if(path.endsWith("/cleanup")){
        const retired=await cleanupRadioStage2AAll();
        return json(200,{ok:true,mode:"GITHUB_OIDC_RADIO_STAGE2A",retired,head:String(claims.sha),run_id:String(claims.run_id)});
      }
      if(path.endsWith("/directory")){
        const directory=await radioStage2AOperationalDirectory();
        return json(200,{ok:true,mode:"GITHUB_OIDC_RADIO_STAGE2A",directory,head:String(claims.sha),run_id:String(claims.run_id)});
      }
      if(path.endsWith("/issue")){
        const issued=await issueRadioStage2A(claims,String(body?.portalUserId||""));
        return json(200,{ok:true,mode:"GITHUB_OIDC_RADIO_STAGE2A",...issued,head:String(claims.sha),run_id:String(claims.run_id)});
      }
      if(path.endsWith("/revoke")){
        const revoked=await revokeRadioStage2A(claims,body);
        return json(200,{ok:true,mode:"GITHUB_OIDC_RADIO_STAGE2A",...revoked});
      }
      return json(404,{ok:false,code:"NOT_FOUND"});
    }

    return json(403,{ok:false,code:"OIDC_PROFILE_DENIED"});
  }catch(error){
    console.error("github oidc browser qa",error);
    const status=Number(error?.status||500);
    return json(status>=400&&status<600?status:500,{ok:false,code:String(error?.message||"OIDC_QA_ERROR")});
  }
});