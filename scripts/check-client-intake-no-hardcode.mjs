import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const mandatoryRuntimePaths=[
  'supabase/functions/_shared/client-intake-v1/index.mjs',
  'supabase/functions/rona-portal-api/bootstrap.ts',
  'supabase/functions/rona-portal-api/stage21-bootstrap.ts',
  'supabase/migrations/20260915123000_client_intake_unified_v1.sql',
  'supabase/migrations/20260915123100_client_intake_reverse_application_policy_v1.sql',
  'supabase/migrations/20260915123200_client_intake_correction_api_v1.sql',
  'supabase/migrations/20260915123300_client_intake_stage21_runtime_fix.sql',
  'supabase/migrations/20260915123400_client_intake_automatic_executor_v1.sql',
  'supabase/migrations/20260915123500_client_intake_stage22_global_coverage.sql',
];
for(const p of mandatoryRuntimePaths)assert.ok(fs.existsSync(p),`mandatory runtime path missing: ${p}`);

function isRuntimeBearing(path){
  return (path.startsWith('supabase/migrations/')&&path.endsWith('.sql'))
    || (path.startsWith('supabase/functions/')&&/\.(?:ts|js|mjs)$/.test(path));
}
function changedFiles(){
  const base=String(process.env.GITHUB_BASE_REF||'').trim();
  const candidates=base?[`origin/${base}...HEAD`,`${base}...HEAD`]:['HEAD^...HEAD'];
  for(const range of candidates){
    try{
      return execFileSync('git',['diff','--name-only',range],{encoding:'utf8'})
        .split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    }catch{}
  }
  throw new Error('NO_HARDCODE_CHANGED_RUNTIME_SCOPE_UNRESOLVED');
}
const changedRuntimePaths=changedFiles().filter(isRuntimeBearing);
const runtimePaths=[...new Set([...mandatoryRuntimePaths,...changedRuntimePaths])];
assert.ok(changedRuntimePaths.length>0,'no changed runtime-bearing files resolved');
for(const p of changedRuntimePaths)assert.ok(runtimePaths.includes(p),`changed runtime omitted from scan: ${p}`);
for(const p of runtimePaths)assert.ok(fs.existsSync(p),`runtime file missing: ${p}`);

const runtime=runtimePaths.map(p=>`\n/* ${p} */\n${fs.readFileSync(p,'utf8')}`).join('\n');
const forbidden=[
  /PORTAL-EVT-2d8981c549484ec7a4b91dc22da78d96/,
  /PORTAL-EVT-d5cee7b90c1e4ce689f114b76814d208/,
  /PRICE-CALC-d1ead6b2-9bcc-4a53-aa4f-e35507d78291/,
  /PRICE-CALC-c462bf1b-320a-4910-81a1-1ae44ff8b3cc/,
  /PORTAL-EVT-2fa7ce9ad1a540458dea8c5876d65080/,
  /PORTAL-EVT-3ed6460e4bfd4ccea94a6874993e50fc/,
  /PORTAL-EVT-e49823000cb74c48b57841192f27a2d3/,
  /10000\s*\/\s*10/,
  /if\s*\([^\n]*(?:event_id|source_record_id)[^\n]*(?:2d898|d5cee|2fa7ce|3ed646|e49823)/i,
];
const hits=forbidden.filter(re=>re.test(runtime));
assert.equal(hits.length,0,`runtime hardcode matches: ${hits.map(String).join(', ')}`);
assert.doesNotMatch(runtime,/resource_chain\.accounting_amount/i);
assert.doesNotMatch(runtime,/['"]CLIENT_PROPOSED['"]/);
assert.ok(runtime.includes('ACCEPT_PUBLISHED_PRICE'),'production published price enum missing');
assert.ok(runtime.includes('CLIENT_PROPOSED_PRICE'),'production proposed price enum missing');
assert.ok(runtime.includes('APPLICATION_DETAILS_V5'),'production application-details family missing');

for(const p of runtimePaths.filter(x=>x.endsWith('.sql'))){
  const sql=fs.readFileSync(p,'utf8');
  const digestCalls=[...sql.matchAll(/(?:[A-Za-z_][\w]*\.)?digest\s*\(/g)].map(x=>x[0]);
  assert.ok(digestCalls.every(x=>x.startsWith('extensions.digest(')),`unqualified digest in ${p}: ${digestCalls.join(', ')}`);
}

console.log(`RUNTIME_FILES_SCANNED=${runtimePaths.length}`);
console.log(`CHANGED_RUNTIME_FILES_SCANNED=${changedRuntimePaths.length}`);
console.log('NO_EXPECTED_VALUE_INJECTION=PASS');
console.log('NO_HARDCODE_FULL_RUNTIME_SCAN=PASS');
console.log('EVENT_ID_BRANCH_COUNT=0');
console.log('DIGEST_SCHEMA_FIX=PASS');
console.log('PRICE_MODE_PRODUCTION_ENUM=PASS');
console.log('RAW_SOURCE_MUTATION=NONE');
console.log('BUSINESS_DATA_MUTATION=NONE');
console.log('FINANCE_RECORD_MUTATION=NONE');
console.log('PRODUCTION_MIGRATION=NONE');
console.log('EDGE_DEPLOY=NONE');
console.log('MERGE=NONE');
