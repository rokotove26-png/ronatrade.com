import { readFile, writeFile } from 'node:fs/promises';

const read = path => readFile(path, 'utf8');
const write = (path, content) => writeFile(path, content, 'utf8');
const replaceOnce = (text, pattern, replacement, label) => {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`CORRECTIVE_REPLACE_MISSING:${label}`);
  return next;
};

const phasePath = 'supabase/functions/rona-portal-api/phase5d.ts';
let phase = await read(phasePath);
const priceFn = "export async function clientPrices(c:Ctx,clientId:string,contractId:string){return await sql`select pi.id as publication_item_id,p.publication_id,p.title,pi.product,pi.basis,pi.currency,pi.price,pi.payment_terms,pi.valid_from,pi.valid_to,pi.delivery_period_from,pi.delivery_period_to,ps.producer,ps.supplier,ps.id::text as price_snapshot_id,ps.source_reference as price_snapshot_source_reference,ps.source_system as price_snapshot_source_system,ps.published_at as price_snapshot_published_at,ps.client_published_at as price_snapshot_client_published_at,jsonb_build_object('snapshot_id',ps.id::text,'source_reference',ps.source_reference,'source_system',ps.source_system,'published_at',ps.published_at,'client_published_at',ps.client_published_at,'authority','OWNER_PRICE_SNAPSHOT') as price_snapshot from portal_private.clients cl join portal_private.contracts ct on ct.client_key=cl.id cross join portal_private.publications p join portal_private.publication_items pi on pi.publication_key=p.id join lateral (select s.id,s.producer,s.supplier,s.source_reference,s.source_system,s.published_at,s.client_published_at,s.updated_at from portal_private.owner_price_snapshots s where s.source_publication_item_key=pi.id and s.source_reference=p.publication_id and s.product=pi.product and s.sale_price=pi.price and s.currency=pi.currency and s.publish_client=true and s.business_status='PUBLISHED' and s.client_published_at is not null order by s.client_published_at desc,s.updated_at desc limit 1) ps on true where cl.client_id=${clientId} and ct.contract_id=${contractId} and portal_private.client_user_has_contract_access(${c.user}::uuid,ct.id,now()) and p.status='PUBLISHED'::portal_private.publication_status_enum and p.published_at is not null and p.authority_state='CONFIRMED'::portal_private.authority_state_enum and p.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and pi.item_type='PRICE'::portal_private.publication_item_type_enum and pi.distribution_allowed and pi.authority_state in ('VERIFIED'::portal_private.authority_state_enum,'CONFIRMED'::portal_private.authority_state_enum) and pi.lifecycle_state='ACTIVE'::portal_private.lifecycle_state_enum and p.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC') and pi.audience in ('ALL_CLIENTS','SELECTED_CLIENTS','PUBLIC') and ((p.audience<>'SELECTED_CLIENTS' and pi.audience<>'SELECTED_CLIENTS') or exists(select 1 from portal_private.publication_client_targets pct where pct.publication_key=p.id and pct.client_key=cl.id and (pct.target_scope='PUBLICATION' or (pct.target_scope='ITEM' and pct.publication_item_key=pi.id)))) and (pi.valid_from is null or pi.valid_from<=now()) and (pi.valid_to is null or pi.valid_to>=now()) order by p.published_at desc nulls last,pi.item_order`}";
phase = replaceOnce(
  phase,
  /export async function clientPrices\(c:Ctx,clientId:string,contractId:string\)\{[\s\S]*?\}\nexport async function clientContext/,
  priceFn + '\nexport async function clientContext',
  'phase5d.clientPrices'
);
await write(phasePath, phase);

await write('scripts/qa-client-price-authority-v1.mjs', `import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
const phase=await readFile('supabase/functions/rona-portal-api/phase5d.ts','utf8');
const router=await readFile('supabase/functions/rona-portal-api/index.ts','utf8');
const runtime=await readFile('assets/portal-runtime/client-price-sync-v1.js','utf8');
const start=phase.indexOf('export async function clientPrices('),end=phase.indexOf('export async function clientContext(',start);
assert(start>=0&&end>start,'clientPrices block missing');
const block=phase.slice(start,end);
for(const marker of ['portal_private.owner_price_snapshots','s.source_publication_item_key=pi.id','s.source_reference=p.publication_id','s.product=pi.product','s.sale_price=pi.price','s.currency=pi.currency','s.publish_client=true',"s.business_status='PUBLISHED'",'s.client_published_at is not null','ps.producer,ps.supplier','price_snapshot_id','price_snapshot_source_reference','price_snapshot_source_system','price_snapshot_published_at',"'authority','OWNER_PRICE_SNAPSHOT'","p.authority_state='CONFIRMED'","p.lifecycle_state='ACTIVE'","pi.lifecycle_state='ACTIVE'"])assert(block.includes(marker),\`price authority missing \${marker}\`);
for(const internal of ['purchase_price','rail_tariff','landed_cost','rona_margin'])assert(!block.includes(internal),\`client price projection leaks \${internal}\`);
assert(router.includes('filterAuthoritativePublishedRows(await clientPrices(c,clientId,contractId))'),'price route must apply authoritative publication gate');
assert(runtime.includes('SERVER_AUTHORITATIVE_PRICE_PROJECTION'),'runtime must identify server price authority');
assert(runtime.includes('item.producer'),'runtime must render producer from server projection');
assert(!/FARGONA|SOLYARIS|producerMap/iu.test(runtime),'runtime contains producer fallback mapping');
console.log('CLIENT_PRICE_AUTHORITY_QA=PASS source=OWNER_PRICE_SNAPSHOT projection=producer+supplier+snapshot fail-closed=true');
`);

const pkgPath='package.json';
let pkg=await read(pkgPath);
pkg=replaceOnce(pkg,'node scripts/qa-client-current-context-consumers-v1.mjs && node scripts/qa-client-backend-context-scope-v1.mjs','node scripts/qa-client-current-context-consumers-v1.mjs && node scripts/qa-client-price-authority-v1.mjs && node scripts/qa-client-backend-context-scope-v1.mjs','package.priceQA');
await write(pkgPath,pkg);

await write('scripts/qa-client-contract-authoritative-projection.mjs', `import { readFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { strict as assert } from 'node:assert';
const read=path=>readFile(path,'utf8');
const runtime=await read('assets/portal-runtime/client-contract-download-v3.js');
const phase5d=await read('supabase/functions/rona-portal-api/phase5d.ts');
const router=await read('supabase/functions/rona-portal-api/index.ts');
const builtRuntime=await read('dist/assets/portal-runtime/client-contract-download-v3.js');
const builtClient=await read('dist/portal/client.html');
for(const marker of ['20260902-client-contract-v4-current-context-authority','20260829-client-contract-v3-authoritative-projection-v5','RONA_CLIENT_CONTEXT','authority.subscribe','/v1/client/context?clientId=','current_external_contract_number','legal_name','function hydrateFrozenClientModel',"typeof CLIENT_CONTEXTS!=='undefined'",'function currentContractDocument',"type(d)==='SIGNED_CONTRACT'&&materialized(d)",'new MutationObserver',"document.addEventListener('click',()=>scheduleRender(140),true)",'Скачать договор PDF','/v1/client/storage/','/signed-url','storage_object_id','Файл подписанного контракта не опубликован в кабинете'])assert(runtime.includes(marker),\`runtime missing \${marker}\`);
for(const forbidden of ['/v1/client/bootstrap','function selectedContextEntry','function hookContextSetter','01/РТ-01-1926','01/РТ-02-1926','01/PT-02-1926'])assert(!runtime.includes(forbidden),\`runtime contains retired local authority \${forbidden}\`);
assert(phase5d.includes('current_external_contract_number'),'client context must project external contract number');
assert(phase5d.includes("so.storage_state='VERIFIED'"),'client documents must require VERIFIED storage');
assert(router.includes('/v1/client/context'),'router must expose client context endpoint');
assert(router.includes('server_client_storage_object'),'signed-storage route must enforce server access gate');
assert.equal(builtRuntime,runtime,'built contract runtime must equal source asset');
const srcs=[...builtClient.matchAll(/<script\\b[^>]*\\bsrc=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
assert(srcs.some(src=>src.includes('client-contract-download-v3.js')),'build must load contract runtime');
const manifest=JSON.parse(await read('portal-src/current/client/manifest.json'));
const encoded=(await Promise.all(manifest.chunks.map(name=>read(\`portal-src/current/client/\${name}\`)))).join('');
const frozen=brotliDecompressSync(Buffer.from(encoded,'base64')).toString('utf8');
for(const marker of ['id="clientContextSelect"','CLIENT_CONTEXTS','setClientContext','Номер уточняется','Контракт пока недоступен'])assert(frozen.includes(marker),\`frozen Client bridge surface missing \${marker}\`);
console.log('CLIENT_CONTRACT_AUTHORITATIVE_PROJECTION=PASS context=RONA_CLIENT_CONTEXT scope=CURRENT_CONTEXT_ONLY');
`);

await write('.github/workflows/client-background-section-preload-qa.yml', `name: client-background-section-preload-qa
on:
  pull_request:
    branches: ['release/public-go-live-v1.1']
  push:
    branches: ['fix/client-context-universal-modules-v1','release/public-go-live-v1.1']
permissions:
  contents: read
jobs:
  client-background-preload:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Verify current-context preload contract and build
        shell: bash
        run: |
          set -euo pipefail
          node tests/client-background-section-preload-v1.test.mjs
          npm run build
          grep -q 'id="rona-client-background-section-preload-v1"' dist/portal/client.html
          grep -q '/assets/portal-runtime/client-background-section-preload-v1.js?v=20260902-current-context-v6' dist/portal/client.html
          grep -q '20260902-client-background-section-preload-current-context-v6' dist/assets/portal-runtime/client-background-section-preload-v1.js
          node -e "const x=require('./dist/canonical-visual-integrity.json');const b=x.client_runtime?.background_section_preload;if(!b||b.mode!=='CORE_CLIENT_SECTIONS_BACKGROUND_PRELOAD'||b.scope!=='CURRENT_AUTHORIZED_CLIENT_CONTEXT_ONLY'||b.context_source!=='RONA_CLIENT_CONTEXT_AUTHORITY'||b.read_only!==true||b.visual_change!==false||b.business_mutation!==false)process.exit(1)"
`);

await write('.github/workflows/client-home-authoritative-qa.yml', `name: Client Home command center QA
on:
  pull_request:
    branches: ['release/public-go-live-v1.1']
  push:
    branches: ['fix/client-context-universal-modules-v1','release/public-go-live-v1.1']
permissions:
  contents: read
jobs:
  client-home-command-center:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Verify Home uses single current-context authority
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/portal-runtime/client-home-command-center-v2.js
          node -e "const fs=require('fs'),r=fs.readFileSync('assets/portal-runtime/client-home-command-center-v2.js','utf8');for(const m of ['20260902-client-home-command-center-v3-current-context','RONA_CLIENT_CONTEXT','function currentContext()','authority.subscribe','/v1/client/context?clientId=',\"source:'CURRENT_CONTEXT_HOME_PROJECTION'\",\"mode:'COMMAND_CENTER'\",'current_status_label','resource_label','payment_label','payment_obligation_amount','payment_received_amount'])if(!r.includes(m))throw Error('missing '+m);for(const m of ['/v1/client/bootstrap','CLIENT_CONTEXTS','setClientContext','RONA-C001','DEAL-2026-004','UNIVERSAL SOLYARIS','FARGONA'])if(r.includes(m))throw Error('retired '+m)"
          npm run build
          grep -q 'id="rona-client-home-command-center-v2"' dist/portal/client.html
          grep -q 'id="rona-client-home-first-paint-guard"' dist/portal/client.html
          if grep -q 'id="rona-client-home-authoritative-v1"' dist/portal/client.html; then exit 1; fi
`);

await write('.github/workflows/client-payments-authoritative-qa.yml', `name: Client Payments authoritative runtime QA
on:
  pull_request:
    branches: ['release/public-go-live-v1.1']
  push:
    branches: ['fix/client-context-universal-modules-v1','release/public-go-live-v1.1']
permissions:
  contents: read
jobs:
  client-payments-authoritative:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - name: Verify Payments uses single current-context authority
        shell: bash
        run: |
          set -euo pipefail
          node --check assets/portal-runtime/client-payments-authoritative-v1.js
          node -e "const fs=require('fs'),r=fs.readFileSync('assets/portal-runtime/client-payments-authoritative-v1.js','utf8');for(const m of ['20260902-client-payments-authoritative-v2-current-context','RONA_CLIENT_CONTEXT','function currentContext()','/v1/client/context?clientId=','payment_received_amount','payment_obligation_amount','resource_status','REFRESH_MS=30000'])if(!r.includes(m))throw Error('missing '+m);for(const m of ['/v1/client/bootstrap','CLIENT_CONTEXTS','setClientContext','RONA-C001','DEAL-2026-004'])if(r.includes(m))throw Error('retired '+m)"
          npm run build
          grep -q 'id="rona-client-payments-authoritative-v1"' dist/portal/client.html
          grep -q 'id="rona-client-payments-first-paint-guard"' dist/portal/client.html
`);

console.log('CLIENT_CONTEXT_PRICE_CORRECTIVE_APPLIED');
