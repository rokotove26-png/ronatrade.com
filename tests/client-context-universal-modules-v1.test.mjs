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
  'assets/portal-runtime/client-application-form-v3.js',
  'assets/portal-runtime/client-contract-download-v3.js',
  'assets/portal-runtime/client-background-section-preload-v1.js',
  'assets/portal-runtime/client-price-sync-v1.js'
];
const forbidden = [
  '/v1/client/bootstrap',
  'getAuthorizedContexts',
  'contexts[0]',
  'Promise.all(contexts.map',
  'chooseContext(contexts',
  'domContextHint()'
];
const hardcodedClient = /['"`]RONA-C\d{3}(?:-CTR-\d{4}-\d{3,})?['"`]/u;
const hardcodedDeal = /['"`]DEAL-\d{4}-\d{3,}['"`]/u;
for (const path of modules) {
  const source = read(path);
  if (!source.includes('RONA_CLIENT_CONTEXT') || !source.includes('getCurrentContext')) throw new Error(path + ': CURRENT_CONTEXT authority missing');
  for (const token of forbidden) if (source.includes(token)) throw new Error(path + ': forbidden parallel context logic: ' + token);
  if (hardcodedClient.test(source)) throw new Error(path + ': hardcoded client/contract literal');
  if (hardcodedDeal.test(source)) throw new Error(path + ': hardcoded deal literal');
}
const price = read('assets/portal-runtime/client-price-sync-v1.js');
if (!price.includes('authority.subscribe')) throw new Error('price sync CURRENT_CONTEXT subscription missing');
if (!price.includes('SERVER_AUTHORITATIVE_PRICE_PROJECTION')) throw new Error('price sync must trust server authoritative projection');
if (price.includes('priceAuthority') || price.includes('owner_price_snapshots')) throw new Error('price sync must not duplicate price authority validation in browser');
console.log('CLIENT_CONTEXT_UNIVERSAL_MODULES=PASS');
console.log('CURRENT_CONTEXT_ONLY_MODULES=' + modules.length);
console.log('PRICE_CONTEXT_FALLBACK=REMOVED');
console.log('PRICE_BOOTSTRAP_DEPENDENCY=REMOVED');
console.log('PRICE_AUTHORITY=SERVER_PROJECTION');
