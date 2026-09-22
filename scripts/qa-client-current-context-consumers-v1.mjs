import { readFile } from 'node:fs/promises';

const files={
  authority:'assets/portal-runtime/client-context-selection-authority-v1.js',
  home:'assets/portal-runtime/client-home-command-center-v2.js',
  payments:'assets/portal-runtime/client-payments-authoritative-v1.js',
  prices:'assets/portal-runtime/client-price-sync-v1.js',
  dealDocuments:'assets/portal-runtime/client-deal-documents-v5.js',
  dealLifecycle:'assets/portal-runtime/client-deal-lifecycle-v1.js',
  applicationForm:'assets/portal-runtime/client-application-form-v3.js',
  applicationLifecycle:'assets/portal-runtime/client-application-lifecycle-v1.js',
  contract:'assets/portal-runtime/client-contract-download-v3.js',
  background:'assets/portal-runtime/client-background-section-preload-v1.js'
};
const source=Object.fromEntries(await Promise.all(Object.entries(files).map(async([name,path])=>[name,await readFile(path,'utf8')])));
const requireAll=(name,tokens)=>{for(const token of tokens)if(!source[name].includes(token))throw new Error(`CURRENT_CONTEXT_REQUIRED_MISSING:${name}:${token}`)};
const requireAny=(name,tokens,label)=>{if(!tokens.some(token=>source[name].includes(token)))throw new Error(`CURRENT_CONTEXT_REQUIRED_MISSING:${name}:${label}`)};
const forbidAll=(name,tokens)=>{for(const token of tokens)if(source[name].includes(token))throw new Error(`CURRENT_CONTEXT_FORBIDDEN_PRESENT:${name}:${token}`)};

requireAll('authority',['20260903-client-context-selection-authority-v4-header-current-context','window.RONA_CLIENT_CONTEXT=publicApi','getCurrentContext','getAuthorizedContexts','selectionRequired','subscribe','scopedBootstrapResponse','rona:client-context-changed','CLIENT_CONTEXT_SELECTION_REQUIRED']);
requireAll('home',['20260902-client-home-command-center-v3-current-context','RONA_CLIENT_CONTEXT','getCurrentContext','whenReady','authority.subscribe']);
requireAll('payments',['20260922-client-payments-authoritative-v3-event-driven','RONA_CLIENT_CONTEXT','getCurrentContext','whenReady','authority.subscribe',"mode:'EVENT_DRIVEN'",'polling:false','ISSUE432_PAYMENTS_CENTRAL_PROJECTION_V1','invalidateCurrentProjection',"whenCurrentProjection('client-payments-authoritative-v1:"]);
requireAll('prices',['20260902-authoritative-price-current-context-server-projection','RONA_CLIENT_CONTEXT','getCurrentContext','whenReady','authority.subscribe','SERVER_AUTHORITATIVE_PRICE_PROJECTION']);
requireAll('dealDocuments',['20260902-client-deal-documents-v7-current-context','RONA_CLIENT_CONTEXT','getCurrentContext','whenReady','authority.subscribe']);
requireAll('dealLifecycle',['20260922-client-deal-realization-status-v7-canonical-deal-state','RONA_CLIENT_CONTEXT','getCurrentContext','authority.subscribe','CLIENT_DEAL_STATE_V1','function acceptCanonicalDetail(detail)','contextKey(ctx)']);
requireAny('dealLifecycle',['data-rona-authoritative-deal-id','ronaAuthoritativeDealId'],'authoritative-deal-id-binding');
requireAny('dealLifecycle',['data-rona-authoritative-context','ronaAuthoritativeContext'],'authoritative-context-binding');
requireAll('applicationForm',['20260902-destination-price-calc-v7-current-context-authority','RONA_CLIENT_CONTEXT','getCurrentContext','contextKey(currentContext())']);
requireAll('applicationLifecycle',['20260902-client-admin-authoritative-deal-projection-v9-current-context','RONA_CLIENT_CONTEXT','getCurrentContext','whenReady','authority.subscribe']);
requireAll('contract',['20260902-client-contract-v4-current-context-authority','RONA_CLIENT_CONTEXT','getCurrentContext','whenReady','authority.subscribe',"scope:'CURRENT_CONTEXT_ONLY'"]);
requireAll('background',['20260902-client-background-section-preload-current-context-v6','RONA_CLIENT_CONTEXT','getCurrentContext','selectionRequired','authority.subscribe']);

for(const name of ['home','payments','prices','dealDocuments','dealLifecycle','applicationLifecycle','contract','background'])forbidAll(name,['/v1/client/bootstrap','getAuthorizedContexts','chooseContext(','contextFromSelect(','Promise.all(contexts.map','state.contexts']);
forbidAll('payments',['REFRESH_MS=30000','setInterval(()=>load(true)','new MutationObserver(()=>schedule(false)','/v1/client/context?clientId=']);
forbidAll('prices',['priceAuthority','owner_price_snapshots','chooseContext(','domContextHint(','currentControlTexts(','data.contexts','prefetchPrices(']);
forbidAll('applicationForm',['PRODUCER_BY_PRODUCT','Мозырский НПЗ','state?.context?.client_id','state?.context?.contract_id']);
forbidAll('dealDocuments',['Promise.all(contexts.map']);
forbidAll('dealLifecycle',['ctx.map(','setInterval(()=>refresh','[data-rona-command-heading]','/v1/client/deal-documents/state','async function getJson','fetch(']);
forbidAll('background',['getAuthorizedContexts','state.contexts.map(preloadContext)']);

const universalNames=['home','payments','prices','dealDocuments','dealLifecycle','applicationForm','applicationLifecycle','contract','background'];
const hardcoded=[/RONA-C\d{3}-CTR-2026-\d{3}/u,/DEAL-2026-\d{3}/u,/FARGONA\s+GAZ/iu,/UNIVERSAL\s+SOLYARIS/iu,/Мозырский\s+НПЗ/iu];
for(const name of universalNames)for(const re of hardcoded)if(re.test(source[name]))throw new Error(`CURRENT_CONTEXT_BUSINESS_HARDCODE:${name}:${re}`);

if(source.prices.includes('/v1/client/bootstrap')||source.prices.includes('priceAuthority'))throw new Error('PRICE_BROWSER_AUTHORITY_DUPLICATION_FORBIDDEN');
if(!source.prices.includes('/v1/client/prices?clientId='))throw new Error('PRICE_CURRENT_CONTEXT_SERVER_PROJECTION_MISSING');
if(!source.contract.includes('state.entry={context,document:currentContractDocument(data.documents)}'))throw new Error('CONTRACT_CURRENT_CONTEXT_DETAIL_MISSING');
if(source.contract.includes('getAuthorizedContexts'))throw new Error('CONTRACT_AUTHORIZED_CONTEXT_CATALOG_FORBIDDEN');

console.log('CLIENT_CURRENT_CONTEXT_CONSUMERS_QA=PASS authority=single-source consumers=9 selected-context-only lifecycle=canonical-deal-state-event-only price-authority=server business-hardcodes=absent');
