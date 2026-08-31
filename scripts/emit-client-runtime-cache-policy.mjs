import { readFile, writeFile } from 'node:fs/promises';

const TARGET='dist/_headers';
const policy=`/portal/client
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/portal/client-rail-current-ui*
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-background-section-preload-v1.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-rail-canonical-hero-v1.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-deal-documents-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-deal-canonical-visual-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-deal-passport-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-deal-lifecycle-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-section-first-paint-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/portal-canonical-button-hover-v1.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
`;

const existing=await readFile(TARGET,'utf8').catch(error=>{
  if(error?.code==='ENOENT')return '';
  throw error;
});

const requiredAdminRoutes=[
  '/portal/clients-agents-current-ui',
  '/portal/claims-r2-ui',
  '/portal/remaining-sections-ui',
  '/portal/analytics-v2-ui'
];
for(const route of requiredAdminRoutes){
  if(!existing.includes(route))throw new Error(`ADMIN_RUNTIME_HEADER_MISSING_BEFORE_CLIENT_POLICY: ${route}`);
}

const merged=(existing.trimEnd()?existing.trimEnd()+'\n\n':'')+policy;
for(const route of requiredAdminRoutes){
  if(!merged.includes(`${route}\n  Content-Type: application/javascript; charset=utf-8`))throw new Error(`ADMIN_RUNTIME_CONTENT_TYPE_LOST: ${route}`);
}
await writeFile(TARGET,merged,'utf8');
console.log('CLIENT_RUNTIME_CACHE_POLICY=PASS admin-runtime-headers=preserved route=/portal/client + background all-section preload + Client Rail canonical hero + Admin-derived operational body + current deal passport/lifecycle/section-first-paint runtimes + canonical button hover=no-store');
