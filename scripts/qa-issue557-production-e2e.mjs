import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN='https://ronaoil.com';
const BROKER='https://sxawrwzeobaqwwmlkzws.supabase.co/functions/v1/rona-ci-admin-session-broker';
const RELEASE_REF='refs/heads/release/public-go-live-v1.1';
const RELEASE_SHA=String(process.env.EXPECTED_RELEASE_SHA||'');
const RUN_ID=String(process.env.GITHUB_RUN_ID||'');
const REPOSITORY=String(process.env.GITHUB_REPOSITORY||'');
const SECRET=String(process.env.RONA_ADMIN_SESSION_SECRET||process.env.RONA_RUNTIME_ADMIN_SECRET||'');
const EVIDENCE_DIR='artifacts/issue557-production-e2e';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/[\u00a0\u202f\s]+/g,' ').trim();
const compact=v=>norm(v).replace(/\s/g,'').replace(/,/g,'.');
const moneyNum=v=>Number(String(v??'').replace(/\s/g,'').replace(',','.'));
const eq=(a,b,t=0.005)=>Number.isFinite(Number(a))&&Math.abs(Number(a)-Number(b))<=t;
const expected={
  deal011:{received:225900,due:0,conditional:527100,spend:35574.47,residual:190325.53},
  deal010:{spend:6225.53},
  aggregates:{
    received:{RUB:10000000,USD:713220},
    due:{RUB:0,USD:0},
    conditional:{RUB:21002300,USD:1244705},
    spend:{RUB:0,USD:481662.96},
    residual:{RUB:10000000,USD:231557.04},
  },
};

assert(SECRET,'CI_BROKER_SECRET_MISSING');
assert(REPOSITORY==='rokotove26-png/ronatrade.com',`REPOSITORY_MISMATCH:${REPOSITORY}`);
assert(/^[0-9a-f]{40}$/i.test(RELEASE_SHA),`RELEASE_SHA_INVALID:${RELEASE_SHA}`);
assert(/^\d{5,20}$/.test(RUN_ID),`RUN_ID_INVALID:${RUN_ID}`);
await mkdir(EVIDENCE_DIR,{recursive:true});

async function broker(path='/'){
  const r=await fetch(BROKER+path,{method:'POST',headers:{
    authorization:`Bearer ${SECRET}`,
    'content-type':'application/json',
    'x-github-repository':REPOSITORY,
    'x-github-ref':RELEASE_REF,
    'x-github-sha':RELEASE_SHA,
    'x-github-run-id':RUN_ID,
  }});
  const j=await r.json().catch(()=>null);
  if(!r.ok||!j?.ok)throw new Error(`CI_BROKER_${path}_${r.status}_${j?.code||'UNKNOWN'}`);
  return j;
}

function findProjection(value,seen=new Set()){
  if(!value||typeof value!=='object'||seen.has(value))return null;
  seen.add(value);
  if(value.contract==='ADMIN_PAYMENTS_V7'&&Array.isArray(value.deals))return value;
  if(value.paymentsV7Projection?.contract==='ADMIN_PAYMENTS_V7')return value.paymentsV7Projection;
  for(const child of Object.values(value)){
    const found=findProjection(child,seen);
    if(found)return found;
  }
  return null;
}
function findDeal(projection,id){return (projection?.deals||[]).find(d=>String(d?.deal_id||'')===id)||null}
function amount(m){return m&&m.amount!==null&&m.amount!==undefined?moneyNum(m.amount):NaN}
function status(m){return String(m?.status||'').toUpperCase()}
function assertMoney(m,want,label){
  assert(m,`${label}_MISSING`);
  assert(status(m)==='AUTHORITATIVE',`${label}_NOT_AUTHORITATIVE:${status(m)}`);
  assert(eq(amount(m),want),`${label}_MISMATCH:${amount(m)}!=${want}`);
}
function paymentAggregate(projection,field){
  const out={};
  for(const d of projection.deals||[]){
    const m=d?.[field];
    if(status(m)!=='AUTHORITATIVE'||m?.amount===null||m?.amount===undefined||!m?.currency)continue;
    const c=String(m.currency).toUpperCase();out[c]=(out[c]||0)+amount(m);
  }
  return out;
}
function assertAggregate(got,want,label){
  for(const [currency,value] of Object.entries(want))assert(eq(got[currency]||0,value),`${label}_${currency}_MISMATCH:${got[currency]||0}!=${value}`);
}
function numberForms(value){
  const n=Number(value);
  const fixed=Number.isInteger(n)?String(n):n.toFixed(2);
  const [i,d]=fixed.split('.');
  const spaced=i.replace(/\B(?=(\d{3})+(?!\d))/g,' ');
  const narrow=i.replace(/\B(?=(\d{3})+(?!\d))/g,'\u202f');
  const nbsp=i.replace(/\B(?=(\d{3})+(?!\d))/g,'\u00a0');
  const vals=[fixed,spaced+(d?'.'+d:''),spaced+(d?','+d:''),narrow+(d?','+d:''),nbsp+(d?','+d:'')];
  return [...new Set(vals.map(compact))];
}
function textHasNumber(text,value){const c=compact(text);return numberForms(value).some(v=>c.includes(v))}
function assertTextNumber(text,value,label){assert(textHasNumber(text,value),`${label}_NOT_VISIBLE:${value} IN ${norm(text).slice(0,800)}`)}

async function apiProof(accessToken){
  const r=await fetch(`${ORIGIN}/api/v1/admin/bootstrap?_qa=${Date.now()}`,{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json','cache-control':'no-store'}});
  const body=await r.json().catch(()=>null);
  assert(r.ok,`ADMIN_BOOTSTRAP_HTTP_${r.status}`);
  const projection=findProjection(body);
  assert(projection,'ADMIN_PAYMENTS_V7_PROJECTION_MISSING');
  const d11=findDeal(projection,'DEAL-2026-011');
  const d10=findDeal(projection,'DEAL-2026-010');
  assert(d11,'API_DEAL_011_MISSING');assert(d10,'API_DEAL_010_MISSING');
  assertMoney(d11.verified_received,expected.deal011.received,'API_D011_RECEIVED');
  assertMoney(d11.due_now,expected.deal011.due,'API_D011_DUE_NOW');
  assertMoney(d11.future_conditional,expected.deal011.conditional,'API_D011_CONDITIONAL');
  assertMoney(d11.actual_spend,expected.deal011.spend,'API_D011_SPEND');
  assertMoney(d11.remaining_execution,expected.deal011.residual,'API_D011_RESIDUAL');
  assertMoney(d10.actual_spend,expected.deal010.spend,'API_D010_SPEND');
  const aggregates={
    received:paymentAggregate(projection,'verified_received'),
    due:paymentAggregate(projection,'due_now'),
    conditional:paymentAggregate(projection,'future_conditional'),
    spend:paymentAggregate(projection,'actual_spend'),
    residual:paymentAggregate(projection,'remaining_execution'),
  };
  assertAggregate(aggregates.received,expected.aggregates.received,'API_AGG_RECEIVED');
  assertAggregate(aggregates.due,expected.aggregates.due,'API_AGG_DUE');
  assertAggregate(aggregates.conditional,expected.aggregates.conditional,'API_AGG_CONDITIONAL');
  assertAggregate(aggregates.spend,expected.aggregates.spend,'API_AGG_SPEND');
  assertAggregate(aggregates.residual,expected.aggregates.residual,'API_AGG_RESIDUAL');
  const recon=projection.finance_authority_projection_reconciliation||null;
  assert(!recon||!['TO_VERIFY','PARTIAL_TO_VERIFY'].includes(String(recon.status||'').toUpperCase()),`API_RECONCILIATION_NOT_ALIGNED:${recon?.status}`);
  return {
    contract:projection.contract,
    generated_at:projection.generated_at||null,
    source_as_of:projection.source_as_of||null,
    reconciliation:recon,
    deal011:{received:amount(d11.verified_received),due_now:amount(d11.due_now),future_conditional:amount(d11.future_conditional),actual_spend:amount(d11.actual_spend),remaining_execution:amount(d11.remaining_execution),financial_status:d11.financial_status||null},
    deal010:{actual_spend:amount(d10.actual_spend),financial_status:d10.financial_status||null},
    aggregates,
  };
}

async function waitPayments(page){
  await page.goto(`${ORIGIN}/portal?_qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(document.querySelector('#nav button[data-page="payments"]')),{timeout:30000});
  const nav=page.locator('#nav button[data-page="payments"]').first();
  await nav.click();
  await page.waitForFunction(()=>{
    const s=document.getElementById('page-payments');if(!s)return false;const r=s.getBoundingClientRect(),cs=getComputedStyle(s);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden'&&(s.classList.contains('active')||document.querySelector('#nav button[data-page="payments"]')?.classList.contains('active'));
  },{timeout:30000});
  await page.waitForFunction(()=>document.getElementById('page-payments')?.innerText?.includes('DEAL-2026-011'),{timeout:45000});
  await sleep(1500);
}
async function pageSnapshot(page){
  return await page.evaluate(()=>{
    const section=document.getElementById('page-payments');
    const text=e=>(e?.innerText||e?.textContent||'').replace(/\s+/g,' ').trim();
    const visible=e=>{if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0};
    const smallestDealContainer=id=>{
      const candidates=[...section.querySelectorAll('tr,article,[data-deal-id],[data-rona-deal-id],.rona-owner-card,.rona-fin-row,div')].filter(e=>visible(e)&&text(e).includes(id));
      candidates.sort((a,b)=>text(a).length-text(b).length);
      const preferred=candidates.find(e=>['TR','ARTICLE'].includes(e.tagName)||e.hasAttribute('data-deal-id')||e.hasAttribute('data-rona-deal-id'));
      return preferred||candidates[0]||null;
    };
    const cards=[...section.querySelectorAll('.rona-fin-kpi-grid > .rona-owner-card,.rona-fin-kpi-grid .rona-owner-card')].filter(visible).map((e,i)=>({index:i,text:text(e)}));
    const warnings=[...section.querySelectorAll('*')].filter(e=>visible(e)&&/TO_VERIFY|требует проверки|расхожд|ошибк/i.test(text(e))&&text(e).length<500).map(text);
    return {url:location.href,title:document.title,sectionText:text(section),deal011:text(smallestDealContainer('DEAL-2026-011')),deal010:text(smallestDealContainer('DEAL-2026-010')),kpiCards:cards,warnings:[...new Set(warnings)].slice(0,30)};
  });
}
function cardBy(cards,patterns){return cards.find(c=>patterns.some(p=>p.test(c.text)))?.text||''}
function browserAssertions(s){
  assert(s.deal011,'UI_D011_ROW_MISSING');assert(s.deal010,'UI_D010_ROW_MISSING');
  assertTextNumber(s.deal011,expected.deal011.received,'UI_D011_RECEIVED');
  assertTextNumber(s.deal011,expected.deal011.due,'UI_D011_DUE_NOW');
  assertTextNumber(s.deal011,expected.deal011.conditional,'UI_D011_CONDITIONAL');
  assertTextNumber(s.deal011,expected.deal011.spend,'UI_D011_SPEND');
  assertTextNumber(s.deal011,expected.deal011.residual,'UI_D011_RESIDUAL');
  assertTextNumber(s.deal010,expected.deal010.spend,'UI_D010_SPEND');
  const cards=s.kpiCards||[];
  const received=cardBy(cards,[/получен/i,/received/i]);
  const due=cardBy(cards,[/ожидается сейчас/i,/к оплате сейчас/i,/due now/i]);
  const conditional=cardBy(cards,[/условн/i,/conditional/i]);
  const spend=cardBy(cards,[/потрачен/i,/расход/i,/actual spend/i]);
  const residual=cardBy(cards,[/остаток/i,/funding residual/i,/remaining execution/i]);
  assert(received,'UI_KPI_RECEIVED_CARD_MISSING');
  assert(due,'UI_KPI_DUE_CARD_MISSING');
  assert(conditional,'UI_KPI_CONDITIONAL_CARD_MISSING');
  assert(spend,'UI_KPI_SPEND_CARD_MISSING');
  assert(residual,'UI_KPI_RESIDUAL_CARD_MISSING');
  for(const [c,v] of Object.entries(expected.aggregates.received)){assert(received.toUpperCase().includes(c),`UI_AGG_RECEIVED_${c}_CURRENCY_MISSING`);assertTextNumber(received,v,`UI_AGG_RECEIVED_${c}`)}
  for(const [c,v] of Object.entries(expected.aggregates.due)){assert(due.toUpperCase().includes(c),`UI_AGG_DUE_${c}_CURRENCY_MISSING`);assertTextNumber(due,v,`UI_AGG_DUE_${c}`)}
  for(const [c,v] of Object.entries(expected.aggregates.conditional)){assert(conditional.toUpperCase().includes(c),`UI_AGG_CONDITIONAL_${c}_CURRENCY_MISSING`);assertTextNumber(conditional,v,`UI_AGG_CONDITIONAL_${c}`)}
  for(const [c,v] of Object.entries(expected.aggregates.spend)){assert(spend.toUpperCase().includes(c),`UI_AGG_SPEND_${c}_CURRENCY_MISSING`);assertTextNumber(spend,v,`UI_AGG_SPEND_${c}`)}
  for(const [c,v] of Object.entries(expected.aggregates.residual)){assert(residual.toUpperCase().includes(c),`UI_AGG_RESIDUAL_${c}_CURRENCY_MISSING`);assertTextNumber(residual,v,`UI_AGG_RESIDUAL_${c}`)}
  assert(!(s.warnings||[]).some(x=>/TO_VERIFY|расхожд/i.test(x)),'UI_RECONCILIATION_WARNING_PRESENT');
  return {received,due,conditional,spend,residual};
}

let issued=null,browser=null,context=null,evidence={release_sha:RELEASE_SHA,run_id:RUN_ID,origin:ORIGIN,mode:'READ_ONLY',started_at:new Date().toISOString(),api:null,ui:null,cleanup:null,result:'FAIL'};
let failure=null;
try{
  issued=await broker('/');
  const accessToken=issued?.session?.access_token;
  assert(accessToken,'CI_BROKER_ACCESS_TOKEN_MISSING');
  evidence.api=await apiProof(accessToken);
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width:1600,height:1200}});
  await context.addCookies([{name:'rona_portal_at',value:accessToken,domain:'ronaoil.com',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  const runtimeErrors=[];
  page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console:${m.text().slice(0,400)}`)});
  page.on('pageerror',e=>runtimeErrors.push(`pageerror:${String(e?.message||e).slice(0,400)}`));
  await waitPayments(page);
  const snap=await pageSnapshot(page);
  const kpis=browserAssertions(snap);
  evidence.ui={authenticated:!snap.url.includes('/portal/login'),final_url:snap.url,deal011:snap.deal011,deal010:snap.deal010,kpis,warnings:snap.warnings,runtime_errors:runtimeErrors};
  assert(evidence.ui.authenticated,'UI_NOT_AUTHENTICATED');
  await page.screenshot({path:`${EVIDENCE_DIR}/issue557-payments-production.png`,fullPage:true});
  evidence.result='PASS';
}catch(error){failure=error;evidence.failure=String(error?.stack||error?.message||error).slice(0,5000)}finally{
  try{if(context)await context.close()}catch{}
  try{if(browser)await browser.close()}catch{}
  if(issued){try{const c=await broker('/cleanup');evidence.cleanup={ok:true,retired:c.retired??null}}catch(e){evidence.cleanup={ok:false,error:String(e?.message||e)}}}
  evidence.finished_at=new Date().toISOString();
  await writeFile(`${EVIDENCE_DIR}/issue557-production-evidence.json`,JSON.stringify(evidence,null,2));
}
if(failure)throw failure;
assert(evidence.cleanup?.ok===true,'CI_BROKER_CLEANUP_FAILED');
console.log('ISSUE557_AUTHENTICATED_PRODUCTION_E2E=PASS');
console.log(`ISSUE557_RELEASE_SHA=${RELEASE_SHA}`);
console.log('ISSUE557_BUSINESS_DATA_MUTATION=NONE');
