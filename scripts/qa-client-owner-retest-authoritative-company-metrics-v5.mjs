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
  "const RAW={A:raw('A'),B:raw('B')};\nconst CURRENT_COMPANY_METRICS={A:{applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'},B:{applications_total:1,deals_total:1,documents_total:3,source:'AUTHORITATIVE_CURRENT_CONTEXT_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'}};\nfor(const name of ['A','B']){RAW[name].company_metrics={...CURRENT_COMPANY_METRICS[name]};const first=RAW[name].documents[0];first.document_type='CONTRACT';first.storage_object_id='QA-STORAGE-'+name;first.authoritative_filename='Contract-'+name+'.pdf';}\nconst AUTHORITATIVE_COMPANY_DIRECTORY={A:{client_id:FIX.A.client_id,legal_name:FIX.A.legal,contract_id:FIX.A.contract_id,current_external_contract_number:FIX.A.external,contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31',applications_total:2,deals_total:2,documents_total:5,source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',current_signed_contract:{document_id:RAW.A.documents[0].document_id,storage_object_id:RAW.A.documents[0].storage_object_id,authoritative_filename:RAW.A.documents[0].authoritative_filename}},B:{client_id:FIX.B.client_id,legal_name:FIX.B.legal,contract_id:FIX.B.contract_id,current_external_contract_number:FIX.B.external,contract_status:'ACTIVE',effective_from:'2099-01-01',effective_to:'2099-12-31',applications_total:1,deals_total:1,documents_total:3,source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',current_signed_contract:{document_id:RAW.B.documents[0].document_id,storage_object_id:RAW.B.documents[0].storage_object_id,authoritative_filename:RAW.B.documents[0].authoritative_filename}}};\nlet companyDirectoryMode='partial';\n",
  'AUTHORITATIVE_COMPANY_DIRECTORY_FIXTURE'
);

replaceRegexOnce(
  /^function expected\(name\)\{.*\}$/m,
  "function expected(name){const r=RAW[name],first=r.deals.find(activeDeal),src=commercialSource(name,first.deal_id),metrics=AUTHORITATIVE_COMPANY_DIRECTORY[name];return{client:r.contract.client_id,contract:r.contract.contract_id,legal:r.contract.legal_name,external:r.contract.current_external_contract_number,applications:metrics.applications_total,deals:metrics.deals_total,documents:metrics.documents_total,array_lengths:{applications:r.applications.length,deals:r.deals.length,documents:r.documents.length},active_ids:r.deals.filter(activeDeal).map(x=>x.deal_id),terminal_ids:r.deals.filter(d=>!activeDeal(d)).map(x=>x.deal_id),passport:first.deal_id,amount:src.obligation_amount,currency:src.currency,source_application_id:src.application_id}}",
  'AUTHORITATIVE_COMPANY_DIRECTORY_EXPECTED'
);

replaceRegexOnce(
  /^const SOURCE_MAP=.*$/m,
  "const SOURCE_MAP={endpoint:'/portal/api/v1/client/context',passport:{relation:'portal_private.client_applications JOIN portal_private.owner_application_workflow',amount:'quantity_tonnes * proposed_price',currency:'proposed_currency',filter:\"status=DEAL_REGISTERED AND business_status=DEAL AND counter_offer_used=false AND finalized_at IS NOT NULL\",backend:'projectClientDeals -> dedicated Passport commercial projection',api_amount:'data.deals[].passport_amount',api_currency:'data.deals[].passport_currency',api_source:'data.deals[].passport_amount_source',api_application:'data.deals[].passport_application_id',consumer:'client-deals-authoritative-v1 authoritativeAmount',dom:'native Passport СУММА'},kpi:{endpoint:'/portal/api/v1/client/bootstrap',applications:'data.company_directory[].applications_total',deals:'data.company_directory[].deals_total',documents:'data.company_directory[].documents_total',source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB',documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY',reference:'complete all-authorized company_directory'}};",
  'AUTHORITATIVE_COMPANY_DIRECTORY_SOURCE_MAP'
);

replaceTextOnce(
  "async function api(label,req,res,u){const c=",
  "async function api(label,req,res,u){if(u.pathname==='/__qa/company-directory-mode'){companyDirectoryMode=u.searchParams.get('value')==='full'?'full':'partial';send(res,{ok:true,mode:companyDirectoryMode});return true}const c=",
  'AUTHORITATIVE_COMPANY_DIRECTORY_MODE_ENDPOINT'
);
replaceTextOnce(
  "if(u.pathname==='/portal/api/v1/client/bootstrap')b={ok:true,data:{contexts:[context('A'),context('B')],selected_context:context('A'),requires_context_selection:false}};",
  "if(u.pathname==='/portal/api/v1/client/bootstrap'){const full=[AUTHORITATIVE_COMPANY_DIRECTORY.A,AUTHORITATIVE_COMPANY_DIRECTORY.B],company_directory=companyDirectoryMode==='full'?full:[AUTHORITATIVE_COMPANY_DIRECTORY.A];b={ok:true,data:{contexts:[context('A'),context('B')],selected_context:context('A'),requires_context_selection:false,company_directory,company_directory_source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'}};}",
  'AUTHORITATIVE_COMPANY_DIRECTORY_BOOTSTRAP'
);

const companyAssertion="await nav(page,'companies');await sleep(450);const stableReady=await wait(page,e=>{const card=document.querySelector(`[data-rona-client-id=\\\"${e.client}\\\"][data-rona-client-contract-id=\\\"${e.contract}\\\"]`);const text=String(card?.innerText||'');return card&&text.includes(String(e.applications))&&text.includes(String(e.deals))&&text.includes(String(e.documents))&&card.querySelector('button[data-rona-contract-download-v3],button[data-rona-company-contract-download]')},EXP.A,4000);const stableCp=await companyProof(page,EXP.A),stableState=await page.evaluate(e=>{const card=document.querySelector(`[data-rona-client-id=\\\"${e.client}\\\"][data-rona-client-contract-id=\\\"${e.contract}\\\"]`);return{hydration:card?.dataset?.ronaCompanyDirectoryHydration||'',source:card?.dataset?.ronaCompanyDirectorySource||'',predicate:card?.dataset?.ronaCompanyDirectoryDocumentsPredicate||'',downloads:card?.querySelectorAll('button[data-rona-contract-download-v3],button[data-rona-company-contract-download]').length||0}},EXP.A),missingProof={stableReady,visible:stableCp.metrics,state:stableState};console.log('MY_COMPANIES_MISSING_DIRECTORY_NONDESTRUCTIVE_PROOF',JSON.stringify(missingProof));console.log('MY_COMPANIES_MISSING_METRICS_NEUTRAL_PROOF',JSON.stringify({...missingProof,compatibility_marker:true,semantics:'NON_DESTRUCTIVE_PARTIAL_DIRECTORY'}));if(!stableReady||stableCp.metrics.applications!==EXP.A.applications||stableCp.metrics.deals!==EXP.A.deals||stableCp.metrics.documents!==EXP.A.documents||stableState.downloads<1||stableState.source==='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB')fail(failures,'COMPANY_DIRECTORY_PARTIAL_DESTROYED_STABLE_OWNER',{stableCp,stableState});await page.evaluate(()=>fetch('/__qa/company-directory-mode?value=full',{cache:'no-store'}));const directoryReqStart=requests.length;const refreshResult=await page.evaluate(async()=>{try{await window.RONA_CLIENT_CONTEXT.refreshCompanyDirectory();return{ok:true}}catch(error){return{ok:false,error:String(error?.message||error)}}});const directoryReady=await wait(page,()=>{const cards=[...document.querySelectorAll('article.company-switch-card[data-rona-client-id][data-rona-client-contract-id]')];return cards.length===2&&cards.every(card=>card.dataset.ronaCompanyDirectoryHydration==='ready'&&card.dataset.ronaCompanyDirectorySource==='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'&&card.dataset.ronaCompanyDirectoryDocumentsPredicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')},null,4000);await sleep(120);const cp=await companyProof(page,EXP.A),bp=await companyProof(page,EXP.B),directoryState=await page.evaluate(()=>[...document.querySelectorAll('article.company-switch-card[data-rona-client-id][data-rona-client-contract-id]')].map(card=>({client:card.dataset.ronaClientId,contract:card.dataset.ronaClientContractId,source:card.dataset.ronaCompanyDirectorySource,predicate:card.dataset.ronaCompanyDirectoryDocumentsPredicate,hydration:card.dataset.ronaCompanyDirectoryHydration,downloads:card.querySelectorAll('button[data-rona-contract-download-v3],button[data-rona-company-contract-download]').length,text:String(card.innerText||'')})),directoryRequests=requests.slice(directoryReqStart).filter(x=>x.label===LABEL&&x.path==='/portal/api/v1/client/bootstrap'),cproof={array_lengths:EXP.A.array_lengths,authoritative:AUTHORITATIVE_COMPANY_DIRECTORY.A,expected:{applications:EXP.A.applications,deals:EXP.A.deals,documents:EXP.A.documents},visible:cp.metrics,b_visible:bp.metrics,legal:cp.contains.legal,refreshResult,directoryReady,directoryState,bootstrap_requests:directoryRequests};console.log('MY_COMPANIES_AUTHORITATIVE_DIRECTORY_PROOF',JSON.stringify(cproof));console.log('MY_COMPANIES_AUTHORITATIVE_METRICS_PROOF',JSON.stringify({...cproof,compatibility_marker:true,source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'}));if(!refreshResult.ok||!directoryReady||!cp.found||!bp.found||!Object.values(cp.contains).every(Boolean)||cp.metrics.applications!==EXP.A.applications||cp.metrics.deals!==EXP.A.deals||cp.metrics.documents!==EXP.A.documents||bp.metrics.applications!==EXP.B.applications||bp.metrics.deals!==EXP.B.deals||bp.metrics.documents!==EXP.B.documents||directoryState.some(x=>x.source!=='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'||x.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'||x.hydration!=='ready'||x.downloads<1))fail(failures,'CURRENT_COMPANY_CARD_AND_COUNTERS',{cp,bp,cproof});await page.evaluate(()=>fetch('/__qa/company-directory-mode?value=partial',{cache:'no-store'}));const beforePartialRefresh=JSON.stringify(directoryState),partialRefresh=await page.evaluate(async()=>{try{await window.RONA_CLIENT_CONTEXT.refreshCompanyDirectory();return{ok:true}}catch(error){return{ok:false,error:String(error?.message||error)}}});await sleep(180);const retainedCp=await companyProof(page,EXP.A),retainedState=await page.evaluate(()=>[...document.querySelectorAll('article.company-switch-card[data-rona-client-id][data-rona-client-contract-id]')].map(card=>({client:card.dataset.ronaClientId,contract:card.dataset.ronaClientContractId,source:card.dataset.ronaCompanyDirectorySource,predicate:card.dataset.ronaCompanyDirectoryDocumentsPredicate,hydration:card.dataset.ronaCompanyDirectoryHydration,downloads:card.querySelectorAll('button[data-rona-contract-download-v3],button[data-rona-company-contract-download]').length})));const retainedProof={partialRefresh,beforePartialRefresh,visible:retainedCp.metrics,state:retainedState};console.log('MY_COMPANIES_LATER_PARTIAL_REFRESH_RETAINED_PROOF',JSON.stringify(retainedProof));if(partialRefresh.ok||!String(partialRefresh.error||'').includes('CLIENT_COMPANY_DIRECTORY_INCOMPLETE')||retainedCp.metrics.applications!==EXP.A.applications||retainedCp.metrics.deals!==EXP.A.deals||retainedCp.metrics.documents!==EXP.A.documents||retainedState.some(x=>x.source!=='AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'||x.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'||x.hydration!=='ready'||x.downloads<1))fail(failures,'COMPANY_DIRECTORY_REFRESH_FAILURE_DESTROYED_LAST_VALIDATED',{retainedProof});await page.evaluate(b=>window.RONA_CLIENT_CONTEXT.select(b.client_id,b.contract_id),FIX.B);const switchedToB=await wait(page,b=>window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.client_id===b.client_id&&window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()?.contract?.client_id===b.client_id,FIX.B,3000);await page.evaluate(a=>window.RONA_CLIENT_CONTEXT.select(a.client_id,a.contract_id),FIX.A);const selectedBack=await wait(page,a=>window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()?.client_id===a.client_id&&window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()?.contract?.client_id===a.client_id,FIX.A,4000);const abaCp=await companyProof(page,EXP.A);if(!switchedToB||!selectedBack||abaCp.metrics.applications!==EXP.A.applications||abaCp.metrics.deals!==EXP.A.deals||abaCp.metrics.documents!==EXP.A.documents)fail(failures,'COMPANY_DIRECTORY_A_B_A_NONREGRESSION',{switchedToB,selectedBack,abaCp});";
replaceRegexOnce(/^await nav\(page,'companies'\)\;await sleep\(450\)\.*CURRENT_COMPANY_CARD_AND_COUNTERS.*$/m,companyAssertion,'AUTHORITATIVE_COMPANY_DIRECTORY_ATOMIC_ASSERTION');

const lifecycleTraceHelper=String.raw`
async function companyGridLifecycleTrace(page,checkpoint){
  const snapshot=await page.evaluate(checkpoint=>{
    const normalize=value=>String(value??'').replace(/\s+/g,' ').trim();
    const selected=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.()||null;
    const projection=window.RONA_CLIENT_CONTEXT?.getCurrentProjection?.()||null;
    const projectionContract=projection?.contract||projection?.current_contract||projection||null;
    const grid=document.querySelector('#clientCompanyGrid');
    const connectedCards=[...document.querySelectorAll('article.company-switch-card')].filter(card=>card.isConnected).map(card=>({isConnected:card.isConnected,data_rona_client_id:card.getAttribute('data-rona-client-id'),data_rona_client_contract_id:card.getAttribute('data-rona-client-contract-id'),data_rona_company_authorization_scope:card.getAttribute('data-rona-company-authorization-scope'),data_rona_company_directory_hydration:card.getAttribute('data-rona-company-directory-hydration'),data_rona_company_directory_source:card.getAttribute('data-rona-company-directory-source'),data_rona_company_directory_documents_predicate:card.getAttribute('data-rona-company-directory-documents-predicate'),text_excerpt:normalize(card.textContent).slice(0,280)}));
    return{checkpoint,selected:{client_id:selected?.client_id??null,contract_id:selected?.contract_id??null},current_projection:{client_id:projectionContract?.client_id??projection?.client_id??null,contract_id:projectionContract?.contract_id??projection?.contract_id??null},company_grid:{exists:Boolean(grid),connected_card_count:connectedCards.length,cards:connectedCards},directory:window.RONA_CLIENT_CONTEXT?.getCompanyDirectory?.()||[]};
  },checkpoint);
  console.log('COMPANY_GRID_LIFECYCLE_TRACE',JSON.stringify(snapshot));
  return snapshot;
}
`;
replaceRegexOnce(/^const SOURCE_MAP=.*$/m,match=>`${match}\n${lifecycleTraceHelper.trim()}`,'COMPANY_GRID_LIFECYCLE_TRACE_HELPER');
replaceTextOnce("await nav(page,'companies');await sleep(450);const stableReady=", "await nav(page,'companies');await sleep(450);await companyGridLifecycleTrace(page,'INITIAL_PARTIAL_DIRECTORY_NONDESTRUCTIVE');const stableReady=", 'COMPANY_GRID_LIFECYCLE_TRACE_INITIAL');
replaceTextOnce("await sleep(120);const cp=", "await sleep(120);await companyGridLifecycleTrace(page,'AFTER_ATOMIC_DIRECTORY_COMMIT');const cp=", 'COMPANY_GRID_LIFECYCLE_TRACE_ATOMIC');
replaceTextOnce("await sleep(180);const retainedCp=", "await sleep(180);await companyGridLifecycleTrace(page,'AFTER_LATER_PARTIAL_REFRESH');const retainedCp=", 'COMPANY_GRID_LIFECYCLE_TRACE_REFRESH');

replaceTextOnce(
  "'production-semantic-company-kpis-mixed-status','one-visible-row-per-active-authoritative-deal-terminal-hidden'",
  "'production-semantic-company-kpis-mixed-status','all-authorized-company-directory-atomic-nondestructive','one-visible-row-per-active-authoritative-deal-terminal-hidden'",
  'AUTHORITATIVE_COMPANY_DIRECTORY_ASSERTION_MARKER'
);

if(!source.includes('MY_COMPANIES_MISSING_DIRECTORY_NONDESTRUCTIVE_PROOF')||!source.includes('MY_COMPANIES_AUTHORITATIVE_DIRECTORY_PROOF')||!source.includes('MY_COMPANIES_LATER_PARTIAL_REFRESH_RETAINED_PROOF'))throw new Error('AUTHORITATIVE_COMPANY_DIRECTORY_PROOF_MARKERS_MISSING');
if(!source.includes("source:'AUTHORITATIVE_AUTHORIZED_CONTEXT_DIRECTORY_DB'")||!source.includes("documents_predicate:'CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'"))throw new Error('AUTHORITATIVE_COMPANY_DIRECTORY_CONTRACT_MISSING');

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
const generatedSyntax=spawnSync(process.execPath,['--check',generatedPath],{cwd:process.cwd(),env:process.env,stdio:'inherit'});
if(generatedSyntax.error){await unlink(generatedPath).catch(()=>{});throw generatedSyntax.error}
if(generatedSyntax.signal){await unlink(generatedPath).catch(()=>{});throw new Error(`OWNER_RETEST_GENERATED_SYNTAX_SIGNAL=${generatedSyntax.signal}`)}
if((generatedSyntax.status??1)!==0){await unlink(generatedPath).catch(()=>{});throw new Error(`OWNER_RETEST_GENERATED_SYNTAX_FAIL status=${generatedSyntax.status??1}`)}
console.log('OWNER_RETEST_GENERATED_SYNTAX=PASS');
console.log('OWNER_RETEST_QA_FIXTURE_ADAPTER=AUTHORITATIVE_COMPANY_METRICS_V1');
console.log('OWNER_RETEST_QA_FIXTURE_ADAPTER_CURRENT=AUTHORITATIVE_COMPANY_DIRECTORY_ATOMIC_V2');
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
  const productFiles=['assets/portal-runtime/client-contract-download-v3.js','assets/portal-runtime/portal-client-company-directory-authority-v1.js','supabase/functions/rona-portal-api/bootstrap.ts','functions/portal/api/v1/client/context.js'];
  const syntheticBusinessLiterals=/CLIENT-B|CONTRACT-B|BOOTSTRAP ALIAS B|BETA ENERGY LLC|DEAL-2099-201|QA-NESTED-CLIENT|QA-NESTED-CTR/iu;
  for(const path of productFiles){const text=await readFile(path,'utf8');if(syntheticBusinessLiterals.test(text))throw new Error(`SYNTHETIC_FUTURE_CLIENT_LEAKED_INTO_PRODUCT_RUNTIME ${path}`)}
  console.log('GENERIC_FUTURE_CLIENT_BROWSER_FIXTURE=PASS client=CLIENT-B contract=CONTRACT-B path=ALL_AUTHORIZED_DIRECTORY_PLUS_CANONICAL_CURRENT_CONTEXT');
  console.log('A_B_A_CURRENT_CONTEXT_ISOLATION=PASS');
  console.log('SYNTHETIC_FUTURE_CLIENT_PRODUCT_HARDCODING=ABSENT');
}
process.exitCode=status;
