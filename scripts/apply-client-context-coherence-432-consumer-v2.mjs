import {readFile,writeFile} from 'node:fs/promises';

const lifecyclePath='dist/assets/portal-runtime/client-application-lifecycle-v1.js';
const applicationsPath='dist/assets/portal-runtime/client-applications-live-render-v1.js';
const contractPath='dist/assets/portal-runtime/client-contract-download-v3.js';
const paymentsPath='dist/assets/portal-runtime/client-payments-authoritative-v1.js';
const dealDocumentsPath='dist/assets/portal-runtime/client-deal-documents-v5.js';
const PRIOR_MARK='ISSUE432_CONTEXT_SWITCH_RELOAD_QUEUE_V1';
const MARK='ISSUE432_CONTEXT_AUTHORITY_CONSUMER_V2';
const APPLICATIONS_MARK='ISSUE432_APPLICATIONS_CENTRAL_PROJECTION_V1';
const CONTRACT_MARK='ISSUE432_CONTRACT_DIRECTORY_CENTRAL_PROJECTION_V1';
const PAYMENTS_MARK='ISSUE432_PAYMENTS_CENTRAL_PROJECTION_V1';
const DEAL_DOCUMENTS_MARK='ISSUE432_DEAL_DOCUMENTS_CENTRAL_PROJECTION_V1';

function replaceOnce(source,from,to,label){
  if(!source.includes(from))throw new Error(`${label}_TARGET_MISSING`);
  if(source.indexOf(from)!==source.lastIndexOf(from))throw new Error(`${label}_TARGET_NOT_UNIQUE`);
  return source.replace(from,to);
}
function assertNoBusinessHardcode(source,label){
  if(/RONA-C005|ГазОнэ|GazOne|RONA-C005-IN-2026-001/iu.test(source))throw new Error(`${label}_BUSINESS_SPECIFIC_HARDCODE_FORBIDDEN`);
}
function validateAndWrite(source,path,label,tokens,directToken){
  for(const token of tokens)if(!source.includes(token))throw new Error(`${label}_CONTRACT_MISSING:${token}`);
  if(directToken&&source.includes(directToken))throw new Error(`${label}_DIRECT_CONTEXT_FETCH_PRESENT`);
  assertNoBusinessHardcode(source,label);new Function(source);return writeFile(path,source,'utf8');
}

let lifecycle=await readFile(lifecyclePath,'utf8');
if(!lifecycle.includes(PRIOR_MARK))throw new Error('ISSUE432_PRIOR_CONSUMER_GUARD_MISSING');
if(!lifecycle.includes(MARK)){
  lifecycle=replaceOnce(lifecycle,`const ${PRIOR_MARK}='${PRIOR_MARK}';`,`const ${PRIOR_MARK}='${PRIOR_MARK}';\nconst ${MARK}='${MARK}';`,'ISSUE432_CONSUMER_MARK');
  lifecycle=replaceOnce(lifecycle,"const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));","const authority=contextAuthority();if(!authority?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');const projected=await authority.whenCurrentProjection('client-application-lifecycle-v1');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};",'ISSUE432_CONSUMER_CONTEXT_READ');
}
await validateAndWrite(lifecycle,lifecyclePath,'ISSUE432_CONSUMER',[MARK,"authority.whenCurrentProjection('client-application-lifecycle-v1')",'state.reloadRequested=true','queueMicrotask(()=>loadAuthoritativeState(true))'],"request('/v1/client/context?clientId='");

let applications=await readFile(applicationsPath,'utf8');
if(!applications.includes(APPLICATIONS_MARK)){
  applications=replaceOnce(applications,"const state={apps:[],contextKey:'',loading:false,lastLoad:0,timer:0,unsubscribe:null};",`const ${APPLICATIONS_MARK}='${APPLICATIONS_MARK}';\nconst state={apps:[],contextKey:'',loading:false,lastLoad:0,timer:0,unsubscribe:null};`,'ISSUE432_APPLICATIONS_MARK');
  applications=replaceOnce(applications,"const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));","const a=authority();if(!a?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');const projected=await a.whenCurrentProjection('client-applications-live-render-v1');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};",'ISSUE432_APPLICATIONS_CONTEXT_READ');
}
await validateAndWrite(applications,applicationsPath,'ISSUE432_APPLICATIONS',[APPLICATIONS_MARK,"a.whenCurrentProjection('client-applications-live-render-v1')",'REFRESH_MS=30000'],"request('/v1/client/context?clientId='");

let contract=await readFile(contractPath,'utf8');
if(!contract.includes(CONTRACT_MARK)){
  contract=replaceOnce(contract,"const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style';",`const API='/portal/api',REFRESH_MS=30000,STYLE_ID='ronaClientContractDownloadV3Style',${CONTRACT_MARK}='${CONTRACT_MARK}';`,'ISSUE432_CONTRACT_MARK');
  const directRead="const detail=await request('/v1/client/context?clientId='+encodeURIComponent(current.client_id)+'&contractId='+encodeURIComponent(current.contract_id));";
  const legacyCombinedRead="const key=contextKey(current),detail=await request('/v1/client/context?clientId='+encodeURIComponent(current.client_id)+'&contractId='+encodeURIComponent(current.contract_id));";
  const projectedRead="const projected=await authority.whenCurrentProjection('client-contract-download-v3');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};";
  if(contract.includes(legacyCombinedRead))contract=replaceOnce(contract,legacyCombinedRead,`const key=contextKey(current),${projectedRead}`,'ISSUE432_CONTRACT_CONTEXT_READ_LEGACY');
  else if(contract.includes(directRead))contract=replaceOnce(contract,directRead,projectedRead,'ISSUE432_CONTRACT_CONTEXT_READ_CURRENT');
  else throw new Error('ISSUE432_CONTRACT_CONTEXT_READ_TARGET_MISSING');
}
await validateAndWrite(contract,contractPath,'ISSUE432_CONTRACT',[CONTRACT_MARK,"authority.whenCurrentProjection('client-contract-download-v3')",'REFRESH_MS=30000'],"request('/v1/client/context?clientId='");

let payments=await readFile(paymentsPath,'utf8');
if(!payments.includes(PAYMENTS_MARK)){
  payments=replaceOnce(payments,"const API='/portal/api',REFRESH_MS=30000;",`const API='/portal/api',REFRESH_MS=30000,${PAYMENTS_MARK}='${PAYMENTS_MARK}';`,'ISSUE432_PAYMENTS_MARK');
  payments=replaceOnce(payments,"const detail=await request('/v1/client/context?clientId='+encodeURIComponent(norm(ctx.client_id))+'&contractId='+encodeURIComponent(norm(ctx.contract_id)));","const authority=contextAuthority();if(!authority?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');const projected=await authority.whenCurrentProjection('client-payments-authoritative-v1');if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const detail={data:projected};",'ISSUE432_PAYMENTS_CONTEXT_READ');
}
await validateAndWrite(payments,paymentsPath,'ISSUE432_PAYMENTS',[PAYMENTS_MARK,"authority.whenCurrentProjection('client-payments-authoritative-v1')",'REFRESH_MS=30000'],"request('/v1/client/context?clientId='");

let dealDocuments=await readFile(dealDocumentsPath,'utf8');
if(!dealDocuments.includes(DEAL_DOCUMENTS_MARK)){
  dealDocuments=replaceOnce(dealDocuments,"const API='/portal/api',PANEL='rona-deal-documents-v5',HOST='rona-deal-card-v5';",`const API='/portal/api',PANEL='rona-deal-documents-v5',HOST='rona-deal-card-v5',${DEAL_DOCUMENTS_MARK}='${DEAL_DOCUMENTS_MARK}';`,'ISSUE432_DEAL_DOCUMENTS_MARK');
  const oldBlock="const [context,workflow]=await Promise.all([\n      getJson(`${API}/v1/client/context?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`),\n      getJson(`${API}/v1/client/deal-documents/state?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`).catch(()=>({deals:[]}))\n    ]);";
  const newBlock="const authority=contextAuthority();if(!authority?.whenCurrentProjection)throw new Error('CLIENT_CONTEXT_AUTHORITY_UNAVAILABLE');\n    const [projected,workflow]=await Promise.all([\n      authority.whenCurrentProjection('client-deal-documents-v5'),\n      getJson(`${API}/v1/client/deal-documents/state?clientId=${encodeURIComponent(clientId)}&contractId=${encodeURIComponent(contractId)}`).catch(()=>({deals:[]}))\n    ]);\n    if(!projected)throw new Error('CLIENT_CONTEXT_PROJECTION_UNAVAILABLE');const context={data:projected};";
  dealDocuments=replaceOnce(dealDocuments,oldBlock,newBlock,'ISSUE432_DEAL_DOCUMENTS_CONTEXT_READ');
}
await validateAndWrite(dealDocuments,dealDocumentsPath,'ISSUE432_DEAL_DOCUMENTS',[DEAL_DOCUMENTS_MARK,"authority.whenCurrentProjection('client-deal-documents-v5')"],'/v1/client/context?clientId=');

console.log(`CLIENT_CONTEXT_COHERENCE_432_CONSUMER=PASS marker=${MARK} lifecycle=CENTRAL applications=${APPLICATIONS_MARK} contract=${CONTRACT_MARK} payments=${PAYMENTS_MARK} deal_documents=${DEAL_DOCUMENTS_MARK} direct_current_context_fetches=absent poll_ms=30000 visual_delta=none`);
