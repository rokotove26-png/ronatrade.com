import { chromium } from 'playwright';

const ORIGIN='https://ronaoil.com';
const ISSUER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-g82-github-oidc-browser-qa-20260816';
const AUDIENCE='rona-pr462-live-preview';

async function oidc(){
  const base=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!base||!token)throw new Error('OIDC_ENV_MISSING');
  const r=await fetch(base+(base.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUDIENCE),{headers:{authorization:`Bearer ${token}`}});
  const j=await r.json(); if(!r.ok||!j?.value)throw new Error('OIDC_FAILED'); return j.value;
}
async function broker(path,body={}){
  const jwt=await oidc();
  const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${jwt}`,'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null); if(!r.ok||!j?.ok)throw new Error(`BROKER_${r.status}_${j?.code||'UNKNOWN'}`); return j;
}
let issued,browser;
try{
  issued=await broker('',{expectedHead:String(process.env.GITHUB_SHA||'')});
  browser=await chromium.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
  await ctx.addCookies([{name:'rona_portal_at',value:issued.session.access_token,url:ORIGIN+'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await ctx.newPage();
  await page.goto(ORIGIN+'/portal/admin?_native_diag='+Date.now(),{waitUntil:'domcontentloaded',timeout:45000});
  const nav=page.locator('button[data-page="payments"]').first(); await nav.waitFor({state:'visible',timeout:60000}); await nav.click();
  await page.waitForTimeout(3500);
  const diag=await page.evaluate(async()=>{
    const snap=window.__RONA_OWNER_AI_SYNC_SNAPSHOT__||null;
    const sp=snap?.paymentsV7Projection||null;
    let direct={};
    try{
      const r=await fetch('/portal/owner-api?path=/admin/ai-sync&_diag='+Date.now(),{cache:'no-store',headers:{'cache-control':'no-store'}});
      const j=await r.json().catch(()=>null);
      const data=j?.data||null;
      const candidates=[j?.paymentsV7Projection,data?.paymentsV7Projection,data?.data?.paymentsV7Projection,j?.result?.paymentsV7Projection].filter(Boolean);
      const p=candidates[0]||null;
      const f=data?.financeFragment||j?.financeFragment||null;
      const outs=Array.isArray(f?.outgoingPayments)?f.outgoingPayments:[];
      direct={status:r.status,headers:{sem:r.headers.get('x-rona-owner-payments-semantics'),native:r.headers.get('x-rona-payments-native-spend')},topKeys:j&&typeof j==='object'?Object.keys(j):[],dataKeys:data&&typeof data==='object'?Object.keys(data):[],contract:p?.contract||null,nativeSummary:p?.actual_spend_native_summary||null,financeKeys:f&&typeof f==='object'?Object.keys(f):[],outgoingCount:outs.length,outgoingPayments:outs};
    }catch(e){direct={error:String(e)}}
    return {snapshot:{topKeys:snap&&typeof snap==='object'?Object.keys(snap):[],contract:sp?.contract||null,nativeSummary:sp?.actual_spend_native_summary||null},direct};
  });
  console.log('NATIVE_SPEND_DIAGNOSTIC='+JSON.stringify(diag));
  await ctx.close();
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(issued)await broker('/cleanup',{expectedHead:String(process.env.GITHUB_SHA||'')}).catch(()=>{});
}
