import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN='https://ronaoil.com';
const SUPABASE='https://sxawrwzeobaqwwmlkzws.supabase.co';
const PORTAL_API=`${SUPABASE}/functions/v1/rona-portal-api`;
const ISSUER=`${SUPABASE}/functions/v1/rona-g82-github-oidc-browser-qa-20260816`;
const AUD='rona-pr462-live-preview';
const OUT='artifacts/issue557-oidc-e2e';
const exp={
  d11:{received:225900,due:0,conditional:527100,spend:35574.47,residual:190325.53},
  d10:{spend:6225.53},
};

await mkdir(OUT,{recursive:true});
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/[\u00a0\u202f\s]+/g,' ').trim();
const compact=v=>norm(v).replace(/\s/g,'').replace(/,/g,'.');
const num=v=>Number(String(v??'').replace(/\s/g,'').replace(',','.'));
const eq=(a,b)=>Math.abs(Number(a)-Number(b))<0.006;
const amount=m=>m?.amount===null||m?.amount===undefined?NaN:num(m.amount);

async function oidc(){
  const b=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  assert(b&&t,'GITHUB_OIDC_ENV_MISSING');
  const r=await fetch(b+(b.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUD),{headers:{authorization:`Bearer ${t}`}}),j=await r.json();
  assert(r.ok&&j.value,`OIDC_HTTP_${r.status}`);
  return j.value;
}
async function issuer(path='/',body={}){
  const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${await oidc()}`,'content-type':'application/json'},body:JSON.stringify(body)}),j=await r.json().catch(()=>null);
  assert(r.ok&&j?.ok,`ISSUER_${path}_${r.status}_${j?.code||'UNKNOWN'}`);
  return j;
}
function findProjection(v,seen=new Set()){
  if(!v||typeof v!=='object'||seen.has(v))return null;
  seen.add(v);
  if(v.contract==='ADMIN_PAYMENTS_V7'&&Array.isArray(v.deals))return v;
  if(v.paymentsV7Projection?.contract==='ADMIN_PAYMENTS_V7')return v.paymentsV7Projection;
  for(const x of Object.values(v)){const p=findProjection(x,seen);if(p)return p}
  return null;
}
function paymentKeyPaths(v,path='$',out=[],seen=new Set()){
  if(!v||typeof v!=='object'||seen.has(v)||out.length>=80)return out;
  seen.add(v);
  for(const [k,x] of Object.entries(v)){
    const p=`${path}.${k}`;
    if(/payment|finance|bootstrap|projection/i.test(k))out.push(p);
    if(x&&typeof x==='object')paymentKeyPaths(x,p,out,seen);
    if(out.length>=80)break;
  }
  return out;
}
function assertMoney(m,want,label){
  assert(m&&String(m.status||'').toUpperCase()==='AUTHORITATIVE',`${label}_NOT_AUTHORITATIVE`);
  assert(eq(amount(m),want),`${label}_${amount(m)}_NE_${want}`);
}
function aggregate(projection,field){
  const out={};
  for(const d of projection.deals||[]){
    const m=d?.[field];
    if(String(m?.status||'').toUpperCase()!=='AUTHORITATIVE'||!m?.currency||!Number.isFinite(amount(m)))continue;
    const c=String(m.currency).toUpperCase();
    out[c]=(out[c]||0)+amount(m);
  }
  for(const c of Object.keys(out))out[c]=Number(out[c].toFixed(6));
  return out;
}
function projectionAggregates(p){
  return {
    received:aggregate(p,'verified_received'),
    due:aggregate(p,'due_now'),
    conditional:aggregate(p,'future_conditional'),
    spend:aggregate(p,'actual_spend'),
    residual:aggregate(p,'remaining_execution'),
  };
}
function responseDiagnostic(r,b){
  const hdr={};
  for(const [k,v] of r.headers.entries())if(/^(x-rona|cf-|server|via|content-type|cache-control)/i.test(k))hdr[k]=v;
  return{status:r.status,url:r.url,headers:hdr,top_level_keys:b&&typeof b==='object'?Object.keys(b):[],data_keys:b?.data&&typeof b.data==='object'?Object.keys(b.data):[],payment_key_paths:paymentKeyPaths(b)};
}
function proveProjection(p){
  assert(p,'PAYMENTS_PROJECTION_MISSING');
  const d11=p.deals.find(d=>d.deal_id==='DEAL-2026-011'),d10=p.deals.find(d=>d.deal_id==='DEAL-2026-010');
  assert(d11&&d10,'TARGET_DEALS_MISSING');
  assertMoney(d11.verified_received,exp.d11.received,'D011_RECEIVED');
  assertMoney(d11.due_now,exp.d11.due,'D011_DUE');
  assertMoney(d11.future_conditional,exp.d11.conditional,'D011_CONDITIONAL');
  assertMoney(d11.actual_spend,exp.d11.spend,'D011_SPEND');
  assertMoney(d11.remaining_execution,exp.d11.residual,'D011_RESIDUAL');
  assertMoney(d10.actual_spend,exp.d10.spend,'D010_SPEND');
  const rec=p.finance_authority_projection_reconciliation||null;
  assert(!rec||!['TO_VERIFY','PARTIAL_TO_VERIFY'].includes(String(rec.status||'').toUpperCase()),`RECON_${rec?.status}`);
  return {
    source_as_of:p.source_as_of||null,
    reconciliation:rec,
    deal011:{
      received:amount(d11.verified_received),
      due:amount(d11.due_now),
      conditional:amount(d11.future_conditional),
      spend:amount(d11.actual_spend),
      residual:amount(d11.remaining_execution),
      statuses:{
        received:d11.verified_received.status,
        due:d11.due_now.status,
        conditional:d11.future_conditional.status,
        spend:d11.actual_spend.status,
        residual:d11.remaining_execution.status,
      },
      financial_status:d11.financial_status||null,
    },
    deal010:{spend:amount(d10.actual_spend),status:d10.actual_spend.status},
    aggregates:projectionAggregates(p),
  };
}
async function fetchJson(url,headers){
  const r=await fetch(url,{headers:{accept:'application/json','cache-control':'no-store',...headers}}),b=await r.json().catch(()=>null);
  return{r,b,diagnostic:responseDiagnostic(r,b)};
}
let apiDiagnostic=null;
async function apiProof(token){
  const logical=await fetchJson(`${PORTAL_API}/v1/admin/bootstrap?_qa=${Date.now()}`,{authorization:`Bearer ${token}`});
  const proxy=await fetchJson(`${ORIGIN}/portal/api/v1/admin/bootstrap?_qa=${Date.now()}`,{cookie:`rona_portal_at=${token}`});
  apiDiagnostic={logical:logical.diagnostic,same_origin_proxy:proxy.diagnostic};
  assert(logical.r.ok,`LOGICAL_BOOTSTRAP_HTTP_${logical.r.status}`);
  assert(proxy.r.ok,`PROXY_BOOTSTRAP_HTTP_${proxy.r.status}`);
  const lp=findProjection(logical.b),pp=findProjection(proxy.b);
  const logicalProof=proveProjection(lp),proxyProof=proveProjection(pp);
  assert(JSON.stringify(logicalProof.deal011)===JSON.stringify(proxyProof.deal011),'LOGICAL_PROXY_D011_MISMATCH');
  assert(JSON.stringify(logicalProof.deal010)===JSON.stringify(proxyProof.deal010),'LOGICAL_PROXY_D010_MISMATCH');
  assert(JSON.stringify(logicalProof.aggregates)===JSON.stringify(proxyProof.aggregates),'LOGICAL_PROXY_AGGREGATE_MISMATCH');
  return{diagnostic:apiDiagnostic,...proxyProof};
}
function forms(v){
  const n=Number(v),variants=[];
  for(const digits of Number.isInteger(n)?[0]:[2,1]){
    const s=n.toFixed(digits),[i,d]=s.split('.'),sp=i.replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    variants.push(s,sp+(d?'.'+d:''),sp+(d?','+d:''));
  }
  return [...new Set(variants.map(compact))];
}
function has(t,v){const c=compact(t);return forms(v).some(x=>c.includes(x))}
function must(t,v,l){assert(has(t,v),`${l}_NOT_VISIBLE_${v}:${norm(t).slice(0,900)}`)}

async function uiProof(token,api){
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1600,height:1200}});
    await ctx.addCookies([{name:'rona_portal_at',value:token,domain:'ronaoil.com',path:'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
    const page=await ctx.newPage(),network=[];
    page.on('response',r=>{
      const u=r.url();
      if(u.includes('/portal/api/')||u.includes('rona-owner-ai-sync')||u.includes('rona-portal-api'))network.push({url:u,status:r.status(),contentType:r.headers()['content-type']||null,paymentsHeader:r.headers()['x-rona-admin-payments-v8-bootstrap']||null});
    });
    await page.goto(`${ORIGIN}/portal/admin?_qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    assert(!page.url().includes('/login'),'AUTH_REDIRECT_TO_LOGIN');
    await page.waitForSelector('#nav button[data-page="payments"]',{state:'visible',timeout:30000});
    await page.locator('#nav button[data-page="payments"]').click();
    let ready=true;
    try{await page.waitForFunction(()=>document.getElementById('page-payments')?.innerText?.includes('DEAL-2026-011'),{timeout:30000})}catch{ready=false}
    await page.waitForTimeout(1000);
    const s=await page.evaluate(()=>{
      const root=document.getElementById('page-payments'),txt=e=>(e?.innerText||'').replace(/\s+/g,' ').trim(),vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'};
      const deal=id=>{const xs=[...(root?.querySelectorAll('tr,article,[data-deal-id],[data-rona-deal-id],.rona-owner-card,div')||[])].filter(e=>vis(e)&&txt(e).includes(id));xs.sort((a,b)=>txt(a).length-txt(b).length);return txt(xs.find(e=>e.tagName==='TR'||e.tagName==='ARTICLE')||xs[0])};
      const cards=root?[...root.querySelectorAll('.rona-fin-kpi-grid .rona-owner-card')].filter(vis).map(txt):[];
      return{url:location.href,body:txt(document.body).slice(0,6000),paymentsText:txt(root).slice(0,14000),deal011:deal('DEAL-2026-011'),deal010:deal('DEAL-2026-010'),cards,boot:window.__RONA_ADMIN_BOOT_STATE__||null,hasAdminData:!!window.adminData,adminDataKeys:window.adminData&&typeof window.adminData==='object'?Object.keys(window.adminData):[],ownerSyncKeys:window.__RONA_OWNER_AI_SYNC_SNAPSHOT__&&typeof window.__RONA_OWNER_AI_SYNC_SNAPSHOT__==='object'?Object.keys(window.__RONA_OWNER_AI_SYNC_SNAPSHOT__):[]};
    });
    await page.screenshot({path:`${OUT}/payments.png`,fullPage:true});
    await ctx.close();
    s.network=network;s.ready=ready;
    assert(ready,'UI_D011_NOT_RENDERED');
    assert(s.deal011&&s.deal010,'UI_DEAL_ROWS_MISSING');
    for(const [k,v] of Object.entries(exp.d11))must(s.deal011,v,`UI_D011_${k}`);
    assert(!/TO_VERIFY|расхожд/i.test(s.deal011),'UI_D011_FAIL_CLOSED_WARNING');
    must(s.deal010,exp.d10.spend,'UI_D010_SPEND');
    const pick=rs=>s.cards.find(t=>rs.some(r=>r.test(t)))||'';
    const cards={received:pick([/получен/i]),due:pick([/ожидается сейчас/i,/к оплате сейчас/i]),conditional:pick([/условн/i]),spend:pick([/потрачен/i,/расход/i]),residual:pick([/остаток/i])};
    for(const [k,w] of Object.entries(api.aggregates)){
      const c=cards[k];assert(c,`UI_${k}_KPI_MISSING`);
      for(const [cur,v] of Object.entries(w)){
        assert(c.toUpperCase().includes(cur),`UI_${k}_${cur}_MISSING`);
        must(c,v,`UI_${k}_${cur}`);
      }
    }
    return{...s,cards,expectedAggregates:api.aggregates};
  }finally{await browser.close()}
}

let issued,e={mode:'READ_ONLY',api_first:true,baseline_release:process.env.BASELINE_RELEASE_SHA||null,live_release:process.env.LIVE_RELEASE_SHA||null,run_id:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA,result:'FAIL'},failure;
try{
  issued=await issuer('/',{expectedHead:process.env.GITHUB_SHA});
  const token=issued?.session?.access_token;assert(token,'SESSION_TOKEN_MISSING');
  try{
    e.api=await apiProof(token);
    e.api_result='PASS';
  }catch(x){
    e.api_result='FAIL';e.api_diagnostic=apiDiagnostic;e.api_failure=String(x?.stack||x).slice(0,3500);e.ui_result='SKIPPED_API_NOT_PASS';throw new Error(`API:${x?.message||x}`);
  }
  try{
    e.ui=await uiProof(token,e.api);e.ui_result='PASS';
  }catch(x){
    e.ui_result='FAIL';e.ui_failure=String(x?.stack||x).slice(0,5000);throw new Error(`UI:${x?.message||x}`);
  }
  e.result='PASS';
}catch(x){failure=x;e.failure=String(x?.stack||x).slice(0,5000)}finally{
  if(issued){try{const c=await issuer('/cleanup',{});e.cleanup={ok:true,retired:c.retired??null}}catch(x){e.cleanup={ok:false,error:String(x?.message||x)}}}
  e.finished_at=new Date().toISOString();
  await writeFile(`${OUT}/evidence.json`,JSON.stringify(e,null,2));
}
if(failure)throw failure;
assert(e.cleanup?.ok,'CLEANUP_FAILED');
console.log('ISSUE557_AUTHENTICATED_PRODUCTION_E2E=PASS');
console.log('ISSUE557_QA_SESSION_CLEANUP=PASS');
console.log('ISSUE557_BUSINESS_FINANCE_LEDGER_MUTATION=NONE');
