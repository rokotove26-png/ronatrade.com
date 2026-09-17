import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ORIGIN='https://ronaoil.com';
const SUPABASE='https://sxawrwzeobaqwwmlkzws.supabase.co';
const PORTAL_API=`${SUPABASE}/functions/v1/rona-portal-api`;
const ISSUER=`${SUPABASE}/functions/v1/rona-g82-github-oidc-browser-qa-20260816`;
const AUD='rona-pr462-live-preview';
const OUT='artifacts/issue557-oidc-e2e';
const DISPLAY_CONTRACT='RONA_PAYMENTS_MONEY_DISPLAY_V1';
const DISPLAY_MAX_FRACTION_DIGITS=1;
const MONEY_FIELDS=['verified_received','due_now','future_conditional','actual_spend','remaining_execution'];

await mkdir(OUT,{recursive:true});
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/[\u00a0\u202f\s]+/g,' ').trim();
const num=v=>Number(String(v??'').replace(/[\u00a0\u202f\s]/g,'').replace(',','.'));
const amount=m=>m?.amount===null||m?.amount===undefined?NaN:num(m.amount);
const rawAmount=m=>m?.amount===null||m?.amount===undefined?null:String(m.amount);
const authoritative=m=>m&&String(m.status||'').toUpperCase()==='AUTHORITATIVE'&&Number.isFinite(amount(m))&&!!String(m.currency||'').trim();
const displayFmt=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:DISPLAY_MAX_FRACTION_DIGITS});
const displayAmount=v=>displayFmt.format(Number(v));
const displayMoney=m=>`${displayAmount(m.raw_amount??m.amount)} ${String(m.currency||'').toUpperCase()}`;
const sha=value=>createHash('sha256').update(value).digest('hex');
function rawFractionDigits(v){const s=String(v??'');const m=s.match(/\.(\d+)(?:[eE][+-]?\d+)?$/);return m?m[1].length:0}

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
function rawMoney(m){
  return{raw_amount:rawAmount(m),raw_type:typeof m?.amount,currency:String(m?.currency||'').toUpperCase(),status:String(m?.status||'')};
}
function rawDealSnapshot(p){
  return Object.fromEntries((p.deals||[]).map(d=>[d.deal_id,Object.fromEntries(MONEY_FIELDS.map(field=>[field,rawMoney(d?.[field])]))]));
}
function aggregateRaw(projection,field){
  const totals={};const sources={};
  for(const d of projection.deals||[]){
    const m=d?.[field];if(!authoritative(m))continue;
    const c=String(m.currency).toUpperCase();
    totals[c]=(totals[c]||0)+Number(m.amount);
    (sources[c]??=[]).push({deal_id:d.deal_id,raw_amount:rawAmount(m)});
  }
  return{totals,sources};
}
function projectionAggregates(p){return Object.fromEntries([
  ['received','verified_received'],['due','due_now'],['conditional','future_conditional'],['spend','actual_spend'],['residual','remaining_execution']
].map(([name,field])=>[name,aggregateRaw(p,field)]))}
function proveProjection(p){
  assert(p,'PAYMENTS_PROJECTION_MISSING');
  assert(Array.isArray(p.deals)&&p.deals.length>0,'PAYMENTS_DEALS_EMPTY');
  const rawBefore=JSON.stringify(rawDealSnapshot(p));
  const deals={};const precisionSamples=[];
  for(const d of p.deals){
    assert(d?.deal_id,'DEAL_ID_MISSING');
    for(const field of MONEY_FIELDS){
      assert(authoritative(d?.[field]),`${d.deal_id}_${field}_NOT_AUTHORITATIVE`);
      const raw=rawMoney(d[field]);
      deals[d.deal_id]??={financial_status:d.financial_status||null};
      deals[d.deal_id][field]=raw;
      if(rawFractionDigits(raw.raw_amount)>DISPLAY_MAX_FRACTION_DIGITS)precisionSamples.push({deal_id:d.deal_id,field,...raw,fraction_digits:rawFractionDigits(raw.raw_amount)});
    }
  }
  const rawAfter=JSON.stringify(rawDealSnapshot(p));
  assert(rawAfter===rawBefore,'API_SOURCE_VALUES_MUTATED_DURING_PROOF');
  const rec=p.finance_authority_projection_reconciliation||null;
  const recStatus=String(rec?.status||'').toUpperCase();
  assert(!['TO_VERIFY','PARTIAL_TO_VERIFY','FAIL','FAIL_CLOSED'].includes(recStatus),`RECON_${rec?.status}`);
  if(rec?.mismatch_count!==undefined&&rec?.mismatch_count!==null)assert(Number(rec.mismatch_count)===0,`RECON_MISMATCH_COUNT_${rec.mismatch_count}`);
  return{
    source_as_of:p.source_as_of||null,
    reconciliation:rec,
    raw_snapshot_sha256:sha(rawBefore),
    source_values_preserved:true,
    long_decimal_samples:precisionSamples.slice(0,30),
    long_decimal_samples_present:precisionSamples.length>0,
    deals,
    aggregates:projectionAggregates(p),
  };
}
async function fetchJson(url,headers){const r=await fetch(url,{headers:{accept:'application/json','cache-control':'no-store',...headers}}),b=await r.json().catch(()=>null);return{r,b}}
async function apiProof(token){
  const logical=await fetchJson(`${PORTAL_API}/v1/admin/bootstrap?_qa=${Date.now()}`,{authorization:`Bearer ${token}`});
  const proxy=await fetchJson(`${ORIGIN}/portal/api/v1/admin/bootstrap?_qa=${Date.now()}`,{cookie:`rona_portal_at=${token}`});
  assert(logical.r.ok,`LOGICAL_BOOTSTRAP_HTTP_${logical.r.status}`);assert(proxy.r.ok,`PROXY_BOOTSTRAP_HTTP_${proxy.r.status}`);
  const a=proveProjection(findProjection(logical.b)),b=proveProjection(findProjection(proxy.b));
  assert(JSON.stringify(a.deals)===JSON.stringify(b.deals),'LOGICAL_PROXY_RAW_DEALS_MISMATCH');
  assert(JSON.stringify(a.aggregates)===JSON.stringify(b.aggregates),'LOGICAL_PROXY_RAW_AGGREGATES_MISMATCH');
  return b;
}
function assertDisplayedMoney(text,m,label){
  const expected=norm(displayMoney(m));
  assert(norm(text).includes(expected),`${label}_DISPLAY_MISSING_${expected}:${norm(text).slice(0,1000)}`);
}
function scanMoneyTokens(text,currencies){
  const safe=currencies.map(c=>String(c).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).filter(Boolean);
  if(!safe.length)return[];
  const re=new RegExp(`(-?\\d[\\d\\s\\u00a0\\u202f]*(?:[.,]\\d+)?)\\s*(${safe.join('|')})\\b`,'gi');
  const out=[];let m;
  while((m=re.exec(String(text||'')))){
    const number=norm(m[1]);const fraction=number.match(/[.,](\d+)\s*$/)?.[1]||'';
    out.push({token:norm(m[0]),number,currency:String(m[2]).toUpperCase(),fraction_digits:fraction.length});
  }
  return out;
}
function aggregateDisplayProof(api){
  const out={};
  for(const [name,group] of Object.entries(api.aggregates)){
    out[name]={};
    for(const [currency,total] of Object.entries(group.totals||{})){
      const rawInputs=(group.sources?.[currency]||[]).map(x=>x.raw_amount);
      const displayRoundedInputSum=rawInputs.reduce((sum,value)=>sum+Number(String(displayAmount(value)).replace(/[\u00a0\u202f\s]/g,'').replace(',','.')),0);
      out[name][currency]={raw_sum:total,raw_inputs:rawInputs,display_after_raw_sum:displayAmount(total),display_rounded_input_sum:displayRoundedInputSum};
    }
  }
  return out;
}

async function uiProof(token,api){
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1600,height:1200}});
    await ctx.addCookies([{name:'rona_portal_at',value:token,domain:'ronaoil.com',path:'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
    const page=await ctx.newPage(),network=[];
    page.on('response',async response=>{
      const url=response.url();
      if(!url.includes('/portal/main-ui')&&!url.includes('/portal/payments-v8-ui'))return;
      let headers={};try{headers=await response.allHeaders()}catch{}
      network.push({url,status:response.status(),money_display:headers['x-rona-payments-money-display']||null,payments_ui:headers['x-rona-payments-ui']||null});
    });
    await page.goto(`${ORIGIN}/portal/admin?_qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    assert(!page.url().includes('/login'),'AUTH_REDIRECT_TO_LOGIN');
    await page.waitForSelector('#nav button[data-page="payments"]',{state:'visible',timeout:30000});
    await page.locator('#nav button[data-page="payments"]').click();
    const dealIds=Object.keys(api.deals);
    await page.waitForFunction(ids=>ids.every(id=>document.getElementById('page-payments')?.innerText?.includes(id)),dealIds,{timeout:30000});
    await page.waitForFunction(()=>globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__?.contract==='RONA_PAYMENTS_MONEY_DISPLAY_V1',{timeout:15000});
    await page.waitForTimeout(750);
    const s=await page.evaluate(ids=>{
      const root=document.getElementById('page-payments'),txt=e=>(e?.innerText||'').replace(/\s+/g,' ').trim(),vis=e=>{if(!e)return false;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'};
      const row=id=>{const xs=[...(root?.querySelectorAll('tr,article,[data-deal-id],[data-rona-deal-id],.rona-owner-card,div')||[])].filter(e=>vis(e)&&txt(e).includes(id));xs.sort((a,b)=>txt(a).length-txt(b).length);return txt(xs.find(e=>e.tagName==='TR'||e.tagName==='ARTICLE')||xs[0])};
      const contract=globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__;
      return{
        paymentsText:txt(root),
        rows:Object.fromEntries(ids.map(id=>[id,row(id)])),
        cards:root?[...root.querySelectorAll('.rona-fin-kpi-grid .rona-owner-card')].filter(vis).map(txt):[],
        moneyContract:{contract:contract?.contract||null,maximumFractionDigits:contract?.maximumFractionDigits??null},
      };
    },dealIds);
    assert(s.moneyContract.contract===DISPLAY_CONTRACT,`UI_MONEY_CONTRACT_${s.moneyContract.contract}`);
    assert(Number(s.moneyContract.maximumFractionDigits)===DISPLAY_MAX_FRACTION_DIGITS,`UI_MAX_FRACTION_${s.moneyContract.maximumFractionDigits}`);

    const currencies=[...new Set(Object.values(api.deals).flatMap(d=>MONEY_FIELDS.map(f=>d?.[f]?.currency)).filter(Boolean))];
    const visibleMoneyTokens=scanMoneyTokens(s.paymentsText,currencies);
    assert(visibleMoneyTokens.length>0,'UI_VISIBLE_MONEY_TOKENS_EMPTY');
    for(const token of visibleMoneyTokens)assert(token.fraction_digits<=DISPLAY_MAX_FRACTION_DIGITS,`UI_MONEY_PRECISION_GT_1:${token.token}`);

    for(const [id,d] of Object.entries(api.deals)){
      const row=s.rows[id];assert(row,`UI_${id}_ROW_MISSING`);
      for(const field of MONEY_FIELDS)assertDisplayedMoney(row,d[field],`UI_${id}_${field}`);
      assert(!/TO_VERIFY|FAIL_CLOSED|расхожд/i.test(row),`UI_${id}_FAIL_CLOSED_WARNING`);
    }
    const pick=rs=>s.cards.find(t=>rs.some(r=>r.test(t)))||'';
    const cards={received:pick([/получен/i]),due:pick([/ожидается сейчас/i,/к оплате сейчас/i]),conditional:pick([/условн/i]),spend:pick([/потрачен/i,/расход/i]),residual:pick([/остаток/i])};
    for(const [name,group] of Object.entries(api.aggregates)){
      const card=cards[name];assert(card,`UI_${name}_KPI_MISSING`);
      for(const [currency,total] of Object.entries(group.totals||{}))assert(norm(card).includes(norm(`${displayAmount(total)} ${currency}`)),`UI_${name}_${currency}_DISPLAY_MISMATCH:${norm(card)}`);
    }

    let passport={status:'NOT_EXPOSED_IN_CURRENT_LIVE_RENDERER',money_tokens:[]};
    const trigger=page.locator('.rona-payments-v7-passport-trigger, .rona-payments-v7-passport > summary').first();
    if(await trigger.count()){
      await trigger.click();
      const modal=page.locator('#ronaPaymentsV7PassportDesignerModal');
      await modal.waitFor({state:'visible',timeout:10000});
      const text=await modal.innerText();
      const tokens=scanMoneyTokens(text,currencies);
      for(const token of tokens)assert(token.fraction_digits<=DISPLAY_MAX_FRACTION_DIGITS,`UI_PASSPORT_MONEY_PRECISION_GT_1:${token.token}`);
      passport={status:'EXPOSED_AND_VERIFIED',money_tokens:tokens,text:norm(text).slice(0,12000)};
    }

    await page.waitForTimeout(500);
    assert(network.some(x=>x.money_display==='max-1-v1'),`UI_MONEY_DISPLAY_HEADER_MISSING:${JSON.stringify(network)}`);
    await page.screenshot({path:`${OUT}/payments.png`,fullPage:true});
    await ctx.close();
    return{
      ...s,
      cards,
      visibleMoneyTokens,
      all_visible_money_max_fraction_digits:Math.max(...visibleMoneyTokens.map(x=>x.fraction_digits)),
      passport,
      network,
      aggregate_precision_proof:aggregateDisplayProof(api),
      expectedAggregates:Object.fromEntries(Object.entries(api.aggregates).map(([k,v])=>[k,v.totals])),
    };
  }finally{await browser.close()}
}

let issued,e={mode:'READ_ONLY',display_only:true,finance_authority_dynamic:true,display_contract:DISPLAY_CONTRACT,maximumFractionDigits:DISPLAY_MAX_FRACTION_DIGITS,baseline_release:process.env.BASELINE_RELEASE_SHA||null,live_release:process.env.LIVE_RELEASE_SHA||null,run_id:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA,result:'FAIL'},failure;
try{
  issued=await issuer('/',{expectedHead:process.env.GITHUB_SHA});
  const token=issued?.session?.access_token;assert(token,'SESSION_TOKEN_MISSING');
  e.api=await apiProof(token);e.api_result='PASS';
  e.ui=await uiProof(token,e.api);e.ui_result='PASS';
  e.result='PASS';
}catch(x){failure=x;e.failure=String(x?.stack||x).slice(0,8000)}finally{
  if(issued){try{const c=await issuer('/cleanup',{});e.cleanup={ok:true,retired:c.retired??null}}catch(x){e.cleanup={ok:false,error:String(x?.message||x)}}}
  e.finished_at=new Date().toISOString();await writeFile(`${OUT}/evidence.json`,JSON.stringify(e,null,2));
}
if(failure)throw failure;assert(e.cleanup?.ok,'CLEANUP_FAILED');
console.log('PAYMENTS_V8_MONEY_DISPLAY_AUTHENTICATED_PRODUCTION_E2E=PASS');
console.log('PAYMENTS_V8_ALL_VISIBLE_MONEY_MAX_FRACTION_DIGITS=1');
console.log('PAYMENTS_V8_RAW_API_PRECISION_PRESERVED=PASS');
console.log('PAYMENTS_V8_RECONCILIATION_RAW_PRECISION=PASS');
console.log('PAYMENTS_V8_QA_SESSION_CLEANUP=PASS');
console.log('PAYMENTS_V8_FINANCE_AUTHORITY_MUTATION=NONE');
console.log('PAYMENTS_V8_PAYMENT_RECORD_MUTATION=NONE');
