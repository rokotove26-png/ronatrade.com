import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN='https://ronaoil.com';
const SUPABASE='https://sxawrwzeobaqwwmlkzws.supabase.co';
const PORTAL_API=`${SUPABASE}/functions/v1/rona-portal-api`;
const ISSUER=`${SUPABASE}/functions/v1/rona-g82-github-oidc-browser-qa-20260816`;
const AUD='rona-pr462-live-preview';
const OUT='artifacts/issue557-oidc-e2e';

await mkdir(OUT,{recursive:true});
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/[\u00a0\u202f\s]+/g,' ').trim();
const compact=v=>norm(v).replace(/\s/g,'').replace(/,/g,'.');
const num=v=>Number(String(v??'').replace(/\s/g,'').replace(',','.'));
const amount=m=>m?.amount===null||m?.amount===undefined?NaN:num(m.amount);
const authoritative=m=>m&&String(m.status||'').toUpperCase()==='AUTHORITATIVE'&&Number.isFinite(amount(m))&&!!String(m.currency||'').trim();

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
function aggregate(projection,field){
  const out={};
  for(const d of projection.deals||[]){
    const m=d?.[field];if(!authoritative(m))continue;
    const c=String(m.currency).toUpperCase();out[c]=(out[c]||0)+amount(m);
  }
  for(const c of Object.keys(out))out[c]=Number(out[c].toFixed(6));
  return out;
}
function projectionAggregates(p){return{received:aggregate(p,'verified_received'),due:aggregate(p,'due_now'),conditional:aggregate(p,'future_conditional'),spend:aggregate(p,'actual_spend'),residual:aggregate(p,'remaining_execution')}}
function proveProjection(p){
  assert(p,'PAYMENTS_PROJECTION_MISSING');
  assert(Array.isArray(p.deals)&&p.deals.length>0,'PAYMENTS_DEALS_EMPTY');
  const fields=['verified_received','due_now','future_conditional','actual_spend','remaining_execution'];
  const deals={};
  for(const d of p.deals){
    assert(d?.deal_id,`DEAL_ID_MISSING`);
    for(const field of fields)assert(authoritative(d?.[field]),`${d.deal_id}_${field}_NOT_AUTHORITATIVE`);
    deals[d.deal_id]={financial_status:d.financial_status||null,...Object.fromEntries(fields.map(f=>[f,{amount:amount(d[f]),currency:String(d[f].currency).toUpperCase(),status:d[f].status}]))};
  }
  const rec=p.finance_authority_projection_reconciliation||null;
  assert(!rec||!['TO_VERIFY','PARTIAL_TO_VERIFY','FAIL','FAIL_CLOSED'].includes(String(rec.status||'').toUpperCase()),`RECON_${rec?.status}`);
  return{source_as_of:p.source_as_of||null,reconciliation:rec,deals,aggregates:projectionAggregates(p)};
}
async function fetchJson(url,headers){const r=await fetch(url,{headers:{accept:'application/json','cache-control':'no-store',...headers}}),b=await r.json().catch(()=>null);return{r,b}}
async function apiProof(token){
  const logical=await fetchJson(`${PORTAL_API}/v1/admin/bootstrap?_qa=${Date.now()}`,{authorization:`Bearer ${token}`});
  const proxy=await fetchJson(`${ORIGIN}/portal/api/v1/admin/bootstrap?_qa=${Date.now()}`,{cookie:`rona_portal_at=${token}`});
  assert(logical.r.ok,`LOGICAL_BOOTSTRAP_HTTP_${logical.r.status}`);assert(proxy.r.ok,`PROXY_BOOTSTRAP_HTTP_${proxy.r.status}`);
  const a=proveProjection(findProjection(logical.b)),b=proveProjection(findProjection(proxy.b));
  assert(JSON.stringify(a.deals)===JSON.stringify(b.deals),'LOGICAL_PROXY_DEALS_MISMATCH');
  assert(JSON.stringify(a.aggregates)===JSON.stringify(b.aggregates),'LOGICAL_PROXY_AGGREGATES_MISMATCH');
  return b;
}
function forms(v){const n=Number(v),variants=[];for(const digits of Number.isInteger(n)?[0]:[2,1,4]){const s=n.toFixed(digits),[i,d]=s.split('.'),sp=i.replace(/\B(?=(\d{3})+(?!\d))/g,' ');variants.push(s,sp+(d?'.'+d:''),sp+(d?','+d:''))}return[...new Set(variants.map(compact))]}
function has(t,v){const c=compact(t);return forms(v).some(x=>c.includes(x))}
function must(t,v,l){assert(has(t,v),`${l}_NOT_VISIBLE_${v}:${norm(t).slice(0,900)}`)}

async function uiProof(token,api){
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1600,height:1200}});
    await ctx.addCookies([{name:'rona_portal_at',value:token,domain:'ronaoil.com',path:'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
    const page=await ctx.newPage();await page.goto(`${ORIGIN}/portal/admin?_qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    assert(!page.url().includes('/login'),'AUTH_REDIRECT_TO_LOGIN');
    await page.waitForSelector('#nav button[data-page="payments"]',{state:'visible',timeout:30000});await page.locator('#nav button[data-page="payments"]').click();
    const dealIds=Object.keys(api.deals);
    await page.waitForFunction(ids=>ids.every(id=>document.getElementById('page-payments')?.innerText?.includes(id)),dealIds,{timeout:30000});await page.waitForTimeout(750);
    const s=await page.evaluate(ids=>{
      const root=document.getElementById('page-payments'),txt=e=>(e?.innerText||'').replace(/\s+/g,' ').trim(),vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'};
      const row=id=>{const xs=[...(root?.querySelectorAll('tr,article,[data-deal-id],[data-rona-deal-id],.rona-owner-card,div')||[])].filter(e=>vis(e)&&txt(e).includes(id));xs.sort((a,b)=>txt(a).length-txt(b).length);return txt(xs.find(e=>e.tagName==='TR'||e.tagName==='ARTICLE')||xs[0])};
      return{paymentsText:txt(root).slice(0,20000),rows:Object.fromEntries(ids.map(id=>[id,row(id)])),cards:root?[...root.querySelectorAll('.rona-fin-kpi-grid .rona-owner-card')].filter(vis).map(txt):[]};
    },dealIds);
    await page.screenshot({path:`${OUT}/payments.png`,fullPage:true});await ctx.close();
    for(const [id,d] of Object.entries(api.deals)){
      const row=s.rows[id];assert(row,`UI_${id}_ROW_MISSING`);
      for(const [field,m] of Object.entries(d)){
        if(field==='financial_status')continue;
        must(row,m.amount,`UI_${id}_${field}`);assert(row.toUpperCase().includes(m.currency),`UI_${id}_${field}_CURRENCY_MISSING`);
      }
      assert(!/TO_VERIFY|FAIL_CLOSED|расхожд/i.test(row),`UI_${id}_FAIL_CLOSED_WARNING`);
    }
    const pick=rs=>s.cards.find(t=>rs.some(r=>r.test(t)))||'';
    const cards={received:pick([/получен/i]),due:pick([/ожидается сейчас/i,/к оплате сейчас/i]),conditional:pick([/условн/i]),spend:pick([/потрачен/i,/расход/i]),residual:pick([/остаток/i])};
    for(const [k,w] of Object.entries(api.aggregates)){const c=cards[k];assert(c,`UI_${k}_KPI_MISSING`);for(const [cur,v] of Object.entries(w)){assert(c.toUpperCase().includes(cur),`UI_${k}_${cur}_MISSING`);must(c,v,`UI_${k}_${cur}`)}}
    return{...s,cards,expectedAggregates:api.aggregates};
  }finally{await browser.close()}
}

let issued,e={mode:'READ_ONLY',finance_authority_dynamic:true,run_id:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA,result:'FAIL'},failure;
try{
  issued=await issuer('/',{expectedHead:process.env.GITHUB_SHA});const token=issued?.session?.access_token;assert(token,'SESSION_TOKEN_MISSING');
  e.api=await apiProof(token);e.api_result='PASS';e.ui=await uiProof(token,e.api);e.ui_result='PASS';e.result='PASS';
}catch(x){failure=x;e.failure=String(x?.stack||x).slice(0,6000)}finally{
  if(issued){try{const c=await issuer('/cleanup',{});e.cleanup={ok:true,retired:c.retired??null}}catch(x){e.cleanup={ok:false,error:String(x?.message||x)}}}
  e.finished_at=new Date().toISOString();await writeFile(`${OUT}/evidence.json`,JSON.stringify(e,null,2));
}
if(failure)throw failure;assert(e.cleanup?.ok,'CLEANUP_FAILED');
console.log('PAYMENTS_V8_AUTHENTICATED_PRODUCTION_E2E=PASS');
console.log('PAYMENTS_V8_QA_SESSION_CLEANUP=PASS');
console.log('PAYMENTS_V8_FINANCE_AUTHORITY_MUTATION=NONE');
console.log('PAYMENTS_V8_PAYMENT_RECORD_MUTATION=NONE');
