import { chromium } from 'playwright';

const ORIGIN=String(process.env.TARGET_ORIGIN||'').replace(/\/$/,'');
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-issue430-owner-uat-browser-v2';
const C005_USER='724ff368-5ba3-449a-bd19-665ee487ee6f';
const C005={client_id:'RONA-C005',contract_id:'RONA-C005-CTR-2026-001'};
const DIRECTORY_SOURCE='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function oidc(){const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;if(!base||!token)throw new Error('GITHUB_OIDC_ENV_MISSING');const r=await fetch(base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE),{headers:{authorization:`Bearer ${token}`}});const j=await r.json();if(!r.ok||!j?.value)throw new Error(`OIDC_${r.status}`);return j.value}
async function call(path,body){const jwt=await oidc();const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>null);if(!r.ok||!j?.ok)throw new Error(`ISSUER_${path}_${r.status}_${j?.code||'UNKNOWN'}`);return j}
const session=await call('/issue',{portalUserId:C005_USER});
const browser=await chromium.launch({headless:true});let context;
try{
  context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addCookies([{name:'rona_portal_at',value:session.access_token,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  const runtimeErrors=[];
  page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning'){const text=msg.text().slice(0,800);runtimeErrors.push({kind:msg.type(),text});console.log(`ISSUE430_DELAYED_BROWSER_CONSOLE_${msg.type().toUpperCase()}=${text}`)}});
  page.on('pageerror',error=>{const text=String(error?.message||error).slice(0,800);runtimeErrors.push({kind:'pageerror',text});console.log(`ISSUE430_DELAYED_PAGEERROR=${text}`)});
  page.on('response',res=>{const u=res.url();if(u.includes('/portal/api/v1/client/bootstrap')||u.includes('/portal/api/v1/client/context'))console.log(`ISSUE430_DELAYED_BROWSER_RESPONSE=${res.status()} ${u}`)});
  await page.addInitScript(()=>{
    window.__issue430DirectoryEvents=[];
    window.__issue430CardTimeline=[];
    window.__issue430NodeIds=new WeakMap();
    window.__issue430NodeSeq=0;
    const nodeId=node=>{if(!node)return null;if(!window.__issue430NodeIds.has(node))window.__issue430NodeIds.set(node,++window.__issue430NodeSeq);return window.__issue430NodeIds.get(node)};
    const snap=label=>{
      const root=document.documentElement,api=window.RONA_CLIENT_CONTEXT,grid=document.getElementById('clientCompanyGrid');
      const cards=[...(grid?.querySelectorAll('article.company-switch-card')||[])].map(c=>({nodeId:nodeId(c),isConnected:c.isConnected,client_id:c.dataset.ronaClientId||null,contract_id:c.dataset.ronaClientContractId||null,hydration:c.dataset.ronaCompanyDirectoryHydration||null,current:c.dataset.ronaCompanyCurrent||null,businessOwner:c.dataset.ronaCompanyBusinessOwner||null,authorizationScope:c.dataset.ronaCompanyAuthorizationScope||null,applications:c.querySelector('[data-rona-company-factory-slot="applications"]')?.textContent?.trim()||null,deals:c.querySelector('[data-rona-company-factory-slot="deals"]')?.textContent?.trim()||null,documents:c.querySelector('[data-rona-company-factory-slot="documents"]')?.textContent?.trim()||null}));
      const entry={at:Date.now(),label,root:{authority:root?.dataset?.ronaClientCompanyDirectoryAuthority||null,atomic:root?.dataset?.ronaClientCompanyDirectoryAtomic||null,source:root?.dataset?.ronaClientCompanyDirectorySource||null,factory:root?.dataset?.ronaClientCompanyDirectoryFactory||null,generation:root?.dataset?.ronaClientCompanyDirectoryGeneration||null,materialization:root?.dataset?.ronaClientCompanyDirectoryMaterialization||null},directory:api?.getCompanyDirectory?.()||[],directorySnapshot:api?.getCompanyDirectorySnapshot?.()||null,current:api?.getCurrentContext?.()||null,cards};
      window.__issue430CardTimeline.push(entry);if(window.__issue430CardTimeline.length>160)window.__issue430CardTimeline.shift();return entry;
    };
    window.__issue430Snap=snap;
    addEventListener('rona:client-authorized-directory',event=>{window.__issue430DirectoryEvents.push({at:Date.now(),detail:event.detail||null});snap('authorized-directory-event-sync');queueMicrotask(()=>snap('authorized-directory-event-microtask'));requestAnimationFrame(()=>snap('authorized-directory-event-raf'))});
    addEventListener('rona:client-company-directory-ready',event=>{window.__issue430DirectoryEvents.push({at:Date.now(),ready:event.detail||null});snap('company-directory-ready-event')});
    addEventListener('DOMContentLoaded',()=>{snap('dom-content-loaded');const observer=new MutationObserver(()=>snap('mutation'));observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['data-rona-company-directory-hydration','data-rona-client-company-directory-atomic','data-rona-client-company-directory-generation','data-rona-company-current']})},{once:true});
  });
  let delayedBootstrap=true,delayedContext=true;
  await page.route('**/portal/api/v1/client/bootstrap**',async route=>{if(delayedBootstrap){delayedBootstrap=false;await sleep(900)}await route.continue()});
  await page.route('**/portal/api/v1/client/context**',async route=>{if(delayedContext){delayedContext=false;await sleep(700)}await route.continue()});
  await page.goto(ORIGIN+'/portal/client?_qa_company_delayed_diag='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
  const nav=page.locator('#nav button[data-page="companies"]');await nav.waitFor({state:'visible',timeout:15000});await nav.click();
  await page.waitForFunction(()=>{const n=document.getElementById('clientCompanyGrid');if(!n)return false;const s=getComputedStyle(n),r=n.getBoundingClientRect();return !n.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0},null,{timeout:10000});
  await page.waitForFunction(()=>Boolean(document.querySelector('#clientCompanyGrid article.company-switch-card[data-rona-company-directory-hydration="loading"],#clientCompanyGrid article.company-switch-card[data-rona-company-directory-hydration="error"]')),null,{timeout:15000});
  const before=await page.evaluate(()=>window.__issue430Snap?.('before-public-refresh'));
  const refresh=await page.evaluate(async({source})=>{const api=window.RONA_CLIENT_CONTEXT;if(!api?.refreshCompanyDirectory)throw new Error('CANONICAL_COMPANY_DIRECTORY_REFRESH_API_MISSING');const payload=await api.refreshCompanyDirectory(source);const row=payload?.data?.company_directory?.[0]||null;return{source:payload?.data?.company_directory_source||null,count:Array.isArray(payload?.data?.company_directory)?payload.data.company_directory.length:null,row:row?{client_id:row.client_id,contract_id:row.contract_id,applications_total:row.applications_total,deals_total:row.deals_total,documents_total:row.documents_total}:null}}, {source:'issue430-owner-browser-delayed-recovery'});
  if(refresh.source!==DIRECTORY_SOURCE||refresh.count!==1)throw new Error(`DELAYED_DIAGNOSTIC_REFRESH_INVALID:${JSON.stringify(refresh)}`);
  const afterRefresh=await page.evaluate(()=>window.__issue430Snap?.('after-public-refresh-resolved'));
  let ready=false;
  const started=Date.now();
  while(Date.now()-started<30000){
    ready=await page.evaluate(target=>[...document.querySelectorAll('#clientCompanyGrid article.company-switch-card')].some(c=>c.dataset.ronaClientId===target.client_id&&c.dataset.ronaClientContractId===target.contract_id&&c.dataset.ronaCompanyDirectoryHydration==='ready'),C005);
    if(ready)break;
    await sleep(100);
  }
  const final=await page.evaluate(()=>window.__issue430Snap?.('delayed-final'));
  const extra=await page.evaluate(()=>({events:window.__issue430DirectoryEvents||[],timeline:window.__issue430CardTimeline||[],callers:window.RONA_CLIENT_CONTEXT?.getCallerMap?.()||[],companyState:window.__RONA_CLIENT_COMPANY_DIRECTORY_STATE__||null}));
  const diag={target:C005,refresh,ready,before,afterRefresh,final,events:extra.events,timeline:extra.timeline,callers:extra.callers,runtimeErrors,companyState:extra.companyState};
  console.log(`ISSUE430_DELAYED_RECOVERY_DIAGNOSTIC=${JSON.stringify(diag)}`);
  console.log(`ISSUE430_DELAYED_RECOVERY_READY=${ready?'PASS':'FAIL'}`);
}finally{
  if(context)await context.close().catch(()=>{});await browser.close().catch(()=>{});
  const revoked=await call('/revoke',{accessToken:session.access_token,sessionId:session.session_id,authUserId:session.auth_user_id});
  console.log(`ISSUE430_DIAGNOSTIC_SESSION_REVOKED=${revoked.revoked===true&&revoked.session_absent===true?'PASS':'FAIL'}`);
}