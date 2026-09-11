import { chromium } from 'playwright';

const ORIGIN=String(process.env.TARGET_ORIGIN||'').replace(/\/$/,'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-issue430-owner-uat-browser-v2';
const C005_USER='724ff368-5ba3-449a-bd19-665ee487ee6f';
const C005={client_id:'RONA-C005',contract_id:'RONA-C005-CTR-2026-001'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function oidc(){const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');const r=await fetch(base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE),{headers:{authorization:`Bearer ${token}`}});const j=await r.json();if(!r.ok||!j?.value)throw new Error(`OIDC_${r.status}`);return j.value}
async function call(path,body){const jwt=await oidc();const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>null);if(!r.ok||!j?.ok)throw new Error(`ISSUER_${path}_${r.status}_${j?.code||'UNKNOWN'}`);return j}
const session=await call('/issue',{portalUserId:C005_USER});
const browser=await chromium.launch({headless:true});let context;
try{
  context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:session.access_token,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')console.log(`ISSUE430_BROWSER_CONSOLE_${msg.type().toUpperCase()}=${msg.text()}`)});
  page.on('response',res=>{const u=res.url();if(u.includes('/portal/api/v1/client/bootstrap')||u.includes('/portal/api/v1/client/context'))console.log(`ISSUE430_BROWSER_RESPONSE=${res.status()} ${u}`)});
  await page.goto(ORIGIN+'/portal/client?_qa_company_diag='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
  const nav=page.locator('#nav button[data-page="companies"]');await nav.waitFor({state:'visible',timeout:15000});await nav.click();
  await sleep(12000);
  const diag=await page.evaluate(async target=>{
    const root=document.documentElement,api=window.RONA_CLIENT_CONTEXT;
    const cardData=()=>[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].map(c=>({client_id:c.dataset.ronaClientId||null,contract_id:c.dataset.ronaClientContractId||null,hydration:c.dataset.ronaCompanyDirectoryHydration||null,current:c.dataset.ronaCompanyCurrent||null,businessOwner:c.dataset.ronaCompanyBusinessOwner||null,applications:c.querySelector('[data-rona-company-factory-slot="applications"]')?.textContent?.trim()||null,deals:c.querySelector('[data-rona-company-factory-slot="deals"]')?.textContent?.trim()||null,documents:c.querySelector('[data-rona-company-factory-slot="documents"]')?.textContent?.trim()||null}));
    const snapshot=()=>({root:{authority:root.dataset.ronaClientCompanyDirectoryAuthority||null,atomic:root.dataset.ronaClientCompanyDirectoryAtomic||null,source:root.dataset.ronaClientCompanyDirectorySource||null,factory:root.dataset.ronaClientCompanyDirectoryFactory||null},current:api?.getCurrentContext?.()||null,authorized:api?.getAuthorizedContexts?.()||[],directory:api?.getCompanyDirectory?.()||[],directorySnapshot:api?.getCompanyDirectorySnapshot?.()||null,callers:api?.getCallerMap?.()||[],cards:cardData()});
    const before=snapshot();
    const direct=await fetch('/portal/api/v1/client/bootstrap?_diag='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:{accept:'application/json','x-rona-client-source':'issue430-company-live-diagnostic'}}).then(async r=>({status:r.status,body:await r.json().catch(()=>null)})).catch(e=>({error:String(e?.message||e)}));
    let refresh=null;try{refresh=await api?.refreshCompanyDirectory?.('issue430-live-diagnostic')}catch(e){refresh={error:String(e?.message||e)}}
    await new Promise(r=>setTimeout(r,1000));
    return{target,before,direct:{status:direct?.status,error:direct?.error||null,ok:direct?.body?.ok??null,code:direct?.body?.code||null,contexts:direct?.body?.data?.contexts||null,company_directory_source:direct?.body?.data?.company_directory_source||null,company_directory:direct?.body?.data?.company_directory||null},refresh,after:snapshot()};
  },C005);
  console.log(`ISSUE430_COMPANY_LIVE_DIAGNOSTIC=${JSON.stringify(diag)}`);
}finally{
  if(context)await context.close().catch(()=>{});await browser.close().catch(()=>{});
  const revoked=await call('/revoke',{accessToken:session.access_token,sessionId:session.session_id,authUserId:session.auth_user_id});
  console.log(`ISSUE430_DIAGNOSTIC_SESSION_REVOKED=${revoked.revoked===true&&revoked.session_absent===true?'PASS':'FAIL'}`);
}
