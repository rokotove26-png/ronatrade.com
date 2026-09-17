import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ORIGIN='https://ronaoil.com';
const SUPABASE='https://sxawrwzeobaqwwmlkzws.supabase.co';
const PORTAL_API=`${SUPABASE}/functions/v1/rona-portal-api`;
const ISSUER=`${SUPABASE}/functions/v1/rona-g82-github-oidc-browser-qa-20260816`;
const AUD='rona-pr462-live-preview';
const OUT='artifacts/payments-v8-money-display-e2e';
const CONTRACT='RONA_PAYMENTS_MONEY_DISPLAY_V1';
const MAX=1;
const FIELDS=['verified_received','due_now','future_conditional','actual_spend','remaining_execution'];
const KPI_FIELDS={received:'verified_received',due:'due_now',conditional:'future_conditional',spend:'actual_spend',residual:'remaining_execution'};

await mkdir(OUT,{recursive:true});
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/[\u00a0\u202f\s]+/g,' ').trim();
const raw=m=>m?.amount===null||m?.amount===undefined?null:String(m.amount);
const amount=m=>Number(raw(m));
const authoritative=m=>m&&String(m.status||'').toUpperCase()==='AUTHORITATIVE'&&raw(m)!==null&&Number.isFinite(amount(m))&&!!String(m.currency||'').trim();
const fmt=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:MAX});
const shown=v=>fmt.format(Number(v));
const hash=v=>createHash('sha256').update(v).digest('hex');
const fractionDigits=v=>String(v??'').match(/\.(\d+)(?:[eE][+-]?\d+)?$/)?.[1]?.length||0;

async function oidc(){
  const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  assert(u&&t,'GITHUB_OIDC_ENV_MISSING');
  const r=await fetch(u+(u.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUD),{headers:{authorization:`Bearer ${t}`}});const j=await r.json();
  assert(r.ok&&j.value,`OIDC_HTTP_${r.status}`);return j.value;
}
async function issuer(path='/',body={}){
  const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${await oidc()}`,'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>null);
  assert(r.ok&&j?.ok,`ISSUER_${path}_${r.status}_${j?.code||'UNKNOWN'}`);return j;
}
function findProjection(v,seen=new Set()){
  if(!v||typeof v!=='object'||seen.has(v))return null;seen.add(v);
  if(v.contract==='ADMIN_PAYMENTS_V7'&&Array.isArray(v.deals))return v;
  if(v.paymentsV7Projection?.contract==='ADMIN_PAYMENTS_V7')return v.paymentsV7Projection;
  for(const x of Object.values(v)){const p=findProjection(x,seen);if(p)return p}return null;
}
function rawSnapshot(p){return Object.fromEntries((p.deals||[]).map(d=>[d.deal_id,Object.fromEntries(FIELDS.map(f=>[f,{amount:raw(d[f]),type:typeof d[f]?.amount,currency:String(d[f]?.currency||'').toUpperCase(),status:String(d[f]?.status||'')}]))]));}
function aggregate(p,field){const totals={},sources={};for(const d of p.deals||[]){const m=d?.[field];if(!authoritative(m))continue;const c=String(m.currency).toUpperCase();totals[c]=(totals[c]||0)+Number(m.amount);(sources[c]??=[]).push({deal_id:d.deal_id,raw_amount:raw(m)});}return{totals,sources};}
function proveProjection(p){
  assert(p,'PAYMENTS_PROJECTION_MISSING');assert(Array.isArray(p.deals)&&p.deals.length,'PAYMENTS_DEALS_EMPTY');
  const before=JSON.stringify(rawSnapshot(p));const long=[];
  for(const d of p.deals){assert(d.deal_id,'DEAL_ID_MISSING');for(const f of FIELDS){assert(authoritative(d[f]),`${d.deal_id}_${f}_NOT_AUTHORITATIVE`);if(fractionDigits(raw(d[f]))>MAX)long.push({deal_id:d.deal_id,field:f,raw_amount:raw(d[f]),fraction_digits:fractionDigits(raw(d[f]))});}}
  const after=JSON.stringify(rawSnapshot(p));assert(before===after,'API_SOURCE_VALUES_MUTATED');
  const rec=p.finance_authority_projection_reconciliation||null;const status=String(rec?.status||'').toUpperCase();
  assert(!['TO_VERIFY','PARTIAL_TO_VERIFY','FAIL','FAIL_CLOSED'].includes(status),`RECON_${status}`);if(rec?.mismatch_count!=null)assert(Number(rec.mismatch_count)===0,`RECON_MISMATCH_${rec.mismatch_count}`);
  return{source_as_of:p.source_as_of||null,reconciliation:rec,raw_snapshot_sha256:hash(before),source_values_preserved:true,long_decimal_samples:long,deals:rawSnapshot(p),aggregates:Object.fromEntries(Object.entries(KPI_FIELDS).map(([k,f])=>[k,aggregate(p,f)]))};
}
async function apiProof(token){
  const get=async(url,headers)=>{const r=await fetch(url,{headers:{accept:'application/json','cache-control':'no-store',...headers}});return{r,j:await r.json().catch(()=>null)}};
  const a=await get(`${PORTAL_API}/v1/admin/bootstrap?_qa=${Date.now()}`,{authorization:`Bearer ${token}`});const b=await get(`${ORIGIN}/portal/api/v1/admin/bootstrap?_qa=${Date.now()}`,{cookie:`rona_portal_at=${token}`});
  assert(a.r.ok,`LOGICAL_HTTP_${a.r.status}`);assert(b.r.ok,`PROXY_HTTP_${b.r.status}`);
  const pa=proveProjection(findProjection(a.j)),pb=proveProjection(findProjection(b.j));
  assert(JSON.stringify(pa.deals)===JSON.stringify(pb.deals),'LOGICAL_PROXY_RAW_DEALS_MISMATCH');assert(JSON.stringify(pa.aggregates)===JSON.stringify(pb.aggregates),'LOGICAL_PROXY_RAW_AGGREGATES_MISMATCH');return pb;
}
function scanMoney(text,currencies){const safe=currencies.map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));if(!safe.length)return[];const re=new RegExp(`(-?\\d[\\d\\s\\u00a0\\u202f]*(?:[.,]\\d+)?)\\s*(${safe.join('|')})\\b`,'gi');const out=[];let m;while((m=re.exec(String(text||'')))){const n=norm(m[1]);out.push({token:norm(m[0]),fraction_digits:n.match(/[.,](\d+)$/)?.[1]?.length||0});}return out;}
function expectMoney(text,m,label){const x=norm(`${shown(m.amount)} ${m.currency}`);assert(norm(text).includes(x),`${label}_DISPLAY_MISSING:${x}`);}

async function uiProof(token,api,evidence){
  const browser=await chromium.launch({headless:true});
  const pageErrors=[],consoleErrors=[],network=[],failedRequests=[];
  try{
    const ctx=await browser.newContext({viewport:{width:1600,height:1200}});await ctx.addCookies([{name:'rona_portal_at',value:token,domain:'ronaoil.com',path:'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
    const page=await ctx.newPage();
    page.on('pageerror',x=>pageErrors.push(String(x?.stack||x).slice(0,3000)));
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,3000))});
    page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||null}));
    page.on('response',async r=>{const u=r.url();if(!u.includes('/portal/main-ui')&&!u.includes('/portal/payments-v8-ui')&&!u.includes('/portal/api/v1/admin/bootstrap'))return;let h={};try{h=await r.allHeaders()}catch{}network.push({url:u,status:r.status(),content_type:h['content-type']||null,money_display:h['x-rona-payments-money-display']||null,payments_ui:h['x-rona-payments-ui']||null,current_runtime:h['x-rona-payments-current-runtime']||null});});
    await page.goto(`${ORIGIN}/portal/admin?_qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});assert(!page.url().includes('/login'),'AUTH_REDIRECT_TO_LOGIN');
    await page.waitForSelector('#nav button[data-page="payments"]',{state:'visible',timeout:30000});await page.locator('#nav button[data-page="payments"]').click();
    const ids=Object.keys(api.deals);
    let ready=false;try{await page.waitForFunction(ids=>ids.every(id=>document.getElementById('page-payments')?.innerText?.includes(id)),ids,{timeout:45000});ready=true}catch{}
    await page.waitForTimeout(1000);
    const diag=await page.evaluate(ids=>{const root=document.getElementById('page-payments'),contract=globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__;return{url:location.href,payments_text:String(root?.innerText||'').slice(0,30000),deal_presence:Object.fromEntries(ids.map(id=>[id,String(root?.innerText||'').includes(id)])),root_html:String(root?.innerHTML||'').slice(0,30000),contract:{contract:contract?.contract||null,maximumFractionDigits:contract?.maximumFractionDigits??null},v8_ui:globalThis.__RONA_PAYMENTS_V8_UI__||null,v8_error:globalThis.__RONA_PAYMENTS_V8_UI_ERROR__||null,v8_projection_deals:Array.isArray(globalThis.__RONA_PAYMENTS_V8_PROJECTION__?.deals)?globalThis.__RONA_PAYMENTS_V8_PROJECTION__.deals.length:null,scripts:[...document.scripts].map(s=>s.src).filter(Boolean).filter(s=>s.includes('main-ui')||s.includes('payments-v8'))};},ids);
    evidence.ui_diagnostic={ready,diag,network,pageErrors,consoleErrors,failedRequests};
    await page.screenshot({path:`${OUT}/payments.png`,fullPage:true});
    assert(ready,`UI_DEALS_NOT_RENDERED:${JSON.stringify(evidence.ui_diagnostic).slice(0,12000)}`);
    assert(diag.contract.contract===CONTRACT,`UI_CONTRACT_${diag.contract.contract}`);assert(Number(diag.contract.maximumFractionDigits)===MAX,`UI_MAX_${diag.contract.maximumFractionDigits}`);
    const s=await page.evaluate(ids=>{const root=document.getElementById('page-payments'),txt=e=>(e?.innerText||'').replace(/\s+/g,' ').trim();const rows={};for(const id of ids){const tr=[...(root?.querySelectorAll('tr')||[])].find(x=>txt(x).includes(id));rows[id]=txt(tr);}return{paymentsText:txt(root),rows,cards:[...(root?.querySelectorAll('.rona-fin-kpi-grid .rona-owner-card')||[])].map(txt)};},ids);
    const currencies=[...new Set(Object.values(api.deals).flatMap(d=>FIELDS.map(f=>d[f]?.currency)).filter(Boolean))];const tokens=scanMoney(s.paymentsText,currencies);assert(tokens.length,'UI_MONEY_TOKENS_EMPTY');for(const t of tokens)assert(t.fraction_digits<=MAX,`UI_PRECISION_GT_1:${t.token}`);
    for(const [id,d] of Object.entries(api.deals)){const row=s.rows[id];assert(row,`UI_${id}_ROW_MISSING`);for(const f of FIELDS)expectMoney(row,d[f],`UI_${id}_${f}`);assert(!/TO_VERIFY|FAIL_CLOSED|расхожд/i.test(row),`UI_${id}_FAIL_CLOSED_WARNING`);}
    const pick=rs=>s.cards.find(t=>rs.some(r=>r.test(t)))||'';const cards={received:pick([/получен/i]),due:pick([/ожидается сейчас/i,/к оплате сейчас/i]),conditional:pick([/условн/i]),spend:pick([/потрачен/i,/расход/i]),residual:pick([/остаток/i])};
    for(const [name,g] of Object.entries(api.aggregates)){const c=cards[name];assert(c,`UI_${name}_KPI_MISSING`);for(const [cur,total] of Object.entries(g.totals))assert(norm(c).includes(norm(`${shown(total)} ${cur}`)),`UI_${name}_${cur}_DISPLAY_MISMATCH`);}
    assert(network.some(x=>x.money_display==='max-1-v1'),`UI_MONEY_DISPLAY_HEADER_MISSING:${JSON.stringify(network)}`);
    let passport={status:'NOT_EXPOSED_IN_CURRENT_LIVE_RENDERER',tokens:[]};const trigger=page.locator('.rona-payments-v7-passport-trigger, .rona-payments-v7-passport > summary').first();if(await trigger.count()){await trigger.click();const modal=page.locator('#ronaPaymentsV7PassportDesignerModal');await modal.waitFor({state:'visible',timeout:10000});const text=await modal.innerText();const pt=scanMoney(text,currencies);for(const t of pt)assert(t.fraction_digits<=MAX,`PASSPORT_PRECISION_GT_1:${t.token}`);passport={status:'EXPOSED_AND_VERIFIED',tokens:pt,text:norm(text).slice(0,12000)};}
    await ctx.close();return{money_contract:diag.contract,all_visible_money_max_fraction_digits:Math.max(...tokens.map(x=>x.fraction_digits)),visible_money_tokens:tokens,cards,passport,network,pageErrors,consoleErrors,failedRequests,aggregate_precision_proof:Object.fromEntries(Object.entries(api.aggregates).map(([name,g])=>[name,Object.fromEntries(Object.entries(g.totals).map(([cur,total])=>[cur,{raw_sum:total,raw_inputs:g.sources[cur].map(x=>x.raw_amount),display_after_raw_sum:shown(total),sum_of_display_rounded_inputs:g.sources[cur].reduce((sum,x)=>sum+Number(String(shown(x.raw_amount)).replace(/[\u00a0\u202f\s]/g,'').replace(',','.')),0)}]))]))};
  }finally{await browser.close()}
}

let issued,failure;const e={mode:'READ_ONLY',display_only:true,display_contract:CONTRACT,maximumFractionDigits:MAX,baseline_release:process.env.BASELINE_RELEASE_SHA||null,live_release:process.env.LIVE_RELEASE_SHA||null,run_id:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA,result:'FAIL'};
try{issued=await issuer('/',{expectedHead:process.env.GITHUB_SHA});const token=issued?.session?.access_token;assert(token,'SESSION_TOKEN_MISSING');e.api=await apiProof(token);e.api_result='PASS';e.ui=await uiProof(token,e.api,e);e.ui_result='PASS';e.result='PASS';}catch(x){failure=x;e.failure=String(x?.stack||x).slice(0,14000);e.ui_result=e.ui_result||'FAIL';}finally{if(issued){try{const c=await issuer('/cleanup',{});e.cleanup={ok:true,retired:c.retired??null}}catch(x){e.cleanup={ok:false,error:String(x?.message||x)}}}e.finished_at=new Date().toISOString();await writeFile(`${OUT}/evidence.json`,JSON.stringify(e,null,2));}
if(failure)throw failure;assert(e.cleanup?.ok,'CLEANUP_FAILED');console.log('PAYMENTS_V8_MONEY_DISPLAY_AUTHENTICATED_PRODUCTION_E2E=PASS');console.log('PAYMENTS_V8_ALL_VISIBLE_MONEY_MAX_FRACTION_DIGITS=1');console.log('PAYMENTS_V8_RAW_API_PRECISION_PRESERVED=PASS');console.log('PAYMENTS_V8_RECONCILIATION_RAW_PRECISION=PASS');console.log('PAYMENTS_V8_QA_SESSION_CLEANUP=PASS');console.log('PAYMENTS_V8_FINANCE_AUTHORITY_MUTATION=NONE');console.log('PAYMENTS_V8_PAYMENT_RECORD_MUTATION=NONE');
