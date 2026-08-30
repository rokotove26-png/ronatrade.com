import { writeFile } from 'node:fs/promises';

const policy=`/portal/client
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-deal-documents-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-deal-canonical-visual-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/assets/portal-runtime/client-deal-command-center-v*.js
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
`;

await writeFile('dist/_headers',policy,'utf8');
console.log('CLIENT_RUNTIME_CACHE_POLICY=PASS route=/portal/client deal runtimes=no-store including command center');
