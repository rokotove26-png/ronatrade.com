import fs from 'node:fs';

const runtime=fs.readFileSync('assets/portal-runtime/client-background-section-preload-v1.js','utf8');
const attach=fs.readFileSync('scripts/attach-client-background-section-preload-v1.mjs','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const cachePolicy=fs.readFileSync('scripts/emit-client-runtime-cache-policy.mjs','utf8');

const requiredRuntime=[
  "20260831-client-background-section-preload-v1",
  "if(location.pathname!=='/portal/client')return",
  "cycle('open')",
  'REFRESH_MS=30000',
  "read('/v1/client/bootstrap')",
  "read('/v1/client/market')",
  "read('/v1/client/shipments')",
  "read('/v1/client/rail',{allowDisabled:true})",
  '/v1/client/context?clientId=',
  '/v1/client/prices?clientId=',
  'state.contexts.map(preloadContext)',
  "for(const name of ['home','applications','deals','documents','payments'])",
  "markSection('prices'",
  "markSection('market'",
  "markSection('rail'",
  'window.__RONA_CLIENT_BACKGROUND_CACHE__=state.cache',
  "emit('rona:client:background-sections'"
];
for(const marker of requiredRuntime)if(!runtime.includes(marker))throw new Error('background preload marker missing: '+marker);

for(const forbidden of ["method:'POST'",'method:"POST"',"fetch(API+'/v1/events'", "fetch(API+'/v1/client/applications'"]){
  if(runtime.includes(forbidden))throw new Error('background preload must be GET/read-only: '+forbidden);
}

if(!attach.includes("mode:'ALL_CLIENT_SECTIONS_BACKGROUND_PRELOAD'")||!attach.includes('visibility_independent:true')||!attach.includes('business_mutation:false'))throw new Error('background preload integrity contract missing');
if(!pkg.scripts?.build?.includes('attach-client-background-section-preload-v1.mjs'))throw new Error('background preloader not attached by production build');
if(!cachePolicy.includes('/assets/portal-runtime/client-background-section-preload-v1.js'))throw new Error('background preloader no-store policy missing');

console.log('CLIENT_BACKGROUND_SECTION_PRELOAD_CONTRACT=PASS');
