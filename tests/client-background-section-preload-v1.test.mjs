import fs from 'node:fs';

const runtime=fs.readFileSync('assets/portal-runtime/client-background-section-preload-v1.js','utf8');
const attach=fs.readFileSync('scripts/attach-client-background-section-preload-v1.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const cachePolicy=fs.readFileSync('scripts/emit-client-runtime-cache-policy.mjs','utf8');

const requiredRuntime=[
  "20260902-client-background-section-preload-current-context-v6",
  "if(location.pathname!=='/portal/client')return",
  "cycle('open')",
  'REFRESH_MS=30000',
  'RONA_CLIENT_CONTEXT',
  'getCurrentContext',
  'selectionRequired',
  'authority.subscribe',
  'marketPath(current)',
  'shipmentsPath(current)',
  'railPath(current)',
  "scopedPath('/v1/client/market',c)",
  "scopedPath('/v1/client/shipments',c)",
  "scopedPath('/v1/client/rail',c)",
  "for(const name of ['home','applications','deals','documents','payments'])",
  "for(const name of ['home','applications','deals','documents','payments','prices','market','rail'])",
  "markSection('prices'",
  "markSection('market'",
  "markSection('rail'",
  'window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache',
  "emit('rona:client:background-sections'"
];
for(const marker of requiredRuntime)if(!runtime.includes(marker))throw new Error('background preload marker missing: '+marker);
for(const forbidden of ["read('/v1/client/bootstrap')","read('/v1/client/market')",'getAuthorizedContexts','state.contexts.map(preloadContext)',"method:'POST'",'method:"POST"',"fetch(API+'/v1/events'", "fetch(API+'/v1/client/applications'"]){
  if(runtime.includes(forbidden))throw new Error('background preload current-context/read-only contract violated: '+forbidden);
}
if(!attach.includes("scope:'CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY'")||!attach.includes("context_source:'RONA_CLIENT_CONTEXT_AUTHORITY'")||!attach.includes("authorized_context_catalog:'NOT_CONSUMED_BY_MODULE'")||!attach.includes("'/portal/api/v1/client/market'")||!attach.includes('global:[]')||!attach.includes('visibility_independent:true')||!attach.includes('business_mutation:false'))throw new Error('background preload integrity contract missing');
if(!pkg.scripts?.build?.includes('attach-client-background-section-preload-v1.mjs'))throw new Error('background preloader not attached by production build');
if(!cachePolicy.includes('/assets/portal-runtime/client-background-section-preload-v1.js'))throw new Error('background preloader no-store policy missing');
console.log('CLIENT_BACKGROUND_SECTION_PRELOAD_CONTRACT=PASS selected-current-context market+shipments+rail only');
