import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const path='supabase/functions/rona-g82-github-oidc-browser-qa-20260816/index.ts';
const source=readFileSync(path,'utf8');
function gitBlob(data){return createHash('sha1').update('blob '+Buffer.byteLength(data)+'\0'+data).digest('hex');}

test('release OIDC script is byte-identical to deployed Supabase Edge v127',()=>{
  assert.equal(source.length,30043);
  assert.equal(gitBlob(source),'45a44bc3c07c63caf23f2240c663157e34700da3');
  assert.equal(readFileSync('supabase/functions/rona-g82-github-oidc-browser-qa-20260816/deno.json','utf8').length,105);
});
test('deployed v127 prevents legacy PR462 Admin issuance and preserves the signed OIDC trust boundary',()=>{
  assert.match(source,/async function verifyGithubOidc\(token\)/);
  assert.match(source,/crypto\.subtle\.verify\("RSASSA-PKCS1-v1_5"/);
  assert.match(source,/claims\.repository!==REPO/);
  assert.match(source,/if\(verified\.profile==="LEGACY"\)\{\s*return json\(410,\{ok:false,code:"PR462_LEGACY_QA_ADMIN_ISSUANCE_RETIRED"\}\)/);
  assert.doesNotMatch(source,/await issueLegacy\(claims\)/);
  assert.match(source,/if\(verified\.profile==="ISSUE430"\)/);
  assert.match(source,/if\(verified\.profile==="RADIO_STAGE2A"\)/);
  assert.match(source,/RADIO_STAGE2C1_WORKFLOW/);
  assert.match(source,/async function cleanupByRun\(/);
  assert.match(source,/async function issue430\(/);
  assert.match(source,/await revoke430\(claims,body\)/);
});
test('no unintended changes to current Admin and Client visual owner sources',()=>{
  const admin=readFileSync('portal-src/current/admin.html','utf8');
  const client=readFileSync('assets/portal-runtime/client-context-selection-authority-v1.js','utf8');
  assert.equal(gitBlob(admin),'cca468590d2353f64d30300284a302479a2b972c','accepted Admin visual source changed');
  assert.equal(gitBlob(client),'abe541dbd6162dd7cc03462e1b37ba23d6fb5b60','accepted Client context source changed');
});
