import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const authority = read('assets/portal-runtime/client-context-selection-authority-v1.js');
if (!authority.includes('window.RONA_CLIENT_CONTEXT=publicApi')) throw new Error('context authority public API missing');
if (!authority.includes('CLIENT_CONTEXT_SELECTION_REQUIRED')) throw new Error('context selection gate missing');

const modules = [
  'assets/portal-runtime/client-home-command-center-v2.js',
  'assets/portal-runtime/client-payments-authoritative-v1.js',
  'assets/portal-runtime/client-deal-documents-v5.js',
  'assets/portal-runtime/client-deal-lifecycle-v1.js',
  'assets/portal-runtime/client-application-lifecycle-v1.js',
  'assets/portal-runtime/client-contract-download-v3.js',
  'assets/portal-runtime/client-background-section-preload-v1.js'
];
const forbidden = ['/v1/client/bootstrap', 'contexts[0]', 'Promise.all(contexts.map', 'chooseContext(contexts', 'domContextHint()'];
for (const path of modules) {
  const source = read(path);
  if (!source.includes('RONA_CLIENT_CONTEXT') || !source.includes('getCurrentContext')) throw new Error(path + ': CURRENT_CONTEXT authority missing');
  for (const token of forbidden) if (source.includes(token)) throw new Error(path + ': forbidden parallel context logic: ' + token);
}
const price = read('assets/portal-runtime/client-price-sync-v1.js');
if (!price.includes('RONA_CLIENT_CONTEXT') || !price.includes('authority.subscribe')) throw new Error('price sync CURRENT_CONTEXT subscription missing');
for (const token of ['contexts[0]', 'chooseContext(contexts', 'domContextHint()', 'Promise.all(contexts.map']) if (price.includes(token)) throw new Error('price sync context fallback remains: ' + token);
console.log('CLIENT_CONTEXT_UNIVERSAL_MODULES=PASS');
console.log('PRICE_AUTHORITY_BOOTSTRAP_MIGRATION=PENDING_BACKEND_PROJECTION');
