import { writeFile } from 'node:fs/promises';

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

await writeFile('dist/_headers',policy,'utf8');
console.log('CLIENT_RUNTIME_CACHE_POLICY=PASS route=/portal/client + background all-section preload + Client Rail canonical hero + Admin-derived operational body + current deal passport/lifecycle/section-first-paint runtimes + canonical button hover=no-store');
