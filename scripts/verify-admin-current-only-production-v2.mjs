import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SOURCE='scripts/verify-admin-current-only-production.mjs';
let source=readFileSync(SOURCE,'utf8');

const replacements=[
  [
    "r.headers.get('x-rona-payments-ui')==='admin-payments-v7-native'",
    "r.headers.get('x-rona-payments-ui')==='admin-payments-v7-native-v2'"
  ],
  [
    "const t=await r.text();assert(t.length>0,'main-v2 body empty');return t;",
    "const t=await r.text();assert(t.length>0,'main-v2 body empty');assert(r.headers.get('x-rona-payments-current-runtime')==='conditional-aware-v2',`payments runtime ${r.headers.get('x-rona-payments-current-runtime')}`);for(const marker of ['PAYMENTS_V7_SERVER_AGGREGATE_UI_V2','paymentsV7MergeServerAggregateRows',\"paymentsV7Kpi('Conditional'\",'paymentsV7OwnerMoney(deal?.remaining_to_receive','grid-template-columns:repeat(5,minmax(0,1fr))'])assert(t.includes(marker),`Payments v2 live marker missing: ${marker}`);return t;"
  ],
  [
    "window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v8-radio-final-v9'",
    "window.__RONA_ADMIN_RUNTIME_WATCHDOG__='page-aware-v10-radio-payments-heading'"
  ],
  [
    "'page-aware-v8-radio-final-v9 marker missing'",
    "'page-aware-v10-radio-payments-heading marker missing'"
  ],
  [
    "watchdog:'page-aware-v8-radio-final-v9'",
    "watchdog:'page-aware-v10-radio-payments-heading'"
  ],
  [
    "optionalHeader(r,'x-rona-claims-visual','approved-v4.5.5')",
    "optionalHeader(r,'x-rona-claims-visual','approved-v5.1.2')"
  ],
  [
    "assert(t.includes('ronaClaimsV455Style')&&t.includes('1140px')&&t.includes('372px'),'approved Claims geometry missing')",
    "assert(t.includes('ronaClaimsV455Style')&&t.includes('1480px')&&t.includes('minmax(340px,.82fr)')&&t.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'approved Claims v5.1.2 geometry missing')"
  ]
];

for(const [from,to] of replacements){
  if(!source.includes(from))throw new Error(`CURRENT_PRODUCTION_VERIFIER_SOURCE_MISMATCH:${from}`);
  source=source.replace(from,to);
}

if(source.includes("==='admin-payments-v7-native'"))throw new Error('LEGACY_PAYMENTS_OWNER_EXPECTATION_REMAINS');
if(source.includes("page-aware-v8-radio-final-v9"))throw new Error('LEGACY_WATCHDOG_EXPECTATION_REMAINS');
if(source.includes("x-rona-claims-visual','approved-v4.5.5"))throw new Error('LEGACY_CLAIMS_VISUAL_EXPECTATION_REMAINS');
if(source.includes("t.includes('1140px')&&t.includes('372px')"))throw new Error('LEGACY_CLAIMS_GEOMETRY_EXPECTATION_REMAINS');

const target=join(tmpdir(),`rona-admin-production-v2-${process.pid}-${Date.now()}.mjs`);
try{
  writeFileSync(target,source,'utf8');
  await import(`${pathToFileURL(target).href}?v=${Date.now()}`);
  console.log('ADMIN_CURRENT_ONLY_PRODUCTION_V2_VERIFIER=PASS');
}finally{
  rmSync(target,{force:true});
}
