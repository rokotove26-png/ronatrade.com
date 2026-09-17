import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const ORIGIN='https://ronaoil.com';
const SUPABASE='https://sxawrwzeobaqwwmlkzws.supabase.co';
const PORTAL_API=`${SUPABASE}/functions/v1/rona-portal-api`;
const ISSUER=`${SUPABASE}/functions/v1/rona-g82-github-oidc-browser-qa-20260816`;
const AUD='rona-pr462-live-preview';
const OUT='artifacts/payments-v8-passport-routing-e2e';
const MONEY_CONTRACT='RONA_PAYMENTS_MONEY_DISPLAY_V1';
const MAX=1;
const MONEY_FIELDS=['verified_received','due_now','future_conditional','actual_spend','remaining_execution'];

await mkdir(OUT,{recursive:true});
const assert=(v,m)=>{if(!v)throw new Error(m)};
const norm=v=>String(v??'').replace(/[\u00a0\u202f\s]+/g,' ').trim();
const hash=v=>createHash('sha256').update(v).digest('hex');
const raw=m=>m?.amount===null||m?.amount===undefined?null:String(m.amount);
const amount=m=>Number(raw(m));
const authoritative=m=>m&&String(m.status||'').toUpperCase()==='AUTHORITATIVE'&&raw(m)!==null&&Number.isFinite(amount(m))&&!!String(m.currency||'').trim();

async function oidc(){
  const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  assert(u&&t,'GITHUB_OIDC_ENV_MISSING');
  const r=await fetch(u+(u.includes('?')?'&':'?')+'audience='+encodeURIComponent(AUD),{headers:{authorization:`Bearer ${t}`}});
  const j=await r.json();
  assert(r.ok&&j.value,`OIDC_HTTP_${r.status}`);
  return j.value;
}
async function issuer(path='/',body={}){
  const r=await fetch(ISSUER+path,{method:'POST',headers:{authorization:`Bearer ${await oidc()}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null);
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
function passportItems(passport){
  const items=[];
  for(const event of Array.isArray(passport?.funding_events)?passport.funding_events:[]){
    items.push({kind:'funding',...event});
    for(const line of Array.isArray(event?.settlement_lines)?event.settlement_lines:[])items.push({kind:'settlement',...line,funding_event_id:event?.funding_event_id||line?.funding_event_id||null});
  }
  for(const line of Array.isArray(passport?.unlinked_settlement_lines)?passport.unlinked_settlement_lines:[])items.push({kind:'unlinked',...line});
  return items;
}
function routeItem(item,index){
  return{
    index,
    kind:String(item?.kind||'payment'),
    payment_id:item?.payment_id||item?.funding_event_id||null,
    recipient:norm(item?.recipient),
    beneficiary:norm(item?.bank_beneficiary_name||item?.beneficiary_name),
    bank_route:norm(item?.bank_route_reference||item?.bank_document),
    amount:item?.amount??item?.funding_amount??item?.allocated_funding_amount??null,
    currency:String(item?.currency||item?.funding_currency||'').toUpperCase()||null,
  };
}
function projectionSnapshot(p){
  const deals={};
  const passports={};
  for(const d of p.deals||[]){
    deals[d.deal_id]=Object.fromEntries(MONEY_FIELDS.map(f=>[f,{amount:raw(d[f]),currency:String(d[f]?.currency||'').toUpperCase(),status:String(d[f]?.status||'')}])) ;
    const passport=d?.payment_passport;
    if(passport)passports[d.deal_id]={contract:passport?.contract||null,items:passportItems(passport).map(routeItem)};
  }
  return{deals,passports};
}
function proveProjection(p){
  assert(p,'PAYMENTS_PROJECTION_MISSING');
  assert(Array.isArray(p.deals)&&p.deals.length,'PAYMENTS_DEALS_EMPTY');
  for(const d of p.deals){
    assert(d.deal_id,'DEAL_ID_MISSING');
    for(const f of MONEY_FIELDS)assert(authoritative(d[f]),`${d.deal_id}_${f}_NOT_AUTHORITATIVE`);
  }
  const rec=p.finance_authority_projection_reconciliation||null;
  const status=String(rec?.status||'').toUpperCase();
  assert(!['TO_VERIFY','PARTIAL_TO_VERIFY','FAIL','FAIL_CLOSED'].includes(status),`RECON_${status}`);
  if(rec?.mismatch_count!=null)assert(Number(rec.mismatch_count)===0,`RECON_MISMATCH_${rec.mismatch_count}`);
  const snapshot=projectionSnapshot(p);
  const distinct=[];
  for(const [deal_id,passport] of Object.entries(snapshot.passports))for(const item of passport.items)if(item.recipient&&item.beneficiary&&item.recipient!==item.beneficiary)distinct.push({deal_id,...item});
  assert(Object.keys(snapshot.passports).length>0,'PAYMENT_PASSPORTS_MISSING');
  assert(distinct.length>0,'NO_DISTINCT_BUSINESS_RECIPIENT_BANK_BENEFICIARY_SAMPLE');
  return{source_as_of:p.source_as_of||null,reconciliation:rec,snapshot_sha256:hash(JSON.stringify(snapshot)),...snapshot,distinct_recipient_bank_samples:distinct};
}
async function apiProof(token){
  const get=async(url,headers)=>{const r=await fetch(url,{headers:{accept:'application/json','cache-control':'no-store',...headers}});return{r,j:await r.json().catch(()=>null)}};
  const logical=await get(`${PORTAL_API}/v1/admin/bootstrap?_qa=${Date.now()}`,{authorization:`Bearer ${token}`});
  const proxy=await get(`${ORIGIN}/portal/api/v1/admin/bootstrap?_qa=${Date.now()}`,{cookie:`rona_portal_at=${token}`});
  assert(logical.r.ok,`LOGICAL_HTTP_${logical.r.status}`);
  assert(proxy.r.ok,`PROXY_HTTP_${proxy.r.status}`);
  const a=proveProjection(findProjection(logical.j));
  const b=proveProjection(findProjection(proxy.j));
  assert(JSON.stringify(a.deals)===JSON.stringify(b.deals),'LOGICAL_PROXY_DEALS_MISMATCH');
  assert(JSON.stringify(a.passports)===JSON.stringify(b.passports),'LOGICAL_PROXY_PASSPORTS_MISMATCH');
  return b;
}
function scanMoney(text,currencies){
  const safe=currencies.map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  if(!safe.length)return[];
  const re=new RegExp(`(-?\\d[\\d\\s\\u00a0\\u202f]*(?:[.,]\\d+)?)\\s*(${safe.join('|')})\\b`,'gi');
  const out=[];let m;
  while((m=re.exec(String(text||'')))){const n=norm(m[1]);out.push({token:norm(m[0]),fraction_digits:n.match(/[.,](\d+)$/)?.[1]?.length||0});}
  return out;
}
async function uiProof(token,api,evidence){
  const browser=await chromium.launch({headless:true});
  const pageErrors=[],consoleErrors=[],failedRequests=[],network=[];
  try{
    const ctx=await browser.newContext({viewport:{width:1600,height:1200}});
    await ctx.addCookies([{name:'rona_portal_at',value:token,domain:'ronaoil.com',path:'/portal',httpOnly:true,secure:true,sameSite:'Lax'}]);
    const page=await ctx.newPage();
    page.on('pageerror',x=>pageErrors.push(String(x?.stack||x).slice(0,3000)));
    page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text().slice(0,3000))});
    page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText||null}));
    page.on('response',async r=>{const u=r.url();if(!u.includes('/portal/main-ui')&&!u.includes('/portal/payments-v8-ui')&&!u.includes('/portal/api/v1/admin/bootstrap'))return;let h={};try{h=await r.allHeaders()}catch{}network.push({url:u,status:r.status(),money_display:h['x-rona-payments-money-display']||null,payments_ui:h['x-rona-payments-ui']||null,current_runtime:h['x-rona-payments-current-runtime']||null});});

    await page.goto(`${ORIGIN}/portal/admin?_qa=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:45000});
    assert(!page.url().includes('/login'),'AUTH_REDIRECT_TO_LOGIN');
    await page.waitForSelector('#nav button[data-page="payments"]',{state:'visible',timeout:30000});
    await page.locator('#nav button[data-page="payments"]').click();
    const ids=Object.keys(api.deals);
    await page.waitForFunction(ids=>ids.every(id=>document.getElementById('page-payments')?.innerText?.includes(id)),ids,{timeout:45000});
    await page.waitForFunction(()=>globalThis.__RONA_PAYMENTS_V8_UI__?.status==='READY',{timeout:30000});
    const contract=await page.evaluate(()=>({money:globalThis.__RONA_PAYMENTS_MONEY_DISPLAY__||null,ui:globalThis.__RONA_PAYMENTS_V8_UI__||null}));
    assert(contract.money?.contract===MONEY_CONTRACT,`UI_MONEY_CONTRACT_${contract.money?.contract}`);
    assert(Number(contract.money?.maximumFractionDigits)===MAX,`UI_MONEY_MAX_${contract.money?.maximumFractionDigits}`);
    assert(contract.ui?.passportModal==='CANONICAL_V8',`UI_PASSPORT_MODAL_${contract.ui?.passportModal}`);
    await page.screenshot({path:`${OUT}/payments.png`,fullPage:true});

    const currencies=[...new Set(Object.values(api.deals).flatMap(d=>MONEY_FIELDS.map(f=>d[f]?.currency)).filter(Boolean))];
    let opened=0,recipientVerified=0,beneficiaryVerified=0,separateVerified=0,routeVerified=0;
    const modalEvidence=[];
    for(const [dealId,passport] of Object.entries(api.passports)){
      if(!passport.items.length)continue;
      const row=page.locator(`tr[data-deal-id="${dealId}"]`);
      assert(await row.count(),`UI_${dealId}_ROW_MISSING`);
      const trigger=row.locator('.rona-payments-v8-passport-trigger');
      assert(await trigger.count(),`UI_${dealId}_PASSPORT_TRIGGER_MISSING`);
      await trigger.click();
      const modal=page.locator('#ronaPaymentsV8PassportModal');
      await modal.waitFor({state:'visible',timeout:10000});
      opened++;
      const modalDeal=await modal.getAttribute('data-passport-deal-id');
      assert(norm(modalDeal)===norm(dealId),`UI_${dealId}_MODAL_DEAL_MISMATCH:${modalDeal}`);
      const cards=modal.locator('.rona-payments-v8-passport-card[data-passport-item]');
      const cardCount=await cards.count();
      assert(cardCount===passport.items.length,`UI_${dealId}_PASSPORT_ITEM_COUNT_${cardCount}_EXPECTED_${passport.items.length}`);
      const itemEvidence=[];
      for(let i=0;i<passport.items.length;i++){
        const expected=passport.items[i],card=cards.nth(i);
        const get=async field=>norm(await card.locator(`[data-passport-field="${field}"]`).innerText());
        const actual={recipient:await get('recipient'),beneficiary:await get('bank-beneficiary'),bank_route:await get('bank-route')};
        if(expected.recipient){assert(actual.recipient===expected.recipient,`UI_${dealId}_${i}_RECIPIENT_MISMATCH:${actual.recipient}!=${expected.recipient}`);recipientVerified++;}
        if(expected.beneficiary){assert(actual.beneficiary===expected.beneficiary,`UI_${dealId}_${i}_BENEFICIARY_MISMATCH:${actual.beneficiary}!=${expected.beneficiary}`);beneficiaryVerified++;}
        if(expected.bank_route){assert(actual.bank_route===expected.bank_route,`UI_${dealId}_${i}_BANK_ROUTE_MISMATCH:${actual.bank_route}!=${expected.bank_route}`);routeVerified++;}
        if(expected.recipient&&expected.beneficiary&&expected.recipient!==expected.beneficiary){assert(actual.recipient!==actual.beneficiary,`UI_${dealId}_${i}_BANK_OVERWROTE_BUSINESS_RECIPIENT`);separateVerified++;}
        itemEvidence.push({index:i,expected,actual});
      }
      const modalText=await modal.innerText();
      const moneyTokens=scanMoney(modalText,currencies);
      for(const t of moneyTokens)assert(t.fraction_digits<=MAX,`PASSPORT_PRECISION_GT_1:${t.token}`);
      if(opened<=3)await modal.screenshot({path:`${OUT}/passport-${String(dealId).replace(/[^A-Za-z0-9_-]/g,'_')}.png`});
      modalEvidence.push({deal_id:dealId,contract:passport.contract,item_count:passport.items.length,money_tokens:moneyTokens,items:itemEvidence});
      await modal.locator('.rona-payments-v8-passport-close').click();
      await modal.waitFor({state:'detached',timeout:5000});
    }
    assert(opened>0,'NO_PAYMENT_PASSPORT_MODAL_OPENED');
    assert(recipientVerified>0,'NO_BUSINESS_RECIPIENT_VERIFIED');
    assert(beneficiaryVerified>0,'NO_BANK_BENEFICIARY_VERIFIED');
    assert(separateVerified>0,'NO_SEPARATE_RECIPIENT_BANK_PAIR_VERIFIED');
    evidence.ui_diagnostic={network,pageErrors,consoleErrors,failedRequests};
    await ctx.close();
    return{money_contract:contract.money?.contract||null,passport_modal:contract.ui?.passportModal||null,opened_modals:opened,recipient_verified:recipientVerified,beneficiary_verified:beneficiaryVerified,route_verified:routeVerified,separate_recipient_bank_pairs_verified:separateVerified,modals:modalEvidence,network,pageErrors,consoleErrors,failedRequests};
  }finally{await browser.close()}
}

let issued,failure;
const evidence={mode:'READ_ONLY',scope:'PAYMENTS_V8_PASSPORT_ROUTING',baseline_release:process.env.BASELINE_RELEASE_SHA||null,live_release:process.env.LIVE_RELEASE_SHA||null,run_id:process.env.GITHUB_RUN_ID,sha:process.env.GITHUB_SHA,result:'FAIL'};
try{
  issued=await issuer('/',{expectedHead:process.env.GITHUB_SHA});
  const token=issued?.session?.access_token;
  assert(token,'SESSION_TOKEN_MISSING');
  evidence.api=await apiProof(token);
  evidence.api_result='PASS';
  evidence.ui=await uiProof(token,evidence.api,evidence);
  evidence.ui_result='PASS';
  evidence.result='PASS';
}catch(x){failure=x;evidence.failure=String(x?.stack||x).slice(0,16000);evidence.ui_result=evidence.ui_result||'FAIL';}
finally{
  if(issued){try{const c=await issuer('/cleanup',{});evidence.cleanup={ok:true,retired:c.retired??null}}catch(x){evidence.cleanup={ok:false,error:String(x?.message||x)}}}
  evidence.finished_at=new Date().toISOString();
  await writeFile(`${OUT}/evidence.json`,JSON.stringify(evidence,null,2));
}
if(failure)throw failure;
assert(evidence.cleanup?.ok,'CLEANUP_FAILED');
console.log('PAYMENTS_V8_PASSPORT_ROUTING_AUTHENTICATED_PRODUCTION_E2E=PASS');
console.log('PAYMENTS_V8_PASSPORT_MODAL_OPEN_REQUIRED=PASS');
console.log('PAYMENTS_V8_BUSINESS_RECIPIENT_SEPARATE_FROM_BANK=PASS');
console.log('PAYMENTS_V8_PASSPORT_MONEY_DISPLAY_MAX_1=PASS');
console.log('PAYMENTS_V8_FINANCE_AUTHORITY_MUTATION=NONE');
console.log('PAYMENTS_V8_PAYMENT_RECORD_MUTATION=NONE');
console.log('PAYMENTS_V8_QA_SESSION_CLEANUP=PASS');
