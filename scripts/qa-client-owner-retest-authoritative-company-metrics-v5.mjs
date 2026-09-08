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
  "const RAW={A:raw('A'),B:raw('B')};\nconst CURRENT_COMPANY_METRICS={A:{applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'},B:{applications_total:1,deals_total:1,documents_total:3,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'}};\nfor(const name of ['A','B']){RAW[name].company_metrics={...CURRENT_COMPANY_METRICS[name]};const first=RAW[name].documents[0];first.document_type='CONTRACT';first.storage_object_id='QA-STORAGE-'+name;first.authoritative_filename='Contract-'+name+'.pdf';}\nconst AUTHORITATIVE_COMPANY_DIRECTORY={A:{client_id:FIX.A.client_id,legal_name:FIX.A.legal,contract_id:FIX.A.contract_id,current_external_contract_number:FIX.A.external,contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31',applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',current_signed_contract:{document_id:RAW.A.documents[0].document_id,storage_object_id:RAW.A.documents[0].storage_object_id,authoritative_filename:RAW.A.documents[0].authoritative_filename}},B:{client_id:FIX.B.client_id,legal_name:FIX.B.legal,contract_id:FIX.B.contract_id,current_external_contract_number:FIX.B.external,contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31',applications_total:1,deals_total:1,documents_total:3,source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',current_signed_contract:{document_id:RAW.B.documents[0].document_id,storage_object_id:RAW.B.documents[0].storage_object_id,authoritative_filename:RAW.B.documents[0].authoritative_filename}}};\nlet companyDirectoryMode='full';\n",
  'AUTHORITATIVE_COMPANY_DIRECTORY_FIXTURE'
);

replaceRegexOnce(
  /^function expected\(name\)\{.*\}$/m,
  "function expected(name){const r=RAW[name],first=r.deals.find(activeDeal),src=commercialSource(name,first.deal_id),metrics=AUTHORITATIVE_COMPANY_DIRECTORY[name];return{client:r.contract.client_id,contract:r.contract.contract_id,legal:r.contract.legal_name,external:r.contract.current_external_contract_number,applications:metrics.applications_total,deals:metrics.deals_total,documents:metrics.documents_total,array_lengths:{applications:r.applications.length,deals:r.deals.length,documents:r.documents.length},active_ids:r.deals.filter(activeDeal).map(x=>x.deal_id),terminal_ids:r.deals.filter(d=>!activeDeal(d)).map(x=>x.deal_id),passport:first.deal_id,amount:src.obligation_amount,currency:src.currency,source_application_id:src.application_id}}",
  'AUTHORITATIVE_COMPANY_DIRECTORY_EXPECTED'
);

replaceRegexOnce(
  /^const SOURCE_MAP=.*$/m,
  "const SOURCE_MAP={endpoint:'/portal/api/v1/client/context',passport:{relation:'portal_private.client_applications JOIN portal_private.owner_application_workflow',amount:'quantity_tonnes * proposed_price',currency:'proposed_currency',filter:\"status=DEAL_REGISTERED AND business_status=DEAL AND counter_offer_used=false AND finalized_at IS NOT NULL\",backend:'projectClientDeals -> dedicated Passport commercial projection',api_amount:'data.deals[].passport_amount',api_currency:'data.deals[].passport_currency',api_source:'data.deals[].passport_amount_source',api_application:'data.deals[].passport_application_id',consumer:'client-deals-authoritative-v1 authoritativeAmount',dom:'native Passport СУММА'},kpi:{endpoint:'/portal/api/v1/client/bootstrap',applications:'data.company_directory[].applications_total',deals:'data.company_directory[].deals_total',documents:'data.company_directory[].documents_total',source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',chain:'raw native bootstrap -> RONA_CLIENT_CONTEXT -> company directory runtime'}};",
  'AUTHORITATIVE_COMPANY_DIRECTORY_SOURCE_MAP'
);

replaceTextOnce(
  "async function api(label,req,res,u){const c=",
  "async function api(label,req,res,u){if(u.pathname==='/__qa/company-directory-mode'){companyDirectoryMode=u.searchParams.get('value')==='partial'?'partial':'full';send(res,{ok:true,mode:companyDirectoryMode});return true}const c=",
  'AUTHORITATIVE_COMPANY_DIRECTORY_MODE_ENDPOINT'
);
replaceTextOnce(
  "if(u.pathname==='/portal/api/v1/client/bootstrap')b={ok:true,data:{contexts:[context('A'),context('B')],selected_context:context('A'),requires_context_selection:false}};",
  "if(u.pathname==='/portal/api/v1/client/bootstrap'){const full=[AUTHORITATIVE_COMPANY_DIRECTORY.A,AUTHORITATIVE_COMPANY_DIRECTORY.B],company_directory=companyDirectoryMode==='full'?full:[AUTHORITATIVE_COMPANY_DIRECTORY.A];b={ok:true,data:{contexts:[context('A'),context('B')],selected_context:context('A'),requires_context_selection:false,company_directory,company_directory_source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'}};}",
  'AUTHORITATIVE_COMPANY_DIRECTORY_BOOTSTRAP'
);

const companyAssertion=String.raw`
await nav(page,'companies');await sleep(650);
const directoryReady=await wait(page,()=>{const cards=[...document.querySelectorAll('article.company-switch-card[data-rona-client-id][data-rona-client-contract-id]')];return cards.length===2&&cards.every(card=>card.dataset.ronaCompanyDirectoryHydration==='ready'&&card.dataset.ronaCompanyDirectorySource==='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'&&card.dataset.ronaCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'&&!/действий/iu.test(card.innerText||'')&&card.querySelector('button[data-rona-company-contract-download],button[data-rona-contract-download-v3]'))},null,5000);
const cp=await companyProof(page,EXP.A),bp=await companyProof(page,EXP.B);
const directoryState=await page.evaluate(()=>[...document.querySelectorAll('article.company-switch-card[data-rona-client-id][data-rona-client-contract-id]')].map(card=>({client:card.dataset.ronaClientId,contract:card.dataset.ronaClientContractId,source:card.dataset.ronaCompanyDirectorySource,predicate:card.dataset.ronaCompanyDirectoryDocumentsPredicate,hydration:card.dataset.ronaCompanyDirectoryHydration,current:card.dataset.ronaCompanyCurrent||'',downloads:card.querySelectorAll('button[data-rona-company-contract-download],button[data-rona-contract-download-v3]').length,text:String(card.innerText||'')})));
console.log('MY_COMPANIES_AUTHORITATIVE_DIRECTORY_PROOF',JSON.stringify({directoryReady,a:cp.metrics,b:bp.metrics,state:directoryState}));
if(!directoryReady||!cp.found||!bp.found||cp.metrics.applications!==EXP.A.applications||cp.metrics.deals!==EXP.A.deals||cp.metrics.documents!==EXP.A.documents||bp.metrics.applications!==EXP.B.applications||bp.metrics.deals!==EXP.B.deals||bp.metrics.documents!==EXP.B.documents||directoryState.some(x=>x.source!=='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'||x.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'||x.hydration!=='ready'||x.downloads<1||/действий/iu.test(x.text)))fail(failures,'CURRENT_COMPANY_CARD_AND_COUNTERS',{cp,bp,directoryState});
await page.evaluate(()=>{window.__qaLegacyCompanyClicks=0;document.querySelector('#clientCompanyGrid')?.addEventListener('click',()=>{window.__qaLegacyCompanyClicks+=1})});
const beforeContract=await page.evaluate(()=>window.RONA_CLIENT_CONTEXT.getCurrentContext());
const contractClicked=await page.evaluate(b=>{const card=document.querySelector('article.company-switch-card[data-rona-client-id="'+b.client_id+'"][data-rona-client-contract-id="'+b.contract_id+'"]'),button=card?.querySelector('button[data-rona-company-contract-download],button[data-rona-contract-download-v3]');if(!button)return false;button.click();return true},FIX.B);await sleep(120);
const afterContract=await page.evaluate(()=>({current:window.RONA_CLIENT_CONTEXT.getCurrentContext(),legacy:window.__qaLegacyCompanyClicks}));
if(!contractClicked||afterContract.current?.client_id!==beforeContract?.client_id||afterContract.current?.contract_id!==beforeContract?.contract_id)fail(failures,'COMPANY_CONTRACT_CLICK_SWITCHED_CONTEXT',{beforeContract,afterContract});
const clickOpen=async fixture=>page.evaluate(f=>{const card=document.querySelector('article.company-switch-card[data-rona-client-id="'+f.client_id+'"][data-rona-client-contract-id="'+f.contract_id+'"]'),action=[...(card?.querySelectorAll('button,a,[role="button"]')||[])].find(el=>/открыть\s+компанию/iu.test(String(el.textContent||'')));if(!action)return false;action.click();return true},fixture);
const openB=await clickOpen(FIX.B),switchedB=await wait(page,b=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.(),s=document.getElementById('clientContextSelect'),card=document.querySelector('article.company-switch-card[data-rona-client-id="'+b.client_id+'"][data-rona-client-contract-id="'+b.contract_id+'"]');return c?.client_id===b.client_id&&c?.contract_id===b.contract_id&&s?.dataset?.clientId===b.client_id&&s?.dataset?.contractId===b.contract_id&&document.documentElement.dataset.ronaClientId===b.client_id&&document.documentElement.dataset.ronaContractId===b.contract_id&&card?.dataset?.ronaCompanyCurrent==='true'},FIX.B,5000);
const convergeB=await page.evaluate(b=>{const slots=[...document.querySelectorAll('[data-rona-current-context-slot]')].map(x=>String(x.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);return{current:window.RONA_CLIENT_CONTEXT.getCurrentContext(),selector:{client:document.getElementById('clientContextSelect')?.dataset?.clientId||'',contract:document.getElementById('clientContextSelect')?.dataset?.contractId||''},html:{client:document.documentElement.dataset.ronaClientId||'',contract:document.documentElement.dataset.ronaContractId||''},slots,legacy:window.__qaLegacyCompanyClicks,slot_converged:slots.some(x=>x.includes(b.client_id)||x.includes(b.contract_id)||x.includes(b.external)||x.includes(b.legal))}},FIX.B);
if(!openB||!switchedB||convergeB.legacy!==0||!convergeB.slot_converged)fail(failures,'COMPANY_CARD_B_CENTRAL_SWITCH_CONVERGENCE',{openB,switchedB,convergeB});
const openA=await clickOpen(FIX.A),switchedA=await wait(page,a=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.(),s=document.getElementById('clientContextSelect'),card=document.querySelector('article.company-switch-card[data-rona-client-id="'+a.client_id+'"][data-rona-client-contract-id="'+a.contract_id+'"]');return c?.client_id===a.client_id&&c?.contract_id===a.contract_id&&s?.dataset?.clientId===a.client_id&&s?.dataset?.contractId===a.contract_id&&document.documentElement.dataset.ronaClientId===a.client_id&&document.documentElement.dataset.ronaContractId===a.contract_id&&card?.dataset?.ronaCompanyCurrent==='true'},FIX.A,5000);
if(!openA||!switchedA||await page.evaluate(()=>window.__qaLegacyCompanyClicks)!==0)fail(failures,'COMPANY_CARD_A_B_A_CENTRAL_SWITCH',{openA,switchedA,legacy:await page.evaluate(()=>window.__qaLegacyCompanyClicks)});
for(let cycle=1;cycle<=5;cycle++){
  await page.reload({waitUntil:'domcontentloaded',timeout:30000});const readyCycle=await ensureProjection(page,FIX.A);await nav(page,'companies');const cardsReady=await wait(page,()=>[...document.querySelectorAll('article.company-switch-card')].filter(x=>x.isConnected&&x.dataset.ronaCompanyDirectoryHydration==='ready'&&x.dataset.ronaCompanyDirectorySource==='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB').length===2,null,5000);const bOk=await clickOpen(FIX.B);const bSelected=await wait(page,b=>window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.client_id===b.client_id&&window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.contract_id===b.contract_id,FIX.B,4000);const aOk=await clickOpen(FIX.A);const aSelected=await wait(page,a=>window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.client_id===a.client_id&&window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.contract_id===a.contract_id,FIX.A,4000);await nav(page,'home');await nav(page,'companies');const stable=await page.evaluate(()=>{const cards=[...document.querySelectorAll('article.company-switch-card')].filter(x=>x.isConnected);return{count:cards.length,bad:cards.some(c=>c.dataset.ronaCompanyDirectoryHydration!=='ready'||c.dataset.ronaCompanyDirectorySource!=='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'||/действий/iu.test(c.innerText||'')||!c.querySelector('button[data-rona-company-contract-download],button[data-rona-contract-download-v3]'))}});console.log('COMPANY_DIRECTORY_STABILITY_CYCLE',JSON.stringify({cycle,readyCycle,cardsReady,bOk,bSelected,aOk,aSelected,stable}));if(!readyCycle.ok||!cardsReady||!bOk||!bSelected||!aOk||!aSelected||stable.count!==2||stable.bad)fail(failures,'COMPANY_DIRECTORY_FIVE_CYCLE_STABILITY',{cycle,readyCycle,cardsReady,bOk,bSelected,aOk,aSelected,stable});
}
await page.evaluate(()=>fetch('/__qa/company-directory-mode?value=partial',{cache:'no-store'}));const bootstrapBefore=requests.length;const incomplete=await page.evaluate(async()=>{try{await window.RONA_CLIENT_CONTEXT.refreshCompanyDirectory('targeted-incomplete');return{ok:true}}catch(error){return{ok:false,error:String(error?.message||error)}}});await sleep(180);const retained=await page.evaluate(()=>{const cards=[...document.querySelectorAll('article.company-switch-card')].filter(x=>x.isConnected);return{cards:cards.map(c=>({source:c.dataset.ronaCompanyDirectorySource,predicate:c.dataset.ronaCompanyDirectoryDocumentsPredicate,hydration:c.dataset.ronaCompanyDirectoryHydration,text:String(c.innerText||''),download:!!c.querySelector('button[data-rona-company-contract-download],button[data-rona-contract-download-v3]')})),directory:window.RONA_CLIENT_CONTEXT.getCompanyDirectory()}});const bootstrapTrace=requests.slice(bootstrapBefore).filter(x=>x.label===LABEL&&x.path==='/portal/api/v1/client/bootstrap');console.log('COMPANY_DIRECTORY_INCOMPLETE_DETERMINISTIC_PROOF',JSON.stringify({incomplete,retained,bootstrapTrace}));if(incomplete.ok||!String(incomplete.error||'').includes('CLIENT_COMPANY_DIRECTORY_INCOMPLETE')||retained.cards.length!==2||retained.cards.some(c=>c.source!=='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'||c.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'||c.hydration!=='ready'||/действий/iu.test(c.text)||!c.download)||bootstrapTrace.some(x=>/portal-client-company-directory-authority/iu.test(x.source))||!bootstrapTrace.some(x=>/client-context-selection-authority-v1:directory-refresh/iu.test(x.source)))fail(failures,'COMPANY_DIRECTORY_INCOMPLETE_NOT_DETERMINISTIC',{incomplete,retained,bootstrapTrace});
await page.evaluate(()=>fetch('/__qa/company-directory-mode?value=full',{cache:'no-store'}));
`;
replaceRegexOnce(/^await nav\(page,'companies'\);await sleep\(450\);.*CURRENT_COMPANY_CARD_AND_COUNTERS.*$/m,companyAssertion,'AUTHORITATIVE_COMPANY_DIRECTORY_CENTRAL_SWITCH_ASSERTION');

replaceTextOnce(
  "'production-semantic-company-kpis-mixed-status','one-visible-row-per-active-authoritative-deal-terminal-hidden'",
  "'production-semantic-company-kpis-mixed-status','all-authorized-directory-single-bootstrap-owner','company-card-central-switch-a-b-a','contract-click-no-switch','five-cycle-company-card-stability','incomplete-directory-deterministic-fail','one-visible-row-per-active-authoritative-deal-terminal-hidden'",
  'AUTHORITATIVE_COMPANY_DIRECTORY_ASSERTION_MARKER'
);

for(const marker of ['AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB','CURRENT_EFFECTIVE_CONTRACTUAL_ONLY','COMPANY_CARD_B_CENTRAL_SWITCH_CONVERGENCE','COMPANY_DIRECTORY_FIVE_CYCLE_STABILITY','COMPANY_DIRECTORY_INCOMPLETE_DETERMINISTIC_PROOF'])if(!source.includes(marker))throw new Error(`AUTHORITATIVE_COMPANY_DIRECTORY_PROOF_MARKER_MISSING:${marker}`);

const generatedPath=fileURLToPath(generatedUrl);
await writeFile(generatedPath,source,'utf8');
const generatedSyntax=spawnSync(process.execPath,['--check',generatedPath],{cwd:process.cwd(),env:process.env,stdio:'inherit'});
if(generatedSyntax.error){await unlink(generatedPath).catch(()=>{});throw generatedSyntax.error}
if(generatedSyntax.signal){await unlink(generatedPath).catch(()=>{});throw new Error(`OWNER_RETEST_GENERATED_SYNTAX_SIGNAL=${generatedSyntax.signal}`)}
if((generatedSyntax.status??1)!==0){await unlink(generatedPath).catch(()=>{});throw new Error(`OWNER_RETEST_GENERATED_SYNTAX_FAIL status=${generatedSyntax.status??1}`)}
console.log('OWNER_RETEST_GENERATED_SYNTAX=PASS');
console.log('OWNER_RETEST_QA_FIXTURE_ADAPTER_CURRENT=AUTHORITATIVE_COMPANY_DIRECTORY_CENTRAL_SWITCH_V3');
let result;
try{result=spawnSync(process.execPath,[generatedPath],{cwd:process.cwd(),env:process.env,stdio:'inherit'})}finally{await unlink(generatedPath).catch(()=>{})}
if(result.error)throw result.error;
if(result.signal)throw new Error(`OWNER_RETEST_GENERATED_HARNESS_SIGNAL=${result.signal}`);
const status=result.status??1;
if(status===0){
  const productFiles=['assets/portal-runtime/client-context-selection-authority-v1.js','assets/portal-runtime/client-contract-download-v3.js','assets/portal-runtime/portal-client-company-directory-authority-v1.js','supabase/functions/rona-portal-api/bootstrap.ts','functions/portal/api/v1/client/context.js'];
  const syntheticBusinessLiterals=/CLIENT-B|CONTRACT-B|BOOTSTRAP ALIAS B|BETA ENERGY LLC|DEAL-2099-201|QA-NESTED-CLIENT|QA-NESTED-CTR/iu;
  for(const path of productFiles){const text=await readFile(path,'utf8');if(syntheticBusinessLiterals.test(text))throw new Error(`SYNTHETIC_FUTURE_CLIENT_LEAKED_INTO_PRODUCT_RUNTIME ${path}`)}
  console.log('GENERIC_FUTURE_CLIENT_BROWSER_FIXTURE=PASS path=ALL_AUTHORIZED_DIRECTORY_PLUS_CENTRAL_CARD_SWITCH');
  console.log('A_B_A_CURRENT_CONTEXT_ISOLATION=PASS');
  console.log('SYNTHETIC_FUTURE_CLIENT_PRODUCT_HARDCODING=ABSENT');
}
process.exitCode=status;
