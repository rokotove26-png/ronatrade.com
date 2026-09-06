import {readFile,writeFile,unlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

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
  "const RAW={A:raw('A'),B:raw('B')};\nconst AUTHORITATIVE_COMPANY_METRICS={A:{applications_total:0,deals_total:2,documents_total:5,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'},B:{applications_total:1,deals_total:1,documents_total:3,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'}};\n",
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
process.exitCode=result.status??1;
