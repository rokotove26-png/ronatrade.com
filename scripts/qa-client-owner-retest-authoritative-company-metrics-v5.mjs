import {readFile,writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const sourceUrl=new URL('./qa-client-owner-retest-real-browser-v4.mjs',import.meta.url);
const generatedUrl=new URL('./.qa-client-owner-retest-real-browser-v5.generated.mjs',import.meta.url);
let source=await readFile(sourceUrl,'utf8');

function replaceRegexOnce(re,replacement,label){
  const matches=source.match(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))||[];
  if(matches.length!==1)throw new Error(`${label}: expected exactly one source match, got ${matches.length}`);
  source=source.replace(re,replacement);
}
function replaceTextOnce(from,to,label){
  const first=source.indexOf(from),last=source.lastIndexOf(from);
  if(first<0||first!==last)throw new Error(`${label}: expected exactly one source match`);
  source=source.replace(from,to);
}

replaceTextOnce(
  "const RAW={A:raw('A'),B:raw('B')};\n",
  "const RAW={A:raw('A'),B:raw('B')};\nconst AUTHORITATIVE_COMPANY_METRICS={A:{applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'},B:{applications_total:1,deals_total:1,documents_total:3,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'}};\n",
  'AUTHORITATIVE_COMPANY_METRICS_FIXTURE'
);

replaceRegexOnce(
  /^function expected\(name\)\{.*\}$/m,
  "function expected(name){const r=RAW[name],first=r.deals.find(activeDeal),src=commercialSource(name,first.deal_id),metrics=AUTHORITATIVE_COMPANY_METRICS[name];return{client:r.contract.client_id,contract:r.contract.contract_id,legal:r.contract.legal_name,external:r.contract.current_external_contract_number,applications:metrics.applications_total,deals:metrics.deals_total,documents:metrics.documents_total,array_lengths:{applications:r.applications.length,deals:r.deals.length,documents:r.documents.length},active_ids:r.deals.filter(activeDeal).map(x=>x.deal_id),terminal_ids:r.deals.filter(d=>!activeDeal(d)).map(x=>x.deal_id),passport:first.deal_id,amount:src.obligation_amount,currency:src.currency,source_application_id:src.application_id}}",
  'AUTHORITATIVE_COMPANY_METRICS_EXPECTED'
);

replaceRegexOnce(
  /^const SOURCE_MAP=.*$/m,
  "const SOURCE_MAP={endpoint:'/portal/api/v1/client/context',passport:{relation:'portal_private.client_applications JOIN portal_private.owner_application_workflow',amount:'quantity_tonnes * proposed_price',currency:'proposed_currency',filter:\"status=DEAL_REGISTERED AND business_status=DEAL AND counter_offer_used=false AND finalized_at IS NOT NULL\",backend:'projectClientDeals -> dedicated Passport commercial projection',api_amount:'data.deals[].passport_amount',api_currency:'data.deals[].passport_currency',api_source:'data.deals[].passport_amount_source',api_application:'data.deals[].passport_application_id',consumer:'client-deals-authoritative-v1 authoritativeAmount',dom:'native Passport СУММА'},kpi:{legal_name:'data.contract.legal_name',applications:'data.company_metrics.applications_total',deals:'data.company_metrics.deals_total',documents:'data.company_metrics.documents_total',source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',reference:'authoritative current-context company_metrics'}};",
  'AUTHORITATIVE_COMPANY_METRICS_SOURCE_MAP'
);

replaceRegexOnce(
  /^await nav\(page,'companies'\);await sleep\(450\);.*CURRENT_COMPANY_CARD_AND_COUNTERS.*$/m,
  "await nav(page,'companies');await sleep(450);const neutralCp=await companyProof(page,EXP.A),neutralMeta=await page.evaluate(e=>{const card=document.querySelector(`[data-rona-client-id=\\\"${e.client}\\\"][data-rona-client-contract-id=\\\"${e.contract}\\\"]`);return{hydration:card?.dataset?.ronaCompanyDirectoryHydration||'',source:card?.dataset?.ronaCompanyDirectorySource||'',predicate:card?.dataset?.ronaCompanyDirectoryDocumentsPredicate||''}},EXP.A),neutralProof={visible:neutralCp.metrics,dashes:(neutralCp.text.match(/—/g)||[]).length,meta:neutralMeta};console.log('MY_COMPANIES_MISSING_METRICS_NEUTRAL_PROOF',JSON.stringify(neutralProof));if(!neutralCp.found||!Object.values(neutralCp.contains).every(Boolean)||neutralCp.metrics.applications!==null||neutralCp.metrics.deals!==null||neutralCp.metrics.documents!==null||neutralProof.dashes<3||neutralMeta.hydration!=='pending'||neutralMeta.source!=='AUTHORITATIVE_METRICS_UNAVAILABLE')fail(failures,'COMPANY_KPI_MISSING_METRICS_NOT_NEUTRAL',{neutralCp,neutralProof});RAW.A.company_metrics={...AUTHORITATIVE_COMPANY_METRICS.A};const metricsReqStart=requests.length;await page.evaluate(b=>window.RONA_CLIENT_CONTEXT.select(b.client_id,b.contract_id),FIX.B);const switchedToB=await wait(page,b=>window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.client_id===b.client_id&&window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.contract_id===b.contract_id&&window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()?.contract?.client_id===b.client_id,FIX.B,3000);await page.evaluate(a=>window.RONA_CLIENT_CONTEXT.select(a.client_id,a.contract_id),FIX.A);const selectedBack=await wait(page,a=>window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.client_id===a.client_id&&window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.contract_id===a.contract_id&&window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()?.contract?.client_id===a.client_id,FIX.A,4000);const metricsReady=await wait(page,e=>{const card=document.querySelector(`[data-rona-client-id=\\\"${e.client}\\\"][data-rona-client-contract-id=\\\"${e.contract}\\\"]`);return card?.dataset?.ronaCompanyDirectoryHydration==='ready'&&card?.dataset?.ronaCompanyDirectorySource==='AUTHORITATIVE_CURRENT_CONTEXT_DB'&&card?.dataset?.ronaCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'},EXP.A,4000);await sleep(120);const cp=await companyProof(page,EXP.A),metricMeta=await page.evaluate(e=>{const card=document.querySelector(`[data-rona-client-id=\\\"${e.client}\\\"][data-rona-client-contract-id=\\\"${e.contract}\\\"]`);return{hydration:card?.dataset?.ronaCompanyDirectoryHydration||'',source:card?.dataset?.ronaCompanyDirectorySource||'',predicate:card?.dataset?.ronaCompanyDirectoryDocumentsPredicate||''}},EXP.A),metricRequests=requests.slice(metricsReqStart).filter(x=>x.label===LABEL&&x.path==='/portal/api/v1/client/context'&&x.client_id===EXP.A.client&&x.contract_id===EXP.A.contract),cproof={array_lengths:EXP.A.array_lengths,authoritative:AUTHORITATIVE_COMPANY_METRICS.A,expected:{applications:EXP.A.applications,deals:EXP.A.deals,documents:EXP.A.documents},visible:cp.metrics,legal:cp.contains.legal,switchedToB,selectedBack,metricsReady,metricMeta,context_requests:metricRequests};console.log('MY_COMPANIES_AUTHORITATIVE_METRICS_PROOF',JSON.stringify(cproof));if(!switchedToB||!selectedBack||!metricsReady||!metricRequests.length||!cp.found||!Object.values(cp.contains).every(Boolean)||cp.metrics.applications!==EXP.A.applications||cp.metrics.deals!==EXP.A.deals||cp.metrics.documents!==EXP.A.documents||metricMeta.hydration!=='ready'||metricMeta.source!=='AUTHORITATIVE_CURRENT_CONTEXT_DB'||metricMeta.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')fail(failures,'CURRENT_COMPANY_CARD_AND_COUNTERS',{cp,cproof});",
  'AUTHORITATIVE_COMPANY_METRICS_TWO_PHASE_ASSERTION'
);

replaceTextOnce(
  "'production-semantic-company-kpis-mixed-status','one-visible-row-per-active-authoritative-deal-terminal-hidden'",
  "'production-semantic-company-kpis-mixed-status','authoritative-company-kpis-neutral-then-ready','one-visible-row-per-active-authoritative-deal-terminal-hidden'",
  'AUTHORITATIVE_COMPANY_METRICS_ASSERTION_MARKER'
);

if(!source.includes('MY_COMPANIES_MISSING_METRICS_NEUTRAL_PROOF')||!source.includes('MY_COMPANIES_AUTHORITATIVE_METRICS_PROOF'))throw new Error('AUTHORITATIVE_COMPANY_METRICS_PROOF_MARKERS_MISSING');
if(!source.includes("source:'AUTHORITATIVE_CURRENT_CONTEXT_DB'")||!source.includes("documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'"))throw new Error('AUTHORITATIVE_COMPANY_METRICS_CONTRACT_MISSING');

async function nestedCompanyCardOwnerFixture(){
  const runtimePath=fileURLToPath(new URL('../assets/portal-runtime/client-contract-download-v3.js',import.meta.url));
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1200,height:800}}),page=await ctx.newPage();
    const client='QA-NESTED-CLIENT-001',contract='QA-NESTED-CTR-001';
    await page.route('**/portal/api/v1/client/context**',async route=>{await new Promise(resolve=>setTimeout(resolve,650));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data:{contract:{client_id:client,contract_id:contract,legal_name:'Future Nested Client LLC',current_external_contract_number:'QA-NESTED-EXT-001',contract_status:'ACTIVE',effective_from:'2099-01-01'},applications:[],deals:[],documents:[],payments:[],company_metrics:{applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'}}})})});
    await page.setContent(`<base href="http://fixture.test/"><main><section id="metricOwner" style="display:block;width:640px;height:320px"><div>Текущая компания</div><div>Future Nested Client LLC</div><div id="identityAnchor" data-rona-client-id="${client}" data-rona-client-contract-id="${contract}" style="display:block;width:260px;height:24px">${client} ${contract}</div><div class="metric"><strong>9</strong><span>ЗАЯВОК</span></div><div class="metric"><strong>8</strong><span>СДЕЛОК</span></div><div class="metric"><strong>7</strong><span>ДЕЙСТВИЙ</span></div><div>Подписанный контракт</div></section></main>`,{waitUntil:'domcontentloaded'});
    const initial=await page.evaluate(({client,contract})=>{const anchor=document.querySelector(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`),owner=document.getElementById('metricOwner');return{depth:anchor?.parentElement===owner?1:null,stale:String(owner?.innerText||'').includes('9')&&String(owner?.innerText||'').includes('8')&&String(owner?.innerText||'').includes('7')}},{client,contract});
    if(initial.depth!==1||!initial.stale)throw new Error(`NESTED_COMPANY_CARD_OWNER_FIXTURE_INVALID ${JSON.stringify(initial)}`);
    await page.evaluate(({client,contract})=>{const current={client_id:client,contract_id:contract,legal_name:'Future Nested Client LLC',current_external_contract_number:'QA-NESTED-EXT-001',contract_status:'ACTIVE',effective_from:'2099-01-01'};window.RONA_CLIENT_CONTEXT={whenReady:async()=>true,getCurrentContext:()=>current,getCurrentProjection:()=>null,whenCurrentProjection:async()=>null,subscribe:()=>()=>{}}},{client,contract});
    await page.addScriptTag({path:runtimePath});
    await page.waitForFunction(({client,contract})=>{const owner=document.querySelector(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`);return owner?.id==='metricOwner'&&owner.dataset.ronaCompanyDirectoryHydration==='pending'&&owner.dataset.ronaCompanyDirectorySource==='AUTHORITATIVE_METRICS_UNAVAILABLE'},{client,contract},{timeout:3000});
    const pending=await page.evaluate(({client,contract})=>{const n=v=>String(v??'').replace(/\s+/g,' ').trim(),owner=document.querySelector(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`),anchor=document.getElementById('identityAnchor');const metric=label=>{const l=[...owner.querySelectorAll('*')].find(x=>x.childElementCount===0&&n(x.textContent).toLocaleLowerCase('ru-RU')===label);const row=l?.parentElement;const value=[...(row?.querySelectorAll('*')||[])].find(x=>x!==l&&x.childElementCount===0&&/^(?:\d+|—)$/.test(n(x.textContent)));return n(value?.textContent)};return{owner_id:owner?.id||'',exact_count:document.querySelectorAll(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`).length,inner_binding:anchor?.hasAttribute('data-rona-client-id')||anchor?.hasAttribute('data-rona-client-contract-id'),metrics:[metric('заявок'),metric('сделок'),metric('документов')],hydration:owner?.dataset.ronaCompanyDirectoryHydration||'',source:owner?.dataset.ronaCompanyDirectorySource||'',predicate:owner?.dataset.ronaCompanyDirectoryDocumentsPredicate||'',text:n(owner?.innerText)}},{client,contract});
    if(pending.owner_id!=='metricOwner'||pending.exact_count!==1||pending.inner_binding||pending.metrics.join('/')!=='—/—/—'||pending.hydration!=='pending'||pending.source!=='AUTHORITATIVE_METRICS_UNAVAILABLE'||pending.predicate!==''||/[789]/.test(pending.text))throw new Error(`NESTED_COMPANY_CARD_OWNER_PENDING_FAIL ${JSON.stringify(pending)}`);
    console.log('NESTED_COMPANY_CARD_OWNER_PENDING=PASS depth=1 metrics=—/—/—');
    console.log('NESTED_COMPANY_CARD_OWNER_STALE_KPI=ABSENT');
    await page.waitForFunction(({client,contract})=>{const owner=document.querySelector(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`);return owner?.dataset.ronaCompanyDirectoryHydration==='ready'&&owner.dataset.ronaCompanyDirectorySource==='AUTHORITATIVE_CURRENT_CONTEXT_DB'&&owner.dataset.ronaCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'},{client,contract},{timeout:4000});
    const ready=await page.evaluate(({client,contract})=>{const n=v=>String(v??'').replace(/\s+/g,' ').trim(),owner=document.querySelector(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`);const metric=label=>{const l=[...owner.querySelectorAll('*')].find(x=>x.childElementCount===0&&n(x.textContent).toLocaleLowerCase('ru-RU')===label);const row=l?.parentElement;const value=[...(row?.querySelectorAll('*')||[])].find(x=>x!==l&&x.childElementCount===0&&/^(?:\d+|—)$/.test(n(x.textContent)));return n(value?.textContent)};return{metrics:[metric('заявок'),metric('сделок'),metric('документов')],exact_count:document.querySelectorAll(`[data-rona-client-id="${client}"][data-rona-client-contract-id="${contract}"]`).length,hydration:owner?.dataset.ronaCompanyDirectoryHydration||'',source:owner?.dataset.ronaCompanyDirectorySource||'',predicate:owner?.dataset.ronaCompanyDirectoryDocumentsPredicate||''}},{client,contract});
    if(ready.metrics.join('/')!=='2/2/5'||ready.exact_count!==1||ready.hydration!=='ready'||ready.source!=='AUTHORITATIVE_CURRENT_CONTEXT_DB'||ready.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')throw new Error(`NESTED_COMPANY_CARD_OWNER_READY_FAIL ${JSON.stringify(ready)}`);
    console.log('NESTED_COMPANY_CARD_OWNER_READY=PASS owner=unique metrics=2/2/5');
    await ctx.close();
  }finally{await browser.close()}
}

const generatedPath=fileURLToPath(generatedUrl);
await writeFile(generatedPath,source,'utf8');
console.log('OWNER_RETEST_QA_FIXTURE_ADAPTER=AUTHORITATIVE_COMPANY_METRICS_V1');
let result;
try{
  result=spawnSync(process.execPath,[generatedPath],{cwd:process.cwd(),env:process.env,stdio:'inherit'});
}finally{
  await unlink(generatedPath).catch(()=>{});
}
if(result.error)throw result.error;
if(result.signal)throw new Error(`OWNER_RETEST_GENERATED_HARNESS_SIGNAL=${result.signal}`);
const status=result.status??1;
if(status===0){
  await nestedCompanyCardOwnerFixture();
  const productFiles=['assets/portal-runtime/client-contract-download-v3.js','supabase/functions/rona-portal-api/bootstrap.ts','functions/portal/api/v1/client/context.js'];
  const syntheticBusinessLiterals=/CLIENT-B|CONTRACT-B|BOOTSTRAP ALIAS B|BETA ENERGY LLC|DEAL-2099-201|QA-NESTED-CLIENT|QA-NESTED-CTR/iu;
  for(const path of productFiles){const text=await readFile(path,'utf8');if(syntheticBusinessLiterals.test(text))throw new Error(`SYNTHETIC_FUTURE_CLIENT_LEAKED_INTO_PRODUCT_RUNTIME ${path}`)}
  console.log('GENERIC_FUTURE_CLIENT_BROWSER_FIXTURE=PASS client=CLIENT-B contract=CONTRACT-B path=CANONICAL_CURRENT_CONTEXT');
  console.log('A_B_A_CURRENT_CONTEXT_ISOLATION=PASS');
  console.log('SYNTHETIC_FUTURE_CLIENT_PRODUCT_HARDCODING=ABSENT');
}
process.exitCode=status;
