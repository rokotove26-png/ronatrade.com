import {writeFile} from 'node:fs/promises';

const PREFLIGHT=process.env.RONA_QA_ISOLATION_PREFLIGHT==='1';
const uniq=values=>[...new Set((values||[]).map(v=>String(v??'').trim()).filter(Boolean))];
const pair=v=>{if(!v||typeof v!=='object')return null;const client_id=String(v.client_id??v.clientId??'').trim(),contract_id=String(v.contract_id??v.contractId??'').trim();return client_id&&contract_id?{client_id,contract_id}:null};
const pairKey=v=>{const p=pair(v);return p?`${p.client_id}|${p.contract_id}`:''};
function scopedIsolationDecision(input){
  const selected=pair(input?.selected),current=pair(input?.current),projection=pair(input?.projection);
  const authorized=uniq((input?.authorized||[]).map(pairKey)).map(k=>{const [client_id,...rest]=k.split('|');return{client_id,contract_id:rest.join('|')}}).filter(x=>x.client_id&&x.contract_id);
  const authorizedKeys=new Set(authorized.map(pairKey)),authorizedClients=new Set(authorized.map(x=>x.client_id)),authorizedContracts=new Set(authorized.map(x=>x.contract_id));
  const chooserPairs=uniq((input?.chooserPairs||[]).map(pairKey)).filter(Boolean),chooserClientIds=uniq(input?.chooserClientIds),chooserContractIds=uniq(input?.chooserContractIds);
  const businessClientIds=uniq(input?.businessClientIds),businessContractIds=uniq(input?.businessContractIds);
  const businessDealIds=uniq(input?.businessDealIds),projectionDealIds=new Set(uniq(input?.projectionDealIds));
  const unauthorizedChooserPairs=chooserPairs.filter(k=>!authorizedKeys.has(k));
  const unauthorizedContextContracts=chooserContractIds.filter(id=>!authorizedContracts.has(id));
  const unauthorizedClientIds=uniq([...chooserClientIds,...businessClientIds]).filter(id=>!authorizedClients.has(id));
  const foreignBusinessClientIds=businessClientIds.filter(id=>!selected||id!==selected.client_id);
  const foreignBusinessContractIds=businessContractIds.filter(id=>!selected||id!==selected.contract_id);
  const unknownBusinessDealIds=businessDealIds.filter(id=>!projectionDealIds.has(id));
  const selectedAuthorized=!!(selected&&authorizedKeys.has(pairKey(selected)));
  const currentMismatch=!selected||!current||pairKey(current)!==pairKey(selected);
  const projectionMismatch=!selected||!projection||pairKey(projection)!==pairKey(selected);
  const pass=selectedAuthorized&&!currentMismatch&&!projectionMismatch&&!unauthorizedChooserPairs.length&&!unauthorizedContextContracts.length&&!unauthorizedClientIds.length&&!foreignBusinessClientIds.length&&!foreignBusinessContractIds.length&&!unknownBusinessDealIds.length;
  return{pass,authorized_context_count:authorized.length,selected_authorized:selectedAuthorized,current_context_match:!currentMismatch,projection_context_match:!projectionMismatch,unauthorized_chooser_pair_count:unauthorizedChooserPairs.length,unauthorized_context_contract_ids:unauthorizedContextContracts,unauthorized_client_ids:unauthorizedClientIds,foreign_business_client_ids:foreignBusinessClientIds,foreign_business_contract_ids:foreignBusinessContractIds,unknown_business_deal_ids:unknownBusinessDealIds};
}
function runIsolationPreflight(label){
  const A={client_id:'RONA-C101',contract_id:'RONA-C101-CTR-2099-001'},B={client_id:'RONA-C202',contract_id:'RONA-C202-CTR-2099-001'},F={client_id:'RONA-C777',contract_id:'RONA-C777-CTR-2099-001'};
  const base={selected:B,current:B,projection:B,authorized:[A,B],chooserPairs:[A,B],chooserClientIds:[A.client_id,B.client_id],chooserContractIds:[A.contract_id,B.contract_id],businessClientIds:[B.client_id],businessContractIds:[B.contract_id],businessDealIds:['DEAL-2099-202'],projectionDealIds:['DEAL-2099-202']};
  const authorizedSelect=scopedIsolationDecision(base);
  if(!authorizedSelect.pass)throw new Error(`${label}_PREFLIGHT_AUTHORIZED_SELECT_SURFACE_FAILED`);
  const companySurface={...base,chooserPairs:[B,A],chooserClientIds:[B.client_id,A.client_id],chooserContractIds:[B.contract_id,A.contract_id]};
  if(!scopedIsolationDecision(companySurface).pass)throw new Error(`${label}_PREFLIGHT_AUTHORIZED_COMPANY_SWITCH_SURFACE_FAILED`);
  let r=scopedIsolationDecision({...companySurface,chooserClientIds:[...companySurface.chooserClientIds,'RONA-C999']});
  if(r.pass||!r.unauthorized_client_ids.includes('RONA-C999'))throw new Error(`${label}_PREFLIGHT_UNAUTHORIZED_COMPANY_SWITCH_CLIENT_NOT_REJECTED`);
  r=scopedIsolationDecision({...companySurface,chooserPairs:[B,{client_id:A.client_id,contract_id:B.contract_id}]});
  if(r.pass||r.unauthorized_chooser_pair_count<1)throw new Error(`${label}_PREFLIGHT_MISMATCHED_COMPANY_SWITCH_PAIR_NOT_REJECTED`);
  r=scopedIsolationDecision({...base,businessClientIds:[B.client_id,A.client_id]});
  if(r.pass||!r.foreign_business_client_ids.includes(A.client_id))throw new Error(`${label}_PREFLIGHT_AUTHORIZED_BUSINESS_SURFACE_NOT_REJECTED`);
  r=scopedIsolationDecision({...base,current:A});
  if(r.pass||r.current_context_match)throw new Error(`${label}_PREFLIGHT_WRONG_CURRENT_NOT_REJECTED`);
  r=scopedIsolationDecision({...base,projection:A});
  if(r.pass||r.projection_context_match)throw new Error(`${label}_PREFLIGHT_WRONG_PROJECTION_NOT_REJECTED`);
  r=scopedIsolationDecision({...base,businessDealIds:['DEAL-2099-999']});
  if(r.pass||!r.unknown_business_deal_ids.includes('DEAL-2099-999'))throw new Error(`${label}_PREFLIGHT_UNKNOWN_BUSINESS_DEAL_NOT_REJECTED`);
  const future={...base,authorized:[A,B,F],chooserPairs:[A,B,F],chooserClientIds:[A.client_id,B.client_id,F.client_id],chooserContractIds:[A.contract_id,B.contract_id,F.contract_id]};
  if(!scopedIsolationDecision(future).pass)throw new Error(`${label}_PREFLIGHT_SYNTHETIC_FUTURE_CONTEXT_FAILED`);
  console.log(`QA_MULTIBINDING_${label}_AUTHORIZED_SELECT_SURFACE=PASS`);
  console.log(`QA_MULTIBINDING_${label}_AUTHORIZED_COMPANY_SWITCH_SURFACE=PASS`);
  console.log(`QA_MULTIBINDING_${label}_UNAUTHORIZED_COMPANY_SWITCH_CLIENT_REJECTED=PASS`);
  console.log(`QA_MULTIBINDING_${label}_MISMATCHED_COMPANY_SWITCH_PAIR_REJECTED=PASS`);
  console.log(`QA_MULTIBINDING_${label}_AUTHORIZED_BUSINESS_SURFACE_REJECTED=PASS`);
  console.log(`QA_MULTIBINDING_${label}_WRONG_CURRENT_REJECTED=PASS`);
  console.log(`QA_MULTIBINDING_${label}_WRONG_PROJECTION_REJECTED=PASS`);
  console.log(`QA_MULTIBINDING_${label}_UNKNOWN_BUSINESS_DEAL_REJECTED=PASS`);
  console.log(`QA_MULTIBINDING_${label}_SYNTHETIC_FUTURE_CONTEXT=PASS`);
  console.log(`QA_MULTIBINDING_${label}_DETERMINISTIC_PREFLIGHT=PASS`);
}
if(PREFLIGHT){runIsolationPreflight('CANDIDATE');process.exit(0)}
const {chromium}=await import('playwright');

const REPO=process.env.GITHUB_REPOSITORY||'rokotove26-png/ronatrade.com';
const HEAD=String(process.env.RONA_EXACT_HEAD||process.env.GITHUB_SHA||'').trim();
const GH_TOKEN=String(process.env.RONA_GITHUB_TOKEN||'').trim();
const PR_NUMBER=String(process.env.RONA_PR_NUMBER||'431').trim();
const ISSUER=String(process.env.RONA_QA_ISSUER_URL||'').trim();
const OIDC_AUDIENCE=String(process.env.RONA_OIDC_AUDIENCE||'rona-pr431-client-qa').trim();
const EXPECTED_BACKEND='PR429_EXISTING_CANDIDATE_SLOT';
const ARTIFACT='issue430-real-authenticated-candidate-proof.json';
const CONTRACT_RUNTIME_SRC='/assets/portal-runtime/client-contract-download-v3.js?v=20260907-company-directory-authorization-scope-v12';
const CONTRACT_RUNTIME_MARK='20260907-client-contract-v12-company-authorization-scope';
const IMMUTABLE_ORIGIN_RE=/^https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev$/i;
const CF_DEPLOYMENT_ID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if(!/^[0-9a-f]{40}$/i.test(HEAD))throw new Error('EXACT_HEAD_REQUIRED');
if(!GH_TOKEN)throw new Error('GITHUB_TOKEN_REQUIRED');
if(!/^\d+$/.test(PR_NUMBER))throw new Error('PR_NUMBER_REQUIRED');
if(!ISSUER.startsWith('https://'))throw new Error('QA_ISSUER_URL_REQUIRED');

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=v=>String(v??'').replace(/\s+/gu,' ').trim();
const compact=v=>norm(v).replace(/\s+/gu,'').toUpperCase();
const safeUrl=u=>{const x=new URL(u);return `${x.pathname}${x.search}`};
async function waitEvaluate(page,predicate,arg,timeout,label){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await page.evaluate(predicate,arg).catch(()=>false))return;await sleep(100)}throw new Error(`${label}_TIMEOUT`)}

async function githubJson(path){const r=await fetch(`https://api.github.com/repos/${REPO}${path}`,{headers:{accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',authorization:`Bearer ${GH_TOKEN}`}});if(!r.ok)throw new Error(`GITHUB_HTTP_${r.status}`);return r.json()}
function previewUrls(text){return[...new Set([...String(text||'').matchAll(/https:\/\/[0-9a-f]{8}\.rona-trade-public\.pages\.dev/ig)].map(m=>m[0].toLowerCase()))]}
function deploymentFromCheck(run){if(run?.app?.slug!=='cloudflare-workers-and-pages')return null;const externalId=String(run?.external_id||'').trim().toLowerCase();if(!CF_DEPLOYMENT_ID_RE.test(externalId))return null;let details;try{details=new URL(String(run?.details_url||''))}catch{return null}if(details.origin!=='https://dash.cloudflare.com')return null;const target=String(details.searchParams.get('to')||''),match=/^\/[0-9a-f]{32}\/pages\/view\/rona-trade-public\/([0-9a-f-]{36})$/i.exec(target);if(!match||match[1].toLowerCase()!==externalId)return null;const origin=`https://${externalId.slice(0,8)}.rona-trade-public.pages.dev`;return IMMUTABLE_ORIGIN_RE.test(origin)?{origin,externalId}:null}
async function verifyImmutablePreview(origin){if(!IMMUTABLE_ORIGIN_RE.test(origin))throw new Error('IMMUTABLE_PREVIEW_ORIGIN_INVALID');const integrityUrl=new URL('/canonical-visual-integrity.json',origin);integrityUrl.searchParams.set('_qa_head',HEAD);integrityUrl.searchParams.set('_qa_nonce',String(Date.now()));const ir=await fetch(integrityUrl,{cache:'no-store',redirect:'error',headers:{'cache-control':'no-cache'}});if(!ir.ok)throw new Error(`IMMUTABLE_PREVIEW_INTEGRITY_HTTP_${ir.status}`);const integrity=await ir.json().catch(()=>null),client=integrity?.client_runtime||{};if(integrity?.architecture!=='CURRENT_ONLY_ADMIN_AND_CLIENT_WITH_FROZEN_CANONICAL_ASSETS')throw new Error('IMMUTABLE_PREVIEW_ARCHITECTURE_MISMATCH');if(client?.state!=='CURRENT_ONLY'||client?.legacy_runtime_in_deployment!==false)throw new Error('IMMUTABLE_PREVIEW_CLIENT_STATE_MISMATCH');if(client?.functional_bridge?.src!==CONTRACT_RUNTIME_SRC)throw new Error('IMMUTABLE_PREVIEW_BRIDGE_SRC_MISMATCH');const assetUrl=new URL(`${origin}${CONTRACT_RUNTIME_SRC}`);assetUrl.searchParams.set('_qa_head',HEAD);assetUrl.searchParams.set('_qa_nonce',String(Date.now()));const ar=await fetch(assetUrl,{cache:'no-store',redirect:'error',headers:{'cache-control':'no-cache'}});if(!ar.ok)throw new Error(`IMMUTABLE_PREVIEW_CLIENT_ASSET_HTTP_${ar.status}`);const text=await ar.text();for(const marker of [CONTRACT_RUNTIME_MARK,"authority.whenCurrentProjection('client-contract-download-v3')","authoritative?.source==='AUTHORITATIVE_CURRENT_CONTEXT_DB'","authoritative?.documents_predicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'","source:'AUTHORITATIVE_METRICS_UNAVAILABLE'","value==null?'—':String(value)"])if(!text.includes(marker))throw new Error(`IMMUTABLE_PREVIEW_CLIENT_ASSET_MARKER_MISSING_${marker}`);if(text.includes("request('/v1/client/context?clientId='"))throw new Error('IMMUTABLE_PREVIEW_DIRECT_CONTEXT_FETCH_PRESENT');return{architecture:integrity.architecture,client_state:client.state,source_sha256:client.source_sha256||null,source_bytes:client.source_bytes??null,asset:CONTRACT_RUNTIME_SRC}}
async function exactPreview(){let lastError=null;for(let i=0;i<72;i++){const data=await githubJson(`/commits/${HEAD}/check-runs?per_page=100`),runs=Array.isArray(data?.check_runs)?data.check_runs:[],run=runs.find(x=>x?.name==='Cloudflare Pages'&&x?.head_sha===HEAD&&x?.status==='completed'&&x?.conclusion==='success'&&x?.app?.slug==='cloudflare-workers-and-pages');if(run){const deployment=deploymentFromCheck(run),urls=previewUrls(run?.output?.summary),candidates=[];if(urls.length>1)lastError=new Error('CLOUDFLARE_CHECK_MULTIPLE_IMMUTABLE_URLS');if(urls.length===1)candidates.push({origin:urls[0],source:'CHECK_OUTPUT'});if(deployment&&urls.length===1&&urls[0]!==deployment.origin)throw new Error('CLOUDFLARE_CHECK_IDENTITY_MISMATCH');if(deployment&&!candidates.some(x=>x.origin===deployment.origin))candidates.push({origin:deployment.origin,source:'CHECK_EXTERNAL_ID'});for(const candidate of candidates){try{const verification=await verifyImmutablePreview(candidate.origin);return{origin:candidate.origin,check_run_id:run.id,external_id:deployment?.externalId||String(run.external_id||''),source:candidate.source,verification}}catch(error){lastError=error}}}await sleep(5000)}throw new Error(`EXACT_HEAD_CLOUDFLARE_PREVIEW_NOT_READY${lastError?`_${lastError.message}`:''}`)}
async function oidcToken(){const base=String(process.env.ACTIONS_ID_TOKEN_REQUEST_URL||''),bearer=String(process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN||'');if(!base||!bearer)throw new Error('GITHUB_OIDC_ENV_REQUIRED');const u=new URL(base);u.searchParams.set('audience',OIDC_AUDIENCE);const r=await fetch(u,{headers:{authorization:`Bearer ${bearer}`,accept:'application/json'}}),body=await r.json().catch(()=>null);if(!r.ok||!body?.value)throw new Error(`GITHUB_OIDC_HTTP_${r.status}`);return String(body.value)}
async function issueSession(oidc,target){const r=await fetch(ISSUER,{method:'POST',headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({clientId:target.clientId,contractId:target.contractId})}),body=await r.json().catch(()=>null);if(!r.ok||body?.ok!==true||!body?.access_token||!body?.refresh_token)throw new Error(`QA_SESSION_ISSUER_${target.key}_HTTP_${r.status}_${String(body?.code||'INVALID_RESPONSE')}`);return{access:String(body.access_token),refresh:String(body.refresh_token)}}
async function cleanupSession(oidc,target,session){const r=await fetch(`${ISSUER.replace(/\/+$/,'')}/cleanup`,{method:'POST',headers:{authorization:`Bearer ${oidc}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({clientId:target.clientId,contractId:target.contractId,accessToken:session.access})}),body=await r.json().catch(()=>null);if(!r.ok||body?.ok!==true||body?.cleanup!=='REVOKED')throw new Error(`QA_SESSION_CLEANUP_${target.key}_HTTP_${r.status}_${String(body?.code||'INVALID_RESPONSE')}`);return{revoked:true}}
function targetDealFromPayload(payload,dealId){const deals=Array.isArray(payload?.data?.deals)?payload.data.deals:[];return deals.find(d=>String(d?.deal_id||'')===dealId)||null}
function sanitizedApi(body,response,target){const deal=target.dealId?targetDealFromPayload(body,target.dealId):null,metrics=body?.data?.company_metrics||null,contract=body?.data?.contract||null;return{request_path:safeUrl(response.url()),http_status:response.status(),backend_header:response.headers()['x-rona-client-context-backend']||null,client_id:String(contract?.client_id||''),contract_id:String(contract?.contract_id||''),deal:deal?{deal_id:String(deal.deal_id||''),passport_amount:deal.passport_amount??null,passport_currency:String(deal.passport_currency||''),passport_amount_source:String(deal.passport_amount_source||''),passport_application_id:String(deal.passport_application_id||'')}:null,company_metrics:metrics?{applications_total:metrics.applications_total??null,deals_total:metrics.deals_total??null,documents_total:metrics.documents_total??null,source:String(metrics.source||''),documents_predicate:String(metrics.documents_predicate||'')}:null}}
async function nav(page,name){const b=page.locator(`#nav [data-page="${name}"],[data-rona-client-nav] [data-page="${name}"],nav [data-page="${name}"]`).first();await b.waitFor({state:'visible',timeout:10000});await b.click()}
async function ensureExactContext(page,target){await waitEvaluate(page,()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady&&window.RONA_CLIENT_CONTEXT?.getCurrentContext),null,15000,'CLIENT_CONTEXT_AUTHORITY_READY');await page.evaluate(async t=>{const a=window.RONA_CLIENT_CONTEXT;await a.whenReady();const c=a.getCurrentContext?.();if(!c||String(c.client_id)!==t.clientId||String(c.contract_id)!==t.contractId)a.select(t.clientId,t.contractId)},target);await waitEvaluate(page,t=>{const a=window.RONA_CLIENT_CONTEXT,c=a?.getCurrentContext?.(),p=a?.getCurrentProjection?.();return String(c?.client_id||'')===t.clientId&&String(c?.contract_id||'')===t.contractId&&String(p?.contract?.client_id||'')===t.clientId&&String(p?.contract?.contract_id||'')===t.contractId},target,20000,'CLIENT_CONTEXT_PROJECTION_READY')}
async function dealDomProof(page,target){await nav(page,'deals');const card=page.locator(`[data-rona-canonical-deal-id="${target.dealId}"]`).first();await card.waitFor({state:'visible',timeout:15000});if(!compact(await card.innerText()).includes(`${target.amount}USD`))throw new Error(`${target.key}_DEAL_CARD_AMOUNT_NOT_RENDERED`);const open=card.locator(`[data-open-deal="${target.dealId}"]`).first();await open.waitFor({state:'visible',timeout:5000});await open.click();const drawer=page.locator('.rona-deal-command-center-v3:visible,[data-rona-deal-passport]:visible').filter({hasText:'Паспорт сделки'}).first();await drawer.waitFor({state:'visible',timeout:10000});const slot=drawer.locator('[data-rona-command-field="amount"] [data-rona-command-field-value]').first();await slot.waitFor({state:'visible',timeout:10000});if(!compact(await slot.innerText()).includes(`${target.amount}USD`))throw new Error(`${target.key}_PASSPORT_AMOUNT_NOT_RENDERED`);if(!norm(await drawer.innerText()).includes(target.dealId))throw new Error(`${target.key}_PASSPORT_DEAL_ID_MISMATCH`);return{deal_card_amount:`${target.amount} USD`,passport_amount:`${target.amount} USD`,card_contains_target_deal:true,passport_contains_target_deal:true}}
function companyCardProbe(t){
  const n=v=>String(v??'').replace(/\s+/g,' ').trim();
  const low=v=>n(v).toLocaleLowerCase('ru-RU');
  const visible=el=>{if(!el)return false;const style=getComputedStyle(el),rect=el.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)!==0&&rect.width>0&&rect.height>0};
  const leafNodes=root=>[...root.querySelectorAll('button,a,span,small,strong,p,div')].filter(e=>e.childElementCount===0&&n(e.textContent));
  const labelPresence=root=>{const labels=leafNodes(root).map(x=>low(x.textContent));return{applications:labels.includes('заявок'),deals:labels.includes('сделок'),documents:labels.includes('документов')||labels.includes('действий')}};
  const main=document.querySelector('main');
  if(!main)return{snapshot:null,diagnostic:{main_present:false,exact_anchor_count:0,pair_count:0,anchors:[]}};
  const selector=`[data-rona-client-id="${t.clientId}"][data-rona-client-contract-id="${t.contractId}"]`;
  const anchors=[...main.querySelectorAll(selector)].filter(visible);
  const pairs=[],anchorDiagnostics=[];
  for(const anchor of anchors){
    let card=null,cardDepth=null,node=anchor;const levels=[];
    for(let depth=0;node&&node!==main&&main.contains(node)&&depth<=6;depth++,node=node.parentElement){
      const presence=labelPresence(node);levels.push({depth,...presence});
      if(!card&&visible(node)&&presence.applications&&presence.deals&&presence.documents){card=node;cardDepth=depth;break}
    }
    anchorDiagnostics.push({hydration:anchor.dataset.ronaCompanyDirectoryHydration||'',card_depth:cardDepth,label_levels:levels});
    if(card)pairs.push({anchor,card});
  }
  const diagnostic={main_present:true,exact_anchor_count:anchors.length,pair_count:pairs.length,anchors:anchorDiagnostics};
  if(pairs.length!==1)return{snapshot:null,diagnostic};
  const {anchor,card}=pairs[0];
  const metric=labels=>{const label=leafNodes(card).find(el=>labels.includes(low(el.textContent)));if(!label)return null;let box=label.parentElement;for(let depth=0;box&&box!==card&&depth<3;depth++,box=box.parentElement){const value=leafNodes(box).find(el=>el!==label&&/^(?:\d+|—)$/.test(n(el.textContent)));if(value)return n(value.textContent)}return null};
  const snapshot={applications:metric(['заявок']),deals:metric(['сделок']),documents:metric(['документов','действий']),hydration:anchor.dataset.ronaCompanyDirectoryHydration||'',source:anchor.dataset.ronaCompanyDirectorySource||'',predicate:anchor.dataset.ronaCompanyDirectoryDocumentsPredicate||'',bound_client_id:anchor.dataset.ronaClientId||'',bound_contract_id:anchor.dataset.ronaClientContractId||''};
  return{snapshot,diagnostic};
}
async function waitCompanyCardSnapshot(page,target,predicate,timeout,label){const deadline=Date.now()+timeout;let lastDiagnostic=null;while(Date.now()<deadline){const probe=await page.evaluate(companyCardProbe,target).catch(()=>null);if(probe){lastDiagnostic=probe.diagnostic||null;if(probe.snapshot&&predicate(probe.snapshot))return probe.snapshot}await sleep(100)}console.log(`${label}_DIAGNOSTIC=${JSON.stringify(lastDiagnostic||{probe_unavailable:true})}`);throw new Error(`${label}_TIMEOUT`)}
async function pendingCompanyMetrics(page,target){await nav(page,'companies');await waitEvaluate(page,t=>{const c=window.RONA_CLIENT_CONTEXT?.getCurrentContext?.();return String(c?.client_id||'')===t.clientId&&String(c?.contract_id||'')===t.contractId},target,5000,'C003_SELECTED_CONTEXT_PENDING');return waitCompanyCardSnapshot(page,target,s=>s.applications==='—'&&s.deals==='—'&&s.documents==='—'&&s.hydration==='pending'&&s.source!=='AUTHORITATIVE_CURRENT_CONTEXT_DB'&&s.bound_client_id===target.clientId&&s.bound_contract_id===target.contractId,8000,'COMPANY_METRICS_PENDING_NEUTRAL')}
async function companyMetrics(page,target){await nav(page,'companies');return waitCompanyCardSnapshot(page,target,s=>s.applications==='2'&&s.deals==='2'&&s.documents==='5'&&s.hydration==='ready'&&s.source==='AUTHORITATIVE_CURRENT_CONTEXT_DB'&&s.predicate==='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY'&&s.bound_client_id===target.clientId&&s.bound_contract_id===target.contractId,15000,'COMPANY_METRICS_READY')}
async function scopedIsolationProof(page,target){
  const snapshot=await page.evaluate(t=>{
    const n=v=>String(v??'').trim(),clientTokens=v=>[...String(v||'').matchAll(/\bRONA-C\d+\b/g)].map(m=>m[0]),contractTokens=v=>[...String(v||'').matchAll(/\bRONA-C\d+-CTR-\d{4}-\d+\b/g)].map(m=>m[0]),dealTokens=v=>[...String(v||'').matchAll(/\bDEAL-\d{4}-\d+\b/g)].map(m=>m[0]);
    const authority=window.RONA_CLIENT_CONTEXT;if(!authority?.getAuthorizedContexts||!authority?.getCurrentContext||!authority?.getCurrentProjection)return{authority_missing:true};
    const authorized=(authority.getAuthorizedContexts()||[]).map(c=>({client_id:n(c?.client_id),contract_id:n(c?.contract_id)})).filter(c=>c.client_id&&c.contract_id),authorizedClients=new Set(authorized.map(c=>c.client_id));
    const current=authority.getCurrentContext?.(),projectionData=authority.getCurrentProjection?.(),projection={client_id:n(projectionData?.contract?.client_id),contract_id:n(projectionData?.contract?.contract_id)};
    const chooser=document.getElementById('clientContextSelect'),chooserClientIds=[],chooserContractIds=[],chooserPairs=[];
    for(const option of chooser?.options||[]){const client_id=n(option.dataset.clientId),contract_id=n(option.dataset.contractId);if(client_id)chooserClientIds.push(client_id);if(contract_id)chooserContractIds.push(contract_id);chooserClientIds.push(...clientTokens(option.textContent));chooserContractIds.push(...contractTokens(option.textContent));if(client_id&&contract_id)chooserPairs.push({client_id,contract_id})}
    const inChooser=el=>!!el?.closest?.('#clientContextSelect');
    const canonicalCompanyCard=el=>{const card=el?.closest?.('article.company-switch-card');if(!card)return null;const grid=card.closest?.('#clientCompanyGrid'),section=grid?.closest?.('section#page-companies');return grid&&section&&grid.contains(card)&&section.contains(grid)?card:null};
    const inContextSurface=el=>inChooser(el)||!!canonicalCompanyCard(el);
    for(const card of document.querySelectorAll('section#page-companies #clientCompanyGrid article.company-switch-card')){if(canonicalCompanyCard(card)!==card)continue;const localClients=[],localContracts=[];for(const el of [card,...card.querySelectorAll('[data-rona-client-id],[data-rona-client-contract-id],[data-rona-contract-id]')]){const c=n(el.getAttribute?.('data-rona-client-id')),k=n(el.getAttribute?.('data-rona-client-contract-id')||el.getAttribute?.('data-rona-contract-id'));if(c)localClients.push(c);if(k)localContracts.push(k);if(c&&k)chooserPairs.push({client_id:c,contract_id:k})}const cardText=String(card.textContent||'');localClients.push(...clientTokens(cardText));localContracts.push(...contractTokens(cardText));const cs=[...new Set(localClients.filter(Boolean))],ks=[...new Set(localContracts.filter(Boolean))];chooserClientIds.push(...cs);chooserContractIds.push(...ks);if(cs.length===1)for(const k of ks)chooserPairs.push({client_id:cs[0],contract_id:k})}
    const safeIdent=v=>{const s=String(v||'').trim();if(!s)return'';if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)||s.length>64)return'[redacted]';return s.replace(/[^A-Za-z0-9_-]/g,'').slice(0,64)};
    const classes=el=>[...(el?.classList||[])].map(safeIdent).filter(x=>x&&x!=='[redacted]').slice(0,4);
    const describe=el=>el?{tag:String(el.tagName||'').toLowerCase(),id:safeIdent(el.id),classes:classes(el)}:null;
    const nearestStructural=el=>{for(let node=el,depth=0;node&&depth<=8;node=node.parentElement,depth++)if(['NAV','ASIDE','HEADER','MAIN','SECTION','DIALOG'].includes(node.tagName))return describe(node);return null};
    const semanticContainer=el=>{for(let node=el,depth=0;node&&depth<=8;node=node.parentElement,depth++){const tag=String(node.tagName||'').toLowerCase(),role=String(node.getAttribute?.('role')||'').toLowerCase(),idClass=`${node.id||''} ${node.className||''}`.toLowerCase(),label=String(node.getAttribute?.('aria-label')||'').toLowerCase();let reason='';if(['navigation','listbox','menu','combobox','tablist'].includes(role))reason='ROLE';else if(/context|company|companies|switch|selector|select|chooser|directory|navigation|nav/.test(idClass))reason='ID_CLASS';else if(['nav','aside','header','section','dialog','select','fieldset'].includes(tag)&&/context|company|компан|контекст/.test(label))reason='TEXT_LABEL';if(reason)return{...describe(node),role:safeIdent(role),match_reason:reason}}return null};
    const openDealWorkspace=el=>{for(let node=el,depth=0;node&&depth<=8;node=node.parentElement,depth++){const idClass=`${node.id||''} ${node.className||''}`.toLowerCase();if(node.matches?.('.rona-deal-command-center-v3,[data-rona-deal-passport]')||((node.getAttribute?.('role')||'').toLowerCase()==='dialog'&&/deal|business|workspace|command-center/.test(idClass)))return describe(node)}return null};
    const visibilityState=el=>{if(!el||!document.documentElement.contains(el))return'DETACHED';if(el.closest?.('script,style'))return'NON_RENDERED';const s=getComputedStyle(el),r=el.getBoundingClientRect();if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)===0)return'HIDDEN';return r.width>0&&r.height>0?'VISIBLE_RENDERED':'VISIBLE_STYLE_ONLY'};
    const domPath=el=>{const parts=[];for(let node=el,depth=0;node&&node.nodeType===1&&depth<7;node=node.parentElement,depth++){const d=describe(node);if(!d)break;parts.unshift(`${d.tag}${d.id?`#${d.id}`:''}${d.classes.length?`.${d.classes.join('.')}`:''}`)}return parts.join('>')};
    const provenanceRecords=[],provenanceSeen=new Set();
    const addProvenance=(el,token,mode,attributeName='')=>{if(provenanceRecords.length>=10||!token||token===t.clientId||!authorizedClients.has(token)||inContextSurface(el))return;const semantic=semanticContainer(el),dealWorkspace=openDealWorkspace(el),record={detection_mode:mode,token,element_tag:String(el?.tagName||'').toLowerCase(),element_id:safeIdent(el?.id),element_classes:classes(el),nearest_structural_ancestor:nearestStructural(el),inside_client_context_select:inChooser(el),inside_semantic_context_container:!!semantic,semantic_container:semantic,inside_open_deal_workspace:!!dealWorkspace,open_deal_workspace:dealWorkspace,visibility_state:visibilityState(el),bounded_dom_path:domPath(el),sanitized_text_excerpt:token};if(mode==='DATA_ATTRIBUTE')record.data_attribute=safeIdent(attributeName);const key=`${mode}|${token}|${record.bounded_dom_path}|${record.data_attribute||''}`;if(provenanceSeen.has(key))return;provenanceSeen.add(key);provenanceRecords.push(record)};
    const businessClientIds=[],businessContractIds=[],businessDealIds=[];
    for(const el of document.querySelectorAll('[data-rona-client-id],[data-rona-client-contract-id],[data-rona-contract-id]')){if(inContextSurface(el))continue;const c=n(el.getAttribute('data-rona-client-id')),k=n(el.getAttribute('data-rona-client-contract-id')||el.getAttribute('data-rona-contract-id'));if(c){businessClientIds.push(c);for(const token of clientTokens(c))addProvenance(el,token,'DATA_ATTRIBUTE','data-rona-client-id')}if(k)businessContractIds.push(k)}
    for(const el of document.querySelectorAll('[data-rona-canonical-deal-id],[data-open-deal]')){const id=n(el.getAttribute('data-rona-canonical-deal-id')||el.getAttribute('data-open-deal'));if(id)businessDealIds.push(id)}
    const visible=el=>{if(!el||el.closest('script,style'))return false;const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)!==0};
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode,parent=node.parentElement;if(!visible(parent))continue;const text=String(node.nodeValue||''),clients=clientTokens(text),contracts=contractTokens(text);businessDealIds.push(...dealTokens(text));if(inContextSurface(parent))continue;businessClientIds.push(...clients);businessContractIds.push(...contracts);for(const token of clients)addProvenance(parent,token,'TEXT')}
    const projectionText=JSON.stringify(projectionData||{}),projectionDealIds=dealTokens(projectionText);
    return{selected:{client_id:t.clientId,contract_id:t.contractId},authorized,current,projection,chooserClientIds,chooserContractIds,chooserPairs,businessClientIds,businessContractIds,businessDealIds,projectionDealIds,provenance_records:provenanceRecords};
  },target);
  if(snapshot?.authority_missing)throw new Error(`${target.key}_SCOPED_ISOLATION_AUTHORITY_MISSING`);
  const result=scopedIsolationDecision(snapshot);
  if(!result.pass){const foreign=new Set(result.foreign_business_client_ids||[]),provenance=(snapshot.provenance_records||[]).filter(r=>foreign.has(r.token)).slice(0,10),diagnostic={...result,foreign_authorized_client_provenance:provenance};console.log(`${target.key}_SCOPED_ISOLATION_PROVENANCE=${JSON.stringify(provenance)}`);throw new Error(`${target.key}_SCOPED_ISOLATION_FAIL_${JSON.stringify(diagnostic)}`)}
  return result;
}

const targets=[
  {key:'C002',clientId:'RONA-C002',contractId:'RONA-C002-CTR-2026-001',dealId:'DEAL-2026-004',amount:236250,currency:'USD',source:'LEGACY_REGISTERED_APPLICATION_COMMERCIAL_TERMS',applicationId:'RONA-C002-IN-2026-001'},
  {key:'C003',clientId:'RONA-C003',contractId:'RONA-C003-CTR-2026-001'},
  {key:'C004',clientId:'RONA-C004',contractId:'RONA-C004-CTR-2026-001',dealId:'DEAL-2026-007',amount:113500,currency:'USD',source:'FINALIZED_APPLICATION_COMMERCIAL_TERMS',applicationId:'RONA-C004-IN-2026-004'}
];
const preview=await exactPreview();console.log(`IMMUTABLE_PREVIEW=${preview.origin}/portal/client source=${preview.source}`);const oidc=await oidcToken(),browser=await chromium.launch({headless:true});const proof={schema:'ISSUE430_REAL_AUTHENTICATED_CANDIDATE_PROOF_V4_SCOPED_ISOLATION',exact_head:HEAD,immutable_preview:`${preview.origin}/portal/client`,cloudflare_check_run_id:preview.check_run_id,cloudflare_external_id:preview.external_id,preview_source:preview.source,preview_verification:preview.verification,expected_candidate_boundary:EXPECTED_BACKEND,targets:{}};
try{
  for(const target of targets){
    const session=await issueSession(oidc,target),host=new URL(preview.origin).hostname,context=await browser.newContext();let releaseDelayedResolve=null;
    try{
      await context.addCookies([{name:'rona_portal_at',value:session.access,domain:host,path:'/portal',secure:true,httpOnly:true,sameSite:'Lax'},{name:'rona_portal_rt',value:session.refresh,domain:host,path:'/portal',secure:true,httpOnly:true,sameSite:'Lax'}]);
      const page=await context.newPage();let apiEvidence=null,delayedResolve=null,delayed=false;const delayedStarted=new Promise(resolve=>{delayedResolve=resolve}),delayedGate=new Promise(resolve=>{releaseDelayedResolve=resolve});
      if(target.key==='C003')await page.route('**/portal/api/v1/client/context?*',async route=>{const u=new URL(route.request().url());if(u.searchParams.get('clientId')===target.clientId&&u.searchParams.get('contractId')===target.contractId){if(!delayed){delayed=true;delayedResolve()}await delayedGate}await route.continue()});
      page.on('response',async response=>{try{const u=new URL(response.url());if(u.origin!==preview.origin||u.pathname!=='/portal/api/v1/client/context'||u.searchParams.get('clientId')!==target.clientId||u.searchParams.get('contractId')!==target.contractId)return;const body=await response.json().catch(()=>null);if(body?.data?.contract?.client_id===target.clientId&&body?.data?.contract?.contract_id===target.contractId)apiEvidence=sanitizedApi(body,response,target)}catch{}});
      await page.goto(`${preview.origin}/portal/client`,{waitUntil:'domcontentloaded',timeout:30000});if(!page.url().startsWith(`${preview.origin}/portal/client`))throw new Error(`${target.key}_AUTHENTICATED_PORTAL_REDIRECTED`);
      if(target.key==='C003'){
        await waitEvaluate(page,()=>Boolean(window.RONA_CLIENT_CONTEXT?.whenReady&&window.RONA_CLIENT_CONTEXT?.getCurrentContext),null,15000,'C003_CONTEXT_AUTHORITY_READY');
        await page.evaluate(async t=>{const a=window.RONA_CLIENT_CONTEXT;await a.whenReady();const c=a.getCurrentContext?.();if(!c||String(c.client_id)!==t.clientId||String(c.contract_id)!==t.contractId)a.select(t.clientId,t.contractId)},target);
        await Promise.race([delayedStarted,(async()=>{await sleep(10000);throw new Error('C003_REAL_CONTEXT_DELAY_NOT_TRIGGERED')})()]);
        let pending;try{pending=await pendingCompanyMetrics(page,target)}finally{releaseDelayedResolve?.()}
        if(!pending||pending.applications!=='—'||pending.deals!=='—'||pending.documents!=='—'||pending.hydration==='ready'||pending.source==='AUTHORITATIVE_CURRENT_CONTEXT_DB')throw new Error(`C003_FAIL_CLOSED_PENDING_MISMATCH_${JSON.stringify(pending)}`);
        proof.targets.C003={fail_closed_before_real_response:pending};
      }
      await ensureExactContext(page,target);for(let i=0;i<60&&!apiEvidence;i++)await sleep(100);if(!apiEvidence)throw new Error(`${target.key}_REAL_CONTEXT_RESPONSE_NOT_CAPTURED`);if(apiEvidence.http_status!==200||apiEvidence.client_id!==target.clientId||apiEvidence.contract_id!==target.contractId)throw new Error(`${target.key}_REAL_CONTEXT_SCOPE_FAIL`);if(apiEvidence.backend_header!==EXPECTED_BACKEND)throw new Error(`${target.key}_CANDIDATE_BOUNDARY_FAIL_${String(apiEvidence.backend_header||'MISSING')}`);
      const runtime=await page.evaluate(()=>({deals:String(window.__RONA_CLIENT_DEALS_AUTHORITATIVE__||''),company:String(window.__RONA_CLIENT_CONTRACT_DOWNLOAD_V3__||''),context:String(window.__RONA_CLIENT_CONTEXT_SELECTION_AUTHORITY__||window.__RONA_CLIENT_CONTEXT_AUTHORITY__||'')}));
      if(target.key==='C002'||target.key==='C004'){
        const d=apiEvidence.deal;if(!d||Number(d.passport_amount)!==target.amount||d.passport_currency!==target.currency||d.passport_amount_source!==target.source||d.passport_application_id!==target.applicationId)throw new Error(`${target.key}_REAL_API_PASSPORT_MISMATCH_${JSON.stringify(d)}`);proof.targets[target.key]={api:apiEvidence,dom:await dealDomProof(page,target),runtime};
      }else{
        const m=apiEvidence.company_metrics;if(!m||Number(m.applications_total)!==2||Number(m.deals_total)!==2||Number(m.documents_total)!==5||m.source!=='AUTHORITATIVE_CURRENT_CONTEXT_DB'||m.documents_predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')throw new Error(`C003_REAL_API_KPI_MISMATCH_${JSON.stringify(m)}`);const dom=await companyMetrics(page,target);if(dom.applications!=='2'||dom.deals!=='2'||dom.documents!=='5'||dom.hydration!=='ready'||dom.source!=='AUTHORITATIVE_CURRENT_CONTEXT_DB'||dom.predicate!=='CURRENT_EFFECTIVE_CONTRACTUAL_ONLY')throw new Error(`C003_REAL_DOM_KPI_MISMATCH_${JSON.stringify(dom)}`);proof.targets.C003={...proof.targets.C003,api:apiEvidence,dom,runtime};
      }
      proof.targets[target.key].scoped_isolation=await scopedIsolationProof(page,target);
    }finally{releaseDelayedResolve?.();await context.close().catch(()=>{});proof.targets[target.key]={...(proof.targets[target.key]||{}),session_cleanup:await cleanupSession(oidc,target,session)}}
  }
}finally{await browser.close()}
await writeFile(ARTIFACT,JSON.stringify(proof,null,2)+'\n','utf8');
console.log('ISSUE430_REAL_AUTH_CANDIDATE=PASS');
console.log(`CANDIDATE_BOUNDARY=${proof.targets.C002.api.backend_header}`);
console.log(`C002_REAL_API=passport_amount:${proof.targets.C002.api.deal.passport_amount} currency:${proof.targets.C002.api.deal.passport_currency} source:${proof.targets.C002.api.deal.passport_amount_source} application:${proof.targets.C002.api.deal.passport_application_id}`);
console.log('C002_REAL_DOM_CARD=236250 USD');console.log('C002_REAL_DOM_PASSPORT=236250 USD');
console.log(`C003_REAL_FAIL_CLOSED=${proof.targets.C003.fail_closed_before_real_response.applications}/${proof.targets.C003.fail_closed_before_real_response.deals}/${proof.targets.C003.fail_closed_before_real_response.documents}`);
console.log('C003_REAL_API_KPI=2/2/5');console.log('C003_REAL_DOM_KPI=2/2/5');
console.log(`C004_REAL_API_PASSPORT=${proof.targets.C004.api.deal.passport_amount} ${proof.targets.C004.api.deal.passport_currency}`);console.log('C004_REAL_DOM_CARD=113500 USD');console.log('C004_REAL_DOM_PASSPORT=113500 USD');
console.log('SCOPED_ISOLATION=PASS');console.log('STALE_FOREIGN_DOM=ABSENT');console.log('QA_SESSION_CLEANUP=PASS');
